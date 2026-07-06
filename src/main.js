const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');
const WS = require('ws');

const store = new Store();
let desks = [], deskCounter = 0, tray = null;
const DESK_COLORS = ['#7C3AED','#0891B2','#D97706','#059669','#E11D48','#7C3AED'];
const DESK_NAMES = ['Violet','Cyan','Amber','Emerald','Rose','Purple'];

let robot = null;
try { robot = require('@jitsi/robotjs'); robot.setMouseDelay(0); robot.setKeyboardDelay(0); } catch(e) {}

function generateRoomCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }

function broadcastToDesks(ch, data) { desks.forEach(d => { if (!d.win.isDestroyed()) d.win.webContents.send(ch, data); }); }

function createDesk(deskId=null) {
  const id = deskId || `desk-${Date.now()}-${deskCounter++}`;
  const colorIdx = desks.length % DESK_COLORS.length;
  const win = new BrowserWindow({ width:420,height:600,x:80+(desks.length*40),y:80+(desks.length*40),frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,resizable:true,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});
  try { win.setContentProtection(true); } catch(e) {}
  win.loadFile(path.join(__dirname,'index.html'));
  const deskInfo = {id,win,color:DESK_COLORS[colorIdx],name:`${DESK_NAMES[colorIdx]} Desk`};
  desks.push(deskInfo);
  broadcastDeskList();
  win.on('closed',()=>{ desks=desks.filter(d=>d.id!==id); broadcastDeskList(); });
  win.webContents.on('did-finish-load',()=>{ win.webContents.send('desk-identity',{id,color:deskInfo.color,name:deskInfo.name}); win.webContents.send('desk-list',getSerializableDesks()); });
  return deskInfo;
}
function getSerializableDesks() { return desks.map(d=>({id:d.id,color:d.color,name:d.name})); }
function broadcastDeskList() { const list=getSerializableDesks(); desks.forEach(d=>{ if(!d.win.isDestroyed()) d.win.webContents.send('desk-list',list); }); }

app.whenReady().then(()=>{
  createDesk();
  globalShortcut.register('CommandOrControl+Shift+G',()=>{ desks.forEach(d=>{ if(!d.win.isDestroyed()) d.win.isVisible()?d.win.hide():d.win.show(); }); });
  globalShortcut.register('CommandOrControl+Shift+N',()=>createDesk());
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('GhostDesk');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'Show All Desks',click:()=>desks.forEach(d=>d.win.show())},{label:'Open New Desk',click:()=>createDesk()},{type:'separator'},{label:'Quit',click:()=>app.quit()}]));
});
app.on('will-quit',()=>globalShortcut.unregisterAll());

ipcMain.on('close-desk',(e)=>{ const w=BrowserWindow.fromWebContents(e.sender); if(w) w.close(); });
ipcMain.on('minimize-desk',(e)=>{ const w=BrowserWindow.fromWebContents(e.sender); if(w) w.minimize(); });
ipcMain.on('open-new-desk',()=>createDesk());
ipcMain.handle('store-get',(e,k)=>store.get(k));
ipcMain.handle('store-set',(e,k,v)=>store.set(k,v));
ipcMain.handle('get-desk-id',(e)=>{ const w=BrowserWindow.fromWebContents(e.sender); const d=desks.find(d=>d.win===w); return d?d.id:null; });

const RELAY_URL = 'wss://ghostdesk-relay.onrender.com';
let relaySocket=null, currentRole=null, currentCode=null, captureInterval=null;

function closeRelay() {
  stopScreenCapture();
  if(relaySocket){ try{relaySocket.close();}catch(e){} relaySocket=null; }
  currentRole=null; currentCode=null;
}

function connectRelay(role, code) {
  closeRelay();
  currentRole=role; currentCode=code;
  console.log('[Relay] Connecting as',role,'code',code);
  relaySocket = new WS(RELAY_URL);
  relaySocket.on('open',()=>{
    console.log('[Relay] open');
    if(role==='host') relaySocket.send(JSON.stringify({type:'host-register',code}));
    else relaySocket.send(JSON.stringify({type:'client-join',code}));
  });
  relaySocket.on('message',(raw)=>{
    let msg; try{msg=JSON.parse(raw);}catch(e){return;}
    console.log('[Relay] msg:',msg.type);
    if(msg.type==='host-registered'){ broadcastToDesks('host-ready', msg.code); startScreenCapture(); }
    if(msg.type==='client-joined'){ broadcastToDesks('relay-status',{status:'client-joined',count:msg.count}); }
    if(msg.type==='client-left'){ broadcastToDesks('relay-status',{status:'client-left',count:msg.count}); }
    if(msg.type==='auth_ok'){ broadcastToDesks('client-connected'); }
    if(msg.type==='auth_fail'){ broadcastToDesks('relay-error', msg.error||'Session not found'); closeRelay(); }
    if(msg.type==='screen-frame'){ broadcastToDesks('screen-frame', msg.frame); }
    if(msg.type==='host-disconnected'){ broadcastToDesks('session-ended'); closeRelay(); }
    // control actions forwarded by server from client
    const controlTypes=['mousemove','click','dblclick','rightclick','mousedown','mouseup','scroll','keypress','keydown','keyup','type'];
    if(currentRole==='host' && controlTypes.includes(msg.type)){ handleRemoteControl(msg); }
  });
  relaySocket.on('close',()=>{ console.log('[Relay] closed'); stopScreenCapture(); broadcastToDesks('session-ended'); relaySocket=null; });
  relaySocket.on('error',(err)=>{ console.error('[Relay] error:',err.message); broadcastToDesks('relay-error','Connection failed: '+err.message); closeRelay(); });
}

const KEY_MAP={'ArrowLeft':'left','ArrowRight':'right','ArrowUp':'up','ArrowDown':'down','Enter':'enter','Backspace':'backspace','Delete':'delete','Escape':'escape','Tab':'tab','Home':'home','End':'end','PageUp':'pageup','PageDown':'pagedown',' ':'space','F1':'f1','F2':'f2','F3':'f3','F4':'f4','F5':'f5','F6':'f6','F7':'f7','F8':'f8','F9':'f9','F10':'f10','F11':'f11','F12':'f12'};

function handleRemoteControl(action) {
  if(!action||!robot) return;
  try {
    const t=action.type, mods=action.modifiers||[];
    const key=KEY_MAP[action.key]||(action.key&&action.key.length===1?action.key.toLowerCase():null);
    if(t==='mousemove') robot.moveMouse(Math.round(action.x),Math.round(action.y));
    else if(t==='click'){robot.moveMouse(Math.round(action.x),Math.round(action.y));robot.mouseClick(action.button||'left');}
    else if(t==='dblclick'){robot.moveMouse(Math.round(action.x),Math.round(action.y));robot.mouseClick(action.button||'left',true);}
    else if(t==='rightclick'){robot.moveMouse(Math.round(action.x),Math.round(action.y));robot.mouseClick('right');}
    else if(t==='scroll') robot.scrollMouse(action.deltaX||0,action.deltaY||0);
    else if(t==='keypress'&&key) robot.keyTap(key,mods);
    else if(t==='keydown'&&key) robot.keyToggle(key,'down',mods);
    else if(t==='keyup'&&key) robot.keyToggle(key,'up',mods);
    else if(t==='type') robot.typeString(action.text||'');
  } catch(e){ console.error('[Control]',e.message); }
}

function startScreenCapture() {
  if(captureInterval) return;
  const {desktopCapturer}=require('electron');
  captureInterval=setInterval(async()=>{
    if(!relaySocket||relaySocket.readyState!==WS.OPEN) return;
    try {
      const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1280,height:720}});
      if(sources[0]){
        const frame=sources[0].thumbnail.toJPEG(60).toString('base64');
        relaySocket.send(JSON.stringify({type:'to-clients',data:{type:'screen-frame',frame}}));
      }
    } catch(e){ console.error('[Capture]',e.message); }
  },150);
}
function stopScreenCapture(){ if(captureInterval){clearInterval(captureInterval);captureInterval=null;} }

ipcMain.on('start-host',(event)=>{
  const code=generateRoomCode();
  console.log('[Host] Generated code:',code);
  event.sender.send('host-code-generated',code);
  connectRelay('host',code);
});
ipcMain.on('start-client',(event,code)=>{ connectRelay('client',code.toString().trim()); });
ipcMain.on('send-control',(event,action)=>{
  if(relaySocket&&relaySocket.readyState===WS.OPEN){
    relaySocket.send(JSON.stringify({type:'to-host',data:action}));
  }
});
ipcMain.on('end-session',()=>closeRelay());
