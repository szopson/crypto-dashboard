"""
Sector brief generator.

Takes a sector slug, reads frontmatter from every report in that sector,
and produces a sector overview MDX with:
- Thesis (why this sector, where we are in the cycle)
- Macro tailwinds / headwinds
- Top picks (ranked from member reports)
- Watch list (lower-conviction names)
- Risks
- Catalysts to watch

Output: content/sector_briefs/{slug}.mdx (and frontend/content/sector_briefs/...)
"""
import asyncio
import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

import anthropic
import yaml
from loguru import logger

from .sectors import SECTORS


SECTOR_ANALYST_SYSTEM = """You are a senior macro/sector strategist writing a concise sector brief that complements detailed equity reports. Style: terse, opinionated, specific, no fence-sitting. Bloomberg/Briefing.com vibe.

Output MUST be a single JSON object with the exact schema specified — no markdown fences, no extra text."""


SECTOR_BRIEF_SCHEMA = """Schema:

{
  "headline": "<8-12 word sector-defining statement>",
  "stance": "BULLISH | NEUTRAL | BEARISH | MIXED",
  "thesis": "<3-4 sentence sector thesis — why now, what drives outcomes>",
  "macro_tailwinds": ["<tailwind 1>", "<tailwind 2>", "<tailwind 3>"],
  "macro_headwinds": ["<headwind 1>", "<headwind 2>", "<headwind 3>"],
  "where_in_cycle": "<1-2 sentences placing the sector in its cycle: early innings, peak euphoria, digestion, capitulation, etc.>",
  "top_picks_commentary": "<2-3 sentences contextualizing the highest-conviction names from the member reports>",
  "watch_list_commentary": "<1-2 sentences on speculative/early-stage names worth monitoring>",
  "risks": ["<risk 1>", "<risk 2>", "<risk 3>", "<risk 4>"],
  "catalysts_to_watch": [
    {"event": "<event name>", "timing": "<e.g. 'Q3 2026' or '2026-09-15'>", "implication": "<1 sentence>"},
    ... 3-4 catalysts
  ],
  "verdict": "<2-3 sentences with actionable takeaway>"
}
"""


def _md_escape(text: Any) -> str:
    """Escape characters in plain narrative markdown text that MDX would
    otherwise parse as JSX. Concretely: any `<` followed by a non-letter
    (e.g. `<15%`, `<$80`, `< 10`) is converted to `&lt;`."""
    if text is None:
        return ""
    s = str(text)
    # Replace `<` not immediately followed by a letter, `!`, or `/`
    return re.sub(r"<(?![A-Za-z!/])", "&lt;", s)


def _parse_frontmatter(text: str) -> dict[str, Any]:
    m = re.match(r"^---\n(.*?)\n---", text, flags=re.DOTALL)
    if not m:
        return {}
    try:
        return yaml.safe_load(m.group(1)) or {}
    except Exception:
        return {}


class SectorBriefGenerator:
    def __init__(
        self,
        reports_root: str | Path = "content/reports",
        briefs_root: str | Path = "content/sector_briefs",
        anthropic_api_key: Optional[str] = None,
        model: str = "claude-sonnet-4-5",
    ):
        import os
        api_key = anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY required")
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model
        self.reports_root = Path(reports_root)
        self.briefs_root = Path(briefs_root)
        self.briefs_root.mkdir(parents=True, exist_ok=True)

    def _gather_member_reports(self, sector_slug: str) -> list[dict[str, Any]]:
        sector_dir = self.reports_root / sector_slug
        if not sector_dir.exists():
            return []
        out = []
        for p in sorted(sector_dir.glob("*.mdx")):
            try:
                text = p.read_text(encoding="utf-8")
                fm = _parse_frontmatter(text)
                if not fm:
                    continue
                out.append({
                    "ticker": fm.get("ticker"),
                    "company": fm.get("company"),
                    "rating": fm.get("rating"),
                    "target_price": fm.get("target_price"),
                    "upside_pct": fm.get("upside_pct"),
                    "time_horizon": fm.get("time_horizon"),
                    "one_liner": fm.get("one_liner"),
                    "price_at_report": fm.get("price_at_report"),
                    "market_cap": fm.get("market_cap"),
                    "industry": fm.get("industry"),
                })
            except Exception as e:
                logger.warning(f"skip {p}: {e}")
        return out

    async def generate(self, sector_slug: str) -> Path:
        sector = SECTORS.get(sector_slug)
        if not sector:
            raise ValueError(f"Unknown sector: {sector_slug}")

        members = self._gather_member_reports(sector_slug)
        logger.info(f"Sector {sector_slug}: {len(members)} member report(s)")

        prompt = f"""Produce a sector brief for "{sector['name']}" ({sector['description']}).

Today's date: {date.today().isoformat()}

Member reports currently in coverage ({len(members)} stocks):
{json.dumps(members, indent=2, default=str)}

Use these member reports' ratings, targets, and one-liners as anchor points — but feel free to add macro perspective the individual reports cannot. If there are no member reports yet, write the brief from general sector knowledge.

{SECTOR_BRIEF_SCHEMA}
"""

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                system=SECTOR_ANALYST_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            ),
        )

        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            if text.startswith("json\n"):
                text = text[5:]
        text = text.strip()
        brief = json.loads(text)

        out_path = self.briefs_root / f"{sector_slug}.mdx"
        out_path.write_text(self._render_mdx(sector, brief, members), encoding="utf-8")
        logger.info(f"Wrote sector brief: {out_path}")
        return out_path

    def _render_mdx(self, sector: dict, brief: dict, members: list[dict]) -> str:
        frontmatter = {
            "sector_slug": sector["slug"],
            "sector_name": sector["name"],
            "headline": brief.get("headline"),
            "stance": brief.get("stance"),
            "date": date.today().isoformat(),
            "generated_at": datetime.utcnow().isoformat(),
            "member_count": len(members),
        }

        def json_prop(obj: Any) -> str:
            raw = json.dumps(obj, default=str, ensure_ascii=False)
            safe = raw.replace("&", "&amp;").replace('"', "&quot;")
            return '"' + safe + '"'

        body = f"""<SectorBriefHeader
  sectorName={json.dumps(sector["name"])}
  headline={json.dumps(brief.get("headline"))}
  stance={json.dumps(brief.get("stance"))}
  memberCount="{len(members)}"
/>

**Thesis.** {_md_escape(brief.get("thesis", ""))}

**Where we are in the cycle.** {_md_escape(brief.get("where_in_cycle", ""))}

## Macro context

<MacroSplit tailwinds={json_prop(brief.get("macro_tailwinds", []))} headwinds={json_prop(brief.get("macro_headwinds", []))} />

## Top picks

{_md_escape(brief.get("top_picks_commentary", ""))}

<SectorRankings members={json_prop(members)} />

## Watch list

{_md_escape(brief.get("watch_list_commentary", ""))}

## Risks

<RiskList items={json_prop(brief.get("risks", []))} />

## Catalysts to watch

<CatalystsTimeline items={json_prop(brief.get("catalysts_to_watch", []))} />

## Verdict

{_md_escape(brief.get("verdict", ""))}
"""
        return "---\n" + yaml.safe_dump(frontmatter, sort_keys=False, allow_unicode=True) + "---\n\n" + body


_singleton: Optional[SectorBriefGenerator] = None


def get_sector_brief_generator(**kwargs) -> SectorBriefGenerator:
    global _singleton
    if _singleton is None:
        _singleton = SectorBriefGenerator(**kwargs)
    return _singleton
