// ============================================================================
// CONTRA: SHATTERED OPS HD - 5 Complete HD Stages, Moving Lifts & Hazards
// ============================================================================
window.Contra = window.Contra || {};

(function (ns) {
  'use strict';

  const { WIDTH, HEIGHT } = ns.CONFIG;

  // ==========================================================================
  // 5 Handcrafted HD Stage Definitions (1280x720 Scale)
  // Max upward step <= 120px, max chasm gap <= 145px (Jump apex ~166px, span ~230px)
  // ==========================================================================
  const STAGE_DEFS = {
    // ------------------------------------------------------------------------
    // STAGE 1: JUNGLE WATERFALL (热带雨林·断桥突袭)
    // ------------------------------------------------------------------------
    1: {
      id: 1,
      theme: 'jungle',
      bgm: 'jungle',
      name: 'STAGE 1 · JUNGLE WATERFALL',
      cnName: '第一关：热带雨林·断桥突袭',
      length: 7680,
      bossLockX: 6400,
      bossType: 'titanWall',
      waterfalls: [{ x: 2420, w: 230 }, { x: 5120, w: 190 }],
      waterZones: [
        { x1: 520, x2: 3350, surfaceY: 636, bedY: 684 },
        { x1: 3550, x2: 4720, surfaceY: 636, bedY: 684 }
      ],
      lavaZones: [],
      platforms: [
        { x: 0,    y: 380, w: 1320, type: 'cliff', droppable: false },
        { x: 560,  y: 485, w: 310,  type: 'ledge', droppable: true },
        { x: 920,  y: 565, w: 340,  type: 'ledge', droppable: true },

        // [Bridge 1: 1320..1704 at y=380] + River climb-outs below
        { x: 1360, y: 575, w: 280,  type: 'ledge', droppable: true },
        { x: 1560, y: 475, w: 240,  type: 'ledge', droppable: true },

        { x: 1704, y: 380, w: 820,  type: 'cliff', droppable: false },
        { x: 1920, y: 270, w: 420,  type: 'ledge', droppable: true },
        { x: 2180, y: 485, w: 420,  type: 'ledge', droppable: true },

        // Waterfall multi-tier crossing
        { x: 2560, y: 420, w: 310,  type: 'ledge', droppable: true },
        { x: 2790, y: 310, w: 350,  type: 'ledge', droppable: true },
        { x: 2980, y: 520, w: 360,  type: 'ledge', droppable: true },

        { x: 3180, y: 380, w: 720,  type: 'cliff', droppable: false },
        { x: 3360, y: 268, w: 360,  type: 'ledge', droppable: true },
        { x: 3580, y: 495, w: 320,  type: 'ledge', droppable: true },

        // [Bridge 2: 3900..4284 at y=380] + River climb-outs
        { x: 3940, y: 575, w: 280,  type: 'ledge', droppable: true },
        { x: 4140, y: 475, w: 240,  type: 'ledge', droppable: true },

        // Jungle Ridge Chasm Gauntlet
        { x: 4284, y: 380, w: 620,  type: 'cliff', droppable: false },
        { x: 4460, y: 270, w: 340,  type: 'ledge', droppable: true },
        { x: 5010, y: 430, w: 480,  type: 'cliff', droppable: false },
        { x: 5120, y: 315, w: 300,  type: 'ledge', droppable: true },
        { x: 5595, y: 485, w: 480,  type: 'cliff', droppable: false },
        { x: 5710, y: 370, w: 310,  type: 'ledge', droppable: true },
        { x: 6040, y: 560, w: 420,  type: 'cliff', droppable: false },

        // Boss 1 Arena
        { x: 6380, y: 636, w: 1300, type: 'solid', droppable: false },
        { x: 6480, y: 520, w: 250,  type: 'ledge', droppable: true },
        { x: 6680, y: 410, w: 230,  type: 'ledge', droppable: true },
        { x: 6480, y: 300, w: 210,  type: 'ledge', droppable: true }
      ],
      movingPlatforms: [],
      laserGates: [],
      bridges: [
        { x: 1320, y: 380, segments: 4, segWidth: 96 },
        { x: 3900, y: 380, segments: 4, segWidth: 96 }
      ],
      spawns: [
        { triggerX: 40,   kind: 'pod',       x: 80,   y: 170, power: 'M' },
        { triggerX: 120,  kind: 'barrel',    x: 860,  y: 380 },
        { triggerX: 140,  kind: 'runner',    x: 920,  y: 380 },
        { triggerX: 220,  kind: 'runner',    x: 1120, y: 380 },
        { triggerX: 280,  kind: 'pillbox',   x: 980,  y: 445, power: 'S' },
        { triggerX: 380,  kind: 'sniper',    x: 1140, y: 565 },
        { triggerX: 520,  kind: 'shield',    x: 1240, y: 380 },

        { triggerX: 980,  kind: 'pod',       x: 1020, y: 165, power: 'S' },
        { triggerX: 1150, kind: 'sniper',    x: 1520, y: 575 },
        { triggerX: 1350, kind: 'cannon',    x: 2080, y: 380 },
        { triggerX: 1420, kind: 'grenadier', x: 2160, y: 270 },
        { triggerX: 1560, kind: 'turret',    x: 2380, y: 445 },
        { triggerX: 1680, kind: 'barrel',    x: 2320, y: 380 },
        { triggerX: 1750, kind: 'runner',    x: 2460, y: 380 },

        { triggerX: 2100, kind: 'pod',       x: 2140, y: 160, power: 'C' },
        { triggerX: 2250, kind: 'sniper',    x: 2960, y: 310 },
        { triggerX: 2480, kind: 'pillbox',   x: 3290, y: 445, power: 'L' },
        { triggerX: 2620, kind: 'shield',    x: 3560, y: 380 },
        { triggerX: 2750, kind: 'cannon',    x: 3740, y: 380 },
        { triggerX: 2860, kind: 'grenadier', x: 3580, y: 268 },

        { triggerX: 3350, kind: 'pod',       x: 3400, y: 165, power: 'R' },
        { triggerX: 3650, kind: 'jetpack',   x: 4380, y: 220 },
        { triggerX: 3850, kind: 'cannon',    x: 4720, y: 380 },
        { triggerX: 3920, kind: 'sniper',    x: 4680, y: 270 },
        { triggerX: 4220, kind: 'pod',       x: 4260, y: 175, power: 'G' },
        { triggerX: 4400, kind: 'shield',    x: 5280, y: 430 },
        { triggerX: 4560, kind: 'turret',    x: 5380, y: 495 },
        { triggerX: 4820, kind: 'pod',       x: 4860, y: 170, power: 'S' },
        { triggerX: 4980, kind: 'cannon',    x: 5940, y: 485 },
        { triggerX: 5120, kind: 'grenadier', x: 5890, y: 370 },
        { triggerX: 5400, kind: 'pod',       x: 5440, y: 185, power: 'N' }
      ]
    },

    // ------------------------------------------------------------------------
    // STAGE 2: CYBERNETIC FACTORY (赛博基地·高压走廊)
    // ------------------------------------------------------------------------
    2: {
      id: 2,
      theme: 'cyber',
      bgm: 'cyber',
      name: 'STAGE 2 · CYBERNETIC FACTORY',
      cnName: '第二关：赛博基地·高压走廊',
      length: 7400,
      bossLockX: 6120,
      bossType: 'spiderMech',
      waterfalls: [],
      waterZones: [],
      lavaZones: [],
      platforms: [
        { x: 0,    y: 520, w: 1280, type: 'cliff', droppable: false },
        { x: 420,  y: 405, w: 380,  type: 'ledge', droppable: true },
        { x: 860,  y: 300, w: 360,  type: 'ledge', droppable: true },

        { x: 1390, y: 480, w: 720,  type: 'cliff', droppable: false },
        { x: 1540, y: 365, w: 420,  type: 'ledge', droppable: true },

        // Hover-Lift Crossing 1 (x: 2110..2560, safety catwalks + moving lift!)
        { x: 2180, y: 575, w: 300,  type: 'ledge', droppable: true },
        { x: 2550, y: 470, w: 820,  type: 'cliff', droppable: false },
        { x: 2740, y: 355, w: 440,  type: 'ledge', droppable: true },

        // Reactor Bridge + Emergency Lower Deck
        { x: 3370, y: 430, w: 320,  type: 'cliff', droppable: false },
        // [Bridge: 3690..4074 at y=430]
        { x: 3660, y: 560, w: 220,  type: 'ledge', droppable: true },
        { x: 3920, y: 530, w: 220,  type: 'ledge', droppable: true },
        { x: 4074, y: 430, w: 760,  type: 'cliff', droppable: false },
        { x: 4240, y: 315, w: 420,  type: 'ledge', droppable: true },

        // Cyber Gauntlet
        { x: 4940, y: 490, w: 620,  type: 'cliff', droppable: false },
        { x: 5080, y: 375, w: 360,  type: 'ledge', droppable: true },
        { x: 5660, y: 565, w: 520,  type: 'cliff', droppable: false },

        // Boss 2 Arena
        { x: 6100, y: 636, w: 1300, type: 'solid', droppable: false },
        { x: 6220, y: 515, w: 240,  type: 'ledge', droppable: true },
        { x: 6460, y: 400, w: 240,  type: 'ledge', droppable: true },
        { x: 6220, y: 295, w: 200,  type: 'ledge', droppable: true }
      ],
      movingPlatforms: [
        { x: 2150, y: 455, w: 170, baseX: 2150, baseY: 455, rangeX: 190, rangeY: 0, speed: 0.032, phase: 0 },
        { x: 4800, y: 440, w: 150, baseX: 4800, baseY: 440, rangeX: 0, rangeY: 85, speed: 0.04, phase: 1.2 }
      ],
      laserGates: [
        { x: 1760, y1: 240, y2: 480, period: 150, activeFrames: 68 },
        { x: 2980, y1: 230, y2: 470, period: 150, activeFrames: 68 },
        { x: 4480, y1: 190, y2: 430, period: 140, activeFrames: 65 }
      ],
      bridges: [
        { x: 3690, y: 430, segments: 4, segWidth: 96 }
      ],
      spawns: [
        { triggerX: 30,   kind: 'pod',       x: 70,   y: 180, power: 'L' },
        { triggerX: 120,  kind: 'drone',     x: 920,  y: 260 },
        { triggerX: 180,  kind: 'shield',    x: 1080, y: 520 },
        { triggerX: 250,  kind: 'barrel',    x: 1020, y: 520 },
        { triggerX: 340,  kind: 'sniper',    x: 1060, y: 300 },
        { triggerX: 680,  kind: 'cannon',    x: 1920, y: 480 },
        { triggerX: 760,  kind: 'drone',     x: 1980, y: 240 },
        { triggerX: 920,  kind: 'pillbox',   x: 1820, y: 545, power: 'C' },
        { triggerX: 1450, kind: 'pod',       x: 1500, y: 175, power: 'S' },
        { triggerX: 1680, kind: 'shield',    x: 2880, y: 470 },
        { triggerX: 1760, kind: 'turret',    x: 3180, y: 530 },
        { triggerX: 1880, kind: 'grenadier', x: 3020, y: 355 },
        { triggerX: 2350, kind: 'pod',       x: 2400, y: 170, power: 'R' },
        { triggerX: 2880, kind: 'jetpack',   x: 4220, y: 210 },
        { triggerX: 3050, kind: 'cannon',    x: 4660, y: 430 },
        { triggerX: 3180, kind: 'barrel',    x: 4520, y: 430 },
        { triggerX: 3300, kind: 'sniper',    x: 4520, y: 315 },
        { triggerX: 3800, kind: 'pod',       x: 3840, y: 175, power: 'M' },
        { triggerX: 4120, kind: 'shield',    x: 5340, y: 490 },
        { triggerX: 4280, kind: 'drone',     x: 5480, y: 260 },
        { triggerX: 4550, kind: 'cannon',    x: 5980, y: 565 },
        { triggerX: 4750, kind: 'pod',       x: 4800, y: 185, power: 'G' }
      ]
    },

    // ------------------------------------------------------------------------
    // STAGE 3: ARCTIC BLIZZARD (极寒雪原·暴风防线)
    // ------------------------------------------------------------------------
    3: {
      id: 3,
      theme: 'arctic',
      bgm: 'arctic',
      name: 'STAGE 3 · ARCTIC BLIZZARD',
      cnName: '第三关：极寒雪原·暴风防线',
      length: 7500,
      bossLockX: 6220,
      bossType: 'gunship',
      waterfalls: [],
      waterZones: [],
      lavaZones: [],
      platforms: [
        { x: 0,    y: 490, w: 1340, type: 'cliff', droppable: false },
        { x: 480,  y: 375, w: 420,  type: 'ledge', droppable: true },
        { x: 960,  y: 270, w: 340,  type: 'ledge', droppable: true },

        { x: 1450, y: 450, w: 840,  type: 'cliff', droppable: false },
        { x: 1680, y: 335, w: 440,  type: 'ledge', droppable: true },

        // Ice Gorge Bridge + Lower Glacier Ledges
        // [Bridge: 2290..2674 at y=450]
        { x: 2270, y: 575, w: 230,  type: 'ledge', droppable: true },
        { x: 2530, y: 545, w: 230,  type: 'ledge', droppable: true },

        { x: 2674, y: 450, w: 860,  type: 'cliff', droppable: false },
        { x: 2880, y: 335, w: 460,  type: 'ledge', droppable: true },

        { x: 3640, y: 500, w: 780,  type: 'cliff', droppable: false },
        { x: 3820, y: 380, w: 440,  type: 'ledge', droppable: true },
        { x: 4040, y: 268, w: 320,  type: 'ledge', droppable: true },

        { x: 4530, y: 460, w: 820,  type: 'cliff', droppable: false },
        { x: 4740, y: 345, w: 420,  type: 'ledge', droppable: true },

        { x: 5460, y: 545, w: 820,  type: 'cliff', droppable: false },
        { x: 5640, y: 430, w: 380,  type: 'ledge', droppable: true },

        // Boss 3 Gunship Helipad Arena
        { x: 6200, y: 636, w: 1300, type: 'solid', droppable: false },
        { x: 6340, y: 510, w: 240,  type: 'ledge', droppable: true },
        { x: 6720, y: 410, w: 260,  type: 'ledge', droppable: true },
        { x: 7100, y: 510, w: 240,  type: 'ledge', droppable: true }
      ],
      movingPlatforms: [
        { x: 3500, y: 470, w: 150, baseX: 3500, baseY: 470, rangeX: 90, rangeY: 0, speed: 0.035, phase: 0 }
      ],
      laserGates: [],
      bridges: [
        { x: 2290, y: 450, segments: 4, segWidth: 96 }
      ],
      spawns: [
        { triggerX: 30,   kind: 'pod',       x: 80,   y: 170, power: 'F' },
        { triggerX: 140,  kind: 'jetpack',   x: 980,  y: 200 },
        { triggerX: 240,  kind: 'shield',    x: 1150, y: 490 },
        { triggerX: 320,  kind: 'sniper',    x: 1180, y: 270 },
        { triggerX: 650,  kind: 'cannon',    x: 2080, y: 450 },
        { triggerX: 740,  kind: 'grenadier', x: 1960, y: 335 },
        { triggerX: 880,  kind: 'pillbox',   x: 1860, y: 515, power: 'S' },
        { triggerX: 1500, kind: 'pod',       x: 1550, y: 165, power: 'C' },
        { triggerX: 1650, kind: 'jetpack',   x: 2820, y: 190 },
        { triggerX: 1820, kind: 'jetpack',   x: 3120, y: 210 },
        { triggerX: 1980, kind: 'cannon',    x: 3360, y: 450 },
        { triggerX: 2100, kind: 'barrel',    x: 3180, y: 450 },
        { triggerX: 2650, kind: 'pod',       x: 2700, y: 170, power: 'M' },
        { triggerX: 2850, kind: 'shield',    x: 4120, y: 500 },
        { triggerX: 2980, kind: 'turret',    x: 4320, y: 560 },
        { triggerX: 3120, kind: 'sniper',    x: 4220, y: 268 },
        { triggerX: 3650, kind: 'pod',       x: 3700, y: 175, power: 'L' },
        { triggerX: 3880, kind: 'jetpack',   x: 4980, y: 200 },
        { triggerX: 4020, kind: 'cannon',    x: 5220, y: 460 },
        { triggerX: 4450, kind: 'shield',    x: 5940, y: 545 },
        { triggerX: 4620, kind: 'grenadier', x: 5880, y: 430 },
        { triggerX: 4900, kind: 'pod',       x: 4950, y: 180, power: 'N' }
      ]
    },

    // ------------------------------------------------------------------------
    // STAGE 4: VOLCANIC MAGMA CORE (熔岩地心·烈焰峡谷)
    // ------------------------------------------------------------------------
    4: {
      id: 4,
      theme: 'volcano',
      bgm: 'volcano',
      name: 'STAGE 4 · VOLCANIC MAGMA CORE',
      cnName: '第四关：熔岩地心·烈焰峡谷',
      length: 7600,
      bossLockX: 6320,
      bossType: 'magmaDragon',
      waterfalls: [],
      waterZones: [],
      lavaZones: [
        { x1: 0, x2: 7600, surfaceY: 676 }
      ],
      platforms: [
        { x: 0,    y: 500, w: 1260, type: 'cliff', droppable: false },
        { x: 460,  y: 385, w: 420,  type: 'ledge', droppable: true },

        { x: 1370, y: 465, w: 780,  type: 'cliff', droppable: false },
        { x: 1580, y: 350, w: 420,  type: 'ledge', droppable: true },

        { x: 2260, y: 515, w: 760,  type: 'cliff', droppable: false },
        { x: 2480, y: 395, w: 420,  type: 'ledge', droppable: true },

        // Magma Bridge + Basalt Stepping Stones
        { x: 3020, y: 445, w: 280,  type: 'cliff', droppable: false },
        // [Bridge: 3300..3684 at y=445]
        { x: 3280, y: 565, w: 220,  type: 'ledge', droppable: true },
        { x: 3540, y: 540, w: 220,  type: 'ledge', droppable: true },
        { x: 3684, y: 445, w: 820,  type: 'cliff', droppable: false },
        { x: 3900, y: 330, w: 440,  type: 'ledge', droppable: true },

        { x: 4615, y: 495, w: 820,  type: 'cliff', droppable: false },
        { x: 4840, y: 375, w: 420,  type: 'ledge', droppable: true },

        { x: 5545, y: 555, w: 820,  type: 'cliff', droppable: false },
        { x: 5720, y: 435, w: 380,  type: 'ledge', droppable: true },

        // Boss 4 Magma Caldera Arena
        { x: 6300, y: 630, w: 1300, type: 'solid', droppable: false },
        { x: 6420, y: 505, w: 250,  type: 'ledge', droppable: true },
        { x: 6680, y: 395, w: 240,  type: 'ledge', droppable: true },
        { x: 6420, y: 290, w: 210,  type: 'ledge', droppable: true }
      ],
      movingPlatforms: [
        { x: 2140, y: 490, w: 140, baseX: 2140, baseY: 490, rangeX: 60, rangeY: 0, speed: 0.04, phase: 0 },
        { x: 4490, y: 470, w: 140, baseX: 4490, baseY: 470, rangeX: 60, rangeY: 0, speed: 0.04, phase: 1.5 }
      ],
      laserGates: [],
      bridges: [
        { x: 3300, y: 445, segments: 4, segWidth: 96 }
      ],
      spawns: [
        { triggerX: 30,   kind: 'pod',       x: 80,   y: 175, power: 'S' },
        { triggerX: 120,  kind: 'alien',     x: 980,  y: 500 },
        { triggerX: 200,  kind: 'shield',    x: 1120, y: 500 },
        { triggerX: 280,  kind: 'grenadier', x: 780,  y: 385 },
        { triggerX: 620,  kind: 'cannon',    x: 1980, y: 465 },
        { triggerX: 720,  kind: 'jetpack',   x: 1920, y: 200 },
        { triggerX: 880,  kind: 'pillbox',   x: 1760, y: 530, power: 'M' },
        { triggerX: 1380, kind: 'pod',       x: 1420, y: 170, power: 'C' },
        { triggerX: 1550, kind: 'turret',    x: 2860, y: 575 },
        { triggerX: 1680, kind: 'barrel',    x: 2740, y: 515 },
        { triggerX: 1780, kind: 'sniper',    x: 2790, y: 395 },
        { triggerX: 2350, kind: 'pod',       x: 2400, y: 165, power: 'F' },
        { triggerX: 2750, kind: 'alien',     x: 4120, y: 445 },
        { triggerX: 2850, kind: 'alien',     x: 4280, y: 445 },
        { triggerX: 2980, kind: 'cannon',    x: 4380, y: 445 },
        { triggerX: 3580, kind: 'pod',       x: 3620, y: 175, power: 'L' },
        { triggerX: 3820, kind: 'shield',    x: 5180, y: 495 },
        { triggerX: 3980, kind: 'jetpack',   x: 5260, y: 210 },
        { triggerX: 4450, kind: 'cannon',    x: 6080, y: 555 },
        { triggerX: 4620, kind: 'grenadier', x: 5980, y: 435 },
        { triggerX: 4920, kind: 'pod',       x: 4960, y: 180, power: 'G' }
      ]
    },

    // ------------------------------------------------------------------------
    // STAGE 5: RED FALCON BIO-HIVE (异形母巢·红隼终局)
    // ------------------------------------------------------------------------
    5: {
      id: 5,
      theme: 'hive',
      bgm: 'hive',
      name: 'FINAL STAGE · RED FALCON BIO-HIVE',
      cnName: '最终关：异形母巢·红隼终局',
      length: 7800,
      bossLockX: 6520,
      bossType: 'emperorGava',
      waterfalls: [],
      waterZones: [],
      lavaZones: [
        { x1: 0, x2: 7800, surfaceY: 682, isAcid: true }
      ],
      platforms: [
        { x: 0,    y: 510, w: 1320, type: 'cliff', droppable: false },
        { x: 460,  y: 395, w: 420,  type: 'ledge', droppable: true },
        { x: 920,  y: 285, w: 360,  type: 'ledge', droppable: true },

        { x: 1430, y: 475, w: 820,  type: 'cliff', droppable: false },
        { x: 1650, y: 360, w: 440,  type: 'ledge', droppable: true },

        { x: 2360, y: 515, w: 820,  type: 'cliff', droppable: false },
        { x: 2580, y: 395, w: 440,  type: 'ledge', droppable: true },

        // Bio-Spine Bridge + Tendril Ledges
        { x: 3180, y: 455, w: 300,  type: 'cliff', droppable: false },
        // [Bridge: 3480..3864 at y=455]
        { x: 3460, y: 575, w: 220,  type: 'ledge', droppable: true },
        { x: 3720, y: 545, w: 220,  type: 'ledge', droppable: true },
        { x: 3864, y: 455, w: 860,  type: 'cliff', droppable: false },
        { x: 4080, y: 340, w: 460,  type: 'ledge', droppable: true },

        { x: 4835, y: 500, w: 840,  type: 'cliff', droppable: false },
        { x: 5060, y: 380, w: 440,  type: 'ledge', droppable: true },

        { x: 5785, y: 560, w: 780,  type: 'cliff', droppable: false },
        { x: 5960, y: 440, w: 400,  type: 'ledge', droppable: true },

        // Final Boss Sanctum Arena
        { x: 6500, y: 636, w: 1300, type: 'solid', droppable: false },
        { x: 6620, y: 520, w: 250,  type: 'ledge', droppable: true },
        { x: 6900, y: 405, w: 260,  type: 'ledge', droppable: true },
        { x: 6640, y: 305, w: 230,  type: 'ledge', droppable: true }
      ],
      movingPlatforms: [
        { x: 2240, y: 495, w: 140, baseX: 2240, baseY: 495, rangeX: 60, rangeY: 0, speed: 0.042, phase: 0 },
        { x: 4715, y: 475, w: 140, baseX: 4715, baseY: 475, rangeX: 60, rangeY: 0, speed: 0.042, phase: 1.4 }
      ],
      laserGates: [
        { x: 1920, y1: 230, y2: 475, period: 145, activeFrames: 64 },
        { x: 4360, y1: 210, y2: 455, period: 145, activeFrames: 64 }
      ],
      bridges: [
        { x: 3480, y: 455, segments: 4, segWidth: 96 }
      ],
      spawns: [
        { triggerX: 30,   kind: 'pod',       x: 80,   y: 175, power: 'S' },
        { triggerX: 100,  kind: 'alien',     x: 920,  y: 510 },
        { triggerX: 160,  kind: 'alien',     x: 1080, y: 510 },
        { triggerX: 240,  kind: 'drone',     x: 1120, y: 230 },
        { triggerX: 320,  kind: 'sniper',    x: 1180, y: 285 },
        { triggerX: 680,  kind: 'shield',    x: 1980, y: 475 },
        { triggerX: 780,  kind: 'cannon',    x: 2120, y: 475 },
        { triggerX: 900,  kind: 'pillbox',   x: 1780, y: 540, power: 'L' },
        { triggerX: 1450, kind: 'pod',       x: 1500, y: 170, power: 'C' },
        { triggerX: 1680, kind: 'alien',     x: 2880, y: 515 },
        { triggerX: 1760, kind: 'turret',    x: 3040, y: 575 },
        { triggerX: 1880, kind: 'jetpack',   x: 2960, y: 200 },
        { triggerX: 2500, kind: 'pod',       x: 2550, y: 165, power: 'B' },
        { triggerX: 2950, kind: 'alien',     x: 4260, y: 455 },
        { triggerX: 3040, kind: 'shield',    x: 4460, y: 455 },
        { triggerX: 3160, kind: 'cannon',    x: 4620, y: 455 },
        { triggerX: 3820, kind: 'pod',       x: 3860, y: 175, power: 'S' },
        { triggerX: 4100, kind: 'drone',     x: 5280, y: 250 },
        { triggerX: 4220, kind: 'cannon',    x: 5540, y: 500 },
        { triggerX: 4750, kind: 'alien',     x: 6180, y: 560 },
        { triggerX: 4860, kind: 'cannon',    x: 6360, y: 560 },
        { triggerX: 5120, kind: 'pod',       x: 5160, y: 180, power: 'N' }
      ]
    }
  };

  // ==========================================================================
  // Level Engine Class
  // ==========================================================================
  class Level {
    constructor(stageNum) {
      const data = STAGE_DEFS[stageNum] || STAGE_DEFS[1];
      this.id = data.id;
      this.theme = data.theme;
      this.bgm = data.bgm;
      this.name = data.name;
      this.cnName = data.cnName;
      this.length = data.length;
      this.bossLockX = data.bossLockX;
      this.bossType = data.bossType;

      this.waterfalls = data.waterfalls.map((w) => Object.assign({}, w));
      this.waterZones = data.waterZones.map((w) => Object.assign({}, w));
      this.lavaZones = data.lavaZones.map((l) => Object.assign({}, l));
      this.platforms = data.platforms.map((p) => Object.assign({}, p));

      this.movingPlatforms = data.movingPlatforms.map((mp) => Object.assign({
        type: 'moving',
        droppable: true,
        dx: 0,
        dy: 0
      }, mp));

      this.laserGates = data.laserGates.map((lg) => Object.assign({ active: false }, lg));

      this.bridgeSegments = [];
      for (let i = 0; i < data.bridges.length; i++) {
        const b = data.bridges[i];
        for (let s = 0; s < b.segments; s++) {
          this.bridgeSegments.push({
            x: b.x + s * b.segWidth,
            y: b.y,
            w: b.segWidth,
            type: 'bridge',
            droppable: false,
            alive: true,
            triggered: false,
            fuse: 26 + s * 7
          });
        }
      }

      for (let i = 0; i < this.waterZones.length; i++) {
        const wz = this.waterZones[i];
        this.platforms.push({
          x: wz.x1,
          y: wz.bedY,
          w: wz.x2 - wz.x1,
          type: 'waterbed',
          droppable: false
        });
      }

      this.spawns = data.spawns.map((s) => Object.assign({ spawned: false }, s));
    }

    getAllSolidSurfaces() {
      const list = this.platforms.concat(this.movingPlatforms);
      for (let i = 0; i < this.bridgeSegments.length; i++) {
        if (this.bridgeSegments[i].alive) list.push(this.bridgeSegments[i]);
      }
      return list;
    }

    getWaterAt(x, y) {
      for (let i = 0; i < this.waterZones.length; i++) {
        const wz = this.waterZones[i];
        if (x >= wz.x1 && x <= wz.x2 && y >= wz.surfaceY) return wz;
      }
      return null;
    }

    getLavaAt(x, y) {
      for (let i = 0; i < this.lavaZones.length; i++) {
        const lz = this.lavaZones[i];
        if (x >= lz.x1 && x <= lz.x2 && y >= lz.surfaceY) return lz;
      }
      return null;
    }

    resolveLanding(x, prevY, nextY, ignorePlatformY = null) {
      if (nextY < prevY - 4) return null;
      const surfaces = this.getAllSolidSurfaces();
      let best = null;

      for (let i = 0; i < surfaces.length; i++) {
        const p = surfaces[i];
        if (ignorePlatformY !== null && Math.abs(p.y - ignorePlatformY) < 6 && p.droppable) {
          continue;
        }
        if (x >= p.x - 10 && x <= p.x + p.w + 10) {
          const tol = p.type === 'moving' ? 12 : 8;
          if (prevY <= p.y + tol && nextY >= p.y - 2) {
            if (!best || p.y < best.y) best = p;
          }
        }
      }
      return best;
    }

    findSafeSpawn(cameraX) {
      const minX = cameraX + 90;
      const maxX = cameraX + 680;
      let bestX = cameraX + 180;
      let bestY = 9999;

      const surfaces = this.platforms;
      for (let i = 0; i < surfaces.length; i++) {
        const p = surfaces[i];
        const left = Math.max(minX, p.x + 36);
        const right = Math.min(maxX, p.x + p.w - 36);
        if (right > left && p.y < bestY) {
          bestY = p.y;
          bestX = (left + right) * 0.5;
        }
      }
      return { x: bestX, y: 70 };
    }

    update(players, particles, audio, frameCount, triggerShake) {
      // 1) Moving Hover-Platforms
      for (let i = 0; i < this.movingPlatforms.length; i++) {
        const mp = this.movingPlatforms[i];
        const nx = mp.baseX + Math.sin(frameCount * mp.speed + mp.phase) * mp.rangeX;
        const ny = mp.baseY + Math.cos(frameCount * mp.speed + mp.phase) * mp.rangeY;
        mp.dx = nx - mp.x;
        mp.dy = ny - mp.y;
        mp.x = nx;
        mp.y = ny;
      }

      // 2) Timed Laser Security Gates
      for (let i = 0; i < this.laserGates.length; i++) {
        const lg = this.laserGates[i];
        const t = frameCount % lg.period;
        lg.active = t < lg.activeFrames;
        lg.warning = !lg.active && t > lg.period - 25;
      }

      // 3) Explosive Suspension Bridges
      for (let i = 0; i < this.bridgeSegments.length; i++) {
        const seg = this.bridgeSegments[i];
        if (!seg.alive) continue;
        if (!seg.triggered) {
          for (let p = 0; p < players.length; p++) {
            const pl = players[p];
            if (pl.active && pl.state !== 'dead' && pl.x >= seg.x - 18) {
              seg.triggered = true;
              break;
            }
          }
        } else {
          seg.fuse--;
          if (seg.fuse <= 0) {
            seg.alive = false;
            particles.spawnExplosion(seg.x + seg.w * 0.5, seg.y + 8, 64, true);
            audio.sfx('explosion');
            if (triggerShake) triggerShake(10, 14);
          }
        }
      }
    }

    // ========================================================================
    // Cinematic HD Multi-Layer Background & Foreground Rendering
    // ========================================================================
    drawBackground(ctx, cameraX, frameCount) {
      // Sky Gradient per Stage Theme
      if (ctx.createLinearGradient) {
        const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
        if (this.theme === 'jungle') {
          sky.addColorStop(0, '#071a26');
          sky.addColorStop(0.55, '#0f382f');
          sky.addColorStop(1, '#061a14');
        } else if (this.theme === 'cyber') {
          sky.addColorStop(0, '#050816');
          sky.addColorStop(0.6, '#0d1b38');
          sky.addColorStop(1, '#060a18');
        } else if (this.theme === 'arctic') {
          sky.addColorStop(0, '#07132c');
          sky.addColorStop(0.45, '#133b5c');
          sky.addColorStop(1, '#1e4d6b');
        } else if (this.theme === 'volcano') {
          sky.addColorStop(0, '#140505');
          sky.addColorStop(0.6, '#450f0a');
          sky.addColorStop(1, '#8f2406');
        } else {
          sky.addColorStop(0, '#090314');
          sky.addColorStop(0.6, '#230938');
          sky.addColorStop(1, '#120422');
        }
        ctx.fillStyle = sky;
      } else {
        ctx.fillStyle = '#091422';
      }
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Distant Mountain / City / Hive Silhouettes (0.18x Parallax)
      const p1 = (cameraX * 0.18) % 420;
      ctx.fillStyle = this.theme === 'volcano' ? '#260808'
        : (this.theme === 'arctic' ? '#1e3a5f'
        : (this.theme === 'cyber' ? '#0b1329'
        : (this.theme === 'hive' ? '#1a062b' : '#0a241e')));

      for (let i = -1; i < 5; i++) {
        const bx = i * 420 - p1;
        ctx.beginPath();
        ctx.moveTo(bx, HEIGHT);
        ctx.lineTo(bx + 140, 210);
        ctx.lineTo(bx + 260, 320);
        ctx.lineTo(bx + 350, 175);
        ctx.lineTo(bx + 460, HEIGHT);
        ctx.closePath();
        ctx.fill();
      }

      // Midground Theme Architecture / Jungle Canopy (0.42x Parallax)
      const p2 = (cameraX * 0.42) % 240;
      for (let i = -1; i < 7; i++) {
        const mx = i * 240 - p2;
        if (this.theme === 'jungle') {
          // Giant rainforest trunks + sunbeams + foliage canopies
          ctx.fillStyle = '#19120c';
          ctx.fillRect(mx + 85, 110, 34, 560);
          ctx.fillStyle = '#134e3a';
          ctx.beginPath();
          ctx.arc(mx + 102, 115, 92, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1f7a4c';
          ctx.beginPath();
          ctx.arc(mx + 82, 95, 64, 0, Math.PI * 2);
          ctx.fill();

          // Volumetric golden sun-ray!
          ctx.save();
          ctx.globalAlpha = 0.06;
          ctx.fillStyle = '#fff59d';
          ctx.beginPath();
          ctx.moveTo(mx + 40, 0);
          ctx.lineTo(mx + 130, 0);
          ctx.lineTo(mx + 260, HEIGHT);
          ctx.lineTo(mx + 120, HEIGHT);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (this.theme === 'cyber') {
          ctx.fillStyle = '#111c33';
          ctx.fillRect(mx + 30, 60, 160, 620);
          ctx.fillStyle = (i + Math.floor(frameCount / 25)) % 2 === 0 ? '#00e5ff' : '#1e40af';
          ctx.fillRect(mx + 104, 110, 12, 480);
        } else if (this.theme === 'arctic') {
          // Aurora ribbon in sky + pine silhouettes
          ctx.save();
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = '#64ffda';
          ctx.fillRect(mx, 70 + Math.sin(frameCount * 0.02 + i) * 25, 240, 45);
          ctx.restore();
          ctx.fillStyle = '#173753';
          ctx.beginPath();
          ctx.moveTo(mx + 110, 260);
          ctx.lineTo(mx + 55, 580);
          ctx.lineTo(mx + 165, 580);
          ctx.closePath();
          ctx.fill();
        } else if (this.theme === 'volcano') {
          ctx.fillStyle = '#2d0c09';
          ctx.fillRect(mx + 60, 90, 80, 600);
          ctx.fillStyle = '#ff3d00';
          ctx.fillRect(mx + 96, 140, 8, 520);
        } else {
          // Biomechanical Alien Ribs & Glowing Stasis Sacs
          ctx.fillStyle = '#24093a';
          ctx.fillRect(mx + 45, 50, 130, 630);
          const glowR = 26 + Math.sin(frameCount * 0.08 + i) * 4;
          ns.drawGlow(ctx, mx + 110, 280, glowR * 1.6, 'purple', 0.45);
          ctx.fillStyle = '#d500f9';
          ctx.beginPath();
          ctx.arc(mx + 110, 280, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Waterfalls (Stage 1)
      for (let i = 0; i < this.waterfalls.length; i++) {
        const wf = this.waterfalls[i];
        const sx = wf.x - cameraX;
        if (sx + wf.w < 0 || sx > WIDTH) continue;

        ctx.fillStyle = 'rgba(14, 116, 184, 0.72)';
        ctx.fillRect(sx, 0, wf.w, 650);

        const shift = (frameCount * 9) % 48;
        ctx.fillStyle = 'rgba(224, 247, 255, 0.65)';
        for (let col = 12; col < wf.w - 12; col += 26) {
          for (let y = -48 + shift; y < 640; y += 48) {
            ctx.fillRect(sx + col, y, 8, 26);
          }
        }
        ns.drawGlow(ctx, sx + wf.w * 0.5, 634, wf.w * 0.7, 'cyan', 0.45);
      }
    }

    drawForeground(ctx, cameraX, frameCount) {
      // 1) Static Cliffs & Ledges
      for (let i = 0; i < this.platforms.length; i++) {
        const p = this.platforms[i];
        if (p.type === 'waterbed') continue;
        const sx = p.x - cameraX;
        if (sx + p.w < -20 || sx > WIDTH + 20) continue;

        if (p.type === 'cliff' || p.type === 'solid') {
          this._drawHDCliff(ctx, sx, p.y, p.w, HEIGHT - p.y);
        } else {
          this._drawHDLedge(ctx, sx, p.y, p.w);
        }
      }

      // 2) Moving Hover-Platforms (with thruster glow!)
      for (let i = 0; i < this.movingPlatforms.length; i++) {
        const mp = this.movingPlatforms[i];
        const sx = mp.x - cameraX;
        if (sx + mp.w < -20 || sx > WIDTH + 20) continue;

        ns.drawGlow(ctx, sx + 26, mp.y + 18, 28, 'cyan', 0.65);
        ns.drawGlow(ctx, sx + mp.w - 26, mp.y + 18, 28, 'cyan', 0.65);

        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.fillRect(sx, mp.y, mp.w, 18);
        ctx.strokeRect(sx, mp.y, mp.w, 18);

        ctx.fillStyle = '#ffd740';
        for (let x = 10; x < mp.w - 14; x += 24) {
          ctx.fillRect(sx + x, mp.y + 5, 12, 4);
        }
      }

      // 3) Explosive Suspension Bridges
      for (let i = 0; i < this.bridgeSegments.length; i++) {
        const seg = this.bridgeSegments[i];
        if (!seg.alive) continue;
        const sx = seg.x - cameraX;
        if (sx + seg.w < 0 || sx > WIDTH) continue;

        const warn = seg.triggered && (seg.fuse % 4 < 2);
        ctx.strokeStyle = warn ? '#ffffff' : '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, seg.y - 32);
        ctx.lineTo(sx + seg.w, seg.y - 32);
        ctx.moveTo(sx + 8, seg.y - 32);
        ctx.lineTo(sx + 8, seg.y);
        ctx.moveTo(sx + seg.w - 8, seg.y - 32);
        ctx.lineTo(sx + seg.w - 8, seg.y);
        ctx.stroke();

        ctx.fillStyle = warn ? '#ffd740' : '#b45309';
        ctx.fillRect(sx, seg.y, seg.w, 16);
        ctx.fillStyle = '#451a03';
        for (let lx = 4; lx < seg.w; lx += 20) {
          ctx.fillRect(sx + lx, seg.y + 3, 14, 10);
        }
      }

      // 4) Timed Security Laser Gates!
      for (let i = 0; i < this.laserGates.length; i++) {
        const lg = this.laserGates[i];
        const sx = lg.x - cameraX;
        if (sx < -30 || sx > WIDTH + 30) continue;

        ctx.fillStyle = '#334155';
        ctx.fillRect(sx - 12, lg.y1 - 8, 24, 12);
        ctx.fillRect(sx - 12, lg.y2 - 4, 24, 12);

        if (lg.active) {
          ns.drawGlow(ctx, sx, (lg.y1 + lg.y2) * 0.5, 65, 'red', 0.6);
          ctx.fillStyle = '#ff1744';
          ctx.fillRect(sx - 4, lg.y1, 8, lg.y2 - lg.y1);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx - 1.5, lg.y1, 3, lg.y2 - lg.y1);
        } else if (lg.warning) {
          ctx.strokeStyle = 'rgba(255, 23, 68, 0.55)';
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.moveTo(sx, lg.y1);
          ctx.lineTo(sx, lg.y2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 5) Water Rivers & Lethal Molten Lava / Acid Pools
      for (let i = 0; i < this.waterZones.length; i++) {
        const wz = this.waterZones[i];
        const x1 = Math.max(0, wz.x1 - cameraX);
        const x2 = Math.min(WIDTH, wz.x2 - cameraX);
        if (x2 <= x1) continue;

        ctx.fillStyle = 'rgba(2, 132, 199, 0.62)';
        ctx.fillRect(x1, wz.surfaceY, x2 - x1, HEIGHT - wz.surfaceY);
        ctx.fillStyle = '#7dd3fc';
        ctx.fillRect(x1, wz.surfaceY, x2 - x1, 5);
      }

      for (let i = 0; i < this.lavaZones.length; i++) {
        const lz = this.lavaZones[i];
        const x1 = Math.max(0, lz.x1 - cameraX);
        const x2 = Math.min(WIDTH, lz.x2 - cameraX);
        if (x2 <= x1) continue;

        ctx.fillStyle = lz.isAcid ? 'rgba(118, 255, 3, 0.72)' : 'rgba(213, 0, 0, 0.85)';
        ctx.fillRect(x1, lz.surfaceY, x2 - x1, HEIGHT - lz.surfaceY);
        ctx.fillStyle = lz.isAcid ? '#ccff90' : '#ffab00';
        const wave = Math.sin(frameCount * 0.12) * 3;
        ctx.fillRect(x1, lz.surfaceY + wave, x2 - x1, 7);
      }
    }

    _drawHDLedge(ctx, sx, y, w) {
      if (this.theme === 'jungle') {
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(sx, y + 8, w, 18);
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(sx - 3, y, w + 6, 12);
        ctx.fillStyle = '#69f0ae';
        ctx.fillRect(sx - 2, y, w + 4, 4);
      } else if (this.theme === 'arctic') {
        ctx.fillStyle = '#334155';
        ctx.fillRect(sx, y + 6, w, 16);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(sx - 2, y, w + 4, 9);
      } else if (this.theme === 'hive') {
        ctx.fillStyle = '#4a148c';
        ctx.fillRect(sx, y, w, 20);
        ctx.fillStyle = '#ea80fc';
        ctx.fillRect(sx, y, w, 5);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx, y, w, 20);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(sx, y, w, 5);
      }
    }

    _drawHDCliff(ctx, sx, y, w, h) {
      if (this.theme === 'jungle') {
        ctx.fillStyle = '#271811';
        ctx.fillRect(sx, y + 10, w, h);
        ctx.fillStyle = '#4e342e';
        for (let ry = y + 18; ry < y + h; ry += 42) {
          for (let rx = 8; rx < w - 24; rx += 64) {
            ctx.fillRect(sx + rx, ry, Math.min(52, w - rx - 8), 30);
          }
        }
        this._drawHDLedge(ctx, sx, y, w);
      } else if (this.theme === 'cyber' || this.theme === 'arctic') {
        ctx.fillStyle = this.theme === 'arctic' ? '#1e293b' : '#0f172a';
        ctx.fillRect(sx, y, w, h);
        ctx.strokeStyle = this.theme === 'arctic' ? '#38bdf8' : '#334155';
        ctx.lineWidth = 2;
        for (let ry = y + 26; ry < y + h; ry += 48) {
          ctx.strokeRect(sx + 8, ry, Math.max(8, w - 16), 36);
        }
        this._drawHDLedge(ctx, sx, y, w);
      } else if (this.theme === 'volcano') {
        ctx.fillStyle = '#1c0a08';
        ctx.fillRect(sx, y, w, h);
        ctx.fillStyle = '#3e1610';
        for (let rx = 10; rx < w - 24; rx += 54) {
          ctx.fillRect(sx + rx, y + 14, 38, h - 14);
        }
        ctx.fillStyle = '#ff6d00';
        ctx.fillRect(sx, y, w, 6);
      } else {
        ctx.fillStyle = '#19062b';
        ctx.fillRect(sx, y, w, h);
        ctx.fillStyle = '#380e5e';
        for (let ry = y + 20; ry < y + h; ry += 38) {
          ctx.fillRect(sx + 6, ry, Math.max(8, w - 12), 20);
        }
        this._drawHDLedge(ctx, sx, y, w);
      }
    }
  }

  ns.Level = Level;
})(window.Contra);
