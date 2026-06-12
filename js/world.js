/* ================================================================
   world — Weltaufbau, Props, Wanderer, Minimap, Interaktionen
================================================================ */
import * as THREE from 'three';
import { $, tween, mulberry } from './util.js';
import { RAW, TOTAL, TYPE_COL, AHNEN_QUOTES } from './data.js';
import { G, save, caughtIds, makeMember, makeBoss, makeBeatrice, grantXP, activeFighter } from './state.js';
import { scene, toon, clock, ANIM } from './scene.js';
import { isNight, cur } from './daynight.js';
import { box, addOutline, buildPerson, buildBike, animPerson, makeLabel, makeSign, disposeModel } from './models.js';
import { sfx } from './audio.js';
import { showDialog, hudUpdate, player, setPlayerCharacter, updateBike } from './ui.js';
import { startBattle } from './battle.js';

const obstacles = []; // {x,z,r}
function blockCircle(x,z,r){ obstacles.push({x,z,r}); }

// ground
{
  const geo = new THREE.PlaneGeometry(260, 260, 44, 44);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position, colors = [];
  const c1 = new THREE.Color('#2e4a2f'), c2 = new THREE.Color('#243d28'), c3 = new THREE.Color('#3a5a35');
  const rng = mulberry(42);
  for (let i=0;i<pos.count;i++){
    const r = rng();
    const c = r < .5 ? c1 : (r < .8 ? c2 : c3);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors:true }));
  ground.receiveShadow = true;
  scene.add(ground);
  // Vorplatz vor der Bühne
  const fore = new THREE.Mesh(new THREE.CircleGeometry(17, 26), new THREE.MeshLambertMaterial({ color:'#5d5345' }));
  fore.rotation.x = -Math.PI/2; fore.position.set(0, .03, -24);
  fore.receiveShadow = true;
  scene.add(fore);
}

// stars + moon
{
  const n = 420, p = new Float32Array(n*3), rng = mulberry(7);
  for (let i=0;i<n;i++){
    const a = rng()*Math.PI*2, r = 150 + rng()*60, y = 25 + rng()*130;
    p[i*3] = Math.cos(a)*r; p[i*3+1] = y; p[i*3+2] = Math.sin(a)*r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  // transparent, damit der Tag-Nacht-Zyklus Sterne & Mond tags ausblenden kann
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color:'#cfd6ff', size:1.1, sizeAttenuation:false, transparent:true, opacity:1 }));
  ANIM.stars = stars.material;
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12),
    new THREE.MeshBasicMaterial({ color:'#f4ecd8', transparent:true, opacity:1 }));
  moon.position.set(-70, 78, -95);
  ANIM.moonMat = moon.material;
  scene.add(moon);
}

// open-air stage
const stagePos = { x:0, z:-44 };
{
  const plat = box(27, 1.3, 11, '#7a5230'); plat.position.set(0, .65, -44); plat.receiveShadow = true;
  scene.add(plat);
  // Vorhang-Streifen
  for (let i=0;i<18;i++){
    const strip = box(1.45, 7.2, .4, i%2 ? '#8e1f2f' : '#6f1825', false);
    strip.position.set(-12.3 + i*1.45, 4.6, -48.8);
    strip.userData.i = i;
    ANIM.curtains.push(strip);
    scene.add(strip);
  }
  // Seitentürme + Traverse
  const t1 = box(1.2, 9.5, 1.2, '#2a2d38'); t1.position.set(-13.8, 4.75, -44);
  const t2 = t1.clone(); t2.position.x = 13.8;
  const beam = box(29, .7, .9, '#2a2d38'); beam.position.set(0, 9.2, -44);
  scene.add(t1, t2, beam);
  // Schild
  const sign = makeSign('KOLPINGTHEATER RAMSEN', 16, 2.2, 44);
  sign.position.set(0, 10.6, -44);
  scene.add(sign);
  // Scheinwerferkegel
  const coneMat = new THREE.MeshBasicMaterial({ color:'#ffd27f', transparent:true, opacity:.13, depthWrite:false, blending:THREE.AdditiveBlending });
  for (const sx of [-9, 9]){
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 8.6, 18, 1, true), coneMat);
    cone.position.set(sx*.55, 5.2, -44.5);
    cone.rotation.z = sx > 0 ? .35 : -.35;
    cone.userData.base = cone.rotation.z;
    ANIM.cones.push(cone);
    scene.add(cone);
    const spot = new THREE.SpotLight('#ffd9a0', 90, 30, .5, .5, 1.4);
    spot.position.set(sx, 8.8, -43);
    spot.target.position.set(sx*.3, 0, -45);
    ANIM.spotTargets.push(spot.target);
    scene.add(spot, spot.target);
  }
  blockCircle(0, -46, 8.5); blockCircle(-9, -45, 6); blockCircle(9, -45, 6);
}

// Kaffee & Kuchen Stand (heilt) — Theatergaudi!
export const kaffeePos = { x:24, z:10 };
{
  const counter = box(5, 1.1, 2.2, '#8a6238'); counter.position.set(24, .55, 10); scene.add(counter);
  for (let i=0;i<6;i++){
    const s = box(.85, .12, 2.8, i%2 ? '#d9483b' : '#f1e8d8', false);
    s.position.set(21.9 + i*.85, 2.6 - i*.04, 10);
    scene.add(s);
  }
  const poleL = box(.14, 2.6, .14, '#5b4226'); poleL.position.set(21.8, 1.3, 11.2);
  const poleR = poleL.clone(); poleR.position.x = 26.2; scene.add(poleL, poleR);
  const sign = makeSign('Kaffee & Kuchen', 4.6, 1.1, 60, '#f1e8d8', '#a8232f');
  sign.position.set(24, 3.4, 10.6); scene.add(sign);
  const warm = new THREE.PointLight('#ffb45e', 30, 16, 1.7); warm.position.set(24, 2.4, 11);
  warm.userData.baseInt = 30; ANIM.standLights.push(warm);   // tags dimmt der Tag-Nacht-Zyklus
  scene.add(warm);
  blockCircle(24, 10, 3);
}

// Fotobox (easter egg)
export const fotoPos = { x:-24, z:14 };
export let fotoLight;
{
  const cab = box(2.1, 2.6, 2.1, '#23252f'); cab.position.set(-24, 1.3, 14); addOutline(cab); scene.add(cab);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.18,16), toon('#e8e3d5'));
  lens.rotation.x = Math.PI/2; lens.position.set(-24, 1.6, 15.16); scene.add(lens);
  const sign = makeSign('FOTOBOX', 1.9, .55, 72, '#23252f', '#ffd97a');
  sign.position.set(-24, 2.95, 15.12); scene.add(sign);
  fotoLight = new THREE.PointLight('#ffffff', 0, 14, 1.6);
  fotoLight.position.set(-24, 1.8, 15.4); scene.add(fotoLight);
  blockCircle(-24, 14, 2.2);
}

// Hüpfburg (Training: einmal pro Spieltag hüpfen = Applaus-Punkte)
export const huepfPos = { x:38, z:-6 };
{
  const base = box(6, 1.4, 6, '#f25c54'); base.position.set(38, .7, -6); scene.add(base);
  for (const [cx,cz] of [[-2.6,-2.6],[2.6,-2.6],[-2.6,2.6],[2.6,2.6]]){
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,3.4,10), toon('#f4d35e'));
    tw.position.set(38+cx, 1.7, -6+cz); addOutline(tw); scene.add(tw);
  }
  const roofDome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 14, 10, 0, Math.PI*2, 0, Math.PI/2), toon('#5fa8d3'));
  roofDome.position.set(38, 3.1, -6); roofDome.scale.y = .55; scene.add(roofDome);
  ANIM.dome = roofDome;
  blockCircle(38, -6, 4.4);
}

// Fundus-Schuppen (Kostüm-Ecke: neues Outfit + Deckung ▲ für den nächsten Kampf)
export const fundusPos = { x:50, z:30 };
{
  const shed = box(5, 3, 4, '#6e5440'); shed.position.set(50, 1.5, 30); scene.add(shed);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2, 4), toon('#4a3526'));
  roof.position.set(50, 4, 30); roof.rotation.y = Math.PI/4; scene.add(roof);
  const sign = makeSign('FUNDUS', 2.6, .8, 80); sign.position.set(50, 2.2, 32.05); scene.add(sign);
  blockCircle(50, 30, 3.6);
}

// Viktors Sarkophag-Lieferung (CREEPSHOW-Requisite — es klopft von innen)
export const sarkPos = { x:-42, z:-4 };
{
  const base = box(1.7, 1.1, 3.6, '#c8a23c'); base.position.set(sarkPos.x, .55, sarkPos.z);
  base.rotation.y = .5; addOutline(base); scene.add(base);
  const lid = box(1.6, .28, 3.4, '#e0bd55'); lid.position.set(sarkPos.x + .45, 1.3, sarkPos.z - .25);
  lid.rotation.set(.08, .68, .14); addOutline(lid); scene.add(lid);
  const mask = box(.8, .55, .15, '#2e6f8e', false); mask.position.set(sarkPos.x + .47, 1.48, sarkPos.z - .23);
  mask.rotation.set(.08, .68, .14); scene.add(mask);
  blockCircle(sarkPos.x, sarkPos.z, 2.2);
}

// Beatrice, die Kannibalia Fressaria (Felias & Fionas Liebling)
export const plantPos = { x:-4, z:42 };
{
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(1, .75, 1.1, 12), toon('#8a4a2b'));
  pot.position.set(plantPos.x, .55, plantPos.z); addOutline(pot); scene.add(pot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.18, .34, 2.4, 8), toon('#2f7a33'));
  stem.position.set(plantPos.x, 2.1, plantPos.z); stem.rotation.z = .14; scene.add(stem);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), toon('#3fa04a'));
  head.position.set(plantPos.x - .35, 3.4, plantPos.z); head.scale.set(1, .85, 1.15);
  addOutline(head); scene.add(head);
  const maw = new THREE.Mesh(new THREE.SphereGeometry(.52, 10, 8), toon('#a8232f'));
  maw.position.set(plantPos.x - .35, 3.25, plantPos.z + .82); scene.add(maw);
  for (const s of [-1, 1]){
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(.45, 1.5, 6), toon('#2f7a33'));
    leaf.position.set(plantPos.x + s*.9, 1.4, plantPos.z); leaf.rotation.z = -s*1.1;
    scene.add(leaf);
  }
  ANIM.beatrice = head;
  blockCircle(plantPos.x, plantPos.z, 1.9);
}

// Ahnengalerie — sprechende Portraits der von Falkensteins
export const galeriePos = { x:-48, z:30 };
{
  for (let i=0;i<3;i++){
    const gx = galeriePos.x - 2.6 + i*2.6, gz = galeriePos.z + (i-1)*.3;
    const post = box(.22, 2.6, .22, '#4a3526'); post.position.set(gx, 1.3, gz); scene.add(post);
    const frame = box(1.8, 2.2, .18, '#c8a23c'); frame.position.set(gx, 2.9, gz);
    frame.rotation.y = (i-1)*.12; addOutline(frame); scene.add(frame);
    const canvas2 = box(1.45, 1.85, .2, i===1 ? '#3a2f3c' : '#46394a', false);
    canvas2.position.set(gx, 2.9, gz); canvas2.rotation.y = (i-1)*.12; scene.add(canvas2);
    // Augenpaare — die Ahnen beobachten dich
    for (const s of [-1, 1]){
      const eye = box(.14, .14, .24, '#f1e8d8', false);
      eye.position.set(gx + s*.3, 3.25, gz); eye.rotation.y = (i-1)*.12;
      ANIM.ahnenAugen.push(eye); scene.add(eye);
    }
  }
  const sign = makeSign('AHNENGALERIE', 3.4, .8, 64, '#3a2f3c', '#c8a23c');
  sign.position.set(galeriePos.x, .9, galeriePos.z + 1.4); scene.add(sign);
  blockCircle(galeriePos.x - 2.6, galeriePos.z, 1.2);
  blockCircle(galeriePos.x, galeriePos.z, 1.2);
  blockCircle(galeriePos.x + 2.6, galeriePos.z, 1.2);
}

// Eselsmilch-Bad (für Prinzessin Iset) — mit Bewohner
export const teichPos = { x:-50, z:10 };
export let krokoLunge = false;   // während des Schnapp-Tweens pausiert die Schwimmrunde
{
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, .5, 22), toon('#f1e8d8'));
  pool.position.set(teichPos.x, .25, teichPos.z); scene.add(pool);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.4, .32, 8, 22), toon('#8a8a7a'));
  rim.rotation.x = Math.PI/2; rim.position.set(teichPos.x, .5, teichPos.z); addOutline(rim); scene.add(rim);
  // Krokodil: Schnauze + Augen lugen aus der Milch
  const kroko = new THREE.Group();
  const snout = box(.5, .28, 1.3, '#3c6b3a'); snout.position.y = .12; kroko.add(snout);
  for (const s of [-1, 1]){
    const eye = box(.2, .26, .2, '#3c6b3a'); eye.position.set(s*.22, .32, -.45); kroko.add(eye);
    const pupil = box(.08, .1, .06, '#f4d35e', false); pupil.position.set(s*.22, .38, -.36); kroko.add(pupil);
  }
  kroko.position.set(teichPos.x + 1.2, .5, teichPos.z);
  ANIM.kroko = kroko; scene.add(kroko);
  const sign = makeSign('ESELSMILCH – NICHT TRINKEN!', 4.4, .85, 52, '#f1e8d8', '#a8232f');
  sign.position.set(teichPos.x, 1.5, teichPos.z + 4.2); scene.add(sign);
  blockCircle(teichPos.x, teichPos.z, 4);
}

// Isets Thron („Wo ist mein Thron, von dem ich auf euch herabsehen kann?")
export const thronPos = { x:-36, z:-14 };
{
  const sockel = box(2.4, .5, 2.4, '#8a8a7a'); sockel.position.set(thronPos.x, .25, thronPos.z); scene.add(sockel);
  const sitz = box(1.5, .55, 1.4, '#c8a23c'); sitz.position.set(thronPos.x, .8, thronPos.z); addOutline(sitz); scene.add(sitz);
  const kissen = box(1.3, .2, 1.2, '#a8232f', false); kissen.position.set(thronPos.x, 1.15, thronPos.z); scene.add(kissen);
  const lehne = box(1.5, 2.3, .3, '#c8a23c'); lehne.position.set(thronPos.x, 2.1, thronPos.z - .6); addOutline(lehne); scene.add(lehne);
  const kugel = new THREE.Mesh(new THREE.SphereGeometry(.26, 10, 8), toon('#e0bd55'));
  kugel.position.set(thronPos.x, 3.35, thronPos.z - .6); scene.add(kugel);
  for (const s of [-1, 1]){
    const arm = box(.28, .8, 1.3, '#c8a23c'); arm.position.set(thronPos.x + s*.75, 1.2, thronPos.z); scene.add(arm);
  }
  blockCircle(thronPos.x, thronPos.z, 1.9);
}

// Viktors Hirntauschinator („Für die Wissenschaft!")
export const hirnPos = { x:44, z:12 };
{
  const basis = box(5, .6, 2.6, '#2a2d38'); basis.position.set(hirnPos.x, .3, hirnPos.z); scene.add(basis);
  for (const s of [-1, 1]){
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(.85, .95, 2.6, 12),
      new THREE.MeshLambertMaterial({ color:'#7fe3dc', transparent:true, opacity:.45 }));
    pod.position.set(hirnPos.x + s*1.7, 1.9, hirnPos.z); scene.add(pod);
    const deckel = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, .3, 12), toon('#3c4454'));
    deckel.position.set(hirnPos.x + s*1.7, 3.3, hirnPos.z); addOutline(deckel); scene.add(deckel);
  }
  const spule = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 1.4, 10), toon('#b85cc4'));
  spule.position.set(hirnPos.x, 2.4, hirnPos.z); scene.add(spule);
  const blitz = new THREE.PointLight('#b85cc4', 10, 12, 1.8);
  blitz.position.set(hirnPos.x, 3.2, hirnPos.z);
  ANIM.hirnLight = blitz; scene.add(blitz);
  const sign = makeSign('HIRNTAUSCHINATOR 3000', 4.2, .85, 56, '#2a2d38', '#7fe3dc');
  sign.position.set(hirnPos.x, 3.9, hirnPos.z + 1.1); scene.add(sign);
  blockCircle(hirnPos.x, hirnPos.z, 3.2);
}

// Emils Käselaib (Catering der besonderen Art)
export const kaesePos = { x:8, z:26 };
{
  const tisch = box(2.6, .9, 2, '#8a6238'); tisch.position.set(kaesePos.x, .45, kaesePos.z); scene.add(tisch);
  const laib = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, .75, 18, 1, false, 0, Math.PI*1.72), toon('#f4d35e'));
  laib.position.set(kaesePos.x, 1.28, kaesePos.z); laib.rotation.y = .6; addOutline(laib); scene.add(laib);
  const ecke = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .6, 10, 1, false, 0, Math.PI*.5), toon('#e8c34a'));
  ecke.position.set(kaesePos.x + 1.4, .3, kaesePos.z + .8); ecke.rotation.y = 2.4; scene.add(ecke);
  const sign = makeSign('EMILS KÄSE-ECKE', 3, .75, 64, '#f4d35e', '#6e5440');
  sign.position.set(kaesePos.x, 2.3, kaesePos.z + 1.1); scene.add(sign);
  blockCircle(kaesePos.x, kaesePos.z, 1.9);
}

// Logges Technik-Rad — hinter der Bühne versteckt (kein Minimap-Punkt: wer es findet, fährt)
export const radPos = { x:-10, z:-54 };
const radProp = buildBike();
radProp.position.set(radPos.x, 0, radPos.z);
radProp.rotation.y = 1.1;
radProp.rotation.z = .14;   // lehnt lässig an der Bühnenrückwand
scene.add(radProp);

// Bäume am Rand
{
  const rng = mulberry(99);
  for (let i=0;i<46;i++){
    const a = rng()*Math.PI*2, r = 78 + rng()*38;
    const x = Math.cos(a)*r, z = Math.sin(a)*r;
    const h = 3 + rng()*3.4;
    const trunk = box(.5,.5+h*.4,.5,'#4a3526'); trunk.position.set(x, h*.2, z);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.6 + rng()*1.2, h, 7), toon(rng()<.5?'#1f4d2e':'#28603a'));
    crown.position.set(x, h*.62 + .4, z);
    crown.userData.phase = rng()*9;
    ANIM.crowns.push(crown);
    ANIM.treeDots.push([x, z]);
    addOutline(crown, 1.04);
    scene.add(trunk, crown);
    blockCircle(x, z, 1.3);
  }
}

export function collides(x, z){
  if (Math.hypot(x, z) > 112) return true;
  for (const o of obstacles) if (Math.hypot(x-o.x, z-o.z) < o.r) return true;
  return false;
}

/* ================================================================
   NPC wanderers
================================================================ */
const ZONES = {
  S: { x1:-55, x2:55, z1:16, z2:60 },
  T: { x1:-54, x2:-16, z1:-50, z2:-14 },
  K: { x1:36, x2:58, z1:16, z2:42 },
};
export const wanderers = []; // {member, model, target, pauseT, gone}
const benched = new Map(); // id -> timestamp wieder verfügbar

function zoneSpot(t){
  const z = ZONES[t], rng = Math.random;
  for (let i=0;i<24;i++){
    const x = z.x1 + rng()*(z.x2-z.x1), zz = z.z1 + rng()*(z.z2-z.z1);
    if (!collides(x, zz) && Math.hypot(x-player.position.x, zz-player.position.z) > 10) return {x, z:zz};
  }
  return { x:(z.x1+z.x2)/2, z:(z.z1+z.z2)/2 };
}
function spawnWanderer(){
  const caught = caughtIds();
  const now = performance.now();
  const avail = RAW.map((_,i)=>i).filter(i =>
    i !== G.playerId && !caught.has(i) && !wanderers.some(w => w.member.id === i) &&
    (!benched.has(i) || benched.get(i) < now));
  if (!avail.length) return;
  const id = avail[Math.floor(Math.random()*avail.length)];
  const type = RAW[id][2];
  // Wild-Level an den eigenen Fortschritt koppeln: echte Produktions-Anzahl, aber max. bestes Member +3
  const best = G.ensemble.length ? Math.max(...G.ensemble.map(m => m.lvl)) : 3;
  const member = makeMember(id, Math.min(RAW[id][3], best + 3));
  const model = buildPerson(member.palette);
  const spot = zoneSpot(type);
  model.position.set(spot.x, 0, spot.z);
  // Level-Schild: rot ▲ = deutlich stärker als dein bestes Member, grün ▼ = deutlich schwächer
  const diff = member.lvl - best;
  const lvlCol = diff >= 2 ? '#ff6b5e' : diff <= -2 ? '#7fe57a' : '#ffd97a';
  const lvlTag = `Lv. ${member.lvl}` + (diff >= 2 ? ' ▲' : diff <= -2 ? ' ▼' : '');
  model.add(makeLabel(member.name, member.role, TYPE_COL[member.type], lvlTag, lvlCol));
  scene.add(model);
  wanderers.push({ member, model, target: zoneSpot(type), pauseT: 0 });
}
export function removeWanderer(w, benchMs){
  disposeModel(w.model);
  scene.remove(w.model);
  wanderers.splice(wanderers.indexOf(w), 1);
  if (benchMs) benched.set(w.member.id, performance.now() + benchMs);
}
let nextSpawnTry = 0;
export function updateWanderers(dt){
  radProp.visible = !G.hasBike;   // beschlagnahmt = weg (hängt dann am Spieler)
  // Spawn-Versuche drosseln statt jede Frame Sets/Arrays zu allozieren
  if (performance.now() > nextSpawnTry){
    nextSpawnTry = performance.now() + 500;
    while (wanderers.length < Math.min(9, TOTAL - G.ensemble.length)) {
      const before = wanderers.length;
      spawnWanderer();
      if (wanderers.length === before) break;
    }
  }
  for (const w of wanderers){
    // Begegnung — auch mit stehenden/winkenden Mitgliedern
    if (G.mode === 'world' && G.encounterCooldown <= 0 &&
        Math.hypot(w.model.position.x - player.position.x, w.model.position.z - player.position.z) < 1.5){
      startBattle(w);
      break;
    }
    if (w.pauseT > 0){
      w.pauseT -= dt;
      animPerson(w.model, false, dt);
      // manche winken dir zu
      if (w.wave) w.model.userData.anim.armR.rotation.z = 2.5 + Math.sin(w.model.userData.anim.t*4)*.35;
      continue;
    }
    w.model.userData.anim.armR.rotation.z = 0;
    const dx = w.target.x - w.model.position.x, dz = w.target.z - w.model.position.z;
    const d = Math.hypot(dx, dz);
    if (d < .4){
      w.pauseT = 1 + Math.random()*2.5;
      w.wave = Math.random() < .4;
      w.target = zoneSpot(w.member.type);
      continue;
    }
    w.model.position.x += dx/d * 1.25 * dt;
    w.model.position.z += dz/d * 1.25 * dt;
    w.model.position.y = Math.abs(Math.sin(w.model.userData.anim.t)) * .05;
    w.model.rotation.y = Math.atan2(dx, dz);
    animPerson(w.model, true, dt);
  }
}

/* ================================================================
   boss (Sebastian) on the forecourt
================================================================ */
export const bossModel = buildPerson(makeBoss().palette, { scale:1.12 });
bossModel.position.set(0, 0, -26);
bossModel.add(makeLabel('Logge', 'Der Saboteur', '#ff5560'));
export const evilGlow = new THREE.PointLight('#ff2233', 16, 8, 1.8);
evilGlow.position.y = 1.5;
bossModel.add(evilGlow);
scene.add(bossModel);

/* minimap */
const mmCtx = $('minimap').getContext('2d');
export function drawMinimap(){
  const c = mmCtx, S = 180, cx = S/2, r = cx - 4;
  const px = u => cx + u/118*r, s = u => u/118*r;
  c.clearRect(0, 0, S, S);
  c.save();
  c.beginPath(); c.arc(cx, cx, r, 0, 7); c.clip();
  c.fillStyle = '#24371f'; c.fillRect(0, 0, S, S);
  // Vorplatz + Bühne
  c.fillStyle = '#5d5345';
  c.beginPath(); c.arc(px(0), px(-24), s(17), 0, 7); c.fill();
  c.fillStyle = '#7a5230'; c.fillRect(px(-13.5), px(-49.5), s(27), s(11));
  c.fillStyle = '#a8232f'; c.fillRect(px(-13), px(-50.5), s(26), 2.5);
  // Stände
  c.fillStyle = '#e8b54a'; c.fillRect(px(22), px(8.5), 6, 5);     // Kaffee
  c.fillStyle = '#0e0f16'; c.fillRect(px(-26), px(12), 5, 5);     // Fotobox
  c.fillStyle = '#6e5440'; c.fillRect(px(48), px(28), 5, 5);      // Fundus
  c.fillStyle = '#f25c54'; c.fillRect(px(35), px(-9), 6, 6);      // Hüpfburg
  c.fillStyle = '#c8a23c'; c.fillRect(px(-44), px(-6), 5, 5);     // Sarkophag
  c.fillStyle = '#3fa04a'; c.fillRect(px(-6), px(40), 5, 5);      // Beatrice
  c.fillStyle = '#8a6d3b'; c.fillRect(px(-50), px(28), 6, 4);     // Ahnengalerie
  c.fillStyle = '#f1e8d8'; c.beginPath(); c.arc(px(-50), px(10), 4, 0, 7); c.fill();  // Eselsmilch-Bad
  c.fillStyle = '#e0bd55'; c.fillRect(px(-38), px(-16), 4, 4);    // Thron
  c.fillStyle = '#7fe3dc'; c.fillRect(px(42), px(10), 5, 5);      // Hirntauschinator
  c.fillStyle = '#f4d35e'; c.fillRect(px(6), px(24), 4, 4);       // Käse-Ecke
  // Bäume
  c.fillStyle = '#152a14';
  for (const [tx, tz] of ANIM.treeDots) c.fillRect(px(tx) - 1.5, px(tz) - 1.5, 3, 3);
  // Mitglieder
  for (const w of wanderers){
    c.fillStyle = TYPE_COL[w.member.type];
    c.beginPath(); c.arc(px(w.model.position.x), px(w.model.position.z), 3, 0, 7); c.fill();
  }
  // Logge: pulsierend rot
  if (!G.bossDown){
    c.fillStyle = '#ff2030';
    c.beginPath(); c.arc(px(bossModel.position.x), px(bossModel.position.z), 3.5 + Math.sin(clock.elapsedTime*4)*1.2, 0, 7); c.fill();
  }
  // Spieler: goldener Pfeil
  c.save();
  c.translate(px(player.position.x), px(player.position.z));
  c.rotate(Math.atan2(Math.sin(player.rotation.y), -Math.cos(player.rotation.y)));
  c.fillStyle = '#ffd97a'; c.strokeStyle = '#16120f'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath();
  c.fill(); c.stroke();
  c.restore();
  c.restore();
}

/* interactions (E) */
export function nearestInteract(){
  const px = player.position.x, pz = player.position.z;
  if (Math.hypot(px-kaffeePos.x, pz-kaffeePos.z) < 4.2) return 'kaffee';
  if (Math.hypot(px-fotoPos.x, pz-fotoPos.z) < 3.4) return 'foto';
  if (Math.hypot(px-sarkPos.x, pz-sarkPos.z) < 3.4) return 'sark';
  if (Math.hypot(px-plantPos.x, pz-plantPos.z) < 3.2) return 'plant';
  if (Math.hypot(px-galeriePos.x, pz-galeriePos.z) < 4.4) return 'galerie';
  if (Math.hypot(px-teichPos.x, pz-teichPos.z) < 5.2) return 'teich';
  if (Math.hypot(px-thronPos.x, pz-thronPos.z) < 3.2) return 'thron';
  if (Math.hypot(px-hirnPos.x, pz-hirnPos.z) < 4.4) return 'hirn';
  if (Math.hypot(px-kaesePos.x, pz-kaesePos.z) < 3.2) return 'kaese';
  if (Math.hypot(px-huepfPos.x, pz-huepfPos.z) < 5.6) return 'huepf';
  if (Math.hypot(px-fundusPos.x, pz-fundusPos.z) < 4.8) return 'fundus';
  if (!G.hasBike && Math.hypot(px-radPos.x, pz-radPos.z) < 3.2) return 'rad';
  if (Math.hypot(px, pz+37) < 3.4) return 'probe';   // Bühnenrand: Generalprobe
  if (Math.hypot(px-bossModel.position.x, pz-bossModel.position.z) < 3.2) return 'boss';
  return null;
}
// Einmal-pro-Spieltag-Aktionen (Session-Gedächtnis, vergleicht mit cur.dayCount)
let bounceDay = -1, probeDay = -1, kaeseDay = -1, krokoDay = -1, thronDay = -1;
let ahnIdx = 0;
const KAESE_SORTEN = ['Bergkäse', 'Backcamembert', 'Obatzter', 'Limburger', 'Räucherkäse', '„Premieren-Brie"'];
export async function tryInteract(){
  const t = nearestInteract();
  if (t === 'kaffee'){
    const hurt = G.ensemble.some(m => m.hp < m.maxHP);
    G.ensemble.forEach(m => { m.hp = m.maxHP; m.buff = {atk:1, def:1}; });
    sfx.heal(); hudUpdate(); save();
    await showDialog('Theatergaudi-Stand', hurt
      ? 'Kaffee und ein Stück Kuchen – das ganze Ensemble ist wieder voll motiviert!'
      : 'Alle sind schon bestens motiviert. Trotzdem ein Stück Kuchen? Natürlich.');
  } else if (t === 'foto'){
    fotoLight.intensity = 260;
    setTimeout(() => fotoLight.intensity = 0, 130);
    sfx.click();
    // nachts gruselt die Box (Original-Text), tagsüber ist sie harmlos
    await showDialog('Fotobox', isNight()
      ? '*KLICK!* &#x1F4F8;\nAuf dem Display flackern alte Ensemblefotos – jedes Gesicht fein säuberlich durchgestrichen.\nNur eines nicht: deins. Noch nicht.'
      : '*KLICK!* &#x1F4F8;\nDas Display zeigt ein frisch geknipstes Bild: du, strahlend vor der Bühne – dahinter winkt das halbe Ensemble.\nBei Tageslicht ist die Box einfach nur eine Fotobox. Wirklich. Ganz bestimmt.');
  } else if (t === 'sark'){
    sfx.click();
    await showDialog('Sarkophag', G.cheeseCarry
      ? '*schnüff* *schnüff* &#x26B0;\nAus dem Sarkophag, plötzlich hellwach: „Ist das… ROMADUR?! DIENER! Her damit! …Wie, der ist für die KROKODILE?"\nKurze Pause. „Oh. Das ist… tatsächlich akzeptabel. Weitergehen."'
      : '*Kratz… kratz…* &#x26B0;\n„Lieferung für Viktor von Falkenstein. Vorsicht: Inhalt über 3000 Jahre alt."\nVon innen klopft es ungeduldig: „Wo bleibt mein Bad in Eselsmilch?! Schweig, Diener, und mach schneller!"');
  } else if (t === 'plant'){
    if (G.beatriceDown){
      await showDialog('Beatrice', 'Beatrice döst satt und friedlich vor sich hin und gurrt fast wie eine Taube. &#x1FAB4;\nSeit eurem Kampf frisst sie nur noch, was Felia & Fiona ihr offiziell servieren. Meistens.');
      return;
    }
    const mutig = await showDialog('Beatrice (Kannibalia Fressaria)',
      'Die fleischfressende Pflanze von Felia & Fiona hat sich an einem Requisitenkoffer verschluckt – und sieht dich jetzt SEHR hungrig an.\nSie versperrt den Weg und faucht. Ja, Pflanzen können fauchen.\nStellst du dich ihr?', { yesNo:true });
    if (mutig){
      sfx.encounter();
      const hz = ANIM.beatrice.position.z;
      await tween(240, k => ANIM.beatrice.position.z = hz + Math.sin(k*Math.PI)*1.2);
      ANIM.beatrice.position.z = hz;
      startBattle(null, makeBeatrice());
    } else {
      await showDialog('Beatrice', 'Sehr vernünftig.\nFelia würde sagen: „Spiel einfach mit – ich bin gleich fertig."\nGenau davor solltest du Angst haben.');
    }
  } else if (t === 'galerie'){
    sfx.click();
    await showDialog('Ahnengalerie', `Eines der Portraits räuspert sich und schaut betont unauffällig geradeaus.\n&#x1F5BC; ${AHNEN_QUOTES[ahnIdx++ % AHNEN_QUOTES.length]}`);
  } else if (t === 'teich'){
    // Käse-Ecken-Quest: Romadur fürs Krokodil dabei?
    if (G.cheeseCarry){
      const wurf = await showDialog('Eselsmilch-Bad',
        'Das Krokodil hebt witternd die Schnauze aus der Milch – es hat den Romadur längst gerochen.\nKäse werfen? (Emil sagte: werfen. NICHT reichen.)', { yesNo:true });
      if (wurf){
        sfx.catchOk();
        krokoLunge = true;
        const kx = ANIM.kroko.position.x, kz = ANIM.kroko.position.z;
        ANIM.kroko.rotation.y = Math.atan2(player.position.x - kx, player.position.z - kz);
        await tween(360, k => ANIM.kroko.position.y = .5 + Math.sin(k*Math.PI)*1.1);
        ANIM.kroko.position.set(kx, .5, kz);
        krokoLunge = false;
        G.cheeseCarry = false; G.krokoFed = true;
        const act = activeFighter();
        const amount = 10 + act.lvl*3;
        const ups = grantXP(act, amount);
        hudUpdate(); save();
        await showDialog('Krokodil', `*HAPP!* …*schmatz* &#x1F40A;&#x1F9C0;\nDas Krokodil verputzt den Romadur in der Luft, dreht eine begeisterte Ehrenrunde und stupst zum Dank deine Hand an.\nDu hast einen Freund fürs Leben. Einen feuchten, käseliebenden Freund.\n+${amount} Applaus-Punkte für ${act.name} – mutiges Tier-Casting!` + (ups ? `\n&#x2B50; ${act.name} steigt auf Lv. ${act.lvl}!` : ''));
      } else {
        await showDialog('Eselsmilch-Bad', 'Du behältst den Romadur. Das Krokodil folgt dem Päckchen mit einem langen, sehr persönlichen Blick.');
      }
      return;
    }
    // gefüttert: das Krokodil ist jetzt ein Freund — tägliche Trainingsrunde statt Schnapp-Falle
    if (G.krokoFed){
      if (krokoDay === cur.dayCount){
        sfx.click();
        await showDialog('Eselsmilch-Bad', 'Das Krokodil döst satt auf dem Rücken und paddelt im Schlaf.\nAus dem Sarkophag: „Meine Babys haben KÄSEATEM. WER war das?!"');
        return;
      }
      const plansch = await showDialog('Eselsmilch-Bad',
        'Das Krokodil schwimmt sofort herbei und legt erwartungsvoll den Kopf auf den Beckenrand.\nKurze Trainingsrunde mit dem neuen Ensemble-Maskottchen? (1× pro Spieltag)', { yesNo:true });
      if (plansch){
        krokoDay = cur.dayCount;
        const act = activeFighter();
        const amount = 8 + act.lvl*2;
        const ups = grantXP(act, amount);
        sfx.heal(); hudUpdate(); save();
        await showDialog('Krokodil', `Das Krokodil führt stolz seine beste Todesrolle vor – ${act.name} übt Timing und Bühnenpräsenz gleich mit. &#x1F40A;\n+${amount} Applaus-Punkte!` + (ups ? `\n&#x2B50; ${act.name} steigt auf Lv. ${act.lvl}!` : ''));
      } else {
        await showDialog('Eselsmilch-Bad', 'Das Krokodil sinkt enttäuscht zurück in die Milch und übt theatralisches Seufzen.\nEs lernt schnell. Zu schnell.');
      }
      return;
    }
    const zeh = await showDialog('Eselsmilch-Bad',
      'Ein Becken voll warmer Eselsmilch – vorbereitet für Prinzessin Isets königliches Bad.\nIn der Milch zieht etwas Grünes gemütlich seine Runden…\nZeh reinhalten?', { yesNo:true });
    if (zeh){
      sfx.encounter();
      krokoLunge = true;
      const kx = ANIM.kroko.position.x, kz = ANIM.kroko.position.z;
      ANIM.kroko.rotation.y = Math.atan2(player.position.x - kx, player.position.z - kz);
      await tween(260, k => ANIM.kroko.position.set(
        kx + (player.position.x - kx)*Math.sin(k*Math.PI)*.5, .5 + Math.sin(k*Math.PI)*.8,
        kz + (player.position.z - kz)*Math.sin(k*Math.PI)*.5));
      ANIM.kroko.position.set(kx, .5, kz);
      krokoLunge = false;
      await showDialog('Krokodil', '*SCHNAPP!* &#x1F40A;\nDas Krokodil verfehlt deinen Zeh um Millimeter und sinkt beleidigt zurück in die Milch.\nAus dem Sarkophag schallt es: „WEHE, ihr füttert meine Babys mit Fußvolk an!"');
    } else {
      await showDialog('Eselsmilch-Bad', 'Gute Entscheidung. Auf dem Schild steht zwar nur „nicht trinken" –\naber „nicht anfassen" hat Iset vermutlich für selbstverständlich gehalten.');
    }
  } else if (t === 'thron'){
    // nachts erscheint Isets Geist und gibt Haltungsunterricht (1× pro Spieltag)
    if (isNight() && thronDay !== cur.dayCount){
      const setz = await showDialog('Isets Thron',
        'Im Mondlicht flimmert die Luft über dem Thron. Eine königliche Stimme:\n„Setz dich, Sterblicher. Ich zeige dir, wie man einen Saal BEHERRSCHT."\nHaltungsunterricht bei einer 3000 Jahre alten Prinzessin? (1× pro Nacht)', { yesNo:true });
      if (setz){
        thronDay = cur.dayCount;
        const act = activeFighter();
        const amount = 10 + act.lvl*3;
        const ups = grantXP(act, amount);
        sfx.lvl(); hudUpdate(); save();
        await showDialog('Isets Geisterstunde', `Iset korrigiert Kinnhöhe, Blick und Sitzhaltung von ${act.name}: „Herabsehen! Würdevoller! BESSER."\n+${amount} Applaus-Punkte!` + (ups ? `\n&#x2B50; ${act.name} steigt auf Lv. ${act.lvl}!` : '') + '\n„Und jetzt RUNTER von meinem Thron."');
      } else {
        await showDialog('Isets Thron', '„WIE BITTE? Man lehnt eine königliche Einladung NICHT ab!"\nDie Luft wird schlagartig kälter. Du gehst lieber ein paar Schritte.');
      }
      return;
    }
    sfx.click();
    await showDialog('Isets Thron', 'Du setzt dich. Einen herrlichen Moment lang siehst du auf alles und jeden herab. &#x1F451;\nDann, eiskalt aus Richtung Sarkophag: „WER sitzt da auf meinem Thron?! DIENER! Die Krokodile haben Hunger!"\nDu stehst sehr, sehr schnell wieder auf.');
  } else if (t === 'hirn'){
    if (G.ensemble.length < 2){
      sfx.click();
      await showDialog('Hirntauschinator 3000', 'Zwei Kammern, eine lila Spule, ein großer Hebel. Ein Zettel: „Funktioniert! – Viktor"\nDarunter, andere Handschrift: „Tut er nicht. – Emil"\nFür einen Tausch bräuchtest du mindestens 2 Ensemble-Mitglieder.');
      return;
    }
    const hebel = await showDialog('Hirntauschinator 3000',
      'Viktors Maschine summt verheißungsvoll. Der Hebel glänzt, als wäre er heute schon poliert worden.\n„Für die Wissenschaft!" steht auf einem Schild. Hebel umlegen?', { yesNo:true });
    if (hebel){
      sfx.lvl();
      const l = ANIM.hirnLight;
      await tween(700, k => l.intensity = 10 + Math.sin(k*Math.PI*6)*60*(1-k) + 80*Math.sin(k*Math.PI));
      l.intensity = 10;
      for (let i = G.ensemble.length - 1; i > 0; i--){
        const j = Math.floor(Math.random()*(i+1));
        [G.ensemble[i], G.ensemble[j]] = [G.ensemble[j], G.ensemble[i]];
      }
      hudUpdate(); save();
      await showDialog('Hirntauschinator 3000', '*BLITZ* *KRACH* *OZONGERUCH* &#x1F9E0;\nDeine Aufstellung wurde komplett durchgewürfelt – wer jetzt vorne steht, weiß nur die Wissenschaft.\nIrgendwo ruft Viktor begeistert: „ES FUNKTIONIERT!"');
    } else {
      await showDialog('Hirntauschinator 3000', 'Du lässt den Hebel in Ruhe.\nDie Maschine summt enttäuscht. Viktor wäre untröstlich – Emil sehr erleichtert.');
    }
  } else if (t === 'kaese'){
    // 1) Käse-Power-Stück (einmalig, bis es im nächsten Kampf verbraucht ist)
    if (!G.cheesePower){
      const stk = await showDialog('Emils Käse-Ecke',
        'Der Laib duftet kräftig herüber. Ein großzügiges Stück würde deinem nächsten Auftritt Präsenz (▲) verleihen.\nAbschneiden?', { yesNo:true });
      if (stk){
        G.cheesePower = true;
        sfx.heal(); save();
        await showDialog('Emils Käse-Ecke', 'Du schneidest dir ein großzügiges Stück vom Käselaib ab. Kräftig. Würzig. Mutmachend. &#x1F9C0;\n&#x2728; KÄSE-POWER: Dein nächster Auftritt startet mit erhöhter Präsenz (▲)!\nIrgendwo seufzt Emil, als hätte er es gespürt.');
        return;
      }
    }
    // 2) Tagesverkostung (1× pro Spieltag): heilt etwas + Applaus-Punkte
    if (kaeseDay !== cur.dayCount){
      const sorte = KAESE_SORTEN[cur.dayCount % KAESE_SORTEN.length];
      const act = activeFighter();
      const ok = await showDialog('Emils Käse-Ecke',
        `Emil taucht hinter der Theke auf, plötzlich ganz Gastgeber: „Tagesverkostung! Heute: ${sorte}."\nEine Probe für ${act.name}? (heilt etwas + Applaus-Punkte, 1× pro Spieltag)`, { yesNo:true });
      if (ok){
        kaeseDay = cur.dayCount;
        act.hp = Math.min(act.maxHP, act.hp + Math.round(act.maxHP*.35));
        const amount = 6 + act.lvl*2;
        const ups = grantXP(act, amount);
        sfx.heal(); hudUpdate(); save();
        await showDialog('Tagesverkostung', `${act.name} kostet den ${sorte} – erst skeptisch, dann mit geschlossenen Augen. &#x1F9C0;\nMotivation steigt, +${amount} Applaus-Punkte!` + (ups ? `\n&#x2B50; ${act.name} steigt auf Lv. ${act.lvl}!` : '') + '\nEmil nickt fachmännisch: „Gute Wahl. Also meine."');
        return;
      }
    }
    // 3) Krokodil-Quest: ein Stück Romadur fürs Eselsmilch-Bad
    if (!G.krokoFed && !G.cheeseCarry){
      const mit = await showDialog('Emils Käse-Ecke',
        'Emil beugt sich verschwörerisch vor: „Du… das Krokodil in der Eselsmilch? Das mag Romadur. SEHR."\nEin gut abgehangenes Stück fürs Krokodil einpacken?', { yesNo:true });
      if (mit){
        G.cheeseCarry = true;
        sfx.catchOk(); save();
        await showDialog('Emils Käse-Ecke', 'Emil wickelt ein Stück Romadur in Bühnenpapier. Es duftet… durchsetzungsstark. &#x1F9C0;\nBring es zum Eselsmilch-Bad – und wirf es. Nicht reichen. WERFEN.');
        return;
      }
    }
    sfx.click();
    await showDialog('Emils Käse-Ecke', G.krokoFed
      ? 'Emil poliert zufrieden die Theke: „Das Krokodil lässt mich neuerdings grüßen.\nWir Käsemenschen halten zusammen."'
      : 'Emil stellt sich schützend vor den Laib: „Der Rest ist für den GRAFEN! Also… fürs Buffet! Also… meiner."');
  } else if (t === 'rad'){
    const mit = await showDialog('Technik-Rad',
      'Hinter der Bühne lehnt ein knallrotes Fahrrad – am Lenker ein Zettel: „NICHT ANFASSEN. – L."\nDas ist eindeutig Logges Fluchtrad. Beschlagnahmen? (Regie-Befugnis!)', { yesNo:true });
    if (mit){
      G.hasBike = true; G.bikeOn = true;
      updateBike();
      sfx.catchOk(); save();
      await showDialog('Technik-Rad', 'Du schwingst dich auf Logges Rad – die Klingel macht ein entrüstetes *PLING*. &#x1F6B2;\nDamit bist du fast doppelt so schnell auf der Wiese unterwegs!\nAuf- und absteigen: Taste F oder der &#x1F6B2;-Knopf oben rechts.');
    } else {
      await showDialog('Technik-Rad', 'Du lässt das Rad stehen. Sehr korrekt. Sehr langsam.');
    }
  } else if (t === 'huepf'){
    if (bounceDay === cur.dayCount){
      sfx.click();
      await showDialog('Hüpfburg', 'Für heute reicht es – das Ensemble ist noch außer Atem vom letzten Sprungtraining.\nMorgen wieder! (Ein Spieltag dauert etwa 5 Minuten.)');
      return;
    }
    const rein = await showDialog('Hüpfburg',
      'Die Hüpfburg wabbelt einladend. Offiziell ist sie „nur für die Theaterkinder".\nAber Sprungtraining ist Bühnentraining – sagt zumindest die Regie.\nReinhüpfen?', { yesNo:true });
    if (rein){
      bounceDay = cur.dayCount;
      const act = activeFighter();
      // Hüpf-Animation: Spieler springt dreimal (Loop pausiert im Dialog-Modus)
      G.mode = 'dialog';
      sfx.lvl();
      await tween(1150, k => player.position.y = Math.abs(Math.sin(k*Math.PI*3))*1.9);
      player.position.y = 0;
      G.mode = 'world';
      const amount = 8 + act.lvl*3;
      const ups = grantXP(act, amount);
      hudUpdate(); save();
      await showDialog('Hüpfburg', `*boing* *boing* *BOING* &#x1F938;\n${act.name} trainiert Sprünge, Timing und den großen Bühnenauftritt: +${amount} Applaus-Punkte!`
        + (ups ? `\n&#x2B50; Und steigt dabei auf Lv. ${act.lvl}!` : ''));
    } else {
      await showDialog('Hüpfburg', 'Verständlich. Die Flecken auf dem Dach sind übrigens KEIN Kunstblut. Sagt Viktor. Lächelnd.');
    }
  } else if (t === 'fundus'){
    const neu = await showDialog('Fundus-Schuppen',
      'Kostüme bis unter die Decke: Musketier-Mäntel, Mumienbinden, ein einzelner Riesen-Käse aus Pappmaché.\nEinmal neu einkleiden? (Neuer Look + frisch gerichtete Garderobe: Deckung ▲ im nächsten Kampf)', { yesNo:true });
    if (neu){
      G.costumeSeed = Math.floor(Math.random()*1e9) + 1;
      G.costumePower = true;
      setPlayerCharacter(G.playerId);
      sfx.catchOk(); save();
      await showDialog('Fundus-Schuppen', 'Vorhang auf für deinen neuen Look! &#x1F9F5;\nDie Garderobe sitzt bühnenfest: Dein nächster Auftritt startet mit erhöhter Deckung (▲).\nUmstyling jederzeit wieder möglich – der Fundus urteilt nicht.');
    } else {
      await showDialog('Fundus-Schuppen', 'Du hängst den Musketier-Mantel zurück.\nAus der hintersten Ecke flüstert es: „Feigling." Es war nur eine Schaufensterpuppe. Vermutlich.');
    }
  } else if (t === 'probe'){
    if (probeDay === cur.dayCount){
      sfx.click();
      await showDialog('Bühne', 'Die Generalprobe für heute ist durch – Drusilla besteht auf Pausenzeiten.\n„Auch Geister haben einen Tarifvertrag."');
      return;
    }
    const schwach = G.ensemble.filter(m => m.hp > 0).sort((a, b) => a.lvl - b.lvl)[0] || G.ensemble[0];
    const ok = await showDialog('Bühne',
      `Die Bretter, die die Welt bedeuten – und sie sind gerade frei.\nEine Generalprobe würde besonders ${schwach.name} (Lv. ${schwach.lvl}) weiterbringen.\nProbe ansetzen?`, { yesNo:true });
    if (ok){
      probeDay = cur.dayCount;
      sfx.lvl();
      const amount = 15 + schwach.lvl*5;
      const ups = grantXP(schwach, amount);
      hudUpdate(); save();
      await showDialog('Generalprobe', `Scheinwerfer an! ${schwach.name} probt die große Szene – erst wackelig, dann immer sicherer.\nAus dem Dunkel des Zuschauerraums: einzelner, langsamer Applaus. (Es ist Jacques. „Hmmm.")\n+${amount} Applaus-Punkte!` + (ups ? `\n&#x2B50; ${schwach.name} steigt auf Lv. ${schwach.lvl}!` : ''));
    } else {
      await showDialog('Bühne', 'Die Bühne bleibt dunkel. Irgendwo klappert enttäuscht ein Scheinwerfer.');
    }
  } else if (t === 'boss'){
    await bossEncounter();
  }
}
async function bossEncounter(){
  if (G.bossDown){
    await showDialog('Logge', 'Es ist vorbei… Ich wollte nur ein einziges Mal im Rampenlicht stehen, statt immer dahinter.\nBring die Premiere auf die Bühne. Ich mache wieder gut, was ich zerstört habe.');
    return;
  }
  if (G.ensemble.length < 6){
    await showDialog('Logge, der Saboteur', `Mit ${G.ensemble.length} Leuten willst du mich aufhalten?\nIch habe die Bühnenpläne verbrannt und die Plakate zerrissen – und das war nur die Ouvertüre.\nHol dir mindestens 6 Mitglieder. Falls sie sich überhaupt trauen.`);
    return;
  }
  const ok = await showDialog('Logge, der Saboteur',
    'Zehn Jahre stand ich im Schatten. Immer nur „der hinter der Website". Nie auf dem Plakat, nie im Applaus.\nHEUTE fällt der letzte Vorhang – keine Premiere, kein Applaus, kein Kolpingtheater. Für niemanden mehr.\nStell dich mir. Oder sieh zu, wie alles endet.',
    { yesNo:true });
  if (ok) startBattle(null, makeBoss());
}
