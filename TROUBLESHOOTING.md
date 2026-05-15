# Troubleshooting Guide

## Buttons Not Working

If the buttons (Create Room, Join, Solo vs Bots) are not responding after deployment, follow these steps:

### Step 1: Check Browser Console
1. Open the game in your browser
2. Press `F12` or right-click → "Inspect" to open Developer Tools
3. Click the "Console" tab
4. Look for error messages

### Step 2: Look for These Log Messages
- `[APP] app.js loaded` — confirms JavaScript file loaded
- `[LOBBY] createRoom clicked` (or other button) — confirms button click was registered
- `[WS] Connecting to ws://...` — shows WebSocket connection attempt
- `[WS] Connected` — successful connection to server

### Step 3: Common Issues & Solutions

#### Issue: `[APP] app.js loaded` NOT in console
**Problem:** JavaScript file not loading
- Check that `style.css` and `app.js` are in the same folder as `index.html`
- Check server is serving static files correctly
- Try a hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

#### Issue: Button clicked but no console log
**Problem:** HTML onclick handlers not working
- Make sure `app.js` loaded first
- Check browser console for JavaScript errors
- Verify HTML file has correct `<script src="app.js" defer></script>` tag

#### Issue: `[WS] Error: WebSocket is closed before the connection is established`
**Problem:** Server is not running or not accessible
- Verify server is running: `npm start` in the `server/` folder
- Check that you're accessing the correct URL (http://localhost:3000 locally)
- For deployed version, check firewall/network allows WebSocket connections
- Ensure the server URL is correct in deployment (try HTTPS with `wss://`)

#### Issue: Connection shows as localhost:3000 but deployed to different URL
**Problem:** Client is trying to connect to wrong server
- The client auto-detects the server URL from `location.host`
- Make sure your deployment host has the server running there
- Or update the WebSocket URL in [app.js](client/app.js) line ~51 if needed

### Step 4: Server-Side Checks

Open another terminal and check if server is running:

```bash
cd server
node server.js
# Should show: Server listening on 3000
```

Check for errors in server console. If you see errors, fix them and restart.

### Step 5: Test Locally First

Before deploying, test locally:

```bash
# Terminal 1: Start server
cd server
npm install
npm start

# Terminal 2: Open in browser
# http://localhost:3000
```

All console logs should appear. Try each button and verify logs print.

### Step 6: Enable More Verbose Logging (Optional)

If still stuck, add this to browser console:

```javascript
// Set log level
window.DEBUG = true;
// Reload page
location.reload();
```

Then check console for detailed logs.

---

## Connection Issues During Gameplay

If you see "Connection error:" alerts:
- Server may have crashed — restart it
- Network connection lost — check internet connection
- Check server firewall allows WebSocket connections
- Ensure server supports WebSocket upgrade (most cloud providers do)

---

## Need More Help?

Share these from browser console (F12 → Console tab):
1. Any red error messages (screenshot or copy-paste)
2. The first few log messages (look for `[APP]`, `[LOBBY]`, `[WS]`)
3. The URL you're accessing
4. Whether you're testing locally or on a deployed server
