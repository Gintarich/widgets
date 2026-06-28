from pathlib import Path
import csv

import anywidget
import traitlets


def _load_profiles() -> list[dict[str, object]]:
    csv_path = Path(__file__).resolve().parents[1] / "steel_profiles.csv"
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        aliases = next(reader)
        profiles = []
        for row in reader:
            profile = {
                _without_unit_suffix(alias): _value(row[column])
                for column, alias in aliases.items()
            }
            profiles.append(profile)

    return profiles


def _without_unit_suffix(name: str) -> str:
    for suffix in ("_kg_m", "_mm6", "_mm4", "_mm3", "_mm2", "_mm", "_m"):
        if name.endswith(suffix):
            return name[: -len(suffix)]
    return name


def _value(value: str) -> object:
    return _number(value) if _looks_numeric(value) else value or None


def _looks_numeric(value: str) -> bool:
    if value == "":
        return True
    try:
        float(value)
    except ValueError:
        return False
    return True


def _number(value: str) -> float | None:
    if value == "":
        return None
    number = float(value)
    return int(number) if number.is_integer() else number


_DEFAULT_PROFILES = _load_profiles()


def _selected_profile(profiles: list[dict[str, object]], selected_profile: str) -> dict[str, object]:
    return next(
        (profile for profile in profiles if profile["profile"] == selected_profile),
        profiles[0] if profiles else {},
    )


class Sections(anywidget.AnyWidget):
    _esm = Path(__file__).parent / "static" / "sections.js"
    _css = Path(__file__).parent / "static" / "sections.css"
    profiles = traitlets.List(trait=traitlets.Dict(), default_value=_DEFAULT_PROFILES).tag(sync=True)
    selected_type = traitlets.Unicode("HEA").tag(sync=True)
    selected_profile = traitlets.Unicode("HEA220").tag(sync=True)
    selected_profile_data = traitlets.Dict(
        default_value=_selected_profile(_DEFAULT_PROFILES, "HEA220")
    ).tag(sync=True)

    @traitlets.observe("profiles", "selected_profile")
    def _update_selected_profile_data(self, change: traitlets.Bunch) -> None:
        self.selected_profile_data = _selected_profile(self.profiles, self.selected_profile)
