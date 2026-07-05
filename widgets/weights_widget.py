import json
import ipywidgets as widgets
from pathlib import Path
from .weights_table import WeightsTable

class WeightsWidget(widgets.VBox):
    def __init__(self, json_path="constructions.json"):
        self.json_path = Path(json_path)
        self.data = self.load_data()
        self.text_box = self.create_text_box()
        self.add_button = self.create_add_button()
        self.save_button = self.create_save_button() 
        self.output = widgets.Output()
        self.structures = widgets.VBox()

        controls = widgets.HBox([self.text_box, self.add_button, self.save_button])
        super().__init__([controls, self.output, self.structures])
        self.render()

    def load_data(self):
        if self.json_path.exists():
            with open(self.json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def save_data(self, button=None):
        with open(self.json_path, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=4)
        with self.output:
            self.output.clear_output()
            print(f"Data saved to {self.json_path}")
    
    def create_add_button(self):
        button = widgets.Button(description='Add Row', button_style='success', icon='plus', layout=widgets.Layout(width='100px'))   
        button.on_click(self.add_construction)
        return button
    
    def create_save_button(self):
        button = widgets.Button(description='Save', button_style='info', icon='save', layout=widgets.Layout(width='100px'))   
        button.on_click(self.save_data)
        return button
    
    def create_text_box(self):
        return widgets.Text(
            value='',
            placeholder='Enter construction key',
            description='Key:',
            layout=widgets.Layout(width='200px'),
        )
    
    def add_construction(self, construction_key):
        key = self.text_box.value.strip()

        if not key:
            with self.output:
                self.output.clear_output()
                print("Please enter a valid construction key.")
            return
        
        if key in self.data:
            with self.output:
                self.output.clear_output()
                print(f"Construction key '{key}' already exists.")
            return
        
        self.data[key] = {
            "name": f"New Construction {key}",
            "layers": []
        }

        self.text_box.value = ''
        self.save_data()
        self.render()

        return 

    def render(self):
        self.structures.children = [
            WeightsTable(key,data) for key, data in self.data.items()
        ]
        return
    
