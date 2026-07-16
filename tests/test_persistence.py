import copy
import json
from pathlib import Path
from unittest.mock import patch

import pytest

from widgets.structural_load_widget.models import new_project_state
from widgets.structural_load_widget.persistence import (
    StateValidationError,
    atomic_save_state,
    load_state,
)


def test_state_round_trip_preserves_identity_and_order(tmp_path):
    path = tmp_path / "state" / "loads.json"
    state = new_project_state()
    original = copy.deepcopy(state)
    atomic_save_state(path, state)
    assert load_state(path) == original


def test_failed_replace_keeps_existing_state(tmp_path):
    path = tmp_path / "loads.json"
    first = new_project_state()
    atomic_save_state(path, first)
    original_text = path.read_text(encoding="utf-8")
    second = new_project_state()
    with patch("widgets.structural_load_widget.persistence.os.replace", side_effect=OSError("disk")):
        with pytest.raises(OSError):
            atomic_save_state(path, second)
    assert path.read_text(encoding="utf-8") == original_text


def test_future_schema_is_rejected_without_overwrite(tmp_path):
    path = tmp_path / "loads.json"
    state = new_project_state()
    state["schema_version"] = 999
    path.write_text(json.dumps(state), encoding="utf-8")
    with pytest.raises(StateValidationError, match="newer"):
        load_state(path)


def test_explicit_orders_control_restored_order(tmp_path):
    path = tmp_path / "loads.json"
    state = new_project_state()
    second = copy.deepcopy(state["tables"][0])
    second["table_id"] = "7da3c4f7-7f5d-4f86-97d4-250e35488f71"
    second["order"] = 0
    state["tables"][0]["order"] = 1
    state["tables"].append(second)
    path.write_text(json.dumps(state), encoding="utf-8")
    restored = load_state(path)
    assert [table["order"] for table in restored["tables"]] == [0, 1]
