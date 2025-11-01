# 🎃 Pumpkin Invaders

A Halloween-themed Space Invaders arcade game where you defend your spaceship against waves of attacking pumpkins!

## Features

- **Progressive Damage System**: Hit pumpkins with bullets to progressively carve jack-o-lantern faces into them
  - First hit: Eyes appear
  - Second hit: Nose and mouth are carved
  - Third hit: Pumpkin explodes!
- **Wave-based Gameplay**: Each level increases difficulty with faster pumpkin movement
- **Retro Arcade Feel**: Classic Space Invaders mechanics with a spooky Halloween twist
- **Colorful Graphics**: Hand-drawn canvas graphics with Halloween colors and effects

## How to Play

1. Open `index.html` in a web browser
2. Use **← →** arrow keys to move your spaceship left and right
3. Press **SPACE** to shoot bullets at the pumpkins
4. Destroy all pumpkins before they reach your ship!
5. Press **ENTER** to restart after game over

## Game Mechanics

- You have 3 lives
- Each destroyed pumpkin gives you 100 points
- Pumpkins move in formation and drop down when they hit the screen edges
- You can have up to 3 bullets on screen at once
- Game over if pumpkins reach the bottom

## Files

- `index.html` - Main game page with canvas and UI
- `game.js` - Complete game logic, rendering, and physics

## Requirements

- Any modern web browser with HTML5 Canvas support
- No build process or dependencies required - just open and play!

## Development

This is a pure vanilla JavaScript game using HTML5 Canvas. No frameworks or external libraries needed.

To modify the game, edit:
- Game constants at the top of `game.js` (speed, bullet count, enemy formation, etc.)
- Drawing functions to change visual appearance
- Game mechanics in the `update()` function

Have a spooky fun time! 👻🎃
