"""Side-Bear – Seitenleiste gruppieren, auf-/zuklappen, ein-/ausblenden.

Die Integration
  * liefert das Frontend-Modul aus und lädt es in jedem Browser (add_extra_js_url),
  * speichert die Einstellungen im HA-Speicher (.storage/side_bear),
  * legt die Einstellungsseite und je Gruppe zwei Überschriften als Panels an.
"""

from __future__ import annotations

import hashlib
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


def _file_hash(path: Path) -> str:
    """Kurzer Fingerabdruck einer Datei (läuft im Executor)."""
    try:
        return hashlib.sha1(path.read_bytes()).hexdigest()[:8]
    except OSError:
        return "0"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Side-Bear einrichten."""
    store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    config = await store.async_load()
    if not isinstance(config, dict):
        config = dict(DEFAULT_CONFIG)

    # Fingerabdruck der Datei in der URL: jede Änderung lädt sicher neu (kein alter Cache)
    js_path = Path(__file__).parent / "frontend" / JS_FILE
    js_hash = await hass.async_add_executor_job(_file_hash, js_path)
    js_url = f"{URL_BASE}/{JS_FILE}?v={VERSION}-{js_hash}"
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
                    str(js_path),
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
    """Side-Bear deinstallieren: eigene Einstellungen löschen.

    Die Seitenleisten der Benutzer werden hier bewusst nicht angefasst. Wer zur
    normalen Seitenleiste zurück will, schaltet Side-Bear vorher auf "inaktiv"
    (das setzt jedes Gerät aus der eigenen Sitzung zurück), siehe README.
    """
    await Store(hass, STORAGE_VERSION, STORAGE_KEY).async_remove()
