"""Panels von Side-Bear: Einstellungsseite und Gruppen-Überschriften."""

from __future__ import annotations

import re

from homeassistant.components import panel_custom
from homeassistant.components.frontend import async_remove_panel
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN, HEADER_CLOSED_SUFFIX, HEADER_PREFIX, NAME, SETTINGS_PANEL


def group_slug(group_id: str) -> str:
    """Gruppen-ID für die URL vereinfachen (muss zum Frontend passen)."""
    return re.sub(r"[^a-z0-9]", "", str(group_id).lower()) or "gruppe"


def _wanted_panels(config: dict) -> dict[str, dict]:
    panels: dict[str, dict] = {
        SETTINGS_PANEL: {
            "webcomponent_name": "side-bear-panel",
            "sidebar_title": NAME,
            "sidebar_icon": "mdi:teddy-bear",
            "require_admin": True,
            "config": {},
        }
    }
    for group in config.get("groups", []):
        if not isinstance(group, dict) or "id" not in group:
            continue
        slug = group_slug(group["id"])
        name = str(group.get("name") or "Gruppe").upper()
        icon = group.get("icon") or "mdi:folder"
        for closed in (False, True):
            url = f"{HEADER_PREFIX}{slug}{HEADER_CLOSED_SUFFIX if closed else ''}"
            panels[url] = {
                "webcomponent_name": "side-bear-group",
                "sidebar_title": f"{'▶' if closed else '▼'} {name}",
                "sidebar_icon": icon,
                "require_admin": False,
                "config": {"group_id": group["id"]},
            }
    return panels


async def async_register_panels(hass: HomeAssistant) -> None:
    """Alle Panels passend zur aktuellen Konfiguration (neu) anlegen."""
    data = hass.data.get(DOMAIN)
    if not data:
        return
    wanted = _wanted_panels(data["config"])
    async_remove_panels(hass, data["panels"])
    data["panels"] = set()
    for url, options in wanted.items():
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path=url,
            module_url=data["js_url"],
            embed_iframe=False,
            trust_external=False,
            **options,
        )
        data["panels"].add(url)


@callback
def async_remove_panels(hass: HomeAssistant, panels: set[str]) -> None:
    """Panels von Side-Bear entfernen."""
    for url in list(panels):
        async_remove_panel(hass, url, warn_if_unknown=False)
        panels.discard(url)
