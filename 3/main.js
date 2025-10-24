const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");

let windows = [];

function createWindow(id, position = { x: 100, y: 100 }) {
  const win = new BrowserWindow({
    width: 40,
    height: 50,
    x: position.x,
    y: position.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile("renderer/character.html");
  
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('character-id', id);
    console.log(`Finestra creata per: ${id}`);
  });

  windows.push({ id, window: win });
  return win;
}

app.whenReady().then(() => {
  console.log("App avviata - creazione finestre personaggi");

  // Crea finestre per tutti i personaggi
  createWindow('you', { x: 100, y: 100 });
  createWindow('friend', { x: 200, y: 100 });
  createWindow('friend2', { x: 300, y: 100 });

  // Handler per aggiornamenti posizione locale (TUO personaggio)
  ipcMain.on('update-character-position', (event, { id, x, y }) => {
    const winData = windows.find(w => w.id === id);
    if (winData) {
      winData.window.setPosition(x, y);
      console.log(`Posizione aggiornata per ${id}: (${x}, ${y})`);
      
      // Inoltra a tutte le altre finestre come aggiornamento remoto
      windows.forEach(({ id: otherId, window }) => {
        if (otherId !== id && window && !window.isDestroyed()) {
          window.webContents.send('remote-position-update', { 
            characterId: id, 
            position: { x, y } 
          });
        }
      });
    }
  });

  // NUOVO: Handler per aggiornare finestre remote
  ipcMain.on('update-remote-window-position', (event, { characterId, x, y }) => {
    console.log(`Movimento finestra remota per ${characterId}: (${x}, ${y})`);
    
    const winData = windows.find(w => w.id === characterId);
    if (winData && winData.window && !winData.window.isDestroyed()) {
      winData.window.setPosition(x, y);
    }
  });

  // Handler per controllo heartbeat
  ipcMain.on('request-heartbeat-check', (event) => {
    windows.forEach(({ window }) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send('request-heartbeat-check');
      }
    });
  });

  // Handler per ottenere posizione mouse
  ipcMain.handle("get-mouse-position", () => {
    return screen.getCursorScreenPoint();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on('before-quit', () => {
  console.log("App in chiusura...");
});