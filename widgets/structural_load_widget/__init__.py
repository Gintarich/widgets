"""Structural dead-load table widget."""

from .calculations import (
    CalculationError,
    accepted_design_load,
    calculate_row_load,
    calculate_table_load,
)
from .materials import MaterialCatalogError, MaterialDefinition, load_material_catalog
from .widget import StructuralLoadWidget

__all__ = [
    "CalculationError",
    "MaterialCatalogError",
    "MaterialDefinition",
    "StructuralLoadWidget",
    "accepted_design_load",
    "calculate_row_load",
    "calculate_table_load",
    "load_material_catalog",
]
