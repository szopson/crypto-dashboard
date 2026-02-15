"""
Portfolio Chat Service.

Provides AI-powered portfolio analysis using free LLM providers:
- Groq (primary): Free tier with Llama 3.3 70B
- Perplexity (for market research): Already configured in project

Features:
- Portfolio construction analysis
- Risk assessment
- Future outlook based on current market conditions
- Real-time data integration for stocks/crypto
"""
import json
from datetime import datetime
from typing import Optional, AsyncGenerator
import httpx
from loguru import logger

from config import settings


class PortfolioChatService:
    """
    AI-powered portfolio chat service.

    Uses Groq's free tier (Llama 3.3 70B) for analysis
    and can fetch real-time market data for context.
    """

    # Groq API (free tier: 6000 tokens/min, 14400 requests/day)
    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_MODEL = "llama-3.3-70b-versatile"

    # Perplexity API (for real-time market research)
    PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"
    PERPLEXITY_MODEL = "sonar"

    def __init__(self):
        self.groq_api_key = getattr(settings, 'groq_api_key', None)
        self.perplexity_api_key = getattr(settings, 'perplexity_api_key', None)

    def is_available(self) -> bool:
        """Check if chat service is available."""
        return bool(self.groq_api_key)

    async def get_market_context(self, tickers: list[str]) -> str:
        """
        Get real-time market context for tickers using Perplexity.

        Args:
            tickers: List of stock/crypto tickers

        Returns:
            Market context string for LLM
        """
        if not self.perplexity_api_key or not tickers:
            return ""

        # Limit to top 5 tickers to avoid rate limits
        top_tickers = tickers[:5]
        query = f"""
        Provide a brief market update for these assets: {', '.join(top_tickers)}.
        Include:
        1. Recent price movements and trends
        2. Any significant news in the last week
        3. Analyst sentiment if available
        Be concise and factual.
        """

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    self.PERPLEXITY_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.perplexity_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.PERPLEXITY_MODEL,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a financial market analyst. Be concise and factual."
                            },
                            {"role": "user", "content": query}
                        ],
                        "temperature": 0.2,
                    }
                )

                if response.status_code != 200:
                    logger.warning(f"Perplexity error: {response.status_code}")
                    return ""

                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return f"\n\nREAL-TIME MARKET CONTEXT:\n{content}\n" if content else ""

        except Exception as e:
            logger.warning(f"Failed to fetch market context: {e}")
            return ""

    def _build_portfolio_context(self, portfolio_data: dict) -> str:
        """Build portfolio context string for the LLM."""
        holdings = portfolio_data.get("holdings", [])
        summary = portfolio_data.get("summary", {})

        context_parts = [
            "PORTFOLIO OVERVIEW:",
            f"- Total Value: ${summary.get('total_value_usd', 0):,.2f}",
            f"- Cost Basis: ${summary.get('total_cost_basis_usd', 0):,.2f}",
            f"- Total Gain/Loss: ${summary.get('total_gain_loss_usd', 0):,.2f} ({summary.get('total_gain_loss_pct', 0):+.1f}%)",
            f"- 24h Change: ${summary.get('change_24h_usd', 0):,.2f} ({summary.get('change_24h_pct', 0):+.1f}%)",
            f"- Number of Holdings: {len(holdings)}",
            ""
        ]

        # Group holdings by asset class
        by_class = {}
        for h in holdings:
            asset_class = h.get("asset_class", "unknown")
            if asset_class not in by_class:
                by_class[asset_class] = []
            by_class[asset_class].append(h)

        context_parts.append("HOLDINGS BY ASSET CLASS:")
        for asset_class, class_holdings in by_class.items():
            class_value = sum(float(h.get("current_value", 0)) for h in class_holdings)
            class_pct = (class_value / summary.get("total_value_usd", 1) * 100) if summary.get("total_value_usd") else 0

            context_parts.append(f"\n{asset_class.upper()} ({class_pct:.1f}% of portfolio):")

            for h in class_holdings:
                ticker = h.get("ticker", "?")
                name = h.get("name", ticker)
                quantity = h.get("quantity", 0)
                current_value = h.get("current_value", 0)
                gain_loss_pct = h.get("gain_loss_pct", 0)

                context_parts.append(
                    f"  - {name} ({ticker}): {quantity} units, ${current_value:,.2f} ({gain_loss_pct:+.1f}%)"
                )

        # Calculate allocation summary
        context_parts.append("\n\nALLOCATION SUMMARY:")
        for asset_class, class_holdings in by_class.items():
            class_value = sum(float(h.get("current_value", 0)) for h in class_holdings)
            class_pct = (class_value / summary.get("total_value_usd", 1) * 100) if summary.get("total_value_usd") else 0
            context_parts.append(f"  - {asset_class}: {class_pct:.1f}%")

        return "\n".join(context_parts)

    def _build_system_prompt(self) -> str:
        """Build system prompt for portfolio analysis."""
        return """You are an experienced financial advisor and portfolio analyst. You help users understand their investment portfolio.

Your role is to:
1. Analyze portfolio construction and allocation
2. Assess risk levels and diversification
3. Identify potential concerns or opportunities
4. Provide educational insights about investing
5. Suggest improvements when appropriate

Guidelines:
- Be conversational but professional
- Provide specific, actionable insights based on the portfolio data
- When discussing risk, consider: concentration, asset class diversity, sector exposure
- Always remind users that this is educational and not financial advice
- If asked about specific stocks/crypto, use the market context provided
- Be honest about limitations - you can't predict the future
- For custom assets (jewelry, watches, art), treat them as alternative investments with different risk profiles

Important: Always mention that users should consult a qualified financial advisor for personalized advice."""

    async def chat(
        self,
        message: str,
        portfolio_data: dict,
        conversation_history: list[dict] = None,
        include_market_context: bool = True,
    ) -> str:
        """
        Send a chat message and get analysis response.

        Args:
            message: User's question/message
            portfolio_data: Portfolio data with holdings and summary
            conversation_history: Previous messages in conversation
            include_market_context: Whether to fetch real-time market data

        Returns:
            AI response string
        """
        if not self.groq_api_key:
            return "Portfolio chat is not available. Please configure GROQ_API_KEY to enable AI-powered portfolio analysis."

        # Build context
        portfolio_context = self._build_portfolio_context(portfolio_data)

        # Get market context for holdings
        market_context = ""
        if include_market_context:
            tickers = [h.get("ticker") for h in portfolio_data.get("holdings", []) if h.get("ticker")]
            market_context = await self.get_market_context(tickers)

        # Build messages
        messages = [
            {"role": "system", "content": self._build_system_prompt()},
            {"role": "system", "content": f"Current date: {datetime.utcnow().strftime('%Y-%m-%d')}\n\n{portfolio_context}{market_context}"},
        ]

        # Add conversation history
        if conversation_history:
            for msg in conversation_history[-10:]:  # Keep last 10 messages
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })

        # Add current message
        messages.append({"role": "user", "content": message})

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    self.GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.GROQ_MODEL,
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 2048,
                    }
                )

                if response.status_code != 200:
                    error_detail = response.text
                    logger.error(f"Groq API error: {response.status_code} - {error_detail}")
                    return f"Sorry, I encountered an error while processing your request. Please try again."

                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

                if not content:
                    return "I couldn't generate a response. Please try rephrasing your question."

                return content

        except httpx.TimeoutException:
            return "The request timed out. Please try again with a simpler question."
        except Exception as e:
            logger.error(f"Portfolio chat error: {e}")
            return "Sorry, I encountered an error. Please try again later."

    async def chat_stream(
        self,
        message: str,
        portfolio_data: dict,
        conversation_history: list[dict] = None,
        include_market_context: bool = True,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat response for real-time display.

        Args:
            message: User's question/message
            portfolio_data: Portfolio data with holdings and summary
            conversation_history: Previous messages in conversation
            include_market_context: Whether to fetch real-time market data

        Yields:
            Chunks of the AI response
        """
        if not self.groq_api_key:
            yield "Portfolio chat is not available. Please configure GROQ_API_KEY to enable AI-powered portfolio analysis."
            return

        # Build context
        portfolio_context = self._build_portfolio_context(portfolio_data)

        # Get market context for holdings
        market_context = ""
        if include_market_context:
            tickers = [h.get("ticker") for h in portfolio_data.get("holdings", []) if h.get("ticker")]
            market_context = await self.get_market_context(tickers)

        # Build messages
        messages = [
            {"role": "system", "content": self._build_system_prompt()},
            {"role": "system", "content": f"Current date: {datetime.utcnow().strftime('%Y-%m-%d')}\n\n{portfolio_context}{market_context}"},
        ]

        # Add conversation history
        if conversation_history:
            for msg in conversation_history[-10:]:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })

        # Add current message
        messages.append({"role": "user", "content": message})

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream(
                    "POST",
                    self.GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.GROQ_MODEL,
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 2048,
                        "stream": True,
                    }
                ) as response:
                    if response.status_code != 200:
                        yield "Sorry, I encountered an error while processing your request."
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                delta = data.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                continue

        except Exception as e:
            logger.error(f"Portfolio chat stream error: {e}")
            yield "Sorry, I encountered an error. Please try again later."

    async def get_quick_analysis(self, portfolio_data: dict) -> dict:
        """
        Get a quick portfolio analysis summary.

        Returns structured analysis with:
        - Overall assessment
        - Risk level
        - Key strengths
        - Key concerns
        - Suggestions
        """
        if not self.groq_api_key:
            return {
                "available": False,
                "message": "AI analysis not available"
            }

        portfolio_context = self._build_portfolio_context(portfolio_data)

        prompt = """Based on the portfolio data, provide a structured analysis in JSON format with these fields:
{
    "overall_assessment": "Brief 1-2 sentence assessment",
    "risk_level": "LOW|MODERATE|HIGH|VERY_HIGH",
    "risk_factors": ["list of specific risk factors"],
    "strengths": ["list of portfolio strengths"],
    "concerns": ["list of concerns or areas for improvement"],
    "suggestions": ["list of actionable suggestions"],
    "diversification_score": 1-10
}

Be specific and actionable. Base your analysis on the actual holdings and allocation."""

        messages = [
            {"role": "system", "content": "You are a portfolio analyst. Respond only with valid JSON, no other text."},
            {"role": "user", "content": f"{portfolio_context}\n\n{prompt}"}
        ]

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    self.GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.GROQ_MODEL,
                        "messages": messages,
                        "temperature": 0.3,
                        "max_tokens": 1024,
                    }
                )

                if response.status_code != 200:
                    return {"available": False, "message": "Analysis failed"}

                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

                # Parse JSON response
                analysis = json.loads(content)
                analysis["available"] = True
                return analysis

        except json.JSONDecodeError:
            return {"available": False, "message": "Failed to parse analysis"}
        except Exception as e:
            logger.error(f"Quick analysis error: {e}")
            return {"available": False, "message": str(e)}


# Singleton
_portfolio_chat_service: Optional[PortfolioChatService] = None


def get_portfolio_chat_service() -> PortfolioChatService:
    """Get or create portfolio chat service singleton."""
    global _portfolio_chat_service
    if _portfolio_chat_service is None:
        _portfolio_chat_service = PortfolioChatService()
    return _portfolio_chat_service
