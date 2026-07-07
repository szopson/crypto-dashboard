#!/usr/bin/env python3
"""
Email Verifier - MillionVerifier Integration

Verifies email addresses using MillionVerifier API.
Supports both single email and bulk verification.

Usage:
    python verify.py --input data/leads_with_emails.csv --output data/verified_leads.csv
    python verify.py --email "test@example.com"  # Single email test
"""

import os
import time
from pathlib import Path
from typing import Optional

import httpx
import pandas as pd
import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TaskProgressColumn,
    TextColumn,
    TimeRemainingColumn,
)
from rich.table import Table

load_dotenv()

app = typer.Typer(help="Verify emails via MillionVerifier API")
console = Console()

# MillionVerifier API endpoints
MV_SINGLE_API = "https://api.millionverifier.com/api/v3/"
MV_BULK_API = "https://bulkapi.millionverifier.com/bulkapi"


def verify_single_email(email: str, api_key: str) -> dict:
    """Verify a single email address."""
    response = httpx.get(
        MV_SINGLE_API,
        params={"api": api_key, "email": email, "timeout": 10},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def upload_bulk_file(filepath: str, api_key: str) -> dict:
    """Upload a file for bulk verification."""
    with open(filepath, "rb") as f:
        response = httpx.post(
            f"{MV_BULK_API}/upload",
            files={"file_contents": f},
            data={"key": api_key},
            timeout=60,
        )
    response.raise_for_status()
    return response.json()


def get_bulk_status(file_id: str, api_key: str) -> dict:
    """Check bulk verification status."""
    response = httpx.get(
        f"{MV_BULK_API}/filestatus",
        params={"key": api_key, "file_id": file_id},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def download_bulk_results(file_id: str, api_key: str, filter_type: str = "all") -> str:
    """Download bulk verification results."""
    response = httpx.get(
        f"{MV_BULK_API}/download",
        params={"key": api_key, "file_id": file_id, "filter": filter_type},
        timeout=120,
    )
    response.raise_for_status()
    return response.text


def classify_result(result: dict) -> str:
    """Classify verification result into categories."""
    # MillionVerifier result codes
    result_code = result.get("result", "").lower()
    quality = result.get("quality", 0)

    if result_code == "ok":
        return "valid"
    elif result_code == "catch_all":
        return "catch_all"
    elif result_code in ["invalid", "error", "unknown"]:
        return "invalid"
    elif result_code == "disposable":
        return "invalid"
    else:
        # Use quality score as fallback
        if quality >= 80:
            return "valid"
        elif quality >= 50:
            return "catch_all"
        else:
            return "invalid"


def verify_emails_single(emails: list[str], api_key: str) -> list[dict]:
    """Verify emails one by one (for small lists < 100)."""
    results = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Verifying emails...", total=len(emails))

        for email in emails:
            if not email or pd.isna(email):
                results.append({"email": email, "status": "invalid", "raw": {}})
                progress.advance(task)
                continue

            try:
                result = verify_single_email(email, api_key)
                status = classify_result(result)
                results.append({"email": email, "status": status, "raw": result})
            except Exception as e:
                console.print(f"[yellow]Warning: Failed to verify {email}: {e}[/yellow]")
                results.append({"email": email, "status": "unknown", "raw": {}})

            progress.advance(task)

            # Rate limiting - MillionVerifier allows ~10 req/sec
            time.sleep(0.15)

    return results


def verify_emails_bulk(input_csv: str, api_key: str) -> pd.DataFrame:
    """Verify emails using bulk API (for large lists)."""
    console.print("[blue]Uploading file for bulk verification...[/blue]")

    # Create temp file with just emails
    df = pd.read_csv(input_csv)
    emails = df["email"].dropna().tolist()

    temp_file = Path(input_csv).parent / "temp_emails.txt"
    with open(temp_file, "w") as f:
        for email in emails:
            f.write(f"{email}\n")

    try:
        # Upload
        upload_result = upload_bulk_file(str(temp_file), api_key)
        file_id = upload_result.get("file_id")

        if not file_id:
            raise Exception(f"Upload failed: {upload_result}")

        console.print(f"[green]Uploaded! File ID: {file_id}[/green]")

        # Poll for completion
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Processing...", total=None)

            while True:
                status = get_bulk_status(file_id, api_key)
                percent = status.get("percent", 0)
                progress.update(task, description=f"Processing... {percent}%")

                if status.get("status") == "finished":
                    break
                elif status.get("status") == "error":
                    raise Exception(f"Bulk verification failed: {status}")

                time.sleep(5)

        # Download results
        console.print("[blue]Downloading results...[/blue]")
        results_csv = download_bulk_results(file_id, api_key)

        # Parse results
        from io import StringIO

        results_df = pd.read_csv(StringIO(results_csv))

        # Map results back to original data
        email_to_status = {}
        for _, row in results_df.iterrows():
            email = row.get("email", "")
            result = row.get("result", "unknown")
            email_to_status[email.lower()] = classify_result({"result": result})

        # Add status to original dataframe
        df["verification_status"] = df["email"].apply(
            lambda x: email_to_status.get(str(x).lower(), "unknown") if pd.notna(x) else "invalid"
        )

        return df

    finally:
        # Cleanup temp file
        if temp_file.exists():
            temp_file.unlink()


@app.command("verify")
def verify_file(
    input_file: str = typer.Option(
        ..., "--input", "-i", help="Input CSV file with emails"
    ),
    output: Optional[str] = typer.Option(
        None, "--output", "-o", help="Output CSV file path"
    ),
    api_key: Optional[str] = typer.Option(
        None, "--api-key", envvar="MILLIONVERIFIER_KEY", help="MillionVerifier API key"
    ),
    bulk: bool = typer.Option(
        False, "--bulk", "-b", help="Use bulk API for large lists (>100 emails)"
    ),
    valid_only: bool = typer.Option(
        False, "--valid-only", help="Only output valid emails"
    ),
):
    """
    Verify emails in a CSV file.

    Example:
        python verify.py -i data/leads_with_emails.csv -o data/verified_leads.csv
    """
    if not api_key:
        console.print(
            "[red]Error: MILLIONVERIFIER_KEY not set. Use --api-key or set environment variable.[/red]"
        )
        raise typer.Exit(1)

    # Load input
    if not Path(input_file).exists():
        console.print(f"[red]Error: Input file not found: {input_file}[/red]")
        raise typer.Exit(1)

    df = pd.read_csv(input_file)

    # Filter rows with emails
    emails_df = df[df["email"].notna() & (df["email"].str.len() > 0)]
    console.print(f"\n[bold blue]Email Verifier[/bold blue]")
    console.print(f"Input: {input_file}")
    console.print(f"Emails to verify: {len(emails_df)}\n")

    if len(emails_df) == 0:
        console.print("[yellow]No emails to verify.[/yellow]")
        raise typer.Exit(0)

    # Verify
    if bulk or len(emails_df) > 100:
        console.print("[blue]Using bulk API...[/blue]")
        result_df = verify_emails_bulk(input_file, api_key)
    else:
        # Single verification for small lists
        emails = emails_df["email"].tolist()
        results = verify_emails_single(emails, api_key)

        # Create status mapping
        email_to_status = {r["email"]: r["status"] for r in results}
        df["verification_status"] = df["email"].apply(
            lambda x: email_to_status.get(x, "unknown") if pd.notna(x) else "invalid"
        )
        result_df = df

    # Filter if requested
    if valid_only:
        result_df = result_df[result_df["verification_status"] == "valid"]

    # Set output path
    if not output:
        data_dir = Path(input_file).parent
        output = str(data_dir / "verified_leads.csv")

    # Save
    result_df.to_csv(output, index=False)

    # Summary
    status_counts = result_df["verification_status"].value_counts()

    table = Table(title="Verification Summary")
    table.add_column("Status", style="cyan")
    table.add_column("Count", style="green")
    table.add_column("Percentage", style="yellow")

    total = len(result_df)
    for status in ["valid", "catch_all", "invalid", "unknown"]:
        count = status_counts.get(status, 0)
        pct = (count / total * 100) if total > 0 else 0
        color = {"valid": "green", "catch_all": "yellow", "invalid": "red", "unknown": "dim"}.get(status, "white")
        table.add_row(status, str(count), f"[{color}]{pct:.1f}%[/{color}]")

    console.print(table)
    console.print(f"\n[green]Saved {len(result_df)} leads to {output}[/green]")


@app.command("single")
def verify_single(
    email: str = typer.Argument(..., help="Email address to verify"),
    api_key: Optional[str] = typer.Option(
        None, "--api-key", envvar="MILLIONVERIFIER_KEY", help="MillionVerifier API key"
    ),
):
    """
    Verify a single email address.

    Example:
        python verify.py single john@example.com
    """
    if not api_key:
        console.print(
            "[red]Error: MILLIONVERIFIER_KEY not set. Use --api-key or set environment variable.[/red]"
        )
        raise typer.Exit(1)

    console.print(f"\n[bold blue]Verifying:[/bold blue] {email}\n")

    try:
        result = verify_single_email(email, api_key)
        status = classify_result(result)

        table = Table(title="Verification Result")
        table.add_column("Field", style="cyan")
        table.add_column("Value", style="green")

        table.add_row("Email", email)
        table.add_row("Status", f"[{'green' if status == 'valid' else 'red'}]{status}[/]")
        table.add_row("Result", result.get("result", "N/A"))
        table.add_row("Quality", str(result.get("quality", "N/A")))
        table.add_row("Free", str(result.get("free", "N/A")))
        table.add_row("Role", str(result.get("role", "N/A")))

        console.print(table)

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
