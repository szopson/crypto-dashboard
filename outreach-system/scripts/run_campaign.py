#!/usr/bin/env python3
"""
Campaign Pipeline Orchestrator

Runs the full outreach pipeline:
1. Scrape leads from Google Maps
2. Find emails from websites
3. Verify emails via MillionVerifier
4. Format for Smartlead import

Usage:
    python run_campaign.py --query "real estate agency" --cities "Miami,Tampa" --limit 500
    python run_campaign.py --step scrape --query "real estate" --city "Miami" --limit 100
"""

import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

load_dotenv()

app = typer.Typer(help="Outreach campaign pipeline orchestrator")
console = Console()

SCRIPTS_DIR = Path(__file__).parent
DATA_DIR = SCRIPTS_DIR.parent / "data"


def run_script(script_name: str, args: list[str]) -> bool:
    """Run a pipeline script and return success status."""
    script_path = SCRIPTS_DIR / script_name
    cmd = [sys.executable, str(script_path)] + args

    try:
        result = subprocess.run(cmd, capture_output=False, text=True)
        return result.returncode == 0
    except Exception as e:
        console.print(f"[red]Error running {script_name}: {e}[/red]")
        return False


def get_file_stats(filepath: Path) -> dict:
    """Get statistics from a CSV file."""
    if not filepath.exists():
        return {"rows": 0, "exists": False}

    df = pd.read_csv(filepath)
    stats = {"rows": len(df), "exists": True}

    if "email" in df.columns:
        stats["with_email"] = len(df[df["email"].notna() & (df["email"].str.len() > 0)])

    if "verification_status" in df.columns:
        stats["valid"] = len(df[df["verification_status"] == "valid"])
        stats["catch_all"] = len(df[df["verification_status"] == "catch_all"])
        stats["invalid"] = len(df[df["verification_status"] == "invalid"])

    return stats


@app.command("full")
def run_full_pipeline(
    query: str = typer.Option(
        "real estate agency", "--query", "-q", help="Search query"
    ),
    city: Optional[str] = typer.Option(None, "--city", "-c", help="Single city"),
    cities: Optional[str] = typer.Option(
        None, "--cities", help="Comma-separated cities"
    ),
    limit: int = typer.Option(100, "--limit", "-l", help="Max leads to scrape"),
    min_reviews: int = typer.Option(5, "--min-reviews", "-r", help="Min Google reviews"),
    campaign_name: Optional[str] = typer.Option(
        None, "--name", "-n", help="Campaign name for output files"
    ),
    skip_verify: bool = typer.Option(
        False, "--skip-verify", help="Skip email verification"
    ),
):
    """
    Run the full outreach pipeline.

    Example:
        python run_campaign.py full -q "real estate agency" --cities "Miami,Tampa" -l 500
    """
    # Validate inputs
    if not city and not cities:
        console.print("[red]Error: Specify --city or --cities[/red]")
        raise typer.Exit(1)

    city_list = city if city else cities

    # Check API keys
    serpapi_key = os.getenv("SERPAPI_KEY")
    mv_key = os.getenv("MILLIONVERIFIER_KEY")

    if not serpapi_key:
        console.print("[red]Error: SERPAPI_KEY not set in environment[/red]")
        raise typer.Exit(1)

    if not mv_key and not skip_verify:
        console.print(
            "[yellow]Warning: MILLIONVERIFIER_KEY not set. Use --skip-verify or set the key.[/yellow]"
        )
        raise typer.Exit(1)

    # Setup output directory
    DATA_DIR.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    campaign_id = campaign_name or f"campaign_{timestamp}"

    # File paths for this campaign
    raw_file = DATA_DIR / f"{campaign_id}_raw.csv"
    emails_file = DATA_DIR / f"{campaign_id}_emails.csv"
    verified_file = DATA_DIR / f"{campaign_id}_verified.csv"
    smartlead_file = DATA_DIR / f"{campaign_id}_smartlead.csv"

    console.print(
        Panel.fit(
            f"[bold blue]Outreach Campaign Pipeline[/bold blue]\n\n"
            f"Query: {query}\n"
            f"Cities: {city_list}\n"
            f"Limit: {limit} | Min reviews: {min_reviews}\n"
            f"Campaign: {campaign_id}",
            title="Starting Pipeline",
        )
    )

    steps = [
        ("Scraping Google Maps", "scraper.py"),
        ("Finding emails", "email_finder.py"),
        ("Verifying emails", "verify.py"),
        ("Formatting for Smartlead", "format_csv.py"),
    ]

    if skip_verify:
        steps = [s for s in steps if "verify" not in s[1]]

    results = {}

    # Step 1: Scrape
    console.print("\n[bold]Step 1/4: Scraping Google Maps[/bold]")
    scrape_args = [
        "-q", query,
        "--cities" if cities else "-c", city_list,
        "-l", str(limit),
        "-r", str(min_reviews),
        "-o", str(raw_file),
    ]
    if run_script("scraper.py", scrape_args):
        results["scrape"] = get_file_stats(raw_file)
        console.print(f"[green]Scraped {results['scrape']['rows']} leads[/green]")
    else:
        console.print("[red]Scraping failed. Aborting pipeline.[/red]")
        raise typer.Exit(1)

    # Step 2: Find emails
    console.print("\n[bold]Step 2/4: Finding emails[/bold]")
    email_args = ["-i", str(raw_file), "-o", str(emails_file)]
    if run_script("email_finder.py", email_args):
        results["emails"] = get_file_stats(emails_file)
        console.print(
            f"[green]Found {results['emails'].get('with_email', 0)} emails[/green]"
        )
    else:
        console.print("[red]Email finding failed. Aborting pipeline.[/red]")
        raise typer.Exit(1)

    # Step 3: Verify emails
    if not skip_verify:
        console.print("\n[bold]Step 3/4: Verifying emails[/bold]")
        verify_args = ["-i", str(emails_file), "-o", str(verified_file)]
        if run_script("verify.py", verify_args):
            results["verify"] = get_file_stats(verified_file)
            console.print(
                f"[green]Verified: {results['verify'].get('valid', 0)} valid, "
                f"{results['verify'].get('catch_all', 0)} catch-all[/green]"
            )
        else:
            console.print("[yellow]Verification failed. Continuing without...[/yellow]")
            verified_file = emails_file
            results["verify"] = results["emails"]
    else:
        console.print("\n[bold]Step 3/4: Skipping verification[/bold]")
        verified_file = emails_file
        results["verify"] = results["emails"]

    # Step 4: Format for Smartlead
    console.print("\n[bold]Step 4/4: Formatting for Smartlead[/bold]")
    format_args = ["-i", str(verified_file), "-o", str(smartlead_file)]
    if run_script("format_csv.py", format_args):
        results["smartlead"] = get_file_stats(smartlead_file)
        console.print(
            f"[green]Formatted {results['smartlead']['rows']} leads for Smartlead[/green]"
        )
    else:
        console.print("[red]Formatting failed.[/red]")
        raise typer.Exit(1)

    # Final summary
    console.print("\n")
    table = Table(title="Pipeline Summary")
    table.add_column("Step", style="cyan")
    table.add_column("Output", style="green")
    table.add_column("Count", style="yellow")

    table.add_row("1. Scrape", str(raw_file.name), str(results["scrape"]["rows"]))
    table.add_row(
        "2. Emails",
        str(emails_file.name),
        str(results["emails"].get("with_email", 0)),
    )
    if not skip_verify:
        table.add_row(
            "3. Verify",
            str(verified_file.name),
            f"{results['verify'].get('valid', 0)} valid",
        )
    table.add_row(
        "4. Smartlead",
        str(smartlead_file.name),
        str(results["smartlead"]["rows"]),
    )

    console.print(table)

    # Conversion funnel
    initial = results["scrape"]["rows"]
    final = results["smartlead"]["rows"]
    conversion = (final / initial * 100) if initial > 0 else 0

    console.print(
        Panel.fit(
            f"[bold green]Pipeline Complete![/bold green]\n\n"
            f"Started with: {initial} businesses\n"
            f"Ended with: {final} verified leads\n"
            f"Conversion: {conversion:.1f}%\n\n"
            f"[dim]Import {smartlead_file.name} into Smartlead to start your campaign.[/dim]",
            title="Results",
        )
    )

    # Log campaign to tracking file
    tracking_file = DATA_DIR / "campaigns.csv"
    campaign_log = {
        "campaign_id": campaign_id,
        "date": datetime.now().isoformat(),
        "query": query,
        "cities": city_list,
        "scraped": results["scrape"]["rows"],
        "emails_found": results["emails"].get("with_email", 0),
        "verified": results["verify"].get("valid", 0)
        + results["verify"].get("catch_all", 0),
        "smartlead_ready": results["smartlead"]["rows"],
        "output_file": str(smartlead_file),
    }

    if tracking_file.exists():
        tracking_df = pd.read_csv(tracking_file)
        tracking_df = pd.concat([tracking_df, pd.DataFrame([campaign_log])], ignore_index=True)
    else:
        tracking_df = pd.DataFrame([campaign_log])

    tracking_df.to_csv(tracking_file, index=False)
    console.print(f"\n[dim]Campaign logged to {tracking_file}[/dim]")


@app.command("step")
def run_single_step(
    step: str = typer.Argument(
        ..., help="Step to run: scrape, emails, verify, format"
    ),
    input_file: Optional[str] = typer.Option(
        None, "--input", "-i", help="Input file (for steps after scrape)"
    ),
    output: Optional[str] = typer.Option(
        None, "--output", "-o", help="Output file path"
    ),
    query: Optional[str] = typer.Option(
        None, "--query", "-q", help="Search query (for scrape)"
    ),
    city: Optional[str] = typer.Option(None, "--city", "-c", help="City (for scrape)"),
    cities: Optional[str] = typer.Option(
        None, "--cities", help="Cities comma-separated (for scrape)"
    ),
    limit: int = typer.Option(100, "--limit", "-l", help="Limit (for scrape)"),
    min_reviews: int = typer.Option(5, "--min-reviews", "-r", help="Min reviews"),
):
    """
    Run a single pipeline step.

    Examples:
        python run_campaign.py step scrape -q "real estate" -c "Miami" -l 50
        python run_campaign.py step emails -i data/raw_leads.csv
        python run_campaign.py step verify -i data/leads_with_emails.csv
        python run_campaign.py step format -i data/verified_leads.csv
    """
    step_map = {
        "scrape": "scraper.py",
        "emails": "email_finder.py",
        "verify": "verify.py",
        "format": "format_csv.py",
    }

    if step not in step_map:
        console.print(f"[red]Unknown step: {step}. Use: {list(step_map.keys())}[/red]")
        raise typer.Exit(1)

    script = step_map[step]
    args = []

    if step == "scrape":
        if not query:
            console.print("[red]Error: --query required for scrape step[/red]")
            raise typer.Exit(1)
        if not city and not cities:
            console.print("[red]Error: --city or --cities required for scrape step[/red]")
            raise typer.Exit(1)

        args = [
            "-q", query,
            "--cities" if cities else "-c", cities or city,
            "-l", str(limit),
            "-r", str(min_reviews),
        ]
        if output:
            args.extend(["-o", output])
    else:
        if not input_file:
            console.print(f"[red]Error: --input required for {step} step[/red]")
            raise typer.Exit(1)
        args = ["-i", input_file]
        if output:
            args.extend(["-o", output])

    console.print(f"[blue]Running {script}...[/blue]")
    if run_script(script, args):
        console.print(f"[green]Step '{step}' completed successfully.[/green]")
    else:
        console.print(f"[red]Step '{step}' failed.[/red]")
        raise typer.Exit(1)


@app.command("status")
def show_status():
    """Show status of data files and recent campaigns."""
    DATA_DIR.mkdir(exist_ok=True)

    console.print("\n[bold blue]Outreach System Status[/bold blue]\n")

    # Data files
    table = Table(title="Data Files")
    table.add_column("File", style="cyan")
    table.add_column("Rows", style="green")
    table.add_column("Modified", style="dim")

    for csv_file in sorted(DATA_DIR.glob("*.csv")):
        try:
            df = pd.read_csv(csv_file)
            mtime = datetime.fromtimestamp(csv_file.stat().st_mtime)
            table.add_row(csv_file.name, str(len(df)), mtime.strftime("%Y-%m-%d %H:%M"))
        except Exception:
            table.add_row(csv_file.name, "Error", "")

    console.print(table)

    # Recent campaigns
    tracking_file = DATA_DIR / "campaigns.csv"
    if tracking_file.exists():
        console.print("\n")
        campaigns_df = pd.read_csv(tracking_file)
        recent = campaigns_df.tail(5)

        camp_table = Table(title="Recent Campaigns")
        camp_table.add_column("ID", style="cyan")
        camp_table.add_column("Date", style="dim")
        camp_table.add_column("Query", style="white")
        camp_table.add_column("Scraped", style="yellow")
        camp_table.add_column("Ready", style="green")

        for _, row in recent.iterrows():
            camp_table.add_row(
                row["campaign_id"],
                row["date"][:10],
                f"{row['query'][:20]}...",
                str(row["scraped"]),
                str(row["smartlead_ready"]),
            )

        console.print(camp_table)


if __name__ == "__main__":
    app()
