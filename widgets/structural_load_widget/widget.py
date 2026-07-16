"""Anywidget coordination layer for structural dead-load tables."""

from __future__ import annotations

import copy
import math
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import anywidget
import traitlets

from .calculations import CalculationError, calculate_row_load
from .materials import MaterialCatalogError, MaterialDefinition, load_material_catalog
from .models import new_project_state
from .persistence import StateValidationError, atomic_save_state, load_state, validate_state_schema


STATIC = Path(__file__).parent / "static"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _message(
    level: str,
    text: str,
    *,
    code: str,
    scope: str = "project",
    table_id: str | None = None,
    row_id: str | None = None,
) -> dict[str, Any]:
    return {
        "level": level,
        "message": text,
        "code": code,
        "scope": scope,
        "table_id": table_id,
        "row_id": row_id,
    }


class StructuralLoadWidget(anywidget.AnyWidget):
    """Editable, CSV-backed structural dead-load tables with JSON persistence."""

    _esm = STATIC / "index.js"
    _css = STATIC / "styles.css"

    project_state = traitlets.Dict().tag(sync=True)
    material_catalog = traitlets.List(trait=traitlets.Dict()).tag(sync=True)
    validation_messages = traitlets.List(trait=traitlets.Dict()).tag(sync=True)
    save_status = traitlets.Unicode("saved").tag(sync=True)
    last_saved_at = traitlets.Unicode(allow_none=True, default_value=None).tag(sync=True)
    state_revision = traitlets.Int(0).tag(sync=True)
    save_request_id = traitlets.Int(0).tag(sync=True)
    reload_materials_request_id = traitlets.Int(0).tag(sync=True)

    def __init__(
        self,
        materials_path: str | Path,
        state_path: str | Path,
        *,
        accepted_load_increment_kn_m2: float = 0.05,
        display_decimals: int = 2,
        autosave: bool = True,
        autosave_debounce_seconds: float = 0.5,
        allow_duplicate_type_names: bool = False,
        create_initial_table: bool = True,
        csv_delimiter: str = ",",
        **kwargs: Any,
    ) -> None:
        if (
            isinstance(accepted_load_increment_kn_m2, bool)
            or not math.isfinite(float(accepted_load_increment_kn_m2))
            or accepted_load_increment_kn_m2 <= 0
        ):
            raise ValueError("accepted_load_increment_kn_m2 must be finite and greater than zero.")
        if (
            isinstance(display_decimals, bool)
            or not isinstance(display_decimals, int)
            or not 0 <= display_decimals <= 8
        ):
            raise ValueError("display_decimals must be an integer from 0 to 8.")
        if autosave_debounce_seconds < 0:
            raise ValueError("autosave_debounce_seconds cannot be negative.")

        self.materials_path = Path(materials_path).expanduser().resolve()
        self.state_path = Path(state_path).expanduser().resolve()
        self.autosave = autosave
        self.autosave_debounce_seconds = autosave_debounce_seconds
        self.allow_duplicate_type_names = allow_duplicate_type_names
        self.csv_delimiter = csv_delimiter
        self._catalog: dict[str, MaterialDefinition] = {}
        self._catalog_hash = ""
        self._system_messages: list[dict[str, Any]] = []
        self._autosave_timer: threading.Timer | None = None
        self._timer_lock = threading.RLock()
        self._applying_python_state = True
        self._state_load_failed = False
        self._closed = False

        initial_state = new_project_state(
            accepted_load_increment_kn_m2=accepted_load_increment_kn_m2,
            display_decimals=display_decimals,
            create_initial_table=create_initial_table,
        )
        try:
            definitions, catalog_hash = load_material_catalog(
                self.materials_path, delimiter=csv_delimiter
            )
            self._set_catalog(definitions, catalog_hash)
        except MaterialCatalogError as exc:
            self._system_messages.append(
                _message("error", str(exc), code="materials_load_failed", scope="catalog")
            )

        if self.state_path.exists():
            try:
                initial_state = copy.deepcopy(load_state(self.state_path))
                self._system_messages.extend(self._material_change_messages(initial_state))
            except StateValidationError as exc:
                self._state_load_failed = True
                self._system_messages.append(
                    _message(
                        "error",
                        f"Saved state was not loaded and will not be overwritten automatically: {exc}",
                        code="state_load_failed",
                        scope="persistence",
                    )
                )

        initial_state.setdefault("materials", {})
        if not initial_state["materials"].get("source_path"):
            initial_state["materials"]["source_path"] = str(self.materials_path)
        if not initial_state["materials"].get("source_sha256"):
            initial_state["materials"]["source_sha256"] = self._catalog_hash
        has_system_error = any(
            message.get("level") == "error" for message in self._system_messages
        )
        super().__init__(
            project_state=initial_state,
            material_catalog=[definition.to_dict() for definition in self._catalog.values()],
            validation_messages=[],
            save_status="error" if has_system_error else "saved",
            last_saved_at=initial_state.get("saved_at_utc"),
            **kwargs,
        )
        self.validation_messages = self._system_messages + self._domain_validation(initial_state)
        self._applying_python_state = False
        self.observe(self._on_project_state_changed, names=["project_state"])
        self.observe(self._on_save_requested, names=["save_request_id"])
        self.observe(
            self._on_reload_materials_requested,
            names=["reload_materials_request_id"],
        )
        if not self.state_path.exists() and autosave and not has_system_error:
            self.save_status = "dirty"
            self._schedule_save()

    def _set_catalog(
        self, definitions: list[MaterialDefinition], catalog_hash: str
    ) -> None:
        self._catalog = {definition.material_id: definition for definition in definitions}
        self._catalog_hash = catalog_hash

    def _material_change_messages(self, state: dict[str, Any]) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []
        saved_hash = state.get("materials", {}).get("source_sha256")
        if saved_hash and self._catalog_hash and saved_hash != self._catalog_hash:
            messages.append(
                _message(
                    "warning",
                    "The material CSV has changed since this project was last saved.",
                    code="catalog_hash_changed",
                    scope="catalog",
                )
            )
        for table in state.get("tables", []):
            for row in table.get("rows", []):
                material_id = row.get("material_id")
                if not material_id:
                    continue
                material = self._catalog.get(material_id)
                if material is None:
                    # Domain validation reports this dynamically so choosing a
                    # replacement clears the error without requiring a reload.
                    continue
                snapshot = row.get("material_snapshot") or {}
                changed = any(
                    snapshot.get(key) != getattr(material, key)
                    for key in ("calculation_type", "density_kn_m3", "fixed_load_kn_m2")
                    if key in snapshot
                )
                if changed:
                    messages.append(
                        _message(
                            "warning",
                            f"{material.display_name!r} changed in the CSV; current values are being used.",
                            code="material_definition_changed",
                            scope="row",
                            table_id=table.get("table_id"),
                            row_id=row.get("row_id"),
                        )
                    )
        return messages

    def _domain_validation(self, state: dict[str, Any]) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []
        try:
            validate_state_schema(state)
        except StateValidationError as exc:
            return [_message("error", str(exc), code="invalid_state")]

        type_owners: dict[str, str] = {}
        for table in state.get("tables", []):
            table_id = table.get("table_id")
            title = table.get("title", "").strip()
            type_name = table.get("type_name", "").strip()
            if not title:
                messages.append(
                    _message(
                        "error",
                        "Table title cannot be empty.",
                        code="empty_title",
                        scope="table",
                        table_id=table_id,
                    )
                )
            if not type_name:
                messages.append(
                    _message(
                        "error",
                        "Type identifier cannot be empty.",
                        code="empty_type",
                        scope="table",
                        table_id=table_id,
                    )
                )
            normalized_type = type_name.casefold()
            if type_name and not self.allow_duplicate_type_names:
                if normalized_type in type_owners:
                    messages.append(
                        _message(
                            "error",
                            f"Type identifier {type_name!r} is already used by another table.",
                            code="duplicate_type",
                            scope="table",
                            table_id=table_id,
                        )
                    )
                else:
                    type_owners[normalized_type] = table_id

            selected_count = 0
            for row in table.get("rows", []):
                material_id = row.get("material_id")
                if not material_id:
                    continue
                selected_count += 1
                material = self._catalog.get(material_id)
                if material is None:
                    messages.append(
                        _message(
                            "error",
                            f"Material {material_id!r} is not available; choose a replacement.",
                            code="missing_material",
                            scope="row",
                            table_id=table_id,
                            row_id=row.get("row_id"),
                        )
                    )
                    continue
                try:
                    calculate_row_load(material.to_dict(), row.get("thickness_mm"))
                except CalculationError as exc:
                    messages.append(
                        _message(
                            "error",
                            str(exc),
                            code="invalid_row",
                            scope="row",
                            table_id=table_id,
                            row_id=row.get("row_id"),
                        )
                    )
            if not selected_count:
                messages.append(
                    _message(
                        "warning",
                        "This table has no selected materials and is saved as a draft.",
                        code="empty_table",
                        scope="table",
                        table_id=table_id,
                    )
                )
        return messages

    def _refresh_messages(self) -> list[dict[str, Any]]:
        messages = self._system_messages + self._domain_validation(self.project_state)
        self.validation_messages = messages
        return messages

    def _on_project_state_changed(self, change: traitlets.Bunch) -> None:
        if self._applying_python_state or self._closed:
            return
        self.state_revision += 1
        self.save_status = "dirty"
        self._refresh_messages()
        if self.autosave and not self._state_load_failed:
            self._schedule_save()

    def _schedule_save(self) -> None:
        with self._timer_lock:
            self._cancel_timer()
            self._autosave_timer = threading.Timer(
                self.autosave_debounce_seconds, self._autosave_callback
            )
            self._autosave_timer.daemon = True
            self._autosave_timer.start()

    def _cancel_timer(self) -> None:
        if self._autosave_timer is not None:
            self._autosave_timer.cancel()
            self._autosave_timer = None

    def _autosave_callback(self) -> None:
        with self._timer_lock:
            self._autosave_timer = None
        if not self._closed:
            self.save()

    def _on_save_requested(self, change: traitlets.Bunch) -> None:
        if not self._applying_python_state and change.get("new") != change.get("old"):
            # An explicit retry is deliberate recovery from a corrupt source state.
            self._state_load_failed = False
            self._system_messages = [
                message
                for message in self._system_messages
                if message.get("code") != "state_load_failed"
            ]
            self.save()

    def _on_reload_materials_requested(self, change: traitlets.Bunch) -> None:
        if not self._applying_python_state and change.get("new") != change.get("old"):
            self.reload_materials()

    def _state_for_save(self) -> dict[str, Any]:
        state = copy.deepcopy(self.project_state)
        now = _utc_now()
        state["saved_at_utc"] = now
        state["materials"] = {
            "source_path": str(self.materials_path),
            "source_sha256": self._catalog_hash,
        }
        for table_order, table in enumerate(state.get("tables", [])):
            table["order"] = table_order
            for row_order, row in enumerate(table.get("rows", [])):
                row["order"] = row_order
                material = self._catalog.get(row.get("material_id"))
                if material is not None:
                    row["material_snapshot"] = {
                        "display_name": material.display_name,
                        "calculation_type": material.calculation_type,
                        "density_kn_m3": material.density_kn_m3,
                        "fixed_load_kn_m2": material.fixed_load_kn_m2,
                    }
                elif not row.get("material_id"):
                    row["material_snapshot"] = None
        return state

    def save(self) -> bool:
        """Immediately validate and atomically persist the current project state."""
        with self._timer_lock:
            self._cancel_timer()
        messages = self._refresh_messages()
        blocking = [message for message in messages if message.get("level") == "error"]
        if blocking:
            self.save_status = "error"
            return False
        self.save_status = "saving"
        state = self._state_for_save()
        try:
            atomic_save_state(self.state_path, state)
        except (OSError, StateValidationError, TypeError, ValueError) as exc:
            self._system_messages = [
                message
                for message in self._system_messages
                if message.get("code") != "save_failed"
            ]
            self._system_messages.append(
                _message(
                    "error",
                    f"Save failed for {self.state_path}: {exc}",
                    code="save_failed",
                    scope="persistence",
                )
            )
            self.save_status = "error"
            self._refresh_messages()
            return False

        self._system_messages = [
            message
            for message in self._system_messages
            if message.get("code")
            not in {
                "save_failed",
                "state_load_failed",
                "catalog_hash_changed",
                "material_definition_changed",
            }
        ]
        self._applying_python_state = True
        try:
            self.project_state = state
            self.last_saved_at = state["saved_at_utc"]
            self.state_revision += 1
            self.save_status = "saved"
            self.validation_messages = self._system_messages + self._domain_validation(state)
        finally:
            self._applying_python_state = False
        return True

    def reload(self) -> bool:
        """Reload the project JSON from disk without changing it."""
        try:
            state = load_state(self.state_path)
        except StateValidationError as exc:
            self._system_messages.append(
                _message("error", str(exc), code="state_load_failed", scope="persistence")
            )
            self.save_status = "error"
            self._refresh_messages()
            return False
        self._applying_python_state = True
        try:
            self._state_load_failed = False
            self._system_messages = self._material_change_messages(state)
            self.project_state = copy.deepcopy(state)
            self.last_saved_at = state.get("saved_at_utc")
            self.state_revision += 1
            self.save_status = "saved"
            self.validation_messages = self._system_messages + self._domain_validation(state)
        finally:
            self._applying_python_state = False
        return True

    def reload_materials(self) -> bool:
        """Atomically replace the catalog only when the complete CSV is valid."""
        try:
            definitions, catalog_hash = load_material_catalog(
                self.materials_path, delimiter=self.csv_delimiter
            )
        except MaterialCatalogError as exc:
            self._system_messages = [
                message
                for message in self._system_messages
                if message.get("code") != "materials_reload_failed"
            ]
            self._system_messages.append(
                _message(
                    "error", str(exc), code="materials_reload_failed", scope="catalog"
                )
            )
            self.save_status = "error"
            self._refresh_messages()
            return False

        self._set_catalog(definitions, catalog_hash)
        self._system_messages = self._material_change_messages(self.project_state)
        self._applying_python_state = True
        try:
            self.material_catalog = [definition.to_dict() for definition in definitions]
            self.state_revision += 1
            self.save_status = "dirty"
            self.validation_messages = self._system_messages + self._domain_validation(
                self.project_state
            )
        finally:
            self._applying_python_state = False
        # Keep changed snapshots dirty until Save now (or an explicit Python save/close).
        return True

    def to_dict(self) -> dict[str, Any]:
        """Return an isolated JSON-compatible copy of the current state."""
        return copy.deepcopy(self.project_state)

    def validate(self) -> list[dict[str, Any]]:
        """Return current structured project validation messages."""
        return copy.deepcopy(self._refresh_messages())

    def close(self) -> None:
        """Flush valid dirty state, stop timers/observers, and close the widget."""
        if self._closed:
            return
        with self._timer_lock:
            self._cancel_timer()
        if self.save_status == "dirty" and not self._state_load_failed:
            self.save()
        self._closed = True
        self.unobserve(self._on_project_state_changed, names=["project_state"])
        self.unobserve(self._on_save_requested, names=["save_request_id"])
        self.unobserve(
            self._on_reload_materials_requested,
            names=["reload_materials_request_id"],
        )
        super().close()
