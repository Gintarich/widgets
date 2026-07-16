from pathlib import Path

import pytest

from widgets.structural_load_widget.materials import (
    MaterialCatalogError,
    load_material_catalog,
)


HEADER = (
    "material_id,display_name,calculation_type,default_thickness_mm,"
    "density_kn_m3,fixed_load_kn_m2,active,sort_order\n"
)


def write(path: Path, body: str) -> Path:
    path.write_text(HEADER + body, encoding="utf-8")
    return path


def test_valid_catalog_is_sorted_and_preserves_inactive(tmp_path):
    path = write(
        tmp_path / "materials.csv",
        "fixed,Membrāna,fixed,,,0.3,no,20\n"
        "layer,Concrete,calculated,50,20,,yes,10\n",
    )
    catalog, digest = load_material_catalog(path)
    assert [item.material_id for item in catalog] == ["layer", "fixed"]
    assert catalog[1].active is False
    assert len(digest) == 64


@pytest.mark.parametrize(
    "body",
    [
        "x,One,calculated,,20,,true,1\n",
        "x,One,fixed,,,0.2,true,1\nx,Two,fixed,,,0.3,true,2\n",
        "x,One,fixed,20,,0.2,true,1\n",
        "x,One,unknown,,,,true,1\n",
    ],
)
def test_invalid_catalog_is_rejected(tmp_path, body):
    with pytest.raises(MaterialCatalogError):
        load_material_catalog(write(tmp_path / "materials.csv", body))
