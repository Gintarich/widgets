import math

import pytest

from widgets.structural_load_widget.calculations import (
    CalculationError,
    accepted_design_load,
    calculate_row_load,
)


def test_calculated_and_fixed_loads():
    calculated = {"calculation_type": "calculated", "density_kn_m3": 20.0}
    fixed = {"calculation_type": "fixed", "fixed_load_kn_m2": 0.30}
    assert calculate_row_load(calculated, 50) == pytest.approx(1.0)
    assert calculate_row_load({**calculated, "density_kn_m3": 0.8}, 300) == pytest.approx(0.24)
    assert calculate_row_load(fixed) == pytest.approx(0.30)


@pytest.mark.parametrize(
    ("total", "expected"), [(1.99, 2.00), (2.00, 2.00), (2.01, 2.05)]
)
def test_accepted_load_rounds_up(total, expected):
    assert accepted_design_load(total) == pytest.approx(expected)


def test_binary_float_at_increment_is_not_rounded_to_next_step():
    assert accepted_design_load(0.1 + 0.2) == pytest.approx(0.30)


@pytest.mark.parametrize("value", [-1, math.nan, math.inf, "invalid"])
def test_invalid_thickness_is_rejected(value):
    with pytest.raises(CalculationError):
        calculate_row_load(
            {"calculation_type": "calculated", "density_kn_m3": 20.0}, value
        )
