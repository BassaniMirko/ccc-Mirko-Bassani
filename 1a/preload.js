const { contextBridge, ipcRenderer } = require("electron");

//fa da bridge tra il renderer process e il main process
contextBridge.exposeInMainWorld("API", {
  openSettings: () => ipcRenderer.send("open-settings"),
  getBattery: () => ipcRenderer.invoke("get-battery"),
  getCpuLoad: () => ipcRenderer.invoke("get-cpu"),
  getMemory: () => ipcRenderer.invoke("get-mem"),
  getCpuInfo: () => ipcRenderer.invoke("get-cpu-info"),
  getProcesses: () => ipcRenderer.invoke("get-processes"),
  getTimeInfo: () => ipcRenderer.invoke("get-time-info"),
  getMousePosition: () => ipcRenderer.invoke("get-mouse-position"),
});
