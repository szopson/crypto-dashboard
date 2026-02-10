"""
SVG Chart Generator for PDF reports.

Generates pie charts, circle gauges, radar charts, sparklines, and other visualizations.
"""
import math
from typing import List, Tuple, Dict, Any, Optional


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


def generate_radar_chart_svg(
    categories: Dict[str, int],
    size: int = 300,
    show_labels: bool = True,
) -> str:
    """
    Generate SVG radar chart for category scores.

    Args:
        categories: Dict of category name -> score (0-10)
        size: SVG size in pixels
        show_labels: Whether to show category labels

    Returns:
        Complete SVG element string
    """
    if not categories:
        return '<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"></svg>'

    center = size / 2
    radius = size * 0.35
    num_axes = len(categories)
    angle_step = 2 * math.pi / num_axes

    # Background circles (grid)
    circles_svg = ""
    for i in range(1, 6):
        r = radius * (i / 5)
        opacity = 0.3 if i % 2 == 0 else 0.15
        circles_svg += f'<circle cx="{center}" cy="{center}" r="{r}" fill="none" stroke="#4a5568" stroke-width="1" opacity="{opacity}"/>'

    # Axis lines
    axes_svg = ""
    for i in range(num_axes):
        angle = i * angle_step - math.pi / 2
        x_end = center + radius * math.cos(angle)
        y_end = center + radius * math.sin(angle)
        axes_svg += f'<line x1="{center}" y1="{center}" x2="{x_end}" y2="{y_end}" stroke="#4a5568" stroke-width="1" opacity="0.5"/>'

    # Data polygon points
    points = []
    for i, (label, score) in enumerate(categories.items()):
        score = max(0, min(10, score or 0))  # Clamp to 0-10
        angle = i * angle_step - math.pi / 2
        r = radius * (score / 10)
        x = center + r * math.cos(angle)
        y = center + r * math.sin(angle)
        points.append(f"{x},{y}")

    polygon_points = " ".join(points)
    polygon_svg = f'''
    <polygon points="{polygon_points}" fill="rgba(88,166,255,0.25)" stroke="#58a6ff" stroke-width="2"/>
    '''

    # Score dots at each vertex
    dots_svg = ""
    for i, (label, score) in enumerate(categories.items()):
        score = max(0, min(10, score or 0))
        angle = i * angle_step - math.pi / 2
        r = radius * (score / 10)
        x = center + r * math.cos(angle)
        y = center + r * math.sin(angle)
        dots_svg += f'<circle cx="{x}" cy="{y}" r="5" fill="#58a6ff" stroke="#0d1117" stroke-width="2"/>'

    # Labels
    labels_svg = ""
    if show_labels:
        for i, (label, score) in enumerate(categories.items()):
            angle = i * angle_step - math.pi / 2
            label_distance = radius + 25
            x = center + label_distance * math.cos(angle)
            y = center + label_distance * math.sin(angle)

            # Adjust anchor based on position
            if abs(math.cos(angle)) < 0.1:
                anchor = "middle"
            elif math.cos(angle) > 0:
                anchor = "start"
            else:
                anchor = "end"

            # Adjust vertical position
            dy = 4 if math.sin(angle) > 0.3 else (-4 if math.sin(angle) < -0.3 else 0)

            labels_svg += f'<text x="{x}" y="{y + dy}" fill="#a3b3c7" font-size="11" font-family="Inter, sans-serif" text-anchor="{anchor}" dominant-baseline="middle">{label}</text>'

    return f'''<svg viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="{size}" height="{size}" fill="transparent"/>
    {circles_svg}
    {axes_svg}
    {polygon_svg}
    {dots_svg}
    {labels_svg}
</svg>'''


def generate_bar_chart_svg(
    data: Dict[str, float],
    width: int = 400,
    height: int = 300,
    title: str = "",
    max_value: float = 10,
) -> str:
    """
    Generate horizontal bar chart SVG.

    Args:
        data: Dict of label -> value
        width: SVG width
        height: SVG height
        title: Optional chart title
        max_value: Maximum value for scaling bars

    Returns:
        Complete SVG element string
    """
    if not data:
        return f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg"></svg>'

    padding_left = 100
    padding_right = 50
    padding_top = 40 if title else 20
    padding_bottom = 20

    bar_height = 28
    bar_gap = 8
    bar_area_width = width - padding_left - padding_right

    bars_svg = ""
    y_offset = padding_top

    for label, value in data.items():
        value = max(0, min(value, max_value))
        bar_width = (value / max_value) * bar_area_width

        # Color based on value (for 0-10 scale)
        if value >= 7:
            color = "#3fb950"  # Green
        elif value >= 4:
            color = "#d29922"  # Yellow
        else:
            color = "#f85149"  # Red

        # Label
        bars_svg += f'<text x="{padding_left - 10}" y="{y_offset + bar_height / 2}" fill="#a3b3c7" font-size="12" font-family="Inter, sans-serif" text-anchor="end" dominant-baseline="middle">{label}</text>'

        # Bar background
        bars_svg += f'<rect x="{padding_left}" y="{y_offset}" width="{bar_area_width}" height="{bar_height}" rx="4" fill="#21262d"/>'

        # Bar fill
        if bar_width > 0:
            bars_svg += f'<rect x="{padding_left}" y="{y_offset}" width="{bar_width}" height="{bar_height}" rx="4" fill="{color}"/>'

        # Value label
        bars_svg += f'<text x="{padding_left + bar_width + 8}" y="{y_offset + bar_height / 2}" fill="#e6edf3" font-size="12" font-family="Inter, sans-serif" font-weight="600" dominant-baseline="middle">{value:.1f}</text>'

        y_offset += bar_height + bar_gap

    # Title
    title_svg = ""
    if title:
        title_svg = f'<text x="{width / 2}" y="20" fill="#e6edf3" font-size="14" font-family="Inter, sans-serif" font-weight="600" text-anchor="middle">{title}</text>'

    return f'''<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="{width}" height="{height}" fill="transparent"/>
    {title_svg}
    {bars_svg}
</svg>'''


def generate_commit_activity_chart_svg(
    commits_history: List[Dict[str, Any]],
    width: int = 600,
    height: int = 120,
) -> str:
    """
    Generate GitHub commit activity sparkline/area chart.

    Args:
        commits_history: List of {"week": int, "commits": int}
        width: SVG width
        height: SVG height

    Returns:
        Complete SVG element string
    """
    if not commits_history:
        return f'''<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="{width}" height="{height}" fill="#161b22" rx="8"/>
    <text x="{width/2}" y="{height/2}" fill="#6e7681" font-size="12" font-family="Inter, sans-serif" text-anchor="middle" dominant-baseline="middle">No commit data available</text>
</svg>'''

    padding = 20
    chart_width = width - 2 * padding
    chart_height = height - 2 * padding

    # Get commit values
    commits = [h.get("commits", 0) for h in commits_history]
    max_commits = max(commits) if commits else 1

    # Avoid division by zero
    if max_commits == 0:
        max_commits = 1

    num_points = len(commits)

    # Generate line and area path points
    points = []
    for i, commit_count in enumerate(commits):
        x = padding + (i / max(num_points - 1, 1)) * chart_width
        y = height - padding - (commit_count / max_commits) * chart_height
        points.append((x, y))

    # Create line path
    line_path_parts = [f"M {points[0][0]} {points[0][1]}"]
    for x, y in points[1:]:
        line_path_parts.append(f"L {x} {y}")
    line_path = " ".join(line_path_parts)

    # Create area path (closed polygon)
    area_path = line_path + f" L {points[-1][0]} {height - padding} L {padding} {height - padding} Z"

    # Calculate total commits
    total_commits = sum(commits)
    avg_commits = total_commits / len(commits) if commits else 0

    # Recent trend (last 4 weeks vs previous 4 weeks)
    recent = sum(commits[-4:]) if len(commits) >= 4 else sum(commits)
    previous = sum(commits[-8:-4]) if len(commits) >= 8 else 0
    trend = "↑" if recent > previous else ("↓" if recent < previous else "→")
    trend_color = "#3fb950" if recent > previous else ("#f85149" if recent < previous else "#6e7681")

    return f'''<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="commitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#58a6ff;stop-opacity:0.4"/>
            <stop offset="100%" style="stop-color:#58a6ff;stop-opacity:0.05"/>
        </linearGradient>
    </defs>
    <rect width="{width}" height="{height}" fill="#161b22" rx="8"/>
    <path d="{area_path}" fill="url(#commitGradient)"/>
    <path d="{line_path}" fill="none" stroke="#58a6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Stats overlay -->
    <text x="{padding + 5}" y="{padding + 5}" fill="#e6edf3" font-size="11" font-family="Inter, sans-serif" font-weight="600" dominant-baseline="hanging">
        {total_commits:,} commits (52w)
    </text>
    <text x="{width - padding - 5}" y="{padding + 5}" fill="{trend_color}" font-size="11" font-family="Inter, sans-serif" font-weight="600" text-anchor="end" dominant-baseline="hanging">
        {trend} {recent} last 4w
    </text>
</svg>'''


def generate_competitor_table_html(
    competitors: List[Dict[str, Any]],
    current_ticker: str,
) -> str:
    """
    Generate HTML table rows for competitor comparison.

    Args:
        competitors: List of competitor data dicts
        current_ticker: Current project ticker (will be highlighted)

    Returns:
        HTML string with table rows
    """
    if not competitors:
        return '<tr><td colspan="6" style="text-align:center;color:#6e7681;">No competitor data available</td></tr>'

    rows = []
    for comp in competitors:
        name = comp.get("name", "Unknown")
        is_current = name.upper() == current_ticker.upper()

        # Format values
        tvl = comp.get("tvl")
        tvl_str = _format_number(tvl) if tvl else "N/A"

        daily_fees = comp.get("daily_fees")
        fees_str = _format_number(daily_fees) if daily_fees else "N/A"

        monthly_fees = comp.get("monthly_fees")
        monthly_str = _format_number(monthly_fees) if monthly_fees else "N/A"

        tvl_change = comp.get("tvl_change_7d")
        if tvl_change is not None:
            change_class = "positive" if tvl_change > 0 else ("negative" if tvl_change < 0 else "")
            change_str = f'<span class="{change_class}">{tvl_change:+.1f}%</span>'
        else:
            change_str = "N/A"

        mc_tvl = comp.get("mc_tvl")
        mc_tvl_str = f"{mc_tvl:.1f}x" if mc_tvl else "N/A"

        row_class = 'class="highlight-row"' if is_current else ""
        name_cell = f"<strong>{name}</strong>" if is_current else name

        rows.append(f'''
        <tr {row_class}>
            <td>{name_cell}</td>
            <td>{tvl_str}</td>
            <td>{fees_str}</td>
            <td>{monthly_str}</td>
            <td>{change_str}</td>
            <td>{mc_tvl_str}</td>
        </tr>
        ''')

    return '\n'.join(rows)


def generate_trading_levels_html(
    levels: Dict[str, Any],
) -> str:
    """
    Generate HTML for trading levels display.

    Args:
        levels: Dict with entry_zone, stop_loss, take_profits, etc.

    Returns:
        HTML string for trading levels grid
    """
    if not levels:
        return '<div class="trading-levels-empty">Trading levels not available</div>'

    entry_low = levels.get("entry_zone_low", 0)
    entry_high = levels.get("entry_zone_high", 0)
    stop_loss = levels.get("stop_loss", 0)
    tp1 = levels.get("take_profit_1", 0)
    tp2 = levels.get("take_profit_2", 0)
    tp3 = levels.get("take_profit_3", 0)
    rr = levels.get("risk_reward_ratio", "N/A")

    support = levels.get("support_levels", [])
    resistance = levels.get("resistance_levels", [])

    support_html = "".join(f'<div class="level-item support">${s:,.4f}</div>' for s in support[:3])
    resistance_html = "".join(f'<div class="level-item resistance">${r:,.4f}</div>' for r in resistance[:3])

    return f'''
    <div class="trading-levels-grid">
        <div class="level-card entry">
            <div class="level-header">Entry Zone</div>
            <div class="level-value">${entry_low:,.4f} - ${entry_high:,.4f}</div>
        </div>
        <div class="level-card stop">
            <div class="level-header">Stop Loss</div>
            <div class="level-value negative">${stop_loss:,.4f}</div>
        </div>
        <div class="level-card targets">
            <div class="level-header">Take Profit Targets</div>
            <div class="level-value positive">TP1: ${tp1:,.4f}</div>
            <div class="level-value positive">TP2: ${tp2:,.4f}</div>
            <div class="level-value positive">TP3: ${tp3:,.4f}</div>
        </div>
        <div class="level-card ratio">
            <div class="level-header">Risk:Reward</div>
            <div class="level-value highlight">{rr}</div>
        </div>
    </div>
    <div class="support-resistance-grid">
        <div class="sr-column">
            <div class="sr-header">Support Levels</div>
            {support_html if support_html else '<div class="level-item">N/A</div>'}
        </div>
        <div class="sr-column">
            <div class="sr-header">Resistance Levels</div>
            {resistance_html if resistance_html else '<div class="level-item">N/A</div>'}
        </div>
    </div>
    '''


def _format_number(value: Optional[float]) -> str:
    """Format large numbers with B/M/K suffixes."""
    if value is None:
        return "N/A"

    abs_value = abs(value)
    if abs_value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.2f}B"
    elif abs_value >= 1_000_000:
        return f"${value / 1_000_000:.2f}M"
    elif abs_value >= 1_000:
        return f"${value / 1_000:.2f}K"
    else:
        return f"${value:.2f}"
