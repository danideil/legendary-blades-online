// Slot-based combat skills shared by the game server.
// 1-3 start unlocked, 4/5/6 unlock at levels 5/10/15, 7-9 are bought from the trainer.

export const MELEE_RANGE = 3.2;
export const RANGED_RANGE = 14;

export function isRangedClass(cls) {
  return cls === 'darkWizard' || cls === 'fairyElf';
}

export function basicRange(cls) {
  return isRangedClass(cls) ? RANGED_RANGE : MELEE_RANGE;
}

export const SKILL_DEFS = {
  1: {
    id: 1,
    unlock: 'start',
    mana: 0,
    cooldown: 800,
    damageMul: 1.0,
    names: {
      darkKnight: { name: 'Slash', icon: '⚔️' },
      darkWizard: { name: 'Magic Bolt', icon: '🔮', mana: 4 },
      fairyElf: { name: 'Bow Shot', icon: '🏹' },
      bicheon: { name: 'Palm Strike', icon: '👊' },
      heuksal: { name: 'Glaive Cut', icon: '🗡️' }
    }
  },
  2: {
    id: 2,
    unlock: 'start',
    mana: 12,
    cooldown: 3000,
    damageMul: 1.65,
    names: {
      darkKnight: { name: 'Power Slash', icon: '💥' },
      darkWizard: { name: 'Charged Bolt', icon: '⚡' },
      fairyElf: { name: 'Power Shot', icon: '🎯' },
      bicheon: { name: 'Heavy Palm', icon: '👊' },
      heuksal: { name: 'Power Cut', icon: '💢' }
    }
  },
  3: {
    id: 3,
    unlock: 'start',
    mana: 18,
    cooldown: 5000,
    damageMul: 1.3,
    aoe: true,
    aoeRadius: 4,
    names: {
      darkKnight: { name: 'Shockwave', icon: '🌀' },
      darkWizard: { name: 'Arc Nova', icon: '🌊' },
      fairyElf: { name: 'Arrow Rain', icon: '🌧️' },
      bicheon: { name: 'Quake Palm', icon: '⛰️' },
      heuksal: { name: 'Dark Burst', icon: '🌑' }
    }
  },
  4: {
    id: 4,
    unlockLevel: 5,
    mana: 22,
    cooldown: 6000,
    damageMul: 1.9,
    names: {
      darkKnight: { name: 'Pierce', icon: '➡️' },
      darkWizard: { name: 'Soul Lance', icon: '✴️' },
      fairyElf: { name: 'Penetrate', icon: '🏹' },
      bicheon: { name: 'Spear Rush', icon: '🔱' },
      heuksal: { name: 'Shadow Pierce', icon: '👤' }
    }
  },
  5: {
    id: 5,
    unlockLevel: 10,
    mana: 28,
    cooldown: 8000,
    damageMul: 0,
    healMul: 0.28,
    selfCast: true,
    names: {
      darkKnight: { name: 'Battle Cry', icon: '🛡️' },
      darkWizard: { name: 'Mana Ward', icon: '✨' },
      fairyElf: { name: 'Heal', icon: '💚' },
      bicheon: { name: 'Inner Force', icon: '☯️' },
      heuksal: { name: 'Shadow Veil', icon: '🌫️' }
    }
  },
  6: {
    id: 6,
    unlockLevel: 15,
    mana: 40,
    cooldown: 12000,
    damageMul: 1.55,
    aoe: true,
    aoeRadius: 6,
    names: {
      darkKnight: { name: 'Storm Slash', icon: '🌪️' },
      darkWizard: { name: 'Inferno', icon: '☄️' },
      fairyElf: { name: 'Tempest', icon: '💨' },
      bicheon: { name: 'Dragon Storm', icon: '🐉' },
      heuksal: { name: 'Nightfall', icon: '🌙' }
    }
  },
  7: {
    id: 7,
    buy: true,
    buyLevel: 20,
    buyCost: 8000,
    mana: 50,
    cooldown: 14000,
    damageMul: 2.4,
    names: {
      darkKnight: { name: 'Dragon Fang', icon: '🐉' },
      darkWizard: { name: 'Abyss Bolt', icon: '🟣' },
      fairyElf: { name: 'Star Arrow', icon: '⭐' },
      bicheon: { name: 'Tiger Fang', icon: '🐯' },
      heuksal: { name: 'Death Mark', icon: '💀' }
    }
  },
  8: {
    id: 8,
    buy: true,
    buyLevel: 25,
    buyCost: 20000,
    mana: 70,
    cooldown: 18000,
    damageMul: 2.8,
    aoe: true,
    aoeRadius: 5.5,
    names: {
      darkKnight: { name: 'Annihilation', icon: '☠️' },
      darkWizard: { name: 'Meteor', icon: '🔥' },
      fairyElf: { name: 'Volley', icon: '🎪' },
      bicheon: { name: 'Heaven Split', icon: '⚡' },
      heuksal: { name: 'Massacre', icon: '🩸' }
    }
  },
  9: {
    id: 9,
    buy: true,
    buyLevel: 30,
    buyCost: 50000,
    mana: 100,
    cooldown: 25000,
    damageMul: 3.2,
    aoe: true,
    aoeRadius: 8,
    names: {
      darkKnight: { name: 'Cataclysm', icon: '🌋' },
      darkWizard: { name: 'Apocalypse', icon: '👁️' },
      fairyElf: { name: 'World Tree', icon: '🌳' },
      bicheon: { name: 'Divine Fist', icon: '👊' },
      heuksal: { name: 'Oblivion', icon: '🖤' }
    }
  }
};

export function defaultSkillLevels() {
  return { 1: 1, 2: 1, 3: 1, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
}

export function defaultLearnedSkills() {
  return { 7: false, 8: false, 9: false };
}

export function skillUnlockLevel(slot) {
  const def = SKILL_DEFS[slot];
  if (!def) return 999;
  if (def.unlock === 'start') return 1;
  if (def.unlockLevel) return def.unlockLevel;
  if (def.buy) return def.buyLevel;
  return 999;
}

export function isSkillKnown(player, slot) {
  const n = Number(slot);
  if (n <= 3) return true;
  if (n === 4) return player.level >= 5 && (player.skillLevels?.[4] || 0) >= 1;
  if (n === 5) return player.level >= 10 && (player.skillLevels?.[5] || 0) >= 1;
  if (n === 6) return player.level >= 15 && (player.skillLevels?.[6] || 0) >= 1;
  return !!(player.learnedSkills && player.learnedSkills[n] && (player.skillLevels?.[n] || 0) >= 1);
}

export function applyLevelUnlocks(player) {
  const unlocked = [];
  if (player.level >= 5 && (player.skillLevels[4] || 0) < 1) {
    player.skillLevels[4] = 1;
    unlocked.push(4);
  }
  if (player.level >= 10 && (player.skillLevels[5] || 0) < 1) {
    player.skillLevels[5] = 1;
    unlocked.push(5);
  }
  if (player.level >= 15 && (player.skillLevels[6] || 0) < 1) {
    player.skillLevels[6] = 1;
    unlocked.push(6);
  }
  return unlocked;
}

export function resolveSkill(cls, slot) {
  const def = SKILL_DEFS[slot];
  if (!def) return null;
  const flavor = def.names[cls] || def.names.darkKnight;
  const ranged = isRangedClass(cls);
  let range;
  if (def.selfCast) {
    range = 20;
  } else if (ranged) {
    range = RANGED_RANGE;
  } else {
    range = MELEE_RANGE + (slot >= 3 ? 0.6 : 0);
  }

  let effect = 'slash';
  if (def.selfCast) effect = 'heal';
  else if (def.aoe) effect = 'burst';
  else if (ranged && cls === 'fairyElf') effect = 'arrows';
  else if (ranged) effect = 'bolt';

  return {
    slot,
    name: flavor.name,
    icon: flavor.icon,
    mana: flavor.mana ?? def.mana,
    cooldown: def.cooldown,
    damageMul: def.damageMul,
    healMul: def.healMul || 0,
    aoe: !!def.aoe,
    aoeRadius: def.aoeRadius || 0,
    range,
    ranged,
    selfCast: !!def.selfCast,
    projectile: ranged && !def.selfCast,
    effect,
    unlock: def.unlock || null,
    unlockLevel: def.unlockLevel || null,
    buy: !!def.buy,
    buyLevel: def.buyLevel || null,
    buyCost: def.buyCost || 0
  };
}

export function skillPower(skillLevel) {
  const lvl = Math.max(1, Math.min(5, skillLevel || 1));
  return 1 + 0.18 * (lvl - 1);
}

export function upgradeCost(slot, currentLevel) {
  return Math.floor(250 * slot * Math.pow(2.4, currentLevel - 1));
}

export function upgradeLevelReq(slot, nextLevel) {
  const base = skillUnlockLevel(slot);
  return base + Math.max(0, nextLevel - 2) * 4;
}

export function buildSkillHud(player) {
  const hud = {};
  for (let slot = 1; slot <= 9; slot++) {
    const skill = resolveSkill(player.class, slot);
    const known = isSkillKnown(player, slot);
    const level = player.skillLevels?.[slot] || 0;
    hud[slot] = {
      ...skill,
      known,
      skillLevel: known ? Math.max(1, level) : 0,
      locked: !known,
      nextCost: known && level < 5 ? upgradeCost(slot, Math.max(1, level)) : null,
      nextLevelReq: known && level < 5 ? upgradeLevelReq(slot, level + 1) : null
    };
  }
  return hud;
}
