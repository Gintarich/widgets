# StructuralLoadWidget

`StructuralLoadWidget` is an Anywidget implementation of the structural dead-load
table specification. Material definitions come from a validated UTF-8 CSV file;
editable project state is restored from and atomically saved to JSON.

```python
from widgets import StructuralLoadWidget

structural_load_widget = StructuralLoadWidget(
    materials_path="widgets/assets/structural_load_materials.csv",
    state_path="state/structural_load_tables.json",
)
structural_load_widget
```

The public Python API is `save()`, `reload()`, `reload_materials()`, `to_dict()`,
`validate()`, and `close()`.

## Compatibility baseline

- Python 3.10+
- Anywidget 0.9–0.11
- Traitlets 5.9+
- ipywidgets 8 / JupyterLab 4 / Notebook 7 / current VS Code Jupyter

The implementation uses a local Anywidget Front-End Module and scoped CSS, with
no JavaScript build step or network-loaded assets.
