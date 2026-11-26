import { contextBridge, ipcRenderer } from 'electron';

// Lo único que la página ve del sistema. Steam se consulta por IPC al proceso principal.
contextBridge.exposeInMainWorld('platform', {
  kind: 'electron',
  steam: {
    status: () => ipcRenderer.invoke('steam:status'),
    testAchievement: () => ipcRenderer.invoke('steam:testAchievement'),
  },
});
