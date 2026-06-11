/* ================================================================
   main — Einstiegspunkt: Input-Verkabelung, Haupt-Loop, Boot
================================================================ */
import * as THREE from 'three';
import { $, sleep } from './util.js';
import { G, load } from './state.js';
import { renderer, scene, camera, battleScene, battleCam, moonLight, clock, ANIM } from './scene.js';
import { animPerson } from './models.js';
import { collides, updateWanderers, drawMinimap, nearestInteract, tryInteract,
         bossModel, evilGlow, krokoLunge, fotoLight, teichPos } from './world.js';
import { B, dust, fx } from './battle.js';
import * as daynight from './daynight.js';
import { player, touchVec, openEnsemble, closeEnsemble, setPlayerCharacter } from './ui.js';

/* ================================================================
   player input (Tastatur + Kamera-Orbit)
================================================================ */
const keys = {};
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Escape'){
    if (G.mode === 'world') openEnsemble();
    else if (G.mode === 'menu' && !$('ensemble').classList.contains('hidden')) closeEnsemble();
  }
  if (e.key.toLowerCase() === 'e' && G.mode === 'world') tryInteract();
  // Dialoge per Enter/E/Leertaste bestätigen
  if (G.mode === 'dialog' && (e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'e')){
    e.preventDefault();
    $('dialog-ok').click();
  }
  // Moves im Kampf per 1–4
  if (G.mode === 'battle' && !B.busy && '1234'.includes(e.key)){
    const b = $('battle-moves').children[+e.key - 1];
    if (b && !b.disabled) b.click();
  }
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// Kamera-Orbit: 1 Finger/Maus dreht, 2 Finger zoomen (Pinch), Rad zoomt
let camYaw = 0, camPitch = .58, camDist = 14;
let dragging = false, lastX = 0, lastY = 0;
const cnv = renderer.domElement;
const ptrs = new Map();
let pinchDist = 0;
cnv.addEventListener('contextmenu', e => e.preventDefault());
cnv.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (ptrs.size === 1){ dragging = true; lastX = e.clientX; lastY = e.clientY; }
  cnv.setPointerCapture(e.pointerId);
});
cnv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (ptrs.size >= 2){
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist) camDist = Math.min(24, Math.max(7, camDist + (pinchDist - d) * .03));
    pinchDist = d; dragging = false;
    return;
  }
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * .0055;
  camPitch = Math.min(1.25, Math.max(.18, camPitch + (e.clientY - lastY) * .004));
  lastX = e.clientX; lastY = e.clientY;
});
function endPtr(e){
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinchDist = 0;
  if (ptrs.size === 0){ dragging = false; }
  else { const p = [...ptrs.values()][0]; lastX = p.x; lastY = p.y; dragging = true; }
}
cnv.addEventListener('pointerup', endPtr);
cnv.addEventListener('pointercancel', endPtr);
cnv.addEventListener('wheel', e => { camDist = Math.min(24, Math.max(7, camDist + e.deltaY * .012)); }, { passive:true });

function moveDir(){
  let x = 0, z = 0;
  if (keys['w']||keys['arrowup']) z -= 1;
  if (keys['s']||keys['arrowdown']) z += 1;
  if (keys['a']||keys['arrowleft']) x -= 1;
  if (keys['d']||keys['arrowright']) x += 1;
  if (touchVec.active){ x += touchVec.x; z += touchVec.z; }
  const l = Math.hypot(x,z);
  if (!l) return { x:0, z:0, moving:false, mag:0 };
  return { x:x/l, z:z/l, moving:true, mag: Math.min(1, l) };
}

/* ================================================================
   main loop
================================================================ */
const CAM_V = new THREE.Vector3();
let nextFlash = 9;
let curNi = null;   // aktuell interagierbares Objekt — steuert den Touch-Action-Button
function loop(){
  requestAnimationFrame(loop);
  const dt = Math.min(.05, clock.getDelta());
  const t = clock.elapsedTime;

  // Touch-Bedienelemente nur in der Welt zeigen (Kampf/Dialog haben eigene Buttons)
  if (document.body.classList.contains('touch')){
    const showMove = G.mode === 'world';
    $('joystick').classList.toggle('hidden', !showMove);
    // Action-Button nur zeigen, wenn es auch etwas zu tun gibt (sonst verwirrt er nur)
    $('touch-action').classList.toggle('hidden', !showMove || !curNi);
    $('touch-menu').classList.toggle('hidden', !(G.mode === 'world' || G.mode === 'menu'));
    if (!showMove && touchVec.active){ touchVec.active = false; touchVec.x = touchVec.z = 0; $('joynub').style.transform = 'translate(0,0)'; }
  }

  if (G.mode === 'battle' || (B.active)){
    // Idle-Bob im Kampf
    if (B.myModel){ if (!B.busy) B.myModel.position.y = 1.5 + Math.sin(t*2.2)*.04; animPerson(B.myModel, false, dt); }
    if (B.enemyModel){ if (!B.busy) B.enemyModel.position.y = 1.5 + Math.sin(t*2.2 + 2)*.04; animPerson(B.enemyModel, false, dt); }
    const dp = dust.geometry.attributes.position;
    for (let i=0;i<dp.count;i++){
      dp.setY(i, dp.getY(i) - dt*.25);
      if (dp.getY(i) < 1.5) dp.setY(i, 8.4);
    }
    dp.needsUpdate = true;
    // Kamera schwebt leicht, Vorhang wogt
    fx.bShake = Math.max(0, fx.bShake - dt*1.6);
    battleCam.position.x = Math.sin(t*.25)*.9 + (Math.random()-.5)*fx.bShake;
    battleCam.position.y = 4.6 + Math.sin(t*.4)*.25 + (Math.random()-.5)*fx.bShake;
    battleCam.lookAt(0, 1.6, 0);
    for (const s of ANIM.bCurtains) s.rotation.y = Math.sin(t*1.2 + s.userData.i*.7)*.06;
    renderer.render(battleScene, battleCam);
    return;
  }

  if (G.mode === 'world'){
    daynight.update(dt);   // Welt-Uhr tickt nur hier — Kämpfe/Dialoge frieren die Tageszeit ein
    G.encounterCooldown = Math.max(0, G.encounterCooldown - dt);
    const d = moveDir();
    if (d.moving){
      // Eingabe relativ zur Kamera drehen
      const cy = Math.cos(camYaw), sy = Math.sin(camYaw);
      const wx = d.x*cy + d.z*sy, wz = -d.x*sy + d.z*cy;
      const speed = 6.5 * dt * (d.mag || 1);
      const nx = player.position.x + wx * speed;
      const nz = player.position.z + wz * speed;
      if (!collides(nx, player.position.z)) player.position.x = nx;
      if (!collides(player.position.x, nz)) player.position.z = nz;
      player.rotation.y = Math.atan2(wx, wz);
    }
    animPerson(player, d.moving, dt);
    player.position.y = d.moving ? Math.abs(Math.sin(player.userData.anim.t)) * .07 : 0;
    updateWanderers(dt);
    // Szenerie lebt: Vorhang wogt, Bäume wiegen, Spots schwenken, Hüpfburg wippt, Sterne funkeln
    for (const s of ANIM.curtains) s.rotation.y = Math.sin(t*1.1 + s.userData.i*.7)*.05;
    for (const c of ANIM.crowns) c.rotation.z = Math.sin(t*.8 + c.userData.phase)*.045;
    ANIM.cones.forEach((c,i) => c.rotation.z = c.userData.base + Math.sin(t*.5 + i*Math.PI)*.2);
    ANIM.spotTargets.forEach((tg,i) => tg.position.x = Math.sin(t*.5 + i*Math.PI)*5.5);
    ANIM.dome.scale.y = .55 + Math.sin(t*2.6)*.05;
    ANIM.beatrice.rotation.z = Math.sin(t*(G.beatriceDown ? .6 : 1.3))*.12;   // Beatrice wiegt sich (lauernd bzw. friedlich)
    // Krokodil zieht gemütlich Runden in der Eselsmilch
    if (!krokoLunge){
      ANIM.kroko.position.x = teichPos.x + Math.cos(t*.45)*1.7;
      ANIM.kroko.position.z = teichPos.z + Math.sin(t*.45)*1.7;
      ANIM.kroko.position.y = .5 + Math.sin(t*1.8)*.06;
      ANIM.kroko.rotation.y = -t*.45;
    }
    ANIM.hirnLight.intensity = 7 + Math.sin(t*5)*4 + (Math.sin(t*.9) > .97 ? 26 : 0);
    ANIM.ahnenAugen.forEach((e, i) => e.scale.y = Math.sin(t*2.2 + i*2) > .96 ? .1 : 1);  // die Ahnen blinzeln
    ANIM.stars.size = 1.1 + Math.sin(t*1.8)*.3;
    // Fotobox-Blitz-Gag: nur nachts — tagsüber bleibt die Box still
    if (!daynight.isNight()){
      nextFlash = Math.max(nextFlash, t + 5);
    } else if (t > nextFlash){
      nextFlash = t + 5 + Math.random()*7;
      fotoLight.intensity = 220;
      setTimeout(() => fotoLight.intensity = 0, 120);
    }
    drawMinimap();
    // Boss tigert vorm Vorhang, Aura flackert bedrohlich
    bossModel.position.x = Math.sin(t*.4)*4;
    bossModel.rotation.y = Math.cos(t*.4) > 0 ? Math.PI/2 : -Math.PI/2;
    animPerson(bossModel, true, dt*.5);
    // tagsüber pulsiert Logges Aura nur halb so stark (nachts Faktor 1 — wie immer)
    evilGlow.intensity = G.bossDown ? 0 : (13 + Math.sin(t*7)*4 + Math.sin(t*23)*2) * (1 - .5*daynight.cur.day);
    // Interact-Hinweis
    const ni = nearestInteract();
    curNi = ni;
    const hint = ni === 'kaffee' ? 'E – Kaffee & Kuchen (heilt alle)'
               : ni === 'foto' ? 'E – Fotobox &#x1F4F8;'
               : ni === 'sark' ? 'E – Sarkophag (es klopft von innen)'
               : ni === 'plant' ? (G.beatriceDown ? 'E – Beatrice besuchen &#x1FAB4;' : 'E – Beatrice herausfordern &#x1FAB4; (Miniboss!)')
               : ni === 'galerie' ? 'E – Ahnengalerie belauschen &#x1F5BC;'
               : ni === 'teich' ? 'E – Eselsmilch-Bad (es schwimmt was drin)'
               : ni === 'thron' ? 'E – Auf Isets Thron setzen &#x1F451;'
               : ni === 'hirn' ? 'E – Hirntauschinator 3000 &#x1F9E0;'
               : ni === 'kaese' ? 'E – Emils Käselaib &#x1F9C0;'
               : ni === 'huepf' ? 'E – Hüpfburg: Sprungtraining &#x1F938;'
               : ni === 'fundus' ? 'E – Fundus: neu einkleiden &#x1F9F5;'
               : ni === 'probe' ? 'E – Generalprobe auf der Bühne &#x1F3AD;'
               : ni === 'boss' ? 'E – Logge entgegentreten' : '';
    if (hint !== fx.lastInteractHint){
      fx.lastInteractHint = hint;
      $('interact').innerHTML = hint;
      $('interact').classList.toggle('hidden', !hint);
      if (document.body.classList.contains('touch')){
        $('touch-action').textContent = ni === 'kaffee' ? '☕' : ni === 'foto' ? '📷' : ni === 'sark' ? '⚰️' : ni === 'plant' ? '🪴' : ni === 'galerie' ? '🖼️' : ni === 'teich' ? '🐊' : ni === 'thron' ? '👑' : ni === 'hirn' ? '🧠' : ni === 'kaese' ? '🧀' : ni === 'huepf' ? '🤸' : ni === 'fundus' ? '🧵' : ni === 'probe' ? '🎭' : ni === 'boss' ? '⚔️' : '👀';
        $('touch-action').classList.toggle('ready', !!ni);
      }
    }
  } else {
    animPerson(player, false, dt);
  }

  // Kamera folgt (Orbit) — Scratch-Vector statt Allokation pro Frame
  const hDist = Math.cos(camPitch) * camDist;
  CAM_V.set(
    player.position.x + Math.sin(camYaw) * hDist,
    Math.sin(camPitch) * camDist,
    player.position.z + Math.cos(camYaw) * hDist);
  camera.position.lerp(CAM_V, 1 - Math.pow(.0004, dt));
  camera.lookAt(player.position.x, 1.4, player.position.z);
  // Schattenkamera dem Spieler hinterherziehen (kleines, scharfes Frustum) —
  // der Offset kommt aus dem Tag-Nacht-Zyklus (Mond/Sonne wandern auf ihrem Bogen)
  moonLight.position.set(player.position.x + daynight.lightOffset.x, daynight.lightOffset.y, player.position.z + daynight.lightOffset.z);
  moonLight.target.position.set(player.position.x, 0, player.position.z);

  renderer.render(scene, camera);
}

/* ================================================================
   boot
================================================================ */
(async function boot(){
  try { await Promise.race([document.fonts.ready, sleep(1800)]); } catch(e){}
  if (load()) $('btn-continue').classList.remove('hidden');
  setPlayerCharacter(G.playerId);
  loop();
})();
