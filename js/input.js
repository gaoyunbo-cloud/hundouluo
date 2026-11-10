// ============================================================================
// CONTRA: SHATTERED OPS HD - Tactical Input Manager (1P/2P/Gamepad/Konami)
// ============================================================================
window.Contra = window.Contra || {};

(function (ns) {
  'use strict';

  const KONAMI_ARROWS = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA'
  ];

  const KONAMI_WASD = [
    'KeyW', 'KeyW', 'KeyS', 'KeyS',
    'KeyA', 'KeyD', 'KeyA', 'KeyD',
    'KeyJ', 'KeyK'
  ];

  class InputManager {
    constructor() {
      this.down = Object.create(null);
      this.pressedQueue = Object.create(null);
      this.framePressed = Object.create(null);

      this.bufArrows = [];
      this.bufWasd = [];
      this.onKonami = null;
      this.onAnyInteraction = null;

      this.twoPlayerMode = false;
      this.touch = {
        left: false, right: false, up: false, down: false,
        fire: false, jump: false, dash: false, grenade: false, swap: false
      };
      this._prevTouch = Object.assign({}, this.touch);
      this._bound = false;
    }

    bind() {
      if (this._bound || typeof window === 'undefined') return;
      this._bound = true;

      const preventCodes = new Set([
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'
      ]);

      window.addEventListener('keydown', (e) => {
        if (this.onAnyInteraction) this.onAnyInteraction();
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (preventCodes.has(e.code)) e.preventDefault();
        const code = e.code;
        if (!this.down[code]) {
          this.pressedQueue[code] = true;
          this._checkKonami(code);
        }
        this.down[code] = true;
      }, { passive: false });

      window.addEventListener('keyup', (e) => {
        this.down[e.code] = false;
      });

      window.addEventListener('blur', () => {
        this.down = Object.create(null);
        this.pressedQueue = Object.create(null);
      });
    }

    _checkKonami(code) {
      this.bufArrows.push(code);
      if (this.bufArrows.length > KONAMI_ARROWS.length) this.bufArrows.shift();
      this.bufWasd.push(code);
      if (this.bufWasd.length > KONAMI_WASD.length) this.bufWasd.shift();

      const matchA = KONAMI_ARROWS.every((k, i) => this.bufArrows[i] === k);
      const matchW = KONAMI_WASD.every((k, i) => this.bufWasd[i] === k);
      if ((matchA || matchW) && this.onKonami) {
        this.bufArrows = [];
        this.bufWasd = [];
        this.onKonami();
      }
    }

    pollFrame() {
      this.framePressed = this.pressedQueue;
      this.pressedQueue = Object.create(null);
      this._touchPressed = {
        fire: this.touch.fire && !this._prevTouch.fire,
        jump: this.touch.jump && !this._prevTouch.jump,
        dash: this.touch.dash && !this._prevTouch.dash,
        grenade: this.touch.grenade && !this._prevTouch.grenade,
        swap: this.touch.swap && !this._prevTouch.swap
      };
      this._prevTouch = Object.assign({}, this.touch);
      this._pollGamepads();
    }

    _pollGamepads() {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
      let pads;
      try {
        pads = navigator.getGamepads();
      } catch (e) {
        return;
      }
      if (!pads) return;
      this._padStates = [];
      for (let i = 0; i < 2; i++) {
        const gp = pads[i];
        if (!gp || !gp.connected) {
          this._padStates[i] = null;
          continue;
        }
        const axX = gp.axes[0] || 0;
        const axY = gp.axes[1] || 0;
        const b = (idx) => !!(gp.buttons[idx] && gp.buttons[idx].pressed);

        const st = {
          left: b(14) || axX < -0.4,
          right: b(15) || axX > 0.4,
          up: b(12) || axY < -0.4,
          down: b(13) || axY > 0.4,
          jump: b(0),                 // A / Cross
          dash: b(1) || b(5),         // B / RB
          fire: b(2) || b(7),         // X / RT
          grenade: b(3),              // Y / Triangle
          swap: b(4),                 // LB
          start: b(9)
        };
        const prev = (this._prevPadStates && this._prevPadStates[i]) || {};
        st.jumpPressed = st.jump && !prev.jump;
        st.firePressed = st.fire && !prev.fire;
        st.dashPressed = st.dash && !prev.dash;
        st.grenadePressed = st.grenade && !prev.grenade;
        st.swapPressed = st.swap && !prev.swap;
        st.startPressed = st.start && !prev.start;
        st.upPressed = st.up && !prev.up;
        st.downPressed = st.down && !prev.down;
        st.leftPressed = st.left && !prev.left;
        st.rightPressed = st.right && !prev.right;
        this._padStates[i] = st;
      }
      this._prevPadStates = this._padStates.map((s) => (s ? Object.assign({}, s) : null));
    }

    isDown(code) { return !!this.down[code]; }
    justPressed(code) { return !!this.framePressed[code]; }

    anyDown(codes) {
      for (let i = 0; i < codes.length; i++) if (this.down[codes[i]]) return true;
      return false;
    }

    anyJustPressed(codes) {
      for (let i = 0; i < codes.length; i++) if (this.framePressed[codes[i]]) return true;
      return false;
    }

    // Full ergonomic single-machine input (WASD + Arrows + Gamepad0 + Touch)
    // Used by Single-Player 1P, Online Host 1P, AND Online Guest 2P on their own device!
    getLocalPrimaryInput() {
      const gp = (this._padStates && this._padStates[0]) || null;
      const tp = this._touchPressed || {};
      const tc = this.touch;

      const leftK = ['KeyA', 'ArrowLeft'];
      const rightK = ['KeyD', 'ArrowRight'];
      const upK = ['KeyW', 'ArrowUp'];
      const downK = ['KeyS', 'ArrowDown'];
      const fireK = ['KeyJ', 'KeyZ'];
      const jumpK = ['KeyK', 'KeyX', 'Space'];
      const dashK = ['KeyL', 'ShiftLeft', 'ShiftRight', 'KeyC'];
      const grenK = ['KeyI', 'KeyU', 'KeyG'];
      const swapK = ['KeyQ', 'KeyE'];

      return {
        left: this.anyDown(leftK) || !!(gp && gp.left) || tc.left,
        right: this.anyDown(rightK) || !!(gp && gp.right) || tc.right,
        up: this.anyDown(upK) || !!(gp && gp.up) || tc.up,
        down: this.anyDown(downK) || !!(gp && gp.down) || tc.down,
        fire: this.anyDown(fireK) || !!(gp && gp.fire) || tc.fire,
        jump: this.anyDown(jumpK) || !!(gp && gp.jump) || tc.jump,
        firePressed: this.anyJustPressed(fireK) || !!(gp && gp.firePressed) || !!tp.fire,
        jumpPressed: this.anyJustPressed(jumpK) || !!(gp && gp.jumpPressed) || !!tp.jump,
        dashPressed: this.anyJustPressed(dashK) || !!(gp && gp.dashPressed) || !!tp.dash,
        grenadePressed: this.anyJustPressed(grenK) || !!(gp && gp.grenadePressed) || !!tp.grenade,
        swapPressed: this.anyJustPressed(swapK) || !!(gp && gp.swapPressed) || !!tp.swap
      };
    }

    getPlayerInput(playerIndex) {
      const gp = (this._padStates && this._padStates[playerIndex]) || null;

      if (!this.twoPlayerMode && playerIndex === 0) {
        return this.getLocalPrimaryInput();
      }

      if (playerIndex === 0) {
        const fireK = ['KeyJ'];
        const jumpK = ['KeyK', 'Space'];
        const dashK = ['KeyL', 'ShiftLeft'];
        const grenK = ['KeyI', 'KeyU', 'KeyG'];
        const swapK = ['KeyQ', 'KeyE'];
        return {
          left: this.isDown('KeyA') || !!(gp && gp.left),
          right: this.isDown('KeyD') || !!(gp && gp.right),
          up: this.isDown('KeyW') || !!(gp && gp.up),
          down: this.isDown('KeyS') || !!(gp && gp.down),
          fire: this.anyDown(fireK) || !!(gp && gp.fire),
          jump: this.anyDown(jumpK) || !!(gp && gp.jump),
          firePressed: this.anyJustPressed(fireK) || !!(gp && gp.firePressed),
          jumpPressed: this.anyJustPressed(jumpK) || !!(gp && gp.jumpPressed),
          dashPressed: this.anyJustPressed(dashK) || !!(gp && gp.dashPressed),
          grenadePressed: this.anyJustPressed(grenK) || !!(gp && gp.grenadePressed),
          swapPressed: this.anyJustPressed(swapK) || !!(gp && gp.swapPressed)
        };
      }

      // 2P Mode - Player 2
      const p2Fire = ['Digit1', 'Numpad1', 'Comma', 'KeyZ'];
      const p2Jump = ['Digit2', 'Numpad2', 'Period', 'KeyX'];
      const p2Dash = ['Digit3', 'Numpad3', 'Slash', 'ShiftRight'];
      const p2Gren = ['Digit4', 'Numpad4', 'Semicolon'];
      const p2Swap = ['Digit0', 'Numpad0', 'Quote'];

      return {
        left: this.isDown('ArrowLeft') || !!(gp && gp.left),
        right: this.isDown('ArrowRight') || !!(gp && gp.right),
        up: this.isDown('ArrowUp') || !!(gp && gp.up),
        down: this.isDown('ArrowDown') || !!(gp && gp.down),
        fire: this.anyDown(p2Fire) || !!(gp && gp.fire),
        jump: this.anyDown(p2Jump) || !!(gp && gp.jump),
        firePressed: this.anyJustPressed(p2Fire) || !!(gp && gp.firePressed),
        jumpPressed: this.anyJustPressed(p2Jump) || !!(gp && gp.jumpPressed),
        dashPressed: this.anyJustPressed(p2Dash) || !!(gp && gp.dashPressed),
        grenadePressed: this.anyJustPressed(p2Gren) || !!(gp && gp.grenadePressed),
        swapPressed: this.anyJustPressed(p2Swap) || !!(gp && gp.swapPressed)
      };
    }

    menuUpPressed() {
      const gp0 = this._padStates && this._padStates[0];
      return this.anyJustPressed(['ArrowUp', 'KeyW']) || !!(gp0 && gp0.upPressed);
    }

    menuDownPressed() {
      const gp0 = this._padStates && this._padStates[0];
      return this.anyJustPressed(['ArrowDown', 'KeyS']) || !!(gp0 && gp0.downPressed);
    }

    menuLeftPressed() {
      const gp0 = this._padStates && this._padStates[0];
      return this.anyJustPressed(['ArrowLeft', 'KeyA']) || !!(gp0 && gp0.leftPressed);
    }

    menuRightPressed() {
      const gp0 = this._padStates && this._padStates[0];
      return this.anyJustPressed(['ArrowRight', 'KeyD']) || !!(gp0 && gp0.rightPressed);
    }

    startPressed() {
      const gp0 = this._padStates && this._padStates[0];
      return this.anyJustPressed(['Enter', 'Space', 'KeyJ', 'KeyZ']) || !!(gp0 && gp0.startPressed);
    }

    pausePressed() {
      const gp0 = this._padStates && this._padStates[0];
      return this.anyJustPressed(['KeyP', 'Escape']) || !!(gp0 && gp0.startPressed);
    }
  }

  ns.input = new InputManager();
})(window.Contra);
