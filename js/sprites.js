// ============================================================================
// CONTRA: SHATTERED OPS HD - Realistic Articulated Humanoid & Mech Renderer
// ============================================================================
window.Contra = window.Contra || {};

(function (ns) {
  'use strict';

  // Helper: draw a rounded capsule limb between (x1, y1) and (x2, y2)
  function drawLimb(ctx, x1, y1, x2, y2, r1, r2, color, highlightColor) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(ang);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r1, Math.PI * 0.5, Math.PI * 1.5);
    ctx.lineTo(len, -r2);
    ctx.arc(len, 0, r2, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.fill();

    if (highlightColor) {
      ctx.fillStyle = highlightColor;
      ctx.beginPath();
      ctx.moveTo(2, -r1 * 0.65);
      ctx.lineTo(len - 2, -r2 * 0.65);
      ctx.lineTo(len - 2, -r2 * 0.15);
      ctx.lineTo(2, -r1 * 0.15);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Helper: draw tactical combat boot
  function drawBoot(ctx, ankleX, ankleY, facing, angle = 0, bootColor = '#1c2430') {
    ctx.save();
    ctx.translate(ankleX, ankleY);
    ctx.rotate(angle);
    ctx.scale(facing, 1);
    ctx.fillStyle = bootColor;
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.lineTo(7, -5);
    ctx.lineTo(14, 1);
    ctx.lineTo(14, 6);
    ctx.lineTo(-7, 6);
    ctx.closePath();
    ctx.fill();
    // Sole tread highlight
    ctx.fillStyle = '#455a64';
    ctx.fillRect(-7, 4, 21, 2.5);
    ctx.restore();
  }

  ns.Sprites = {
    // ========================================================================
    // HD Action-Hero Commando (Bill Rizer 1P & Lance Bean 2P)
    // ========================================================================
    drawCommando(ctx, player, frameCount) {
      const px = player.x;
      const py = player.y;
      const facing = player.facing;
      const isP1 = player.index === 0;

      if (player.state === 'dead') {
        this._drawDeadHero(ctx, player, px, py);
        return;
      }

      if (player.invulnTimer > 0 && player.barrierTimer <= 0 && player.dashTimer <= 0) {
        if (Math.floor(frameCount / 3) % 2 === 0) return;
      }

      const theme = isP1
        ? {
            pantsDark: '#0d47a1',
            pantsMid: '#1976d2',
            pantsHi: '#42a5f5',
            bandana: '#ff1744',
            hair: '#ffca28',
            vest: '#1e293b',
            aura: 'cyan'
          }
        : {
            pantsDark: '#8e0000',
            pantsMid: '#d32f2f',
            pantsHi: '#ff5252',
            bandana: '#00b0ff',
            hair: '#212121',
            vest: '#261c24',
            aura: 'red'
          };

      // Barrier Invincibility Plasma Shield!
      if (player.barrierTimer > 0) {
        ns.drawGlow(ctx, px, py - 42, 68, 'cyan', 0.55);
        ctx.save();
        ctx.strokeStyle = frameCount % 4 < 2 ? '#40f8ff' : '#ffd740';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py - 42, 48 + Math.sin(frameCount * 0.25) * 3, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = frameCount * 0.14 + (i * Math.PI) / 2;
          ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#40f8ff';
          ctx.beginPath();
          ctx.arc(px + Math.cos(a) * 48, py - 42 + Math.sin(a) * 48, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Ground contact shadow
      if (player.onGround && !player.inWater) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.beginPath();
        ctx.ellipse(px, py + 1, player.state === 'prone' ? 32 : 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 1) Submerged underwater
      if (player.inWater && player.state === 'submerged') {
        ctx.save();
        ctx.fillStyle = theme.bandana;
        ctx.fillRect(px - 10, py - 38, 20, 5);
        ctx.strokeStyle = '#80d8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - 22, py - 32);
        ctx.lineTo(px + 22, py - 32);
        ctx.stroke();
        ctx.restore();
        return;
      }

      // 2) Midair Acrobatic Somersault OR Tactical Jet-Dash!
      if ((!player.onGround && !player.inWater) || player.dashTimer > 0) {
        const cy = player.dashTimer > 0 ? py - 34 : py - 36;
        if (player.dashTimer > 0) {
          ns.drawGlow(ctx, px, cy, 46, theme.aura, 0.7);
        }
        ctx.save();
        ctx.translate(px, cy);
        const rot = player.dashTimer > 0
          ? facing * 0.35
          : (player.animTimer * 0.34 * facing);
        ctx.rotate(rot);

        // Motion spin energy ring
        ctx.strokeStyle = isP1 ? 'rgba(64,248,255,0.65)' : 'rgba(255,82,82,0.65)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 23, 0, Math.PI * 1.55);
        ctx.stroke();

        // Curled muscular body
        ctx.fillStyle = theme.pantsMid;
        ctx.beginPath();
        ctx.arc(-4, 6, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e09e6d';
        ctx.beginPath();
        ctx.arc(5, -5, 13, 0, Math.PI * 2);
        ctx.fill();

        // Head & bandana in spin
        ctx.fillStyle = theme.hair;
        ctx.beginPath();
        ctx.arc(8, -12, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme.bandana;
        ctx.fillRect(-2, -16, 20, 4.5);
        ctx.restore();

        // Heavy Weapon aimed in 8 directions from spin center!
        this._drawHeavyGun(ctx, px, cy, player.aimX, player.aimY, facing, player.getActiveWeapon(), frameCount, true);
        return;
      }

      // 3) Prone Tactical Sniper Stance on Ground
      if (player.state === 'prone') {
        // Legs stretched back
        drawLimb(ctx, px - facing * 8, py - 10, px - facing * 34, py - 7, 7.5, 6, theme.pantsDark, theme.pantsMid);
        drawBoot(ctx, px - facing * 36, py - 6, facing, -facing * 0.4);
        // Torso low to ground
        drawLimb(ctx, px - facing * 8, py - 11, px + facing * 14, py - 15, 9.5, 10.5, '#d9915b', '#f3b98b');
        // Tactical vest strap
        drawLimb(ctx, px - facing * 4, py - 12, px + facing * 10, py - 14, 9.8, 9.8, theme.vest, '#475569');
        // Head & flowing bandana
        this._drawHeroHead(ctx, px + facing * 18, py - 24, facing, theme, frameCount, false);
        // Heavy Weapon + supporting arms
        const gx = px + facing * 18;
        const gy = py - 14;
        drawLimb(ctx, px + facing * 10, py - 14, gx + facing * 14, gy + 2, 5.5, 4.5, '#d9915b', '#f3b98b');
        this._drawHeavyGun(ctx, gx, gy, facing, 0, facing, player.getActiveWeapon(), frameCount, true);
        return;
      }

      // 4) Standing / Athletic Sprint / Water Wading
      const stride = player.moving ? player.animTimer * 0.28 : 0;
      const bob = player.moving ? Math.abs(Math.sin(stride)) * 4.5 : Math.sin(frameCount * 0.07) * 1.2;
      const hipX = px;
      const hipY = py - 38 + bob;

      // Draw Legs unless chest-deep in water
      if (!player.inWater) {
        if (player.moving) {
          // Back leg & Front leg 2-segment inverse stride
          for (let leg = 0; leg < 2; leg++) {
            const phase = stride + (leg === 0 ? Math.PI : 0);
            const hipSwing = Math.sin(phase) * 0.62;
            const kneeBend = Math.max(0.08, Math.cos(phase - 0.55) * 0.85 + 0.45);

            const thighLen = 19;
            const shinLen = 19;
            const thighAng = Math.PI * 0.5 - facing * hipSwing;
            const kneeX = hipX + Math.cos(thighAng) * thighLen;
            const kneeY = hipY + Math.sin(thighAng) * thighLen;

            const shinAng = thighAng + facing * kneeBend;
            const ankleX = kneeX + Math.cos(shinAng) * shinLen;
            const ankleY = Math.min(py - 5, kneeY + Math.sin(shinAng) * shinLen);

            const pCol = leg === 0 ? theme.pantsDark : theme.pantsMid;
            const pHi = leg === 0 ? theme.pantsMid : theme.pantsHi;

            drawLimb(ctx, hipX, hipY, kneeX, kneeY, 7.5, 6.2, pCol, pHi);
            drawLimb(ctx, kneeX, kneeY, ankleX, ankleY, 6.0, 4.8, pCol, pHi);
            // Tactical Knee Pad
            ctx.fillStyle = '#263238';
            ctx.beginPath();
            ctx.arc(kneeX + facing * 2, kneeY, 4.5, 0, Math.PI * 2);
            ctx.fill();
            drawBoot(ctx, ankleX, ankleY, facing, (shinAng - Math.PI * 0.5) * 0.35);
          }
        } else {
          // Heroic wide combat stance!
          const bKneeX = hipX - facing * 8;
          const bKneeY = py - 20;
          const bAnkX = hipX - facing * 13;
          drawLimb(ctx, hipX - facing * 3, hipY, bKneeX, bKneeY, 7.5, 6.2, theme.pantsDark, theme.pantsMid);
          drawLimb(ctx, bKneeX, bKneeY, bAnkX, py - 6, 6.0, 4.8, theme.pantsDark, theme.pantsMid);
          drawBoot(ctx, bAnkX, py - 6, facing, 0);

          const fKneeX = hipX + facing * 9;
          const fKneeY = py - 20;
          const fAnkX = hipX + facing * 12;
          drawLimb(ctx, hipX + facing * 3, hipY, fKneeX, fKneeY, 7.8, 6.4, theme.pantsMid, theme.pantsHi);
          drawLimb(ctx, fKneeX, fKneeY, fAnkX, py - 6, 6.2, 5.0, theme.pantsMid, theme.pantsHi);
          ctx.fillStyle = '#263238';
          ctx.beginPath();
          ctx.arc(fKneeX + facing * 2, fKneeY, 4.5, 0, Math.PI * 2);
          ctx.fill();
          drawBoot(ctx, fAnkX, py - 6, facing, 0);
        }
      }

      // Muscular Sculpted Torso + Tactical Vest / Bandolier
      const lean = player.moving ? facing * 3.5 : 0;
      const shoulderX = hipX + lean;
      const shoulderY = hipY - 24;

      // Base muscular torso
      drawLimb(ctx, hipX, hipY - 2, shoulderX, shoulderY, 10.5, 13.5, '#d48a54', '#f4bd90');

      // Tactical combat harness & belt
      ctx.save();
      ctx.fillStyle = '#1b2430';
      ctx.fillRect(hipX - 11, hipY - 5, 22, 6);
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(hipX - 3, hipY - 4, 6, 4); // Gold belt buckle!

      // Cross-chest heavy ammo bandolier
      ctx.strokeStyle = '#2b3648';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(hipX - facing * 9, hipY - 4);
      ctx.lineTo(shoulderX + facing * 8, shoulderY - 2);
      ctx.stroke();

      // Brass shells on bandolier
      ctx.fillStyle = '#ffca28';
      for (let b = 0.2; b <= 0.85; b += 0.22) {
        const bx = hipX - facing * 9 + (shoulderX + facing * 8 - (hipX - facing * 9)) * b;
        const by = (hipY - 4) + ((shoulderY - 2) - (hipY - 4)) * b;
        ctx.fillRect(bx - 2, by - 1.5, 4, 2.5);
      }
      ctx.restore();

      // Hero Head & Flowing Wind-Physics Bandana
      this._drawHeroHead(ctx, shoulderX + facing * 2, shoulderY - 13, facing, theme, frameCount, player.moving);

      // Back Arm, Heavy Weapon & Muscular Front Bicep/Forearm!
      const gunPivotX = shoulderX + facing * 4;
      const gunPivotY = shoulderY + 5;
      const aimAng = Math.atan2(player.aimY, player.aimX);

      // Back support arm reaching to foregrip
      const foregripX = gunPivotX + Math.cos(aimAng) * 22;
      const foregripY = gunPivotY + Math.sin(aimAng) * 22;
      drawLimb(ctx, shoulderX + facing * 5, shoulderY + 2, foregripX, foregripY, 5.8, 4.5, '#b8703d', '#d9915b');

      // Heavy HD Weapon
      this._drawHeavyGun(ctx, gunPivotX, gunPivotY, player.aimX, player.aimY, facing, player.getActiveWeapon(), frameCount, true);

      // Front muscular deltoid + bicep + forearm holding pistol grip!
      const elbowX = shoulderX - facing * 4 + Math.cos(aimAng + facing * 0.65) * 11;
      const elbowY = shoulderY + 7 + Math.sin(aimAng + facing * 0.65) * 11;
      const trigX = gunPivotX + Math.cos(aimAng) * 7;
      const trigY = gunPivotY + Math.sin(aimAng) * 7;
      drawLimb(ctx, shoulderX - facing * 2, shoulderY + 2, elbowX, elbowY, 6.8, 5.6, '#d9915b', '#f6c399');
      drawLimb(ctx, elbowX, elbowY, trigX, trigY, 5.4, 4.4, '#d9915b', '#f6c399');
      // Wristband
      ctx.fillStyle = theme.bandana;
      ctx.beginPath();
      ctx.arc(trigX, trigY, 4.2, 0, Math.PI * 2);
      ctx.fill();

      // Water waist foam if wading
      if (player.inWater) {
        ctx.save();
        ctx.fillStyle = 'rgba(128, 216, 255, 0.85)';
        ctx.beginPath();
        ctx.ellipse(px, py - 34, 24, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },

    _drawHeroHead(ctx, hx, hy, facing, theme, frameCount, moving) {
      // Flowing physics bandana ribbons behind head!
      ctx.save();
      ctx.strokeStyle = theme.bandana;
      ctx.lineCap = 'round';
      for (let t = 0; t < 2; t++) {
        ctx.lineWidth = t === 0 ? 4.2 : 3.2;
        ctx.beginPath();
        const startX = hx - facing * 8;
        const startY = hy - 3 + t * 4;
        ctx.moveTo(startX, startY);
        const wave1 = Math.sin(frameCount * (moving ? 0.32 : 0.14) + t * 1.4) * (moving ? 7 : 3.5);
        const wave2 = Math.cos(frameCount * (moving ? 0.28 : 0.12) + t) * (moving ? 9 : 4.5);
        ctx.quadraticCurveTo(
          startX - facing * 14,
          startY + wave1,
          startX - facing * (moving ? 28 : 20),
          startY + 4 + wave2
        );
        ctx.stroke();
      }

      // Neck
      ctx.fillStyle = '#c47b47';
      ctx.fillRect(hx - 4, hy + 5, 8, 7);

      // Sculpted face/jaw
      ctx.fillStyle = '#f0b484';
      ctx.beginPath();
      ctx.arc(hx, hy, 9.5, 0, Math.PI * 2);
      ctx.fill();

      // Jaw shadow
      ctx.fillStyle = '#d48a54';
      ctx.beginPath();
      ctx.arc(hx - facing * 2, hy + 2, 7.5, 0.2, Math.PI - 0.2);
      ctx.fill();

      // Spiked Hero Hair
      ctx.fillStyle = theme.hair;
      ctx.beginPath();
      ctx.arc(hx - facing * 1, hy - 4, 9.5, Math.PI, Math.PI * 2);
      ctx.lineTo(hx - facing * 12, hy - 9);
      ctx.lineTo(hx - facing * 4, hy - 13);
      ctx.lineTo(hx + facing * 6, hy - 12);
      ctx.closePath();
      ctx.fill();

      // Headband wrap
      ctx.fillStyle = theme.bandana;
      ctx.fillRect(hx - 9.5, hy - 6, 19, 4.5);

      // Intense eye & brow
      ctx.fillStyle = '#111827';
      ctx.fillRect(hx + facing * 3 - 2, hy - 1.5, 4.5, 2.2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx + facing * 4 - 1, hy - 1, 2, 1.5);
      ctx.restore();
    },

    _drawHeavyGun(ctx, ox, oy, ax, ay, facing, slot, frameCount, showLaserSight) {
      const wepId = (slot && slot.id) || 'R';
      const lv2 = slot && slot.level >= 2;
      const ang = Math.atan2(ay, ax);

      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(ang);
      if (ax < -0.01 || (Math.abs(ax) <= 0.01 && facing < 0)) {
        ctx.scale(1, -1);
      }

      // Subtle tactical laser sight line!
      if (showLaserSight) {
        ctx.save();
        ctx.strokeStyle = wepId === 'L' ? 'rgba(64, 248, 255, 0.28)' : 'rgba(255, 50, 50, 0.22)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(38, 0);
        ctx.lineTo(155, 0);
        ctx.stroke();
        ctx.restore();
      }

      // Gun stock & receiver
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-6, -4, 24, 9);
      ctx.fillStyle = '#475569';
      ctx.fillRect(2, -6, 22, 5);

      if (wepId === 'M') {
        // Multi-barrel Rotary Vulcan Minigun!
        ctx.fillStyle = '#94a3b8';
        const spin = Math.floor(frameCount / 2) % 2;
        ctx.fillRect(18, -6 + spin, 26, 3);
        ctx.fillRect(18, -1, 26, 3);
        ctx.fillRect(18, 4 - spin, 26, 3);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(26, -7, 6, 15);
      } else if (wepId === 'S') {
        // Heavy Plasma Spread Shotgun
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(18, -6, 22, 12);
        ctx.fillStyle = '#ff3d00';
        ctx.fillRect(22, -3, 14, 6);
      } else if (wepId === 'L') {
        // Electromagnetic Railgun with glowing cyan coils!
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(16, -5, 30, 10);
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(20, -2, 24, 4);
      } else if (wepId === 'F') {
        // Napalm Flamethrower
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(12, 2, 16, 7);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(18, -4, 24, 6);
        ctx.fillStyle = '#ff6d00';
        ctx.beginPath();
        ctx.arc(44, -1, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (wepId === 'C') {
        // Homing Seeker Missile Pod
        ctx.fillStyle = '#334155';
        ctx.fillRect(12, -8, 26, 14);
        ctx.fillStyle = '#b388ff';
        ctx.fillRect(18, -5, 18, 3);
        ctx.fillRect(18, 1, 18, 3);
      } else {
        // Tactical Assault Carbine
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(18, -4, 22, 6);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(10, -8, 7, 3);
      }

      // Lv.2 MAX golden power core indicator on weapon!
      if (lv2) {
        ctx.fillStyle = '#ffd740';
        ctx.fillRect(6, -2, 8, 3);
      }

      ctx.restore();
    },

    _drawDeadHero(ctx, player, px, py) {
      const isP1 = player.index === 0;
      const pants = isP1 ? '#1976d2' : '#d32f2f';
      if (player.deathTimer > 32) {
        ctx.save();
        ctx.translate(px, py - 32);
        ctx.rotate((65 - player.deathTimer) * 0.25 * -player.facing);
        drawLimb(ctx, -20, 4, 16, -4, 9, 11, '#d9915b', '#f3b98b');
        drawLimb(ctx, -20, 4, -38, 14, 8, 6, pants, pants);
        ctx.restore();
      } else if (Math.floor(player.deathTimer / 3) % 2 === 1) {
        drawLimb(ctx, px - 28, py - 8, px + 4, py - 8, 7, 8, pants, pants);
        drawLimb(ctx, px + 4, py - 9, px + 26, py - 10, 9, 9, '#d9915b', '#f3b98b');
      }
    },

    // ========================================================================
    // 9 HD Enemy Archetypes & Destructible Props
    // ========================================================================
    drawEnemy(ctx, e, frameCount) {
      const flash = e.flashTimer > 0;
      const px = e.x;
      const py = e.y;

      if (e.type === 'runner' || e.type === 'sniper' || e.type === 'grenadier' || e.type === 'shield' || e.type === 'jetpack') {
        this._drawExoSoldier(ctx, e, frameCount, flash);
      } else if (e.type === 'turret') {
        this._drawRotaryTurret(ctx, e, frameCount, flash);
      } else if (e.type === 'cannon') {
        this._drawMechCannon(ctx, e, frameCount, flash);
      } else if (e.type === 'drone') {
        this._drawCyberDrone(ctx, e, frameCount, flash);
      } else if (e.type === 'alien') {
        this._drawXenomorph(ctx, e, frameCount, flash);
      } else if (e.type === 'barrel') {
        this._drawFuelBarrel(ctx, px, py, frameCount, flash);
      }
    },

    _drawExoSoldier(ctx, e, frameCount, flash) {
      const px = e.x;
      const py = e.y;
      const facing = e.facing || (e.vx < 0 ? -1 : 1);
      const moving = Math.abs(e.vx || 0) > 0.3 && e.onGround !== false;
      const stride = moving ? frameCount * 0.25 : 0;

      // Jetpack thruster flames!
      if (e.type === 'jetpack') {
        const bx = px - facing * 12;
        const by = py - 46;
        ctx.fillStyle = '#475569';
        ctx.fillRect(bx - 6, by - 14, 12, 24);
        const flameH = 16 + (frameCount % 3) * 7;
        ns.drawGlow(ctx, bx, by + 18, 28, 'fire', 0.75);
        ctx.fillStyle = '#ff9100';
        ctx.beginPath();
        ctx.moveTo(bx - 6, by + 10);
        ctx.lineTo(bx, by + 10 + flameH);
        ctx.lineTo(bx + 6, by + 10);
        ctx.closePath();
        ctx.fill();
      }

      // Sniper red laser sight telegraph!
      if (e.type === 'sniper' && e.shootTimer < 42) {
        ctx.save();
        ctx.strokeStyle = e.shootTimer < 14 ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 23, 68, 0.55)';
        ctx.lineWidth = e.shootTimer < 14 ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(px + (e.aimX || facing) * 24, py - 52 + (e.aimY || 0) * 24);
        ctx.lineTo(px + (e.aimX || facing) * 560, py - 52 + (e.aimY || 0) * 560);
        ctx.stroke();
        ctx.restore();
      }

      let armorDark = '#1e293b';
      let armorMid = '#334155';
      let visor = '#ff1744';
      if (e.type === 'sniper') { armorMid = '#991b1b'; armorDark = '#450a0a'; }
      else if (e.type === 'grenadier') { armorMid = '#b45309'; armorDark = '#451a03'; visor = '#ffd740'; }
      else if (e.type === 'shield') { armorMid = '#1e3a8a'; armorDark = '#172554'; visor = '#00e5ff'; }
      else if (e.type === 'jetpack') { armorMid = '#3730a3'; armorDark = '#1e1b4b'; visor = '#40f8ff'; }

      if (flash) { armorMid = '#ffffff'; armorDark = '#e2e8f0'; }

      const hipY = py - 36;
      // Articulated legs
      for (let l = 0; l < 2; l++) {
        const ph = stride + (l === 0 ? Math.PI : 0);
        const swing = moving ? Math.sin(ph) * 0.55 : (l === 0 ? -0.22 : 0.22);
        const kx = px + Math.sin(swing) * 14 * facing;
        const ky = hipY + 17;
        const ax = kx + (moving ? Math.cos(ph) * 6 : (l === 0 ? -4 : 5)) * facing;
        const ay = py - 5;
        drawLimb(ctx, px, hipY, kx, ky, 6.5, 5.5, armorDark, armorMid);
        drawLimb(ctx, kx, ky, ax, ay, 5.5, 4.5, armorDark, armorMid);
        drawBoot(ctx, ax, ay, facing, 0, '#0f172a');
      }

      // Armored Exo-Chest
      drawLimb(ctx, px, hipY, px + facing * 2, hipY - 24, 10, 13, armorDark, armorMid);

      // Exo-Helmet & Glowing Visor
      const hx = px + facing * 3;
      const hy = hipY - 36;
      ctx.fillStyle = armorMid;
      ctx.beginPath();
      ctx.arc(hx, hy, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = visor;
      ctx.fillRect(hx + (facing > 0 ? 1 : -8), hy - 3, 7, 4);

      // Rifle
      const ax = e.aimX !== undefined ? e.aimX : facing;
      const ay = e.aimY !== undefined ? e.aimY : 0;
      drawLimb(ctx, px + facing * 2, hipY - 18, px + ax * 28, hipY - 18 + ay * 28, 4, 3, '#64748b', '#cbd5e1');

      // Ballistic Riot Shield in front!
      if (e.type === 'shield') {
        const sx = px + facing * 19;
        ctx.save();
        ctx.fillStyle = flash ? '#ffffff' : '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.fillRect(sx - 6, py - 74, 12, 68);
        ctx.strokeRect(sx - 6, py - 74, 12, 68);
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(sx - 3, py - 62, 6, 14);
        ctx.restore();
      }
    },

    _drawRotaryTurret(ctx, t, frameCount, flash) {
      const cx = t.x;
      const cy = t.y;

      // Octagonal Armored Base
      ctx.save();
      ctx.fillStyle = flash ? '#ffffff' : '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (!t.open) {
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // Glowing Red Eye + Dual Recoiling Autocannons!
      ns.drawGlow(ctx, cx, cy, 34, 'red', 0.55);
      ctx.fillStyle = frameCount % 10 < 5 ? '#ff1744' : '#ff9100';
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(cx, cy);
      ctx.rotate(t.angle);
      ctx.fillStyle = flash ? '#ffffff' : '#cbd5e1';
      ctx.fillRect(8, -8, 28, 5);
      ctx.fillRect(8, 3, 28, 5);
      ctx.fillStyle = '#475569';
      ctx.fillRect(4, -10, 12, 20);
      ctx.restore();
    },

    _drawMechCannon(ctx, c, frameCount, flash) {
      const rise = c.riseProgress * 56;
      if (rise <= 4) return;
      const px = c.x;
      const py = c.y;

      ctx.save();
      ctx.beginPath();
      ctx.rect(px - 60, py - 85, 120, 85);
      ctx.clip();

      const topY = py - rise;
      // Hydraulic armored chassis
      ctx.fillStyle = flash ? '#ffffff' : '#334155';
      ctx.fillRect(px - 34, topY + 12, 68, 46);
      ctx.fillStyle = flash ? '#ffffff' : '#94a3b8';
      ctx.fillRect(px - 28, topY, 56, 26);

      // Glowing plasma vents
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(px - 18, topY + 20, 36, 5);

      // Heavy Plasma Barrel
      ctx.translate(px, topY + 13);
      ctx.rotate(c.angle);
      ctx.fillStyle = flash ? '#ffffff' : '#e2e8f0';
      ctx.fillRect(6, -7, 42, 14);
      ctx.fillStyle = '#ff3d00';
      ctx.fillRect(36, -5, 10, 10);
      ctx.restore();
    },

    _drawCyberDrone(ctx, d, frameCount, flash) {
      const cx = d.x;
      const cy = d.y;
      ns.drawGlow(ctx, cx, cy, 32, 'cyan', 0.5);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = flash ? '#ffffff' : '#1e293b';
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Rotor wings
      ctx.fillStyle = '#94a3b8';
      const w = (frameCount % 4 < 2) ? 28 : 14;
      ctx.fillRect(-w, -22, w * 2, 3);

      // Scanner eye
      ctx.fillStyle = '#ff1744';
      ctx.beginPath();
      ctx.arc(-5, 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    _drawXenomorph(ctx, a, frameCount, flash) {
      const px = a.x;
      const py = a.y;
      const facing = a.vx > 0 ? 1 : -1;
      const skitter = Math.sin(frameCount * 0.45) * 6;

      ctx.save();
      // Glossy alien carapace & elongated skull
      drawLimb(ctx, px - facing * 14, py - 18, px + facing * 18, py - 24, 9, 11, flash ? '#fff' : '#311b92', '#7c4dff');
      // Segmented scorpion tail
      ctx.strokeStyle = flash ? '#fff' : '#651fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px - facing * 14, py - 18);
      ctx.quadraticCurveTo(px - facing * 34, py - 42, px - facing * 18, py - 48 + skitter * 0.5);
      ctx.stroke();

      // 4 Scythe legs
      ctx.strokeStyle = flash ? '#fff' : '#b388ff';
      ctx.lineWidth = 3.5;
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(px + i * 8, py - 16);
        ctx.lineTo(px + i * 18 + skitter * i, py - 10);
        ctx.lineTo(px + i * 22 - skitter * i, py);
        ctx.stroke();
      }

      // Glowing bio-eyes
      ctx.fillStyle = '#69f0ae';
      ctx.beginPath();
      ctx.arc(px + facing * 18, py - 25, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    _drawFuelBarrel(ctx, px, py, frameCount, flash) {
      ctx.save();
      ctx.fillStyle = flash ? '#ffffff' : '#b71c1c';
      ctx.strokeStyle = '#ff8a80';
      ctx.lineWidth = 2;
      ctx.fillRect(px - 17, py - 46, 34, 46);
      ctx.strokeRect(px - 17, py - 46, 34, 46);

      // Hazard yellow band
      ctx.fillStyle = '#ffd600';
      ctx.fillRect(px - 16, py - 30, 32, 12);
      ctx.fillStyle = '#111827';
      ctx.font = '900 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TNT', px, py - 24);

      if (frameCount % 20 < 10) {
        ns.drawGlow(ctx, px, py - 48, 16, 'red', 0.65);
      }
      ctx.restore();
    },

    // ========================================================================
    // HD Weapon Capsules, Pillboxes & Falcon Emblems
    // ========================================================================
    drawWeaponPod(ctx, pod, frameCount) {
      const cx = pod.x;
      const cy = pod.y;
      ns.drawGlow(ctx, cx, cy, 38, 'red', 0.55);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = pod.flashTimer > 0 ? '#ffffff' : '#cbd5e1';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = frameCount % 10 < 5 ? '#ff1744' : '#ffd600';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    drawPillbox(ctx, box, frameCount) {
      const cx = box.x;
      const cy = box.y;
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.fillRect(cx - 26, cy - 26, 52, 52);
      ctx.strokeRect(cx - 26, cy - 26, 52, 52);

      if (box.openAmount > 0.2) {
        ns.drawGlow(ctx, cx, cy, 36, 'gold', 0.65);
        ctx.fillStyle = box.flashTimer > 0 ? '#ffffff' : (frameCount % 8 < 4 ? '#ff3d00' : '#ffab00');
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#475569';
        ctx.fillRect(cx - 20, cy - 20, 40, 18);
        ctx.fillRect(cx - 20, cy + 2, 40, 18);
      }
      ctx.restore();
    },

    drawPowerupItem(ctx, item, frameCount) {
      const cx = item.x;
      const cy = item.y;
      const pulse = Math.sin(frameCount * 0.18) * 3;
      ns.drawGlow(ctx, cx, cy, 36 + pulse, 'gold', 0.75);

      ctx.save();
      ctx.translate(cx, cy);
      // Golden Falcon Wings!
      ctx.fillStyle = '#ff3d00';
      ctx.beginPath();
      ctx.moveTo(-24, -10);
      ctx.lineTo(-8, -4);
      ctx.lineTo(0, -12);
      ctx.lineTo(8, -4);
      ctx.lineTo(24, -10);
      ctx.lineTo(16, 10);
      ctx.lineTo(0, 15);
      ctx.lineTo(-16, 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#ffd740';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffd740';
      ctx.font = '900 14px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = item.powerType === 'N' ? '★' : (item.powerType === 'G' ? '💣' : item.powerType);
      ctx.fillText(label, 0, 1);
      ctx.restore();
    }
  };
})(window.Contra);
