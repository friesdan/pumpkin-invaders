// ========================================
// PUMPKIN INVADERS - VIRAL FEATURES ADD-ON
// ========================================
// Copy these sections into your existing game.js file
// Follow the instructions for where to place each section

// ============================================
// SECTION 1: ADD AT TOP (after line ~45)
// Place this after your existing global variables
// ============================================

// Viral Features - Daily Challenges
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

// Share tracking
let shareableScore = {
    score: 0,
    level: 0,
    timestamp: Date.now(),
    challengeMode: false,
    challengeScore: 0,
    challengeLevel: 0
};

// ============================================
// SECTION 2: ANALYTICS FUNCTIONS
// Add these functions anywhere in your file
// ============================================

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

// ============================================
// SECTION 3: SHARE FUNCTIONS
// Add these functions anywhere in your file
// ============================================

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
    tempCtx.fillRect(0, HEIGHT - 80, WIDTH, 80);
    tempCtx.fillStyle = '#ff8800';
    tempCtx.font = 'bold 24px "Courier New"';
    tempCtx.textAlign = 'center';
    tempCtx.fillText(`🎃 Score: ${score} | Level: ${level} 🎃`, WIDTH/2, HEIGHT - 45);
    tempCtx.font = '16px "Courier New"';
    tempCtx.fillText('pumpkininvaders.com', WIDTH/2, HEIGHT - 20);
    
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

// ============================================
// SECTION 4: DAILY CHALLENGE SYSTEM
// Add these functions anywhere in your file
// ============================================

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
            if (lives === 3 && level >= dailyChallenge.target) {
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
    playSound(880, 0.3, 'sine'); // Victory sound
    trackEvent('Challenge', 'completed', dailyChallenge.name, dailyChallenge.progress);
}

function drawDailyChallenge() {
    if (!dailyChallenge.active) return;
    
    const x = 10;
    const y = 10;
    const width = 260;
    const height = 75;
    
    // Background
    ctx.fillStyle = 'rgba(255, 170, 0, 0.2)';
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    
    // Title
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 14px "Courier New"';
    ctx.textAlign = 'left';
    ctx.fillText('🏆 DAILY CHALLENGE', x + 10, y + 20);
    
    // Challenge name
    ctx.font = '12px "Courier New"';
    ctx.fillText(dailyChallenge.name, x + 10, y + 38);
    
    // Progress
    const progressText = dailyChallenge.completed ? 
        '✅ COMPLETED!' : 
        `Progress: ${dailyChallenge.progress}/${dailyChallenge.target}`;
    
    ctx.fillStyle = dailyChallenge.completed ? '#00ff00' : '#ffffff';
    ctx.fillText(progressText, x + 10, y + 56);
    
    ctx.textAlign = 'center'; // Reset
}

// ============================================
// SECTION 5: ENHANCED GAME OVER SCREEN
// REPLACE your existing drawGameOver() function with this one
// ============================================

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 60px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', WIDTH/2, HEIGHT/2 - 120);
    
    ctx.fillStyle = '#ff8800';
    ctx.font = '30px "Courier New"';
    ctx.fillText(`Final Score: ${score}`, WIDTH/2, HEIGHT/2 - 50);
    ctx.fillText(`Level Reached: ${level}`, WIDTH/2, HEIGHT/2 - 10);
    
    // Check if beat challenge
    if (shareableScore.challengeMode && score > shareableScore.challengeScore) {
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 24px "Courier New"';
        ctx.fillText('🏆 CHALLENGE BEATEN! 🏆', WIDTH/2, HEIGHT/2 + 30);
    }
    
    // Share buttons
    ctx.fillStyle = '#4a90e2';
    ctx.fillRect(WIDTH/2 - 180, HEIGHT/2 + 70, 120, 40);
    ctx.fillStyle = '#7289da';
    ctx.fillRect(WIDTH/2 - 50, HEIGHT/2 + 70, 120, 40);
    ctx.fillStyle = '#1da1f2';
    ctx.fillRect(WIDTH/2 + 80, HEIGHT/2 + 70, 120, 40);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "Courier New"';
    ctx.fillText('📸 Screenshot', WIDTH/2 - 120, HEIGHT/2 + 96);
    ctx.fillText('💬 Discord', WIDTH/2 + 10, HEIGHT/2 + 96);
    ctx.fillText('🐦 Twitter', WIDTH/2 + 140, HEIGHT/2 + 96);
    
    // Instructions
    ctx.fillStyle = '#ffaa00';
    ctx.font = '20px "Courier New"';
    ctx.fillText('Press H for High Scores', WIDTH/2, HEIGHT/2 + 150);
    
    ctx.fillStyle = '#888888';
    ctx.font = '18px "Courier New"';
    ctx.fillText('Press ENTER to restart', WIDTH/2, HEIGHT/2 + 190);
    ctx.fillText('S=Screenshot | T=Twitter | D=Discord | C=Copy Link', WIDTH/2, HEIGHT/2 + 220);
}

// ============================================
// SECTION 6: CLICK HANDLER FOR SHARE BUTTONS
// Add this event listener near your other event listeners
// ============================================

canvas.addEventListener('click', (e) => {
    if (!gameOver) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking share buttons
    const buttonY = HEIGHT/2 + 70;
    if (y >= buttonY && y <= buttonY + 40) {
        if (x >= WIDTH/2 - 180 && x <= WIDTH/2 - 60) {
            // Screenshot button
            downloadScreenshot();
        } else if (x >= WIDTH/2 - 50 && x <= WIDTH/2 + 70) {
            // Discord button
            shareToDiscord();
        } else if (x >= WIDTH/2 + 80 && x <= WIDTH/2 + 200) {
            // Twitter button
            shareToTwitter();
        }
    }
});

// ============================================
// SECTION 7: ADD TO YOUR EXISTING KEYDOWN HANDLER
// Find your existing document.addEventListener('keydown', ...) 
// and ADD these lines inside it
// ============================================

// Add these INSIDE your existing keydown event listener:
if (gameOver) {
    if (e.key === 's' || e.key === 'S') {
        downloadScreenshot();
    }
    if (e.key === 't' || e.key === 'T') {
        shareToTwitter();
    }
    if (e.key === 'd' || e.key === 'D') {
        shareToDiscord();
    }
    if (e.key === 'c' || e.key === 'C') {
        copyShareLink();
    }
}

// ============================================
// SECTION 8: ADD TO YOUR update() FUNCTION
// Find your update() function and ADD this line near the end
// ============================================

// Add this line inside your update() function, near the end:
updateDailyChallenge();

// ============================================
// SECTION 9: ADD TO YOUR draw() FUNCTION
// Find your draw() function and ADD this line
// ============================================

// Add this line inside your draw() function, AFTER drawing the player:
drawDailyChallenge();

// ============================================
// SECTION 10: INITIALIZATION CODE
// Add this at the VERY BOTTOM of your game.js file
// ============================================

// Initialize viral features on load
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

// ============================================
// SECTION 11: UPDATE YOUR GAME OVER HANDLING
// Find where you set gameOver = true and ADD this line
// ============================================

// When gameOver is set to true, also call:
trackGameOver(score, level);

// ============================================
// SECTION 12: TRACK POWER-UP COLLECTION
// Find where power-ups are collected and ADD this line
// ============================================

// When a power-up is collected, add:
// trackPowerUpCollected(powerUpType);
// (Replace powerUpType with the actual type like 'laser', 'shield', etc.)

// ============================================
// 🎉 INTEGRATION COMPLETE!
// ============================================
// 
// Once you've added all these sections, your game will have:
// ✅ Screenshot sharing
// ✅ Social media share buttons
// ✅ Daily challenges
// ✅ Challenge mode (beat a friend)
// ✅ Analytics tracking
// ✅ Click handlers for share buttons
// ✅ Keyboard shortcuts for sharing
//
// TEST EVERYTHING:
// 1. Play game until game over
// 2. Click share buttons
// 3. Press S, T, D, C keys
// 4. Check for daily challenge badge
// 5. Look for errors in console (F12)
//
// NEXT STEPS:
// 1. Deploy to your website
// 2. Test on mobile
// 3. Share with 5 friends
// 4. Monitor Google Analytics!
//
// Questions? Check the IMPLEMENTATION_GUIDE.md
// ============================================
