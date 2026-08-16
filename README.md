# MU Legends Online - Silk Road Chronicles

A browser-based 3D MMORPG inspired by **MU Online** and **Silkroad Online**, featuring dark fantasy aesthetics, classic Korean MMORPG gameplay mechanics, and real-time multiplayer.

## Features

### Character Classes (MU Online Inspired)

| Class | Role | Primary Stats | Special |
|-------|------|---------------|---------|
| **Dark Knight** | Melee DPS | STR/VIT | Devastating sword combos |
| **Dark Wizard** | Magic DPS | Energy | Powerful AoE spells |
| **Fairy Elf** | Ranged/Support | AGI/Energy | Arrows + Healing |
| **Bicheon** | Martial Artist | STR/AGI | Chinese sword & spear |
| **Heuksal** | Assassin | AGI | Shadow attacks, high crit |

### MU Online Features

- **Stat Point System**: Allocate 5 stat points per level (STR, AGI, VIT, Energy)
- **Item Enhancement**: Upgrade items from +0 to +15 using Jewels
  - Jewel of Bless: Safe enhancement up to +6
  - Jewel of Soul: Higher potential, risk of destruction
  - Jewel of Life/Chaos: Special upgrades
- **Wing System**: Equip wings for bonus stats and visual effects
  - Wings of Elf (Tier 1)
  - Wings of Heaven / Wings of Darkness (Tier 2)
  - Cape of Lord (Tier 3)
- **Combo System**: Chain attacks for bonus damage
- **World Bosses**: Kundun, Death Knight

### Silkroad Online Features

- **Job System**: Choose your path on the Silk Road
  - **Trader**: Transport goods along dangerous routes for profit
  - **Thief**: Ambush traders and steal goods (PvP)
  - **Hunter**: Protect traders, earn bounties
- **Trade Routes**: Multiple routes with varying danger/reward
- **Desert Bandits**: Enemy NPCs that attack caravans

### Monsters

| Monster | Level | Location | Notes |
|---------|-------|----------|-------|
| Budge Dragon | 1 | Starter | Easy grinding |
| Giant Spider | 3 | Forest | Medium |
| Hell Hound | 6 | Wasteland | Medium |
| Tiger Girl | 12 | Eastern Lands | Silkroad-style |
| Golden Goblin | 1 | Roaming | Rare, high gold |
| Lichen King | 10 | Swamp | Mini-boss |
| Ghost Phantom | 15 | Ancient Ruins | Magic-based |
| Shadow Master | 22 | Shadow Territory | Hard |
| Desert Bandit | 8 | Trade Routes | Thief NPC |
| **Death Knight** | 30 | Boss Arena | **BOSS** |
| **Kundun** | 50 | Kundun Lair | **WORLD BOSS** |

### Game Systems

- **Dark Fantasy World**: Atmospheric night-time environment
- **Leveling**: Exponential XP curve, death penalty (5% XP loss)
- **Equipment Slots**: Weapon, Armor, Helm, Pants, Boots, Wings, Outfit
- **Quest System**: Monster hunting, trading, boss kills
- **Skill progression**: Skills 1-3 from the start, 4/5/6 at levels 5/10/15, skills 7-9 bought from Master Kael. Each skill upgrades to level 5 at the trainer.
- **Ranged combat**: Fairy Elf (bow) and Dark Wizard (magic bolt) attack from range and will not walk into melee when you tap a monster
- **Real-time Combat**: Target-based with 9 skill slots
- **Minimap**: Shows monsters, players, and current zone

## Controls

| Key | Action |
|-----|--------|
| W/A/S/D | Move |
| Click ground | Walk there |
| Click / tap monster | Approach to attack range, then auto-attack (ranged classes stay back) |
| Space or 1 | Basic attack (melee / bow / magic bolt by class) |
| 2-9 | Skills (2-3 starting specials; 4-6 by level; 7-9 from trainer) |
| F1-F4 | Use Potions |
| Tab | Cycle Targets |
| Enter | Chat |
| I | Inventory |
| C | Character Stats |
| Q | Quest Log |
| J | Silk Road Jobs |
| E | Enhancement (Chaos Forge) |
| Scroll Wheel | Zoom |
| Escape | Close Panels |

## Installation

```bash
# Install dependencies
npm install

# Start server
npm start
```

Open **http://localhost:3000** in your browser.

## Project Structure

```
mmorpg-3d/
├── server/
│   └── index.js          # Game server (Socket.io)
├── client/
│   ├── index.html        # Main HTML
│   ├── css/
│   │   └── game.css      # Dark fantasy styling
│   └── js/
│       └── game.js       # Three.js client
├── package.json
└── README.md
```

## Gameplay Guide

### Getting Started
1. Create a character and choose your class
2. Start in **Lorencia** (safe zone)
3. Kill **Budge Dragons** nearby to level up
4. Accept quests from the Quest Log (Q)
5. Allocate stat points as you level (C)

### Stat Builds

**Dark Knight (Melee)**
- Focus: STR > VIT > AGI
- High damage, good survivability

**Dark Wizard (Magic)**
- Focus: Energy > VIT
- AoE damage, glass cannon

**Fairy Elf (Ranged/Support)**
- Focus: AGI > Energy
- Fast attacks, can heal

**Bicheon/Heuksal (Hybrid)**
- Balanced STR/AGI builds
- Combo-focused gameplay

### Enhancement Tips
- Use Bless jewels for safe +1 to +6
- Soul jewels for +7 and higher (risky!)
- Items +7 and above may be destroyed on failure
- +9 and higher items glow

### Trading on the Silk Road
1. Set your job to "Trader" (J key)
2. Buy trade goods from shops
3. Start a caravan on a route
4. Survive bandit attacks
5. Reach the destination for profit!

## Technical Stack

- **Frontend**: Three.js, ES6 Modules
- **Backend**: Node.js, Express, Socket.io
- **Networking**: WebSockets
- **Styling**: CSS3 with MU Online dark theme

## Credits

Inspired by:
- **MU Online** (Webzen) - Class system, enhancement, wings, dark fantasy
- **Silkroad Online** (Joymax) - Trade system, job system, Eastern classes

## License

MIT License - For educational purposes only.
