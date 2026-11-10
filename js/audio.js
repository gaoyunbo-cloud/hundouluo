// ============================================================================
// CONTRA: SHATTERED OPS HD - Multi-Channel Action Synth & Heavy SFX Engine
// ============================================================================
window.Contra = window.Contra || {};

(function (ns) {
  'use strict';

  function mtof(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.noiseBuffer = null;
      this.muted = false;
      this.masterGain = null;
      this.bgmTimer = null;
      this.currentTrack = null;
      this.stepIndex = 0;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.30;
        this.masterGain.connect(this.ctx.destination);

        const sampleRate = this.ctx.sampleRate;
        const length = Math.floor(sampleRate * 1.5);
        this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        let lfsr = 0x7fff;
        for (let i = 0; i < length; i++) {
          if (i % 2 === 0) {
            const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
            lfsr = (lfsr >> 1) | (bit << 14);
          }
          data[i] = ((lfsr & 1) ? 0.8 : -0.8) * 0.7 + (Math.random() * 0.6 - 0.3);
        }
      } catch (e) {
        this.ctx = null;
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.30, this.ctx.currentTime);
      }
      return this.muted;
    }

    playTone(freq, duration, type = 'sawtooth', vol = 0.22, slideTo = null, delay = 0) {
      if (!this.ctx || this.muted) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), now);
      if (slideTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
      }

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    }

    playNoise(duration, filterFreq = 1200, vol = 0.28, filterType = 'bandpass', slideFreq = null, delay = 0) {
      if (!this.ctx || !this.noiseBuffer || this.muted) return;
      const now = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, now);
      if (slideFreq !== null) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, slideFreq), now + duration);
      }

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start(now);
      src.stop(now + duration + 0.01);
    }

    sfx(name) {
      this.init();
      if (!this.ctx || this.muted) return;

      switch (name) {
        case 'shootR':
          this.playNoise(0.05, 2600, 0.22, 'bandpass', 700);
          this.playTone(540, 0.05, 'sawtooth', 0.16, 150);
          break;
        case 'shootM':
          this.playNoise(0.06, 2000, 0.28, 'lowpass', 360);
          this.playTone(380, 0.055, 'sawtooth', 0.22, 95);
          break;
        case 'shootS':
          this.playNoise(0.11, 3200, 0.32, 'bandpass', 500);
          this.playTone(920, 0.09, 'sawtooth', 0.20, 210);
          this.playTone(460, 0.09, 'square', 0.14, 130);
          break;
        case 'shootL':
          this.playTone(1850, 0.14, 'sawtooth', 0.22, 280);
          this.playTone(925, 0.12, 'square', 0.16, 180, 0.015);
          break;
        case 'shootF':
          this.playNoise(0.14, 900, 0.28, 'bandpass', 2500);
          this.playTone(280, 0.12, 'triangle', 0.22, 680);
          break;
        case 'shootC':
          this.playNoise(0.09, 3400, 0.20, 'highpass', 1200);
          this.playTone(620, 0.10, 'triangle', 0.18, 1180);
          break;
        case 'dash':
          this.playNoise(0.11, 2400, 0.24, 'bandpass', 600);
          this.playTone(340, 0.09, 'sine', 0.20, 760);
          break;
        case 'grenadeThrow':
          this.playTone(300, 0.09, 'triangle', 0.18, 620);
          break;
        case 'grenadeBoom':
          this.playNoise(0.55, 850, 0.52, 'lowpass', 60);
          this.playTone(135, 0.42, 'sawtooth', 0.34, 32);
          break;
        case 'shieldBlock':
          this.playTone(1860, 0.05, 'triangle', 0.24, 2900);
          this.playTone(1240, 0.04, 'square', 0.15, 820, 0.02);
          break;
        case 'weaponSwap':
          this.playTone(660, 0.045, 'square', 0.15, 990);
          break;
        case 'hitArmor':
          this.playTone(1360, 0.04, 'square', 0.18, 1980);
          break;
        case 'playerHit':
          this.playNoise(0.18, 1200, 0.34, 'lowpass', 180);
          this.playTone(240, 0.16, 'sawtooth', 0.26, 75);
          break;
        case 'enemyDie':
          this.playNoise(0.15, 1100, 0.28, 'lowpass', 170);
          this.playTone(250, 0.11, 'sawtooth', 0.18, 65);
          break;
        case 'explosion':
          this.playNoise(0.45, 780, 0.46, 'lowpass', 70);
          this.playTone(145, 0.35, 'sawtooth', 0.30, 34);
          break;
        case 'bossExplosion':
          this.playNoise(0.9, 950, 0.56, 'lowpass', 50);
          this.playTone(125, 0.70, 'sawtooth', 0.34, 26);
          this.playNoise(0.6, 520, 0.46, 'lowpass', 42, 0.22);
          break;
        case 'powerupSpawn':
          this.playTone(523, 0.07, 'square', 0.16, 784);
          break;
        case 'powerupPick':
          [523, 659, 784, 1046].forEach((f, idx) => {
            this.playTone(f, 0.08, 'square', 0.22, null, idx * 0.05);
          });
          break;
        case 'weaponUpgrade':
          [587, 740, 880, 1175, 1480].forEach((f, idx) => {
            this.playTone(f, 0.09, 'sawtooth', 0.22, null, idx * 0.048);
          });
          break;
        case 'oneUp':
          [659, 784, 1318, 1046, 1175, 1568].forEach((f, idx) => {
            this.playTone(f, 0.09, 'square', 0.24, null, idx * 0.065);
          });
          break;
        case 'konami':
          [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, idx) => {
            this.playTone(f, 0.1, 'sawtooth', 0.25, null, idx * 0.06);
            this.playTone(f * 0.5, 0.1, 'triangle', 0.22, null, idx * 0.06);
          });
          break;
        case 'playerDie':
          this.playNoise(0.38, 900, 0.36, 'lowpass', 100);
          [440, 392, 330, 262, 196].forEach((f, idx) => {
            this.playTone(f, 0.11, 'sawtooth', 0.25, f * 0.82, idx * 0.075);
          });
          break;
        case 'jump':
          this.playTone(210, 0.08, 'triangle', 0.18, 470);
          break;
        case 'splash':
          this.playNoise(0.15, 1700, 0.20, 'bandpass', 520);
          break;
        case 'menuMove':
          this.playTone(820, 0.04, 'square', 0.15);
          break;
        case 'pause':
          [784, 659, 523, 659].forEach((f, idx) => {
            this.playTone(f, 0.065, 'square', 0.22, null, idx * 0.06);
          });
          break;
      }
    }

    stopBGM() {
      if (this.bgmTimer) {
        clearInterval(this.bgmTimer);
        this.bgmTimer = null;
      }
      this.currentTrack = null;
    }

    playTitleFanfare() {
      this.init();
      this.stopBGM();
      if (!this.ctx || this.muted) return;
      const notes = [
        [62, 0.00, 0.13], [62, 0.15, 0.13], [65, 0.30, 0.14],
        [69, 0.46, 0.24], [67, 0.72, 0.16], [72, 0.90, 0.32],
        [74, 1.25, 0.55]
      ];
      notes.forEach(([n, t, d]) => {
        this.playTone(mtof(n), d, 'sawtooth', 0.22, null, t);
        this.playTone(mtof(n - 12), d, 'triangle', 0.24, null, t);
      });
      this.playNoise(0.3, 850, 0.3, 'lowpass', 110, 1.25);
    }

    playStageClear() {
      this.init();
      this.stopBGM();
      if (!this.ctx || this.muted) return;
      const seq = [
        [60, 0.00, 0.12], [64, 0.13, 0.12], [67, 0.26, 0.12],
        [72, 0.40, 0.24], [67, 0.66, 0.12], [72, 0.80, 0.55]
      ];
      seq.forEach(([n, t, d]) => {
        this.playTone(mtof(n), d, 'sawtooth', 0.23, null, t);
        this.playTone(mtof(n - 12), d, 'triangle', 0.22, null, t);
      });
    }

    playGameOver() {
      this.init();
      this.stopBGM();
      if (!this.ctx || this.muted) return;
      const seq = [
        [64, 0.00, 0.20], [62, 0.22, 0.20], [60, 0.44, 0.22],
        [59, 0.68, 0.24], [57, 0.95, 0.60]
      ];
      seq.forEach(([n, t, d]) => {
        this.playTone(mtof(n), d, 'sawtooth', 0.22, null, t);
        this.playTone(mtof(n - 12), d, 'triangle', 0.24, null, t);
      });
    }

    startBGM(trackName) {
      this.init();
      if (this.currentTrack === trackName && this.bgmTimer) return;
      this.stopBGM();
      this.currentTrack = trackName;
      this.stepIndex = 0;

      const tracks = {
        jungle: {
          stepMs: 108,
          lead: [69,0,72,0,74,0,76,74,72,0,69,0,67,0,69,0, 69,0,72,0,76,0,79,76,74,0,72,0,74,0,0,0],
          bass: [45,45,0,45,57,45,0,45,43,43,0,43,55,43,45,0, 45,45,0,45,57,45,0,45,41,41,43,43,45,45,33,0],
          drum: ['K','.','H','.','S','.','H','K','.','K','H','.','S','.','H','H', 'K','.','H','.','S','.','H','K','K','.','S','H','K','S','H','.']
        },
        cyber: {
          stepMs: 102,
          lead: [64,64,67,0,71,0,69,67,64,0,62,0,64,67,71,0, 64,64,72,0,71,0,69,67,66,0,69,0,67,0,0,0],
          bass: [40,52,40,52,40,52,43,55,38,50,38,50,40,52,43,55, 40,52,40,52,45,57,43,55,42,54,42,54,40,40,35,0],
          drum: ['K','H','S','H','K','H','S','H','K','K','S','H','K','H','S','S', 'K','H','S','H','K','K','S','H','K','S','K','S','K','S','H','S']
        },
        arctic: {
          stepMs: 106,
          lead: [71,0,74,0,76,74,71,0,69,0,71,74,72,0,69,0, 71,0,76,0,78,76,74,71,72,0,71,69,71,0,0,0],
          bass: [47,47,59,47,47,47,59,47,45,45,57,45,43,43,55,43, 47,47,59,47,50,50,49,49,48,48,45,45,47,47,35,0],
          drum: ['K','.','H','H','S','.','H','K','K','.','H','H','S','.','H','S', 'K','.','H','H','S','.','H','K','K','S','H','K','S','S','H','.']
        },
        volcano: {
          stepMs: 96,
          lead: [62,65,68,65,62,0,67,65,62,65,68,70,68,0,65,0, 62,65,70,68,74,0,73,70,68,67,65,64,62,0,0,0],
          bass: [38,38,38,50,38,38,41,40,38,38,38,50,44,44,41,41, 38,38,38,50,43,43,41,41,40,40,39,39,38,38,38,0],
          drum: ['K','K','S','H','K','K','S','H','K','K','S','K','K','S','S','H', 'K','K','S','H','K','K','S','H','K','S','K','S','K','S','S','S']
        },
        hive: {
          stepMs: 100,
          lead: [64,0,65,64,60,0,64,0,68,0,65,64,62,0,0,0, 64,0,71,68,65,0,72,0,71,68,65,64,65,0,0,0],
          bass: [40,40,52,40,41,41,53,41,40,40,52,40,38,38,43,43, 40,40,52,40,44,44,56,44,45,43,41,40,38,38,40,0],
          drum: ['K','H','S','H','K','K','S','H','K','H','S','H','K','S','H','S', 'K','H','S','H','K','K','S','H','K','S','K','S','K','S','S','H']
        },
        boss: {
          stepMs: 88,
          lead: [62,65,68,0,62,65,70,0,62,65,68,65,64,0,61,0, 62,65,68,0,74,73,70,68,67,65,64,62,61,0,69,0],
          bass: [38,38,50,38,38,38,50,38,39,39,51,39,37,37,49,37, 38,38,50,38,41,41,40,40,39,39,38,38,37,37,45,37],
          drum: ['K','H','S','H','K','H','S','K','K','H','S','H','K','S','K','S', 'K','H','S','H','K','K','S','H','K','S','K','S','K','S','S','S']
        }
      };

      const t = tracks[trackName] || tracks.jungle;
      const stepSec = t.stepMs / 1000;

      this.bgmTimer = setInterval(() => {
        if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
        const i = this.stepIndex % t.lead.length;
        const lNote = t.lead[i];
        const bNote = t.bass[i];
        const dHit = t.drum[i];

        if (lNote > 0) {
          this.playTone(mtof(lNote), stepSec * 0.9, 'sawtooth', 0.095);
          this.playTone(mtof(lNote - 5), stepSec * 0.8, 'square', 0.045);
        }
        if (bNote > 0) {
          this.playTone(mtof(bNote), stepSec * 0.95, 'triangle', 0.17);
        }
        if (dHit === 'K') {
          this.playTone(120, 0.06, 'sine', 0.22, 36);
        } else if (dHit === 'S') {
          this.playNoise(0.08, 1600, 0.13, 'bandpass', 650);
        } else if (dHit === 'H') {
          this.playNoise(0.03, 5500, 0.05, 'highpass');
        }
        this.stepIndex++;
      }, t.stepMs);
    }
  }

  ns.audio = new SoundEngine();
})(window.Contra);
