#!/usr/bin/env python3
"""
Email Finder - Extract contact emails from websites

Crawls business websites to find contact emails and owner/agent names.
Prioritizes personal emails over generic ones (info@, contact@).

Usage:
    python email_finder.py --input data/raw_leads.csv --output data/leads_with_emails.csv
"""

import asyncio
import re
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
import pandas as pd
import typer
from bs4 import BeautifulSoup
from rich.console import Console
from rich.progress import (
    BarColumn,
    Progress,
    TaskProgressColumn,
    TextColumn,
    TimeRemainingColumn,
)
from rich.table import Table

app = typer.Typer(help="Extract emails from business websites")
console = Console()

# Email regex pattern
EMAIL_PATTERN = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)

# Pages to check for contact info
CONTACT_PAGES = [
    "",  # Homepage
    "/contact",
    "/contact-us",
    "/about",
    "/about-us",
    "/team",
    "/our-team",
    "/agents",
    "/staff",
]

# Generic emails to deprioritize
GENERIC_PREFIXES = {
    "info",
    "contact",
    "hello",
    "support",
    "admin",
    "office",
    "sales",
    "enquiries",
    "inquiries",
    "general",
    "mail",
    "email",
    "webmaster",
    "noreply",
    "no-reply",
}

# Headers to mimic browser
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def extract_emails_from_html(html: str, domain: str) -> list[str]:
    """Extract email addresses from HTML content."""
    emails = set()

    # Find all email patterns
    for match in EMAIL_PATTERN.finditer(html):
        email = match.group().lower()

        # Filter out common false positives
        if any(
            x in email
            for x in ["example.com", "domain.com", "email.com", ".png", ".jpg", ".gif"]
        ):
            continue

        # Prefer emails from the same domain
        email_domain = email.split("@")[1] if "@" in email else ""
        if domain in email_domain or email_domain in domain:
            emails.add(email)
        else:
            # Still add external emails but they'll be deprioritized
            emails.add(email)

    return list(emails)


def extract_names_from_html(html: str, soup: BeautifulSoup) -> list[tuple[str, str]]:
    """Extract potential contact names from HTML."""
    names = []

    # Look for structured data (schema.org)
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            import json

            data = json.loads(script.string)
            if isinstance(data, dict):
                if "name" in data and data.get("@type") in [
                    "Person",
                    "RealEstateAgent",
                ]:
                    name = data["name"]
                    parts = name.split()
                    if len(parts) >= 2:
                        names.append((parts[0], parts[-1]))
        except Exception:
            pass

    # Look for common name patterns in meta tags
    for meta in soup.find_all("meta"):
        if meta.get("name") in ["author", "owner"]:
            content = meta.get("content", "")
            parts = content.split()
            if len(parts) >= 2:
                names.append((parts[0], parts[-1]))

    # Look for team/agent sections
    for heading in soup.find_all(["h1", "h2", "h3", "h4"]):
        text = heading.get_text(strip=True)
        # Pattern: "John Smith" or "John Smith - Broker"
        match = re.match(r"^([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s*[-–|]|$)", text)
        if match:
            names.append((match.group(1), match.group(2)))

    return names


def prioritize_email(email: str, names: list[tuple[str, str]]) -> int:
    """
    Score an email for prioritization.
    Higher score = better email to use.
    """
    prefix = email.split("@")[0].lower()
    score = 50  # Base score

    # Penalize generic emails
    if prefix in GENERIC_PREFIXES:
        score -= 30

    # Bonus for personal-looking emails
    if "." in prefix:  # john.smith@
        score += 20

    # Bonus if prefix matches a found name
    for first_name, last_name in names:
        if first_name.lower() in prefix or last_name.lower() in prefix:
            score += 40
            break

    # Bonus for short prefixes (likely personal)
    if len(prefix) < 15:
        score += 10

    return score


async def fetch_page(
    client: httpx.AsyncClient, url: str
) -> tuple[Optional[str], Optional[str]]:
    """Fetch a page and return (html, final_url)."""
    try:
        response = await client.get(url, follow_redirects=True, timeout=10)
        if response.status_code == 200:
            return response.text, str(response.url)
    except Exception:
        pass
    return None, None


async def find_emails_for_website(
    client: httpx.AsyncClient, website: str
) -> tuple[str, str, str]:
    """
    Find the best email and contact name for a website.
    Returns (email, first_name, last_name).
    """
    # Normalize URL
    if not website.startswith(("http://", "https://")):
        website = "https://" + website

    parsed = urlparse(website)
    domain = parsed.netloc.replace("www.", "")
    base_url = f"{parsed.scheme}://{parsed.netloc}"

    all_emails = []
    all_names = []

    # Check multiple pages
    for page in CONTACT_PAGES:
        url = urljoin(base_url, page)
        html, _ = await fetch_page(client, url)

        if html:
            soup = BeautifulSoup(html, "lxml")

            # Extract emails
            emails = extract_emails_from_html(html, domain)
            all_emails.extend(emails)

            # Extract names
            names = extract_names_from_html(html, soup)
            all_names.extend(names)

        # Small delay between requests
        await asyncio.sleep(0.2)

    # Deduplicate
    all_emails = list(set(all_emails))
    all_names = list(set(all_names))

    if not all_emails:
        return "", "", ""

    # Score and sort emails
    scored_emails = [(email, prioritize_email(email, all_names)) for email in all_emails]
    scored_emails.sort(key=lambda x: x[1], reverse=True)

    best_email = scored_emails[0][0]

    # Try to find name associated with best email
    best_first = ""
    best_last = ""

    email_prefix = best_email.split("@")[0].lower()

    # Check if email prefix matches a name
    for first_name, last_name in all_names:
        if first_name.lower() in email_prefix or last_name.lower() in email_prefix:
            best_first = first_name
            best_last = last_name
            break

    # If no match, use first found name
    if not best_first and all_names:
        best_first, best_last = all_names[0]

    return best_email, best_first, best_last


async def process_leads(df: pd.DataFrame, concurrency: int = 10) -> pd.DataFrame:
    """Process all leads and find emails."""
    results = []

    semaphore = asyncio.Semaphore(concurrency)

    async def process_with_semaphore(row):
        async with semaphore:
            website = row.get("website", "")
            if not website:
                return {**row, "email": "", "email_first_name": "", "email_last_name": ""}

            email, first_name, last_name = await find_emails_for_website(client, website)

            # Use found names if we don't have them already
            result = dict(row)
            result["email"] = email
            if first_name and not result.get("first_name"):
                result["first_name"] = first_name
            if last_name and not result.get("last_name"):
                result["last_name"] = last_name

            return result

    async with httpx.AsyncClient(headers=HEADERS) as client:
        with Progress(
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeRemainingColumn(),
            console=console,
        ) as progress:
            task = progress.add_task("Finding emails...", total=len(df))

            tasks = []
            for _, row in df.iterrows():
                tasks.append(process_with_semaphore(row.to_dict()))

            for coro in asyncio.as_completed(tasks):
                result = await coro
                results.append(result)
                progress.advance(task)

    return pd.DataFrame(results)


@app.command()
def main(
    input_file: str = typer.Option(
        ..., "--input", "-i", help="Input CSV file with leads"
    ),
    output: Optional[str] = typer.Option(
        None, "--output", "-o", help="Output CSV file path"
    ),
    concurrency: int = typer.Option(
        10, "--concurrency", "-c", help="Number of concurrent requests"
    ),
):
    """
    Extract emails from business websites.

    Example:
        python email_finder.py -i data/raw_leads.csv -o data/leads_with_emails.csv
    """
    # Load input
    if not Path(input_file).exists():
        console.print(f"[red]Error: Input file not found: {input_file}[/red]")
        raise typer.Exit(1)

    df = pd.read_csv(input_file)
    console.print(f"\n[bold blue]Email Finder[/bold blue]")
    console.print(f"Input: {input_file} ({len(df)} leads)")
    console.print(f"Concurrency: {concurrency}\n")

    # Process
    result_df = asyncio.run(process_leads(df, concurrency))

    # Set output path
    if not output:
        data_dir = Path(input_file).parent
        output = str(data_dir / "leads_with_emails.csv")

    # Save
    result_df.to_csv(output, index=False)

    # Summary
    emails_found = len(result_df[result_df["email"].str.len() > 0])
    names_found = len(
        result_df[
            (result_df["first_name"].str.len() > 0)
            | (result_df["last_name"].str.len() > 0)
        ]
    )

    table = Table(title="Email Finding Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("Total leads", str(len(result_df)))
    table.add_row("Emails found", f"{emails_found} ({emails_found/len(result_df)*100:.1f}%)")
    table.add_row("Names found", f"{names_found} ({names_found/len(result_df)*100:.1f}%)")
    table.add_row("Output file", output)

    console.print(table)
    console.print(f"\n[green]Saved {len(result_df)} leads to {output}[/green]")


if __name__ == "__main__":
    app()
