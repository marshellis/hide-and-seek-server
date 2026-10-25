// Hide & Seek room server.
// It only manages rooms, the 10-second lobby countdown and message relaying.
// The room's host (first player in) runs the game simulation and bots; everyone else sends
// their own position + shots to the host and receives snapshots back.
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const LOBBY_MS = 10000;   // wait this long after someone clicks Play so more players can join
const MAX_PLAYERS = 7;

const rooms = new Map();
let nextId = 1;

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, { name, players: new Map(), hostId: null, phase: 'lobby', startAt: 0, timer: null, inGame: new Set(), counter: 0 });
  return rooms.get(name);
}
const send = (p, msg) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); };
const broadcast = (r, msg, exceptId) => r.players.forEach(p => { if (p.id !== exceptId) send(p, msg); });
const toGame = (r, msg, exceptId) => r.players.forEach(p => { if (p.id !== exceptId && r.inGame.has(p.id)) send(p, msg); });
const profile = p => ({ id: p.id, name: p.name, hex: p.hex, shape: p.shape });

function lobbyMsg(r) {
  return { type: 'lobby', hostId: r.hostId, phase: r.phase, players: [...r.players.values()].map(profile), startsIn: r.startAt ? Math.max(0, r.startAt - Date.now()) : 0 };
}
const sendLobby = r => broadcast(r, lobbyMsg(r));

function startGame(r) {
  r.timer = null; r.startAt = 0;
  if (!r.players.size) return;
  r.phase = 'playing';
  r.inGame = new Set(r.players.keys());
  broadcast(r, { type: 'start', hostId: r.hostId, humans: [...r.players.values()].map(profile) });
}

function backToLobby(r) {
  r.phase = 'lobby'; r.startAt = 0; r.inGame = new Set();
  if (r.timer) { clearTimeout(r.timer); r.timer = null; }
}

const http = require('http');
const httpServer = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); });   // /health for Fly
const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(PORT);
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const r = getRoom((url.searchParams.get('room') || 'public').slice(0, 24));
  if (r.players.size >= MAX_PLAYERS) { ws.send(JSON.stringify({ type: 'full' })); ws.close(); return; }
  const p = { id: 'p' + nextId++, ws, name: 'Player ' + (++r.counter), hex: 0x2f6fe0, shape: 'Bean' };
  r.players.set(p.id, p);
  if (!r.hostId) r.hostId = p.id;
  send(p, { type: 'welcome', id: p.id });
  sendLobby(r);

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const isHost = p.id === r.hostId;
    switch (m.type) {
      case 'join':
        if (typeof m.hex === 'number') p.hex = m.hex;
        if (typeof m.shape === 'string') p.shape = m.shape.slice(0, 12);
        sendLobby(r); break;
      case 'ready':
        if (r.phase === 'lobby' && !r.startAt) { r.startAt = Date.now() + LOBBY_MS; r.timer = setTimeout(() => startGame(r), LOBBY_MS); }
        sendLobby(r); break;
      case 'profile':
        if (typeof m.hex === 'number') p.hex = m.hex;
        if (typeof m.shape === 'string') p.shape = m.shape.slice(0, 12);
        broadcast(r, { type: 'profile', id: p.id, hex: p.hex, shape: p.shape }, p.id); break;
      case 'state': case 'shoot':          // player -> host
        if (!isHost && r.phase === 'playing') { const h = r.players.get(r.hostId); if (h) send(h, { ...m, id: p.id }); } break;
      case 'init': case 'snap': case 'fx': case 'tag':   // host -> everyone in the game
        if (isHost) toGame(r, m, p.id); break;
      case 'end':
        if (isHost) { toGame(r, m, p.id); backToLobby(r); sendLobby(r); } break;
    }
  });

  ws.on('close', () => {
    r.players.delete(p.id); r.inGame.delete(p.id);
    if (!r.players.size) { if (r.timer) clearTimeout(r.timer); rooms.delete(r.name); return; }
    if (r.hostId === p.id) {
      r.hostId = r.players.keys().next().value;
      if (r.phase === 'playing') { broadcast(r, { type: 'abort', reason: 'The host left, so the game was cancelled.' }); backToLobby(r); }
    } else if (r.phase === 'playing') toGame(r, { type: 'left', id: p.id });
    sendLobby(r);
  });
});
console.log('Hide & Seek server listening on ws://localhost:' + PORT);
