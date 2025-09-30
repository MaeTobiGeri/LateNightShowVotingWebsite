const WS_URL = 'ws://localhost:3000';
let ws = null;

// State
let votingData = null;
let timeLeft = 0;
let initialTimeLeft = 45;
let currentState = 'waiting'; 
let lastVoteCount = 0;

// Vote animation tracking
let voteAnimationQueue = [];
let isProcessingAnimation = false;

// DOM elements
const waitingState = document.getElementById('waitingState');
const votingActive = document.getElementById('votingActive');
const resultsState = document.getElementById('resultsState');
const questionDisplay = document.getElementById('questionDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const votesContainer = document.getElementById('votesContainer');
const resultsBars = document.getElementById('resultsBars');
const totalVotesDisplay = document.getElementById('totalVotesDisplay');
const displayLogo = document.getElementById('displayLogo');

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

    if (votesContainer) {
        votesContainer.innerHTML = '';
    }
    voteAnimationQueue = [];

    if (newState === 'waiting') {
        displayLogo.classList.remove('compact');
        waitingState.style.display = 'flex';
        votingActive.style.display = 'none';
        resultsState.style.display = 'none';
    } else if (newState === 'voting') {
        displayLogo.classList.add('compact');
        waitingState.style.display = 'none';
        votingActive.style.display = 'block';
        resultsState.style.display = 'none';
    } else if (newState === 'results') {
        displayLogo.classList.add('compact');
        waitingState.style.display = 'none';
        votingActive.style.display = 'none';
        resultsState.style.display = 'flex';
    }
}

// Create ambient glow pulses when votes come in
function createAmbientVotePulse(optionIndex) {
    if (!votingData || !votingData.options) return;

    const colors = [
        '#dc2626', '#ea580c', '#16a34a', '#2563eb',
        '#9333ea', '#db2777', '#0891b2', '#ca8a04'
    ];
    
    const color = colors[optionIndex % colors.length];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    
    // Create ambient glow around the question box
    const glow = document.createElement('div');
    glow.style.position = 'fixed';
    glow.style.top = '50%';
    glow.style.left = '50%';
    glow.style.transform = 'translate(-50%, -50%)';
    glow.style.width = '80vw';
    glow.style.height = '60vh';
    glow.style.borderRadius = '40px';
    glow.style.background = `radial-gradient(ellipse at center, ${color}30 0%, transparent 70%)`;
    glow.style.pointerEvents = 'none';
    glow.style.zIndex = '5';
    glow.style.opacity = '0';
    
    votesContainer.appendChild(glow);

    // Quick pulse animation
    const startTime = performance.now();
    const duration = 800;

    function animateGlow(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const opacity = Math.sin(progress * Math.PI) * 0.4;
        glow.style.opacity = opacity;

        if (progress < 1) {
            requestAnimationFrame(animateGlow);
        } else {
            glow.remove();
        }
    }

    requestAnimationFrame(animateGlow);

    // Create letter indicator at a corner
    const positions = [
        { top: '15%', right: '10%' },
        { top: '15%', left: '10%' },
        { bottom: '20%', right: '10%' },
        { bottom: '20%', left: '10%' }
    ];
    
    const pos = positions[Math.floor(Math.random() * positions.length)];
    
    const indicator = document.createElement('div');
    indicator.style.position = 'fixed';
    Object.assign(indicator.style, pos);
    indicator.style.fontSize = '3rem';
    indicator.style.fontWeight = '800';
    indicator.style.color = color;
    indicator.style.textShadow = `
        0 0 40px ${color},
        0 0 20px ${color},
        0 4px 20px rgba(0,0,0,0.8)
    `;
    indicator.style.pointerEvents = 'none';
    indicator.style.zIndex = '30';
    indicator.style.opacity = '0';
    indicator.style.transform = 'scale(0.5)';
    indicator.textContent = letters[optionIndex];
    
    votesContainer.appendChild(indicator);

    const indicatorStart = performance.now();
    const indicatorDuration = 1200;

    function animateIndicator(currentTime) {
        const elapsed = currentTime - indicatorStart;
        const progress = Math.min(elapsed / indicatorDuration, 1);

        if (progress < 0.2) {
            // Pop in
            const popProgress = progress / 0.2;
            indicator.style.opacity = popProgress;
            indicator.style.transform = `scale(${0.5 + popProgress * 0.7})`;
        } else if (progress < 0.8) {
            // Hold
            indicator.style.opacity = '1';
            indicator.style.transform = 'scale(1.2)';
        } else {
            // Fade out
            const fadeProgress = (progress - 0.8) / 0.2;
            indicator.style.opacity = 1 - fadeProgress;
            indicator.style.transform = `scale(${1.2 + fadeProgress * 0.3})`;
        }

        if (progress < 1) {
            requestAnimationFrame(animateIndicator);
        } else {
            indicator.remove();
        }
    }

    requestAnimationFrame(animateIndicator);
}

// Create energy particles flowing into the center
function createEnergyFlow(optionIndex, count) {
    const colors = [
        '#dc2626', '#ea580c', '#16a34a', '#2563eb',
        '#9333ea', '#db2777', '#0891b2', '#ca8a04'
    ];
    
    const color = colors[optionIndex % colors.length];
    const particleCount = Math.min(15, Math.ceil(count / 2));
    
    for (let i = 0; i < particleCount; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.style.position = 'fixed';
            particle.style.width = '12px';
            particle.style.height = '12px';
            particle.style.borderRadius = '50%';
            particle.style.background = color;
            particle.style.boxShadow = `0 0 20px ${color}, 0 0 10px ${color}`;
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '15';
            
            // Start from random edge
            const edge = Math.floor(Math.random() * 4);
            let startX, startY;
            
            switch(edge) {
                case 0: // top
                    startX = Math.random() * window.innerWidth;
                    startY = -20;
                    break;
                case 1: // right
                    startX = window.innerWidth + 20;
                    startY = Math.random() * window.innerHeight;
                    break;
                case 2: // bottom
                    startX = Math.random() * window.innerWidth;
                    startY = window.innerHeight + 20;
                    break;
                case 3: // left
                    startX = -20;
                    startY = Math.random() * window.innerHeight;
                    break;
            }
            
            particle.style.left = startX + 'px';
            particle.style.top = startY + 'px';
            
            votesContainer.appendChild(particle);
            
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            const particleStart = performance.now();
            const duration = 1000 + Math.random() * 500;
            
            function animateParticle(currentTime) {
                const elapsed = currentTime - particleStart;
                const progress = Math.min(elapsed / duration, 1);
                
                // Ease in-out
                const easeProgress = progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
                const currentX = startX + (centerX - startX) * easeProgress;
                const currentY = startY + (centerY - startY) * easeProgress;
                
                const opacity = progress < 0.9 ? 0.8 : 0.8 * (1 - (progress - 0.9) / 0.1);
                const scale = 1 + Math.sin(progress * Math.PI) * 0.5;
                
                particle.style.left = currentX + 'px';
                particle.style.top = currentY + 'px';
                particle.style.opacity = opacity;
                particle.style.transform = `scale(${scale})`;
                
                if (progress < 1) {
                    requestAnimationFrame(animateParticle);
                } else {
                    particle.remove();
                }
            }
            
            requestAnimationFrame(animateParticle);
        }, i * 50); // Stagger particle creation
    }
}

// Process vote animations
function processVoteAnimations() {
    if (isProcessingAnimation || voteAnimationQueue.length === 0) return;
    
    isProcessingAnimation = true;
    
    // Group votes by option
    const votesByOption = {};
    voteAnimationQueue.forEach(optionIndex => {
        votesByOption[optionIndex] = (votesByOption[optionIndex] || 0) + 1;
    });
    
    // Clear queue
    voteAnimationQueue = [];
    
    // Create animations for each option
    Object.keys(votesByOption).forEach((optionIndex, index) => {
        setTimeout(() => {
            const count = votesByOption[optionIndex];
            createAmbientVotePulse(parseInt(optionIndex));
            createEnergyFlow(parseInt(optionIndex), count);
        }, index * 150);
    });
    
    setTimeout(() => {
        isProcessingAnimation = false;
        if (voteAnimationQueue.length > 0) {
            processVoteAnimations();
        }
    }, 500);
}

// Render results
function renderResults() {
    if (!votingData || !votingData.options) return;

    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const totalVotes = votingData.totalVotes || 1;

    totalVotesDisplay.textContent = `${totalVotes} Stimme${totalVotes !== 1 ? 'n' : ''}`;

    const maxVotes = Math.max(...votingData.votes);
    const winnerIndex = votingData.votes.indexOf(maxVotes);

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
                ${isWinner ? '<div class="winner-badge">GEWINNER</div>' : ''}
            </div>
        `;
    }).join('');

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
                if (currentState !== 'voting') {
                    switchState('voting');
                    questionDisplay.textContent = votingData.question;
                    updateTimerDisplay();
                }
            } else {
                if (currentState !== 'waiting') {
                    switchState('waiting');
                }
            }
        } else if (message.type === 'timeUpdate') {
            timeLeft = message.data.timeLeft;
            updateTimerDisplay();
        } else if (message.type === 'voteUpdate') {
            const newTotalVotes = message.data.totalVotes;
            const voteDiff = newTotalVotes - lastVoteCount;

            if (voteDiff > 0 && currentState === 'voting') {
                if (votingData && message.data.votes) {
                    message.data.votes.forEach((newVotes, index) => {
                        const oldVotes = votingData.votes[index] || 0;
                        const diff = newVotes - oldVotes;

                        for (let i = 0; i < diff; i++) {
                            voteAnimationQueue.push(index);
                        }
                    });

                    processVoteAnimations();
                }
            }

            votingData.votes = message.data.votes;
            votingData.totalVotes = message.data.totalVotes;
            lastVoteCount = newTotalVotes;
        } else if (message.type === 'votingEnded') {
            votingData = message.data;
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
        setTimeout(connectWebSocket, 3000);
    };
}

createParticles();

displayLogo.classList.remove('compact');
waitingState.style.display = 'flex';
votingActive.style.display = 'none';
resultsState.style.display = 'none';

connectWebSocket();