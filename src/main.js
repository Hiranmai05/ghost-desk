const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const os = require('os');

const store = new Store();

let desks = [];
let deskCounter = 0;
let tray = null;

// ── Remote Session ──
let wsServer = null;
let httpServer = null;
let remoteClients = new Map(); // clientId -> ws
let sessionCode = null;
let isHosting = false;

const DESK_COLORS = ['#7C3AED', '#0891B2', '#D97706', '#059669', '#E11D48', '#7C3AED'];
const DESK_NAMES = ['Violet', 'Cyan', 'Amber', 'Emerald', 'Rose', 'Purple'];

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastToRemote(msg) {
  const data = JSON.stringify(msg);
  remoteClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}

function notifyAllDesks(channel, data) {
  desks.forEach(d => {
    if (!d.win.isDestroyed()) d.win.webContents.send(channel, data);
  });
}

function startHosting(port = 45678) {
  if (isHosting) return;
  sessionCode = generateCode();
  isHosting = true;

  httpServer = http.createServer();
  wsServer = new WebSocketServer({ server: httpServer });

  wsServer.on('connection', (ws) => {
    const clientId = `client-${Date.now()}`;
    let authenticated = false;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);

        if (!authenticated) {
          if (msg.type === 'auth' && msg.code === sessionCode) {
            authenticated = true;
            remoteClients.set(clientId, ws);
            ws.send(JSON.stringify({ type: 'auth_ok', clientId }));
            notifyAllDesks('remote-client-joined', { clientId, count: remoteClients.size });
          } else {
            ws.send(JSON.stringify({ type: 'auth_fail' }));
            ws.close();
          }
          return;
        }

        // Forward messages from remote client to all local desks
        notifyAllDesks('remote-message', { clientId, ...msg });

        // Also broadcast to other remote clients
        remoteClients.forEach((other, id) => {
          if (id !== clientId && other.readyState === WebSocket.OPEN) {
            other.send(JSON.stringify({ from: clientId, ...msg }));
          }
        });

      } catch (e) {}
    });

    ws.on('close', () => {
      remoteClients.delete(clientId);
      notifyAllDesks('remote-client-left', { clientId, count: remoteClients.size });
    });
  });

  httpServer.listen(port, '0.0.0.0', () => {
    const ip = getLocalIP();
    notifyAllDesks('hosting-started', { ip, port, code: sessionCode });
  });
}

function stopHosting() {
  if (!isHosting) return;
  remoteClients.forEach(ws => ws.close());
  remoteClients.clear();
  wsServer?.close();
  httpServer?.close();
  wsServer = null;
  httpServer = null;
  isHosting = false;
  sessionCode = null;
  notifyAllDesks('hosting-stopped', {});
}

function createDesk(deskId = null) {
  const id = deskId || `desk-${Date.now()}-${deskCounter++}`;
  const colorIdx = desks.length % DESK_COLORS.length;

  const win = new BrowserWindow({
    width: 420,
    height: 640,
    x: 80 + (desks.length * 40),
    y: 80 + (desks.length * 40),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    win.setContentProtection(true);
    try {
      const addon = require('../build/Release/ghost_addon');
      addon.setWindowDisplayAffinity(win.getNativeWindowHandle());
    } catch (e) {}
  } catch (e) {}

  win.loadFile(path.join(__dirname, 'index.html'));

  const deskInfo = { id, win, color: DESK_COLORS[colorIdx], name: `${DESK_NAMES[colorIdx]} Desk` };
  desks.push(deskInfo);
  broadcastDeskList();

  win.on('closed', () => {
    desks = desks.filter(d => d.id !== id);
    broadcastDeskList();
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('desk-identity', { id, color: deskInfo.color, name: deskInfo.name });
    win.webContents.send('desk-list', getSerializableDesks());
    if (isHosting) win.webContents.send('hosting-started', { ip: getLocalIP(), port: 45678, code: sessionCode });
  });

  return deskInfo;
}

function getSerializableDesks() {
  return desks.map(d => ({ id: d.id, color: d.color, name: d.name }));
}

function broadcastDeskList() {
  const list = getSerializableDesks();
  desks.forEach(d => { if (!d.win.isDestroyed()) d.win.webContents.send('desk-list', list); });
}

app.whenReady().then(() => {
  createDesk();

  globalShortcut.register('CommandOrControl+Shift+G', () => {
    desks.forEach(d => { if (!d.win.isDestroyed()) d.win.isVisible() ? d.win.hide() : d.win.show(); });
  });
  globalShortcut.register('CommandOrControl+Shift+N', () => createDesk());

  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('GhostDesk');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show All Desks', click: () => desks.forEach(d => d.win.show()) },
    { label: 'Open New Desk', click: () => createDesk() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopHosting();
});

// IPC
ipcMain.on('close-desk', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.on('minimize-desk', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('open-new-desk', () => createDesk());
ipcMain.handle('store-get', (e, key) => store.get(key));
ipcMain.handle('store-set', (e, key, val) => store.set(key, val));
ipcMain.handle('get-desk-id', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  return desks.find(d => d.win === win)?.id || null;
});
ipcMain.handle('get-local-ip', () => getLocalIP());

// Remote IPC
ipcMain.on('start-hosting', () => startHosting());
ipcMain.on('stop-hosting', () => stopHosting());
ipcMain.on('send-remote-message', (e, msg) => {
  broadcastToRemote(msg);
  // Echo to all local desks too
  notifyAllDesks('remote-message', { clientId: 'local', ...msg });
});

// Client-side: connect to a remote host
let remoteClientWs = null;
ipcMain.on('remote-connect', (e, { ip, port, code }) => {
  if (remoteClientWs) { remoteClientWs.close(); remoteClientWs = null; }
  try {
    const ws = new WebSocket(`ws://${ip}:${port}`);
    remoteClientWs = ws;

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', code }));
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        notifyAllDesks('remote-message', msg);
        if (msg.type === 'auth_ok') notifyAllDesks('remote-connected', { ip, port });
        if (msg.type === 'auth_fail') notifyAllDesks('remote-error', { error: 'Wrong code' });
      } catch (e) {}
    });
    ws.on('error', () => notifyAllDesks('remote-error', { error: 'Cannot reach host. Check IP and code.' }));
    ws.on('close', () => notifyAllDesks('remote-disconnected', {}));
  } catch (err) {
    notifyAllDesks('remote-error', { error: err.message });
  }
});

ipcMain.on('remote-disconnect', () => {
  remoteClientWs?.close();
  remoteClientWs = null;
});

ipcMain.on('send-to-host', (e, msg) => {
  if (remoteClientWs?.readyState === WebSocket.OPEN) {
    remoteClientWs.send(JSON.stringify(msg));
  }
});
