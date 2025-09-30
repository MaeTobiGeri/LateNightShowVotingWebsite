// WebSocket connection
const WS_URL = 'ws://localhost:3000';
let ws = null;

// State
let votingData = null;
let timeLeft = 0;
let initialTimeLeft = 45;
let currentState = 'waiting'; // waiting, voting, results
let lastVoteCount = 0;

// Performance optimization for high vote volume
let voteQueue = [];
let maxConcurrentBubbles = 12; // Maximum bubbles visible at once (reduced for subtlety)
let activeBubbleCount = 0;
let processingQueue = false;

// DOM elements
const waitingState = document.getElementById('waitingState');
const votingActive = document.getElementById('votingActive');
const resultsState = document.getElementById('resultsState');
const questionDisplay = document.getElementById('questionDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const votesContainer = document.getElementById('votesContainer');
const optionsPreview = document.getElementById('optionsPreview');
const resultsBars = document.getElementById('resultsBars');
const totalVotesDisplay = document.getElementById('totalVotesDisplay');
const displayLogo = document.getElementById('displayLogo');

// Initialize background particles
function createParticles() {
    const particles = document.getElementById('particles');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        particles.appendChild(particle);
    }
}

// Update timer display
function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Switch states
function switchState(newState) {
    currentState = newState;

    // Clear votes container and reset performance tracking when switching states
    if (votesContainer) {
        votesContainer.innerHTML = '';
    }
    voteQueue = [];
    activeBubbleCount = 0;
    processingQueue = false;

    if (newState === 'waiting') {
        // Logo in center, large size
        displayLogo.classList.remove('compact');
        waitingState.style.display = 'flex';
        votingActive.style.display = 'none';
        resultsState.style.display = 'none';
    } else if (newState === 'voting') {
        // Animate logo to top-left corner, small size
        displayLogo.classList.add('compact');
        waitingState.style.display = 'none';
        votingActive.style.display = 'block';
        resultsState.style.display = 'none';
    } else if (newState === 'results') {
        // Keep logo in top-left corner during results
        displayLogo.classList.add('compact');
        waitingState.style.display = 'none';
        votingActive.style.display = 'none';
        resultsState.style.display = 'flex';
    }
}

// Process vote queue with throttling
function processVoteQueue() {
    if (processingQueue || voteQueue.length === 0) return;

    processingQueue = true;

    function processNext() {
        if (voteQueue.length === 0) {
            processingQueue = false;
            return;
        }

        // Process votes in batches when queue is large
        if (voteQueue.length > 30) {
            // For large queues, batch by option and show fewer bubbles
            const batchSize = Math.min(15, voteQueue.length);
            const batch = voteQueue.splice(0, batchSize);

            // Count votes per option in this batch
            const optionCounts = {};
            batch.forEach(optionIndex => {
                optionCounts[optionIndex] = (optionCounts[optionIndex] || 0) + 1;
            });

            // Create one bubble per option with count indicator
            Object.keys(optionCounts).forEach(optionIndex => {
                if (activeBubbleCount < maxConcurrentBubbles) {
                    createVoteBubble(parseInt(optionIndex), optionCounts[optionIndex]);
                }
            });
        } else {
            // Normal processing for smaller queues
            if (activeBubbleCount < maxConcurrentBubbles) {
                const optionIndex = voteQueue.shift();
                createVoteBubble(optionIndex, 1);
            }
        }

        // Process next batch after a small delay
        setTimeout(processNext, 100);
    }

    processNext();
}

// Create flying vote bubble with smooth animation
function createVoteBubble(optionIndex, count = 1) {
    if (!votingData || !votingData.options) return;

    activeBubbleCount++;

    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const bubble = document.createElement('div');
    bubble.className = 'vote-bubble';
    bubble.textContent = count > 1 ? `${letters[optionIndex]} +${count}` : letters[optionIndex];

    // Color based on option
    const colors = [
        '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
    ];
    bubble.style.background = colors[optionIndex % colors.length];

    // Random spawn position around the question (not from screen edges)
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Spawn in a wider circle around the center for more subtle effect
    const angle = Math.random() * Math.PI * 2;
    const distance = 400 + Math.random() * 300; // 400-700px from center (further away)

    const startX = centerX + Math.cos(angle) * distance;
    const startY = centerY + Math.sin(angle) * distance;

    bubble.style.left = startX + 'px';
    bubble.style.top = startY + 'px';
    bubble.style.transform = 'scale(0)';
    bubble.style.opacity = '0';

    votesContainer.appendChild(bubble);

    // Animate appearance
    requestAnimationFrame(() => {
        bubble.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        bubble.style.transform = 'scale(1)';
        bubble.style.opacity = '1';
    });

    // After brief pause, fly to center with custom animation
    setTimeout(() => {
        const duration = 1500 + Math.random() * 500; // 1.5-2 seconds
        const startTime = performance.now();

        // Add some curve to the path
        const midX = (startX + centerX) / 2 + (Math.random() - 0.5) * 100;
        const midY = (startY + centerY) / 2 + (Math.random() - 0.5) * 100;

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth easing with acceleration at the end
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            // Bezier curve for smooth path
            const t = easeProgress;
            const currentX = Math.pow(1-t, 2) * startX + 2 * (1-t) * t * midX + Math.pow(t, 2) * (centerX - 25);
            const currentY = Math.pow(1-t, 2) * startY + 2 * (1-t) * t * midY + Math.pow(t, 2) * (centerY - 25);

            // Smooth rotation and scale
            const rotation = easeProgress * 720 + Math.sin(progress * Math.PI * 4) * 30;
            const scale = 1 - easeProgress * 0.3;
            const opacity = 1 - Math.pow(easeProgress, 3) * 0.3;

            bubble.style.left = currentX + 'px';
            bubble.style.top = currentY + 'px';
            bubble.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
            bubble.style.opacity = opacity;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // When reaching center, create explosion effect
                createExplosionEffect(centerX, centerY, colors[optionIndex % colors.length], count);
                bubble.remove();
                activeBubbleCount--;
            }
        }

        requestAnimationFrame(animate);
    }, 100);
}

// Create subtle effect when bubble reaches center
function createExplosionEffect(x, y, color, count = 1) {
    // Very subtle flash - just a gentle pulse
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.left = (x - 30) + 'px';
    flash.style.top = (y - 30) + 'px';
    flash.style.width = '60px';
    flash.style.height = '60px';
    flash.style.borderRadius = '50%';
    flash.style.background = `radial-gradient(circle, ${color}, transparent)`;
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '25';
    flash.style.opacity = '0.3';

    votesContainer.appendChild(flash);

    // Quick, subtle fade
    const startTime = performance.now();
    const duration = 300;

    function animateFlash(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const scale = 1 + progress * 1.5;
        const opacity = 0.3 * (1 - progress);

        flash.style.transform = `scale(${scale})`;
        flash.style.opacity = opacity;

        if (progress < 1) {
            requestAnimationFrame(animateFlash);
        } else {
            flash.remove();
        }
    }

    requestAnimationFrame(animateFlash);
}

// Render results
function renderResults() {
    if (!votingData || !votingData.options) return;

    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const totalVotes = votingData.totalVotes || 1; // Avoid division by zero

    totalVotesDisplay.textContent = `${totalVotes} Stimme${totalVotes !== 1 ? 'n' : ''}`;

    // Find winner
    const maxVotes = Math.max(...votingData.votes);
    const winnerIndex = votingData.votes.indexOf(maxVotes);

    // Create result bars with animation delay
    resultsBars.innerHTML = votingData.options.map((option, index) => {
        const votes = votingData.votes[index] || 0;
        const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
        const isWinner = index === winnerIndex && votes > 0;

        return `
            <div class="result-bar" style="animation-delay: ${index * 0.1}s">
                <div class="result-bar-fill" style="width: ${percentage}%"></div>
                <div class="result-bar-content">
                    <div class="result-option">
                        <span class="result-letter">${letters[index]}</span>
                        <span class="result-text">${option}</span>
                    </div>
                    <div class="result-stats">
                        <span class="result-votes">${votes}</span>
                        <span class="result-percentage">${percentage}%</span>
                    </div>
                </div>
                ${isWinner ? '<div class="winner-badge">🏆 GEWINNER</div>' : ''}
            </div>
        `;
    }).join('');

    // Trigger width animation
    setTimeout(() => {
        document.querySelectorAll('.result-bar-fill').forEach((fill, index) => {
            const votes = votingData.votes[index] || 0;
            const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100) : 0;
            fill.style.width = percentage + '%';
        });
    }, 100);
}

// WebSocket connection
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('Display connected to server');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'init' || message.type === 'votingUpdate') {
            votingData = message.data;
            timeLeft = votingData.timeLeft;
            initialTimeLeft = votingData.timeLeft;
            lastVoteCount = votingData.totalVotes || 0;

            if (votingData.isActive && votingData.options && votingData.options.length > 0) {
                // Show voting state
                if (currentState !== 'voting') {
                    switchState('voting');
                    questionDisplay.textContent = votingData.question;
                    updateTimerDisplay();
                }
            } else {
                // Show waiting state
                if (currentState !== 'waiting') {
                    switchState('waiting');
                }
            }
        } else if (message.type === 'timeUpdate') {
            timeLeft = message.data.timeLeft;
            updateTimerDisplay();
        } else if (message.type === 'voteUpdate') {
            // Update vote counts and queue flying bubbles
            const newTotalVotes = message.data.totalVotes;
            const voteDiff = newTotalVotes - lastVoteCount;

            if (voteDiff > 0 && currentState === 'voting') {
                // Find which option(s) got votes and add to queue
                if (votingData && message.data.votes) {
                    message.data.votes.forEach((newVotes, index) => {
                        const oldVotes = votingData.votes[index] || 0;
                        const diff = newVotes - oldVotes;

                        // Add votes to queue instead of creating immediately
                        for (let i = 0; i < diff; i++) {
                            voteQueue.push(index);
                        }
                    });

                    // Start processing the queue
                    processVoteQueue();
                }
            }

            votingData.votes = message.data.votes;
            votingData.totalVotes = message.data.totalVotes;
            lastVoteCount = newTotalVotes;
        } else if (message.type === 'votingEnded') {
            votingData = message.data;
            // Wait a moment, then show results
            setTimeout(() => {
                switchState('results');
                renderResults();
            }, 3000);
        } else if (message.type === 'votingCleared') {
            votingData = message.data;
            switchState('waiting');
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('Display disconnected from server');
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
    };
}

// Initialize
createParticles();

// Set initial state immediately
displayLogo.classList.remove('compact');
waitingState.style.display = 'flex';
votingActive.style.display = 'none';
resultsState.style.display = 'none';

connectWebSocket();
