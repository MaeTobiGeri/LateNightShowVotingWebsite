const API_URL = 'http://localhost:3000/api';

// Track if user is currently editing
let isEditing = false;
let isAuthenticated = false;
let authToken = null;

// Check authentication on load
function checkAuth() {
    authToken = sessionStorage.getItem('authToken');
    if (authToken) {
        isAuthenticated = true;
        showMainPanel();
    } else {
        showLoginPanel();
    }
}

// Show login panel
function showLoginPanel() {
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('mainContainer').style.display = 'none';
}

// Show main panel
function showMainPanel() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'block';
    loadCurrentState();
    loadUpcomingVotings();
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (result.success && result.token) {
            authToken = result.token;
            sessionStorage.setItem('authToken', authToken);
            isAuthenticated = true;
            errorEl.style.display = 'none';
            showMainPanel();
        } else {
            errorEl.style.display = 'block';
            document.getElementById('password').value = '';
        }
    } catch (error) {
        errorEl.textContent = 'Verbindungsfehler: ' + error.message;
        errorEl.style.display = 'block';
        document.getElementById('password').value = '';
    }
}

// Handle logout
async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    sessionStorage.removeItem('authToken');
    authToken = null;
    isAuthenticated = false;
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showLoginPanel();
}

// Load current voting data
async function loadCurrentState() {
    if (!isAuthenticated) return;

    try {
        const response = await fetch(`${API_URL}/voting`);
        const data = await response.json();

        // Only update fields if user is not currently editing
        if (!isEditing) {
            document.getElementById('question').value = data.question || '';
            document.getElementById('timeLeft').value = data.timeLeft || 45;

            // Clear and populate options (only for editing form, not needed for create-only form)
            const container = document.getElementById('optionsContainer');
            if (container.children.length === 0) {
                // Initialize with two empty option fields on first load
                addOption();
                addOption();
            }
        }

        // Always update current state display
        const currentState = document.getElementById('currentState');
        const activeControls = document.getElementById('activeVotingControls');

        if (data.isActive && data.question) {
            currentState.innerHTML = `
                <h3>✅ Aktive Voting-Session</h3>
                <p><strong>Frage:</strong> ${data.question}</p>
                <p><strong>Optionen:</strong> ${data.options.length}</p>
                <p><strong>Gesamtstimmen:</strong> ${data.totalVotes}</p>
                <p><strong>Zeit übrig:</strong> ${data.timeLeft}s</p>
                <p><strong>Stimmenverteilung:</strong> ${data.votes.join(', ')}</p>
            `;
            activeControls.style.display = 'block';
        } else {
            currentState.innerHTML = `
                <h3>❌ Kein aktives Voting</h3>
                <p style="color: #9ca3af;">Aktiviere ein bevorstehendes Voting oder erstelle ein neues.</p>
            `;
            activeControls.style.display = 'none';
        }
    } catch (error) {
        showStatus('Fehler beim Laden der Daten: ' + error.message, 'error');
    }
}

// Load upcoming votings
async function loadUpcomingVotings() {
    if (!isAuthenticated) return;

    try {
        const response = await fetch(`${API_URL}/votings/upcoming`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const result = await response.json();
        const container = document.getElementById('upcomingVotingsList');

        if (result.votings && result.votings.length > 0) {
            container.innerHTML = result.votings.map(voting => `
                <div class="upcoming-voting-item">
                    <div class="voting-info">
                        <h4>${voting.question}</h4>
                        <p>${voting.options.length} Optionen • ${voting.timeLeft}s</p>
                        <p style="font-size: 0.8em; color: #9ca3af;">${voting.options.join(', ')}</p>
                    </div>
                    <div class="voting-actions">
                        <button class="btn-primary btn-small" onclick="activateVoting(${voting.id})">Aktivieren</button>
                        <button class="btn-danger btn-small" onclick="deleteVoting(${voting.id})">Löschen</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="color: #9ca3af; text-align: center; padding: 20px;">Keine bevorstehenden Votings</p>';
        }
    } catch (error) {
        console.error('Fehler beim Laden der bevorstehenden Votings:', error);
    }
}

// Add new option input field
function addOption(value = '') {
    const container = document.getElementById('optionsContainer');
    const optionDiv = document.createElement('div');
    optionDiv.className = 'option-input';
    optionDiv.innerHTML = `
        <input type="text" placeholder="Option ${container.children.length + 1}" class="option-field" value="${value}">
        <button class="btn-remove" onclick="removeOption(this)">✕</button>
    `;
    container.appendChild(optionDiv);
}

// Remove option
function removeOption(button) {
    const container = document.getElementById('optionsContainer');
    if (container.children.length > 2) {
        button.parentElement.remove();
    } else {
        showStatus('Mindestens zwei Optionen müssen vorhanden sein', 'error');
    }
}

// Create voting (save to upcoming list)
async function createVoting() {
    const question = document.getElementById('question').value;
    const timeLeft = parseInt(document.getElementById('timeLeft').value);
    const options = Array.from(document.querySelectorAll('.option-field')).map(input => input.value);

    if (!question || options.some(opt => !opt)) {
        showStatus('Bitte fülle alle Felder aus', 'error');
        return;
    }

    if (options.length < 2) {
        showStatus('Mindestens zwei Optionen sind erforderlich', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/votings/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ question, options, timeLeft })
        });

        const result = await response.json();
        if (result.success) {
            showStatus('Voting erfolgreich gespeichert!', 'success');

            // Clear form
            document.getElementById('question').value = '';
            document.getElementById('timeLeft').value = '45';
            const container = document.getElementById('optionsContainer');
            container.innerHTML = '';
            addOption();
            addOption();

            loadUpcomingVotings();
        } else if (response.status === 401) {
            showStatus('Sitzung abgelaufen. Bitte erneut anmelden.', 'error');
            logout();
        }
    } catch (error) {
        showStatus('Fehler beim Speichern: ' + error.message, 'error');
    }
}

// Activate voting from upcoming list
async function activateVoting(votingId) {
    if (!confirm('Dieses Voting aktivieren? Das aktuelle Voting wird beendet.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/votings/activate/${votingId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });

        const result = await response.json();
        if (result.success) {
            showStatus('Voting erfolgreich aktiviert!', 'success');
            loadCurrentState();
            loadUpcomingVotings();
        } else if (response.status === 401) {
            showStatus('Sitzung abgelaufen. Bitte erneut anmelden.', 'error');
            logout();
        }
    } catch (error) {
        showStatus('Fehler beim Aktivieren: ' + error.message, 'error');
    }
}

// Delete voting from upcoming list
async function deleteVoting(votingId) {
    if (!confirm('Dieses Voting wirklich löschen?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/votings/${votingId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const result = await response.json();
        if (result.success) {
            showStatus('Voting erfolgreich gelöscht!', 'success');
            loadUpcomingVotings();
        } else if (response.status === 401) {
            showStatus('Sitzung abgelaufen. Bitte erneut anmelden.', 'error');
            logout();
        }
    } catch (error) {
        showStatus('Fehler beim Löschen: ' + error.message, 'error');
    }
}

// Stop current active voting
async function stopVoting() {
    if (!confirm('Aktuelles Voting beenden?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/voting/stop`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });

        const result = await response.json();
        if (result.success) {
            showStatus('Voting erfolgreich beendet!', 'success');
            loadCurrentState();
        } else if (response.status === 401) {
            showStatus('Sitzung abgelaufen. Bitte erneut anmelden.', 'error');
            logout();
        }
    } catch (error) {
        showStatus('Fehler beim Beenden: ' + error.message, 'error');
    }
}

// Legacy update voting function (no longer used in new interface)
async function updateVoting() {
    showStatus('Diese Funktion ist nicht mehr verfügbar. Verwende "Voting Speichern" und dann "Aktivieren".', 'error');
}

// Reset votes
async function resetVotes() {
    if (!confirm('Möchtest du wirklich alle Stimmen zurücksetzen?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/voting/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });

        const result = await response.json();
        if (result.success) {
            showStatus('Stimmen erfolgreich zurückgesetzt!', 'success');
            loadCurrentState();
        } else if (response.status === 401) {
            showStatus('Sitzung abgelaufen. Bitte erneut anmelden.', 'error');
            logout();
        }
    } catch (error) {
        showStatus('Fehler beim Zurücksetzen: ' + error.message, 'error');
    }
}

// Show status message
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    setTimeout(() => {
        status.style.display = 'none';
    }, 5000);
}

// Mark as editing when user interacts with form fields
function markAsEditing() {
    isEditing = true;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Setup login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Check if already authenticated
    checkAuth();

    // Auto-refresh every 3 seconds if authenticated
    setInterval(() => {
        if (isAuthenticated) {
            loadCurrentState();
            loadUpcomingVotings();
        }
    }, 3000);

    // Add event listeners to detect editing
    const questionEl = document.getElementById('question');
    const timeLeftEl = document.getElementById('timeLeft');
    const optionsContainerEl = document.getElementById('optionsContainer');

    if (questionEl) questionEl.addEventListener('input', markAsEditing);
    if (timeLeftEl) timeLeftEl.addEventListener('input', markAsEditing);

    // Listen for option field changes
    if (optionsContainerEl) {
        optionsContainerEl.addEventListener('input', (e) => {
            if (e.target.classList.contains('option-field')) {
                markAsEditing();
            }
        });
    }
});
