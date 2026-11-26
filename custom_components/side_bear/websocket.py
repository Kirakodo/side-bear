"""Websocket-Befehle von Side-Bear."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import (
    async_dispatcher_connect,
    async_dispatcher_send,
)

from .const import DOMAIN, SIGNAL_UPDATED
from .panels import async_register_panels

REGISTERED = f"{DOMAIN}_ws_registered"


@callback
def async_setup_websocket(hass: HomeAssistant) -> None:
    """Befehle einmal pro HA-Lauf registrieren."""
    if hass.data.get(REGISTERED):
        return
    hass.data[REGISTERED] = True
    websocket_api.async_register_command(hass, ws_get_config)
    websocket_api.async_register_command(hass, ws_save_config)
    websocket_api.async_register_command(hass, ws_subscribe)


def _clean(config: dict[str, Any]) -> dict[str, Any]:
    """Grobe Prüfung der Einstellungen, unbekannte Felder bleiben erhalten."""
    out = dict(config)
    out["enabled"] = bool(out.get("enabled", True))
    out["home"] = str(out.get("home") or "lovelace")
    groups = out.get("groups")
    out["groups"] = [g for g in groups if isinstance(g, dict) and "id" in g] if isinstance(groups, list) else []
    for group in out["groups"]:
        group["panels"] = [str(p) for p in group.get("panels", []) if isinstance(p, str)]
    items = out.get("items")
    out["items"] = items if isinstance(items, dict) else {}
    return out


@websocket_api.websocket_command({vol.Required("type"): "side_bear/config"})
@callback
def ws_get_config(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Aktuelle Einstellungen liefern (für alle angemeldeten Benutzer)."""
    data = hass.data.get(DOMAIN)
    if not data:
        connection.send_error(msg["id"], "not_loaded", "Side-Bear ist nicht geladen")
        return
    connection.send_result(msg["id"], data["config"])


@websocket_api.websocket_command(
    {vol.Required("type"): "side_bear/save", vol.Required("config"): dict}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_config(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Einstellungen speichern (nur Admin) und Panels anpassen."""
    data = hass.data.get(DOMAIN)
    if not data:
        connection.send_error(msg["id"], "not_loaded", "Side-Bear ist nicht geladen")
        return
    config = _clean(msg["config"])
    data["config"] = config
    await data["store"].async_save(config)
    await async_register_panels(hass)
    async_dispatcher_send(hass, SIGNAL_UPDATED)
    connection.send_result(msg["id"], config)


@websocket_api.websocket_command({vol.Required("type"): "side_bear/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Bei jeder Änderung die neuen Einstellungen schicken (None = entladen)."""

    @callback
    def forward() -> None:
        data = hass.data.get(DOMAIN)
        connection.send_message(
            websocket_api.event_message(msg["id"], {"config": data["config"] if data else None})
        )

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_UPDATED, forward)
    connection.send_result(msg["id"])
