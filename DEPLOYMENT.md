# Chaukadi - Deployment Guide

## Directory Structure

```
chaukdi-game/
├── client/
│   ├── index.html       (main page)
│   ├── style.css        (styling)
│   └── app.js           (game logic & WebSocket client)
└── server/
    ├── server.js        (Express + WebSocket relay)
    ├── package.json
    └── node_modules/    (after npm install)
```

## Local Setup

1. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

2. **Start server**
   ```bash
   npm start
   ```
   Should show: `Server listening on 3000`

3. **Open in browser**
   - http://localhost:3000
   - Open multiple tabs/windows to simulate multiplayer
   - Check browser console (F12) for logs

## Quick Testing via ngrok (Temporary Public URL)

```bash
# In another terminal (server still running in first terminal)
ngrok http 3000
```

Share the HTTPS URL ngrok provides (e.g., `https://abc123.ngrok.io`) with friends.

## Deploy to Cloud (Production)

### Option 1: Render (Free tier available)

1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Create "New Web Service" → Connect GitHub repo
4. Settings:
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Deploy

The `server.js` automatically serves static files from `../client`, and listens on `process.env.PORT`.

### Option 2: Railway

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. Create new project → GitHub repo
4. Set root directory to `server/`
5. Deploy

### Option 3: Fly.io

```bash
cd server
flyctl launch   # follow prompts
flyctl deploy
```

### Option 4: Vercel + Separate Backend

- Deploy `client/` to Vercel (static)
- Deploy `server/` to Render/Railway
- Update client WebSocket URL in `app.js` to backend URL

## Verify Deployment

After deploying, test in browser:

1. Open the deployed URL
2. Press **F12** → **Console** tab
3. Enter your name and click **Create Room**
4. Look for these in console:
   - `[APP] app.js loaded`
   - `[LOBBY] createRoom clicked`
   - `[WS] Connecting to wss://...` (or `ws://...`)
   - `[WS] Connected`

If you see connection errors, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Environment Variables

The server reads:
- `PORT` - defaults to 3000 (cloud providers set this automatically)

No other config needed—the client auto-detects the server from the browser's `location.host`.

## Server Details

`server.js`:
- Serves static files from `../client/`
- Opens WebSocket server on same port
- Maintains rooms: broadcasts messages to clients in same room code
- No database—rooms are in-memory only

WebSocket Message Types:
- `{t:'reg', room, name}` - Client registration
- `{t:'jr', name}` - Join room request
- `{t:'ru', seated}` - Room update
- `{t:'gs', G, seated}` - Game start
- `{t:'syn', G}` - Game state sync

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for:
- Buttons not working
- Connection errors
- WebSocket fails to connect
- Console logs to check

## Performance

- Room capacity: Limited by server memory (easily handles 100+ rooms)
- Message latency: Usually <100ms
- Connections: Server can handle thousands on reasonable hardware

## Security Notes

- **No authentication:** Anyone can join if they know room code
- **No persistence:** Rooms deleted when last player leaves
- **No user accounts:** Name is just display text, no validation
- For production use, consider adding: room passwords, user auth, data validation
