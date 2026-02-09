"""
HTML Template Engine for report generation.

Uses simple {{PLACEHOLDER}} syntax for template population.
"""
import re
from pathlib import Path
from typing import Dict, Any, Optional
from loguru import logger


class TemplateEngine:
    """
    Simple template engine using {{PLACEHOLDER}} syntax.

    Supports:
    - Simple placeholders: {{TICKER}}
    - Default values: {{volume|N/A}}
    """

    PLACEHOLDER_PATTERN = re.compile(r'\{\{([^}]+)\}\}')

    def __init__(self, template_dir: Optional[str] = None):
        if template_dir:
            self.template_dir = Path(template_dir)
        else:
            self.template_dir = Path(__file__).parent / "templates"

    def render(
        self,
        template: str,
        data: Dict[str, Any],
    ) -> str:
        """
        Render a template with data.

        Args:
            template: Template filename or HTML string
            data: Data dictionary for placeholder replacement

        Returns:
            Rendered HTML string
        """
        # Load template
        if template.endswith('.html'):
            template_path = self.template_dir / template
            if not template_path.exists():
                raise FileNotFoundError(f"Template not found: {template_path}")
            html = template_path.read_text(encoding='utf-8')
        else:
            html = template

        # Process placeholders
        html = self._process_placeholders(html, data)

        return html

    def _process_placeholders(self, html: str, context: Dict[str, Any]) -> str:
        """Replace {{placeholder}} with values."""
        def replace(match):
            key = match.group(1).strip()

            # Handle default values: {{key|default}}
            if '|' in key:
                key, default = key.split('|', 1)
                key = key.strip()
                default = default.strip()
            else:
                default = ''

            # Get value from context
            value = context.get(key)

            if value is None:
                return default

            return str(value)

        return self.PLACEHOLDER_PATTERN.sub(replace, html)

    def format_number(self, value: float, prefix: str = "$") -> str:
        """Format large numbers with B/M/K suffixes."""
        if value is None:
            return "N/A"

        abs_value = abs(value)
        if abs_value >= 1_000_000_000:
            return f"{prefix}{value/1_000_000_000:.2f}B"
        elif abs_value >= 1_000_000:
            return f"{prefix}{value/1_000_000:.2f}M"
        elif abs_value >= 1_000:
            return f"{prefix}{value/1_000:.2f}K"
        else:
            return f"{prefix}{value:.2f}"

    def format_percent(self, value: float) -> str:
        """Format percentage with sign."""
        if value is None:
            return "N/A"
        sign = "+" if value > 0 else ""
        return f"{sign}{value:.1f}%"


# Singleton
_template_engine: Optional[TemplateEngine] = None


def get_template_engine() -> TemplateEngine:
    """Get or create template engine singleton."""
    global _template_engine
    if _template_engine is None:
        _template_engine = TemplateEngine()
    return _template_engine
