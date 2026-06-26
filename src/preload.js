const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ghostDesk', {
  close: () => ipcRenderer.send('close-desk'),
  minimize: () => ipcRenderer.send('minimize-desk'),
  openNewDesk: () => ipcRenderer.send('open-new-desk'),
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, val) => ipcRenderer.invoke('store-set', key, val),
  getDeskId: () => ipcRenderer.invoke('get-desk-id'),
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  onDeskIdentity: (cb) => ipcRenderer.on('desk-identity', (_, d) => cb(d)),
  onDeskList: (cb) => ipcRenderer.on('desk-list', (_, l) => cb(l)),

  // Hosting
  startHosting: () => ipcRenderer.send('start-hosting'),
  stopHosting: () => ipcRenderer.send('stop-hosting'),
  sendRemoteMessage: (msg) => ipcRenderer.send('send-remote-message', msg),
  onHostingStarted: (cb) => ipcRenderer.on('hosting-started', (_, d) => cb(d)),
  onHostingStopped: (cb) => ipcRenderer.on('hosting-stopped', (_, d) => cb(d)),
  onRemoteClientJoined: (cb) => ipcRenderer.on('remote-client-joined', (_, d) => cb(d)),
  onRemoteClientLeft: (cb) => ipcRenderer.on('remote-client-left', (_, d) => cb(d)),

  // Client
  remoteConnect: (opts) => ipcRenderer.send('remote-connect', opts),
  remoteDisconnect: () => ipcRenderer.send('remote-disconnect'),
  sendToHost: (msg) => ipcRenderer.send('send-to-host', msg),
  onRemoteConnected: (cb) => ipcRenderer.on('remote-connected', (_, d) => cb(d)),
  onRemoteDisconnected: (cb) => ipcRenderer.on('remote-disconnected', (_, d) => cb(d)),
  onRemoteError: (cb) => ipcRenderer.on('remote-error', (_, d) => cb(d)),

  // Shared messages (both host + client receive these)
  onRemoteMessage: (cb) => ipcRenderer.on('remote-message', (_, d) => cb(d)),
});
