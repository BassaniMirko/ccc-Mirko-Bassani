function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

//variable font
const font = document.getElementById("font");
let fontWeight = 32,
  fontSlant = 0,
  fontWidth = 100;

async function updateStats() {
  try {
    const battery = await window.API.getBattery();
    const cpuLoad = await window.API.getCpuLoad();
    const mem = await window.API.getMemory();
    const cpuInfo = await window.API.getCpuInfo();
    const processes = await window.API.getProcesses();
    const timeInfo = await window.API.getTimeInfo();

    //   //questa funzione serve per inviare a clock il suo valore
    window.dispatchEvent(new CustomEvent("batteryUpdate", { detail: battery }));
    window.dispatchEvent(new CustomEvent("cpuLoadUpdate", { detail: cpuLoad }));

    // Battery
    document.getElementById("batteria").innerText = battery.hasBattery
      ? battery.percent.toFixed(0)
      : "N/A";

    // CPU Load
    const cpuPercent = cpuLoad.currentLoad.toFixed(1);
    document.getElementById("cpu").innerText = cpuPercent;

    // RAM Usage
    const ramPercent = ((mem.active / mem.total) * 100).toFixed(1);
    document.getElementById("ram").innerText = ramPercent;

    // CPU Thermometer
    document.getElementById("cpu-thermometer-label").innerText =
      cpuPercent + "%";

    // Uptime
    document.getElementById("uptime").innerText = formatTime(timeInfo.uptime);
    fontSlant = mapRange(cpuPercent, 0, 100, 0, 24);

    // Time now not timeInfo
    let timeNow = new Date();
    document.getElementById("time").innerText = formatTime(
      timeNow.getHours() * 3600 +
        timeNow.getMinutes() * 60 +
        timeNow.getSeconds()
    );
  } catch (err) {
    console.error("Errore nel caricamento statistiche:", err);
  }
}

async function showMouseCoords() {
  const pos = await window.API.getMousePosition();
  // console.log(`Mouse: x=${pos.x}, y=${pos.y}`);
  document.getElementById(
    "mouse-coords"
  ).innerText = `X: ${pos.x}, Y: ${pos.y}`;
  fontWeight = mapRange(pos.x, 0, 1500, 32, 120);
}

//create
function mapRange(value, a, b, c, d) {
  value = (value - a) / (b - a);
  return c + value * (d - c);
}

setInterval(showMouseCoords, 10);
setInterval(updateStats, 500);
updateStats();
