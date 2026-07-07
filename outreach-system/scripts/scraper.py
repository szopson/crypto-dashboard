#!/usr/bin/env python3
"""
Google Maps Scraper for Lead Generation

Scrapes business data from Google Maps via SerpAPI.
Filters by review count to find established businesses.

Usage:
    python scraper.py --query "real estate agency" --city "Miami" --limit 100
    python scraper.py --query "real estate" --cities "Miami,Tampa,Orlando" --limit 500 --min-reviews 5
"""

import os
import re
import time
from pathlib import Path
from typing import Optional

import httpx
import pandas as pd
import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

load_dotenv()

app = typer.Typer(help="Google Maps scraper for lead generation")
console = Console()

# SerpAPI endpoint
SERPAPI_URL = "https://serpapi.com/search"


def search_google_maps(
    query: str,
    location: str,
    api_key: str,
    start: int = 0,
) -> dict:
    """Search Google Maps via SerpAPI."""
    params = {
        "engine": "google_maps",
        "q": query,
        "ll": f"@{location},14z",  # Coordinates with zoom level
        "type": "search",
        "api_key": api_key,
        "start": start,
    }

    # If location is a city name, use text search instead
    if not re.match(r"^-?\d+\.?\d*,-?\d+\.?\d*$", location):
        params = {
            "engine": "google_maps",
            "q": f"{query} in {location}",
            "type": "search",
            "api_key": api_key,
            "start": start,
        }

    response = httpx.get(SERPAPI_URL, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def extract_lead_data(result: dict) -> dict:
    """Extract relevant lead data from a search result."""
    # Try to extract owner/contact name from title or reviews
    business_name = result.get("title", "")

    # Extract first name from business name if it looks like a person's name
    # e.g., "John Smith Real Estate" -> "John"
    name_parts = business_name.split()
    first_name = ""
    last_name = ""

    # Check if first word looks like a first name (not "The", "A", numbers, etc.)
    if name_parts and name_parts[0][0].isupper() and len(name_parts[0]) > 2:
        common_prefixes = {"the", "a", "an", "best", "top", "premier", "elite", "luxury"}
        if name_parts[0].lower() not in common_prefixes:
            first_name = name_parts[0]
            if len(name_parts) > 1 and name_parts[1][0].isupper():
                # Check if second word is also a name (not "Real", "Estate", etc.)
                common_suffixes = {"real", "estate", "realty", "properties", "group", "team", "agency", "company", "inc", "llc", "corp"}
                if name_parts[1].lower() not in common_suffixes:
                    last_name = name_parts[1]

    return {
        "business_name": business_name,
        "first_name": first_name,
        "last_name": last_name,
        "website": result.get("website", ""),
        "phone": result.get("phone", ""),
        "address": result.get("address", ""),
        "city": "",  # Will be filled from address
        "rating": result.get("rating", 0),
        "review_count": result.get("reviews", 0),
        "place_id": result.get("place_id", ""),
        "categories": ", ".join(result.get("types", result.get("type", "").split(","))),
        "thumbnail": result.get("thumbnail", ""),
    }


def extract_city_from_address(address: str) -> str:
    """Extract city name from address string."""
    if not address:
        return ""

    # Common pattern: "123 Main St, City, State ZIP"
    parts = [p.strip() for p in address.split(",")]
    if len(parts) >= 2:
        # City is usually the second-to-last or second part
        city_part = parts[-2] if len(parts) >= 3 else parts[-1]
        # Remove state/zip if present
        city = re.sub(r"\s+[A-Z]{2}\s*\d{5}.*$", "", city_part).strip()
        return city
    return ""


def scrape_leads(
    query: str,
    cities: list[str],
    limit: int,
    min_reviews: int,
    api_key: str,
) -> pd.DataFrame:
    """Scrape leads from Google Maps for multiple cities."""
    all_leads = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        for city in cities:
            task = progress.add_task(f"Scraping {city}...", total=None)

            start = 0
            city_leads = []

            while len(city_leads) < limit // len(cities):
                try:
                    results = search_google_maps(query, city, api_key, start)

                    local_results = results.get("local_results", [])
                    if not local_results:
                        break

                    for result in local_results:
                        lead = extract_lead_data(result)
                        lead["city"] = city  # Override with search city

                        # Apply review filter
                        if lead["review_count"] >= min_reviews:
                            # Skip if no website (can't find email)
                            if lead["website"]:
                                city_leads.append(lead)

                    start += 20  # SerpAPI returns 20 results per page

                    # Rate limiting
                    time.sleep(0.5)

                except httpx.HTTPStatusError as e:
                    console.print(f"[red]API error for {city}: {e}[/red]")
                    break
                except Exception as e:
                    console.print(f"[red]Error scraping {city}: {e}[/red]")
                    break

            all_leads.extend(city_leads[:limit // len(cities)])
            progress.update(task, completed=True)

    return pd.DataFrame(all_leads)


@app.command()
def main(
    query: str = typer.Option(..., "--query", "-q", help="Search query (e.g., 'real estate agency')"),
    city: Optional[str] = typer.Option(None, "--city", "-c", help="Single city to search"),
    cities: Optional[str] = typer.Option(None, "--cities", help="Comma-separated list of cities"),
    limit: int = typer.Option(100, "--limit", "-l", help="Maximum number of leads to scrape"),
    min_reviews: int = typer.Option(5, "--min-reviews", "-r", help="Minimum number of Google reviews"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Output CSV file path"),
    api_key: Optional[str] = typer.Option(None, "--api-key", envvar="SERPAPI_KEY", help="SerpAPI key"),
):
    """
    Scrape business leads from Google Maps.

    Examples:
        python scraper.py -q "real estate agency" -c "Miami" -l 100
        python scraper.py -q "real estate" --cities "Miami,Tampa,Orlando" -l 500
    """
    if not api_key:
        console.print("[red]Error: SERPAPI_KEY not set. Use --api-key or set environment variable.[/red]")
        raise typer.Exit(1)

    # Parse cities
    city_list = []
    if city:
        city_list = [city]
    elif cities:
        city_list = [c.strip() for c in cities.split(",")]
    else:
        console.print("[red]Error: Specify --city or --cities[/red]")
        raise typer.Exit(1)

    console.print(f"\n[bold blue]Google Maps Scraper[/bold blue]")
    console.print(f"Query: {query}")
    console.print(f"Cities: {', '.join(city_list)}")
    console.print(f"Limit: {limit} | Min reviews: {min_reviews}\n")

    # Scrape
    df = scrape_leads(query, city_list, limit, min_reviews, api_key)

    if df.empty:
        console.print("[yellow]No leads found matching criteria.[/yellow]")
        raise typer.Exit(0)

    # Deduplicate by place_id
    df = df.drop_duplicates(subset=["place_id"])

    # Set output path
    if not output:
        data_dir = Path(__file__).parent.parent / "data"
        data_dir.mkdir(exist_ok=True)
        output = str(data_dir / "raw_leads.csv")

    # Save
    df.to_csv(output, index=False)

    # Summary table
    table = Table(title="Scraping Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("Total leads", str(len(df)))
    table.add_row("With website", str(len(df[df["website"].str.len() > 0])))
    table.add_row("Avg rating", f"{df['rating'].mean():.1f}")
    table.add_row("Avg reviews", f"{df['review_count'].mean():.0f}")
    table.add_row("Output file", output)

    console.print(table)
    console.print(f"\n[green]Saved {len(df)} leads to {output}[/green]")


if __name__ == "__main__":
    app()
