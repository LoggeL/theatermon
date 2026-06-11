/* ================================================================
   game state + save
================================================================ */
import { hashStr, mulberry, pick } from './util.js';
import { RAW, TOTAL, MOVE_POOL, SKIN, HAIR, SHIRT } from './data.js';
import { readSave, writeSave } from './storage.js';

// zentrale Statformel — Level = echte Produktions-Anzahl (1–12)
export function applyStats(m){
  m.maxHP = 28 + m.lvl*5 + m.hpV;
  m.atk = 9 + Math.round(m.lvl*1.6) + m.atkV;
}
export function makeMember(id, lvl){
  const [name, role, type, prods] = RAW[id];
  const rng = mulberry(hashStr(name + role));
  const pool = MOVE_POOL[type].slice();
  // Signature-Move der Rolle + 3 aus dem Typ-Pool
  const moves = ['sig' + id];
  while (moves.length < 4 && pool.length){
    const i = Math.floor(rng()*pool.length);
    moves.push(pool.splice(i,1)[0]);
  }
  const hpV = Math.floor(rng()*8), atkV = Math.floor(rng()*4);
  const m = {
    id, name, role, type, lvl: lvl ?? prods,
    xp: 0, hpV, atkV, moves,
    palette: {
      skin: pick(rng, SKIN), hair: pick(rng, HAIR),
      shirt: pick(rng, SHIRT[type]), pants: pick(rng, ['#3b3b50','#4a3f35','#2f4858','#5d5d6e']),
      longHair: rng() < .45, cap: type==='T' && rng() < .8,
    },
    buff: { atk:1, def:1 },
  };
  applyStats(m);
  m.hp = m.maxHP;
  return m;
}
export function levelUp(m){
  m.lvl++;
  applyStats(m);
  m.hp = Math.min(m.maxHP, m.hp + Math.round(m.maxHP*.15));
}
export function xpNeed(m){ return m.lvl * 24; }
// XP außerhalb des Kampfs vergeben (Hüpfburg-Training, Generalprobe) —
// liefert die Anzahl der Level-Ups für den Dialog-Text
export function grantXP(m, amount){
  m.xp += amount;
  let ups = 0;
  while (m.xp >= xpNeed(m)){ m.xp -= xpNeed(m); levelUp(m); ups++; }
  return ups;
}
export function makeBoss(){
  // Boss skaliert mit den Top-4 des Teams — viele schwache Member casten macht ihn nicht leichter
  const lvls = G.ensemble.map(m => m.lvl).sort((a, b) => b - a).slice(0, 4);
  const teamL = lvls.length ? lvls.reduce((s, l) => s + l, 0) / lvls.length : 6;
  const L = Math.round(teamL) + 2;
  const b = {
    id:-1, name:'Logge', role:'Der Saboteur', type:'W', lvl:11,
    maxHP: 90 + L*16, hp: 90 + L*16, atk: 10 + Math.round(L*1.9), xp:0,
    moves:['absage','sabotage','vorhang','drohung'],
    palette:{ skin:SKIN[0], hair:'#1a1a1a', shirt:'#1d1f29', pants:'#14151f', longHair:false, cap:false, evil:true },
    buff:{ atk:1, def:1 }, boss:true,
  };
  return b;
}
export function makeBeatrice(){
  // Miniboss: etwas über Team-Niveau, nicht castbar, einmalig
  const lvls = G.ensemble.map(m => m.lvl).sort((a, b) => b - a).slice(0, 4);
  const teamL = lvls.length ? lvls.reduce((s, l) => s + l, 0) / lvls.length : 4;
  const L = Math.max(4, Math.round(teamL) + 1);
  return {
    id:-3, name:'Beatrice', role:'Kannibalia Fressaria', type:'K', lvl:L,
    maxHP: 50 + L*9, hp: 50 + L*9, atk: 8 + Math.round(L*1.7), xp:0,
    moves:['schnapp','ranke','duft','photosyn'],
    buff:{ atk:1, def:1 }, mini:true, beatrice:true,
  };
}

// Welt-Uhr-Start: früher Abend (Theater-Stimmung!) — 0..1, 0 = Mitternacht
export const TIME_START = .66;

export const G = {
  mode: 'title',          // title | world | battle | dialog | menu
  timeOfDay: TIME_START,  // Welt-Uhr (Tag-Nacht-Zyklus), tickt nur im World-Modus
  ensemble: [],           // gefangene Member-Instanzen (Reihenfolge = Aufstellung)
  playerId: -2,           // -2 = Sebastian (Regie), sonst RAW-Index
  bossDown: false,
  beatriceDown: false,    // Miniboss-Pflanze besiegt?
  cheesePower: false,     // Käselaib gegessen → nächster Kampf startet mit Präsenz ▲
  costumeSeed: 0,         // Fundus-Outfit des Spielers (0 = Standard-Look)
  costumePower: false,    // frisches Fundus-Kostüm → nächster Kampf startet mit Deckung ▲
  encounterCooldown: 0,
  healReady: true,
  fotoReady: true,
};
export const maxCatch = () => TOTAL - (G.playerId >= 0 ? 1 : 0);
export function save(){
  writeSave({
    v: 2,                 // Save-Format-Version (v2: Julian-Duplikat aus RAW entfernt)
    bossDown: G.bossDown,
    beatriceDown: G.beatriceDown,
    cheesePower: G.cheesePower,
    costumeSeed: G.costumeSeed,
    costumePower: G.costumePower,
    playerId: G.playerId,
    time: G.timeOfDay,    // Welt-Uhr (optional, seit Tag-Nacht-Zyklus)
    ensemble: G.ensemble.map(m => ({ id:m.id, lvl:m.lvl, xp:m.xp, hp:m.hp, hpV:m.hpV, atkV:m.atkV })),
  });
}
export function load(){
  try {
    const d = readSave();
    if (!d || !d.ensemble || !d.ensemble.length) return false;
    // Migration Altformat (ohne v-Feld) → v2: Julian stand doppelt im RAW-Array
    // (Index 8 = Ensemble, Index 32 = Bühnentechnik — dieselbe Person).
    // Der Technik-Eintrag wurde entfernt: id 32 wird auf 8 umgemappt
    // (bzw. verworfen, wenn id 8 schon im Ensemble ist), alle ids > 32 rücken um 1 auf.
    if (!d.v){
      const has8 = d.ensemble.some(s => s.id === 8);
      d.ensemble = d.ensemble.filter(s => !(s.id === 32 && has8));
      for (const s of d.ensemble){
        if (s.id === 32) s.id = 8;
        else if (s.id > 32) s.id -= 1;
      }
      if (d.playerId === 32) d.playerId = 8;
      else if (d.playerId > 32) d.playerId -= 1;
    }
    G.bossDown = !!d.bossDown;
    G.beatriceDown = !!d.beatriceDown;
    G.cheesePower = !!d.cheesePower;
    G.costumeSeed = d.costumeSeed || 0;
    G.costumePower = !!d.costumePower;
    G.playerId = d.playerId ?? -2;
    // Welt-Uhr: optionales v2-Feld — Alt-Saves ohne `time` starten am frühen Abend
    G.timeOfDay = typeof d.time === 'number' ? ((d.time % 1) + 1) % 1 : TIME_START;
    G.ensemble = d.ensemble.map(s => {
      const m = makeMember(s.id, 1);
      m.lvl = s.lvl; m.xp = s.xp;
      applyStats(m);
      m.hp = Math.min(s.hp, m.maxHP);
      return m;
    });
    // nie mit komplett erschöpftem Ensemble laden (Blackout-Save)
    if (!G.ensemble.some(m => m.hp > 0)) G.ensemble.forEach(m => m.hp = m.maxHP);
    return true;
  } catch(e){ return false; }
}
export const caughtIds = () => new Set(G.ensemble.map(m => m.id));
export const activeFighter = () => G.ensemble.find(m => m.hp > 0) || G.ensemble[0];
