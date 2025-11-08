// Game constants
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let WIDTH = canvas.width;
let HEIGHT = canvas.height;

// Mobile support
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let touchControls = {
    left: false,
    right: false,
    shoot: false,
    targetX: null, // Target X position for ship movement
    movementTouchId: null, // ID of touch controlling movement
    shootTouchId: null // ID of touch controlling shooting
};
let activeTouches = new Map(); // Track all active touches

// Make canvas responsive for mobile (after variables are declared)
if (isMobile) {
    // Use more conservative sizing to ensure everything fits on screen
    const maxWidth = Math.min(window.innerWidth - 20, 800); // Leave 10px margin on each side
    const maxHeight = Math.min(window.innerHeight * 0.6, 600); // Leave room for UI and headers
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    WIDTH = canvas.width;
    HEIGHT = canvas.height;
}

// Global scale factor - everything scales proportionally based on screen size
const REFERENCE_WIDTH = 800;
const REFERENCE_HEIGHT = 600;
const SCALE_X = WIDTH / REFERENCE_WIDTH;
const SCALE_Y = HEIGHT / REFERENCE_HEIGHT;
const SCALE = Math.min(SCALE_X, SCALE_Y); // Use smaller dimension to maintain aspect ratio

// Helper function to create scaled font strings
function scaledFont(size, style = '', family = 'Arial') {
    const scaledSize = Math.max(8, Math.round(size * SCALE)); // Minimum 8px for readability
    return `${style} ${scaledSize}px ${family}`.trim();
}

// Game state - ARELLA TEST: Start at level 20
let score = 0;
let lives = 3;
let shield = 100;
let level = 20; // Start at ARELLA level
let deaths = 0; // Track number of deaths for survival challenge
let gameOver = false;
let gameStarted = false; // Game hasn't started until button is tapped
let audioContextUnlocked = false; // Track if audio context is unlocked
let keys = {};
let bigBossMode = false;
let bigBoss = null;
let shipDestroying = false;
let shipDestroyFrame = 0;
let shipRotation = 0;
let shipSpinSpeed = 0;
let levelComplete = false;
let levelCompleteTimer = 0;
let levelCompleteMessage = '';
let pumpkinBits = [];
let showHighScores = false;
let enteringName = false;
let playerName = '';
let highScores = [];
let pierceCooldownTimer = 0; // Tracks cooldown after pierce expires
let shuffledBossNames = []; // Randomized boss names for this game
let paused = false;
let combo = 0;
let comboTimer = 0;
let particles = [];
let screenShake = 0;
let volume = 0.5;
let colorblindMode = false;
let showSettings = false;
let difficulty = 'normal';
let keyBindings = {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    shoot: [' ', 'a', 's', 'd', 'f'],
    pause: 'p'
};
let remappingKey = null;

// VIRAL FEATURE: Daily Challenges
let dailyChallenge = {
    active: false,
    type: '',
    target: 0,
    progress: 0,
    date: new Date().toDateString(),
    name: '',
    description: '',
    completed: false
};

// VIRAL FEATURE: Share tracking
let shareableScore = {
    score: 0,
    level: 0,
    timestamp: Date.now(),
    challengeMode: false,
    challengeScore: 0,
    challengeLevel: 0
};

// Load ARELLA boss image
const arellaImage = new Image();
arellaImage.src = 'ARELLA.jpg';

// Audio context for sound effects (create once and reuse)
let audioContext = null;
let sizzleOscillator = null;
let sizzleGain = null;
let spookyMusicOscillators = [];
let spookyMusicGain = null;
let backgroundMusicOscillators = [];
let backgroundMusicGain = null;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Unlock audio context on first user interaction (required for iOS)
function unlockAudioContext() {
    const ctx = getAudioContext();
    // Resume the context if it's suspended
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    if (!audioContextUnlocked) {
        // Play a silent sound to unlock on first interaction
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0;
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.01);
        audioContextUnlocked = true;
    }
}

// Player (all sizes and speeds scaled, smaller on mobile)
const playerSizeMultiplier = isMobile ? 0.7 : 1; // 30% smaller on mobile
const player = {
    x: WIDTH / 2,
    y: HEIGHT - (60 * SCALE),
    width: 50 * SCALE * playerSizeMultiplier,
    height: 40 * SCALE * playerSizeMultiplier,
    speed: 5 * SCALE,
    bullets: [],
    powerUp: null, // Can be 'laser', 'pierceknife', or null
    powerUpTimer: 0
};

// Pumpkins (all sizes and speeds scaled)
let pumpkins = [];
let enemyGrenades = [];
let bossProjectiles = [];
const PUMPKIN_ROWS = 4;
const PUMPKIN_COLS = 8;
const PUMPKIN_SIZE = 40 * SCALE;
const PUMPKIN_SPACING = 60 * SCALE;
let pumpkinDirection = 1;
let pumpkinSpeed = (isMobile ? 0.5 : 1) * SCALE; // Slower speed for mobile, scaled
let pumpkinDropDistance = (isMobile ? 10 : 20) * SCALE; // Smaller drops for mobile, scaled
const GRENADE_SPEED = 2 * SCALE;
const GRENADE_SIZE = 12 * SCALE;
const GRENADE_DAMAGE = 15;

// Power-ups (sizes and speeds scaled)
let powerUps = [];
const POWERUP_TYPES = ['laser', 'clone', 'shield', 'autoshoot', 'pierceknife'];
const POWERUP_TYPES_WITH_FULLSHIELD = ['laser', 'clone', 'shield', 'fullshield', 'autoshoot', 'pierceknife'];
const POWERUP_SIZE = 30 * SCALE;
const POWERUP_FALL_SPEED = 3 * SCALE;
let activePowerUps = {
    laser: { active: false, timer: 0 },
    clone: { active: false, timer: 0 },
    autoshoot: { active: false, timer: 0 },
    pierceknife: { active: false, timer: 0 }
};
let cloneShips = [];
let autoShootCooldown = 0;

// Weapon power-up distribution functions
function collectWeaponPowerUp(type) {
    // Laser or pierce collected
    if (type === 'pierceknife') {
        // Pierce always goes to main ship
        const hadLaser = player.powerUp === 'laser';
        player.powerUp = 'pierceknife';
        player.powerUpTimer = 600; // 10 seconds at 60fps
        playPierceSound();
        // If main ship had laser, move it to clones
        if (hadLaser) {
            assignLaserToClones();
        }
    } else if (type === 'laser') {
        // Laser distribution logic
        if (!player.powerUp) {
            // Main ship empty - give laser to main
            player.powerUp = 'laser';
            player.powerUpTimer = 600;
            playLaserSound();
        } else if (player.powerUp === 'laser' && cloneShips.length === 0) {
            // Main ship has laser but no clones - refresh laser on main
            player.powerUp = 'laser';
            player.powerUpTimer = 600;
            playLaserSound();
        } else if (player.powerUp === 'laser' && cloneShips.length > 0) {
            // Main ship has laser and has clones - give laser to clones (main keeps its laser)
            assignLaserToClones();
        } else if (player.powerUp === 'pierceknife') {
            // Main ship has pierce - give laser to clones
            assignLaserToClones();
        }
    }
}

function redistributePowerUps() {
    // Called when clones are added or pierce expires
    // If main ship has pierce, move laser to clones
    if (player.powerUp === 'pierceknife') {
        assignLaserToClones();
    } else if (player.powerUp === 'laser') {
        // Main ship has laser - check if we should keep it there or move to clones
        // Keep on main ship
    }
}

function assignLaserToClones() {
    // Assign laser to up to 2 outermost clones
    if (cloneShips.length === 0) return;

    // Clear laser from all clones first
    for (let clone of cloneShips) {
        if (clone.powerUp === 'laser') {
            clone.powerUp = null;
            clone.powerUpTimer = 0;
        }
    }

    if (cloneShips.length === 1) {
        // Only one clone - give it laser
        cloneShips[0].powerUp = 'laser';
        cloneShips[0].powerUpTimer = 600;
    } else {
        // Multiple clones - give laser to leftmost and rightmost
        cloneShips[0].powerUp = 'laser';
        cloneShips[0].powerUpTimer = 600;
        cloneShips[cloneShips.length - 1].powerUp = 'laser';
        cloneShips[cloneShips.length - 1].powerUpTimer = 600;
    }
    playLaserSound();
}

// Witch system (appears on regular levels after bosses, every 3rd or 6th level)
let witch = null;
let witchLevelInterval = 0; // Will be set to 3 or 6 at level 4
let lastWitchLevel = 0; // Track when witch last appeared
let extraLifeToken = null;

// Parallax starfield (3 layers moving top to bottom)
let starLayers = [];

function initStars() {
    starLayers = [
        // Layer 1 (farthest, slowest) - 30 small stars
        { stars: [], speed: 0.3 * SCALE, size: 1 * SCALE, opacity: 0.4, count: 30 },
        // Layer 2 (middle) - 25 medium stars
        { stars: [], speed: 0.6 * SCALE, size: 2 * SCALE, opacity: 0.7, count: 25 },
        // Layer 3 (closest, fastest) - 20 larger stars
        { stars: [], speed: 1.0 * SCALE, size: 3 * SCALE, opacity: 1.0, count: 20 }
    ];

    // Initialize each layer's stars
    for (let layer of starLayers) {
        for (let i = 0; i < layer.count; i++) {
            layer.stars.push({
                x: Math.random() * WIDTH,
                y: Math.random() * HEIGHT
            });
        }
    }
}

// Initialize stars on load
initStars();

// Bullet settings (sizes and speeds scaled)
const BULLET_WIDTH = 4 * SCALE;
const BULLET_HEIGHT = 15 * SCALE;
const BULLET_SPEED = 7 * SCALE;

// Pumpkin damage stages (0 = no damage, 1-2 = carved stages, 3 = destroyed)
const DAMAGE_STAGES = 3;

// Shuffle boss names for randomization
function getDifficultyModifier() {
    switch(difficulty) {
        case 'easy': return { health: 0.7, speed: 0.8, damage: 0.7 };
        case 'hard': return { health: 1.3, speed: 1.2, damage: 1.3 };
        default: return { health: 1, speed: 1, damage: 1 };
    }
}

function getColor(normalColor, cbColor) {
    return colorblindMode ? cbColor : normalColor;
}

function addScreenShake(intensity) {
    screenShake = Math.max(screenShake, intensity);
}

function createParticles(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 2 + Math.random() * 3;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            size: 3 + Math.random() * 5,
            color: color,
            life: 30 + Math.random() * 30,
            maxLife: 60
        });
    }
}

function shuffleBossNames() {
    const bossNames = [
        'Darth Pumpkin', 'Pumpkin Queen', 'Khan Pumpkin', 'Pumpkin Dalek', 'Cyber Pumpkin',
        'Pumpkin Predator', 'Pumpkin Alien', 'Pumpkinator', 'Pumpkin Replicant', 'Pumpkin Cylon',
        'Pumpkin Lord', 'Pumpkin Goa\'uld', 'Pumpkin Wraith', 'Pumpkin Skrull', 'Pumpkin Thanos',
        'Pumpkintron', 'Pumpkin Loki', 'Pumpkineto', 'Pumpkin Apocalypse', 'Pumpkintus',
        'LeBoss James', 'The Pumpkin Dominator', 'Pumpkin King', 'Pumpkin Rifter', 'Boss Hog',
        'Mike Tyson', 'Pumpkin Breaker', 'Pumpkinhead', 'Pumpkin Librarian', 'The Pumpkin Lord',
        'The Pumpkinkeeper', 'The Pumpkin Controller', 'The Pumpkin Overseer', 'The Pumpkin Menace'
    ];

    // Fisher-Yates shuffle
    const shuffled = [...bossNames];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    shuffledBossNames = shuffled;
}

// Clear all pierce bullets (called when starting a new level)
function clearPierceBullets() {
    // Remove all pierce bullets from player
    player.bullets = player.bullets.filter(bullet => !bullet.pierce);

    // Remove all pierce bullets from clones
    for (let clone of cloneShips) {
        clone.bullets = clone.bullets.filter(bullet => !bullet.pierce);
    }
}

// Initialize pumpkins
function initPumpkins() {
    // Clear pierce bullets when starting new level
    clearPierceBullets();

    // Check if it's time for a big boss (every 3 levels)
    if (level % 3 === 0) {
        bigBossMode = true;
        const bossIndex = Math.floor((level / 3) - 1);
        const musicTheme = bossIndex % 5; // Cycle through 5 different themes
        startSpookyMusic(musicTheme);

        // Map boss names to projectile types
        const projectileTypes = {
            'LeBoss James': 'basketball',
            'The Pumpkin Dominator': 'planet',
            'Pumpkin King': 'fireball',
            'Pumpkin Rifter': 'rift',
            'Boss Hog': 'pig',
            'Mike Tyson': 'fist',
            'Pumpkin Breaker': 'glitch',
            'Pumpkinhead': 'silly',
            'Pumpkin Librarian': 'book',
            'The Pumpkin Lord': 'lightning',
            'The Pumpkinkeeper': 'clock',
            'The Pumpkin Controller': 'controller',
            'The Pumpkin Overseer': 'eye',
            'The Pumpkin Menace': 'anchor',
            'default': 'pumpkin' // All other bosses shoot pumpkins
        };
        const bossColors = ['#8b00ff', '#ff0066', '#00ff00', '#00ccff', '#ffff00', '#ff8800', '#ff00ff', '#00ff88'];
        const colorIndex = bossIndex % bossColors.length;
        const nameIndex = bossIndex % shuffledBossNames.length;

        // Progressive sizing: start at 2x, progress to 9x over 40 levels
        // Formula: scale = 2 + (level / 40) * 7, capped at 9x
        const baseScale = 2 + Math.min(level / 40, 1) * 7;
        const bossSize = PUMPKIN_SIZE * baseScale;

        // Progressive difficulty: HP increases with level (halved from original)
        const baseHP = 50 + (Math.floor(level / 3) * 25);

        // Check if ARELLA should appear (any boss level after 15, 25% chance)
        const isArellaLevel = level > 15 && Math.random() < 0.25;
        const bossName = isArellaLevel ? 'ARELLA THE FINAL BOSS' : shuffledBossNames[nameIndex];
        const projectileType = isArellaLevel ? 'glitter' : (projectileTypes[bossName] || projectileTypes['default']);

        bigBoss = {
            x: WIDTH / 2,
            y: HEIGHT * 0.25, // Boss at 25% down from top (scales with screen)
            width: bossSize,
            height: bossSize,
            baseSize: PUMPKIN_SIZE,
            damage: 0,
            maxDamage: isArellaLevel ? baseHP * 1.5 : baseHP, // ARELLA has 50% more HP
            alive: true,
            exploding: false,
            explosionFrame: 0,
            color: isArellaLevel ? '#ff69b4' : bossColors[colorIndex], // Hot pink for ARELLA
            faceType: 'scary',
            shootCooldown: 0,
            name: bossName,
            projectileType: projectileType,
            isArella: isArellaLevel,
            teleportCooldown: 0,
            teleporting: false,
            teleportFrame: 0,
            dodgeChance: 0.2 // 1 in 5 chance (20%)
        };
        bossProjectiles = [];
        return;
    }

    bigBossMode = false;
    pumpkins = [];
    enemyGrenades = [];

    // Scale pumpkin formation to fit screen width
    const totalFormationWidth = (PUMPKIN_COLS - 1) * PUMPKIN_SPACING + PUMPKIN_SIZE;
    const availableWidth = WIDTH - (100 * SCALE); // Leave scaled margin on each side
    const scale = Math.min(1, availableWidth / totalFormationWidth);
    const scaledSpacing = PUMPKIN_SPACING * scale;
    const actualFormationWidth = (PUMPKIN_COLS - 1) * scaledSpacing + PUMPKIN_SIZE;
    const startX = (WIDTH - actualFormationWidth) / 2; // Center the formation
    const startY = 80 * SCALE; // Scale starting Y position

    // Calculate number of boss pumpkins based on level (1 per 10 levels)
    const numBosses = Math.floor(level / 10) + 1;
    const bossCols = [];

    // Pick random unique columns for boss pumpkins
    while (bossCols.length < Math.min(numBosses, PUMPKIN_COLS)) {
        const col = Math.floor(Math.random() * PUMPKIN_COLS);
        if (!bossCols.includes(col)) {
            bossCols.push(col);
        }
    }

    for (let row = 0; row < PUMPKIN_ROWS; row++) {
        for (let col = 0; col < PUMPKIN_COLS; col++) {
            const isBoss = (row === 1) && bossCols.includes(col);
            const faceType = Math.random() < 0.5 ? 'normal' : 'scary';
            const canShoot = !isBoss && Math.random() < 0.2; // 20% of non-boss pumpkins can shoot

            pumpkins.push({
                x: startX + col * scaledSpacing,
                y: startY + row * scaledSpacing,
                width: PUMPKIN_SIZE,
                height: PUMPKIN_SIZE,
                damage: 0,
                maxDamage: isBoss ? 8 : 3,
                alive: true,
                exploding: false,
                explosionFrame: 0,
                isBoss: isBoss,
                faceType: faceType,
                baseSize: PUMPKIN_SIZE,
                canShoot: canShoot,
                shootCooldown: 0
            });
        }
    }
}

// Draw spaceship (bat design)
function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.scale(playerSizeMultiplier, playerSizeMultiplier); // Scale player visually

    // Bat body (dark purple)
    ctx.fillStyle = getColor('#4a3580', '#0066cc');
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bat head
    ctx.fillStyle = getColor('#5a4590', '#0088ee');
    ctx.beginPath();
    ctx.arc(0, -8, 8, 0, Math.PI * 2);
    ctx.fill();

    // Bat ears (pointed)
    ctx.fillStyle = '#4a3580';
    ctx.beginPath();
    ctx.moveTo(-5, -12);
    ctx.lineTo(-8, -20);
    ctx.lineTo(-3, -14);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(5, -12);
    ctx.lineTo(8, -20);
    ctx.lineTo(3, -14);
    ctx.closePath();
    ctx.fill();

    // Bat eyes (glowing)
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(-3, -9, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, -9, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Left wing
    ctx.fillStyle = getColor('#6b5bff', '#00aaff');
    ctx.strokeStyle = '#8b7bff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(-20, -5, -30, 0);
    ctx.quadraticCurveTo(-25, 8, -18, 12);
    ctx.quadraticCurveTo(-12, 8, -10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wing details (membrane)
    ctx.strokeStyle = '#7b6bff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.lineTo(-15, 8);
    ctx.moveTo(-10, 0);
    ctx.lineTo(-20, 5);
    ctx.moveTo(-10, -2);
    ctx.lineTo(-25, 2);
    ctx.stroke();

    // Right wing
    ctx.fillStyle = getColor('#6b5bff', '#00aaff');
    ctx.strokeStyle = '#8b7bff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.quadraticCurveTo(20, -5, 30, 0);
    ctx.quadraticCurveTo(25, 8, 18, 12);
    ctx.quadraticCurveTo(12, 8, 10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wing details (membrane)
    ctx.strokeStyle = '#7b6bff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, 2);
    ctx.lineTo(15, 8);
    ctx.moveTo(10, 0);
    ctx.lineTo(20, 5);
    ctx.moveTo(10, -2);
    ctx.lineTo(25, 2);
    ctx.stroke();

    // Shield glow if active
    if (shield > 0) {
        const shieldAlpha = shield / 100;
        // Color matches shield bar
        let glowColor;
        if (shield > 75) {
            glowColor = '0, 255, 0'; // Green
        } else if (shield > 50) {
            glowColor = '136, 255, 0'; // Yellow-green
        } else if (shield > 33) {
            glowColor = '255, 170, 0'; // Orange
        } else if (shield > 15) {
            glowColor = '255, 102, 0'; // Dark orange
        } else {
            glowColor = '255, 0, 0'; // Red
        }
        
        ctx.strokeStyle = `rgba(${glowColor}, ${shieldAlpha * 0.6})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = `rgb(${glowColor})`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

// Draw clone ship (bat design with health-based color)
function drawCloneShip(clone) {
    ctx.save();
    ctx.translate(clone.x, clone.y);
    ctx.globalAlpha = 0.7;

    // Color changes based on health: green (3) -> orange (2) -> red (1)
    let bodyColor, headColor, wingColor, wingStroke, eyeColor;

    if (clone.health >= 3) {
        // Green - full health
        bodyColor = '#3a8060';
        headColor = '#4a9070';
        wingColor = '#5bff9b';
        wingStroke = '#7bffbb';
        eyeColor = '#00ff00';
    } else if (clone.health === 2) {
        // Orange - damaged
        bodyColor = '#806040';
        headColor = '#907050';
        wingColor = '#ff9b5b';
        wingStroke = '#ffbb7b';
        eyeColor = '#ff8800';
    } else {
        // Red - critical
        bodyColor = '#803030';
        headColor = '#904040';
        wingColor = '#ff5b5b';
        wingStroke = '#ff7b7b';
        eyeColor = '#ff0000';
    }

    // Bat body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bat head
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.arc(0, -8, 8, 0, Math.PI * 2);
    ctx.fill();

    // Bat ears
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-5, -12);
    ctx.lineTo(-8, -20);
    ctx.lineTo(-3, -14);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(5, -12);
    ctx.lineTo(8, -20);
    ctx.lineTo(3, -14);
    ctx.closePath();
    ctx.fill();

    // Bat eyes (colored glow)
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(-3, -9, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, -9, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Left wing
    ctx.fillStyle = wingColor;
    ctx.strokeStyle = wingStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(-20, -5, -30, 0);
    ctx.quadraticCurveTo(-25, 8, -18, 12);
    ctx.quadraticCurveTo(-12, 8, -10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right wing
    ctx.fillStyle = wingColor;
    ctx.strokeStyle = wingStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.quadraticCurveTo(20, -5, 30, 0);
    ctx.quadraticCurveTo(25, 8, 18, 12);
    ctx.quadraticCurveTo(12, 8, 10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

// Initialize witch
function createWitch() {
    // Create witch to fly across screen during regular level
    witch = {
        x: -100 * SCALE, // Start off screen left
        y: 150 * SCALE,
        width: 60 * SCALE,
        height: 60 * SCALE,
        speed: 3 * SCALE,
        direction: 1, // 1 = right, -1 = left
        passes: 0,
        maxPasses: 5,
        hit: false,
        alive: true
    };
}

// Draw pumpkin with different damage stages
function drawPumpkin(pumpkin) {
    if (!pumpkin.alive) return;

    ctx.save();
    ctx.translate(pumpkin.x, pumpkin.y);

    // Calculate scale for boss pumpkins
    let scale = 1;
    if (pumpkin.maxDamage >= 100) {
        // Big boss - scale based on actual width/baseSize ratio
        scale = pumpkin.width / pumpkin.baseSize;
    } else if (pumpkin.isBoss && pumpkin.damage > 0) {
        scale = 1 + (pumpkin.damage / pumpkin.maxDamage) * 3; // Grows to 4x
        pumpkin.width = pumpkin.baseSize * scale;
        pumpkin.height = pumpkin.baseSize * scale;
    }

    // Handle teleportation effect for ARELLA
    if (pumpkin.isArella && pumpkin.teleporting) {
        const teleportAlpha = pumpkin.teleportFrame < 15 ?
            1 - (pumpkin.teleportFrame / 15) : // Fade out
            (pumpkin.teleportFrame - 15) / 15; // Fade in
        ctx.globalAlpha = teleportAlpha;

        // Pink sparkle effect during teleport
        for (let i = 0; i < 5; i++) {
            const angle = (pumpkin.teleportFrame / 30) * Math.PI * 2 + (i * Math.PI * 2 / 5);
            const radius = 30 + pumpkin.teleportFrame * 2;
            ctx.fillStyle = '#ff69b4';
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (pumpkin.exploding) {
        // Explosion effect - bigger pumpkins have proportionally larger explosions
        const explosionMultiplier = 5 * Math.max(1, scale); // Scale up explosion for bigger pumpkins
        const size = pumpkin.explosionFrame * explosionMultiplier;
        const alpha = 1 - (pumpkin.explosionFrame / 10);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = getColor(pumpkin.color || '#ff6600', pumpkin.color || '#ff9933');
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        return;
    }

    ctx.scale(scale, scale);

    // Draw ARELLA image if this is ARELLA boss
    if (pumpkin.isArella && arellaImage.complete) {
        const imgSize = 40; // Size in canvas units

        // Draw outer pink glow that fades into the image
        const gradient = ctx.createRadialGradient(0, 0, imgSize/3, 0, 0, imgSize/2 + 10);
        gradient.addColorStop(0, 'rgba(255, 105, 180, 0)');
        gradient.addColorStop(0.6, 'rgba(255, 105, 180, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 105, 180, 0.8)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, imgSize/2 + 10, 0, Math.PI * 2);
        ctx.fill();

        // Clip to circular shape to cut off dark corners of jpg
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, imgSize/2, 0, Math.PI * 2);
        ctx.clip();

        // Draw the ARELLA face (clipped to circle)
        ctx.drawImage(arellaImage, -imgSize/2, -imgSize/2, imgSize, imgSize);

        ctx.restore();

        // Subtle sparkle effect around edge
        ctx.strokeStyle = 'rgba(255, 182, 193, 0.6)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff69b4';
        ctx.shadowBlur = 15 * SCALE;
        ctx.beginPath();
        ctx.arc(0, 0, imgSize/2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.restore();
        return; // Skip regular pumpkin drawing
    }

    // Pumpkin body
    ctx.fillStyle = getColor(pumpkin.color || '#ff6600', pumpkin.color || '#ff9933');
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Boss glow effect
    if (pumpkin.isBoss) {
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 15 * SCALE;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 18, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Pumpkin ridges
    ctx.strokeStyle = pumpkin.color ? '#aa0044' : '#cc5200';
    ctx.lineWidth = 2;
    for (let i = -15; i <= 15; i += 10) {
        ctx.beginPath();
        ctx.moveTo(i, -18);
        ctx.lineTo(i, 18);
        ctx.stroke();
    }

    // Stem
    ctx.fillStyle = '#2d5016';
    ctx.fillRect(-3, -22, 6, 8);

    // Draw face based on damage stage
    ctx.fillStyle = '#1a0a00';
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 1;

    // Calculate damage thresholds based on pumpkin type
    let damageForEyes, damageForNose;
    if (pumpkin.maxDamage >= 100) {
        // Big boss - progressive face carving based on HP percentage
        damageForEyes = pumpkin.maxDamage * 0.33;  // Eyes at 33% damage
        damageForNose = pumpkin.maxDamage * 0.66;  // Nose+mouth at 66% damage
    } else {
        // Regular pumpkins use simple damage stages
        damageForEyes = 1;
        damageForNose = 2;
    }

    if (pumpkin.damage >= damageForEyes) {
        if (pumpkin.faceType === 'scary') {
            // Scary eyes (angry slanted)
            ctx.beginPath();
            ctx.moveTo(-14, -8);
            ctx.lineTo(-6, -3);
            ctx.lineTo(-10, 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(14, -8);
            ctx.lineTo(6, -3);
            ctx.lineTo(10, 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            // Normal eyes (triangles)
            ctx.beginPath();
            ctx.moveTo(-12, -5);
            ctx.lineTo(-8, 0);
            ctx.lineTo(-12, 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(12, -5);
            ctx.lineTo(8, 0);
            ctx.lineTo(12, 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }

    if (pumpkin.damage >= damageForNose) {
        // Nose (small triangle)
        ctx.beginPath();
        ctx.moveTo(0, 3);
        ctx.lineTo(-3, 8);
        ctx.lineTo(3, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (pumpkin.faceType === 'scary') {
            // Scary mouth (jagged with fangs)
            ctx.beginPath();
            ctx.moveTo(-12, 10);
            ctx.lineTo(-10, 12);
            ctx.lineTo(-8, 10);
            ctx.lineTo(-6, 14);
            ctx.lineTo(-4, 10);
            ctx.lineTo(-2, 12);
            ctx.lineTo(0, 10);
            ctx.lineTo(2, 12);
            ctx.lineTo(4, 10);
            ctx.lineTo(6, 14);
            ctx.lineTo(8, 10);
            ctx.lineTo(10, 12);
            ctx.lineTo(12, 10);
            ctx.fill();
            ctx.stroke();
        } else {
            // Normal mouth (zigzag)
            ctx.beginPath();
            ctx.moveTo(-10, 12);
            ctx.lineTo(-7, 10);
            ctx.lineTo(-4, 12);
            ctx.lineTo(0, 10);
            ctx.lineTo(4, 12);
            ctx.lineTo(7, 10);
            ctx.lineTo(10, 12);
            ctx.fill();
            ctx.stroke();
        }
    }

    // Draw boss-specific accessories
    if (pumpkin.name === 'LeBoss James') {
        // Draw beard (scaled)
        const s = SCALE;
        ctx.fillStyle = '#1a0a00';
        ctx.beginPath();
        ctx.moveTo(-8, 12);
        ctx.lineTo(-6, 16);
        ctx.lineTo(-4, 18);
        ctx.lineTo(-2, 20);
        ctx.lineTo(0, 21);
        ctx.lineTo(2, 20);
        ctx.lineTo(4, 18);
        ctx.lineTo(6, 16);
        ctx.lineTo(8, 12);
        ctx.lineTo(6, 14);
        ctx.lineTo(4, 15);
        ctx.lineTo(2, 16);
        ctx.lineTo(0, 17);
        ctx.lineTo(-2, 16);
        ctx.lineTo(-4, 15);
        ctx.lineTo(-6, 14);
        ctx.closePath();
        ctx.fill();
    } else if (pumpkin.name === 'Boss Hog') {
        // Draw top hat (scaled)
        const s = SCALE;
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        // Hat brim
        ctx.fillRect(-15, -26, 30, 3);
        ctx.strokeRect(-15, -26, 30, 3);

        // Hat top
        ctx.fillRect(-10, -40, 20, 14);
        ctx.strokeRect(-10, -40, 20, 14);

        // Hat band
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(-10, -28, 20, 2);
    } else if (pumpkin.name === 'Pumpkin Librarian') {
        // Draw horn rim glasses
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#87CEEB'; // Light blue lens tint
        ctx.lineWidth = 2;

        // Left lens
        ctx.beginPath();
        ctx.arc(-8, -5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right lens
        ctx.beginPath();
        ctx.arc(8, -5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Bridge
        ctx.beginPath();
        ctx.moveTo(-2, -5);
        ctx.lineTo(2, -5);
        ctx.stroke();

        // Left temple
        ctx.beginPath();
        ctx.moveTo(-14, -5);
        ctx.lineTo(-18, -5);
        ctx.stroke();

        // Right temple
        ctx.beginPath();
        ctx.moveTo(14, -5);
        ctx.lineTo(18, -5);
        ctx.stroke();
    }

    ctx.restore();
}

// Draw bullet (carving knife)
function drawBullet(bullet) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);

    if (bullet.pierce) {
        // Giant pierce knife
        const scale = 3;
        ctx.scale(scale, scale);

        // Giant knife blade (silver with glow)
        ctx.fillStyle = '#c0c0c0';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20 * SCALE;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-3, 12);
        ctx.lineTo(3, 12);
        ctx.closePath();
        ctx.fill();

        // Energy glow
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Blade highlight
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-1, 2);
        ctx.lineTo(-1, 10);
        ctx.stroke();

        // Knife handle (glowing orange)
        ctx.fillStyle = '#ff8800';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 10;
        ctx.fillRect(-2, 12, 4, 6);
        ctx.shadowBlur = 0;

        // Handle grip lines
        ctx.strokeStyle = '#cc6600';
        ctx.lineWidth = 1;
        for (let i = 13; i < 18; i += 2) {
            ctx.beginPath();
            ctx.moveTo(-2, i);
            ctx.lineTo(2, i);
            ctx.stroke();
        }
    } else {
        // Normal knife blade (silver)
        ctx.fillStyle = '#c0c0c0';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-3, 12);
        ctx.lineTo(3, 12);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Blade highlight
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-1, 2);
        ctx.lineTo(-1, 10);
        ctx.stroke();

        // Knife handle (orange)
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(-2, 12, 4, 6);

        // Handle grip lines
        ctx.strokeStyle = '#cc6600';
        ctx.lineWidth = 1;
        for (let i = 13; i < 18; i += 2) {
            ctx.beginPath();
            ctx.moveTo(-2, i);
            ctx.lineTo(2, i);
            ctx.stroke();
        }
    }

    ctx.restore();
}

// Draw laser beam
function drawLaser(x, y) {
    ctx.save();

    // Laser beam (continuous from ship to top of screen)
    const gradient = ctx.createLinearGradient(x, y, x, 0);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0.2)');

    ctx.fillStyle = gradient;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
    ctx.fillRect(x - 8, 0, 16, y);
    ctx.shadowBlur = 0;

    // Core beam
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.fillRect(x - 3, 0, 6, y);
    ctx.shadowBlur = 0;

    ctx.restore();
}

// Draw witch on broom
function drawWitch(witch) {
    if (!witch.alive) return;

    ctx.save();
    ctx.translate(witch.x, witch.y);

    // Flip horizontally based on direction
    if (witch.direction < 0) {
        ctx.scale(-1, 1);
    }

    // Glowing outline for visibility
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20 * SCALE;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2 * SCALE;

    // Scale all witch elements
    const s = SCALE;

    // Broomstick
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(-25 * s, 10 * s);
    ctx.lineTo(25 * s, 10 * s);
    ctx.stroke();

    // Broom bristles
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 2 * s;
    for (let i = -5; i < 10; i += 3) {
        ctx.beginPath();
        ctx.moveTo(20 * s, 10 * s);
        ctx.lineTo((25 + i) * s, 18 * s);
        ctx.stroke();
    }

    // Witch body (black dress)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(0, -5 * s);
    ctx.lineTo(-12 * s, 10 * s);
    ctx.lineTo(12 * s, 10 * s);
    ctx.closePath();
    ctx.fill();

    // Witch head (green)
    ctx.fillStyle = '#90EE90';
    ctx.beginPath();
    ctx.arc(0, -12 * s, 8 * s, 0, Math.PI * 2);
    ctx.fill();

    // Witch hat
    ctx.fillStyle = '#4B0082';
    ctx.beginPath();
    ctx.moveTo(-10 * s, -12 * s);
    ctx.lineTo(0, -28 * s);
    ctx.lineTo(10 * s, -12 * s);
    ctx.closePath();
    ctx.fill();

    // Hat brim
    ctx.fillRect(-12 * s, -12 * s, 24 * s, 3 * s);

    // Witch face details (evil grin)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-3 * s, -13 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 * s, -13 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Evil smile
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.arc(0, -10 * s, 4 * s, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
}

// Draw extra life token
function drawExtraLifeToken(token) {
    ctx.save();
    ctx.translate(token.x, token.y);

    const s = SCALE;

    // Heart shape for extra life
    ctx.fillStyle = '#FF1493';
    ctx.shadowColor = '#FF1493';
    ctx.shadowBlur = 15 * s;

    ctx.beginPath();
    ctx.moveTo(0, 5 * s);
    ctx.bezierCurveTo(-8 * s, -2 * s, -15 * s, -8 * s, -15 * s, -13 * s);
    ctx.bezierCurveTo(-15 * s, -18 * s, -10 * s, -20 * s, -5 * s, -18 * s);
    ctx.bezierCurveTo(0, -20 * s, 0, -20 * s, 0, -20 * s);
    ctx.bezierCurveTo(0, -20 * s, 0, -20 * s, 5 * s, -18 * s);
    ctx.bezierCurveTo(10 * s, -20 * s, 15 * s, -18 * s, 15 * s, -13 * s);
    ctx.bezierCurveTo(15 * s, -8 * s, 8 * s, -2 * s, 0, 5 * s);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    // "+1" text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = scaledFont(12, 'bold');
    ctx.textAlign = 'center';
    ctx.fillText('+1', 0, -10 * s);

    ctx.restore();
}

// Draw enemy grenade (mini pumpkin)
function drawGrenade(grenade) {
    ctx.save();
    ctx.translate(grenade.x, grenade.y);

    // Mini pumpkin body
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.ellipse(0, 0, GRENADE_SIZE / 2, GRENADE_SIZE / 2 - 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mini stem
    ctx.fillStyle = '#2d5016';
    ctx.fillRect(-1, -GRENADE_SIZE / 2 - 2, 2, 3);

    // Glow
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, GRENADE_SIZE / 2, GRENADE_SIZE / 2 - 1, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
}

// Draw power-up token (green coin with unique icons)
function drawPowerUp(powerUp) {
    ctx.save();
    ctx.translate(powerUp.x, powerUp.y);

    // Coin body (green)
    ctx.fillStyle = '#00ff00';
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(0, 0, POWERUP_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Coin border
    ctx.strokeStyle = '#00aa00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, POWERUP_SIZE / 2, 0, Math.PI * 2);
    ctx.stroke();

    // Draw icon based on power-up type
    ctx.fillStyle = '#003300';
    ctx.strokeStyle = '#003300';
    ctx.lineWidth = 2;

    if (powerUp.type === 'laser') {
        // Laser beam icon
        ctx.fillRect(-2, -8, 4, 16);
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(-1, -8, 2, 16);

        // Sparkles
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -10, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 10, 2, 0, Math.PI * 2);
        ctx.fill();

    } else if (powerUp.type === 'clone') {
        // Two small ships icon
        ctx.fillStyle = '#003300';
        ctx.beginPath();
        ctx.moveTo(-6, -3);
        ctx.lineTo(-10, 3);
        ctx.lineTo(-2, 3);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(6, -3);
        ctx.lineTo(2, 3);
        ctx.lineTo(10, 3);
        ctx.closePath();
        ctx.fill();

    } else if (powerUp.type === 'shield') {
        // Shield icon
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-8, -4);
        ctx.lineTo(-8, 4);
        ctx.lineTo(0, 10);
        ctx.lineTo(8, 4);
        ctx.lineTo(8, -4);
        ctx.closePath();
        ctx.stroke();

    } else if (powerUp.type === 'fullshield') {
        // Full Shield icon - larger with plus sign
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(-10, -5);
        ctx.lineTo(-10, 5);
        ctx.lineTo(0, 12);
        ctx.lineTo(10, 5);
        ctx.lineTo(10, -5);
        ctx.closePath();
        ctx.stroke();

        // Plus sign
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(-6, -1, 12, 2);
        ctx.fillRect(-1, -6, 2, 12);
        ctx.lineWidth = 2;
        ctx.fillStyle = '#006600';
        ctx.fill();

        // Shield cross
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();

    } else if (powerUp.type === 'autoshoot') {
        // Multiple bullets icon
        for (let i = -1; i <= 1; i++) {
            ctx.fillStyle = '#003300';
            ctx.fillRect(i * 5 - 1, -8, 2, 6);
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(i * 5 - 1, -8, 2, 3);
        }

        // "AUTO" text
        ctx.fillStyle = '#003300';
        ctx.font = scaledFont(6, 'bold');
        ctx.textAlign = 'center';
        ctx.fillText('AUTO', 0, 6);

    } else if (powerUp.type === 'pierceknife') {
        // Giant knife icon with glow
        ctx.fillStyle = '#003300';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;

        // Large knife blade
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-4, 8);
        ctx.lineTo(4, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glow effect
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Handle
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(-3, 8, 6, 4);
    }

    ctx.restore();
}

// Draw boss projectile (explosive pumpkin)
function drawBossProjectile(projectile) {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);

    const type = projectile.type || 'pumpkin';
    const size = 20;

    switch(type) {
        case 'basketball':
            // Basketball
            ctx.fillStyle = '#ff8800';
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            // Lines
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-size, 0);
            ctx.lineTo(size, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.lineTo(0, size);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.stroke();
            break;

        case 'planet':
            // Planet/sphere
            ctx.fillStyle = '#4466ff';
            ctx.shadowColor = '#6688ff';
            ctx.shadowBlur = 15 * SCALE;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            // Rings
            ctx.strokeStyle = '#88aaff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, size + 8, 5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            break;

        case 'fireball':
            // Fireball
            ctx.fillStyle = '#ff4400';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 20 * SCALE;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            break;

        case 'rift':
            // Dimensional rift
            ctx.strokeStyle = '#8800ff';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#8800ff';
            ctx.shadowBlur = 15 * SCALE;
            ctx.beginPath();
            ctx.ellipse(0, 0, size * 1.5, size * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#ff00ff';
            ctx.beginPath();
            ctx.ellipse(0, 0, size, size * 0.3, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            break;

        case 'pig':
            // Pig face
            ctx.fillStyle = '#ffaacc';
            ctx.shadowColor = '#ffaacc';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            // Snout
            ctx.fillStyle = '#ff88aa';
            ctx.beginPath();
            ctx.ellipse(0, 2, 10, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            // Nostrils
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(-3, 2, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(3, 2, 2, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.beginPath();
            ctx.arc(-7, -5, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(7, -5, 3, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'fist':
            // Boxing glove/fist
            ctx.fillStyle = '#cc0000';
            ctx.shadowColor = '#cc0000';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-15, 5, 30, 10);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = scaledFont(12, 'bold');
            ctx.textAlign = 'center';
            ctx.fillText('POW', 0, 3);
            break;

        case 'glitch':
            // Glitchy reality effect
            const glitchColors = ['#ff0000', '#00ff00', '#0000ff'];
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = glitchColors[i];
                ctx.globalAlpha = 0.6;
                ctx.fillRect(-size + (i * 5), -size + (i * 5), size * 2, size * 2);
            }
            ctx.globalAlpha = 1;
            break;

        case 'silly':
            // Random silly emoji-like face
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            // Silly face
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(-7, -5, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(7, -5, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 5, 8, Math.PI, 0, false);
            ctx.stroke();
            // Tongue
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-3, 13, 6, 5);
            break;

        case 'book':
            // Book
            ctx.fillStyle = '#8b4513';
            ctx.shadowColor = '#8b4513';
            ctx.shadowBlur = 10;
            ctx.fillRect(-15, -18, 30, 36);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#daa520';
            ctx.fillRect(-13, -16, 26, 32);
            // Pages
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            for (let i = -10; i < 10; i += 3) {
                ctx.beginPath();
                ctx.moveTo(-10, i);
                ctx.lineTo(10, i);
                ctx.stroke();
            }
            break;

        case 'lightning':
            // Lightning bolt
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 20 * SCALE;
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(5, -5);
            ctx.lineTo(10, 0);
            ctx.lineTo(0, 5);
            ctx.lineTo(-5, 20);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-10, -5);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            break;

        case 'clock':
            // Clock
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#888888';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
            // Clock hands
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -12);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(8, 0);
            ctx.stroke();
            // Center dot
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'controller':
            // Game controller
            ctx.fillStyle = '#444444';
            ctx.shadowColor = '#444444';
            ctx.shadowBlur = 10;
            ctx.fillRect(-20, -12, 40, 24);
            ctx.shadowBlur = 0;
            // D-pad
            ctx.fillStyle = '#222222';
            ctx.fillRect(-14, -4, 8, 8);
            ctx.fillRect(-12, -6, 4, 12);
            // Buttons
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(10, -4, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(16, -4, 3, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'eye':
            // Eye
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.ellipse(0, 0, size * 1.2, size, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            // Iris
            ctx.fillStyle = '#0088ff';
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
            ctx.fill();
            // Pupil
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'anchor':
            // Anchor
            ctx.fillStyle = '#666666';
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#666666';
            ctx.shadowBlur = 10;
            // Vertical line
            ctx.fillRect(-2, -18, 4, 32);
            // Horizontal bottom
            ctx.fillRect(-15, 10, 30, 4);
            // Hooks
            ctx.beginPath();
            ctx.arc(-15, 10, 8, 0, Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(15, 10, 8, 0, Math.PI);
            ctx.stroke();
            // Top circle
            ctx.beginPath();
            ctx.arc(0, -18, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            break;

        case 'glitter': // ARELLA's pink glitter projectiles
            // Draw multiple glitter particles
            for (let i = 0; i < 8; i++) {
                const angle = (Date.now() / 200 + i) * Math.PI / 4;
                const dist = Math.sin(Date.now() / 150) * 5;
                const px = Math.cos(angle) * (10 + dist);
                const py = Math.sin(angle) * (10 + dist);

                // Pink glitter particle
                ctx.fillStyle = i % 2 === 0 ? '#ff69b4' : '#ffb6c1';
                ctx.shadowColor = '#ff69b4';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();

                // Sparkle effect
                if (i % 3 === 0) {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(px - 4, py);
                    ctx.lineTo(px + 4, py);
                    ctx.moveTo(px, py - 4);
                    ctx.lineTo(px, py + 4);
                    ctx.stroke();
                }
            }

            // Central glow
            ctx.fillStyle = 'rgba(255, 105, 180, 0.5)';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            break;

        default: // pumpkin
            // Large explosive pumpkin
            ctx.fillStyle = '#ff3300';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 15 * SCALE;
            ctx.beginPath();
            ctx.ellipse(0, 0, size, size - 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Angry face
            ctx.fillStyle = '#000000';
            // Eyes
            ctx.beginPath();
            ctx.arc(-8, -5, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(8, -5, 3, 0, Math.PI * 2);
            ctx.fill();

            // Angry mouth
            ctx.beginPath();
            ctx.arc(0, 8, 10, 0, Math.PI, false);
            ctx.fill();

            // Explosive aura
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, size + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            break;
    }

    ctx.restore();
}

// Draw ship destruction animation
function drawShipDestruction() {
    // Draw spinning ship during out-of-control phase
    if (shipDestroyFrame <= 50) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(shipRotation);
        ctx.globalAlpha = Math.max(0.3, 1 - (shipDestroyFrame / 50));
        
        // Draw simplified bat ship
        ctx.fillStyle = '#6b5bff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Wings
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-25, -5);
        ctx.lineTo(-20, 8);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(25, -5);
        ctx.lineTo(20, 8);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
    
    // Draw pumpkin bits
    for (let bit of pumpkinBits) {
        ctx.save();
        ctx.fillStyle = bit.color;
        ctx.globalAlpha = bit.life / 80;
        ctx.beginPath();
        ctx.arc(bit.x, bit.y, bit.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Draw explosion after ship stops spinning
    if (shipDestroyFrame > 50) {
        ctx.save();
        ctx.translate(player.x, player.y);

        const frame = shipDestroyFrame - 50;
        const maxFrame = 30;
        const progress = Math.min(1, frame / maxFrame);

        // Multiple explosion rings
        for (let i = 0; i < 5; i++) {
            const ringProgress = Math.max(0, progress - (i * 0.1));
            const size = ringProgress * 80;
            const alpha = Math.max(0, 1 - ringProgress * 2);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = i % 2 === 0 ? '#ff6600' : '#ffaa00';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 20 * SCALE;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Debris particles (ship parts)
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const distance = progress * 50;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            const alpha = Math.max(0, 1 - progress);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#8b7bff';
            ctx.fillRect(x - 3, y - 3, 6, 6);
        }

        ctx.restore();
    }

    // Draw "YOU DIED!" message after explosion starts
    if (shipDestroyFrame > 25) {
        ctx.save();
        ctx.fillStyle = '#ff0000';
        ctx.font = scaledFont(60, 'bold');
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20 * SCALE;
        ctx.fillText('YOU DIED!', WIDTH / 2, HEIGHT / 2 + 100);

        ctx.fillStyle = '#ffaa00';
        ctx.font = scaledFont(30, 'bold');
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 10;
        const livesText = lives === 1 ? '1 life left' : lives + ' lives left';
        ctx.fillText('You have ' + livesText + '.', WIDTH / 2, HEIGHT / 2 + 150);
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// Play sad bleepy sound (using Web Audio API) - Extended for dramatic death
function playSadSound() {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'square';

        // Longer, more dramatic descending notes
        const now = ctx.currentTime;
        oscillator.frequency.setValueAtTime(440, now);      // A
        oscillator.frequency.setValueAtTime(415, now + 0.3); // G#
        oscillator.frequency.setValueAtTime(392, now + 0.6); // G
        oscillator.frequency.setValueAtTime(370, now + 0.9); // F#
        oscillator.frequency.setValueAtTime(349, now + 1.2); // F
        oscillator.frequency.setValueAtTime(330, now + 1.5); // E
        oscillator.frequency.setValueAtTime(311, now + 1.8); // D#
        oscillator.frequency.setValueAtTime(293, now + 2.1); // D
        oscillator.frequency.setValueAtTime(277, now + 2.4); // C#
        oscillator.frequency.setValueAtTime(262, now + 2.7); // C (final low note)

        gainNode.gain.setValueAtTime(0.3 * volume, now);
        gainNode.gain.setValueAtTime(0.25 * volume, now + 1.5);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 3.0);

        oscillator.start(now);
        oscillator.stop(now + 3.0);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Happy sound - plays ascending cheerful notes
function playHappySound() {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';

        // Cheerful ascending notes (C major chord arpeggio)
        const now = ctx.currentTime;
        oscillator.frequency.setValueAtTime(523, now);      // C5
        oscillator.frequency.setValueAtTime(659, now + 0.15); // E5
        oscillator.frequency.setValueAtTime(784, now + 0.3); // G5
        oscillator.frequency.setValueAtTime(1047, now + 0.45); // C6 (octave higher)

        gainNode.gain.setValueAtTime(0.3 * volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

        oscillator.start(now);
        oscillator.stop(now + 0.7);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Clone hit sound - plays N descending tones based on hits taken (1-3)
function playCloneHitSound(hitsTaken) {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';

        const now = ctx.currentTime;
        const toneDuration = 0.15; // Short, quick tones

        // Descending frequencies (E, D, C)
        const frequencies = [659, 587, 523]; // E5, D5, C5

        // Set frequencies for each tone based on hits taken (clamp to array length)
        const clampedHits = Math.min(hitsTaken, frequencies.length);
        for (let i = 0; i < clampedHits; i++) {
            oscillator.frequency.setValueAtTime(frequencies[i], now + (i * toneDuration));
        }

        // Volume envelope
        gainNode.gain.setValueAtTime(0.2 * volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + (hitsTaken * toneDuration) + 0.1);

        oscillator.start(now);
        oscillator.stop(now + (hitsTaken * toneDuration) + 0.1);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Shield damage sound
function playShieldDamageSound() {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sawtooth';
        const now = ctx.currentTime;
        
        // Sharp descending sound for impact
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.15);

        gainNode.gain.setValueAtTime(0.2 * volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        oscillator.start(now);
        oscillator.stop(now + 0.15);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Shoot bullet sound
function playShootSound() {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'square';
        const now = ctx.currentTime;
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1);

        gainNode.gain.setValueAtTime(0.1 * volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Laser sound
function playLaserSound() {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sawtooth';
        const now = ctx.currentTime;
        oscillator.frequency.setValueAtTime(1200, now);
        oscillator.frequency.linearRampToValueAtTime(200, now + 0.3);

        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        oscillator.start(now);
        oscillator.stop(now + 0.3);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Pierce knife sound
function playPierceSound() {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        const now = ctx.currentTime;
        oscillator.frequency.setValueAtTime(1500, now);
        oscillator.frequency.linearRampToValueAtTime(1800, now + 0.15);

        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        oscillator.start(now);
        oscillator.stop(now + 0.15);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Pumpkin hit sound
function playHitSound() {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'square';
        const now = ctx.currentTime;
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.exponentialRampToValueAtTime(150, now + 0.08);

        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        oscillator.start(now);
        oscillator.stop(now + 0.08);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Pumpkin explosion sound (scale: size multiplier, default 1 for regular pumpkins)
function playExplosionSound(scale = 1) {
    try {
        const ctx = getAudioContext();

        // Create noise for explosion using multiple oscillators
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.type = 'sawtooth';
        osc2.type = 'square';

        const now = ctx.currentTime;
        // Lower frequency for bigger explosions
        const freq1 = 100 / Math.sqrt(scale);
        const freq2 = 50 / Math.sqrt(scale);
        osc1.frequency.setValueAtTime(freq1, now);
        osc2.frequency.setValueAtTime(freq2, now);

        // Louder and longer for bigger explosions
        const volume = Math.min(0.2 * Math.sqrt(scale), 0.4);
        const duration = 0.6 * Math.sqrt(scale);

        gainNode.gain.setValueAtTime(volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
    } catch (e) {
        console.log('Audio error:', e);
    }

}

// Background music
function startBackgroundMusic() {
    if (backgroundMusicOscillators.length > 0 || bigBossMode) return;
    
    try {
        const ctx = getAudioContext();
        backgroundMusicGain = ctx.createGain();
        backgroundMusicGain.connect(ctx.destination);
        backgroundMusicGain.gain.setValueAtTime(0.03 * volume, ctx.currentTime);

        const melody = [
            { freq: 220, duration: 0.5 },
            { freq: 246.94, duration: 0.5 },
            { freq: 261.63, duration: 0.5 },
            { freq: 293.66, duration: 0.5 },
            { freq: 261.63, duration: 0.5 },
            { freq: 220, duration: 0.5 },
            { freq: 196, duration: 1.0 },
            { freq: 174.61, duration: 1.0 }
        ];

        let time = ctx.currentTime;

        function scheduleNote(noteIndex) {
            if (noteIndex >= melody.length) {
                time = ctx.currentTime;
                setTimeout(() => {
                    if (backgroundMusicGain && !paused && !gameOver && !bigBossMode) {
                        scheduleNote(0);
                    }
                }, 100);
                return;
            }

            const note = melody[noteIndex];
            const osc = ctx.createOscillator();
            osc.connect(backgroundMusicGain);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, time);

            osc.start(time);
            osc.stop(time + note.duration);

            backgroundMusicOscillators.push(osc);

            time += note.duration;
            setTimeout(() => scheduleNote(noteIndex + 1), note.duration * 1000);
        }

        scheduleNote(0);
    } catch (e) {}
}

function stopBackgroundMusic() {
    // Clear arrays immediately so music can restart
    backgroundMusicOscillators = [];

    if (backgroundMusicGain) {
        const ctx = getAudioContext();
        try {
            backgroundMusicGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        } catch (e) {
            // Context might be suspended, just clear
        }
        setTimeout(() => {
            backgroundMusicGain = null;
        }, 500);
    }
}

// Start sizzling sound (for laser melting pumpkins)
function startSizzle() {
    try {
        if (sizzleOscillator) return; // Already playing

        const ctx = getAudioContext();
        sizzleOscillator = ctx.createOscillator();
        sizzleGain = ctx.createGain();

        sizzleOscillator.connect(sizzleGain);
        sizzleGain.connect(ctx.destination);

        sizzleOscillator.type = 'sawtooth';
        sizzleOscillator.frequency.setValueAtTime(80 + Math.random() * 40, ctx.currentTime);

        sizzleGain.gain.setValueAtTime(0.08, ctx.currentTime);

        sizzleOscillator.start();
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Stop sizzling sound
function stopSizzle() {
    try {
        if (sizzleOscillator) {
            const ctx = getAudioContext();
            sizzleGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            sizzleOscillator.stop(ctx.currentTime + 0.1);
            sizzleOscillator = null;
            sizzleGain = null;
        }
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Start spooky boss music (theme: 0-4 for different musical themes)
function startSpookyMusic(theme = 0) {
    try {
        if (spookyMusicOscillators.length > 0) return; // Already playing

        const ctx = getAudioContext();
        spookyMusicGain = ctx.createGain();
        spookyMusicGain.connect(ctx.destination);
        spookyMusicGain.gain.setValueAtTime(0.1, ctx.currentTime);

        // Different spooky melodies based on theme
        const melodies = [
            // Theme 0: Classic spooky (minor descending)
            [
                { freq: 220, duration: 0.5 },  // A3
                { freq: 246.94, duration: 0.5 }, // B3
                { freq: 261.63, duration: 0.5 }, // C4
                { freq: 246.94, duration: 0.5 }, // B3
                { freq: 220, duration: 0.5 },  // A3
                { freq: 196, duration: 0.5 },  // G3
                { freq: 220, duration: 1 }     // A3 (longer)
            ],
            // Theme 1: Ominous rising (building tension)
            [
                { freq: 174.61, duration: 0.6 }, // F3
                { freq: 185, duration: 0.6 },    // F#3
                { freq: 196, duration: 0.6 },    // G3
                { freq: 207.65, duration: 0.6 }, // G#3
                { freq: 220, duration: 0.6 },    // A3
                { freq: 233.08, duration: 0.6 }, // A#3
                { freq: 246.94, duration: 1.2 }  // B3
            ],
            // Theme 2: Dissonant horror (unsettling intervals)
            [
                { freq: 261.63, duration: 0.4 }, // C4
                { freq: 277.18, duration: 0.4 }, // C#4
                { freq: 246.94, duration: 0.4 }, // B3
                { freq: 233.08, duration: 0.4 }, // A#3
                { freq: 261.63, duration: 0.4 }, // C4
                { freq: 220, duration: 0.4 },    // A3
                { freq: 207.65, duration: 0.8 }  // G#3
            ],
            // Theme 3: Lurking danger (slow and ominous)
            [
                { freq: 164.81, duration: 0.8 }, // E3
                { freq: 196, duration: 0.8 },    // G3
                { freq: 174.61, duration: 0.8 }, // F3
                { freq: 155.56, duration: 0.8 }, // D#3
                { freq: 164.81, duration: 1.6 }  // E3
            ],
            // Theme 4: Frantic chase (fast and aggressive)
            [
                { freq: 293.66, duration: 0.3 }, // D4
                { freq: 261.63, duration: 0.3 }, // C4
                { freq: 293.66, duration: 0.3 }, // D4
                { freq: 246.94, duration: 0.3 }, // B3
                { freq: 293.66, duration: 0.3 }, // D4
                { freq: 220, duration: 0.3 },    // A3
                { freq: 293.66, duration: 0.6 }  // D4
            ]
        ];

        const notes = melodies[theme % melodies.length];
        let time = ctx.currentTime;

        function scheduleNote(noteIndex) {
            if (noteIndex >= notes.length) {
                // Loop the melody
                time = ctx.currentTime;
                setTimeout(() => {
                    if (spookyMusicGain) {
                        scheduleNote(0);
                    }
                }, 50);
                return;
            }

            const note = notes[noteIndex];
            const osc = ctx.createOscillator();
            osc.connect(spookyMusicGain);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, time);

            osc.start(time);
            osc.stop(time + note.duration);

            spookyMusicOscillators.push(osc);

            time += note.duration;
            setTimeout(() => scheduleNote(noteIndex + 1), note.duration * 1000);
        }

        scheduleNote(0);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Stop spooky music
function stopSpookyMusic() {
    try {
        if (spookyMusicGain) {
            const ctx = getAudioContext();
            spookyMusicGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            setTimeout(() => {
                spookyMusicOscillators = [];
                spookyMusicGain = null;
            }, 500);
        }
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Power-up collection sound
function playPowerUpSound() {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        const now = ctx.currentTime;
        oscillator.frequency.setValueAtTime(523, now); // C
        oscillator.frequency.setValueAtTime(659, now + 0.05); // E
        oscillator.frequency.setValueAtTime(784, now + 0.1); // G
        oscillator.frequency.setValueAtTime(1047, now + 0.15); // High C

        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        oscillator.start(now);
        oscillator.stop(now + 0.3);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Boss defeat sound
function playBossDefeatSound() {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'triangle';
        const now = ctx.currentTime;
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.setValueAtTime(150, now + 0.2);
        oscillator.frequency.setValueAtTime(100, now + 0.4);
        oscillator.frequency.setValueAtTime(50, now + 0.6);

        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

        oscillator.start(now);
        oscillator.stop(now + 0.8);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// Level complete sound
function playLevelCompleteSound() {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        const now = ctx.currentTime;
        oscillator.frequency.setValueAtTime(523, now); // C
        oscillator.frequency.setValueAtTime(659, now + 0.1); // E
        oscillator.frequency.setValueAtTime(784, now + 0.2); // G
        oscillator.frequency.setValueAtTime(1047, now + 0.3); // High C
        oscillator.frequency.setValueAtTime(1319, now + 0.4); // High E

        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        oscillator.start(now);
        oscillator.stop(now + 0.6);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// High Score Functions
function loadHighScores() {
    const stored = localStorage.getItem('pumpkinInvadersHighScores');
    if (stored) {
        highScores = JSON.parse(stored);
    } else {
        highScores = [];
    }
}

function saveHighScores() {
    localStorage.setItem('pumpkinInvadersHighScores', JSON.stringify(highScores));
}

function isHighScore(newScore) {
    if (highScores.length < 100) return true;
    return newScore > highScores[highScores.length - 1].score;
}

function addHighScore(name, newScore) {
    highScores.push({ name: name, score: newScore });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 100); // Keep only top 100
    saveHighScores();
}

// VIRAL FEATURE: Analytics Functions (Section 2)
function trackEvent(category, action, label, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            'event_category': category,
            'event_label': label,
            'value': value
        });
    }
    console.log(`📊 Analytics: ${category} - ${action} - ${label}:`, value);
}

function trackGameStart() {
    trackEvent('Game', 'start', difficulty, level);
}

function trackGameOver(finalScore, finalLevel) {
    trackEvent('Game', 'game_over', `Score: ${finalScore}`, finalLevel);
}

function trackShare(platform, score) {
    trackEvent('Social', 'share', platform, score);
}

function trackPowerUpCollected(powerUpType) {
    trackEvent('PowerUp', 'collected', powerUpType, 1);
}

// VIRAL FEATURE: Share Functions (Section 3)
function shareToTwitter() {
    const text = `🎃 I just scored ${score} on Pumpkin Invaders! Can you beat it?`;
    const url = 'https://pumpkininvaders.com?challenge=' + btoa(`${score}:${level}`);
    const twitterURL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterURL, '_blank', 'width=550,height=420');
    trackShare('twitter', score);
}

function shareToDiscord() {
    const text = `🎃 I just scored ${score} on Pumpkin Invaders! Can you beat it?\nhttps://pumpkininvaders.com?challenge=${btoa(`${score}:${level}`)}`;
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ Share message copied! Paste it in Discord!');
        trackShare('discord', score);
    });
}

function copyShareLink() {
    const url = 'https://pumpkininvaders.com?challenge=' + btoa(`${score}:${level}`);
    navigator.clipboard.writeText(url).then(() => {
        alert('✅ Link copied to clipboard!');
        trackShare('copy', score);
    });
}

async function downloadScreenshot() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = WIDTH;
    tempCanvas.height = HEIGHT;
    const tempCtx = tempCanvas.getContext('2d');

    // Copy current game frame
    tempCtx.drawImage(canvas, 0, 0);

    // Add score overlay
    tempCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    tempCtx.fillRect(0, HEIGHT - 80 * SCALE, WIDTH, 80 * SCALE);
    tempCtx.fillStyle = '#ff8800';
    tempCtx.font = `bold ${24 * SCALE}px "Courier New"`;
    tempCtx.textAlign = 'center';
    tempCtx.fillText(`🎃 Score: ${score} | Level: ${level} 🎃`, WIDTH/2, HEIGHT - 45 * SCALE);
    tempCtx.font = `${16 * SCALE}px "Courier New"`;
    tempCtx.fillText('pumpkininvaders.com', WIDTH/2, HEIGHT - 20 * SCALE);

    tempCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pumpkin-invaders-${score}.png`;
        a.click();
        URL.revokeObjectURL(url);
        trackShare('screenshot', score);
    });
}

// Make screenshot function globally accessible
window.captureGameScreenshot = downloadScreenshot;

// VIRAL FEATURE: Daily Challenge System (Section 4)
function initDailyChallenge() {
    const today = new Date().toDateString();
    const saved = localStorage.getItem('dailyChallenge');

    if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) {
            dailyChallenge = parsed;
            return;
        }
    }

    // Generate new daily challenge
    const challenges = [
        { type: 'score', name: 'High Roller', desc: 'Score 50,000 points', target: 50000 },
        { type: 'score', name: 'Point Hunter', desc: 'Score 25,000 points', target: 25000 },
        { type: 'survival', name: 'Perfect Run', desc: 'Reach level 10 without losing a life', target: 10 },
        { type: 'survival', name: 'Iron Will', desc: 'Reach level 5 without losing a life', target: 5 },
        { type: 'combo', name: 'Combo King', desc: 'Get a 20x combo', target: 20 },
        { type: 'combo', name: 'Combo Master', desc: 'Get a 15x combo', target: 15 },
        { type: 'level', name: 'Deep Dive', desc: 'Reach level 15', target: 15 },
        { type: 'level', name: 'Marathon', desc: 'Reach level 10', target: 10 }
    ];

    const challenge = challenges[Math.floor(Math.random() * challenges.length)];
    dailyChallenge = {
        active: true,
        type: challenge.type,
        name: challenge.name,
        description: challenge.desc,
        target: challenge.target,
        progress: 0,
        date: today,
        completed: false
    };

    localStorage.setItem('dailyChallenge', JSON.stringify(dailyChallenge));
}

function updateDailyChallenge() {
    if (!dailyChallenge.active || dailyChallenge.completed) return;

    switch(dailyChallenge.type) {
        case 'score':
            dailyChallenge.progress = score;
            if (score >= dailyChallenge.target) {
                completeDailyChallenge();
            }
            break;
        case 'survival':
            // Track level progress, complete if target level reached with no deaths
            dailyChallenge.progress = level;
            if (deaths === 0 && level >= dailyChallenge.target) {
                completeDailyChallenge();
            }
            break;
        case 'combo':
            if (combo >= dailyChallenge.target) {
                completeDailyChallenge();
            }
            break;
        case 'level':
            dailyChallenge.progress = level;
            if (level >= dailyChallenge.target) {
                completeDailyChallenge();
            }
            break;
    }
}

function completeDailyChallenge() {
    dailyChallenge.completed = true;
    localStorage.setItem('dailyChallenge', JSON.stringify(dailyChallenge));
    playHappySound(); // Victory sound
    trackEvent('Challenge', 'completed', dailyChallenge.name, dailyChallenge.progress);
}

function drawDailyChallenge() {
    if (!dailyChallenge.active) return;

    const width = 260 * SCALE;
    const height = 75 * SCALE;
    const x = WIDTH - width - 10 * SCALE; // Position in top-right corner
    const y = 10 * SCALE;

    // Background
    ctx.fillStyle = 'rgba(255, 170, 0, 0.2)';
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);

    // Title
    ctx.fillStyle = '#ffaa00';
    ctx.font = scaledFont(14, 'bold', '"Courier New"');
    ctx.textAlign = 'left';
    ctx.fillText('🏆 DAILY CHALLENGE', x + 10 * SCALE, y + 20 * SCALE);

    // Challenge name
    ctx.font = scaledFont(12, '', '"Courier New"');
    ctx.fillText(dailyChallenge.name, x + 10 * SCALE, y + 38 * SCALE);

    // Progress
    const progressText = dailyChallenge.completed ?
        '✅ COMPLETED!' :
        `Progress: ${dailyChallenge.progress}/${dailyChallenge.target}`;

    ctx.fillStyle = dailyChallenge.completed ? '#00ff00' : '#ffffff';
    ctx.fillText(progressText, x + 10 * SCALE, y + 56 * SCALE);

    ctx.textAlign = 'center'; // Reset
}

// Update game state
function update() {
    if (!gameStarted) return; // Don't update until game is started
    if (paused) return;
    if (gameOver) return;

    // Update combo timer
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) {
            combo = 0;
        }
    }

    // Update particles
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life--;
        return p.life > 0;
    });

    // Update screen shake
    if (screenShake > 0) {
        screenShake *= 0.9;
        if (screenShake < 0.1) screenShake = 0;
    }

    // Handle ship destruction cutscene
    if (shipDestroying) {
        shipDestroyFrame++;

        // Spinning out of control phase (frames 1-40)
        if (shipDestroyFrame <= 40) {
            // Accelerate spin
            shipSpinSpeed += 0.3;
            shipRotation += shipSpinSpeed;
            
            // Spiral motion - move in expanding circles
            const spiralRadius = shipDestroyFrame * 3;
            const spiralSpeed = shipDestroyFrame * 0.15;
            player.x += Math.cos(spiralSpeed) * 4;
            player.y += Math.sin(spiralSpeed) * 4;
            
            // Keep somewhat on screen but erratic
            if (player.x < 50) player.x = 50;
            if (player.x > WIDTH - 50) player.x = WIDTH - 50;
            if (player.y < 50) player.y = 50;
            if (player.y > HEIGHT - 50) player.y = HEIGHT - 50;
            
            // Create smoke trail particles
            if (shipDestroyFrame % 3 === 0) {
                createParticles(player.x, player.y, '#666666', 5);
            }
        }

        // Move to center for final explosion (frames 41-50)
        if (shipDestroyFrame > 40 && shipDestroyFrame <= 50) {
            const targetX = WIDTH / 2;
            const targetY = HEIGHT / 2;
            player.x += (targetX - player.x) * 0.2;
            player.y += (targetY - player.y) * 0.2;
            shipRotation += shipSpinSpeed;
            shipSpinSpeed *= 0.8; // Slow down spin
        }

        // Big explosion at frame 50
        if (shipDestroyFrame === 50) {
            // Create pumpkin bit particles
            for (let i = 0; i < 30; i++) {
                const angle = (Math.PI * 2 * i) / 30;
                const speed = 2 + Math.random() * 4;
                pumpkinBits.push({
                    x: player.x,
                    y: player.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 2, // Upward bias
                    size: 5 + Math.random() * 10,
                    color: Math.random() > 0.5 ? '#ff6600' : '#ff8800',
                    life: 60
                });
            }
        }

        // Update pumpkin bits
        pumpkinBits.forEach(bit => {
            bit.x += bit.vx;
            bit.y += bit.vy;
            bit.vy += 0.3; // Gravity
            bit.life--;
        });

        // Remove dead bits
        pumpkinBits = pumpkinBits.filter(bit => bit.life > 0);

        if (shipDestroyFrame >= 100) { // 1.33 seconds total
            shipDestroying = false;
            shipDestroyFrame = 0;
            shipRotation = 0;
            shipSpinSpeed = 0;
            shield = 100; // Reset shield
            player.x = WIDTH / 2;
            player.y = HEIGHT - (60 * SCALE); // Reset Y position
            player.bullets = [];
            enemyGrenades = [];
            bossProjectiles = [];
            pumpkinBits = []; // Clear pumpkin bits
        }
        return;
    }

    // Handle level complete cutscene
    if (levelComplete) {
        levelCompleteTimer--;
        if (levelCompleteTimer <= 0) {
            levelComplete = false;
            level++;
            pumpkinSpeed += isMobile ? 0.15 : 0.25; // Slower progression for mobile

            // Initialize witch interval on level 4
            if (level === 4 && witchLevelInterval === 0) {
                witchLevelInterval = Math.random() < 0.5 ? 3 : 6;
            }

            // Always initialize the level (boss or pumpkins)
            initPumpkins();

            // Check if witch should appear (only on non-boss regular levels)
            const isBossLevel = level % 3 === 0;
            const levelsSinceWitch = level - lastWitchLevel;
            const shouldSpawnWitch = level >= 4 &&
                                     !isBossLevel &&
                                     witchLevelInterval > 0 &&
                                     levelsSinceWitch >= witchLevelInterval;

            if (shouldSpawnWitch) {
                // Spawn witch alongside pumpkins
                createWitch();
                lastWitchLevel = level;
            }

            updateUI();
        }
        return;
    }

    // Move player
    // Handle movement (keyboard or touch)
    if (isMobile && touchControls.targetX !== null) {
        // Mobile: smooth movement to touch position
        const dx = touchControls.targetX - player.x;
        const moveSpeed = player.speed * 2; // Faster movement on mobile for better responsiveness
        if (Math.abs(dx) > moveSpeed) {
            player.x += Math.sign(dx) * moveSpeed;
        } else {
            player.x = touchControls.targetX;
        }
        // Keep player in bounds
        player.x = Math.max(30 * SCALE, Math.min(WIDTH - (30 * SCALE), player.x));
    } else {
        // Desktop: keyboard controls
        const moveLeft = (keys[keyBindings.left] || touchControls.left) && player.x > (30 * SCALE);
        const moveRight = (keys[keyBindings.right] || touchControls.right) && player.x < WIDTH - (30 * SCALE);

        if (moveLeft) {
            player.x -= player.speed;
        }
        if (moveRight) {
            player.x += player.speed;
        }
    }


    // Auto-shoot on touch for mobile
    if (isMobile && touchControls.shoot && !paused && !gameOver && !shipDestroying && !levelComplete) {
        // Decrement cooldown
        if (autoShootCooldown > 0) {
            autoShootCooldown--;
        }

        // Shoot when cooldown reaches 0
        // Calculate max bullets: 5 base, +2 per level starting at level 30
        // Each clone adds 1 bullet, auto-shoot doubles the limit
        const baseMaxBullets1 = level < 30 ? 5 : 5 + (2 * (level - 29));
        const cloneBonus1 = cloneShips.length;
        let maxBulletsMobile1 = baseMaxBullets1 + cloneBonus1;
        if (activePowerUps.autoshoot.active) {
            maxBulletsMobile1 *= 2;
        }

        const canMainShoot = autoShootCooldown <= 0 &&
                            player.powerUp !== 'laser' &&
                            player.bullets.length < maxBulletsMobile1;

        const canCloneShoot = autoShootCooldown <= 0 &&
                             player.bullets.length < maxBulletsMobile1;

        if (canMainShoot) {
            player.bullets.push({
                x: player.x,
                y: player.y - 20,
                pierce: player.powerUp === 'pierceknife'
            });
        }

        if (canCloneShoot) {
            for (let clone of cloneShips) {
                if (clone.powerUp !== 'laser' && player.bullets.length < maxBulletsMobile1) {
                    player.bullets.push({
                        x: clone.x,
                        y: clone.y - 20,
                        pierce: false
                    });
                }
            }
        }

        if (canMainShoot || canCloneShoot) {
            if (player.powerUp === 'pierceknife') {
                playPierceSound();
            } else {
                playShootSound();
            }

            autoShootCooldown = 15; // Slower auto-shoot for mobile (about 4 shots/sec at 60fps)
        }
    } else if (isMobile && !touchControls.shoot) {
        // Reset cooldown when not shooting so first shot is immediate
        autoShootCooldown = 0;
    }

    // Update bullets
    player.bullets = player.bullets.filter(bullet => {
        bullet.y -= BULLET_SPEED;

        // Check collision with boss projectiles
        for (let i = bossProjectiles.length - 1; i >= 0; i--) {
            const projectile = bossProjectiles[i];
            const dx = bullet.x - projectile.x;
            const dy = bullet.y - projectile.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 25) { // Collision radius
                bossProjectiles.splice(i, 1);
                score += 25;
                updateUI();
                return false; // Remove bullet
            }
        }

        // Check collision with witch
        if (witch && witch.alive && !witch.hit) {
            const halfSize = witch.width / 2;
            if (bullet.x > witch.x - halfSize &&
                bullet.x < witch.x + halfSize &&
                bullet.y > witch.y - halfSize &&
                bullet.y < witch.y + halfSize) {

                witch.hit = true;
                score += 500;
                playHitSound();
                updateUI();

                // Witch drops extra life token
                extraLifeToken = {
                    x: witch.x,
                    y: witch.y
                };

                return false; // Remove bullet
            }
        }

        // Check collision with big boss
        if (bigBossMode && bigBoss && bigBoss.alive && !bigBoss.exploding) {
            const halfSize = bigBoss.width / 2;
            if (bullet.x > bigBoss.x - halfSize &&
                bullet.x < bigBoss.x + halfSize &&
                bullet.y > bigBoss.y - halfSize &&
                bullet.y < bigBoss.y + halfSize) {

                // ARELLA teleportation dodge - increases as health decreases
                if (bigBoss.isArella && !bigBoss.teleporting) {
                    const healthPercent = ((bigBoss.maxDamage - bigBoss.damage) / bigBoss.maxDamage) * 100;
                    let dodgeChance = 0.2; // Default: 1 in 5 (20%)

                    if (healthPercent < 15) {
                        dodgeChance = 0.5; // 1 in 2 (50%)
                    } else if (healthPercent < 30) {
                        dodgeChance = 0.33; // 1 in 3 (33%)
                    } else if (healthPercent < 40) {
                        dodgeChance = 0.25; // 1 in 4 (25%)
                    }

                    if (Math.random() < dodgeChance) {
                        bigBoss.teleporting = true;
                        bigBoss.teleportFrame = 0;
                        // Teleport to random location - much wider range for more dramatic jumps
                        bigBoss.targetX = (Math.random() * (WIDTH - 300)) + 150;
                        bigBoss.targetY = HEIGHT * (0.1 + Math.random() * 0.4); // 10-50% down screen (wider vertical range)
                        return true; // Bullet passes through during teleport
                    }
                }

                // Calculate bullet damage based on level (BOSS LEVELS ONLY - every 3rd level: 3, 6, 9, 12, etc.)
                // Base damage: 1
                // Level 10+: +1 damage (so 2 total)
                // Every 5 levels after 10: +1 damage (level 15: 3, level 20: 4, etc.)
                let bulletDamage = 1;
                if (level >= 10) {
                    bulletDamage = 1 + 1 + Math.floor((level - 10) / 5);
                }

                if (bullet.pierce) {
                    // Pierce: base 5 damage + 2 per scaling tier (boss levels only)
                    const pierceDamage = 5 + (Math.floor((level - 10) / 5) * 2);
                    bigBoss.damage += level >= 10 ? pierceDamage : 5;
                } else {
                    bigBoss.damage += bulletDamage;
                    playHitSound();
                }

                if (bigBoss.damage >= bigBoss.maxDamage) {
                    bigBoss.exploding = true;
                    const bossScale = bigBoss.width / bigBoss.baseSize;
                    playExplosionSound(bossScale);
                    score += 1000;
                    updateUI();

                    // Big boss always drops full shield refill
                    powerUps.push({
                        x: bigBoss.x,
                        y: bigBoss.y,
                        type: 'fullshield'
                    });
                }

                return false; // Remove all bullets after hitting boss (one hit only)
            }
        }

        // Check collision with pumpkins
        let hitPumpkin = false;
        for (let pumpkin of pumpkins) {
            if (pumpkin.alive && !pumpkin.exploding) {
                const halfSize = (pumpkin.width || PUMPKIN_SIZE) / 2;

                if (bullet.x > pumpkin.x - halfSize &&
                    bullet.x < pumpkin.x + halfSize &&
                    bullet.y > pumpkin.y - halfSize &&
                    bullet.y < pumpkin.y + halfSize) {

                    if (bullet.pierce) {
                        // Pierce knife instantly destroys pumpkins
                        pumpkin.damage = pumpkin.maxDamage;
                        hitPumpkin = true;
                    } else {
                        pumpkin.damage++;
                        playHitSound();
                    }

                    if (pumpkin.damage >= pumpkin.maxDamage) {
                        pumpkin.exploding = true;
                        const pumpkinScale = pumpkin.width ? pumpkin.width / PUMPKIN_SIZE : 1;
                        playExplosionSound(pumpkinScale);
                        createParticles(pumpkin.x, pumpkin.y, '#ff6600', 15);
                        addScreenShake(pumpkin.isBoss ? 8 : 3);
                        combo++;
                        comboTimer = 120;
                        const baseScore = pumpkin.isBoss ? 500 : 100;
                        score += baseScore * combo;
                        updateUI();

                        // Drop power-up chance (15% for regular, 50% for boss)
                        const dropChance = pumpkin.isBoss ? 0.5 : 0.15;
                        if (Math.random() < dropChance) {
                            // Filter out pierce if active/on cooldown, and clone if at max (5)
                            let availablePowerUps = POWERUP_TYPES.filter(type => {
                                if (type === 'pierceknife') {
                                    return player.powerUp !== 'pierceknife' && pierceCooldownTimer <= 0;
                                }
                                if (type === 'clone') {
                                    return cloneShips.length < 5;
                                }
                                return true;
                            });

                            // If no power-ups available, allow all
                            if (availablePowerUps.length === 0) {
                                availablePowerUps = POWERUP_TYPES;
                            }

                            const powerUpType = availablePowerUps[Math.floor(Math.random() * availablePowerUps.length)];
                            powerUps.push({
                                x: pumpkin.x,
                                y: pumpkin.y,
                                type: powerUpType
                            });
                        }

                        // Boss splash damage
                        if (pumpkin.isBoss) {
                            const splashRadius = 180 * SCALE; // 3 rows/columns at 60px spacing
                            for (let other of pumpkins) {
                                if (other !== pumpkin && other.alive && !other.exploding) {
                                    const dx = other.x - pumpkin.x;
                                    const dy = other.y - pumpkin.y;
                                    const distance = Math.sqrt(dx * dx + dy * dy);

                                    if (distance < splashRadius) {
                                        other.exploding = true;
                                        score += 50;
                                    }
                                }
                            }
                        }
                    }

                    if (!bullet.pierce) {
                        return false; // Remove normal bullet
                    }
                }
            }
        }

        // Pierce bullets continue through pumpkins
        if (hitPumpkin && bullet.pierce) {
            // Continue to next frame
        }

        return bullet.y > 0; // Keep bullet if still on screen
    });

    // Update enemy grenades
    enemyGrenades = enemyGrenades.filter(grenade => {
        grenade.y += GRENADE_SPEED;

        // Check if any ship has laser and can vaporize this grenade
        const laserWidth = 16;
        const grenadeSize = 10;

        // Check player laser
        if (player.powerUp === 'laser') {
            const playerLaserX = player.x;
            if (grenade.x + grenadeSize / 2 > playerLaserX - laserWidth / 2 &&
                grenade.x - grenadeSize / 2 < playerLaserX + laserWidth / 2 &&
                grenade.y < player.y) {
                playExplosionSound(0.5);
                return false; // Grenade destroyed by laser
            }
        }

        // Check clone lasers
        for (let clone of cloneShips) {
            if (clone.powerUp === 'laser') {
                const cloneLaserX = clone.x;
                if (grenade.x + grenadeSize / 2 > cloneLaserX - laserWidth / 2 &&
                    grenade.x - grenadeSize / 2 < cloneLaserX + laserWidth / 2 &&
                    grenade.y < clone.y) {
                    playExplosionSound();
                    return false; // Grenade destroyed by laser
                }
            }
        }

        // Check collision with clones first
        for (let i = cloneShips.length - 1; i >= 0; i--) {
            const clone = cloneShips[i];
            if (grenade.y >= clone.y - 20 && grenade.y <= clone.y + 20 &&
                grenade.x >= clone.x - 25 && grenade.x <= clone.x + 25) {
                clone.health--;
                const hitsTaken = 4 - clone.health; // Calculate hits (1, 2, or 3)
                playCloneHitSound(hitsTaken);
                if (clone.health <= 0) {
                    cloneShips.splice(i, 1); // Remove this clone
                }
                return false; // Remove grenade
            }
        }

        // Check collision with player
        if (grenade.y >= player.y - 20 && grenade.y <= player.y + 20 &&
            grenade.x >= player.x - 25 && grenade.x <= player.x + 25) {
            shield -= GRENADE_DAMAGE;
            playShieldDamageSound();
            updateUI();
            if (shield <= 0) {
                shield = 0;
                lives--;
                deaths++; // Track deaths for survival challenge
                cloneShips = []; // Remove all clones when a life is lost
                powerUps = []; // Remove all power-ups when a life is lost
                // Reset active power-ups
                player.powerUp = null;
                player.powerUpTimer = 0;
                activePowerUps = {
                    laser: { active: false, timer: 0 },
                    clone: { active: false, timer: 0 },
                    autoshoot: { active: false, timer: 0 },
                    pierceknife: { active: false, timer: 0 }
                };
                if (lives <= 0) {
                    gameOver = true;
                    trackGameOver(score, level); // VIRAL FEATURE: Track game over (Section 11)
                } else {
                    // Trigger ship destruction cutscene
                    shipDestroying = true;
                    shipDestroyFrame = 0;
                    playSadSound();
                    updateUI();
                }
            }
            return false; // Remove grenade
        }

        return grenade.y < HEIGHT; // Keep grenade if still on screen
    });

    // Update boss projectiles
    bossProjectiles = bossProjectiles.filter(projectile => {
        // Curve towards player
        const dx = player.x - projectile.x;
        const dy = player.y - projectile.y;
        const angle = Math.atan2(dy, dx);

        projectile.vx += Math.cos(angle) * 0.15; // Slight homing
        projectile.vy += Math.sin(angle) * 0.15;

        // Apply velocity
        projectile.x += projectile.vx;
        projectile.y += projectile.vy;

        // Check if any ship has laser and can vaporize this projectile
        const laserWidth = 16;
        const projectileSize = 20;

        // Check player laser
        if (player.powerUp === 'laser') {
            const playerLaserX = player.x;
            if (projectile.x + projectileSize / 2 > playerLaserX - laserWidth / 2 &&
                projectile.x - projectileSize / 2 < playerLaserX + laserWidth / 2 &&
                projectile.y < player.y) {
                playExplosionSound(0.7);
                return false; // Projectile destroyed by laser
            }
        }

        // Check clone lasers
        for (let clone of cloneShips) {
            if (clone.powerUp === 'laser') {
                const cloneLaserX = clone.x;
                if (projectile.x + projectileSize / 2 > cloneLaserX - laserWidth / 2 &&
                    projectile.x - projectileSize / 2 < cloneLaserX + laserWidth / 2 &&
                    projectile.y < clone.y) {
                    playExplosionSound();
                    return false; // Projectile destroyed by laser
                }
            }
        }

        // Check collision with clones first
        for (let i = cloneShips.length - 1; i >= 0; i--) {
            const clone = cloneShips[i];
            if (projectile.y >= clone.y - 30 && projectile.y <= clone.y + 30 &&
                projectile.x >= clone.x - 30 && projectile.x <= clone.x + 30) {
                clone.health--;
                const hitsTaken = 4 - clone.health; // Calculate hits (1, 2, or 3)
                playCloneHitSound(hitsTaken);
                if (clone.health <= 0) {
                    cloneShips.splice(i, 1); // Remove this clone
                }
                return false; // Remove projectile
            }
        }

        // Check collision with player
        if (projectile.y >= player.y - 30 && projectile.y <= player.y + 30 &&
            projectile.x >= player.x - 30 && projectile.x <= player.x + 30) {
            shield -= 25; // Boss projectiles do more damage
            playShieldDamageSound();
            updateUI();
            if (shield <= 0) {
                shield = 0;
                lives--;
                deaths++; // Track deaths for survival challenge
                cloneShips = []; // Remove all clones when a life is lost
                powerUps = []; // Remove all power-ups when a life is lost
                // Reset active power-ups
                player.powerUp = null;
                player.powerUpTimer = 0;
                activePowerUps = {
                    laser: { active: false, timer: 0 },
                    clone: { active: false, timer: 0 },
                    autoshoot: { active: false, timer: 0 },
                    pierceknife: { active: false, timer: 0 }
                };
                if (lives <= 0) {
                    gameOver = true;
                    trackGameOver(score, level); // VIRAL FEATURE: Track game over (Section 11)
                } else {
                    // Trigger ship destruction cutscene
                    shipDestroying = true;
                    shipDestroyFrame = 0;
                    playSadSound();
                    updateUI();
                }
            }
            return false; // Remove projectile
        }

        return projectile.y < HEIGHT; // Keep projectile if still on screen
    });

    // Update power-ups
    powerUps = powerUps.filter(powerUp => {
        powerUp.y += POWERUP_FALL_SPEED;

        // Check collision with player or clone ships
        let collected = false;

        if (powerUp.y >= player.y - 30 && powerUp.y <= player.y + 30 &&
            powerUp.x >= player.x - 30 && powerUp.x <= player.x + 30) {
            collected = true;
        }

        // Also check collision with clone ships
        for (let clone of cloneShips) {
            if (powerUp.y >= clone.y - 30 && powerUp.y <= clone.y + 30 &&
                powerUp.x >= clone.x - 30 && powerUp.x <= clone.x + 30) {
                collected = true;
                break;
            }
        }

        if (collected) {
            playPowerUpSound();
            trackPowerUpCollected(powerUp.type); // VIRAL FEATURE: Track power-up collection (Section 12)

            // Activate power-up
            if (powerUp.type === 'shield') {
                // Instant effect - restore shield
                shield = Math.min(100, shield + 50);
                updateUI();
            } else if (powerUp.type === 'fullshield') {
                // Instant effect - restore shield to full and heal existing clones
                shield = 100;

                // Restore all existing clones to full health (doesn't spawn new clones)
                for (let clone of cloneShips) {
                    clone.health = 3;
                }

                updateUI();
            } else if (powerUp.type === 'clone') {
                // Add a new clone ship with 3 health
                const offset = cloneShips.length === 0 ? -60 : 60;
                cloneShips.push({
                    x: player.x + offset,
                    y: player.y,
                    bullets: [],
                    health: 3,
                    powerUp: null, // Can be 'laser' or null
                    powerUpTimer: 0
                });
                // Redistribute power-ups after adding clone
                redistributePowerUps();
            } else if (powerUp.type === 'laser' || powerUp.type === 'pierceknife') {
                // Handle laser/pierce power-up collection
                collectWeaponPowerUp(powerUp.type);
            } else {
                // Timed power-ups (laser, autoshoot, pierceknife)
                activePowerUps[powerUp.type].active = true;
                activePowerUps[powerUp.type].timer = 600; // 10 seconds at 60fps

                // Play laser sound when laser is activated
                if (powerUp.type === 'laser') {
                    playLaserSound();
                }
            }

            return false; // Remove power-up
        }

        return powerUp.y < HEIGHT; // Keep power-up if still on screen
    });

    // Update main ship weapon timer
    if (player.powerUpTimer > 0) {
        player.powerUpTimer--;
        if (player.powerUpTimer <= 0) {
            const expiredPowerUp = player.powerUp;
            player.powerUp = null;

            // When pierce expires, start cooldown
            if (expiredPowerUp === 'pierceknife') {
                let cooldownSeconds = 5;
                if (level > 40) {
                    cooldownSeconds = Math.max(1, 5 - Math.floor((level - 40) / 5));
                }
                pierceCooldownTimer = cooldownSeconds * 60;

                // Move laser from clones to main if available
                for (let clone of cloneShips) {
                    if (clone.powerUp === 'laser' && clone.powerUpTimer > 0) {
                        player.powerUp = 'laser';
                        player.powerUpTimer = clone.powerUpTimer;
                        // Remove laser from all clones
                        for (let c of cloneShips) {
                            c.powerUp = null;
                            c.powerUpTimer = 0;
                        }
                        break;
                    }
                }
            }
        }
    }

    // Update clone weapon timers
    for (let clone of cloneShips) {
        if (clone.powerUpTimer > 0) {
            clone.powerUpTimer--;
            if (clone.powerUpTimer <= 0) {
                clone.powerUp = null;
            }
        }
    }

    // Update non-weapon power-up timers (autoshoot only now)
    if (activePowerUps.autoshoot.active) {
        activePowerUps.autoshoot.timer--;
        if (activePowerUps.autoshoot.timer <= 0) {
            activePowerUps.autoshoot.active = false;
        }
    }

    // Decrement pierce cooldown timer
    if (pierceCooldownTimer > 0) {
        pierceCooldownTimer--;
    }

    // Update clone ships (they last until a life is lost)
    cloneShips.forEach((clone, index) => {
        // Position clones around the player
        const totalClones = cloneShips.length;
        if (totalClones === 1) {
            clone.x = player.x - 60;
        } else {
            const spread = 60;
            const offset = (index - (totalClones - 1) / 2) * spread;
            clone.x = player.x + offset;
        }
        clone.y = player.y;
    });

    // Auto-shoot power-up (doesn't work with laser or pierce - manual weapons only)
    const canAutoShoot = activePowerUps.autoshoot.active &&
                         (player.powerUp !== 'laser') &&
                         (player.powerUp !== 'pierceknife');

    if (canAutoShoot) {
        autoShootCooldown--;
        // Calculate max bullets: 5 base, +2 per level starting at level 30
        // Each clone adds 1 bullet
        const baseMaxBullets2 = level < 30 ? 5 : 5 + (2 * (level - 29));
        const cloneBonus2 = cloneShips.length;
        const maxBulletsMobile2 = (baseMaxBullets2 + cloneBonus2) * 2; // Auto-shoot gets 2x limit
        if (autoShootCooldown <= 0 && player.bullets.length < maxBulletsMobile2) {
            // Main ship auto-shoots (unless it has laser)
            if (player.powerUp !== 'laser') {
                player.bullets.push({
                    x: player.x,
                    y: player.y - 20,
                    pierce: player.powerUp === 'pierceknife'
                });
            }

            // Clone ships auto-shoot too (unless they have laser)
            for (let clone of cloneShips) {
                if (clone.powerUp !== 'laser' && player.bullets.length < maxBulletsMobile2) {
                    player.bullets.push({
                        x: clone.x,
                        y: clone.y - 20,
                        pierce: false
                    });
                }
            }

            // Play shooting sound
            if (player.powerUp === 'pierceknife') {
                playPierceSound();
            } else {
                playShootSound();
            }

            autoShootCooldown = 3; // Shoot 5x faster - every 0.05 seconds
        }
    }

    // Laser beam collision detection (continuous damage)
    // Collect all ships that have laser
    const laserShips = [];
    if (player.powerUp === 'laser') {
        laserShips.push({ x: player.x, y: player.y });
    }
    for (let clone of cloneShips) {
        if (clone.powerUp === 'laser') {
            laserShips.push({ x: clone.x, y: clone.y });
        }
    }

    for (let ship of laserShips) {
        const laserX = ship.x;
        const laserWidth = 16;
        let laserHittingSomething = false;

        // Check collision with big boss
        if (bigBossMode && bigBoss && bigBoss.alive && !bigBoss.exploding) {
            const halfSize = bigBoss.width / 2;
            if (laserX - laserWidth / 2 < bigBoss.x + halfSize &&
                laserX + laserWidth / 2 > bigBoss.x - halfSize) {

                bigBoss.damage += 0.3; // Continuous damage
                laserHittingSomething = true;

                if (bigBoss.damage >= bigBoss.maxDamage) {
                    bigBoss.exploding = true;
                    const bossScale = bigBoss.width / bigBoss.baseSize;
                    playExplosionSound(bossScale);
                    score += 1000;
                    updateUI();

                    // Big boss always drops full shield refill
                    powerUps.push({
                        x: bigBoss.x,
                        y: bigBoss.y,
                        type: 'fullshield'
                    });
                }
            }
        }

        // Check collision with pumpkins
        for (let pumpkin of pumpkins) {
            if (pumpkin.alive && !pumpkin.exploding) {
                const halfSize = (pumpkin.width || PUMPKIN_SIZE) / 2;

                if (laserX - laserWidth / 2 < pumpkin.x + halfSize &&
                    laserX + laserWidth / 2 > pumpkin.x - halfSize &&
                    pumpkin.y < player.y) {

                    pumpkin.damage += 0.05; // Continuous damage
                    laserHittingSomething = true;

                    if (pumpkin.damage >= pumpkin.maxDamage) {
                        pumpkin.exploding = true;
                        const pumpkinScale = pumpkin.width ? pumpkin.width / PUMPKIN_SIZE : 1;
                        playExplosionSound(pumpkinScale);
                        createParticles(pumpkin.x, pumpkin.y, '#ff6600', 15);
                        addScreenShake(pumpkin.isBoss ? 8 : 3);
                        combo++;
                        comboTimer = 120;
                        const baseScore = pumpkin.isBoss ? 500 : 100;
                        score += baseScore * combo;
                        updateUI();

                        // Drop power-up chance (15% for regular, 50% for boss)
                        const dropChance = pumpkin.isBoss ? 0.5 : 0.15;
                        if (Math.random() < dropChance) {
                            // Filter out pierce if active/on cooldown, and clone if at max (5)
                            let availablePowerUps = POWERUP_TYPES.filter(type => {
                                if (type === 'pierceknife') {
                                    return player.powerUp !== 'pierceknife' && pierceCooldownTimer <= 0;
                                }
                                if (type === 'clone') {
                                    return cloneShips.length < 5;
                                }
                                return true;
                            });

                            // If no power-ups available, allow all
                            if (availablePowerUps.length === 0) {
                                availablePowerUps = POWERUP_TYPES;
                            }

                            const powerUpType = availablePowerUps[Math.floor(Math.random() * availablePowerUps.length)];
                            powerUps.push({
                                x: pumpkin.x,
                                y: pumpkin.y,
                                type: powerUpType
                            });
                        }

                        // Boss splash damage
                        if (pumpkin.isBoss) {
                            const splashRadius = 180 * SCALE; // 3 rows/columns at 60px spacing
                            for (let other of pumpkins) {
                                if (other !== pumpkin && other.alive && !other.exploding) {
                                    const dx = other.x - pumpkin.x;
                                    const dy = other.y - pumpkin.y;
                                    const distance = Math.sqrt(dx * dx + dy * dy);

                                    if (distance < splashRadius) {
                                        other.exploding = true;
                                        score += 50;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Control sizzle sound based on laser hits
        if (laserHittingSomething) {
            startSizzle();
        } else {
            stopSizzle();
        }
    }

    // Stop sizzle if no laser ships
    if (laserShips.length === 0) {
        stopSizzle();
    }

    // Update witch
    if (witch && witch.alive) {
        if (witch.hit) {
            // Witch flies away after being hit
            witch.y -= 3 * SCALE;
            if (witch.y < -100 * SCALE) {
                witch.alive = false;
                witch = null;
                // Level continues with pumpkins
            }
        } else {
            // Witch flies back and forth
            witch.x += witch.direction * witch.speed;

            // Reverse direction at edges and increment pass count
            if (witch.x > WIDTH + 100 * SCALE) {
                witch.direction = -1;
                witch.passes++;
            } else if (witch.x < -100 * SCALE && witch.passes > 0) {
                witch.direction = 1;
                witch.passes++;
            }

            // After 5 passes, witch leaves
            if (witch.passes >= witch.maxPasses) {
                witch.alive = false;
                witch = null;
                // Level continues with pumpkins
            }
        }
    }

    // Update extra life token
    if (extraLifeToken) {
        extraLifeToken.y += 2 * SCALE;

        // Check collision with player
        let collected = false;
        const playerDx = player.x - extraLifeToken.x;
        const playerDy = player.y - extraLifeToken.y;
        const playerDistance = Math.sqrt(playerDx * playerDx + playerDy * playerDy);

        if (playerDistance < 30 * SCALE) {
            collected = true;
        }

        // Check collision with clones
        if (!collected) {
            for (let clone of cloneShips) {
                const cloneDx = clone.x - extraLifeToken.x;
                const cloneDy = clone.y - extraLifeToken.y;
                const cloneDistance = Math.sqrt(cloneDx * cloneDx + cloneDy * cloneDy);

                if (cloneDistance < 30 * SCALE) {
                    collected = true;
                    break;
                }
            }
        }

        if (collected) {
            lives++;
            playHappySound();
            extraLifeToken = null;
            updateUI();
        }

        // Remove if off screen
        if (extraLifeToken && extraLifeToken.y > HEIGHT + 50 * SCALE) {
            extraLifeToken = null;
        }
    }

    // Update big boss
    if (bigBossMode && bigBoss) {
        if (bigBoss.exploding) {
            bigBoss.explosionFrame++;
            if (bigBoss.explosionFrame > 15) {
                bigBoss.alive = false;
                // Trigger level complete cutscene
                levelCompleteMessage = 'Level ' + level + ' Complete!\n' + bigBoss.name + ' Defeated!';
                levelComplete = true;
                levelCompleteTimer = 180; // 3 seconds at 60fps

                // Clear all bullets and deactivate all power-ups to prevent damaging next level's enemies
                player.bullets = [];
                for (let clone of cloneShips) {
                    clone.bullets = [];
                }
                // Reset weapon power-ups after boss levels
                player.powerUp = null;
                player.powerUpTimer = 0;
                for (let clone of cloneShips) {
                    clone.powerUp = null;
                    clone.powerUpTimer = 0;
                }
                // Reset auto-shoot
                activePowerUps.autoshoot.active = false;
                activePowerUps.autoshoot.timer = 0;
                autoShootCooldown = 0;

                playBossDefeatSound();
                stopSpookyMusic();
            }
        } else if (bigBoss.alive) {
            // Handle ARELLA teleportation
            if (bigBoss.isArella && bigBoss.teleporting) {
                bigBoss.teleportFrame++;
                if (bigBoss.teleportFrame === 15) {
                    // Mid-teleport - move to new position
                    bigBoss.x = bigBoss.targetX;
                    bigBoss.y = bigBoss.targetY;
                }
                if (bigBoss.teleportFrame >= 30) {
                    // Teleport complete
                    bigBoss.teleporting = false;
                    bigBoss.teleportFrame = 0;
                }
            }

            // Big boss moves slowly side to side and up/down (when not teleporting)
            if (!bigBoss.teleporting) {
                const time = Date.now() / 1000;
                bigBoss.x += Math.sin(time) * 2;
                bigBoss.y += Math.sin(time * 0.7) * 0.8; // Slower vertical oscillation

                // Clamp boss position - can only go halfway off screen horizontally
                const halfBossWidth = bigBoss.width / 2;
                bigBoss.x = Math.max(halfBossWidth, Math.min(WIDTH - halfBossWidth, bigBoss.x));

                // Clamp vertical position to stay in upper half
                bigBoss.y = Math.max(150 * SCALE, Math.min(bigBoss.y, 350 * SCALE));
            }

            // Big boss shooting (gets faster at higher levels)
            bigBoss.shootCooldown--;
            if (bigBoss.shootCooldown <= 0) {
                bossProjectiles.push({
                    x: bigBoss.x,
                    y: bigBoss.y + 60,
                    vx: 0,
                    vy: 2,
                    type: bigBoss.projectileType
                });
                // Shoot faster at higher levels (1.5-3s at level 3, down to 0.5-1.5s at level 30+)
                const maxCooldown = Math.max(30, 90 - (Math.floor(level / 3) * 10));
                const minCooldown = Math.max(15, 90 - (Math.floor(level / 3) * 15));
                bigBoss.shootCooldown = minCooldown + Math.random() * (maxCooldown - minCooldown);
            }

            // Check if big boss reached player
            if (bigBoss.y >= HEIGHT - (200 * SCALE)) {
                shield = 0;
                lives--;
                deaths++; // Track deaths for survival challenge
                cloneShips = []; // Remove all clones when a life is lost
                powerUps = []; // Remove all power-ups when a life is lost
                // Reset active power-ups
                player.powerUp = null;
                player.powerUpTimer = 0;
                activePowerUps = {
                    laser: { active: false, timer: 0 },
                    clone: { active: false, timer: 0 },
                    autoshoot: { active: false, timer: 0 },
                    pierceknife: { active: false, timer: 0 }
                };
                if (lives <= 0) {
                    gameOver = true;
                    trackGameOver(score, level); // VIRAL FEATURE: Track game over (Section 11)
                } else {
                    // Trigger ship destruction cutscene
                    shipDestroying = true;
                    shipDestroyFrame = 0;
                    playSadSound();
                }
                // Reset boss position (move it back up)
                bigBoss.y = 250;
                updateUI();
            }
        }
    } else {
        // Update pumpkins
        let hitEdge = false;
        let allDestroyed = true;

        for (let pumpkin of pumpkins) {
            if (!pumpkin.alive) continue;

            if (pumpkin.exploding) {
                pumpkin.explosionFrame++;
                if (pumpkin.explosionFrame > 10) {
                    pumpkin.alive = false;
                }
            } else {
                allDestroyed = false;

                pumpkin.x += pumpkinDirection * pumpkinSpeed;

                // Edge detection with proper margins
                const edgeMargin = PUMPKIN_SIZE / 2 + (10 * SCALE); // Half pumpkin size plus scaled buffer
                if (pumpkin.x <= edgeMargin || pumpkin.x >= WIDTH - edgeMargin) {
                    hitEdge = true;
                }

                // Pumpkin shooting grenades
                if (pumpkin.canShoot && pumpkin.alive) {
                    pumpkin.shootCooldown--;
                    if (pumpkin.shootCooldown <= 0) {
                        enemyGrenades.push({
                            x: pumpkin.x,
                            y: pumpkin.y + 20
                        });
                        pumpkin.shootCooldown = 120 + Math.random() * 180; // 2-5 seconds at 60fps
                    }
                }

                // Check if pumpkin reached bottom
                if (pumpkin.y >= HEIGHT - (100 * SCALE)) {
                    // Mark all pumpkins as exploding to clear the level
                    for (let p of pumpkins) {
                        if (p.alive) {
                            p.exploding = true;
                            p.explosionFrame = 0;
                        }
                    }

                    shield = 0;
                    lives--;
                    cloneShips = []; // Remove all clones when a life is lost
                powerUps = []; // Remove all power-ups when a life is lost
                // Reset active power-ups
                player.powerUp = null;
                player.powerUpTimer = 0;
                activePowerUps = {
                    laser: { active: false, timer: 0 },
                    clone: { active: false, timer: 0 },
                    autoshoot: { active: false, timer: 0 },
                    pierceknife: { active: false, timer: 0 }
                };
                    if (lives <= 0) {
                        gameOver = true;
                    } else {
                        // Trigger ship destruction cutscene
                        shipDestroying = true;
                        shipDestroyFrame = 0;
                        playSadSound();
                    }
                    updateUI();
                    break; // Exit the loop
                }
            }
        }

        // Move pumpkins down and reverse direction if hit edge
        if (hitEdge) {
            pumpkinDirection *= -1;
            for (let pumpkin of pumpkins) {
                if (pumpkin.alive && !pumpkin.exploding) {
                    pumpkin.y += pumpkinDropDistance;
                }
            }
        }

        // Level complete
        if (allDestroyed) {
            levelCompleteMessage = 'Level ' + level + ' Complete!';
            levelComplete = true;
            levelCompleteTimer = 60; // 1 second at 60fps

            // If witch is still alive, she escapes
            if (witch && witch.alive) {
                witch.alive = false;
                witch = null;
                extraLifeToken = null; // Remove any dropped token
            }

            // Clear all bullets to prevent damaging next level's enemies
            player.bullets = [];
            for (let clone of cloneShips) {
                clone.bullets = [];
            }
            // Keep power-ups active (they persist through regular levels, reset after boss levels)

            playLevelCompleteSound();
        }
    }

    // VIRAL FEATURE: Update daily challenge progress (Section 8)
    updateDailyChallenge();
}

// Draw everything
function draw() {
    try {
        ctx.save();

        // Apply screen shake (only when not paused)
    if (screenShake > 0 && !paused && !showSettings) {
        const shakeX = (Math.random() - 0.5) * screenShake;
        const shakeY = (Math.random() - 0.5) * screenShake;
        ctx.translate(shakeX, shakeY);
    }

    // Clear canvas
    ctx.fillStyle = '#0a0015';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Update and draw parallax starfield
    for (let layer of starLayers) {
        ctx.fillStyle = `rgba(255, 255, 255, ${layer.opacity})`;

        for (let star of layer.stars) {
            // Update star position (move down)
            star.y += layer.speed;

            // Wrap around when star goes off bottom
            if (star.y > HEIGHT) {
                star.y = 0;
                star.x = Math.random() * WIDTH;
            }

            // Draw star
            ctx.fillRect(star.x, star.y, layer.size, layer.size);
        }
    }

    // Draw score in center (behind everything)
    if (!gameOver && !shipDestroying) {
        ctx.save();
        ctx.font = `bold ${48 * SCALE}px "Courier New", monospace`;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.textAlign = 'center';
        ctx.fillText('Score: ' + score, WIDTH / 2, 50 * SCALE);
        ctx.restore();
    }

    // Draw game objects

    // Draw shield bar at very bottom (behind ships in visual layer)
    if (!shipDestroying && !gameOver) {
        const barWidth = 150;
        const barHeight = 15;
        const barX = WIDTH / 2 - barWidth / 2;
        const barY = HEIGHT - 25; // Very bottom of play area
        const shieldPercent = shield / 100;

        // Semi-transparent background
        ctx.fillStyle = 'rgba(34, 34, 34, 0.6)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Smooth color gradient based on shield level (semi-transparent)
        let shieldColor;
        if (shield > 75) {
            shieldColor = 'rgba(0, 255, 0, 0.7)'; // Green
        } else if (shield > 50) {
            shieldColor = 'rgba(136, 255, 0, 0.7)'; // Yellow-green
        } else if (shield > 33) {
            shieldColor = 'rgba(255, 170, 0, 0.7)'; // Orange
        } else if (shield > 15) {
            shieldColor = 'rgba(255, 102, 0, 0.7)'; // Dark orange
        } else {
            shieldColor = 'rgba(255, 0, 0, 0.7)'; // Red
        }

        ctx.fillStyle = shieldColor;
        ctx.fillRect(barX, barY, barWidth * shieldPercent, barHeight);

        // Semi-transparent border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Semi-transparent text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = scaledFont(12);
        ctx.textAlign = 'center';
        ctx.fillText('SHIELD: ' + Math.floor(shield), WIDTH / 2, barY + 12);
    }

    // Draw ship or destruction
    if (shipDestroying) {
        drawShipDestruction();
    } else {
        drawPlayer();
    }

    for (let clone of cloneShips) {
        drawCloneShip(clone);
    }

    // VIRAL FEATURE: Draw daily challenge badge (Section 9)
    drawDailyChallenge();

    // Draw witch if active
    if (witch && witch.alive) {
        drawWitch(witch);
    }

    // Draw extra life token if active
    if (extraLifeToken) {
        drawExtraLifeToken(extraLifeToken);
    }

    // Draw big boss or regular pumpkins
    if (bigBossMode && bigBoss) {
        drawPumpkin(bigBoss);

        // Draw health bar for big boss
        if (bigBoss.alive && !bigBoss.exploding) {
            const barWidth = 200;
            const barHeight = 20;
            const barX = WIDTH / 2 - barWidth / 2;
            const barY = 50;
            const healthRemaining = bigBoss.maxDamage - bigBoss.damage;
            const healthPercent = healthRemaining / bigBoss.maxDamage;

            ctx.fillStyle = '#333333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            ctx.fillStyle = '#ff0000';
            ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(barX, barY, barWidth, barHeight);

            ctx.fillStyle = '#ffffff';
            ctx.font = scaledFont(16, 'bold');
            ctx.textAlign = 'center';
            ctx.shadowColor = bigBoss.color;
            ctx.shadowBlur = 10;
            ctx.fillText(bigBoss.name.toUpperCase(), WIDTH / 2, barY - 10);
            ctx.shadowBlur = 0;
            ctx.font = scaledFont(14);
            ctx.fillText(`${Math.floor(healthRemaining)} / ${bigBoss.maxDamage}`, WIDTH / 2, barY + 15);
        }
    } else {
        for (let pumpkin of pumpkins) {
            drawPumpkin(pumpkin);
        }
    }

    // Draw lasers ON TOP of pumpkins so they burn into them
    // Collect all ships that have laser
    const laserShipsForDrawing = [];
    if (player.powerUp === 'laser') {
        laserShipsForDrawing.push({ x: player.x, y: player.y });
    }
    for (let clone of cloneShips) {
        if (clone.powerUp === 'laser') {
            laserShipsForDrawing.push({ x: clone.x, y: clone.y });
        }
    }

    if (laserShipsForDrawing.length > 0) {
        // Draw laser burn effects on pumpkins first
        const laserPositions = laserShipsForDrawing.map(ship => ship.x);

        // Add burning glow to pumpkins being hit by laser
        if (bigBossMode && bigBoss && bigBoss.alive && !bigBoss.exploding) {
            const halfSize = bigBoss.width / 2;
            for (let laserX of laserPositions) {
                const laserWidth = 16;
                if (laserX - laserWidth / 2 < bigBoss.x + halfSize &&
                    laserX + laserWidth / 2 > bigBoss.x - halfSize) {
                    // Draw bright burning effect on big boss
                    ctx.save();
                    ctx.globalAlpha = 0.6;
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = '#00ffff';
                    ctx.shadowBlur = 30;
                    ctx.beginPath();
                    ctx.arc(bigBoss.x, bigBoss.y, halfSize * 1.1, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }
        }

        for (let pumpkin of pumpkins) {
            if (pumpkin.alive && !pumpkin.exploding) {
                const halfSize = (pumpkin.width || PUMPKIN_SIZE) / 2;
                for (let laserX of laserPositions) {
                    const laserWidth = 16;
                    if (laserX - laserWidth / 2 < pumpkin.x + halfSize &&
                        laserX + laserWidth / 2 > pumpkin.x - halfSize &&
                        pumpkin.y < player.y) {
                        // Draw bright burning effect on pumpkin
                        ctx.save();
                        ctx.globalAlpha = 0.6;
                        ctx.fillStyle = '#ffffff';
                        ctx.shadowColor = '#00ffff';
                        ctx.shadowBlur = 25;
                        ctx.beginPath();
                        ctx.arc(pumpkin.x, pumpkin.y, halfSize * 1.2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }
        }

        // Now draw the lasers on top
        for (let ship of laserShipsForDrawing) {
            drawLaser(ship.x, ship.y);
        }
    }

    for (let bullet of player.bullets) {
        drawBullet(bullet);
    }

    for (let grenade of enemyGrenades) {
        drawGrenade(grenade);
    }

    for (let projectile of bossProjectiles) {
        drawBossProjectile(projectile);
    }

    for (let powerUp of powerUps) {
        drawPowerUp(powerUp);
    }

    // Draw power-up indicators panel
    const panelX = 10;
    const panelY = 10;
    const panelItemHeight = 28;
    let panelHeight = 0;

    // Count active power-ups (per-ship basis)
    let activeCount = 0;
    if (player.powerUp === 'laser') activeCount++;
    if (player.powerUp === 'pierceknife') activeCount++;
    if (cloneShips.some(c => c.powerUp === 'laser')) activeCount++;
    if (cloneShips.length > 0) activeCount++;
    if (activePowerUps.autoshoot.active) activeCount++;

    if (activeCount > 0) {
        panelHeight = activeCount * panelItemHeight + 10;

        // Panel background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(panelX, panelY, 180, panelHeight);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, 180, panelHeight);

        let itemY = panelY + 20;

        // Main ship laser indicator
        if (player.powerUp === 'laser') {
            const timeLeft = Math.ceil(player.powerUpTimer / 60);

            ctx.fillStyle = '#00ffff';
            ctx.font = scaledFont(14, 'bold');
            ctx.textAlign = 'left';
            ctx.fillText('⚡ LASER (Main)', panelX + 10, itemY);

            ctx.fillStyle = '#ffffff';
            ctx.font = scaledFont(12);
            ctx.textAlign = 'right';
            ctx.fillText(timeLeft + 's', panelX + 170, itemY);

            // Time bar
            const barWidth = 150;
            const barX = panelX + 15;
            const barY = itemY + 3;
            const timePercent = player.powerUpTimer / 600;

            ctx.fillStyle = '#003333';
            ctx.fillRect(barX, barY, barWidth, 4);
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(barX, barY, barWidth * timePercent, 4);

            itemY += panelItemHeight;
        }

        // Clone laser indicator
        const laserClones = cloneShips.filter(c => c.powerUp === 'laser');
        if (laserClones.length > 0) {
            const timeLeft = Math.ceil(laserClones[0].powerUpTimer / 60);

            ctx.fillStyle = '#00ff88';
            ctx.font = scaledFont(14, 'bold');
            ctx.textAlign = 'left';
            ctx.fillText('⚡ LASER (Clones)', panelX + 10, itemY);

            ctx.fillStyle = '#ffffff';
            ctx.font = scaledFont(12);
            ctx.textAlign = 'right';
            ctx.fillText(timeLeft + 's', panelX + 170, itemY);

            // Time bar
            const barWidth = 150;
            const barX = panelX + 15;
            const barY = itemY + 3;
            const timePercent = laserClones[0].powerUpTimer / 600;

            ctx.fillStyle = '#003333';
            ctx.fillRect(barX, barY, barWidth, 4);
            ctx.fillStyle = '#00ff88';
            ctx.fillRect(barX, barY, barWidth * timePercent, 4);

            itemY += panelItemHeight;
        }

        // Pierce knife indicator
        if (player.powerUp === 'pierceknife') {
            const timeLeft = Math.ceil(player.powerUpTimer / 60);

            ctx.fillStyle = '#ff00ff';
            ctx.font = scaledFont(14, 'bold');
            ctx.textAlign = 'left';
            ctx.fillText('🔪 PIERCE', panelX + 10, itemY);

            ctx.fillStyle = '#ffffff';
            ctx.font = scaledFont(12);
            ctx.textAlign = 'right';
            ctx.fillText(timeLeft + 's', panelX + 170, itemY);

            // Time bar
            const barWidth = 150;
            const barX = panelX + 15;
            const barY = itemY + 3;
            const timePercent = player.powerUpTimer / 600;

            ctx.fillStyle = '#330033';
            ctx.fillRect(barX, barY, barWidth, 4);
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(barX, barY, barWidth * timePercent, 4);

            itemY += panelItemHeight;
        }

        // Clone indicator
        if (cloneShips.length > 0) {
            ctx.fillStyle = '#00ff88';
            ctx.font = scaledFont(14, 'bold');
            ctx.textAlign = 'left';
            ctx.fillText('🦇 CLONES', panelX + 10, itemY);

            ctx.fillStyle = '#ffffff';
            ctx.font = scaledFont(12);
            ctx.textAlign = 'right';
            ctx.fillText('x' + cloneShips.length, panelX + 170, itemY);

            itemY += panelItemHeight;
        }

        // Auto-shoot indicator
        if (activePowerUps.autoshoot.active) {
            const timeLeft = Math.ceil(activePowerUps.autoshoot.timer / 60);

            ctx.fillStyle = '#ffaa00';
            ctx.font = scaledFont(14, 'bold');
            ctx.textAlign = 'left';
            ctx.fillText('🔫 AUTO', panelX + 10, itemY);

            ctx.fillStyle = '#ffffff';
            ctx.font = scaledFont(12);
            ctx.textAlign = 'right';
            ctx.fillText(timeLeft + 's', panelX + 170, itemY);

            // Time bar
            const barWidth = 150;
            const barX = panelX + 15;
            const barY = itemY + 3;
            const timePercent = activePowerUps.autoshoot.timer / 600;

            ctx.fillStyle = '#332200';
            ctx.fillRect(barX, barY, barWidth, 4);
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(barX, barY, barWidth * timePercent, 4);

            itemY += panelItemHeight;
        }
    }

    // Level complete screen
    if (levelComplete) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = '#00ff00';
        ctx.font = scaledFont(50, 'bold');
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 20 * SCALE;

        // Split message into lines and draw each one
        const lines = levelCompleteMessage.split('\n');
        const lineHeight = 60 * SCALE;
        const startY = HEIGHT / 2 - ((lines.length - 1) * lineHeight / 2);

        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], WIDTH / 2, startY + (i * lineHeight));
        }

        ctx.shadowBlur = 0;
    }

    // High Scores screen
    if (showHighScores) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = '#00ff00';
        ctx.font = scaledFont(40, 'bold');
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 15 * SCALE;
        ctx.fillText('TOP 100 HIGH SCORES', WIDTH / 2, 50);
        ctx.shadowBlur = 0;

        // Display high scores in two columns
        ctx.font = scaledFont(16);
        const startY = 90;
        const columnWidth = WIDTH / 2;

        for (let i = 0; i < Math.min(50, highScores.length); i++) {
            const x = columnWidth / 2;
            const y = startY + (i * 20);
            const rank = i + 1;

            ctx.fillStyle = rank <= 3 ? '#ffaa00' : '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(`${rank}. ${highScores[i].name}`, x + 20, y);
            ctx.textAlign = 'right';
            ctx.fillText(highScores[i].score, x + columnWidth - 40, y);
        }

        for (let i = 50; i < Math.min(100, highScores.length); i++) {
            const x = columnWidth + columnWidth / 2;
            const y = startY + ((i - 50) * 20);
            const rank = i + 1;

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(`${rank}. ${highScores[i].name}`, x + 20, y);
            ctx.textAlign = 'right';
            ctx.fillText(highScores[i].score, x + columnWidth - 40, y);
        }

        ctx.fillStyle = '#ffaa00';
        ctx.font = scaledFont(20);
        ctx.textAlign = 'center';
        if (isMobile) {
            ctx.fillText('Tap to play again', WIDTH / 2, HEIGHT - 20);
        } else {
            ctx.fillText('Press ESC to return', WIDTH / 2, HEIGHT - 20);
        }
    }

    // Name entry screen
    if (enteringName) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = '#00ff00';
        ctx.font = scaledFont(50, 'bold');
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 20 * SCALE;
        ctx.fillText('NEW HIGH SCORE!', WIDTH / 2, HEIGHT / 2 - 100);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#ffffff';
        ctx.font = scaledFont(35);
        ctx.fillText('Score: ' + score, WIDTH / 2, HEIGHT / 2 - 40);

        ctx.fillStyle = '#ffaa00';
        ctx.font = scaledFont(25);
        ctx.fillText('Enter your name:', WIDTH / 2, HEIGHT / 2 + 10);

        // Draw input box
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3 * SCALE;
        ctx.strokeRect(WIDTH / 2 - (150 * SCALE), HEIGHT / 2 + (30 * SCALE), 300 * SCALE, 50 * SCALE);

        // Draw player name
        ctx.fillStyle = '#ffffff';
        ctx.font = scaledFont(30, 'bold');
        ctx.fillText(playerName + '_', WIDTH / 2, HEIGHT / 2 + 65);

        ctx.fillStyle = '#ffaa00';
        ctx.font = scaledFont(18);
        ctx.fillText('Press ENTER when done (max 15 characters)', WIDTH / 2, HEIGHT / 2 + 120);
    }

    // Draw particles
    for (let p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Boss preview
    if (!bigBossMode && !gameOver && level % 3 === 2 && !paused) {
        const alivePumpkins = pumpkins.filter(p => p.alive).length;
        if (alivePumpkins < 5) {
            const nextBossIndex = Math.floor(level / 3);
            const nextBossName = shuffledBossNames[nextBossIndex % shuffledBossNames.length];
            ctx.fillStyle = 'rgba(139, 0, 255, 0.3)';
            ctx.fillRect(0, HEIGHT - 100, WIDTH, 40);
            ctx.fillStyle = '#8b00ff';
            ctx.font = scaledFont(24, 'bold');
            ctx.textAlign = 'center';
            ctx.shadowColor = '#8b00ff';
            ctx.shadowBlur = 15 * SCALE;
            ctx.fillText('⚠️ NEXT: ' + nextBossName.toUpperCase(), WIDTH / 2, HEIGHT - 70);
            ctx.shadowBlur = 0;
        }
    }

    // Low shield warning
    if (shield <= 33 && shield > 0 && !shipDestroying && !paused && !gameOver) {
        const flash = Math.sin(Date.now() / 100) > 0;
        if (flash) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
        }
    }

    // Draw combo counter
    if (combo > 1 && !paused && !gameOver) {
        ctx.fillStyle = '#ffff00';
        ctx.font = scaledFont(30, 'bold');
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 10;
        ctx.fillText(combo + 'x COMBO!', WIDTH / 2, 100);
        ctx.shadowBlur = 0;
    }

    // Settings screen
    if (showSettings) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = '#00ff00';
        ctx.font = scaledFont(40, 'bold');
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 15 * SCALE;
        ctx.fillText('SETTINGS', WIDTH / 2, 80);
        ctx.shadowBlur = 0;

        ctx.font = scaledFont(24);
        ctx.fillStyle = '#ffffff';
        let y = 150;

        ctx.fillText('Difficulty: ' + difficulty.toUpperCase(), WIDTH / 2, y);
        ctx.fillStyle = '#ffaa00';
        ctx.font = scaledFont(18);
        ctx.fillText('(Press D to change)', WIDTH / 2, y + 25);
        y += 80;

        ctx.fillStyle = '#ffffff';
        ctx.font = scaledFont(24);
        ctx.fillText('Volume: ' + Math.round(volume * 100) + '%', WIDTH / 2, y);
        ctx.fillStyle = '#ffaa00';
        ctx.font = scaledFont(18);
        ctx.fillText('(Press +/- to adjust)', WIDTH / 2, y + 25);
        y += 80;

        ctx.fillStyle = '#ffffff';
        ctx.font = scaledFont(24);
        ctx.fillText('Colorblind Mode: ' + (colorblindMode ? 'ON' : 'OFF'), WIDTH / 2, y);
        ctx.fillStyle = '#ffaa00';
        ctx.font = scaledFont(18);
        ctx.fillText('(Press C to toggle)', WIDTH / 2, y + 25);
        y += 100;

        ctx.fillStyle = '#ffaa00';
        ctx.font = scaledFont(20);
        ctx.fillText('Press S to close settings', WIDTH / 2, y);
    }

    // Pause screen
    if (paused && !showSettings) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = '#00ff00';
        ctx.font = scaledFont(60, 'bold');
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 20 * SCALE;
        ctx.fillText('PAUSED', WIDTH / 2, HEIGHT / 2 - 30);
        ctx.shadowBlur = 0;

        ctx.font = scaledFont(25);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Press P to resume', WIDTH / 2, HEIGHT / 2 + 30);
        ctx.fillText('Press S for Settings', WIDTH / 2, HEIGHT / 2 + 70);
    }

    // Game over screen
    if (gameOver && !enteringName && !showHighScores) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = '#ff6600';
        ctx.font = scaledFont(60, 'bold');
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', WIDTH / 2, HEIGHT / 2 - 30);

        ctx.font = scaledFont(30);
        ctx.fillText('Final Score: ' + score, WIDTH / 2, HEIGHT / 2 + 30);

        if (isMobile) {
            ctx.font = scaledFont(25);
            ctx.fillStyle = '#ffaa00';
            ctx.fillText('Tap to continue', WIDTH / 2, HEIGHT / 2 + 90);
        } else {
            ctx.font = scaledFont(20);
            ctx.fillText('Press ENTER to restart', WIDTH / 2, HEIGHT / 2 + 80);
            ctx.fillText('Press H to view High Scores', WIDTH / 2, HEIGHT / 2 + 110);
        }
    }

    // Draw touch control UI for mobile - show movement indicator
    if (isMobile && !paused && !gameOver && touchControls.targetX !== null) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(touchControls.targetX, HEIGHT - (40 * SCALE), 30 * SCALE, 0, Math.PI * 2);
        ctx.fill();

        // Draw arrow pointing to ship
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#00ff00';
        ctx.font = scaledFont(40, 'bold');
        ctx.textAlign = 'center';
        ctx.fillText('▲', touchControls.targetX, HEIGHT - (25 * SCALE));

        ctx.globalAlpha = 1.0;
    }

    // Draw start/pause button overlay
    if (!gameStarted || (paused && !showSettings && !gameOver)) {
        // Semi-transparent dark overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        // Draw pumpkin-shaped button in center
        const buttonCenterX = WIDTH / 2;
        const buttonCenterY = HEIGHT / 2;
        const pumpkinSize = 100;

        // Pumpkin body (orange circle)
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(buttonCenterX, buttonCenterY, pumpkinSize, 0, Math.PI * 2);
        ctx.fill();

        // Pumpkin ridges
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 3;
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(buttonCenterX + (i * 21), buttonCenterY - pumpkinSize);
            ctx.lineTo(buttonCenterX + (i * 21), buttonCenterY + pumpkinSize);
            ctx.stroke();
        }

        // Pumpkin stem
        ctx.fillStyle = '#228b22';
        ctx.fillRect(buttonCenterX - 12, buttonCenterY - pumpkinSize - 18, 24, 20);

        // Button text centered on the pumpkin with strong black shadow
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        if (!gameStarted) {
            ctx.font = scaledFont(72, 'bold'); // Tripled from 24
            ctx.fillText('CARVE', buttonCenterX, buttonCenterY - 25);
            ctx.fillText('PUMPKINS!', buttonCenterX, buttonCenterY + 35);
        } else if (paused) {
            ctx.font = scaledFont(54, 'bold'); // Tripled from 18
            ctx.fillText('PAUSED', buttonCenterX, buttonCenterY - 35);
            ctx.font = scaledFont(66, 'bold'); // Tripled from 22
            ctx.fillText('CARVE', buttonCenterX, buttonCenterY + 10);
            ctx.fillText('PUMPKINS!', buttonCenterX, buttonCenterY + 55);
        }

        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.textBaseline = 'alphabetic'; // Reset to default
    }

    } catch (error) {
        console.error('Draw function error:', error);
    } finally {
        // Always restore canvas state
        ctx.restore();
    }
}


// Touch controls for mobile - Multi-touch support
if (isMobile) {
    // Canvas is now only for movement control - entire canvas can be used
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();

        // Handle start button tap
        if (!gameStarted || (paused && !showSettings && !gameOver)) {
            unlockAudioContext();
            const wasUnpausing = paused; // Track if we're unpausing
            gameStarted = true;
            paused = false;

            // Resume audio context if it was suspended, then restart music
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    if (wasUnpausing) {
                        // Clear any stale music state
                        backgroundMusicOscillators = [];
                        backgroundMusicGain = null;
                        spookyMusicOscillators = [];
                        spookyMusicGain = null;

                        if (!bigBossMode) {
                            startBackgroundMusic();
                        } else if (bigBoss && bigBoss.alive) {
                            // Restart boss music if we're in a boss fight
                            const bossIndex = Math.floor((level / 3) - 1);
                            const musicTheme = bossIndex % 5;
                            startSpookyMusic(musicTheme);
                        }
                    }
                });
            } else if (wasUnpausing) {
                // Context wasn't suspended, just restart music
                backgroundMusicOscillators = [];
                backgroundMusicGain = null;
                spookyMusicOscillators = [];
                spookyMusicGain = null;

                if (!bigBossMode) {
                    startBackgroundMusic();
                } else if (bigBoss && bigBoss.alive) {
                    const bossIndex = Math.floor((level / 3) - 1);
                    const musicTheme = bossIndex % 5;
                    startSpookyMusic(musicTheme);
                }
            }
            return;
        }

        // Handle high scores dismissal - show start button instead of auto-restart
        if (showHighScores) {
            showHighScores = false;
            gameOver = false; // End game over state
            gameStarted = false; // Show start button
            return;
        }

        // Handle game over tap to continue
        if (gameOver && !enteringName && !showHighScores) {
            // Check if this is a high score
            if (isHighScore(score)) {
                // Use native prompt for mobile name entry
                const name = prompt('NEW HIGH SCORE!\nScore: ' + score + '\n\nEnter your name:', '');
                if (name !== null) { // Allow empty string
                    playerName = name.slice(0, 15); // Limit to 15 characters
                    addHighScore(playerName || 'Anonymous', score, 'mobile');
                }
                showHighScores = true;
            } else {
                showHighScores = true;
            }
            return;
        }

        // Handle tap to restart from high scores
        if (showHighScores) {
            // Restart game
            score = 0;
            lives = 3;
            shield = 100;
            level = 1;
            deaths = 0;
            gameOver = false;
            shipDestroying = false;
            shipDestroyFrame = 0;
            shipRotation = 0;
            shipSpinSpeed = 0;
            levelComplete = false;
            levelCompleteTimer = 0;
            levelCompleteMessage = '';
            showHighScores = false;
            enteringName = false;
            playerName = '';
            pumpkinSpeed = (isMobile ? 0.5 : 1) * SCALE;
            bigBossMode = false;
            bigBoss = null;
            witch = null;
            extraLifeToken = null;
            witchLevelInterval = 0;
            lastWitchLevel = 0;
            player.x = WIDTH / 2;
            player.y = HEIGHT - (60 * SCALE);
            player.bullets = [];
            enemyGrenades = [];
            bossProjectiles = [];
            powerUps = [];
            cloneShips = [];
            pumpkinBits = [];
            autoShootCooldown = 0;
            pierceCooldownTimer = 0;
            activePowerUps = {
                laser: { active: false, timer: 0 },
                clone: { active: false, timer: 0 },
                autoshoot: { active: false, timer: 0 },
                pierceknife: { active: false, timer: 0 }
            };
            shuffleBossNames();
            initPumpkins();
            updateUI();
            return;
        }

        // Process all new touches on canvas - first touch for movement, second for shooting
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // Store touch info
            activeTouches.set(touch.identifier, { x, y });

            // First touch is for movement
            if (touchControls.movementTouchId === null) {
                touchControls.movementTouchId = touch.identifier;
                touchControls.targetX = x;
            }
            // Second touch is for shooting (multi-touch support)
            else if (touchControls.shootTouchId === null) {
                touchControls.shootTouchId = touch.identifier;
                touchControls.shoot = true;
            }
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();

        // Update all moving touches
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // Update stored position
            if (activeTouches.has(touch.identifier)) {
                activeTouches.set(touch.identifier, { x, y });
            }

            // If this is the movement touch, update target position
            if (touch.identifier === touchControls.movementTouchId) {
                touchControls.targetX = x;
            }
        }
    });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();

        // Process all ended touches
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            // Remove from active touches
            activeTouches.delete(touch.identifier);

            // Clear movement if this was the movement touch
            if (touch.identifier === touchControls.movementTouchId) {
                touchControls.movementTouchId = null;
                touchControls.targetX = null;
            }

            // Clear shooting if this was the shoot touch
            if (touch.identifier === touchControls.shootTouchId) {
                touchControls.shootTouchId = null;
                touchControls.shoot = false;
            }
        }
    });

    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();

        // Handle cancelled touches the same as touchend
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            activeTouches.delete(touch.identifier);

            if (touch.identifier === touchControls.movementTouchId) {
                touchControls.movementTouchId = null;
                touchControls.targetX = null;
            }

            if (touch.identifier === touchControls.shootTouchId) {
                touchControls.shootTouchId = null;
                touchControls.shoot = false;
            }
        }
    });

    // Fire button controls (separate element above canvas)
    const fireButton = document.getElementById('fireButton');
    if (fireButton) {
        fireButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touchControls.shoot = true;
            // Visual feedback - button press effect
            fireButton.style.transform = 'scale(0.95)';
            fireButton.style.opacity = '0.8';
        });

        fireButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            touchControls.shoot = false;
            // Reset visual state
            fireButton.style.transform = 'scale(1)';
            fireButton.style.opacity = '1';
        });

        fireButton.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            touchControls.shoot = false;
            // Reset visual state
            fireButton.style.transform = 'scale(1)';
            fireButton.style.opacity = '1';
        });
    }
}

// Visibility change detection for pause/resume
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden (app backgrounded, tab switched, phone locked)
        if (gameStarted && !gameOver) {
            paused = true;
        }
        // Suspend audio context to save resources
        if (audioContext && audioContext.state === 'running') {
            audioContext.suspend();
        }
    } else {
        // Page is visible again - audio will resume when user taps to unpause
        // Don't auto-resume - wait for user to tap the button
    }
});

// Game loop
function gameLoop() {
    try {
        update();
        draw();
    } catch (error) {
        console.error('Game loop error:', error);
        // Continue the game loop even if there's an error
    }
    requestAnimationFrame(gameLoop);
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('level').textContent = level;
}

// Input handling
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    // Check if any shoot key is pressed
    if (keyBindings.shoot.includes(e.key)) {
        e.preventDefault();
        // Calculate max bullets: 5 base, +2 per level starting at level 30
        // Each clone adds 1 bullet, auto-shoot doubles the limit
        const baseMaxBullets3 = level < 30 ? 5 : 5 + (2 * (level - 29));
        const cloneBonus3 = cloneShips.length;
        let maxBulletsMobile3 = baseMaxBullets3 + cloneBonus3;
        if (activePowerUps.autoshoot.active) {
            maxBulletsMobile3 *= 2;
        }

        const canMainShoot = !gameOver && !shipDestroying && !levelComplete &&
                            player.powerUp !== 'laser' &&
                            player.bullets.length < maxBulletsMobile3;

        const canCloneShoot = !gameOver && !shipDestroying && !levelComplete &&
                             player.bullets.length < maxBulletsMobile3;

        if (canMainShoot) {
            player.bullets.push({
                x: player.x,
                y: player.y - 20,
                pierce: player.powerUp === 'pierceknife'
            });
        }

        if (canCloneShoot) {
            // Clone ships shoot too (unless they have laser)
            for (let clone of cloneShips) {
                if (clone.powerUp !== 'laser' && player.bullets.length < maxBulletsMobile3) {
                    player.bullets.push({
                        x: clone.x,
                        y: clone.y - 20,
                        pierce: false
                    });
                }
            }
        }

        // Play shooting sound if any ship shot
        if (canMainShoot || canCloneShoot) {
            if (player.powerUp === 'pierceknife') {
                playPierceSound();
            } else {
                playShootSound();
            }
        }
    }

    // Name entry input
    if (enteringName) {
        if (e.key === 'Enter') {
            if (playerName.length > 0) {
                // Save high score
                addHighScore(playerName, score);
                enteringName = false;
                playerName = '';
                showHighScores = true; // Show high scores after entering name
            }
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            playerName = playerName.slice(0, -1);
        } else if (e.key.length === 1 && playerName.length < 15) {
            // Only add printable characters
            if (e.key.match(/^[a-zA-Z0-9 ]$/)) {
                playerName += e.key;
            }
        }
        return;
    }

    // High score viewing
    if (e.key === 'Escape' && showHighScores) {
        showHighScores = false;
        return;
    }

    if (e.key === 'h' || e.key === 'H') {
        if (gameOver && !enteringName) {
            showHighScores = !showHighScores;
        }
        return;
    }

    if (showSettings) {
        if (e.key === 's' || e.key === 'S') {
            showSettings = false;
            return;
        }
        if (e.key === 'd' || e.key === 'D') {
            const difficulties = ['easy', 'normal', 'hard'];
            const currentIndex = difficulties.indexOf(difficulty);
            difficulty = difficulties[(currentIndex + 1) % difficulties.length];
            return;
        }
        if (e.key === '+' || e.key === '=') {
            volume = Math.min(1, volume + 0.1);
            return;
        }
        if (e.key === '-' || e.key === '_') {
            volume = Math.max(0, volume - 0.1);
            return;
        }
        if (e.key === 'c' || e.key === 'C') {
            colorblindMode = !colorblindMode;
            return;
        }
        return;
    }

    if (e.key === 's' || e.key === 'S') {
        if (paused && !showSettings) {
            showSettings = true;
            stopSizzle();
            return;
        }
    }

    if (e.key === keyBindings.pause || e.key === keyBindings.pause.toUpperCase()) {
        paused = !paused;
        if (paused) {
            stopBackgroundMusic();
            stopSpookyMusic();
            stopSizzle();
        } else {
            if (!bigBossMode) {
                startBackgroundMusic();
            } else if (bigBoss && bigBoss.alive) {
                // Restart boss music if we're in a boss fight
                const bossIndex = Math.floor((level / 3) - 1);
                const musicTheme = bossIndex % 5;
                startSpookyMusic(musicTheme);
            }
        }
        return;
    }

    if (e.key === 'Enter' && gameOver && !enteringName && !showHighScores) {
        // Check if it's a high score first
        if (isHighScore(score)) {
            enteringName = true;
            playerName = '';
        } else {
            // Restart game
            score = 0;
            lives = 3;
            shield = 100;
            level = 1;
            deaths = 0;
            gameOver = false;
            shipDestroying = false;
            shipDestroyFrame = 0;
            shipRotation = 0;
            shipSpinSpeed = 0;
            levelComplete = false;
            levelCompleteTimer = 0;
            levelCompleteMessage = '';
            showHighScores = false;
            enteringName = false;
            playerName = '';
            pumpkinSpeed = (isMobile ? 0.5 : 1) * SCALE;
            bigBossMode = false;
            bigBoss = null;
            witch = null;
            extraLifeToken = null;
            witchLevelInterval = 0;
            lastWitchLevel = 0;
            player.x = WIDTH / 2;
            player.y = HEIGHT - (60 * SCALE);
            player.bullets = [];
            enemyGrenades = [];
            bossProjectiles = [];
            powerUps = [];
            cloneShips = [];
            pumpkinBits = [];
            autoShootCooldown = 0;
            pierceCooldownTimer = 0;
            activePowerUps = {
                laser: { active: false, timer: 0 },
                clone: { active: false, timer: 0 },
                autoshoot: { active: false, timer: 0 },
                pierceknife: { active: false, timer: 0 }
            };
            shuffleBossNames();
            initPumpkins();
            updateUI();
        }
    }

    // Allow restarting from high score screen
    if (e.key === 'Enter' && showHighScores) {
        // Restart game
        score = 0;
        lives = 3;
        shield = 100;
        level = 1;
        deaths = 0;
        gameOver = false;
        shipDestroying = false;
        shipDestroyFrame = 0;
        levelComplete = false;
        levelCompleteTimer = 0;
        levelCompleteMessage = '';
        showHighScores = false;
        enteringName = false;
        playerName = '';
        pumpkinSpeed = (isMobile ? 0.5 : 1) * SCALE;
        bigBossMode = false;
        bigBoss = null;
        player.x = WIDTH / 2;
        player.y = HEIGHT - (60 * SCALE);
        player.bullets = [];
        enemyGrenades = [];
        bossProjectiles = [];
        powerUps = [];
        cloneShips = [];
        pumpkinBits = [];
        autoShootCooldown = 0;
        pierceCooldownTimer = 0;
        activePowerUps = {
            laser: { active: false, timer: 0 },
            clone: { active: false, timer: 0 },
            autoshoot: { active: false, timer: 0 },
            pierceknife: { active: false, timer: 0 }
        };
        shuffleBossNames();
        initPumpkins();
        updateUI();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Initialize and start game
loadHighScores();
shuffleBossNames();
initPumpkins();
updateUI();
startBackgroundMusic();
gameLoop();

// VIRAL FEATURE: Initialize viral features on load (Section 10)
window.addEventListener('load', () => {
    initDailyChallenge();

    // Check for share challenge
    const params = new URLSearchParams(window.location.search);
    const challenge = params.get('challenge');
    if (challenge) {
        try {
            const [challengeScore, challengeLevel] = atob(challenge).split(':').map(Number);
            shareableScore.challengeMode = true;
            shareableScore.challengeScore = challengeScore;
            shareableScore.challengeLevel = challengeLevel;

            alert(`🎃 CHALLENGE MODE ACTIVATED!\n\nBeat ${challengeScore} points to win!\n\nGood luck! 👻`);
            trackEvent('Game', 'challenge_accepted', `${challengeScore}`, challengeLevel);
        } catch (e) {
            console.error('Invalid challenge URL');
        }
    }

    // Track game start
    trackGameStart();

    // Update share timestamp
    shareableScore.timestamp = Date.now();
});
