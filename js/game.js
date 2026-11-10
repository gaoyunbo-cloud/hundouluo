// ============================================================================
// CONTRA: SHATTERED OPS HD - Main Loop, Tactical HUD, Menus & Cutscenes
// ============================================================================
window.Contra = window.Contra || {};

(function (ns) {
  'use strict';

  const {
    WIDTH,
    HEIGHT,
    FIXED_DT,
    DEFAULT_LIVES,
    KONAMI_LIVES,
    DIFFICULTIES,
    WEAPONS
  } = ns.CONFIG;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');

      this.state = 'title'; // 'title' | 'stageIntro' | 'playing' | 'paused' | 'stageClear' | 'gameover' | 'victory'
      this.frameCount = 0;

      // Menu options
      this.menuRow = 0;       // 0 = Players, 1 = Difficulty, 2 = Start Stage
      this.twoPlayers = false;
      this.diffIndex = 0;     // 0 = Normal, 1 = Hard, 2 = Nightmare
      this.selectedStartStage = 1;

      this.konamiActive = false;
      this.cinemaFilter = true;
      this.autoPilot = false;
      this.humanBot = new HumanLikeAgent(this);
      this.continuesLeft = 3;
      this.highScore = this._loadHighScore();

      this.stageNum = 1;
      this.level = null;
      this.entities = new ns.EntityManager();
      this.particles = new ns.ParticleSystem();
      this.players = [];
      this.boss = null;

      this.cameraX = 0;
      this.shakeMag = 0;
      this.shakeTime = 0;
      this.screenFlash = 0;
      this.bossWarnTimer = 0;

      this.stateTimer = 0;
      this.gameOverCursor = 0;

      this._lastTime = 0;
      this._accum = 0;
      this._rafId = null;
    }

    getDifficulty() {
      return DIFFICULTIES[this.diffIndex] || DIFFICULTIES[0];
    }

    _loadHighScore() {
      try {
        const v = parseInt(localStorage.getItem('contra_hd_hi_score') || '50000', 10);
        return Number.isFinite(v) ? Math.max(50000, v) : 50000;
      } catch (e) {
        return 50000;
      }
    }

    _saveHighScore(score) {
      if (score > this.highScore) {
        this.highScore = score;
        try {
          localStorage.setItem('contra_hd_hi_score', String(this.highScore));
        } catch (e) {}
      }
    }

    init() {
      ns.input.bind();
      ns.input.onAnyInteraction = () => ns.audio.init();
      ns.input.onKonami = () => {
        if (ns.netplay && ns.netplay.isGuest()) ns.netplay.requestKonami();
        else this.activateKonami();
      };
      if (ns.netplay) ns.netplay.bindGame(this);

      this.particles.initWeather('volcano');

      const loop = (ts) => {
        if (!this._lastTime) this._lastTime = ts;
        const delta = Math.min(0.1, (ts - this._lastTime) / 1000);
        this._lastTime = ts;
        this._accum += delta;

        while (this._accum >= FIXED_DT) {
          this.step();
          this._accum -= FIXED_DT;
        }
        this.render();
        this._rafId = requestAnimationFrame(loop);
      };
      this._rafId = requestAnimationFrame(loop);
    }

    activateKonami() {
      if (!this.konamiActive) {
        this.konamiActive = true;
        ns.audio.sfx('konami');
        this.screenFlash = 0.85;
        for (let i = 0; i < this.players.length; i++) {
          if (this.players[i].active && this.players[i].lives < KONAMI_LIVES) {
            this.players[i].lives = KONAMI_LIVES;
            this.players[i].hp = this.players[i].maxHp;
            this.particles.spawnText(this.players[i].x, this.players[i].y - 96, '30 LIVES KONAMI MODE!', '#ffd740', 22);
          }
        }
        if (window.updateKonamiBadge) window.updateKonamiBadge(true);
      }
    }

    triggerShake(mag, frames) {
      this.shakeMag = Math.max(this.shakeMag, mag);
      this.shakeTime = Math.max(this.shakeTime, frames);
    }

    startNewGame(twoPlayers, startStage) {
      if (twoPlayers !== undefined) this.twoPlayers = !!twoPlayers;
      ns.input.twoPlayerMode = this.twoPlayers;
      this.continuesLeft = 3;

      const diff = this.getDifficulty();
      const startLives = this.konamiActive ? KONAMI_LIVES : DEFAULT_LIVES;

      this.players = [new ns.Player(0, 150, 140, startLives, diff.maxHp)];
      if (this.twoPlayers) {
        this.players.push(new ns.Player(1, 95, 140, startLives, diff.maxHp));
      }

      ns.audio.playTitleFanfare();
      this._beginStage(startStage || this.selectedStartStage || 1);
    }

    jumpToStage(stageNum) {
      const clamped = Math.max(1, Math.min(5, stageNum));
      this.selectedStartStage = clamped;
      if (this.players.length === 0 || this.state === 'title' || this.state === 'gameover' || this.state === 'victory') {
        this.startNewGame(this.twoPlayers, clamped);
      } else {
        this._beginStage(clamped);
      }
    }

    _beginStage(stageNum) {
      this.stageNum = stageNum;
      this.level = new ns.Level(stageNum);
      this.entities.clear();
      this.particles.clear();
      this.particles.initWeather(this.level.theme);
      this.cameraX = 0;
      this.bossWarnTimer = 0;

      const diff = this.getDifficulty();
      this.boss = ns.createBoss(this.level.bossType, diff.enemyHpMult);

      for (let i = 0; i < this.players.length; i++) {
        this.players[i].maxHp = diff.maxHp;
        this.players[i].resetForStage(160 - i * 55, 120);
      }

      this.state = 'stageIntro';
      this.stateTimer = 100;
      if (window.highlightStageBtn) window.highlightStageBtn(stageNum);
    }

    awardScore(playerIdx, pts, worldX, worldY) {
      const p = this.players[playerIdx] || this.players[0];
      if (!p) return;
      const diffMult = this.getDifficulty().scoreMult || 1.0;
      const actual = p.addScore(Math.round(pts * diffMult), this.particles);
      this._saveHighScore(p.score);
      if (worldX !== undefined && actual >= 200) {
        this.particles.spawnText(worldX, worldY, '+' + actual, actual >= 1500 ? '#ffd740' : '#ffffff', actual >= 1500 ? 18 : 14);
      }
    }

    triggerFalconBomb(ownerIdx) {
      this.screenFlash = 0.95;
      this.triggerShake(18, 24);
      ns.audio.sfx('bossExplosion');

      this.entities.enemyBullets = [];
      for (let i = this.entities.enemies.length - 1; i >= 0; i--) {
        const e = this.entities.enemies[i];
        this.particles.spawnExplosion(e.x, e.y - 30, 64, true);
        this.awardScore(ownerIdx, e.score, e.x, e.y - 40);
      }
      this.entities.enemies = [];

      if (this.boss && this.boss.active && !this.boss.dying && !this.boss.dead && this.boss.applyAoEDamage) {
        const pts = this.boss.getTargetPoints();
        if (pts.length) {
          this.boss.applyAoEDamage(ownerIdx, pts[0].x, pts[0].y, 350, 26, this.particles, (i, s, x, y) => this.awardScore(i, s, x, y), (m, f) => this.triggerShake(m, f));
        }
      }
    }

    // ========================================================================
    // Fixed 60FPS Update Step
    // ========================================================================
    step() {
      this.frameCount++;
      ns.input.pollFrame();

      if (this.screenFlash > 0) this.screenFlash = Math.max(0, this.screenFlash - 0.055);
      if (this.shakeTime > 0) {
        this.shakeTime--;
        if (this.shakeTime <= 0) this.shakeMag = 0;
      }

      if (ns.input.justPressed('KeyO') && window.openNetplayLobby) {
        window.openNetplayLobby();
      }

      // Invisible Hotkey (T): Toggle Realistic Pro-Player Simulation
      if (ns.input.justPressed('KeyT')) {
        this.autoPilot = !this.autoPilot;
        if (this.autoPilot) {
          this.humanBot.reset();
          if (this.state === 'title') {
            this.startNewGame(this.twoPlayers, this.selectedStartStage || 1);
          }
        }
      }

      // Pro-player natural state progression
      if (this.autoPilot) {
        if (this.state === 'stageIntro' && this.stateTimer < 58) {
          this.state = 'playing';
          ns.audio.startBGM(this.level.bgm);
        } else if (this.state === 'gameover' && this.continuesLeft > 0) {
          this.continuesLeft--;
          const lives = this.konamiActive ? KONAMI_LIVES : DEFAULT_LIVES;
          const diff = this.getDifficulty();
          for (let i = 0; i < this.players.length; i++) {
            this.players[i].lives = lives;
            this.players[i].maxHp = diff.maxHp;
            this.players[i].hp = diff.maxHp;
            this.players[i].active = true;
          }
          this._beginStage(this.stageNum);
        }
      }

      // Online Guest (2P Lance): stream 60Hz input & run smooth 60FPS dead-reckoning!
      if (ns.netplay && ns.netplay.isGuest()) {
        ns.netplay.sendGuestInputFrame();
        ns.netplay.stepGuestDeadReckoning(this);
        return;
      }

      if (ns.input.justPressed('KeyR') && this.state !== 'title') {
        ns.audio.stopBGM();
        this.state = 'title';
        if (ns.netplay && ns.netplay.isHost()) ns.netplay.broadcastWorldSnapshot(this);
        return;
      }

      if (this.state === 'title') {
        this.particles.update(null, 'volcano');
        this._stepTitle();
      } else if (this.state === 'stageIntro') {
        this.stateTimer--;
        if (this.stateTimer <= 0 || ns.input.startPressed()) {
          this.state = 'playing';
          ns.audio.startBGM(this.level.bgm);
        }
      } else if (this.state === 'paused') {
        if (ns.input.pausePressed() || ns.input.startPressed()) {
          this.state = 'playing';
          ns.audio.sfx('pause');
        }
      } else if (this.state === 'playing') {
        this._stepPlaying();
      } else if (this.state === 'stageClear') {
        this.particles.update(this.level, this.level.theme);
        this.stateTimer--;
        if (this.stateTimer <= 0) {
          if (this.stageNum < 5) {
            this._beginStage(this.stageNum + 1);
          } else {
            this.state = 'victory';
            this.stateTimer = 0;
            ns.audio.playStageClear();
          }
        }
      } else if (this.state === 'gameover') {
        this._stepGameOver();
      } else if (this.state === 'victory') {
        this.stateTimer++;
        this.particles.update(null, 'volcano');
        if (this.stateTimer < 260 && this.stateTimer % 14 === 0) {
          this.particles.spawnExplosion(240 + Math.random() * 360, 440 + Math.random() * 130, 68, true);
        }
        if (this.stateTimer > 90 && ns.input.startPressed()) {
          this.state = 'title';
        }
      }

      // Online Host (1P Bill): broadcast authoritative 30Hz world snapshot to 2P Guest!
      if (ns.netplay && ns.netplay.isHost() && this.frameCount % 2 === 0) {
        ns.netplay.broadcastWorldSnapshot(this);
      }
    }

    _stepTitle() {
      if (ns.input.menuUpPressed()) {
        this.menuRow = (this.menuRow + 2) % 3;
        ns.audio.sfx('menuMove');
      } else if (ns.input.menuDownPressed()) {
        this.menuRow = (this.menuRow + 1) % 3;
        ns.audio.sfx('menuMove');
      }

      const left = ns.input.menuLeftPressed();
      const right = ns.input.menuRightPressed();
      if (left || right) {
        const delta = right ? 1 : -1;
        if (this.menuRow === 0) {
          this.twoPlayers = !this.twoPlayers;
        } else if (this.menuRow === 1) {
          this.diffIndex = (this.diffIndex + delta + DIFFICULTIES.length) % DIFFICULTIES.length;
        } else if (this.menuRow === 2) {
          this.selectedStartStage = ((this.selectedStartStage - 1 + delta + 5) % 5) + 1;
        }
        ns.audio.sfx('menuMove');
      }

      if (ns.input.startPressed()) {
        this.startNewGame(this.twoPlayers, this.selectedStartStage);
      }
    }

    _stepPlaying() {
      if (ns.input.pausePressed()) {
        this.state = 'paused';
        ns.audio.sfx('pause');
        return;
      }

      if (this.bossWarnTimer > 0) this.bossWarnTimer--;

      // 1) Update Level (Moving Platforms, Laser Gates & Bridges first so players ride cleanly)
      this.level.update(this.players, this.particles, ns.audio, this.frameCount, (m, f) => this.triggerShake(m, f));

      // 2) Update Players
      const onlineHost = ns.netplay && ns.netplay.isHost();
      for (let i = 0; i < this.players.length; i++) {
        let pInp;
        if (this.autoPilot && (!onlineHost || i === 0)) {
          pInp = this.humanBot.computeInput(this.players[i], this.level, this.entities, this.boss, this.cameraX, this.frameCount);
        } else if (onlineHost) {
          pInp = i === 0 ? ns.input.getLocalPrimaryInput() : ns.netplay.getRemoteGuestInput();
        } else {
          pInp = ns.input.getPlayerInput(i);
        }
        const partner = this.players.length > 1 ? this.players[1 - i] : null;
        this.players[i].update(
          pInp,
          this.level,
          this.entities,
          this.particles,
          this.cameraX,
          partner,
          this.boss,
          (m, f) => this.triggerShake(m, f)
        );
      }

      if (!this.players.some((p) => p.active)) {
        this.state = 'gameover';
        this.gameOverCursor = this.continuesLeft > 0 ? 0 : 1;
        ns.audio.playGameOver();
        return;
      }

      // 3) Smooth Forward Camera
      let leadX = 0;
      for (let i = 0; i < this.players.length; i++) {
        if (this.players[i].active && this.players[i].state !== 'dead') {
          leadX = Math.max(leadX, this.players[i].x);
        }
      }
      const targetCam = Math.min(this.level.bossLockX, Math.max(this.cameraX, leadX - 520));
      this.cameraX += (targetCam - this.cameraX) * 0.22;
      if (Math.abs(targetCam - this.cameraX) < 1) this.cameraX = targetCam;

      // 4) Boss Activation
      if (!this.boss.active && this.cameraX >= this.level.bossLockX - 18) {
        this.cameraX = this.level.bossLockX;
        this.boss.active = true;
        this.bossWarnTimer = 110;
        ns.audio.startBGM('boss');
      }

      const diff = this.getDifficulty();
      if (!this.boss.active) {
        this.entities.activateStageSpawns(this.level, this.cameraX, diff);
      }

      // 5) Update Entities, Boss & Particles
      this.entities.update(
        this.level,
        this.players,
        this.particles,
        this.cameraX,
        this.frameCount,
        diff,
        this.boss,
        (idx, pts, wx, wy) => this.awardScore(idx, pts, wx, wy),
        (idx) => this.triggerFalconBomb(idx),
        (m, f) => this.triggerShake(m, f)
      );

      this.boss.update(
        this.entities,
        this.players,
        this.particles,
        this.frameCount,
        diff,
        (idx, pts, wx, wy) => this.awardScore(idx, pts, wx, wy),
        (m, f) => this.triggerShake(m, f)
      );

      this.particles.update(this.level, this.level.theme);

      // 6) Player Hazard Collisions
      this._checkPlayerHazards();

      // 7) Stage Clear Check
      if (this.boss.dead) {
        this.state = 'stageClear';
        this.stateTimer = 165;
        for (let i = 0; i < this.players.length; i++) {
          if (this.players[i].active) {
            this.awardScore(i, 8000, this.players[i].x, this.players[i].y - 90);
          }
        }
        ns.audio.playStageClear();
      }
    }

    _checkPlayerHazards() {
      const bossBoxes = this.boss && this.boss.getHazardBoxes ? this.boss.getHazardBoxes() : [];

      for (let pIdx = 0; pIdx < this.players.length; pIdx++) {
        const pl = this.players[pIdx];
        const hb = pl.getHurtbox();
        if (!hb || pl.invulnTimer > 0 || pl.barrierTimer > 0 || pl.dashTimer > 0) continue;

        let hit = false;

        // Timed Security Laser Gates
        for (let i = 0; i < this.level.laserGates.length; i++) {
          const lg = this.level.laserGates[i];
          if (!lg.active) continue;
          if (hb.x < lg.x + 6 && hb.x + hb.w > lg.x - 6 && hb.y < lg.y2 && hb.y + hb.h > lg.y1) {
            pl.takeHit(this.particles, false, (m, f) => this.triggerShake(m, f));
            hit = true;
            break;
          }
        }
        if (hit) continue;

        // Enemy Bullets
        for (let i = this.entities.enemyBullets.length - 1; i >= 0; i--) {
          const eb = this.entities.enemyBullets[i];
          const r = Math.max(4, (eb.radius || 7) - 2);
          if (eb.x + r >= hb.x && eb.x - r <= hb.x + hb.w && eb.y + r >= hb.y && eb.y - r <= hb.y + hb.h) {
            this.entities.enemyBullets.splice(i, 1);
            pl.takeHit(this.particles, false, (m, f) => this.triggerShake(m, f));
            hit = true;
            break;
          }
        }
        if (hit) continue;

        // Enemy Contact
        for (let i = 0; i < this.entities.enemies.length; i++) {
          const e = this.entities.enemies[i];
          if (e.type === 'barrel' || e.type === 'turret' || (e.type === 'cannon' && e.riseProgress < 0.7)) continue;
          const cy = e.type === 'drone' ? e.y - e.h * 0.5 : e.y - e.h * 0.9;
          const ex = e.x - e.w * 0.36;
          const ew = e.w * 0.72;
          const eh = e.h * 0.85;
          if (hb.x < ex + ew && hb.x + hb.w > ex && hb.y < cy + eh && hb.y + hb.h > cy) {
            pl.takeHit(this.particles, false, (m, f) => this.triggerShake(m, f));
            hit = true;
            break;
          }
        }
        if (hit) continue;

        // Boss Contact / Whipping Tentacles
        for (let i = 0; i < bossBoxes.length; i++) {
          const bx = bossBoxes[i];
          if (hb.x < bx.x + bx.w && hb.x + hb.w > bx.x && hb.y < bx.y + bx.h && hb.y + hb.h > bx.y) {
            pl.takeHit(this.particles, false, (m, f) => this.triggerShake(m, f));
            break;
          }
        }
      }
    }

    _stepGameOver() {
      if (this.continuesLeft > 0 && (ns.input.menuUpPressed() || ns.input.menuDownPressed())) {
        this.gameOverCursor = 1 - this.gameOverCursor;
        ns.audio.sfx('menuMove');
      }
      if (ns.input.startPressed()) {
        if (this.gameOverCursor === 0 && this.continuesLeft > 0) {
          this.continuesLeft--;
          const lives = this.konamiActive ? KONAMI_LIVES : DEFAULT_LIVES;
          const diff = this.getDifficulty();
          for (let i = 0; i < this.players.length; i++) {
            this.players[i].lives = lives;
            this.players[i].maxHp = diff.maxHp;
            this.players[i].hp = diff.maxHp;
            this.players[i].score = 0;
            this.players[i].nextExtraLifeIdx = 0;
            this.players[i].active = true;
          }
          this._beginStage(this.stageNum);
        } else {
          this.state = 'title';
        }
      }
    }

    // ========================================================================
    // Cinematic HD Rendering
    // ========================================================================
    render() {
      const ctx = this.ctx;
      ctx.fillStyle = '#04060d';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      if (this.state === 'title') {
        this._renderTitle(ctx);
        return;
      }
      if (this.state === 'stageIntro') {
        this._renderStageIntro(ctx);
        return;
      }
      if (this.state === 'victory') {
        this._renderVictory(ctx);
        return;
      }

      ctx.save();
      if (this.shakeTime > 0) {
        const ox = (Math.random() - 0.5) * this.shakeMag;
        const oy = (Math.random() - 0.5) * this.shakeMag;
        ctx.translate(ox, oy);
      }

      this.level.drawBackground(ctx, this.cameraX, this.frameCount);
      this.level.drawForeground(ctx, this.cameraX, this.frameCount);
      this.boss.draw(ctx, this.cameraX, this.frameCount);
      this.entities.draw(ctx, this.cameraX, this.frameCount);

      for (let i = 0; i < this.players.length; i++) {
        this.players[i].draw(ctx, this.cameraX, this.frameCount);
      }
      this.particles.draw(ctx, this.cameraX);
      this.particles.drawWeather(ctx);

      if (this.screenFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash.toFixed(2)})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
      ctx.restore();

      // Optional Subtle Cinema Vignette
      if (this.cinemaFilter && ctx.createRadialGradient) {
        const vig = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.5, HEIGHT * 0.45, WIDTH * 0.5, HEIGHT * 0.5, WIDTH * 0.65);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.42)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      this._renderHUD(ctx);

      if (this.state === 'paused') this._renderPauseOverlay(ctx);
      else if (this.state === 'stageClear') this._renderStageClearOverlay(ctx);
      else if (this.state === 'gameover') this._renderGameOverOverlay(ctx);
    }

    _renderTitle(ctx) {
      // Dramatic Cinematic Battlefield Backdrop
      if (ctx.createLinearGradient) {
        const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
        bg.addColorStop(0, '#060b19');
        bg.addColorStop(0.55, '#131c38');
        bg.addColorStop(1, '#2a0d18');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
      this.particles.drawWeather(ctx);

      // Dramatic Rim-Light Halo behind Bill & Lance Hero Showcase on Right!
      ns.drawGlow(ctx, 960, 420, 290, 'red', 0.45);
      ns.drawGlow(ctx, 880, 380, 220, 'cyan', 0.40);

      // Rocky Heroic Pedestal
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(690, 720);
      ctx.lineTo(760, 560);
      ctx.lineTo(1160, 560);
      ctx.lineTo(1240, 720);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(760, 560, 400, 4);

      // Giant Scaled HD Action-Hero Bill & Lance Pose!
      const mockBill = {
        index: 0, x: 885, y: 560, facing: -1, aimX: -0.92, aimY: -0.25,
        onGround: true, inWater: false, state: 'normal', moving: false,
        animTimer: 0, invulnTimer: 0, barrierTimer: 0, dashTimer: 0,
        getActiveWeapon: () => ({ id: 'L', level: 2 })
      };
      const mockLance = {
        index: 1, x: 1035, y: 560, facing: 1, aimX: 0.94, aimY: -0.20,
        onGround: true, inWater: false, state: 'normal', moving: false,
        animTimer: 0, invulnTimer: 0, barrierTimer: 0, dashTimer: 0,
        getActiveWeapon: () => ({ id: 'M', level: 2 })
      };

      ctx.save();
      ctx.translate(960, 560);
      ctx.scale(2.55, 2.55);
      ctx.translate(-960, -560);
      ns.Sprites.drawCommando(ctx, mockBill, this.frameCount);
      ns.Sprites.drawCommando(ctx, mockLance, this.frameCount);
      ctx.restore();

      // Title Logo Block (Left Side)
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      ctx.font = '900 18px "Arial Black", sans-serif';
      ctx.fillStyle = '#00e5ff';
      ctx.fillText('NEXT-GEN 720P SKELETAL ACTION REMAKE · 5 FULL STAGES', 84, 72);

      ctx.font = '900 76px "Impact", "Arial Black", sans-serif';
      ctx.fillStyle = '#b71c1c';
      ctx.fillText('CONTRA', 88, 104);
      ctx.fillStyle = '#ffd740';
      ctx.fillText('CONTRA', 84, 98);

      ctx.font = '800 24px "Arial Black", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText('SHATTERED OPS HD · REMASTERED EDITION', 86, 186);

      // Interactive Tactical Menu Options
      const diff = this.getDifficulty();
      const rows = [
        { label: 'PLAYERS MODE', val: this.twoPlayers ? '◀  2 PLAYERS CO-OP ASSAULT  ▶' : '◀  1 PLAYER SOLO CAMPAIGN  ▶' },
        { label: 'COMBAT DIFFICULTY', val: `◀  ${diff.name}  ▶`, sub: diff.desc },
        { label: 'STARTING MISSION', val: `◀  STAGE ${this.selectedStartStage} / 5  ▶` }
      ];

      for (let i = 0; i < rows.length; i++) {
        const ry = 275 + i * 86;
        const selected = this.menuRow === i;

        ctx.fillStyle = selected ? 'rgba(0, 229, 255, 0.16)' : 'rgba(15, 23, 42, 0.68)';
        ctx.strokeStyle = selected ? '#00e5ff' : '#334155';
        ctx.lineWidth = selected ? 2.5 : 1.5;
        ctx.fillRect(84, ry, 540, 70);
        ctx.strokeRect(84, ry, 540, 70);

        ctx.font = '700 13px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(rows[i].label, 104, ry + 11);

        ctx.font = '800 20px sans-serif';
        ctx.fillStyle = selected ? '#ffd740' : '#e2e8f0';
        ctx.fillText(rows[i].val, 104, ry + 32);

        if (rows[i].sub) {
          ctx.font = '12px sans-serif';
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(rows[i].sub, 310, ry + 11);
        }
      }

      // High Score & Konami Status
      ctx.font = '700 16px monospace';
      ctx.fillStyle = '#ffab40';
      ctx.fillText('HI-SCORE: ' + String(this.highScore).padStart(8, '0'), 86, 548);

      ctx.font = '700 14px sans-serif';
      ctx.fillStyle = '#69f0ae';
      ctx.fillText('🌐 ONLINE CO-OP: Click "ONLINE CO-OP (O)" above or press O to host/join a 6-digit room!', 86, 574);

      if (this.konamiActive) {
        ctx.fillStyle = '#ffd740';
        ctx.fillText('★ KONAMI CODE ACTIVATED: 30 LIVES READY! ★', 86, 600);
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px sans-serif';
        ctx.fillText('UP/DOWN: Select Option · LEFT/RIGHT: Change Value · Code: ↑↑↓↓←→←→BA (30 Lives)', 86, 602);
      }

      if (Math.floor(this.frameCount / 22) % 2 === 0) {
        ctx.font = '900 24px "Arial Black", sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('▶ PRESS ENTER / SPACE / J TO DEPLOY!', 86, 642);
      }
    }

    _renderStageIntro(ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = '900 42px "Impact", "Arial Black", sans-serif';
      ctx.fillStyle = '#ffd740';
      ctx.fillText(this.level.name, WIDTH * 0.5, HEIGHT * 0.42);

      ctx.font = '800 28px "PingFang SC", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.level.cnName, WIDTH * 0.5, HEIGHT * 0.52);

      ctx.font = '700 18px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(
        `DIFFICULTY: ${this.getDifficulty().name}   |   1P LIVES: ${this.players[0].lives}`,
        WIDTH * 0.5,
        HEIGHT * 0.64
      );
    }

    _renderHUD(ctx) {
      // Player 1 Left Tactical HUD Card
      if (this.players[0]) {
        this._drawPlayerHUDCard(ctx, this.players[0], 22, 16, false);
      }

      // Center Score & Stage / Boss HP Panel
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = '800 15px monospace';
      ctx.fillStyle = '#ffd740';
      ctx.fillText(`STAGE ${this.stageNum}/5  ·  HI ${String(this.highScore).padStart(8, '0')}`, WIDTH * 0.5, 14);

      if (ns.netplay && ns.netplay.active) {
        ctx.font = '700 12px monospace';
        ctx.fillStyle = '#69f0ae';
        const roleTag = ns.netplay.role === 'host' ? '1P HOST' : '2P GUEST';
        const pingTag = ns.netplay.rttMs > 0 ? `${ns.netplay.rttMs}ms` : '...';
        ctx.fillText(`🌐 ROOM ${ns.netplay.roomCode} · ${roleTag} · PING ${pingTag}`, WIDTH * 0.5, 76);
      }

      if (this.boss && this.boss.active && !this.boss.dead) {
        const barW = 420;
        const bx = WIDTH * 0.5 - barW * 0.5;
        const by = 38;
        const ratio = this.boss.getHealthRatio();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.fillRect(bx - 3, by - 3, barW + 6, 18);
        ctx.strokeRect(bx - 3, by - 3, barW + 6, 18);

        ctx.fillStyle = ratio < 0.35 ? '#ff1744' : '#ff9100';
        ctx.fillRect(bx, by, barW * ratio, 12);

        ctx.font = '700 12px "PingFang SC", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.boss.cnName, WIDTH * 0.5, by + 19);

        if (this.bossWarnTimer > 0 && Math.floor(this.bossWarnTimer / 6) % 2 === 0) {
          ctx.font = '900 34px "Impact", "PingFang SC", sans-serif';
          ctx.fillStyle = '#ff1744';
          ctx.fillText(`⚠ WARNING · ${this.boss.cnName} ⚠`, WIDTH * 0.5, 130);
        }
      }

      // Player 2 Right Tactical HUD Card
      if (this.twoPlayers && this.players[1]) {
        this._drawPlayerHUDCard(ctx, this.players[1], WIDTH - 352, 16, true);
      }
    }

    _drawPlayerHUDCard(ctx, p, x, y) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 16, 30, 0.78)';
      ctx.strokeStyle = p.index === 0 ? '#0284c7' : '#dc2626';
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, 330, 68);
      ctx.strokeRect(x, y, 330, 68);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      if (!p.active) {
        const partner = this.players[1 - p.index];
        ctx.font = '800 14px sans-serif';
        ctx.fillStyle = '#ffd740';
        ctx.fillText(
          partner && partner.active && partner.lives >= 2 ? 'PRESS FIRE TO BORROW 1 LIFE!' : 'GAME OVER · KIA',
          x + 14, y + 24
        );
        ctx.restore();
        return;
      }

      // Name, Lives & Score
      ctx.font = '800 14px monospace';
      ctx.fillStyle = p.index === 0 ? '#38bdf8' : '#ff5252';
      ctx.fillText(`${p.name}  ♥x${p.lives}`, x + 12, y + 8);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(p.score).padStart(8, '0'), x + 318, y + 8);

      // Armor Shield Segments
      ctx.textAlign = 'left';
      for (let a = 0; a < p.maxHp; a++) {
        ctx.fillStyle = a < p.hp ? '#00e676' : '#334155';
        ctx.fillRect(x + 12 + a * 26, y + 29, 22, 8);
      }

      // Grenade Count & Dash Cooldown Indicator
      ctx.font = '700 12px sans-serif';
      ctx.fillStyle = '#ffab40';
      ctx.fillText(`💣x${p.grenades}`, x + 98, y + 26);

      const dashReady = p.dashCooldown <= 0;
      ctx.fillStyle = dashReady ? '#40f8ff' : '#475569';
      ctx.fillText(dashReady ? '⚡DASH' : '⏳DASH', x + 144, y + 26);

      // Dual-Weapon Slot Badges!
      for (let s = 0; s < 2; s++) {
        const slot = p.slots[s];
        const bx = x + 202 + s * 60;
        const active = p.activeSlot === s;
        ctx.fillStyle = active ? 'rgba(0, 229, 255, 0.25)' : '#1e293b';
        ctx.strokeStyle = active ? '#00e5ff' : '#475569';
        ctx.lineWidth = 1.5;
        ctx.fillRect(bx, y + 26, 54, 34);
        ctx.strokeRect(bx, y + 26, 54, 34);

        ctx.textAlign = 'center';
        ctx.font = '800 13px monospace';
        ctx.fillStyle = slot ? (slot.level >= 2 ? '#ffd740' : '#ffffff') : '#64748b';
        ctx.fillText(slot ? `${slot.id}${slot.level >= 2 ? '★' : ''}` : '--', bx + 27, y + 30);
        ctx.font = '9px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(slot ? WEAPONS[slot.id].short.slice(0, 6) : 'EMPTY', bx + 27, y + 46);
      }

      // Combo Badge
      if (p.combo >= 3) {
        ctx.textAlign = 'left';
        ctx.font = '900 13px "Arial Black", sans-serif';
        ctx.fillStyle = '#ffd740';
        ctx.fillText(`${p.combo} HIT COMBO!`, x + 12, y + 46);
      }

      ctx.restore();
    }

    _renderPauseOverlay(ctx) {
      ctx.fillStyle = 'rgba(4, 8, 18, 0.75)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 46px "Impact", sans-serif';
      ctx.fillStyle = '#ffd740';
      ctx.fillText('PAUSED · TACTICAL HOLD', WIDTH * 0.5, HEIGHT * 0.44);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('PRESS P / ESC TO RESUME   |   PRESS R FOR MAIN MENU', WIDTH * 0.5, HEIGHT * 0.55);
    }

    _renderStageClearOverlay(ctx) {
      ctx.fillStyle = 'rgba(6, 12, 28, 0.72)';
      ctx.fillRect(WIDTH * 0.5 - 290, HEIGHT * 0.5 - 110, 580, 220);
      ctx.strokeStyle = '#ffd740';
      ctx.lineWidth = 3;
      ctx.strokeRect(WIDTH * 0.5 - 290, HEIGHT * 0.5 - 110, 580, 220);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 40px "Impact", sans-serif';
      ctx.fillStyle = '#ffd740';
      ctx.fillText(`STAGE ${this.stageNum} CLEAR!`, WIDTH * 0.5, HEIGHT * 0.5 - 45);

      ctx.font = '800 22px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('STAGE CLEAR BONUS: +8,000 PTS', WIDTH * 0.5, HEIGHT * 0.5 + 10);

      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(this.stageNum < 5 ? `DEPLOYING TO STAGE ${this.stageNum + 1}...` : 'RED FALCON HIVE COLLAPSING — EVACUATE NOW!', WIDTH * 0.5, HEIGHT * 0.5 + 58);
    }

    _renderGameOverOverlay(ctx) {
      ctx.fillStyle = 'rgba(4, 6, 14, 0.85)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = '900 62px "Impact", sans-serif';
      ctx.fillStyle = '#ff1744';
      ctx.fillText('MISSION FAILED · GAME OVER', WIDTH * 0.5, 250);

      if (this.continuesLeft > 0) {
        ctx.font = '800 22px monospace';
        ctx.fillStyle = '#ffd740';
        ctx.fillText(`CONTINUES REMAINING: ${this.continuesLeft}`, WIDTH * 0.5, 330);

        const opts = ['CONTINUE · REDEPLOY NOW', 'TITLE MENU · RETURN TO BASE'];
        for (let i = 0; i < 2; i++) {
          const y = 405 + i * 52;
          ctx.fillStyle = this.gameOverCursor === i ? '#00e5ff' : '#94a3b8';
          ctx.font = '800 24px sans-serif';
          ctx.fillText((this.gameOverCursor === i ? '▶  ' : '    ') + opts[i], WIDTH * 0.5, y);
        }
      } else {
        ctx.font = '800 22px sans-serif';
        ctx.fillStyle = '#ffd740';
        ctx.fillText('PRESS ENTER / SPACE TO RETURN TO TITLE MENU', WIDTH * 0.5, 390);
      }
    }

    _renderVictory(ctx) {
      if (ctx.createLinearGradient) {
        const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
        sky.addColorStop(0, '#070b24');
        sky.addColorStop(0.65, '#3b1238');
        sky.addColorStop(1, '#ff6d00');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, WIDTH, 540);
      }
      ctx.fillStyle = '#082f49';
      ctx.fillRect(0, 540, WIDTH, 180);

      // Sinking Exploding Red Falcon Island
      const sink = Math.min(85, this.stateTimer * 0.25);
      ctx.fillStyle = '#1e1b2e';
      ctx.beginPath();
      ctx.moveTo(160, 545);
      ctx.lineTo(310, 370 + sink);
      ctx.lineTo(430, 420 + sink);
      ctx.lineTo(520, 340 + sink);
      ctx.lineTo(680, 545);
      ctx.closePath();
      ctx.fill();

      this.particles.draw(ctx, 0);

      // Rescue Blackhawk Helicopter Flying Toward Sunset!
      const cx = Math.min(980, 420 + this.stateTimer * 2.0);
      const cy = 275 + Math.sin(this.stateTimer * 0.08) * 12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-48, -14, 86, 32);
      ctx.fillRect(-92, -6, 46, 12);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(10, -10, 26, 16);
      const rw = this.frameCount % 4 < 2 ? 120 : 45;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-rw * 0.5, -24, rw, 4);
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 54px "Impact", sans-serif';
      ctx.fillStyle = '#ffd740';
      ctx.fillText('★ ALL 5 STAGES CLEARED · MISSION COMPLETE! ★', WIDTH * 0.5, 95);

      ctx.font = '800 24px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('EMPEROR GAVA & THE RED FALCON BIO-HIVE HAVE BEEN OBLITERATED!', WIDTH * 0.5, 155);

      const best = Math.max(...this.players.map((p) => p.score));
      const rank = best >= 120000 ? 'SSS · LEGENDARY COMMANDO' : (best >= 75000 ? 'S · SUPREME VETERAN' : 'A · ELITE OPERATIVE');
      ctx.font = '800 22px monospace';
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(`FINAL SCORE: ${String(best).padStart(8, '0')}   |   COMBAT RANK: ${rank}`, WIDTH * 0.5, 615);

      if (this.stateTimer > 90 && Math.floor(this.frameCount / 22) % 2 === 0) {
        ctx.font = '800 20px sans-serif';
        ctx.fillStyle = '#ffd740';
        ctx.fillText('PRESS ENTER / SPACE TO RETURN TO TITLE SCREEN', WIDTH * 0.5, 668);
      }
    }

  }

  // ============================================================================
  // Veteran Human Player Tactical Agent v2
  // Authentic Contra Pro Tactics: Prone Clear-Before-Advance, 45°/90° Angles,
  // Shield Counterplay, Trajectory Duck/Jump/Sidestep & Honest Physics
  // ============================================================================
  class HumanLikeAgent {
    constructor(game) {
      this.game = game;
      this.reset();
    }

    reset() {
      this.proneHoldTimer = 0;
      this.burstCycle = 0;
      this.totalDeaths = 0;
      this.stageDeaths = {};
      this.wasDead = false;
      this.stuckTimer = 0;
      this.lootFrames = 0;
      this.lastX = 0;
      this.lastStage = 0;
      this.strafeDir = -1;
      this.strafeTimer = 0;
      this.stationAnchorX = 0;
      this.stationTimer = 0;
      this.forceAdvanceTimer = 0;
    }

    _hasSafeGround(level, x, refY) {
      const topProbe = Math.min(refY - 130, 140);
      const land = level.resolveLanding(x, topProbe, HEIGHT - 14);
      if (!land) return null;
      if (level.getLavaAt(x, land.y + 4)) return null;
      if (land.y > HEIGHT - 16) return null;
      return land;
    }

    _canStepLeft(p, level, cameraX, dist = 34) {
      if (p.x - dist < cameraX + 42) return false;
      if (p.onGround && p.currentPlatform) {
        if (p.x - p.currentPlatform.x > dist + 8) return true;
        const adj = level.resolveLanding(p.currentPlatform.x - 22, p.y - 16, p.y + 95);
        return !!(adj && !level.getLavaAt(p.currentPlatform.x - 22, adj.y + 4) && adj.y < HEIGHT - 16);
      }
      return !!this._hasSafeGround(level, p.x - dist, p.y);
    }

    _wantsPowerup(p, type) {
      if (type === 'R' || type === 'G' || type === 'N' || type === 'B') return true;
      for (let s = 0; s < 2; s++) {
        if (p.slots[s] && p.slots[s].id === type) {
          return p.slots[s].level < 2;
        }
      }
      if (!p.slots[1]) return true;
      if (p.slots[0].id === 'R' || p.slots[1].id === 'R') return true;
      // Once holding Spread Lv.2 + another real weapon, never risk overwriting S★!
      const hasMaxSpread = (p.slots[0].id === 'S' && p.slots[0].level >= 2) ||
                           (p.slots[1].id === 'S' && p.slots[1].level >= 2);
      if (hasMaxSpread) return false;
      const worstTier = Math.min(this._weaponTier(p.slots[0]), this._weaponTier(p.slots[1]));
      const newTier = this._weaponTier({ id: type, level: 1 });
      return newTier > worstTier + 0.5;
    }

    _weaponTier(slot) {
      if (!slot) return 0;
      const base = { S: 6, L: 5, M: 4.5, C: 4, F: 3.8, R: 2.5 }[slot.id] || 2;
      return base + (slot.level >= 2 ? 2.2 : 0);
    }

    computeInput(p, level, entities, boss, cameraX, frameCount) {
      const inp = {
        left: false, right: false, up: false, down: false,
        fire: false, firePressed: false,
        jump: false, jumpPressed: false,
        dash: false, dashPressed: false,
        grenade: false, grenadePressed: false,
        swap: false, swapPressed: false
      };

      if (this.lastStage !== this.game.stageNum) {
        this.lastStage = this.game.stageNum;
        this.proneHoldTimer = 0;
        this.stuckTimer = 0;
        this.stationAnchorX = p.x;
        this.stationTimer = 0;
        this.forceAdvanceTimer = 0;
        this.wasDead = false;
      }

      if (!p.active) return inp;
      if (p.state === 'dead') {
        if (!this.wasDead) {
          this.wasDead = true;
          this.totalDeaths++;
          this.stageDeaths[this.game.stageNum] = (this.stageDeaths[this.game.stageNum] || 0) + 1;
        }
        return inp;
      }
      this.wasDead = false;

      if (this.proneHoldTimer > 0) this.proneHoldTimer--;
      if (this.strafeTimer > 0) this.strafeTimer--;
      if (this.forceAdvanceTimer > 0) this.forceAdvanceTimer--;

      const isBossFight = !!(boss && boss.active && !boss.dying && !boss.dead);
      const onBridge = !!(p.onGround && (
        (p.currentPlatform && p.currentPlatform.type === 'bridge') ||
        (level.bridges && level.bridges.some(b => p.x >= b.x - 30 && p.x <= b.x + b.segments * b.segWidth + 40))
      ));
      const curWep = p.getActiveWeapon();
      const hasWideShot = curWep.id === 'S' || curWep.id === 'C';

      // Track genuine horizontal stall & anti-loop station watchdog
      if (Math.abs(p.x - this.lastX) < 0.8) {
        this.stuckTimer++;
      } else {
        this.stuckTimer = 0;
        this.lastX = p.x;
      }
      if (!isBossFight && Math.abs(p.x - this.stationAnchorX) < 38) {
        this.stationTimer++;
        if (this.stationTimer > 220) {
          this.forceAdvanceTimer = 46;
          this.stationTimer = 0;
        }
      } else {
        this.stationAnchorX = p.x;
        this.stationTimer = 0;
      }

      // ----------------------------------------------------------------------
      // 1) Smart Dual-Weapon Selection (protect top-tier weapon when looting!)
      // ----------------------------------------------------------------------
      if (p.slots[0] && p.slots[1]) {
        const active = p.slots[p.activeSlot];
        const other = p.slots[1 - p.activeSlot];
        let wantSwap = false;

        // If about to pick up a new weapon type, switch to weaker slot so we replace 'R' instead of 'S'!
        const nearNewWeaponPickup = entities.powerups.find(
          (pu) => ns.CONFIG.WEAPONS[pu.powerType] &&
                  pu.powerType !== 'R' &&
                  p.slots[0].id !== pu.powerType &&
                  p.slots[1].id !== pu.powerType &&
                  Math.abs(pu.x - p.x) < 95 &&
                  this._wantsPowerup(p, pu.powerType)
        );
        if (nearNewWeaponPickup) {
          if (this._weaponTier(other) < this._weaponTier(active)) {
            wantSwap = true;
          }
        } else if (frameCount % 20 === 0) {
          const shieldAhead = entities.enemies.some(
            (e) => e.type === 'shield' && e.x > p.x - 20 && e.x < p.x + 380 && Math.abs(e.y - p.y) < 85
          );
          if (shieldAhead && (other.id === 'L' || other.id === 'F') && active.id !== 'L' && active.id !== 'F') {
            wantSwap = true;
          } else if (this._weaponTier(other) > this._weaponTier(active) + 0.3) {
            wantSwap = true;
          }
        }
        if (wantSwap) {
          inp.swap = true;
          inp.swapPressed = true;
        }
      }

      // ----------------------------------------------------------------------
      // 2) Scan Threats, Destructible Orbs, Containers & Safe Loot
      // ----------------------------------------------------------------------
      let destructibleOrb = null;
      for (let i = 0; i < entities.enemyBullets.length; i++) {
        const eb = entities.enemyBullets[i];
        if (eb.destructible && eb.x > cameraX && eb.x < cameraX + WIDTH) {
          const d = Math.hypot(eb.x - p.x, eb.y - (p.y - 40));
          if (d < 340 && (!destructibleOrb || d < destructibleOrb.dist)) {
            destructibleOrb = { x: eb.x, y: eb.y, dist: d };
          }
        }
      }

      let proneEnemy = null;     // cannon / sniper / runner / alien on same elevation -> LIE PRONE!
      let shieldEnemy = null;    // riot-shield trooper
      let lowerTarget = null;    // cliff-mounted turret or pillbox below player
      let highTarget = null;     // elevated grenadier / sniper / drone / jetpack / pod
      let generalEnemy = null;
      let nearBarrel = null;

      for (let i = 0; i < entities.enemies.length; i++) {
        const e = entities.enemies[i];
        if (e.x < cameraX - 24 || e.x > cameraX + WIDTH - 18) continue;
        const dx = e.x - p.x;
        const absDx = Math.abs(dx);
        const ey = (e.type === 'turret' || e.type === 'drone') ? e.y : e.y - e.h * 0.5;

        if (e.type === 'barrel') {
          if (dx > 50 && dx < 460) nearBarrel = e;
          continue;
        }

        // Same-platform threats: classic Contra lie-down-and-clear!
        if (
          (e.type === 'cannon' || e.type === 'sniper' || e.type === 'runner' || e.type === 'alien') &&
          Math.abs(e.y - p.y) <= 34 &&
          ((dx >= 38 && dx <= 600) || (e.type !== 'cannon' && dx >= -260 && dx <= -32))
        ) {
          const score = (e.type === 'alien' ? 0 : (e.type === 'runner' ? 30 : 60)) + absDx;
          if (!proneEnemy || score < proneEnemy.score) {
            proneEnemy = { e, dx, ey, score };
          }
          continue;
        }

        if (
          e.type === 'shield' &&
          ((dx >= -48 && dx < 420 && Math.abs(e.y - p.y) <= 45) ||
           (dx >= -150 && dx < -48 && Math.abs(e.y - p.y) <= 24 && (!p.currentPlatform || e.x >= p.currentPlatform.x)))
        ) {
          if (!shieldEnemy || absDx < Math.abs(shieldEnemy.dx)) {
            shieldEnemy = { e, dx, ey };
          }
          continue;
        }

        if (e.type === 'turret' && dx > -20 && dx < 470 && e.y > p.y + 18 && e.y < p.y + 125) {
          if (!lowerTarget || dx < lowerTarget.dx) {
            lowerTarget = { obj: e, x: e.x, y: e.y, dx, isTurret: true, open: e.open };
          }
          continue;
        }

        if (ey < p.y - 68 && dx > -42 && dx < 500) {
          if (!highTarget || absDx < Math.abs(highTarget.dx)) {
            highTarget = { obj: e, x: e.x, y: ey, dx, kind: e.type };
          }
          continue;
        }

        if (!generalEnemy || absDx < Math.abs(generalEnemy.dx)) {
          generalEnemy = { e, x: e.x, y: ey, dx };
        }
      }

      // Containers: flying weapon pods & cliff pillboxes
      let podTarget = null;
      for (let i = 0; i < entities.containers.length; i++) {
        const c = entities.containers[i];
        if (c.x < cameraX + 12 || c.x > cameraX + WIDTH - 28) continue;
        const dx = c.x - p.x;
        if (c.kind === 'pod') {
          if (dx > -480 && dx < 460 && this._wantsPowerup(p, c.power)) {
            podTarget = { x: c.x, y: c.y, dx, isPod: true };
          }
        } else if (c.kind === 'pillbox' && !isBossFight) {
          if (dx > 15 && dx < 420 && this._wantsPowerup(p, c.power)) {
            if (c.y > p.y + 18 && c.y < p.y + 125 && !lowerTarget) {
              lowerTarget = { obj: c, x: c.x, y: c.y, dx, isTurret: false, open: c.openAmount > 0.1 };
            } else if (Math.abs(c.y - (p.y - 40)) <= 48 && !generalEnemy) {
              generalEnemy = { e: c, x: c.x, y: c.y, dx };
            }
          }
        }
      }

      // Safe reachable ground powerups (never backtrack across chasms or chase stranded items!)
      let lootItem = null;
      for (let i = 0; i < entities.powerups.length; i++) {
        const pu = entities.powerups[i];
        if ((pu._agentTicks || 0) > 105) continue;
        if (pu.x < cameraX + 32 || pu.x > cameraX + WIDTH - 36) continue;
        if (!this._wantsPowerup(p, pu.powerType)) continue;
        if (Math.abs(pu.x - p.x) > 360 || pu.y < p.y - 140) continue;
        if (pu.x < p.x - 16 && p.currentPlatform && pu.x < p.currentPlatform.x + 18) continue;
        if (pu.y > p.y + 24 && p.onGround && p.currentPlatform && !p.currentPlatform.droppable && Math.abs(pu.x - p.x) < 95) continue;
        if (this._hasSafeGround(level, pu.x, Math.max(p.y, pu.y))) {
          lootItem = pu;
          break;
        }
      }

      // ----------------------------------------------------------------------
      // 3) Core Tactical Decision: Boss Combat vs Stage Clear-Before-Advance
      // ----------------------------------------------------------------------
      let engagingStationary = false;
      let wantFire = false;
      let aimTarget = null;
      const forcePush = this.forceAdvanceTimer > 0;

      const flankedShield = shieldEnemy && (
        (shieldEnemy.dx < 0 && shieldEnemy.e.facing < 0) ||
        (shieldEnemy.dx > 0 && shieldEnemy.e.facing > 0)
      );
      const urgentGroundRush = proneEnemy && (
        (proneEnemy.e.type === 'alien' && Math.abs(proneEnemy.dx) < 380) ||
        (proneEnemy.e.type === 'runner' && Math.abs(proneEnemy.dx) < 300) ||
        (proneEnemy.e.type === 'cannon' && proneEnemy.e.riseProgress >= 0.65 && Math.abs(proneEnemy.dx) < 420)
      );
      const clearElevatedFirst = !forcePush && !urgentGroundRush && highTarget && Math.abs(highTarget.dx) < 380;

      if (isBossFight) {
        this._executeBossTactics(p, level, entities, boss, cameraX, frameCount, inp, proneEnemy, destructibleOrb);
        wantFire = true;
      } else if (proneEnemy && !flankedShield && !clearElevatedFirst && p.onGround && !p.inWater && !onBridge) {
        // CLASSIC CONTRA VETERAN MOVE: Stop, lie completely prone, kill cannon/sniper/runner/alien, then advance!
        engagingStationary = true;
        this.stuckTimer = 0;
        this.proneHoldTimer = 10;
        const e = proneEnemy.e;
        const wantDir = proneEnemy.dx >= 0 ? 1 : -1;

        // If an alien already leaped high into the air, stand & shoot it at 45° up!
        if (e.type === 'alien' && !e.onGround && e.y < p.y - 28) {
          if (wantDir > 0) inp.right = true; else inp.left = true;
          inp.up = true;
          wantFire = true;
        } else if (p.facing !== wantDir) {
          // Tap direction for 1 frame to face the target before dropping prone
          if (wantDir > 0) inp.right = true; else inp.left = true;
          inp.down = false;
          wantFire = true;
        } else {
          // Hold DOWN with ZERO horizontal movement -> true 'prone' posture!
          inp.left = false;
          inp.right = false;
          inp.down = true;
          // Wait gracefully for pop-up cannon armor to open before firing burst
          wantFire = !(e.type === 'cannon' && e.riseProgress < 0.42);
        }
      } else if (this.proneHoldTimer > 0 && !clearElevatedFirst && p.onGround && !p.inWater && !onBridge) {
        // Brief human confirmation pause (~0.15s) after prone kill before standing up
        engagingStationary = true;
        this.stuckTimer = 0;
        inp.left = false;
        inp.right = false;
        inp.down = true;
        wantFire = false;
      } else if (shieldEnemy && !onBridge) {
        // RIOT-SHIELD COUNTERPLAY: Barrel blast -> Frag Grenade -> Railgun/Napalm -> Dash/Apex-Jump behind!
        this.stuckTimer = 0;
        const se = shieldEnemy.e;
        const dx = shieldEnemy.dx;
        const nearbyBarrel = nearBarrel && Math.abs(nearBarrel.x - se.x) < 190 ? nearBarrel : null;
        const piercesShield = curWep.id === 'L' || curWep.id === 'F';
        const shieldBlockingUs = (dx > 0 && se.facing < 0) || (dx < 0 && se.facing > 0);

        if (nearbyBarrel && Math.abs(nearbyBarrel.y - p.y) < 42) {
          engagingStationary = true;
          if (p.facing < 0) inp.right = true;
          else { inp.down = true; } // Prone shot into TNT barrel!
          wantFire = true;
        } else if (piercesShield || !shieldBlockingUs) {
          // Either our weapon pierces shields OR we flanked behind his back!
          engagingStationary = true;
          const wantDir = dx >= 0 ? 1 : -1;
          if (p.facing !== wantDir) {
            if (wantDir > 0) inp.right = true; else inp.left = true;
          } else if (p.onGround && Math.abs(se.y - p.y) <= 28) {
            inp.down = true;
          }
          wantFire = true;
        } else if (p.grenades > 0 && p.grenadeCooldown <= 0 && entities.grenades.length === 0 && Math.abs(se.y - p.y) < 70 && dx > 195) {
          // Exact grenade ballistics: low-arc (down+grenade) hits at ~265..350px; standard arc hits at ~355..435px!
          if (dx > 350 && dx < 435) {
            engagingStationary = true;
            if (p.facing < 0) inp.right = true;
            else { inp.grenade = true; inp.grenadePressed = true; }
          } else if (dx >= 260 && dx <= 350) {
            engagingStationary = true;
            if (p.facing < 0) inp.right = true;
            else {
              inp.down = true; // Low-arc direct chest impact!
              inp.grenade = true;
              inp.grenadePressed = true;
            }
          } else if (dx > 435) {
            inp.right = true;
          } else if (this._canStepLeft(p, level, cameraX, 36)) {
            inp.left = true;
          } else {
            inp.down = true;
            inp.grenade = true;
            inp.grenadePressed = true;
          }
          wantFire = false;
        } else if (entities.grenades.length > 0 && dx > 150) {
          // Grenade already in flight -> hold safe spacing until detonation!
          engagingStationary = true;
          if (dx < 190 && this._canStepLeft(p, level, cameraX, 30)) inp.left = true;
          wantFire = false;
        } else {
          // Close-quarters flank: early apex somersault at dx 135..175 (clears helmet by 100px!) or invincible Jet-Dash at dx 50..85!
          inp.right = dx > -52;
          if (dx >= 132 && dx <= 172 && p.onGround) {
            inp.jump = true;
            inp.jumpPressed = true;
          } else if (dx > 0 && dx <= 86 && p.dashCooldown <= 0) {
            inp.dash = true;
            inp.dashPressed = true;
          }
          wantFire = !shieldBlockingUs;
        }
      } else if (lowerTarget && !onBridge && !forcePush) {
        // CLIFF-WALL TURRET / PILLBOX BELOW: Position at 45° down-right firing line & destroy!
        this.stuckTimer = 0;
        const desiredDx = Math.max(75, (lowerTarget.y - p.y) + 55);
        const dx = lowerTarget.dx;
        if (dx > desiredDx + 32 && !(hasWideShot && dx < 260)) {
          inp.right = true;
          wantFire = hasWideShot;
        } else if (dx < desiredDx - 24 && this._canStepLeft(p, level, cameraX, 26)) {
          inp.left = true;
          wantFire = false;
        } else {
          engagingStationary = true;
          // 45° down-right requires right + down while moving slightly; alternate micro-step to stay on angle!
          if ((frameCount % 10) < 7 || !this._canStepLeft(p, level, cameraX, 20)) {
            inp.right = true;
            inp.down = true;
            wantFire = lowerTarget.open;
          } else {
            inp.left = true;
            wantFire = false;
          }
        }
      } else if ((highTarget || podTarget) && !onBridge && !forcePush) {
        // ELEVATED SNIPER / GRENADIER / DRONE / JETPACK / WEAPON POD: 45° up-right or 90° straight up!
        const ht = highTarget || podTarget;
        this.stuckTimer = 0;
        const dx = ht.dx;
        const isAerialMover = ht.kind === 'jetpack' || ht.kind === 'drone' || !ht.kind;
        const desiredDx = Math.max(55, (p.y - 52) - ht.y);

        if (Math.abs(dx) <= 42) {
          engagingStationary = true;
          inp.left = false;
          inp.right = false;
          inp.up = true;
          wantFire = true;
        } else if (dx > 42) {
          if (isAerialMover || hasWideShot) {
            // Aerial movers actively keep ~190px distance -> hold micro-stepped 45° up-right fire!
            engagingStationary = true;
            if ((frameCount % 8) < 6 || !this._canStepLeft(p, level, cameraX, 18)) {
              inp.right = true;
              inp.up = true;
              wantFire = true;
            } else {
              inp.left = true;
              wantFire = false;
            }
          } else if (dx > desiredDx + 45) {
            inp.right = true;
            inp.up = dx < desiredDx + 120;
            wantFire = dx < desiredDx + 95;
          } else if (dx < desiredDx - 32 && this._canStepLeft(p, level, cameraX, 26)) {
            inp.left = true;
            inp.up = true;
            wantFire = true;
          } else {
            engagingStationary = true;
            if ((frameCount % 9) < 6 || !this._canStepLeft(p, level, cameraX, 18)) {
              inp.right = true;
              inp.up = true;
              wantFire = true;
            } else {
              inp.left = true;
              wantFire = false;
            }
          }
        } else if (dx < -210 && ht.isPod) {
          // Wait stationary for flying weapon pod to glide into 45° up-left firing cone!
          engagingStationary = true;
          inp.left = false;
          inp.right = false;
          wantFire = false;
        } else if (this._canStepLeft(p, level, cameraX, 24)) {
          inp.left = true;
          inp.up = true;
          wantFire = true;
        } else {
          inp.up = true;
          wantFire = true;
        }
      } else if (lootItem && p.onGround && !onBridge && !forcePush) {
        // Deliberately walk/drop to pick up safe upgraded weapon / grenade / rapid-fire pod (only when grounded!)
        lootItem._agentTicks = (lootItem._agentTicks || 0) + 1;
        this.lootFrames++;
        this.stuckTimer = 0;
        const dx = lootItem.x - p.x;
        if (dx > 16) inp.right = true;
        else if (dx < -16) inp.left = true;
        else if (lootItem.y > p.y + 24 && p.onGround && p.currentPlatform && p.currentPlatform.droppable) {
          // Item landed on platform directly below -> drop down to grab it!
          inp.left = false;
          inp.right = false;
          inp.down = true;
          inp.jump = true;
          inp.jumpPressed = true;
        }
        if (lootItem.y < p.y - 42 && Math.abs(dx) < 95 && p.onGround) {
          inp.jump = true;
          inp.jumpPressed = true;
        }
        if (generalEnemy) {
          aimTarget = generalEnemy;
          wantFire = true;
        }
      } else {
        this.lootFrames = 0;
        // Clear ahead -> Steady human advance (with occasional micro check-pause, never mindless holding)
        inp.right = true;
        if (generalEnemy) {
          aimTarget = generalEnemy;
          wantFire = true;
          if (generalEnemy.y < p.y - 68) inp.up = true;
          else if (generalEnemy.y > p.y + 24) inp.down = true;
        } else if (nearBarrel && nearBarrel.x - p.x < 280) {
          wantFire = true;
        }
      }

      // Shoot down destructible seeker orbs immediately if close
      if (destructibleOrb && destructibleOrb.dist < 220 && !engagingStationary) {
        aimTarget = destructibleOrb;
        wantFire = true;
        if (destructibleOrb.y < p.y - 68) inp.up = true;
      }

      // ----------------------------------------------------------------------
      // 4) Projectile Trajectory Evasion (Duck Prone, Sidestep, Timed Jump, Dash)
      //    + Controlled Late-Stage Boss Drama (0 Stage-1 Deaths, 1 Tense Late-Stage Boss Death!)
      // ----------------------------------------------------------------------
      if (p.invulnTimer <= 4 && p.barrierTimer <= 0 && p.dashTimer <= 0) {
        this._evadeIncomingThreats(p, level, entities, boss, cameraX, inp);
      }

      // ----------------------------------------------------------------------
      // 5) World Boundary & Hazard Safety (Laser Gates, Chasms, Bridges, Cliffs)
      //    Runs AFTER combat & bullet evasion so a dodge NEVER steps into a pit or beam!
      // ----------------------------------------------------------------------
      if (!isBossFight) {
        // 5a) Security Laser Gate Timing: stop cleanly (>=56px) before active/warning beam!
        for (let i = 0; i < level.laserGates.length; i++) {
          const lg = level.laserGates[i];
          const distToGate = lg.x - p.x;
          if (distToGate > -16 && distToGate < 96 && p.y > lg.y1 - 10 && p.y - 74 < lg.y2) {
            const t = frameCount % lg.period;
            const unsafe = lg.active || t > lg.period - 32 || t < lg.activeFrames + 4;
            if (unsafe) {
              this.stuckTimer = 0;
              this.stationTimer = 0;
              inp.right = false;
              inp.jump = false;
              inp.jumpPressed = false;
              inp.dash = false;
              inp.dashPressed = false;
              if (distToGate < 54 && this._canStepLeft(p, level, cameraX, 24)) {
                inp.left = true;
                inp.down = false;
              } else {
                inp.down = p.onGround && distToGate >= 52;
              }
            } else if (distToGate < 64 && !inp.jumpPressed) {
              inp.right = true;
              inp.down = false;
            }
            break;
          }
        }

        // Guard against backing off a left cliff lip into a pit or lava!
        if (inp.left && p.onGround && !this._canStepLeft(p, level, cameraX, 22)) {
          inp.left = false;
          inp.dash = false;
          inp.dashPressed = false;
        }

        // 5b) Platform Edge, Step-Up Cliff, Chasm & Moving-Lift Navigation
        if (inp.right && p.onGround && p.currentPlatform) {
          const plat = p.currentPlatform;
          const platRight = plat.x + plat.w;
          const distToEdge = platRight - p.x;

          if (plat.type === 'bridge') {
            // Sprint across exploding suspension bridge and leap cleanly off the end!
            inp.down = false;
            const nextAlive = level.bridgeSegments.some(
              (bs) => bs.alive && bs.x >= platRight - 4 && bs.x <= platRight + 20
            );
            const farCliff = level.resolveLanding(platRight + 28, p.y - 25, p.y + 45);
            if ((!nextAlive && !farCliff && distToEdge < 42) || (plat.triggered && plat.fuse < 12)) {
              inp.jump = true;
              inp.jumpPressed = true;
            }
          } else if (distToEdge < 34) {
            // If on a droppable upper ledge and lower ground extends further ahead, drop down!
            if (plat.droppable) {
              const lowerPlat = level.resolveLanding(p.x, p.y + 14, p.y + 250, plat.y);
              const dropHeight = lowerPlat ? (lowerPlat.y - plat.y) : 0;
              const minRunwayNeeded = Math.max(70, dropHeight * 0.72);
              if (lowerPlat && (lowerPlat.x + lowerPlat.w - p.x) > minRunwayNeeded) {
                inp.left = false;
                inp.right = false;
                inp.down = true;
                inp.jump = true;
                inp.jumpPressed = true;
                return inp;
              }
            }

            // Check if ground continues gently within [p.y - 10, p.y + 95] without lava
            const gentleNext = level.resolveLanding(platRight + 26, p.y - 12, p.y + 98);
            const safeContinuation = gentleNext && gentleNext.type !== "moving" && Math.abs(gentleNext.y - plat.y) <= 8 && !level.getLavaAt(platRight + 26, gentleNext.y + 4) && gentleNext.y < HEIGHT - 16;

            if (!safeContinuation) {
              // Either a chasm, a lava gap, or a step-up cliff (e.g. y=515 -> y=445)!
              // Verify a landing target exists within jump span (60..225px ahead) or wait for moving lift!
              let jumpReachable = false;
              for (let probe = 65; probe <= 220; probe += 30) {
                if (this._hasSafeGround(level, p.x + probe, p.y - 45)) {
                  jumpReachable = true;
                  break;
                }
              }
              if (jumpReachable) {
                inp.down = false;
                inp.jump = true;
                inp.jumpPressed = true;
              } else {
                // Moving hover-lift is currently out of range -> wait at cliff edge!
                this.stuckTimer = 0;
                this.stationTimer = 0;
                inp.right = false;
                inp.dash = false;
                inp.dashPressed = false;
                if (distToEdge < 18) inp.left = true;
              }
            }
          }
        }

        // Mid-air over or near chasm / cliff lip: preserve forward crossing momentum, but fall straight if dropping through ledge!
        if (!p.onGround) {
          if (p.ignoreTimer > 0) {
            inp.left = false;
            inp.right = false;
          } else {
            inp.left = false;
            inp.right = true;
          }
        }

        // Unstuck hop if genuinely blocked for > 26 frames while trying to move
        if (p.onGround && inp.right && this.stuckTimer > 26) {
          inp.jump = true;
          inp.jumpPressed = true;
          this.stuckTimer = 0;
        }
      }

      // ----------------------------------------------------------------------
      // 6) Human Burst-Fire Cadence
      // ----------------------------------------------------------------------
      if (inp._suppressFire) wantFire = false;
      this.burstCycle = (this.burstCycle + 1) % 32;
      const inBurstWindow = isBossFight || this.burstCycle < 27;
      if (wantFire && inBurstWindow) {
        inp.fire = true;
        inp.firePressed = (frameCount % 4 === 0);
      }

      return inp;
    }

    _executeBossTactics(p, level, entities, boss, cameraX, frameCount, inp, proneEnemy, destructibleOrb) {
      const stage = this.game.stageNum;

      // Priority 0: If Boss 5 spawned an alien crawler on our floor, prone-kill it immediately!
      if (proneEnemy && proneEnemy.e.type === 'alien' && p.onGround && Math.abs(proneEnemy.dx) < 380) {
        const wantDir = proneEnemy.dx >= 0 ? 1 : -1;
        if (p.facing !== wantDir) {
          if (wantDir > 0) inp.right = true; else inp.left = true;
        } else {
          inp.left = false;
          inp.right = false;
          inp.down = true;
        }
        return;
      }

      if (stage === 1) {
        // BOSS 1 (Titan Wall): Take out twin mortar cannons (y=390) with 45° up-right from x~7145, then blast lower core (y=545)!
        const cannonsAlive = boss.cannons && boss.cannons.some((c) => c.alive);
        if (cannonsAlive) {
          if (p.x < 7125) {
            inp.right = true;
            inp.up = p.x > 7040;
          } else if (p.x > 7205) {
            inp.left = true;
            inp._suppressFire = true;
          } else {
            if ((frameCount % 10) < 7) { inp.right = true; inp.up = true; }
            else { inp.left = true; inp._suppressFire = true; }
          }
        } else {
          // Core at (7355, 545, r=46): standing straight shots on floor (oy=582) hit core dead center!
          if (p.y < 600 && p.onGround && p.currentPlatform && p.currentPlatform.droppable) {
            inp.left = false;
            inp.right = false;
            inp.down = true;
            inp.jump = true;
            inp.jumpPressed = true;
          } else if (p.x < 6940) {
            inp.right = true;
          } else if (p.x > 7120) {
            inp.left = true;
            inp._suppressFire = true;
          } else if (p.facing < 0) {
            inp.right = true;
          }
          if (p.grenades > 0 && p.grenadeCooldown <= 0 && frameCount % 40 === 0 && p.x > 6960 && p.x < 7110) {
            inp.down = true; // Low-arc grenade straight into core!
            inp.grenade = true;
            inp.grenadePressed = true;
          }
        }
      } else if (stage === 2) {
        // BOSS 2 (Omega Spider Mech): Climb left tactical ledge (x:6220..6460, y=515) where straight shots (oy=461) hit Spider (y=430, r=72) & Seeker Orbs at ANY distance!
        const dx = boss.x - p.x;
        const onMidLedge = p.onGround && Math.abs(p.y - 515) < 16 && p.x >= 6215 && p.x <= 6465;

        if (p.onGround && p.y < 460 && p.currentPlatform && p.currentPlatform.droppable) {
          // Immediately drop back down from y=400/295 onto y=515 firing ledge!
          inp.left = false;
          inp.right = false;
          inp.down = true;
          inp.jump = true;
          inp.jumpPressed = true;
        } else if (onMidLedge) {
          if (p.x < 6285) inp.right = true;
          else if (p.x > 6415) { inp.left = true; inp._suppressFire = true; }
          else if (p.facing < 0) inp.right = true;
        } else if (p.y > 560 && dx > 250) {
          if (p.x < 6305) inp.right = true;
          else if (p.x > 6400) { inp.left = true; inp._suppressFire = true; }
          else if (p.onGround) { inp.jump = true; inp.jumpPressed = true; }
        } else {
          if (dx > 0 && dx < 230 && p.x < cameraX + 240) {
            inp.right = true;
            if (p.onGround) { inp.jump = true; inp.jumpPressed = true; }
            if (p.dashCooldown <= 0) { inp.dash = true; inp.dashPressed = true; }
          } else if (Math.abs(dx) < 260) {
            if (dx > 0) { inp.left = true; inp._suppressFire = true; } else inp.right = true;
          } else {
            if ((frameCount % 8) < 6) { inp.right = dx > 0; inp.left = dx < 0; inp.up = true; }
            else { inp.left = dx > 0; inp.right = dx < 0; inp._suppressFire = true; }
          }
        }
      } else if (stage === 3) {
        // BOSS 3 (Valkyrie Gunship): Hold tactical cover under the center helipad canopy (x:6765..6935, y=636) which blocks overhead carpet bombs, firing 90°/45° up!
        const dx = boss.x - p.x;
        if (p.y < 590 && p.onGround && p.currentPlatform && p.currentPlatform.droppable) {
          inp.left = false;
          inp.right = false;
          inp.down = true;
          inp.jump = true;
          inp.jumpPressed = true;
        } else if (p.x < 6765) {
          inp.right = true;
          inp.up = Math.abs(dx) < 420;
        } else if (p.x > 6935) {
          inp.left = true;
          inp.up = Math.abs(dx) < 420;
        } else if (Math.abs(dx) <= 145) {
          // Gunship overhead -> 90° straight up!
          inp.left = false;
          inp.right = false;
          inp.up = true;
        } else if (dx > 145 && dx < 540) {
          // Balanced zero-drift micro-step for 45° up-right so we stay under canopy cover!
          if ((frameCount % 8) < 5) { inp.right = true; inp.up = true; }
          else { inp.left = true; inp._suppressFire = true; }
        } else if (dx < -145 && dx > -540) {
          if ((frameCount % 8) < 5) { inp.left = true; inp.up = true; }
          else { inp.right = true; inp._suppressFire = true; }
        } else {
          inp.up = true;
        }
                  } else if (stage === 4) {
        // BOSS 4 (Magma Dragon): Caldera floor (x: 6660..6780, y=630) under mid ledge (y=395)
        // continuous 45° up-right assault into Dragon Head & Armored Spine!
        if (p.onGround && p.y < 580 && p.currentPlatform && p.currentPlatform.droppable) {
          inp.left = false; inp.right = false;
          inp.down = true; inp.jump = true; inp.jumpPressed = true;
        } else if (p.x < 6660) {
          inp.right = true; inp.up = true;
        } else if (p.x > 6780) {
          inp.left = true; inp.up = true;
        } else {
          if ((frameCount % 8) < 6) { inp.right = true; inp.up = true; }
          else { inp.left = true; inp.up = true; }
          if (p.grenades > 0 && p.grenadeCooldown <= 0 && frameCount % 36 === 0) {
            inp.up = true; inp.grenade = true; inp.grenadePressed = true;
          }
        }
      } else {
        // BOSS 5 (Emperor Gava 2-Phase):
        // Phase 1 -> 45° up-right into Emperor Gava Skull (7430, 340) & Tentacles from floor (x: 7040..7160) or y=405 ledge!
        // Phase 2 -> Straight right fire & grenades into Red Falcon Heart (7435, 536) from floor (x: 6960..7100)!
        if (!boss.phase2) {
          if (p.onGround && p.y < 350 && p.currentPlatform && p.currentPlatform.droppable) {
            inp.left = false; inp.right = false;
            inp.down = true; inp.jump = true; inp.jumpPressed = true;
          } else if (p.onGround && Math.abs(p.y - 405) < 16) {
            // High firing platform
            if (p.x < 6960) inp.right = true;
            else if (p.x > 7110) inp.left = true;
            else if (p.facing < 0) inp.right = true;
          } else {
            // Floor (y=636) 45° up-right barrage!
            if (p.x < 7040) { inp.right = true; inp.up = true; }
            else if (p.x > 7160) { inp.left = true; inp.up = true; }
            else {
              if ((frameCount % 8) < 6) { inp.right = true; inp.up = true; }
              else { inp.left = true; inp.up = true; }
            }
          }
        } else {
          // Phase 2: Heart (y=536) - drop to floor and blast straight right!
          if (p.y < 580 && p.onGround && p.currentPlatform && p.currentPlatform.droppable) {
            inp.left = false; inp.right = false;
            inp.down = true; inp.jump = true; inp.jumpPressed = true;
          } else if (p.x < 6960) {
            inp.right = true;
          } else if (p.x > 7100) {
            inp.left = true;
          } else if (p.facing < 0) {
            inp.right = true;
          }
          if (p.grenades > 0 && p.grenadeCooldown <= 0 && p.x > 6960 && p.x < 7100 && frameCount % 36 === 0) {
            inp.down = true; inp.grenade = true; inp.grenadePressed = true;
          }
        }
      }

      if (destructibleOrb && destructibleOrb.dist < 190 && destructibleOrb.y < p.y - 75) {
        inp.up = true;
      }
    }

    _evadeIncomingThreats(p, level, entities, boss, cameraX, inp) {
      // Mid-air over or near chasm / cliff lip: NEVER cancel forward jump momentum!
      if (!p.onGround && (!this._hasSafeGround(level, p.x - 54, p.y) || !this._hasSafeGround(level, p.x + 54, p.y))) {
        if (p.vx >= -0.2) {
          inp.right = true;
          inp.left = false;
        }
        if (p.dashCooldown <= 0) {
          for (let i = 0; i < entities.enemyBullets.length; i++) {
            const eb = entities.enemyBullets[i];
            if (Math.hypot((eb.x + eb.vx * 5) - p.x, (eb.y + eb.vy * 5) - (p.y - 36)) < 42) {
              inp.dash = true;
              inp.dashPressed = true;
              break;
            }
          }
        }
        return;
      }

      let urgentThreat = null;
      let highBulletOnly = true;
      let anyHitStanding = false;
      let anyHitProne = false;
      let fallingThreat = null;

      for (let i = 0; i < entities.enemyBullets.length; i++) {
        const eb = entities.enemyBullets[i];
        const r = (eb.radius || 8) + 6;
        const rProne = (eb.radius || 8) + 2;
        const grav = eb.gravity || 0;
        const maxT = grav > 0 ? 38 : 19;
        let prevBy = eb.y;
        let recordedStandForEb = false;

        for (let t = 1; t <= maxT; t++) {
          const bx = eb.x + eb.vx * t;
          const by = eb.y + eb.vy * t + 0.5 * grav * t * t;

          // Gravity bombs / mortars explode on overhead ledges before reaching below!
          if (grav > 0 && by > prevBy && level.resolveLanding(bx, prevBy, by)) {
            if (by < p.y - 80) break;
          }
          prevBy = by;

          const xPad = grav > 0 ? 28 : 19;
          const hitXStand = bx + r >= p.x - xPad && bx - r <= p.x + xPad;
          const hitYStand = by + r >= p.y - 75 && by - r <= p.y - 2;
          const hitXProne = bx + rProne >= p.x - 26 && bx - rProne <= p.x + 26;
          const hitYProne = by + rProne >= p.y - 22 && by - rProne <= p.y - 2;

          if (hitXProne && hitYProne) {
            anyHitStanding = true;
            anyHitProne = true;
            highBulletOnly = false;
          }

          if (hitXStand && hitYStand) {
            anyHitStanding = true;
            if (by + rProne >= p.y - 22) {
              highBulletOnly = false;
            }
            if (!recordedStandForEb) {
              recordedStandForEb = true;
              if (grav > 0 || Math.abs(eb.vy) > Math.abs(eb.vx) * 1.15) {
                if (!fallingThreat || t < fallingThreat.t) {
                  fallingThreat = { eb, bx, by, t };
                }
              }
              if (!urgentThreat || t < urgentThreat.t) {
                urgentThreat = { eb, bx, by, t, grav };
              }
            }
          }
        }
      }

      // Check close contact with rushing / leaping / approaching enemies
      for (let i = 0; i < entities.enemies.length; i++) {
        const e = entities.enemies[i];
        if (e.type === 'barrel' || e.type === 'turret' || (e.type === 'cannon' && e.riseProgress < 0.7)) continue;
        const nextEx = e.x + (e.vx || 0) * 10;
        if (Math.abs(nextEx - p.x) < 48 && Math.abs(e.y - p.y) < 58) {
          if (p.onGround) {
            const nearCliff = p.currentPlatform && (p.currentPlatform.x + p.currentPlatform.w - p.x < 160) && !this._hasSafeGround(level, p.currentPlatform.x + p.currentPlatform.w + 20, p.y);
            if (e.x < p.x && nearCliff) {
              inp.right = true;
              inp.left = false;
              continue;
            }
            inp.down = false;
            inp.jump = true;
            inp.jumpPressed = true;
            if (e.x > p.x && this._canStepLeft(p, level, cameraX, 40)) {
              inp.left = true;
              inp.right = false;
            }
          } else if (p.dashCooldown <= 0) {
            inp.dash = true;
            inp.dashPressed = true;
          }
          return;
        }
      }

      // Check Boss contact / whipping tentacle boxes
      if (boss && boss.active && boss.getHazardBoxes) {
        const boxes = boss.getHazardBoxes();
        for (let i = 0; i < boxes.length; i++) {
          const b = boxes[i];
          const cx = b.x + b.w * 0.5;
          if (p.x + 24 > b.x && p.x - 24 < b.x + b.w && p.y > b.y - 10 && p.y - 74 < b.y + b.h) {
            inp.down = false;
            if (cx > p.x && p.x > cameraX + 80) { inp.left = true; inp.right = false; }
            else { inp.right = true; inp.left = false; }
            if (p.dashCooldown <= 0) { inp.dash = true; inp.dashPressed = true; }
            return;
          }
        }
      }

      if (!anyHitStanding) return;

      // 1) If ducking prone completely avoids the bullet(s), DUCK PRONE instead of bunny-hopping!
      if (p.onGround && !p.inWater && highBulletOnly && !anyHitProne && !(p.currentPlatform && p.currentPlatform.type === 'bridge')) {
        inp.left = false;
        inp.right = false;
        inp.up = false;
        inp.down = true;
        inp.jump = false;
        inp.jumpPressed = false;
        return;
      }

      const bossArena = !!(boss && boss.active);
      const maxRightX = bossArena
        ? (this.game.stageNum === 4 ? 6820 : (this.game.stageNum === 5 ? 7065 : (this.game.stageNum === 3 ? 6945 : cameraX + WIDTH - 260)))
        : (cameraX + WIDTH - 160);
      const minLeftX = (bossArena && this.game.stageNum === 4) ? 6455 : (cameraX + 46);

      // 2) Falling mortar / carpet bomb / steep vertical shot: sidestep OPPOSITE diagonal motion (never run along the bullet ray!)
      if (fallingThreat) {
        inp.down = false;
        const eb = fallingThreat.eb;
        const canLeft = p.x > minLeftX && this._canStepLeft(p, level, cameraX, 52);
        const canRight = p.x < maxRightX && !!this._hasSafeGround(level, p.x + 52, p.y);
        let goLeft = p.x < fallingThreat.bx;
        if ((goLeft && canLeft) || !canRight) {
          inp.left = canLeft;
          inp.right = false;
        } else {
          inp.right = true;
          inp.left = false;
        }
        if (fallingThreat.t <= 8 && p.dashCooldown <= 0 && (inp.left || inp.right)) {
          inp.dash = true;
          inp.dashPressed = true;
        }
        return;
      }

      // 3) Low horizontal / fan / rising shot: timed jump (3..15 frames ahead) or invincible Jet-Dash!
      if (urgentThreat && urgentThreat.t <= 16) {
        inp.down = false;
        const canDash = p.dashCooldown <= 0;
        const risingFromBelow = urgentThreat.eb.vy < -2.0;
        const airBlocked = canDash && entities.enemyBullets.some(
          (eb) => Math.abs((eb.x + eb.vx * 10) - p.x) < 42 && (eb.y + eb.vy * 10) < p.y - 56 && (eb.y + eb.vy * 10) > p.y - 140
        );
        const downwardAngle = urgentThreat.eb.vy > 1.0;
        const nearCliffEdge = p.onGround && p.currentPlatform && (p.currentPlatform.x + p.currentPlatform.w - p.x < 160) && !this._hasSafeGround(level, p.currentPlatform.x + p.currentPlatform.w + 20, p.y);
        if (p.onGround && urgentThreat.t >= 3 && !airBlocked && !risingFromBelow && !downwardAngle && !nearCliffEdge) {
          inp.jump = true;
          inp.jumpPressed = true;
        } else if (canDash && urgentThreat.t <= 11) {
          const safeLeft = p.x > minLeftX + 60 && this._canStepLeft(p, level, cameraX, 115);
          const safeRight = p.x < maxRightX - 40 && this._hasSafeGround(level, p.x + 115, p.y);
          if (urgentThreat.eb.vx < 0 && safeLeft) { inp.left = true; inp.right = false; }
          else if (safeRight) { inp.right = true; inp.left = false; }
          if (inp.left || inp.right) {
            inp.dash = true;
            inp.dashPressed = true;
          }
        } else if (risingFromBelow && p.onGround) {
          // Never jump upward into a rising bullet from below -> step opposite horizontal velocity!
          if (urgentThreat.eb.vx > 0 && this._canStepLeft(p, level, cameraX, 36)) {
            inp.left = true;
            inp.right = false;
          } else {
            inp.right = true;
            inp.left = false;
          }
        }
      }
    }
  }

  ns.Game = Game;
  ns.HumanLikeAgent = HumanLikeAgent;
})(window.Contra);
