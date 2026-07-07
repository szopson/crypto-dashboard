#!/usr/bin/env python3
"""
Smartlead CSV Formatter

Formats verified leads into Smartlead import format.
Maps custom fields for personalization in email sequences.

Usage:
    python format_csv.py --input data/verified_leads.csv --output data/smartlead_import.csv
"""

from pathlib import Path
from typing import Optional

import pandas as pd
import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(help="Format leads for Smartlead import")
console = Console()

# Smartlead required and custom columns
SMARTLEAD_COLUMNS = [
    "email",
    "first_name",
    "last_name",
    "company_name",
    "phone",
    # Custom fields for personalization
    "custom1",  # City
    "custom2",  # Rating/Reviews
    "custom3",  # Website
    "custom4",  # Address
    "custom5",  # Categories
]


def format_name(name: str) -> str:
    """Format name properly (capitalize, clean)."""
    if not name or pd.isna(name):
        return ""
    return str(name).strip().title()


def format_rating(rating: float, reviews: int) -> str:
    """Format rating and reviews for personalization."""
    if pd.isna(rating) or pd.isna(reviews):
        return ""
    if rating > 0 and reviews > 0:
        return f"{rating:.1f} stars ({int(reviews)} reviews)"
    return ""


def clean_website(url: str) -> str:
    """Clean website URL for display."""
    if not url or pd.isna(url):
        return ""
    url = str(url).strip()
    # Remove protocol for cleaner look
    url = url.replace("https://", "").replace("http://", "")
    # Remove trailing slash
    url = url.rstrip("/")
    return url


def process_leads(df: pd.DataFrame, valid_only: bool = True) -> pd.DataFrame:
    """Process and format leads for Smartlead."""
    # Filter to valid emails only
    if valid_only:
        df = df[df["verification_status"].isin(["valid", "catch_all"])].copy()

    if len(df) == 0:
        return pd.DataFrame(columns=SMARTLEAD_COLUMNS)

    # Build Smartlead formatted dataframe
    smartlead_df = pd.DataFrame()

    # Required fields
    smartlead_df["email"] = df["email"].str.lower().str.strip()
    smartlead_df["first_name"] = df["first_name"].apply(format_name)
    smartlead_df["last_name"] = df["last_name"].apply(format_name)
    smartlead_df["company_name"] = df["business_name"].str.strip()
    smartlead_df["phone"] = df.get("phone", "").fillna("")

    # Custom fields for personalization
    smartlead_df["custom1"] = df.get("city", "").fillna("")  # {{custom1}} = city
    smartlead_df["custom2"] = df.apply(
        lambda row: format_rating(row.get("rating", 0), row.get("review_count", 0)),
        axis=1,
    )  # {{custom2}} = rating
    smartlead_df["custom3"] = df["website"].apply(clean_website)  # {{custom3}} = website
    smartlead_df["custom4"] = df.get("address", "").fillna("")  # {{custom4}} = address
    smartlead_df["custom5"] = df.get("categories", "").fillna("")  # {{custom5}} = categories

    # Remove rows without email
    smartlead_df = smartlead_df[smartlead_df["email"].str.len() > 0]

    # Deduplicate by email
    smartlead_df = smartlead_df.drop_duplicates(subset=["email"])

    return smartlead_df


@app.command()
def main(
    input_file: str = typer.Option(
        ..., "--input", "-i", help="Input CSV file with verified leads"
    ),
    output: Optional[str] = typer.Option(
        None, "--output", "-o", help="Output CSV file path"
    ),
    include_catchall: bool = typer.Option(
        True, "--include-catchall", help="Include catch-all emails (risky)"
    ),
    valid_only: bool = typer.Option(
        True, "--valid-only", help="Only include valid/catch-all status"
    ),
):
    """
    Format verified leads for Smartlead import.

    Example:
        python format_csv.py -i data/verified_leads.csv -o data/smartlead_import.csv
    """
    # Load input
    if not Path(input_file).exists():
        console.print(f"[red]Error: Input file not found: {input_file}[/red]")
        raise typer.Exit(1)

    df = pd.read_csv(input_file)
    console.print(f"\n[bold blue]Smartlead Formatter[/bold blue]")
    console.print(f"Input: {input_file} ({len(df)} leads)\n")

    # Check if verification status column exists
    if "verification_status" not in df.columns:
        console.print(
            "[yellow]Warning: No verification_status column found. "
            "Assuming all emails are valid.[/yellow]"
        )
        df["verification_status"] = "valid"

    # Filter based on flags
    if valid_only:
        if include_catchall:
            df = df[df["verification_status"].isin(["valid", "catch_all"])]
        else:
            df = df[df["verification_status"] == "valid"]

    # Process
    result_df = process_leads(df, valid_only=False)  # Already filtered above

    if len(result_df) == 0:
        console.print("[yellow]No valid leads to export.[/yellow]")
        raise typer.Exit(0)

    # Set output path
    if not output:
        data_dir = Path(input_file).parent
        output = str(data_dir / "smartlead_import.csv")

    # Save
    result_df.to_csv(output, index=False)

    # Summary
    table = Table(title="Formatting Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("Total leads", str(len(result_df)))
    table.add_row(
        "With first name",
        str(len(result_df[result_df["first_name"].str.len() > 0])),
    )
    table.add_row(
        "With company name",
        str(len(result_df[result_df["company_name"].str.len() > 0])),
    )
    table.add_row(
        "With city",
        str(len(result_df[result_df["custom1"].str.len() > 0])),
    )
    table.add_row("Output file", output)

    console.print(table)

    # Show Smartlead variable mapping
    mapping_table = Table(title="Smartlead Variable Mapping")
    mapping_table.add_column("Variable", style="cyan")
    mapping_table.add_column("Field", style="green")
    mapping_table.add_column("Example", style="dim")

    if len(result_df) > 0:
        sample = result_df.iloc[0]
        mapping_table.add_row("{{email}}", "email", sample["email"])
        mapping_table.add_row("{{first_name}}", "first_name", sample["first_name"])
        mapping_table.add_row("{{last_name}}", "last_name", sample["last_name"])
        mapping_table.add_row("{{company_name}}", "company_name", sample["company_name"])
        mapping_table.add_row("{{custom1}}", "city", sample["custom1"])
        mapping_table.add_row("{{custom2}}", "rating", sample["custom2"])
        mapping_table.add_row("{{custom3}}", "website", sample["custom3"])

    console.print(mapping_table)
    console.print(f"\n[green]Saved {len(result_df)} leads to {output}[/green]")
    console.print("\n[dim]Import this file into Smartlead and use the variables above in your email templates.[/dim]")


if __name__ == "__main__":
    app()
