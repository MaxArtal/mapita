const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

const users = new Map(); // id -> última posición
const avs = new Map();   // id -> foto (jpeg base64 pequeña)
const idOwner = new Map(); // id -> socket que está reportando ese id ahora mismo (diagnóstico)
const AV_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
const num = (v, lo, hi) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : null;

const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
// Solo se envía a quienes tienen la app visible: ahorra datos y batería a los demás
const all = o => { const s = JSON.stringify(o); wss.clients.forEach(c => c.vis && c.readyState === 1 && c.send(s)); };
const snap = () => {
  const now = Date.now();
  return { t: 'snap', users: [...users.values()].map(u => ({ ...u, av: avs.get(u.id) || null, age: now - u.ts })) };
};

wss.on('connection', (ws, req) => {
  ws.vis = true; ws.alive = true;
  ws.ip = req.socket.remoteAddress;
  console.log(`[+] nueva conexión desde ${ws.ip} (clientes conectados: ${wss.clients.size})`);
  ws.on('pong', () => { ws.alive = true; });
  send(ws, snap());

  ws.on('close', () => {
    console.log(`[-] conexión cerrada (${ws.ip})`);
    for (const [id, owner] of idOwner) if (owner === ws) idOwner.delete(id);
  });

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'vis') { const was = ws.vis; ws.vis = !!m.v; if (ws.vis && !was) send(ws, snap()); return; }
    if (typeof m.id !== 'string') return;
    const id = m.id.slice(0, 40);

    if (m.t === 'bye') { users.delete(id); avs.delete(id); idOwner.delete(id); return all({ t: 'x', id }); }
    if (m.t === 'prof') {
      if (typeof m.av === 'string' && m.av.length <= 24000 && AV_RE.test(m.av)) { avs.set(id, m.av); all({ t: 'p', id, av: m.av }); }
      return;
    }
    if (m.t !== 'pos' || !Number.isFinite(m.lat) || !Number.isFinite(m.lng)) return;

    // Diagnóstico: si el mismo id llega desde dos conexiones distintas y activas a la vez,
    // probablemente dos dispositivos/pestañas están compartiendo el mismo "uid" de localStorage.
    const prevOwner = idOwner.get(id);
    if (prevOwner && prevOwner !== ws && prevOwner.readyState === 1) {
      console.warn(`[!] COLISIÓN DE ID: "${id}" está siendo usado por dos conexiones a la vez ` +
        `(${prevOwner.ip} y ${ws.ip}). Nombre recibido ahora: "${String(m.name || '').slice(0, 24)}". ` +
        `Esto hace que ambos dispositivos se muestren como una sola persona en el mapa.`);
    }
    idOwner.set(id, ws);

    const u = {
      id, name: String(m.name || 'Anónimo').slice(0, 24),
      lat: m.lat, lng: m.lng, acc: num(m.acc, 0, 99999),
      bat: num(m.bat, 0, 100), chg: !!m.chg,
      net: typeof m.net === 'string' ? m.net.slice(0, 10) : null,
      sig: num(m.sig, 0, 4), ts: Date.now()
    };
    users.set(id, u);
    console.log(`[pos] ${u.name} (${id.slice(0, 8)}…) lat=${u.lat.toFixed(4)} lng=${u.lng.toFixed(4)} — usuarios activos: ${users.size}`);
    all({ t: 'u', u: { ...u, age: 0 } });
  });
});

// Detecta conexiones muertas y quita a quien lleva 15 min sin reportar
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); });
  const now = Date.now();
  for (const [id, u] of users) if (now - u.ts > 15 * 60e3) { users.delete(id); avs.delete(id); idOwner.delete(id); all({ t: 'x', id }); }
}, 30e3);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Listo en http://localhost:' + PORT));
