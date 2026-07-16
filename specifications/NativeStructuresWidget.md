# Native Structural Load Table Widget — Functional and Technical Specification

## 1. Purpose

This document specifies a Jupyter widget for creating and maintaining structural dead-load tables. A project may contain multiple structure types, and each structure type is represented by an independent table.

The implementation must be written entirely in Python with `ipywidgets`. Python owns the complete interface, event handling, file access, CSV validation, domain validation, calculations, and persistence. The package contains Python source and ordinary package metadata only.

The widget must allow a user to:

- create, edit, and remove structure tables;
- give every table a descriptive title and type identifier;
- add, select, and remove material rows;
- choose materials from a dropdown populated from a CSV file;
- automatically populate material properties and calculate characteristic loads;
- edit thickness where the selected material uses a thickness-based calculation;
- see table totals update after each edit;
- save all project table state to disk; and
- restore that state after a notebook cell is rerun or the Jupyter kernel is restarted.

Domain and persistence logic must remain independent of notebook display code so it can be tested without rendering widgets.

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
- A layout suitable for common Jupyter notebook widths.

### 2.2 Not included in the first version

- Simultaneous multi-user editing.
- Database storage or cloud synchronization.
- Material editing inside the table widget.
- Structural design-code verification beyond the calculations defined here.
- Load combinations, partial safety factors, live loads, snow loads, or wind loads.
- PDF, Word, or spreadsheet export.
- Drag-and-drop row or table reordering. The persisted data model must retain explicit ordering fields so reordering can be added later.

### 2.3 Required widget platform

The widget must use Python and `ipywidgets` only. The main project widget should derive from `ipywidgets.VBox` or own a root `ipywidgets.VBox`. Tables and rows must be composed from standard controls such as:

- `VBox` and `HBox` for composition;
- `Text`, `FloatText`, and `Dropdown` for editing;
- `Label` for headings, values, units, and messages;
- `Button` for actions;
- `Output` for exception details when appropriate; and
- `GridspecLayout` only if the implementation needs consistent column alignment.

All event handling must use Python callbacks registered with `observe()` or `on_click()`. Values in the domain model are authoritative; widget values are an editable view of that model.

No custom widget model is required. The implementation should avoid defining synchronized application-state traitlets because each standard child control already synchronizes its own value. Project state is held in Python dataclasses and persisted directly from them.

## 3. Terminology and units

| Term | Meaning | Unit |
|---|---|---|
| Material | A selectable construction layer or fixed allowance defined in the CSV file | — |
| Thickness, `t` | Layer thickness | mm |
| Density/unit weight, `γ` | Material unit weight | kN/m³ |
| Characteristic load, `g_k` | Dead load contributed by one row | kN/m² |
| Table total | Sum of valid row characteristic loads | kN/m² |
| Accepted design load | Table total rounded upward to the configured increment | kN/m² |

All calculations must use unrounded Python numeric values. Values are rounded only for display and for the accepted-load rule.

## 4. Primary user workflow

1. The user runs the notebook cell that creates the widget.
2. The widget loads and validates the material CSV file.
3. The widget looks for the project state file.
4. If a valid state file exists, the widget restores all tables and rows in their saved order.
5. If no state file exists, the widget creates one initial table with one unselected row unless the caller supplies different initial content.
6. The user edits the table title and type identifier.
7. The user chooses a material in a row.
8. The row populates from the material definition:
   - a thickness-based material receives its default thickness and density;
   - a fixed-load material displays dashes for thickness and density and uses its fixed load.
9. The row load and table totals update through Python callbacks.
10. The user may change thickness, add or delete rows, and add or delete tables.
11. Every meaningful state change schedules an automatic save.
12. The user may also press **Save now** to force an immediate save.
13. When the notebook or kernel is restarted, rerunning the widget cell restores the most recently saved state.

## 5. User interface specification

### 5.1 Overall composition

The root `VBox` contains, in order:

1. a compact project status/action `HBox`;
2. a project message `VBox`;
3. a tables `VBox`; and
4. an **Add table** button.

The project status/action row contains:

- a `Label` with `Saved`, `Saving…`, `Unsaved changes`, or `Save failed`;
- a `Label` with the last successful save time when available;
- a **Save now** `Button`; and
- an optional **Reload materials** `Button`.

The interface should be usable at common notebook widths. A table may render each material row as one `HBox`. If the caller requests compact mode, or the available width is known to be limited, the implementation may render each row as a small `VBox` of labeled fields. Automatic width detection is not required in version 1.

### 5.2 Structure table

Each structure table is a `StructureTableView` Python object owning a `VBox` and the callbacks associated with that table.

The table `VBox` contains:

1. title/type inputs;
2. column labels;
3. a row container;
4. an **Add row** button;
5. calculated summary values;
6. validation messages; and
7. a **Remove table** action.

#### Title row

The first `HBox` contains:

- a `Text` control for the table title; and
- a `Text` control for the table type identifier.

Suggested defaults for a newly added table are:

- title: `Load zone – New structure`;
- type: the next generated identifier, for example `Type J-3`.

The type generator is a convenience only. The user may replace the generated text with any non-empty value. Type identifiers should be unique within a project. Duplicates produce a validation warning and block a clean save unless the caller explicitly allows duplicates.

#### Column labels

The standard row presentation uses these fields:

1. **No.**
2. **Material**
3. **Thickness**
4. **Density γ**
5. **Load g_k**
6. **Action**

The column-label row uses `Label` controls. The material selector should receive the largest practical share of space. Exact widths are an implementation detail and may use standard widget `layout` options when needed.

#### Material rows

Each material row is a `MaterialRowView` Python object owning one row model and these controls:

- a `Label` showing the sequential row number;
- a `Dropdown` containing active material choices;
- a `FloatText` for thickness;
- a `Label` for density;
- a `Label` for calculated load; and
- a delete `Button` with `icon="trash"` and a descriptive tooltip.

For a calculated material, the thickness control is enabled. For a fixed-load material, the thickness control is disabled and its description or adjacent value label indicates that the field is not applicable. Density is always read-only.

Row numbers are derived from display order and are not permanent identifiers. Every row has an internal UUID that is persisted and does not change when rows are renumbered.

When a blank row has no selected material, density and load display an em dash. Its thickness control is disabled until a calculated material is selected.

#### Add-row action

An **Add row** button appears immediately after the material rows. Activating it appends a new unselected row, rebuilds row numbering, and attempts to focus the new material dropdown by calling its `focus()` method when that method is available in the installed `ipywidgets` version. Focus behavior is a usability enhancement and must not be required for correctness.

#### Summary

The following values appear directly below each table using `Label` controls:

- `Total characteristic load`;
- `Accepted design load`.

Both values are displayed to two decimal places with `kN/m²` units. The accepted value should be easy to identify through its label and placement; custom visual styling is not required.

#### Table removal

A **Remove table** button appears after the summary. Removing a table must require confirmation when the table contains selected materials or has a non-default title.

Confirmation must be implemented inside the table `VBox`, for example by temporarily adding:

- a `Label` explaining what will be removed;
- a **Confirm removal** button; and
- a **Cancel** button.

Empty newly created tables may be removed immediately.

### 5.3 Adding a table

The **Add table** button creates a new independent table containing one unselected material row. It must:

- assign a new table UUID;
- suggest the next type identifier without reusing a number already visible in the project;
- use the default new-structure title;
- attempt to focus the title field; and
- save the changed project state.

The generated type-number counter must not be the table's permanent identity. If a table is deleted, its number does not need to be reused.

### 5.4 Deleting rows and tables

- Deleting a row updates numbering, totals, validation, and persisted state immediately.
- A table may temporarily contain zero rows, but new tables normally start with one blank row.
- Deleting a table removes only that table and its rows.
- Deletion must never modify the material CSV file.
- Confirmation must not use a blocking terminal prompt.

### 5.5 Keyboard and accessibility behavior

- All actions use standard `ipywidgets` controls and normal notebook tab order.
- Icon buttons have descriptive `tooltip` values.
- Text, selection, and numeric controls have clear `description` values or adjacent `Label` controls.
- Errors are shown as text and do not rely only on color.
- Units remain visible in descriptions or adjacent labels.
- Callback errors must be caught and reported in the project message area rather than printed only to kernel logs.
- A notebook host may manage Enter-key behavior differently; correctness must rely on value-change and button callbacks rather than custom key handlers.

## 6. Material CSV specification

### 6.1 Default location

The material file path is supplied by the caller. A recommended project layout is:

```text
project/
├── notebook.ipynb
├── data/
│   └── materials.csv
└── state/
    └── structural_load_tables.json
```

The widget constructor accepts explicit paths:

```python
widget = NativeStructuresWidget(
    materials_path="data/materials.csv",
    state_path="state/structural_load_tables.json",
)
display(widget)
```

Paths are resolved relative to the notebook's current working directory unless absolute paths are provided.

### 6.2 Encoding and formatting

- Encoding: UTF-8, preferably with no byte-order mark.
- Delimiter: comma by default; configurable if required.
- Decimal separator: period (`.`).
- Header row: required.
- Empty numeric fields: empty string, not `-`.
- Units are defined by this specification and must not be included in numeric cells.
- Duplicate `material_id` values are invalid.

### 6.3 Required CSV columns

| Column | Type | Required | Description |
|---|---:|---:|---|
| `material_id` | string | Yes | Stable machine identifier used by saved state. Must not change when the display name changes. |
| `display_name` | string | Yes | Text shown in the material dropdown. |
| `calculation_type` | enum | Yes | Either `calculated` or `fixed`. |
| `default_thickness_mm` | number | Conditional | Required and non-negative for `calculated`; empty for `fixed`. |
| `density_kn_m3` | number | Conditional | Required and non-negative for `calculated`; empty for `fixed`. |
| `fixed_load_kn_m2` | number | Conditional | Required and non-negative for `fixed`; empty for `calculated`. |

### 6.4 Recommended optional CSV columns

| Column | Type | Default | Description |
|---|---:|---:|---|
| `category` | string | empty | Optional grouping metadata. |
| `active` | boolean | `true` | Inactive materials are hidden from new selections but remain resolvable for saved projects. |
| `sort_order` | integer | file order | Controls dropdown order. |
| `description` | string | empty | Optional longer description. |
| `source` | string | empty | Standard, manufacturer, or other source reference. |

Recognized boolean values should include `true/false`, `1/0`, and `yes/no`, case-insensitively.

### 6.5 Example CSV

```csv
material_id,display_name,calculation_type,default_thickness_mm,density_kn_m3,fixed_load_kn_m2,category,active,sort_order
concrete_levelling,Concrete levelling layer,calculated,50,20.0,,concrete,true,10
thermal_insulation,Thermal insulation,calculated,300,0.8,,insulation,true,20
roofing_membrane,Roofing membrane,fixed,,,0.30,roofing,true,30
finishing_layer,Finishing layer,calculated,25,10.0,,finish,true,40
building_services,Building services,fixed,,,0.20,allowance,true,50
reinforced_concrete,Reinforced concrete slab,calculated,200,25.0,,concrete,true,60
cement_screed,Cement screed,calculated,60,20.0,,finish,true,70
mineral_wool,Mineral wool,calculated,200,0.8,,insulation,true,80
```

### 6.6 CSV validation

The complete material file must be validated before replacing the active in-memory catalog. Validation errors include:

- missing required columns;
- empty or duplicate `material_id`;
- empty `display_name`;
- unknown `calculation_type`;
- non-numeric, negative, NaN, or infinite numeric values;
- calculated material missing thickness or density;
- fixed material missing fixed load; and
- mutually incompatible populated fields, such as both density and fixed load.

If material reload fails, the widget keeps the last valid in-memory catalog and shows a detailed error. It must not partially apply an invalid file.

## 7. Calculation rules

### 7.1 Thickness-based material

For `calculation_type == "calculated"`:

```text
g_k = (thickness_mm / 1000) × density_kn_m3
```

Example:

```text
50 mm / 1000 × 20.0 kN/m³ = 1.00 kN/m²
```

The selected material supplies density and default thickness. The user may edit the row thickness. Density remains read-only in version 1.

### 7.2 Fixed-load material

For `calculation_type == "fixed"`:

```text
g_k = fixed_load_kn_m2
```

Thickness and density are not applicable. The thickness control is disabled and the read-only value labels show an em dash.

### 7.3 Table total

```text
table_total = sum(row.g_k for every valid selected row)
```

An unselected blank row contributes zero. A selected row containing invalid user input must not be silently treated as zero. The row must show an error and both summary values must display `—` until the error is corrected.

The table total is also persisted as `total_weight_kn_m2` on the corresponding table object. This field represents the total characteristic dead load in `kN/m²`. It is provided so code outside the notebook can read each table's total without loading the material catalog or repeating the row calculations.

### 7.4 Accepted design load

The default accepted-load increment is `0.05 kN/m²`. The value is always rounded upward:

```python
accepted = ceil((table_total - epsilon) / increment) * increment
```

Equivalent for the default increment:

```python
accepted = ceil((table_total - epsilon) * 20) / 20
```

The small epsilon prevents a floating-point value already on an increment from being rounded to the next increment.

| Total | Accepted |
|---:|---:|
| 1.99 | 2.00 |
| 2.00 | 2.00 |
| 2.01 | 2.05 |

The increment is a constructor option and is stored in project state.

### 7.5 Display precision

- Density: two decimal places by default.
- Row load: two decimal places.
- Table total: two decimal places.
- Accepted load: two decimal places.
- Thickness: display without decimals when integral; otherwise preserve a practical number of decimals.
- Persisted numeric data must not be truncated to display precision.

## 8. State persistence

### 8.1 State file

The project state is stored as UTF-8 JSON. JSON is inspectable, portable, versionable, and safer to load than executable serialization formats.

Recommended default path:

```text
state/structural_load_tables.json
```

The parent directory is created automatically if it does not exist.

### 8.2 When state is saved

A save is scheduled after any of these changes:

- table added or removed;
- table title changed;
- table type changed;
- row added or removed;
- material selection changed;
- thickness changed; or
- project-level calculation settings changed.

Edits should use a configurable debounce of approximately 300–750 ms. Structural operations such as add and delete may save immediately.

Debouncing should use the active notebook event loop. A recommended implementation stores an `asyncio.TimerHandle`, cancels it when another edit arrives, and registers a replacement with `loop.call_later()`. The callback invokes the normal validated save path. Thread-based timers should be avoided because widget mutation and notebook output are expected to occur on the kernel's event-loop thread.

The UI must also provide **Save now**. Notebook shutdown cannot always be detected reliably, so auto-save plus explicit save is required.

### 8.3 Atomic write procedure

To reduce the risk of a corrupted state file:

1. serialize and validate the complete state in memory;
2. recalculate every table and assign its current total to `total_weight_kn_m2`;
3. write the resulting state to a temporary file in the same directory;
4. flush and close the temporary file;
5. optionally call `os.fsync()` when durability is important; and
6. atomically replace the destination using `os.replace()`.

The implementation may retain one backup named `structural_load_tables.json.bak` before replacement. If the main file is unreadable, the widget may offer to restore the backup but must not do so silently.

### 8.4 State schema

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
      "total_weight_kn_m2": 1.0,
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

Calculated row loads remain unpersisted derived values. Each table's `total_weight_kn_m2` is a persisted convenience snapshot of the derived table total. The widget must recalculate it from the rows after loading and immediately before serialization; it must never use the stored value as the source for row or table calculations.

External consumers may read `tables[*].total_weight_kn_m2` as the table's characteristic dead load at `saved_at_utc`. The value must be a finite, non-negative JSON number in `kN/m²` and must be written at full calculation precision rather than truncated to the configured display precision.

Example external access:

```python
import json
from pathlib import Path

state = json.loads(
    Path("state/structural_load_tables.json").read_text(encoding="utf-8")
)
weights_by_type = {
    table["type_name"]: table["total_weight_kn_m2"]
    for table in state["tables"]
}
```

For backward compatibility, a state file without `total_weight_kn_m2` may be loaded by calculating the value from its rows. The field is then included the next time the project is deliberately saved. A present value that differs from the recalculated total must be replaced in memory and reported as a recoverable state warning.

### 8.5 Material snapshot and CSV changes

The CSV is the active source of material definitions. State stores both `material_id` and a small snapshot of the material values used at the last save.

On restore:

1. Resolve each `material_id` against the current catalog.
2. If the material exists and its relevant values match the snapshot, restore normally.
3. If it exists but density, calculation type, or fixed load changed, use the current CSV value, recalculate the load, and show a non-blocking warning identifying the affected rows.
4. If it no longer exists, retain the saved row and snapshot, label it as a missing material, and require the user to choose a replacement. Do not silently change or delete it.
5. A saved inactive material may remain selected. It is not offered for new selections unless configured otherwise.

The state file stores `source_sha256` so the widget can quickly detect that the material file changed. The path and hash are diagnostic information, not a replacement for row-level comparison.

### 8.6 Loading state

At startup:

1. load and validate materials;
2. load JSON if it exists;
3. validate `schema_version` and the state structure;
4. migrate older supported schema versions in memory;
5. restore tables and rows in `order` sequence;
6. resolve material references;
7. recalculate every row and table;
8. build the `ipywidgets` control tree; and
9. show warnings without discarding recoverable data.

An unsupported future schema version must produce a clear error and must not overwrite the state file.

### 8.7 Rerunning a notebook cell

Rerunning the construction cell may leave an older displayed widget in notebook output. The implementation should avoid two live instances writing to the same state file.

Required behavior:

- expose `close()` to flush pending state, unregister callbacks, close owned child widgets, and close the root widget;
- document that notebook code should close a prior instance before replacing it; and
- optionally maintain a process-local registry keyed by resolved state path so constructing a replacement can close the previous registered instance.

Example notebook pattern:

```python
try:
    structural_load_widget.close()
except NameError:
    pass

structural_load_widget = NativeStructuresWidget(
    materials_path="data/materials.csv",
    state_path="state/structural_load_tables.json",
)
structural_load_widget
```

The implementation must guard against saving during initialization or model-to-control refreshes.

## 9. In-memory domain model

Use dataclasses or equivalent typed Python objects. Recommended structures are:

```python
@dataclass(frozen=True)
class MaterialDefinition:
    material_id: str
    display_name: str
    calculation_type: Literal["calculated", "fixed"]
    default_thickness_mm: float | None
    density_kn_m3: float | None
    fixed_load_kn_m2: float | None
    category: str = ""
    active: bool = True
    sort_order: int = 0
    description: str = ""
    source: str = ""


@dataclass
class MaterialRow:
    row_id: UUID
    material_id: str | None
    thickness_mm: float | None
    material_snapshot: MaterialSnapshot | None


@dataclass
class StructureTable:
    table_id: UUID
    title: str
    type_name: str
    rows: list[MaterialRow]


@dataclass
class StructuresProject:
    project_id: UUID
    settings: ProjectSettings
    tables: list[StructureTable]
```

Derived values should be returned by pure calculation functions or read-only properties. They should not be duplicated across controls and models as independently editable values.

The model must not store `ipywidgets` instances. View objects own controls and reference their model objects. This separation allows the model, calculations, CSV loader, and persistence code to be tested without a live notebook.

## 10. Recommended implementation structure

```text
structural_load_widget/
├── __init__.py
├── widget.py          # NativeStructuresWidget and project-level callbacks
├── views.py           # StructureTableView and MaterialRowView
├── models.py          # Dataclasses and schema conversion
├── materials.py       # CSV loading, validation, and hashing
├── calculations.py    # Pure row/table calculations and rounding
├── persistence.py     # JSON validation, migration, and atomic saving
└── tests/
    ├── test_materials.py
    ├── test_calculations.py
    ├── test_persistence.py
    ├── test_widget.py
    └── test_views.py
```

There should be one public project class:

- `NativeStructuresWidget`: root project view, model coordinator, validation coordinator, and persistence coordinator.

Internal view classes are normal Python classes:

- `StructureTableView`: owns one table `VBox`, title/type controls, row views, summaries, and table actions.
- `MaterialRowView`: owns one material-row container, its controls, and its callbacks.

### 10.1 Native project widget

The public class should follow this general shape:

```python
from pathlib import Path

import ipywidgets as widgets


class NativeStructuresWidget(widgets.VBox):
    def __init__(
        self,
        materials_path: str | Path,
        state_path: str | Path,
        **options,
    ) -> None:
        self._closed = False
        self._updating_controls = True
        self._autosave_handle = None

        self._catalog = load_materials(materials_path)
        self._project = load_or_create_project(state_path, options)

        self._status_label = widgets.Label()
        self._saved_at_label = widgets.Label()
        self._save_button = widgets.Button(description="Save now")
        self._reload_materials_button = widgets.Button(
            description="Reload materials"
        )
        self._messages_box = widgets.VBox()
        self._tables_box = widgets.VBox()
        self._add_table_button = widgets.Button(description="Add table")

        super().__init__(children=self._build_children())
        self._register_callbacks()
        self._rebuild_table_views()
        self._updating_controls = False
        self._refresh_all()
```

Construction must fully validate file data before creating editable controls. If startup cannot continue safely, the root widget should contain a concise error label and optional details output, with destructive actions disabled.

### 10.2 View ownership and callbacks

Every callback registration must have a matching cleanup path.

Recommended ownership rules:

- `NativeStructuresWidget` owns project-level buttons and `StructureTableView` instances.
- Each `StructureTableView` owns title/type controls and `MaterialRowView` instances.
- Each `MaterialRowView` owns row controls.
- A view's `close()` method unregisters every `observe()` and `on_click()` callback it registered, then closes its controls.
- Rebuilding a table or row collection first closes the replaced view objects.

Example callback registration and removal:

```python
self.material_dropdown.observe(self._on_material_changed, names="value")
self.delete_button.on_click(self._on_delete_clicked)

# During close:
self.material_dropdown.unobserve(self._on_material_changed, names="value")
self.delete_button.on_click(self._on_delete_clicked, remove=True)
```

Callbacks must return quickly. File writes may remain synchronous for small local state files, but the status must change to `Saving…` before the save begins and to `Saved` or `Save failed` afterward.

### 10.3 Model-to-control update guard

Programmatic control updates trigger the same observers as user edits. Every view must prevent refreshes from being interpreted as new edits.

A context manager is recommended:

```python
@contextmanager
def updating_controls(self):
    previous = self._updating_controls
    self._updating_controls = True
    try:
        yield
    finally:
        self._updating_controls = previous
```

Observers begin with:

```python
if self._updating_controls or self._closed:
    return
```

The guard must cover startup restoration, material reload, validation rollback, row rebuilds, and any assignment that merely reflects the existing domain model.

### 10.4 Control update rules

- Add/delete operations mutate the Python model immediately, rebuild only the affected collection, recalculate, validate, and schedule a save.
- Material selection updates the row model immediately and assigns the default thickness for calculated materials.
- Thickness changes are validated before they enter the model. A temporarily invalid value remains visible with a row error and is not persisted as a valid numeric value.
- Title and type changes update the table model, validate project uniqueness and completeness, and schedule a debounced save.
- Calculations occur only in Python and use the pure functions from `calculations.py`.
- The view reads calculated results and formats them into `Label.value` strings.
- Refresh logic should update existing controls when possible. Rebuilding every table for a single thickness edit is not acceptable.

### 10.5 Material dropdown options

Build one immutable options tuple for active materials and reuse it across rows:

```python
material_options = (
    [("Select material…", None)]
    + [(material.display_name, material.material_id) for material in active_materials]
)
material_options = tuple(material_options)
```

If a restored row references an inactive material, add that material to the row's options so its current value remains selectable. If the material is missing, add a clearly labeled placeholder option whose value remains the missing `material_id` until the user selects a replacement.

### 10.6 Dependency and packaging workflow

Development installation:

```bash
python -m pip install ipywidgets
```

The package contains Python modules only and has no compilation step.

The minimum supported Python, `ipywidgets`, JupyterLab/Notebook, and VS Code versions should be pinned when implementation begins. Automated compatibility tests should cover the notebook environments used by the project.

## 11. Widget event behavior

| Event | Required response |
|---|---|
| Material dropdown changed | Resolve material, reset thickness to its default when appropriate, update density/load labels, recalculate table, schedule save. |
| Thickness changed | Validate, update model, recalculate row and table, schedule debounced save. |
| Add row | Append blank row, build its controls, renumber, attempt to focus its dropdown, save. |
| Delete row | Remove by UUID, close its view, renumber, recalculate, save. |
| Title/type edited | Update state, validate uniqueness and non-empty values, schedule debounced save. |
| Add table | Create a table and blank row, generate suggested type, build its view, attempt to focus title, save. |
| Remove table | Confirm when required, remove by UUID, close its view, save. |
| Reload materials | Validate replacement catalog, atomically swap it in memory, update dropdown options, re-resolve rows, recalculate, warn about changes, and save updated snapshots only after a deliberate save. |
| Save now | Cancel pending debounce, validate state, atomically save, update status. |

All observers and autosave handles must be detached or cancelled by `close()` to prevent memory leaks, duplicate callbacks, and writes from obsolete widget instances.

## 12. Validation and error handling

### 12.1 Row validation

- No selected material: allowed for a blank row; load displays `—`.
- Calculated material thickness: required, numeric, finite, and non-negative.
- Density and fixed load: validated when the catalog loads and read-only in the row.
- Missing saved material: warning or error until replaced.

Each row view should contain a message `Label` that is empty when the row is valid. The label should contain a concise correction when invalid.

### 12.2 Table validation

- Title should be non-empty after trimming.
- Type name should be non-empty after trimming.
- Type name should be unique within the project.
- At least one valid selected material is recommended before considering a table complete, but empty tables may be saved as drafts.

Table messages belong in a table-level message `VBox`. Project-wide messages, including duplicate type names, may also be summarized in the root message area.

### 12.3 Persistence errors

If saving fails:

- keep the in-memory state unchanged;
- show `Save failed` with error details;
- keep the widget usable;
- do not claim the state is saved;
- allow **Save now** to retry; and
- never delete or truncate the last valid state file.

If loading fails, do not overwrite the invalid file automatically. Present an error state and preserve the unreadable file for inspection. Recovery into a new empty project must require a deliberate button action or an explicit constructor option.

### 12.4 Callback exception boundary

Public callbacks should execute through a small wrapper that catches unexpected exceptions, updates the status and message controls, and preserves the last valid model. During development, the wrapper may also write a traceback to a dedicated `Output` control. Exceptions must not leave `_updating_controls` or `_closed` flags in an inconsistent state.

## 13. Configuration API

Recommended constructor:

```python
NativeStructuresWidget(
    materials_path: str | Path,
    state_path: str | Path,
    *,
    accepted_load_increment_kn_m2: float = 0.05,
    display_decimals: int = 2,
    autosave: bool = True,
    autosave_debounce_seconds: float = 0.5,
    allow_duplicate_type_names: bool = False,
    create_initial_table: bool = True,
    compact: bool = False,
)
```

The returned object is directly displayable because it subclasses `ipywidgets.VBox`:

```python
from structural_load_widget import NativeStructuresWidget

structural_load_widget = NativeStructuresWidget(
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
widget.to_dict()              # Return state with recalculated table weights
widget.validate()             # Return project validation messages
widget.close()                # Flush, detach callbacks, and close controls
```

`reload()` must either replace the current in-memory project completely or leave it unchanged if loading fails. It must rebuild views inside the model-to-control update guard and must not schedule an autosave merely because controls were refreshed.

## 14. Performance requirements

- Normal callbacks should update visibly within 150 ms for a project containing up to 30 tables with 30 rows each, excluding disk latency and kernel transport latency.
- CSV loading and full state restoration should normally complete within one second for up to 5,000 material definitions and 1,000 saved rows on a typical workstation.
- Dropdown options should be shared as an immutable tuple where practical.
- Recalculation should be limited to the affected table except when material definitions or project-level settings change.
- A simple field edit must update existing labels instead of reconstructing the complete widget tree.
- Row or table collection rebuilds must close replaced controls and callbacks.
- Autosave must be debounced and serialize a consistent model snapshot.
- For very large material catalogs, version 1 may have slower dropdown opening because standard `Dropdown` controls do not provide virtualized search. Search support may be added later with another standard `ipywidgets` selection control.

## 15. Security and data integrity

- Do not use pickle for untrusted or user-editable state.
- Treat CSV and JSON text as data; never evaluate it as Python.
- Material names and user-entered titles are assigned only to standard widget string properties.
- Resolve and display actual paths in error messages but avoid exposing unrelated environment information.
- State file writes must be atomic.
- Saved state must include a schema version.
- UUIDs are used for persistent table and row identity.
- Validation must reject non-finite numeric values before calculation or persistence.

## 16. Testing requirements

### 16.1 Calculation tests

- `50 mm × 20 kN/m³` produces `1.00 kN/m²`.
- `300 mm × 0.8 kN/m³` produces `0.24 kN/m²`.
- Fixed load `0.30` produces `0.30 kN/m²`.
- Example rows totaling `1.99` produce accepted load `2.00`.
- Total `2.00` remains `2.00`.
- Total `2.01` rounds to `2.05`.
- Invalid, negative, NaN, and infinite values are rejected.

### 16.2 Material loader tests

- Valid CSV loads all expected definitions in sort order.
- Missing required columns fail with a useful message.
- Duplicate IDs fail.
- Conditional fields are enforced by calculation type.
- Inactive materials are excluded from new options but can resolve saved rows.
- UTF-8 display names load correctly.

### 16.3 Persistence tests

- Round-trip save/load preserves table order, row order, UUIDs, titles, types, selections, and thickness overrides.
- Every serialized table contains `total_weight_kn_m2` equal to the full-precision sum of its valid row loads.
- Loading a legacy table without `total_weight_kn_m2` calculates it without rejecting the project.
- A stale stored `total_weight_kn_m2` is replaced by the recalculated value and reported as a recoverable warning.
- Atomic save leaves the previous file intact when a simulated write fails.
- Unsupported future schema version is rejected without overwrite.
- Missing material references are retained and reported.
- A changed material CSV is detected by hash and row snapshot comparison.
- Pending debounced changes are flushed by `save()` and `close()`.

### 16.4 Widget behavior tests

Widget tests should instantiate the Python controls directly and invoke value assignments or button callbacks without rendering a notebook view.

- Adding a table creates an independent model and one blank row.
- Changing a row in one table does not affect another table.
- Assigning a dropdown value selects the material and applies the default thickness.
- Assigning a thickness value updates row load and table totals.
- Fixed materials disable the thickness control.
- Adding and deleting rows updates row numbers and totals.
- Deleting a table removes only the selected table.
- Restart simulation restores the last saved project.
- Duplicate type names show validation feedback.
- A save failure is visible and does not disable editing.
- Programmatic refresh under the update guard does not schedule a save.
- Closing a row, table, or project removes callbacks and prevents later writes.

## 17. Acceptance criteria

The first version is complete when all of the following are true:

1. The implementation consists of Python modules and uses standard `ipywidgets` controls.
2. The widget loads material definitions from a validated CSV file.
3. A user can create any practical number of structure tables.
4. Each table has editable title and type fields.
5. Each row selects a material from the CSV-backed dropdown.
6. Selecting a calculated material fills its default thickness and density and calculates its load.
7. Selecting a fixed material disables thickness, marks density as not applicable, and displays its fixed load.
8. Editing thickness updates row load and both table totals through Python calculation code.
9. Rows and tables can be added and removed independently.
10. The total and accepted load follow the formulas in this specification.
11. All user-created project state is saved atomically to JSON.
12. Every saved table exposes its current characteristic dead-load total as the finite, non-negative `total_weight_kn_m2` value.
13. Rerunning the notebook cell or restarting the kernel restores the same tables, ordering, titles, types, material selections, and thickness overrides.
14. CSV changes and missing material IDs are reported without silently discarding rows.
15. Invalid CSV or state data cannot corrupt the last valid saved state.
16. All callbacks and pending save handles are cleaned up by `close()`.
17. Core calculations, CSV parsing, persistence, and Python widget behavior are covered by automated tests.
18. Installation and packaging require only the Python package and its declared Python dependencies.

## 18. Future extensions

The data model should permit these additions without replacing the version 1 state format entirely:

- explicit up/down controls for row and table reordering;
- editable density or fixed-load overrides with audit flags;
- material filtering or type-ahead selection for large catalogs;
- table duplication;
- load-category and partial-factor calculations;
- export to CSV, Excel, PDF, or Word;
- project metadata and revision history;
- per-table notes;
- localized labels and decimal formatting; and
- a formal JSON Schema for external integrations.

## 19. Implementation references

- [`ipywidgets` documentation](https://ipywidgets.readthedocs.io/) — standard controls, containers, events, output widgets, and notebook display behavior.
- [`traitlets` documentation](https://traitlets.readthedocs.io/) — observation behavior used by standard widget values.
- [Python standard library documentation](https://docs.python.org/3/) — event-loop scheduling, timer cancellation, and atomic file replacement.
