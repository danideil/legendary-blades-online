// ============================================================
// MU Legends Online - 2D Engine
// Top-down 2D rendering with directional character sprites
// ============================================================

// Game State
const game = {
  socket: null,
  canvas: null,
  ctx: null,
  player: null,
  players: new Map(),
  npcs: new Map(),
  selectedTarget: null,
  keys: {},
  clock: { last: performance.now() },
  moveSpeed: 15,
  zoom: 14,            // pixels per world unit
  minimapCtx: null,
  quests: [],
  classes: {},
  tradeRoutes: [],
  skillNames: [],
  skillCooldowns: {},
  effects: [],
  time: 0
};

// Class icons and skill icons
const classIcons = {
  darkKnight: '⚔️',
  darkWizard: '🔮',
  fairyElf: '🏹',
  bicheon: '🗡️',
  heuksal: '🌙'
};

const skillIcons = {
  darkKnight: { twistingSlash: '🌀', deathStab: '🗡️', ragefulBlow: '💥', comboSlash: '⚔️' },
  darkWizard: { fireBall: '🔥', powerWave: '🌊', hellFire: '🔥', inferno: '☄️' },
  fairyElf: { tripleShot: '🏹', penetration: '➡️', iceArrow: '❄️', heal: '💚' },
  bicheon: { chainSword: '⛓️', snowFlower: '❄️', flyingDragon: '🐉', thunderAssault: '⚡' },
  heuksal: { shadowStrike: '🌑', phantomSlash: '👻', darkCloud: '☁️', assassinate: '💀' }
};

// ============================================================
// SPRITE FACTORY - pixel art drawn on offscreen canvases
// ============================================================
const spriteCache = new Map();
const PIXEL = 3; // scale factor for pixel art

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w * PIXEL;
  c.height = h * PIXEL;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PIXEL, y * PIXEL, w * PIXEL, h * PIXEL);
}

// Class visual definitions
const classLooks = {
  darkKnight: { tunic: '#a02020', pants: '#5a1010', hair: '#3a2a1a', helmet: '#777788' },
  darkWizard: { tunic: '#5a3a9a', pants: '#2a1a4a', hair: '#e0e0e0', hat: '#33206a' },
  fairyElf: { tunic: '#2a8a3a', pants: '#1a5a2a', hair: '#e8c860' },
  bicheon: { tunic: '#c07818', pants: '#6a4010', hair: '#101010' },
  heuksal: { tunic: '#6a2a8a', pants: '#2a1040', hair: '#3a1a5a' }
};

// Outfit visual overrides (dropped costumes)
const outfitLooks = {
  bandit: { tunic: '#3a3a3a', pants: '#242424', hood: '#1a1a1a' },
  knight: { tunic: '#9aa0b0', pants: '#5a6070', helmet: '#c8ccda' },
  royal: { tunic: '#c8a020', pants: '#7a3a9a', crown: '#ffd700' },
  shadow: { tunic: '#181828', pants: '#0c0c18', hood: '#282840', glow: '#8844ff' }
};

const SKIN = '#f0c8a0';
const BOOTS = '#3a2a1a';

// Character sprite: 16x22 logical pixels, 4 directions
function getCharacterSprite(cls, outfitId, dir) {
  const key = `char|${cls}|${outfitId || ''}|${dir}`;
  if (spriteCache.has(key)) return spriteCache.get(key);

  const look = { ...(classLooks[cls] || classLooks.darkKnight) };
  if (outfitId && outfitLooks[outfitId]) Object.assign(look, outfitLooks[outfitId]);

  const { c, ctx } = makeCanvas(16, 22);

  if (dir === 'left' || dir === 'right') {
    drawCharSide(ctx, cls, look);
    if (dir === 'right') {
      // mirror
      const { c: mc, ctx: mctx } = makeCanvas(16, 22);
      mctx.translate(mc.width, 0);
      mctx.scale(-1, 1);
      mctx.drawImage(c, 0, 0);
      spriteCache.set(key, mc);
      return mc;
    }
  } else if (dir === 'up') {
    drawCharBack(ctx, cls, look);
  } else {
    drawCharFront(ctx, cls, look);
  }

  spriteCache.set(key, c);
  return c;
}

function drawHeadgear(ctx, look, xOff = 0) {
  if (look.helmet) {
    px(ctx, 4 + xOff, 0, 8, 4, look.helmet);
    px(ctx, 5 + xOff, 4, 6, 1, look.helmet);
  } else if (look.hat) {
    px(ctx, 6 + xOff, -0, 4, 2, look.hat);
    px(ctx, 3 + xOff, 2, 10, 2, look.hat);
  } else if (look.hood) {
    px(ctx, 4 + xOff, 0, 8, 5, look.hood);
  } else if (look.crown) {
    px(ctx, 5 + xOff, 0, 6, 2, look.crown);
    px(ctx, 4 + xOff, 1, 8, 1, look.hair);
  } else {
    px(ctx, 4 + xOff, 0, 8, 3, look.hair);
  }
}

function drawCharFront(ctx, cls, look) {
  // head
  px(ctx, 5, 1, 6, 5, SKIN);
  drawHeadgear(ctx, look);
  // eyes
  px(ctx, 6, 4, 1, 1, '#181818');
  px(ctx, 9, 4, 1, 1, '#181818');
  // body
  px(ctx, 4, 6, 8, 7, look.tunic);
  // belt
  px(ctx, 4, 12, 8, 1, '#2a2016');
  // arms
  px(ctx, 3, 7, 1, 5, look.tunic);
  px(ctx, 12, 7, 1, 5, look.tunic);
  px(ctx, 3, 12, 1, 1, SKIN);
  px(ctx, 12, 12, 1, 1, SKIN);
  // legs
  px(ctx, 5, 13, 2, 6, look.pants);
  px(ctx, 9, 13, 2, 6, look.pants);
  // boots
  px(ctx, 5, 19, 2, 2, BOOTS);
  px(ctx, 9, 19, 2, 2, BOOTS);
  // weapon
  drawWeapon(ctx, cls, 'front');
  // outfit glow accents
  if (look.glow) {
    px(ctx, 4, 6, 1, 7, look.glow);
    px(ctx, 11, 6, 1, 7, look.glow);
  }
}

function drawCharBack(ctx, cls, look) {
  // head (no face)
  px(ctx, 5, 1, 6, 5, SKIN);
  drawHeadgear(ctx, look);
  px(ctx, 5, 3, 6, 3, look.hood || look.helmet || look.hair); // hair covers back
  // body
  px(ctx, 4, 6, 8, 7, look.tunic);
  px(ctx, 4, 12, 8, 1, '#2a2016');
  // arms
  px(ctx, 3, 7, 1, 5, look.tunic);
  px(ctx, 12, 7, 1, 5, look.tunic);
  // legs
  px(ctx, 5, 13, 2, 6, look.pants);
  px(ctx, 9, 13, 2, 6, look.pants);
  px(ctx, 5, 19, 2, 2, BOOTS);
  px(ctx, 9, 19, 2, 2, BOOTS);
  drawWeapon(ctx, cls, 'back');
  if (look.glow) {
    px(ctx, 4, 6, 1, 7, look.glow);
    px(ctx, 11, 6, 1, 7, look.glow);
  }
}

function drawCharSide(ctx, cls, look) {
  // facing LEFT
  // head
  px(ctx, 5, 1, 6, 5, SKIN);
  drawHeadgear(ctx, look);
  // one eye
  px(ctx, 6, 4, 1, 1, '#181818');
  // body (narrower)
  px(ctx, 5, 6, 6, 7, look.tunic);
  px(ctx, 5, 12, 6, 1, '#2a2016');
  // front arm
  px(ctx, 4, 7, 1, 5, look.tunic);
  px(ctx, 4, 12, 1, 1, SKIN);
  // legs
  px(ctx, 6, 13, 2, 6, look.pants);
  px(ctx, 8, 13, 2, 6, look.pants);
  px(ctx, 6, 19, 2, 2, BOOTS);
  px(ctx, 8, 19, 2, 2, BOOTS);
  drawWeapon(ctx, cls, 'side');
  if (look.glow) {
    px(ctx, 5, 6, 1, 7, look.glow);
  }
}

function drawWeapon(ctx, cls, view) {
  const isSword = (cls === 'darkKnight' || cls === 'bicheon');
  if (isSword) {
    if (view === 'side') {
      px(ctx, 1, 5, 1, 8, '#c8c8d0');
      px(ctx, 0, 12, 3, 1, '#8a6a20');
    } else {
      const x = view === 'back' ? 2 : 13;
      px(ctx, x, 4, 1, 9, '#c8c8d0');
      px(ctx, x - 1, 12, 3, 1, '#8a6a20');
    }
  } else if (cls === 'darkWizard') {
    const x = view === 'side' ? 1 : (view === 'back' ? 2 : 13);
    px(ctx, x, 3, 1, 12, '#6a4a20');
    px(ctx, x - 1, 1, 3, 3, '#aa66ff');
  } else if (cls === 'fairyElf') {
    const x = view === 'side' ? 1 : (view === 'back' ? 2 : 13);
    px(ctx, x, 4, 1, 8, '#8a6a30');
    px(ctx, x - 1, 4, 1, 1, '#8a6a30');
    px(ctx, x - 1, 11, 1, 1, '#8a6a30');
  } else if (cls === 'heuksal') {
    if (view !== 'back') {
      const x = view === 'side' ? 2 : 13;
      px(ctx, x, 8, 1, 4, '#b0b0b8');
    }
  }
}

// ---------- Monster sprites (single front image, flipped for direction) ----------
const monsterDefs = {
  budgeDragon:  { size: 16, draw: (ctx) => drawDragonSprite(ctx, '#d07030', '#f0a050') },
  spider:       { size: 16, draw: (ctx) => drawSpiderSprite(ctx, '#3a3a4a', '#ff3333') },
  hound:        { size: 16, draw: (ctx) => drawHoundSprite(ctx, '#7a4020', '#ff5522') },
  goldenGoblin: { size: 16, draw: (ctx) => drawGoblinSprite(ctx, '#e8c020', '#a08010') },
  lichenKing:   { size: 20, draw: (ctx) => drawHumanoidMonster(ctx, '#2a7a2a', '#1a4a1a', '#88ff88') },
  ghostPhantom: { size: 16, draw: (ctx) => drawGhostSprite(ctx, '#a0c0e8', '#5a7aa8') },
  shadowMaster: { size: 20, draw: (ctx) => drawHumanoidMonster(ctx, '#282838', '#181820', '#aa66ff') },
  deathKnight:  { size: 20, draw: (ctx) => drawKnightSprite(ctx, '#5a5a6a', '#8a2be2') },
  kundun:       { size: 28, draw: (ctx) => drawDemonSprite(ctx, '#a02020', '#ffcc00') },
  tigerGirl:    { size: 18, draw: (ctx) => drawHumanoidMonster(ctx, '#e07030', '#8a4010', '#ffffff') },
  bandit:       { size: 18, draw: (ctx) => drawHumanoidMonster(ctx, '#4a4038', '#2a241e', '#ff8888') },
  eliteThief:   { size: 18, draw: (ctx) => drawHumanoidMonster(ctx, '#32424a', '#1a262e', '#88ffff') }
};

function getMonsterSprite(type, flip) {
  const key = `mon|${type}|${flip ? 'f' : ''}`;
  if (spriteCache.has(key)) return spriteCache.get(key);

  const def = monsterDefs[type] || monsterDefs.hound;
  const { c, ctx } = makeCanvas(def.size, def.size);
  def.draw(ctx);

  if (flip) {
    const { c: mc, ctx: mctx } = makeCanvas(def.size, def.size);
    mctx.translate(mc.width, 0);
    mctx.scale(-1, 1);
    mctx.drawImage(c, 0, 0);
    spriteCache.set(key, mc);
    return mc;
  }
  spriteCache.set(key, c);
  return c;
}

function drawDragonSprite(ctx, body, belly) {
  px(ctx, 4, 6, 8, 7, body);       // body
  px(ctx, 6, 9, 4, 4, belly);      // belly
  px(ctx, 5, 2, 6, 5, body);       // head
  px(ctx, 6, 4, 1, 1, '#ff2020');  // eye
  px(ctx, 9, 4, 1, 1, '#ff2020');
  px(ctx, 7, 6, 2, 1, '#f8e8a0');  // beak
  px(ctx, 1, 6, 3, 4, body);       // left wing
  px(ctx, 12, 6, 3, 4, body);      // right wing
  px(ctx, 5, 13, 2, 2, body);      // feet
  px(ctx, 9, 13, 2, 2, body);
}

function drawSpiderSprite(ctx, body, eyes) {
  px(ctx, 5, 6, 6, 5, body);       // abdomen
  px(ctx, 6, 3, 4, 4, body);       // head
  px(ctx, 6, 4, 1, 1, eyes);
  px(ctx, 9, 4, 1, 1, eyes);
  // legs
  for (let i = 0; i < 4; i++) {
    px(ctx, 1, 5 + i * 2, 4, 1, body);
    px(ctx, 11, 5 + i * 2, 4, 1, body);
  }
}

function drawHoundSprite(ctx, body, eyes) {
  px(ctx, 3, 7, 10, 5, body);      // body
  px(ctx, 11, 4, 4, 4, body);      // head
  px(ctx, 12, 5, 1, 1, eyes);
  px(ctx, 11, 2, 1, 2, body);      // ear
  px(ctx, 13, 2, 1, 2, body);
  px(ctx, 1, 7, 2, 2, body);       // tail
  px(ctx, 4, 12, 2, 3, body);      // legs
  px(ctx, 10, 12, 2, 3, body);
}

function drawGoblinSprite(ctx, body, dark) {
  px(ctx, 4, 6, 8, 6, body);       // round body
  px(ctx, 5, 2, 6, 5, body);       // head
  px(ctx, 2, 2, 2, 3, body);       // big ears
  px(ctx, 12, 2, 2, 3, body);
  px(ctx, 6, 4, 1, 1, '#181818');
  px(ctx, 9, 4, 1, 1, '#181818');
  px(ctx, 7, 5, 2, 1, dark);       // grin
  px(ctx, 5, 12, 2, 3, dark);      // feet
  px(ctx, 9, 12, 2, 3, dark);
  px(ctx, 12, 8, 3, 2, '#ffd700'); // money bag
}

function drawGhostSprite(ctx, body, dark) {
  px(ctx, 4, 2, 8, 10, body);
  px(ctx, 3, 4, 1, 6, body);
  px(ctx, 12, 4, 1, 6, body);
  // wavy bottom
  px(ctx, 4, 12, 2, 2, body);
  px(ctx, 8, 12, 2, 2, body);
  px(ctx, 6, 12, 2, 1, dark);
  px(ctx, 10, 12, 2, 1, dark);
  px(ctx, 6, 5, 1, 2, '#101020');  // eyes
  px(ctx, 9, 5, 1, 2, '#101020');
}

function drawHumanoidMonster(ctx, tunic, pants, eyeColor) {
  const s = 2; // offset for larger canvas
  px(ctx, 5 + s, 1, 6, 5, '#c8a880');   // head
  px(ctx, 4 + s, 0, 8, 2, pants);       // hood/hair
  px(ctx, 6 + s, 3, 1, 1, eyeColor);
  px(ctx, 9 + s, 3, 1, 1, eyeColor);
  px(ctx, 4 + s, 6, 8, 7, tunic);       // body
  px(ctx, 3 + s, 7, 1, 5, tunic);       // arms
  px(ctx, 12 + s, 7, 1, 5, tunic);
  px(ctx, 5 + s, 13, 2, 5, pants);      // legs
  px(ctx, 9 + s, 13, 2, 5, pants);
  px(ctx, 13 + s, 4, 1, 9, '#b0b0b8'); // weapon
}

function drawKnightSprite(ctx, armor, glow) {
  const s = 2;
  px(ctx, 5 + s, 0, 6, 6, armor);       // helmet
  px(ctx, 6 + s, 3, 4, 1, glow);        // visor glow
  px(ctx, 4 + s, 6, 8, 8, armor);       // armor body
  px(ctx, 3 + s, 7, 1, 6, armor);
  px(ctx, 12 + s, 7, 1, 6, armor);
  px(ctx, 5 + s, 14, 2, 5, '#3a3a44'); // legs
  px(ctx, 9 + s, 14, 2, 5, '#3a3a44');
  px(ctx, 14 + s, 2, 1, 12, '#d0d0d8'); // big sword
  px(ctx, 13 + s, 12, 3, 1, '#8a6a20');
}

function drawDemonSprite(ctx, body, eyes) {
  // Kundun - big demon 28x28
  px(ctx, 8, 6, 12, 12, body);          // torso
  px(ctx, 10, 1, 8, 6, body);           // head
  px(ctx, 8, 0, 2, 3, '#181818');       // horns
  px(ctx, 18, 0, 2, 3, '#181818');
  px(ctx, 11, 3, 2, 2, eyes);           // glowing eyes
  px(ctx, 15, 3, 2, 2, eyes);
  px(ctx, 5, 7, 3, 8, body);            // arms
  px(ctx, 20, 7, 3, 8, body);
  px(ctx, 4, 14, 2, 3, '#181818');      // claws
  px(ctx, 22, 14, 2, 3, '#181818');
  px(ctx, 10, 18, 3, 8, '#701515');     // legs
  px(ctx, 15, 18, 3, 8, '#701515');
  px(ctx, 9, 26, 4, 2, '#181818');
  px(ctx, 15, 26, 4, 2, '#181818');
}

// ---------- Object sprites (single image) ----------
function getObjectSprite(kind) {
  const key = `obj|${kind}`;
  if (spriteCache.has(key)) return spriteCache.get(key);

  let result;
  if (kind === 'tree') {
    const { c, ctx } = makeCanvas(20, 26);
    px(ctx, 8, 16, 4, 10, '#6a4a2a');       // trunk
    px(ctx, 3, 2, 14, 14, '#2a7a2a');       // canopy
    px(ctx, 5, 0, 10, 4, '#2a7a2a');
    px(ctx, 1, 6, 4, 8, '#2a7a2a');
    px(ctx, 15, 6, 4, 8, '#2a7a2a');
    px(ctx, 5, 4, 4, 4, '#38963a');         // highlights
    px(ctx, 11, 8, 4, 3, '#38963a');
    result = c;
  } else if (kind === 'rock') {
    const { c, ctx } = makeCanvas(14, 10);
    px(ctx, 2, 3, 10, 7, '#8a8a92');
    px(ctx, 4, 1, 6, 3, '#8a8a92');
    px(ctx, 4, 3, 3, 2, '#a8a8b0');
    px(ctx, 3, 8, 8, 2, '#6a6a72');
    result = c;
  } else if (kind === 'building') {
    const { c, ctx } = makeCanvas(44, 36);
    px(ctx, 4, 14, 36, 22, '#c8a878');       // walls
    px(ctx, 2, 6, 40, 9, '#8a2020');         // roof
    px(ctx, 6, 2, 32, 5, '#a03030');
    px(ctx, 19, 26, 7, 10, '#5a3a1a');       // door
    px(ctx, 8, 18, 6, 6, '#88bbdd');         // windows
    px(ctx, 30, 18, 6, 6, '#88bbdd');
    px(ctx, 8, 17, 6, 1, '#6a4a2a');
    px(ctx, 30, 17, 6, 1, '#6a4a2a');
    result = c;
  } else if (kind === 'portal') {
    const { c, ctx } = makeCanvas(20, 26);
    px(ctx, 2, 2, 16, 22, '#7733bb');
    px(ctx, 4, 4, 12, 18, '#aa66ff');
    px(ctx, 6, 6, 8, 14, '#ddbbff');
    px(ctx, 8, 9, 4, 8, '#ffffff');
    result = c;
  } else if (kind === 'torch') {
    const { c, ctx } = makeCanvas(6, 16);
    px(ctx, 2, 6, 2, 10, '#6a4a2a');
    px(ctx, 1, 4, 4, 3, '#444444');
    px(ctx, 1, 1, 4, 4, '#ff8820');
    px(ctx, 2, 0, 2, 3, '#ffcc40');
    result = c;
  }

  spriteCache.set(key, result);
  return result;
}

// ============================================================
// WORLD MAP - water lakes are inaccessible
// ============================================================
const lakes = [
  { x: 70, z: -60, r: 22 },
  { x: -90, z: 70, r: 26 },
  { x: -50, z: -120, r: 18 },
  { x: 130, z: 100, r: 24 }
];

const worldObjects = [];

function buildWorld() {
  // Town buildings
  worldObjects.push({ kind: 'building', x: 0, z: -20, name: 'Lorencia Inn', blockW: 14, blockH: 8 });
  worldObjects.push({ kind: 'building', x: -25, z: 10, name: 'Chaos Machine', blockW: 14, blockH: 8 });
  worldObjects.push({ kind: 'building', x: 25, z: 10, name: 'Shop', blockW: 14, blockH: 8 });

  // Portals
  worldObjects.push({ kind: 'portal', x: 0, z: 200, name: 'Kundun Lair' });
  worldObjects.push({ kind: 'portal', x: 150, z: 0, name: 'Death Knight Arena' });

  // Trees - deterministic positions (few, as requested)
  let seed = 12345;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 60; i++) {
    const x = (rand() - 0.5) * 440;
    const z = (rand() - 0.5) * 440;
    if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;         // keep town clear
    if (lakes.some(l => Math.hypot(x - l.x, z - l.z) < l.r + 6)) continue;
    worldObjects.push({ kind: 'tree', x, z });
  }

  // Rocks
  for (let i = 0; i < 20; i++) {
    const x = (rand() - 0.5) * 400;
    const z = (rand() - 0.5) * 400;
    if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;
    if (lakes.some(l => Math.hypot(x - l.x, z - l.z) < l.r + 4)) continue;
    worldObjects.push({ kind: 'rock', x, z });
  }

  // Torches around town
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    worldObjects.push({ kind: 'torch', x: Math.cos(angle) * 38, z: Math.sin(angle) * 38 });
  }
}

function isWater(x, z) {
  return lakes.some(l => Math.hypot(x - l.x, z - l.z) < l.r);
}

function isBlocked(x, z) {
  if (Math.abs(x) > 245 || Math.abs(z) > 245) return true;
  if (isWater(x, z)) return true;
  // buildings block
  for (const obj of worldObjects) {
    if (obj.blockW && Math.abs(x - obj.x) < obj.blockW / 2 && Math.abs(z - obj.z) < obj.blockH / 2) {
      return true;
    }
  }
  return false;
}

// tile hash for grass variation
function tileHash(tx, tz) {
  let h = tx * 374761393 + tz * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// ============================================================
// SOCKET
// ============================================================
function initSocket() {
  game.socket = io();

  game.socket.on('connect', () => {
    console.log('Connected to MU Server');
    document.getElementById('online-count').textContent = '1';
  });

  game.socket.on('gameState', (data) => {
    game.player = data.player;
    game.quests = data.quests;
    game.classes = data.classes;
    game.tradeRoutes = data.tradeRoutes;
    game.skillNames = Object.keys(game.player.skills);
    initEntity(game.player);

    data.players.forEach(p => {
      initEntity(p);
      game.players.set(p.id, p);
    });

    data.npcs.forEach(npc => {
      initEntity(npc);
      game.npcs.set(npc.id, npc);
    });

    updateUI();
    updateQuestPanel();
    updateTradeRoutes();
    addChatMessage(null, `Welcome to MU Legends, ${game.player.name}!`, 'system');
    addChatMessage(null, `You are a Level ${game.player.level} ${game.classes[game.player.class].name}`, 'system');
  });

  game.socket.on('playerJoined', (player) => {
    initEntity(player);
    game.players.set(player.id, player);
    addChatMessage(null, `${player.name} has entered the game`, 'system');
    document.getElementById('online-count').textContent = game.players.size + 1;
  });

  game.socket.on('playerLeft', (data) => {
    const player = game.players.get(data.id);
    if (player) {
      game.players.delete(data.id);
      addChatMessage(null, `${player.name} has left the game`, 'system');
      document.getElementById('online-count').textContent = game.players.size + 1;
    }
  });

  game.socket.on('playerMoved', (data) => {
    const player = game.players.get(data.id);
    if (player) {
      player.position = data.position;
      player.rotation = data.rotation;
      player.velocity = data.velocity;
    }
  });

  game.socket.on('npcUpdate', (npcStates) => {
    npcStates.forEach(state => {
      const npc = game.npcs.get(state.id);
      if (npc) {
        npc.position = state.position;
        npc.rotation = state.rotation;
        npc.state = state.state;
        npc.health = state.health;
        npc.maxHealth = state.maxHealth;
        npc.dead = state.dead;
      }
    });
  });

  game.socket.on('npcRespawn', (data) => {
    const npc = game.npcs.get(data.id);
    if (npc) {
      npc.position = data.position;
      npc.health = data.health;
      npc.maxHealth = data.maxHealth;
      npc.dead = false;
    }
  });

  game.socket.on('combatResult', (data) => {
    const type = data.critical ? 'critical' : 'damage';
    showDamageNumber(data.defenderId, data.damage, type);

    if (game.selectedTarget && game.selectedTarget.id === data.defenderId) {
      updateTargetUI();
    }

    if (data.combo > 1 && data.attackerId === game.player?.id) {
      showCombo(data.combo);
    }

    if (data.killed && data.attackerId === game.player?.id) {
      addChatMessage(null, `Defeated target!`, 'system');
      const target = game.npcs.get(data.defenderId) || game.players.get(data.defenderId);
      if (target?.position) {
        createDeathEffect(target.position);
      }
    }
  });

  game.socket.on('xpGained', (data) => {
    showDamageNumber(game.player.id, `+${data.amount} EXP`, 'xp');
    if (data.goldGained) {
      showDamageNumber(game.player.id, `+${data.goldGained} Zen`, 'gold');
      game.player.gold += data.goldGained;
      game.player.zen = game.player.gold;
    }

    game.player.xp = data.totalXp;
    game.player.xpToLevel = data.xpToLevel;
    game.player.freeStatPoints = data.freeStatPoints;

    if (data.leveledUp) {
      game.player.level = data.newLevel;
      showLevelUp(data.newLevel);
      createLevelUpEffect();
    }

    if (data.drops && data.drops.length > 0) {
      data.drops.forEach(item => {
        showItemNotification(item);
      });
    }

    updateUI();
  });

  game.socket.on('statsUpdate', (data) => {
    if (data.health !== undefined) game.player.health = data.health;
    if (data.mana !== undefined) game.player.mana = data.mana;
    if (data.maxHealth !== undefined) game.player.maxHealth = data.maxHealth;
    if (data.maxMana !== undefined) game.player.maxMana = data.maxMana;
    if (data.stats !== undefined) game.player.stats = data.stats;
    if (data.statPoints !== undefined) game.player.statPoints = data.statPoints;
    if (data.freeStatPoints !== undefined) game.player.freeStatPoints = data.freeStatPoints;
    if (data.combo !== undefined) game.player.comboCount = data.combo;
    updateUI();
  });

  game.socket.on('inventoryUpdate', (data) => {
    game.player.inventory = data.inventory;
    if (data.gold !== undefined) {
      game.player.gold = data.gold;
      game.player.zen = data.gold;
    }
    updateInventoryUI();
    updateSkillBarItems();
  });

  game.socket.on('equipmentUpdate', (data) => {
    game.player.equipment = data.equipment;
    game.player.stats = data.stats;
    updateCharacterUI();
  });

  game.socket.on('questUpdate', (data) => {
    game.player.quests = data.quests;
    updateQuestTracker();
    updateQuestPanel();
  });

  game.socket.on('questCompleted', (data) => {
    addChatMessage(null, `Quest Complete: "${data.quest.name}"`, 'system');
    addChatMessage(null, `Rewards: ${data.rewards.xp} EXP, ${data.rewards.gold} Zen`, 'drop');
  });

  game.socket.on('playerDied', () => {
    showDeathScreen();
  });

  game.socket.on('playerRespawn', (data) => {
    game.player.position = data.position;
    game.player.health = data.health;
    game.player.mana = data.mana;
    game.player.xp = data.xp;
    game.player.dead = false;

    document.getElementById('xp-lost').textContent = data.xpLost;

    setTimeout(() => {
      hideDeathScreen();
    }, 500);

    updateUI();
  });

  game.socket.on('chatMessage', (data) => {
    addChatMessage(data.playerName, data.message, 'normal', data.playerClass, data.level);
  });

  game.socket.on('combatError', (data) => {
    addChatMessage(null, data.error, 'system');
  });

  game.socket.on('gameError', (data) => {
    addChatMessage(null, data.error, 'system');
  });

  game.socket.on('jobUpdate', (data) => {
    game.player.job = data.job;
    document.getElementById('current-job').textContent = data.job || 'None';
  });

  game.socket.on('enhanceResult', (data) => {
    const resultDiv = document.getElementById('enhance-result');
    if (data.success) {
      resultDiv.textContent = `Success! Item enhanced to +${data.newEnhancement}`;
      resultDiv.className = 'success';
    } else if (data.destroyed) {
      resultDiv.textContent = 'Item destroyed!';
      resultDiv.className = 'fail';
    } else {
      resultDiv.textContent = `Failed! Item downgraded to +${data.newEnhancement}`;
      resultDiv.className = 'fail';
    }
  });
}

function initEntity(ent) {
  ent.facing = 'down';
  ent.animPhase = 0;
  ent.lastPos = { x: ent.position.x, z: ent.position.z };
}

// ============================================================
// 2D RENDERING
// ============================================================
function initScene() {
  game.canvas = document.createElement('canvas');
  game.canvas.id = 'game-canvas';
  game.canvas.style.display = 'block';
  document.getElementById('game-container').appendChild(game.canvas);
  game.ctx = game.canvas.getContext('2d');

  resizeCanvas();
  buildWorld();

  game.minimapCtx = document.getElementById('minimap-canvas')?.getContext('2d');
}

function resizeCanvas() {
  game.canvas.width = window.innerWidth;
  game.canvas.height = window.innerHeight;
  game.ctx.imageSmoothingEnabled = false;
  // Smaller screens see a bit less world
  game.zoom = window.innerWidth < 600 ? 11 : 14;
}

function worldToScreen(x, z) {
  const cam = game.player.position;
  return {
    x: game.canvas.width / 2 + (x - cam.x) * game.zoom,
    y: game.canvas.height / 2 + (z - cam.z) * game.zoom
  };
}

function screenToWorld(sx, sy) {
  const cam = game.player.position;
  return {
    x: cam.x + (sx - game.canvas.width / 2) / game.zoom,
    z: cam.z + (sy - game.canvas.height / 2) / game.zoom
  };
}

const TILE = 4; // world units per tile

function drawTerrain(ctx) {
  const cam = game.player.position;
  const halfW = game.canvas.width / 2 / game.zoom;
  const halfH = game.canvas.height / 2 / game.zoom;

  const minTx = Math.floor((cam.x - halfW) / TILE) - 1;
  const maxTx = Math.floor((cam.x + halfW) / TILE) + 1;
  const minTz = Math.floor((cam.z - halfH) / TILE) - 1;
  const maxTz = Math.floor((cam.z + halfH) / TILE) + 1;

  const tilePx = TILE * game.zoom;

  for (let tx = minTx; tx <= maxTx; tx++) {
    for (let tz = minTz; tz <= maxTz; tz++) {
      const wx = tx * TILE + TILE / 2;
      const wz = tz * TILE + TILE / 2;
      const s = worldToScreen(tx * TILE, tz * TILE);

      if (Math.abs(wx) > 248 || Math.abs(wz) > 248) {
        // out of world - dark
        ctx.fillStyle = '#1a2a1a';
        ctx.fillRect(s.x, s.y, tilePx + 1, tilePx + 1);
        continue;
      }

      if (isWater(wx, wz)) {
        // animated water
        const wave = Math.sin(game.time * 2 + tx * 1.7 + tz * 2.3) * 0.5 + 0.5;
        ctx.fillStyle = wave > 0.6 ? '#3a6ac8' : '#2a56b0';
        ctx.fillRect(s.x, s.y, tilePx + 1, tilePx + 1);
        if (wave > 0.85) {
          ctx.fillStyle = '#5a8ae0';
          ctx.fillRect(s.x + tilePx * 0.2, s.y + tilePx * 0.4, tilePx * 0.3, tilePx * 0.1);
        }
        continue;
      }

      // town dirt area
      const distTown = Math.hypot(wx, wz);
      const h = tileHash(tx, tz);
      if (distTown < 36) {
        ctx.fillStyle = h > 0.5 ? '#b09468' : '#a48a5e';
      } else {
        // grass variants
        if (h > 0.85) ctx.fillStyle = '#4a9a4a';
        else if (h > 0.4) ctx.fillStyle = '#42883e';
        else ctx.fillStyle = '#3c7c3a';
      }
      ctx.fillRect(s.x, s.y, tilePx + 1, tilePx + 1);

      // grass detail specks
      if (h > 0.7 && distTown >= 36) {
        ctx.fillStyle = '#2e6a2e';
        ctx.fillRect(s.x + tilePx * (h % 0.3) * 3, s.y + tilePx * 0.3, 3, 3);
      }
    }
  }

  // water edges (shoreline)
  lakes.forEach(l => {
    const s = worldToScreen(l.x, l.z);
    const rp = l.r * game.zoom;
    if (s.x + rp < 0 || s.x - rp > game.canvas.width || s.y + rp < 0 || s.y - rp > game.canvas.height) return;
    ctx.strokeStyle = '#d8c890';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, rp, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function getFacing(dx, dz) {
  if (Math.abs(dx) > Math.abs(dz)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dz < 0 ? 'up' : 'down';
}

function updateEntityFacing(ent, dt) {
  const dx = ent.position.x - ent.lastPos.x;
  const dz = ent.position.z - ent.lastPos.z;
  const moved = Math.abs(dx) + Math.abs(dz) > 0.01;
  if (moved) {
    ent.facing = getFacing(dx, dz);
    ent.animPhase = (ent.animPhase || 0) + dt * 10;
  }
  ent.moving = moved;
  ent.lastPos.x = ent.position.x;
  ent.lastPos.z = ent.position.z;
}

function drawCharacter(ctx, ent, isLocal) {
  const s = worldToScreen(ent.position.x, ent.position.z);
  const outfitId = ent.equipment?.outfit?.outfitId || null;
  const sprite = getCharacterSprite(ent.class, outfitId, ent.facing || 'down');

  const scale = game.zoom / 14;
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const bob = ent.moving ? Math.sin(ent.animPhase * 2) * 2 * scale : 0;

  // selection ring
  if (game.selectedTarget && game.selectedTarget.id === ent.id) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, w * 0.5, w * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + 2, w * 0.35, w * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(sprite, s.x - w / 2, s.y - h + bob, w, h);

  // wings indicator (glow behind player if wings equipped)
  if (ent.equipment?.wings) {
    ctx.fillStyle = 'rgba(170,120,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - h * 0.65, w * 0.75, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // name
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  const label = `${ent.name} [${ent.level}]`;
  ctx.strokeText(label, s.x, s.y - h - 6);
  ctx.fillStyle = isLocal ? '#ffe860' : '#7ae0ff';
  ctx.fillText(label, s.x, s.y - h - 6);
}

function drawMonster(ctx, npc) {
  const s = worldToScreen(npc.position.x, npc.position.z);
  const flip = npc.facing === 'right';
  const sprite = getMonsterSprite(npc.type, flip);

  const scale = (game.zoom / 14) * (npc.boss ? 1.6 : 1);
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const bob = npc.moving ? Math.sin(npc.animPhase * 2) * 2 * scale : 0;

  if (game.selectedTarget && game.selectedTarget.id === npc.id) {
    ctx.strokeStyle = '#ff4040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, w * 0.5, w * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // boss aura
  if (npc.boss) {
    const pulse = Math.sin(game.time * 3) * 0.15 + 0.35;
    ctx.fillStyle = `rgba(255,0,0,${pulse})`;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2, w * 0.6, w * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + 2, w * 0.35, w * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(sprite, s.x - w / 2, s.y - h + bob, w, h);

  // health bar
  const hpPct = Math.max(0, npc.health / npc.maxHealth);
  const barW = Math.max(30, w * 0.8);
  ctx.fillStyle = '#000';
  ctx.fillRect(s.x - barW / 2 - 1, s.y - h - 10, barW + 2, 6);
  ctx.fillStyle = npc.boss ? '#ff2020' : '#cc3030';
  ctx.fillRect(s.x - barW / 2, s.y - h - 9, barW * hpPct, 4);

  // name
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  const label = `${npc.name} [${npc.level}]`;
  ctx.strokeText(label, s.x, s.y - h - 14);
  ctx.fillStyle = npc.boss ? '#ff5050' : (npc.rare ? '#ffd700' : '#ffb0b0');
  ctx.fillText(label, s.x, s.y - h - 14);
}

function drawObject(ctx, obj) {
  const sprite = getObjectSprite(obj.kind);
  if (!sprite) return;
  const s = worldToScreen(obj.x, obj.z);
  const scale = game.zoom / 14;
  const w = sprite.width * scale;
  const h = sprite.height * scale;

  if (s.x + w < 0 || s.x - w > game.canvas.width || s.y + h < 0 || s.y - h > game.canvas.height) return;

  // portal glow animation
  if (obj.kind === 'portal') {
    const pulse = Math.sin(game.time * 4) * 0.2 + 0.5;
    ctx.fillStyle = `rgba(170,100,255,${pulse})`;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, w * 0.8, h * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // torch flicker
  if (obj.kind === 'torch') {
    const flick = Math.sin(game.time * 12 + obj.x) * 0.1 + 0.3;
    ctx.fillStyle = `rgba(255,150,40,${flick})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y - h * 0.8, w * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.drawImage(sprite, s.x - w / 2, s.y - h, w, h);

  if (obj.name) {
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.strokeText(obj.name, s.x, s.y - h - 4);
    ctx.fillStyle = obj.kind === 'portal' ? '#dd99ff' : '#ffd700';
    ctx.fillText(obj.name, s.x, s.y - h - 4);
  }
}

function render() {
  const ctx = game.ctx;
  if (!game.player) return;

  drawTerrain(ctx);

  // collect drawables and sort by world z (depth)
  const drawables = [];

  worldObjects.forEach(obj => {
    drawables.push({ z: obj.z, type: 'object', ref: obj });
  });

  game.npcs.forEach(npc => {
    if (!npc.dead) drawables.push({ z: npc.position.z, type: 'npc', ref: npc });
  });

  game.players.forEach(p => {
    drawables.push({ z: p.position.z, type: 'player', ref: p });
  });

  drawables.push({ z: game.player.position.z, type: 'localPlayer', ref: game.player });

  drawables.sort((a, b) => a.z - b.z);

  drawables.forEach(d => {
    if (d.type === 'object') drawObject(ctx, d.ref);
    else if (d.type === 'npc') drawMonster(ctx, d.ref);
    else if (d.type === 'player') drawCharacter(ctx, d.ref, false);
    else drawCharacter(ctx, d.ref, true);
  });

  // effects (particles)
  game.effects = game.effects.filter(ef => {
    ef.life -= 0.016;
    if (ef.life <= 0) return false;
    ef.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      const s = worldToScreen(ef.x, ef.z);
      ctx.globalAlpha = Math.max(0, ef.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(s.x + p.x, s.y + p.y - 20, 4, 4);
    });
    ctx.globalAlpha = 1;
    return true;
  });
}

// ============================================================
// EFFECTS
// ============================================================
function createDeathEffect(position) {
  const particles = [];
  for (let i = 0; i < 15; i++) {
    particles.push({
      x: 0, y: 0,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 5,
      color: Math.random() > 0.5 ? '#ff3030' : '#aa1010'
    });
  }
  game.effects.push({ x: position.x, z: position.z, particles, life: 1 });
}

function createLevelUpEffect() {
  if (!game.player) return;
  const particles = [];
  for (let i = 0; i < 25; i++) {
    particles.push({
      x: (Math.random() - 0.5) * 40, y: 0,
      vx: (Math.random() - 0.5) * 2,
      vy: -Math.random() * 6 - 2,
      color: Math.random() > 0.5 ? '#ffd700' : '#fff8a0'
    });
  }
  game.effects.push({ x: game.player.position.x, z: game.player.position.z, particles, life: 1.5 });
}

// ============================================================
// INPUT
// ============================================================
function setupInput() {
  document.addEventListener('keydown', (e) => {
    game.keys[e.code] = true;

    if (document.activeElement === document.getElementById('chat-input')) {
      if (e.code === 'Enter') {
        sendChatMessage();
      }
      return;
    }

    if (e.code === 'Digit1') useSkill(0);
    if (e.code === 'Digit2') useSkill(1);
    if (e.code === 'Digit3') useSkill(2);
    if (e.code === 'Digit4') useSkill(3);

    if (e.code === 'F1') { e.preventDefault(); useItem('Small Heal Potion'); }
    if (e.code === 'F2') { e.preventDefault(); useItem('Small Mana Potion'); }
    if (e.code === 'F3') { e.preventDefault(); useItem('Heal Potion'); }
    if (e.code === 'F4') { e.preventDefault(); useItem('Mana Potion'); }

    if (e.code === 'KeyI') togglePanel('inventory-panel');
    if (e.code === 'KeyC') togglePanel('character-panel');
    if (e.code === 'KeyQ') togglePanel('quest-panel');
    if (e.code === 'KeyJ') togglePanel('job-panel');
    if (e.code === 'KeyE') togglePanel('enhance-panel');

    if (e.code === 'Enter') {
      document.getElementById('chat-input').focus();
    }

    if (e.code === 'Tab') {
      e.preventDefault();
      cycleTargets();
    }

    if (e.code === 'Escape') {
      deselectTarget();
      closeAllPanels();
    }
  });

  document.addEventListener('keyup', (e) => {
    game.keys[e.code] = false;
  });

  game.canvas.addEventListener('click', (e) => {
    handleClick(e.clientX, e.clientY);
  });

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('wheel', (e) => {
    game.zoom = Math.max(8, Math.min(24, game.zoom - e.deltaY * 0.01));
  });

  window.addEventListener('resize', resizeCanvas);

  // UI buttons
  document.getElementById('inventory-btn').addEventListener('click', () => togglePanel('inventory-panel'));
  document.getElementById('character-btn').addEventListener('click', () => togglePanel('character-panel'));
  document.getElementById('quest-btn').addEventListener('click', () => togglePanel('quest-panel'));
  document.getElementById('job-btn').addEventListener('click', () => togglePanel('job-panel'));
  document.getElementById('enhance-btn').addEventListener('click', () => togglePanel('enhance-panel'));

  document.getElementById('stat-points-indicator')?.addEventListener('click', () => {
    togglePanel('character-panel');
  });

  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.panel').classList.add('hidden');
    });
  });

  document.querySelectorAll('.stat-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (game.player.freeStatPoints > 0) {
        game.socket.emit('allocateStat', { stat: btn.dataset.stat });
      }
    });
  });

  document.querySelectorAll('.skill-slot:not(.item-slot)').forEach((slot, index) => {
    slot.addEventListener('click', () => useSkill(index));
  });

  document.querySelectorAll('.skill-slot.item-slot').forEach(slot => {
    slot.addEventListener('click', () => useItem(slot.dataset.item));
  });

  document.querySelectorAll('.job-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.job-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      game.socket.emit('setJob', { job: option.dataset.job });
    });
  });

  document.getElementById('clear-job')?.addEventListener('click', () => {
    document.querySelectorAll('.job-option').forEach(o => o.classList.remove('selected'));
    game.socket.emit('setJob', { job: null });
  });

  setupMobileControls();
}

// Click / tap hit testing in 2D
function handleClick(sx, sy) {
  let best = null;
  let bestDist = Infinity;

  const testEntity = (ent, type) => {
    const s = worldToScreen(ent.position.x, ent.position.z);
    const scale = (game.zoom / 14) * (ent.boss ? 1.6 : 1);
    const w = 20 * PIXEL * scale;
    const h = 24 * PIXEL * scale;
    if (sx > s.x - w / 2 && sx < s.x + w / 2 && sy > s.y - h && sy < s.y + 10) {
      const d = Math.hypot(sx - s.x, sy - (s.y - h / 2));
      if (d < bestDist) {
        bestDist = d;
        best = { ent, type };
      }
    }
  };

  game.npcs.forEach(npc => {
    if (!npc.dead) testEntity(npc, 'npc');
  });
  game.players.forEach(p => testEntity(p, 'player'));

  if (best) {
    selectTarget({ type: best.type, id: best.ent.id });
  }
}

// Mobile Controls
function setupMobileControls() {
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (!isMobile) return;

  const joystickContainer = document.getElementById('joystick-container');
  const joystickStick = document.getElementById('joystick-stick');
  const joystickBase = document.getElementById('joystick-base');

  if (!joystickContainer) return;

  let joystickActive = false;
  let joystickOrigin = { x: 0, y: 0 };
  const maxDistance = 40;

  joystickBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joystickActive = true;
    const rect = joystickBase.getBoundingClientRect();
    joystickOrigin = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!joystickActive) return;

    const touch = e.touches[0];
    let dx = touch.clientX - joystickOrigin.x;
    let dy = touch.clientY - joystickOrigin.y;

    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }

    joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    const threshold = 10;
    game.keys['KeyW'] = dy < -threshold;
    game.keys['KeyS'] = dy > threshold;
    game.keys['KeyA'] = dx < -threshold;
    game.keys['KeyD'] = dx > threshold;
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (joystickActive) {
      joystickActive = false;
      joystickStick.style.transform = 'translate(-50%, -50%)';
      game.keys['KeyW'] = false;
      game.keys['KeyS'] = false;
      game.keys['KeyA'] = false;
      game.keys['KeyD'] = false;
    }
  });

  const attackBtn = document.getElementById('mobile-attack-btn');
  if (attackBtn) {
    attackBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (game.selectedTarget && !game.selectedTarget.dead) {
        useSkill(0);
      } else {
        let nearestNPC = null;
        let nearestDist = Infinity;
        game.npcs.forEach(npc => {
          if (!npc.dead) {
            const dist = Math.hypot(
              npc.position.x - game.player.position.x,
              npc.position.z - game.player.position.z
            );
            if (dist < nearestDist && dist < 15) {
              nearestDist = dist;
              nearestNPC = npc;
            }
          }
        });
        if (nearestNPC) {
          selectTarget({ type: 'npc', id: nearestNPC.id });
          useSkill(0);
        }
      }
    }, { passive: false });
  }

  document.querySelectorAll('.mobile-skill-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      useSkill(parseInt(btn.dataset.skill));
    }, { passive: false });
  });

  document.querySelectorAll('.mobile-potion-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const potionType = btn.dataset.potion;
      if (potionType === 'hp') {
        useItem('Small Heal Potion');
      } else if (potionType === 'mp') {
        useItem('Small Mana Potion');
      }
    }, { passive: false });
  });

  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileQuickMenu = document.getElementById('mobile-quick-menu');

  if (mobileMenuBtn && mobileQuickMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileQuickMenu.classList.toggle('show');
    });

    document.querySelectorAll('.mobile-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        togglePanel(item.dataset.panel);
        mobileQuickMenu.classList.remove('show');
      });
    });
  }

  // Touch to select target
  game.canvas.addEventListener('touchstart', (e) => {
    if (e.target !== game.canvas) return;
    const touch = e.touches[0];
    handleClick(touch.clientX, touch.clientY);
  }, { passive: true });
}

// ============================================================
// TARGETING & COMBAT
// ============================================================
function selectTarget(userData) {
  if (userData.type === 'npc') {
    game.selectedTarget = game.npcs.get(userData.id);
    if (game.selectedTarget) game.selectedTarget.targetType = 'npc';
  } else if (userData.type === 'player') {
    game.selectedTarget = game.players.get(userData.id);
    if (game.selectedTarget) game.selectedTarget.targetType = 'player';
  }

  if (game.selectedTarget) {
    updateTargetUI();

    if (game.selectedTarget.boss) {
      showBossWarning(game.selectedTarget.name);
    }
  }
}

function deselectTarget() {
  game.selectedTarget = null;
  document.getElementById('target-info').classList.add('hidden');
}

function cycleTargets() {
  const npcs = Array.from(game.npcs.values()).filter(n => !n.dead);
  if (npcs.length === 0) return;

  npcs.sort((a, b) => {
    const distA = Math.hypot(a.position.x - game.player.position.x, a.position.z - game.player.position.z);
    const distB = Math.hypot(b.position.x - game.player.position.x, b.position.z - game.player.position.z);
    return distA - distB;
  });

  const currentIndex = game.selectedTarget ? npcs.findIndex(n => n.id === game.selectedTarget.id) : -1;
  const nextIndex = (currentIndex + 1) % npcs.length;

  game.selectedTarget = npcs[nextIndex];
  game.selectedTarget.targetType = 'npc';
  updateTargetUI();
}

function updateTargetUI() {
  if (!game.selectedTarget) {
    document.getElementById('target-info').classList.add('hidden');
    return;
  }

  document.getElementById('target-info').classList.remove('hidden');
  document.querySelector('#target-info .target-name').textContent = game.selectedTarget.name;
  document.getElementById('target-level').textContent = game.selectedTarget.level || '?';
  document.getElementById('target-health-current').textContent = Math.max(0, Math.floor(game.selectedTarget.health));
  document.getElementById('target-health-max').textContent = game.selectedTarget.maxHealth;

  const healthPercent = Math.max(0, (game.selectedTarget.health / game.selectedTarget.maxHealth) * 100);
  document.getElementById('target-health-fill').style.width = `${healthPercent}%`;
}

function useSkill(index) {
  if (!game.selectedTarget || game.selectedTarget.dead) {
    addChatMessage(null, 'No target selected', 'system');
    return;
  }

  const skillName = game.skillNames[index];
  if (!skillName) return;

  game.socket.emit('attack', {
    targetType: game.selectedTarget.targetType,
    targetId: game.selectedTarget.id,
    skill: skillName
  });
}

function useItem(itemName) {
  game.socket.emit('useItem', { itemName });
}

// ============================================================
// CHAT
// ============================================================
function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (message) {
    game.socket.emit('chatMessage', { message });
    input.value = '';
  }
  input.blur();
}

function addChatMessage(sender, message, type = 'normal', playerClass = null, level = null) {
  const chatMessages = document.getElementById('chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${type}`;

  if (type === 'system' || type === 'drop') {
    msgDiv.textContent = message;
  } else {
    const levelStr = level ? `[${level}]` : '';
    const classStr = playerClass ? playerClass : '';
    msgDiv.innerHTML = `<span class="level">${levelStr}</span> <span class="sender ${classStr}">${sender}:</span> <span class="text">${message}</span>`;
  }

  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ============================================================
// UI UPDATES
// ============================================================
function updateUI() {
  if (!game.player) return;

  document.querySelector('.player-name-display').textContent = game.player.name;
  document.getElementById('level-display').textContent = game.player.level;
  document.getElementById('class-emblem').textContent = classIcons[game.player.class];

  document.getElementById('health-current').textContent = Math.floor(game.player.health);
  document.getElementById('health-max').textContent = game.player.maxHealth;
  document.getElementById('health-fill').style.width = `${(game.player.health / game.player.maxHealth) * 100}%`;

  document.getElementById('mana-current').textContent = Math.floor(game.player.mana);
  document.getElementById('mana-max').textContent = game.player.maxMana;
  document.getElementById('mana-fill').style.width = `${(game.player.mana / game.player.maxMana) * 100}%`;

  document.getElementById('xp-current').textContent = game.player.xp;
  document.getElementById('xp-max').textContent = game.player.xpToLevel;
  document.getElementById('xp-fill').style.width = `${(game.player.xp / game.player.xpToLevel) * 100}%`;

  document.getElementById('zen-amount').textContent = game.player.zen?.toLocaleString() || game.player.gold?.toLocaleString();

  const indicator = document.getElementById('stat-points-indicator');
  if (game.player.freeStatPoints > 0) {
    indicator.classList.remove('hidden');
    document.getElementById('free-stat-points').textContent = game.player.freeStatPoints;
  } else {
    indicator.classList.add('hidden');
  }

  updateSkillBar();
  updateCharacterUI();
}

function updateSkillBar() {
  const skills = game.player.skills;
  const skillNames = Object.keys(skills);
  const icons = skillIcons[game.player.class] || {};
  const skillSlots = document.querySelectorAll('.skill-row .skill-slot');

  skillSlots.forEach((slot, i) => {
    const skillName = skillNames[i];
    if (skillName && skills[skillName]) {
      const skill = skills[skillName];
      slot.querySelector('.skill-icon').textContent = icons[skillName] || '⚡';
      slot.querySelector('.skill-name').textContent = skill.name;
      slot.title = `${skill.name}\nDamage: ${skill.damage}\nMana: ${skill.mana}\nCooldown: ${skill.cooldown / 1000}s`;
    }
  });

  const mobileSkillBtns = document.querySelectorAll('.mobile-skill-btn');
  mobileSkillBtns.forEach((btn, i) => {
    const skillName = skillNames[i];
    if (skillName && skills[skillName]) {
      const iconSpan = btn.querySelector('.skill-icon');
      if (iconSpan) {
        iconSpan.textContent = icons[skillName] || '⚡';
      }
    }
  });
}

function updateSkillBarItems() {
  const potions = {
    'Small Heal Potion': 0,
    'Small Mana Potion': 0,
    'Heal Potion': 0,
    'Mana Potion': 0
  };

  game.player.inventory.forEach(item => {
    if (potions[item.name] !== undefined) {
      potions[item.name] = item.quantity || 0;
    }
  });

  document.querySelectorAll('.skill-slot.item-slot').forEach(slot => {
    const itemName = slot.dataset.item;
    const count = potions[itemName] || 0;
    slot.querySelector('.item-count').textContent = count;
  });

  const hpCount = potions['Small Heal Potion'] + potions['Heal Potion'];
  const mpCount = potions['Small Mana Potion'] + potions['Mana Potion'];

  const mobileHpBtn = document.querySelector('.mobile-potion-btn[data-potion="hp"] .potion-count');
  const mobileMpBtn = document.querySelector('.mobile-potion-btn[data-potion="mp"] .potion-count');

  if (mobileHpBtn) mobileHpBtn.textContent = hpCount;
  if (mobileMpBtn) mobileMpBtn.textContent = mpCount;
}

function updateCharacterUI() {
  if (!game.player) return;

  document.querySelector('.char-name').textContent = game.player.name;
  document.querySelector('.char-class').textContent = game.classes[game.player.class]?.name || game.player.class;
  document.getElementById('char-level').textContent = game.player.level;
  document.getElementById('free-points-display').textContent = game.player.freeStatPoints || 0;

  const stats = game.player.stats;
  document.getElementById('stat-strength').textContent = stats.strength;
  document.getElementById('stat-agility').textContent = stats.agility;
  document.getElementById('stat-vitality').textContent = stats.vitality;
  document.getElementById('stat-energy').textContent = stats.energy;

  document.getElementById('combat-damage').textContent = stats.damage;
  document.getElementById('combat-magic').textContent = stats.magicDamage;
  document.getElementById('combat-defense').textContent = stats.defense;
  document.getElementById('combat-speed').textContent = stats.attackSpeed?.toFixed(2) || '1.00';
  document.getElementById('combat-crit').textContent = `${((stats.critChance || 0.05) * 100).toFixed(1)}%`;

  Object.keys(game.player.equipment).forEach(slot => {
    const slotEl = document.querySelector(`.equip-slot[data-slot="${slot}"] .slot-item`);
    const item = game.player.equipment[slot];
    if (slotEl) {
      if (item) {
        const enhanceStr = item.enhancement ? `+${item.enhancement}` : '';
        slotEl.textContent = `${item.name} ${enhanceStr}`;
        slotEl.className = item.enhancement > 0 ? 'slot-item enhanced' : 'slot-item';
      } else {
        slotEl.textContent = 'Empty';
        slotEl.className = 'slot-item';
      }
    }
  });

  document.querySelectorAll('.stat-add-btn').forEach(btn => {
    btn.disabled = (game.player.freeStatPoints || 0) <= 0;
  });
}

function updateInventoryUI() {
  const grid = document.getElementById('inventory-grid');
  grid.innerHTML = '';

  document.getElementById('gold-amount').textContent = (game.player.gold || 0).toLocaleString();

  game.player.inventory.forEach((item, index) => {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';

    if (item.glow) slot.classList.add('legendary');
    else if (item.type === 'wings' || item.type === 'outfit') slot.classList.add('epic');
    else if (item.type === 'enhancement') slot.classList.add('rare');

    const icon = getItemIcon(item);
    const enhancement = item.enhancement !== undefined ? `<div class="item-enhancement">+${item.enhancement}</div>` : '';
    const qty = item.quantity > 1 ? `<div class="item-qty">${item.quantity}</div>` : '';

    slot.innerHTML = `
      <div class="item-icon">${icon}</div>
      <div class="item-name">${item.name}</div>
      ${enhancement}
      ${qty}
    `;

    slot.title = getItemTooltip(item);

    slot.addEventListener('click', () => {
      if (item.type === 'consumable') {
        game.socket.emit('useItem', { itemName: item.name });
      } else if (item.slot) {
        game.socket.emit('equipItem', { itemName: item.name });
      }
    });

    slot.dataset.index = index;
    grid.appendChild(slot);
  });
}

function getItemIcon(item) {
  const icons = {
    'Small Heal Potion': '❤️',
    'Heal Potion': '💗',
    'Great Heal Potion': '💖',
    'Small Mana Potion': '💙',
    'Mana Potion': '💜',
    'Jewel of Bless': '💎',
    'Jewel of Soul': '🔮',
    'Jewel of Life': '💚',
    'Jewel of Chaos': '🌀',
    'Wings of Elf': '🦋',
    'Wings of Heaven': '👼',
    'Wings of Darkness': '🦇',
    'Cape of Lord': '👑',
    'Bandit Outfit': '🥷',
    'Knight Outfit': '🛡️',
    'Royal Outfit': '👑',
    'Shadow Outfit': '🌑'
  };

  if (icons[item.name]) return icons[item.name];
  if (item.type === 'weapon') return '⚔️';
  if (item.type === 'armor') return '🛡️';
  if (item.type === 'outfit') return '🧥';
  return '📦';
}

function getItemTooltip(item) {
  let tooltip = item.name;
  if (item.enhancement) tooltip += ` +${item.enhancement}`;
  if (item.type === 'outfit') tooltip += '\n[Costume - changes appearance]';
  if (item.stats) {
    tooltip += '\n---';
    if (item.stats.damage) tooltip += `\nDamage: +${item.stats.damage}`;
    if (item.stats.magicDamage) tooltip += `\nMagic Damage: +${item.stats.magicDamage}`;
    if (item.stats.defense) tooltip += `\nDefense: +${item.stats.defense}`;
  }
  if (item.requiredLevel) tooltip += `\nRequired Level: ${item.requiredLevel}`;
  return tooltip;
}

function updateQuestTracker() {
  const tracker = document.getElementById('quest-list');
  tracker.innerHTML = '';

  game.player.quests.active.forEach(quest => {
    const questDiv = document.createElement('div');
    questDiv.className = 'quest-item';
    questDiv.innerHTML = `
      <div class="quest-item-name">${quest.name}</div>
      ${quest.objectives.map(obj => `
        <div class="quest-item-objective ${obj.current >= obj.required ? 'completed' : ''}">
          ${obj.target || 'Complete'}: ${obj.current}/${obj.required}
        </div>
      `).join('')}
    `;
    tracker.appendChild(questDiv);
  });
}

function updateQuestPanel() {
  const availableList = document.getElementById('available-quest-list');
  availableList.innerHTML = '';

  game.quests.forEach(quest => {
    const isActive = game.player?.quests.active.find(q => q.id === quest.id);
    const isCompleted = game.player?.quests.completed.includes(quest.id);
    if (isActive || isCompleted) return;

    const questDiv = document.createElement('div');
    questDiv.className = 'quest-entry';
    questDiv.innerHTML = `
      <div class="quest-entry-name">${quest.name}</div>
      <div class="quest-entry-level">Required Level: ${quest.minLevel || 1}</div>
      <div class="quest-entry-desc">${quest.description}</div>
      <div class="quest-entry-rewards">Rewards: ${quest.rewards.xp} EXP, ${quest.rewards.gold} Zen</div>
      <button class="quest-accept-btn">Accept</button>
    `;

    questDiv.querySelector('.quest-accept-btn').addEventListener('click', () => {
      game.socket.emit('acceptQuest', { questId: quest.id });
    });

    availableList.appendChild(questDiv);
  });

  const activeList = document.getElementById('active-quest-list');
  activeList.innerHTML = '';

  game.player?.quests.active.forEach(quest => {
    const questDiv = document.createElement('div');
    questDiv.className = 'quest-entry';
    const allComplete = quest.objectives.every(o => o.current >= o.required);

    questDiv.innerHTML = `
      <div class="quest-entry-name">${quest.name}</div>
      <div class="quest-entry-desc">${quest.description}</div>
      <div class="quest-entry-objectives">
        ${quest.objectives.map(obj => `
          <div class="${obj.current >= obj.required ? 'completed' : ''}">
            ${obj.target || 'Complete'}: ${obj.current}/${obj.required}
          </div>
        `).join('')}
      </div>
      <button class="quest-complete-btn" ${!allComplete ? 'disabled' : ''}>
        ${allComplete ? 'Complete Quest' : 'In Progress'}
      </button>
    `;

    if (allComplete) {
      questDiv.querySelector('.quest-complete-btn').addEventListener('click', () => {
        game.socket.emit('completeQuest', { questId: quest.id });
      });
    }

    activeList.appendChild(questDiv);
  });
}

function updateTradeRoutes() {
  const routeList = document.getElementById('trade-route-list');
  if (!routeList) return;
  routeList.innerHTML = '';

  game.tradeRoutes.forEach(route => {
    const routeDiv = document.createElement('div');
    routeDiv.className = 'quest-entry';
    routeDiv.innerHTML = `
      <div class="quest-entry-name">${route.name}</div>
      <div class="quest-entry-desc">Danger: ${route.danger} | Reward Multiplier: ${route.reward}x</div>
    `;
    routeList.appendChild(routeDiv);
  });
}

function updateMinimap() {
  const ctx = game.minimapCtx;
  if (!ctx) return;
  const canvas = ctx.canvas;
  const scale = 0.35;

  ctx.fillStyle = '#1a3a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // water on minimap
  lakes.forEach(l => {
    const x = 80 + (l.x - game.player.position.x) * scale;
    const y = 80 + (l.z - game.player.position.z) * scale;
    ctx.fillStyle = '#2a56b0';
    ctx.beginPath();
    ctx.arc(x, y, l.r * scale, 0, Math.PI * 2);
    ctx.fill();
  });

  game.npcs.forEach(npc => {
    if (npc.dead) return;
    const x = 80 + (npc.position.x - game.player.position.x) * scale;
    const y = 80 + (npc.position.z - game.player.position.z) * scale;

    if (x >= 0 && x <= 160 && y >= 0 && y <= 160) {
      ctx.fillStyle = npc.boss ? '#ff0000' : (npc.rare ? '#ffd700' : '#ff4444');
      ctx.beginPath();
      ctx.arc(x, y, npc.boss ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  game.players.forEach(player => {
    const x = 80 + (player.position.x - game.player.position.x) * scale;
    const y = 80 + (player.position.z - game.player.position.z) * scale;

    if (x >= 0 && x <= 160 && y >= 0 && y <= 160) {
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(80, 80, 4, 0, Math.PI * 2);
  ctx.fill();

  document.getElementById('coord-x').textContent = Math.round(game.player.position.x);
  document.getElementById('coord-z').textContent = Math.round(game.player.position.z);

  const areaName = getAreaName(game.player.position);
  document.getElementById('area-name').textContent = areaName;
}

function getAreaName(pos) {
  const x = pos.x, z = pos.z;
  if (Math.abs(x) < 30 && Math.abs(z) < 30) return 'Lorencia';
  if (x > 50 && z > 50) return 'Spider Forest';
  if (x < -50 && z > 30) return 'Wasteland';
  if (x > 80 && z > 60) return 'Swamp';
  if (x < -80 && z < -40) return 'Ancient Ruins';
  if (x > 100 && z < -80) return 'Shadow Territory';
  if (x < -40 && z < -60) return 'Eastern Lands';
  if (z > 150) return 'Kundun Lair';
  if (x > 130) return 'Death Knight Arena';
  return 'Wilderness';
}

// ============================================================
// VISUAL FEEDBACK (DOM overlays)
// ============================================================
function showDamageNumber(targetId, amount, type) {
  const container = document.getElementById('damage-numbers');
  const div = document.createElement('div');
  div.className = `damage-number ${type}`;
  div.textContent = typeof amount === 'number' ? `-${amount}` : amount;

  let target;
  if (targetId === game.player?.id) {
    target = game.player;
  } else {
    target = game.npcs.get(targetId) || game.players.get(targetId);
  }

  if (target?.position) {
    const s = worldToScreen(target.position.x, target.position.z);
    div.style.left = `${s.x + (Math.random() - 0.5) * 40}px`;
    div.style.top = `${s.y - 60}px`;
  } else {
    div.style.left = '50%';
    div.style.top = '50%';
  }

  container.appendChild(div);
  setTimeout(() => div.remove(), 1200);
}

function showCombo(count) {
  const display = document.getElementById('combo-display');
  document.getElementById('combo-count').textContent = count;
  display.classList.remove('hidden');

  clearTimeout(display.timeout);
  display.timeout = setTimeout(() => {
    display.classList.add('hidden');
  }, 2000);
}

function showLevelUp(level) {
  const notification = document.getElementById('level-up-notification');
  document.getElementById('new-level').textContent = level;
  notification.classList.remove('hidden');

  setTimeout(() => {
    notification.classList.add('hidden');
  }, 4000);
}

function showBossWarning(bossName) {
  const warning = document.getElementById('boss-warning');
  document.getElementById('boss-name').textContent = bossName;
  warning.classList.remove('hidden');

  setTimeout(() => {
    warning.classList.add('hidden');
  }, 3000);
}

function showDeathScreen() {
  document.getElementById('death-screen').classList.remove('hidden');
  let timer = 5;
  const timerElement = document.getElementById('respawn-timer');

  const interval = setInterval(() => {
    timer--;
    timerElement.textContent = timer;
    if (timer <= 0) clearInterval(interval);
  }, 1000);
}

function hideDeathScreen() {
  document.getElementById('death-screen').classList.add('hidden');
}

function showItemNotification(item) {
  const container = document.getElementById('item-notifications');
  const div = document.createElement('div');
  div.className = 'item-notification';
  div.textContent = `Obtained: ${item.name}${item.enhancement ? ` +${item.enhancement}` : ''}`;
  container.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  panel.classList.toggle('hidden');

  if (panelId === 'inventory-panel' && !panel.classList.contains('hidden')) {
    updateInventoryUI();
  } else if (panelId === 'character-panel' && !panel.classList.contains('hidden')) {
    updateCharacterUI();
  }
}

function closeAllPanels() {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
}

// ============================================================
// GAME LOOP
// ============================================================
function gameLoop() {
  requestAnimationFrame(gameLoop);

  const now = performance.now();
  const delta = Math.min(0.1, (now - game.clock.last) / 1000);
  game.clock.last = now;
  game.time += delta;

  if (game.player) {
    let moveX = 0, moveZ = 0;

    if (game.keys['KeyW'] || game.keys['ArrowUp']) moveZ -= 1;
    if (game.keys['KeyS'] || game.keys['ArrowDown']) moveZ += 1;
    if (game.keys['KeyA'] || game.keys['ArrowLeft']) moveX -= 1;
    if (game.keys['KeyD'] || game.keys['ArrowRight']) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= length;
      moveZ /= length;

      const speed = game.moveSpeed * (game.player.stats?.moveSpeed || 1);
      const newX = game.player.position.x + moveX * speed * delta;
      const newZ = game.player.position.z + moveZ * speed * delta;

      // Collision: water and buildings block movement (try axis separately for sliding)
      if (!isBlocked(newX, game.player.position.z)) {
        game.player.position.x = newX;
      }
      if (!isBlocked(game.player.position.x, newZ)) {
        game.player.position.z = newZ;
      }

      game.player.facing = getFacing(moveX, moveZ);
      game.player.moving = true;
      game.player.animPhase = (game.player.animPhase || 0) + delta * 10;
      game.player.rotation = Math.atan2(moveX, moveZ);

      game.socket.emit('playerMove', {
        position: game.player.position,
        rotation: game.player.rotation,
        velocity: { x: moveX * speed, y: 0, z: moveZ * speed }
      });
    } else {
      game.player.moving = false;
    }

    updateMinimap();
  }

  // Update other entities' facing/animation
  game.players.forEach(p => updateEntityFacing(p, delta));
  game.npcs.forEach(npc => {
    if (!npc.dead) updateEntityFacing(npc, delta);
  });

  if (game.selectedTarget) {
    updateTargetUI();
  }

  render();
}

// ============================================================
// LOGIN
// ============================================================
function setupLoginScreen() {
  const classOptions = document.querySelectorAll('.class-option');
  let selectedClass = 'darkKnight';

  classOptions.forEach(option => {
    option.addEventListener('click', () => {
      classOptions.forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      selectedClass = option.dataset.class;
    });
  });

  document.getElementById('play-button').addEventListener('click', () => {
    const playerName = document.getElementById('player-name').value.trim() || 'Adventurer';

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    initScene();
    setupInput();
    initSocket();

    setTimeout(() => {
      game.socket.emit('playerJoin', {
        name: playerName,
        class: selectedClass
      });
    }, 100);

    gameLoop();
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupLoginScreen();
});
