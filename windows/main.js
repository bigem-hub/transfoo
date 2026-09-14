const { app, BrowserWindow, Menu, Tray } = require('electron');
const path = require('path');

const isDev = !!process.env.NODE_ENV && process.env.NODE_ENV.trim().toLowerCase() === 'development';
// In the packaged app, renderer is the Next static export shipped under `out/`.
const rendererRoot = path.join(__dirname, 'out');

function rendererPage(p = 'index.html') {
  const clean = (p || 'index.html').replace(/^\/+/, '');
  return clean.endsWith('.html') ? clean : clean + '.html';
}

function createWindow() {
  const win = new BrowserWindow({ width: 1200, height: 800, icon: path.join(__dirname, 'public', 'icon.ico'), webPreferences: { nodeIntegration: false, contextIsolation: true } });
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(rendererRoot, 'index.html'));
  }
  createTray(win);
  return win;
}

function nav(win, p) {
  if (isDev) win.loadURL('http://localhost:3000/' + p.replace('.html', ''));
  else win.loadFile(path.join(rendererRoot, rendererPage(p)));
}

function createTray(win) {
  let tray;
  try {
    tray = new Tray(path.join(__dirname, 'public', 'icon.png'));
  } catch (_) {
    try { tray = new Tray(path.join(__dirname, 'public', 'icon.ico')); } catch (__) { return; }
  }
  tray.setToolTip('Transfo');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Transfo', click: () => win.show() },
    { label: 'Send files', click: () => nav(win, 'transfer') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  tray.on('double-click', () => win.show());
  win.on('closed', () => { try { tray.destroy(); } catch (_) {} });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});