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
  cooldowns: {},   // { skillName|__basic: { end, dur } } for radial cooldown UI
  effects: [],
  time: 0,
  delta: 0.016,
  shake: 0,
  moveTarget: null,     // { x, z } - click-to-move destination
  chaseTargetId: null   // npc id - approach and melee attack
};

const MELEE_RANGE = 3; // basic attack range - close combat, enemy can hit back too

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

// Visual effect per skill: slash / burst / projectile / arrows / bolt / heal
const skillEffects = {
  // Dark Knight
  twistingSlash:  { type: 'slash', color: '#ffd24a', size: 1.5 },
  deathStab:      { type: 'slash', color: '#ff5040', size: 1.1 },
  ragefulBlow:    { type: 'burst', color: '#ff3020', size: 1.6 },
  comboSlash:     { type: 'slash', color: '#ffee66', size: 1.9 },
  // Dark Wizard
  fireBall:       { type: 'projectile', color: '#ff7020', size: 1.2 },
  powerWave:      { type: 'burst', color: '#40a0ff', size: 1.2 },
  hellFire:       { type: 'burst', color: '#ff5010', size: 1.8 },
  inferno:        { type: 'burst', color: '#ff8c00', size: 2.3 },
  // Fairy Elf
  tripleShot:     { type: 'arrows', color: '#c8ff80', count: 3 },
  penetration:    { type: 'arrows', color: '#ffffff', count: 1 },
  iceArrow:       { type: 'projectile', color: '#80d0ff', size: 1 },
  heal:           { type: 'heal', color: '#60ff80' },
  // Bicheon
  chainSword:     { type: 'slash', color: '#ffcc00', size: 1.3 },
  snowFlower:     { type: 'burst', color: '#a0e0ff', size: 1.4 },
  flyingDragon:   { type: 'burst', color: '#ffd700', size: 1.8 },
  thunderAssault: { type: 'bolt', color: '#ffe840' },
  // Heuksal
  shadowStrike:   { type: 'slash', color: '#a060ff', size: 1.2 },
  phantomSlash:   { type: 'slash', color: '#c080ff', size: 1.6 },
  darkCloud:      { type: 'burst', color: '#7040b0', size: 1.5 },
  assassinate:    { type: 'slash', color: '#ff2060', size: 2 }
};

// ============================================================
// SPRITE FACTORY - pixel art drawn on offscreen canvases
// ============================================================
const spriteCache = new Map();
const PIXEL = 4; // scale factor for pixel art

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

// Dark outline around sprite for clarity/readability
function outlineSprite(src) {
  const pad = PIXEL;
  const c = document.createElement('canvas');
  c.width = src.width + pad * 2;
  c.height = src.height + pad * 2;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const offsets = [[-pad, 0], [pad, 0], [0, -pad], [0, pad]];
  offsets.forEach(([ox, oy]) => ctx.drawImage(src, pad + ox, pad + oy));
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = 'rgba(10,10,16,0.85)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(src, pad, pad);
  return c;
}

// Class visual definitions - rustic medieval look based on reference art:
// laced tunic, leather belt with buckle, dark trousers, worn leather boots
const classLooks = {
  darkKnight: { tunic: '#c9b795', pants: '#4c443a', hair: '#4a3520' },
  darkWizard: { tunic: '#4a3a7a', pants: '#2a2348', hair: '#b8b8c0', hat: '#332a5a' },
  fairyElf: { tunic: '#5a8a3a', pants: '#3a5a28', hair: '#d8c060' },
  bicheon: { tunic: '#b87828', pants: '#5a4020', hair: '#181818' },
  heuksal: { tunic: '#41284f', pants: '#221830', hair: '#2a1a3a' }
};

// Outfit visual overrides (dropped costumes)
const outfitLooks = {
  bandit: { tunic: '#3a3a3a', pants: '#242424', hood: '#1a1a1a' },
  knight: { tunic: '#9aa0b0', pants: '#5a6070', helmet: '#c8ccda' },
  royal: { tunic: '#c8a020', pants: '#7a3a9a', crown: '#ffd700' },
  shadow: { tunic: '#181828', pants: '#0c0c18', hood: '#282840', glow: '#8844ff' }
};

const SKIN = '#e2b285';
const SKIN_SHADE = '#c69a6e';
const BOOTS = '#6a4a28';
const BOOTS_DARK = '#4a3018';
const BELT = '#5a3a1e';
const BUCKLE = '#c8a030';
const BRACER = '#7a5230';

// Character sprite: 24x34 logical pixels, 4 directions, male/female.
// Design based on reference art: laced tunic, leather belt with buckle,
// rolled-up sleeves with wrist bracers, dark trousers, worn leather boots.
const CHAR_W = 24;
const CHAR_H = 34;

// pose: 0 = idle, 1/2 = walk steps, 'atk' = attack stance
function getCharacterSprite(cls, outfitId, dir, gender, pose = 0) {
  const g = gender === 'female' ? 'f' : 'm';
  const key = `char|${cls}|${outfitId || ''}|${dir}|${g}|${pose}`;
  if (spriteCache.has(key)) return spriteCache.get(key);

  const look = { ...(classLooks[cls] || classLooks.darkKnight) };
  if (outfitId && outfitLooks[outfitId]) Object.assign(look, outfitLooks[outfitId]);
  const female = g === 'f';

  const { c, ctx } = makeCanvas(CHAR_W, CHAR_H);

  if (dir === 'left' || dir === 'right') {
    drawCharSide(ctx, cls, look, female, pose);
    if (dir === 'right') {
      const { c: mc, ctx: mctx } = makeCanvas(CHAR_W, CHAR_H);
      mctx.translate(mc.width, 0);
      mctx.scale(-1, 1);
      mctx.drawImage(c, 0, 0);
      const outlinedM = outlineSprite(mc);
      spriteCache.set(key, outlinedM);
      return outlinedM;
    }
  } else if (dir === 'up') {
    drawCharBack(ctx, cls, look, female, pose);
  } else {
    drawCharFront(ctx, cls, look, female, pose);
  }

  const outlined = outlineSprite(c);
  spriteCache.set(key, outlined);
  return outlined;
}

// Legs + boots for front/back views, with walking steps and attack stance
function drawLegsFrontBack(ctx, look, pose) {
  const pantsDark = shadeColor(look.pants, -18);
  const lLift = pose === 1 ? 1 : 0;   // left leg lifted
  const rLift = pose === 2 ? 1 : 0;   // right leg lifted
  const spread = pose === 'atk' ? 1 : 0; // wider stance while attacking

  // legs
  px(ctx, 8 - spread, 22, 3, 6 - lLift, look.pants);
  px(ctx, 13 + spread, 22, 3, 6 - rLift, look.pants);
  px(ctx, 10 - spread, 22, 1, 5 - lLift, pantsDark);
  px(ctx, 13 + spread, 22, 1, 5 - rLift, pantsDark);
  // knee crease
  px(ctx, 8 - spread, 25, 3, 1, pantsDark);
  px(ctx, 13 + spread, 25, 3, 1, pantsDark);

  // boots
  px(ctx, 8 - spread, 28 - lLift, 3, 3, BOOTS);
  px(ctx, 13 + spread, 28 - rLift, 3, 3, BOOTS);
  px(ctx, 7 - spread, 31 - lLift, 4, 2, BOOTS);
  px(ctx, 13 + spread, 31 - rLift, 4, 2, BOOTS);
  px(ctx, 7 - spread, 33 - lLift, 4, 1, BOOTS_DARK);
  px(ctx, 13 + spread, 33 - rLift, 4, 1, BOOTS_DARK);
  // boot highlights and laces
  px(ctx, 8 - spread, 28 - lLift, 1, 2, shadeColor(BOOTS, 22));
  px(ctx, 13 + spread, 28 - rLift, 1, 2, shadeColor(BOOTS, 22));
  px(ctx, 9 - spread, 29 - lLift, 1, 1, BOOTS_DARK);
  px(ctx, 14 + spread, 29 - rLift, 1, 1, BOOTS_DARK);
}

// Per-class gear details for extra MU-style realism (front view)
function drawClassDetailsFront(ctx, cls, look, tx, tw) {
  if (cls === 'darkKnight') {
    // leather shoulder pads + chest strap
    const pad = '#6a5a40';
    px(ctx, tx - 2, 10, 3, 2, pad);
    px(ctx, tx + tw - 1, 10, 3, 2, pad);
    px(ctx, tx - 2, 10, 1, 1, shadeColor(pad, 25));
    for (let i = 0; i < 4; i++) px(ctx, tx + 1 + i * 2, 12 + i, 1, 1, '#5a4530');
  } else if (cls === 'darkWizard') {
    // golden robe trim
    px(ctx, tx, 21, tw, 1, '#a08a30');
    px(ctx, tx, 14, tw, 1, shadeColor(look.tunic, -30));
  } else if (cls === 'fairyElf') {
    // quiver strap across the chest
    for (let i = 0; i < 5; i++) px(ctx, tx + 1 + i, 11 + i, 1, 1, '#7a5a30');
  } else if (cls === 'bicheon') {
    // red martial sash
    px(ctx, tx, 17, tw, 1, '#a03030');
    px(ctx, tx + tw - 3, 20, 1, 3, '#a03030');
  } else if (cls === 'heuksal') {
    // dark scarf around the neck
    px(ctx, 9, 9, 6, 1, '#2a1a3a');
    px(ctx, 9, 10, 2, 2, '#2a1a3a');
  }
}

function shadeColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

// Headgear / hair for the front view
function drawHairFront(ctx, look, female) {
  const hairDark = shadeColor(look.hair || '#4a3520', -25);
  if (look.helmet) {
    px(ctx, 8, 0, 8, 5, look.helmet);
    px(ctx, 7, 2, 1, 3, look.helmet);
    px(ctx, 16, 2, 1, 3, look.helmet);
    px(ctx, 9, 1, 3, 1, shadeColor(look.helmet, 30));
  } else if (look.hat) {
    px(ctx, 10, 0, 4, 2, look.hat);
    px(ctx, 9, 1, 6, 2, look.hat);
    px(ctx, 7, 3, 10, 1, look.hat);
    px(ctx, 8, 4, 8, 1, shadeColor(look.hat, -20));
  } else if (look.hood) {
    px(ctx, 8, 0, 8, 5, look.hood);
    px(ctx, 7, 2, 1, 4, look.hood);
    px(ctx, 16, 2, 1, 4, look.hood);
  } else if (look.crown) {
    px(ctx, 9, 0, 6, 1, look.crown);
    px(ctx, 9, 1, 1, 1, look.crown);
    px(ctx, 11, 1, 1, 1, look.crown);
    px(ctx, 14, 1, 1, 1, look.crown);
    px(ctx, 8, 2, 8, 2, look.hair);
  } else {
    // messy hair like the reference
    px(ctx, 9, 0, 6, 1, look.hair);
    px(ctx, 8, 1, 8, 2, look.hair);
    px(ctx, 8, 3, 2, 1, look.hair);
    px(ctx, 14, 3, 2, 1, look.hair);
    px(ctx, 10, 0, 1, 1, hairDark);
    px(ctx, 13, 1, 1, 1, hairDark);
  }
  if (female && !look.helmet && !look.hood) {
    // long hair falling on the sides
    px(ctx, 7, 2, 1, 11, look.hair);
    px(ctx, 6, 4, 1, 8, look.hair);
    px(ctx, 16, 2, 1, 11, look.hair);
    px(ctx, 17, 4, 1, 8, look.hair);
  }
}

function drawCharFront(ctx, cls, look, female, pose = 0) {
  const tunicDark = shadeColor(look.tunic, -22);
  const tunicLight = shadeColor(look.tunic, 18);
  const hairC = look.hair || '#4a3520';
  const attacking = pose === 'atk';

  // ---- head ----
  px(ctx, 9, 2, 6, 7, SKIN);
  px(ctx, 8, 4, 1, 4, SKIN);
  px(ctx, 15, 4, 1, 4, SKIN);
  // face shading (light from top-left)
  px(ctx, 14, 4, 1, 4, SKIN_SHADE);
  drawHairFront(ctx, look, female);
  // eyes (looking down slightly, like the reference)
  px(ctx, 10, 5, 1, 1, '#2a1a10');
  px(ctx, 13, 5, 1, 1, '#2a1a10');
  // nose shadow
  px(ctx, 11, 6, 1, 1, SKIN_SHADE);
  // beard for males (like reference), soft chin shade for females
  if (!female && !look.helmet) {
    px(ctx, 9, 7, 6, 2, hairC);
    px(ctx, 10, 7, 4, 1, shadeColor(hairC, -15));
    px(ctx, 11, 7, 2, 1, SKIN_SHADE); // mouth area
  } else {
    px(ctx, 10, 8, 4, 1, SKIN_SHADE);
  }
  // neck
  px(ctx, 10, 9, 4, 1, SKIN_SHADE);

  // ---- torso: tunic ----
  const tx = female ? 8 : 7;
  const tw = female ? 8 : 10;
  px(ctx, tx - 1, 10, tw + 2, 2, look.tunic);          // shoulders
  px(ctx, tx, 10, tw, 8, look.tunic);                  // chest
  px(ctx, tx + tw - 1, 11, 1, 7, tunicDark);           // side shading
  px(ctx, tx, 11, 1, 7, tunicLight);                   // light side highlight
  // fabric fold lines
  px(ctx, tx + 2, 14, 1, 3, tunicDark);
  px(ctx, tx + tw - 3, 15, 1, 2, tunicDark);
  // V-neck lacing
  px(ctx, 11, 10, 2, 1, SKIN_SHADE);
  px(ctx, 11, 11, 2, 3, tunicDark);
  px(ctx, 11, 11, 1, 1, '#8a7a5a');
  px(ctx, 12, 12, 1, 1, '#8a7a5a');
  px(ctx, 11, 13, 1, 1, '#8a7a5a');
  // waist pinch for female
  if (female) {
    px(ctx, 8, 15, 1, 3, tunicDark);
    px(ctx, 15, 15, 1, 3, tunicDark);
  }

  drawClassDetailsFront(ctx, cls, look, tx, tw);

  // ---- arms: rolled sleeves, bare forearms, bracers ----
  // while attacking the weapon arm is raised
  const armL = tx - 2, armR = tx + tw;
  const rArmY = attacking ? 9 : 11;   // right (weapon) arm raised when attacking
  px(ctx, armL, 11, 2, 5, look.tunic);
  px(ctx, armR, rArmY, 2, 5, look.tunic);
  px(ctx, armL, 15, 2, 1, tunicDark);
  px(ctx, armR, rArmY + 4, 2, 1, tunicDark);
  px(ctx, armL, 16, 2, 3, SKIN);
  px(ctx, armR, rArmY + 5, 2, 3, SKIN);
  px(ctx, armL, 17, 2, 2, BRACER);
  px(ctx, armR, rArmY + 6, 2, 2, BRACER);
  px(ctx, armL, 19, 2, 2, SKIN);
  px(ctx, armR, rArmY + 8, 2, 2, SKIN);

  // ---- belt with buckle ----
  px(ctx, tx, 18, tw, 2, BELT);
  px(ctx, 11, 18, 2, 2, BUCKLE);
  px(ctx, 11, 18, 1, 1, shadeColor(BUCKLE, 40));
  // tunic hem below the belt
  px(ctx, tx, 20, tw, 2, look.tunic);
  px(ctx, tx, 21, tw, 1, tunicDark);

  drawLegsFrontBack(ctx, look, pose);

  drawWeapon(ctx, cls, 'front', attacking);

  if (look.glow) {
    px(ctx, tx, 10, 1, 10, look.glow);
    px(ctx, tx + tw - 1, 10, 1, 10, look.glow);
  }
}

function drawCharBack(ctx, cls, look, female, pose = 0) {
  const tunicDark = shadeColor(look.tunic, -22);
  const tunicLight = shadeColor(look.tunic, 18);
  const hairC = look.hood || look.helmet || look.hair || '#4a3520';
  const attacking = pose === 'atk';

  // head covered by hair/hood from behind
  px(ctx, 9, 2, 6, 7, hairC);
  px(ctx, 8, 3, 1, 5, hairC);
  px(ctx, 15, 3, 1, 5, hairC);
  px(ctx, 9, 0, 6, 2, hairC);
  px(ctx, 9, 1, 2, 2, shadeColor(hairC, 18)); // hair highlight
  if (female && !look.helmet && !look.hood) {
    // long hair down the back
    px(ctx, 9, 9, 6, 5, look.hair);
    px(ctx, 10, 14, 4, 2, look.hair);
    px(ctx, 10, 15, 4, 1, shadeColor(look.hair, -25));
  }
  px(ctx, 10, 9, 4, 1, SKIN_SHADE);

  const tx = female ? 8 : 7;
  const tw = female ? 8 : 10;
  px(ctx, tx - 1, 10, tw + 2, 2, look.tunic);
  px(ctx, tx, 10, tw, 8, look.tunic);
  px(ctx, tx, 11, 1, 7, tunicDark);
  px(ctx, tx + tw - 1, 11, 1, 7, tunicLight);
  px(ctx, tx + 3, 13, 1, 4, tunicDark); // back fold
  if (female) {
    px(ctx, 8, 15, 1, 3, tunicDark);
    px(ctx, 15, 15, 1, 3, tunicDark);
  }

  const armL = tx - 2, armR = tx + tw;
  const rArmY = attacking ? 9 : 11;
  px(ctx, armL, 11, 2, 5, look.tunic);
  px(ctx, armR, rArmY, 2, 5, look.tunic);
  px(ctx, armL, 15, 2, 1, tunicDark);
  px(ctx, armR, rArmY + 4, 2, 1, tunicDark);
  px(ctx, armL, 16, 2, 3, SKIN);
  px(ctx, armR, rArmY + 5, 2, 3, SKIN);
  px(ctx, armL, 17, 2, 2, BRACER);
  px(ctx, armR, rArmY + 6, 2, 2, BRACER);
  px(ctx, armL, 19, 2, 2, SKIN);
  px(ctx, armR, rArmY + 8, 2, 2, SKIN);

  // plain belt (no buckle from behind)
  px(ctx, tx, 18, tw, 2, BELT);
  px(ctx, tx, 20, tw, 2, look.tunic);
  px(ctx, tx, 21, tw, 1, tunicDark);

  drawLegsFrontBack(ctx, look, pose);

  drawWeapon(ctx, cls, 'back', attacking);

  if (look.glow) {
    px(ctx, tx, 10, 1, 10, look.glow);
    px(ctx, tx + tw - 1, 10, 1, 10, look.glow);
  }
}

function drawCharSide(ctx, cls, look, female, pose = 0) {
  // facing LEFT
  const tunicDark = shadeColor(look.tunic, -22);
  const tunicLight = shadeColor(look.tunic, 18);
  const pantsDark = shadeColor(look.pants, -18);
  const hairC = look.hair || '#4a3520';
  const attacking = pose === 'atk';

  // ---- head (leaning forward slightly when attacking) ----
  const hx = attacking ? -1 : 0;
  px(ctx, 9 + hx, 2, 6, 7, SKIN);
  if (look.helmet) {
    px(ctx, 8 + hx, 0, 8, 5, look.helmet);
  } else if (look.hood) {
    px(ctx, 8 + hx, 0, 8, 6, look.hood);
    px(ctx, 13 + hx, 6, 3, 3, look.hood);
  } else if (look.hat) {
    px(ctx, 10 + hx, 0, 5, 2, look.hat);
    px(ctx, 8 + hx, 2, 9, 2, look.hat);
  } else {
    px(ctx, 9 + hx, 0, 7, 2, hairC);
    px(ctx, 10 + hx, 2, 6, 2, hairC);
    px(ctx, 13 + hx, 4, 3, 4, hairC);   // back of head
    px(ctx, 10 + hx, 0, 2, 1, shadeColor(hairC, 18)); // highlight
  }
  if (female && !look.helmet && !look.hood) {
    px(ctx, 14 + hx, 6, 2, 9, look.hair); // long hair down the back
    px(ctx, 15 + hx, 14, 1, 2, shadeColor(look.hair, -25));
  }
  // one eye + beard on the chin
  px(ctx, 10 + hx, 5, 1, 1, '#2a1a10');
  if (!female && !look.helmet) {
    px(ctx, 9 + hx, 7, 4, 2, hairC);
  }
  px(ctx, 11 + hx, 9, 3, 1, SKIN_SHADE);

  // ---- body ----
  px(ctx, 9, 10, 7, 8, look.tunic);
  px(ctx, 15, 11, 1, 7, tunicDark);
  px(ctx, 9, 11, 1, 7, tunicLight);
  px(ctx, 12, 13, 1, 4, tunicDark); // fold
  if (female) {
    px(ctx, 9, 15, 1, 3, tunicDark);
    px(ctx, 14, 15, 1, 3, tunicDark);
  }

  // front arm - extended forward when attacking
  if (attacking) {
    px(ctx, 4, 12, 5, 2, look.tunic);   // arm reaching forward
    px(ctx, 3, 12, 2, 2, SKIN);         // forearm
    px(ctx, 2, 12, 2, 2, BRACER);       // bracer
    px(ctx, 1, 12, 2, 2, SKIN);         // hand
  } else {
    px(ctx, 7, 11, 2, 5, look.tunic);
    px(ctx, 7, 15, 2, 1, tunicDark);
    px(ctx, 7, 16, 2, 3, SKIN);
    px(ctx, 7, 17, 2, 2, BRACER);
    px(ctx, 7, 19, 2, 2, SKIN);
  }

  // belt
  px(ctx, 9, 18, 7, 2, BELT);
  px(ctx, 9, 20, 7, 2, look.tunic);
  px(ctx, 9, 21, 7, 1, tunicDark);

  // ---- legs: real stride poses ----
  if (pose === 1) {
    // stride: front leg forward, back leg behind
    px(ctx, 7, 22, 3, 6, look.pants);
    px(ctx, 13, 22, 3, 6, pantsDark);
    px(ctx, 7, 28, 3, 3, BOOTS);
    px(ctx, 13, 28, 3, 3, shadeColor(BOOTS, -12));
    px(ctx, 5, 31, 5, 2, BOOTS);
    px(ctx, 13, 31, 4, 2, shadeColor(BOOTS, -12));
    px(ctx, 5, 33, 5, 1, BOOTS_DARK);
    px(ctx, 13, 33, 4, 1, BOOTS_DARK);
  } else if (pose === 2) {
    // passing: legs close together
    px(ctx, 10, 22, 3, 6, look.pants);
    px(ctx, 12, 22, 3, 6, pantsDark);
    px(ctx, 10, 28, 3, 3, BOOTS);
    px(ctx, 12, 28, 3, 3, shadeColor(BOOTS, -12));
    px(ctx, 9, 31, 4, 2, BOOTS);
    px(ctx, 12, 31, 4, 2, shadeColor(BOOTS, -12));
    px(ctx, 9, 33, 4, 1, BOOTS_DARK);
    px(ctx, 12, 33, 4, 1, BOOTS_DARK);
  } else if (attacking) {
    // lunge stance: wide split
    px(ctx, 6, 22, 3, 6, look.pants);
    px(ctx, 14, 22, 3, 6, pantsDark);
    px(ctx, 6, 28, 3, 3, BOOTS);
    px(ctx, 14, 28, 3, 3, shadeColor(BOOTS, -12));
    px(ctx, 4, 31, 5, 2, BOOTS);
    px(ctx, 14, 31, 4, 2, shadeColor(BOOTS, -12));
    px(ctx, 4, 33, 5, 1, BOOTS_DARK);
    px(ctx, 14, 33, 4, 1, BOOTS_DARK);
  } else {
    // idle
    px(ctx, 9, 22, 3, 6, look.pants);
    px(ctx, 12, 22, 3, 6, pantsDark);
    px(ctx, 9, 28, 3, 3, BOOTS);
    px(ctx, 12, 28, 3, 3, shadeColor(BOOTS, -12));
    px(ctx, 7, 31, 5, 2, BOOTS);
    px(ctx, 12, 31, 4, 2, shadeColor(BOOTS, -12));
    px(ctx, 7, 33, 5, 1, BOOTS_DARK);
    px(ctx, 12, 33, 4, 1, BOOTS_DARK);
  }

  drawWeapon(ctx, cls, 'side', attacking);

  if (look.glow) {
    px(ctx, 9, 10, 1, 10, look.glow);
  }
}

function drawWeapon(ctx, cls, view, attacking = false) {
  const isSword = (cls === 'darkKnight' || cls === 'bicheon');
  if (isSword) {
    if (attacking) {
      if (view === 'side') {
        // horizontal thrust forward (facing left)
        px(ctx, 0, 12, 8, 1, '#c8c8d0');
        px(ctx, 0, 12, 2, 1, '#f0f0f8');
        px(ctx, 0, 11, 1, 1, '#f0f0f8');   // tip
        px(ctx, 7, 11, 1, 3, '#8a6a20');   // guard
      } else {
        // diagonal overhead swing
        const x = view === 'back' ? 3 : 16;
        px(ctx, x + 4, 2, 2, 1, '#f0f0f8');
        px(ctx, x + 3, 3, 2, 1, '#d8d8e0');
        px(ctx, x + 2, 4, 2, 2, '#c8c8d0');
        px(ctx, x + 1, 6, 2, 2, '#c8c8d0');
        px(ctx, x, 8, 2, 1, '#8a6a20');    // guard
        px(ctx, x, 9, 1, 2, '#5a3a1a');    // grip
      }
    } else {
      if (view === 'side') {
        px(ctx, 3, 8, 1, 13, '#c8c8d0');
        px(ctx, 3, 8, 1, 2, '#e8e8f0');
        px(ctx, 2, 19, 3, 1, '#8a6a20');
        px(ctx, 3, 20, 1, 2, '#5a3a1a');
      } else {
        const x = view === 'back' ? 4 : 19;
        px(ctx, x, 7, 1, 12, '#c8c8d0');
        px(ctx, x, 7, 1, 2, '#e8e8f0');
        px(ctx, x - 1, 18, 3, 1, '#8a6a20');
        px(ctx, x, 19, 1, 2, '#5a3a1a');
      }
    }
  } else if (cls === 'darkWizard') {
    const x = view === 'side' ? (attacking ? 2 : 3) : (view === 'back' ? 4 : 19);
    if (attacking) {
      // staff raised, orb blazing
      px(ctx, x, 2, 1, 19, '#6a4a20');
      px(ctx, x - 1, 0, 3, 3, '#aa66ff');
      px(ctx, x, 0, 1, 1, '#ffffff');
      px(ctx, x - 2, 1, 1, 1, '#d8bbff');   // sparks
      px(ctx, x + 2, 0, 1, 1, '#d8bbff');
      px(ctx, x - 1, 3, 3, 1, '#8844dd');
    } else {
      px(ctx, x, 5, 1, 18, '#6a4a20');
      px(ctx, x - 1, 2, 3, 3, '#aa66ff');
      px(ctx, x, 3, 1, 1, '#e0ccff');
    }
  } else if (cls === 'fairyElf') {
    const x = view === 'side' ? 3 : (view === 'back' ? 4 : 19);
    if (attacking && view === 'side') {
      // drawn bow with nocked arrow (facing left)
      px(ctx, 2, 7, 1, 12, '#8a6a30');
      px(ctx, 3, 8, 1, 4, '#d8d8c0');     // string pulled back
      px(ctx, 3, 12, 1, 1, '#d8d8c0');
      px(ctx, 3, 13, 1, 5, '#d8d8c0');
      px(ctx, 0, 12, 6, 1, '#c8a860');    // arrow
      px(ctx, 0, 12, 1, 1, '#f0f0f0');    // arrowhead
    } else if (attacking) {
      px(ctx, x, 7, 1, 12, '#8a6a30');
      px(ctx, x + 1, 8, 1, 10, '#d8d8c0');
      px(ctx, x - 2, 12, 4, 1, '#c8a860'); // arrow
      px(ctx, x - 2, 12, 1, 1, '#f0f0f0');
    } else {
      px(ctx, x, 7, 1, 12, '#8a6a30');
      px(ctx, x - 1, 6, 1, 2, '#8a6a30');
      px(ctx, x - 1, 18, 1, 2, '#8a6a30');
      px(ctx, x + 1, 8, 1, 10, '#d8d8c0'); // bowstring
    }
  } else if (cls === 'heuksal') {
    if (attacking) {
      if (view === 'side') {
        // dagger thrust forward
        px(ctx, 0, 12, 5, 1, '#b0b0b8');
        px(ctx, 0, 12, 1, 1, '#e8e8f0');
        px(ctx, 5, 11, 1, 3, '#3a2a1a');
      } else {
        const x = view === 'back' ? 3 : 18;
        px(ctx, x, 6, 1, 5, '#b0b0b8');
        px(ctx, x, 6, 1, 1, '#e8e8f0');
        px(ctx, x - 1, 11, 3, 1, '#3a2a1a');
      }
    } else if (view !== 'back') {
      const x = view === 'side' ? 4 : 19;
      px(ctx, x, 14, 1, 6, '#b0b0b8');
      px(ctx, x, 14, 1, 1, '#e0e0e8');
      px(ctx, x - 1, 19, 3, 1, '#3a2a1a');
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
    const outlinedM = outlineSprite(mc);
    spriteCache.set(key, outlinedM);
    return outlinedM;
  }
  const outlined = outlineSprite(c);
  spriteCache.set(key, outlined);
  return outlined;
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
    // oak: layered canopy with 3 green tones, shaded trunk with roots
    const { c, ctx } = makeCanvas(22, 30);
    px(ctx, 9, 19, 4, 9, '#6a4a2a');          // trunk
    px(ctx, 9, 19, 1, 9, '#8a6540');          // trunk highlight
    px(ctx, 12, 20, 1, 8, '#4e3319');         // trunk shade
    px(ctx, 7, 27, 3, 2, '#5a3d22');          // roots
    px(ctx, 12, 27, 3, 2, '#5a3d22');
    px(ctx, 10, 22, 1, 2, '#4e3319');         // bark line
    // canopy: dark base, mid, highlights
    px(ctx, 3, 4, 16, 13, '#25682a');
    px(ctx, 6, 1, 10, 5, '#25682a');
    px(ctx, 1, 8, 4, 7, '#25682a');
    px(ctx, 17, 8, 4, 7, '#25682a');
    px(ctx, 4, 3, 12, 10, '#338a38');         // mid tone
    px(ctx, 7, 1, 7, 4, '#338a38');
    px(ctx, 5, 3, 5, 4, '#46a84c');           // sunlit top-left
    px(ctx, 8, 1, 4, 2, '#46a84c');
    px(ctx, 12, 7, 4, 3, '#46a84c');
    px(ctx, 6, 9, 3, 2, '#46a84c');
    px(ctx, 4, 13, 13, 3, '#1d5522');         // canopy underside
    result = c;
  } else if (kind === 'pine') {
    const { c, ctx } = makeCanvas(20, 32);
    px(ctx, 9, 25, 3, 6, '#5e4023');           // trunk
    px(ctx, 9, 25, 1, 6, '#7a5a35');
    // three triangular layers
    px(ctx, 7, 0, 6, 3, '#1e6030');
    px(ctx, 5, 3, 10, 5, '#1e6030');
    px(ctx, 8, 1, 3, 2, '#2f804a');
    px(ctx, 4, 8, 13, 6, '#1a5429');
    px(ctx, 6, 9, 4, 2, '#2f804a');
    px(ctx, 2, 14, 17, 7, '#174a24');
    px(ctx, 4, 15, 5, 2, '#256b3a');
    px(ctx, 3, 21, 15, 4, '#133f1e');
    result = c;
  } else if (kind === 'rock') {
    const { c, ctx } = makeCanvas(14, 11);
    px(ctx, 2, 4, 10, 7, '#7e7e88');
    px(ctx, 4, 1, 6, 4, '#7e7e88');
    px(ctx, 4, 2, 3, 2, '#a2a2ac');           // top highlight
    px(ctx, 3, 4, 2, 2, '#92929c');
    px(ctx, 9, 5, 3, 4, '#62626c');           // shade side
    px(ctx, 3, 9, 8, 2, '#54545e');           // base
    px(ctx, 2, 7, 3, 2, '#4e7a4e');           // moss
    px(ctx, 7, 3, 2, 1, '#8f8f99');           // crack
    px(ctx, 6, 4, 1, 2, '#62626c');
    result = c;
  } else if (kind === 'bush') {
    const { c, ctx } = makeCanvas(12, 9);
    px(ctx, 1, 3, 10, 5, '#2b6e30');
    px(ctx, 3, 1, 6, 4, '#2b6e30');
    px(ctx, 3, 2, 4, 2, '#3f8f46');
    px(ctx, 2, 4, 2, 2, '#3f8f46');
    px(ctx, 2, 7, 9, 1, '#1d5122');
    px(ctx, 8, 3, 1, 1, '#c03040');           // berries
    px(ctx, 5, 5, 1, 1, '#c03040');
    px(ctx, 9, 5, 1, 1, '#c03040');
    result = c;
  } else if (kind === 'flowers') {
    const { c, ctx } = makeCanvas(12, 8);
    // grass tuft
    px(ctx, 2, 4, 1, 4, '#3f8f46');
    px(ctx, 5, 3, 1, 5, '#3f8f46');
    px(ctx, 9, 4, 1, 4, '#3f8f46');
    px(ctx, 7, 5, 1, 3, '#2b6e30');
    // flowers
    px(ctx, 1, 2, 2, 2, '#e05070');
    px(ctx, 1, 2, 1, 1, '#ff88a8');
    px(ctx, 5, 1, 2, 2, '#e8c830');
    px(ctx, 5, 1, 1, 1, '#fff090');
    px(ctx, 9, 2, 2, 2, '#7888e0');
    px(ctx, 9, 2, 1, 1, '#a8b8ff');
    result = c;
  } else if (kind === 'mushroom') {
    const { c, ctx } = makeCanvas(7, 7);
    px(ctx, 2, 3, 2, 4, '#d8c8a8');            // stem
    px(ctx, 0, 1, 6, 3, '#b03028');            // cap
    px(ctx, 1, 0, 4, 2, '#b03028');
    px(ctx, 1, 1, 1, 1, '#e8e0d0');            // dots
    px(ctx, 4, 2, 1, 1, '#e8e0d0');
    result = c;
  } else if (kind === 'building') {
    const { c, ctx } = makeCanvas(48, 42);
    // walls with timber frame
    px(ctx, 4, 18, 40, 24, '#d8b888');
    px(ctx, 4, 18, 40, 1, '#b89868');
    px(ctx, 4, 18, 1, 24, '#b89868');
    px(ctx, 43, 18, 1, 24, '#a88858');
    // timber beams
    px(ctx, 14, 18, 1, 24, '#7a5a34');
    px(ctx, 33, 18, 1, 24, '#7a5a34');
    px(ctx, 4, 28, 40, 1, '#7a5a34');
    // roof with shingle rows
    px(ctx, 1, 8, 46, 11, '#8a2820');
    px(ctx, 5, 4, 38, 5, '#9a3428');
    px(ctx, 9, 1, 30, 4, '#a84030');
    px(ctx, 1, 11, 46, 1, '#701c16');          // shingle lines
    px(ctx, 3, 15, 43, 1, '#701c16');
    px(ctx, 7, 7, 35, 1, '#88281e');
    px(ctx, 1, 17, 46, 2, '#5a1410');          // roof edge
    // chimney
    px(ctx, 36, 0, 5, 8, '#8a8a92');
    px(ctx, 35, 0, 7, 2, '#72727c');
    // arched door
    px(ctx, 20, 30, 8, 12, '#5a3a1a');
    px(ctx, 21, 28, 6, 3, '#5a3a1a');
    px(ctx, 21, 29, 1, 12, '#7a5535');         // door plank lines
    px(ctx, 24, 29, 1, 13, '#42280e');
    px(ctx, 26, 35, 1, 2, '#c8a030');          // handle
    // glowing windows with frames
    px(ctx, 8, 21, 7, 6, '#6a4a2a');
    px(ctx, 9, 22, 5, 4, '#ffd870');
    px(ctx, 11, 22, 1, 4, '#6a4a2a');
    px(ctx, 34, 21, 7, 6, '#6a4a2a');
    px(ctx, 35, 22, 5, 4, '#ffd870');
    px(ctx, 37, 22, 1, 4, '#6a4a2a');
    result = c;
  } else if (kind === 'portal') {
    const { c, ctx } = makeCanvas(22, 30);
    // stone arch frame
    px(ctx, 1, 2, 4, 26, '#6e6e78');
    px(ctx, 17, 2, 4, 26, '#6e6e78');
    px(ctx, 1, 0, 20, 4, '#7e7e88');
    px(ctx, 2, 1, 2, 2, '#92929c');
    px(ctx, 1, 26, 5, 2, '#5a5a64');
    px(ctx, 16, 26, 5, 2, '#5a5a64');
    // swirling energy
    px(ctx, 5, 4, 12, 24, '#5a2a9a');
    px(ctx, 6, 6, 10, 20, '#8848dd');
    px(ctx, 8, 8, 6, 16, '#b880ff');
    px(ctx, 9, 11, 4, 9, '#e0ccff');
    px(ctx, 10, 13, 2, 5, '#ffffff');
    px(ctx, 7, 9, 2, 2, '#d0b0ff');           // swirl sparks
    px(ctx, 13, 19, 2, 2, '#d0b0ff');
    result = c;
  } else if (kind === 'torch') {
    const { c, ctx } = makeCanvas(8, 18);
    px(ctx, 3, 7, 2, 11, '#6a4a2a');
    px(ctx, 3, 7, 1, 11, '#8a6540');
    px(ctx, 2, 5, 4, 3, '#4a4a52');            // iron holder
    px(ctx, 2, 5, 4, 1, '#5e5e66');
    px(ctx, 2, 2, 4, 4, '#ff8820');            // flame
    px(ctx, 3, 0, 2, 4, '#ffcc40');
    px(ctx, 3, 1, 1, 2, '#fff0a0');            // flame core
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

  // Trees - deterministic positions (oak + pine mix)
  let seed = 12345;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const clearOfLakes = (x, z, pad) => !lakes.some(l => Math.hypot(x - l.x, z - l.z) < l.r + pad);

  for (let i = 0; i < 60; i++) {
    const x = (rand() - 0.5) * 440;
    const z = (rand() - 0.5) * 440;
    if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;         // keep town clear
    if (!clearOfLakes(x, z, 6)) continue;
    worldObjects.push({ kind: rand() > 0.4 ? 'tree' : 'pine', x, z });
  }

  // Rocks
  for (let i = 0; i < 20; i++) {
    const x = (rand() - 0.5) * 400;
    const z = (rand() - 0.5) * 400;
    if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;
    if (!clearOfLakes(x, z, 4)) continue;
    worldObjects.push({ kind: 'rock', x, z });
  }

  // Bushes
  for (let i = 0; i < 30; i++) {
    const x = (rand() - 0.5) * 430;
    const z = (rand() - 0.5) * 430;
    if (Math.abs(x) < 34 && Math.abs(z) < 34) continue;
    if (!clearOfLakes(x, z, 4)) continue;
    worldObjects.push({ kind: 'bush', x, z });
  }

  // Flower patches
  for (let i = 0; i < 40; i++) {
    const x = (rand() - 0.5) * 440;
    const z = (rand() - 0.5) * 440;
    if (!clearOfLakes(x, z, 3)) continue;
    worldObjects.push({ kind: 'flowers', x, z });
  }

  // Mushrooms (near woods)
  for (let i = 0; i < 14; i++) {
    const x = (rand() - 0.5) * 420;
    const z = (rand() - 0.5) * 420;
    if (Math.abs(x) < 36 && Math.abs(z) < 36) continue;
    if (!clearOfLakes(x, z, 3)) continue;
    worldObjects.push({ kind: 'mushroom', x, z });
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

// ============================================================
// SMOOTH TERRAIN - value-noise based, pre-rendered once
// Multiple grass biomes blending smoothly, no visible tiles
// ============================================================
const TERRAIN_RES = 2; // pixels per world unit on the terrain texture

function nhash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = nhash(ix, iz), b = nhash(ix + 1, iz);
  const c = nhash(ix, iz + 1), d = nhash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function fbm(x, z) {
  return vnoise(x, z) * 0.55 + vnoise(x * 2.1 + 17, z * 2.1 + 17) * 0.28 + vnoise(x * 4.3 + 43, z * 4.3 + 43) * 0.17;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// grass biome gradient stops (dark forest -> lush -> meadow -> dry savanna)
const BIOME_STOPS = [
  [36, 96, 44],    // dark forest green
  [56, 132, 58],   // lush green
  [96, 148, 62],   // bright meadow
  [132, 144, 70]   // dry yellowish grass
];

function biomeColor(n) {
  const t = Math.max(0, Math.min(0.999, n)) * (BIOME_STOPS.length - 1);
  const i = Math.floor(t);
  return lerpColor(BIOME_STOPS[i], BIOME_STOPS[i + 1], t - i);
}

// distance from point to line segment (for dirt roads)
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function buildTerrain() {
  const size = 500 * TERRAIN_RES;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const tctx = canvas.getContext('2d');
  const img = tctx.createImageData(size, size);
  const data = img.data;

  // roads from town toward the portals
  const roads = [
    [0, 0, 0, 200],    // to Kundun Lair
    [0, 0, 150, 0]     // to Death Knight Arena
  ];

  for (let pyi = 0; pyi < size; pyi++) {
    const wz = pyi / TERRAIN_RES - 250;
    for (let pxi = 0; pxi < size; pxi++) {
      const wx = pxi / TERRAIN_RES - 250;
      let r, g, b;

      // nearest lake
      let lakeD = Infinity, lakeR = 1;
      for (let li = 0; li < lakes.length; li++) {
        const l = lakes[li];
        const d = Math.hypot(wx - l.x, wz - l.z);
        if (d - l.r < lakeD - lakeR) { lakeD = d; lakeR = l.r; }
      }
      const shore = lakeD - lakeR; // negative = inside water

      if (shore < 0) {
        // water: deeper toward center, ripple noise
        const depth = Math.min(1, -shore / lakeR);
        const ripple = (fbm(wx * 0.15, wz * 0.15) - 0.5) * 18;
        const wc = lerpColor([66, 132, 205], [26, 74, 150], depth);
        r = wc[0] + ripple; g = wc[1] + ripple; b = wc[2] + ripple * 0.6;
      } else {
        // base grass with smooth biome blending
        const n1 = fbm(wx * 0.012, wz * 0.012);            // biome selector (large scale)
        const n2 = fbm(wx * 0.05 + 37, wz * 0.05 + 37);    // medium patches
        const n3 = vnoise(wx * 0.3 + 91, wz * 0.3 + 91);   // fine detail
        let gc = biomeColor(n1);
        const shade = (n2 - 0.5) * 26 + (n3 - 0.5) * 12;
        r = gc[0] + shade; g = gc[1] + shade; b = gc[2] + shade * 0.7;

        // sandy shoreline blending into grass
        if (shore < 2) {
          const sand = [214, 196, 146];
          r = sand[0]; g = sand[1]; b = sand[2];
        } else if (shore < 7) {
          const t = (shore - 2) / 5;
          const sand = [214, 196, 146];
          r = lerp(sand[0], r, t); g = lerp(sand[1], g, t); b = lerp(sand[2], b, t);
        }

        // town dirt area with smooth edge
        const dTown = Math.hypot(wx, wz);
        let dirtT = 0;
        if (dTown < 28) dirtT = 1;
        else if (dTown < 42) dirtT = 1 - (dTown - 28) / 14;

        // dirt roads
        for (let ri = 0; ri < roads.length; ri++) {
          const rd = roads[ri];
          const d = segDist(wx, wz, rd[0], rd[1], rd[2], rd[3]);
          let rt = 0;
          if (d < 3) rt = 1;
          else if (d < 7) rt = 1 - (d - 3) / 4;
          if (rt > dirtT) dirtT = rt;
        }

        if (dirtT > 0) {
          const dn = (fbm(wx * 0.08 + 71, wz * 0.08 + 71) - 0.5) * 24;
          const dirt = [154 + dn, 126 + dn, 90 + dn * 0.7];
          // soften: dirt fades smoothly into grass
          dirtT = dirtT * dirtT * (3 - 2 * dirtT);
          r = lerp(r, dirt[0], dirtT);
          g = lerp(g, dirt[1], dirtT);
          b = lerp(b, dirt[2], dirtT);
        }
      }

      const idx = (pyi * size + pxi) * 4;
      data[idx] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = Math.max(0, Math.min(255, b));
      data[idx + 3] = 255;
    }
  }

  tctx.putImageData(img, 0, 0);
  game.terrainCanvas = canvas;
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

    // Spawn hit/spell visual effect
    spawnSkillEffect(data);

    // Attack animation: attacker turns to target and performs a motion by attack type
    const attackerEnt = data.attackerId === game.player?.id
      ? game.player
      : (game.players.get(data.attackerId) || game.npcs.get(data.attackerId));
    const defenderEnt = data.defenderId === game.player?.id
      ? game.player
      : (game.npcs.get(data.defenderId) || game.players.get(data.defenderId));

    if (attackerEnt?.position && defenderEnt?.position) {
      const dx = defenderEnt.position.x - attackerEnt.position.x;
      const dz = defenderEnt.position.z - attackerEnt.position.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.1) {
        attackerEnt.facing = getFacing(dx, dz);
      }
      let kind = 'slash';
      if (attackerEnt.class === 'darkWizard') kind = 'cast';
      else if (attackerEnt.class === 'fairyElf') kind = data.skill === 'heal' ? 'cast' : 'bow';
      attackerEnt.attackAnim = { t: 0, dur: 0.35, kind };
    }

    // Start cooldown sweep for my own attacks (server confirmed the hit)
    if (data.attackerId === game.player?.id) {
      const now = performance.now();
      if (data.skill && game.player.skills[data.skill]) {
        const cd = game.player.skills[data.skill].cooldown;
        game.cooldowns[data.skill] = { end: now + cd, dur: cd };
      } else if (!data.skill) {
        game.cooldowns.__basic = { end: now + 1000, dur: 1000 };
      }
    }

    // Screen shake on critical hits involving the local player
    if (data.critical && (data.attackerId === game.player?.id || data.defenderId === game.player?.id)) {
      game.shake = 0.3;
    }

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
  buildTerrain();

  game.minimapCtx = document.getElementById('minimap-canvas')?.getContext('2d');
}

function resizeCanvas() {
  game.canvas.width = window.innerWidth;
  game.canvas.height = window.innerHeight;
  game.ctx.imageSmoothingEnabled = false;
  // Smaller screens see a bit less world
  game.zoom = window.innerWidth < 600 ? 13 : 16;
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

function drawTerrain(ctx) {
  const cam = game.player.position;
  const halfW = game.canvas.width / 2 / game.zoom;
  const halfH = game.canvas.height / 2 / game.zoom;

  // area outside the world - dark
  ctx.fillStyle = '#1c3020';
  ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);

  if (!game.terrainCanvas) return;

  const viewL = cam.x - halfW, viewT = cam.z - halfH;
  const wl = Math.max(-250, viewL), wr = Math.min(250, cam.x + halfW);
  const wt = Math.max(-250, viewT), wb = Math.min(250, cam.z + halfH);

  if (wr > wl && wb > wt) {
    const R = TERRAIN_RES;
    // smooth upscaling for natural look (sprites stay pixelated)
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      game.terrainCanvas,
      (wl + 250) * R, (wt + 250) * R, (wr - wl) * R, (wb - wt) * R,
      (wl - viewL) * game.zoom, (wt - viewT) * game.zoom,
      (wr - wl) * game.zoom, (wb - wt) * game.zoom
    );
    ctx.imageSmoothingEnabled = false;
  }

  // animated water highlights on visible lakes
  lakes.forEach(l => {
    const s = worldToScreen(l.x, l.z);
    const rp = l.r * game.zoom;
    if (s.x + rp < 0 || s.x - rp > game.canvas.width || s.y + rp < 0 || s.y - rp > game.canvas.height) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(s.x, s.y, rp * 0.97, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#d8ecff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const ang = i * 1.05 + game.time * 0.4;
      const rr = rp * (0.18 + 0.13 * i + Math.sin(game.time * 1.6 + i * 1.3) * 0.05);
      ctx.beginPath();
      ctx.arc(s.x, s.y, rr, ang, ang + 1);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
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

const FACING_VEC = {
  down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0]
};

function drawCharacter(ctx, ent, isLocal) {
  const s = worldToScreen(ent.position.x, ent.position.z);
  const outfitId = ent.equipment?.outfit?.outfitId || null;

  // pose: attack > walking steps > idle
  let pose = 0;
  let lungeX = 0, lungeY = 0;
  if (ent.attackAnim) {
    pose = 'atk';
    // quick lunge toward the target and back
    const p = Math.min(1, ent.attackAnim.t / ent.attackAnim.dur);
    const lunge = Math.sin(p * Math.PI) * 9 * (game.zoom / 14);
    const v = FACING_VEC[ent.facing || 'down'];
    lungeX = v[0] * lunge;
    lungeY = v[1] * lunge;
  } else if (ent.moving) {
    pose = (Math.floor(ent.animPhase * 0.8) % 2) + 1; // alternate step frames
  }

  const sprite = getCharacterSprite(ent.class, outfitId, ent.facing || 'down', ent.gender, pose);

  const scale = (game.zoom / 14) * 0.95;
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const bob = ent.moving ? Math.sin(ent.animPhase * 2) * 1.2 * scale : 0;

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

  // hit flash
  if (ent.hitFlash > 0) {
    ctx.filter = 'brightness(1.9) saturate(1.4)';
  }
  ctx.drawImage(sprite, s.x - w / 2 + lungeX, s.y - h + bob + lungeY, w, h);
  ctx.filter = 'none';

  // wings indicator (glow behind player if wings equipped)
  if (ent.equipment?.wings) {
    ctx.fillStyle = 'rgba(170,120,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - h * 0.65, w * 0.75, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // name
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
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

  const scale = (game.zoom / 14) * (npc.boss ? 1.8 : 1.2);
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const bob = npc.moving ? Math.sin(npc.animPhase * 2) * 2 * scale : 0;

  // attack lunge toward target
  let lungeX = 0, lungeY = 0;
  if (npc.attackAnim) {
    const p = Math.min(1, npc.attackAnim.t / npc.attackAnim.dur);
    const lunge = Math.sin(p * Math.PI) * 8 * (game.zoom / 14);
    const v = FACING_VEC[npc.facing || 'down'];
    lungeX = v[0] * lunge;
    lungeY = v[1] * lunge;
  }

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

  // hit flash
  if (npc.hitFlash > 0) {
    ctx.filter = 'brightness(1.9) saturate(1.4)';
  }
  ctx.drawImage(sprite, s.x - w / 2 + lungeX, s.y - h + bob + lungeY, w, h);
  ctx.filter = 'none';

  // health bar
  const hpPct = Math.max(0, npc.health / npc.maxHealth);
  const barW = Math.max(36, w * 0.8);
  ctx.fillStyle = '#000';
  ctx.fillRect(s.x - barW / 2 - 1, s.y - h - 11, barW + 2, 7);
  ctx.fillStyle = npc.boss ? '#ff2020' : '#cc3030';
  ctx.fillRect(s.x - barW / 2, s.y - h - 10, barW * hpPct, 5);

  // name
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000';
  const label = `${npc.name} [${npc.level}]`;
  ctx.strokeText(label, s.x, s.y - h - 16);
  ctx.fillStyle = npc.boss ? '#ff5050' : (npc.rare ? '#ffd700' : '#ffb0b0');
  ctx.fillText(label, s.x, s.y - h - 16);
}

function drawObject(ctx, obj) {
  const sprite = getObjectSprite(obj.kind);
  if (!sprite) return;
  const s = worldToScreen(obj.x, obj.z);
  const scale = game.zoom / 14;
  const w = sprite.width * scale;
  const h = sprite.height * scale;

  if (s.x + w < 0 || s.x - w > game.canvas.width || s.y + h < 0 || s.y - h > game.canvas.height) return;

  // soft ground shadow under solid objects
  if (obj.kind === 'tree' || obj.kind === 'pine' || obj.kind === 'rock' || obj.kind === 'building' || obj.kind === 'bush') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 1, w * 0.42, w * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

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

  // screen shake on critical hits
  ctx.save();
  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 10 * game.shake, (Math.random() - 0.5) * 10 * game.shake);
  }

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

  // effects
  drawEffects(ctx);

  ctx.restore();
}

// ============================================================
// EFFECT RENDERING
// ============================================================
function drawEffects(ctx) {
  const dt = game.delta || 0.016;
  const sc = game.zoom / 14;
  const newEffects = [];

  game.effects = game.effects.filter(ef => {
    ef.t = (ef.t || 0) + dt;
    if (ef.t < 0) return true; // delayed start
    const dur = ef.dur || 1;
    if (ef.t >= dur) {
      // projectile explodes on arrival
      if (ef.type === 'projectile' && !ef.thin) {
        newEffects.push({ type: 'burst', x: ef.tx, z: ef.tz, color: ef.color, size: (ef.size || 1) * 0.9, t: 0, dur: 0.4, parts: makeBurstParts() });
      }
      return false;
    }
    const p = ef.t / dur;

    if (ef.type === 'particles') {
      ef.particles.forEach(pt => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.15;
        const s = worldToScreen(ef.x, ef.z);
        ctx.globalAlpha = Math.max(0, 1 - p);
        ctx.fillStyle = pt.color;
        ctx.fillRect(s.x + pt.x, s.y + pt.y - 20, 5, 5);
      });
      ctx.globalAlpha = 1;

    } else if (ef.type === 'slash') {
      const s = worldToScreen(ef.x, ef.z);
      const cy = s.y - 34 * sc;
      const r = (14 + p * 30) * sc * (ef.size || 1);
      const a0 = ef.seed + p * 3;
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = ef.color;
      ctx.lineWidth = 6 * sc;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(s.x, cy, r, a0, a0 + 2.1);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5 * sc;
      ctx.beginPath();
      ctx.arc(s.x, cy, r * 0.75, a0 + 0.3, a0 + 1.8);
      ctx.stroke();
      // spark dots
      ctx.fillStyle = ef.color;
      for (let i = 0; i < 4; i++) {
        const ang = a0 + i * 1.6;
        ctx.fillRect(s.x + Math.cos(ang) * r * 1.1, cy + Math.sin(ang) * r * 1.1, 4, 4);
      }
      ctx.globalAlpha = 1;

    } else if (ef.type === 'burst') {
      const s = worldToScreen(ef.x, ef.z);
      const cy = s.y - 24 * sc;
      const R = p * 46 * sc * (ef.size || 1);
      ctx.globalAlpha = 1 - p;
      // expanding ring
      ctx.strokeStyle = ef.color;
      ctx.lineWidth = 7 * sc * (1 - p * 0.6);
      ctx.beginPath();
      ctx.arc(s.x, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      // inner flash
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.beginPath();
      ctx.arc(s.x, cy, R * 0.35, 0, Math.PI * 2);
      ctx.fill();
      // flying particles
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = ef.color;
      (ef.parts || []).forEach(d => {
        ctx.fillRect(s.x + d.dx * R * 1.2, cy + d.dy * R * 1.2, 5, 5);
      });
      ctx.globalAlpha = 1;

    } else if (ef.type === 'projectile') {
      const from = worldToScreen(ef.fx, ef.fz);
      const to = worldToScreen(ef.tx, ef.tz);
      const cx = from.x + (to.x - from.x) * p;
      const cy = from.y + (to.y - from.y) * p - 30 * sc;
      if (ef.thin) {
        // arrow streak
        const dx = to.x - from.x, dy = to.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 3 * sc;
        ctx.beginPath();
        ctx.moveTo(cx - ux * 20 * sc, cy - uy * 20 * sc);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        // glowing orb with trail
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ef.color;
        for (let i = 1; i <= 3; i++) {
          const tp = Math.max(0, p - i * 0.08);
          const tx2 = from.x + (to.x - from.x) * tp;
          const ty2 = from.y + (to.y - from.y) * tp - 30 * sc;
          ctx.beginPath();
          ctx.arc(tx2, ty2, (9 - i * 2) * sc * (ef.size || 1), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 9 * sc * (ef.size || 1), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 4 * sc * (ef.size || 1), 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (ef.type === 'bolt') {
      const s = worldToScreen(ef.x, ef.z);
      const topY = s.y - 260 * sc;
      const botY = s.y - 20 * sc;
      ctx.globalAlpha = p < 0.4 ? 1 : (1 - p) / 0.6;
      // jagged main bolt
      ctx.strokeStyle = ef.color;
      ctx.lineWidth = 5 * sc;
      ctx.beginPath();
      ctx.moveTo(s.x + Math.sin(ef.seed) * 10, topY);
      const segs = 6;
      for (let i = 1; i <= segs; i++) {
        const yy = topY + (botY - topY) * (i / segs);
        const xx = s.x + Math.sin(ef.seed * 3 + i * 7.3) * 16 * sc * (i < segs ? 1 : 0);
        ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      // white core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * sc;
      ctx.stroke();
      // impact flash
      ctx.fillStyle = ef.color;
      ctx.beginPath();
      ctx.ellipse(s.x, botY, 22 * sc * (1 - p), 8 * sc * (1 - p), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

    } else if (ef.type === 'clickMarker') {
      // shrinking ring on the ground where the player clicked
      const s = worldToScreen(ef.x, ef.z);
      const R = (1 - p) * 18 * sc + 4;
      ctx.globalAlpha = 1 - p * 0.6;
      ctx.strokeStyle = '#7dff7d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, R, R * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#7dff7d';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

    } else if (ef.type === 'heal') {
      const s = worldToScreen(ef.x, ef.z);
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = ef.color;
      ctx.font = `bold ${Math.round(14 * sc)}px Arial`;
      for (let i = 0; i < 5; i++) {
        const ang = i * 1.26 + game.time;
        const xx = s.x + Math.cos(ang) * 18 * sc;
        const yy = s.y - 30 * sc - p * 45 * sc - i * 6;
        ctx.fillText('+', xx, yy);
      }
      // soft glow
      ctx.globalAlpha = (1 - p) * 0.25;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 25 * sc, 26 * sc, 34 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    return true;
  });

  newEffects.forEach(e => game.effects.push(e));
}

function makeBurstParts() {
  const parts = [];
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
    parts.push({ dx: Math.cos(ang), dy: Math.sin(ang) * 0.6 });
  }
  return parts;
}

// Spawn effect based on combat result
function spawnSkillEffect(data) {
  const attacker = data.attackerId === game.player?.id
    ? game.player
    : (game.players.get(data.attackerId) || game.npcs.get(data.attackerId));
  const defender = data.defenderId === game.player?.id
    ? game.player
    : (game.npcs.get(data.defenderId) || game.players.get(data.defenderId));
  if (!defender?.position) return;

  // white hit flash on the defender sprite
  defender.hitFlash = 0.15;

  const tx = defender.position.x;
  const tz = defender.position.z;
  const fx = data.skill ? skillEffects[data.skill] : null;

  if (!fx) {
    // basic hit (e.g. monster attacking a player)
    game.effects.push({ type: 'slash', x: tx, z: tz, color: '#ff6050', size: 0.9, seed: Math.random() * 6.28, t: 0, dur: 0.3 });
    return;
  }

  if (fx.type === 'projectile' && attacker?.position) {
    game.effects.push({ type: 'projectile', fx: attacker.position.x, fz: attacker.position.z, tx, tz, color: fx.color, size: fx.size || 1, t: 0, dur: 0.28 });
  } else if (fx.type === 'arrows' && attacker?.position) {
    const n = fx.count || 1;
    for (let i = 0; i < n; i++) {
      game.effects.push({
        type: 'projectile', thin: true,
        fx: attacker.position.x + (i - (n - 1) / 2) * 1.5, fz: attacker.position.z,
        tx: tx + (i - (n - 1) / 2) * 1.2, tz,
        color: fx.color, t: -i * 0.06, dur: 0.22
      });
    }
    game.effects.push({ type: 'burst', x: tx, z: tz, color: fx.color, size: 0.7, t: 0.2, dur: 0.5, parts: makeBurstParts() });
  } else if (fx.type === 'bolt') {
    game.effects.push({ type: 'bolt', x: tx, z: tz, color: fx.color, t: 0, dur: 0.4, seed: Math.random() * 100 });
  } else if (fx.type === 'heal') {
    game.effects.push({ type: 'heal', x: tx, z: tz, color: fx.color, t: 0, dur: 0.9 });
  } else if (fx.type === 'burst') {
    game.effects.push({ type: 'burst', x: tx, z: tz, color: fx.color, size: fx.size || 1, t: 0, dur: 0.5, parts: makeBurstParts() });
  } else {
    game.effects.push({ type: 'slash', x: tx, z: tz, color: fx.color, size: fx.size || 1, seed: Math.random() * 6.28, t: 0, dur: 0.32 });
  }
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
  game.effects.push({ type: 'particles', x: position.x, z: position.z, particles, t: 0, dur: 1 });
  game.effects.push({ type: 'burst', x: position.x, z: position.z, color: '#ff4030', size: 1.2, t: 0, dur: 0.45, parts: makeBurstParts() });
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
  game.effects.push({ type: 'particles', x: game.player.position.x, z: game.player.position.z, particles, t: 0, dur: 1.5 });
  game.effects.push({ type: 'burst', x: game.player.position.x, z: game.player.position.z, color: '#ffd700', size: 2, t: 0, dur: 0.7, parts: makeBurstParts() });
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

    if (e.code === 'Space') { e.preventDefault(); useBasicAttack(); }
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

  document.querySelectorAll('.skill-slot:not(.item-slot):not(.basic-slot)').forEach((slot, index) => {
    slot.addEventListener('click', () => useSkill(index));
  });

  document.querySelector('.skill-slot.basic-slot')?.addEventListener('click', () => useBasicAttack());

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
    if (best.type === 'npc') {
      // approach the monster and melee attack when in range
      game.chaseTargetId = best.ent.id;
      game.moveTarget = null;
    }
  } else {
    // ground click: walk there
    const w = screenToWorld(sx, sy);
    if (Math.abs(w.x) <= 245 && Math.abs(w.z) <= 245) {
      game.moveTarget = { x: w.x, z: w.z };
      game.chaseTargetId = null;
      game.effects.push({ type: 'clickMarker', x: w.x, z: w.z, t: 0, dur: 0.6 });
    }
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
        useBasicAttack();
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
          useBasicAttack();
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

  // Touch: select monster / walk to tapped point
  game.canvas.addEventListener('touchstart', (e) => {
    if (e.target !== game.canvas) return;
    const touch = e.touches[0];
    handleClick(touch.clientX, touch.clientY);
  }, { passive: true });
}

// Shared movement helper: walk toward a world point, returns remaining distance
function stepToward(tx, tz, delta) {
  const dx = tx - game.player.position.x;
  const dz = tz - game.player.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.01) return 0;

  const speed = game.moveSpeed * (game.player.stats?.moveSpeed || 1);
  const step = Math.min(speed * delta, dist);
  const nx = game.player.position.x + (dx / dist) * step;
  const nz = game.player.position.z + (dz / dist) * step;

  let movedX = false, movedZ = false;
  if (!isBlocked(nx, game.player.position.z)) {
    game.player.position.x = nx;
    movedX = true;
  }
  if (!isBlocked(game.player.position.x, nz)) {
    game.player.position.z = nz;
    movedZ = true;
  }

  if (movedX || movedZ) {
    game.player.facing = getFacing(dx, dz);
    game.player.moving = true;
    game.player.animPhase = (game.player.animPhase || 0) + delta * 10;
    game.player.rotation = Math.atan2(dx, dz);
    game.socket.emit('playerMove', {
      position: game.player.position,
      rotation: game.player.rotation,
      velocity: { x: (dx / dist) * speed, y: 0, z: (dz / dist) * speed }
    });
    return dist - step;
  }
  return -1; // blocked
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

// Basic attack: free, no mana, 1 second cooldown, available to all classes
let lastBasicAttack = 0;
function useBasicAttack() {
  if (!game.selectedTarget || game.selectedTarget.dead) return;

  // melee only: if too far, run toward the target first
  const dist = Math.hypot(
    game.selectedTarget.position.x - game.player.position.x,
    game.selectedTarget.position.z - game.player.position.z
  );
  if (dist > MELEE_RANGE) {
    if (game.selectedTarget.targetType === 'npc') {
      game.chaseTargetId = game.selectedTarget.id;
      game.moveTarget = null;
    }
    return;
  }

  const now = Date.now();
  if (now - lastBasicAttack < 1000) return;
  lastBasicAttack = now;

  game.socket.emit('attack', {
    targetType: game.selectedTarget.targetType,
    targetId: game.selectedTarget.id,
    skill: null
  });

  // optimistic radial cooldown on the basic slot
  game.cooldowns.__basic = { end: performance.now() + 1000, dur: 1000 };
}

// Radial clockwise cooldown sweep (dark overlay clears clockwise)
function updateCooldownUI() {
  const now = performance.now();

  const applyToSlot = (slotEl, overlayEl, cd) => {
    if (!slotEl || !overlayEl) return;
    if (cd && now < cd.end) {
      const remaining = (cd.end - now) / 1000;
      const progress = 1 - (cd.end - now) / cd.dur; // 0 -> 1 as it recharges
      slotEl.classList.add('on-cooldown');
      overlayEl.style.background =
        `conic-gradient(transparent ${progress * 360}deg, rgba(0,0,0,0.75) ${progress * 360}deg)`;
      overlayEl.textContent = remaining >= 1 ? Math.ceil(remaining) : remaining.toFixed(1);
    } else {
      slotEl.classList.remove('on-cooldown');
      overlayEl.style.background = 'none';
      overlayEl.textContent = '';
    }
  };

  // basic attack slot
  const basicSlot = document.querySelector('.skill-slot.basic-slot');
  if (basicSlot) {
    applyToSlot(basicSlot, basicSlot.querySelector('.skill-cooldown'), game.cooldowns.__basic);
  }

  // desktop skill slots
  document.querySelectorAll('.skill-row .skill-slot:not(.basic-slot)').forEach((slot, i) => {
    const skillName = game.skillNames[i];
    applyToSlot(slot, slot.querySelector('.skill-cooldown'), skillName ? game.cooldowns[skillName] : null);
  });

  // mobile skill buttons
  document.querySelectorAll('.mobile-skill-btn').forEach((btn) => {
    const i = parseInt(btn.dataset.skill);
    const skillName = game.skillNames[i];
    applyToSlot(btn, btn.querySelector('.cooldown-overlay'), skillName ? game.cooldowns[skillName] : null);
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
  const skillSlots = document.querySelectorAll('.skill-row .skill-slot:not(.basic-slot)');

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
  game.delta = delta;

  // decay screen shake and hit flashes
  if (game.shake > 0) game.shake = Math.max(0, game.shake - delta * 1.5);
  if (game.player?.hitFlash > 0) game.player.hitFlash -= delta;
  game.players.forEach(p => { if (p.hitFlash > 0) p.hitFlash -= delta; });
  game.npcs.forEach(n => { if (n.hitFlash > 0) n.hitFlash -= delta; });

  // advance attack animations
  const tickAttack = (ent) => {
    if (ent?.attackAnim) {
      ent.attackAnim.t += delta;
      if (ent.attackAnim.t >= ent.attackAnim.dur) ent.attackAnim = null;
    }
  };
  tickAttack(game.player);
  game.players.forEach(tickAttack);
  game.npcs.forEach(tickAttack);

  // radial cooldown sweeps
  updateCooldownUI();

  if (game.player) {
    let moveX = 0, moveZ = 0;

    if (game.keys['KeyW'] || game.keys['ArrowUp']) moveZ -= 1;
    if (game.keys['KeyS'] || game.keys['ArrowDown']) moveZ += 1;
    if (game.keys['KeyA'] || game.keys['ArrowLeft']) moveX -= 1;
    if (game.keys['KeyD'] || game.keys['ArrowRight']) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      // manual movement cancels click-to-move and chase
      game.moveTarget = null;
      game.chaseTargetId = null;

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
    } else if (game.chaseTargetId) {
      // chase a monster and melee it when close enough
      const npc = game.npcs.get(game.chaseTargetId);
      if (!npc || npc.dead) {
        game.chaseTargetId = null;
        game.player.moving = false;
      } else {
        const dist = Math.hypot(
          npc.position.x - game.player.position.x,
          npc.position.z - game.player.position.z
        );
        if (dist > MELEE_RANGE * 0.85) {
          const res = stepToward(npc.position.x, npc.position.z, delta);
          if (res === -1) {
            // path blocked - stop chasing
            game.chaseTargetId = null;
            game.player.moving = false;
          }
        } else {
          // in melee range: face it and auto basic attack
          game.player.moving = false;
          const dx = npc.position.x - game.player.position.x;
          const dz = npc.position.z - game.player.position.z;
          if (Math.abs(dx) + Math.abs(dz) > 0.1) {
            game.player.facing = getFacing(dx, dz);
          }
          if (game.selectedTarget?.id !== npc.id) {
            selectTarget({ type: 'npc', id: npc.id });
          }
          useBasicAttack();
        }
      }
    } else if (game.moveTarget) {
      // click-to-move
      const res = stepToward(game.moveTarget.x, game.moveTarget.z, delta);
      if (res === -1 || res < 0.4) {
        game.moveTarget = null;
        game.player.moving = false;
      }
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
  let selectedGender = 'male';

  classOptions.forEach(option => {
    option.addEventListener('click', () => {
      classOptions.forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      selectedClass = option.dataset.class;
    });
  });

  document.querySelectorAll('.gender-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.gender-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      selectedGender = option.dataset.gender;
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
        class: selectedClass,
        gender: selectedGender
      });
    }, 100);

    gameLoop();
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupLoginScreen();
});
