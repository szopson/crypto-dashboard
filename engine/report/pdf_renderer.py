"""
PDF Renderer using Playwright.

Converts HTML to PDF with professional styling.
"""
import asyncio
from typing import Optional
from loguru import logger

try:
    from playwright.async_api import async_playwright, Browser
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("playwright not installed - PDF rendering unavailable")


class PDFRenderer:
    """
    Render HTML to PDF using Playwright.

    Uses Chromium for accurate CSS rendering and PDF generation.
    """

    def __init__(self, timeout: int = 30000):
        self.timeout = timeout
        self._browser: Optional[Browser] = None
        self._playwright = None
        self._lock = asyncio.Lock()

    async def _get_browser(self) -> Browser:
        """Get or create browser instance."""
        if not PLAYWRIGHT_AVAILABLE:
            raise RuntimeError("Playwright not installed. Run: pip install playwright && playwright install chromium")

        if self._browser is None or not self._browser.is_connected():
            async with self._lock:
                if self._browser is None or not self._browser.is_connected():
                    self._playwright = await async_playwright().start()
                    self._browser = await self._playwright.chromium.launch(
                        headless=True,
                        args=[
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                        ]
                    )
                    logger.info("Playwright browser launched")
        return self._browser

    async def render(
        self,
        html_content: str,
        width: str = "1440px",
        height: str = "810px",
        print_background: bool = True,
    ) -> bytes:
        """
        Render HTML content to PDF.

        Args:
            html_content: Complete HTML document string
            width: Page width (default: 1440px for 16:9 landscape)
            height: Page height (default: 810px for 16:9 landscape)
            print_background: Include background colors/images

        Returns:
            PDF as bytes
        """
        browser = await self._get_browser()
        page = None

        try:
            page = await browser.new_page()

            # Set content with wait for network idle
            await page.set_content(
                html_content,
                wait_until="networkidle",
                timeout=self.timeout,
            )

            # Wait for fonts to load
            await page.wait_for_timeout(2000)

            # Generate PDF with custom page size
            pdf_bytes = await page.pdf(
                width=width,
                height=height,
                print_background=print_background,
                margin={
                    "top": "0",
                    "right": "0",
                    "bottom": "0",
                    "left": "0",
                },
            )

            logger.info(f"PDF generated: {len(pdf_bytes)} bytes")
            return pdf_bytes

        except Exception as e:
            logger.error(f"PDF rendering failed: {e}")
            raise

        finally:
            if page:
                await page.close()

    async def close(self):
        """Close browser instance."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
            logger.info("Playwright browser closed")


# Singleton
_renderer: Optional[PDFRenderer] = None


def get_pdf_renderer() -> PDFRenderer:
    """Get or create PDF renderer singleton."""
    global _renderer
    if _renderer is None:
        _renderer = PDFRenderer()
    return _renderer
