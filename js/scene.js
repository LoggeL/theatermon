/* ================================================================
   three.js setup — Renderer, Szenen, Kameras, Lichter, geteilte
   Geometrien/Materialien und die zentrale Uhr
================================================================ */
import * as THREE from 'three';
import { $ } from './util.js';

export const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);

export const NIGHT = '#141831';
export const scene = new THREE.Scene();
scene.background = new THREE.Color(NIGHT);
scene.fog = new THREE.Fog(NIGHT, 55, 165);
export const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, .1, 500);

export const battleScene = new THREE.Scene();
battleScene.background = new THREE.Color('#0c0e1e');
export const battleCam = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, .1, 200);
battleCam.position.set(0, 4.6, 10.2);
battleCam.lookAt(0, 1.6, 0);

addEventListener('resize', () => {
  camera.aspect = battleCam.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix(); battleCam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// toon gradient
const gradTex = new THREE.DataTexture(new Uint8Array([60,60,60,255, 140,140,140,255, 255,255,255,255]), 3, 1);
gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter;
gradTex.needsUpdate = true;
const matCache = {};
export function toon(color){
  if (!matCache[color]) matCache[color] = new THREE.MeshToonMaterial({ color, gradientMap: gradTex });
  return matCache[color];
}
export const outlineMat = new THREE.MeshBasicMaterial({ color:'#16120f', side: THREE.BackSide });

/* ---------- lights (world) ---------- */
// Hemisphere + Directional sind die Stellschrauben des Tag-Nacht-Zyklus
// (daynight.js lerpt Farben/Intensitäten; die Werte hier sind der Nacht-Look)
export const hemiLight = new THREE.HemisphereLight('#5560a4', '#1c2415', 1.0);
scene.add(hemiLight);
export const moonLight = new THREE.DirectionalLight('#aab4ff', 0.7);
moonLight.position.set(-50, 80, -30);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
moonLight.shadow.camera.left = -35; moonLight.shadow.camera.right = 35;
moonLight.shadow.camera.top = 35; moonLight.shadow.camera.bottom = -35;
scene.add(moonLight, moonLight.target);   // Licht folgt im Loop dem Spieler

/* ---------- shared geometries & materials (kein GPU-Leak bei Respawns) ---------- */
const geoCache = {};
export function cachedGeo(key, make){ return geoCache[key] ??= make(); }
export function boxGeo(w,h,d){ return cachedGeo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w,h,d)); }
export function sphGeo(r,ws,hs){ return cachedGeo(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r,ws,hs)); }
export function cylGeo(rt,rb,h,s){ return cachedGeo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt,rb,h,s)); }
export function coneGeo(r,h,s){ return cachedGeo(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r,h,s)); }
const basicCache = {};
export function basicMat(color){ return basicCache[color] ??= new THREE.MeshBasicMaterial({ color }); }

// zentrale Uhr — vom Haupt-Loop (main.js) und der Minimap (world.js) genutzt
export const clock = new THREE.Clock();

// Animations-Registry: Welt (world.js) und Kampf-Deko (battle.js) tragen
// ihre animierten Objekte hier ein, der Loop in main.js liest sie.
// Liegt hier (statt in world.js), damit battle.js beim Modul-Init nicht
// in den Import-Zyklus world ↔ battle läuft.
// standLights/moonMat liest der Tag-Nacht-Zyklus (daynight.js):
// warme Standlichter werden tags gedimmt, Sterne/Mond ausgeblendet.
export const ANIM = { crowns:[], curtains:[], cones:[], spotTargets:[], bCurtains:[], dome:null, stars:null, treeDots:[], ahnenAugen:[], standLights:[], moonMat:null };
