"""CSV loading and validation for structural load materials."""

from __future__ import annotations

import csv
import hashlib
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


REQUIRED_COLUMNS = {
    "material_id",
    "display_name",
    "calculation_type",
    "default_thickness_mm",
    "density_kn_m3",
    "fixed_load_kn_m2",
}


class MaterialCatalogError(ValueError):
    """Raised when the complete material CSV is not valid."""


@dataclass(frozen=True)
class MaterialDefinition:
    material_id: str
    display_name: str
    calculation_type: str
    default_thickness_mm: float | None
    density_kn_m3: float | None
    fixed_load_kn_m2: float | None
    category: str = ""
    active: bool = True
    sort_order: int = 0
    description: str = ""
    source: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _number(value: str, label: str, row_number: int, *, required: bool) -> float | None:
    value = value.strip()
    if not value:
        if required:
            raise MaterialCatalogError(f"Row {row_number}: {label} is required.")
        return None
    try:
        number = float(value)
    except ValueError as exc:
        raise MaterialCatalogError(f"Row {row_number}: {label} must be numeric.") from exc
    if not math.isfinite(number) or number < 0:
        raise MaterialCatalogError(
            f"Row {row_number}: {label} must be finite and non-negative."
        )
    return number


def _boolean(value: str, row_number: int) -> bool:
    normalized = value.strip().lower()
    if normalized in {"", "true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no"}:
        return False
    raise MaterialCatalogError(
        f"Row {row_number}: active must be true/false, 1/0, or yes/no."
    )


def load_material_catalog(
    path: str | Path, *, delimiter: str = ","
) -> tuple[list[MaterialDefinition], str]:
    """Validate the whole CSV and return sorted definitions plus its SHA-256."""
    csv_path = Path(path).expanduser().resolve()
    try:
        raw = csv_path.read_bytes()
    except OSError as exc:
        raise MaterialCatalogError(f"Cannot read material CSV {csv_path}: {exc}") from exc

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise MaterialCatalogError(f"Material CSV {csv_path} is not valid UTF-8.") from exc

    reader = csv.DictReader(text.splitlines(), delimiter=delimiter)
    columns = set(reader.fieldnames or [])
    missing = sorted(REQUIRED_COLUMNS - columns)
    if missing:
        raise MaterialCatalogError(
            f"Material CSV {csv_path} is missing columns: {', '.join(missing)}."
        )

    definitions: list[tuple[int, MaterialDefinition]] = []
    seen: set[str] = set()
    for file_order, row in enumerate(reader):
        row_number = file_order + 2
        material_id = (row.get("material_id") or "").strip()
        display_name = (row.get("display_name") or "").strip()
        calculation_type = (row.get("calculation_type") or "").strip().lower()
        if not material_id:
            raise MaterialCatalogError(f"Row {row_number}: material_id is required.")
        if material_id in seen:
            raise MaterialCatalogError(
                f"Row {row_number}: duplicate material_id {material_id!r}."
            )
        if not display_name:
            raise MaterialCatalogError(f"Row {row_number}: display_name is required.")
        if calculation_type not in {"calculated", "fixed"}:
            raise MaterialCatalogError(
                f"Row {row_number}: calculation_type must be 'calculated' or 'fixed'."
            )

        is_calculated = calculation_type == "calculated"
        default_thickness = _number(
            row.get("default_thickness_mm") or "",
            "default_thickness_mm",
            row_number,
            required=is_calculated,
        )
        density = _number(
            row.get("density_kn_m3") or "",
            "density_kn_m3",
            row_number,
            required=is_calculated,
        )
        fixed_load = _number(
            row.get("fixed_load_kn_m2") or "",
            "fixed_load_kn_m2",
            row_number,
            required=not is_calculated,
        )
        if is_calculated and fixed_load is not None:
            raise MaterialCatalogError(
                f"Row {row_number}: calculated materials cannot define fixed_load_kn_m2."
            )
        if not is_calculated and (default_thickness is not None or density is not None):
            raise MaterialCatalogError(
                f"Row {row_number}: fixed materials cannot define thickness or density."
            )

        sort_text = (row.get("sort_order") or "").strip()
        try:
            sort_order = int(sort_text) if sort_text else file_order
        except ValueError as exc:
            raise MaterialCatalogError(
                f"Row {row_number}: sort_order must be an integer."
            ) from exc

        definition = MaterialDefinition(
            material_id=material_id,
            display_name=display_name,
            calculation_type=calculation_type,
            default_thickness_mm=default_thickness,
            density_kn_m3=density,
            fixed_load_kn_m2=fixed_load,
            category=(row.get("category") or "").strip(),
            active=_boolean(row.get("active") or "", row_number),
            sort_order=sort_order,
            description=(row.get("description") or "").strip(),
            source=(row.get("source") or "").strip(),
        )
        definitions.append((file_order, definition))
        seen.add(material_id)

    definitions.sort(key=lambda item: (item[1].sort_order, item[0]))
    return [definition for _, definition in definitions], hashlib.sha256(raw).hexdigest()
