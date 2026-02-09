"""
FastAPI router for PDF report generation.
"""
from datetime import datetime
import io
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from loguru import logger

router = APIRouter(tags=["Reports"])


@router.post("/generate")
async def generate_report(
    ticker: str = Query(..., min_length=1, max_length=10, description="Token ticker symbol"),
    report_type: str = Query("crypto", description="Type of report: crypto, defi, nft"),
    send_telegram: bool = Query(False, description="Send PDF to Telegram after generation"),
    telegram_chat_id: Optional[str] = Query(None, description="Override default Telegram chat ID"),
):
    """
    Generate a PDF investment report for a crypto token.

    - **ticker**: Token symbol (e.g., "SOL", "ETH", "BTC")
    - **report_type**: Type of report (crypto, defi, nft)
    - **send_telegram**: Send PDF to Telegram after generation
    - **telegram_chat_id**: Override default Telegram chat ID

    Returns the PDF file as a downloadable attachment.
    """
    from .generator import get_report_generator_service

    try:
        generator = get_report_generator_service()
        result = await generator.generate_report(
            ticker=ticker.upper(),
            report_type=report_type,
            send_telegram=send_telegram,
            telegram_chat_id=telegram_chat_id,
        )

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Report generation failed"))

        # Return PDF as streaming response
        pdf_bytes = result["pdf_bytes"]
        filename = f"{ticker.upper()}_report_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Telegram-Sent": str(result.get("telegram_sent", False)).lower(),
                "X-Generation-Time": str(result.get("generation_time_seconds", 0)),
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/json")
async def generate_report_json(
    ticker: str = Query(..., min_length=1, max_length=10, description="Token ticker symbol"),
    report_type: str = Query("crypto", description="Type of report: crypto, defi, nft"),
    send_telegram: bool = Query(False, description="Send PDF to Telegram after generation"),
    telegram_chat_id: Optional[str] = Query(None, description="Override default Telegram chat ID"),
):
    """
    Generate a report and return metadata (without PDF binary).

    Useful for async workflows where PDF is sent to Telegram.
    """
    from .generator import get_report_generator_service

    try:
        generator = get_report_generator_service()
        result = await generator.generate_report(
            ticker=ticker.upper(),
            report_type=report_type,
            send_telegram=send_telegram,
            telegram_chat_id=telegram_chat_id,
        )

        return {
            "success": result.get("success", False),
            "ticker": ticker.upper(),
            "report_type": report_type,
            "filename": f"{ticker.upper()}_report_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.pdf",
            "telegram_sent": result.get("telegram_sent", False),
            "telegram_message_id": result.get("telegram_message_id"),
            "error": result.get("error"),
            "generation_time_seconds": result.get("generation_time_seconds", 0),
        }

    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return {
            "success": False,
            "ticker": ticker.upper(),
            "report_type": report_type,
            "error": str(e),
            "generation_time_seconds": 0,
        }
