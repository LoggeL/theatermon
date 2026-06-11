# THEATERMON – Architektur

HTML5/Three.js-Spiel als native ES-Module (kein Build-Schritt). Three.js 0.160
kommt per Importmap vom CDN; ausgeliefert wird über einen simplen statischen
Server (z.B. `python -m http.server`).

## Modulübersicht

| Datei | Inhalt |
|---|---|
| `index.html` | Nur Markup, Importmap und die Einbindung von `css/style.css` + `js/main.js`. |
| `css/style.css` | Komplettes Styling (Hand-drawn-Look, HUD, Battle-UI, Touch-Controls). |
| `js/util.js` | Reine Helfer: `$` (DOM), `sleep`, `tween`, `hashStr`, `mulberry` (PRNG), `pick`. |
| `js/data.js` | Reine Spieldaten + pure Funktionen: Cast (`RAW`, `TOTAL`), Moves (`MOVES`, `SIG`, `MOVE_POOL`), Typen (`TYPE_NAME`/`TYPE_COL`/`TYPE_BLURB`, `typeEff`), Dialogzeilen (`ROLE_LINES` etc.), Paletten. Keine DOM-/Three-Abhängigkeiten – backend-tauglich. |
| `js/storage.js` | Abstraktion über `localStorage` (`readSave`/`writeSave`/`clearSave`, `readFlag`/`writeFlag`) — einzige Stelle, die Persistenz anfasst. |
| `js/audio.js` | Mini-Synth: `audioInit`, `beep`, `sfx`, Mute-Button. |
| `js/state.js` | Spielzustand `G`, `save()`/`load()` (inkl. Save-Migration v1→v2), Member-Fabriken (`makeMember`, `makeBoss`, `makeBeatrice`), Stat-/Level-Logik. |
| `js/scene.js` | Renderer, Welt- und Kampf-Szene, Kameras, Lichter, Resize, geteilte Geometrie-/Material-Caches (`toon`, `boxGeo` …), zentrale `clock` und die Animations-Registry `ANIM`. |
| `js/daynight.js` | Tag-Nacht-Zyklus: Welt-Uhr (`G.timeOfDay`, tickt nur im World-Modus), Keyframe-Tabelle der Phasen (Nacht/Morgen/Tag/Abend), `update(dt)` lerpt Himmel/Nebel, Hemisphere, Mond/Sonne, Sterne und Standlichter; `getPhase()`/`isNight()` für Gameplay-Hooks (Fotobox, Logges Glühen) und die HUD-Tageszeit. |
| `js/models.js` | Modellbau: `buildPerson`, `animPerson`, `makeLabel`, `makeSign`, `buildBattlePlant`, `disposeModel`. |
| `js/world.js` | Weltaufbau (Bühne + alle Props), Kollisionen, NPC-Wanderer, Boss-Modell, Minimap, Interaktionen (`tryInteract`, `nearestInteract`). |
| `js/battle.js` | Kampfsystem: `B`-Zustand, `startBattle`/`endBattle`, Zugablauf, Casting, Effekte (floatText, burst, …), Battle-UI-Buttons, `fx` (modulübergreifend beschriebener Effekt-Zustand). |
| `js/ui.js` | Dialoge (`showDialog`), HUD, Ensemble-Menü, Title-/Charakter-/Starter-Screens, Credits, Touch-Steuerung, Spieler-Setup (`player`, `setPlayerCharacter`). |
| `js/main.js` | Einstiegspunkt: Tastatur + Kamera-Orbit, zentraler `loop()` (requestAnimationFrame), Boot-Logik. |

## Datenfluss

```
data.js (statische Daten)
   ↓
state.js (G = Laufzeit-Zustand) ⇄ storage.js (Persistenz, localStorage)
   ↓
world.js ⇄ battle.js   (Begegnung startet Kampf, Kampfende räumt Wanderer auf)
   ↓           ↓
  ui.js (Dialoge/HUD spiegeln G)
   ↓
main.js (loop liest alles, rendert scene.js)
```

- `main.js` treibt pro Frame: Input → Spielerbewegung → Wanderer → Animationen
  (`ANIM`) → Minimap → Render. Im Kampfmodus rendert derselbe Loop stattdessen
  die `battleScene`.
- `world.js` und `battle.js` importieren sich gegenseitig (zirkulär). Das ist
  unkritisch, weil die gegenseitige Nutzung (`startBattle`, `removeWanderer`,
  `kaffeePos`) nur zur Laufzeit in Funktionen passiert, nie beim Modul-Init.
- Modulübergreifend *beschriebener* Zustand liegt in Objekten
  (`G`, `B`, `fx`, `touchVec`, `ANIM`), weil importierte ES-Module-Bindings
  beim Importeur read-only sind.
- Save-Format v2: `{ v:2, playerId, bossDown, beatriceDown, cheesePower, time,
  ensemble:[{id,lvl,xp,hp,hpV,atkV}] }`. `load()` migriert Alt-Saves ohne
  `v`-Feld (Julian-Doppeleintrag: id 32 → 8, ids > 32 rücken um 1 auf).
  `time` (Welt-Uhr, 0..1) ist optional — fehlt es, startet der Stand am
  frühen Abend (`TIME_START`); keine eigene Migrationsstufe nötig.

## Erweiterbarkeit

- `data.js` ist DOM-/Three-frei und `storage.js` kapselt die komplette
  Persistenz — sollte später doch einmal ein Backend gewünscht sein, sind das
  die beiden Andockpunkte. Aktuell läuft alles rein clientseitig.
