// ============================================================================
// CONTRA: SHATTERED OPS HD (魂斗罗：铁血重装版) - Core Configuration
// ============================================================================
window.Contra = window.Contra || {};

(function (ns) {
  'use strict';

  ns.CONFIG = {
    WIDTH: 1280,
    HEIGHT: 720,
    FPS: 60,
    FIXED_DT: 1 / 60,

    // HD Commando Physics
    GRAVITY: 0.58,
    MAX_FALL_SPEED: 15.5,
    PLAYER_SPEED: 4.9,
    JUMP_FORCE: -13.9,
    WATER_SPEED_FACTOR: 0.76,

    // Tactical Dash / Roll
    DASH_SPEED: 11.8,
    DASH_FRAMES: 11,
    DASH_COOLDOWN: 58,

    // Gameplay Rules
    DEFAULT_LIVES: 3,
    KONAMI_LIVES: 30,
    STARTING_GRENADES: 3,
    MAX_GRENADES: 6,
    EXTRA_LIFE_SCORES: [30000, 80000, 160000, 300000],
    RESPAWN_INVULN_FRAMES: 90,
    HIT_INVULN_FRAMES: 26,
    BARRIER_FRAMES: 260,

    // Difficulty Presets
    DIFFICULTIES: [
      {
        id: 'normal',
        name: 'NORMAL · 铁血战士',
        desc: '每条命含3格防弹护甲 · 标准弹幕强度',
        maxHp: 3,
        enemyHpMult: 1.0,
        bulletSpeedMult: 1.0,
        fireRateMult: 1.0,
        scoreMult: 1.0
      },
      {
        id: 'hard',
        name: 'HARD · 狂暴精英',
        desc: '每条命2格护甲 · 敌军高射速与强化装甲',
        maxHp: 2,
        enemyHpMult: 1.3,
        bulletSpeedMult: 1.18,
        fireRateMult: 1.25,
        scoreMult: 1.5
      },
      {
        id: 'nightmare',
        name: 'NIGHTMARE · 经典一击必杀',
        desc: '无护甲一击必死 · 极限硬核弹幕 · 双倍得分',
        maxHp: 1,
        enemyHpMult: 1.5,
        bulletSpeedMult: 1.32,
        fireRateMult: 1.45,
        scoreMult: 2.0
      }
    ],

    // 6 Upgradable HD Weapons (Lv.1 & Lv.2 MAX!)
    WEAPONS: {
      R: {
        id: 'R',
        name: '突击步枪',
        short: 'CARBINE',
        cooldown: 9,
        lv2Cooldown: 6,
        speed: 15.5,
        damage: 1.1,
        lv2Damage: 1.5,
        maxBullets: 12,
        color: '#ffe082',
        glow: 'gold'
      },
      M: {
        id: 'M',
        name: '火神加特林',
        short: 'VULCAN',
        cooldown: 5,
        lv2Cooldown: 3,
        speed: 17.0,
        damage: 1.35,
        lv2Damage: 1.75,
        maxBullets: 22,
        color: '#ff5252',
        glow: 'red'
      },
      S: {
        id: 'S',
        name: '高能散弹炮',
        short: 'SPREAD',
        cooldown: 13,
        lv2Cooldown: 11,
        speed: 14.5,
        damage: 1.3,
        lv2Damage: 1.55,
        maxBullets: 35,
        spreadLv1: [-0.36, -0.18, 0, 0.18, 0.36],
        spreadLv2: [-0.48, -0.32, -0.16, 0, 0.16, 0.32, 0.48],
        color: '#ff6e40',
        glow: 'red'
      },
      L: {
        id: 'L',
        name: '电磁轨道激光',
        short: 'RAILGUN',
        cooldown: 15,
        lv2Cooldown: 11,
        speed: 22.0,
        damage: 2.8,
        lv2Damage: 4.2,
        maxBullets: 14,
        pierce: true,
        color: '#40f8ff',
        glow: 'cyan'
      },
      F: {
        id: 'F',
        name: '凝固汽油烈焰',
        short: 'NAPALM',
        cooldown: 12,
        lv2Cooldown: 9,
        speed: 11.8,
        damage: 2.2,
        lv2Damage: 3.2,
        maxBullets: 14,
        spiral: true,
        explosive: true,
        color: '#ffab40',
        glow: 'fire'
      },
      C: {
        id: 'C',
        name: '蜂群追踪导弹',
        short: 'HOMING',
        cooldown: 13,
        lv2Cooldown: 9,
        speed: 12.4,
        damage: 1.9,
        lv2Damage: 2.4,
        maxBullets: 18,
        homing: true,
        color: '#b388ff',
        glow: 'purple'
      }
    }
  };
})(window.Contra);
