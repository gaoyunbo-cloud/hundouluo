// ============================================================================
// CONTRA: SHATTERED OPS HD - Commando Controller (Dash, Dual-Weapons, Armor)
// ============================================================================
window.Contra = window.Contra || {};

(function (ns) {
  'use strict';

  const {
    WIDTH,
    HEIGHT,
    GRAVITY,
    MAX_FALL_SPEED,
    PLAYER_SPEED,
    JUMP_FORCE,
    WATER_SPEED_FACTOR,
    DASH_SPEED,
    DASH_FRAMES,
    DASH_COOLDOWN,
    STARTING_GRENADES,
    MAX_GRENADES,
    RESPAWN_INVULN_FRAMES,
    HIT_INVULN_FRAMES,
    BARRIER_FRAMES,
    WEAPONS,
    EXTRA_LIFE_SCORES
  } = ns.CONFIG;

  class Player {
    constructor(index, startX, startY, lives, maxHp = 3) {
      this.index = index; // 0 = Bill (1P), 1 = Lance (2P)
      this.name = index === 0 ? '1P BILL' : '2P LANCE';
      this.active = true;

      this.x = startX;
      this.y = startY;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;

      this.aimX = 1;
      this.aimY = 0;

      this.onGround = false;
      this.currentPlatform = null;
      this.inWater = false;
      this.state = 'normal'; // 'normal' | 'prone' | 'submerged' | 'dead'

      this.lives = lives;
      this.maxHp = maxHp;
      this.hp = maxHp;
      this.score = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.nextExtraLifeIdx = 0;

      // Dual-Weapon Slots (each { id, level: 1|2 })
      this.slots = [{ id: 'R', level: 1 }, null];
      this.activeSlot = 0;
      this.rapidFire = false;
      this.shootCooldown = 0;

      // Tactical Grenades & Dash
      this.grenades = STARTING_GRENADES;
      this.grenadeCooldown = 0;
      this.dashTimer = 0;
      this.dashCooldown = 0;
      this.dashDir = 1;

      this.invulnTimer = RESPAWN_INVULN_FRAMES;
      this.barrierTimer = 0;
      this.deathTimer = 0;

      this.coyoteTimer = 0;
      this.jumpBuffer = 0;
      this.ignorePlatformY = null;
      this.ignoreTimer = 0;

      this.moving = false;
      this.animTimer = 0;
    }

    getActiveWeapon() {
      return this.slots[this.activeSlot] || this.slots[0] || { id: 'R', level: 1 };
    }

    resetForStage(x, y) {
      if (!this.active && this.lives <= 0) return;
      this.active = true;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.onGround = false;
      this.currentPlatform = null;
      this.inWater = false;
      this.state = 'normal';
      this.hp = this.maxHp;
      this.grenades = Math.max(this.grenades, STARTING_GRENADES);
      this.dashTimer = 0;
      this.invulnTimer = 60;
    }

    addScore(pts, particles) {
      this.combo = Math.min(20, this.combo + 1);
      this.comboTimer = 150;
      const mult = 1 + Math.floor(this.combo / 5) * 0.25;
      const finalPts = Math.round(pts * mult);
      this.score += finalPts;

      while (
        this.nextExtraLifeIdx < EXTRA_LIFE_SCORES.length &&
        this.score >= EXTRA_LIFE_SCORES[this.nextExtraLifeIdx]
      ) {
        this.lives++;
        this.nextExtraLifeIdx++;
        ns.audio.sfx('oneUp');
        if (particles) {
          particles.spawnText(this.x, this.y - 96, '1UP EXTRA LIFE!', '#ffd740', 20);
        }
      }
      return finalPts;
    }

    collectPowerup(type, particles, awardFn, triggerFalconBomb) {
      awardFn(1000);

      if (type === 'R') {
        this.rapidFire = true;
        for (let s = 0; s < 2; s++) {
          if (this.slots[s] && this.slots[s].id === 'R') {
            this.slots[s].level = 2;
          }
        }
        ns.audio.sfx('weaponUpgrade');
        particles.spawnText(this.x, this.y - 92, 'RAPID FIRE +25% & CARBINE LV.2!', '#ffd740', 18);
        return;
      }
      if (type === 'B') {
        this.barrierTimer = BARRIER_FRAMES;
        this.hp = this.maxHp;
        ns.audio.sfx('powerupPick');
        particles.spawnText(this.x, this.y - 92, 'PLASMA BARRIER + FULL ARMOR!', '#40f8ff', 18);
        return;
      }
      if (type === 'G') {
        this.grenades = Math.min(MAX_GRENADES, this.grenades + 3);
        this.hp = Math.min(this.maxHp, this.hp + 1);
        ns.audio.sfx('powerupPick');
        particles.spawnText(this.x, this.y - 92, '+3 GRENADES & ARMOR!', '#69f0ae', 18);
        return;
      }
      if (type === 'N') {
        ns.audio.sfx('powerupPick');
        particles.spawnText(this.x, this.y - 92, 'TACTICAL NUKE!', '#ffffff', 20);
        if (triggerFalconBomb) triggerFalconBomb(this.index);
        return;
      }

      if (WEAPONS[type]) {
        // Check if player already holds this weapon in either slot -> Upgrade to Lv.2 MAX!
        for (let s = 0; s < 2; s++) {
          if (this.slots[s] && this.slots[s].id === type) {
            this.slots[s].level = 2;
            this.activeSlot = s;
            ns.audio.sfx('weaponUpgrade');
            particles.spawnText(this.x, this.y - 92, WEAPONS[type].short + ' LV.2 MAX!', '#ffd740', 20);
            return;
          }
        }
        // Otherwise fill empty secondary slot or replace active slot
        if (!this.slots[1]) {
          this.slots[1] = { id: type, level: 1 };
          this.activeSlot = 1;
        } else {
          this.slots[this.activeSlot] = { id: type, level: 1 };
        }
        ns.audio.sfx('powerupPick');
        particles.spawnText(this.x, this.y - 92, WEAPONS[type].short + ' EQUIPPED!', '#40f8ff', 18);
      }
    }

    getHurtbox() {
      if (!this.active || this.state === 'dead' || this.state === 'submerged' || this.dashTimer > 0) {
        return null;
      }
      if (!this.onGround && !this.inWater) {
        return { x: this.x - 15, y: this.y - 60, w: 30, h: 46 };
      }
      if (this.state === 'prone') {
        return { x: this.x - 26, y: this.y - 24, w: 52, h: 20 };
      }
      if (this.inWater) {
        return { x: this.x - 14, y: this.y - 72, w: 28, h: 34 };
      }
      return { x: this.x - 13, y: this.y - 74, w: 26, h: 68 };
    }

    takeHit(particles, instantKill = false, triggerShake = null) {
      if (!this.active || this.state === 'dead') return;
      if (!instantKill && (this.invulnTimer > 0 || this.barrierTimer > 0 || this.dashTimer > 0)) return;

      if (!instantKill && this.hp > 1) {
        this.hp--;
        this.invulnTimer = HIT_INVULN_FRAMES;
        this.combo = 0;
        particles.spawnHitSparks(this.x, this.y - 45, 12, '#ff5252');
        particles.spawnText(this.x, this.y - 88, 'ARMOR -1', '#ff5252', 16);
        ns.audio.sfx('playerHit');
        if (triggerShake) triggerShake(8, 10);
        return;
      }

      // Fatal Hit -> Lose 1 Life
      this.hp = 0;
      this.combo = 0;
      this.state = 'dead';
      this.deathTimer = 65;
      this.vx = -this.facing * 4.0;
      this.vy = -10.2;
      this.onGround = false;
      this.inWater = false;
      this.dashTimer = 0;
      this.barrierTimer = 0;
      this.rapidFire = false;

      // Downgrade active weapon on death (keep secondary slot!)
      if (this.slots[this.activeSlot] && this.slots[this.activeSlot].level > 1) {
        this.slots[this.activeSlot].level = 1;
      } else {
        this.slots[this.activeSlot] = { id: 'R', level: 1 };
      }

      particles.spawnExplosion(this.x, this.y - 42, 46, false);
      ns.audio.sfx('playerDie');
      if (triggerShake) triggerShake(11, 16);
    }

    update(inp, level, entities, particles, cameraX, partner, boss, triggerShake) {
      // 2P Life Borrow ("借命")
      if (!this.active) {
        if (partner && partner.active && partner.lives >= 2 && (inp.firePressed || inp.jumpPressed)) {
          partner.lives--;
          this.lives = 1;
          this.hp = this.maxHp;
          this.grenades = STARTING_GRENADES;
          this.active = true;
          const sp = level.findSafeSpawn(cameraX);
          this.x = sp.x;
          this.y = sp.y;
          this.vx = 0;
          this.vy = 0;
          this.state = 'normal';
          this.invulnTimer = RESPAWN_INVULN_FRAMES;
          ns.audio.sfx('oneUp');
          particles.spawnText(this.x, this.y + 30, 'BORROWED 1UP!', '#ffd740', 18);
        }
        return;
      }

      this.animTimer++;
      if (this.invulnTimer > 0) this.invulnTimer--;
      if (this.barrierTimer > 0) this.barrierTimer--;
      if (this.shootCooldown > 0) this.shootCooldown--;
      if (this.grenadeCooldown > 0) this.grenadeCooldown--;
      if (this.dashCooldown > 0) this.dashCooldown--;
      if (this.comboTimer > 0) {
        this.comboTimer--;
        if (this.comboTimer <= 0) this.combo = 0;
      }
      if (this.ignoreTimer > 0) {
        this.ignoreTimer--;
        if (this.ignoreTimer <= 0) this.ignorePlatformY = null;
      }

      // Death & Respawn Sequence
      if (this.state === 'dead') {
        const prevY = this.y;
        this.x += this.vx;
        this.y += this.vy;
        this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY);

        const land = level.resolveLanding(this.x, prevY, this.y);
        if (land) {
          this.y = land.y;
          this.vy = 0;
          this.vx = 0;
        }
        this.x = Math.max(cameraX + 28, Math.min(cameraX + WIDTH - 28, this.x));

        this.deathTimer--;
        if (this.deathTimer <= 0) {
          this.lives--;
          if (this.lives > 0) {
            const sp = level.findSafeSpawn(cameraX);
            this.x = sp.x;
            this.y = sp.y;
            this.vx = 0;
            this.vy = 0;
            this.onGround = false;
            this.state = 'normal';
            this.hp = this.maxHp;
            this.grenades = STARTING_GRENADES;
            this.invulnTimer = RESPAWN_INVULN_FRAMES;
          } else {
            this.active = false;
          }
        }
        return;
      }

      // Ride Moving Platform delta!
      if (this.onGround && this.currentPlatform && this.currentPlatform.type === 'moving') {
        this.x += this.currentPlatform.dx || 0;
        this.y += this.currentPlatform.dy || 0;
      }

      // Dual-Weapon Slot Swap (Q / E)
      if (inp.swapPressed && this.slots[1]) {
        this.activeSlot = 1 - this.activeSlot;
        ns.audio.sfx('weaponSwap');
        const curW = this.getActiveWeapon();
        particles.spawnText(this.x, this.y - 88, WEAPONS[curW.id].short, '#40f8ff', 15);
      }

      // Directional Input
      let moveDir = 0;
      if (inp.left && !inp.right) moveDir = -1;
      else if (inp.right && !inp.left) moveDir = 1;
      if (moveDir !== 0 && this.dashTimer <= 0) {
        this.facing = moveDir;
      }

      // Trigger Tactical Jet-Dash (L / Shift)!
      if (inp.dashPressed && this.dashCooldown <= 0 && this.dashTimer <= 0 && this.state !== 'submerged') {
        this.dashTimer = DASH_FRAMES;
        this.dashCooldown = DASH_COOLDOWN;
        this.dashDir = moveDir !== 0 ? moveDir : this.facing;
        this.facing = this.dashDir;
        this.vy = Math.min(0, this.vy);
        ns.audio.sfx('dash');
      }

      if (this.dashTimer > 0) {
        this.dashTimer--;
        this.vx = this.dashDir * DASH_SPEED;
        this.vy = 0;
        if (this.dashTimer % 2 === 0) {
          particles.spawnGhost(this.x, this.y, this.facing, this.index === 0, 'roll');
        }
      } else {
        const spd = this.inWater ? PLAYER_SPEED * WATER_SPEED_FACTOR : PLAYER_SPEED;
        const crouchLocked = this.onGround && inp.down && moveDir === 0;
        this.vx = crouchLocked ? 0 : moveDir * spd;
      }
      this.moving = Math.abs(this.vx) > 0.2;

      // Posture & 8-Direction Aiming
      if (this.inWater && this.onGround && inp.down && moveDir === 0 && this.dashTimer <= 0) {
        this.state = 'submerged';
      } else if (this.onGround && !this.inWater && inp.down && moveDir === 0 && this.dashTimer <= 0) {
        this.state = 'prone';
      } else {
        this.state = 'normal';
      }

      this._updateAimVector(inp, moveDir);

      // Jump & Drop-Down Logic
      if (this.onGround) this.coyoteTimer = 7;
      else if (this.coyoteTimer > 0) this.coyoteTimer--;

      if (inp.jumpPressed) this.jumpBuffer = 7;
      else if (this.jumpBuffer > 0) this.jumpBuffer--;

      if (this.jumpBuffer > 0) {
        if (
          this.onGround &&
          inp.down &&
          moveDir === 0 &&
          this.currentPlatform &&
          this.currentPlatform.droppable
        ) {
          this.ignorePlatformY = this.currentPlatform.y;
          this.ignoreTimer = 14;
          this.onGround = false;
          this.currentPlatform = null;
          this.y += 10;
          this.vy = 2.5;
          this.state = 'normal';
          this.jumpBuffer = 0;
        } else if (this.coyoteTimer > 0) {
          this.vy = JUMP_FORCE;
          this.onGround = false;
          this.currentPlatform = null;
          this.inWater = false;
          this.dashTimer = 0;
          this.state = 'normal';
          this.coyoteTimer = 0;
          this.jumpBuffer = 0;
          ns.audio.sfx('jump');
        }
      }

      // Integrate Physics & Platform Collisions
      const prevY = this.y;
      this.x += this.vx;
      const rightBound = boss && boss.active ? cameraX + WIDTH - 140 : Math.min(level.length - 36, cameraX + WIDTH - 36);
      this.x = Math.max(cameraX + 28, Math.min(rightBound, this.x));

      if (this.dashTimer <= 0) {
        this.y += this.vy;
        this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY);
      }

      const land = level.resolveLanding(this.x, prevY, this.y, this.ignorePlatformY);
      if (land && this.vy >= 0) {
        this.y = land.y;
        this.vy = 0;
        this.onGround = true;
        this.currentPlatform = land;
      } else if (this.dashTimer <= 0) {
        this.onGround = false;
        this.currentPlatform = null;
      }

      // Water Check
      const wz = level.getWaterAt(this.x, this.y);
      const nowWater = !!wz;
      if (nowWater !== this.inWater) {
        particles.spawnWaterSplash(this.x, wz ? wz.surfaceY : prevY - 30, false);
        ns.audio.sfx('splash');
        this.inWater = nowWater;
      }

      // Lethal Lava / Acid Pool Check!
      const lz = level.getLavaAt(this.x, this.y);
      if (lz) {
        particles.spawnWaterSplash(this.x, lz.surfaceY, true);
        this.takeHit(particles, true, triggerShake);
        return;
      }

      // Bottomless Pit Check
      if (this.y > HEIGHT + 42) {
        this.takeHit(particles, true, triggerShake);
        return;
      }

      // Throw Frag Grenade (I / U / G)!
      if (inp.grenadePressed && this.grenades > 0 && this.grenadeCooldown <= 0 && this.state !== 'submerged') {
        this.grenades--;
        this.grenadeCooldown = 26;
        const gx = this.x + this.facing * 20;
        const gy = this.y - 52;
        const gvx = this.facing * 9.8 + this.vx * 0.4;
        const gvy = inp.up ? -13.2 : (inp.down ? -5.5 : -9.8);
        entities.spawnGrenade(this.index, gx, gy, gvx, gvy);
        ns.audio.sfx('grenadeThrow');
      }

      // Fire Active Weapon!
      const slot = this.getActiveWeapon();
      const wep = WEAPONS[slot.id] || WEAPONS.R;
      const wantFire = inp.firePressed || inp.fire;
      if (wantFire && this.state !== 'submerged' && this.shootCooldown <= 0) {
        this._fireWeapon(slot, wep, inp.firePressed, entities, particles);
      }
    }

    _updateAimVector(inp, moveDir) {
      const d = 0.70710678;
      if (!this.onGround && !this.inWater) {
        if (moveDir !== 0 && inp.up) { this.aimX = moveDir * d; this.aimY = -d; }
        else if (moveDir !== 0 && inp.down) { this.aimX = moveDir * d; this.aimY = d; }
        else if (inp.up) { this.aimX = 0; this.aimY = -1; }
        else if (inp.down) { this.aimX = 0; this.aimY = 1; }
        else { this.aimX = this.facing; this.aimY = 0; }
        return;
      }
      if (this.state === 'prone') {
        this.aimX = this.facing;
        this.aimY = 0;
        return;
      }
      if (moveDir !== 0 && inp.up) { this.aimX = moveDir * d; this.aimY = -d; }
      else if (moveDir !== 0 && inp.down && !this.inWater) { this.aimX = moveDir * d; this.aimY = d; }
      else if (inp.up && moveDir === 0) { this.aimX = 0; this.aimY = -1; }
      else { this.aimX = this.facing; this.aimY = 0; }
    }

    _fireWeapon(slot, wep, isTap, entities, particles) {
      if (slot.id !== 'L' && entities.countPlayerBullets(this.index) >= wep.maxBullets) {
        return;
      }

      const lv2 = slot.level >= 2;
      let cd = lv2 ? wep.lv2Cooldown : wep.cooldown;
      if (this.rapidFire) cd = Math.max(3, Math.round(cd * 0.75));
      this.shootCooldown = isTap ? Math.max(3, cd - 1) : cd;

      let ox = this.x + this.aimX * 38;
      let oy = this.y - 54 + this.aimY * 34;

      if (!this.onGround && !this.inWater) {
        oy = this.y - 36 + this.aimY * 28;
      } else if (this.state === 'prone') {
        ox = this.x + this.facing * 52;
        oy = this.y - 14;
      } else if (this.aimX === 0 && this.aimY < 0) {
        ox = this.x + this.facing * 6;
        oy = this.y - 92;
      }

      const spd = wep.speed * (this.rapidFire ? 1.15 : 1.0);
      const dmg = lv2 ? wep.lv2Damage : wep.damage;
      const baseAng = Math.atan2(this.aimY, this.aimX);

      if (slot.id === 'S') {
        const angles = lv2 ? wep.spreadLv2 : wep.spreadLv1;
        for (let i = 0; i < angles.length; i++) {
          const a = baseAng + angles[i];
          entities.spawnPlayerBullet({
            owner: this.index, weapon: 'S', lv2,
            baseX: ox, baseY: oy, x: ox, y: oy,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            radius: lv2 ? 9 : 7.5, damage: dmg
          });
        }
        ns.audio.sfx('shootS');
      } else if (slot.id === 'L') {
        entities.spawnPlayerBullet({
          owner: this.index, weapon: 'L', lv2,
          baseX: ox, baseY: oy, x: ox, y: oy,
          vx: Math.cos(baseAng) * spd, vy: Math.sin(baseAng) * spd,
          radius: lv2 ? 14 : 10, damage: dmg, pierce: true
        });
        ns.audio.sfx('shootL');
      } else if (slot.id === 'C') {
        const count = lv2 ? [-0.18, 0.18] : [0];
        for (let i = 0; i < count.length; i++) {
          const a = baseAng + count[i];
          entities.spawnPlayerBullet({
            owner: this.index, weapon: 'C', lv2,
            baseX: ox, baseY: oy, x: ox, y: oy,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            radius: 9, damage: dmg, homing: true
          });
        }
        ns.audio.sfx('shootC');
      } else {
        // Carbine R, Vulcan M, Napalm F (Lv.2 fires twin parallel rounds for R & M!)
        const offsets = (lv2 && (slot.id === 'R' || slot.id === 'M')) ? [-5, 5] : [0];
        const nx = -Math.sin(baseAng);
        const ny = Math.cos(baseAng);
        for (let i = 0; i < offsets.length; i++) {
          const bx = ox + nx * offsets[i];
          const by = oy + ny * offsets[i];
          entities.spawnPlayerBullet({
            owner: this.index, weapon: slot.id, lv2,
            baseX: bx, baseY: by, x: bx, y: by,
            vx: Math.cos(baseAng) * spd, vy: Math.sin(baseAng) * spd,
            radius: slot.id === 'F' ? 12 : 8,
            damage: offsets.length > 1 ? dmg * 0.72 : dmg,
            spiral: !!wep.spiral,
            explosive: !!wep.explosive
          });
        }
        if (slot.id === 'R' || slot.id === 'M') {
          particles.spawnShell(this.x + this.facing * 12, oy, this.facing);
        }
        ns.audio.sfx(slot.id === 'M' ? 'shootM' : (slot.id === 'F' ? 'shootF' : 'shootR'));
      }

      particles.spawnMuzzle(ox, oy, this.aimX, this.aimY, wep.glow);
    }

    draw(ctx, cameraX, frameCount) {
      if (!this.active) return;
      ctx.save();
      ctx.translate(-cameraX, 0);
      ns.Sprites.drawCommando(ctx, this, frameCount);
      ctx.restore();
    }
  }

  ns.Player = Player;
})(window.Contra);
