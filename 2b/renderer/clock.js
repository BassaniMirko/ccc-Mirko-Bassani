// === MouseSpeedProvider: lasciato per usi futuri (non usato qui) ===
const BASE_GLYPH   = '.';
const ACTIVE_GLYPH = '█';      // rettangolo pieno (puoi usare anche '■' o '▮')
const BASE_OPACITY = 0.25;     // opacità delle celle non attive


function setupMouseSpeedSource(onSpeed) {
  let lastX = null, lastY = null, lastT = 0;
  const emit = (x, y) => {
    const now = performance.now();
    if (lastX != null) {
      const dx = x - lastX, dy = y - lastY, dt = Math.max(1, now - lastT);
      onSpeed(Math.hypot(dx, dy) / (dt / 1000)); // px/s
    }
    lastX = x; lastY = y; lastT = now;
  };
  try {
    if (window.API?.onMouseMove) { window.API.onMouseMove(({x,y}) => emit(x,y)); return () => {}; }
    if (window.API?.mouse?.on)   { window.API.mouse.on('move', ({x,y}) => emit(x,y)); return () => {}; }
    if (window.API?.on?.bind)    { window.API.on('mouseMove', ({x,y}) => emit(x,y)); return () => {}; }
  } catch(_) {}
  const onMove = e => emit(e.clientX, e.clientY);
  window.addEventListener('pointermove', onMove, { passive:true });
  window.addEventListener('mousemove', onMove, { passive:true });
  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('mousemove', onMove);
  };
}

(function () {
  const clockEl = document.getElementById('clock');
  if (!clockEl) return;

  // --- Modalità / pulizia contenitore
  function clearClock(mode = 'secondgrid') {
    clockEl.innerHTML = '';
    clockEl.classList.remove('mode-grid','mode-hourrow','mode-minuterow','mode-secondrow','mode-secondgrid');
    clockEl.classList.add(`mode-${mode}`);
  }

  // --- Helpers secondi correnti (indice 0..3599 -> minuto*60 + secondo)
  function currentSecondIndex(d = new Date()) {
    return d.getMinutes() * 60 + d.getSeconds();
  }

  // --- Costruzione griglia 60×60 (3600 celle)
  function buildSecondGrid() {
  clearClock('secondgrid');

  const grid = document.createElement('div');
  grid.className = 'grid grid-60x60';
  clockEl.appendChild(grid);

  const cells = [];
  for (let i = 0; i < 3600; i++) {
    const c = document.createElement('div');
    c.className = 'cell cell-block';
    c.textContent = BASE_GLYPH;               // base: punto
    c.style.opacity = String(BASE_OPACITY);   // attenuato
    grid.appendChild(c);
    cells.push(c);
  }
  return cells;
}

  // --- Loop: evidenzia solo la cella del secondo corrente (nessun lampeggio)
  let secCells = null;
  let secRaf = 0;
  let lastIdx = -1;

  function startSecondGrid() {
  secCells = buildSecondGrid();
  lastIdx = -1;

  const loop = () => {
    if (!secCells || secCells.length !== 3600) {
      secRaf = requestAnimationFrame(loop);
      return;
    }

    const now = new Date();
    const idx = currentSecondIndex(now); // 0..3599

    if (idx !== lastIdx) {
      // ripristina la precedente
      if (lastIdx !== -1) {
        const prev = secCells[lastIdx];
        if (prev) {
          prev.classList.remove('is-active');
          prev.textContent = BASE_GLYPH;                // torna al punto
          prev.style.opacity = String(BASE_OPACITY);    // torna attenuato
        }
      }

      // attiva la cella corrente
      const cur = secCells[idx];
      if (cur) {
        cur.classList.add('is-active');
        cur.textContent = ACTIVE_GLYPH; // rettangolo pieno
        cur.style.opacity = '1';
      }

      lastIdx = idx;
    }

    secRaf = requestAnimationFrame(loop);
  };

  cancelAnimationFrame(secRaf);
  secRaf = requestAnimationFrame(loop);
}


  // Avvio
  startSecondGrid();
})();
