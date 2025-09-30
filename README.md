# Abiflix Live Voting System

A real-time voting system with WebSocket support for live updates. The system consists of four components:

1. **Backend Server** - Node.js/Express server with WebSocket support
2. **Frontend-Crowd** - Voting interface for audience members
3. **Frontend-Display** - Large screen display for projector/beamer with live results
4. **Frontend-Maintenance** - Admin panel for managing voting options

## Features

- ✅ Real-time voting with WebSocket communication
- ✅ Live vote count updates
- ✅ Dynamic voting options loaded from server
- ✅ Admin panel for managing questions and options
- ✅ Server-controlled countdown timer
- ✅ Automatic voting end when timer expires
- ✅ 15-second grace period after voting ends before clearing
- ✅ Vote reset functionality

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 3. Access the Interfaces

- **Voting Interface (Crowd)**: `http://localhost:3000/`
- **Display (Projector/Beamer)**: `http://localhost:3000/display/`
- **Maintenance Panel**: `http://localhost:3000/Frontend-Maintenance/`

## How It Works

### Backend (server.js)

- Serves static files from Frontend-Crowd
- Provides REST API endpoints for voting management
- WebSocket server for real-time communication
- Stores voting data in memory

### Frontend-Crowd

- Connects to WebSocket server on load
- Receives voting options dynamically
- Displays real-time vote counts
- Sends votes through WebSocket

### Frontend-Display

- Large screen interface for projector/beamer
- Shows waiting state with Abiflix branding
- During voting: displays question, timer, and flying vote animations
- After voting: shows animated result bars with percentages
- Automatically transitions between states
- Flying vote bubbles animate from screen edges to center

### Frontend-Maintenance

- Admin interface to manage voting
- Create and save upcoming votings
- Activate votings from queue
- Stop current voting manually
- Delete upcoming votings
- Authentication required (Username: LNS-Admin, Password: LNS2026.root)

## API Endpoints

### GET /api/voting
Returns current voting data

### POST /api/voting/update
Update voting configuration
```json
{
  "question": "Your question here",
  "options": ["Option 1", "Option 2", "Option 3"],
  "timeLeft": 45,
  "isActive": true
}
```

### POST /api/voting/reset
Reset all votes to zero

## WebSocket Messages

### Server → Client

**init** - Initial voting data on connection
```json
{
  "type": "init",
  "data": { /* voting data */ }
}
```

**votingUpdate** - Voting configuration changed
```json
{
  "type": "votingUpdate",
  "data": { /* updated voting data */ }
}
```

**voteUpdate** - Vote count changed
```json
{
  "type": "voteUpdate",
  "data": {
    "votes": [10, 5, 8, 3],
    "totalVotes": 26
  }
}
```

**timeUpdate** - Timer countdown (sent every second)
```json
{
  "type": "timeUpdate",
  "data": {
    "timeLeft": 30
  }
}
```

**votingEnded** - Voting time expired
```json
{
  "type": "votingEnded",
  "data": { /* final voting data */ }
}
```

**votingCleared** - Grace period ended, screen cleared
```json
{
  "type": "votingCleared",
  "data": { /* empty voting data */ }
}
```

### Client → Server

**vote** - Submit a vote
```json
{
  "type": "vote",
  "optionIndex": 0
}
```

## Configuration

To change the server port, set the `PORT` environment variable:

```bash
PORT=8080 npm start
```

To change the WebSocket URL in the frontend, edit `Frontend-Crowd/voting.js`:

```javascript
const WS_URL = 'ws://localhost:3000';
```

## Technologies Used

- Node.js
- Express.js
- WebSocket (ws)
- Vanilla JavaScript
- HTML5/CSS3
