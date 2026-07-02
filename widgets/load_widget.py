import ipywidgets as widgets

class LoadWidget(widgets.VBox):
    def __init__(self, materials):
        super().__init__()
        self.materials = materials
        button = widgets.Button(description='Add Row', button_style='success', icon='plus', layout=widgets.Layout(width='100px'))   
        button.on_click(lambda x: self.add_row())
        self.children += (button,)
        self.add_row()
    
    def add_row(self):
        dropdown = widgets.Dropdown( options=self.materials.keys())
        text = widgets.FloatText(
            value=0,
            layout=widgets.Layout(width='60px'),
            )
        intText = widgets.IntText(
            value=0,
            layout=widgets.Layout(width='60px'))
        calcVal = widgets.FloatText(
            value=text.value * intText.value/1000,
            layout=widgets.Layout(width='60px'),)
        def on_dropdown_change(change):
            newVal = change['new']
            text.value = self.materials[newVal]
        def update_calcVal(change):
            calcVal.value = text.value * intText.value/1000
        dropdown.observe(on_dropdown_change, names='value')
        intText.observe(update_calcVal, names='value')
        text.observe(update_calcVal, names='value')
        self.children += (widgets.HBox([dropdown, text, intText, calcVal]),)

class LoadWudgetV2(widgets.GridBox):
    def __init__(self, materials):
        
        super().__init__()
        self.materials = materials
        self.add_row()
    
    def add_row(self):
        dropdown = widgets.Dropdown( options=self.materials.keys())
        text = widgets.FloatText(
            value=self.materials[dropdown.value],
            layout=widgets.Layout(width='60px'),
            )
        intText = widgets.IntText(
            value=50,
            layout=widgets.Layout(width='60px'))
        calcVal = widgets.FloatText(
            value=text.value * intText.value/1000,
            layout=widgets.Layout(width='60px'),)
        def on_dropdown_change(change):
            newVal = change['new']
            text.value = self.materials[newVal]
        def update_calcVal(change):
            calcVal.value = text.value * intText.value/1000
        dropdown.observe(on_dropdown_change, names='value')
        intText.observe(update_calcVal, names='value')
        text.observe(update_calcVal, names='value')
        self.children += (dropdown, text, intText, calcVal)