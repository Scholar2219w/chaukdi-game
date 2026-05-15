# Chaukadi - The Art of the Hidden Card

A real-time multiplayer card game built with vanilla JavaScript and WebSockets.

## Quick Start

### Local (Development)

```bash
# Terminal 1: Start server
cd server
npm install
npm start

# Terminal 2: Open browser
# http://localhost:3000
```

### Play with Friends (Instant)

```bash
# Keep server running, then:
ngrok http 3000
# Share the HTTPS URL with friends
```

### Deploy (Production)

See [DEPLOYMENT.md](DEPLOYMENT.md) for Render, Railway, Fly, or other cloud platforms.

## Game Overview

**Chaukadi** is a 4-player trick-taking card game:
- **2 Teams:** North+South vs East+West
- **Goal:** Team selected as "Trump" needs 8 tricks; defending team needs 5 tricks to win
- **Cards:** Standard 52-card deck, 13 cards per player
  - 3 in hand (private)
  - 5 face-up (show-up)
  - 5 face-down (hidden, revealed when show-up played)

### How to Play

1. **Create/Join a Room**
   - Host creates room, gets a code
   - 3 friends join with the same code
   - Start when all 4 seated

2. **Trump Selection**
   - Dealer (south) picks a suit from their hand
   - If passes, partner (north) chooses
   - Trump player's team needs 8 tricks

3. **Trick Rounds**
   - South leads; play proceeds West → North → East
   - Must follow suit if possible; must beat if possible
   - Trump beats all other suits
   - Highest card of lead suit (or highest trump) wins

4. **Win Condition**
   - Trump team: 8 tricks → **wins**
   - Defending team: 5 tricks → **wins**

## Features

- ✅ Real-time multiplayer via WebSocket relay
- ✅ Bot AI for single-player testing
- ✅ Automatic card legality enforcement
- ✅ Turn timer with auto-play
- ✅ Fully responsive UI
- ✅ Works on desktop & mobile
- ✅ No dependencies (except server: Express + ws)

## Architecture

### Client (`client/`)
- **index.html** — DOM structure
- **style.css** — Visual design
- **app.js** — Game logic, WebSocket client

### Server (`server/`)
- **server.js** — Express static server + WebSocket relay
- **package.json** — Dependencies (express, ws)

**How it works:**
1. Each player connects via WebSocket to the server
2. Server relays all messages (room registration, game state, plays) to players in same room
3. Game logic runs client-side (each player calculates their own view)
4. Room codes are random 5-char alphanumeric strings

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) if:
- Buttons don't respond
- Can't connect to multiplayer
- Game freezes or crashes

## Project Structure

```
├── client/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── server/
│   ├── server.js
│   └── package.json
├── DEPLOYMENT.md
├── TROUBLESHOOTING.md
└── README.md (this file)
```

## Development

Edit any file in `client/` and refresh browser (auto-serves from server).

Edit `server/server.js` and restart server with `npm start`.

### Adding Features

To add new gameplay rules:
1. Modify game logic in `app.js` (functions like `getLegalMoves`, `playCard`, etc.)
2. Update relay in `server.js` if new message types needed
3. Test with 2+ browser tabs

To style changes:
- Edit `client/style.css`
- Refresh browser

## License

MIT (free to use and modify)

## Credits

**Game Design:** Traditional South Asian trick-taking game
**Implementation:** Vanilla JS, WebSocket relay architecture

---

**Ready to play?** Run `npm start` in `server/` and visit http://localhost:3000 🎮
