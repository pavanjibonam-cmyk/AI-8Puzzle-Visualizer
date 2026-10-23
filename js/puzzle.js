(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Puzzle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SIZE = 3;
  const CELLS = SIZE * SIZE;
  const BLANK = '0';

  const MOVES = {
    U: { dr: -1, dc: 0, name: 'Up', arrow: '↑' },
    D: { dr: 1, dc: 0, name: 'Down', arrow: '↓' },
    L: { dr: 0, dc: -1, name: 'Left', arrow: '←' },
    R: { dr: 0, dc: 1, name: 'Right', arrow: '→' }
  };

  const ORDERS = ['UDLR', 'URDL', 'LRUD', 'RLDU', 'DRUL', 'ULDR'];
  const DEFAULT_ORDER = 'UDLR';
  const STANDARD_GOAL = '123456780';
  const SNAIL_GOAL = '123804765';
  const EXAMPLE_START = '283164705';

  const NEIGHBOR = [];
  for (let i = 0; i < CELLS; i++) {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    const row = {};
    for (const key of Object.keys(MOVES)) {
      const nr = r + MOVES[key].dr;
      const nc = c + MOVES[key].dc;
      row[key] = nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE ? nr * SIZE + nc : -1;
    }
    NEIGHBOR.push(row);
  }

  const OPPOSITE = { U: 'D', D: 'U', L: 'R', R: 'L' };

  function isValidState(state) {
    if (typeof state !== 'string' || state.length !== CELLS) return false;
    const seen = new Set(state);
    if (seen.size !== CELLS) return false;
    for (let d = 0; d < CELLS; d++) if (!seen.has(String(d))) return false;
    return true;
  }

  function swap(state, i, j) {
    const a = state.split('');
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
    return a.join('');
  }

  function successors(state, order) {
    const seq = order && ORDERS.includes(order) ? order : DEFAULT_ORDER;
    const blank = state.indexOf(BLANK);
    const out = [];
    for (const move of seq) {
      const target = NEIGHBOR[blank][move];
      if (target < 0) continue;
      out.push({ state: swap(state, blank, target), move, tile: state[target] });
    }
    return out;
  }

  function applyMove(state, move) {
    const blank = state.indexOf(BLANK);
    const target = NEIGHBOR[blank][move];
    if (target < 0) return null;
    return swap(state, blank, target);
  }

  function applyMoves(state, moves) {
    const states = [state];
    let cur = state;
    for (const m of moves) {
      cur = applyMove(cur, m);
      if (cur === null) return null;
      states.push(cur);
    }
    return states;
  }

  function moveBetween(a, b) {
    for (const s of successors(a, DEFAULT_ORDER)) if (s.state === b) return s.move;
    return null;
  }

  function inversions(state) {
    const tiles = state.split('').filter(ch => ch !== BLANK).map(Number);
    let count = 0;
    for (let i = 0; i < tiles.length; i++)
      for (let j = i + 1; j < tiles.length; j++)
        if (tiles[i] > tiles[j]) count++;
    return count;
  }

  function isSolvable(start, goal) {
    return inversions(start) % 2 === inversions(goal) % 2;
  }

  function parse(text) {
    if (typeof text !== 'string') return { ok: false, error: 'Input must be text.' };
    const cleaned = text.trim().replace(/[,;|]/g, ' ');
    let tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length !== CELLS) {
      const compact = cleaned.replace(/\s+/g, '');
      if (compact.length === CELLS) tokens = compact.split('');
    }
    if (tokens.length !== CELLS) return { ok: false, error: 'Enter exactly 9 cells: tiles 1–8 and one blank (_ or 0).' };
    const normalized = tokens.map(t => (/^[_0bBxX.\-]$/.test(t) ? BLANK : t));
    for (const t of normalized) if (!/^[0-8]$/.test(t)) return { ok: false, error: `"${t}" is not a valid tile. Use 1–8 and _ for the blank.` };
    const state = normalized.join('');
    if (!isValidState(state)) {
      const counts = {};
      for (const ch of state) counts[ch] = (counts[ch] || 0) + 1;
      const dup = Object.keys(counts).find(k => counts[k] > 1);
      const label = dup === BLANK ? 'blank' : `tile ${dup}`;
      return { ok: false, error: `Each tile must appear exactly once (${label} is repeated).` };
    }
    return { ok: true, state };
  }

  function format(state, blankChar) {
    const b = blankChar === undefined ? '_' : blankChar;
    const rows = [];
    for (let r = 0; r < SIZE; r++)
      rows.push(state.slice(r * SIZE, r * SIZE + SIZE).split('').map(ch => (ch === BLANK ? b : ch)).join(' '));
    return rows.join('\n');
  }

  function compact(state) {
    return format(state).split('\n').join(' / ');
  }

  function goalPositions(goal) {
    const pos = new Array(CELLS);
    for (let i = 0; i < CELLS; i++) pos[Number(goal[i])] = i;
    return pos;
  }

  function misplaced(state, goal) {
    let count = 0;
    for (let i = 0; i < CELLS; i++) if (state[i] !== BLANK && state[i] !== goal[i]) count++;
    return count;
  }

  function manhattan(state, goal) {
    const pos = goalPositions(goal);
    let sum = 0;
    for (let i = 0; i < CELLS; i++) {
      const ch = state[i];
      if (ch === BLANK) continue;
      const g = pos[Number(ch)];
      sum += Math.abs(Math.floor(i / SIZE) - Math.floor(g / SIZE)) + Math.abs((i % SIZE) - (g % SIZE));
    }
    return sum;
  }

  const HEURISTICS = {
    manhattan: { id: 'manhattan', name: 'Manhattan Distance', short: 'Manhattan' },
    misplaced: { id: 'misplaced', name: 'Misplaced Tiles', short: 'Misplaced' }
  };

  function makeHeuristic(name, goal) {
    if (name === 'misplaced') return state => misplaced(state, goal);
    const pos = goalPositions(goal);
    const rowOf = pos.map(p => Math.floor(p / SIZE));
    const colOf = pos.map(p => p % SIZE);
    return state => {
      let sum = 0;
      for (let i = 0; i < CELLS; i++) {
        const t = state.charCodeAt(i) - 48;
        if (t === 0) continue;
        const dr = Math.floor(i / SIZE) - rowOf[t];
        const dc = (i % SIZE) - colOf[t];
        sum += (dr < 0 ? -dr : dr) + (dc < 0 ? -dc : dc);
      }
      return sum;
    };
  }

  function makeRng(seed) {
    if (seed === undefined || seed === null) return Math.random;
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomWalk(goal, steps, rng) {
    const rand = rng || Math.random;
    let state = goal;
    let last = null;
    const visited = new Set([goal]);
    let taken = 0;
    let guard = 0;
    while ((taken < steps || state === goal) && guard < steps * 50 + 100) {
      guard++;
      const options = successors(state, DEFAULT_ORDER).filter(s => s.move !== (last ? OPPOSITE[last] : null));
      const fresh = options.filter(s => !visited.has(s.state));
      const pool = fresh.length ? fresh : options;
      const pick = pool[Math.floor(rand() * pool.length)];
      state = pick.state;
      last = pick.move;
      visited.add(state);
      taken++;
    }
    return state;
  }

  function randomSolvable(goal, rng) {
    const rand = rng || Math.random;
    let state = goal;
    while (state === goal) {
      const a = goal.split('');
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
      }
      if (!isSolvable(a.join(''), goal)) {
        const tiles = [];
        for (let i = 0; i < a.length && tiles.length < 2; i++) if (a[i] !== BLANK) tiles.push(i);
        const t = a[tiles[0]];
        a[tiles[0]] = a[tiles[1]];
        a[tiles[1]] = t;
      }
      state = a.join('');
    }
    return state;
  }

  const DIFFICULTIES = {
    easy: { id: 'easy', name: 'Easy (8 scramble moves)', steps: 8 },
    medium: { id: 'medium', name: 'Medium (16 scramble moves)', steps: 16 },
    hard: { id: 'hard', name: 'Hard (28 scramble moves)', steps: 28 },
    random: { id: 'random', name: 'Fully random solvable', steps: null }
  };

  function generate(goal, difficulty, rng) {
    const d = DIFFICULTIES[difficulty] || DIFFICULTIES.medium;
    return d.steps === null ? randomSolvable(goal, rng) : randomWalk(goal, d.steps, rng);
  }

  return {
    SIZE,
    CELLS,
    BLANK,
    MOVES,
    ORDERS,
    DEFAULT_ORDER,
    STANDARD_GOAL,
    SNAIL_GOAL,
    EXAMPLE_START,
    HEURISTICS,
    DIFFICULTIES,
    isValidState,
    successors,
    applyMove,
    applyMoves,
    moveBetween,
    inversions,
    isSolvable,
    parse,
    format,
    compact,
    misplaced,
    manhattan,
    makeHeuristic,
    makeRng,
    randomWalk,
    randomSolvable,
    generate
  };
});
