"""State validation and atomic JSON persistence."""

from __future__ import annotations

import json
import math
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any
from uuid import UUID

from .models import SCHEMA_VERSION


class StateValidationError(ValueError):
    """Raised for malformed or unsupported project state."""


def _uuid(value: Any, label: str) -> None:
    try:
        UUID(str(value))
    except (ValueError, TypeError, AttributeError) as exc:
        raise StateValidationError(f"{label} must be a UUID.") from exc


def validate_state_schema(state: Any) -> dict[str, Any]:
    """Validate persistence shape without applying domain/catalog rules."""
    if not isinstance(state, dict):
        raise StateValidationError("Project state must be a JSON object.")
    version = state.get("schema_version")
    if version != SCHEMA_VERSION:
        if isinstance(version, int) and version > SCHEMA_VERSION:
            raise StateValidationError(
                f"State schema version {version} is newer than supported version {SCHEMA_VERSION}."
            )
        raise StateValidationError(f"Unsupported state schema version: {version!r}.")
    _uuid(state.get("project_id"), "project_id")
    saved_at = state.get("saved_at_utc")
    if saved_at is not None and not isinstance(saved_at, str):
        raise StateValidationError("saved_at_utc must be a string or null.")
    materials = state.get("materials")
    if not isinstance(materials, dict):
        raise StateValidationError("materials must be an object.")
    if not isinstance(materials.get("source_path", ""), str) or not isinstance(
        materials.get("source_sha256", ""), str
    ):
        raise StateValidationError("Material source path and hash must be strings.")
    settings = state.get("settings")
    if not isinstance(settings, dict):
        raise StateValidationError("settings must be an object.")
    increment = settings.get("accepted_load_increment_kn_m2")
    if isinstance(increment, bool) or not isinstance(increment, (int, float)):
        raise StateValidationError("Accepted-load increment must be numeric.")
    if not math.isfinite(float(increment)) or increment <= 0:
        raise StateValidationError("Accepted-load increment must be finite and greater than zero.")
    decimals = settings.get("display_decimals")
    if isinstance(decimals, bool) or not isinstance(decimals, int) or not 0 <= decimals <= 8:
        raise StateValidationError("display_decimals must be an integer from 0 to 8.")
    tables = state.get("tables")
    if not isinstance(tables, list):
        raise StateValidationError("tables must be a list.")

    table_ids: set[str] = set()
    table_orders: set[int] = set()
    for table_index, table in enumerate(tables):
        label = f"tables[{table_index}]"
        if not isinstance(table, dict):
            raise StateValidationError(f"{label} must be an object.")
        table_id = str(table.get("table_id"))
        _uuid(table_id, f"{label}.table_id")
        if table_id in table_ids:
            raise StateValidationError(f"Duplicate table_id {table_id!r}.")
        table_ids.add(table_id)
        if not isinstance(table.get("title"), str) or not isinstance(table.get("type_name"), str):
            raise StateValidationError(f"{label} title and type_name must be strings.")
        if not isinstance(table.get("order"), int):
            raise StateValidationError(f"{label}.order must be an integer.")
        if table["order"] in table_orders:
            raise StateValidationError(f"Duplicate table order {table['order']}.")
        table_orders.add(table["order"])
        rows = table.get("rows")
        if not isinstance(rows, list):
            raise StateValidationError(f"{label}.rows must be a list.")
        row_ids: set[str] = set()
        row_orders: set[int] = set()
        for row_index, row in enumerate(rows):
            row_label = f"{label}.rows[{row_index}]"
            if not isinstance(row, dict):
                raise StateValidationError(f"{row_label} must be an object.")
            row_id = str(row.get("row_id"))
            _uuid(row_id, f"{row_label}.row_id")
            if row_id in row_ids:
                raise StateValidationError(f"Duplicate row_id {row_id!r} in {label}.")
            row_ids.add(row_id)
            if not isinstance(row.get("order"), int):
                raise StateValidationError(f"{row_label}.order must be an integer.")
            if row["order"] in row_orders:
                raise StateValidationError(
                    f"Duplicate row order {row['order']} in {label}."
                )
            row_orders.add(row["order"])
            material_id = row.get("material_id")
            if material_id is not None and not isinstance(material_id, str):
                raise StateValidationError(f"{row_label}.material_id must be a string or null.")
            thickness = row.get("thickness_mm")
            if thickness is not None and (
                isinstance(thickness, bool)
                or not isinstance(thickness, (int, float))
                or not math.isfinite(float(thickness))
            ):
                raise StateValidationError(f"{row_label}.thickness_mm must be finite or null.")
            snapshot = row.get("material_snapshot")
            if snapshot is not None and not isinstance(snapshot, dict):
                raise StateValidationError(
                    f"{row_label}.material_snapshot must be an object or null."
                )
    return state


def load_state(path: str | Path) -> dict[str, Any]:
    state_path = Path(path).expanduser().resolve()
    try:
        with state_path.open(encoding="utf-8") as handle:
            state = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise StateValidationError(f"Cannot load state file {state_path}: {exc}") from exc
    validated = validate_state_schema(state)
    validated["tables"].sort(key=lambda table: table["order"])
    for table in validated["tables"]:
        table["rows"].sort(key=lambda row: row["order"])
    return validated


def atomic_save_state(
    path: str | Path, state: dict[str, Any], *, keep_backup: bool = True
) -> None:
    state_path = Path(path).expanduser().resolve()
    validate_state_schema(state)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            dir=state_path.parent,
            prefix=f".{state_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_name = temporary.name
            json.dump(state, temporary, ensure_ascii=False, indent=2, allow_nan=False)
            temporary.write("\n")
            temporary.flush()
            os.fsync(temporary.fileno())
        if keep_backup and state_path.exists():
            shutil.copy2(state_path, state_path.with_suffix(state_path.suffix + ".bak"))
        os.replace(temporary_name, state_path)
        temporary_name = None
    finally:
        if temporary_name:
            try:
                Path(temporary_name).unlink()
            except OSError:
                pass
