const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } = require("electron");
const path = require("path");
const si = require("systeminformation");

let mainWindow;
let tray;
let trayAnimationInterval;

const w = 300;
const h = 300;

// Array dei frame per l'animazione dell'icona nella tray
const trayFrames = [
  "1.png",
"2.png",
"3.png",
"4.png",
"5.png",
"6.png",
"7.png",
"8.png",
"9.png",
"10.png",
];

// Funzione per creare la finestra principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: w,
    height: h,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  // mainWindow.setPosition(1200, 800, true);
  mainWindow.loadFile("renderer/index.html");
  return mainWindow;
}

// Funzione per creare la finestra delle impostazioni
function createSettingsWindow() {
  const win = new BrowserWindow({
    width: 300,
    height: 300,
    title: "Index Settings",
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("renderer/settings.html");
}

// Funzione per animare l'icona nella tray
function animateTrayIcon() {
  let frame = 0;

  trayAnimationInterval = setInterval(() => {
    const iconPath = path.join(__dirname, "assets", trayFrames[frame]);
    const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray.setImage(image);
    frame = (frame + 1) % trayFrames.length;
  }, 90);
}

// Funzione per animare la finestra con un movimento di rimbalzo sullo schermo
function animateWindow(win) {
  const display = screen.getPrimaryDisplay();
  const screenWidth = display.workArea.width;
  const screenHeight = display.workArea.height;

  let x = 0;
  let y = 0;
  let dx = 2;
  let dy = 2;
  const width = w;
  const height = h;

  setInterval(() => {
    x += dx;
    y += dy;

    if (x <= 0 || x + width >= screenWidth) dx *= -1;
    if (y <= 0 || y + height >= screenHeight) dy *= -1;

    win.setBounds({ x, y, width, height });
  }, 16);
}

// Funzioni esposte ai renderer process tramite ipc
ipcMain.handle("get-battery", async () => await si.battery());
ipcMain.handle("get-cpu", async () => await si.currentLoad());
ipcMain.handle("get-mem", async () => await si.mem());
ipcMain.handle("get-cpu-info", async () => await si.cpu());
ipcMain.handle("get-processes", async () => await si.processes());
ipcMain.handle("get-time-info", async () => await si.time());
ipcMain.handle("get-mouse-position", () => screen.getCursorScreenPoint());

// Avvio dell'applicazione
app.whenReady().then(() => {
  // Inizializza l'icona della tray
  const initialIcon = nativeImage
    .createFromPath(path.join(__dirname, "assets", "icon-0.png"))
    .resize({ width: 16, height: 16 });

  tray = new Tray(initialIcon);
  tray.setToolTip("Is active!");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Settings", click: () => ipcMain.emit("open-settings") },
      { type: "separator" },
      { label: "Quit", role: "quit" },
    ])
  );

  const win = createWindow();
  // animateWindow(win); // opzionale: attiva animazione della finestra

  animateTrayIcon(); // Avvia l'animazione dell'icona nella tray

  // Listener per apertura finestra impostazioni
  ipcMain.on("open-settings", () => {
    createSettingsWindow();
  });

  // Listener per apertura finestra posizione del mouse (se implementata)
  ipcMain.on("open-mouse-position", () => {
    createMousePositionWindow(); // da implementare eventualmente
  });
});

// Uscita dall'applicazione quando tutte le finestre sono chiuse
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
