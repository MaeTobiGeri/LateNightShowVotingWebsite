const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Serve maintenance panel
app.use('/Frontend-Maintenance', express.static('Frontend-Maintenance'));

// Serve display page (for beamer/projector)
app.use('/display', express.static('Frontend-Display'));

// Serve crowd interface as default
app.use(express.static('Frontend-Crowd'));

// In-memory storage for voting data
let votingData = {
    question: "",
    options: [],
    timeLeft: 45,
    totalVotes: 0,
    votes: [],
    isActive: false,
    startTime: null,
    endTime: null
};

// Storage for upcoming votings
let upcomingVotings = [];
let nextVotingId = 1;

let votingTimer = null;
let gracePeriodTimer = null;

// Broadcast to all connected clients
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Start voting countdown
function startVotingTimer() {
    // Clear any existing timers
    if (votingTimer) clearInterval(votingTimer);
    if (gracePeriodTimer) clearTimeout(gracePeriodTimer);

    votingData.startTime = Date.now();
    votingData.endTime = votingData.startTime + (votingData.timeLeft * 1000);

    votingTimer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((votingData.endTime - now) / 1000));

        if (remaining !== votingData.timeLeft) {
            votingData.timeLeft = remaining;

            // Broadcast updated time
            broadcast({
                type: 'timeUpdate',
                data: { timeLeft: votingData.timeLeft }
            });
        }

        if (remaining <= 0) {
            clearInterval(votingTimer);
            votingTimer = null;

            // End voting after time runs out
            votingData.isActive = false;
            broadcast({
                type: 'votingEnded',
                data: votingData
            });

            // Start grace period (15 seconds) before clearing
            gracePeriodTimer = setTimeout(() => {
                // Clear voting data after grace period
                votingData.question = "";
                votingData.options = [];
                votingData.votes = [];
                votingData.totalVotes = 0;
                votingData.timeLeft = 45;
                votingData.startTime = null;
                votingData.endTime = null;

                broadcast({
                    type: 'votingCleared',
                    data: votingData
                });
            }, 15000); // 15 second grace period
        }
    }, 1000);
}

// Stop voting timer
function stopVotingTimer() {
    if (votingTimer) {
        clearInterval(votingTimer);
        votingTimer = null;
    }
    if (gracePeriodTimer) {
        clearTimeout(gracePeriodTimer);
        gracePeriodTimer = null;
    }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New client connected');

    // Send current voting data to new client
    ws.send(JSON.stringify({
        type: 'init',
        data: votingData
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'vote' && votingData.isActive) {
                const optionIndex = data.optionIndex;
                if (optionIndex >= 0 && optionIndex < votingData.options.length) {
                    votingData.votes[optionIndex]++;
                    votingData.totalVotes++;

                    // Broadcast updated vote counts
                    broadcast({
                        type: 'voteUpdate',
                        data: {
                            votes: votingData.votes,
                            totalVotes: votingData.totalVotes
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Authentication credentials (stored server-side)
const ADMIN_USERNAME = 'LNS-Admin';
const ADMIN_PASSWORD = 'LNS2026.root';

// Simple session storage (in production, use a proper session management library)
const activeSessions = new Set();

// Generate simple session token
function generateSessionToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// REST API endpoints

// Login endpoint
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateSessionToken();
        activeSessions.add(token);
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
        activeSessions.delete(token);
    }
    res.json({ success: true });
});

// Middleware to check authentication
function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token && activeSessions.has(token)) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }
}

// Get current voting data (public - no auth required)
app.get('/api/voting', (req, res) => {
    res.json(votingData);
});

// Get upcoming votings - requires auth
app.get('/api/votings/upcoming', requireAuth, (req, res) => {
    res.json({ success: true, votings: upcomingVotings });
});

// Create/save voting (doesn't activate it) - requires auth
app.post('/api/votings/create', requireAuth, (req, res) => {
    const { question, options, timeLeft } = req.body;

    if (!question || !options || options.length < 2) {
        return res.status(400).json({ success: false, message: 'Invalid voting data' });
    }

    const newVoting = {
        id: nextVotingId++,
        question,
        options,
        timeLeft: timeLeft || 45,
        createdAt: new Date().toISOString()
    };

    upcomingVotings.push(newVoting);
    res.json({ success: true, voting: newVoting });
});

// Activate a voting from upcoming list - requires auth
app.post('/api/votings/activate/:id', requireAuth, (req, res) => {
    const votingId = parseInt(req.params.id);
    const votingIndex = upcomingVotings.findIndex(v => v.id === votingId);

    if (votingIndex === -1) {
        return res.status(404).json({ success: false, message: 'Voting not found' });
    }

    // Stop any current voting
    stopVotingTimer();

    const voting = upcomingVotings[votingIndex];

    // Set as active voting
    votingData.question = voting.question;
    votingData.options = voting.options;
    votingData.timeLeft = voting.timeLeft;
    votingData.votes = new Array(voting.options.length).fill(0);
    votingData.totalVotes = 0;
    votingData.isActive = true;
    votingData.startTime = null;
    votingData.endTime = null;

    // Remove from upcoming list
    upcomingVotings.splice(votingIndex, 1);

    // Start timer
    startVotingTimer();

    // Broadcast to all clients
    broadcast({
        type: 'votingUpdate',
        data: votingData
    });

    res.json({ success: true, data: votingData });
});

// Delete upcoming voting - requires auth
app.delete('/api/votings/:id', requireAuth, (req, res) => {
    const votingId = parseInt(req.params.id);
    const votingIndex = upcomingVotings.findIndex(v => v.id === votingId);

    if (votingIndex === -1) {
        return res.status(404).json({ success: false, message: 'Voting not found' });
    }

    upcomingVotings.splice(votingIndex, 1);
    res.json({ success: true });
});

// Stop current active voting - requires auth
app.post('/api/voting/stop', requireAuth, (req, res) => {
    stopVotingTimer();

    votingData.isActive = false;

    broadcast({
        type: 'votingEnded',
        data: votingData
    });

    // Clear after grace period
    setTimeout(() => {
        votingData.question = "";
        votingData.options = [];
        votingData.votes = [];
        votingData.totalVotes = 0;
        votingData.timeLeft = 45;
        votingData.startTime = null;
        votingData.endTime = null;

        broadcast({
            type: 'votingCleared',
            data: votingData
        });
    }, 15000);

    res.json({ success: true, data: votingData });
});

// Update voting data (for maintenance interface) - requires auth
app.post('/api/voting/update', requireAuth, (req, res) => {
    const { question, options, timeLeft, isActive } = req.body;

    const wasActive = votingData.isActive;

    if (question !== undefined) votingData.question = question;
    if (options && Array.isArray(options)) {
        votingData.options = options;
        votingData.votes = new Array(options.length).fill(0);
        votingData.totalVotes = 0;
    }
    if (typeof timeLeft === 'number') votingData.timeLeft = timeLeft;
    if (typeof isActive === 'boolean') votingData.isActive = isActive;

    // Start timer when voting becomes active
    if (isActive && !wasActive) {
        startVotingTimer();
    } else if (!isActive && wasActive) {
        stopVotingTimer();
    }

    // Broadcast update to all clients
    broadcast({
        type: 'votingUpdate',
        data: votingData
    });

    res.json({ success: true, data: votingData });
});

// Reset voting - requires auth
app.post('/api/voting/reset', requireAuth, (req, res) => {
    stopVotingTimer();

    votingData.votes = new Array(votingData.options.length).fill(0);
    votingData.totalVotes = 0;
    votingData.timeLeft = 45;
    votingData.isActive = true;
    votingData.startTime = null;
    votingData.endTime = null;

    // Start the timer for the reset voting
    startVotingTimer();

    broadcast({
        type: 'votingUpdate',
        data: votingData
    });

    res.json({ success: true, data: votingData });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
