import copy
import json
import time

from widgets import StructuralLoadWidget


CSV = """material_id,display_name,calculation_type,default_thickness_mm,density_kn_m3,fixed_load_kn_m2,active,sort_order
concrete,Concrete,calculated,50,20,,true,1
membrane,Membrane,fixed,,,0.3,true,2
"""


def make_widget(tmp_path, **kwargs):
    materials = tmp_path / "materials.csv"
    materials.write_text(CSV, encoding="utf-8")
    return StructuralLoadWidget(
        materials,
        tmp_path / "state" / "loads.json",
        autosave=False,
        **kwargs,
    )


def selected_state(widget):
    state = widget.to_dict()
    row = state["tables"][0]["rows"][0]
    row["material_id"] = "concrete"
    row["thickness_mm"] = 75.25
    return state


def test_save_and_restart_restore_all_editable_state(tmp_path):
    widget = make_widget(tmp_path)
    state = selected_state(widget)
    state["tables"][0]["title"] = "Roof build-up"
    state["tables"][0]["type_name"] = "Type R-7"
    widget.project_state = state
    assert widget.save()
    saved = widget.to_dict()
    widget.close()

    restored = make_widget(tmp_path)
    assert restored.project_state["tables"] == saved["tables"]
    assert restored.project_state["project_id"] == saved["project_id"]
    restored.close()


def test_duplicate_types_block_clean_save(tmp_path):
    widget = make_widget(tmp_path)
    state = selected_state(widget)
    duplicate = copy.deepcopy(state["tables"][0])
    duplicate["table_id"] = "7da3c4f7-7f5d-4f86-97d4-250e35488f71"
    duplicate["order"] = 1
    duplicate["rows"] = []
    state["tables"].append(duplicate)
    widget.project_state = state
    assert not widget.save()
    assert any(message["code"] == "duplicate_type" for message in widget.validate())
    widget.close()


def test_invalid_reload_keeps_last_valid_catalog(tmp_path):
    widget = make_widget(tmp_path)
    before = widget.material_catalog
    widget.materials_path.write_text("wrong,columns\n1,2\n", encoding="utf-8")
    assert not widget.reload_materials()
    assert widget.material_catalog == before
    widget.close()


def test_missing_material_error_clears_after_replacement(tmp_path):
    widget = make_widget(tmp_path)
    state = selected_state(widget)
    state["tables"][0]["rows"][0]["material_id"] = "removed_material"
    widget.project_state = state
    assert any(message["code"] == "missing_material" for message in widget.validate())
    repaired = widget.to_dict()
    repaired["tables"][0]["rows"][0]["material_id"] = "membrane"
    repaired["tables"][0]["rows"][0]["thickness_mm"] = None
    widget.project_state = repaired
    assert not any(message["code"] == "missing_material" for message in widget.validate())
    assert widget.save()
    widget.close()
