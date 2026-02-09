"""
SVG Chart Generator for PDF reports.

Generates pie charts, circle gauges, and other visualizations.
"""
import math
from typing import List, Tuple


def generate_pie_slice_path(
    cx: float,
    cy: float,
    radius: float,
    start_angle: float,
    end_angle: float,
) -> str:
    """
    Generate SVG path for a pie slice.

    Args:
        cx, cy: Center coordinates
        radius: Circle radius
        start_angle: Start angle in degrees (0 = right, 90 = bottom)
        end_angle: End angle in degrees

    Returns:
        SVG path d attribute
    """
    # Convert to radians
    start_rad = math.radians(start_angle - 90)  # Adjust so 0 is at top
    end_rad = math.radians(end_angle - 90)

    # Calculate arc points
    x1 = cx + radius * math.cos(start_rad)
    y1 = cy + radius * math.sin(start_rad)
    x2 = cx + radius * math.cos(end_rad)
    y2 = cy + radius * math.sin(end_rad)

    # Large arc flag
    large_arc = 1 if (end_angle - start_angle) > 180 else 0

    # Pie slice path (from center to arc and back)
    return f"M {cx} {cy} L {x1} {y1} A {radius} {radius} 0 {large_arc} 1 {x2} {y2} Z"


def generate_pie_chart_paths(
    percentages: List[float],
    cx: float = 100,
    cy: float = 100,
    radius: float = 80,
) -> List[str]:
    """
    Generate SVG paths for pie chart slices.

    Args:
        percentages: List of percentages (should sum to 100)
        cx, cy: Center coordinates
        radius: Circle radius

    Returns:
        List of SVG path d attributes
    """
    paths = []
    current_angle = 0

    for pct in percentages:
        if pct <= 0:
            paths.append("")
            continue

        angle = (pct / 100) * 360
        end_angle = current_angle + angle

        # Handle full circle case
        if angle >= 359.9:
            paths.append(f"M {cx} {cy - radius} A {radius} {radius} 0 1 1 {cx - 0.01} {cy - radius} A {radius} {radius} 0 1 1 {cx} {cy - radius} Z")
        else:
            paths.append(generate_pie_slice_path(cx, cy, radius, current_angle, end_angle))

        current_angle = end_angle

    return paths


def calculate_circle_offset(percentage: float, radius: float = 52) -> float:
    """
    Calculate stroke-dashoffset for circular progress indicator.

    Args:
        percentage: Value from 0 to 100
        radius: Circle radius (default: 52 as in template)

    Returns:
        stroke-dashoffset value

    Formula: circumference = 2 * pi * r = 326.7 for r=52
             offset = circumference * (1 - percentage/100)
    """
    circumference = 2 * math.pi * radius
    offset = circumference * (1 - min(max(percentage, 0), 100) / 100)
    return round(offset, 1)


def get_metric_class(value: float, thresholds: Tuple[float, float] = (33, 66)) -> str:
    """
    Get CSS class for metric based on value.

    Args:
        value: Metric value (0-100 scale)
        thresholds: (low, high) thresholds

    Returns:
        CSS class: "negative", "neutral-fill", or "positive"
    """
    if value < thresholds[0]:
        return "negative"
    elif value < thresholds[1]:
        return "neutral-fill"
    else:
        return "positive"


def get_rating_class(rating: str) -> str:
    """
    Get CSS class based on rating text.

    Args:
        rating: Rating text like "Strong", "Moderate", "Weak"

    Returns:
        CSS class: "strong", "moderate", or "weak"
    """
    rating_lower = rating.lower()
    if "strong" in rating_lower or "high" in rating_lower or "good" in rating_lower:
        return "strong"
    elif "moderate" in rating_lower or "medium" in rating_lower or "average" in rating_lower:
        return "moderate"
    else:
        return "weak"


def format_bar_width(value: float, max_value: float = 100) -> int:
    """
    Calculate bar width percentage.

    Args:
        value: Current value
        max_value: Maximum value

    Returns:
        Width percentage (0-100)
    """
    if max_value <= 0:
        return 0
    return min(max(int((value / max_value) * 100), 0), 100)


def generate_catalyst_html(
    catalysts: List[dict],
) -> str:
    """
    Generate HTML for catalyst timeline items.

    Args:
        catalysts: List of dicts with 'quarter', 'title', 'description'

    Returns:
        HTML string for catalyst items
    """
    html_parts = []

    for i, catalyst in enumerate(catalysts):
        position = "left" if i % 2 == 0 else "right"
        quarter = catalyst.get("quarter", f"Q{i+1}")
        title = catalyst.get("title", "")
        description = catalyst.get("description", "")

        html_parts.append(f'''
        <div class="catalyst-item {position}">
            <div class="catalyst-node">{quarter}</div>
            <div class="catalyst-content">
                <h4>{title}</h4>
                <p>{description}</p>
            </div>
        </div>
        ''')

    return '\n'.join(html_parts)


def generate_swot_items(items: List[str]) -> str:
    """
    Generate HTML list items for SWOT sections.

    Args:
        items: List of SWOT items

    Returns:
        HTML string with <li> elements
    """
    return '\n'.join(f'<li>{item}</li>' for item in items)


def generate_peer_table_rows(peers: List[dict], highlight_first: bool = True) -> str:
    """
    Generate HTML table rows for peer comparison.

    Args:
        peers: List of dicts with peer data
        highlight_first: Whether first row (subject) gets special styling

    Returns:
        HTML string with <tr> elements
    """
    rows = []

    for i, peer in enumerate(peers):
        name = peer.get("name", "")
        market_cap = peer.get("market_cap", "N/A")
        tvl = peer.get("tvl", "N/A")
        mc_tvl = peer.get("mc_tvl", "N/A")
        volume = peer.get("volume", "N/A")
        dev_activity = peer.get("dev_activity", "N/A")
        community = peer.get("community", "N/A")

        rows.append(f'''
        <tr>
            <td>{name}</td>
            <td>{market_cap}</td>
            <td>{tvl}</td>
            <td>{mc_tvl}</td>
            <td>{volume}</td>
            <td>{dev_activity}</td>
            <td>{community}</td>
        </tr>
        ''')

    return '\n'.join(rows)


def generate_risk_items(risks: List[str]) -> str:
    """
    Generate HTML for risk assessment list.

    Args:
        risks: List of risk descriptions

    Returns:
        HTML string with styled risk items
    """
    if not risks:
        return '<li>No significant risks identified</li>'

    items = []
    for risk in risks[:5]:  # Limit to 5 risks
        items.append(f'<li><span class="risk-bullet">⚠</span> {risk}</li>')

    return '\n'.join(items)


def generate_team_badges(badges: List[str]) -> str:
    """
    Generate HTML badges for team attributes.

    Args:
        badges: List of badge labels like "Doxxed", "Experienced", "VC-backed"

    Returns:
        HTML string with badge elements
    """
    if not badges:
        return ''

    # Badge colors based on content
    badge_colors = {
        "doxxed": "var(--accent-green)",
        "anon": "var(--accent-yellow)",
        "experienced": "var(--accent-blue)",
        "vc-backed": "var(--accent-purple)",
        "audited": "var(--accent-green)",
        "new team": "var(--accent-yellow)",
        "veteran": "var(--accent-cyan)",
    }

    items = []
    for badge in badges[:4]:  # Limit to 4 badges
        badge_lower = badge.lower()
        color = badge_colors.get(badge_lower, "var(--accent-blue)")
        items.append(f'<span class="team-badge" style="border-color:{color};color:{color}">{badge}</span>')

    return ' '.join(items)


def generate_product_status_badge(status: str) -> str:
    """
    Generate HTML badge for product status.

    Args:
        status: Product status (idea, whitepaper, testnet, mainnet, production)

    Returns:
        HTML badge element
    """
    status_colors = {
        "idea": ("var(--accent-red)", "Idea Phase"),
        "whitepaper": ("var(--accent-yellow)", "Whitepaper"),
        "testnet": ("var(--accent-cyan)", "Testnet"),
        "mainnet": ("var(--accent-blue)", "Mainnet"),
        "production": ("var(--accent-green)", "Production"),
    }

    color, label = status_colors.get(status.lower(), ("var(--accent-blue)", status.title()))
    return f'<span class="status-badge" style="border-color:{color};color:{color}">{label}</span>'


def generate_github_stats_html(stars: int, forks: int, commits: int, contributors: int) -> str:
    """
    Generate HTML for GitHub statistics grid.

    Args:
        stars: GitHub stars
        forks: GitHub forks
        commits: Commits in last 4 weeks
        contributors: Number of contributors

    Returns:
        HTML string with stats grid
    """
    return f'''
    <div class="github-stats-grid">
        <div class="github-stat">
            <span class="stat-icon">★</span>
            <span class="stat-value">{stars:,}</span>
            <span class="stat-label">Stars</span>
        </div>
        <div class="github-stat">
            <span class="stat-icon">⑂</span>
            <span class="stat-value">{forks:,}</span>
            <span class="stat-label">Forks</span>
        </div>
        <div class="github-stat">
            <span class="stat-icon">●</span>
            <span class="stat-value">{commits:,}</span>
            <span class="stat-label">Commits/4w</span>
        </div>
        <div class="github-stat">
            <span class="stat-icon">👥</span>
            <span class="stat-value">{contributors:,}</span>
            <span class="stat-label">Contributors</span>
        </div>
    </div>
    '''
