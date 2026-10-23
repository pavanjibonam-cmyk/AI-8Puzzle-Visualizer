(function (root) {
  const P = root.Puzzle;
  const SIZE = P.SIZE;

  function esc(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function mini(state, opts) {
    const o = opts || {};
    const goal = o.goal || null;
    let cells = '';
    for (let i = 0; i < P.CELLS; i++) {
      const ch = state[i];
      if (ch === P.BLANK) {
        cells += '<span class="mc mc-blank" aria-hidden="true"></span>';
      } else {
        const ok = goal && goal[i] === ch ? ' mc-ok' : '';
        cells += `<span class="mc${ok}">${ch}</span>`;
      }
    }
    const label = `Board ${P.compact(state)}`;
    const cls = ['mini'];
    if (o.size) cls.push(`mini-${o.size}`);
    if (o.className) cls.push(o.className);
    return `<span class="${cls.join(' ')}" role="img" aria-label="${esc(label)}">${cells}</span>`;
  }

  class LiveBoard {
    constructor(el, opts) {
      this.el = el;
      this.goal = (opts && opts.goal) || null;
      this.state = null;
      this.tiles = {};
      el.classList.add('board');
      el.setAttribute('role', 'img');
      const frag = document.createDocumentFragment();
      for (let i = 0; i < P.CELLS; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.setAttribute('aria-hidden', 'true');
        frag.appendChild(slot);
      }
      this.slots = Array.from(frag.children);
      for (let t = 1; t < P.CELLS; t++) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.textContent = String(t);
        tile.setAttribute('aria-hidden', 'true');
        this.tiles[t] = tile;
        frag.appendChild(tile);
      }
      el.appendChild(frag);
    }

    setGoal(goal) {
      this.goal = goal;
      if (this.state) this.paint();
    }

    isSingleSlide(prev, next) {
      if (!prev) return false;
      let diff = 0;
      for (let i = 0; i < P.CELLS; i++) if (prev[i] !== next[i]) diff++;
      return diff === 2 && prev.indexOf(P.BLANK) !== next.indexOf(P.BLANK);
    }

    paint() {
      const state = this.state;
      for (let t = 1; t < P.CELLS; t++) {
        const idx = state.indexOf(String(t));
        const row = Math.floor(idx / SIZE);
        const col = idx % SIZE;
        const tile = this.tiles[t];
        tile.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
        tile.classList.toggle('tile-ok', !!this.goal && this.goal[idx] === String(t));
      }
      const blank = state.indexOf(P.BLANK);
      this.slots.forEach((slot, i) => slot.classList.toggle('slot-blank', i === blank));
      this.el.setAttribute('aria-label', `Board ${P.compact(state)}`);
    }

    set(state, animate) {
      if (state === this.state) return;
      const slide = animate !== false && this.isSingleSlide(this.state, state);
      if (!slide && this.state) {
        this.el.classList.add('no-trans');
        this.state = state;
        this.paint();
        void this.el.offsetWidth;
        this.el.classList.remove('no-trans');
        this.el.classList.remove('flash');
        void this.el.offsetWidth;
        this.el.classList.add('flash');
      } else {
        if (!this.state) this.el.classList.add('no-trans');
        this.state = state;
        this.paint();
        if (this.el.classList.contains('no-trans')) {
          void this.el.offsetWidth;
          this.el.classList.remove('no-trans');
        }
      }
    }

    setSpeed(ms) {
      this.el.style.setProperty('--tile-ms', `${ms}ms`);
    }
  }

  root.BoardView = { mini, LiveBoard, esc };
})(typeof globalThis !== 'undefined' ? globalThis : this);
