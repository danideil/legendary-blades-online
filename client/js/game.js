import * as THREE from 'three';

// Game State
const game = {
  socket: null,
  scene: null,
  camera: null,
  renderer: null,
  player: null,
  players: new Map(),
  npcs: new Map(),
  selectedTarget: null,
  keys: {},
  mouse: { x: 0, y: 0 },
  raycaster: new THREE.Raycaster(),
  clock: new THREE.Clock(),
  moveSpeed: 15,
  cameraDistance: 25,
  cameraHeight: 18,
  cameraAngle: 0,
  minimapCtx: null,
  quests: [],
  classes: {},
  tradeRoutes: [],
  skillNames: [],
  skillCooldowns: {},
  particleSystems: [],
  glowMeshes: []
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

// Monster colors based on type
const monsterColors = {
  budgeDragon: 0x8B4513,
  spider: 0x2F4F4F,
  hound: 0x8B0000,
  goldenGoblin: 0xFFD700,
  lichenKing: 0x006400,
  ghostPhantom: 0x4169E1,
  shadowMaster: 0x1C1C1C,
  deathKnight: 0x4B0082,
  kundun: 0x8B0000,
  tigerGirl: 0xFF6347,
  bandit: 0x8B4513,
  eliteThief: 0x2F4F4F
};

// Initialize Socket
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

    createPlayerMesh(game.player, true);

    data.players.forEach(p => {
      createPlayerMesh(p);
      game.players.set(p.id, p);
    });

    data.npcs.forEach(npc => {
      createNPCMesh(npc);
      game.npcs.set(npc.id, npc);
    });

    updateUI();
    updateQuestPanel();
    updateTradeRoutes();
    addChatMessage(null, `Welcome to MU Legends, ${game.player.name}!`, 'system');
    addChatMessage(null, `You are a Level ${game.player.level} ${game.classes[game.player.class].name}`, 'system');
  });

  game.socket.on('playerJoined', (player) => {
    createPlayerMesh(player);
    game.players.set(player.id, player);
    addChatMessage(null, `${player.name} has entered the game`, 'system');
    document.getElementById('online-count').textContent = game.players.size + 1;
  });

  game.socket.on('playerLeft', (data) => {
    const player = game.players.get(data.id);
    if (player) {
      if (player.mesh) game.scene.remove(player.mesh);
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

        if (npc.mesh) {
          npc.mesh.visible = !state.dead;
          if (npc.healthBar) npc.healthBar.visible = !state.dead;
        }
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
      if (npc.mesh) npc.mesh.visible = true;
    }
  });

  game.socket.on('combatResult', (data) => {
    const type = data.critical ? 'critical' : 'damage';
    showDamageNumber(data.defenderId, data.damage, type);

    if (game.selectedTarget && game.selectedTarget.id === data.defenderId) {
      updateTargetUI();
    }

    // Show combo
    if (data.combo > 1 && data.attackerId === game.player?.id) {
      showCombo(data.combo);
    }

    if (data.killed && data.attackerId === game.player?.id) {
      addChatMessage(null, `Defeated target!`, 'system');
      
      // Create death particles
      const target = game.npcs.get(data.defenderId) || game.players.get(data.defenderId);
      if (target?.mesh) {
        createDeathEffect(target.mesh.position);
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

    // Show item drops
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
    updatePlayerWings();
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
      createEnhanceEffect(true);
    } else if (data.destroyed) {
      resultDiv.textContent = 'Item destroyed!';
      resultDiv.className = 'fail';
      createEnhanceEffect(false);
    } else {
      resultDiv.textContent = `Failed! Item downgraded to +${data.newEnhancement}`;
      resultDiv.className = 'fail';
    }
  });
}

// Create Player Mesh
function createPlayerMesh(playerData, isLocal = false) {
  const group = new THREE.Group();

  // Color scheme for each class
  const classColors = {
    darkKnight: { main: 0xcc2222, accent: 0xff4444, skin: 0xffccaa },
    darkWizard: { main: 0x6633cc, accent: 0x9966ff, skin: 0xeeddcc },
    fairyElf: { main: 0x22aa44, accent: 0x66ff88, skin: 0xffeecc },
    bicheon: { main: 0xcc8800, accent: 0xffcc00, skin: 0xddbb99 },
    heuksal: { main: 0x8822aa, accent: 0xcc66ff, skin: 0xddccee }
  };
  const colors = classColors[playerData.class] || { main: 0x888888, accent: 0xaaaaaa, skin: 0xffccaa };

  // Base platform/shadow circle
  const shadowGeometry = new THREE.CircleGeometry(0.8, 16);
  const shadowMaterial = new THREE.MeshBasicMaterial({ 
    color: isLocal ? 0x44ff44 : 0x4444ff, 
    transparent: true, 
    opacity: 0.4 
  });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // Legs
  const legGeometry = new THREE.CylinderGeometry(0.15, 0.2, 1, 8);
  const legMaterial = new THREE.MeshStandardMaterial({ color: colors.main, roughness: 0.7 });
  
  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(-0.25, 0.5, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);
  
  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(0.25, 0.5, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Body/Torso
  const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.35, 1.2, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: colors.main,
    roughness: 0.6,
    metalness: 0.2
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.5;
  body.castShadow = true;
  group.add(body);

  // Armor/Chest plate (for knights)
  if (playerData.class === 'darkKnight' || playerData.class === 'bicheon') {
    const armorGeometry = new THREE.BoxGeometry(0.7, 0.6, 0.5);
    const armorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x555555, 
      roughness: 0.3, 
      metalness: 0.8 
    });
    const armor = new THREE.Mesh(armorGeometry, armorMaterial);
    armor.position.set(0, 1.6, 0.1);
    group.add(armor);
  }

  // Arms
  const armGeometry = new THREE.CylinderGeometry(0.1, 0.12, 0.9, 8);
  const armMaterial = new THREE.MeshStandardMaterial({ color: colors.main, roughness: 0.7 });
  
  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.set(-0.55, 1.5, 0);
  leftArm.rotation.z = 0.3;
  leftArm.castShadow = true;
  group.add(leftArm);
  
  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.set(0.55, 1.5, 0);
  rightArm.rotation.z = -0.3;
  rightArm.castShadow = true;
  group.add(rightArm);

  // Head
  const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
  const headMaterial = new THREE.MeshStandardMaterial({ color: colors.skin, roughness: 0.8 });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 2.4;
  head.castShadow = true;
  group.add(head);

  // Hair/Helmet based on class
  if (playerData.class === 'darkKnight') {
    const helmetGeometry = new THREE.ConeGeometry(0.4, 0.5, 8);
    const helmetMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
    const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
    helmet.position.y = 2.7;
    group.add(helmet);
  } else if (playerData.class === 'darkWizard') {
    const hatGeometry = new THREE.ConeGeometry(0.45, 0.8, 8);
    const hatMaterial = new THREE.MeshStandardMaterial({ color: 0x220066 });
    const hat = new THREE.Mesh(hatGeometry, hatMaterial);
    hat.position.y = 2.9;
    group.add(hat);
  } else {
    // Hair for other classes
    const hairGeometry = new THREE.SphereGeometry(0.38, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const hairMaterial = new THREE.MeshStandardMaterial({ color: colors.accent });
    const hair = new THREE.Mesh(hairGeometry, hairMaterial);
    hair.position.y = 2.5;
    group.add(hair);
  }

  // Weapon based on class
  const weaponGroup = new THREE.Group();
  if (playerData.class === 'darkKnight' || playerData.class === 'bicheon') {
    // Sword
    const bladeGeometry = new THREE.BoxGeometry(0.1, 1.2, 0.05);
    const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.6;
    weaponGroup.add(blade);
    
    const hiltGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
    const hiltMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const hilt = new THREE.Mesh(hiltGeometry, hiltMaterial);
    weaponGroup.add(hilt);
    
    weaponGroup.position.set(0.8, 1.3, 0);
    weaponGroup.rotation.z = -0.5;
  } else if (playerData.class === 'darkWizard') {
    // Staff
    const staffGeometry = new THREE.CylinderGeometry(0.05, 0.08, 2, 8);
    const staffMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2800 });
    const staff = new THREE.Mesh(staffGeometry, staffMaterial);
    staff.position.y = 1;
    weaponGroup.add(staff);
    
    const orbGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const orbMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x9966ff, 
      emissive: 0x6633cc, 
      emissiveIntensity: 0.5 
    });
    const orb = new THREE.Mesh(orbGeometry, orbMaterial);
    orb.position.y = 2.1;
    weaponGroup.add(orb);
    game.glowMeshes.push({ mesh: orb, color: 0x9966ff });
    
    weaponGroup.position.set(0.7, 0, 0);
  } else if (playerData.class === 'fairyElf') {
    // Bow
    const bowGeometry = new THREE.TorusGeometry(0.5, 0.03, 8, 16, Math.PI);
    const bowMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const bow = new THREE.Mesh(bowGeometry, bowMaterial);
    bow.rotation.z = Math.PI / 2;
    bow.position.y = 0.5;
    weaponGroup.add(bow);
    
    weaponGroup.position.set(0.7, 1.2, 0);
  } else if (playerData.class === 'heuksal') {
    // Daggers
    const daggerGeometry = new THREE.ConeGeometry(0.05, 0.5, 4);
    const daggerMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9 });
    const dagger1 = new THREE.Mesh(daggerGeometry, daggerMaterial);
    dagger1.position.set(-0.6, 1.2, 0.3);
    dagger1.rotation.x = -Math.PI / 4;
    group.add(dagger1);
    const dagger2 = new THREE.Mesh(daggerGeometry, daggerMaterial);
    dagger2.position.set(0.6, 1.2, 0.3);
    dagger2.rotation.x = -Math.PI / 4;
    group.add(dagger2);
  }
  group.add(weaponGroup);

  // Class aura/glow
  const auraGeometry = new THREE.RingGeometry(0.6, 1, 32);
  const auraMaterial = new THREE.MeshBasicMaterial({ 
    color: colors.accent, 
    transparent: true, 
    opacity: 0.3,
    side: THREE.DoubleSide
  });
  const aura = new THREE.Mesh(auraGeometry, auraMaterial);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.05;
  group.add(aura);

  // Name sprite with better visibility
  const nameSprite = createTextSprite(
    `${playerData.name} [Lv.${playerData.level}]`,
    isLocal ? '#ffff00' : '#00ffff'
  );
  nameSprite.position.y = 3.5;
  nameSprite.scale.set(5, 1.5, 1);
  group.add(nameSprite);

  group.position.set(playerData.position.x, 0, playerData.position.z);
  group.userData = { type: 'player', id: playerData.id };

  game.scene.add(group);

  if (isLocal) {
    game.playerMesh = group;
    game.player.mesh = group;

    // Add wings if equipped
    if (playerData.equipment?.wings) {
      addWingsToPlayer(group, playerData.equipment.wings);
    }
  } else {
    playerData.mesh = group;
  }

  return group;
}

// Add wings to player
function addWingsToPlayer(playerMesh, wingsData) {
  // Remove existing wings
  const existingWings = playerMesh.getObjectByName('wings');
  if (existingWings) {
    playerMesh.remove(existingWings);
  }

  const wingsGroup = new THREE.Group();
  wingsGroup.name = 'wings';

  const wingGeometry = new THREE.PlaneGeometry(2, 2.5);
  const wingColor = {
    'Wings of Elf': 0x66ff66,
    'Wings of Heaven': 0xffffff,
    'Wings of Darkness': 0x4B0082,
    'Cape of Lord': 0xff0000
  }[wingsData.name] || 0x888888;

  const wingMaterial = new THREE.MeshPhongMaterial({
    color: wingColor,
    emissive: wingColor,
    emissiveIntensity: 0.3,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });

  // Left wing
  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.position.set(-1, 1.5, -0.3);
  leftWing.rotation.y = -0.5;
  wingsGroup.add(leftWing);

  // Right wing
  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  rightWing.position.set(1, 1.5, -0.3);
  rightWing.rotation.y = 0.5;
  wingsGroup.add(rightWing);

  playerMesh.add(wingsGroup);

  // Add glow effect
  game.glowMeshes.push({ mesh: leftWing, color: wingColor });
  game.glowMeshes.push({ mesh: rightWing, color: wingColor });
}

// Update player wings
function updatePlayerWings() {
  if (game.playerMesh && game.player.equipment?.wings) {
    addWingsToPlayer(game.playerMesh, game.player.equipment.wings);
  }
}

// Create NPC Mesh
function createNPCMesh(npcData) {
  const group = new THREE.Group();

  const color = monsterColors[npcData.type] || 0x888888;
  let height = 1;
  let scale = 1;

  // Shadow circle under monster
  const shadowGeometry = new THREE.CircleGeometry(npcData.boss ? 2 : 0.8, 16);
  const shadowMaterial = new THREE.MeshBasicMaterial({ 
    color: npcData.boss ? 0xff0000 : 0x660000, 
    transparent: true, 
    opacity: 0.4 
  });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // Create detailed monster based on type
  switch (npcData.type) {
    case 'budgeDragon':
      createDragonMesh(group, color, 1);
      height = 1.5;
      break;
    case 'goldenGoblin':
      createGoblinMesh(group, 0xFFD700);
      height = 1;
      scale = 0.8;
      break;
    case 'kundun':
      createBossDemonMesh(group, color);
      height = 4;
      scale = 2;
      break;
    case 'deathKnight':
      createKnightMesh(group, color);
      height = 2.5;
      scale = 1.5;
      break;
    case 'spider':
      createSpiderMesh(group, color);
      height = 0.8;
      break;
    case 'hound':
      createHoundMesh(group, color);
      height = 1;
      break;
    case 'bandit':
    case 'eliteThief':
      createBanditMesh(group, color);
      height = 2;
      break;
    default:
      createDefaultMonsterMesh(group, color);
      height = 1.5;
  }

  // Health bar
  const healthBar = createHealthBar(npcData.boss);
  healthBar.position.y = height * scale + 1;
  group.add(healthBar);

  // Name sprite with better colors
  const nameColor = npcData.boss ? '#ff3333' : (npcData.rare ? '#ffdd00' : '#ff8888');
  const nameSprite = createTextSprite(`${npcData.name} [Lv.${npcData.level}]`, nameColor);
  nameSprite.position.y = height * scale + 1.5;
  nameSprite.scale.set(5, 1.5, 1);
  group.add(nameSprite);

  // Boss aura
  if (npcData.boss) {
    const auraGeometry = new THREE.RingGeometry(1.5, 2.5, 32);
    const auraMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000, 
      transparent: true, 
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    const aura = new THREE.Mesh(auraGeometry, auraMaterial);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.1;
    group.add(aura);
    game.glowMeshes.push({ mesh: aura, color: 0xff0000 });
  }

  group.position.set(npcData.position.x, 0, npcData.position.z);
  group.userData = { type: 'npc', npcId: npcData.id };

  game.scene.add(group);

  npcData.mesh = group;
  npcData.healthBar = healthBar;

  return group;
}

// Monster creation helpers
function createDragonMesh(group, color, scale) {
  // Body
  const bodyGeometry = new THREE.ConeGeometry(0.6, 1.5, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1;
  body.rotation.x = 0.3;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeometry = new THREE.SphereGeometry(0.4, 8, 8);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.set(0, 1.8, 0.4);
  head.castShadow = true;
  group.add(head);

  // Wings
  const wingGeometry = new THREE.PlaneGeometry(1.2, 0.8);
  const wingMaterial = new THREE.MeshStandardMaterial({ 
    color: color, 
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.position.set(-0.8, 1.2, -0.2);
  leftWing.rotation.y = -0.5;
  leftWing.rotation.z = 0.3;
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  rightWing.position.set(0.8, 1.2, -0.2);
  rightWing.rotation.y = 0.5;
  rightWing.rotation.z = -0.3;
  group.add(rightWing);

  // Tail
  const tailGeometry = new THREE.ConeGeometry(0.15, 1, 6);
  const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
  tail.position.set(0, 0.6, -0.8);
  tail.rotation.x = -1.2;
  group.add(tail);

  // Eyes
  const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.15, 1.9, 0.7);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.15, 1.9, 0.7);
  group.add(rightEye);
}

function createGoblinMesh(group, color) {
  // Body
  const bodyGeometry = new THREE.SphereGeometry(0.5, 8, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: color, 
    emissive: color,
    emissiveIntensity: 0.3,
    roughness: 0.4,
    metalness: 0.6
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeometry = new THREE.SphereGeometry(0.35, 8, 8);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.y = 1.3;
  group.add(head);

  // Big ears
  const earGeometry = new THREE.ConeGeometry(0.15, 0.4, 4);
  const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
  leftEar.position.set(-0.3, 1.5, 0);
  leftEar.rotation.z = 0.5;
  group.add(leftEar);
  const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
  rightEar.position.set(0.3, 1.5, 0);
  rightEar.rotation.z = -0.5;
  group.add(rightEar);

  // Eyes
  const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.12, 1.35, 0.3);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.12, 1.35, 0.3);
  group.add(rightEye);

  // Gold sparkle effect
  game.glowMeshes.push({ mesh: body, color: color });
}

function createBossDemonMesh(group, color) {
  // Large body
  const bodyGeometry = new THREE.CylinderGeometry(1, 1.5, 3, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: color,
    emissive: color,
    emissiveIntensity: 0.3,
    roughness: 0.5
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 2;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeometry = new THREE.SphereGeometry(0.8, 16, 16);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.y = 4;
  group.add(head);

  // Horns
  const hornGeometry = new THREE.ConeGeometry(0.2, 1.2, 6);
  const hornMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const leftHorn = new THREE.Mesh(hornGeometry, hornMaterial);
  leftHorn.position.set(-0.5, 4.8, 0);
  leftHorn.rotation.z = 0.3;
  group.add(leftHorn);
  const rightHorn = new THREE.Mesh(hornGeometry, hornMaterial);
  rightHorn.position.set(0.5, 4.8, 0);
  rightHorn.rotation.z = -0.3;
  group.add(rightHorn);

  // Arms
  const armGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2, 8);
  const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
  leftArm.position.set(-1.5, 2.5, 0);
  leftArm.rotation.z = 0.5;
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
  rightArm.position.set(1.5, 2.5, 0);
  rightArm.rotation.z = -0.5;
  group.add(rightArm);

  // Glowing eyes
  const eyeGeometry = new THREE.SphereGeometry(0.15, 8, 8);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.3, 4.1, 0.7);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.3, 4.1, 0.7);
  group.add(rightEye);

  game.glowMeshes.push({ mesh: body, color: color });
  game.glowMeshes.push({ mesh: leftEye, color: 0xff0000 });
  game.glowMeshes.push({ mesh: rightEye, color: 0xff0000 });
}

function createKnightMesh(group, color) {
  // Body armor
  const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.6, 1.5, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: color, 
    roughness: 0.3,
    metalness: 0.8
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.5;
  body.castShadow = true;
  group.add(body);

  // Head/Helmet
  const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.y = 2.6;
  group.add(head);

  // Helmet visor
  const visorGeometry = new THREE.BoxGeometry(0.5, 0.15, 0.3);
  const visorMaterial = new THREE.MeshBasicMaterial({ color: 0x330000 });
  const visor = new THREE.Mesh(visorGeometry, visorMaterial);
  visor.position.set(0, 2.55, 0.3);
  group.add(visor);

  // Sword
  const bladeGeometry = new THREE.BoxGeometry(0.1, 1.8, 0.05);
  const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9 });
  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade.position.set(0.8, 1.8, 0);
  blade.rotation.z = -0.3;
  group.add(blade);

  // Shield
  const shieldGeometry = new THREE.CircleGeometry(0.5, 8);
  const shieldMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7 });
  const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
  shield.position.set(-0.7, 1.5, 0.3);
  group.add(shield);

  game.glowMeshes.push({ mesh: body, color: color });
}

function createSpiderMesh(group, color) {
  // Body
  const bodyGeometry = new THREE.SphereGeometry(0.5, 8, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.6;
  body.scale.set(1, 0.7, 1.3);
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.set(0, 0.5, 0.6);
  group.add(head);

  // Legs (8)
  const legGeometry = new THREE.CylinderGeometry(0.03, 0.04, 0.8, 4);
  for (let i = 0; i < 8; i++) {
    const leg = new THREE.Mesh(legGeometry, bodyMaterial);
    const side = i < 4 ? -1 : 1;
    const index = i % 4;
    leg.position.set(side * 0.4, 0.3, (index - 1.5) * 0.3);
    leg.rotation.z = side * 1;
    group.add(leg);
  }

  // Red eyes
  const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  for (let i = 0; i < 4; i++) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set((i % 2 - 0.5) * 0.15, 0.55, 0.8);
    group.add(eye);
  }
}

function createHoundMesh(group, color) {
  // Body
  const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.7;
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.set(0, 0.8, 0.7);
  head.scale.set(1, 0.8, 1.2);
  group.add(head);

  // Snout
  const snoutGeometry = new THREE.ConeGeometry(0.12, 0.3, 6);
  const snout = new THREE.Mesh(snoutGeometry, bodyMaterial);
  snout.position.set(0, 0.75, 1);
  snout.rotation.x = Math.PI / 2;
  group.add(snout);

  // Ears
  const earGeometry = new THREE.ConeGeometry(0.1, 0.25, 4);
  const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
  leftEar.position.set(-0.15, 1, 0.6);
  group.add(leftEar);
  const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
  rightEar.position.set(0.15, 1, 0.6);
  group.add(rightEar);

  // Legs
  const legGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6);
  const positions = [[-0.2, 0.25, 0.4], [0.2, 0.25, 0.4], [-0.2, 0.25, -0.4], [0.2, 0.25, -0.4]];
  positions.forEach(pos => {
    const leg = new THREE.Mesh(legGeometry, bodyMaterial);
    leg.position.set(...pos);
    group.add(leg);
  });

  // Eyes
  const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff3300 });
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.1, 0.85, 0.9);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.1, 0.85, 0.9);
  group.add(rightEye);
}

function createBanditMesh(group, color) {
  // Similar to player but darker
  const bodyGeometry = new THREE.CylinderGeometry(0.35, 0.4, 1.2, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.4;
  body.castShadow = true;
  group.add(body);

  // Head with hood
  const headGeometry = new THREE.SphereGeometry(0.3, 8, 8);
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0xddbbaa });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 2.2;
  group.add(head);

  const hoodGeometry = new THREE.ConeGeometry(0.4, 0.5, 8);
  const hoodMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const hood = new THREE.Mesh(hoodGeometry, hoodMaterial);
  hood.position.y = 2.4;
  group.add(hood);

  // Dagger
  const daggerGeometry = new THREE.ConeGeometry(0.05, 0.6, 4);
  const daggerMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
  const dagger = new THREE.Mesh(daggerGeometry, daggerMaterial);
  dagger.position.set(0.5, 1.3, 0.3);
  dagger.rotation.x = -Math.PI / 4;
  group.add(dagger);
}

function createDefaultMonsterMesh(group, color) {
  // Generic monster
  const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: color,
    roughness: 0.6
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeometry = new THREE.SphereGeometry(0.3, 8, 8);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.y = 1.8;
  group.add(head);

  // Eyes
  const eyeGeometry = new THREE.SphereGeometry(0.06, 8, 8);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.12, 1.85, 0.25);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.12, 1.85, 0.25);
  group.add(rightEye);
}

// Create text sprite
function createTextSprite(text, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;

  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.strokeText(text, 128, 40);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 40);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4, 1, 1);

  return sprite;
}

// Create health bar
function createHealthBar(isBoss = false) {
  const group = new THREE.Group();

  const width = isBoss ? 3 : 2;
  const bgGeometry = new THREE.PlaneGeometry(width, 0.2);
  const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const bg = new THREE.Mesh(bgGeometry, bgMaterial);
  group.add(bg);

  const fillGeometry = new THREE.PlaneGeometry(width - 0.1, 0.15);
  const fillColor = isBoss ? 0xff0000 : 0xcc0000;
  const fillMaterial = new THREE.MeshBasicMaterial({ color: fillColor, side: THREE.DoubleSide });
  const fill = new THREE.Mesh(fillGeometry, fillMaterial);
  fill.position.z = 0.01;
  fill.name = 'healthFill';
  group.add(fill);

  return group;
}

// Initialize Scene
function initScene() {
  game.scene = new THREE.Scene();
  game.scene.background = new THREE.Color(0x87CEEB); // Sky blue background
  game.scene.fog = new THREE.Fog(0x87CEEB, 100, 400);

  game.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  game.camera.position.set(0, game.cameraHeight, game.cameraDistance);

  game.renderer = new THREE.WebGLRenderer({ antialias: true });
  game.renderer.setSize(window.innerWidth, window.innerHeight);
  game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  game.renderer.shadowMap.enabled = true;
  game.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game-container').appendChild(game.renderer.domElement);

  // Very bright ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  game.scene.add(ambientLight);

  // Hemisphere light - sky and ground colors
  const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x88aa55, 1.2);
  game.scene.add(hemiLight);

  // Main sunlight - very bright
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
  sunLight.position.set(50, 100, 50);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 300;
  sunLight.shadow.camera.left = -100;
  sunLight.shadow.camera.right = 100;
  sunLight.shadow.camera.top = 100;
  sunLight.shadow.camera.bottom = -100;
  game.scene.add(sunLight);

  // Secondary fill light from opposite direction
  const fillLight = new THREE.DirectionalLight(0xaaccff, 1.0);
  fillLight.position.set(-50, 50, -50);
  game.scene.add(fillLight);

  // Player spotlight - very bright, follows player
  game.playerLight = new THREE.PointLight(0xffffff, 2, 50);
  game.playerLight.position.set(0, 15, 0);
  game.scene.add(game.playerLight);

  // Bright green grass ground
  const groundGeometry = new THREE.PlaneGeometry(500, 500, 50, 50);
  const groundMaterial = new THREE.MeshLambertMaterial({
    color: 0x4a8c4a,
    side: THREE.DoubleSide
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  game.scene.add(ground);
  
  // Grid lines for visibility
  const gridHelper = new THREE.GridHelper(500, 50, 0x3a7a3a, 0x5aaa5a);
  gridHelper.position.y = 0.05;
  game.scene.add(gridHelper);

  // Add terrain height variation
  const vertices = groundGeometry.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i + 2] = Math.sin(vertices[i] * 0.03) * Math.cos(vertices[i + 1] * 0.03) * 3;
  }
  groundGeometry.attributes.position.needsUpdate = true;
  groundGeometry.computeVertexNormals();

  // Dark trees
  for (let i = 0; i < 150; i++) {
    const x = (Math.random() - 0.5) * 400;
    const z = (Math.random() - 0.5) * 400;
    if (Math.abs(x) < 15 && Math.abs(z) < 15) continue;
    createDarkTree(x, z);
  }

  // Ruins and structures
  createRuin(-100, -60);
  createRuin(95, 100);
  createPortal(0, 200, 'Kundun Lair');
  createPortal(150, 0, 'Death Knight Arena');

  // Town structures
  createTownBuilding(0, -20, 'Lorencia');
  createTownBuilding(-25, 10, 'Chaos Machine');
  createTownBuilding(25, 10, 'Shop');

  // Torches for atmosphere
  for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * Math.PI * 2;
    const radius = 50 + Math.random() * 100;
    createTorch(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  // Distant mountains with nice colors
  const mountainGeometry = new THREE.ConeGeometry(40, 80, 4);
  const mountainMaterial = new THREE.MeshLambertMaterial({ color: 0x6688aa });
  for (let i = 0; i < 12; i++) {
    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
    const angle = (i / 12) * Math.PI * 2;
    mountain.position.set(Math.cos(angle) * 220, 20, Math.sin(angle) * 220);
    mountain.rotation.y = Math.random() * Math.PI;
    game.scene.add(mountain);
  }

  // Clouds instead of stars
  const cloudGeometry = new THREE.SphereGeometry(8, 8, 8);
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 20; i++) {
    const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloud.position.set(
      (Math.random() - 0.5) * 400,
      50 + Math.random() * 30,
      (Math.random() - 0.5) * 400
    );
    cloud.scale.set(1 + Math.random(), 0.5, 1 + Math.random());
    game.scene.add(cloud);
  }

  game.minimapCtx = document.getElementById('minimap-canvas').getContext('2d');
}

// Create tree
function createDarkTree(x, z) {
  const treeGroup = new THREE.Group();
  
  // Brown trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.5, 5, 8),
    new THREE.MeshLambertMaterial({ color: 0x8B4513 })
  );
  trunk.position.y = 2.5;
  trunk.castShadow = true;
  treeGroup.add(trunk);

  // Bright green leaves
  const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
  
  const leaves1 = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), leavesMaterial);
  leaves1.position.y = 7;
  leaves1.scale.set(1, 0.8, 1);
  leaves1.castShadow = true;
  treeGroup.add(leaves1);
  
  const leaves2 = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), leavesMaterial);
  leaves2.position.y = 9;
  leaves2.castShadow = true;
  treeGroup.add(leaves2);
  
  treeGroup.position.set(x, 0, z);
  treeGroup.rotation.y = Math.random() * Math.PI * 2;
  const scale = 0.7 + Math.random() * 0.5;
  treeGroup.scale.setScalar(scale);
  
  game.scene.add(treeGroup);
}

// Create ruin
function createRuin(x, z) {
  const pillarGeometry = new THREE.CylinderGeometry(0.8, 1, 8, 8);
  const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });

  for (let i = 0; i < 4; i++) {
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    const px = x + (i % 2) * 15 - 7.5;
    const pz = z + Math.floor(i / 2) * 15 - 7.5;
    pillar.position.set(px, 4, pz);
    pillar.castShadow = true;
    game.scene.add(pillar);
  }
}

// Create portal
function createPortal(x, z, name) {
  const portalGroup = new THREE.Group();

  const ringGeometry = new THREE.TorusGeometry(3, 0.5, 8, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xaa44ff });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 3;
  portalGroup.add(ring);

  const innerGeometry = new THREE.CircleGeometry(2.5, 32);
  const innerMaterial = new THREE.MeshBasicMaterial({
    color: 0x8866ff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide
  });
  const inner = new THREE.Mesh(innerGeometry, innerMaterial);
  inner.rotation.x = Math.PI / 2;
  inner.position.y = 3;
  portalGroup.add(inner);

  // Portal light
  const portalLight = new THREE.PointLight(0xaa44ff, 2, 20);
  portalLight.position.y = 3;
  portalGroup.add(portalLight);

  const nameSprite = createTextSprite(name, '#ff88ff');
  nameSprite.position.y = 7;
  nameSprite.scale.set(5, 1.5, 1);
  portalGroup.add(nameSprite);

  portalGroup.position.set(x, 0, z);
  game.scene.add(portalGroup);

  game.glowMeshes.push({ mesh: ring, color: 0xaa44ff });
}

// Create town building
function createTownBuilding(x, z, name) {
  const building = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(12, 6, 10),
    new THREE.MeshLambertMaterial({ color: 0xDEB887 })
  );
  base.position.y = 3;
  base.castShadow = true;
  building.add(base);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(9, 4, 4),
    new THREE.MeshLambertMaterial({ color: 0x8B0000 })
  );
  roof.position.y = 8;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  building.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3.5, 0.2),
    new THREE.MeshLambertMaterial({ color: 0x4a3020 })
  );
  door.position.set(0, 1.75, 5.1);
  building.add(door);

  const nameSprite = createTextSprite(name, '#ffff00');
  nameSprite.position.y = 11;
  nameSprite.scale.set(6, 1.5, 1);
  building.add(nameSprite);

  building.position.set(x, 0, z);
  game.scene.add(building);
}

// Create torch
function createTorch(x, z) {
  const torchGroup = new THREE.Group();
  
  // Post
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 2.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 })
  );
  post.position.y = 1.25;
  post.castShadow = true;
  torchGroup.add(post);

  // Bowl/holder
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 })
  );
  bowl.position.y = 2.5;
  torchGroup.add(bowl);

  // Flame (multiple layers)
  const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const flame1 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 6), flameMaterial);
  flame1.position.y = 2.9;
  torchGroup.add(flame1);
  
  const flame2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.35, 6),
    new THREE.MeshBasicMaterial({ color: 0xffaa00 })
  );
  flame2.position.y = 3;
  torchGroup.add(flame2);

  // Light - brighter and larger radius
  const light = new THREE.PointLight(0xff8833, 1.5, 25);
  light.position.y = 3;
  torchGroup.add(light);

  torchGroup.position.set(x, 0, z);
  game.scene.add(torchGroup);
  
  // Add flame to glow meshes for animation
  game.glowMeshes.push({ mesh: flame1, color: 0xff6600 });
}

// Particle effects
function createDeathEffect(position) {
  const particles = [];
  for (let i = 0; i < 20; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    particle.position.copy(position);
    particle.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      Math.random() * 0.3,
      (Math.random() - 0.5) * 0.3
    );
    particle.life = 1;
    game.scene.add(particle);
    particles.push(particle);
  }
  game.particleSystems.push({ particles, type: 'death' });
}

function createLevelUpEffect() {
  if (!game.playerMesh) return;
  
  const particles = [];
  for (let i = 0; i < 30; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd700 })
    );
    particle.position.copy(game.playerMesh.position);
    particle.position.y += 1;
    const angle = (i / 30) * Math.PI * 2;
    particle.velocity = new THREE.Vector3(
      Math.cos(angle) * 0.1,
      0.2,
      Math.sin(angle) * 0.1
    );
    particle.life = 1;
    game.scene.add(particle);
    particles.push(particle);
  }
  game.particleSystems.push({ particles, type: 'levelup' });
}

function createEnhanceEffect(success) {
  // Visual feedback in 3D would go here
}

// Input setup
function setupInput() {
  document.addEventListener('keydown', (e) => {
    game.keys[e.code] = true;

    if (document.activeElement === document.getElementById('chat-input')) {
      if (e.code === 'Enter') {
        sendChatMessage();
      }
      return;
    }

    // Skills 1-4
    if (e.code === 'Digit1') useSkill(0);
    if (e.code === 'Digit2') useSkill(1);
    if (e.code === 'Digit3') useSkill(2);
    if (e.code === 'Digit4') useSkill(3);

    // Potions F1-F4
    if (e.code === 'F1') { e.preventDefault(); useItem('Small Heal Potion'); }
    if (e.code === 'F2') { e.preventDefault(); useItem('Small Mana Potion'); }
    if (e.code === 'F3') { e.preventDefault(); useItem('Heal Potion'); }
    if (e.code === 'F4') { e.preventDefault(); useItem('Mana Potion'); }

    // UI
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

  document.addEventListener('mousemove', (e) => {
    game.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    game.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('#hud') && !e.target.closest('#game-container')) return;
    handleClick(e);
  });

  // Camera control
  let isRightMouseDown = false;
  let lastMouseX = 0;

  document.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
      isRightMouseDown = true;
      lastMouseX = e.clientX;
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button === 2) isRightMouseDown = false;
  });

  document.addEventListener('mousemove', (e) => {
    if (isRightMouseDown) {
      game.cameraAngle += (e.clientX - lastMouseX) * 0.005;
      lastMouseX = e.clientX;
    }
  });

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('wheel', (e) => {
    game.cameraDistance = Math.max(8, Math.min(50, game.cameraDistance + e.deltaY * 0.05));
  });

  window.addEventListener('resize', () => {
    game.camera.aspect = window.innerWidth / window.innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
  });

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

  // Stat allocation
  document.querySelectorAll('.stat-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (game.player.freeStatPoints > 0) {
        game.socket.emit('allocateStat', { stat: btn.dataset.stat });
      }
    });
  });

  // Skill slots
  document.querySelectorAll('.skill-slot:not(.item-slot)').forEach((slot, index) => {
    slot.addEventListener('click', () => useSkill(index));
  });

  document.querySelectorAll('.skill-slot.item-slot').forEach(slot => {
    slot.addEventListener('click', () => useItem(slot.dataset.item));
  });

  // Job selection
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

  // Mobile controls setup
  setupMobileControls();
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
  
  // Joystick touch handling
  joystickBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joystickActive = true;
    const touch = e.touches[0];
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
    
    // Set movement keys based on joystick position
    const threshold = 10;
    game.keys['KeyW'] = dy < -threshold;
    game.keys['KeyS'] = dy > threshold;
    game.keys['KeyA'] = dx < -threshold;
    game.keys['KeyD'] = dx > threshold;
  }, { passive: false });
  
  document.addEventListener('touchend', (e) => {
    if (joystickActive) {
      joystickActive = false;
      joystickStick.style.transform = 'translate(-50%, -50%)';
      game.keys['KeyW'] = false;
      game.keys['KeyS'] = false;
      game.keys['KeyA'] = false;
      game.keys['KeyD'] = false;
    }
  });
  
  // Mobile attack button
  const attackBtn = document.getElementById('mobile-attack-btn');
  if (attackBtn) {
    attackBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (game.selectedTarget) {
        attackTarget();
      } else {
        // Auto-target nearest enemy
        let nearestNPC = null;
        let nearestDist = Infinity;
        game.npcs.forEach(npc => {
          if (!npc.dead && npc.mesh) {
            const dist = game.playerMesh.position.distanceTo(npc.mesh.position);
            if (dist < nearestDist && dist < 15) {
              nearestDist = dist;
              nearestNPC = npc;
            }
          }
        });
        if (nearestNPC) {
          selectTarget(nearestNPC);
          attackTarget();
        }
      }
    }, { passive: false });
  }
  
  // Mobile skill buttons
  document.querySelectorAll('.mobile-skill-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const skillIndex = parseInt(btn.dataset.skill);
      useSkill(skillIndex);
    }, { passive: false });
  });
  
  // Mobile potion buttons
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
  
  // Mobile menu button
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileQuickMenu = document.getElementById('mobile-quick-menu');
  
  if (mobileMenuBtn && mobileQuickMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileQuickMenu.classList.toggle('show');
    });
    
    document.querySelectorAll('.mobile-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const panelId = item.dataset.panel;
        togglePanel(panelId);
        mobileQuickMenu.classList.remove('show');
      });
    });
  }
  
  // Touch to select target
  document.getElementById('game-container')?.addEventListener('touchstart', (e) => {
    if (e.target.closest('#mobile-controls') || e.target.closest('#hud')) return;
    
    const touch = e.touches[0];
    game.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    game.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    game.raycaster.setFromCamera(game.mouse, game.camera);
    
    const clickables = [];
    game.npcs.forEach(npc => {
      if (npc.mesh && !npc.dead) clickables.push(npc.mesh);
    });
    
    const intersects = game.raycaster.intersectObjects(clickables, true);
    if (intersects.length > 0) {
      let targetMesh = intersects[0].object;
      while (targetMesh.parent && !targetMesh.userData.npcId) {
        targetMesh = targetMesh.parent;
      }
      
      if (targetMesh.userData.npcId) {
        const npc = game.npcs.get(targetMesh.userData.npcId);
        if (npc) {
          selectTarget(npc);
        }
      }
    }
  }, { passive: true });
}

// Handle click
function handleClick(e) {
  game.raycaster.setFromCamera(game.mouse, game.camera);

  const clickables = [];
  game.npcs.forEach(npc => {
    if (npc.mesh && !npc.dead) clickables.push(npc.mesh);
  });
  game.players.forEach(player => {
    if (player.mesh) clickables.push(player.mesh);
  });

  const intersects = game.raycaster.intersectObjects(clickables, true);

  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj && !obj.userData?.type) {
      obj = obj.parent;
    }
    if (obj?.userData) {
      selectTarget(obj.userData);
    }
  }
}

// Target functions
function selectTarget(userData) {
  if (userData.type === 'npc') {
    game.selectedTarget = game.npcs.get(userData.id);
    game.selectedTarget.targetType = 'npc';
  } else if (userData.type === 'player') {
    game.selectedTarget = game.players.get(userData.id);
    game.selectedTarget.targetType = 'player';
  }

  if (game.selectedTarget) {
    updateTargetUI();
    
    // Boss warning
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

  // Sort by distance
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

// Combat
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

// Chat
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

// UI updates
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

  // Stat points indicator
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
  
  // Update mobile skill buttons
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
  
  // Update mobile potion buttons
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

  // Equipment
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

  // Enable/disable stat buttons
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
    
    // Rarity classes
    if (item.glow) slot.classList.add('legendary');
    else if (item.type === 'wings') slot.classList.add('epic');
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
    'Cape of Lord': '👑'
  };
  
  if (icons[item.name]) return icons[item.name];
  if (item.type === 'weapon') return '⚔️';
  if (item.type === 'armor') return '🛡️';
  return '📦';
}

function getItemTooltip(item) {
  let tooltip = item.name;
  if (item.enhancement) tooltip += ` +${item.enhancement}`;
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
  const canvas = ctx.canvas;
  const scale = 0.35;

  ctx.fillStyle = '#0a0505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // NPCs
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

  // Other players
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

  // Player
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(80, 80, 4, 0, Math.PI * 2);
  ctx.fill();

  // Direction
  const dirX = 80 + Math.sin(game.player.rotation || 0) * 8;
  const dirY = 80 + Math.cos(game.player.rotation || 0) * 8;
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 80);
  ctx.lineTo(dirX, dirY);
  ctx.stroke();

  document.getElementById('coord-x').textContent = Math.round(game.player.position.x);
  document.getElementById('coord-z').textContent = Math.round(game.player.position.z);

  // Update area name based on position
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

// Visual effects
function showDamageNumber(targetId, amount, type) {
  const container = document.getElementById('damage-numbers');
  const div = document.createElement('div');
  div.className = `damage-number ${type}`;
  div.textContent = typeof amount === 'number' ? `-${amount}` : amount;

  let target;
  if (targetId === game.player?.id) {
    target = game.playerMesh;
  } else {
    const npc = game.npcs.get(targetId);
    const player = game.players.get(targetId);
    target = npc?.mesh || player?.mesh;
  }

  if (target) {
    const vector = target.position.clone();
    vector.y += 2;
    vector.project(game.camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    div.style.left = `${x + (Math.random() - 0.5) * 40}px`;
    div.style.top = `${y}px`;
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

// Game loop
function gameLoop() {
  requestAnimationFrame(gameLoop);

  const delta = game.clock.getDelta();

  if (game.player && game.playerMesh) {
    let moveX = 0, moveZ = 0;

    if (game.keys['KeyW'] || game.keys['ArrowUp']) moveZ -= 1;
    if (game.keys['KeyS'] || game.keys['ArrowDown']) moveZ += 1;
    if (game.keys['KeyA'] || game.keys['ArrowLeft']) moveX -= 1;
    if (game.keys['KeyD'] || game.keys['ArrowRight']) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= length;
      moveZ /= length;

      const sin = Math.sin(game.cameraAngle);
      const cos = Math.cos(game.cameraAngle);
      const rotatedX = moveX * cos - moveZ * sin;
      const rotatedZ = moveX * sin + moveZ * cos;

      const speed = game.moveSpeed * (game.player.stats?.moveSpeed || 1);
      game.player.position.x += rotatedX * speed * delta;
      game.player.position.z += rotatedZ * speed * delta;
      game.player.rotation = Math.atan2(rotatedX, rotatedZ);

      game.socket.emit('playerMove', {
        position: game.player.position,
        rotation: game.player.rotation,
        velocity: { x: rotatedX * speed, y: 0, z: rotatedZ * speed }
      });
    }

    game.playerMesh.position.set(game.player.position.x, 0, game.player.position.z);
    game.playerMesh.rotation.y = game.player.rotation || 0;

    // Update player light to follow player
    if (game.playerLight) {
      game.playerLight.position.set(game.player.position.x, 8, game.player.position.z);
    }

    const cameraX = game.player.position.x + Math.sin(game.cameraAngle) * game.cameraDistance;
    const cameraZ = game.player.position.z + Math.cos(game.cameraAngle) * game.cameraDistance;
    game.camera.position.set(cameraX, game.cameraHeight, cameraZ);
    game.camera.lookAt(game.player.position.x, 2, game.player.position.z);

    updateMinimap();
  }

  // Update other players
  game.players.forEach(player => {
    if (player.mesh) {
      player.mesh.position.lerp(new THREE.Vector3(player.position.x, 0, player.position.z), 0.2);
      player.mesh.rotation.y = player.rotation || 0;
    }
  });

  // Update NPCs
  game.npcs.forEach(npc => {
    if (npc.mesh && !npc.dead) {
      npc.mesh.position.lerp(new THREE.Vector3(npc.position.x, 0, npc.position.z), 0.2);
      npc.mesh.rotation.y = npc.rotation || 0;

      if (npc.healthBar) {
        const healthFill = npc.healthBar.getObjectByName('healthFill');
        if (healthFill) {
          const healthPercent = npc.health / npc.maxHealth;
          healthFill.scale.x = Math.max(0.01, healthPercent);
          healthFill.position.x = -(1 - healthPercent) * (npc.boss ? 1.45 : 0.95);
        }
        npc.healthBar.quaternion.copy(game.camera.quaternion);
      }
    }
  });

  // Update particles
  game.particleSystems = game.particleSystems.filter(system => {
    let alive = false;
    system.particles.forEach(p => {
      p.position.add(p.velocity);
      p.velocity.y -= 0.01;
      p.life -= delta;
      if (p.life <= 0) {
        game.scene.remove(p);
      } else {
        alive = true;
        p.material.opacity = p.life;
      }
    });
    return alive;
  });

  // Glow animation
  const time = Date.now() * 0.001;
  game.glowMeshes.forEach(item => {
    if (item.mesh.material) {
      item.mesh.material.emissiveIntensity = 0.3 + Math.sin(time * 2) * 0.1;
    }
  });

  if (game.selectedTarget) {
    updateTargetUI();
  }

  game.renderer.render(game.scene, game.camera);
}

// Login screen setup
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
