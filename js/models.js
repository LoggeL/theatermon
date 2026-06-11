/* ================================================================
   models — Figuren, Labels, Schilder und das Kampf-Pflanzenmodell
================================================================ */
import * as THREE from 'three';
import { toon, outlineMat, boxGeo, sphGeo, cylGeo, coneGeo, basicMat } from './scene.js';

const LEG_GEO = new THREE.BoxGeometry(.22,.5,.22).translate(0,-.25,0);
const ARM_GEO = new THREE.BoxGeometry(.15,.5,.15).translate(0,-.22,0);
export function disposeModel(model){
  // Geometrien/Toon-Materialien sind geteilt — nur die individuellen Label-Sprites freigeben
  model.traverse(o => {
    if (o.isSprite){ o.material.map?.dispose(); o.material.dispose(); }
  });
}

/* ---------- person builder ---------- */
export function box(w,h,d,color,castShadow=true){
  const m = new THREE.Mesh(boxGeo(w,h,d), toon(color));
  m.castShadow = castShadow;
  return m;
}
export function addOutline(mesh, s=1.06){
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.scale.setScalar(s);
  mesh.add(o);
}
export function buildPerson(p, opts={}){
  const g = new THREE.Group();
  const legL = new THREE.Mesh(LEG_GEO, toon(p.pants)); legL.position.set(-.14,.5,0);
  const legR = new THREE.Mesh(LEG_GEO, toon(p.pants)); legR.position.set(.14,.5,0);
  const torso = box(.56,.62,.32, p.shirt); torso.position.y = .81;
  const armL = new THREE.Mesh(ARM_GEO, toon(p.shirt)); armL.position.set(-.37,1.05,0);
  const armR = new THREE.Mesh(ARM_GEO, toon(p.shirt)); armR.position.set(.37,1.05,0);
  const head = new THREE.Mesh(sphGeo(.24,12,10), toon(p.skin)); head.position.y = 1.34;
  const hair = new THREE.Mesh(sphGeo(.265,12,10), toon(p.hair));
  hair.position.y = 1.42; hair.scale.y = .72;
  [legL,legR,torso,armL,armR,head].forEach(m => { m.castShadow = true; addOutline(m); });
  addOutline(hair);
  g.add(legL, legR, torso, armL, armR, head, hair);
  if (p.longHair){
    const back = box(.34,.42,.14, p.hair); back.position.set(0,1.18,-.18); addOutline(back); g.add(back);
  }
  if (p.cap){
    hair.visible = false;
    const cap = new THREE.Mesh(cylGeo(.26,.27,.14,12), toon('#3a3f4a'));
    cap.position.y = 1.52; addOutline(cap); g.add(cap);
    const brim = box(.3,.04,.18,'#3a3f4a'); brim.position.set(0,1.47,.26); g.add(brim);
  }
  if (p.beret){
    hair.scale.y = .6;
    const beret = new THREE.Mesh(cylGeo(.3,.24,.12,12), toon('#a8232f'));
    beret.position.set(.05,1.56,0); beret.rotation.z = -.18; addOutline(beret); g.add(beret);
    const mega = new THREE.Mesh(coneGeo(.14,.34,10), toon('#e8e3d5'));
    mega.position.set(.5,.78,.12); mega.rotation.z = Math.PI/2.3; addOutline(mega); g.add(mega);
  }
  if (p.evil){
    // Kapuze tief im Gesicht, nur zwei rot glühende Augen
    const hood = new THREE.Mesh(sphGeo(.3,12,10), toon(p.shirt));
    hood.position.y = 1.36; hood.scale.set(1,.98,1); addOutline(hood); g.add(hood);
    for (const ex of [-.09,.09]){
      const eye = new THREE.Mesh(sphGeo(.04,8,6), basicMat('#ff2030'));
      eye.position.set(ex, 1.36, .32); g.add(eye);
    }
  }
  g.userData.anim = { legL, legR, armL, armR, t: Math.random()*9 };
  if (opts.scale) g.scale.setScalar(opts.scale);
  return g;
}
export function animPerson(g, moving, dt){
  const a = g.userData.anim; if (!a) return;
  a.t += dt * (moving ? 11 : 2.2);
  const k = moving ? .55 : .06;
  a.legL.rotation.x = Math.sin(a.t)*k;
  a.legR.rotation.x = -Math.sin(a.t)*k;
  a.armL.rotation.x = -Math.sin(a.t)*k*.8;
  a.armR.rotation.x = Math.sin(a.t)*k*.8;
}

/* ---------- name label sprites ---------- */
export function makeLabel(name, role, typeCol, lvlText, lvlCol){
  // mit lvlText: dritte, farbige Zeile oben (Level-Schild der Wanderer)
  const tall = !!lvlText;
  const cv = document.createElement('canvas'); cv.width = 360; cv.height = tall ? 150 : 110;
  const c = cv.getContext('2d');
  c.textAlign = 'center';
  c.lineWidth = 7; c.strokeStyle = 'rgba(15,13,25,.9)';
  let y = 44;
  if (tall){
    c.font = "31px Schoolbell, cursive";
    c.strokeText(lvlText, 180, 34); c.fillStyle = lvlCol; c.fillText(lvlText, 180, 34);
    y = 84;
  }
  c.font = "34px Schoolbell, cursive";
  c.strokeText(name, 180, y); c.fillStyle = '#f7f1e3'; c.fillText(name, 180, y);
  c.font = "25px Caveat, cursive";
  c.strokeText(role, 180, y+38); c.fillStyle = typeCol; c.fillText(role, 180, y+38);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
  sp.scale.set(3.4, tall ? 1.42 : 1.04, 1);
  sp.position.y = tall ? 2.35 : 2.15;
  return sp;
}

// sign helper
export function makeSign(text, w, h, fontPx, bg='#241d18', fg='#f1d9a0'){
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512*h/w);
  const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0,0,cv.width,cv.height);
  c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(8,8,cv.width-16,cv.height-16);
  c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  // Schrift automatisch verkleinern, bis der Text mit Rand ins Schild passt (clippt sonst)
  const maxW = cv.width - 60;
  let size = fontPx;
  c.font = size + "px 'Special Elite', monospace";
  while (size > 10 && c.measureText(text).width > maxW){
    size -= 2;
    c.font = size + "px 'Special Elite', monospace";
  }
  c.fillText(text, cv.width/2, cv.height/2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

export function buildBattlePlant(){
  // Beatrice als Kampf-Modell — Maul Richtung Spieler (-x)
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.68, .5, .8, 12), toon('#8a4a2b'));
  pot.position.y = .4; addOutline(pot); g.add(pot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.13, .24, 1.5, 8), toon('#2f7a33'));
  stem.position.y = 1.35; stem.rotation.z = .14; g.add(stem);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.72, 14, 12), toon('#3fa04a'));
  head.position.set(-.25, 2.2, 0); head.scale.set(1.15, .85, 1);
  addOutline(head); g.add(head);
  const maw = new THREE.Mesh(new THREE.SphereGeometry(.38, 10, 8), toon('#a8232f'));
  maw.position.set(-.85, 2.1, 0); g.add(maw);
  for (const s of [-1, 1]){
    const zahn = new THREE.Mesh(new THREE.ConeGeometry(.09, .28, 5), toon('#f1e8d8'));
    zahn.position.set(-.8, 2.1 + s*.28, s*.12); zahn.rotation.z = s > 0 ? Math.PI : 0; g.add(zahn);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(.34, 1.1, 6), toon('#2f7a33'));
    leaf.position.set(s*.65, 1, 0); leaf.rotation.z = -s*1.1; g.add(leaf);
  }
  g.scale.setScalar(1.5);
  return g;
}
