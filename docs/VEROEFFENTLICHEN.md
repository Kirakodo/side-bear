# Side-Bear veröffentlichen – Checkliste

Ziel: Side-Bear soll in HACS ohne „benutzerdefiniertes Repository“ auffindbar sein (HACS-Standardkatalog).

## 1. Repository (erledigt durch das Hochladen)

- [ ] Öffentliches Repository `side-bear` auf GitHub
- [ ] Beschreibung: *Ordnung für die Home-Assistant-Seitenleiste: Gruppen, auf-/zuklappen, ausblenden, Startseite oben.*
- [ ] Themen (Topics): `home-assistant`, `hacs`, `homeassistant`, `custom-integration`, `sidebar`
- [ ] Issues aktiviert
- [ ] Release **v1.0.0** (Tag `v1.0.0`) mit kurzer Beschreibung
- [ ] GitHub Actions „Validate“ (HACS + Hassfest) laufen grün

## 2. Logo im Home-Assistant-Brands-Repository

HACS verlangt für den Standardkatalog ein Logo im Repository `home-assistant/brands`.

1. https://github.com/home-assistant/brands forken.
2. Ordner `custom_integrations/side_bear/` anlegen.
3. Aus diesem Projekt `brand/icon.png` (256×256) und `brand/icon@2x.png` (512×512) dort hineinlegen.
4. Pull Request stellen, Titel: `Add side_bear`.
5. Warten, bis er gemergt ist (meist wenige Tage).
6. Danach in `.github/workflows/validate.yml` die Zeile `ignore: brands` entfernen.

## 3. Aufnahme in HACS

1. https://github.com/hacs/default forken.
2. In der Datei `integration` die Zeile `Kirakodo/side-bear` alphabetisch einfügen.
3. Pull Request stellen und die Vorlage ausfüllen (Link zum Repo, Release, grüne Checks, Brands-PR).
4. Die HACS-Prüfungen laufen automatisch; ein Maintainer prüft und mergt.

Bis dahin kann jeder Side-Bear schon über **HACS → Benutzerdefinierte Repositories** installieren.

## Neue Version herausgeben

1. In `custom_components/side_bear/manifest.json` **und** `const.py` die Version erhöhen (z. B. `1.0.1`).
   Die Version steckt auch in der Frontend-Adresse – so laden Browser die neue Datei sofort.
2. Änderungen hochladen.
3. Neues Release mit Tag `v1.0.1` anlegen. HACS meldet das Update automatisch.
