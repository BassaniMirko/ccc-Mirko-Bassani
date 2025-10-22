const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
const lerp  = (a,b,t)=>a+(b-a)*t;
const map   = (v,inA,inB,outA,outB)=>outA+(clamp(v,inA,inB)-inA)*(outB-outA)/(inB-inA);

function formatTime(seconds){
  const h=Math.floor(seconds/3600), m=Math.floor((seconds%3600)/60), s=Math.floor(seconds%60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}


const xorCanvas = document.getElementById('xorCanvas');
const ctx = xorCanvas.getContext('2d', { alpha: true });

function resizeCanvas(){
  const dpr = Math.min(2, window.devicePixelRatio||1);
  xorCanvas.width  = Math.floor(innerWidth  * dpr);
  xorCanvas.height = Math.floor(innerHeight * dpr);
  xorCanvas.style.width  = innerWidth  + 'px';
  xorCanvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0); // coord in CSS px
}
addEventListener('resize', resizeCanvas);
resizeCanvas();


let lastMouse = { x: 0, y: 0, t: performance.now() };
let mouseSpeed = 0; // px/s

// angoli (deg) e velocità (deg/s) per i triangoli pilotati dai dati
const state = {
  battery: { angle: 0, speed: 60 },   // batteria
  cpu:     { angle: 0, speed: 60 },  // cpu
  ram:     { angle: 0, speed: 60 },   // ram
  uptime:  { angle: 0, speed: 60 },   // uptime (ore)
  thermo:  { angle: 0, speed: 60 },  // alias cpu/temperatura
  mouseX:  { angle: 0, speed: 0 },    // guidato da X del mouse
  mouseY:  { angle: 0, speed: 0 },    // guidato da Y del mouse
};

/* ===================== utils disegno triangolo equilatero ===================== */
function drawEquilateralTriangle(ctx, cx, cy, size, angleDeg){
  const a = angleDeg * Math.PI/180;
  const h = Math.sqrt(3)/2 * size;
  const pts = [
    { x: 0,        y: -2*h/3 },  // top
    { x: -size/2,  y:  h/3   },  // left
    { x:  size/2,  y:  h/3   }   // right
  ];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Disegna con XOR: le zone in pari sovrapposizione diventano trasparenti (vuoto)
function drawTrianglesXOR(anglesDegArray, opts = {}){
  const {
    cx = innerWidth/2,
    cy = innerHeight/2,
    size = Math.min(innerWidth, innerHeight) * 1,
    color = '#000' // su sfondo chiaro: nero
  } = opts;

  // pulizia
  ctx.clearRect(0, 0, xorCanvas.width, xorCanvas.height);

  // set riempimento
  ctx.fillStyle = color;

  // per ogni triangolo: compositing XOR
  for(let i=0;i<anglesDegArray.length;i++){
    ctx.globalCompositeOperation = 'xor';
    drawEquilateralTriangle(ctx, cx, cy, size, anglesDegArray[i]);
  }

  // reset compositing
  ctx.globalCompositeOperation = 'source-over';
}

/* ===================== input: mouse ===================== */
async function showMouseCoords(){
  try{
    const pos = await window.API.getMousePosition();
    const now = performance.now();
    const dt  = Math.max(1, now - lastMouse.t);
    const dx  = pos.x - lastMouse.x;
    const dy  = pos.y - lastMouse.y;
    mouseSpeed = Math.hypot(dx, dy) / (dt/1000); // px/s
    lastMouse = { x: pos.x, y: pos.y, t: now };

    const hud = document.getElementById("mouse-coords");
    if (hud) hud.innerText = `X: ${pos.x}, Y: ${pos.y}`;

    const xNorm = pos.x / Math.max(1, window.innerWidth);
    const yNorm = pos.y / Math.max(1, window.innerHeight);

    // velocità per i triangoli mouseX/mouseY (range ampio + boost dalla velocità fisica)
    const speedFromX = map(xNorm, 0,1, 0, 240);
    const speedFromY = map(yNorm, 0,1, 0, 540);
    const speedBoost = clamp(mouseSpeed, 0, 600) * 0.2; // max +120

    state.mouseX.speed = speedFromX + speedBoost;
    state.mouseY.speed = speedFromY + speedBoost;
  }catch(e){
    // fall back: nessun mouse
  }
}

/* ===================== input: stats di sistema ===================== */
async function updateStats(){
  try{
    const battery  = await window.API.getBattery();
    const cpuLoad  = await window.API.getCpuLoad();
    const mem      = await window.API.getMemory();
    const timeInfo = await window.API.getTimeInfo();

    const batteryEl = document.getElementById("battery");
    const cpuEl     = document.getElementById("cpu");
    const ramEl     = document.getElementById("ram");
    const uptimeEl  = document.getElementById("uptime");
    const thermoEl  = document.getElementById("cpu-thermometer-label");

    const battVal = battery.hasBattery ? Number(battery.percent) : 50;
    const cpuPct  = Number(cpuLoad.currentLoad.toFixed(1));
    const ramPct  = Number(((mem.active / mem.total) * 100).toFixed(1));
    const hoursUp = Math.floor(timeInfo.uptime / 3600) % 24;

    if (batteryEl) batteryEl.innerText = battery.hasBattery ? battVal.toFixed(0) : "N/A";
    if (cpuEl)     cpuEl.innerText     = cpuPct.toFixed(1);
    if (ramEl)     ramEl.innerText     = ramPct.toFixed(1);
    if (uptimeEl)  uptimeEl.innerText  = formatTime(timeInfo.uptime);
    if (thermoEl)  thermoEl.innerText  = cpuPct + "%";

    // map dati -> velocità rotazione (deg/s)
    state.battery.speed = map(battVal, 0,100, 30, 360);  // più carica, più veloce
    state.cpu.speed     = map(cpuPct,  0,100, 20, 480);
    state.ram.speed     = map(ramPct,  0,100, 10, 180);
    state.uptime.speed  = map(hoursUp, 0, 23,  5, 120);
    state.thermo.speed  = map(cpuPct,  0,100, 50, 540);

  }catch(e){
    // fall back: lascia le speed attuali
  }
}

/* ===================== animazione continua (RAF) ===================== */
let lastTS = performance.now();

function tick(nowTS){
  const dt = (nowTS - lastTS)/1000;
  lastTS = nowTS;

  // integra angoli
  state.battery.angle = (state.battery.angle + state.battery.speed * dt) % 360;
  state.cpu.angle     = (state.cpu.angle     + state.cpu.speed     * dt) % 360;
  state.ram.angle     = (state.ram.angle     + state.ram.speed     * dt) % 360;
  state.uptime.angle  = (state.uptime.angle  + state.uptime.speed  * dt) % 360;
  state.thermo.angle  = (state.thermo.angle  + state.thermo.speed  * dt) % 360;
  state.mouseX.angle  = (state.mouseX.angle  + state.mouseX.speed  * dt) % 360;
  state.mouseY.angle  = (state.mouseY.angle  + state.mouseY.speed  * dt) % 360;

  // disegna su canvas con XOR (esclude le sovrapposizioni -> vuoto)
  drawTrianglesXOR([
    state.battery.angle,
    state.cpu.angle,
    state.ram.angle,
    state.uptime.angle,
    state.thermo.angle,
    state.mouseX.angle,
    state.mouseY.angle
  ], {
    cx: innerWidth/2,
    cy: innerHeight/2,
    size: Math.min(innerWidth, innerHeight) * 0.60,
    color: '#000' // su sfondo bianco: nero
  });

  requestAnimationFrame(tick);
}


setInterval(showMouseCoords, 150);
setInterval(updateStats,    800);

// kickoff
showMouseCoords();
updateStats();
requestAnimationFrame(tick);
