"""JSON-compatible state model helpers."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any
from uuid import uuid4


SCHEMA_VERSION = 1
DEFAULT_TITLE = "Load zone – New structure"


@dataclass
class LoadRowState:
    row_id: str = field(default_factory=lambda: str(uuid4()))
    material_id: str | None = None
    thickness_mm: float | None = None
    order: int = 0
    material_snapshot: dict[str, Any] | None = None


@dataclass
class StructureTableState:
    table_id: str = field(default_factory=lambda: str(uuid4()))
    title: str = DEFAULT_TITLE
    type_name: str = "Type J-1"
    rows: list[LoadRowState] = field(default_factory=lambda: [LoadRowState()])
    order: int = 0


def new_project_state(
    *,
    accepted_load_increment_kn_m2: float = 0.05,
    display_decimals: int = 2,
    create_initial_table: bool = True,
) -> dict[str, Any]:
    tables = [asdict(StructureTableState())] if create_initial_table else []
    return {
        "schema_version": SCHEMA_VERSION,
        "project_id": str(uuid4()),
        "saved_at_utc": None,
        "materials": {"source_path": "", "source_sha256": ""},
        "settings": {
            "accepted_load_increment_kn_m2": accepted_load_increment_kn_m2,
            "display_decimals": display_decimals,
        },
        "tables": tables,
    }
