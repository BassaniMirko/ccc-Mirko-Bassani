class CharacterAnimator {
  constructor() {
    this.characterId = null;
    this.currentPosition = { x: 100, y: 100 };
    this.targetPosition = { x: 100, y: 100 };
    this.velocity = { x: 0, y: 0 };
    
    // Configurazione per ogni personaggio
    this.characterAssets = {
      'you': 'pg1',
      'friend': 'pg2', 
      'friend2': 'pg3'
    };
    
    this.sprites = {
      idle: ['fermo.png', 'fermo2.png'],
      walk: Array.from({length: 12}, (_, i) => `${(i + 1).toString().padStart(2, '0')}.png`)
    };
    
    this.direction = 'right';
    this.isWalking = false;
    this.isFollowing = false;
    this.isActive = true;
    this.currentFrame = 0;
    this.idleFrame = 0;
    this.idleInterval = null;
    this.lastMouseMoveTime = Date.now();
    this.randomMoveTarget = null;
    this.randomMoveStartTime = null;
    this.offScreenPosition = { x: -100, y: 300 };
    this.entering = false;
    this.leaving = false;
    this.lastHeartbeat = Date.now();
    
    // Parametri di movimento
    this.maxSpeed = 8;
    this.followSpeed = 3;
    this.randomMoveSpeed = 1;
    this.followDistance = 80;
    this.stopDistance = 20;
    
    this.init();
  }

  init() {
    console.log("CharacterAnimator inizializzato");

    // Ricevi ID del personaggio
    window.electronAPI.receiveCharacterId((id) => {
      this.characterId = id;
      console.log(`Character ID assegnato: ${id}`);
      
      if (id === 'you') {
        this.isActive = true;
        this.startLocalMouseTracking();
        this.startRandomMovement();
        
        // Invia posizione iniziale
        setTimeout(() => {
          this.sendPositionUpdate();
        }, 1000);
      } else {
        // Personaggi remoti inizialmente disconnessi
        this.isActive = false;
        this.currentPosition = { ...this.offScreenPosition };
        this.setIdle();
        console.log(`${id} inizializzato come disconnesso`);
      }
    });

    // Ascolta aggiornamenti di posizione remoti da Electron
    window.electronAPI.onRemotePositionUpdate((data) => {
      console.log(`Ricevuto aggiornamento remoto in character.js per ${data.characterId}:`, data);
      
      if (data.characterId === this.characterId && this.characterId !== 'you') {
        console.log(`Applico aggiornamento posizione per ${this.characterId}`);
        
        if (!this.isActive && !this.entering) {
          this.enterScene();
        }
        
        this.targetPosition = data.position;
        this.isFollowing = true;
        this.isActive = true;
        this.lastHeartbeat = Date.now();
      }
    });

    // Ascolta richieste di heartbeat check
    window.electronAPI.onRequestHeartbeatCheck(() => {
      if (this.characterId === 'you') {
        console.log("Richiesto heartbeat check - invio posizione");
        this.sendPositionUpdate();
      }
    });

    // Ascolta aggiornamenti dal database
    window.addEventListener('remotePositionUpdate', (event) => {
      const { characterId, position } = event.detail;
      console.log(`Evento DB ricevuto per ${characterId}:`, position);
      
      if (characterId === this.characterId && this.characterId !== 'you') {
        console.log(`Applico aggiornamento DB per ${this.characterId}`);
        
        if (!this.isActive && !this.entering) {
          this.enterScene();
        }
        
        this.targetPosition = position;
        this.isFollowing = true;
        this.isActive = true;
        this.lastHeartbeat = Date.now();
      }
    });

    this.setIdle();
    this.startAnimationLoop();
    this.startConnectionCheck();
  }

  startConnectionCheck() {
    setInterval(() => {
      if (this.characterId !== 'you' && this.isActive) {
        const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
        console.log(`${this.characterId} - tempo dall'ultimo heartbeat: ${timeSinceLastHeartbeat}ms`);
        
        if (timeSinceLastHeartbeat > 30000) { // 30 secondi di timeout
          console.log(`${this.characterId} disconnesso - timeout`);
          this.leaveScene();
        }
      }
      
      // Richiedi heartbeat check periodico
      if (this.characterId === 'you') {
        window.electronAPI.requestHeartbeatCheck();
      }
    }, 5000);
  }

  enterScene() {
    console.log(`${this.characterId} sta entrando in scena`);
    this.entering = true;
    this.leaving = false;
    this.isActive = true;
    
    this.currentPosition = { x: -50, y: 300 };
    this.targetPosition = { x: 100, y: 300 };
    this.isFollowing = true;
  }

  leaveScene() {
    console.log(`${this.characterId} sta uscendo di scena`);
    this.leaving = true;
    this.entering = false;
    this.isFollowing = true;
    this.targetPosition = { ...this.offScreenPosition };
  }

  sendPositionUpdate() {
    if (this.characterId === 'you') {
      const roundedPos = {
        x: Math.round(this.currentPosition.x),
        y: Math.round(this.currentPosition.y)
      };
      
      console.log(`Invio posizione per ${this.characterId}:`, roundedPos);
      
      // Aggiorna posizione finestra via Electron
      window.electronAPI.updateCharacterPosition(
        this.characterId, 
        roundedPos.x, 
        roundedPos.y
      );

      // Invia evento per salvare nel database
      const event = new CustomEvent('characterPositionUpdate', { 
        detail: { x: roundedPos.x, y: roundedPos.y } 
      });
      window.dispatchEvent(event);
    }
  }

  // NUOVO: Metodo per muovere la finestra del personaggio remoto
  moveRemoteWindow() {
    if (this.characterId !== 'you' && this.isActive) {
      const roundedPos = {
        x: Math.round(this.currentPosition.x),
        y: Math.round(this.currentPosition.y)
      };
      
      console.log(`Movimento finestra remota per ${this.characterId}:`, roundedPos);
      
      // Richiedi a Electron di muovere la finestra
      window.electronAPI.updateRemoteWindowPosition(
        this.characterId,
        roundedPos.x,
        roundedPos.y
      );
    }
  }

  startLocalMouseTracking() {
    let lastSentPosition = { x: 0, y: 0 };
    
    setInterval(async () => {
      try {
        const mousePos = await window.electronAPI.getMousePosition();
        
        const targetX = mousePos.x + this.followDistance;
        const targetY = mousePos.y;
        
        const mouseMoved = Math.abs(mousePos.x - this.targetPosition.x) > 2 || 
                          Math.abs(mousePos.y - this.targetPosition.y) > 2;
        
        if (mouseMoved) {
          this.lastMouseMoveTime = Date.now();
          this.targetPosition = { x: targetX, y: targetY };
          this.isFollowing = true;
          this.randomMoveTarget = null;
        }
        
        // Invia aggiornamento posizione solo se significativamente cambiata
        const currentRoundedPos = {
          x: Math.round(this.currentPosition.x),
          y: Math.round(this.currentPosition.y)
        };
        
        const positionChanged = 
          Math.abs(currentRoundedPos.x - lastSentPosition.x) > 5 ||
          Math.abs(currentRoundedPos.y - lastSentPosition.y) > 5;
        
        if (positionChanged && this.characterId === 'you') {
          this.sendPositionUpdate();
          lastSentPosition = { ...currentRoundedPos };
        }
        
      } catch (err) {
        console.error("Errore nel tracciamento del mouse:", err);
      }
    }, 50);
  }

  startRandomMovement() {
    setInterval(() => {
      const timeSinceLastMove = Date.now() - this.lastMouseMoveTime;
      
      if (timeSinceLastMove > 2000 && !this.isFollowing && !this.randomMoveTarget && this.isActive) {
        this.startNewRandomMove();
      }
    }, 1000);
  }

  startNewRandomMove() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 100;
    
    this.randomMoveTarget = {
      x: this.currentPosition.x + Math.cos(angle) * distance,
      y: this.currentPosition.y + Math.sin(angle) * distance
    };
    this.randomMoveStartTime = Date.now();
    
    if (this.randomMoveTarget.x > this.currentPosition.x) {
      this.setDirection('right');
    } else {
      this.setDirection('left');
    }
  }

  startAnimationLoop() {
    setInterval(() => {
      this.updateMovement();
      this.updateAnimation();
      // NUOVO: Muovi la finestra per i personaggi remoti
      if (this.characterId !== 'you') {
        this.moveRemoteWindow();
      }
    }, 60);
  }

  updateMovement() {
    if (!this.isActive && !this.entering && !this.leaving) {
      this.setIdle();
      return;
    }

    let targetX, targetY;
    let speed = this.followSpeed;

    if (this.leaving) {
      targetX = this.targetPosition.x;
      targetY = this.targetPosition.y;
      speed = this.followSpeed;
      
      if (this.currentPosition.x < -100) {
        this.leaving = false;
        this.isActive = false;
        this.isFollowing = false;
        this.setIdle();
        return;
      }
    } else if (this.entering) {
      targetX = this.targetPosition.x;
      targetY = this.targetPosition.y;
      speed = this.followSpeed;
      
      const distanceToTarget = Math.sqrt(
        Math.pow(targetX - this.currentPosition.x, 2) + 
        Math.pow(targetY - this.currentPosition.y, 2)
      );
      
      if (distanceToTarget < 5) {
        this.entering = false;
        this.isFollowing = false;
        this.setIdle();
      }
    } else if (this.randomMoveTarget && !this.isFollowing) {
      targetX = this.randomMoveTarget.x;
      targetY = this.randomMoveTarget.y;
      speed = this.randomMoveSpeed;
      
      const distanceToTarget = Math.sqrt(
        Math.pow(targetX - this.currentPosition.x, 2) + 
        Math.pow(targetY - this.currentPosition.y, 2)
      );
      
      if (distanceToTarget < 5 || Date.now() - this.randomMoveStartTime > 5000) {
        this.randomMoveTarget = null;
        this.setIdle();
        return;
      }
    } else if (this.isFollowing) {
      targetX = this.targetPosition.x;
      targetY = this.targetPosition.y;
      
      const distance = Math.sqrt(
        Math.pow(targetX - this.currentPosition.x, 2) + 
        Math.pow(targetY - this.currentPosition.y, 2)
      );
      
      if (distance > 100) {
        speed = this.maxSpeed;
      } else if (distance < this.stopDistance) {
        this.isFollowing = false;
        this.setIdle();
        return;
      }
    } else {
      this.setIdle();
      return;
    }

    const dx = targetX - this.currentPosition.x;
    const dy = targetY - this.currentPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      this.velocity.x = (dx / distance) * speed;
      this.velocity.y = (dy / distance) * speed;
      
      this.currentPosition.x += this.velocity.x;
      this.currentPosition.y += this.velocity.y;
      
      if (dx > 0) {
        this.setDirection('right');
      } else {
        this.setDirection('left');
      }
      
      this.setWalking();
    }
  }

  updateAnimation() {
    if (this.isWalking && this.isActive) {
      this.currentFrame = (this.currentFrame + 1) % this.sprites.walk.length;
      this.updateSprite(this.sprites.walk[this.currentFrame]);
    }
  }

  setWalking() {
    if (!this.isWalking && this.isActive) {
      this.isWalking = true;
      this.stopIdleAnimation();
    }
  }

  setIdle() {
    if (this.isWalking || (this.idleInterval && !this.isActive)) {
      this.isWalking = false;
      this.currentFrame = 0;
      
      if (this.isActive && !this.idleInterval) {
        this.idleInterval = setInterval(() => {
          this.idleFrame = (this.idleFrame + 1) % this.sprites.idle.length;
          this.updateSprite(this.sprites.idle[this.idleFrame]);
        }, 1000);
      } else if (!this.isActive && this.idleInterval) {
        this.stopIdleAnimation();
        this.updateSprite(this.sprites.idle[0]);
      }
    }
  }

  stopIdleAnimation() {
    if (this.idleInterval) {
      clearInterval(this.idleInterval);
      this.idleInterval = null;
    }
  }

  updateSprite(spriteName) {
    const spriteElement = document.getElementById('character-sprite');
    const assetPrefix = this.characterAssets[this.characterId];
    
    if (spriteElement && assetPrefix) {
      spriteElement.src = `../assets/${assetPrefix}_${spriteName}`;
      
      if (this.direction === 'left') {
        spriteElement.style.transform = 'scaleX(-1)';
      } else {
        spriteElement.style.transform = 'scaleX(1)';
      }
    }
  }

  setDirection(direction) {
    if (direction !== this.direction) {
      this.direction = direction;
      this.stopIdleAnimation();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new CharacterAnimator();
});