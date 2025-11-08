# ARELLA THE FINAL BOSS - Test Files

## Test Files Created

- **index-arella.html** - Test HTML page
- **game-mobile-arella.js** - Test game that starts at level 20

## How to Test

1. Navigate to: `http://localhost:8080/index-arella.html`
2. Tap the "CARVE PUMPKINS!" button to start
3. You'll immediately face ARELLA THE FINAL BOSS at level 20

## ARELLA Features to Test

### Visual
- ✅ ARELLA.jpg image displayed as the boss
- ✅ Hot pink glow effect around ARELLA
- ✅ Pink glitter projectiles with sparkles

### Mechanics
- ✅ **Teleportation Dodge**: ARELLA has a 20% chance (1 in 5) to teleport when hit by bullets
- ✅ **Teleport Animation**:
  - Boss fades out with pink sparkles
  - Instantly relocates to new random position
  - Fades back in
- ✅ **Pink Glitter Shots**: Animated glitter particles that rotate and pulse
- ✅ **50% More HP**: ARELLA has 1.5x the normal boss HP

## Expected Behavior

- Boss name displayed as "ARELLA THE FINAL BOSS"
- Boss shoots pink glitter instead of regular projectiles
- Roughly 1 out of every 5 bullets will trigger a teleport dodge
- During teleport (30 frames), bullets pass through harmlessly
- Normal boss movement when not teleporting

## Regular Game

ARELLA appears on:
- Level 20
- Level 40
- Level 60
- Every 20th level thereafter
