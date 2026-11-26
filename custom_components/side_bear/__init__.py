"""Side-Bear – Seitenleiste gruppieren, auf-/zuklappen, ein-/ausblenden.

Die Integration
  * liefert das Frontend-Modul aus und lädt es in jedem Browser (add_extra_js_url),
  * speichert die Einstellungen im HA-Speicher (.storage/side_bear),
  * legt die Einstellungsseite und je Gruppe zwei Überschriften als Panels an,
  * stellt beim Entfernen die normale Seitenleiste aller Benutzer wieder her.
"""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import (
    DEFAULT_CONFIG,
    DOMAIN,
    JS_FILE,
    SIGNAL_UPDATED,
    STORAGE_KEY,
    STORAGE_VERSION,
    URL_BASE,
    VERSION,
)
from .panels import async_register_panels, async_remove_panels
from .websocket import async_setup_websocket

_LOGGER = logging.getLogger(__name__)

STATIC_REGISTERED = f"{DOMAIN}_static_registered"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Side-Bear einrichten."""
    store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    config = await store.async_load()
    if not isinstance(config, dict):
        config = dict(DEFAULT_CONFIG)

    js_url = f"{URL_BASE}/{JS_FILE}?v={VERSION}"
    hass.data[DOMAIN] = {
        "store": store,
        "config": config,
        "panels": set(),
        "js_url": js_url,
    }

    # Statische Datei nur einmal pro HA-Lauf registrieren (lässt sich nicht entfernen)
    if not hass.data.get(STATIC_REGISTERED):
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    f"{URL_BASE}/{JS_FILE}",
                    str(Path(__file__).parent / "frontend" / JS_FILE),
                    False,
                )
            ]
        )
        hass.data[STATIC_REGISTERED] = True

    add_extra_js_url(hass, js_url)
    async_setup_websocket(hass)
    await async_register_panels(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Side-Bear entladen: Panels und Frontend-Modul entfernen."""
    data = hass.data.pop(DOMAIN, None)
    if data:
        remove_extra_js_url(hass, data["js_url"])
        async_remove_panels(hass, data["panels"])
    # offene Browser informieren (sie bekommen config = None und hören auf)
    async_dispatcher_send(hass, SIGNAL_UPDATED)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Side-Bear deinstallieren: Einstellungen löschen, Seitenleisten zurücksetzen."""
    await Store(hass, STORAGE_VERSION, STORAGE_KEY).async_remove()
    await _async_reset_sidebars(hass)


async def _async_reset_sidebars(hass: HomeAssistant) -> None:
    """Normale Seitenleiste für alle Benutzer wiederherstellen.

    Side-Bear lässt die Benutzerdaten "sidebar" leer, damit jedes Gerät seine
    eigene Reihenfolge aus dem Gerätespeicher nimmt. Nach dem Entfernen setzen
    wir dort ausdrücklich den HA-Standard, damit alte Gerätewerte nicht greifen.
    """
    try:
        from homeassistant.components.frontend.storage import (  # noqa: PLC0415
            async_user_store,
        )
    except ImportError:
        _LOGGER.warning(
            "Seitenleisten konnten nicht automatisch zurückgesetzt werden; "
            "bitte in HA unter Profil > Seitenleiste bearbeiten zurücksetzen"
        )
        return

    for user in await hass.auth.async_get_users():
        if user.system_generated:
            continue
        try:
            user_store = await async_user_store(hass, user.id)
            await user_store.async_set_item(
                "sidebar", {"panelOrder": [], "hiddenPanels": []}
            )
        except Exception:  # noqa: BLE001
            _LOGGER.debug("Seitenleiste von %s nicht zurückgesetzt", user.name, exc_info=True)
