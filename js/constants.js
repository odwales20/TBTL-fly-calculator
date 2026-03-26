export const FIREBASE_URL = 'https://tbtl-fly-calc-default-rtdb.firebaseio.com';

export function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
export function escAttr(val) {
  return esc(JSON.stringify(String(val)));
}
export const FULL = 12, HALF = 6;
export const EXTENSIONS_WEIGHT = 12;
export const IWB_WEIGHT = 48;    // 8 cradle bricks × 12 kg ÷ 2 (double purchase)
export const IWB_COLOURS = [
  { id: 'magenta', label: 'Magenta', bg: '#4a044e', border: '#d946ef', text: '#e879f9' },
  { id: 'brown',   label: 'Brown',   bg: '#431407', border: '#b45309', text: '#f59e0b' },
  { id: 'yellow',  label: 'Yellow',  bg: '#422006', border: '#ca8a04', text: '#eab308' },
  { id: 'grey',    label: 'Grey',    bg: '#1e293b', border: '#64748b', text: '#94a3b8' },
  { id: 'red',     label: 'Red',     bg: '#450a0a', border: '#dc2626', text: '#f87171' },
];
export const CABLE_WEIGHT = 6;   // cable allowance: 6kg hung = 12kg CW = 1 brick in cradle
export const BAND_COLORS = [
  { id: 'green',  label: 'Green',  hex: '#22c55e' },
  { id: 'blue',   label: 'Blue',   hex: '#3b82f6' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'pink',   label: 'Pink',   hex: '#ec4899' },
  { id: 'teal',   label: 'Teal',   hex: '#14b8a6' },
  { id: 'white',  label: 'White',  hex: '#e2e8f0' },
];
export const EXCLUDED = new Set([32,34,36,38,40]);
export const BAR_IDS = Array.from({length:44}, (_,i) => i+1).filter(n => !EXCLUDED.has(n));

export const DEFAULT_FIXTURES = [
  {name:"Selecon TW1S",           weight:3.5,  category:"Lighting"},
  {name:"ETC Source Four 19°",    weight:5.0,  category:"Lighting"},
  {name:"ETC Source Four 26°",    weight:4.9,  category:"Lighting"},
  {name:"ETC Source Four 36°",    weight:4.8,  category:"Lighting"},
  {name:"ETC Source Four PAR",    weight:4.0,  category:"Lighting"},
  {name:"Generic LED Par",        weight:2.0,  category:"Lighting"},
  {name:"Chauvet Rogue R2 Wash",  weight:9.5,  category:"Lighting"},
  {name:"Martin MAC Aura",        weight:5.5,  category:"Lighting"},
  {name:"Selecon Pacific 14-35°", weight:5.8,  category:"Lighting"},
  {name:"Robert Juliat Lancelot", weight:28.0, category:"Lighting"},
  {name:"Pulsar ChromaFlood 200", weight:2.4,  category:"Lighting"},
  {name:"SL 15-32",               weight:8.0,  category:"Lighting"},
  {name:"SL 23-50",               weight:6.8,  category:"Lighting"},
  {name:"Cantata F",              weight:7.0,  category:"Lighting"},
  {name:"Chauvet Batt",           weight:4.8,  category:"Lighting"},
  {name:"B-eye",                  weight:15.0, category:"Lighting"},
  {name:"Lustr 25-50",            weight:15.1, category:"Lighting"},
  {name:"Lustr 15-30",            weight:17.0, category:"Lighting"},
  {name:"S4 26deg",               weight:7.5,  category:"Lighting"},
  {name:"S4 36deg",               weight:7.5,  category:"Lighting"},
  {name:"S4 19deg",               weight:7.5,  category:"Lighting"},
  {name:"S4 70deg",               weight:7.5,  category:"Lighting"},
  {name:"TW1",                    weight:28.5, category:"Lighting"},
  {name:"Halcyon Tit",            weight:36.0, category:"Lighting"},
  {name:"Viper NT",               weight:10.0, category:"Lighting"},
  {name:"MVS",                    weight:10.0, category:"Lighting"},
  {name:"ColorForce 72",          weight:22.0, category:"Lighting"},
  {name:"LED WW 8B",              weight:0.1,  category:"Lighting"},
  {name:"LED WW 16B",             weight:0.1,  category:"Lighting"},
  {name:"LED RGBWW 16B",          weight:0.1,  category:"Lighting"},
  {name:"Pendant Dimmer",         weight:0.1,  category:"Lighting"},
  {name:"CS Fres V",              weight:7.5,  category:"Lighting"},
  {name:"ND at 50",               weight:0.1,  category:"Lighting"},
  {name:"Nexo PS10",              weight:14.0, category:"Sound"},
  {name:"GLP Impression X5",     weight:13.3, category:"Lighting"},
  {name:"GLP Impression X5 Compact", weight:7.5, category:"Lighting"},
  {name:"White Cyc/BP",           weight:36.0, category:"Drapes", exclusive:true, defaultDead:'in'},
  {name:"Drape (per metre run)",  weight:2.5,  category:"Drapes", defaultDead:'in'},
  {name:"Tab (per metre run)",    weight:1.8,  category:"Drapes", defaultDead:'in'},
  {name:"Gauze (per metre run)",  weight:0.8,  category:"Drapes", defaultDead:'in'},
  {name:"Cable Loom (per 5m)",    weight:1.0,  category:"Set"},
  {name:"Boom Arm",               weight:1.5,  category:"Set"},
];

export const DEFAULT_POSITIONS = ['Duty Stage', 'Duty Tech', 'ASM', 'CSM', 'DSM'];

export const DEFAULT_USERS = [
  { name: 'Daymon', canEdit: true, isAdmin: false, canViewHistory: false },
  { name: 'Louis',  canEdit: true, isAdmin: false, canViewHistory: false },
  { name: 'Oliver', canEdit: true, isAdmin: true,  canViewHistory: true  },
  { name: 'Robert', canEdit: true, isAdmin: false, canViewHistory: false },
  { name: 'Symon',  canEdit: true, isAdmin: false, canViewHistory: false },
];

export const CAT_COLOURS = {Lighting:'#818cf8', Sound:'#34d399', Set:'#94a3b8', Drapes:'#f472b6'};
