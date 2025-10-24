(function () {
  // IMPORTANTE: Questi ID devono corrispondere a quelli nel database
  let yourID = 7;        // Il tuo ID
  let friendID = 9;      // Amico 1
  let friendID2 = 4;     // Amico 2
  let table = "students";

  const SUPABASE_URL = "https://ukaxvfohnynqjvgzxtkk.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrYXh2Zm9obnlucWp2Z3p4dGtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzU5NzgsImV4cCI6MjA3NjAxMTk3OH0.dZIYwmU-DYSgZFqmpEGXnwb8mm1pYGTU7As9ZrlFWL4";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let channel;
  let lastSavedPosition = null;
  let lastHeartbeats = {
    'friend': 0,
    'friend2': 0
  };

  // Mappa ID database -> characterId
  const idToCharacterMap = {
    9: 'friend',   // friendID -> 'friend'
    4: 'friend2',  // friendID2 -> 'friend2'
    7: 'you'       // yourID -> 'you' (solo per riferimento)
  };

  // Mappa characterId -> ID database (inversa)
  const characterToIdMap = {
    'friend': 9,
    'friend2': 4,
    'you': 7
  };

  async function initialize() {
    console.log("Inizializzazione DB...");
    await loadInitialData();
    subscribeRealtime();
    startPositionTracking();
    startHeartbeatCheck();
  }

  async function loadInitialData() {
    try {
      console.log("Caricamento dati iniziali...");
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .in('id', [friendID, friendID2])
        .order('updated_at', { ascending: false });

      if (error) {
        console.error("Errore nel caricamento dati iniziali:", error);
        return;
      }

      console.log("Dati iniziali caricati:", data);

      const dataByUser = {};
      data.forEach(item => {
        dataByUser[item.id] = item;
        const characterId = idToCharacterMap[item.id];
        if (characterId && item.data && item.data.heartbeat) {
          lastHeartbeats[characterId] = item.data.heartbeat;
          console.log(`Heartbeat iniziale per ${characterId}: ${item.data.heartbeat}`);
        }
      });

      // Aggiorna posizioni iniziali degli amici
      if (dataByUser[friendID] && dataByUser[friendID].data && dataByUser[friendID].data.position) {
        updateRemotePosition('friend', dataByUser[friendID].data.position);
      }

      if (dataByUser[friendID2] && dataByUser[friendID2].data && dataByUser[friendID2].data.position) {
        updateRemotePosition('friend2', dataByUser[friendID2].data.position);
      }
      
    } catch (err) {
      console.error("Errore nel caricamento dati iniziali:", err);
    }
  }

  function startPositionTracking() {
    // Ascolta gli aggiornamenti di posizione dal character.js
    window.addEventListener('characterPositionUpdate', async (e) => {
      console.log("Salvataggio posizione nel DB:", e.detail);
      await savePosition(e.detail);
    });

    // Ascolta le richieste di controllo heartbeat
    window.addEventListener('requestHeartbeatCheck', () => {
      console.log("Invio heartbeat check:", lastHeartbeats);
      const event = new CustomEvent('checkConnection', { detail: lastHeartbeats });
      window.dispatchEvent(event);
    });
  }

  async function savePosition(position) {
    // Salva solo se la posizione è cambiata significativamente
    if (lastSavedPosition && 
        Math.abs(position.x - lastSavedPosition.x) < 2 && 
        Math.abs(position.y - lastSavedPosition.y) < 2) {
      return;
    }

    const input = {
      id: yourID,
      data: {
        position: position,
        heartbeat: Date.now(),
      },
      updated_at: new Date(),
    };

    console.log("Salvataggio nel DB:", input);

    const { error } = await supabase.from(table).upsert([input]);
    if (error) {
      console.error("Errore nel salvataggio:", error.message);
    } else {
      lastSavedPosition = { ...position };
      console.log("Posizione salvata con successo");
    }
  }

  function startHeartbeatCheck() {
    setInterval(() => {
      const event = new CustomEvent('checkConnection', { detail: lastHeartbeats });
      window.dispatchEvent(event);
    }, 10000);
  }

  function subscribeRealtime() {
    if (channel) {
      supabase.removeChannel(channel);
    }

    console.log("Sottoscrizione realtime...");

    channel = supabase
      .channel("public:" + table)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: table },
        (payload) => {
          const data = payload.new;
          console.log("Aggiornamento realtime ricevuto:", data);

          const characterId = idToCharacterMap[data.id];
          
          if (characterId && characterId !== 'you') {
            // Aggiorna heartbeat
            if (data.data && data.data.heartbeat) {
              lastHeartbeats[characterId] = data.data.heartbeat;
              console.log(`Heartbeat aggiornato per ${characterId}: ${data.data.heartbeat}`);
            }
            
            // Aggiorna posizione
            if (data.data && data.data.position) {
              console.log(`Posizione aggiornata per ${characterId}:`, data.data.position);
              updateRemotePosition(characterId, data.data.position);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("Stato sottoscrizione realtime:", status);
        if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          console.log("Riconnessione realtime in 3 secondi...");
          setTimeout(subscribeRealtime, 3000);
        }
      });
  }

  function updateRemotePosition(characterId, position) {
    if (position && characterId) {
      console.log(`Invio aggiornamento posizione per ${characterId}:`, position);
      
      // Invia l'evento direttamente al character.js
      const event = new CustomEvent('remotePositionUpdate', { 
        detail: { characterId, position } 
      });
      window.dispatchEvent(event);
    }
  }

  // Inizializza quando il DOM è pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();