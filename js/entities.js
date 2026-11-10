// ============================================================================
// CONTRA: SHATTERED OPS HD - Weapons, Homing Missiles, Grenades & 9 Enemy AIs
// ============================================================================
window.Contra = window.Contra || {};

(function (ns) {
  'use strict';

  const { WIDTH, HEIGHT, GRAVITY } = ns.CONFIG;

  class EntityManager {
    constructor() {
      this.playerBullets = [];
      this.enemyBullets = [];
      this.grenades = [];
      this.napalmZones = [];
      this.enemies = [];
      this.containers = [];
      this.powerups = [];
    }

    clear() {
      this.playerBullets = [];
      this.enemyBullets = [];
      this.grenades = [];
      this.napalmZones = [];
      this.enemies = [];
      this.containers = [];
      this.powerups = [];
    }

    countPlayerBullets(ownerIndex) {
      let c = 0;
      for (let i = 0; i < this.playerBullets.length; i++) {
        if (this.playerBullets[i].owner === ownerIndex) c++;
      }
      return c;
    }

    spawnPlayerBullet(b) {
      b.hitSet = new Set();
      b.age = 0;
      this.playerBullets.push(b);
    }

    spawnEnemyBullet(b) {
      b.age = 0;
      this.enemyBullets.push(b);
    }

    spawnGrenade(ownerIndex, x, y, vx, vy) {
      this.grenades.push({
        owner: ownerIndex,
        x, y, vx, vy,
        rot: 0,
        life: 90
      });
    }

    activateStageSpawns(level, cameraX, diff) {
      const lookAhead = cameraX + WIDTH + 80;
      const hpMult = (diff && diff.enemyHpMult) || 1.0;

      for (let i = 0; i < level.spawns.length; i++) {
        const sp = level.spawns[i];
        if (sp.spawned) continue;
        if (cameraX >= sp.triggerX || (sp.kind !== 'pod' && sp.x <= lookAhead && sp.triggerX <= cameraX + 260)) {
          sp.spawned = true;
          this._instantiateSpawn(sp, cameraX, hpMult);
        }
      }
    }

    _instantiateSpawn(sp, cameraX, hpMult) {
      if (sp.kind === 'pod') {
        this.containers.push({
          kind: 'pod',
          x: cameraX - 30,
          baseY: sp.y,
          y: sp.y,
          vx: 5.0,
          phase: 0,
          hp: 1.5,
          flashTimer: 0,
          power: sp.power
        });
        ns.audio.sfx('powerupSpawn');
        return;
      }

      if (sp.kind === 'pillbox') {
        this.containers.push({
          kind: 'pillbox',
          x: sp.x,
          y: sp.y,
          hp: 4 * hpMult,
          timer: 20,
          openAmount: 1,
          flashTimer: 0,
          power: sp.power
        });
        return;
      }

      if (sp.kind === 'barrel') {
        this.enemies.push({
          type: 'barrel',
          x: sp.x,
          y: sp.y,
          vx: 0, vy: 0,
          hp: 2.5,
          score: 300,
          flashTimer: 0,
          w: 36, h: 48
        });
        return;
      }

      const spawnRightX = Math.max(sp.x, cameraX + WIDTH + 28);

      if (sp.kind === 'runner') {
        this.enemies.push({
          type: 'runner',
          x: spawnRightX, y: sp.y,
          vx: -3.8, vy: 0, facing: -1, onGround: true,
          hp: 1.5 * hpMult, score: 150,
          shootTimer: 52 + Math.floor(Math.random() * 35),
          flashTimer: 0, w: 36, h: 74
        });
      } else if (sp.kind === 'shield') {
        this.enemies.push({
          type: 'shield',
          x: sp.x, y: sp.y,
          vx: -1.6, vy: 0, facing: -1, onGround: true,
          hp: 6.5 * hpMult, score: 500,
          shootTimer: 72,
          flashTimer: 0, w: 44, h: 76
        });
      } else if (sp.kind === 'sniper') {
        this.enemies.push({
          type: 'sniper',
          x: sp.x, y: sp.y,
          vx: 0, vy: 0, facing: -1, aimX: -1, aimY: 0, onGround: true,
          hp: 2.2 * hpMult, score: 300,
          shootTimer: 78,
          flashTimer: 0, w: 36, h: 74
        });
      } else if (sp.kind === 'grenadier') {
        this.enemies.push({
          type: 'grenadier',
          x: sp.x, y: sp.y,
          vx: 0, vy: 0, facing: -1, onGround: true,
          hp: 2.8 * hpMult, score: 350,
          shootTimer: 84,
          flashTimer: 0, w: 36, h: 74
        });
      } else if (sp.kind === 'jetpack') {
        this.enemies.push({
          type: 'jetpack',
          x: sp.x, baseY: sp.y, y: sp.y,
          vx: -2.2, vy: 0, facing: -1, onGround: false,
          phase: Math.random() * 6,
          hp: 3.5 * hpMult, score: 450,
          shootTimer: 68,
          flashTimer: 0, w: 40, h: 76
        });
      } else if (sp.kind === 'drone') {
        this.enemies.push({
          type: 'drone',
          x: sp.x, baseY: sp.y, y: sp.y,
          vx: -2.8, vy: 0, phase: Math.random() * 6,
          hp: 3.0 * hpMult, score: 350,
          shootTimer: 62,
          flashTimer: 0, w: 42, h: 42
        });
      } else if (sp.kind === 'turret') {
        this.enemies.push({
          type: 'turret',
          x: sp.x, y: sp.y,
          vx: 0, vy: 0, angle: Math.PI, open: false,
          hp: 8.5 * hpMult, score: 650,
          shootTimer: 76,
          flashTimer: 0, w: 62, h: 62
        });
      } else if (sp.kind === 'cannon') {
        this.enemies.push({
          type: 'cannon',
          x: sp.x, y: sp.y,
          vx: 0, vy: 0, angle: Math.PI, riseProgress: 0,
          hp: 10.0 * hpMult, score: 750,
          shootTimer: 74,
          flashTimer: 0, w: 72, h: 56
        });
      } else if (sp.kind === 'alien') {
        this.enemies.push({
          type: 'alien',
          x: spawnRightX, y: sp.y,
          vx: -5.6, vy: 0, facing: -1, onGround: true,
          hp: 3.0 * hpMult, score: 320,
          leapTimer: 32 + Math.floor(Math.random() * 24),
          flashTimer: 0, w: 48, h: 36
        });
      }
    }

    spawnPowerup(x, y, powerType) {
      this.powerups.push({
        x, y,
        vx: 1.0,
        vy: -8.5,
        onGround: false,
        powerType
      });
    }

    _pickTarget(x, y, players) {
      let best = null;
      let bestDist = Infinity;
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p.active || p.state === 'dead' || p.state === 'submerged') continue;
        const d = Math.hypot(p.x - x, (p.y - 42) - y);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      return best;
    }

    // Find nearest enemy or Boss weakpoint for Homing Missiles (C)!
    _findHomingTarget(bx, by, cameraX, boss) {
      let best = null;
      let bestDist = 720;

      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.x < cameraX - 20 || e.x > cameraX + WIDTH + 40) continue;
        const ey = e.type === 'turret' || e.type === 'drone' ? e.y : e.y - e.h * 0.5;
        const d = Math.hypot(e.x - bx, ey - by);
        if (d < bestDist) {
          bestDist = d;
          best = { x: e.x, y: ey };
        }
      }

      if (boss && boss.active && !boss.dying && !boss.dead && boss.getTargetPoints) {
        const pts = boss.getTargetPoints();
        for (let i = 0; i < pts.length; i++) {
          const d = Math.hypot(pts[i].x - bx, pts[i].y - by);
          if (d < bestDist) {
            bestDist = d;
            best = pts[i];
          }
        }
      }
      return best;
    }

    // Trigger massive AoE blast (from Frag Grenade or Explosive Fuel Barrel!)
    detonateAoE(ownerIdx, x, y, radius, damage, particles, awardScore, triggerShake, boss) {
      particles.spawnExplosion(x, y, radius * 0.65, true);
      ns.audio.sfx('grenadeBoom');
      if (triggerShake) triggerShake(11, 16);

      // Wipe enemy bullets inside blast radius
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        if (Math.hypot(this.enemyBullets[i].x - x, this.enemyBullets[i].y - y) <= radius) {
          this.enemyBullets.splice(i, 1);
        }
      }

      // Damage all enemies inside blast radius (ignores Riot Shields!)
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        if (i >= this.enemies.length) i = this.enemies.length - 1;
        if (i < 0) break;
        const e = this.enemies[i];
        if (!e) continue;
        const ey = (e.type === 'turret' || e.type === 'drone') ? e.y : e.y - e.h * 0.5;
        if (Math.hypot(e.x - x, ey - y) <= radius + e.w * 0.4) {
          e.hp -= damage;
          e.flashTimer = 5;
          if (e.hp <= 0) {
            const isBarrel = e.type === 'barrel';
            const ex = e.x;
            const eCenterY = ey;
            const sc = e.score;
            this.enemies.splice(i, 1);
            particles.spawnExplosion(ex, eCenterY, 52, true);
            awardScore(ownerIdx, sc, ex, eCenterY - 20);
            if (isBarrel) {
              this.detonateAoE(ownerIdx, ex, eCenterY, 190, 16, particles, awardScore, triggerShake, boss);
            }
          }
        }
      }

      // Damage Boss if inside blast radius!
      if (boss && boss.active && !boss.dying && !boss.dead && boss.applyAoEDamage) {
        boss.applyAoEDamage(ownerIdx, x, y, radius, damage * 0.75, particles, awardScore, triggerShake);
      }
    }

    // ========================================================================
    // Main Update Loop
    // ========================================================================
    update(level, players, particles, cameraX, frameCount, diff, boss, awardScore, triggerFalconBomb, triggerShake) {
      const bulletSpdMult = (diff && diff.bulletSpeedMult) || 1.0;
      const fireRateMult = (diff && diff.fireRateMult) || 1.0;

      // 1) Update Player Bullets (including Homing Missiles & Spiral Napalm!)
      for (let i = this.playerBullets.length - 1; i >= 0; i--) {
        const b = this.playerBullets[i];
        b.age++;

        if (b.homing) {
          const tgt = this._findHomingTarget(b.x, b.y, cameraX, boss);
          if (tgt) {
            const desired = Math.atan2(tgt.y - b.y, tgt.x - b.x);
            let cur = Math.atan2(b.vy, b.vx);
            let delta = desired - cur;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            cur += Math.max(-0.14, Math.min(0.14, delta));
            const spd = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(cur) * spd;
            b.vy = Math.sin(cur) * spd;
          }
          if (b.age % 2 === 0) {
            particles.particles.push({
              x: b.x, y: b.y, vx: 0, vy: 0, r: 3.5, life: 8, maxLife: 8, gravity: 0, color: '#d1c4e9'
            });
          }
        }

        b.baseX += b.vx;
        b.baseY += b.vy;

        if (b.spiral) {
          const ang = b.age * 0.36;
          b.x = b.baseX + Math.cos(ang) * 18;
          b.y = b.baseY + Math.sin(ang) * 18;
        } else {
          b.x = b.baseX;
          b.y = b.baseY;
        }

        if (b.weapon === 'S') {
          b.radius = Math.min(14, 7 + b.age * 0.22);
        }

        if (b.x < cameraX - 80 || b.x > cameraX + WIDTH + 80 || b.y < -80 || b.y > HEIGHT + 80) {
          this.playerBullets.splice(i, 1);
        }
      }

      // 2) Update Player Thrown Frag Grenades
      for (let i = this.grenades.length - 1; i >= 0; i--) {
        const g = this.grenades[i];
        const prevY = g.y;
        g.x += g.vx;
        g.y += g.vy;
        g.vy += 0.48;
        g.rot += 0.28;
        g.life--;

        let hitSomething = g.life <= 0;
        const land = level.resolveLanding(g.x, prevY, g.y);
        if (land) {
          g.y = land.y;
          hitSomething = true;
        } else {
          for (let k = 0; k < this.enemies.length; k++) {
            const e = this.enemies[k];
            const ey = (e.type === 'turret' || e.type === 'drone') ? e.y : e.y - e.h * 0.5;
            if (Math.hypot(g.x - e.x, g.y - ey) < e.w * 0.6 + 14) {
              hitSomething = true;
              break;
            }
          }
          if (!hitSomething && boss && boss.active && !boss.dying && boss.getTargetPoints) {
            const pts = boss.getTargetPoints();
            for (let k = 0; k < pts.length; k++) {
              if (Math.hypot(g.x - pts[k].x, g.y - pts[k].y) < 48) {
                hitSomething = true;
                break;
              }
            }
          }
        }

        if (hitSomething) {
          this.detonateAoE(g.owner, g.x, g.y, 165, 14, particles, awardScore, triggerShake, boss);
          this.grenades.splice(i, 1);
        }
      }

      // 3) Update Lingering Napalm Burn Zones
      for (let i = this.napalmZones.length - 1; i >= 0; i--) {
        const nz = this.napalmZones[i];
        nz.life--;
        if (nz.life % 6 === 0) {
          for (let k = this.enemies.length - 1; k >= 0; k--) {
            const e = this.enemies[k];
            const ey = (e.type === 'turret' || e.type === 'drone') ? e.y : e.y - e.h * 0.5;
            if (Math.hypot(e.x - nz.x, ey - nz.y) < nz.r) {
              e.hp -= 0.9;
              e.flashTimer = 2;
            }
          }
        }
        if (nz.life <= 0) this.napalmZones.splice(i, 1);
      }

      // 4) Update Enemy Bullets
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const eb = this.enemyBullets[i];
        eb.age++;
        eb.x += eb.vx;
        eb.y += eb.vy;
        if (eb.gravity) {
          eb.vy += eb.gravity;
          const land = level.resolveLanding(eb.x, eb.y - eb.vy, eb.y);
          if (land) {
            particles.spawnExplosion(eb.x, land.y, 38, false);
            ns.audio.sfx('enemyDie');
            this.enemyBullets.splice(i, 1);
            continue;
          }
        }
        if (eb.x < cameraX - 90 || eb.x > cameraX + WIDTH + 90 || eb.y < -90 || eb.y > HEIGHT + 70) {
          this.enemyBullets.splice(i, 1);
        }
      }

      // 5) Update Weapon Containers (Pods & Pillboxes)
      for (let i = this.containers.length - 1; i >= 0; i--) {
        const c = this.containers[i];
        if (c.flashTimer > 0) c.flashTimer--;

        if (c.kind === 'pod') {
          c.x += c.vx;
          c.phase += 0.085;
          c.y = c.baseY + Math.sin(c.phase) * 52;
          if (c.x > cameraX + WIDTH + 90) {
            this.containers.splice(i, 1);
            continue;
          }
        } else {
          c.timer = (c.timer + 1) % 160;
          c.openAmount = c.timer < 108 ? 1 : 0;
          if (c.x < cameraX - 120) {
            this.containers.splice(i, 1);
            continue;
          }
        }

        const halfW = c.kind === 'pod' ? 28 : 30;
        const halfH = c.kind === 'pod' ? 20 : 30;
        let destroyed = false;

        for (let j = this.playerBullets.length - 1; j >= 0; j--) {
          const b = this.playerBullets[j];
          if (Math.abs(b.x - c.x) <= halfW + b.radius && Math.abs(b.y - c.y) <= halfH + b.radius) {
            if (c.kind === 'pillbox' && c.openAmount <= 0.1) {
              particles.spawnHitSparks(b.x, b.y, 5, '#94a3b8');
              ns.audio.sfx('hitArmor');
              this.playerBullets.splice(j, 1);
              continue;
            }
            c.hp -= b.damage;
            c.flashTimer = 4;
            particles.spawnHitSparks(b.x, b.y, 6, '#ffd740');
            if (!b.pierce) this.playerBullets.splice(j, 1);
            if (c.hp <= 0) {
              destroyed = true;
              awardScore(b.owner, 500, c.x, c.y - 20);
              break;
            }
          }
        }

        if (destroyed) {
          particles.spawnExplosion(c.x, c.y, 44, true);
          ns.audio.sfx('enemyDie');
          this.spawnPowerup(c.x, c.y - 10, c.power);
          this.containers.splice(i, 1);
        }
      }

      // 6) Update Winged Powerup Items
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const item = this.powerups[i];
        if (!item.onGround) {
          const prevY = item.y + 16;
          item.x += item.vx;
          item.y += item.vy;
          item.vy = Math.min(12, item.vy + GRAVITY * 0.85);
          const land = level.resolveLanding(item.x, prevY, item.y + 16);
          if (land) {
            item.y = land.y - 16;
            item.vy = 0;
            item.vx = 0;
            item.onGround = true;
          }
        }

        if (item.x < cameraX - 100 || item.y > HEIGHT + 60) {
          this.powerups.splice(i, 1);
          continue;
        }

        for (let p = 0; p < players.length; p++) {
          const pl = players[p];
          if (!pl.active || pl.state === 'dead') continue;
          if (Math.abs(pl.x - item.x) < 42 && Math.abs((pl.y - 40) - item.y) < 48) {
            pl.collectPowerup(item.powerType, particles, (pts) => awardScore(pl.index, pts, item.x, item.y - 24), triggerFalconBomb);
            this.powerups.splice(i, 1);
            break;
          }
        }
      }

      // 7) Update Enemies & Player Bullet Hits
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        if (i >= this.enemies.length) i = this.enemies.length - 1;
        if (i < 0) break;
        const e = this.enemies[i];
        if (!e) continue;
        if (e.flashTimer > 0) e.flashTimer--;

        this._updateEnemyAI(e, level, players, cameraX, bulletSpdMult, fireRateMult);

        if (e.x < cameraX - 140 || e.y > HEIGHT + 90) {
          this.enemies.splice(i, 1);
          continue;
        }

        const centerY = (e.type === 'turret' || e.type === 'drone') ? e.y : (e.y - e.h * 0.5);
        const halfW = e.w * 0.5;
        const halfH = e.h * 0.5;
        let killed = false;
        let killerIdx = 0;

        // Barrier body-slam instant kill!
        if (e.type !== 'barrel') {
          for (let p = 0; p < players.length; p++) {
            const pl = players[p];
            if (pl.active && pl.state !== 'dead' && pl.barrierTimer > 0) {
              if (Math.abs(pl.x - e.x) < halfW + 28 && Math.abs((pl.y - 40) - centerY) < halfH + 38) {
                killed = true;
                killerIdx = pl.index;
                break;
              }
            }
          }
        }

        if (!killed) {
          for (let j = this.playerBullets.length - 1; j >= 0; j--) {
            const b = this.playerBullets[j];
            if (b.hitSet && b.hitSet.has(e)) continue;

            if (Math.abs(b.x - e.x) <= halfW + b.radius && Math.abs(b.y - centerY) <= halfH + b.radius) {
              // Armored closed state check
              if ((e.type === 'turret' && !e.open) || (e.type === 'cannon' && e.riseProgress < 0.45)) {
                particles.spawnHitSparks(b.x, b.y, 5, '#94a3b8');
                ns.audio.sfx('hitArmor');
                this.playerBullets.splice(j, 1);
                continue;
              }

              // Riot-Shield Frontal Block Check!
              if (e.type === 'shield' && !b.pierce && !b.explosive) {
                const hittingFront = (e.facing < 0 && b.vx > 0 && b.x < e.x + 8) || (e.facing > 0 && b.vx < 0 && b.x > e.x - 8);
                if (hittingFront) {
                  particles.spawnHitSparks(b.x, b.y, 8, '#38bdf8');
                  ns.audio.sfx('shieldBlock');
                  this.playerBullets.splice(j, 1);
                  continue;
                }
              }

              e.hp -= b.damage;
              e.flashTimer = 3;
              particles.spawnHitSparks(b.x, b.y, 6, '#ffd740');

              if (b.explosive) {
                this.napalmZones.push({ x: b.x, y: b.y, r: 68, life: 36 });
                particles.spawnExplosion(b.x, b.y, 38, false);
              }

              if (b.pierce) b.hitSet.add(e);
              else this.playerBullets.splice(j, 1);

              if (e.hp <= 0) {
                killed = true;
                killerIdx = b.owner;
                break;
              } else {
                ns.audio.sfx('hitArmor');
              }
            }
          }
        }

        if (killed) {
          const isBarrel = e.type === 'barrel';
          const ex = e.x;
          const ey = centerY;
          const sc = e.score;
          const big = isBarrel || e.type === 'turret' || e.type === 'cannon' || e.type === 'shield';
          this.enemies.splice(i, 1);

          if (isBarrel) {
            this.detonateAoE(killerIdx, ex, ey, 195, 18, particles, awardScore, triggerShake, boss);
          } else {
            particles.spawnExplosion(ex, ey, big ? 58 : 40, big);
            if (e.type === 'alien') particles.spawnBloodOrBio(ex, ey, '#69f0ae');
            ns.audio.sfx(big ? 'explosion' : 'enemyDie');
            awardScore(killerIdx, sc, ex, ey - 24);
          }
        }
      }

      // 8) Destructible Enemy Orbs / Missiles
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const eb = this.enemyBullets[i];
        if (!eb.destructible) continue;
        for (let j = this.playerBullets.length - 1; j >= 0; j--) {
          const b = this.playerBullets[j];
          if (Math.hypot(b.x - eb.x, b.y - eb.y) <= eb.radius + b.radius + 6) {
            particles.spawnExplosion(eb.x, eb.y, 28, false);
            ns.audio.sfx('enemyDie');
            awardScore(b.owner, 100, eb.x, eb.y);
            if (!b.pierce) this.playerBullets.splice(j, 1);
            this.enemyBullets.splice(i, 1);
            break;
          }
        }
      }
    }

    _updateEnemyAI(e, level, players, cameraX, spdMult, rateMult) {
      if (e.type === 'barrel') return;
      const target = this._pickTarget(e.x, e.y - 36, players);

      if (e.type === 'runner' || e.type === 'shield' || e.type === 'alien') {
        const prevY = e.y;
        e.x += e.vx;
        e.y += e.vy;
        e.vy = Math.min(14, e.vy + GRAVITY);

        const land = level.resolveLanding(e.x, prevY, e.y);
        if (land) {
          e.y = land.y;
          e.vy = 0;
          e.onGround = true;

          if ((e.vx < 0 && e.x <= land.x + 18) || (e.vx > 0 && e.x >= land.x + land.w - 18)) {
            if (e.type === 'shield') {
              e.vx = -e.vx;
              e.facing = e.vx < 0 ? -1 : 1;
            } else if (Math.random() < 0.65) {
              e.vy = -10.8;
              e.onGround = false;
            } else {
              e.vx = -e.vx;
              e.facing = e.vx < 0 ? -1 : 1;
            }
          }
        } else {
          e.onGround = false;
        }

        if (e.type === 'shield' && target) {
          // Shield trooper slowly faces player unless player just dashed right behind them (turn delay!)
          if (Math.random() < 0.03) {
            e.facing = target.x < e.x ? -1 : 1;
            e.vx = e.facing * 1.4;
          }
        }

        if ((e.type === 'runner' || e.type === 'shield') && e.onGround && e.x < cameraX + WIDTH - 20) {
          e.shootTimer -= rateMult;
          if (e.shootTimer <= 0 && target) {
            e.shootTimer = e.type === 'shield' ? 92 : 78;
            const dir = e.type === 'shield' ? e.facing : (target.x < e.x ? -1 : 1);
            e.facing = dir;
            this.spawnEnemyBullet({
              x: e.x + dir * 24,
              y: e.y - 50,
              vx: dir * 6.2 * spdMult,
              vy: 0,
              radius: 7,
              color: '#ff1744'
            });
          }
        }

        if (e.type === 'alien' && e.onGround) {
          e.leapTimer--;
          if (e.leapTimer <= 0 && target && Math.abs(target.x - e.x) < 340) {
            e.leapTimer = 48;
            e.vy = -11.5;
            e.vx = (target.x < e.x ? -1 : 1) * 6.8;
          }
        }
        return;
      }

      if (e.type === 'jetpack' || e.type === 'drone') {
        if (e.x > cameraX + WIDTH + 120) return;
        e.phase += 0.06;
        e.y = e.baseY + Math.sin(e.phase) * 44;
        if (target) {
          const desiredX = target.x + 190;
          e.vx = Math.max(-3.2, Math.min(3.2, (desiredX - e.x) * 0.025));
          e.facing = target.x < e.x ? -1 : 1;
        }
        e.x += e.vx;

        e.shootTimer -= rateMult;
        if (e.shootTimer <= 0 && target) {
          e.shootTimer = e.type === 'jetpack' ? 84 : 74;
          const ang = Math.atan2((target.y - 40) - e.y, target.x - e.x);
          const count = e.type === 'jetpack' ? [-0.18, 0.18] : [0];
          for (let k = 0; k < count.length; k++) {
            const a = ang + count[k];
            this.spawnEnemyBullet({
              x: e.x,
              y: e.y - (e.type === 'jetpack' ? 32 : 0),
              vx: Math.cos(a) * 6.0 * spdMult,
              vy: Math.sin(a) * 6.0 * spdMult,
              radius: 7,
              color: '#00e5ff'
            });
          }
        }
        return;
      }

      if (e.type === 'sniper') {
        if (!target) return;
        const dx = target.x - e.x;
        const dy = (target.y - 42) - (e.y - 52);
        e.facing = dx < 0 ? -1 : 1;
        const dist = Math.hypot(dx, dy) || 1;
        e.aimX = dx / dist;
        e.aimY = dy / dist;

        if (e.x > cameraX + 20 && e.x < cameraX + WIDTH - 20) {
          e.shootTimer -= rateMult;
          if (e.shootTimer <= 0) {
            e.shootTimer = 98;
            this.spawnEnemyBullet({
              x: e.x + e.aimX * 28,
              y: e.y - 52 + e.aimY * 28,
              vx: e.aimX * 8.6 * spdMult,
              vy: e.aimY * 8.6 * spdMult,
              radius: 7,
              color: '#ff1744'
            });
          }
        }
        return;
      }

      if (e.type === 'grenadier') {
        if (!target) return;
        e.facing = target.x < e.x ? -1 : 1;
        if (e.x > cameraX + 20 && e.x < cameraX + WIDTH - 20) {
          e.shootTimer -= rateMult;
          if (e.shootTimer <= 0) {
            e.shootTimer = 105;
            const dx = Math.max(-520, Math.min(520, target.x - e.x));
            this.spawnEnemyBullet({
              x: e.x + e.facing * 18,
              y: e.y - 56,
              vx: (dx / 55) * spdMult,
              vy: -9.5,
              gravity: 0.36,
              radius: 10,
              color: '#ff9100'
            });
          }
        }
        return;
      }

      if (e.type === 'turret') {
        const inView = e.x > cameraX + 30 && e.x < cameraX + WIDTH - 30;
        e.open = inView && !!target && Math.abs(target.x - e.x) < 780;
        if (!e.open || !target) return;

        e.angle = Math.atan2((target.y - 42) - e.y, target.x - e.x);
        e.shootTimer -= rateMult;
        if (e.shootTimer <= 0) {
          e.shootTimer = 88;
          for (let s = -1; s <= 1; s += 2) {
            const a = e.angle + s * 0.14;
            this.spawnEnemyBullet({
              x: e.x + Math.cos(a) * 32,
              y: e.y + Math.sin(a) * 32,
              vx: Math.cos(a) * 5.8 * spdMult,
              vy: Math.sin(a) * 5.8 * spdMult,
              radius: 7.5,
              color: '#ff6d00'
            });
          }
        }
        return;
      }

      if (e.type === 'cannon') {
        const inView = e.x > cameraX + 30 && e.x < cameraX + WIDTH - 20;
        if (inView) e.riseProgress = Math.min(1, e.riseProgress + 0.032);
        if (e.riseProgress < 0.9 || !target) return;

        const dy = (target.y - 42) - (e.y - 42);
        e.angle = target.x < e.x ? (dy < -75 ? -Math.PI * 0.84 : Math.PI) : 0;

        e.shootTimer -= rateMult;
        if (e.shootTimer <= 0) {
          e.shootTimer = 86;
          const topY = e.y - 43;
          this.spawnEnemyBullet({
            x: e.x + Math.cos(e.angle) * 44,
            y: topY + Math.sin(e.angle) * 44,
            vx: Math.cos(e.angle) * 6.8 * spdMult,
            vy: Math.sin(e.angle) * 6.8 * spdMult,
            radius: 9,
            color: '#00e5ff'
          });
        }
      }
    }

    // ========================================================================
    // HD Entity Rendering
    // ========================================================================
    draw(ctx, cameraX, frameCount) {
      ctx.save();
      ctx.translate(-cameraX, 0);

      // 1) Containers
      for (let i = 0; i < this.containers.length; i++) {
        const c = this.containers[i];
        if (c.kind === 'pod') ns.Sprites.drawWeaponPod(ctx, c, frameCount);
        else ns.Sprites.drawPillbox(ctx, c, frameCount);
      }

      // 2) Lingering Napalm Fire Pools
      for (let i = 0; i < this.napalmZones.length; i++) {
        const nz = this.napalmZones[i];
        ns.drawGlow(ctx, nz.x, nz.y, nz.r, 'fire', 0.55);
      }

      // 3) Enemies & Explosive Barrels
      for (let i = 0; i < this.enemies.length; i++) {
        ns.Sprites.drawEnemy(ctx, this.enemies[i], frameCount);
      }

      // 4) Winged Powerups
      for (let i = 0; i < this.powerups.length; i++) {
        ns.Sprites.drawPowerupItem(ctx, this.powerups[i], frameCount);
      }

      // 5) Thrown Frag Grenades
      for (let i = 0; i < this.grenades.length; i++) {
        const g = this.grenades[i];
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.rot);
        ctx.fillStyle = '#33691e';
        ctx.strokeStyle = '#aed581';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ff1744';
        ctx.fillRect(-3, -14, 6, 4);
        ctx.restore();
      }

      ctx.restore();

      // 6) Player Projectiles (Screen Space with Additive Glow!)
      for (let i = 0; i < this.playerBullets.length; i++) {
        const b = this.playerBullets[i];
        const sx = b.x - cameraX;
        const sy = b.y;

        if (b.weapon === 'L') {
          const ang = Math.atan2(b.vy, b.vx);
          ns.drawGlow(ctx, sx, sy, b.lv2 ? 44 : 30, 'cyan', 0.75);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang);
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(-44, b.lv2 ? -7 : -4.5, 52, b.lv2 ? 14 : 9);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-40, b.lv2 ? -3.5 : -2, 46, b.lv2 ? 7 : 4);
          ctx.restore();
        } else if (b.weapon === 'C') {
          const ang = Math.atan2(b.vy, b.vx);
          ns.drawGlow(ctx, sx, sy, 24, 'purple', 0.75);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(-12, -4, 22, 8);
          ctx.fillStyle = '#d500f9';
          ctx.beginPath();
          ctx.moveTo(10, -5);
          ctx.lineTo(18, 0);
          ctx.lineTo(10, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (b.weapon === 'S') {
          ns.drawGlow(ctx, sx, sy, b.radius * 2.2, 'red', 0.7);
          ctx.fillStyle = '#ff3d00';
          ctx.beginPath();
          ctx.arc(sx, sy, b.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, sy, b.radius * 0.48, 0, Math.PI * 2);
          ctx.fill();
        } else if (b.weapon === 'F') {
          ns.drawGlow(ctx, sx, sy, 32, 'fire', 0.85);
          ctx.fillStyle = '#ff9100';
          ctx.beginPath();
          ctx.arc(sx, sy, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fffde7';
          ctx.beginPath();
          ctx.arc(sx, sy, 6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Carbine R & Vulcan M
          const ang = Math.atan2(b.vy, b.vx);
          ns.drawGlow(ctx, sx, sy, 20, b.weapon === 'M' ? 'red' : 'gold', 0.65);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang);
          ctx.fillStyle = b.weapon === 'M' ? '#ff5252' : '#ffe082';
          ctx.fillRect(-14, -4, 24, 8);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-8, -2, 16, 4);
          ctx.restore();
        }
      }

      // 7) Enemy Projectiles
      const blink = frameCount % 6 < 3;
      for (let i = 0; i < this.enemyBullets.length; i++) {
        const eb = this.enemyBullets[i];
        const sx = eb.x - cameraX;
        const sy = eb.y;
        const r = eb.radius || 7;

        ns.drawGlow(ctx, sx, sy, r * 2.6, eb.destructible ? 'purple' : 'red', 0.7);
        ctx.fillStyle = blink ? '#ffffff' : (eb.color || '#ff1744');
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = eb.destructible ? '#00e5ff' : '#ffd740';
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ns.EntityManager = EntityManager;
})(window.Contra);
