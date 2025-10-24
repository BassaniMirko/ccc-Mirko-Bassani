const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getMousePosition: () => ipcRenderer.invoke("get-mouse-position"),
  
  receiveCharacterId: (callback) => ipcRenderer.on('character-id', (event, id) => callback(id)),
  
  updateCharacterPosition: (id, x, y) => {
    console.log(`Invio posizione per ${id}: (${x}, ${y})`);
    ipcRenderer.send('update-character-position', { id, x, y });
  },
  
  // NUOVO: API per muovere finestre remote
  updateRemoteWindowPosition: (characterId, x, y) => {
    console.log(`Richiesto movimento finestra per ${characterId}: (${x}, ${y})`);
    ipcRenderer.send('update-remote-window-position', { characterId, x, y });
  },
  
  // API per aggiornamenti remoti
  onRemotePositionUpdate: (callback) => {
    ipcRenderer.on('remote-position-update', (event, data) => {
      console.log("Aggiornamento remoto ricevuto in preload:", data);
      callback(data);
    });
  },
  
  requestHeartbeatCheck: () => {
    ipcRenderer.send('request-heartbeat-check');
  },
  
  onRequestHeartbeatCheck: (callback) => {
    ipcRenderer.on('request-heartbeat-check', (event) => {
      console.log("Richiesta heartbeat ricevuta in preload");
      callback();
    });
  }
});

// Aggiungi anche window.API per compatibilità
contextBridge.exposeInMainWorld("API", {
  getMousePosition: () => ipcRenderer.invoke("get-mouse-position")
});