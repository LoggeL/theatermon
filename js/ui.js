/* ================================================================
   UI — Dialoge, HUD, Ensemble-Menü, Title/Charsel/Starter,
   Credits, Touch-Steuerung, Spieler-Setup
================================================================ */
import * as THREE from 'three';
import { $, sleep } from './util.js';
import { RAW, SIG, SHIRT, MOVES, TYPE_NAME, TYPE_BLURB } from './data.js';
import { G, save, load, maxCatch, activeFighter, makeMember, TIME_START } from './state.js';
import { scene } from './scene.js';
import { buildPerson, makeLabel, disposeModel } from './models.js';
import { sfx, audioInit } from './audio.js';
import { clearSave } from './storage.js';
import { hpPct } from './battle.js';
import { tryInteract } from './world.js';

/* ================================================================
   player
================================================================ */
// Nur dieses Modul weist `player` neu zu (setPlayerCharacter) —
// alle anderen Module lesen die Live-Binding bzw. mutieren nur Properties.
export let player = null;
export function playerName(){ return G.playerId === -2 ? 'Sebastian' : RAW[G.playerId][0]; }
export function playerRole(){ return G.playerId === -2 ? 'Regie' : RAW[G.playerId][1]; }
export function setPlayerCharacter(id){
  G.playerId = id;
  const pal = id === -2
    ? { skin:'#f1c9a5', hair:'#3a3a3a', shirt:'#222222', pants:'#1c1c28', beret:true }
    : makeMember(id, 1).palette;
  const pos = player ? player.position.clone() : new THREE.Vector3(0, 0, 18);
  const rot = player ? player.rotation.y : 0;
  if (player){ disposeModel(player); scene.remove(player); }
  player = buildPerson(pal);
  player.position.copy(pos);
  player.rotation.y = rot;
  player.add(makeLabel(playerName(), playerRole() + ' · Casting', '#ffd97a'));
  scene.add(player);
}

/* ---------- Touch-Steuerung (Handy): Joystick + Aktions-/Menü-Button ---------- */
export const touchVec = { x:0, z:0, active:false };   // virtueller Joystick (Handy)
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch){
  document.body.classList.add('touch');
  const joy = $('joystick'), nub = $('joynub');
  let joyId = null;
  function resetJoy(){ joyId = null; touchVec.active = false; touchVec.x = touchVec.z = 0; nub.style.transform = 'translate(0,0)'; }
  function updateJoy(e){
    const r = joy.getBoundingClientRect(), max = r.width / 2;
    let dx = e.clientX - (r.left + max), dy = e.clientY - (r.top + max);
    const dist = Math.hypot(dx, dy);
    if (dist > max){ dx *= max / dist; dy *= max / dist; }
    nub.style.transform = `translate(${dx}px,${dy}px)`;
    touchVec.x = dx / max; touchVec.z = dy / max;   // wie WASD: x=rechts, z=vor/zurück (Kamera rotiert es im Loop)
    touchVec.active = dist > max * .18;
  }
  joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); updateJoy(e); e.preventDefault(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) updateJoy(e); });
  joy.addEventListener('pointerup', e => { if (e.pointerId === joyId) resetJoy(); });
  joy.addEventListener('pointercancel', e => { if (e.pointerId === joyId) resetJoy(); });
  $('touch-action').addEventListener('click', () => { if (G.mode === 'world') tryInteract(); });
  $('touch-menu').addEventListener('click', () => {
    if (G.mode === 'world') openEnsemble();
    else if (G.mode === 'menu' && !$('ensemble').classList.contains('hidden')) closeEnsemble();
  });
}

/* ================================================================
   UI helpers
================================================================ */
export function showDialog(speaker, text, { yesNo=false } = {}){
  return new Promise(res => {
    const prevMode = G.mode;
    G.mode = 'dialog';
    $('dialog-speaker').textContent = speaker;
    $('dialog-text').textContent = text;
    $('dialog').classList.remove('hidden');
    $('dialog-no').classList.toggle('hidden', !yesNo);
    $('dialog-ok').textContent = yesNo ? 'Na klar!' : 'Weiter';
    const done = ok => {
      $('dialog').classList.add('hidden');
      $('dialog-ok').onclick = $('dialog-no').onclick = null;
      G.mode = prevMode === 'dialog' ? 'world' : prevMode;
      sfx.click(); res(ok);
    };
    $('dialog-ok').onclick = () => done(true);
    $('dialog-no').onclick = () => done(false);
  });
}
export async function wipe(){
  $('wipe').classList.add('on');
  await sleep(580);
}
export function unwipe(){ $('wipe').classList.remove('on'); }

export function hudUpdate(){
  $('hud-count').textContent = G.ensemble.length;
  $('hud-total').textContent = maxCatch();
  const act = activeFighter();
  $('hud-fighter').innerHTML = G.ensemble.slice(0, 8).map(m =>
    `<div>${m === act ? '&#x2B50;' : '&#x1F3AD;'} ${m.name} <span class="chip ${m.type}">${TYPE_NAME[m.type]}</span> Lv. ${m.lvl} · ${m.hp}/${m.maxHP}</div>`
  ).join('') + (G.ensemble.length > 8 ? `<div>… +${G.ensemble.length - 8} weitere (Esc)</div>` : '');
}

/* ================================================================
   ensemble menu
================================================================ */
export function openEnsemble(){
  G.mode = 'menu';
  const grid = $('ens-grid');
  grid.innerHTML = '';
  $('ens-sub').textContent = G.ensemble.length
    ? `${G.ensemble.length} von ${maxCatch()} gecastet · Klick = nach vorn holen (spielt zuerst)`
    : 'Noch niemand gecastet – lauf über die Wiese!';
  const act = activeFighter();
  for (const m of G.ensemble){
    const card = document.createElement('div');
    card.className = 'member-card paper' + (m === act ? ' active-f' : '');
    card.innerHTML = `
      <div class="nm">${m.name} <span class="chip ${m.type}">${TYPE_NAME[m.type]}</span></div>
      <div class="rl">${m.role}</div>
      <div class="st">Lv. ${m.lvl} (${m.lvl} Produktionen) · &#x2764; ${m.hp}/${m.maxHP} · &#x2694; ${m.atk}</div>
      <div class="st">&#x2728; ${MOVES[m.moves[0]].n}</div>
      <div class="hpbar" style="margin-top:5px"><i style="width:${hpPct(m)}%;background:${hpPct(m)>50?'#4caf6e':hpPct(m)>22?'#e8b54a':'#d9483b'}"></i></div>`;
    card.onclick = () => {
      G.ensemble.splice(G.ensemble.indexOf(m), 1);
      G.ensemble.unshift(m);
      sfx.click(); save(); openEnsemble();
    };
    grid.appendChild(card);
  }
  $('ensemble').classList.remove('hidden');
}
export function closeEnsemble(){
  $('ensemble').classList.add('hidden');
  G.mode = 'world';
  hudUpdate();
}
$('ens-close').onclick = closeEnsemble;
$('ens-reset').onclick = () => {
  if (confirm('Spielstand wirklich löschen?')){
    clearSave();
    location.reload();
  }
};

/* ================================================================
   credits
================================================================ */
export async function showCredits(){
  sfx.fanfare();
  const sc = $('credits-scroll');
  const groups = { S:[], T:[], K:[] };
  RAW.forEach(([n, r, t], i) => groups[t].push(
    `<div class="nm">${n} <span>· ${r}${i === G.playerId ? ' · das bist du &#x2764;' : ''}</span></div>`));
  sc.innerHTML = `
    <h1>CREEPSHOW</h1>
    <h2>Kolpingtheater Ramsen · CREEPSHOW 2026 · Die Premiere ist gerettet!</h2>
    <div class="grp">— REGIE —</div>
    <div class="nm">Sebastian <span>· Butler Wilson${G.playerId === -2 ? ' · das bist du &#x2764;' : ''}</span></div>
    <div class="grp">— SCHAUSPIEL —</div>${groups.S.join('')}
    <div class="grp">— TECHNIK —</div>${groups.T.join('')}
    <div class="grp">— KOSTÜM —</div>${groups.K.join('')}
    <div class="grp">— WEBSITE —</div>
    <div class="nm">Logge <span>· aus dem Schatten zurück ins Team</span></div>
    <div class="grp">&#x1F39F;</div>
    <div class="nm"><span>Theatergaudi am 4. Juli · kolpingtheater-ramsen.de</span></div>`;
  $('credits').classList.remove('hidden');
  G.mode = 'menu';
  await new Promise(res => $('credits-close').onclick = res);
  $('credits').classList.add('hidden');
  G.mode = 'world';
}

/* ================================================================
   title flow
================================================================ */
function buildCharSelect(){
  const grid = $('charsel-grid');
  grid.innerHTML = '';
  const choices = [[-2, 'Sebastian', 'Butler Wilson · Regie', 'R'], ...RAW.map(([n, r, t], i) => [i, n, r, t])];
  for (const [id, n, r, t] of choices){
    const card = document.createElement('div');
    card.className = 'member-card paper';
    card.innerHTML = `
      <div class="nm">${n} <span class="chip ${t}">${TYPE_NAME[t]}</span></div>
      <div class="rl">${r}</div>`;
    card.onclick = () => {
      sfx.click();
      setPlayerCharacter(id);
      $('charsel').classList.add('hidden');
      buildStarterCards();
      $('starter').classList.remove('hidden');
    };
    grid.appendChild(card);
  }
}
function buildStarterCards(){
  const wrap = $('starter-cards');
  wrap.innerHTML = '';
  // 3 zufällige Starter, möglichst verschiedene Typen, nie der eigene Charakter
  const shuffled = RAW.map((_, i) => i).filter(i => i !== G.playerId).sort(() => Math.random() - .5);
  const picks = [];
  for (const i of shuffled){
    if (picks.length === 3) break;
    if (!picks.some(p => RAW[p][2] === RAW[i][2])) picks.push(i);
  }
  for (const i of shuffled){ if (picks.length < 3 && !picks.includes(i)) picks.push(i); }
  for (const idx of picks){
    const [n, role, type] = RAW[idx];
    const div = document.createElement('div');
    div.className = 'starter-card paper';
    div.innerHTML = `
      <div class="swatch" style="background:${SHIRT[type][0]}"></div>
      <h3>${n}</h3>
      <div class="role">${role} · startet auf Lv. 3</div>
      <span class="chip ${type}">${TYPE_NAME[type]}</span>
      <p>&#x2728; ${SIG[idx].n}<br>${TYPE_BLURB[type]}</p>`;
    div.onclick = async () => {
      sfx.catchOk();
      G.ensemble = []; G.bossDown = false; G.beatriceDown = false; G.cheesePower = false;   // neuer Run beginnt erst jetzt wirklich
      G.timeOfDay = TIME_START;   // neue Spiele starten am frühen Abend (Theater!)
      const m = makeMember(idx, 3);          // alle Starter beginnen bei 3 Prod. — faire Ausgangslage
      G.ensemble.push(m);
      $('starter').classList.add('hidden');
      await enterWorld();
      await showDialog(`${playerName()} (du)`,
        `CREEPSHOW steht kurz vor der Premiere: Die schaurige Familie von Falkenstein lädt zu Graf Thaddäus' 110. Geburtstag.\n` +
        `Doch Logge ist der Dunkelheit verfallen: zerrissene Plakate, gestohlene Bühnenpläne – er schwört, dass der letzte Vorhang fällt.\n` +
        `${m.name} macht den Anfang. Lauf über die Wiese und überzeuge die anderen (einfach anlaufen). ` +
        `Ab 6 Mitgliedern stellst du Logge vor der Bühne.\n` +
        `Kaffee & Kuchen heilen. Meide die Fotobox nach Einbruch der Nacht – und steck KEINE Hand in die fleischfressende Pflanze.`);
    };
    wrap.appendChild(div);
  }
}
async function enterWorld(){
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hint').classList.remove('hidden');
  $('mute').classList.remove('hidden');
  $('minimap').classList.remove('hidden');
  G.mode = 'world';
  hudUpdate();
  save();
}
$('btn-new').onclick = () => {
  audioInit(); sfx.click();
  // Save wird erst beim ersten save() nach der Starterwahl überschrieben
  $('title').classList.add('hidden');
  buildCharSelect();
  $('charsel').classList.remove('hidden');
};
$('charsel-back').onclick = () => {
  sfx.click();
  $('charsel').classList.add('hidden');
  $('title').classList.remove('hidden');
};
$('starter-back').onclick = () => {
  sfx.click();
  $('starter').classList.add('hidden');
  $('charsel').classList.remove('hidden');
};
$('btn-continue').onclick = async () => {
  audioInit(); sfx.click();
  load();   // Stand neu laden, falls zwischendurch in "Neues Spiel" geschnuppert wurde
  setPlayerCharacter(G.playerId);
  await enterWorld();
};
