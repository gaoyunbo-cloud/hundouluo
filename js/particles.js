// ============================================================================
// CONTRA: SHATTERED OPS HD - Volumetric FX, Shell Casings, Glows & Weather
// ============================================================================
window.Contra = window.Contra || {};

(function (ns) {
  'use strict';

  const { WIDTH, HEIGHT } = ns.CONFIG;

  // Pre-baked offscreen radial glow stamps for 60FPS additive bloom!
  const GLOW_COLORS = {
    red:    ['rgba(255, 90, 50, 0.95)',  'rgba(255, 30, 0, 0.35)',   'rgba(255, 0, 0, 0)'],
    gold:   ['rgba(255, 250, 190, 0.95)','rgba(255, 180, 20, 0.38)', 'rgba(255, 120, 0, 0)'],
    cyan:   ['rgba(210, 255, 255, 0.95)','rgba(0, 225, 255, 0.40)',  'rgba(0, 120, 255, 0)'],
    purple: ['rgba(245, 200, 255, 0.95)','rgba(185, 60, 255, 0.40)', 'rgba(100, 0, 200, 0)'],
    fire:   ['rgba(255, 240, 160, 0.95)','rgba(255, 110, 10, 0.42)', 'rgba(200, 20, 0, 0)'],
    green:  ['rgba(200, 255, 200, 0.90)','rgba(40, 230, 90, 0.35)',  'rgba(0, 120, 40, 0)']
  };

  const glowCache = Object.create(null);

  function getGlowCanvas(key) {
    if (glowCache[key]) return glowCache[key];
    if (typeof document === 'undefined' || !document.createElement) return null;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const gctx = c.getContext('2d');
    if (!gctx || !gctx.createRadialGradient) return null;
    const stops = GLOW_COLORS[key] || GLOW_COLORS.gold;
    const grad = gctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.4, stops[1]);
    grad.addColorStop(1, stops[2]);
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 64, 64);
    glowCache[key] = c;
    return c;
  }

  ns.drawGlow = function (ctx, x, y, radius, key = 'gold', alpha = 1) {
    const stamp = getGlowCanvas(key);
    if (!stamp) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(stamp, x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  };

  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.shells = [];
      this.explosions = [];
      this.shockwaves = [];
      this.ghosts = [];
      this.texts = [];
      this.weather = [];
    }

    clear() {
      this.particles = [];
      this.shells = [];
      this.explosions = [];
      this.shockwaves = [];
      this.ghosts = [];
      this.texts = [];
      this.weather = [];
    }

    initWeather(theme) {
      this.weather = [];
      const count = theme === 'arctic' ? 75 : 42;
      for (let i = 0; i < count; i++) {
        this.weather.push(this._makeWeatherDrop(theme, true));
      }
    }

    _makeWeatherDrop(theme, randomY) {
      if (theme === 'arctic') {
        return {
          x: Math.random() * (WIDTH + 200),
          y: randomY ? Math.random() * HEIGHT : -10,
          vx: -4.5 - Math.random() * 3.5,
          vy: 3.8 + Math.random() * 3.0,
          r: 1.5 + Math.random() * 2.5,
          alpha: 0.45 + Math.random() * 0.45,
          color: '#e8f4ff'
        };
      }
      if (theme === 'volcano') {
        return {
          x: Math.random() * WIDTH,
          y: randomY ? Math.random() * HEIGHT : HEIGHT + 10,
          vx: (Math.random() - 0.5) * 1.4,
          vy: -1.2 - Math.random() * 2.2,
          r: 1.5 + Math.random() * 2.5,
          alpha: 0.6 + Math.random() * 0.4,
          color: Math.random() < 0.5 ? '#ff9100' : '#ff3d00'
        };
      }
      if (theme === 'hive') {
        return {
          x: Math.random() * WIDTH,
          y: randomY ? Math.random() * HEIGHT : HEIGHT + 10,
          vx: (Math.random() - 0.5) * 0.9,
          vy: -0.5 - Math.random() * 1.0,
          r: 2 + Math.random() * 2.5,
          alpha: 0.35 + Math.random() * 0.4,
          color: Math.random() < 0.5 ? '#e040fb' : '#69f0ae'
        };
      }
      if (theme === 'cyber') {
        return {
          x: Math.random() * WIDTH,
          y: randomY ? Math.random() * HEIGHT : -10,
          vx: -0.5,
          vy: 1.8 + Math.random() * 2.5,
          r: 1.5 + Math.random() * 1.5,
          alpha: 0.3 + Math.random() * 0.35,
          color: '#40c4ff'
        };
      }
      // Jungle sun-spores / fireflies
      return {
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        vx: (Math.random() - 0.3) * 0.7,
        vy: (Math.random() - 0.5) * 0.6,
        r: 1.5 + Math.random() * 2.0,
        alpha: 0.35 + Math.random() * 0.45,
        color: '#dce775'
      };
    }

    spawnMuzzle(x, y, ax, ay, glowKey = 'gold') {
      this.particles.push({
        x, y,
        vx: ax * 2.2,
        vy: ay * 2.2,
        r: 11,
        life: 5,
        maxLife: 5,
        gravity: 0,
        color: '#ffffff',
        glow: glowKey,
        muzzle: true,
        angle: Math.atan2(ay, ax)
      });
      for (let i = 0; i < 4; i++) {
        const sp = 2.5 + Math.random() * 4.5;
        const a = Math.atan2(ay, ax) + (Math.random() - 0.5) * 0.55;
        this.particles.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          r: 2.2,
          life: 8 + Math.floor(Math.random() * 5),
          maxLife: 13,
          gravity: 0.1,
          color: '#ffd54f'
        });
      }
    }

    spawnShell(x, y, facing) {
      if (this.shells.length > 45) this.shells.shift();
      this.shells.push({
        x, y,
        vx: -facing * (2.2 + Math.random() * 2.0),
        vy: -3.5 - Math.random() * 2.2,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.5,
        bounces: 0,
        life: 85
      });
    }

    spawnGhost(x, y, facing, isP1, pose) {
      this.ghosts.push({
        x, y, facing, isP1, pose,
        life: 10,
        maxLife: 10
      });
    }

    spawnHitSparks(x, y, count = 8, color = '#ffd740') {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.0 + Math.random() * 5.8;
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 1.0,
          r: i % 2 === 0 ? 3.0 : 2.0,
          life: 10 + Math.floor(Math.random() * 9),
          maxLife: 19,
          gravity: 0.22,
          color: i % 3 === 0 ? '#ffffff' : color
        });
      }
    }

    spawnBloodOrBio(x, y, color = '#ff1744') {
      for (let i = 0; i < 8; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 4.5;
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 1.5,
          r: 2.5 + Math.random() * 2.5,
          life: 14 + Math.floor(Math.random() * 10),
          maxLife: 24,
          gravity: 0.3,
          color
        });
      }
    }

    spawnWaterSplash(x, y, isLava = false) {
      for (let i = 0; i < 14; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 26,
          y,
          vx: (Math.random() - 0.5) * 5.5,
          vy: -4.2 - Math.random() * 5.2,
          r: 3 + Math.random() * 3,
          life: 18 + Math.floor(Math.random() * 12),
          maxLife: 30,
          gravity: 0.38,
          color: isLava ? (i % 2 === 0 ? '#ffab00' : '#ff3d00') : (i % 2 === 0 ? '#ffffff' : '#4fc3f7')
        });
      }
    }

    spawnExplosion(x, y, radius = 48, heavy = false) {
      // Shockwave ring
      this.shockwaves.push({
        x, y,
        r: radius * 0.25,
        maxR: radius * (heavy ? 2.1 : 1.5),
        life: heavy ? 20 : 14,
        maxLife: heavy ? 20 : 14,
        color: heavy ? '#ffab40' : '#ffd740'
      });

      // Multi-puff volumetric fireballs & dark smoke
      const puffs = heavy ? 7 : 4;
      for (let i = 0; i < puffs; i++) {
        const ox = (Math.random() - 0.5) * radius * 0.7;
        const oy = (Math.random() - 0.5) * radius * 0.7;
        this.explosions.push({
          x: x + ox,
          y: y + oy,
          vx: ox * 0.05,
          vy: -0.6 - Math.random() * 1.2,
          radius: radius * (0.55 + Math.random() * 0.55),
          life: 22 + Math.floor(Math.random() * 12),
          maxLife: 34
        });
      }

      // Flying glowing embers & metallic debris
      const sparks = heavy ? 22 : 11;
      for (let i = 0; i < sparks; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.5 + Math.random() * (heavy ? 9.5 : 6.0);
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - (heavy ? 3.5 : 1.5),
          r: heavy && i < 6 ? 4.5 : 2.5,
          life: 18 + Math.floor(Math.random() * 20),
          maxLife: 38,
          gravity: 0.28,
          color: i % 3 === 0 ? '#ffffff' : (i % 3 === 1 ? '#ff9100' : '#ff3d00')
        });
      }
    }

    spawnText(x, y, text, color = '#ffffff', size = 16) {
      this.texts.push({
        x, y, text, color, size,
        life: 48,
        maxLife: 48
      });
    }

    update(level, theme) {
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.life--;
        sw.r += (sw.maxR - sw.r) * 0.22;
        if (sw.life <= 0) this.shockwaves.splice(i, 1);
      }

      for (let i = this.explosions.length - 1; i >= 0; i--) {
        const ex = this.explosions[i];
        ex.x += ex.vx;
        ex.y += ex.vy;
        ex.life--;
        if (ex.life <= 0) this.explosions.splice(i, 1);
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.life--;
        if (p.life <= 0) this.particles.splice(i, 1);
      }

      // Brass shell casings bounce on platforms!
      for (let i = this.shells.length - 1; i >= 0; i--) {
        const s = this.shells[i];
        const prevY = s.y;
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.42;
        s.rot += s.vrot;
        s.life--;
        if (level && s.bounces < 2) {
          const land = level.resolveLanding(s.x, prevY, s.y);
          if (land) {
            s.y = land.y;
            s.vy = -Math.abs(s.vy) * 0.45;
            s.vx *= 0.65;
            s.bounces++;
          }
        }
        if (s.life <= 0) this.shells.splice(i, 1);
      }

      for (let i = this.ghosts.length - 1; i >= 0; i--) {
        this.ghosts[i].life--;
        if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
      }

      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.y -= 1.05;
        t.life--;
        if (t.life <= 0) this.texts.splice(i, 1);
      }

      // Weather screen-space ambient particles
      for (let i = 0; i < this.weather.length; i++) {
        const w = this.weather[i];
        w.x += w.vx;
        w.y += w.vy;
        if (w.x < -20 || w.x > WIDTH + 220 || w.y < -20 || w.y > HEIGHT + 20) {
          this.weather[i] = this._makeWeatherDrop(theme || 'jungle', false);
        }
      }
    }

    draw(ctx, cameraX) {
      // 1) Dash Afterimage Ghosts
      for (let i = 0; i < this.ghosts.length; i++) {
        const g = this.ghosts[i];
        const alpha = (g.life / g.maxLife) * 0.45;
        const sx = g.x - cameraX;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = g.isP1 ? '#00e5ff' : '#ff3d00';
        ctx.beginPath();
        if (g.pose === 'roll') {
          ctx.arc(sx, g.y - 24, 22, 0, Math.PI * 2);
        } else {
          ctx.roundRect ? ctx.roundRect(sx - 16, g.y - 76, 32, 72, 10) : ctx.fillRect(sx - 16, g.y - 76, 32, 72);
        }
        ctx.fill();
        ctx.restore();
      }

      // 2) Brass Shell Casings
      ctx.fillStyle = '#ffd54f';
      for (let i = 0; i < this.shells.length; i++) {
        const s = this.shells[i];
        ctx.save();
        ctx.translate(s.x - cameraX, s.y - 2);
        ctx.rotate(s.rot);
        ctx.fillRect(-3.5, -1.5, 7, 3);
        ctx.restore();
      }

      // 3) Volumetric Fireball Explosions + Additive Glow
      for (let i = 0; i < this.explosions.length; i++) {
        const ex = this.explosions[i];
        const t = 1 - ex.life / ex.maxLife;
        const sx = ex.x - cameraX;
        const sy = ex.y;
        const r = ex.radius * (0.45 + Math.sin(t * Math.PI * 0.9) * 0.75);

        if (t < 0.55) {
          ns.drawGlow(ctx, sx, sy, r * 1.6, 'fire', (1 - t) * 0.85);
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t * 0.95);
        if (t < 0.22) {
          ctx.fillStyle = '#fffde7';
        } else if (t < 0.52) {
          ctx.fillStyle = '#ff9100';
        } else if (t < 0.76) {
          ctx.fillStyle = '#d50000';
        } else {
          ctx.fillStyle = '#263238';
        }
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, r), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4) Expanding Shockwave Rings
      for (let i = 0; i < this.shockwaves.length; i++) {
        const sw = this.shockwaves[i];
        const alpha = sw.life / sw.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3.5 * alpha;
        ctx.beginPath();
        ctx.arc(sw.x - cameraX, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 5) Muzzle Cones & Sparks
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const sx = p.x - cameraX;
        if (p.muzzle) {
          ns.drawGlow(ctx, sx, p.y, 34, p.glow || 'gold', 0.9);
          ctx.save();
          ctx.translate(sx, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(24, 0);
          ctx.lineTo(0, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.min(1, (p.life / p.maxLife) * 1.4);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 6) Floating Tactical Combat Text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < this.texts.length; i++) {
        const t = this.texts[i];
        const alpha = Math.min(1, (t.life / t.maxLife) * 1.6);
        const sx = t.x - cameraX;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `900 ${t.size || 16}px "Impact", "Arial Black", "PingFang SC", sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.fillText(t.text, sx + 2, t.y + 2);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, sx, t.y);
        ctx.restore();
      }
    }

    drawWeather(ctx) {
      for (let i = 0; i < this.weather.length; i++) {
        const w = this.weather[i];
        ctx.save();
        ctx.globalAlpha = w.alpha;
        ctx.fillStyle = w.color;
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  ns.ParticleSystem = ParticleSystem;
})(window.Contra);
