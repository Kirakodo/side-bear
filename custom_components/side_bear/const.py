"""Konstanten für Side-Bear."""

from __future__ import annotations

DOMAIN = "side_bear"
NAME = "Side-Bear"
VERSION = "1.0.1"

# Frontend
URL_BASE = "/side_bear_static"
JS_FILE = "side-bear.js"

# Panels
SETTINGS_PANEL = "side-bear"
HEADER_PREFIX = "side-bear-g-"
HEADER_CLOSED_SUFFIX = "-zu"

# Speicher
STORAGE_KEY = "side_bear"
STORAGE_VERSION = 1

# interne Signale
SIGNAL_UPDATED = "side_bear_updated"

DEFAULT_CONFIG: dict = {
    "enabled": True,
    "home": "lovelace",
    "groups": [],
    "items": {},
}
