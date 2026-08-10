import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, '../client')));

// Game State
const gameState = {
  players: new Map(),
  npcs: new Map(),
  items: new Map(),
  caravans: new Map(),
  dropItems: new Map()
};

// MU Online inspired classes with Silkroad elements
const classData = {
  darkKnight: {
    name: 'Dark Knight',
    description: 'Melee warrior with devastating sword skills',
    baseStats: { strength: 28, agility: 20, vitality: 25, energy: 10 },
    healthPerVit: 3,
    manaPerEnergy: 1,
    damagePerStr: 1.2,
    skills: {
      twistingSlash: { name: 'Twisting Slash', damage: 35, cooldown: 2000, mana: 10, range: 4, aoe: true, aoeRadius: 3 },
      deathStab: { name: 'Death Stab', damage: 50, cooldown: 3000, mana: 15, range: 3 },
      ragefulBlow: { name: 'Rageful Blow', damage: 80, cooldown: 6000, mana: 25, range: 4 },
      comboSlash: { name: 'Combo Slash', damage: 100, cooldown: 8000, mana: 35, range: 3, combo: true }
    }
  },
  darkWizard: {
    name: 'Dark Wizard',
    description: 'Master of destructive magic',
    baseStats: { strength: 10, agility: 15, vitality: 15, energy: 35 },
    healthPerVit: 2,
    manaPerEnergy: 2.5,
    damagePerEnergy: 1.5,
    skills: {
      fireBall: { name: 'Fire Ball', damage: 30, cooldown: 1500, mana: 8, range: 20, projectile: true },
      powerWave: { name: 'Power Wave', damage: 25, cooldown: 2000, mana: 12, range: 15, aoe: true, aoeRadius: 4 },
      hellFire: { name: 'Hell Fire', damage: 60, cooldown: 5000, mana: 30, range: 25, aoe: true, aoeRadius: 5 },
      inferno: { name: 'Inferno', damage: 120, cooldown: 10000, mana: 50, range: 20, aoe: true, aoeRadius: 8 }
    }
  },
  fairyElf: {
    name: 'Fairy Elf',
    description: 'Agile archer with support magic',
    baseStats: { strength: 15, agility: 30, vitality: 18, energy: 20 },
    healthPerVit: 2,
    manaPerEnergy: 1.5,
    damagePerAgi: 1.3,
    skills: {
      tripleShot: { name: 'Triple Shot', damage: 25, cooldown: 1500, mana: 8, range: 30, projectiles: 3 },
      penetration: { name: 'Penetration', damage: 45, cooldown: 3000, mana: 15, range: 35, pierce: true },
      iceArrow: { name: 'Ice Arrow', damage: 35, cooldown: 4000, mana: 20, range: 30, slow: 0.5 },
      heal: { name: 'Heal', damage: -60, cooldown: 8000, mana: 40, range: 15, targetAlly: true }
    }
  },
  bicheon: {
    name: 'Bicheon',
    description: 'Chinese martial artist with sword and spear',
    baseStats: { strength: 25, agility: 25, vitality: 22, energy: 12 },
    healthPerVit: 2.5,
    manaPerEnergy: 1.2,
    damagePerStr: 1.1,
    skills: {
      chainSword: { name: 'Chain Sword', damage: 30, cooldown: 1800, mana: 10, range: 5, hits: 3 },
      snowFlower: { name: 'Snow Flower Sword', damage: 55, cooldown: 4000, mana: 20, range: 6, aoe: true, aoeRadius: 4 },
      flyingDragon: { name: 'Flying Dragon Spear', damage: 70, cooldown: 5000, mana: 25, range: 8 },
      thunderAssault: { name: 'Thunder Assault', damage: 90, cooldown: 8000, mana: 35, range: 3, dash: true }
    }
  },
  heuksal: {
    name: 'Heuksal',
    description: 'Assassin wielding dual glaives',
    baseStats: { strength: 22, agility: 28, vitality: 18, energy: 15 },
    healthPerVit: 2,
    manaPerEnergy: 1.3,
    damagePerAgi: 1.2,
    skills: {
      shadowStrike: { name: 'Shadow Strike', damage: 40, cooldown: 2000, mana: 12, range: 5, stealth: true },
      phantomSlash: { name: 'Phantom Slash', damage: 55, cooldown: 3500, mana: 18, range: 6, bleed: true },
      darkCloud: { name: 'Dark Cloud', damage: 65, cooldown: 5000, mana: 25, range: 8, aoe: true, aoeRadius: 5 },
      assassinate: { name: 'Assassinate', damage: 150, cooldown: 12000, mana: 45, range: 3, critBonus: 2.0 }
    }
  }
};

// MU/Silkroad inspired monsters
const monsterTemplates = {
  budgeDragon: { name: 'Budge Dragon', health: 80, damage: 8, xpReward: 30, goldDrop: [5, 15], level: 1, respawnTime: 15000 },
  spider: { name: 'Giant Spider', health: 120, damage: 12, xpReward: 45, goldDrop: [10, 25], level: 3, respawnTime: 18000 },
  hound: { name: 'Hell Hound', health: 180, damage: 18, xpReward: 70, goldDrop: [15, 40], level: 6, respawnTime: 22000 },
  goldenGoblin: { name: 'Golden Goblin', health: 100, damage: 5, xpReward: 200, goldDrop: [100, 300], level: 1, respawnTime: 120000, rare: true },
  lichenKing: { name: 'Lichen King', health: 300, damage: 25, xpReward: 150, goldDrop: [30, 80], level: 10, respawnTime: 30000 },
  ghostPhantom: { name: 'Ghost Phantom', health: 400, damage: 35, xpReward: 220, goldDrop: [50, 120], level: 15, respawnTime: 35000 },
  shadowMaster: { name: 'Shadow Master', health: 600, damage: 45, xpReward: 350, goldDrop: [80, 200], level: 22, respawnTime: 45000 },
  deathKnight: { name: 'Death Knight', health: 1000, damage: 60, xpReward: 500, goldDrop: [150, 400], level: 30, respawnTime: 60000, boss: true },
  kundun: { name: 'Kundun', health: 5000, damage: 150, xpReward: 5000, goldDrop: [1000, 3000], level: 50, respawnTime: 300000, boss: true, worldBoss: true },
  tigerGirl: { name: 'Tiger Girl', health: 250, damage: 30, xpReward: 180, goldDrop: [40, 100], level: 12, respawnTime: 25000 },
  bandit: { name: 'Desert Bandit', health: 200, damage: 22, xpReward: 120, goldDrop: [25, 60], level: 8, respawnTime: 20000, thief: true },
  eliteThief: { name: 'Elite Thief', health: 350, damage: 40, xpReward: 280, goldDrop: [60, 150], level: 18, respawnTime: 40000, thief: true }
};

// Item Templates with enhancement system
const itemTemplates = {
  // Consumables
  smallHealPotion: { name: 'Small Heal Potion', type: 'consumable', effect: { health: 50 }, stackable: true, buyPrice: 30, sellPrice: 10 },
  healPotion: { name: 'Heal Potion', type: 'consumable', effect: { health: 150 }, stackable: true, buyPrice: 100, sellPrice: 35 },
  greatHealPotion: { name: 'Great Heal Potion', type: 'consumable', effect: { health: 400 }, stackable: true, buyPrice: 300, sellPrice: 100 },
  smallManaPotion: { name: 'Small Mana Potion', type: 'consumable', effect: { mana: 30 }, stackable: true, buyPrice: 40, sellPrice: 15 },
  manaPotion: { name: 'Mana Potion', type: 'consumable', effect: { mana: 100 }, stackable: true, buyPrice: 120, sellPrice: 40 },

  // Enhancement items
  blessJewel: { name: 'Jewel of Bless', type: 'enhancement', effect: 'bless', stackable: true, buyPrice: 5000, sellPrice: 2000 },
  soulJewel: { name: 'Jewel of Soul', type: 'enhancement', effect: 'soul', stackable: true, buyPrice: 6000, sellPrice: 2500 },
  lifeJewel: { name: 'Jewel of Life', type: 'enhancement', effect: 'life', stackable: true, buyPrice: 10000, sellPrice: 4000 },
  chaosJewel: { name: 'Jewel of Chaos', type: 'enhancement', effect: 'chaos', stackable: true, buyPrice: 15000, sellPrice: 6000 },

  // Wings
  wingsOfElf: { name: 'Wings of Elf', type: 'wings', slot: 'wings', tier: 1, stats: { damage: 12, defense: 10, speed: 0.1 }, requiredLevel: 15 },
  wingsOfHeaven: { name: 'Wings of Heaven', type: 'wings', slot: 'wings', tier: 2, stats: { damage: 25, defense: 20, speed: 0.15 }, requiredLevel: 40 },
  wingsOfDarkness: { name: 'Wings of Darkness', type: 'wings', slot: 'wings', tier: 2, stats: { damage: 32, defense: 15, speed: 0.12 }, requiredLevel: 40 },
  capeOfLord: { name: 'Cape of Lord', type: 'wings', slot: 'wings', tier: 3, stats: { damage: 50, defense: 35, speed: 0.2 }, requiredLevel: 80 },

  // Weapons - Swords
  shortSword: { name: 'Short Sword', type: 'weapon', slot: 'mainHand', weaponType: 'sword', stats: { damage: 8 }, requiredLevel: 1 },
  kris: { name: 'Kris', type: 'weapon', slot: 'mainHand', weaponType: 'sword', stats: { damage: 15 }, requiredLevel: 6 },
  rapier: { name: 'Rapier', type: 'weapon', slot: 'mainHand', weaponType: 'sword', stats: { damage: 22 }, requiredLevel: 12 },
  katana: { name: 'Katana', type: 'weapon', slot: 'mainHand', weaponType: 'sword', stats: { damage: 35 }, requiredLevel: 22 },
  lightingSword: { name: 'Lighting Sword', type: 'weapon', slot: 'mainHand', weaponType: 'sword', stats: { damage: 50, attackSpeed: 0.1 }, requiredLevel: 35, glow: 'lightning' },
  legendSword: { name: 'Sword of Legend', type: 'weapon', slot: 'mainHand', weaponType: 'sword', stats: { damage: 80, critChance: 0.1 }, requiredLevel: 50, glow: 'red' },

  // Weapons - Staffs
  skullStaff: { name: 'Skull Staff', type: 'weapon', slot: 'mainHand', weaponType: 'staff', stats: { damage: 10, magicDamage: 15 }, requiredLevel: 1 },
  serpentStaff: { name: 'Serpent Staff', type: 'weapon', slot: 'mainHand', weaponType: 'staff', stats: { damage: 12, magicDamage: 28 }, requiredLevel: 10 },
  thunderStaff: { name: 'Thunder Staff', type: 'weapon', slot: 'mainHand', weaponType: 'staff', stats: { damage: 15, magicDamage: 45 }, requiredLevel: 25, glow: 'blue' },
  grandSoulStaff: { name: 'Grand Soul Staff', type: 'weapon', slot: 'mainHand', weaponType: 'staff', stats: { damage: 20, magicDamage: 75 }, requiredLevel: 45, glow: 'purple' },

  // Weapons - Bows
  shortBow: { name: 'Short Bow', type: 'weapon', slot: 'mainHand', weaponType: 'bow', stats: { damage: 12 }, requiredLevel: 1 },
  elvenBow: { name: 'Elven Bow', type: 'weapon', slot: 'mainHand', weaponType: 'bow', stats: { damage: 25, attackSpeed: 0.05 }, requiredLevel: 15 },
  silverBow: { name: 'Silver Bow', type: 'weapon', slot: 'mainHand', weaponType: 'bow', stats: { damage: 40, critChance: 0.08 }, requiredLevel: 30 },
  celestialBow: { name: 'Celestial Bow', type: 'weapon', slot: 'mainHand', weaponType: 'bow', stats: { damage: 60, critChance: 0.12, attackSpeed: 0.1 }, requiredLevel: 50, glow: 'green' },

  // Armor
  leatherArmor: { name: 'Leather Armor', type: 'armor', slot: 'chest', stats: { defense: 8 }, requiredLevel: 1 },
  paddedArmor: { name: 'Padded Armor', type: 'armor', slot: 'chest', stats: { defense: 15 }, requiredLevel: 8 },
  boneArmor: { name: 'Bone Armor', type: 'armor', slot: 'chest', stats: { defense: 25 }, requiredLevel: 18 },
  scaleArmor: { name: 'Scale Armor', type: 'armor', slot: 'chest', stats: { defense: 40 }, requiredLevel: 30 },
  dragonArmor: { name: 'Dragon Armor', type: 'armor', slot: 'chest', stats: { defense: 65, health: 100 }, requiredLevel: 50, glow: 'red' },

  // Silkroad Trade goods
  silkBundle: { name: 'Silk Bundle', type: 'trade', tradeValue: 500, weight: 10 },
  spiceBox: { name: 'Exotic Spices', type: 'trade', tradeValue: 800, weight: 8 },
  goldIngot: { name: 'Gold Ingot', type: 'trade', tradeValue: 2000, weight: 15 },
  ancientArtifact: { name: 'Ancient Artifact', type: 'trade', tradeValue: 5000, weight: 5 }
};

// Quest Templates
const questTemplates = {
  budgeHunter: {
    id: 'budgeHunter',
    name: 'Budge Dragon Hunter',
    description: 'Eliminate the Budge Dragons infesting the outskirts',
    objectives: [{ type: 'kill', target: 'budgeDragon', current: 0, required: 10 }],
    rewards: { xp: 200, gold: 100 },
    minLevel: 1
  },
  spiderExterminator: {
    id: 'spiderExterminator',
    name: 'Spider Exterminator',
    description: 'Clear out the Giant Spider nest',
    objectives: [{ type: 'kill', target: 'spider', current: 0, required: 15 }],
    rewards: { xp: 500, gold: 250, items: ['healPotion'] },
    minLevel: 3
  },
  hellHoundSlayer: {
    id: 'hellHoundSlayer',
    name: 'Hell Hound Slayer',
    description: 'Hunt down the Hell Hounds terrorizing travelers',
    objectives: [{ type: 'kill', target: 'hound', current: 0, required: 12 }],
    rewards: { xp: 800, gold: 400, items: ['blessJewel'] },
    minLevel: 6
  },
  goldenChase: {
    id: 'goldenChase',
    name: 'Golden Opportunity',
    description: 'Find and defeat the rare Golden Goblin',
    objectives: [{ type: 'kill', target: 'goldenGoblin', current: 0, required: 1 }],
    rewards: { xp: 1000, gold: 1000 },
    minLevel: 1
  },
  deathKnightChallenge: {
    id: 'deathKnightChallenge',
    name: 'Death Knight Challenge',
    description: 'Defeat the fearsome Death Knight boss',
    objectives: [{ type: 'kill', target: 'deathKnight', current: 0, required: 1 }],
    rewards: { xp: 3000, gold: 2000, items: ['soulJewel', 'soulJewel'] },
    minLevel: 25
  },
  silkroadTrader: {
    id: 'silkroadTrader',
    name: 'Silk Road Merchant',
    description: 'Successfully complete a trade caravan run',
    objectives: [{ type: 'trade', current: 0, required: 1 }],
    rewards: { xp: 1500, gold: 800 },
    minLevel: 10
  },
  thiefHunter: {
    id: 'thiefHunter',
    name: 'Thief Hunter',
    description: 'Protect trade routes by eliminating bandits',
    objectives: [{ type: 'kill', target: 'bandit', current: 0, required: 20 }],
    rewards: { xp: 1200, gold: 600, items: ['lifeJewel'] },
    minLevel: 8
  },
  kundunSlayer: {
    id: 'kundunSlayer',
    name: 'Kundun Slayer',
    description: 'Defeat the World Boss Kundun',
    objectives: [{ type: 'kill', target: 'kundun', current: 0, required: 1 }],
    rewards: { xp: 20000, gold: 10000, items: ['chaosJewel', 'wingsOfHeaven'] },
    minLevel: 40
  }
};

// Spawn locations for monsters
const monsterSpawns = [
  // Starter area - Budge Dragons
  { type: 'budgeDragon', x: 25, z: 20, area: 'starter' },
  { type: 'budgeDragon', x: -30, z: 25, area: 'starter' },
  { type: 'budgeDragon', x: 35, z: -20, area: 'starter' },
  { type: 'budgeDragon', x: -25, z: -30, area: 'starter' },
  { type: 'budgeDragon', x: 40, z: 35, area: 'starter' },
  { type: 'budgeDragon', x: -40, z: 40, area: 'starter' },

  // Spider forest
  { type: 'spider', x: 60, z: 30, area: 'forest' },
  { type: 'spider', x: 70, z: 45, area: 'forest' },
  { type: 'spider', x: 55, z: 55, area: 'forest' },
  { type: 'spider', x: 80, z: 35, area: 'forest' },
  { type: 'spider', x: 65, z: 60, area: 'forest' },

  // Hell Hound territory
  { type: 'hound', x: -60, z: 50, area: 'wasteland' },
  { type: 'hound', x: -75, z: 40, area: 'wasteland' },
  { type: 'hound', x: -65, z: 65, area: 'wasteland' },
  { type: 'hound', x: -80, z: 55, area: 'wasteland' },

  // Lichen King area
  { type: 'lichenKing', x: 100, z: 80, area: 'swamp' },
  { type: 'lichenKing', x: 110, z: 95, area: 'swamp' },
  { type: 'lichenKing', x: 95, z: 100, area: 'swamp' },

  // Ghost area
  { type: 'ghostPhantom', x: -100, z: -60, area: 'ruins' },
  { type: 'ghostPhantom', x: -110, z: -75, area: 'ruins' },
  { type: 'ghostPhantom', x: -95, z: -85, area: 'ruins' },

  // Shadow territory
  { type: 'shadowMaster', x: 120, z: -100, area: 'shadow' },
  { type: 'shadowMaster', x: 135, z: -110, area: 'shadow' },

  // Tiger Girls (Silkroad)
  { type: 'tigerGirl', x: -50, z: -80, area: 'eastern' },
  { type: 'tigerGirl', x: -65, z: -90, area: 'eastern' },
  { type: 'tigerGirl', x: -55, z: -100, area: 'eastern' },

  // Trade route bandits
  { type: 'bandit', x: 30, z: 80, area: 'tradeRoute' },
  { type: 'bandit', x: 45, z: 90, area: 'tradeRoute' },
  { type: 'bandit', x: 55, z: 100, area: 'tradeRoute' },
  { type: 'bandit', x: 40, z: 110, area: 'tradeRoute' },
  { type: 'eliteThief', x: 50, z: 95, area: 'tradeRoute' },

  // Bosses
  { type: 'deathKnight', x: 150, z: 0, area: 'bossArena' },
  { type: 'kundun', x: 0, z: 200, area: 'kundunLair' },

  // Rare spawn
  { type: 'goldenGoblin', x: Math.random() * 200 - 100, z: Math.random() * 200 - 100, area: 'roaming' }
];

// Trade routes for Silkroad system
const tradeRoutes = [
  { id: 'route1', name: 'Jangan to Donwhang', start: { x: 0, z: 0 }, end: { x: 100, z: 150 }, danger: 'low', reward: 1.5 },
  { id: 'route2', name: 'Donwhang to Hotan', start: { x: 100, z: 150 }, end: { x: -80, z: 180 }, danger: 'medium', reward: 2.0 },
  { id: 'route3', name: 'Hotan to Constantinople', start: { x: -80, z: 180 }, end: { x: -150, z: 50 }, danger: 'high', reward: 3.0 }
];

// Initialize world
function initializeWorld() {
  monsterSpawns.forEach((spawn, index) => {
    const template = monsterTemplates[spawn.type];
    const npc = {
      id: `npc_${index}`,
      type: spawn.type,
      ...template,
      maxHealth: template.health,
      position: { x: spawn.x, y: 0, z: spawn.z },
      rotation: Math.random() * Math.PI * 2,
      spawnPosition: { x: spawn.x, y: 0, z: spawn.z },
      area: spawn.area,
      state: 'idle',
      targetId: null,
      lastAttack: 0,
      dead: false
    };
    gameState.npcs.set(npc.id, npc);
  });

  console.log(`Initialized ${gameState.npcs.size} monsters`);
}

// Calculate XP required for level (MU-style exponential)
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.08, level) * level);
}

// Calculate stats based on class and level
function calculateStats(player) {
  const classInfo = classData[player.class];

  const totalStr = classInfo.baseStats.strength + (player.statPoints?.strength || 0);
  const totalAgi = classInfo.baseStats.agility + (player.statPoints?.agility || 0);
  const totalVit = classInfo.baseStats.vitality + (player.statPoints?.vitality || 0);
  const totalEnergy = classInfo.baseStats.energy + (player.statPoints?.energy || 0);

  let baseDamage = 10;
  if (classInfo.damagePerStr) baseDamage += totalStr * classInfo.damagePerStr;
  if (classInfo.damagePerAgi) baseDamage += totalAgi * classInfo.damagePerAgi;
  if (classInfo.damagePerEnergy) baseDamage += totalEnergy * classInfo.damagePerEnergy;

  // Add equipment bonuses
  let equipDamage = 0;
  let equipDefense = 0;
  let equipMagicDamage = 0;
  let equipHealth = 0;
  let equipSpeed = 0;

  Object.values(player.equipment).forEach(item => {
    if (item && item.stats) {
      equipDamage += (item.stats.damage || 0) * (1 + (item.enhancement || 0) * 0.05);
      equipDefense += (item.stats.defense || 0) * (1 + (item.enhancement || 0) * 0.05);
      equipMagicDamage += (item.stats.magicDamage || 0) * (1 + (item.enhancement || 0) * 0.05);
      equipHealth += item.stats.health || 0;
      equipSpeed += item.stats.speed || 0;
    }
  });

  return {
    strength: totalStr,
    agility: totalAgi,
    vitality: totalVit,
    energy: totalEnergy,
    damage: Math.floor(baseDamage + equipDamage),
    magicDamage: Math.floor(equipMagicDamage + totalEnergy * 0.8),
    defense: Math.floor(totalAgi * 0.5 + equipDefense),
    maxHealth: Math.floor(80 + totalVit * classInfo.healthPerVit + player.level * 5 + equipHealth),
    maxMana: Math.floor(30 + totalEnergy * classInfo.manaPerEnergy + player.level * 2),
    attackSpeed: 1 + totalAgi * 0.005 + equipSpeed,
    critChance: 0.05 + totalAgi * 0.001,
    moveSpeed: 1 + equipSpeed
  };
}

// Create new player
function createPlayer(socketId, name, playerClass) {
  const classInfo = classData[playerClass] || classData.darkKnight;

  const player = {
    id: socketId,
    name: name || `Player_${socketId.substring(0, 6)}`,
    class: playerClass || 'darkKnight',
    level: 1,
    xp: 0,
    xpToLevel: xpForLevel(2),
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    velocity: { x: 0, y: 0, z: 0 },
    statPoints: { strength: 0, agility: 0, vitality: 0, energy: 0 },
    freeStatPoints: 0,
    skills: classInfo.skills,
    skillCooldowns: {},
    inventory: [
      { ...itemTemplates.smallHealPotion, quantity: 20 },
      { ...itemTemplates.smallManaPotion, quantity: 20 }
    ],
    equipment: {
      mainHand: null,
      offHand: null,
      head: null,
      chest: null,
      legs: null,
      feet: null,
      wings: null
    },
    gold: 10000,
    zen: 10000, // MU currency
    quests: {
      active: [],
      completed: []
    },
    job: null, // Silkroad job system: 'trader', 'thief', 'hunter'
    caravan: null,
    comboCount: 0,
    lastComboTime: 0,
    inCombat: false,
    pvpEnabled: false,
    guildId: null,
    lastAction: Date.now()
  };

  // Calculate initial stats
  const stats = calculateStats(player);
  player.stats = stats;
  player.health = stats.maxHealth;
  player.mana = stats.maxMana;
  player.maxHealth = stats.maxHealth;
  player.maxMana = stats.maxMana;

  // Give starter weapon based on class
  const starterWeapons = {
    darkKnight: itemTemplates.shortSword,
    darkWizard: itemTemplates.skullStaff,
    fairyElf: itemTemplates.shortBow,
    bicheon: itemTemplates.shortSword,
    heuksal: itemTemplates.kris
  };

  player.equipment.mainHand = { ...starterWeapons[playerClass], enhancement: 0 };
  player.equipment.chest = { ...itemTemplates.leatherArmor, enhancement: 0 };

  // Recalculate with equipment
  const newStats = calculateStats(player);
  player.stats = newStats;
  player.health = newStats.maxHealth;
  player.mana = newStats.maxMana;
  player.maxHealth = newStats.maxHealth;
  player.maxMana = newStats.maxMana;

  return player;
}

// Handle combat with combo system
function handleCombat(attacker, defender, skillName = null) {
  if (defender.dead) return null;

  let baseDamage = attacker.stats ? attacker.stats.damage : attacker.damage;
  let isMagic = false;
  let manaCost = 0;
  let skill = null;

  if (skillName && attacker.skills && attacker.skills[skillName]) {
    skill = attacker.skills[skillName];
    baseDamage = skill.damage;
    manaCost = skill.mana;
    isMagic = skill.projectile || false;

    if (attacker.mana !== undefined && attacker.mana < manaCost) {
      return { error: 'Not enough mana' };
    }

    const now = Date.now();
    const lastUsed = attacker.skillCooldowns?.[skillName] || 0;
    if (now - lastUsed < skill.cooldown) {
      return { error: 'Skill on cooldown' };
    }

    if (attacker.skillCooldowns) attacker.skillCooldowns[skillName] = now;
    if (attacker.mana !== undefined) attacker.mana -= manaCost;
  }

  // Add magic damage for wizards
  if (isMagic && attacker.stats?.magicDamage) {
    baseDamage += attacker.stats.magicDamage * 0.5;
  }

  // Calculate defense
  const defense = defender.stats ? defender.stats.defense : 0;
  let actualDamage = Math.max(1, baseDamage - defense * 0.5);

  // Critical hit
  const critChance = attacker.stats?.critChance || 0.05;
  const isCrit = Math.random() < critChance;
  if (isCrit) {
    actualDamage *= 1.5;
  }

  // Combo bonus
  if (attacker.comboCount !== undefined) {
    const now = Date.now();
    if (now - (attacker.lastComboTime || 0) < 3000) {
      attacker.comboCount = Math.min(10, attacker.comboCount + 1);
      actualDamage *= (1 + attacker.comboCount * 0.05);
    } else {
      attacker.comboCount = 1;
    }
    attacker.lastComboTime = now;
  }

  actualDamage = Math.floor(actualDamage);
  defender.health -= actualDamage;

  const result = {
    attackerId: attacker.id,
    defenderId: defender.id,
    damage: actualDamage,
    skill: skillName,
    defenderHealth: defender.health,
    attackerMana: attacker.mana,
    critical: isCrit,
    combo: attacker.comboCount || 0
  };

  if (defender.health <= 0) {
    defender.health = 0;
    defender.dead = true;
    result.killed = true;

    // Drop items and gold for NPCs
    if (defender.xpReward) {
      result.xpReward = defender.xpReward;
      result.goldReward = Math.floor(Math.random() * (defender.goldDrop[1] - defender.goldDrop[0]) + defender.goldDrop[0]);

      // Item drops
      result.drops = generateDrops(defender);

      setTimeout(() => {
        respawnNPC(defender.id);
      }, defender.respawnTime);
    }
  }

  return result;
}

// Generate item drops
function generateDrops(monster) {
  const drops = [];
  const dropChance = monster.boss ? 0.8 : (monster.rare ? 0.5 : 0.15);

  if (Math.random() < dropChance) {
    // Determine what to drop based on monster level
    const possibleDrops = [];

    if (monster.level >= 1) possibleDrops.push('smallHealPotion', 'smallManaPotion');
    if (monster.level >= 5) possibleDrops.push('healPotion', 'manaPotion', 'shortSword', 'leatherArmor');
    if (monster.level >= 10) possibleDrops.push('kris', 'paddedArmor', 'elvenBow', 'serpentStaff');
    if (monster.level >= 20) possibleDrops.push('rapier', 'boneArmor', 'blessJewel');
    if (monster.level >= 30) possibleDrops.push('katana', 'scaleArmor', 'silverBow', 'thunderStaff', 'soulJewel');
    if (monster.level >= 40) possibleDrops.push('wingsOfElf', 'lifeJewel');
    if (monster.level >= 50) possibleDrops.push('lightingSword', 'legendSword', 'celestialBow', 'grandSoulStaff', 'dragonArmor', 'wingsOfHeaven', 'wingsOfDarkness');

    if (monster.worldBoss) {
      possibleDrops.push('capeOfLord', 'chaosJewel');
    }

    const dropItem = possibleDrops[Math.floor(Math.random() * possibleDrops.length)];
    if (itemTemplates[dropItem]) {
      const item = { ...itemTemplates[dropItem], quantity: 1 };
      if (item.type === 'weapon' || item.type === 'armor' || item.type === 'wings') {
        item.enhancement = Math.floor(Math.random() * 4); // +0 to +3
      }
      drops.push(item);
    }
  }

  return drops;
}

// Respawn NPC
function respawnNPC(npcId) {
  const npc = gameState.npcs.get(npcId);
  if (!npc) return;

  const template = monsterTemplates[npc.type];

  // For golden goblin, respawn at random location
  if (npc.type === 'goldenGoblin') {
    npc.position = {
      x: Math.random() * 200 - 100,
      y: 0,
      z: Math.random() * 200 - 100
    };
    npc.spawnPosition = { ...npc.position };
  } else {
    npc.position = { ...npc.spawnPosition };
  }

  npc.health = template.health;
  npc.maxHealth = template.health;
  npc.dead = false;
  npc.state = 'idle';
  npc.targetId = null;

  io.emit('npcRespawn', {
    id: npc.id,
    position: npc.position,
    health: npc.health,
    maxHealth: npc.maxHealth
  });
}

// Enhance item (+1 to +15 system)
function enhanceItem(player, itemIndex, jewelType) {
  const item = player.inventory[itemIndex];
  if (!item || !item.enhancement === undefined) return { success: false, error: 'Invalid item' };

  const currentEnhancement = item.enhancement || 0;
  if (currentEnhancement >= 15) return { success: false, error: 'Item already at max enhancement' };

  // Find jewel in inventory
  const jewelName = jewelType === 'bless' ? 'Jewel of Bless' : 'Jewel of Soul';
  const jewelIndex = player.inventory.findIndex(i => i.name === jewelName && i.quantity > 0);
  if (jewelIndex === -1) return { success: false, error: 'No jewel found' };

  // Consume jewel
  player.inventory[jewelIndex].quantity--;
  if (player.inventory[jewelIndex].quantity <= 0) {
    player.inventory.splice(jewelIndex, 1);
  }

  // Calculate success rate
  let successRate;
  if (jewelType === 'bless') {
    // Bless: 100% up to +6, then decreasing
    successRate = currentEnhancement < 6 ? 1.0 : Math.max(0.5, 1 - (currentEnhancement - 5) * 0.1);
  } else {
    // Soul: Higher potential but lower rates
    successRate = Math.max(0.3, 0.75 - currentEnhancement * 0.05);
  }

  if (Math.random() < successRate) {
    item.enhancement = currentEnhancement + 1;
    return { success: true, newEnhancement: item.enhancement };
  } else {
    // Failure - item downgrades or breaks
    if (currentEnhancement > 6 && Math.random() < 0.3) {
      // Item breaks
      player.inventory.splice(itemIndex, 1);
      return { success: false, destroyed: true };
    } else {
      // Downgrade
      item.enhancement = Math.max(0, currentEnhancement - 1);
      return { success: false, newEnhancement: item.enhancement };
    }
  }
}

// Award XP with level up
function awardXP(player, amount) {
  player.xp += amount;
  let leveledUp = false;
  let levelsGained = 0;

  while (player.xp >= player.xpToLevel) {
    player.xp -= player.xpToLevel;
    player.level++;
    levelsGained++;
    player.xpToLevel = xpForLevel(player.level + 1);

    // Award stat points (5 per level, MU style)
    player.freeStatPoints += 5;

    leveledUp = true;
  }

  // Recalculate stats
  const newStats = calculateStats(player);
  player.stats = newStats;
  player.maxHealth = newStats.maxHealth;
  player.maxMana = newStats.maxMana;

  // Full heal on level up
  if (leveledUp) {
    player.health = player.maxHealth;
    player.mana = player.maxMana;
  }

  return { leveledUp, newLevel: player.level, levelsGained, freeStatPoints: player.freeStatPoints };
}

// Update quest progress
function updateQuestProgress(player, type, target) {
  let updated = false;

  player.quests.active.forEach(quest => {
    quest.objectives.forEach(obj => {
      if (obj.type === type && (!obj.target || obj.target === target) && obj.current < obj.required) {
        obj.current++;
        updated = true;

        if (quest.objectives.every(o => o.current >= o.required)) {
          quest.completed = true;
        }
      }
    });
  });

  return updated;
}

// NPC AI Update
function updateNPCs() {
  gameState.npcs.forEach((npc) => {
    if (npc.dead) return;

    let nearestPlayer = null;
    let nearestDist = Infinity;
    const aggroRange = npc.boss ? 50 : (npc.thief ? 40 : 25);

    gameState.players.forEach((player) => {
      if (player.dead) return;

      const dx = player.position.x - npc.position.x;
      const dz = player.position.z - npc.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < nearestDist && dist < aggroRange) {
        nearestDist = dist;
        nearestPlayer = player;
      }
    });

    if (nearestPlayer) {
      npc.state = 'aggro';
      npc.targetId = nearestPlayer.id;

      const dx = nearestPlayer.position.x - npc.position.x;
      const dz = nearestPlayer.position.z - npc.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const attackRange = npc.boss ? 4 : 2.5;

      if (dist > attackRange) {
        const speed = npc.boss ? 0.15 : 0.12;
        npc.position.x += (dx / dist) * speed;
        npc.position.z += (dz / dist) * speed;
        npc.rotation = Math.atan2(dx, dz);
      } else {
        const now = Date.now();
        const attackCooldown = npc.boss ? 1500 : 2000;
        if (now - npc.lastAttack > attackCooldown) {
          npc.lastAttack = now;
          const result = handleCombat(npc, nearestPlayer);
          if (result && !result.error) {
            io.emit('combatResult', result);

            if (result.killed) {
              io.to(nearestPlayer.id).emit('playerDied');
              setTimeout(() => respawnPlayer(nearestPlayer.id), 5000);
            }
          }
        }
      }
    } else {
      npc.state = 'idle';
      npc.targetId = null;

      // Patrol behavior
      if (Math.random() < 0.008) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 8;
        const targetX = npc.spawnPosition.x + Math.cos(angle) * dist;
        const targetZ = npc.spawnPosition.z + Math.sin(angle) * dist;

        npc.position.x += (targetX - npc.position.x) * 0.015;
        npc.position.z += (targetZ - npc.position.z) * 0.015;
        npc.rotation = Math.atan2(targetX - npc.position.x, targetZ - npc.position.z);
      }
    }
  });
}

// Respawn player
function respawnPlayer(playerId) {
  const player = gameState.players.get(playerId);
  if (!player) return;

  const stats = calculateStats(player);
  player.health = stats.maxHealth;
  player.mana = stats.maxMana;
  player.position = { x: 0, y: 0, z: 0 };
  player.dead = false;
  player.comboCount = 0;

  // XP penalty on death (MU style)
  const xpLoss = Math.floor(player.xp * 0.05);
  player.xp = Math.max(0, player.xp - xpLoss);

  io.to(playerId).emit('playerRespawn', {
    position: player.position,
    health: player.health,
    mana: player.mana,
    xp: player.xp,
    xpLost: xpLoss
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('playerJoin', (data) => {
    const player = createPlayer(socket.id, data.name, data.class);
    gameState.players.set(socket.id, player);

    socket.emit('gameState', {
      player: player,
      players: Array.from(gameState.players.values()).filter(p => p.id !== socket.id),
      npcs: Array.from(gameState.npcs.values()),
      quests: Object.values(questTemplates),
      classes: classData,
      tradeRoutes: tradeRoutes
    });

    socket.broadcast.emit('playerJoined', player);

    console.log(`${player.name} joined as ${classData[player.class].name}`);
  });

  socket.on('playerMove', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    player.position = data.position;
    player.rotation = data.rotation;
    player.velocity = data.velocity || { x: 0, y: 0, z: 0 };

    socket.broadcast.emit('playerMoved', {
      id: socket.id,
      position: player.position,
      rotation: player.rotation,
      velocity: player.velocity
    });
  });

  socket.on('attack', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player || player.dead) return;

    let target;
    if (data.targetType === 'npc') {
      target = gameState.npcs.get(data.targetId);
    } else if (data.targetType === 'player' && player.pvpEnabled) {
      target = gameState.players.get(data.targetId);
    }

    if (!target) return;

    const result = handleCombat(player, target, data.skill);

    if (result && !result.error) {
      io.emit('combatResult', result);

      if (result.killed && result.xpReward) {
        const xpResult = awardXP(player, result.xpReward);
        player.gold += result.goldReward || 0;
        player.zen += result.goldReward || 0;

        updateQuestProgress(player, 'kill', target.type);

        socket.emit('xpGained', {
          amount: result.xpReward,
          goldGained: result.goldReward,
          totalXp: player.xp,
          xpToLevel: player.xpToLevel,
          leveledUp: xpResult.leveledUp,
          newLevel: xpResult.newLevel,
          freeStatPoints: player.freeStatPoints,
          drops: result.drops
        });

        // Add drops to inventory
        if (result.drops) {
          result.drops.forEach(drop => {
            const existing = player.inventory.find(i => i.name === drop.name && i.stackable);
            if (existing) {
              existing.quantity += drop.quantity || 1;
            } else {
              player.inventory.push(drop);
            }
          });
          socket.emit('inventoryUpdate', { inventory: player.inventory, gold: player.gold });
        }

        socket.emit('questUpdate', { quests: player.quests });
      }

      socket.emit('statsUpdate', {
        health: player.health,
        mana: player.mana,
        combo: player.comboCount
      });
    } else if (result && result.error) {
      socket.emit('combatError', { error: result.error });
    }
  });

  socket.on('allocateStat', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player || player.freeStatPoints <= 0) return;

    const stat = data.stat;
    if (!['strength', 'agility', 'vitality', 'energy'].includes(stat)) return;

    player.statPoints[stat]++;
    player.freeStatPoints--;

    const newStats = calculateStats(player);
    player.stats = newStats;

    // Update max health/mana but keep current ratios
    const healthRatio = player.health / player.maxHealth;
    const manaRatio = player.mana / player.maxMana;
    player.maxHealth = newStats.maxHealth;
    player.maxMana = newStats.maxMana;
    player.health = Math.floor(newStats.maxHealth * healthRatio);
    player.mana = Math.floor(newStats.maxMana * manaRatio);

    socket.emit('statsUpdate', {
      health: player.health,
      maxHealth: player.maxHealth,
      mana: player.mana,
      maxMana: player.maxMana,
      stats: player.stats,
      statPoints: player.statPoints,
      freeStatPoints: player.freeStatPoints
    });
  });

  socket.on('useItem', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    const itemIndex = player.inventory.findIndex(item =>
      item.name === data.itemName && item.quantity > 0
    );

    if (itemIndex === -1) return;

    const item = player.inventory[itemIndex];

    if (item.type === 'consumable' && item.effect) {
      if (item.effect.health) {
        player.health = Math.min(player.maxHealth, player.health + item.effect.health);
      }
      if (item.effect.mana) {
        player.mana = Math.min(player.maxMana, player.mana + item.effect.mana);
      }

      item.quantity--;
      if (item.quantity <= 0) {
        player.inventory.splice(itemIndex, 1);
      }

      socket.emit('statsUpdate', { health: player.health, mana: player.mana });
      socket.emit('inventoryUpdate', { inventory: player.inventory });
    }
  });

  socket.on('equipItem', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    const itemIndex = player.inventory.findIndex(item => item.name === data.itemName);
    if (itemIndex === -1) return;

    const item = player.inventory[itemIndex];
    if (!item.slot) return;

    // Check level requirement
    if (item.requiredLevel && player.level < item.requiredLevel) {
      socket.emit('gameError', { error: `Required level: ${item.requiredLevel}` });
      return;
    }

    // Unequip current
    if (player.equipment[item.slot]) {
      player.inventory.push(player.equipment[item.slot]);
    }

    player.equipment[item.slot] = item;
    player.inventory.splice(itemIndex, 1);

    // Recalculate stats
    const newStats = calculateStats(player);
    player.stats = newStats;
    player.maxHealth = newStats.maxHealth;
    player.maxMana = newStats.maxMana;

    socket.emit('equipmentUpdate', { equipment: player.equipment, stats: player.stats });
    socket.emit('inventoryUpdate', { inventory: player.inventory });
    socket.emit('statsUpdate', {
      health: player.health,
      maxHealth: player.maxHealth,
      mana: player.mana,
      maxMana: player.maxMana
    });
  });

  socket.on('enhanceItem', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    const result = enhanceItem(player, data.itemIndex, data.jewelType);

    socket.emit('enhanceResult', result);
    socket.emit('inventoryUpdate', { inventory: player.inventory });
  });

  socket.on('acceptQuest', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    const questTemplate = questTemplates[data.questId];
    if (!questTemplate) return;

    if (questTemplate.minLevel && player.level < questTemplate.minLevel) {
      socket.emit('gameError', { error: `Required level: ${questTemplate.minLevel}` });
      return;
    }

    if (player.quests.active.find(q => q.id === data.questId) ||
        player.quests.completed.includes(data.questId)) {
      return;
    }

    const quest = JSON.parse(JSON.stringify(questTemplate));
    player.quests.active.push(quest);

    socket.emit('questUpdate', { quests: player.quests });
  });

  socket.on('completeQuest', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    const questIndex = player.quests.active.findIndex(q => q.id === data.questId && q.completed);
    if (questIndex === -1) return;

    const quest = player.quests.active[questIndex];

    if (quest.rewards.xp) awardXP(player, quest.rewards.xp);
    if (quest.rewards.gold) {
      player.gold += quest.rewards.gold;
      player.zen += quest.rewards.gold;
    }
    if (quest.rewards.items) {
      quest.rewards.items.forEach(itemId => {
        const itemTemplate = itemTemplates[itemId];
        if (itemTemplate) {
          const existing = player.inventory.find(i => i.name === itemTemplate.name && itemTemplate.stackable);
          if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
          } else {
            player.inventory.push({ ...itemTemplate, quantity: 1 });
          }
        }
      });
    }

    player.quests.active.splice(questIndex, 1);
    player.quests.completed.push(quest.id);

    socket.emit('questCompleted', { quest, rewards: quest.rewards });
    socket.emit('questUpdate', { quests: player.quests });
    socket.emit('inventoryUpdate', { inventory: player.inventory, gold: player.gold });
  });

  socket.on('setJob', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    if (!['trader', 'thief', 'hunter', null].includes(data.job)) return;

    player.job = data.job;
    socket.emit('jobUpdate', { job: player.job });
    socket.broadcast.emit('playerJobChanged', { id: socket.id, job: player.job });
  });

  socket.on('startCaravan', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player || player.job !== 'trader') return;

    const route = tradeRoutes.find(r => r.id === data.routeId);
    if (!route) return;

    // Check if player has trade goods
    const tradeGoods = player.inventory.filter(i => i.type === 'trade');
    if (tradeGoods.length === 0) {
      socket.emit('gameError', { error: 'No trade goods in inventory' });
      return;
    }

    const caravan = {
      id: `caravan_${socket.id}`,
      playerId: socket.id,
      route: route,
      position: { ...route.start },
      goods: tradeGoods,
      progress: 0,
      underAttack: false
    };

    // Remove trade goods from inventory
    player.inventory = player.inventory.filter(i => i.type !== 'trade');
    player.caravan = caravan;
    gameState.caravans.set(caravan.id, caravan);

    socket.emit('caravanStarted', { caravan });
    io.emit('caravanSpawned', { caravan });
  });

  socket.on('togglePvP', () => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    player.pvpEnabled = !player.pvpEnabled;
    socket.emit('pvpToggled', { pvpEnabled: player.pvpEnabled });
    socket.broadcast.emit('playerPvPChanged', { id: socket.id, pvpEnabled: player.pvpEnabled });
  });

  socket.on('chatMessage', (data) => {
    const player = gameState.players.get(socket.id);
    if (!player) return;

    io.emit('chatMessage', {
      playerId: socket.id,
      playerName: player.name,
      playerClass: player.class,
      level: player.level,
      message: data.message,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    const player = gameState.players.get(socket.id);
    if (player) {
      console.log(`${player.name} disconnected`);

      // Clean up caravan
      if (player.caravan) {
        gameState.caravans.delete(player.caravan.id);
        io.emit('caravanDestroyed', { id: player.caravan.id });
      }

      gameState.players.delete(socket.id);
      io.emit('playerLeft', { id: socket.id });
    }
  });
});

// Game loops
setInterval(updateNPCs, 100);

setInterval(() => {
  const npcStates = Array.from(gameState.npcs.values()).map(npc => ({
    id: npc.id,
    position: npc.position,
    rotation: npc.rotation,
    state: npc.state,
    health: npc.health,
    maxHealth: npc.maxHealth,
    dead: npc.dead
  }));

  io.emit('npcUpdate', npcStates);
}, 100);

// Health/Mana regeneration
setInterval(() => {
  gameState.players.forEach((player, playerId) => {
    if (player.dead) return;

    let needsUpdate = false;

    if (player.health < player.maxHealth) {
      player.health = Math.min(player.maxHealth, player.health + player.maxHealth * 0.01);
      needsUpdate = true;
    }
    if (player.mana < player.maxMana) {
      player.mana = Math.min(player.maxMana, player.mana + player.maxMana * 0.02);
      needsUpdate = true;
    }

    if (needsUpdate) {
      io.to(playerId).emit('statsUpdate', {
        health: Math.floor(player.health),
        mana: Math.floor(player.mana)
      });
    }
  });
}, 2000);

// Caravan progress update
setInterval(() => {
  gameState.caravans.forEach((caravan, caravanId) => {
    if (caravan.underAttack) return;

    caravan.progress += 0.5;

    // Move caravan along route
    const route = caravan.route;
    const t = caravan.progress / 100;
    caravan.position.x = route.start.x + (route.end.x - route.start.x) * t;
    caravan.position.z = route.start.z + (route.end.z - route.start.z) * t;

    io.emit('caravanMoved', { id: caravanId, position: caravan.position, progress: caravan.progress });

    if (caravan.progress >= 100) {
      // Caravan completed
      const player = gameState.players.get(caravan.playerId);
      if (player) {
        const totalValue = caravan.goods.reduce((sum, g) => sum + (g.tradeValue || 0), 0);
        const reward = Math.floor(totalValue * route.reward);

        player.gold += reward;
        player.zen += reward;
        player.caravan = null;

        updateQuestProgress(player, 'trade', null);

        io.to(caravan.playerId).emit('caravanCompleted', { reward, route: route.name });
        io.to(caravan.playerId).emit('questUpdate', { quests: player.quests });
      }

      gameState.caravans.delete(caravanId);
      io.emit('caravanDestroyed', { id: caravanId });
    }
  });
}, 1000);

initializeWorld();

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`MU/Silkroad MMORPG Server running on port ${PORT}`);
});
