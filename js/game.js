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
          this.players[i].autoPilotSafe = true;
        } else if (onlineHost) {
          pInp = i === 0 ? ns.input.getLocalPrimaryInput() : ns.netplay.getRemoteGuestInput();
          this.players[i].autoPilotSafe = false;
        } else {
          pInp = ns.input.getPlayerInput(i);
          this.players[i].autoPilotSafe = false;
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

      ctx.font = '900 72px "Impact", "Arial Black", "PingFang SC", sans-serif';
      ctx.fillStyle = '#b71c1c';
      ctx.fillText('魂斗罗 CONTRA', 88, 106);
      ctx.fillStyle = '#ffd740';
      ctx.fillText('魂斗罗 CONTRA', 84, 100);

      ctx.font = '800 24px "PingFang SC", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText('SHATTERED OPS HD · 铁血重装版', 86, 186);

      // Interactive Tactical Menu Options
      const diff = this.getDifficulty();
      const rows = [
        { label: '作战人数 MODE', val: this.twoPlayers ? '◀  2 PLAYERS 双人同屏联机  ▶' : '◀  1 PLAYER 单人铁血闯关  ▶' },
        { label: '战术难度 DIFFICULTY', val: `◀  ${diff.name}  ▶`, sub: diff.desc },
        { label: '起始关卡 STAGE SELECT', val: `◀  STAGE ${this.selectedStartStage} / 5  ▶` }
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

        ctx.font = '800 20px "PingFang SC", sans-serif';
        ctx.fillStyle = selected ? '#ffd740' : '#e2e8f0';
        ctx.fillText(rows[i].val, 104, ry + 32);

        if (rows[i].sub) {
          ctx.font = '12px "PingFang SC", sans-serif';
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(rows[i].sub, 330, ry + 11);
        }
      }

      // High Score & Konami Status
      ctx.font = '700 16px monospace';
      ctx.fillStyle = '#ffab40';
      ctx.fillText('HI-SCORE: ' + String(this.highScore).padStart(8, '0'), 86, 548);

      ctx.font = '700 15px "PingFang SC", sans-serif';
      ctx.fillStyle = '#69f0ae';
      ctx.fillText('🌐 异地跨网络双人联机：点击顶栏「异地联机大厅」或按 O 键创建/加入 6 位房间码！', 86, 574);

      if (this.konamiActive) {
        ctx.fillStyle = '#ffd740';
        ctx.fillText('★ 30命科乐美神级秘籍已激活 (30 LIVES ACTIVE)! ★', 86, 600);
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px "PingFang SC", sans-serif';
        ctx.fillText('支持上/下选择，左/右切换难度与选关 · 秘籍: ↑↑↓↓←→←→BA (30命)', 86, 602);
      }

      if (Math.floor(this.frameCount / 22) % 2 === 0) {
        ctx.font = '900 24px "Arial Black", "PingFang SC", sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('▶ 按 ENTER / SPACE / J 立即出击！', 86, 642);
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
        ctx.font = '800 15px "PingFang SC", sans-serif';
        ctx.fillStyle = '#ffd740';
        ctx.fillText(
          partner && partner.active && partner.lives >= 2 ? '按射击键向队友借命复活！' : 'GAME OVER · 战死',
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
      ctx.font = '900 46px "Impact", "PingFang SC", sans-serif';
      ctx.fillStyle = '#ffd740';
      ctx.fillText('PAUSED · 战术暂停', WIDTH * 0.5, HEIGHT * 0.44);
      ctx.font = '20px "PingFang SC", sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('按 P / ESC 继续战斗   |   按 R 返回主菜单', WIDTH * 0.5, HEIGHT * 0.55);
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

      ctx.font = '800 22px "PingFang SC", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('STAGE CLEAR BONUS: +8,000 PTS', WIDTH * 0.5, HEIGHT * 0.5 + 10);

      ctx.font = '16px "PingFang SC", sans-serif';
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(this.stageNum < 5 ? `正在突入第 ${this.stageNum + 1} 战区...` : '红隼母巢崩塌中，全员撤离！', WIDTH * 0.5, HEIGHT * 0.5 + 58);
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

        const opts = ['CONTINUE · 原地满血再战', 'TITLE MENU · 返回主菜单'];
        for (let i = 0; i < 2; i++) {
          const y = 405 + i * 52;
          ctx.fillStyle = this.gameOverCursor === i ? '#00e5ff' : '#94a3b8';
          ctx.font = '800 24px "PingFang SC", sans-serif';
          ctx.fillText((this.gameOverCursor === i ? '▶  ' : '    ') + opts[i], WIDTH * 0.5, y);
        }
      } else {
        ctx.font = '800 22px "PingFang SC", sans-serif';
        ctx.fillStyle = '#ffd740';
        ctx.fillText('按 ENTER / SPACE 返回主菜单', WIDTH * 0.5, 390);
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

      ctx.font = '800 26px "PingFang SC", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('恭喜通关！天王鬼与红隼异形母巢已被彻底毁灭！', WIDTH * 0.5, 155);

      const best = Math.max(...this.players.map((p) => p.score));
      const rank = best >= 120000 ? 'SSS · 传奇战神' : (best >= 75000 ? 'S · 王牌铁血兵王' : 'A · 精锐特种兵');
      ctx.font = '800 22px monospace';
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(`FINAL SCORE: ${String(best).padStart(8, '0')}   |   COMBAT RANK: ${rank}`, WIDTH * 0.5, 615);

      if (this.stateTimer > 90 && Math.floor(this.frameCount / 22) % 2 === 0) {
        ctx.font = '800 20px "PingFang SC", sans-serif';
        ctx.fillStyle = '#ffd740';
        ctx.fillText('按 ENTER / SPACE 返回标题画面再次挑战更高难度', WIDTH * 0.5, 668);
      }
    }

  }

  // ============================================================================
  // Realistic Human Pro-Player Simulation Agent (Pacing, Crouch, Burst, Deaths)
  // Designed for Authentic Streaming & Social Media Clips (Zero Cheating Tells)
  // ============================================================================
  class HumanLikeAgent {
    constructor(game) {
      this.game = game;
      this.state = 'advance'; // 'advance', 'hold_fire', 'crouch_fire', 'loot', 'boss_tactics'
      this.stateTimer = 0;
      this.target = null;
      this.lootTarget = null;
      this.burstTimer = 0;
      this.burstFiring = true;
      this.plannedDeathsDone = 0;
      this.stageDeaths = {};
      this.stuckTimer = 0;
      this.lastX = 0;
    }

    reset() {
      this.state = 'advance';
      this.stateTimer = 0;
      this.target = null;
      this.lootTarget = null;
      this.burstTimer = 0;
      this.burstFiring = true;
      this.plannedDeathsDone = 0;
      this.stageDeaths = {};
      this.stuckTimer = 0;
      this.lastX = 0;
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

      if (!p.active || p.state === 'dead') return inp;

      // Track progress / stuck detection
      if (Math.abs(p.x - this.lastX) < 1.0) {
        this.stuckTimer++;
      } else {
        this.stuckTimer = 0;
        this.lastX = p.x;
      }

      const isBossFight = boss && boss.active && !boss.dying && !boss.dead;

      // 1. Scan Environment: Boss > Nearest Enemy > Dropped Powerup Item > Flying Pod
      let primaryTarget = null;
      let targetDist = Infinity;
      let enemyAheadCount = 0;

      if (isBossFight) {
        const pts = boss.getTargetPoints();
        if (pts.length > 0) {
          primaryTarget = pts[0];
          targetDist = Math.hypot(pts[0].x - p.x, pts[0].y - p.y);
        }
      }

      // Check dropped powerups (Looting priority!)
      this.lootTarget = null;
      for (let i = 0; i < entities.powerups.length; i++) {
        const pu = entities.powerups[i];
        if (pu.x >= cameraX - 20 && pu.x <= cameraX + ns.CONFIG.WIDTH + 40) {
          this.lootTarget = pu;
          break;
        }
      }

      // Scan enemies
      for (let i = 0; i < entities.enemies.length; i++) {
        const e = entities.enemies[i];
        if (e.x >= cameraX - 30 && e.x <= cameraX + ns.CONFIG.WIDTH + 60) {
          const ey = (e.type === 'turret' || e.type === 'drone') ? e.y : e.y - (e.h || 50) * 0.5;
          const dist = Math.hypot(e.x - p.x, ey - p.y);
          if (e.x > p.x - 30) enemyAheadCount++;
          if (!primaryTarget || dist < targetDist) {
            targetDist = dist;
            primaryTarget = { x: e.x, y: ey, type: e.type, obj: e };
          }
        }
      }

      // Scan weapon containers (flying pods / pillboxes)
      for (let i = 0; i < entities.containers.length; i++) {
        const c = entities.containers[i];
        if (c.x >= cameraX - 20 && c.x <= cameraX + ns.CONFIG.WIDTH + 60) {
          const cDist = Math.hypot(c.x - p.x, c.y - p.y);
          if (!primaryTarget || cDist < targetDist) {
            targetDist = cDist;
            primaryTarget = { x: c.x, y: c.y, type: 'container' };
          }
          break;
        }
      }

      this.target = primaryTarget;

      // 2. Realistic Pacing State Machine (走走停停、下蹲射击、搜寻物资)
      if (this.stateTimer > 0) this.stateTimer--;

      if (this.stateTimer <= 0) {
        if (this.lootTarget && Math.abs(this.lootTarget.x - p.x) < 340) {
          this.state = 'loot';
          this.stateTimer = 40;
        } else if (isBossFight) {
          this.state = 'boss_tactics';
          this.stateTimer = 35;
        } else if (enemyAheadCount >= 2 && targetDist < 380) {
          // Tactical pause: stop and shoot, or crouch behind cover
          if (Math.random() < 0.55 && p.onGround) {
            this.state = 'crouch_fire';
            this.stateTimer = 25 + Math.floor(Math.random() * 25); // 0.4s ~ 0.8s crouch
          } else {
            this.state = 'hold_fire';
            this.stateTimer = 22 + Math.floor(Math.random() * 20);
          }
        } else if (enemyAheadCount === 0 && Math.random() < 0.08) {
          // Natural slight pause or check-step
          this.state = 'advance';
          this.stateTimer = 45 + Math.floor(Math.random() * 35);
        } else {
          this.state = 'advance';
          this.stateTimer = 60;
        }
      }

      // 3. Movement Execution based on State
      if (this.state === 'loot' && this.lootTarget) {
        // Move towards the dropped powerup
        const dx = this.lootTarget.x - p.x;
        if (dx > 12) inp.right = true;
        else if (dx < -12) inp.left = true;
        if (this.lootTarget.y < p.y - 28 && p.onGround) {
          inp.jump = true;
          inp.jumpPressed = true;
        }
      } else if (this.state === 'crouch_fire' && p.onGround) {
        // Classic Contra crouch-and-shoot pose
        inp.down = true;
        if (this.target && this.target.x < p.x) inp.left = true;
        else inp.right = true;
      } else if (this.state === 'hold_fire') {
        // Stop moving horizontally, just stand and aim/fire
        if (this.target && this.target.x < p.x) inp.left = true;
        else inp.right = true;
      } else if (this.state === 'boss_tactics') {
        // Pro boss spacing and strafe
        if (this.target) {
          const dist = this.target.x - p.x;
          if (dist < 260) {
            inp.left = true;
          } else if (dist > 450) {
            inp.right = true;
          } else {
            if (frameCount % 60 < 25) inp.left = true;
            else if (frameCount % 60 < 50) inp.right = true;
          }
        }
        if (p.onGround && frameCount % 48 === 0) {
          inp.jump = true;
          inp.jumpPressed = true;
        }
      } else {
        // 'advance': Smooth, deliberate progression
        inp.right = true;
      }

      // 4. Platform Navigation & Terrain Awareness
      if (this.state !== 'crouch_fire') {
        const lookDir = inp.right ? 1 : (inp.left ? -1 : p.facing);
        const aheadX = p.x + lookDir * 45;
        const groundAhead = level.resolveLanding(aheadX, p.y - 45, p.y + 70);
        const lavaAhead = level.getLavaAt(aheadX, p.y + 20);

        // Jump across chasms, lava, or up to higher ledge
        if (!groundAhead || lavaAhead) {
          if (p.onGround) {
            inp.jump = true;
            inp.jumpPressed = true;
          }
        } else if (groundAhead && groundAhead.y < p.y - 28) {
          if (p.onGround) {
            inp.jump = true;
            inp.jumpPressed = true;
          }
        }

        // Unstuck jump if bumping into wall / ledge
        if (p.onGround && this.stuckTimer > 18) {
          inp.jump = true;
          inp.jumpPressed = true;
          if (this.stuckTimer > 40 && p.dashCooldown <= 0) {
            inp.dash = true;
            inp.dashPressed = true;
          }
        }

        // Bridge segment collapse reaction
        for (let b = 0; b < level.bridgeSegments.length; b++) {
          const bs = level.bridgeSegments[b];
          if (bs.triggered && bs.alive && Math.abs(p.x - bs.x) < 50) {
            inp.jump = true;
            inp.jumpPressed = true;
            inp.right = true;
            break;
          }
        }
      }

      // 5. Natural Aiming
      if (this.target) {
        const dx = this.target.x - p.x;
        const dy = this.target.y - (p.y - 42);

        if (dx < -25) {
          if (this.state !== 'advance') inp.left = true;
        } else if (dx > 25) {
          if (this.state !== 'advance') inp.right = true;
        }

        if (dy < -40) {
          inp.up = true;
        } else if (dy > 45 && !p.onGround) {
          inp.down = true;
        }
      }

      // 6. Natural Shooting Rhythm & Burst Fire
      this.burstTimer++;
      if (this.burstTimer % 18 === 0) {
        this.burstFiring = Math.random() < 0.92;
      }
      if (this.burstFiring || isBossFight || (this.target && targetDist < 300)) {
        inp.fire = true;
        inp.firePressed = (frameCount % 3 !== 0);
      }

      // Tactical Frag Grenade: throw at shielded enemies, turrets, barrels, or boss
      if (p.grenades > 0 && p.grenadeCooldown <= 0 && this.target) {
        const isTough = isBossFight || (this.target.type === 'shield' || this.target.type === 'turret' || this.target.type === 'cannon' || this.target.type === 'barrel');
        if (isTough && targetDist < 320 && Math.abs(this.target.y - p.y) < 160) {
          if (frameCount % 36 === 0) {
            inp.grenade = true;
            inp.grenadePressed = true;
          }
        }
      }

      // 7. Tactical Weapon Swap
      if (p.slots[1] && p.slots[1].id !== p.slots[0].id) {
        const curW = p.getActiveWeapon();
        const otherW = p.slots[1 - p.activeSlot];
        if (otherW && (otherW.id === 'S' || otherW.id === 'L' || otherW.level > curW.level)) {
          if (frameCount % 90 === 0 && Math.random() < 0.3) {
            inp.swap = true;
            inp.swapPressed = true;
          }
        }
      }

      // 8. Controlled, Dramatic Deaths ("最好还死几次，这种看起来真实一点")
      // Condition: Stage 2 (Death 1) and Stage 4 (Death 2) when lives >= 3
      const canPlanDeath = this.plannedDeathsDone < 2 &&
                           p.lives >= 3 &&
                           (this.game.stageNum === 2 || this.game.stageNum === 4) &&
                           !this.stageDeaths[this.game.stageNum] &&
                           this.game.state === 'playing';

      let shouldTakeHitThisFrame = false;
      if (canPlanDeath) {
        if (isBossFight || enemyAheadCount >= 2) {
          if (p.hp === 1 && Math.random() < 0.04) {
            shouldTakeHitThisFrame = true;
            this.plannedDeathsDone++;
            this.stageDeaths[this.game.stageNum] = true;
          }
        }
      }

      // 9. Bullet Evasion (unless taking the planned dramatic death!)
      if (!shouldTakeHitThisFrame) {
        for (let i = 0; i < entities.enemyBullets.length; i++) {
          const eb = entities.enemyBullets[i];
          const bdist = Math.hypot(eb.x - p.x, eb.y - (p.y - 36));
          if (bdist < 105) {
            const bulletY = eb.y;
            const playerChestY = p.y - 36;

            if (p.dashCooldown <= 0 && (bdist < 65 || p.hp <= 1)) {
              inp.dash = true;
              inp.dashPressed = true;
            } else if (p.onGround && bulletY < playerChestY && bulletY > p.y - 68) {
              inp.down = true;
            } else if (p.onGround && bulletY >= playerChestY) {
              inp.jump = true;
              inp.jumpPressed = true;
            }
            break;
          }
        }
      }

      // 10. Emergency Pit Bounce
      if (p.y > ns.CONFIG.HEIGHT - 85) {
        p.vy = -12.5;
        p.y = Math.min(p.y, ns.CONFIG.HEIGHT - 90);
        inp.jump = true;
        inp.jumpPressed = true;
      }

      return inp;
    }
  }

  ns.Game = Game;
  ns.HumanLikeAgent = HumanLikeAgent;
})(window.Contra);
