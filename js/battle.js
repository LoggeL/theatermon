/* ================================================================
   battle scene (separate) — Kampf-Deko, Kampf-Logik, Effekte
================================================================ */
import * as THREE from 'three';
import { $, sleep, tween, pick, mulberry } from './util.js';
import { MOVES, TYPE_NAME, TYPE_COL, typeEff, roleLines } from './data.js';
import { G, save, xpNeed, levelUp, activeFighter, maxCatch } from './state.js';
import { battleScene, battleCam, toon, outlineMat, cachedGeo, boxGeo, sphGeo, basicMat, ANIM } from './scene.js';
import { box, buildPerson, buildBattlePlant } from './models.js';
import { sfx, beep } from './audio.js';
import { readFlag, writeFlag } from './storage.js';
import { removeWanderer, kaffeePos } from './world.js';
import { showDialog, hudUpdate, showCredits, wipe, unwipe, player } from './ui.js';

// Modulübergreifend BESCHRIEBENER Zustand als Objekt-Properties:
// ES-Module-Bindings sind beim Importeur read-only, deshalb kein `export let`.
// bShake wird hier (doMove) gesetzt und im Loop (main.js) abgebaut;
// lastInteractHint wird im Loop gepflegt und von endBattle() zurückgesetzt.
export const fx = { bShake: 0, lastInteractHint: '' };

export let dust;
{
  const plat = box(17, 1.5, 8.5, '#7a5230'); plat.position.y = .75; plat.receiveShadow = true;
  battleScene.add(plat);
  for (let i=0;i<14;i++){
    const strip = box(1.45, 6.4, .4, i%2 ? '#8e1f2f' : '#6f1825', false);
    strip.position.set(-9.4 + i*1.45, 4.2, -4.4);
    strip.userData.i = i;
    ANIM.bCurtains.push(strip);
    battleScene.add(strip);
  }
  battleScene.add(new THREE.HemisphereLight('#665a8c', '#241d18', .9));
  for (const sx of [-3.4, 3.4]){
    const spot = new THREE.SpotLight('#ffd9a0', 160, 30, .42, .55, 1.3);
    spot.position.set(sx, 9.5, 3);
    spot.target.position.set(sx, 1.5, 0);
    spot.castShadow = sx < 0;   // ein Schattenwerfer reicht
    battleScene.add(spot, spot.target);
    const ring = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24),
      new THREE.MeshBasicMaterial({ color:'#ffdfa8', transparent:true, opacity:.3, blending:THREE.AdditiveBlending, depthWrite:false }));
    ring.rotation.x = -Math.PI/2; ring.position.set(sx, 1.52, 0);
    battleScene.add(ring);
  }
  // Staub im Scheinwerferlicht
  const n = 90, p = new Float32Array(n*3), rng = mulberry(5);
  for (let i=0;i<n;i++){ p[i*3] = (rng()-.5)*14; p[i*3+1] = 1.5 + rng()*7; p[i*3+2] = (rng()-.5)*6; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p,3));
  dust = new THREE.Points(g, new THREE.PointsMaterial({ color:'#ffe9bf', size:.06, transparent:true, opacity:.65 }));
  battleScene.add(dust);
}

export const B = { active:false, enemy:null, mine:null, enemyModel:null, myModel:null, wanderRef:null, busy:false };

export function hpPct(m){ return Math.max(0, m.hp) / m.maxHP * 100; }
function setBar(el, m){
  const p = hpPct(m);
  el.style.width = p + '%';
  el.style.background = p > 50 ? '#4caf6e' : p > 22 ? '#e8b54a' : '#d9483b';
}
function refreshBattleUI(){
  const e = B.enemy, m = B.mine;
  $('e-name').innerHTML = `${e.name} <span class="chip ${e.type}">${TYPE_NAME[e.type]}</span>`;
  $('e-role').textContent = e.role;
  const d = e.lvl - m.lvl;
  $('e-lvl').textContent = 'Lv. ' + e.lvl + (d >= 2 ? ' ▲' : d <= -2 ? ' ▼' : '');
  $('e-lvl').style.color = d >= 2 ? '#b3362b' : d <= -2 ? '#3c7d46' : '';
  setBar($('e-hp'), e);
  $('p-name').innerHTML = `${m.name} <span class="chip ${m.type}">${TYPE_NAME[m.type]}</span>`;
  $('p-role').textContent = `${m.role} · ${m.hp}/${m.maxHP}`;
  $('p-lvl').textContent = 'Lv. ' + m.lvl;
  setBar($('p-hp'), m);
  $('p-xp').style.width = Math.min(100, m.xp / xpNeed(m) * 100) + '%';
  // Cast-Button leuchtet, sobald der Gegner überzeugbar ist
  $('act-cast').classList.toggle('glow', !!(B.active && B.enemy && !B.enemy.boss && !B.enemy.mini && B.enemy.hp > 0 && hpPct(B.enemy) < 40));
}
function blog(t){ $('battle-log').textContent = t; }
const EFF_DESC = {
  heal: 'heilt ~28% Motivation',
  atkUp: 'eigene Präsenz ▲ (mehr Schaden)',
  defUp: 'Deckung ▲ (weniger Schaden kassieren)',
  atkDown: 'Gegner-Präsenz ▼ (er trifft schwächer)',
};
function buildMoveButtons(){
  const wrap = $('battle-moves');
  wrap.innerHTML = '';
  B.mine.moves.forEach((key, i) => {
    const mv = MOVES[key];
    const b = document.createElement('button');
    b.className = 'btn';
    b.dataset.key = key;
    b.innerHTML = `<span class="mvname">[${i + 1}] ${mv.n} <small>${TYPE_NAME[mv.t]}</small></span>
      <small>${mv.p ? 'Kraft ' + mv.p : EFF_DESC[mv.eff]} · ${Math.round((mv.acc ?? .95) * 100)}% Treffer</small>`;
    b.onclick = () => playerTurn(key);
    wrap.appendChild(b);
  });
  updateBoredBadges();
}
function updateBoredBadges(){
  for (const b of $('battle-moves').children)
    b.classList.toggle('bored', !!B.mine && b.dataset.key === B.mine._lastMove);
}
function setMenuEnabled(on){
  document.querySelectorAll('#battle-menu .btn').forEach(b => b.disabled = !on);
}

function placeBattleModels(){
  if (B.myModel) battleScene.remove(B.myModel);
  if (B.enemyModel) battleScene.remove(B.enemyModel);
  B.myModel = buildPerson(B.mine.palette, { scale:1.5 });
  B.myModel.position.set(-3.4, 1.5, 0);
  B.myModel.rotation.y = Math.PI/2.4;
  B.myModel.userData.s = 1.5;
  B.enemyModel = B.enemy.beatrice ? buildBattlePlant() : buildPerson(B.enemy.palette, { scale: B.enemy.boss ? 1.7 : 1.5 });
  B.enemyModel.position.set(3.4, 1.5, 0);
  B.enemyModel.rotation.y = -Math.PI/2.4;
  B.enemyModel.userData.s = B.enemy.boss ? 1.7 : 1.5;
  battleScene.add(B.myModel, B.enemyModel);
}

export async function startBattle(wanderRef, bossInstance){
  G.mode = 'encounter';   // Input einfrieren, Welt weiter rendern bis der Wipe zu ist
  B.wanderRef = wanderRef;
  B.enemy = bossInstance || wanderRef.member;
  B.enemy.buff = { atk:1, def:1 };
  B.enemy._rep = 0; B.enemy._lastMove = null;
  B.mine = activeFighter();
  // Käselaib gegessen / frisches Fundus-Kostüm? Einmal-Buffs für den ersten Auftritt
  B.cheese = G.cheesePower; G.cheesePower = false;
  B.garde = G.costumePower; G.costumePower = false;
  B.mine.buff = { atk: B.cheese ? 1.5 : 1, def: B.garde ? .75 : 1 };
  B.mine._rep = 0; B.mine._lastMove = null;
  B.castHintShown = false;
  B.bossShake = 0;
  sfx.encounter();
  $('excl').classList.remove('hidden');
  await sleep(520);
  await wipe();
  $('excl').classList.add('hidden');
  G.mode = 'battle';
  placeBattleModels();
  B.active = true;
  $('battle-ui').classList.remove('hidden');
  $('battle-menu').classList.remove('hidden');
  $('hud').classList.add('hidden'); $('hint').classList.add('hidden'); $('interact').classList.add('hidden'); $('minimap').classList.add('hidden');
  buildMoveButtons();
  refreshBattleUI();
  $('act-cast').disabled = !!(B.enemy.boss || B.enemy.mini);
  unwipe();
  // Auftritt von beiden Seiten
  B.myModel.position.x = -9; B.enemyModel.position.x = 9;
  await tween(500, k => {
    const e2 = 1 - Math.pow(1-k, 3);
    B.myModel.position.x = -9 + e2*5.6;
    B.enemyModel.position.x = 9 - e2*5.6;
  });
  blog(B.enemy.boss
    ? 'Logge tritt aus dem Dunkel, die Augen glühen rot. „HEUTE fällt der letzte Vorhang."'
    : B.enemy.beatrice
    ? '*RASCHEL!* Beatrice reckt sich zu voller Größe – der Blumentopf ächzt bedrohlich.'
    : `${B.enemy.name} (${B.enemy.role}): „${roleLines(B.enemy).enc}"`);
  if (B.cheese){ floatText(B.myModel, 'Käse-Power ▲ 🧀', '#f4d35e'); sfx.heal(); }
  if (B.garde){ floatText(B.myModel, 'Garderobe sitzt ▲ 🧵', '#9cc8ff'); sfx.heal(); }
  setMenuEnabled(true);
  $('act-cast').disabled = !!(B.enemy.boss || B.enemy.mini);
  // Einmaliges Tutorial beim ersten Kampf
  if (!B.enemy.boss && !readFlag('theatermon-tut')){
    writeFlag('theatermon-tut', '1');
    await showDialog('Regie-Tipp',
      'Motivation = Lebensenergie. Fällt sie auf 0, tritt man ab.\n' +
      'Lv. = Bühnenerfahrung in Produktionen. Rotes Lv. ▲ über einem Kopf heißt: deutlich stärker als dein Team!\n' +
      '📖 CASTING wirbt das Mitglied an – je weniger Motivation es noch hat, desto eher sagt es zu. ' +
      'Veteranen mit vielen Produktionen zieren sich länger – Lampenfieber (Präsenz ▼) macht sie gesprächsbereiter. ' +
      'Besiegen bringt nur Applaus-Punkte, aber KEIN neues Ensemble-Mitglied!\n' +
      'Und: Wiederholst du dieselbe Nummer, langweilt sich das Publikum – sie verliert jedes Mal Wirkung. 😴');
  }
}

async function endBattle(){
  B.active = false;
  setMenuEnabled(true);
  await wipe();
  $('battle-ui').classList.add('hidden');
  $('battle-menu').classList.add('hidden');
  $('hud').classList.remove('hidden'); $('hint').classList.remove('hidden'); $('minimap').classList.remove('hidden');
  if (B.myModel){ battleScene.remove(B.myModel); B.myModel = null; }
  if (B.enemyModel){ battleScene.remove(B.enemyModel); B.enemyModel = null; }
  G.mode = 'world';
  G.encounterCooldown = 2;
  fx.lastInteractHint = '';
  hudUpdate(); save();
  unwipe();
}

/* ---------- battle actions ---------- */
function dmgCalc(att, def, mv, mult = 1){
  const eff = typeEff(mv.t, def.type);
  const variance = .85 + Math.random()*.3;
  const raw = att.atk * att.buff.atk * (mv.p/22) * eff * variance * def.buff.def * mult;
  return { dmg: Math.max(1, Math.round(raw)), eff };
}
const flashMat = new THREE.MeshBasicMaterial({ color:'#ffffff' });
async function dash(attModel, defModel){
  const sx = attModel.position.x, sz = attModel.position.z;
  const dir = defModel.position.x > sx ? 1 : -1;
  const tx = defModel.position.x - dir*1.7;
  await tween(170, k => {
    attModel.position.x = sx + (tx - sx)*k*k;
    attModel.position.y = 1.5 + Math.sin(k*Math.PI)*.7;
  });
  attModel.rotation.z = -dir*.3;   // Schlag-Pose
  await sleep(70);
  attModel.rotation.z = 0;
  await tween(240, k => {
    attModel.position.x = tx + (sx - tx)*k;
    attModel.position.y = 1.5 + Math.sin(k*Math.PI)*.35;
  });
  attModel.position.set(sx, 1.5, sz);
}
async function dodge(model){
  const z0 = model.position.z;
  await tween(380, k => model.position.z = z0 + Math.sin(k*Math.PI)*1.1);
  model.position.z = z0;
}
async function flashShake(model){
  const base = model.position.z;
  await tween(240, k => { model.position.z = base + Math.sin(k*22)*.16*(1-k); });
  model.position.z = base;
}
async function flashWhite(model){
  const orig = [];
  model.traverse(o => { if (o.isMesh && o.material !== outlineMat){ orig.push([o, o.material]); o.material = flashMat; } });
  await sleep(90);
  for (const [o, m] of orig) o.material = m;
}
function pulse(model){
  const s = model.userData.s || 1.5;
  tween(320, k => model.scale.setScalar(s * (1 + Math.sin(k*Math.PI)*.12)));
}
function impact(model, color){
  const ring = new THREE.Mesh(cachedGeo('impact-ring', () => new THREE.RingGeometry(.12,.26,20)),
    new THREE.MeshBasicMaterial({ color, side:THREE.DoubleSide, transparent:true, depthWrite:false }));
  ring.position.set(model.position.x, 2.3, model.position.z + .9);
  ring.lookAt(battleCam.position);
  battleScene.add(ring);
  tween(380, k => { ring.scale.setScalar(1 + k*7); ring.material.opacity = 1 - k; })
    .then(() => { battleScene.remove(ring); ring.material.dispose(); });
}
function sparkle(model, color, dir = 1){
  const x = model.position.x, z = model.position.z;
  const g = new THREE.Group();
  for (let i=0;i<12;i++){
    const m = new THREE.Mesh(sphGeo(.06,6,5),
      new THREE.MeshBasicMaterial({ color, transparent:true }));
    m.userData.a = Math.random()*Math.PI*2;
    m.userData.r = .4 + Math.random()*.55;
    m.userData.h = Math.random()*1.3;
    g.add(m);
  }
  battleScene.add(g);
  return tween(750, k => {
    for (const m of g.children){
      const y0 = dir > 0 ? 1.4 + m.userData.h : 3.3 - m.userData.h;
      m.position.set(x + Math.cos(m.userData.a)*m.userData.r, y0 + dir*k*1.6, z + Math.sin(m.userData.a)*m.userData.r);
      m.material.opacity = 1 - k;
    }
  }).then(() => {
    battleScene.remove(g);
    for (const m of g.children) m.material.dispose();
  });
}
function modelScreenPos(model, yOff){
  const v = new THREE.Vector3(0, yOff, 0).applyMatrix4(model.matrixWorld).project(battleCam);
  return { x: (v.x*.5 + .5)*innerWidth, y: (-v.y*.5 + .5)*innerHeight };
}
function floatText(model, text, color){
  const p = modelScreenPos(model, 2.7);
  const d = document.createElement('div');
  d.className = 'float-dmg';
  d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; d.style.color = color;
  d.textContent = text;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1100);
}
function burst(x, y, z, color){
  const g = new THREE.Group();
  for (let i=0;i<16;i++){
    const m = new THREE.Mesh(boxGeo(.09,.09,.09), basicMat(color));
    m.userData.v = new THREE.Vector3((Math.random()-.5)*4.5, Math.random()*3.5 + 1, (Math.random()-.5)*4.5);
    m.position.set(x, y, z);
    g.add(m);
  }
  battleScene.add(g);
  tween(900, k => {
    for (const m of g.children){
      m.position.set(x + m.userData.v.x*k, y + m.userData.v.y*k - 2.2*k*k, z + m.userData.v.z*k);
      m.rotation.x = m.rotation.y = k*7;
      m.scale.setScalar(1-k);
    }
  }).then(() => battleScene.remove(g));
}
async function doMove(att, def, key, attModel, defModel, mine){
  const mv = MOVES[key];
  // Publikum langweilt sich, wenn dieselbe Nummer wiederholt wird
  att._rep = key === att._lastMove ? (att._rep || 0) + 1 : 0;
  att._lastMove = key;
  const boredom = Math.max(.4, 1 - .25 * att._rep);
  blog(`${att.name} setzt ${mv.n} ein!`);
  await sleep(380);
  if (Math.random() > (mv.acc ?? .95)){
    await dodge(defModel);
    floatText(defModel, 'daneben!', '#cfd6ff');
    blog('… und verfehlt das Stichwort!');
    await sleep(600); return;
  }
  if (mv.eff === 'heal'){
    att.hp = Math.min(att.maxHP, att.hp + Math.round(att.maxHP*.28*boredom));
    sfx.heal(); pulse(attModel);
    floatText(attModel, '+ Motivation', '#7fe57a');
    await sparkle(attModel, '#7fe57a', 1);
    refreshBattleUI();
    blog(`${att.name} schöpft neue Motivation!`); await sleep(450); return;
  }
  if (mv.eff === 'atkUp'){
    att.buff.atk = 1.5; sfx.heal(); pulse(attModel);
    floatText(attModel, 'Präsenz ▲', '#ffd97a');
    await sparkle(attModel, '#ffd97a', 1);
    blog(`${att.name}s Bühnenpräsenz steigt!`); await sleep(450); return;
  }
  if (mv.eff === 'defUp'){
    att.buff.def = .65; sfx.heal(); pulse(attModel);
    floatText(attModel, 'Deckung ▲', '#9cc8ff');
    await sparkle(attModel, '#9cc8ff', 1);
    blog(`${att.name} ist jetzt schwerer zu treffen!`); await sleep(450); return;
  }
  if (mv.eff === 'atkDown'){
    def.buff.atk = .65; sfx.hit();   // stackt nicht — einmal Lampenfieber ist genug
    if (def.boss) B.bossShake = 0;

    floatText(defModel, 'Präsenz ▼', '#b85cc4');
    await sparkle(defModel, '#b85cc4', -1);
    await flashShake(defModel);
    blog(`${def.name} bekommt Lampenfieber!`); await sleep(450); return;
  }
  await dash(attModel, defModel);
  sfx.hit();
  const { dmg, eff } = dmgCalc(att, def, mv, boredom);
  def.hp = Math.max(0, def.hp - dmg);
  flashWhite(defModel);
  impact(defModel, TYPE_COL[mv.t] || '#ffffff');
  fx.bShake = eff > 1 ? .5 : .28;
  floatText(defModel, '-' + dmg, eff > 1 ? '#ffd97a' : '#ff6b5e');
  refreshBattleUI();
  await flashShake(defModel);
  if (att._rep > 0) blog(`Gähnen im Publikum – die Nummer kennt es schon… (${dmg})`);
  else if (eff > 1) blog(`Volltreffer – sehr effektiv! (${dmg})`);
  else if (eff < 1) blog(`Hmm, das zieht nicht so recht… (${dmg})`);
  else blog(`Das saß! (${dmg})`);
  await sleep(600);
}
async function enemyTurn(){
  const e = B.enemy;
  // Logge schüttelt Lampenfieber nach ein paar Runden wieder ab
  if (e.boss && e.buff.atk < 1 && ++B.bossShake >= 3){
    B.bossShake = 0; e.buff.atk = 1;
    floatText(B.enemyModel, 'Präsenz ▲', '#ff6b5e');
    blog('Logge sammelt sich – das Lampenfieber verfliegt!');
    await sleep(550);
  }
  const atkMoves = e.moves.filter(k => MOVES[k].p > 0 && !MOVES[k].eff);
  // Util-Moves nur, wenn sie gerade etwas bringen
  const utilMoves = e.moves.filter(k => {
    const mv = MOVES[k];
    if (mv.eff === 'heal')    return e.hp < e.maxHP * .55;
    if (mv.eff === 'atkUp')   return e.buff.atk === 1;
    if (mv.eff === 'defUp')   return e.buff.def === 1;
    if (mv.eff === 'atkDown') return B.mine.buff.atk >= 1;
    return false;
  });
  const key = (utilMoves.length && Math.random() < .35) ? pick(Math.random, utilMoves) : pick(Math.random, atkMoves);
  await doMove(e, B.mine, key, B.enemyModel, B.myModel, false);
  refreshBattleUI();
  if (B.mine.hp <= 0) await handleMyFaint();
}
async function gainXP(amount){
  const m = B.mine;
  m.xp += amount;
  blog(`${m.name} bekommt ${amount} Applaus-Punkte!`);
  // die Bank lernt vom Zuschauen mit (30 %)
  const share = Math.max(1, Math.round(amount * .3));
  const benchUps = [];
  for (const b of G.ensemble){
    if (b === m) continue;
    b.xp += share;
    while (b.xp >= xpNeed(b)){ b.xp -= xpNeed(b); levelUp(b); benchUps.push(b.name); }
  }
  if (benchUps.length) blog(`Vom Zuschauen gelernt: ${benchUps.join(', ')} +1 Produktion! ⭐`);
  refreshBattleUI();
  await sleep(700);
  while (m.xp >= xpNeed(m)){
    m.xp -= xpNeed(m);
    levelUp(m);
    sfx.lvl();
    burst(-3.4, 2.5, 0, '#7fe3dc');
    floatText(B.myModel, '+1 Produktion ⭐', '#7fe3dc');
    pulse(B.myModel);
    blog(`${m.name} steigt auf Lv. ${m.lvl}!`);
    refreshBattleUI();
    await sleep(900);
  }
}
async function handleEnemyFaint(){
  sfx.faint();
  burst(B.enemyModel.position.x, 2, B.enemyModel.position.z, '#9aa0c8');
  await tween(550, k => {
    B.enemyModel.scale.setScalar((B.enemy.boss?1.7:1.5)*(1-k*.9));
    B.enemyModel.rotation.z = k*1.1;
    B.enemyModel.position.y = 1.5 - k*.7;
  });
  blog(B.enemy.boss
    ? 'Logge sinkt auf die Knie. Das rote Glühen erlischt. „Es ist… vorbei."'
    : B.enemy.beatrice
    ? 'Beatrice klappt das Maul zu, lässt alle Blätter hängen – und spuckt den Requisitenkoffer aus!'
    : `${B.enemy.name} verbeugt sich und tritt ab!`);
  await sleep(800);
  await gainXP(14 + B.enemy.lvl*5);
  if (B.enemy.boss){
    G.bossDown = true;
    save();
    await endBattle();
    await showCredits();
    return;
  }
  if (B.enemy.beatrice){
    G.beatriceDown = true;
    G.cheesePower = true;   // im Koffer: ein unversehrter Käselaib
    save();
    await endBattle();
    await showDialog('Beatrice besiegt! &#x1FAB4;',
      'Beatrice ist satt, erschöpft und plötzlich erstaunlich friedlich – sie gurrt fast.\n' +
      'Im ausgespuckten Requisitenkoffer: Bühnenpläne, ein Hosenknopf – und ein unversehrter Käselaib! &#x1F9C0;\n' +
      '&#x2728; KÄSE-POWER: Dein nächster Auftritt startet mit erhöhter Präsenz (▲).\n' +
      'Fiona, aus der Ferne: „Oh. Jetzt mag sie dich."');
    return;
  }
  if (B.wanderRef) removeWanderer(B.wanderRef, 30000);
  await endBattle();
}
async function handleMyFaint(){
  sfx.faint();
  burst(B.myModel.position.x, 2, B.myModel.position.z, '#9aa0c8');
  await tween(550, k => {
    B.myModel.scale.setScalar(1.5*(1-k*.9));
    B.myModel.rotation.z = -k*1.1;
    B.myModel.position.y = 1.5 - k*.7;
  });
  blog(`${B.mine.name} braucht eine Pause hinter der Bühne!`);
  await sleep(800);
  const alive = G.ensemble.filter(m => m.hp > 0);
  if (!alive.length){
    // erst heilen, dann beenden — endBattle() speichert
    G.ensemble.forEach(m => { m.hp = m.maxHP; });
    player.position.set(kaffeePos.x - 4, 0, kaffeePos.z);
    await endBattle();
    await showDialog('Blackout!', 'Das ganze Ensemble ist erschöpft…\nIhr wacht am Kaffee-&-Kuchen-Stand wieder auf. Ursula hat schon eingeschenkt.');
    hudUpdate();
    return;
  }
  await chooseSwitch(true);
}
function chooseSwitch(forced){
  return new Promise(res => {
    const list = $('switch-list');
    list.innerHTML = '';
    $('switch-title').textContent = forced ? 'Wen schickst du auf die Bühne?' : 'Wechseln zu…';
    const candidates = G.ensemble.filter(m => m.hp > 0 && m !== B.mine);
    for (const m of candidates){
      const b = document.createElement('button');
      b.className = 'btn';
      b.innerHTML = `${m.name} <span class="chip ${m.type}">${TYPE_NAME[m.type]}</span> Lv. ${m.lvl} · ${m.hp}/${m.maxHP}`;
      b.onclick = async () => {
        $('switch-modal').classList.add('hidden');
        B.mine = m;
        m.buff = { atk:1, def:1 };
        m._rep = 0; m._lastMove = null;
        placeBattleModels();
        buildMoveButtons();
        refreshBattleUI();
        blog(`Auftritt ${m.name}!`);
        sfx.click();
        B.myModel.scale.setScalar(.01);
        await tween(300, k => B.myModel.scale.setScalar(1.5*k));
        sparkle(B.myModel, '#f1e8d8', 1);
        await sleep(300);
        res(true);
      };
      list.appendChild(b);
    }
    if (!forced){
      const c = document.createElement('button');
      c.className = 'btn'; c.textContent = 'Abbrechen';
      c.onclick = () => { $('switch-modal').classList.add('hidden'); res(false); };
      list.appendChild(c);
    }
    $('switch-modal').classList.remove('hidden');
  });
}

async function playerTurn(moveKey){
  if (B.busy || !B.active) return;
  B.busy = true; setMenuEnabled(false);
  await doMove(B.mine, B.enemy, moveKey, B.myModel, B.enemyModel, true);
  refreshBattleUI();
  updateBoredBadges();
  if (B.enemy.hp <= 0){ await handleEnemyFaint(); B.busy = false; return; }
  await enemyTurn();
  B.busy = false;
  if (B.active){
    setMenuEnabled(true);
    $('act-cast').disabled = !!(B.enemy.boss || B.enemy.mini);
    if (!B.enemy.boss && !B.enemy.mini && hpPct(B.enemy) < 40 && !B.castHintShown){
      B.castHintShown = true;
      blog(`${B.enemy.name} wankt – jetzt casten! 📖`);
    }
  }
}

$('act-cast').onclick = async () => {
  if (B.busy || !B.active || B.enemy.boss || B.enemy.mini) return;
  B.busy = true; setMenuEnabled(false);
  blog(`Du wirfst ${B.enemy.name} das Drehbuch zu…`);
  // Buch fliegt
  const book = new THREE.Mesh(boxGeo(.5,.7,.12), toon('#f1e8d8'));
  const spine = box(.06,.7,.13,'#a8232f',false); spine.position.x = -.25; book.add(spine);
  book.position.set(-3, 3, 0);
  battleScene.add(book);
  await tween(600, k => {
    book.position.x = -3 + k*6.4;
    book.position.y = 3 + Math.sin(k*Math.PI)*1.6 - k*.8;
    book.rotation.z = k*7;
  });
  battleScene.remove(book);
  impact(B.enemyModel, '#f1e8d8');
  await tween(350, k => B.enemyModel.scale.setScalar(1.5*(1-k*.85)));
  // wackeln
  for (let i=0;i<3;i++){
    beep(440 - i*60, .07, 'square', .04);
    await tween(330, k => B.enemyModel.rotation.z = Math.sin(k*Math.PI*2)*.25);
  }
  // wenig Motivation = leichter zu überzeugen · Veteranen zieren sich · Lampenfieber macht gesprächsbereit
  const p = Math.max(.05,
    .08 + .75 * (1 - B.enemy.hp / B.enemy.maxHP)
    - B.enemy.lvl * .015
    + (B.enemy.buff.atk < 1 ? .15 : 0));
  if (Math.random() < p){
    sfx.catchOk();
    burst(3.4, 2.5, 0, '#ffd97a');
    floatText(B.enemyModel, 'GECASTET!', '#ffd97a');
    blog(`${B.enemy.name}: „${roleLines(B.enemy).ok}" – Willkommen im Ensemble!`);
    B.enemy.hp = Math.max(1, B.enemy.hp);
    G.ensemble.push(B.enemy);
    if (B.wanderRef) removeWanderer(B.wanderRef, 0);
    await sleep(1100);
    await gainXP(10 + B.enemy.lvl*3);
    await endBattle();
    if (G.ensemble.length === maxCatch()){
      await showDialog('&#x1F3C6;', `ALLE ${maxCatch()} Mitglieder im Ensemble – das komplette Kolpingtheater!\nJetzt kann Logge einpacken – und Graf Thaddäus seinen 110. feiern.`);
    }
  } else {
    sfx.catchNo();
    await tween(250, k => B.enemyModel.scale.setScalar(.225 + k*1.275));
    B.enemyModel.rotation.z = 0;
    blog(`${B.enemy.name}: „${roleLines(B.enemy).no}"`);
    await sleep(900);
    await enemyTurn();
  }
  B.busy = false;
  if (B.active){ setMenuEnabled(true); $('act-cast').disabled = !!(B.enemy.boss || B.enemy.mini); }
};
$('act-switch').onclick = async () => {
  if (B.busy || !B.active) return;
  if (G.ensemble.filter(m => m.hp > 0).length < 2){ blog('Niemand sonst ist einsatzbereit!'); return; }
  B.busy = true; setMenuEnabled(false);
  const did = await chooseSwitch(false);
  if (did) await enemyTurn();
  B.busy = false;
  if (B.active){ setMenuEnabled(true); $('act-cast').disabled = !!(B.enemy.boss || B.enemy.mini); }
};
$('act-flee').onclick = async () => {
  if (B.busy || !B.active) return;
  B.busy = true; setMenuEnabled(false);
  if (B.enemy.boss){
    blog('Logge versperrt den Weg. „Hier geht NIEMAND, bevor der Vorhang fällt."');
    await sleep(900);
    await enemyTurn();
    B.busy = false;
    if (B.active) setMenuEnabled(true);
    return;
  }
  blog('Du verbeugst dich und verlässt die Bühne…');
  await sleep(700);
  // Wanderer kurz wegschicken, sonst zwingt er einen sofort wieder in den Kampf
  if (B.wanderRef) removeWanderer(B.wanderRef, 10000);
  B.busy = false;
  await endBattle();
};
