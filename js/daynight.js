/* ================================================================
   Tag-Nacht-Zyklus — Welt-Uhr, Phasen-Keyframes, Interpolation
   Ein voller Spieltag dauert DAY_LEN Sekunden Echtzeit. Die Uhr
   (G.timeOfDay, 0..1, 0 = Mitternacht) läuft nur im World-Modus:
   main.js ruft update(dt) ausschließlich im World-Zweig auf, damit
   Kämpfe/Dialoge die Stimmung nicht unbemerkt verschieben.
   Der NACHT-Keyframe sind exakt die ursprünglichen Werte aus
   scene.js/world.js — nachts sieht das Spiel 1:1 aus wie vorher.
================================================================ */
import * as THREE from 'three';
import { $ } from './util.js';
import { G } from './state.js';
import { NIGHT, scene, hemiLight, moonLight, ANIM } from './scene.js';

const DAY_LEN = 300;   // Sekunden Echtzeit pro Spieltag (~5 Minuten)

/* ---------- Phasen-Looks ----------
   sky                          Hintergrund- UND Nebelfarbe
   hemiSky/hemiGround/hemiInt   HemisphereLight
   dir/dirInt                   Directional (nachts Mond, tags Sonne)
   dirPos                       Licht-Offset relativ zum Spieler (Bogen am Himmel)
   stars                        Sterne-/Mond-Opacity (nachts 1, tags 0)
   stand                        Dimm-Faktor der warmen Standlichter
   day                          0 = Nacht, 1 = heller Tag (für Glühen & Gags)
   Palette harmonisch zum Hand-drawn-Look: gedeckte, leicht entsättigte
   Töne rund um Papier #f1e8d8, Gold #e8b54a und Nachtblau #141831.   */
const NACHT  = { sky:NIGHT,     hemiSky:'#5560a4', hemiGround:'#1c2415', hemiInt:1.0,
                 dir:'#aab4ff', dirInt:.7,   dirPos:[-50,80,-30], stars:1,   stand:1,   day:0 };
const MORGEN = { sky:'#a394bb', hemiSky:'#9591c4', hemiGround:'#39402e', hemiInt:1.05,
                 dir:'#e6b4c0', dirInt:.85,  dirPos:[65,28,-25],  stars:.2,  stand:.7,  day:.45 };
const TAG    = { sky:'#9fb5c9', hemiSky:'#b8c6d8', hemiGround:'#55603f', hemiInt:1.2,
                 dir:'#f5dfae', dirInt:1.35, dirPos:[20,95,-15],  stars:0,   stand:.35, day:1 };
const ABEND  = { sky:'#b5714e', hemiSky:'#bb8660', hemiGround:'#3a3326', hemiInt:1.05,
                 dir:'#f2a85e', dirInt:1.0,  dirPos:[-70,26,-10], stars:.12, stand:.85, day:.45 };

// Keyframe-Tabelle über den normierten Tag (t in 0..1) — die Plateaus
// (tiefe Nacht, heller Nachmittag) halten die Stimmung, dazwischen wird gelerpt.
const KEYS = [
  { t:.00, ...NACHT },
  { t:.22, ...NACHT },    // tiefe Nacht hält bis kurz vorm Morgengrauen
  { t:.30, ...MORGEN },   // kühles Blaurosa
  { t:.40, ...TAG },
  { t:.62, ...TAG },      // Nachmittag hält
  { t:.70, ...ABEND },    // Abendrot, tiefstehende warme Sonne
  { t:.80, ...NACHT },
  { t:1,   ...NACHT },
];
// Farben einmalig vorparsen — keine Allokationen pro Frame
for (const k of KEYS){
  k.skyC = new THREE.Color(k.sky);
  k.hemiSkyC = new THREE.Color(k.hemiSky);
  k.hemiGroundC = new THREE.Color(k.hemiGround);
  k.dirC = new THREE.Color(k.dir);
}

// Vom Loop in main.js gelesen: Licht-Offset (die Schattenkamera folgt dem
// Spieler, Mond/Sonne wandern auf ihrem Bogen mit) und der aktuelle
// Tag-Faktor (Logges Glühen pulsiert tagsüber nur halb so stark).
// Objekte statt Re-Export, weil importierte Bindings read-only sind.
export const lightOffset = { x:-50, y:80, z:-30 };
export const cur = { day:0 };

const lerp = (a, b, k) => a + (b - a)*k;

const PHASE_EMOJI = { nacht:'\u{1F319}', morgen:'\u{1F305}', tag:'☀️', abend:'\u{1F307}' };
const PHASE_NAME  = { nacht:'Nacht', morgen:'Morgengrauen', tag:'Tag', abend:'Abend' };
let lastEmoji = '';

export function getTimeOfDay(){ return G.timeOfDay; }
export function getPhase(){
  const t = G.timeOfDay;
  if (t < .26 || t >= .76) return 'nacht';
  if (t < .36) return 'morgen';
  if (t < .66) return 'tag';
  return 'abend';
}
// Fotobox & Co.: gruselig wird's erst nach Einbruch der Nacht
export const isNight = () => getPhase() === 'nacht';

export function update(dt){
  G.timeOfDay = (G.timeOfDay + dt/DAY_LEN) % 1;
  apply();
}

function apply(){
  const t = G.timeOfDay;
  // Keyframe-Segment suchen und weich interpolieren
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++){
    if (t >= KEYS[i].t && t <= KEYS[i+1].t){ a = KEYS[i]; b = KEYS[i+1]; break; }
  }
  let k = b.t > a.t ? (t - a.t)/(b.t - a.t) : 0;
  k = k*k*(3 - 2*k);   // smoothstep — weiche Übergänge, exakte Plateaus

  scene.background.lerpColors(a.skyC, b.skyC, k);
  scene.fog.color.copy(scene.background);
  hemiLight.color.lerpColors(a.hemiSkyC, b.hemiSkyC, k);
  hemiLight.groundColor.lerpColors(a.hemiGroundC, b.hemiGroundC, k);
  hemiLight.intensity = lerp(a.hemiInt, b.hemiInt, k);
  moonLight.color.lerpColors(a.dirC, b.dirC, k);
  moonLight.intensity = lerp(a.dirInt, b.dirInt, k);
  lightOffset.x = lerp(a.dirPos[0], b.dirPos[0], k);
  lightOffset.y = lerp(a.dirPos[1], b.dirPos[1], k);
  lightOffset.z = lerp(a.dirPos[2], b.dirPos[2], k);
  // Sternenhimmel (und Mondscheibe) tags ausblenden
  const stars = lerp(a.stars, b.stars, k);
  ANIM.stars.opacity = stars;
  if (ANIM.moonMat) ANIM.moonMat.opacity = stars;
  // warme Standlichter tagsüber etwas runterdimmen
  const stand = lerp(a.stand, b.stand, k);
  for (const l of ANIM.standLights) l.intensity = l.userData.baseInt * stand;
  cur.day = lerp(a.day, b.day, k);

  // HUD: dezente Tageszeit-Anzeige neben dem Ensemble-Zähler
  const ph = getPhase();
  if (PHASE_EMOJI[ph] !== lastEmoji){
    lastEmoji = PHASE_EMOJI[ph];
    const el = $('hud-time');
    el.textContent = lastEmoji;
    el.title = PHASE_NAME[ph];
  }
}
