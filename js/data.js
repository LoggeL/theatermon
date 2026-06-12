/* ================================================================
   data: types, moves, team (kolpingtheater-ramsen.de/team)

   WICHTIG: Diese Datei enthält ausschließlich reine Daten und pure
   Funktionen — bewusst KEINE DOM- und KEINE Three.js-Abhängigkeiten.
   Bitte hier nichts UI- oder Render-spezifisches ergänzen.
================================================================ */
import { hashStr } from './util.js';

export const TYPE_NAME = { S:'Schauspiel', T:'Technik', K:'Kostüm', R:'Regie', W:'Website' };
export function typeEff(att, def){
  // Regie & Website: Glass Cannon — teilen breit aus, stecken aber überall mehr ein
  if (def==='R' || def==='W') return 1.25;
  if (att==='R' || att==='W') return 1.15;
  if (att==='T'&&def==='S' || att==='S'&&def==='K' || att==='K'&&def==='T') return 1.6;
  if (att==='S'&&def==='T' || att==='K'&&def==='S' || att==='T'&&def==='K') return 0.65;
  return 1;
}
export const MOVES = {
  monolog:    { n:'Dramatischer Monolog', t:'S', p:26, acc:.92 },
  impro:      { n:'Improvisation',        t:'S', p:18, acc:1 },
  stichwort:  { n:'Stichwort geben',      t:'S', p:12, acc:1 },
  lampenfieber:{n:'Lampenfieber',         t:'S', p:0,  acc:1, eff:'atkDown' },
  ovation:    { n:'Standing Ovation',     t:'S', p:0,  acc:1, eff:'heal' },
  blackout:   { n:'Blackout',             t:'T', p:26, acc:.9 },
  nebel:      { n:'Nebelmaschine',        t:'T', p:0,  acc:1, eff:'atkDown' },
  feedback:   { n:'Feedback-Pfeifen',     t:'T', p:20, acc:.95 },
  soundcheck: { n:'Soundcheck',           t:'T', p:0,  acc:1, eff:'atkUp' },
  followspot: { n:'Verfolger-Spot',       t:'T', p:16, acc:1 },
  maskenball: { n:'Maskenball',           t:'K', p:24, acc:.92 },
  nadelstich: { n:'Nadelstich',           t:'K', p:14, acc:1 },
  fundus:     { n:'Fundus-Lawine',        t:'K', p:32, acc:.7 },
  anprobe:    { n:'Anprobe',              t:'K', p:0,  acc:1, eff:'heal' },
  kostuem:    { n:'Kostümwechsel',        t:'K', p:0,  acc:1, eff:'defUp' },
  regie1:     { n:'Regieanweisung',       t:'R', p:24, acc:.95 },
  regie2:     { n:'„Noch mal von vorn!“', t:'R', p:30, acc:.85 },
  generalprobe:{n:'Generalprobe',         t:'R', p:0,  acc:1, eff:'atkUp' },
  striche:    { n:'Strichfassung',        t:'R', p:18, acc:1 },
  absage:     { n:'Eiskalte Absage',      t:'W', p:30, acc:.85 },
  sabotage:   { n:'Sabotage',             t:'W', p:24, acc:.95 },
  vorhang:    { n:'„Vorhang. Für immer."',t:'W', p:18, acc:1 },
  drohung:    { n:'Finstere Drohung',     t:'W', p:0,  acc:1, eff:'atkDown' },
  // Beatrice (Miniboss)
  schnapp:    { n:'SCHNAPP!',             t:'S', p:26, acc:.88 },
  ranke:      { n:'Rankenpeitsche',       t:'K', p:18, acc:1 },
  duft:       { n:'Betörender Duft',      t:'S', p:0,  acc:1, eff:'atkDown' },
  photosyn:   { n:'Photosynthese',        t:'S', p:0,  acc:1, eff:'heal' },
};
// Signature-Move pro Rolle (Index = RAW-Index)
export const SIG = [
  { n:'Drusillas Giftblick',     t:'S', p:22, acc:.95 },
  { n:'Der Ohrenbohrer',         t:'S', p:0,  acc:1, eff:'atkDown' },
  { n:'Sumpf-Standpauke',        t:'S', p:24, acc:.9 },
  { n:'Sprung ins Rampenlicht',  t:'S', p:18, acc:1 },
  { n:'Karls Konter',            t:'S', p:20, acc:.95 },
  { n:'Brunos Bärenumarmung',    t:'S', p:26, acc:.85 },
  { n:'Hirntauschinator',        t:'S', p:0,  acc:1, eff:'atkDown' },
  { n:'Mottenflattern',          t:'S', p:18, acc:1 },
  { n:'Doppelrolle',             t:'S', p:0,  acc:1, eff:'atkUp' },
  { n:'Perfekter Einsatz',       t:'S', p:18, acc:1 },
  { n:'Gespielte Freundlichkeit',t:'S', p:0,  acc:1, eff:'heal' },
  { n:'Spontaner Szenenklau',    t:'S', p:20, acc:.95 },
  { n:'Bronzene Büste',          t:'S', p:26, acc:.9 },
  { n:'Suzies Schlagfertigkeit', t:'S', p:20, acc:1 },
  { n:'Maximale Gestik',         t:'S', p:18, acc:1 },
  { n:'Noch maximalere Gestik',  t:'S', p:20, acc:.95 },
  { n:'„Blinde Kuh"',            t:'S', p:18, acc:1 },
  { n:'Pharaonenfluch',          t:'S', p:24, acc:.9 },
  { n:'Käselaib-Stärkung',       t:'S', p:0,  acc:1, eff:'atkUp' },
  { n:'Eiserne Probe',           t:'S', p:0,  acc:1, eff:'defUp' },
  { n:'Stilles Servieren',       t:'S', p:0,  acc:1, eff:'heal' },
  { n:'„En garde!"',             t:'S', p:0,  acc:1, eff:'atkUp' },
  { n:'Claras Klartext',         t:'S', p:20, acc:1 },
  { n:'Schniebli-Schnauze',      t:'S', p:22, acc:.95 },
  { n:'Stoisches „Hmmm."',       t:'S', p:0,  acc:1, eff:'defUp' },
  { n:'Chorische Attacke',       t:'S', p:18, acc:1 },
  { n:'Düstere Diagnose',        t:'S', p:24, acc:.9 },
  { n:'Nähnadel-Sturm',          t:'K', p:22, acc:.95 },
  { n:'Szenen-Umschnitt',        t:'T', p:20, acc:.95 },
  { n:'Gleißender Spot',         t:'T', p:24, acc:.9 },
  { n:'Stroboskop',              t:'T', p:0,  acc:1, eff:'atkDown' },
  { n:'Lichtkegel-Falle',        t:'T', p:18, acc:1 },
  { n:'Blitzlichtgewitter',      t:'T', p:22, acc:.9 },
  { n:'Requisiten-Wurf',         t:'T', p:18, acc:1 },
  { n:'Umbau im Dunkeln',        t:'T', p:0,  acc:1, eff:'defUp' },
  { n:'Ohrenbetäubende Rückkopplung', t:'T', p:24, acc:.85 },
  { n:'Sanfte Einspielmusik',    t:'T', p:0,  acc:1, eff:'heal' },
];
SIG.forEach((mv, i) => MOVES['sig' + i] = mv);
export const MOVE_POOL = {
  S:['monolog','impro','stichwort','lampenfieber','ovation'],
  T:['blackout','nebel','feedback','soundcheck','followspot'],
  K:['maskenball','nadelstich','fundus','anprobe','kostuem'],
};
// Original-Zitate & Running Gags aus dem CREEPSHOW-Skript (skript.logge.top)
// enc = Spruch zu Kampfbeginn · no = Casting abgelehnt · ok = Casting angenommen
export const ROLE_LINES = {
  'Drusilla':            { enc:'Herzlich willkommen, verehrte Herr- und Frauschaften, zu einem Spektakel der anderen Art!', no:'Dieser Aufzug geziemt sich nicht für echte von Falkensteins.', ok:'Nun denn – ich führe euch durch das Anwesen. Es steckt voller Erinnerungen. Und dunkler Geheimnisse.' },
  'Lucy':                { enc:'Was schaut ihr so blöd? Habt ihr keine Arbeit?', no:'Och weißt du, ich habe heute nichts mehr vor.', ok:'Nun gut, weil ich heute einen guten Tag habe, werde ich euch verschonen.' },
  'Tante Heideltraut':   { enc:'Mensch Kinder, ich habe euch überall gesucht!', no:'Es ist Schlafenszeit. Kommt jetzt!', ok:'Zum Glück, dann ist ja alles gut. Ich habe mir schon Sorgen gemacht.' },
  'Vetter Viktor':       { enc:'Bei Holla der Waldfee und ihren fünf heißen Schwestern!', no:'Seltsam… da ist wohl eine Lötstelle nicht richtig gesetzt.', ok:'Na schön, wenn ihr so fragt. Für die Wissenschaft!' },
  'Motte':               { enc:'Voll spannend! Und das klappt dann einfach so?', no:'Ich muss mir gar nichts mehr sagen lassen. Es reicht!', ok:'Aber sowas von!' },
  'Graf Thaddäus':       { enc:'Habt Dank, liebe Verwandte, Freunde, Bekannte – und bereits Verblichene.', no:'Du bist nicht Winston.', ok:'Nun denn. Aber vorher rückt noch jemand meine Büste zurecht – die Nase wirkt unvorteilhaft.' },
  'Fiona':               { enc:'Sieh an, wen haben wir denn da?', no:'Keine Sorge, es wird bestimmt richtig witzig.', ok:'Gut. Aber Beatrice füttert ihr ab jetzt selbst.' },
  'Felia':               { enc:'Wir spielen „Blinde Kuh". Eine Sondervariante – ich erkläre dir gleich die Regeln.', no:'Spiel einfach mit. Ich bin gleich fertig.', ok:'So, erledigt.' },
  'Prinzessin Iset':     { enc:'Wo ist mein Thron, von dem ich auf euch einfaches Fußvolk herabsehen kann?', no:'Schweig, Diener! Oder ich werfe euch meinen Krokodilen zum Fraß vor.', ok:'Das will ich hoffen. Und nun: ein Bad in Eselsmilch!' },
  'Praktikant Emil':     { enc:'Also eigentlich bin ich hier wegen meines Schnupperpraktikums…', no:'Für den Aufwand schuldest du mir einen ganzen Käselaib.', ok:'Aber klar doch! Das wird hoffentlich positiv im Arbeitszeugnis vermerkt.' },
  'Mia':                 { enc:'Das ist eine Beleidigung – ich fordere dich zum Duell! En garde!', no:'Dafür musst du erst kämpfen wie ein Musketier!', ok:'Einer für alle und alle für einen!' },
  'Clara':               { enc:'Du kannst lange warten, bis ich dir etwas verrate.', no:'Seltsam…', ok:'Na gut. Aber Mia kommt mit – wir gehören zusammen.' },
  'Herr Schniebli':      { enc:'Du dreckiges Gör! Was fällt dir ein?', no:'Ihr fresst mir noch die Haare vom Kopf, ihr verfressenen Plagegeister!', ok:'Fürsorge wird bei uns im „Haus Sonnenschein" GANZ großgeschrieben.' },
  'Jacques':             { enc:'Hmmm.', no:'Hmm,…', ok:'Mhm!' },
  'Dr. Adrian Düsterwald': { enc:'Und jetzt halten Sie sich fest…', no:'Doch!', ok:'Die Erbschaftsangelegenheit wäre damit geregelt.' },
  'Karl':                { enc:'Na, wer hat sich denn hierher verirrt?', no:'Erst, wenn Schniebli schläft.', ok:'Alles ist besser als Haus Sonnenschein!' },
  'Bruno':               { enc:'Na sieh an, wer jetzt erst wach geworden ist.', no:'Dafür musst du früher aufstehen.', ok:'Na gut – aber nur mit Bärenumarmung.' },
  'Suzie':               { enc:'Im Waisenhaus lernt man, sich durchzubeißen.', no:'Netter Versuch.', ok:'Endlich raus aus dem Schlafsaal!' },
  'Diener':              { enc:'Verzeiht, ich habe gedacht…', no:'Bitte nicht der Ohrenbohrer!', ok:'Sehr wohl. Stilles Servieren ist meine Spezialität.' },
};
// Fallbacks für Ensemble (Bedienstete der Villa) & Crew
export const ENS_LINES = [
  { enc:'Die Portraits im Flur haben mir wieder zugezwinkert.', no:'Erst, wenn die Portraits es erlauben.', ok:'Die Villa wird stolz auf uns sein!' },
  { enc:'Psst… im Kerker der Villa spukt es. Also noch mehr als sonst.', no:'Ich muss noch Staub wischen. Überall Staub. Seit 1916.', ok:'Endlich Applaus statt Kettenrasseln!' },
  { enc:'Ich probe gerade meinen schaurigsten Blick für den Geburtstag des Grafen.', no:'Mein großer Auftritt ist noch nicht reif.', ok:'Für den 110. des Grafen – ich bin dabei!' },
];
export const CREW_LINES = [
  { enc:'Blitz und Donner über der Villa Falkenstein? Reine Handarbeit.', no:'Erst, wenn der Soundcheck steht.', ok:'Na gut – aber die Spieluhr fahre ICH.' },
  { enc:'Ohne uns bleibt die Gruft dunkel.', no:'Der Bühnennebel ist noch nicht dicht genug.', ok:'Licht aus, Spot an – ich bin dabei!' },
];
export function roleLines(m){
  if (ROLE_LINES[m.role]) return ROLE_LINES[m.role];
  const pool = m.type === 'S' ? ENS_LINES : CREW_LINES;
  return pool[hashStr(m.name + m.role) % pool.length];
}
// [name, rolle, typ, produktionen] — kompletter Cast & Crew (ohne Logge=Boss, Sebastian wählbar)
// Produktionen = echte Daten von kolpingtheater-ramsen.de/team/<Name> (Crew: Jahre seit Beitritt)
// Hinweis: Julian steht nur noch einmal im Cast (Index 8, Ensemble) — der frühere
// Technik-Doppeleintrag (alter Index 32) wurde entfernt, Save-Migration siehe state.js.
export const RAW = [
  ['Carina','Drusilla','S',11],['Elena','Lucy','S',7],['Fernanda','Tante Heideltraut','S',6],
  ['Fynn','Ensemble','S',5],['Hendrik','Karl','S',1],['Jakob','Bruno','S',2],
  ['Jonas','Vetter Viktor','S',8],['Jule','Motte','S',3],['Julian','Ensemble','S',12],
  ['Lena','Ensemble','S',3],['Lina','Fiona','S',8],['Lina K.','Ensemble','S',3],
  ['Louis','Graf Thaddäus','S',7],['Marcella','Suzie','S',2],['Max','Ensemble','S',7],
  ['Maximilian','Ensemble','S',10],['Nela','Felia','S',7],['Nele','Prinzessin Iset','S',8],
  ['Niko','Praktikant Emil','S',8],['Nora','Ensemble','S',11],['Raphael','Diener','S',5],
  ['Sophie','Mia','S',3],['Theresa','Clara','S',6],['Till','Herr Schniebli','S',7],
  ['Tobias','Jacques','S',8],['Vanessa','Ensemble','S',6],['Yunus','Dr. Adrian Düsterwald','S',6],
  ['Cathrin','Kostüme','K',2],['Christian','Bühnen- & Videotechnik','T',7],
  ['Daniel','Lichttechnik','T',6],['Florian','Lichttechnik','T',7],['Jonas','Lichttechnik','T',8],
  ['Leo','Bühnentechnik & Foto','T',5],['Philipp','Bühnentechnik','T',3],
  ['Maren','Bühnentechnik','T',2],['Wolfgang','Tontechnik','T',10],['Ursula','Tontechnik','T',10],
];
export const TOTAL = RAW.length; // 37

export const SKIN = ['#f1c9a5','#e0ac7e','#c68863','#8d5a3b'];
export const HAIR = ['#2b2421','#5b3a1e','#8a5a2b','#c9912e','#d8d3c4','#7a2f1d'];
export const SHIRT = {
  S:['#e4572e','#d33f49','#f2a541','#c75146','#e86a92'],
  T:['#4f86c6','#3c6997','#5fa8d3','#34547a','#48929b'],
  K:['#b85cc4','#9b5de5','#d264b6','#7d4fb2','#c86bfa'],
  R:['#222222'],
};

export const TYPE_COL = { S:'#ff9d76', T:'#9cc8ff', K:'#e0a3ff', R:'#ffd97a', W:'#7fe3dc' };

export const TYPE_BLURB = {
  S:'Volle Bühnenpräsenz und dramatische Monologe – Offensive pur.',
  T:'Blackout und Nebelmaschine auf Knopfdruck – Technik schlägt Schauspiel.',
  K:'Mit Fundus-Lawine und Anprobe kaum kleinzukriegen.',
};

// Zitate der gemalten Ahnen (sprechende Portraits aus CREEPSHOW)
export const AHNEN_QUOTES = [
  '„Psst! Der Graf glaubt immer noch, wir wären nur gemalt. Verrat uns nicht."',
  '„110 Jahre wird der Bengel – und benimmt sich immer noch wie ein Achtzigjähriger."',
  '„Früher gab es hier echte Spukgestalten mit Stil. Heute? Praktikanten mit Käse."',
  '„Falls Lucy fragt: Wir sind NICHT zu Hause. Keiner von uns. Niemals."',
  '„Die Mumie badet schon wieder in Eselsmilch. DREI Stunden. Wir haben auch Bedürfnisse!"',
  '„Wenn du Logge besiegst, häng bitte mein Portrait etwas höher. Neben den Grafen. Aus Gründen."',
  '„Logge versteckt sein rotes Rad hinter der Bühne. Als ob wir das nicht sehen würden. Wir sehen ALLES."',
];
