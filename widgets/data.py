from pathlib import Path
import csv

def load_materials():
    csv_path = Path(__file__).resolve().parents[0] / "assets" / "materials.csv"
    with csv_path.open(newline='', encoding='utf-8') as handle:
        return {
            row["material_lv"]: float(row["density_kg_m3_typical"])
            for row in csv.DictReader(handle)
        }

MATERIALS = load_materials()