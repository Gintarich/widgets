import ipywidgets as widgets
from .data import MATERIALS


class WeightsTable(widgets.VBox):
    def __init__(self, struct_key, data):
        self.struct_key = struct_key
        self.data = data
        self.materials = MATERIALS
        self.add_layer_button = self.add_layer_button()
        self.render()
        super().__init__(children=self.children, layout=self.layout)

    def add_layer_button(self):
        button = widgets.Button(description='Add Layer', button_style='success', icon='plus', layout=widgets.Layout(width='100px'))   
        button.on_click(self.add_row)
        return button

    def add_row(self, button=None):
        self.data["layers"].append({"material": "Parastais betons", "thickness_mm": 0})
        self.render()
    
    def render(self):
        self.children = [widgets.Label(self.data["name"])]
        for layer in self.data["layers"]:
            dropdown = widgets.Dropdown(options=self.materials.keys(), value=layer["material"])
            thickness = widgets.FloatText(value=layer["thickness_mm"], layout=widgets.Layout(width='60px'))
            self.children += (widgets.HBox([dropdown, thickness]),)
        self.children += (self.add_layer_button,)
