import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { createSteamBridge, steamAppId } from './steam';

// Steam: por ahora sin librería conectada (ver steam.ts). El juego funciona igual.
const steam = createSteamBridge(() => null, steamAppId(process.env));
ipcMain.handle('steam:status', () => steam.status());
ipcMain.handle('steam:testAchievement', () => steam.testAchievement());

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#000000',
    show: false,
    autoHideMenuBar: true,
    title: 'MAGNAR',
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
