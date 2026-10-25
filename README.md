# Hide & Seek server

```
npm install
npm start          # listens on PORT (default 8080)
```

Point the game at it: open `hide-and-seek.html?server=ws://localhost:8080`
(use `wss://` when the server is behind HTTPS). `&room=name` makes a private room.
Or set `window.HS_SERVER = 'wss://your-server'` before the game script.

Anyone who clicks Play starts a 10-second lobby countdown; everyone in the room by then
plays together, remaining slots become bots (7 slots total).

## Deploy (Fly.io, same as battle-royale-server)
One-time: `flyctl auth login`, `flyctl launch --no-deploy --copy-config`, then create a deploy token
(`flyctl tokens create deploy`) and add it to this repo as the Actions secret `FLY_API_TOKEN`.
After that every push to `main` deploys. The game connects to `wss://hide-and-seek-server.fly.dev`.
