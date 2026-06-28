from pathlib import Path
import csv

import anywidget
import traitlets


class First(anywidget.AnyWidget):
    _esm = Path(__file__).parent / "static" / "first.js"
    value = traitlets.Int(0).tag(sync=True)