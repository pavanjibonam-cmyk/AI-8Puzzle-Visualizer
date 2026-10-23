const assert = require('assert');
const P = require('../js/puzzle.js');
const A = require('../js/algorithms.js');
const MinHeap = require('../js/heap.js');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}

function bfsDistance(start, goal) {
  if (start === goal) return 0;
  const dist = new Map([[start, 0]]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (const c of P.successors(s)) {
        if (!dist.has(c.state)) {
          dist.set(c.state, dist.get(s) + 1);
          if (c.state === goal) return dist.get(c.state);
          next.push(c.state);
        }
      }
    }
    frontier = next;
  }
  return -1;
}

function farthestFrom(goal) {
  const dist = new Map([[goal, 0]]);
  let frontier = [goal];
  let last = goal;
  while (frontier.length) {
    const next = [];
    for (const st of frontier)
      for (const c of P.successors(st))
        if (!dist.has(c.state)) {
          dist.set(c.state, dist.get(st) + 1);
          next.push(c.state);
        }
    if (next.length) last = next[0];
    frontier = next;
  }
  return { state: last, depth: dist.get(last) };
}

function validatePath(result, start, goal) {
  assert.strictEqual(result.found, true, 'expected a solution');
  assert.strictEqual(result.states.length, result.moves.length + 1);
  assert.strictEqual(result.states[0], start);
  assert.strictEqual(result.states[result.states.length - 1], goal);
  let cur = start;
  for (let i = 0; i < result.moves.length; i++) {
    const nxt = P.applyMove(cur, result.moves[i]);
    assert.notStrictEqual(nxt, null, `illegal move at step ${i}`);
    assert.strictEqual(nxt, result.states[i + 1]);
    cur = nxt;
  }
  assert.strictEqual(cur, goal);
  assert.strictEqual(result.pathCost, result.moves.length);
}

console.log('Puzzle model');

test('successors respect board edges', () => {
  assert.strictEqual(P.successors('123456780').length, 2);
  assert.strictEqual(P.successors('123406785').length, 4);
  assert.strictEqual(P.successors('102345678').length, 3);
  assert.strictEqual(P.successors('120345678').length, 2);
});

test('successors use requested order', () => {
  const m = P.successors('123406785', 'LRUD').map(s => s.move).join('');
  assert.strictEqual(m, 'LRUD');
});

test('applyMove is reversible', () => {
  const s = P.EXAMPLE_START;
  for (const c of P.successors(s)) {
    const back = P.applyMove(c.state, { U: 'D', D: 'U', L: 'R', R: 'L' }[c.move]);
    assert.strictEqual(back, s);
  }
});

test('parse accepts spaces, commas, compact and underscore', () => {
  assert.strictEqual(P.parse('2 8 3 1 6 4 7 _ 5').state, '283164705');
  assert.strictEqual(P.parse('2,8,3,1,6,4,7,0,5').state, '283164705');
  assert.strictEqual(P.parse('283164705').state, '283164705');
  assert.strictEqual(P.parse('283 164 7_5').state, '283164705');
  assert.strictEqual(P.parse('2 8 3\n1 6 4\n7 _ 5').state, '283164705');
});

test('parse rejects bad input', () => {
  assert.strictEqual(P.parse('').ok, false);
  assert.strictEqual(P.parse('1 2 3 4 5 6 7 8').ok, false);
  assert.strictEqual(P.parse('1 2 3 4 5 6 7 8 9').ok, false);
  assert.strictEqual(P.parse('1 1 3 4 5 6 7 8 _').ok, false);
  assert.strictEqual(P.parse('1 2 3 4 5 6 7 _ _').ok, false);
  assert.strictEqual(P.parse('a b c d e f g h i').ok, false);
});

test('isValidState', () => {
  assert.ok(P.isValidState('123456780'));
  assert.ok(!P.isValidState('123456788'));
  assert.ok(!P.isValidState('12345678'));
  assert.ok(!P.isValidState('1234567890'));
  assert.ok(!P.isValidState(null));
});

test('solvability matches exhaustive reachability from both goals', () => {
  for (const goal of [P.STANDARD_GOAL, P.SNAIL_GOAL]) {
    const reach = new Set([goal]);
    let frontier = [goal];
    while (frontier.length) {
      const next = [];
      for (const s of frontier)
        for (const c of P.successors(s))
          if (!reach.has(c.state)) {
            reach.add(c.state);
            next.push(c.state);
          }
      frontier = next;
    }
    assert.strictEqual(reach.size, 181440);
    const perm = [];
    const digits = '012345678'.split('');
    (function gen(arr, rest) {
      if (!rest.length) return perm.push(arr.join(''));
      for (let i = 0; i < rest.length; i++) gen(arr.concat(rest[i]), rest.slice(0, i).concat(rest.slice(i + 1)));
    })([], digits);
    assert.strictEqual(perm.length, 362880);
    let mismatches = 0;
    for (const p of perm) if (reach.has(p) !== P.isSolvable(p, goal)) mismatches++;
    assert.strictEqual(mismatches, 0);
  }
});

test('example from the brief is solvable, swapped tiles are not', () => {
  assert.ok(P.isSolvable('283164705', P.SNAIL_GOAL));
  assert.ok(!P.isSolvable('213456780', P.STANDARD_GOAL));
  assert.ok(!P.isSolvable('123456870', P.STANDARD_GOAL));
});

test('random generation is always solvable and never the goal', () => {
  const goals = [P.STANDARD_GOAL, P.SNAIL_GOAL, '876543210', '102345678'];
  for (const goal of goals) {
    for (const diff of Object.keys(P.DIFFICULTIES)) {
      const rng = P.makeRng(7 + goal.length);
      for (let i = 0; i < 150; i++) {
        const s = P.generate(goal, diff, rng);
        assert.ok(P.isValidState(s));
        assert.ok(P.isSolvable(s, goal), `${diff} gave unsolvable ${s} for ${goal}`);
        assert.notStrictEqual(s, goal);
      }
    }
  }
});

test('random generation without seed works', () => {
  for (let i = 0; i < 100; i++) {
    const s = P.generate(P.SNAIL_GOAL, 'medium');
    assert.ok(P.isSolvable(s, P.SNAIL_GOAL));
  }
});

test('difficulty levels scale with true solution depth', () => {
  const rng = P.makeRng(99);
  const avg = d => {
    let sum = 0;
    for (let i = 0; i < 60; i++) sum += bfsDistance(P.generate(P.STANDARD_GOAL, d, rng), P.STANDARD_GOAL);
    return sum / 60;
  };
  const e = avg('easy');
  const m = avg('medium');
  const h = avg('hard');
  assert.ok(e < m && m < h, `expected increasing depth, got ${e} ${m} ${h}`);
});

test('heuristics: values and admissibility spot-check', () => {
  assert.strictEqual(P.manhattan('123456780', '123456780'), 0);
  assert.strictEqual(P.misplaced('123456780', '123456780'), 0);
  assert.strictEqual(P.manhattan('283164705', P.SNAIL_GOAL), 5);
  assert.strictEqual(P.misplaced('283164705', P.SNAIL_GOAL), 4);
  const rng = P.makeRng(5);
  for (let i = 0; i < 120; i++) {
    const s = P.generate(P.SNAIL_GOAL, 'medium', rng);
    const d = bfsDistance(s, P.SNAIL_GOAL);
    const hM = P.makeHeuristic('manhattan', P.SNAIL_GOAL)(s);
    const hX = P.makeHeuristic('misplaced', P.SNAIL_GOAL)(s);
    assert.strictEqual(hM, P.manhattan(s, P.SNAIL_GOAL));
    assert.strictEqual(hX, P.misplaced(s, P.SNAIL_GOAL));
    assert.ok(hM <= d && hX <= d && hX <= hM);
  }
});

console.log('MinHeap');

test('heap pops in sorted order', () => {
  const h = new MinHeap((a, b) => a - b);
  const data = [];
  for (let i = 0; i < 500; i++) data.push(Math.floor(Math.random() * 100));
  data.forEach(x => h.push(x));
  const out = [];
  while (h.size) out.push(h.pop());
  assert.deepStrictEqual(out, data.slice().sort((a, b) => a - b));
});

test('heap smallest(k) returns k smallest without mutating', () => {
  const h = new MinHeap((a, b) => a - b);
  [9, 4, 7, 1, 8, 2, 6, 3, 5, 0].forEach(x => h.push(x));
  assert.deepStrictEqual(h.smallest(4), [0, 1, 2, 3]);
  assert.strictEqual(h.size, 10);
  assert.deepStrictEqual(h.smallest(3, x => x % 2 === 0), [0, 2, 4]);
});

console.log('Algorithms: the worked example (2 8 3 / 1 6 4 / 7 _ 5 → snail goal)');

const START = P.EXAMPLE_START;
const GOAL = P.SNAIL_GOAL;

test('known optimal length is 5 and path is Up Up Left Down Right', () => {
  assert.strictEqual(bfsDistance(START, GOAL), 5);
  const r = A.analyze('bfs', START, GOAL, { order: 'UDLR' });
  validatePath(r, START, GOAL);
  assert.strictEqual(r.moves.length, 5);
  assert.strictEqual(r.moves.join(''), 'UULDR');
});

for (const id of ['bfs', 'dfs', 'iddls', 'gbfs', 'astar', 'ucs']) {
  test(`${id} returns a valid path`, () => {
    const r = A.analyze(id, START, GOAL, { heuristic: 'manhattan' });
    validatePath(r, START, GOAL);
  });
}

test('dls works at limit 5 and fails at limit 4', () => {
  const ok = A.analyze('dls', START, GOAL, { depthLimit: 5 });
  validatePath(ok, START, GOAL);
  assert.strictEqual(ok.moves.length, 5);
  const bad = A.analyze('dls', START, GOAL, { depthLimit: 4 });
  assert.strictEqual(bad.found, false);
  assert.strictEqual(bad.status, 'failed');
  assert.ok(/depth limit 4/.test(bad.message));
});

test('optimal algorithms all report 5 moves', () => {
  for (const id of ['bfs', 'iddls', 'astar', 'ucs']) {
    for (const h of ['manhattan', 'misplaced']) {
      const r = A.analyze(id, START, GOAL, { heuristic: h });
      assert.strictEqual(r.moves.length, 5, `${id}/${h}`);
    }
  }
});

test('dfs is not required to be optimal but must be valid', () => {
  const r = A.analyze('dfs', START, GOAL, {});
  validatePath(r, START, GOAL);
  assert.ok(r.moves.length >= 5);
});

test('trivial: start equals goal gives zero moves for every algorithm', () => {
  for (const a of A.ALGORITHMS) {
    const r = A.analyze(a.id, GOAL, GOAL, { depthLimit: 3 });
    assert.strictEqual(r.found, true, a.id);
    assert.strictEqual(r.moves.length, 0, a.id);
    assert.strictEqual(r.stats.expanded, 0, a.id);
  }
});

test('one move away', () => {
  const s = P.applyMove(GOAL, 'U');
  for (const a of A.ALGORITHMS) {
    const r = A.analyze(a.id, s, GOAL, { depthLimit: 3 });
    validatePath(r, s, GOAL);
    if (a.id !== 'dfs' && a.id !== 'gbfs') assert.strictEqual(r.moves.length, 1, a.id);
  }
});

console.log('Algorithms: random puzzles, cross-checked against an independent BFS');

test('optimal algorithms match true shortest distance on 60 random puzzles', () => {
  const rng = P.makeRng(2024);
  const goals = [P.STANDARD_GOAL, P.SNAIL_GOAL];
  let iddlsChecked = 0;
  for (let i = 0; i < 60; i++) {
    const goal = goals[i % 2];
    const s = P.generate(goal, ['easy', 'medium', 'hard', 'random'][i % 4], rng);
    const truth = bfsDistance(s, goal);
    const ids = ['bfs', 'ucs'];
    if (truth <= 18) {
      ids.push('iddls');
      iddlsChecked++;
    }
    for (const id of ids) {
      const r = A.analyze(id, s, goal, { maxExpansions: 3000000 });
      validatePath(r, s, goal);
      assert.strictEqual(r.moves.length, truth, `${id} on ${s}->${goal}`);
    }
    for (const h of ['manhattan', 'misplaced']) {
      const r = A.analyze('astar', s, goal, { heuristic: h });
      validatePath(r, s, goal);
      assert.strictEqual(r.moves.length, truth, `astar/${h} on ${s}->${goal}`);
    }
  }
  assert.ok(iddlsChecked >= 20);
});

test('dfs and gbfs always return valid (possibly long) paths on 40 random puzzles', () => {
  const rng = P.makeRng(31337);
  for (let i = 0; i < 40; i++) {
    const goal = i % 2 ? P.SNAIL_GOAL : P.STANDARD_GOAL;
    const s = P.generate(goal, 'random', rng);
    for (const order of P.ORDERS) {
      const r = A.analyze('dfs', s, goal, { order });
      validatePath(r, s, goal);
      assert.ok(r.stats.expanded <= 181440);
    }
    for (const h of ['manhattan', 'misplaced']) validatePath(A.analyze('gbfs', s, goal, { heuristic: h }), s, goal);
  }
});

test('dls with the true depth as limit succeeds; one less fails', () => {
  const rng = P.makeRng(11);
  for (let i = 0; i < 30; i++) {
    const s = P.generate(P.SNAIL_GOAL, 'medium', rng);
    const d = bfsDistance(s, P.SNAIL_GOAL);
    const ok = A.analyze('dls', s, P.SNAIL_GOAL, { depthLimit: d });
    validatePath(ok, s, P.SNAIL_GOAL);
    assert.ok(ok.moves.length <= d);
    if (d > 0) {
      const bad = A.analyze('dls', s, P.SNAIL_GOAL, { depthLimit: d - 1 });
      assert.strictEqual(bad.found, false, `limit ${d - 1} should fail for true depth ${d}`);
    }
  }
});

test('dls finds solutions regardless of move order (depth-aware closed set)', () => {
  const rng = P.makeRng(77);
  for (let i = 0; i < 25; i++) {
    const s = P.generate(P.STANDARD_GOAL, 'medium', rng);
    const d = bfsDistance(s, P.STANDARD_GOAL);
    for (const order of P.ORDERS) {
      const r = A.analyze('dls', s, P.STANDARD_GOAL, { depthLimit: d, order });
      validatePath(r, s, P.STANDARD_GOAL);
    }
  }
});

test('every move order yields correct optimal BFS length', () => {
  const s = '724506831';
  const truth = bfsDistance(s, P.STANDARD_GOAL);
  for (const order of P.ORDERS) {
    const r = A.analyze('bfs', s, P.STANDARD_GOAL, { order });
    assert.strictEqual(r.moves.length, truth);
  }
});

const FAR = farthestFrom(P.STANDARD_GOAL);

test('farthest state from the standard goal is exactly 31 moves away', () => {
  assert.strictEqual(FAR.depth, 31);
  assert.ok(P.isSolvable(FAR.state, P.STANDARD_GOAL));
});

test('hardest 8-puzzle instance (31 moves) is solved optimally', () => {
  for (const id of ['bfs', 'astar', 'ucs']) {
    const r = A.analyze(id, FAR.state, P.STANDARD_GOAL, {});
    validatePath(r, FAR.state, P.STANDARD_GOAL);
    assert.strictEqual(r.moves.length, 31, id);
  }
  const m = A.analyze('astar', FAR.state, P.STANDARD_GOAL, { heuristic: 'manhattan' });
  const x = A.analyze('astar', FAR.state, P.STANDARD_GOAL, { heuristic: 'misplaced' });
  assert.ok(m.stats.expanded < x.stats.expanded);
});

test('iddls solves the hardest instance when given enough budget', () => {
  const r = A.analyze('iddls', FAR.state, P.STANDARD_GOAL, { maxExpansions: 6000000, iterMax: 40 });
  validatePath(r, FAR.state, P.STANDARD_GOAL);
  assert.strictEqual(r.moves.length, 31);
});

test('iddls reports the safety limit honestly under a small budget', () => {
  const r = A.analyze('iddls', FAR.state, P.STANDARD_GOAL, { maxExpansions: 50000 });
  assert.strictEqual(r.found, false);
  assert.strictEqual(r.status, 'limit');
});

console.log('Algorithms: statistics and safety');

test('stats are internally consistent', () => {
  const rng = P.makeRng(3);
  for (let i = 0; i < 20; i++) {
    const s = P.generate(P.SNAIL_GOAL, 'hard', rng);
    for (const a of A.ALGORITHMS) {
      const r = A.analyze(a.id, s, P.SNAIL_GOAL, { depthLimit: 30, maxExpansions: 400000 });
      if (!r.found) continue;
      assert.ok(r.stats.generated >= 1);
      assert.ok(r.stats.timeMs >= 0);
      assert.ok(r.stats.memoryBytes > 0);
      assert.ok(r.stats.maxFrontier >= 0);
      if (a.id === 'bfs' || a.id === 'ucs' || a.id === 'astar' || a.id === 'gbfs') assert.ok(r.stats.expanded <= r.stats.generated);
      if (a.id === 'bfs' || a.id === 'ucs' || a.id === 'astar') assert.ok(r.stats.maxDepth >= r.moves.length);
    }
  }
});

test('bfs: generated counts and maxDepth are sane', () => {
  const r = A.analyze('bfs', START, GOAL, {});
  assert.ok(r.stats.maxDepth >= 5);
  assert.ok(r.stats.generated > r.stats.expanded);
});

test('safety cap stops runaway searches', () => {
  const r = A.analyze('bfs', '806547231', P.STANDARD_GOAL, { maxExpansions: 100 });
  assert.strictEqual(r.found, false);
  assert.strictEqual(r.status, 'limit');
  assert.ok(r.stats.expanded <= 100);
  assert.ok(/safety limit/.test(r.message));
});

test('unsolvable puzzle exhausts search space instead of hanging (bfs, dfs, astar, ucs, gbfs)', () => {
  const bad = '213456780';
  assert.ok(!P.isSolvable(bad, P.STANDARD_GOAL));
  for (const id of ['bfs', 'dfs', 'gbfs', 'astar', 'ucs']) {
    const r = A.analyze(id, bad, P.STANDARD_GOAL, { maxExpansions: 400000 });
    assert.strictEqual(r.found, false, id);
    assert.strictEqual(r.status, 'failed', id);
    assert.strictEqual(r.stats.expanded, 181440, id);
  }
});

test('dls on unsolvable reports exhausted vs cutoff correctly', () => {
  const bad = '213456780';
  const r = A.analyze('dls', bad, P.STANDARD_GOAL, { depthLimit: 6 });
  assert.strictEqual(r.found, false);
  assert.ok(/depth limit 6/.test(r.message));
});

test('invalid input throws', () => {
  assert.throws(() => A.analyze('bfs', '123', GOAL, {}));
  assert.throws(() => A.analyze('bfs', START, '111111111', {}));
  assert.throws(() => A.analyze('nope', START, GOAL, {}));
});

test('analysis is deterministic', () => {
  const a = A.analyze('dfs', '724506831', P.STANDARD_GOAL, {});
  const b = A.analyze('dfs', '724506831', P.STANDARD_GOAL, {});
  assert.strictEqual(a.moves.join(''), b.moves.join(''));
  assert.strictEqual(a.stats.expanded, b.stats.expanded);
});

console.log('Trace recording and timeline');

test('trace events: start first, goal last, stats monotonic', () => {
  for (const a of A.ALGORITHMS) {
    const r = A.analyze(a.id, START, GOAL, { trace: true, depthLimit: 6 });
    assert.ok(r.events.length >= 2, a.id);
    if (a.id !== 'dls' && a.id !== 'iddls') assert.strictEqual(r.events[0].kind, 'start', a.id);
    assert.strictEqual(r.events[r.events.length - 1].kind, 'goal', a.id);
    let prevExp = 0;
    let prevGen = 0;
    for (const e of r.events) {
      assert.ok(e.stats.expanded >= prevExp, a.id);
      assert.ok(e.stats.generated >= prevGen, a.id);
      prevExp = e.stats.expanded;
      prevGen = e.stats.generated;
    }
  }
});

test('trace is sampled for large searches but still ends at the goal', () => {
  const r = A.analyze('dfs', FAR.state, P.STANDARD_GOAL, { trace: true, maxTraceEvents: 500 });
  assert.ok(r.stride > 1);
  assert.ok(r.events.length <= 520);
  assert.strictEqual(r.events[r.events.length - 1].kind, 'goal');
  assert.strictEqual(r.events[r.events.length - 1].stats.expanded, r.stats.expanded);
});

test('expand events list children with valid statuses', () => {
  const r = A.analyze('astar', START, GOAL, { trace: true, heuristic: 'manhattan' });
  const ok = new Set(['added', 'explored', 'frontier', 'improved']);
  let seen = 0;
  for (const e of r.events) {
    if (e.kind !== 'expand') continue;
    seen++;
    assert.ok(e.children.length >= 1);
    assert.ok(e.f === e.g + e.h);
    for (const c of e.children) assert.ok(ok.has(c.status), c.status);
  }
  assert.ok(seen > 0);
});

test('timeline appends a step-0 event plus one path event per move and ends on the goal', () => {
  const r = A.analyze('bfs', START, GOAL, { trace: true });
  const t = A.timeline(r);
  const path = t.filter(e => e.kind === 'path');
  assert.strictEqual(path.length, r.moves.length + 1);
  assert.strictEqual(path[0].state, START);
  assert.strictEqual(path[0].parent, null);
  assert.strictEqual(path[0].move, null);
  assert.strictEqual(path[path.length - 1].state, GOAL);
  assert.strictEqual(path[1].parent, START);
  assert.strictEqual(path[1].move, r.moves[0]);
});

test('timeline has no path events when the search fails or hits the cap', () => {
  const failed = A.analyze('dls', START, GOAL, { trace: true, depthLimit: 4 });
  assert.strictEqual(failed.found, false);
  assert.strictEqual(A.timeline(failed).filter(e => e.kind === 'path').length, 0);
  assert.strictEqual(A.timeline(failed)[A.timeline(failed).length - 1].kind, 'fail');
  const capped = A.analyze('bfs', FAR.state, P.STANDARD_GOAL, { trace: true, maxExpansions: 50 });
  assert.strictEqual(A.timeline(capped).filter(e => e.kind === 'path').length, 0);
  assert.strictEqual(A.timeline(capped)[A.timeline(capped).length - 1].kind, 'limit');
});

test('timeline for a zero-move puzzle holds just the step-0 event', () => {
  const r = A.analyze('bfs', GOAL, GOAL, { trace: true });
  const path = A.timeline(r).filter(e => e.kind === 'path');
  assert.strictEqual(path.length, 1);
  assert.strictEqual(path[0].state, GOAL);
});

test('astar frontier preview is ordered by f', () => {
  const r = A.analyze('astar', '724506831', P.STANDARD_GOAL, { trace: true, heuristic: 'manhattan' });
  for (const e of r.events) {
    for (let i = 1; i < e.frontier.length; i++) assert.ok(e.frontier[i - 1].f <= e.frontier[i].f);
  }
});

test('compareAll returns all seven results', () => {
  const rs = A.compareAll(START, GOAL, { depthLimit: 8 });
  assert.strictEqual(rs.length, 7);
  assert.deepStrictEqual(rs.map(r => r.algorithm), A.ALGORITHMS.map(a => a.id));
});

test('formatters', () => {
  assert.strictEqual(A.formatBytes(500), '500 B');
  assert.strictEqual(A.formatBytes(2048), '2.0 KB');
  assert.strictEqual(A.formatBytes(3 * 1024 * 1024), '3.00 MB');
  assert.strictEqual(A.formatTime(0.001), '<0.01 ms');
  assert.strictEqual(A.formatTime(12.345), '12.35 ms');
  assert.strictEqual(A.formatTime(2500), '2.50 s');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('Failures:\n - ' + failures.join('\n - '));
  process.exit(1);
}
