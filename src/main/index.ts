import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#000000',
    show: false,
    autoHideMenuBar: true,
    title: 'Enjambre gravitatorio',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
}

void app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
