# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pumpkin Invaders is a Halloween-themed Space Invaders arcade game built with vanilla JavaScript and HTML5 Canvas. The game features a progressive damage system, boss fights, power-ups, and a shield mechanic.

## Running the Game

Simply open `index.html` in any web browser. No build process, package manager, or dependencies required.

## Architecture

### Core Game Loop (game.js)
- **Game Loop**: Uses `requestAnimationFrame` for smooth 60fps animation
  - `update()` - Physics, collision detection, game state updates
  - `draw()` - Renders all game objects to canvas
  - `gameLoop()` - Orchestrates update/draw cycle

### Key Game Objects
- **player**: Object with position, speed, and bullets array. Rendered as a bat spaceship.
- **pumpkins**: Array of enemy objects, each with position, damage state, explosion state, and boss flag
- **bigBoss**: Appears on odd-numbered levels (3, 5, 7, etc.), has 100 HP and special mechanics
- **powerUps**: Array of falling power-up tokens (laser, clone, shield, autoshoot)
- **cloneShips**: Array of temporary ally ships created by the clone power-up
- **enemyGrenades**: Mini pumpkins shot by enemy pumpkins (20% spawn with shooting ability)
- **bossProjectiles**: Homing explosive pumpkins fired by big boss

### Game State Management
- Global state variables: `score`, `lives`, `shield`, `level`, `gameOver`, `bigBossMode`, `shipDestroying`
- Input tracked via `keys` object (keydown/keyup event listeners)
- UI updates via `updateUI()` function that modifies DOM elements
- Shield system: Player has 100 shield points, depleted by enemy projectiles. When shield reaches 0, player loses a life and ship destruction animation plays.

### Level Structure
- **Even levels (2, 4, 6, etc.)**: Standard pumpkin formations with mini-boss and shooting pumpkins
  - One random pumpkin in second row is designated as "boss" (8 hits instead of 3)
  - Boss pumpkins grow larger as they take damage and trigger splash damage on death
  - 20% of non-boss pumpkins can shoot grenades
- **Odd levels (3, 5, 7, etc.)**: Single "Big Boss" fight
  - Big boss has 100 HP, grows to 4x size as damaged, fires homing projectiles
  - Boss moves slowly side to side and shoots every 1.5-3 seconds
  - Boss color changes each time (purple, pink, green, cyan, yellow cycle)

### Progressive Damage System
Each pumpkin has a `damage` property:
- **Regular pumpkins**: 0-3 damage (3 hits to destroy)
- **Mini-boss pumpkins**: 0-8 damage (8 hits to destroy)
- **Big boss**: 0-100 damage (100 hits to destroy)

Visual stages:
- **0**: Intact pumpkin, no face
- **1**: Eyes carved (first hit)
- **2**: Eyes, nose, and mouth carved (second hit)
- **3+**: Triggers explosion animation, then destroyed

Pumpkins have two face types (`faceType` property):
- **'normal'**: Triangle eyes, zigzag mouth
- **'scary'**: Angry slanted eyes, jagged mouth with fangs

The `drawPumpkin()` function conditionally renders facial features based on damage level and scales boss pumpkins dynamically.

### Power-Up System
Four power-up types drop from destroyed pumpkins (15% drop rate for regular, 50% for bosses):

1. **Laser** (cyan icon): Replaces bullets with continuous beam for 10 seconds. Beam does continuous damage to any pumpkin in its path.
2. **Clone** (twin ships icon): Spawns ally bat ships that follow the player and shoot simultaneously. Multiple clones can stack.
3. **Shield** (shield icon): Instant effect, restores 50 shield points (max 100).
4. **Auto-shoot** (bullets + "AUTO" icon): Automatically fires bullets every 0.25 seconds for 10 seconds. Works with clone ships.

Power-ups stored in `activePowerUps` object with timers. Clone ships tracked separately in `cloneShips` array with individual timers.

### Collision Detection
- **Bullet-pumpkin collision**: AABB checks in `update()` function, increments damage
- **Bullet-boss projectile collision**: Can shoot down boss projectiles for 25 points
- **Grenade-player collision**: Deals 15 shield damage
- **Boss projectile-player collision**: Deals 25 shield damage
- **Power-up-player collision**: Activates power-up effect
- **Laser-pumpkin collision**: Continuous damage (0.05 per frame) to all pumpkins in beam path

When shield reaches 0:
1. `shipDestroying` flag set to true
2. `drawShipDestruction()` renders 60-frame explosion animation
3. `playSadSound()` plays descending 4-note audio sequence
4. After animation, shield resets to 100 and gameplay resumes (if lives remain)

### Enemy Behavior
- **Regular pumpkins**: Move horizontally in formation at `pumpkinSpeed`
  - Direction reverses when edge is hit, all pumpkins drop by `pumpkinDropDistance`
  - Speed increases by 0.5 each level
  - Shooting pumpkins fire grenades every 2-5 seconds
- **Big boss**: Moves smoothly side to side using sine wave pattern
  - Fires homing projectiles that curve towards player
  - Does not move downward like regular pumpkins

### Rendering
All drawing uses `ctx` (2D rendering context):
- **Player/Clone ships**: Drawn as bat with body, head, ears, eyes, and wings using `drawPlayer()` and `drawCloneShip()`
  - Shield rendered as cyan glow ring when active
- **Pumpkins**: Drawn with body, ridges, stem, and progressive face features via `drawPumpkin()`
- **Bullets**: Drawn as silver carving knives via `drawBullet()`
- **Lasers**: Drawn as gradient beam from ship to top of screen via `drawLaser()`
- **Grenades**: Drawn as mini pumpkins via `drawGrenade()`
- **Power-ups**: Drawn as green coins with unique icons via `drawPowerUp()`

Context techniques used:
- `ctx.save()` / `ctx.restore()` for transform isolation
- `ctx.translate()` for object-relative coordinate systems
- `ctx.scale()` for boss growth animation
- Shadows and glows via `shadowColor` and `shadowBlur` properties
- `ctx.globalAlpha` for transparency effects

## Modifying Game Parameters

All tunable constants are at the top of `game.js`:

```javascript
PUMPKIN_ROWS / PUMPKIN_COLS  // Enemy formation size (even levels)
PUMPKIN_SIZE / PUMPKIN_SPACING  // Visual layout
BULLET_SPEED / BULLET_WIDTH / BULLET_HEIGHT  // Projectile behavior
GRENADE_SPEED / GRENADE_SIZE / GRENADE_DAMAGE  // Enemy grenade settings
POWERUP_TYPES / POWERUP_SIZE / POWERUP_FALL_SPEED  // Power-up mechanics
pumpkinSpeed  // Enemy speed (increases per level)
player.speed  // Player movement speed
bigBoss.maxDamage  // Big boss health (default 100)
```

## Key Functions

- **initPumpkins()**: Creates pumpkin formation or big boss based on level number. Designates mini-boss and shooting pumpkins.
- **update()**: Main game logic - handles all movement, collisions, power-up timers, and game state transitions
- **draw()**: Renders all game objects in correct order (stars, lasers, ships, pumpkins, projectiles, UI)
- **drawShipDestruction()**: Renders multi-ring explosion animation with debris particles
- **playSadSound()**: Uses Web Audio API to play descending tone sequence (A-G-F-D)

## Game Flow

1. Player starts with 3 lives, 100 shield, level 1
2. Even levels: Destroy all pumpkins to advance (with mini-boss)
3. Odd levels: Defeat big boss to advance
4. Each level increases pumpkin speed by 0.5
5. Game over when lives reach 0 or pumpkins/boss reach bottom
6. Press ENTER to restart after game over
