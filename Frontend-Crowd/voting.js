// WebSocket connection
const WS_URL = 'ws://localhost:3000';
let ws = null;

// State variables
let timeLeft = 45;
let initialTimeLeft = 45;
let totalVotes = 0;
let selectedOption = null;
let hasVoted = false;
let votingData = null;

// DOM elements
const timerEl = document.getElementById('timer');
const totalVotesEl = document.getElementById('totalVotes');
const progressFillEl = document.getElementById('progressFill');
const voteButtonEl = document.getElementById('voteButton');
const statusMessageEl = document.getElementById('statusMessage');
const questionTitleEl = document.getElementById('questionTitle');
const optionsGridEl = document.getElementById('optionsGrid');
const statsContainerEl = document.getElementById('statsContainer');

// Timer display function
function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Update progress bar
    const progress = Math.max(0, Math.min(100, ((initialTimeLeft - timeLeft) / initialTimeLeft) * 100));
    progressFillEl.style.width = `${progress}%`;
}

// Render voting options dynamically
function renderOptions() {
    optionsGridEl.innerHTML = '';

    if (!votingData || !votingData.options || votingData.options.length === 0) {
        optionsGridEl.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Keine Abstimmung aktiv. Bitte warten...</p>';
        // Hide stats when no voting is active
        statsContainerEl.style.display = 'none';
        return;
    }

    // Show stats when voting is active
    statsContainerEl.style.display = 'flex';

    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    votingData.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.dataset.index = index;
        optionDiv.innerHTML = `
            <div class="option-content">
                <span class="option-letter">${letters[index] || index + 1}</span>
                <span class="option-text">${option}</span>
            </div>
        `;
        optionDiv.addEventListener('click', () => selectOption(index));
        optionsGridEl.appendChild(optionDiv);
    });
}

// Option selection
function selectOption(index) {
    if (hasVoted || timeLeft <= 0) return;

    const optionsEl = document.querySelectorAll('.option');
    // Remove previous selection
    optionsEl.forEach(option => {
        option.classList.remove('selected');
    });
    const selectedEl = optionsEl[index];
    selectedEl.classList.add('selected');

    selectedOption = index;
    updateVoteButton();
}

// Vote submission
function submitVote() {
    if (hasVoted || selectedOption === null || timeLeft <= 0) return;

    // Send vote via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'vote',
            optionIndex: selectedOption
        }));
    }

    hasVoted = true;

    const optionsEl = document.querySelectorAll('.option');
    const selectedEl = optionsEl[selectedOption];
    selectedEl.classList.remove('selected');
    selectedEl.classList.add('voted');

    statusMessageEl.innerHTML = '<span class="status-voted">Deine Stimme wurde gezählt!</span>';
    disableAllOptions();
    updateVoteButton();
}

// Update vote button state
function updateVoteButton() {
    if (hasVoted) {
        voteButtonEl.textContent = 'Abgestimmt!';
        voteButtonEl.className = 'vote-button disabled';
        voteButtonEl.disabled = true;
    } else if (selectedOption === null || timeLeft <= 0) {
        voteButtonEl.textContent = 'Wähle eine Option';
        voteButtonEl.className = 'vote-button disabled';
        voteButtonEl.disabled = true;
    } else {
        voteButtonEl.textContent = 'Jetzt Abstimmen!';
        voteButtonEl.className = 'vote-button active';
        voteButtonEl.disabled = false;
    }
}

// Disable all options except the voted one
function disableAllOptions() {
    const optionsEl = document.querySelectorAll('.option');
    optionsEl.forEach((option, index) => {
        if (index !== selectedOption || !hasVoted) {
            option.classList.add('disabled');
        }
    });
}

// WebSocket connection setup
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('Connected to server');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'init' || message.type === 'votingUpdate') {
            // Initialize or update voting data
            votingData = message.data;
            timeLeft = votingData.timeLeft;
            initialTimeLeft = votingData.timeLeft; // Store initial time for progress bar
            totalVotes = votingData.totalVotes;

            // Update UI
            questionTitleEl.textContent = votingData.question || 'Warte auf Abstimmung...';
            totalVotesEl.textContent = votingData.totalVotes;
            updateTimerDisplay();
            renderOptions();

            // Reset voting state if voting was reset
            if (message.type === 'votingUpdate') {
                hasVoted = false;
                selectedOption = null;
                updateVoteButton();

                if (votingData.options && votingData.options.length > 0) {
                    statusMessageEl.innerHTML = '<span class="status-choose">Wähle deine Antwort!</span>';
                } else {
                    statusMessageEl.innerHTML = '<span class="status-choose">Keine aktive Abstimmung</span>';
                }

                const optionsEl = document.querySelectorAll('.option');
                optionsEl.forEach(option => {
                    option.classList.remove('disabled', 'voted', 'selected');
                });
            }
        } else if (message.type === 'voteUpdate') {
            // Update vote counts
            totalVotes = message.data.totalVotes;
            totalVotesEl.textContent = totalVotes;
        } else if (message.type === 'timeUpdate') {
            // Server is controlling the timer
            timeLeft = message.data.timeLeft;
            updateTimerDisplay();
        } else if (message.type === 'votingEnded') {
            // Voting has ended
            votingData = message.data;
            timeLeft = 0;
            updateTimerDisplay();

            // Keep "Deine Stimme wurde gezählt!" if user voted, otherwise show "Voting beendet!"
            if (!hasVoted) {
                statusMessageEl.innerHTML = '<span class="status-time-up">Voting beendet!</span>';
            }
            // If hasVoted is true, keep the existing "Deine Stimme wurde gezählt!" message

            disableAllOptions();
            updateVoteButton();
        } else if (message.type === 'votingCleared') {
            // Clear the screen after grace period
            votingData = message.data;
            hasVoted = false;
            selectedOption = null;
            timeLeft = 45;
            totalVotes = 0;

            questionTitleEl.textContent = 'Warte auf Abstimmung...';
            totalVotesEl.textContent = 0;
            statusMessageEl.innerHTML = '<span class="status-choose">Keine aktive Abstimmung</span>';
            renderOptions();
            updateVoteButton();

            const optionsEl = document.querySelectorAll('.option');
            optionsEl.forEach(option => {
                option.classList.remove('disabled', 'voted', 'selected');
            });
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        statusMessageEl.innerHTML = '<span class="status-time-up">Verbindungsfehler!</span>';
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
    };
}

// Event listeners
voteButtonEl.addEventListener('click', submitVote);

// Update timer display periodically
setInterval(updateTimerDisplay, 100);

// Initialize
connectWebSocket();
updateVoteButton();