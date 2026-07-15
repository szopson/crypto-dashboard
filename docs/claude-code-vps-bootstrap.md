# Claude Code na VPS — bootstrap 1:1 (z pętlą Codex)

Cel: odtworzyć na serwerze VPS (Linux, headless) dokładnie to środowisko Claude
Code, które działa na Macu Jakuba: globalny CLAUDE.md z pętlą plan-review
Codexa, plugin `codex@openai-codex` (/codex:rescue, /codex:setup, agent
codex-rescue), pluginy oficjalne, skille globalne i projektowe (mattpocock:
grilling → tdd → code-review itd.).

Dokument ma dwie części: **A** — co skopiować z Maca (sekrety i rzeczy
niereprodukowalne), **B** — prompt do wklejenia w Claude Code na VPS, który
robi całą resztę sam.

---

## Część A — skopiuj z Maca (przed startem)

Te rzeczy NIE są w żadnym repo i musisz je przenieść ręcznie (z Maca):

```bash
VPS=user@twoj-vps   # dostosuj

# 1. Globalny CLAUDE.md (pętla Codex plan-review) + settings
ssh $VPS 'mkdir -p ~/.claude'
scp ~/.claude/CLAUDE.md $VPS:~/.claude/CLAUDE.md

# 2. Globalne skille (marketingowe/osobiste — opcjonalne na serwerze,
#    ale "1:1" = kopiujemy)
rsync -a ~/.claude/skills/ $VPS:~/.claude/skills/

# 3. Skille projektowe crypto-dashboard — UWAGA: poza `setup` są
#    GITIGNOROWANE, git clone ich nie przyniesie. Kopiuj po sklonowaniu repo:
rsync -a ~/IdeaProjects/crypto-dashboard/.claude/skills/ \
  $VPS:~/crypto-dashboard/.claude/skills/

# 4. Autoryzacja Codex CLI — ZALECANE: loguj się per maszyna na VPS-ie:
#      codex login --device-auth   # kod wpisujesz na auth.openai.com/codex/device
#    (zwykłe `codex login` nie działa headless; device-auth trwa minutę).
#    Alternatywa (sekret): scp ~/.codex/auth.json + chmod 600.
```

Czego się NIE DA przenieść 1:1 i dlaczego:

- **Konektory claude.ai MCP** (Gmail, Calendly, Notion, Shopify, Higgsfield,
  Alpha Vantage…) — są przypięte do sesji claude.ai; na VPS po zalogowaniu
  podłącz przez `/mcp` te, których faktycznie potrzebujesz.
- **Claude in Chrome** — tylko desktop; na serwerze zamiennikiem jest plugin
  `playwright` (jest na liście do włączenia niżej).
- **Hooki powiadomień** — na Macu to `osascript` (dźwięk Glass); na Linuksie
  nie istnieje, więc settings poniżej ich nie zawiera. Jak chcesz powiadomienia
  z VPS, dopisz hook z `curl` do ntfy.sh/Telegrama.
- **Pamięć projektowa** (`~/.claude/projects/<ścieżka>/memory/`) — jest
  per-ścieżka-projektu; skopiuj analogicznie rsynciem, jeśli chcesz zachować
  wspomnienia agenta o projekcie.

---

## Część B — prompt dla Claude Code na VPS

Zainstaluj i zaloguj Claude Code (to jedyne dwa kroki ręczne):

```bash
# Node 20+ (jeśli brak): https://github.com/nvm-sh/nvm
npm install -g @anthropic-ai/claude-code
claude   # → /login (konto Anthropic)
```

Potem wklej Claude Code PONIŻSZY blok w całości jako jedno polecenie:

---

Skonfiguruj to środowisko Claude Code 1:1 według poniższej specyfikacji.
Pracuj krok po kroku, weryfikuj każdy krok, nie pomijaj żadnego.

**1. Codex CLI.** Sprawdź `codex --version`. Jeśli brak, zainstaluj:
`npm install -g @openai/codex` oraz `apt-get install -y bubblewrap` (sandbox
dla Codexa na Linuksie — bez niego warning przy każdym runie). Potem sprawdź
autoryzację: `codex login status`. Jeśli niezalogowany, powiedz mi, że mam
uruchomić `codex login --device-auth` (kod wpisuje się na
auth.openai.com/codex/device) i zatrzymaj się w tym kroku, aż potwierdzę.

**2. Globalny `~/.claude/settings.json`.** Utwórz (lub scal z istniejącym)
dokładnie tę zawartość:

```json
{
  "model": "claude-fable-5[1m]",
  "effortLevel": "high",
  "tui": "fullscreen",
  "enabledPlugins": {
    "context7@claude-plugins-official": true,
    "typescript-lsp@claude-plugins-official": true,
    "pyright-lsp@claude-plugins-official": true,
    "frontend-design@claude-plugins-official": true,
    "github@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true,
    "serena@claude-plugins-official": true,
    "playwright@claude-plugins-official": true,
    "agent-sdk-dev@claude-plugins-official": true,
    "code-review@claude-plugins-official": true,
    "ralph-loop@claude-plugins-official": true,
    "code-simplifier@claude-plugins-official": true,
    "security-guidance@claude-plugins-official": true,
    "commit-commands@claude-plugins-official": true,
    "vercel@claude-plugins-official": true,
    "codex@openai-codex": true
  },
  "extraKnownMarketplaces": {
    "claude-plugins-official": {
      "source": { "source": "github", "repo": "anthropics/claude-plugins-official" }
    },
    "openai-codex": {
      "source": { "source": "github", "repo": "openai/codex-plugin-cc" }
    }
  }
}
```

(To jest zestaw z Maca zredukowany o pluginy bez sensu na serwerze — LSP dla
Go/Rust/C#/Java/PHP, Notion, GitLab, Obsidian, Apify, ui-ux-pro-max. Jeśli
któregoś zabraknie, dorejestrujesz marketplace i włączysz analogicznie.)

**3. Pluginy.** Uruchom `claude plugin marketplace add
anthropics/claude-plugins-official` oraz `claude plugin marketplace add
openai/codex-plugin-cc`, a następnie zainstaluj każdy plugin z listy
`enabledPlugins` powyżej (`claude plugin install <nazwa>@<marketplace>`).
Zweryfikuj `claude plugin list`.

**4. Globalny `~/.claude/CLAUDE.md`.** Jeśli nie został skopiowany z Maca
(sprawdź, czy plik istnieje i zawiera nagłówek "Codex plan-review loop"),
utwórz go z dokładnie tą treścią:

```markdown
# Global Claude Instructions

> These apply to all Claude Code sessions on this machine.

## Codex plan-review loop

For complex implementation work, use Codex as a second-opinion reviewer before
editing code. This applies when the task requires an implementation plan,
touches multiple components, changes architecture or data flow, involves a
migration, authentication/security, concurrency, or has meaningful rollback or
data-loss risk. Skip this loop for small, obvious, low-risk changes.

1. Explore the repository and produce a concrete draft plan first.
2. Before implementation, ask the `codex:codex-rescue` subagent to review that
   plan in read-only mode. Include the draft plan and relevant repository
   context. Tell Codex explicitly: do not edit files; identify incorrect
   assumptions, missing steps, edge cases, simpler alternatives, testing gaps,
   and rollback risks; return a concise corrected plan.
3. Evaluate Codex's feedback rather than accepting it blindly. Resolve
   conflicts using repository evidence, then update the plan.
4. Implement the reconciled plan in Claude Code and run the project's normal
   verification.

Fail open: if Codex is unavailable, unauthenticated, times out, reports a usage
or rate limit, or the plugin fails, mention that briefly and continue without
Codex. Do not retry repeatedly and do not block implementation. Use at most one
Codex plan-review pass unless the user explicitly asks for another.
```

**5. Weryfikacja końcowa.** Po kolei:
- `claude plugin list` — wszystkie pluginy z punktu 2 obecne i enabled;
- `codex login status` — "Logged in";
- smoke test Codexa bez repo:
  `codex exec --skip-git-repo-check --sandbox read-only "reply OK" < /dev/null`;
- w nowej sesji `/codex:setup` — ma potwierdzić, że Codex CLI jest gotowy;
- jeśli katalog `~/.claude/skills/` został wgrany, sprawdź w nowej sesji, że
  skille są widoczne na liście.

Na końcu wypisz mi tabelę: komponent → status (OK/brak) → co ewentualnie
zostało do zrobienia ręcznie.

---

## Jak działa workflow po bootstrapie (przypomnienie)

- Duże zadanie → Claude Code robi plan → **automatycznie** (przez globalny
  CLAUDE.md) wysyła plan do `codex:codex-rescue` w trybie read-only → scala
  uwagi → implementuje. Fail-open: brak Codexa nie blokuje pracy.
- Ręczne wywołania: `/codex:rescue` (oddaj zadanie/diagnozę Codexowi),
  `/codex:setup` (health-check + bramka review na stop).
- Workflow projektowy (skille mattpocock w repo): `grilling` (przemagluj plan)
  → `tdd` (red-green-refactor) → `code-review` / `adversarial-review`.
- W repo crypto-dashboard dodatkowo: `/setup [COIN]` — perp setup z Hyperliquid.
