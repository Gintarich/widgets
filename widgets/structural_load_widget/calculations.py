"""Pure calculation helpers for structural dead loads."""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from decimal import Decimal, ROUND_CEILING
from typing import Any


class CalculationError(ValueError):
    """Raised when a load cannot be calculated from valid finite values."""


def _non_negative_number(value: Any, label: str) -> float:
    if isinstance(value, bool):
        raise CalculationError(f"{label} must be a number.")
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise CalculationError(f"{label} must be a number.") from exc
    if not math.isfinite(number) or number < 0:
        raise CalculationError(f"{label} must be finite and non-negative.")
    return number


def calculate_row_load(material: Mapping[str, Any], thickness_mm: Any = None) -> float:
    """Return an unrounded characteristic row load in kN/m²."""
    calculation_type = material.get("calculation_type")
    if calculation_type == "calculated":
        thickness = _non_negative_number(thickness_mm, "Thickness")
        density = _non_negative_number(material.get("density_kn_m3"), "Density")
        return thickness / 1000.0 * density
    if calculation_type == "fixed":
        return _non_negative_number(material.get("fixed_load_kn_m2"), "Fixed load")
    raise CalculationError(f"Unknown calculation type: {calculation_type!r}.")


def calculate_table_load(
    rows: Iterable[Mapping[str, Any]],
    materials: Mapping[str, Mapping[str, Any]],
) -> float:
    """Sum selected rows; blank rows contribute zero and invalid rows raise."""
    total = 0.0
    for row in rows:
        material_id = row.get("material_id")
        if not material_id:
            continue
        material = materials.get(str(material_id))
        if material is None:
            raise CalculationError(f"Material {material_id!r} is missing from the catalog.")
        total += calculate_row_load(material, row.get("thickness_mm"))
    return total


def accepted_design_load(total: Any, increment: Any = 0.05) -> float:
    """Round a non-negative total upward to the requested increment."""
    total_number = _non_negative_number(total, "Total")
    increment_number = _non_negative_number(increment, "Accepted-load increment")
    if increment_number == 0:
        raise CalculationError("Accepted-load increment must be greater than zero.")

    # Decimal strings avoid pushing an exact binary-float multiple up one step.
    value = Decimal(str(total_number))
    step = Decimal(str(increment_number))
    epsilon = min(step * Decimal("1e-9"), Decimal("1e-12"))
    adjusted = max(value - epsilon, Decimal(0))
    return float((adjusted / step).to_integral_value(rounding=ROUND_CEILING) * step)
