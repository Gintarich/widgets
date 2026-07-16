# Structural Load Table Widget — Functional and Technical Specification

## 1. Purpose

This document specifies a Jupyter widget for creating and maintaining structural dead-load tables. A project may contain multiple structure types, and each structure type is represented by an independent table.

The widget must allow a user to:

- create, edit, and remove structure tables;
- give every table a descriptive title and type identifier;
- add, select, reorder in the future, and remove material rows;
- choose materials from a dropdown populated from a CSV file;
- automatically populate material properties and calculate characteristic loads;
- edit thickness where the selected material uses a thickness-based calculation;
- see table totals update immediately;
- save all project table state to disk; and
- restore that state after a notebook cell is rerun or the Jupyter kernel is restarted.

The intended implementation is an `anywidget.AnyWidget` subclass. Python owns file access, CSV validation, authoritative domain validation, calculations used for persistence, and atomic disk saving. A web-standard ECMAScript module renders the interactive table interface and synchronizes user edits through traitlets. The specification separates domain and persistence logic from front-end rendering so the core behavior can be tested without running a notebook UI.

## 2. Scope

### 2.1 Included in the first version

- Multiple structure tables in one project.
- Editable table title and type identifier.
- Material definitions loaded from a CSV file.
- One material dropdown per row.
- Automatically populated density, fixed load, and default thickness.
- Editable thickness for thickness-based materials.
- Fixed-load materials that do not require thickness or density.
- Automatic row load, characteristic total, and accepted design load calculations.
- Add and delete row actions.
- Add and delete table actions.
- Automatic and explicit saving to a project state file.
- Automatic state restoration.
- Validation and readable error reporting.
- Responsive presentation suitable for normal Jupyter notebook widths.

### 2.2 Not included in the first version

- Simultaneous multi-user editing.
- Database storage or cloud synchronization.
- Material editing inside the table widget.
- Structural design-code verification beyond the calculations defined here.
- Load combinations, partial safety factors, live loads, snow loads, or wind loads.
- PDF, Word, or spreadsheet export.
- Drag-and-drop row or table reordering. The persisted data model must nevertheless retain explicit ordering fields so this can be added later.

### 2.3 Required widget platform

The widget must use:

- `anywidget.AnyWidget` as the Python widget base class;
- `traitlets` with `.tag(sync=True)` for Python/JavaScript shared state;
- an Anywidget Front-End Module (AFM) in a separate local ESM file;
- a separate scoped CSS file referenced through `_css`; and
- standard browser DOM controls (`input`, `select`, and `button`) inside the AFM.

The first version should use plain JavaScript without React, Vue, Svelte, or a bundling step. The interaction model is small enough that direct DOM rendering and event delegation are sufficient. Separate local `_esm` and `_css` paths enable Anywidget's development-time file watching and hot module replacement. A bundler may be introduced later if TypeScript or a framework is adopted.

## 3. Terminology and units

| Term | Meaning | Unit |
|---|---|---|
| Material | A selectable construction layer or fixed allowance defined in the CSV file | — |
| Thickness, `t` | Layer thickness | mm |
| Density/unit weight, `γ` | Material unit weight | kN/m³ |
| Characteristic load, `g_k` | Dead load contributed by one row | kN/m² |
| Table total | Sum of valid row characteristic loads | kN/m² |
| Accepted design load | Table total rounded upward to the configured increment | kN/m² |

All internal numeric calculations must use unrounded Python numeric values. Values are rounded only for display and for the accepted-load rule.

## 4. Primary user workflow

1. The user runs the notebook cell that creates the widget.
2. The widget loads and validates the material CSV file.
3. The widget looks for the project state file.
4. If a valid state file exists, the widget restores all tables and rows in their saved order.
5. If no state file exists, the widget creates one initial table with one unselected row, unless the caller supplies different initial content.
6. The user edits the table title and type identifier.
7. The user chooses a material in a row.
8. The row populates from the material definition:
   - a thickness-based material receives its default thickness and density;
   - a fixed-load material displays dashes for thickness and density and uses its fixed load.
9. The row load and table totals update immediately.
10. The user may change thickness, add or delete rows, and add or delete tables.
11. Every meaningful state change schedules an automatic save.
12. The user may also press **Save now** to force an immediate save.
13. When the notebook or kernel is restarted, rerunning the widget cell restores the most recently saved state.

## 5. User interface specification

## 5.1 Overall layout

The root widget contains, in order:

1. a compact project status/action bar;
2. zero or more structure tables; and
3. an **Add table** button below the complete collection.

The project status/action bar should contain:

- save state text such as `Saved`, `Saving…`, `Unsaved changes`, or `Save failed`;
- the last successful save time when available;
- a **Save now** button; and
- an optional **Reload materials** button.

The interface must not require horizontal scrolling at a typical notebook content width of approximately 700–1000 px. A narrower layout may stack row fields vertically.

## 5.2 Structure table

Each structure table is an independent component with the following sections.

### Title row

The first row spans the same width as the material grid and contains:

- a wide editable text field for the table title; and
- a narrower editable text field for the table type identifier.

Suggested defaults for a newly added table:

- title: `Load zone – New structure`;
- type: the next generated identifier, for example `Type J-3`.

The type generator is only a convenience. The user may replace the generated text with any non-empty value. Type identifiers should be unique within a project; duplicates produce a validation warning and block a clean save unless the caller explicitly allows duplicates.

### Column header row

The desktop/table layout uses these columns:

1. **No.**
2. **Material**
3. **Thickness**
4. **Density γ**
5. **Load g_k**
6. **Action**

Recommended relative widths are 5%, 42%, 16%, 15%, 16%, and 6%. The material column receives the most space. The number and action columns remain narrow.

### Material rows

Each row contains:

- an automatically generated sequential row number;
- a material dropdown;
- a thickness input or an em dash;
- a read-only density value or an em dash;
- a read-only calculated load value; and
- a delete-row button with a clearly visible trash icon and an accessible label.

Row numbers are derived from display order and are not stored as permanent identifiers. Every row also has an internal UUID that is persisted and does not change when rows are renumbered.

### Add-row footer

A full-width **Add row** button appears immediately under the final material row and inside the visual boundary of the table. Activating it appends a new unselected row and moves keyboard focus to the new material dropdown.

### Summary

The following values appear directly below each table:

- `Total characteristic load`;
- `Accepted design load`.

Both values are displayed to two decimal places with `kN/m²` units. The accepted value should have stronger visual emphasis.

### Table action

A **Remove table** action appears after the summary. Removing a table must require confirmation when that table contains selected materials or a non-default title. Empty newly created tables may be removed immediately.

## 5.3 Adding a table

The **Add table** button creates a new independent table containing one unselected material row. It must:

- assign a new table UUID;
- suggest the next type identifier without reusing a number already visible in the project;
- use the default new-structure title;
- focus the title field; and
- save the changed project state.

The generated type-number counter must not be the table's permanent identity. If a table is deleted, its number does not need to be reused.

## 5.4 Deleting rows and tables

- Deleting a row updates numbering, totals, and persisted state immediately.
- A table may temporarily contain zero rows, but the interface should normally offer one blank row after creation.
- Deleting a table removes only that table and its rows.
- Deletion must never modify the material CSV file.
- If confirmation is implemented, it must be an in-widget HTML confirmation area or accessible dialog rather than a blocking Python `input()` call.

## 5.5 Keyboard and accessibility behavior

- All actions use semantic native HTML controls rendered by the AFM and are reachable in normal tab order.
- Icon-only buttons have descriptive tooltips and accessible descriptions.
- Pressing Enter in a text or numeric field commits the value and triggers validation/save.
- Focus moves predictably after add/delete actions.
- Errors are shown as text and do not rely only on color.
- Units remain visible next to numeric fields.

## 6. Material CSV specification

## 6.1 Default location

The material file path is supplied by the caller. A recommended project layout is:

```text
project/
├── notebook.ipynb
├── data/
│   └── materials.csv
└── state/
    └── structural_load_tables.json
```

The widget constructor should accept explicit paths:

```python
widget = StructuralLoadWidget(
    materials_path="data/materials.csv",
    state_path="state/structural_load_tables.json",
)
display(widget)
```

Paths are resolved relative to the notebook's current working directory unless absolute paths are provided.

## 6.2 Encoding and formatting

- Encoding: UTF-8, preferably UTF-8 with no BOM.
- Delimiter: comma by default; configurable if required.
- Decimal separator: period (`.`).
- Header row: required.
- Empty numeric fields: empty string, not `-`.
- Units are defined by this specification and must not be included in numeric cells.
- Duplicate `material_id` values are invalid.

## 6.3 Required CSV columns

| Column | Type | Required | Description |
|---|---:|---:|---|
| `material_id` | string | Yes | Stable machine identifier used by saved state. Must not change when the display name changes. |
| `display_name` | string | Yes | Text shown in the material dropdown. |
| `calculation_type` | enum | Yes | Either `calculated` or `fixed`. |
| `default_thickness_mm` | number | Conditional | Required and non-negative for `calculated`; empty for `fixed`. |
| `density_kn_m3` | number | Conditional | Required and non-negative for `calculated`; empty for `fixed`. |
| `fixed_load_kn_m2` | number | Conditional | Required and non-negative for `fixed`; empty for `calculated`. |

## 6.4 Recommended optional CSV columns

| Column | Type | Default | Description |
|---|---:|---:|---|
| `category` | string | empty | Optional grouping metadata. |
| `active` | boolean | `true` | Inactive materials are hidden from new selections but remain resolvable for saved projects. |
| `sort_order` | integer | file order | Controls dropdown order. |
| `description` | string | empty | Optional longer description or tooltip. |
| `source` | string | empty | Standard, manufacturer, or other source reference. |

Recognized boolean values should include `true/false`, `1/0`, and `yes/no`, case-insensitively.

## 6.5 Example CSV

```csv
material_id,display_name,calculation_type,default_thickness_mm,density_kn_m3,fixed_load_kn_m2,category,active,sort_order
concrete_levelling,Concrete levelling layer,calculated,50,20.0,,concrete,true,10
thermal_insulation,Thermal insulation,calculated,300,0.8,,insulation,true,20
roofing_membrane,Roofing membrane,fixed,,,0.30,roofing,true,30
finishing_layer,Finishing layer,calculated,25,10.0,,finish,true,40
building_services,Building services,fixed,,,0.20,allowance,true,50
reinforced_concrete,Reinforced concrete slab,calculated,200,25.0,,concrete,true,60
cement_screed,Cement screed,calculated,60,20.0,,concrete,true,70
mineral_wool,Mineral wool,calculated,200,0.8,,insulation,true,80
```

## 6.6 CSV validation

The complete material file must be validated before replacing the active in-memory catalog. Validation errors include:

- missing required columns;
- empty or duplicate `material_id`;
- empty `display_name`;
- unknown `calculation_type`;
- non-numeric, negative, NaN, or infinite numeric values;
- calculated material missing thickness or density;
- fixed material missing fixed load;
- fields populated in a mutually incompatible way, such as both density and fixed load.

If material reload fails, the widget keeps the last valid in-memory catalog and shows a detailed error. It must not partially apply an invalid file.

## 7. Calculation rules

## 7.1 Thickness-based material

For `calculation_type == "calculated"`:

```text
g_k = (thickness_mm / 1000) × density_kn_m3
```

Example:

```text
50 mm / 1000 × 20.0 kN/m³ = 1.00 kN/m²
```

The selected material supplies density and default thickness. The user may edit the row thickness. Density remains read-only in version 1.

## 7.2 Fixed-load material

For `calculation_type == "fixed"`:

```text
g_k = fixed_load_kn_m2
```

Thickness and density are not applicable and display an em dash. Their input controls are disabled or omitted.

## 7.3 Table total

```text
table_total = sum(row.g_k for every valid selected row)
```

An unselected blank row contributes zero. A selected row containing invalid user input must not be silently treated as zero; the row and table must show an error state. The last valid total may remain visible but must be marked as stale, or the total may display `—`. The chosen implementation must be consistent. The recommended behavior is to display `—` until the error is corrected.

## 7.4 Accepted design load

The default accepted-load increment is `0.05 kN/m²`. The value is always rounded upward:

```python
accepted = ceil((table_total - epsilon) / increment) * increment
```

Equivalent for the default increment:

```python
accepted = ceil((table_total - epsilon) * 20) / 20
```

The small epsilon prevents a floating-point value that is already exactly on an increment from being rounded to the next increment.

Examples:

| Total | Accepted |
|---:|---:|
| 1.99 | 2.00 |
| 2.00 | 2.00 |
| 2.01 | 2.05 |

The increment should be a constructor option and must be stored in project state.

## 7.5 Display precision

- Density: two decimal places by default.
- Row load: two decimal places.
- Table total: two decimal places.
- Accepted load: two decimal places.
- Thickness: display without decimals when integral; otherwise preserve a practical number of decimals.
- Persisted numeric data must not be truncated to display precision.

## 8. State persistence

## 8.1 State file

The project state is stored as UTF-8 JSON. JSON is chosen instead of pickle because it is inspectable, portable, versionable, and safer to load.

Recommended default path:

```text
state/structural_load_tables.json
```

The parent directory is created automatically if it does not exist.

## 8.2 When state is saved

A save is scheduled after any of these changes:

- table added or removed;
- table title changed;
- table type changed;
- row added or removed;
- material selection changed;
- thickness changed;
- project-level calculation settings changed.

Text and numeric edits should use a debounce of approximately 300–750 ms to avoid writing on every keystroke. Structural operations such as add/delete may save immediately.

The UI must also provide **Save now**. Notebook shutdown cannot always be detected reliably, so auto-save plus explicit save is required; saving only when the kernel shuts down is not sufficient.

## 8.3 Atomic write procedure

To reduce the risk of a corrupted state file:

1. serialize and validate the complete state in memory;
2. write it to a temporary file in the same directory;
3. flush and close the temporary file;
4. optionally call `os.fsync()` when durability is important;
5. atomically replace the destination using `os.replace()`.

Optionally retain one backup named `structural_load_tables.json.bak` before replacement. If the main file is unreadable, the widget may offer to restore the backup but must not do so silently.

## 8.4 State schema

The root object uses this structure:

```json
{
  "schema_version": 1,
  "project_id": "7da3c4f7-7f5d-4f86-97d4-250e35488f71",
  "saved_at_utc": "2026-07-16T08:30:00Z",
  "materials": {
    "source_path": "data/materials.csv",
    "source_sha256": "<hexadecimal hash>"
  },
  "settings": {
    "accepted_load_increment_kn_m2": 0.05,
    "display_decimals": 2
  },
  "tables": [
    {
      "table_id": "06136598-d49e-44be-8aca-20484e67ec7e",
      "order": 0,
      "title": "Load zone – Building joint",
      "type_name": "Type J-2",
      "rows": [
        {
          "row_id": "d267bd7c-69ad-4535-9808-fd67388bac35",
          "order": 0,
          "material_id": "concrete_levelling",
          "thickness_mm": 50.0,
          "material_snapshot": {
            "display_name": "Concrete levelling layer",
            "calculation_type": "calculated",
            "density_kn_m3": 20.0,
            "fixed_load_kn_m2": null
          }
        }
      ]
    }
  ]
}
```

Calculated row loads and table totals are derived values and should not be treated as authoritative state. They are recalculated after loading. They may be included in a separate optional audit/export section, but the widget must not depend on them.

## 8.5 Material snapshot and CSV changes

The CSV is the active source of material definitions. State stores both `material_id` and a small snapshot of the material values used at the last save.

On restore:

1. Resolve each `material_id` against the current CSV catalog.
2. If the material exists and its relevant values match the snapshot, restore normally.
3. If the material exists but density, calculation type, or fixed load changed, use the current CSV value, recalculate the load, and show a non-blocking warning identifying the affected rows.
4. If the material no longer exists, retain the saved row and snapshot, label it as a missing material, and require the user to choose a replacement. Do not silently change or delete it.
5. A saved inactive material may remain selected. It is not offered for new selections unless configured otherwise.

The state file stores `source_sha256` so the widget can quickly detect that the material file changed. The path and hash are diagnostic information, not a replacement for row-level comparison.

## 8.6 Loading state

At startup:

1. load and validate materials;
2. load JSON if it exists;
3. validate `schema_version` and the state structure;
4. migrate older supported schema versions in memory;
5. restore tables and rows in `order` sequence;
6. resolve material references;
7. recalculate every row and table;
8. render the widget; and
9. show warnings without discarding recoverable data.

An unsupported future schema version must produce a clear error and must not overwrite the state file.

## 8.7 Rerunning a notebook cell

Rerunning the construction cell may leave an older displayed widget in the notebook output. The implementation should avoid two live widget instances writing to the same state file.

Recommended behavior:

- expose a `close()` method that flushes pending state and closes observers/widgets;
- in the notebook example, close the previous instance before creating a new one; and
- use a process-local lock keyed by the resolved state path to warn or prevent a second active writer.

Example notebook pattern:

```python
try:
    structural_load_widget.close()
except NameError:
    pass

structural_load_widget = StructuralLoadWidget(
    materials_path="data/materials.csv",
    state_path="state/structural_load_tables.json",
)
display(structural_load_widget)
```

For multiple notebook processes, an optional filesystem lock may be added. Version 1 must at minimum detect an external file modification by comparing file modification time or a state revision before overwriting.

## 9. In-memory domain model

UI controls must not be the sole data model. Recommended dataclasses are:

```python
@dataclass(frozen=True)
class MaterialDefinition:
    material_id: str
    display_name: str
    calculation_type: Literal["calculated", "fixed"]
    default_thickness_mm: float | None
    density_kn_m3: float | None
    fixed_load_kn_m2: float | None
    category: str | None = None
    active: bool = True
    sort_order: int = 0

@dataclass
class LoadRowState:
    row_id: str
    material_id: str | None
    thickness_mm: float | None
    order: int

@dataclass
class StructureTableState:
    table_id: str
    title: str
    type_name: str
    rows: list[LoadRowState]
    order: int

@dataclass
class ProjectState:
    schema_version: int
    project_id: str
    tables: list[StructureTableState]
    accepted_load_increment_kn_m2: float = 0.05
```

Calculation functions should be pure functions accepting model values and returning results or validation errors.

## 10. Recommended implementation structure

```text
structural_load_widget/
├── __init__.py
├── widget.py          # anywidget.AnyWidget subclass and synchronized traits
├── models.py          # Dataclasses and schema conversion
├── materials.py       # CSV loading, validation, hashing
├── calculations.py    # Pure row/table calculations and rounding
├── persistence.py     # JSON validation, migration, atomic saving
├── static/
│   ├── index.js       # Anywidget Front-End Module
│   └── styles.css     # Widget-scoped styles
└── tests/
    ├── test_materials.py
    ├── test_calculations.py
    ├── test_persistence.py
    ├── test_widget_state.py
    └── test_frontend.py
```

There should normally be one Python widget class:

- `StructuralLoadWidget`: the `anywidget.AnyWidget` subclass, root project model, and persistence coordinator.

Individual tables and rows are front-end components represented by plain JavaScript objects and DOM elements. They are not separate Python widget instances. This avoids creating hundreds of comm-backed child widgets and keeps the entire project state coherent in one synchronized model.

## 10.1 Python Anywidget class

The class should follow this shape:

```python
from pathlib import Path

import anywidget
import traitlets


STATIC = Path(__file__).parent / "static"


class StructuralLoadWidget(anywidget.AnyWidget):
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
```

The exact traitlet declarations may be strengthened with custom validation, but the synchronized values must remain JSON-serializable.

The constructor must:

1. resolve configuration paths;
2. load and validate the material CSV;
3. load, migrate, and validate saved JSON state if present;
4. resolve saved material references and calculate warnings;
5. assign all synchronized traits before the widget is first displayed; and
6. register Python observers with explicit `names=[...]` filters.

Python observers should include:

```python
self.observe(self._on_project_state_changed, names=["project_state"])
self.observe(self._on_save_requested, names=["save_request_id"])
self.observe(
    self._on_reload_materials_requested,
    names=["reload_materials_request_id"],
)
```

An internal guard such as `_applying_python_state` is required when Python replaces traits during load, validation, or rollback so those assignments do not schedule unintended saves.

## 10.2 Synchronized trait contract

| Trait | Direction | Purpose |
|---|---|---|
| `project_state` | bidirectional | Complete editable project state: settings, tables, rows, selections, and thicknesses. |
| `material_catalog` | Python → JavaScript | Validated, dropdown-ready material definitions. The front end must never edit this trait. |
| `validation_messages` | primarily Python → JavaScript | Structured project, table, row, CSV, and persistence messages. |
| `save_status` | Python → JavaScript | `saved`, `saving`, `dirty`, or `error`. |
| `last_saved_at` | Python → JavaScript | ISO timestamp of the last successful disk save. |
| `state_revision` | Python → JavaScript | Monotonic accepted-state revision for synchronization and stale-write detection. |
| `save_request_id` | JavaScript → Python | Incremented when the user presses **Save now**. |
| `reload_materials_request_id` | JavaScript → Python | Incremented when the user presses **Reload materials**. |

Traitlets are preferred over ad-hoc custom messages. The synchronized traits must be sufficient to reconstruct the complete visible widget state after a new view is rendered.

When JavaScript edits a nested value, it must create a new `project_state` object rather than mutating the object returned by `model.get()` in place. Required pattern:

```javascript
const next = structuredClone(model.get("project_state"));
// Modify next.tables[...] here.
model.set("project_state", next);
model.save_changes();
```

Calling `model.save_changes()` is required after front-end `model.set()` calls so the new value is synchronized to Python.

## 10.3 Anywidget Front-End Module

`static/index.js` must default-export an AFM object using the documented lifecycle:

```javascript
function render({ model, el, signal }) {
  el.classList.add("structural-load-widget");

  const renderProject = () => {
    // Render or reconcile the status bar, tables, rows, and actions.
  };

  renderProject();
  model.on("change:project_state", renderProject);
  model.on("change:material_catalog", renderProject);
  model.on("change:validation_messages", renderProject);
  model.on("change:save_status", renderProject);
  model.on("change:last_saved_at", renderProject);

  return () => {
    model.off("change:project_state", renderProject);
    model.off("change:material_catalog", renderProject);
    model.off("change:validation_messages", renderProject);
    model.off("change:save_status", renderProject);
    model.off("change:last_saved_at", renderProject);
  };
}

export default { render };
```

The actual implementation should avoid replacing a focused input on every keystroke. It may use keyed reconciliation by `table_id` and `row_id`, or capture and restore focus/selection when a full render is unavoidable.

### VS Code notebook keyboard compatibility

VS Code's Jupyter keymap handles single-letter notebook commands such as `A` and `B` in the host process when `notebookOutputInputFocused` is false, so stopping `keydown` propagation alone is insufficient. The AFM keeps control key events inside the widget and uses a `focusin` compatibility bridge to VS Code's `.output` boundary. That bridge walks the composed DOM across shadow hosts and temporarily marks closed-shadow hosts as editable while a control owns focus, allowing VS Code's read/write detector to set the correct context and suppress notebook shortcuts during normal typing.

`render` is executed once for every view displaying the widget instance, so all view-specific DOM and listeners belong inside `render`. It must return cleanup logic or use the supplied `AbortSignal`. No DOM nodes, timers, observers, or event handlers may survive after the view is removed.

Event delegation is recommended: register `input`, `change`, and `click` listeners once on the widget root, locate actions through `data-action`, `data-table-id`, and `data-row-id`, and register listeners with `{ signal }` where supported.

Example:

```javascript
el.addEventListener("click", handleClick, { signal });
el.addEventListener("change", handleChange, { signal });
el.addEventListener("input", handleInput, { signal });
```

The AFM must treat the Anywidget model as shared state. If the same widget instance is displayed in two notebook cells, editing either view must synchronize both views through `project_state`.

## 10.4 Front-end state update rules

- Add/delete operations update `project_state` immediately and call `model.save_changes()`.
- Material selection updates immediately, including its default thickness.
- Thickness and title/type typing updates the visible DOM immediately but sends a debounced model update after approximately 300–500 ms.
- Pressing Enter or leaving the field flushes the pending update immediately.
- Before applying a Python-originated `change:project_state`, the front end cancels or reconciles pending edits to avoid overwriting newer state.
- Derived loads may be calculated immediately in JavaScript for responsiveness, but Python recalculates and validates the same values before saving. The formulas and rounding rules must be implemented identically and covered by shared test fixtures.
- The JavaScript state must not contain file paths that the user has not explicitly provided through Python configuration.

## 10.5 Styling

`static/styles.css` must scope every selector beneath `.structural-load-widget` because Anywidget `_css` styles are loaded globally. The stylesheet must preserve the sharp-cornered professional table appearance from the approved prototype.

The CSS must:

- use CSS custom properties with sensible light/dark fallbacks;
- avoid styling generic global selectors such as `button`, `table`, or `input` without the root class;
- keep the material column wider than number/action columns;
- use a larger, clearly visible delete icon with an adequate click target;
- provide visible focus indication;
- support a stacked layout below approximately 560 px; and
- avoid external web fonts or network-loaded assets.

Icons may be inline SVG elements rendered by the local ESM. SVGs must be decorative when a visible label exists, and icon-only actions must have `aria-label` text.

## 10.6 Development and packaging workflow

Development installation:

```bash
pip install "anywidget[dev]" traitlets
```

Referencing local files from `_esm` and `_css` enables Anywidget's built-in development file watching/hot module replacement. Production packaging must include both static files as package data. No Node.js build step is required for the plain JavaScript version.

The minimum supported versions of Python, Anywidget, Traitlets, JupyterLab/Notebook, and VS Code should be pinned and recorded when implementation begins. Automated compatibility tests should cover the notebook environments used by the project.

## 11. Widget event behavior

| Event | Required response |
|---|---|
| Material dropdown changed | Resolve material, reset thickness to its default when appropriate, update density/load, recalculate table, schedule save. |
| Thickness changed | Validate, recalculate row and table, schedule debounced save. |
| Add row | Append blank row, renumber, focus dropdown, save. |
| Delete row | Remove by UUID, renumber, recalculate, save. |
| Title/type edited | Update state, validate uniqueness/non-empty values, schedule debounced save. |
| Add table | Create table and blank row, generate suggested type, focus title, save. |
| Remove table | Confirm when required, remove by UUID, save. |
| Reload materials | Validate replacement catalog, atomically swap catalog in memory, re-resolve rows, recalculate, warn about changes, save updated snapshots only after user acknowledgment or next deliberate save. |
| Save now | Cancel pending debounce, validate state, atomically save, update status. |

Front-end listeners and `model.on(...)` subscriptions must be detached through the AFM lifecycle cleanup. Python observers and autosave timers must be detached or cancelled by `close()` to avoid memory leaks, duplicate callbacks, and writes from obsolete widget instances.

## 12. Validation and error handling

## 12.1 Row validation

- No selected material: allowed for a blank row; load displays `—`.
- Calculated material thickness: required, numeric, finite, and non-negative.
- Density and fixed load: validated when the catalog loads and read-only in the row.
- Missing saved material: warning/error until replaced.

## 12.2 Table validation

- Title should be non-empty after trimming.
- Type name should be non-empty after trimming.
- Type name should be unique within the project.
- At least one valid selected material is recommended before considering a table complete, but empty tables may be saved as drafts.

## 12.3 Persistence errors

If saving fails:

- keep the in-memory state unchanged;
- show `Save failed` with the error details;
- keep the widget usable;
- do not claim the state is saved;
- allow **Save now** to retry; and
- never delete or truncate the last valid state file.

If loading fails, do not overwrite the invalid file automatically. Offer an empty recovery state only after clearly reporting the failure and, where possible, preserve the corrupt file for inspection.

## 13. Configuration API

Recommended constructor:

```python
StructuralLoadWidget(
    materials_path: str | Path,
    state_path: str | Path,
    *,
    accepted_load_increment_kn_m2: float = 0.05,
    display_decimals: int = 2,
    autosave: bool = True,
    autosave_debounce_seconds: float = 0.5,
    allow_duplicate_type_names: bool = False,
    create_initial_table: bool = True,
)
```

The returned object is directly displayable because it subclasses `anywidget.AnyWidget`:

```python
from structural_load_widget import StructuralLoadWidget

structural_load_widget = StructuralLoadWidget(
    materials_path="data/materials.csv",
    state_path="state/structural_load_tables.json",
)
structural_load_widget
```

Recommended public methods:

```python
widget.save()                 # Immediate validated atomic save
widget.reload()               # Reload saved project state from disk
widget.reload_materials()     # Reload and validate the CSV catalog
widget.to_dict()              # Return serializable current project state
widget.validate()             # Return project validation messages
widget.close()                # Flush/stop observers and close widgets
```

## 14. Performance requirements

- Normal interactions should update visibly within 100 ms for a project containing up to 30 tables with 30 rows each.
- CSV loading and full state restoration should normally complete within one second for up to 5,000 material definitions and 1,000 saved rows on a typical workstation.
- Dropdown options may be shared as an immutable tuple to avoid rebuilding identical option lists for every row.
- The front end should receive the material catalog once per catalog revision rather than once per row.
- A debounced text or thickness edit should produce one trait synchronization operation, not one operation per keystroke.
- Recalculation should be limited to the affected table except when material definitions or project-level settings change.
- Autosave must be debounced and must serialize a consistent snapshot.

## 15. Security and data integrity

- Do not use pickle for untrusted or user-editable state.
- Treat CSV and JSON text as data; never evaluate it as Python.
- Escape material display names when generating any custom HTML.
- Resolve and display actual paths in error messages but avoid exposing unrelated environment information.
- State file writes must be atomic.
- Saved state must include a schema version.
- UUIDs are used for persistent table and row identity.

## 16. Testing requirements

## 16.1 Calculation tests

- `50 mm × 20 kN/m³` produces `1.00 kN/m²`.
- `300 mm × 0.8 kN/m³` produces `0.24 kN/m²`.
- Fixed load `0.30` produces `0.30 kN/m²`.
- Example rows totaling `1.99` produce accepted load `2.00`.
- Total `2.00` remains `2.00`.
- Total `2.01` rounds to `2.05`.
- Invalid, negative, NaN, and infinite values are rejected.

## 16.2 Material loader tests

- Valid CSV loads all expected definitions in sort order.
- Missing required columns fail with a useful message.
- Duplicate IDs fail.
- Conditional fields are enforced by calculation type.
- Inactive materials are excluded from new options but can resolve saved rows.
- UTF-8 display names load correctly.

## 16.3 Persistence tests

- Round-trip save/load preserves table order, row order, UUIDs, titles, types, selections, and thickness overrides.
- Atomic save leaves the previous file intact when a simulated write fails.
- Unsupported future schema version is rejected without overwrite.
- Missing material references are retained and reported.
- A changed material CSV is detected by hash and row snapshot comparison.
- Pending debounced changes are flushed by `save()` and `close()`.

## 16.4 Widget behavior tests

- Adding a table creates an independent model and one blank row.
- Changing a row in one table does not affect another table.
- Adding and deleting rows updates row numbers and totals.
- Deleting a table removes only the selected table.
- Material selection switches between calculated and fixed row presentation correctly.
- Restart simulation restores the last saved project.
- Duplicate type names show validation feedback.
- A save failure is visible and does not disable editing.

## 17. Acceptance criteria

The first version is complete when all of the following are true:

1. The widget loads material definitions from a validated CSV file.
2. A user can create any practical number of structure tables.
3. Each table has editable title and type fields.
4. Each row selects a material from the CSV-backed dropdown.
5. Selecting a calculated material fills its default thickness and density and calculates its load.
6. Selecting a fixed material hides or disables thickness/density and displays its fixed load.
7. Editing thickness updates row load and both table totals immediately.
8. Rows and tables can be added and removed independently.
9. The total and accepted load follow the formulas in this specification.
10. All user-created project state is saved atomically to JSON.
11. Rerunning the notebook cell or restarting the kernel restores the same tables, ordering, titles, types, material selections, and thickness overrides.
12. CSV changes and missing material IDs are reported without silently discarding rows.
13. Invalid CSV or state data cannot corrupt the last valid saved state.
14. Core calculations, CSV parsing, and persistence are covered by automated tests independent of the notebook UI.

## 18. Future extensions

The data model should permit these additions without replacing the version 1 state format entirely:

- drag-and-drop reordering of rows and tables;
- editable density or fixed-load overrides with explicit audit flags;
- material search/grouping for large catalogs;
- table duplication;
- load-category and partial-factor calculations;
- export to CSV, Excel, PDF, or Word;
- project metadata and revision history;
- per-table notes;
- localized labels and decimal formatting; and
- a formal JSON Schema for external integrations.

## 19. Anywidget implementation references

- [Anywidget Getting Started](https://anywidget.dev/en/getting-started/) — `AnyWidget`, synchronized traitlets, `_esm`, `_css`, local file paths, and development HMR.
- [Anywidget Front-End Module](https://anywidget.dev/en/afm/) — AFM module shape, `initialize`/`render`, multiple views, `AbortSignal`, and cleanup requirements.
- [Jupyter Widgets: The Good Parts](https://anywidget.dev/en/jupyter-widgets-the-good-parts/) — model-as-source-of-truth guidance, trait synchronization, multiple views, and explicit observer names.
- [Anywidget Bundling](https://anywidget.dev/en/bundling/) — when a bundler is needed and how production static assets are referenced.
