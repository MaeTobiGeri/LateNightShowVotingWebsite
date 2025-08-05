// State variables
let timeLeft = 45;
let totalVotes = 127;
let selectedOption = null;
let hasVoted = false;

// DOM elements
const timerEl = document.getElementById('timer');
const totalVotesEl = document.getElementById('totalVotes');
const progressFillEl = document.getElementById('progressFill');
const voteButtonEl = document.getElementById('voteButton');
const statusMessageEl = document.getElementById('statusMessage');
const optionsEl = document.querySelectorAll('.option');

// Timer function
function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Update progress bar
    const progress = Math.max(0, (45 - timeLeft) / 45 * 100);
    progressFillEl.style.width = `${progress}%`;

    if (timeLeft <= 0) {
        // Time's up
        statusMessageEl.innerHTML = '<span class="status-time-up">Voting beendet!</span>';
        disableAllOptions();
        updateVoteButton();
    } else {
        timeLeft--;
    }
}

// Option selection
function selectOption(index) {
    if (hasVoted || timeLeft <= 0) return;

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

    hasVoted = true;
    totalVotes++;
    totalVotesEl.textContent = totalVotes;

    // Add voted checkmark to selected option
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
    optionsEl.forEach((option, index) => {
        if (index !== selectedOption || !hasVoted) {
            option.classList.add('disabled');
        }
    });
}

// Event listeners
optionsEl.forEach((option, index) => {
    option.addEventListener('click', () => selectOption(index));
});

voteButtonEl.addEventListener('click', submitVote);

// Start timer
const timerInterval = setInterval(updateTimer, 1000);

// Initialize
updateVoteButton();