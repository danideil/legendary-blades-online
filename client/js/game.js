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

  // Body
  const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
  const bodyColor = {
    darkKnight: 0xff2222,
    darkWizard: 0x9966ff,
    fairyElf: 0x66ff66,
    bicheon: 0xffcc00,
    heuksal: 0xff66ff
  }[playerData.class] || 0xffffff;

  const bodyMaterial = new THREE.MeshPhongMaterial({ 
    color: bodyColor,
    emissive: bodyColor,
    emissiveIntensity: 0.1
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.25;
  body.castShadow = true;
  group.add(body);

  // Name sprite
  const nameSprite = createTextSprite(
    `${playerData.name} [Lv.${playerData.level}]`,
    isLocal ? '#ffd700' : '#ffffff'
  );
  nameSprite.position.y = 3;
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

  let geometry, scale = 1, height = 1;

  // Different shapes for different monsters
  switch (npcData.type) {
    case 'budgeDragon':
      geometry = new THREE.ConeGeometry(0.5, 1.2, 6);
      scale = 1;
      break;
    case 'goldenGoblin':
      geometry = new THREE.SphereGeometry(0.5, 8, 8);
      scale = 0.8;
      break;
    case 'kundun':
      geometry = new THREE.ConeGeometry(1.5, 4, 8);
      scale = 2;
      height = 2;
      break;
    case 'deathKnight':
      geometry = new THREE.CapsuleGeometry(0.7, 2, 4, 8);
      scale = 1.5;
      height = 1.5;
      break;
    default:
      geometry = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
  }

  const color = monsterColors[npcData.type] || 0x888888;
  const material = new THREE.MeshPhongMaterial({
    color: color,
    emissive: npcData.boss ? color : 0x000000,
    emissiveIntensity: npcData.boss ? 0.3 : 0
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = height;
  mesh.castShadow = true;
  mesh.scale.setScalar(scale);
  group.add(mesh);

  // Health bar
  const healthBar = createHealthBar(npcData.boss);
  healthBar.position.y = height * 2 + 1;
  group.add(healthBar);

  // Name sprite
  const nameColor = npcData.boss ? '#ff0000' : (npcData.rare ? '#ffd700' : '#ff6666');
  const nameSprite = createTextSprite(`${npcData.name} [Lv.${npcData.level}]`, nameColor);
  nameSprite.position.y = height * 2 + 1.5;
  group.add(nameSprite);

  group.position.set(npcData.position.x, 0, npcData.position.z);
  group.userData = { type: 'npc', id: npcData.id };

  game.scene.add(group);

  npcData.mesh = group;
  npcData.healthBar = healthBar;

  // Boss glow
  if (npcData.boss) {
    game.glowMeshes.push({ mesh: mesh, color: color });
  }

  return group;
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
  game.scene.background = new THREE.Color(0x0a0a15);
  game.scene.fog = new THREE.FogExp2(0x0a0a15, 0.008);

  game.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  game.camera.position.set(0, game.cameraHeight, game.cameraDistance);

  game.renderer = new THREE.WebGLRenderer({ antialias: true });
  game.renderer.setSize(window.innerWidth, window.innerHeight);
  game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  game.renderer.shadowMap.enabled = true;
  game.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game-container').appendChild(game.renderer.domElement);

  // Dark ambient light
  const ambientLight = new THREE.AmbientLight(0x222244, 0.5);
  game.scene.add(ambientLight);

  // Moon light
  const moonLight = new THREE.DirectionalLight(0x6666aa, 0.8);
  moonLight.position.set(-50, 100, -50);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 2048;
  moonLight.shadow.mapSize.height = 2048;
  moonLight.shadow.camera.near = 0.5;
  moonLight.shadow.camera.far = 300;
  moonLight.shadow.camera.left = -150;
  moonLight.shadow.camera.right = 150;
  moonLight.shadow.camera.top = 150;
  moonLight.shadow.camera.bottom = -150;
  game.scene.add(moonLight);

  // Red accent light
  const redLight = new THREE.PointLight(0xff0000, 0.5, 100);
  redLight.position.set(0, 20, 0);
  game.scene.add(redLight);

  // Ground with dark texture
  const groundGeometry = new THREE.PlaneGeometry(500, 500, 100, 100);
  const groundMaterial = new THREE.MeshPhongMaterial({
    color: 0x1a1a2a,
    side: THREE.DoubleSide
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  game.scene.add(ground);

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

  // Skybox - distant dark mountains
  const mountainGeometry = new THREE.ConeGeometry(30, 100, 4);
  const mountainMaterial = new THREE.MeshPhongMaterial({ color: 0x111122 });
  for (let i = 0; i < 12; i++) {
    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
    const angle = (i / 12) * Math.PI * 2;
    mountain.position.set(Math.cos(angle) * 220, 30, Math.sin(angle) * 220);
    mountain.rotation.y = Math.random() * Math.PI;
    game.scene.add(mountain);
  }

  // Stars
  const starsGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 1000; i++) {
    starPositions.push(
      (Math.random() - 0.5) * 500,
      Math.random() * 100 + 50,
      (Math.random() - 0.5) * 500
    );
  }
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
  const stars = new THREE.Points(starsGeometry, starsMaterial);
  game.scene.add(stars);

  game.minimapCtx = document.getElementById('minimap-canvas').getContext('2d');
}

// Create dark tree
function createDarkTree(x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.4, 4, 6),
    new THREE.MeshPhongMaterial({ color: 0x1a1a1a })
  );
  trunk.position.set(x, 2, z);
  trunk.castShadow = true;
  game.scene.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(2, 5, 6),
    new THREE.MeshPhongMaterial({ color: 0x0a2a0a })
  );
  leaves.position.set(x, 6, z);
  leaves.castShadow = true;
  game.scene.add(leaves);
}

// Create ruin
function createRuin(x, z) {
  const pillarGeometry = new THREE.CylinderGeometry(0.8, 1, 8, 8);
  const pillarMaterial = new THREE.MeshPhongMaterial({ color: 0x2a2a3a });

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
  const ringMaterial = new THREE.MeshPhongMaterial({
    color: 0x8800ff,
    emissive: 0x4400aa,
    emissiveIntensity: 0.5
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 3;
  portalGroup.add(ring);

  const innerGeometry = new THREE.CircleGeometry(2.5, 32);
  const innerMaterial = new THREE.MeshBasicMaterial({
    color: 0x6600cc,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });
  const inner = new THREE.Mesh(innerGeometry, innerMaterial);
  inner.rotation.x = Math.PI / 2;
  inner.position.y = 3;
  portalGroup.add(inner);

  const nameSprite = createTextSprite(name, '#ff66ff');
  nameSprite.position.y = 7;
  nameSprite.scale.set(5, 1.5, 1);
  portalGroup.add(nameSprite);

  portalGroup.position.set(x, 0, z);
  game.scene.add(portalGroup);

  game.glowMeshes.push({ mesh: ring, color: 0x8800ff });
}

// Create town building
function createTownBuilding(x, z, name) {
  const building = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(12, 6, 10),
    new THREE.MeshPhongMaterial({ color: 0x3a2a2a })
  );
  base.position.y = 3;
  base.castShadow = true;
  building.add(base);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(9, 4, 4),
    new THREE.MeshPhongMaterial({ color: 0x4a0000 })
  );
  roof.position.y = 8;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  building.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3.5, 0.2),
    new THREE.MeshPhongMaterial({ color: 0x2a1a1a })
  );
  door.position.set(0, 1.75, 5.1);
  building.add(door);

  const nameSprite = createTextSprite(name, '#ffd700');
  nameSprite.position.y = 11;
  nameSprite.scale.set(6, 1.5, 1);
  building.add(nameSprite);

  building.position.set(x, 0, z);
  game.scene.add(building);
}

// Create torch
function createTorch(x, z) {
  const torch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.15, 2, 6),
    new THREE.MeshPhongMaterial({ color: 0x4a3a2a })
  );
  torch.position.set(x, 1, z);
  game.scene.add(torch);

  const light = new THREE.PointLight(0xff6600, 0.5, 15);
  light.position.set(x, 2.5, z);
  game.scene.add(light);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.5, 6),
    new THREE.MeshBasicMaterial({ color: 0xff4400 })
  );
  flame.position.set(x, 2.25, z);
  game.scene.add(flame);
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
