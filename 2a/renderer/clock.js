// === MouseSpeedProvider: preleva velocità mouse dall'API se c'è, altrimenti fallback ===
function setupMouseSpeedSource(onSpeed) {
  
  let lastX=null, lastY=null, lastT=0;
  let rafPoll = 0, intPoll = 0;

  const emit = (x,y) => {
    const now = performance.now();
    if (lastX!=null) {
      const dx = x - lastX, dy = y - lastY;
      const dt = Math.max(1, now - lastT);
      const v = Math.hypot(dx, dy) / (dt/1000); // px/s
      onSpeed(v);
    }
    lastX = x; lastY = y; lastT = now;
  };

  // --- PRIORITÀ 1: API con event stream (push) ---
  // Prova vari naming comuni: API.onMouseMove, API.on('mouse'), API.subscribeMouse
  try {
    if (window.API?.onMouseMove) {
      window.API.onMouseMove(({x,y}) => emit(x,y));
      return () => {};
    }
    if (window.API?.mouse?.on) {
      window.API.mouse.on('move', ({x,y}) => emit(x,y));
      return () => {};
    }
    if (window.API?.on && window.API.on.bind) {
      window.API.on('mouseMove', ({x,y}) => emit(x,y));
      return () => {};
    }
  } catch(_) {}

  // --- PRIORITÀ 2: API con polling (pull) ---
  // Prova metodi tipici: getMousePosition(), getMouse(), pointer()
  const pollers = [
    () => window.API?.getMousePosition?.(),
    () => window.API?.getMouse?.(),
    () => window.API?.pointer?.(),
  ].filter(Boolean);

  if (pollers.length) {
    const poll = () => {
      try {
        const res = pollers[0]();
        if (res && typeof res.then === 'function') {
          res.then(p => { if (p) emit(p.x ?? p.clientX, p.y ?? p.clientY); });
        } else if (res) {
          emit(res.x ?? res.clientX, res.y ?? res.clientY);
        }
      } catch(_) {}
      rafPoll = requestAnimationFrame(poll);
    };
    rafPoll = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafPoll);
  }

  // --- PRIORITÀ 3: fallback browser (pointermove ovunque nello schermo) ---
  const onMove = (e) => emit(e.clientX, e.clientY);
  window.addEventListener('pointermove', onMove, { passive:true });
  window.addEventListener('mousemove', onMove, { passive:true });
  // NB: se usi Electron con aree draggable, metti: #clock { -webkit-app-region: no-drag; }
  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('mousemove', onMove);
  };
}

(function () {
  const clockEl = document.getElementById("clock");
  if (!clockEl) return;

    // ===== HOUR ROW MODE (24 glifi '█' con lampeggio progressivo) =====

  function clearClock() {
    clockEl.innerHTML = '';
    clockEl.classList.remove('mode-grid');
    clockEl.classList.add('mode-hourrow');
  }

  function buildHourRow() {
    clearClock();
    const row = document.createElement('div');
    row.className = 'row row-24';
    clockEl.appendChild(row);

    const cells = [];
    for (let h = 0; h < 24; h++) {
      const cell = document.createElement('div');
      cell.className = 'cell cell-block';
      cell.textContent = '█';
      row.appendChild(cell);
      cells.push(cell);
    }
    return cells;
  }

  let hrCells = null;
  let hrRaf = 0;

  // mappa lineare
  function lerp(a,b,t){ return a + (b-a)*t; }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function startHourRow() {
    hrCells = buildHourRow();
    startGlyphWave(hrCells);
setupHoverTimeDigits(hrCells);

    // parametri blink
    const MIN_PERIOD = 0.50; // s (blink rapido vicino all’ora successiva)
    const MAX_PERIOD = 2.50; // s (blink lento a inizio ora)

    const loop = (tms) => {
      const now = new Date();
      const H  = now.getHours();
      const M  = now.getMinutes();
      const S  = now.getSeconds();
      const ms = now.getMilliseconds();

      // progresso dentro l’ora (0..1)
      const secInHour = M*60 + S + ms/1000;
      const prog = clamp01(secInHour / 3600);

      // periodo di lampeggio in secondi: lento → veloce
      const period = lerp(MAX_PERIOD, MIN_PERIOD, prog);

      // square wave 0/1
      const t = (tms/1000) % period;
      const blinkOn = (t / period) < 0.5;

      // disegna i 24 glifi
      for (let i = 0; i < 24; i++) {
        const c = hrCells[i];
        if (!c) continue;
        if (i === H) {
          c.style.opacity = blinkOn ? '1' : '0';
          c.classList.add('is-active');
        } else {
          c.style.opacity = '1';
          c.classList.remove('is-active');
        }
      }

      hrRaf = requestAnimationFrame(loop);
    };

    cancelAnimationFrame(hrRaf);
    hrRaf = requestAnimationFrame(loop);
  }

  function stopHourRow() {
    cancelAnimationFrame(hrRaf);
    hrRaf = 0;
  }

  // === Hover HHMM su 4 glifi (indici 10..13) con transizione a rampa ===
function setupHoverTimeDigits(cells){
  if (!cells || cells.length < 14) return;

  const IDX = [10,11,12,13];                  // glifi 11..14
  const RAMP_FWD = [' ', '▛', '▚', '▝', '╫', '┼', '─'];
  const RAMP = RAMP_FWD.concat(RAMP_FWD.slice(1,-1).reverse()); // ~rampa avanti+indietro
  const DURATION = 240;                       // ms animazione

  let saved = null;                           // salviamo i 4 glifi originali
  let timer = 0;                              // per aggiornare HH:MM ogni secondo

  function readHHMM(){
    const d = new Date();
    const H = String(d.getHours()).padStart(2,'0');
    const M = String(d.getMinutes()).padStart(2,'0');
    return [H[0], H[1], M[0], M[1]];         // HHMM
  }

  // animazione: percorre la RAMP e alla fine imposta il carattere target
  function animateRampTo(el, targetChar, dur = DURATION){
    const start = performance.now();
    function step(now){
      const u = Math.max(0, Math.min(1, (now - start)/dur));
      const idx = Math.min(RAMP.length-1, Math.floor(u * RAMP.length));
      if (u < 1) {
        const g = RAMP[idx] ?? el.textContent;
        if (el.textContent !== g) el.textContent = g;
        requestAnimationFrame(step);
      } else {
        if (el.textContent !== targetChar) el.textContent = targetChar;
      }
    }
    requestAnimationFrame(step);
  }

  function applyDigits(animated=true){
    const digits = readHHMM();
    for (let k=0; k<4; k++){
      const i = IDX[k];
      const el = cells[i];
      if (!el) continue;
      el.dataset.locked = '1';               // blocca da startGlyphWave
      if (animated) animateRampTo(el, digits[k]);
      else el.textContent = digits[k];
    }
  }

  function restore(animated=true){
    if (!saved) return;
    for (let k=0; k<4; k++){
      const i = IDX[k];
      const el = cells[i];
      if (!el) continue;
      const base = saved[k];
      if (animated) animateRampTo(el, base);
      else el.textContent = base;
      delete el.dataset.locked;              // sblocca la wave
    }
    saved = null;
  }

  function onEnter(){
    if (saved) return;                        // già in hover
    saved = IDX.map(i => cells[i]?.textContent ?? '█');
    applyDigits(true);
    clearInterval(timer);
    // aggiorna le cifre durante l'hover (una volta al secondo basta)
    timer = setInterval(() => applyDigits(false), 1000);
  }

  function onLeave(){
    clearInterval(timer);
    timer = 0;
    restore(true);
  }

  // hover sull'intero body
  document.body.addEventListener('mouseenter', onEnter, true);
  document.body.addEventListener('mouseleave', onLeave,  true);
}


  /** Crea la griglia 24×60 e restituisce un Array di 1440 celle in ordine cronologico */

  function buildGrid() {
    const cells = [];
    for (let h = 0; h < 24; h++) {
      const row = document.createElement("div");
      row.className = "row";
      clockEl.appendChild(row);

      for (let m = 0; m < 60; m++) {
        const idx = h * 60 + m;
        const cell = document.createElement("div");
        cell.className = "cell";
        row.appendChild(cell);
        cells.push(cell);
      }
    }
    return cells;
  }

  const cells = buildGrid();
  const TOTAL_MIN = 24 * 60; // 1440

  /** Minuti trascorsi dall'inizio della giornata locale */
  function minutesSinceStartOfDay(d = new Date()) {
    return d.getHours() * 60 + d.getMinutes();
  }


  /** Aggiorna lo stato delle celle in base all’ora corrente */
  function paintNow() {
    const now = new Date();
    const elapsed = minutesSinceStartOfDay(now); // 0..1439 (minuto corrente)
    // Se è dopo mezzanotte (es. 00:05) e ieri avevamo celle piene, pulisci tutto
    for (let i = 0; i < TOTAL_MIN; i++) {
      const c = cells[i];
      if (!c) continue;
      if (i < elapsed) {
        c.classList.add("filled");
      } else {
        c.classList.remove("filled");
      }
    }
    //remove aria-current="true" from all cells
    for (const c of cells) c.removeAttribute("aria-current");
    //add aria-current="true" to the current cell
    // Evidenzia il minuto corrente (l’indice "elapsed")
    const current = cells[Math.min(elapsed, TOTAL_MIN - 1)];
    if (current) current.setAttribute("aria-current", "true");
  }



// === ONE-SHOT WAVE (multi-run): puoi retriggerare mentre un'onda è in corso ===
function startGlyphWave(cells){
  if (!cells || cells.length !== 24) return;

  const baseGlyphs = cells.map(el => el.textContent || '█');
  const RAMP_FWD = [' ', '▛', '▚', '▝', '╫', '┼', '─'];
  const RAMP = RAMP_FWD.concat(RAMP_FWD.slice(1,-1).reverse()); // es. 12 step
  const GLYPH_DUR = 520;     // ms: durata passaggio rampa su 1 glifo

  // trigger & velocità
  const THRESHOLD = 400;     // px/s per partire
  const MIN_DELAY = 30;      // ms tra glifi (onda veloce)
  const MAX_DELAY = 200;     // ms tra glifi (onda lenta)
  const ALPHA = 0.25;        // smoothing velocità
  const RETRIGGER_GUARD = 180;// ms: minima distanza tra due trigger (anti-rimbalzo)
  let speedSm = 0;
  let lastTriggerAt = 0;

  // onde attive: {start, delay, end}
  const waves = [];
  let rafId = 0;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const map   = (v,a1,b1,a2,b2)=> a2 + (b2-a2) * clamp((v-a1)/(b1-a1), 0, 1);

  // --- Sorgente velocità (API-first, già definita sopra) ---
  const cancelSpeed = setupMouseSpeedSource((v)=>{
    speedSm = (1-ALPHA)*speedSm + ALPHA*v;
    const now = performance.now();
    if (speedSm > THRESHOLD && (now - lastTriggerAt) > RETRIGGER_GUARD) {
      lastTriggerAt = now;
      const delayBetween = map(speedSm, THRESHOLD, 2000, MAX_DELAY, MIN_DELAY);
      // aggiungi una NUOVA onda, senza toccare quelle in corso
      const start = performance.now();
      const end = start + delayBetween*(cells.length-1) + GLYPH_DUR;
      waves.push({ start, delay: delayBetween, end });
      // se non stiamo già renderizzando, avvia il RAF
      if (!rafId) rafId = requestAnimationFrame(render);
    }
  });

  function render(ts){
    const now = performance.now();

    // ripulisci onde finite
    for (let i = waves.length - 1; i >= 0; i--) {
      if (now >= waves[i].end) waves.splice(i, 1);
    }

    // per ogni cella scegli il glifo da mostrare:
    // preferisci l'onda più recente che sta “toccando” quella cella
    for (let i = 0; i < cells.length; i++) {
      let chosen = null;    // { local, start, glyphChar }
      for (let k = 0; k < waves.length; k++) {
        const w = waves[k];
        const local = (now - w.start) - i * w.delay; // ms
        if (local > 0 && local < GLYPH_DUR) {
          // questa onda sta interessando il glifo i
          const u = clamp(local / GLYPH_DUR, 0, 1);
          const idx = Math.min(RAMP.length-1, Math.floor(u * RAMP.length));
          const g = RAMP[idx] ?? baseGlyphs[i];
          // tieni la più recente (start maggiore)
          if (!chosen || w.start > chosen.start) {
            chosen = { local, start: w.start, glyphChar: g };
          }
        }
      }
      if (cells[i].dataset.locked === '1') continue;

const targetGlyph = chosen ? chosen.glyphChar : baseGlyphs[i];
if (cells[i].textContent !== targetGlyph) cells[i].textContent = targetGlyph;
    }

    // continua finché ci sono onde attive
    if (waves.length) {
      rafId = requestAnimationFrame(render);
    } else {
      rafId = 0; // fermo il loop finché non arriva un nuovo trigger
      // assicura ripristino totale (nel caso di residui)
      for (let i=0; i<cells.length; i++){
        const g0 = baseGlyphs[i];
        if (cells[i].textContent !== g0) cells[i].textContent = g0;
      }
    }
  }

  // opzionale, se un giorno ti servirà spegnere la sorgente
  startGlyphWave.cancel = () => { try { cancelSpeed && cancelSpeed(); } catch(_){} };
}

  /** Re-sync quando torni in foreground o cambi visibilità della pagina */
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) paintNow();
  });

  /** Reset a mezzanotte: calcola i ms fino alla prossima mezzanotte locale */
  function scheduleMidnightReset() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const ms = midnight - now;
    setTimeout(() => {
      // A mezzanotte pulisci e riparti
      for (const c of cells) { 
  c.classList.remove("filled"); 
  c.removeAttribute("aria-current"); 
}

      paintNow();
      scheduleMidnightReset(); // programma il prossimo
    }, ms);
  }

  function showClock() {
    let cells = document.querySelectorAll(".cell");
    cells.forEach((cell, i) => {
      setTimeout(() => {
        cell.style.opacity = "1";
      }, 5 * i);
    });
  }

  //dati ricevuti da render.js
  window.addEventListener("batteryUpdate", (e) => {
    // const data = e.detail;
    // let cells = document.querySelectorAll(".cell");
  });

   window.addEventListener("cpuLoadUpdate", (e) => {
    const data = e.detail;
    const clock = document.getElementById("clock");
    // Applica la rotazione SOLO nella vecchia modalità griglia minuti
    if (clock && clock.classList.contains("mode-grid")) {
      let cells = document.querySelectorAll(".cell");
      let dataValue = map(data.currentLoad, 0, 100, 0, 360);
      cells.forEach((cell) => {
        cell.style.transform = `rotate(${dataValue}deg)`;
      });
    }
  });


  //create a map function from 0 to 360 
  function map(value, min, max, minOut, maxOut) {
    return (value - min) / (max - min) * (maxOut - minOut) + minOut;
  }

   // Avvio modalità 24 ore a glifi
  startHourRow();


})();
