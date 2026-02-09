"""
PDF Report Generator for Crypto Project Analysis.

Generates professional PDF investment reports using ReportLab.
"""
from io import BytesIO
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from services.project_analysis import ProjectReport


def get_recommendation_color(recommendation: str) -> colors.Color:
    """Get color based on recommendation."""
    rec_colors = {
        "STRONG_BUY": colors.HexColor("#10B981"),  # Green
        "BUY": colors.HexColor("#34D399"),  # Light green
        "NEUTRAL": colors.HexColor("#F59E0B"),  # Yellow
        "AVOID": colors.HexColor("#F87171"),  # Light red
        "STRONG_AVOID": colors.HexColor("#EF4444"),  # Red
    }
    return rec_colors.get(recommendation, colors.gray)


def get_score_color(score: int, max_score: int = 10) -> colors.Color:
    """Get color based on score."""
    ratio = score / max_score
    if ratio >= 0.7:
        return colors.HexColor("#10B981")  # Green
    elif ratio >= 0.4:
        return colors.HexColor("#F59E0B")  # Yellow
    else:
        return colors.HexColor("#EF4444")  # Red


def get_risk_color(risk: str) -> colors.Color:
    """Get color based on risk level."""
    risk_colors = {
        "low": colors.HexColor("#10B981"),
        "medium": colors.HexColor("#F59E0B"),
        "high": colors.HexColor("#EF4444"),
    }
    return risk_colors.get(risk.lower(), colors.gray)


class ProjectReportPDF:
    """Generate professional PDF reports for crypto project analysis."""

    def __init__(self, report: ProjectReport):
        self.report = report
        self.styles = getSampleStyleSheet()
        self._setup_styles()

    def _setup_styles(self):
        """Setup custom paragraph styles."""
        # Title style
        self.styles.add(ParagraphStyle(
            name='ReportTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            spaceAfter=20,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#1F2937"),
        ))

        # Section header
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceBefore=15,
            spaceAfter=10,
            textColor=colors.HexColor("#374151"),
            borderWidth=1,
            borderColor=colors.HexColor("#E5E7EB"),
            borderPadding=5,
        ))

        # Subtitle
        self.styles.add(ParagraphStyle(
            name='Subtitle',
            parent=self.styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor("#6B7280"),
            alignment=TA_CENTER,
            spaceAfter=30,
        ))

        # Body text - use CustomBody to avoid conflict with default BodyText
        self.styles.add(ParagraphStyle(
            name='CustomBody',
            parent=self.styles['Normal'],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#374151"),
        ))

        # Highlight text
        self.styles.add(ParagraphStyle(
            name='Highlight',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor("#1F2937"),
            fontName='Helvetica-Bold',
        ))

    def generate(self) -> bytes:
        """Generate PDF report and return as bytes."""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=2*cm,
            bottomMargin=2*cm,
        )

        story = []

        # Header
        story.extend(self._build_header())

        # Executive Summary
        story.extend(self._build_executive_summary())

        # Scores Overview
        story.extend(self._build_scores_overview())

        # Team Analysis
        story.extend(self._build_team_section())

        # Product Analysis
        story.extend(self._build_product_section())

        # DeFi Metrics (if available)
        story.extend(self._build_defi_section())

        # Development Activity (GitHub)
        story.extend(self._build_development_section())

        # Market Analysis
        story.extend(self._build_market_section())

        # Competition Analysis
        story.extend(self._build_competition_section())

        # Tokenomics
        story.extend(self._build_tokenomics_section())

        # On-Chain Metrics (if available)
        story.extend(self._build_onchain_section())

        # Risk Assessment
        story.extend(self._build_risk_section())

        # Investment Signals
        story.extend(self._build_signals_section())

        # Footer
        story.extend(self._build_footer())

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        return pdf_bytes

    def _build_header(self) -> list:
        """Build report header."""
        elements = []

        # Logo/Title area
        elements.append(Paragraph(
            f"<b>{self.report.name}</b> ({self.report.ticker})",
            self.styles['ReportTitle']
        ))

        # Subtitle with metadata
        analyzed_at = datetime.fromisoformat(self.report.analyzed_at.replace('Z', '+00:00'))
        elements.append(Paragraph(
            f"Investment Analysis Report | {analyzed_at.strftime('%B %d, %Y')}",
            self.styles['Subtitle']
        ))

        # Category and blockchain
        if self.report.category:
            elements.append(Paragraph(
                f"<b>Category:</b> {self.report.category}",
                self.styles['CustomBody']
            ))

        elements.append(Spacer(1, 20))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E5E7EB")))
        elements.append(Spacer(1, 10))

        return elements

    def _build_executive_summary(self) -> list:
        """Build executive summary section."""
        elements = []
        rec = self.report.recommendation
        rec_color = get_recommendation_color(rec.recommendation)

        elements.append(Paragraph("EXECUTIVE SUMMARY", self.styles['SectionHeader']))

        # Summary table
        data = [
            ["Recommendation", rec.recommendation.replace("_", " ")],
            ["Overall Score", f"{self.report.overall_score}/100"],
            ["Confidence", f"{rec.confidence}%"],
            ["Risk Level", self.report.risk.overall_risk.upper()],
            ["Time Horizon", rec.time_horizon or "N/A"],
        ]

        table = Table(data, colWidths=[3*cm, 5*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor("#374151")),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ('TEXTCOLOR', (1, 0), (1, 0), rec_color),
            ('FONTNAME', (1, 0), (1, 0), 'Helvetica-Bold'),
        ]))

        elements.append(table)
        elements.append(Spacer(1, 15))

        # Summary text
        if rec.summary:
            elements.append(Paragraph(rec.summary, self.styles['CustomBody']))

        elements.append(Spacer(1, 20))
        return elements

    def _build_scores_overview(self) -> list:
        """Build scores overview section."""
        elements = []
        elements.append(Paragraph("SCORES OVERVIEW", self.styles['SectionHeader']))

        scores = [
            ("Team Experience", self.report.team.experience_score, 10),
            ("Product Development", self.report.product.product_score, 10),
            ("Development Activity", self.report.development.activity_score, 10),
            ("Market Opportunity", self.report.market.market_score, 10),
            ("Competitive Position", self.report.competition.competition_score, 10),
            ("Community Sentiment", self.report.sentiment.sentiment_score, 10),
            ("Tokenomics", self.report.tokenomics.tokenomics_score, 10),
            ("Decentralization", self.report.onchain.decentralization_score, 10),
        ]

        data = [["Category", "Score", "Rating"]]
        for name, score, max_score in scores:
            rating = "Strong" if score >= 7 else "Moderate" if score >= 4 else "Weak"
            data.append([name, f"{score}/{max_score}", rating])

        table = Table(data, colWidths=[6*cm, 3*cm, 4*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1F2937")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ]))

        # Color the scores
        for i, (_, score, max_score) in enumerate(scores, start=1):
            color = get_score_color(score, max_score)
            table.setStyle(TableStyle([
                ('TEXTCOLOR', (1, i), (1, i), color),
                ('FONTNAME', (1, i), (1, i), 'Helvetica-Bold'),
            ]))

        elements.append(table)
        elements.append(Spacer(1, 20))
        return elements

    def _build_team_section(self) -> list:
        """Build team analysis section."""
        elements = []
        team = self.report.team

        elements.append(Paragraph("TEAM ANALYSIS", self.styles['SectionHeader']))

        data = [
            ["Founders Known", "Yes" if team.founders_known else "No"],
            ["Founders Doxxed", "Yes" if team.founders_doxxed else "No"],
            ["Team Size", team.team_size or "Unknown"],
        ]

        if team.key_members:
            data.append(["Key Members", ", ".join(team.key_members[:3])])

        if team.previous_projects:
            data.append(["Previous Projects", ", ".join(team.previous_projects[:3])])

        table = Table(data, colWidths=[4*cm, 9*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ]))

        elements.append(table)

        if team.notes:
            elements.append(Spacer(1, 10))
            elements.append(Paragraph(f"<i>{team.notes}</i>", self.styles['CustomBody']))

        elements.append(Spacer(1, 15))
        return elements

    def _build_product_section(self) -> list:
        """Build product analysis section."""
        elements = []
        product = self.report.product

        elements.append(Paragraph("PRODUCT ANALYSIS", self.styles['SectionHeader']))

        data = [
            ["Status", product.status.title()],
            ["Working Product", "Yes" if product.has_working_product else "No"],
            ["GitHub Activity", product.github_activity.title()],
            ["Audited", "Yes" if product.audited else "No"],
        ]

        if product.unique_features:
            data.append(["Key Features", ", ".join(product.unique_features[:3])])

        table = Table(data, colWidths=[4*cm, 9*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ]))

        elements.append(table)

        if product.notes:
            elements.append(Spacer(1, 10))
            elements.append(Paragraph(f"<i>{product.notes}</i>", self.styles['CustomBody']))

        elements.append(Spacer(1, 15))
        return elements

    def _build_defi_section(self) -> list:
        """Build DeFi metrics section (DefiLlama data)."""
        elements = []
        defi = self.report.defi_metrics

        # Skip if no TVL data
        if not defi.tvl:
            return elements

        elements.append(Paragraph("DEFI METRICS", self.styles['SectionHeader']))

        data = [
            ["Total Value Locked (TVL)", defi.tvl_formatted or "N/A"],
        ]

        if defi.tvl_change_1d is not None:
            change_str = f"{defi.tvl_change_1d:+.1f}%"
            data.append(["TVL Change (24h)", change_str])

        if defi.tvl_change_7d is not None:
            change_str = f"{defi.tvl_change_7d:+.1f}%"
            data.append(["TVL Change (7d)", change_str])

        if defi.tvl_change_30d is not None:
            change_str = f"{defi.tvl_change_30d:+.1f}%"
            data.append(["TVL Change (30d)", change_str])

        if defi.mcap_tvl_ratio is not None:
            data.append(["Market Cap / TVL Ratio", f"{defi.mcap_tvl_ratio:.2f}"])

        if defi.category:
            data.append(["DeFi Category", defi.category])

        if defi.chains:
            data.append(["Active Chains", ", ".join(defi.chains[:5])])

        table = Table(data, colWidths=[5*cm, 8*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ]))

        elements.append(table)
        elements.append(Spacer(1, 15))
        return elements

    def _build_development_section(self) -> list:
        """Build development activity section (GitHub data)."""
        elements = []
        dev = self.report.development

        # Skip if no GitHub data
        if not dev.github_url:
            return elements

        elements.append(Paragraph("DEVELOPMENT ACTIVITY", self.styles['SectionHeader']))

        data = [
            ["GitHub Repository", dev.github_url],
            ["Stars", f"{dev.stars:,}"],
            ["Forks", f"{dev.forks:,}"],
            ["Contributors", f"{dev.contributors:,}"],
            ["Open Issues", f"{dev.open_issues:,}"],
        ]

        if dev.commits_last_30d > 0:
            data.append(["Commits (Last 30d)", f"{dev.commits_last_30d:,}"])

        if dev.commits_last_year > 0:
            data.append(["Commits (Last Year)", f"{dev.commits_last_year:,}"])

        if dev.last_commit_date:
            try:
                last_commit = datetime.fromisoformat(dev.last_commit_date.replace('Z', '+00:00'))
                data.append(["Last Commit", last_commit.strftime('%Y-%m-%d')])
            except:
                data.append(["Last Commit", dev.last_commit_date[:10]])

        if dev.primary_language:
            data.append(["Primary Language", dev.primary_language])

        if dev.license:
            data.append(["License", dev.license])

        if dev.is_archived:
            data.append(["Status", "⚠️ ARCHIVED"])

        table = Table(data, colWidths=[5*cm, 8*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ]))

        elements.append(table)

        # Activity score summary
        score_color = get_score_color(dev.activity_score, 10)
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(
            f"<b>Development Activity Score:</b> <font color='{score_color.hexval()}'>{dev.activity_score}/10</font>",
            self.styles['Highlight']
        ))

        elements.append(Spacer(1, 15))
        return elements

    def _build_onchain_section(self) -> list:
        """Build on-chain metrics section (Dune data)."""
        elements = []
        onchain = self.report.onchain

        # Skip if no on-chain data
        if not onchain.holder_count and not onchain.top_10_holder_percent:
            return elements

        elements.append(Paragraph("ON-CHAIN METRICS", self.styles['SectionHeader']))

        data = []

        if onchain.chain:
            data.append(["Chain", onchain.chain.title()])

        if onchain.holder_count:
            data.append(["Total Holders", f"{onchain.holder_count:,}"])

        if onchain.top_10_holder_percent is not None:
            data.append(["Top 10 Holders %", f"{onchain.top_10_holder_percent:.1f}%"])

        if onchain.top_100_holder_percent is not None:
            data.append(["Top 100 Holders %", f"{onchain.top_100_holder_percent:.1f}%"])

        if onchain.active_addresses_7d is not None:
            data.append(["Active Addresses (7d)", f"{onchain.active_addresses_7d:,}"])

        if onchain.active_addresses_30d is not None:
            data.append(["Active Addresses (30d)", f"{onchain.active_addresses_30d:,}"])

        if onchain.transfer_count_7d is not None:
            data.append(["Transfers (7d)", f"{onchain.transfer_count_7d:,}"])

        if not data:
            return elements

        table = Table(data, colWidths=[5*cm, 8*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ]))

        elements.append(table)

        # Decentralization score
        if onchain.decentralization_score > 0:
            score_color = get_score_color(onchain.decentralization_score, 10)
            elements.append(Spacer(1, 10))
            elements.append(Paragraph(
                f"<b>Decentralization Score:</b> <font color='{score_color.hexval()}'>{onchain.decentralization_score}/10</font>",
                self.styles['Highlight']
            ))

        elements.append(Spacer(1, 15))
        return elements

    def _build_market_section(self) -> list:
        """Build market analysis section."""
        elements = []
        market = self.report.market

        elements.append(Paragraph("MARKET ANALYSIS", self.styles['SectionHeader']))

        data = [
            ["Niche", market.niche or "Unknown"],
            ["Market Size", market.market_size or "Unknown"],
            ["Growth Potential", market.growth_potential.title() if market.growth_potential else "Unknown"],
            ["Timing", market.timing.title() if market.timing else "Unknown"],
        ]

        if market.use_cases:
            data.append(["Use Cases", ", ".join(market.use_cases[:3])])

        table = Table(data, colWidths=[4*cm, 9*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ]))

        elements.append(table)

        if market.notes:
            elements.append(Spacer(1, 10))
            elements.append(Paragraph(f"<i>{market.notes}</i>", self.styles['CustomBody']))

        elements.append(Spacer(1, 15))
        return elements

    def _build_competition_section(self) -> list:
        """Build competition analysis section."""
        elements = []
        comp = self.report.competition

        elements.append(Paragraph("COMPETITION ANALYSIS", self.styles['SectionHeader']))

        # Position and moat
        data = [
            ["Market Position", comp.market_position.title() if comp.market_position else "Unknown"],
            ["Competitive Moat", comp.moat or "Unknown"],
        ]

        table = Table(data, colWidths=[4*cm, 9*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ]))
        elements.append(table)

        # Competitors
        if comp.main_competitors:
            elements.append(Spacer(1, 10))
            elements.append(Paragraph("<b>Main Competitors:</b>", self.styles['CustomBody']))
            for c in comp.main_competitors[:5]:
                if isinstance(c, dict):
                    elements.append(Paragraph(
                        f"• <b>{c.get('name', 'Unknown')}</b>: {c.get('comparison', '')}",
                        self.styles['CustomBody']
                    ))

        # Advantages/Disadvantages
        if comp.competitive_advantages:
            elements.append(Spacer(1, 10))
            elements.append(Paragraph("<b>Advantages:</b>", self.styles['CustomBody']))
            for adv in comp.competitive_advantages[:3]:
                elements.append(Paragraph(f"✓ {adv}", self.styles['CustomBody']))

        if comp.competitive_disadvantages:
            elements.append(Spacer(1, 5))
            elements.append(Paragraph("<b>Disadvantages:</b>", self.styles['CustomBody']))
            for dis in comp.competitive_disadvantages[:3]:
                elements.append(Paragraph(f"✗ {dis}", self.styles['CustomBody']))

        elements.append(Spacer(1, 15))
        return elements

    def _build_tokenomics_section(self) -> list:
        """Build tokenomics section."""
        elements = []
        tok = self.report.tokenomics

        elements.append(Paragraph("TOKENOMICS", self.styles['SectionHeader']))

        data = [
            ["Market Cap", tok.market_cap or "N/A"],
            ["Fully Diluted Value", tok.fdv or "N/A"],
            ["Circulating Supply", tok.circulating_supply or "N/A"],
            ["Total Supply", tok.total_supply or "N/A"],
        ]

        if tok.team_allocation:
            data.append(["Team Allocation", tok.team_allocation])

        table = Table(data, colWidths=[4*cm, 9*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ]))

        elements.append(table)
        elements.append(Spacer(1, 15))
        return elements

    def _build_risk_section(self) -> list:
        """Build risk assessment section."""
        elements = []
        risk = self.report.risk

        elements.append(Paragraph("RISK ASSESSMENT", self.styles['SectionHeader']))

        # Overall risk
        risk_color = get_risk_color(risk.overall_risk)
        elements.append(Paragraph(
            f"<b>Overall Risk Level:</b> <font color='{risk_color.hexval()}'>{risk.overall_risk.upper()}</font>",
            self.styles['Highlight']
        ))
        elements.append(Spacer(1, 10))

        # Risk breakdown
        risks = [
            ("Regulatory", risk.regulatory_risk),
            ("Technical", risk.technical_risk),
            ("Market", risk.market_risk),
            ("Team", risk.team_risk),
            ("Competition", risk.competition_risk),
            ("Liquidity", risk.liquidity_risk),
        ]

        data = [["Risk Type", "Level"]]
        for name, level in risks:
            data.append([name, level.title()])

        table = Table(data, colWidths=[5*cm, 4*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1F2937")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ]))

        # Color the risk levels
        for i, (_, level) in enumerate(risks, start=1):
            color = get_risk_color(level)
            table.setStyle(TableStyle([
                ('TEXTCOLOR', (1, i), (1, i), color),
            ]))

        elements.append(table)

        # Key risks
        if risk.key_risks:
            elements.append(Spacer(1, 10))
            elements.append(Paragraph("<b>Key Risks:</b>", self.styles['CustomBody']))
            for r in risk.key_risks[:5]:
                elements.append(Paragraph(f"⚠ {r}", self.styles['CustomBody']))

        elements.append(Spacer(1, 15))
        return elements

    def _build_signals_section(self) -> list:
        """Build investment signals section."""
        elements = []
        rec = self.report.recommendation

        elements.append(Paragraph("INVESTMENT SIGNALS", self.styles['SectionHeader']))

        # Catalysts (bullish)
        if rec.key_catalysts:
            elements.append(Paragraph(
                "<b><font color='#10B981'>KEY CATALYSTS (BULLISH)</font></b>",
                self.styles['CustomBody']
            ))
            for cat in rec.key_catalysts[:5]:
                elements.append(Paragraph(f"▲ {cat}", self.styles['CustomBody']))
            elements.append(Spacer(1, 10))

        # Concerns (bearish)
        if rec.key_concerns:
            elements.append(Paragraph(
                "<b><font color='#EF4444'>KEY CONCERNS (BEARISH)</font></b>",
                self.styles['CustomBody']
            ))
            for con in rec.key_concerns[:5]:
                elements.append(Paragraph(f"▼ {con}", self.styles['CustomBody']))

        elements.append(Spacer(1, 15))
        return elements

    def _build_footer(self) -> list:
        """Build report footer."""
        elements = []

        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E5E7EB")))
        elements.append(Spacer(1, 10))

        elements.append(Paragraph(
            f"<i>Report generated by Trading Command Center | {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}</i>",
            ParagraphStyle(
                name='Footer',
                parent=self.styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor("#9CA3AF"),
                alignment=TA_CENTER,
            )
        ))

        elements.append(Paragraph(
            "<i>This report is for informational purposes only and does not constitute financial advice.</i>",
            ParagraphStyle(
                name='Disclaimer',
                parent=self.styles['Normal'],
                fontSize=7,
                textColor=colors.HexColor("#9CA3AF"),
                alignment=TA_CENTER,
            )
        ))

        return elements


def generate_pdf_report(report: ProjectReport) -> bytes:
    """Generate PDF report from ProjectReport."""
    pdf_gen = ProjectReportPDF(report)
    return pdf_gen.generate()
