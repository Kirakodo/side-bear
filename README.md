# 🐻 Side-Bear

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/)
[![Validate](https://github.com/Kirakodo/side-bear/actions/workflows/validate.yml/badge.svg)](https://github.com/Kirakodo/side-bear/actions/workflows/validate.yml)

**🇩🇪 Deutsch** · [🇬🇧 English](#-english)

---

## 🇩🇪 Deutsch

**Ordnung für die Home-Assistant-Seitenleiste.** Side-Bear gruppiert alle Einträge der Seitenleiste, klappt Gruppen auf und zu, blendet Einträge aus – auch automatisch, abhängig von einer Entität – und hält deine Startseite immer ganz oben.

```
Übersicht                  ← Startseite, immer ganz oben
🏠  ▼ WOHNEN                ← Gruppe, aufgeklappt
    Lichtvorhang
    Gesundheit
📅  ▶ ALLTAG                ← Gruppe, zugeklappt
⚙️  ▶ SYSTEM
```

### Funktionen

- **Gruppen** mit Name und Icon, frei sortierbar – für alle Seitenleisten-Einträge: Dashboards, Add-ons, Energie, Verlauf …
- **Auf- und zuklappen** mit einem Tipp auf die Gruppen-Überschrift. Der Zustand gilt **pro Gerät**: Laptop und Handy dürfen verschieden aufgeklappt sein.
- **Standard je Gruppe**: startet aufgeklappt oder zugeklappt; dazu „Alle aufklappen“, „Alle zuklappen“, „Auf Standard“.
- **Ausblenden** einzelner Einträge oder ganzer Gruppen.
- **Bedingungen**: Eintrag oder Gruppe nur zeigen, wenn eine Entität einen bestimmten Zustand hat (z. B. `binary_sensor.lichterkette_online` ist `on`).
- **Startseite** steht immer ganz oben und wird nie zugeklappt.
- **Aus-Schalter**: „inaktiv“ zeigt die normale HA-Seitenleiste, die Einstellungen bleiben erhalten.
- **Gruppen-Karte** `custom:side-bear-card` zeigt alle Dashboards nach Gruppen als Kacheln auf jedem Dashboard.
- Funktioniert im Browser und in der Companion-App; die Einstellungsseite ist auch auf dem Handy bedienbar.

### Installation

#### Über HACS (empfohlen)

[![In HACS öffnen](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Kirakodo&repository=side-bear&category=integration)

1. HACS öffnen → ⋮ → **Benutzerdefinierte Repositories** → `https://github.com/Kirakodo/side-bear`, Typ **Integration**.
2. **Side-Bear** suchen und herunterladen.
3. Home Assistant neu starten.
4. **Einstellungen → Geräte & Dienste → Integration hinzufügen → Side-Bear**.
5. In der Seitenleiste erscheint **Side-Bear** 🐻 – dort Gruppen anlegen und Einträge zuordnen.

#### Manuell

Ordner `custom_components/side_bear` nach `/config/custom_components/side_bear` kopieren, neu starten, dann wie oben ab Schritt 4.

### Bedienung

| Was | Wo |
|---|---|
| Gruppe anlegen | Side-Bear → **Neue Gruppe** |
| Eintrag einer Gruppe zuordnen | Auswahlfeld neben dem Eintrag |
| Reihenfolge | Pfeile ↑ ↓ bei Gruppen und Einträgen |
| Ausblenden | Auge-Symbol |
| Bedingung | Filter-Symbol → Entität, „ist“/„ist nicht“, Zustand |
| Startseite wählen | Bereich „Startseite – immer ganz oben“ |
| Auf-/Zuklappen | Tipp auf die Überschrift in der Seitenleiste |

### Deinstallation

**Einstellungen → Geräte & Dienste → Side-Bear → ⋮ → Löschen.** Side-Bear entfernt dabei seine Einstellungsseite und die Gruppen-Überschriften, löscht seine gespeicherten Einstellungen und setzt die Seitenleiste aller Benutzer auf den HA-Standard zurück. Danach in HACS entfernen und Browser/App einmal neu laden.

### So funktioniert es (update-sicher)

Side-Bear verändert keine Dateien von Home Assistant und greift nicht in den Aufbau der Seitenleiste ein. Es nutzt nur Wege, die HA selbst verwendet:

| Teil | Umsetzung |
|---|---|
| Frontend laden | `frontend.add_extra_js_url` |
| Einstellungen | HA-Speicher `.storage/side_bear`, Websocket `side_bear/*` |
| Gruppen-Überschriften | Panels der Integration (`side-bear-g-<id>` / `-zu`) |
| Reihenfolge & Ausblenden | dieselben Werte, die „Seitenleiste bearbeiten“ speichert – pro Gerät |

Sollte ein HA-Update das Abfangen des Klicks auf eine Überschrift verhindern, öffnet die Überschrift einfach eine Seite mit allen Dashboards der Gruppe – nichts geht kaputt.

**Hinweis:** Änderungen über HAs eigenes „Seitenleiste bearbeiten“ werden von Side-Bear überschrieben, solange es aktiv ist.

### Lovelace-Karte

```yaml
type: custom:side-bear-card
group: wohnen        # optional: nur eine Gruppe (ID oder Name)
show_hidden: false   # optional: ausgeblendete Einträge blass mit anzeigen
```

### Voraussetzungen

Home Assistant 2025.1 oder neuer.

---

## 🇬🇧 English

**Tidy up your Home Assistant sidebar.** Side-Bear groups all sidebar entries into collapsible sections, hides entries – manually or automatically based on an entity state – and keeps your start page pinned to the top.

### Features

- **Groups** with name and icon, freely sortable – for every sidebar entry: dashboards, add-ons, energy, history …
- **Collapse and expand** by tapping the group header. The state is stored **per device**: your laptop and your phone can differ.
- **Default per group**: starts expanded or collapsed; plus "expand all", "collapse all", "reset to default".
- **Hide** single entries or whole groups.
- **Conditions**: show an entry or group only while an entity has a given state (e.g. `binary_sensor.fairy_lights_online` is `on`).
- **Start page** always stays on top and is never collapsed.
- **Off switch**: "inactive" restores the normal HA sidebar, settings are kept.
- **Group card** `custom:side-bear-card` shows all dashboards by group as tiles on any dashboard.
- Works in the browser and in the Companion app; the settings page is mobile friendly. The user interface is currently in German.

### Installation

#### HACS (recommended)

1. Open HACS → ⋮ → **Custom repositories** → `https://github.com/Kirakodo/side-bear`, type **Integration**.
2. Search for **Side-Bear** and download it.
3. Restart Home Assistant.
4. **Settings → Devices & services → Add integration → Side-Bear**.
5. **Side-Bear** 🐻 appears in the sidebar – create groups and assign entries there.

#### Manual

Copy `custom_components/side_bear` to `/config/custom_components/side_bear`, restart, then continue with step 4.

### Uninstall

**Settings → Devices & services → Side-Bear → ⋮ → Delete.** Side-Bear removes its settings page and group headers, deletes its stored settings and resets the sidebar of all users to the HA default. Then remove it in HACS and reload browser/app once.

### How it works (update-safe)

Side-Bear does not modify any Home Assistant files and does not patch the sidebar. It only uses mechanisms HA itself uses: `frontend.add_extra_js_url`, its own storage `.storage/side_bear` with `side_bear/*` websocket commands, integration panels for the group headers, and the same per-device values that "Edit sidebar" stores. If a future HA update prevents intercepting a header click, the header simply opens a page listing all dashboards of the group.

**Note:** While active, Side-Bear overrides changes made via HA's own "Edit sidebar".

### Lovelace card

```yaml
type: custom:side-bear-card
group: wohnen        # optional: a single group (id or name)
show_hidden: false   # optional: show hidden entries dimmed
```

### Requirements

Home Assistant 2025.1 or newer.

---

## Lizenz / License

MIT
