# Side-Bear veröffentlichen – Checkliste

Ziel: Side-Bear soll in HACS ohne „benutzerdefiniertes Repository“ auffindbar sein (HACS-Standardkatalog).

## 1. Repository

- [x] Öffentliches Repository https://github.com/Kirakodo/side-bear
- [x] Beschreibung und Themen (`home-assistant`, `hacs`, `hacs-integration`, `custom-integration`, `sidebar`, `homeassistant`)
- [x] Issues aktiviert
- [x] Releases mit Tag (`v1.0.0`, `v1.0.1` …)
- [x] GitHub Actions „Validate“ (HACS + Hassfest) grün

## 2. Logo

Seit Home Assistant 2026.3 bringen benutzerdefinierte Integrationen ihr Logo selbst mit;
das Repository `home-assistant/brands` nimmt dafür keine Pull Requests mehr an.

- [x] `custom_components/side_bear/brand/icon.png` (256×256, transparent, randlos)
- [x] `custom_components/side_bear/brand/icon@2x.png` (512×512)
- optional: `logo.png`, `dark_icon.png` usw. (fehlt ein Logo, nimmt HA das Icon)

## 3. Aufnahme in den HACS-Standardkatalog

1. https://github.com/hacs/default forken.
2. In der Datei `integration` die Zeile `Kirakodo/side-bear` alphabetisch einfügen.
3. Pull Request stellen und die Vorlage ausfüllen (Link zum Repo, Release, grüne Checks).
4. Die HACS-Prüfungen laufen automatisch; ein Maintainer prüft und mergt.

Bis dahin kann jeder Side-Bear schon über **HACS → Benutzerdefinierte Repositories** installieren.

## Neue Version herausgeben

1. Version erhöhen in `custom_components/side_bear/manifest.json`, `const.py` **und** `frontend/side-bear.js`
   (z. B. `1.1.1`). Version und ein Fingerabdruck der JS-Datei stecken in der Frontend-Adresse – so laden Browser die neue Datei sofort.
2. Änderungen hochladen.
3. Neues Release mit Tag `v1.1.1` anlegen. HACS meldet das Update automatisch.
