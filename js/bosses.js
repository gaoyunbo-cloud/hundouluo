// ============================================================================
// CONTRA: SHATTERED OPS HD - 5 Epic Multi-Attack Stage Bosses
// ============================================================================
window.Contra = window.Contra || {};

(function (ns) {
  'use strict';

  // Shared death chain-explosion handler
  function stepBossDeath(boss, cx, cy, spanW, spanH, particles, triggerShake) {
    boss.deathTimer--;
    if (boss.deathTimer % 6 === 0) {
      const ex = cx + (Math.random() - 0.5) * spanW;
      const ey = cy + (Math.random() - 0.5) * spanH;
      particles.spawnExplosion(ex, ey, 72, true);
      ns.audio.sfx('explosion');
      if (triggerShake) triggerShake(12, 10);
    }
    if (boss.deathTimer <= 0) {
      boss.dying = false;
      boss.dead = true;
      ns.audio.sfx('bossExplosion');
    }
  }

  // ==========================================================================
  // BOSS 1: TITAN FORTRESS WALL
  // ==========================================================================
  class TitanWallBoss {
    constructor(hpMult = 1) {
      this.name = 'TITAN FORTRESS WALL';
      this.cnName = 'TITAN FORTRESS WALL';
      this.wallX = 7320;
      this.floorY = 636;

      this.core = { x: 7355, y: 545, r: 46, hp: 145 * hpMult, maxHp: 145 * hpMult, flash: 0 };
      this.cannons = [
        { x: 7335, y: 390, r: 32, hp: 42 * hpMult, alive: true, flash: 0, cd: 55 },
        { x: 7415, y: 390, r: 32, hp: 42 * hpMult, alive: true, flash: 0, cd: 95 }
      ];
      this.eye = { x: 7365, y: 255, r: 28, hp: 48 * hpMult, alive: true, flash: 0, cd: 110 };

      this.active = false;
      this.dying = false;
      this.dead = false;
      this.deathTimer = 0;
    }

    getHealthRatio() { return Math.max(0, this.core.hp / this.core.maxHp); }

    getTargetPoints() {
      const pts = [{ x: this.core.x, y: this.core.y }];
      this.cannons.forEach((c) => { if (c.alive) pts.push({ x: c.x, y: c.y }); });
      if (this.eye.alive) pts.push({ x: this.eye.x, y: this.eye.y });
      return pts;
    }

    getHazardBoxes() { return []; }

    applyAoEDamage(ownerIdx, x, y, radius, dmg, particles, awardScore, triggerShake) {
      if (Math.hypot(this.core.x - x, this.core.y - y) <= radius + this.core.r) {
        this._damageCore(ownerIdx, dmg, particles, null, awardScore, triggerShake);
      }
      this.cannons.forEach((c) => {
        if (c.alive && Math.hypot(c.x - x, c.y - y) <= radius + c.r) {
          c.hp -= dmg;
          c.flash = 5;
          if (c.hp <= 0) {
            c.alive = false;
            particles.spawnExplosion(c.x, c.y, 58, true);
            awardScore(ownerIdx, 2000, c.x, c.y - 20);
          }
        }
      });
    }

    _damageCore(ownerIdx, dmg, particles, entities, awardScore, triggerShake) {
      this.core.hp -= dmg;
      this.core.flash = 4;
      if (this.core.hp <= 0 && !this.dying) {
        this.core.hp = 0;
        this.dying = true;
        this.deathTimer = 135;
        this.cannons.forEach((c) => { c.alive = false; });
        this.eye.alive = false;
        if (entities) { entities.enemyBullets = []; entities.enemies = []; }
        ns.audio.stopBGM();
        ns.audio.sfx('bossExplosion');
        awardScore(ownerIdx, 12000, this.core.x, this.core.y - 40);
        if (triggerShake) triggerShake(16, 30);
      }
    }

    update(entities, players, particles, frameCount, diff, awardScore, triggerShake) {
      if (this.dead || !this.active) return;
      if (this.dying) {
        stepBossDeath(this, this.wallX + 70, 410, 180, 380, particles, triggerShake);
        return;
      }

      const spdMult = (diff && diff.bulletSpeedMult) || 1;
      if (this.core.flash > 0) this.core.flash--;
      if (this.eye.flash > 0) this.eye.flash--;

      const target = entities._pickTarget(this.core.x, this.core.y, players);
      const rage = this.core.hp < this.core.maxHp * 0.45 ? 0.72 : 1.0;

      // Upper Plasma Eye 3-way fan shot
      if (this.eye.alive) {
        this.eye.cd--;
        if (this.eye.cd <= 0 && target) {
          this.eye.cd = Math.round(105 * rage);
          const base = Math.atan2((target.y - 40) - this.eye.y, target.x - this.eye.x);
          [-0.22, 0, 0.22].forEach((off) => {
            const a = base + off;
            entities.spawnEnemyBullet({
              x: this.eye.x - 20, y: this.eye.y,
              vx: Math.cos(a) * 6.6 * spdMult,
              vy: Math.sin(a) * 6.6 * spdMult,
              radius: 8, color: '#00e5ff'
            });
          });
        }
      }

      // Twin Mortar Cannons
      for (let i = 0; i < this.cannons.length; i++) {
        const c = this.cannons[i];
        if (!c.alive) continue;
        if (c.flash > 0) c.flash--;
        c.cd--;
        if (c.cd <= 0) {
          c.cd = Math.round((86 + i * 24) * rage);
          entities.spawnEnemyBullet({
            x: c.x - 26, y: c.y,
            vx: -(5.5 + Math.random() * 5.8) * spdMult,
            vy: -7.5 - Math.random() * 3.0,
            gravity: 0.34,
            radius: 11, color: '#ff9100'
          });
          particles.spawnMuzzle(c.x - 32, c.y, -1, -0.3, 'fire');
        }
      }

      // Bullet Collisions
      for (let j = entities.playerBullets.length - 1; j >= 0; j--) {
        const b = entities.playerBullets[j];

        if (this.eye.alive && Math.hypot(b.x - this.eye.x, b.y - this.eye.y) <= this.eye.r + b.radius) {
          if (b.hitSet && b.hitSet.has(this.eye)) continue;
          this.eye.hp -= b.damage;
          this.eye.flash = 3;
          particles.spawnHitSparks(b.x, b.y, 6, '#00e5ff');
          if (b.pierce) b.hitSet.add(this.eye); else entities.playerBullets.splice(j, 1);
          if (this.eye.hp <= 0) {
            this.eye.alive = false;
            particles.spawnExplosion(this.eye.x, this.eye.y, 54, true);
            ns.audio.sfx('explosion');
            awardScore(b.owner, 2500, this.eye.x, this.eye.y - 24);
          } else ns.audio.sfx('hitArmor');
          continue;
        }

        let hitSub = false;
        for (let i = 0; i < this.cannons.length; i++) {
          const c = this.cannons[i];
          if (!c.alive) continue;
          if (Math.hypot(b.x - c.x, b.y - c.y) <= c.r + b.radius) {
            if (b.hitSet && b.hitSet.has(c)) continue;
            c.hp -= b.damage;
            c.flash = 3;
            particles.spawnHitSparks(b.x, b.y, 6, '#ffd740');
            if (b.pierce) b.hitSet.add(c); else entities.playerBullets.splice(j, 1);
            if (c.hp <= 0) {
              c.alive = false;
              particles.spawnExplosion(c.x, c.y, 56, true);
              ns.audio.sfx('explosion');
              awardScore(b.owner, 2000, c.x, c.y - 24);
            } else ns.audio.sfx('hitArmor');
            hitSub = true;
            break;
          }
        }
        if (hitSub) continue;

        if (Math.hypot(b.x - this.core.x, b.y - this.core.y) <= this.core.r + b.radius) {
          if (b.hitSet && b.hitSet.has(this.core)) continue;
          particles.spawnHitSparks(b.x, b.y, 7, '#ff6d00');
          ns.audio.sfx('hitArmor');
          if (b.pierce) b.hitSet.add(this.core); else entities.playerBullets.splice(j, 1);
          this._damageCore(b.owner, b.damage, particles, entities, awardScore, triggerShake);
          if (this.dying) break;
          continue;
        }

        if (b.x >= this.wallX + 20 && b.y >= 190 && b.y <= this.floorY) {
          particles.spawnHitSparks(b.x, b.y, 4, '#94a3b8');
          entities.playerBullets.splice(j, 1);
        }
      }
    }

    draw(ctx, cameraX, frameCount) {
      const wx = this.wallX - cameraX;
      if (wx > ns.CONFIG.WIDTH + 40) return;

      // Armored Fortress Bunker Wall
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(wx, 185, 380, this.floorY - 185);
      ctx.fillStyle = '#334155';
      ctx.fillRect(wx + 12, 198, 350, this.floorY - 204);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(wx, 185, 360, 14);

      // Hazard Chevron Stripes
      for (let s = 0; s < 140; s += 24) {
        ctx.fillStyle = (s / 24) % 2 === 0 ? '#ffd600' : '#111827';
        ctx.fillRect(wx + 8 + s, 462, 18, 14);
      }

      // Blast Door Recess
      ctx.fillStyle = '#05070d';
      ctx.fillRect(wx + 6, 480, 130, 156);

      if (!this.dead && !this.dying) {
        const cx = this.core.x - cameraX;
        const cy = this.core.y;
        const pulse = Math.sin(frameCount * 0.16) * 5;
        ns.drawGlow(ctx, cx, cy, 85 + pulse, 'red', 0.85);

        ctx.fillStyle = this.core.flash > 0 ? '#ffffff' : '#d50000';
        ctx.beginPath();
        ctx.arc(cx, cy, this.core.r + pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ff9100';
        ctx.beginPath();
        ctx.arc(cx, cy, (this.core.r + pulse) * 0.62, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx - 8, cy - 8, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Twin Mortar Cannons
      for (let i = 0; i < this.cannons.length; i++) {
        const c = this.cannons[i];
        const cx = c.x - cameraX;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(cx - 28, c.y - 28, 56, 56);
        if (c.alive) {
          ctx.fillStyle = c.flash > 0 ? '#ffffff' : '#cbd5e1';
          ctx.fillRect(cx - 22, c.y - 22, 44, 44);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(cx - 48, c.y - 11, 34, 22);
        }
      }

      // Upper Plasma Laser Eye
      if (this.eye.alive) {
        const ex = this.eye.x - cameraX;
        ns.drawGlow(ctx, ex, this.eye.y, 52, 'cyan', 0.75);
        ctx.fillStyle = this.eye.flash > 0 ? '#ffffff' : '#00e5ff';
        ctx.beginPath();
        ctx.arc(ex, this.eye.y, this.eye.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(ex - 6, this.eye.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ==========================================================================
  // BOSS 2: OMEGA SPIDER MECH
  // ==========================================================================
  class SpiderMechBoss {
    constructor(hpMult = 1) {
      this.name = 'OMEGA SPIDER MECH';
      this.cnName = 'OMEGA SPIDER MECH';
      this.x = 7080;
      this.y = 435;
      this.floorY = 636;
      this.vx = -2.4;

      this.hp = 175 * hpMult;
      this.maxHp = 175 * hpMult;
      this.flash = 0;
      this.missileCd = 85;
      this.gatlingCd = 52;

      this.active = false;
      this.dying = false;
      this.dead = false;
      this.deathTimer = 0;
    }

    getHealthRatio() { return Math.max(0, this.hp / this.maxHp); }
    getTargetPoints() { return [{ x: this.x, y: this.y }]; }
    getHazardBoxes() {
      if (!this.active || this.dying || this.dead) return [];
      return [{ x: this.x - 65, y: this.y - 55, w: 130, h: 110 }];
    }

    applyAoEDamage(ownerIdx, x, y, radius, dmg, particles, awardScore, triggerShake) {
      if (Math.hypot(this.x - x, this.y - y) <= radius + 72) {
        this._takeDamage(ownerIdx, dmg, particles, null, awardScore, triggerShake);
      }
    }

    _takeDamage(ownerIdx, dmg, particles, entities, awardScore, triggerShake) {
      this.hp -= dmg;
      this.flash = 4;
      if (this.hp <= 0 && !this.dying) {
        this.hp = 0;
        this.dying = true;
        this.deathTimer = 140;
        if (entities) { entities.enemyBullets = []; entities.enemies = []; }
        ns.audio.stopBGM();
        ns.audio.sfx('bossExplosion');
        awardScore(ownerIdx, 15000, this.x, this.y - 50);
        if (triggerShake) triggerShake(16, 30);
      }
    }

    update(entities, players, particles, frameCount, diff, awardScore, triggerShake) {
      if (this.dead || !this.active) return;
      if (this.dying) {
        stepBossDeath(this, this.x, this.y + 40, 220, 240, particles, triggerShake);
        return;
      }

      const spdMult = (diff && diff.bulletSpeedMult) || 1;
      if (this.flash > 0) this.flash--;

      const enraged = this.hp < this.maxHp * 0.45;
      this.x += this.vx * (enraged ? 1.45 : 1.0);
      this.y = 430 + Math.sin(frameCount * 0.08) * 18;
      if (this.x < 6820) this.vx = Math.abs(this.vx);
      if (this.x > 7220) this.vx = -Math.abs(this.vx);

      const target = entities._pickTarget(this.x, this.y, players);

      // Gatling Spread
      this.gatlingCd--;
      if (this.gatlingCd <= 0 && target) {
        this.gatlingCd = enraged ? 48 : 68;
        const ang = Math.atan2((target.y - 40) - (this.y + 20), target.x - (this.x - 50));
        [-0.18, 0, 0.18].forEach((off) => {
          const a = ang + off;
          entities.spawnEnemyBullet({
            x: this.x - 55, y: this.y + 20,
            vx: Math.cos(a) * 6.8 * spdMult,
            vy: Math.sin(a) * 6.8 * spdMult,
            radius: 8, color: '#ff1744'
          });
        });
      }

      // Destructible Plasma Seeker Orbs
      this.missileCd--;
      if (this.missileCd <= 0 && target) {
        this.missileCd = enraged ? 85 : 120;
        for (let m = -1; m <= 1; m += 2) {
          const ang = Math.atan2((target.y - 40) - (this.y - 45), target.x - this.x) + m * 0.25;
          entities.spawnEnemyBullet({
            x: this.x, y: this.y - 48,
            vx: Math.cos(ang) * 5.4 * spdMult,
            vy: Math.sin(ang) * 5.4 * spdMult,
            radius: 12, destructible: true
          });
        }
      }

      for (let j = entities.playerBullets.length - 1; j >= 0; j--) {
        const b = entities.playerBullets[j];
        if (Math.hypot(b.x - this.x, b.y - this.y) <= 72 + b.radius) {
          if (b.hitSet && b.hitSet.has(this)) continue;
          particles.spawnHitSparks(b.x, b.y, 7, '#00e5ff');
          ns.audio.sfx('hitArmor');
          if (b.pierce) b.hitSet.add(this); else entities.playerBullets.splice(j, 1);
          this._takeDamage(b.owner, b.damage, particles, entities, awardScore, triggerShake);
          if (this.dying) break;
        }
      }
    }

    draw(ctx, cameraX, frameCount) {
      if (this.dead) return;
      const sx = this.x - cameraX;
      const sy = this.y;

      // 4 Articulated Hydraulic Spider Legs!
      ctx.save();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < 2; k++) {
          const step = Math.sin(frameCount * 0.16 + k * Math.PI + (side > 0 ? 1 : 0)) * 26;
          const hipX = sx + side * (35 + k * 22);
          const hipY = sy + 25;
          const kneeX = hipX + side * (58 + k * 20);
          const kneeY = sy - 35 - k * 14;
          const footX = hipX + side * (78 + k * 34) + step;
          const footY = this.floorY;

          ctx.beginPath();
          ctx.moveTo(hipX, hipY);
          ctx.lineTo(kneeX, kneeY);
          ctx.lineTo(footX, footY);
          ctx.stroke();

          ctx.fillStyle = '#00e5ff';
          ctx.beginPath();
          ctx.arc(kneeX, kneeY, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Armored Spider Chassis & Glowing Red Core
      ns.drawGlow(ctx, sx, sy, 95, 'cyan', 0.6);
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#1e293b';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 76, 54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.flash > 0 ? '#ffd740' : '#ff1744';
      ctx.beginPath();
      ctx.arc(sx - 18, sy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx - 24, sy - 6, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ==========================================================================
  // BOSS 3: VALKYRIE ASSAULT GUNSHIP
  // ==========================================================================
  class ValkyrieGunshipBoss {
    constructor(hpMult = 1) {
      this.name = 'VALKYRIE ASSAULT GUNSHIP';
      this.cnName = 'VALKYRIE ASSAULT GUNSHIP';
      this.x = 7100;
      this.y = 205;
      this.vx = -4.2;

      this.hp = 185 * hpMult;
      this.maxHp = 185 * hpMult;
      this.flash = 0;
      this.gunCd = 46;
      this.bombCd = 38;

      this.active = false;
      this.dying = false;
      this.dead = false;
      this.deathTimer = 0;
    }

    getHealthRatio() { return Math.max(0, this.hp / this.maxHp); }
    getTargetPoints() { return [{ x: this.x, y: this.y }]; }
    getHazardBoxes() {
      if (!this.active || this.dying || this.dead) return [];
      return [{ x: this.x - 105, y: this.y - 38, w: 210, h: 76 }];
    }

    applyAoEDamage(ownerIdx, x, y, radius, dmg, particles, awardScore, triggerShake) {
      if (Math.hypot(this.x - x, this.y - y) <= radius + 95) {
        this._takeDamage(ownerIdx, dmg, particles, null, awardScore, triggerShake);
      }
    }

    _takeDamage(ownerIdx, dmg, particles, entities, awardScore, triggerShake) {
      this.hp -= dmg;
      this.flash = 4;
      if (this.hp <= 0 && !this.dying) {
        this.hp = 0;
        this.dying = true;
        this.deathTimer = 145;
        if (entities) { entities.enemyBullets = []; entities.enemies = []; }
        ns.audio.stopBGM();
        ns.audio.sfx('bossExplosion');
        awardScore(ownerIdx, 18000, this.x, this.y);
        if (triggerShake) triggerShake(16, 32);
      }
    }

    update(entities, players, particles, frameCount, diff, awardScore, triggerShake) {
      if (this.dead || !this.active) return;
      if (this.dying) {
        this.y += 1.2;
        stepBossDeath(this, this.x, this.y, 260, 120, particles, triggerShake);
        return;
      }

      const spdMult = (diff && diff.bulletSpeedMult) || 1;
      if (this.flash > 0) this.flash--;

      const enraged = this.hp < this.maxHp * 0.45;
      this.x += this.vx * (enraged ? 1.35 : 1.0);
      this.y = 195 + Math.sin(frameCount * 0.06) * 34;
      if (this.x < 6420) this.vx = Math.abs(this.vx);
      if (this.x > 7280) this.vx = -Math.abs(this.vx);

      const target = entities._pickTarget(this.x, this.y, players);

      // Aimed Nose Vulcan Burst
      this.gunCd--;
      if (this.gunCd <= 0 && target) {
        this.gunCd = enraged ? 44 : 64;
        const ang = Math.atan2((target.y - 40) - (this.y + 28), target.x - this.x);
        [-0.14, 0.14].forEach((off) => {
          const a = ang + off;
          entities.spawnEnemyBullet({
            x: this.x, y: this.y + 32,
            vx: Math.cos(a) * 7.2 * spdMult,
            vy: Math.sin(a) * 7.2 * spdMult,
            radius: 8, color: '#00e5ff'
          });
        });
      }

      // Carpet Napalm Bombs
      this.bombCd--;
      if (this.bombCd <= 0) {
        this.bombCd = enraged ? 34 : 52;
        entities.spawnEnemyBullet({
          x: this.x, y: this.y + 36,
          vx: this.vx * 0.35,
          vy: 2.0,
          gravity: 0.32,
          radius: 11, color: '#ff9100'
        });
      }

      for (let j = entities.playerBullets.length - 1; j >= 0; j--) {
        const b = entities.playerBullets[j];
        if (Math.abs(b.x - this.x) <= 115 + b.radius && Math.abs(b.y - this.y) <= 46 + b.radius) {
          if (b.hitSet && b.hitSet.has(this)) continue;
          particles.spawnHitSparks(b.x, b.y, 7, '#ffd740');
          ns.audio.sfx('hitArmor');
          if (b.pierce) b.hitSet.add(this); else entities.playerBullets.splice(j, 1);
          this._takeDamage(b.owner, b.damage, particles, entities, awardScore, triggerShake);
          if (this.dying) break;
        }
      }
    }

    draw(ctx, cameraX, frameCount) {
      if (this.dead) return;
      const sx = this.x - cameraX;
      const sy = this.y;
      const facing = this.vx < 0 ? -1 : 1;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(facing, 1);

      // Twin Jet Thruster Plumes
      ns.drawGlow(ctx, -95, 8, 52, 'fire', 0.85);
      ctx.fillStyle = '#ff9100';
      ctx.beginPath();
      ctx.moveTo(-80, -8);
      ctx.lineTo(-135 - (frameCount % 3) * 12, 4);
      ctx.lineTo(-80, 18);
      ctx.closePath();
      ctx.fill();

      // Stealth Gunship Fuselage
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#1e293b';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(115, 12);
      ctx.lineTo(35, -28);
      ctx.lineTo(-95, -24);
      ctx.lineTo(-110, -48);
      ctx.lineTo(-85, 24);
      ctx.lineTo(55, 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Armored Cockpit Canopy
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.moveTo(85, 6);
      ctx.lineTo(35, -18);
      ctx.lineTo(15, 2);
      ctx.closePath();
      ctx.fill();

      // Spinning Overhead Rotor Blur
      const rw = frameCount % 4 < 2 ? 155 : 65;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-rw, -38, rw * 2, 5);
      ctx.restore();
    }
  }

  // ==========================================================================
  // BOSS 4: MAGMA LEVIATHAN DRAGON
  // ==========================================================================
  class MagmaDragonBoss {
    constructor(hpMult = 1) {
      this.name = 'MAGMA LEVIATHAN DRAGON';
      this.cnName = 'MAGMA LEVIATHAN DRAGON';
      this.anchorX = 7420;
      this.anchorY = 560;
      this.head = { x: 7040, y: 340, r: 64 };
      this.segments = [];

      this.hp = 165 * hpMult;
      this.maxHp = 165 * hpMult;
      this.flash = 0;
      this.breathCd = 68;
      this.meteorCd = 95;

      this.active = false;
      this.dying = false;
      this.dead = false;
      this.deathTimer = 0;
    }

    getHealthRatio() { return Math.max(0, this.hp / this.maxHp); }
    getTargetPoints() {
      const pts = [{ x: this.head.x, y: this.head.y }];
      if (this.segments) {
        for (let i = 0; i < this.segments.length; i += 2) {
          pts.push({ x: this.segments[i].x, y: this.segments[i].y });
        }
      }
      return pts;
    }
    getHazardBoxes() {
      if (!this.active || this.dying || this.dead) return [];
      return [{ x: this.head.x - 42, y: this.head.y - 42, w: 84, h: 84 }];
    }

    applyAoEDamage(ownerIdx, x, y, radius, dmg, particles, awardScore, triggerShake) {
      if (Math.hypot(this.head.x - x, this.head.y - y) <= radius + this.head.r) {
        this._takeDamage(ownerIdx, dmg, particles, null, awardScore, triggerShake);
      }
    }

    _takeDamage(ownerIdx, dmg, particles, entities, awardScore, triggerShake) {
      this.hp -= dmg;
      this.flash = 4;
      if (this.hp <= 0 && !this.dying) {
        this.hp = 0;
        this.dying = true;
        this.deathTimer = 150;
        if (entities) { entities.enemyBullets = []; entities.enemies = []; }
        ns.audio.stopBGM();
        ns.audio.sfx('bossExplosion');
        awardScore(ownerIdx, 22000, this.head.x, this.head.y);
        if (triggerShake) triggerShake(18, 34);
      }
    }

    update(entities, players, particles, frameCount, diff, awardScore, triggerShake) {
      if (this.dead || !this.active) return;
      if (this.dying) {
        stepBossDeath(this, this.head.x + 120, 400, 320, 300, particles, triggerShake);
        return;
      }

      const spdMult = (diff && diff.bulletSpeedMult) || 1;
      if (this.flash > 0) this.flash--;
      const enraged = this.hp < this.maxHp * 0.45;

      // Articulate serpentine cyber-dragon neck & head!
      this.head.x = 7060 + Math.sin(frameCount * 0.045) * 145;
      this.head.y = 330 + Math.cos(frameCount * 0.065) * 125;

      this.segments = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const sx = this.anchorX + (this.head.x - this.anchorX) * t;
        const sy = this.anchorY + (this.head.y - this.anchorY) * t + Math.sin(frameCount * 0.09 + i * 0.7) * 28 * (1 - Math.abs(t - 0.5));
        this.segments.push({ x: sx, y: sy, r: 28 + t * 18 });
      }

      const target = entities._pickTarget(this.head.x, this.head.y, players);

      // 5-Way Molten Fire Breath
      this.breathCd--;
      if (this.breathCd <= 0 && target) {
        this.breathCd = enraged ? 58 : 82;
        const base = Math.atan2((target.y - 40) - this.head.y, target.x - this.head.x);
        [-0.32, -0.16, 0, 0.16, 0.32].forEach((off) => {
          const a = base + off;
          entities.spawnEnemyBullet({
            x: this.head.x - 36, y: this.head.y + 10,
            vx: Math.cos(a) * 6.5 * spdMult,
            vy: Math.sin(a) * 6.5 * spdMult,
            radius: 9, color: '#ff6d00'
          });
        });
      }

      // Volcanic Falling Magma Meteors!
      this.meteorCd--;
      if (this.meteorCd <= 0) {
        this.meteorCd = enraged ? 64 : 96;
        const mx = 6400 + Math.random() * 820;
        entities.spawnEnemyBullet({
          x: mx, y: -20,
          vx: -1.2, vy: 5.8 * spdMult,
          gravity: 0.08,
          radius: 13, color: '#ff3d00'
        });
      }

      for (let j = entities.playerBullets.length - 1; j >= 0; j--) {
        const b = entities.playerBullets[j];
        let hit = Math.hypot(b.x - this.head.x, b.y - this.head.y) <= this.head.r + b.radius;
        if (!hit && this.segments) {
          for (let sIdx = 0; sIdx < this.segments.length; sIdx++) {
            const sg = this.segments[sIdx];
            if (Math.hypot(b.x - sg.x, b.y - sg.y) <= sg.r + b.radius) {
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          if (b.hitSet && b.hitSet.has(this)) continue;
          particles.spawnHitSparks(b.x, b.y, 8, '#ff9100');
          ns.audio.sfx('hitArmor');
          if (b.pierce) b.hitSet.add(this); else entities.playerBullets.splice(j, 1);
          this._takeDamage(b.owner, b.damage, particles, entities, awardScore, triggerShake);
          if (this.dying) break;
        }
      }
    }

    draw(ctx, cameraX) {
      if (this.dead) return;

      // Draw Segmented Armored Spine
      for (let i = 0; i < this.segments.length; i++) {
        const seg = this.segments[i];
        const sx = seg.x - cameraX;
        ns.drawGlow(ctx, sx, seg.y, seg.r * 1.6, 'fire', 0.45);
        ctx.fillStyle = '#270907';
        ctx.strokeStyle = '#ff6d00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, seg.y, seg.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Dragon Skull & Molten Jaws
      const hx = this.head.x - cameraX;
      const hy = this.head.y;
      ns.drawGlow(ctx, hx, hy, 105, 'fire', 0.85);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#3e100c';
      ctx.strokeStyle = '#ffab00';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-68, 12);
      ctx.lineTo(-10, -46);
      ctx.lineTo(58, -62);
      ctx.lineTo(42, 34);
      ctx.lineTo(-52, 38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing Dragon Eye & Molten Maw
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(-18, -14, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffab00';
      ctx.fillRect(-58, 14, 48, 14);
      ctx.restore();
    }
  }

  // ==========================================================================
  // FINAL BOSS (STAGE 5): 2-PHASE EMPEROR DEMON GAVA & RED FALCON HEART
  // ==========================================================================
  class EmperorGavaBoss {
    constructor(hpMult = 1) {
      this.name = 'EMPEROR GAVA · RED FALCON';
      this.cnName = 'EMPEROR GAVA · RED FALCON SUPREME';
      this.wallX = 7440;
      this.floorY = 636;
      this.hpMult = hpMult;

      this.maxHp = 155 * hpMult;
      this.hp = this.maxHp;
      this.phase2 = false;
      this.flash = 0;

      this.headPos = { x: 7430, y: 340, r: 66 };
      this.heartPos = { x: 7435, y: 536, r: 70 };

      this.tentacles = [
        { ax: 7440, ay: 225, hp: 22 * hpMult, alive: true, flash: 0, off: 0, cd: 72, segs: [] },
        { ax: 7440, ay: 385, hp: 22 * hpMult, alive: true, flash: 0, off: 2.1, cd: 98, segs: [] },
        { ax: 7440, ay: 535, hp: 22 * hpMult, alive: true, flash: 0, off: 4.2, cd: 84, segs: [] }
      ];

      this.orbCd = 82;
      this.spawnCd = 190;

      this.active = false;
      this.dying = false;
      this.dead = false;
      this.deathTimer = 0;
    }

    getHealthRatio() { return Math.max(0, this.hp / this.maxHp); }

    getTargetPoints() {
      const main = this.phase2 ? this.heartPos : this.headPos;
      const pts = [{ x: main.x, y: main.y }];
      this.tentacles.forEach((t) => {
        if (t.alive && t.segs.length) pts.push(t.segs[t.segs.length - 1]);
      });
      return pts;
    }

    getHazardBoxes() {
      if (!this.active || this.dying || this.dead) return [];
      const boxes = [];
      for (let i = 0; i < this.tentacles.length; i++) {
        const t = this.tentacles[i];
        if (!t.alive) continue;
        for (let s = 2; s < t.segs.length; s++) {
          boxes.push({ x: t.segs[s].x - 16, y: t.segs[s].y - 16, w: 32, h: 32 });
        }
      }
      return boxes;
    }

    applyAoEDamage(ownerIdx, x, y, radius, dmg, particles, awardScore, triggerShake) {
      const main = this.phase2 ? this.heartPos : this.headPos;
      if (Math.hypot(main.x - x, main.y - y) <= radius + main.r) {
        this._takeDamage(ownerIdx, dmg, particles, null, awardScore, triggerShake);
      }
    }

    _takeDamage(ownerIdx, dmg, particles, entities, awardScore, triggerShake) {
      this.hp -= dmg;
      this.flash = 4;

      if (!this.phase2 && this.hp <= this.maxHp * 0.52) {
        this.phase2 = true;
        particles.spawnExplosion(this.heartPos.x, this.heartPos.y, 110, true);
        particles.spawnText(this.heartPos.x - 120, 320, 'PHASE 2: ALIEN HEART AWAKENED!', '#ff1744', 22);
        ns.audio.sfx('bossExplosion');
        if (triggerShake) triggerShake(16, 24);
      }

      if (this.hp <= 0 && !this.dying) {
        this.hp = 0;
        this.dying = true;
        this.deathTimer = 175;
        this.tentacles.forEach((t) => { t.alive = false; });
        if (entities) { entities.enemyBullets = []; entities.enemies = []; }
        ns.audio.stopBGM();
        ns.audio.sfx('bossExplosion');
        awardScore(ownerIdx, 30000, this.heartPos.x, this.heartPos.y - 40);
        if (triggerShake) triggerShake(20, 40);
      }
    }

    update(entities, players, particles, frameCount, diff, awardScore, triggerShake) {
      if (this.dead || !this.active) return;
      if (this.dying) {
        stepBossDeath(this, this.wallX - 20, 380, 260, 420, particles, triggerShake);
        return;
      }

      const spdMult = (diff && diff.bulletSpeedMult) || 1;
      if (this.flash > 0) this.flash--;

      if (frameCount % (this.phase2 ? 26 : 44) === 0) {
        ns.audio.playTone(this.phase2 ? 96 : 74, 0.14, 'triangle', 0.24, 36);
      }

      // Update 3 Whipping Biomechanical Tentacles
      for (let i = 0; i < this.tentacles.length; i++) {
        const t = this.tentacles[i];
        if (!t.alive) continue;
        if (t.flash > 0) t.flash--;

        t.segs = [];
        let cx = t.ax;
        let cy = t.ay;
        const base = Math.PI + Math.sin(frameCount * (this.phase2 ? 0.06 : 0.042) + t.off) * 0.48;
        for (let s = 0; s < 6; s++) {
          const a = base + Math.sin(frameCount * 0.075 + s * 0.55 + t.off) * 0.34;
          cx += Math.cos(a) * 36;
          cy += Math.sin(a) * 36;
          t.segs.push({ x: cx, y: cy });
        }

        const tip = t.segs[t.segs.length - 1];
        t.cd--;
        if (t.cd <= 0) {
          t.cd = this.phase2 ? 78 : 106;
          const target = entities._pickTarget(tip.x, tip.y, players);
          if (target) {
            const ang = Math.atan2((target.y - 40) - tip.y, target.x - tip.x);
            entities.spawnEnemyBullet({
              x: tip.x, y: tip.y,
              vx: Math.cos(ang) * 5.6 * spdMult,
              vy: Math.sin(ang) * 5.6 * spdMult,
              radius: 12, destructible: true
            });
          }
        }
      }

      // Main Core Bio-Plasma Barrage
      const origin = this.phase2 ? this.heartPos : this.headPos;
      this.orbCd--;
      if (this.orbCd <= 0) {
        this.orbCd = this.phase2 ? 76 : 105;
        const target = entities._pickTarget(origin.x, origin.y, players);
        const base = target ? Math.atan2((target.y - 40) - origin.y, target.x - origin.x) : Math.PI;
        const fan = this.phase2 ? [-0.36, -0.18, 0, 0.18, 0.36] : [-0.22, 0, 0.22];
        fan.forEach((off) => {
          const a = base + off;
          entities.spawnEnemyBullet({
            x: origin.x - 36, y: origin.y,
            vx: Math.cos(a) * 6.0 * spdMult,
            vy: Math.sin(a) * 6.0 * spdMult,
            radius: 10, color: '#e040fb'
          });
        });
      }

      // Xenomorph Spawner
      this.spawnCd--;
      if (this.spawnCd <= 0) {
        this.spawnCd = this.phase2 ? 190 : 250;
        if (entities.enemies.length < 1) {
          entities.enemies.push({
            type: 'alien',
            x: this.wallX - 30, y: this.floorY,
            vx: -5.2, vy: -8, facing: -1, onGround: false,
            hp: 2.5, score: 300, leapTimer: 44, flashTimer: 0, w: 48, h: 36
          });
        }
      }

      // Player Bullet Collisions
      for (let j = entities.playerBullets.length - 1; j >= 0; j--) {
        const b = entities.playerBullets[j];

        let hitTent = false;
        for (let i = 0; i < this.tentacles.length; i++) {
          const t = this.tentacles[i];
          if (!t.alive || !t.segs.length) continue;
          const tip = t.segs[t.segs.length - 1];
          if (Math.hypot(b.x - tip.x, b.y - tip.y) <= 32 + b.radius) {
            if (b.hitSet && b.hitSet.has(t)) continue;
            t.hp -= b.damage;
            t.flash = 3;
            particles.spawnHitSparks(b.x, b.y, 6, '#69f0ae');
            if (b.pierce) b.hitSet.add(t); else entities.playerBullets.splice(j, 1);
            if (t.hp <= 0) {
              t.alive = false;
              t.segs.forEach((sg) => particles.spawnExplosion(sg.x, sg.y, 40, true));
              particles.spawnText(tip.x - 20, tip.y - 30, 'TENTACLE SEVERED!', '#69f0ae', 16);
              ns.audio.sfx('explosion');
              awardScore(b.owner, 3500, tip.x, tip.y);
              this._takeDamage(b.owner, 15 * (this.hpMult || 1), particles, entities, awardScore, triggerShake);
            } else ns.audio.sfx('hitArmor');
            hitTent = true;
            break;
          }
        }
        if (this.dying) break;
        if (hitTent) continue;

        if (Math.hypot(b.x - origin.x, b.y - origin.y) <= origin.r + b.radius) {
          if (b.hitSet && b.hitSet.has(this)) continue;
          particles.spawnHitSparks(b.x, b.y, 8, '#ff4081');
          ns.audio.sfx('hitArmor');
          if (b.pierce) b.hitSet.add(this); else entities.playerBullets.splice(j, 1);
          this._takeDamage(b.owner, b.damage, particles, entities, awardScore, triggerShake);
          if (this.dying) break;
        }
      }
    }

    draw(ctx, cameraX, frameCount) {
      const wx = this.wallX - cameraX;
      if (wx > ns.CONFIG.WIDTH + 80) return;

      // Grotesque Biomechanical Emperor Sanctum Wall
      ctx.fillStyle = '#1a0529';
      ctx.fillRect(wx - 20, 80, 420, this.floorY - 80);
      for (let ry = 100; ry < this.floorY - 20; ry += 42) {
        ctx.fillStyle = '#4a148c';
        ctx.fillRect(wx - 36, ry, 160, 24);
      }

      if (this.dead) return;

      // Draw 3 Articulated Bio-Tentacles
      for (let i = 0; i < this.tentacles.length; i++) {
        const t = this.tentacles[i];
        if (!t.alive) continue;
        for (let s = 0; s < t.segs.length; s++) {
          const sg = t.segs[s];
          const sx = sg.x - cameraX;
          const isTip = s === t.segs.length - 1;
          const r = isTip ? 26 : 18;
          if (isTip) ns.drawGlow(ctx, sx, sg.y, 46, 'purple', 0.7);
          ctx.fillStyle = t.flash > 0 ? '#ffffff' : (isTip ? '#ff4081' : '#7b1fa2');
          ctx.beginPath();
          ctx.arc(sx, sg.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = isTip ? '#69f0ae' : '#e040fb';
          ctx.beginPath();
          ctx.arc(sx, sg.y, r * 0.42, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Emperor Demon Gava Skull (Upper)
      const gx = this.headPos.x - cameraX;
      const gy = this.headPos.y;
      ns.drawGlow(ctx, gx, gy, 100, this.phase2 ? 'purple' : 'cyan', 0.8);
      ctx.fillStyle = (!this.phase2 && this.flash > 0) ? '#ffffff' : '#311b92';
      ctx.strokeStyle = '#ea80fc';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(gx, gy, this.headPos.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Glowing Third Eye
      ctx.fillStyle = this.phase2 ? '#475569' : '#00e5ff';
      ctx.beginPath();
      ctx.arc(gx - 22, gy - 8, 18, 0, Math.PI * 2);
      ctx.fill();

      // Phase 2: Exposed Hyper-Pulsing Red Falcon Alien Heart!
      const hx = this.heartPos.x - cameraX;
      const hy = this.heartPos.y;
      if (this.phase2) {
        const beat = Math.abs(Math.sin(frameCount * 0.16)) * 14;
        const r = this.heartPos.r + beat;
        ns.drawGlow(ctx, hx, hy, r * 2.0, 'red', 0.95);

        ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#c51162';
        ctx.beginPath();
        ctx.arc(hx, hy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ff80ab';
        ctx.beginPath();
        ctx.arc(hx - 12, hy - 10, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Sealed Armored Ribcage before Phase 2
        ctx.fillStyle = '#380e5e';
        ctx.fillRect(hx - 54, hy - 54, 108, 108);
      }
    }
  }

  ns.createBoss = function (type, hpMult) {
    switch (type) {
      case 'spiderMech':  return new SpiderMechBoss(hpMult);
      case 'gunship':     return new ValkyrieGunshipBoss(hpMult);
      case 'magmaDragon': return new MagmaDragonBoss(hpMult);
      case 'emperorGava': return new EmperorGavaBoss(hpMult);
      default:            return new TitanWallBoss(hpMult);
    }
  };
})(window.Contra);
