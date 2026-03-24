"""
services/csv_import.py — shared CSV parsing utility for bulk import endpoints.

Keeps all three import endpoints (leads, contacts, accounts) DRY.
Uses only stdlib: csv, io, re.
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field

from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_ROWS  = 5_000
MAX_BYTES = 5 * 1024 * 1024   # 5 MB

_EMAIL_RE = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
)


# ---------------------------------------------------------------------------
# Response schema  (shared across all import endpoints)
# ---------------------------------------------------------------------------

class RowError(BaseModel):
    row: int
    reason: str


class ImportResult(BaseModel):
    imported: int
    skipped:  int
    errors:   list[RowError]


# ---------------------------------------------------------------------------
# Internal data class returned by parse_csv_bytes
# ---------------------------------------------------------------------------

@dataclass
class ParsedCSV:
    rows:   list[dict[str, str]]       # normalised (lowercase keys, stripped values)
    errors: list[RowError] = field(default_factory=list)   # seed errors (e.g. row-limit hit)


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def validate_email(value: str) -> bool:
    return bool(_EMAIL_RE.match(value.strip()))


def parse_csv_bytes(content: bytes, required_columns: set[str]) -> ParsedCSV:
    """
    Decode *content*, read it as CSV, and return normalised rows.

    - Strips BOM (utf-8-sig).
    - Normalises all header names to lowercase + stripped.
    - Raises ValueError for file-too-large or missing required columns.
    - Silently truncates at MAX_ROWS and appends a seed error for the caller.
    """
    if len(content) > MAX_BYTES:
        raise ValueError(
            f"File too large — maximum allowed size is {MAX_BYTES // 1024 // 1024} MB"
        )

    text   = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        raise ValueError("Empty or unreadable CSV file")

    # Normalise header names for comparison
    normalised_headers = {h.strip().lower() for h in reader.fieldnames}
    missing = {c.lower() for c in required_columns} - normalised_headers
    if missing:
        raise ValueError(
            f"Missing required column(s): {', '.join(sorted(missing))}"
        )

    rows: list[dict[str, str]] = []
    seed_errors: list[RowError] = []

    for i, raw_row in enumerate(reader, start=1):
        if i > MAX_ROWS:
            seed_errors.append(RowError(
                row=i,
                reason=f"Row limit ({MAX_ROWS:,}) reached — remaining rows were not imported",
            ))
            break
        # Normalise keys and values
        rows.append({
            k.strip().lower(): (v.strip() if v else "")
            for k, v in raw_row.items()
            if k  # skip None keys (trailing commas in CSV)
        })

    return ParsedCSV(rows=rows, errors=seed_errors)
