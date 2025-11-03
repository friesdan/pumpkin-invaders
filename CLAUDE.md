# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pumpkin Invaders is a Halloween-themed Space Invaders arcade game built with vanilla JavaScript and HTML5 Canvas. The game features a progressive damage system, boss fights, power-ups, and a shield mechanic.

## Running the Game

- **Desktop version**: Open `index.html` in any web browser
- **Mobile version**: Open `index-mobile.html` for touch-optimized controls

No build process, package manager, or dependencies required.

## File Structure

- **index.html / game.js**: Main desktop version with keyboard controls
- **index-mobile.html / game-mobile.js**: Mobile version with touch controls and responsive canvas sizing
- **game-backup.js, game-enhanced*.js, game-working*.js**: Development backups and working versions (not used in production)

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
- Global state variables: `score`, `lives`, `shield`, `level`, `gameOver`, `bigBossMode`, `shipDestroying`, `paused`, `combo`, `screenShake`
- Input tracked via `keys` object (keydown/keyup event listeners) or `touchControls` object on mobile
- UI updates via `updateUI()` function that modifies DOM elements
- Shield system: Player has 100 shield points, depleted by enemy projectiles. When shield reaches 0, player loses a life and ship destruction animation plays.
- Pause system: Press P to pause/unpause game (pauses all updates but not rendering)
- Combo system: Rapidly destroying enemies increases combo multiplier, resets after timer expires
- Settings: Volume control, colorblind mode, difficulty selection, and key rebinding available via settings menu
- High scores: Top 10 scores stored in localStorage with player names

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
Power-ups drop from destroyed pumpkins (15% drop rate for regular, 50% for bosses, 100% for big boss):

1. **Laser** (cyan icon): Replaces bullets with continuous beam for 10 seconds. Beam does continuous damage to any pumpkin in its path.
2. **Clone** (twin ships icon): Spawns ally bat ships that follow the player and shoot simultaneously. Multiple clones can stack.
3. **Shield** (shield icon): Instant effect, restores 50 shield points (max 100).
4. **Auto-shoot** (bullets + "AUTO" icon): Automatically fires bullets every 0.25 seconds for 10 seconds. Works with clone ships.
5. **Pierce** (arrow icon): Bullets pass through pumpkins for 8 seconds instead of stopping. Has cooldown period after expiration.

Power-ups stored in `activePowerUps` object with timers. Clone ships tracked separately in `cloneShips` array with individual timers. Pierce has additional `pierceCooldownTimer` to prevent immediate reactivation.

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
- **Particles**: Explosion particles, pumpkin bits, and other visual effects via `particles` array
- **Screen shake**: Camera shake effect applied via canvas translation when `screenShake > 0`
- **UI overlays**: Pause menu, settings menu, high scores, combo counter, power-up timers

Context techniques used:
- `ctx.save()` / `ctx.restore()` for transform isolation
- `ctx.translate()` for object-relative coordinate systems and screen shake
- `ctx.scale()` for boss growth animation
- Shadows and glows via `shadowColor` and `shadowBlur` properties
- `ctx.globalAlpha` for transparency effects
- Colorblind mode: Alternative color palettes when enabled in settings

## Modifying Game Parameters

All tunable constants are at the top of `game.js` and `game-mobile.js`:

```javascript
PUMPKIN_ROWS / PUMPKIN_COLS  // Enemy formation size (even levels)
PUMPKIN_SIZE / PUMPKIN_SPACING  // Visual layout
BULLET_SPEED / BULLET_WIDTH / BULLET_HEIGHT  // Projectile behavior
GRENADE_SPEED / GRENADE_SIZE / GRENADE_DAMAGE  // Enemy grenade settings
POWERUP_TYPES / POWERUP_SIZE / POWERUP_FALL_SPEED  // Power-up mechanics
pumpkinSpeed  // Enemy speed (increases per level)
player.speed  // Player movement speed
bigBoss.maxDamage  // Big boss health (default 100)
volume  // Audio volume (0.0 - 1.0)
difficulty  // Game difficulty ('easy', 'normal', 'hard')
keyBindings  // Customizable key mappings for controls
```

## Controls

**Desktop (index.html):**
- Arrow keys: Move left/right
- Space, A, S, D, F: Shoot (multiple keys for rapid fire)
- P: Pause/unpause
- Enter: Restart game or submit high score name
- Settings menu: Accessible from pause menu

**Mobile (index-mobile.html):**
- Touch left/right side of canvas: Move ship
- Red fire button: Shoot
- Tap pause button: Pause/unpause

## Key Functions

- **initPumpkins()**: Creates pumpkin formation or big boss based on level number. Designates mini-boss and shooting pumpkins.
- **update()**: Main game logic - handles all movement, collisions, power-up timers, and game state transitions. Skipped when `paused` is true.
- **draw()**: Renders all game objects in correct order (stars, lasers, ships, pumpkins, projectiles, UI, overlays). Always runs even when paused.
- **drawShipDestruction()**: Renders multi-ring explosion animation with debris particles
- **playSadSound()**: Uses Web Audio API to play descending tone sequence (A-G-F-D)
- **playSound()**: Generic sound generator using Web Audio API with configurable frequency, duration, and type
- **loadHighScores() / saveHighScores()**: localStorage persistence for top 10 high scores
- **drawPauseMenu() / drawSettingsMenu() / drawHighScores()**: UI overlay rendering functions

## Game Flow

1. Player starts with 3 lives, 100 shield, level 1
2. Even levels (2, 4, 6, ...): Destroy all pumpkins to advance (includes one mini-boss with 8 HP)
3. Odd levels (3, 5, 7, ...): Defeat big boss to advance (100 HP, unique boss names)
4. Each level increases pumpkin speed by 0.5
5. Combo system rewards rapid consecutive kills with score multipliers
6. Power-ups drop randomly from destroyed enemies
7. Game over when lives reach 0 or enemies reach bottom of screen
8. High scores saved to localStorage with player names (top 10)
9. Press ENTER to restart after game over or submit high score name

## Mobile-Specific Differences

The mobile version (`game-mobile.js`) includes:
- Touch-based input instead of keyboard (`touchControls` object)
- Responsive canvas sizing based on device screen dimensions
- On-screen fire button rendered in bottom-right corner
- Optimized for portrait and landscape orientations
- Same gameplay mechanics and features as desktop version
