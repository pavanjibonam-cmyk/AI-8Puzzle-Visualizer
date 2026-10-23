(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./puzzle.js'), require('./heap.js'));
  } else {
    root.Algorithms = factory(root.Puzzle, root.MinHeap);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P, MinHeap) {
  const NODE_BYTES = 96;
  const PREVIEW = 10;
  const DEFAULT_CAP = 1000000;
  const DEFAULT_TRACE_EVENTS = 2500;
  const DEFAULT_ITER_MAX = 40;

  const ALGORITHMS = [
    { id: 'bfs', name: 'Breadth-First Search', short: 'BFS', needsDepth: false, needsHeuristic: false, bonus: false },
    { id: 'dfs', name: 'Depth-First Search', short: 'DFS', needsDepth: false, needsHeuristic: false, bonus: false },
    { id: 'dls', name: 'Depth-Limited Search', short: 'DLS', needsDepth: true, needsHeuristic: false, bonus: false },
    { id: 'iddls', name: 'Iterative Deepening DLS', short: 'IDDLS', needsDepth: false, needsHeuristic: false, bonus: false },
    { id: 'gbfs', name: 'Greedy Best-First Search', short: 'GBFS', needsDepth: false, needsHeuristic: true, bonus: false },
    { id: 'astar', name: 'A* Search', short: 'A*', needsDepth: false, needsHeuristic: true, bonus: false },
    { id: 'ucs', name: 'Uniform Cost Search', short: 'UCS', needsDepth: false, needsHeuristic: false, bonus: true }
  ];

  function byId(id) {
    return ALGORITHMS.find(a => a.id === id) || null;
  }

  const now = typeof performance !== 'undefined' && performance.now
    ? () => performance.now()
    : () => Number(process.hrtime.bigint()) / 1e6;

  function makeNode(state, parent, move, h) {
    const g = parent ? parent.g + 1 : 0;
    return { state, parent, move, depth: g, g, h, f: h === null ? null : g + h };
  }

  function movesOf(node) {
    const out = [];
    for (let n = node; n && n.parent; n = n.parent) out.push(n.move);
    out.reverse();
    return out;
  }

  function brief(n) {
    return { state: n.state, depth: n.depth, g: n.g, h: n.h, f: n.f, move: n.move };
  }

  function newStats() {
    return {
      generated: 0,
      expanded: 0,
      maxDepth: 0,
      maxFrontier: 0,
      peakNodes: 0,
      duplicates: 0,
      cutoffs: 0,
      iterations: 0,
      steps: 0
    };
  }

  function track(st, frontier, explored) {
    if (frontier > st.maxFrontier) st.maxFrontier = frontier;
    const total = frontier + explored;
    if (total > st.peakNodes) st.peakNodes = total;
  }

  function createRecorder(cfg, st) {
    const events = [];
    const stride = Math.max(1, cfg.stride || 1);
    const maxTaken = cfg.maxEvents || DEFAULT_TRACE_EVENTS;
    const recent = [];
    let seen = 0;
    let taken = 0;
    const hooks = { frontierSize: () => 0, exploredSize: () => 0, frontierPreview: () => [] };

    function snapshot() {
      return {
        generated: st.generated,
        expanded: st.expanded,
        frontier: hooks.frontierSize(),
        explored: hooks.exploredSize(),
        maxDepth: st.maxDepth,
        maxFrontier: st.maxFrontier,
        duplicates: st.duplicates,
        cutoffs: st.cutoffs,
        iteration: st.iterations
      };
    }

    function build(kind, node, children, extra) {
      const base = {
        kind,
        stats: snapshot(),
        frontier: hooks.frontierPreview(),
        explored: recent.slice().reverse(),
        children: children || [],
        node: node || null
      };
      if (node) {
        base.state = node.state;
        base.parent = node.parent ? node.parent.state : null;
        base.move = node.move;
        base.depth = node.depth;
        base.g = node.g;
        base.h = node.h;
        base.f = node.f;
      }
      return Object.assign(base, extra || {});
    }

    return {
      events,
      stride,
      bind(h) {
        Object.assign(hooks, h);
      },
      noteExplored(state) {
        recent.push(state);
        if (recent.length > PREVIEW) recent.shift();
      },
      mark(kind, node, children, extra) {
        events.push(build(kind, node, children, extra));
      },
      take(kind, node, children, extra) {
        seen++;
        if ((seen - 1) % stride !== 0 || taken >= maxTaken) return;
        taken++;
        events.push(build(kind, node, children, extra));
      }
    };
  }

  function childInfo(child, status) {
    return { state: child.state, move: child.move, status, h: child.h, f: child.f, depth: child.depth };
  }

  function bfs(Q, st, rec) {
    const { start, goal, order, cap } = Q;
    const root = makeNode(start, null, null, null);
    const queue = [root];
    let head = 0;
    const inFrontier = new Set([start]);
    const explored = new Set();
    st.generated = 1;
    if (rec) {
      rec.bind({
        frontierSize: () => queue.length - head,
        exploredSize: () => explored.size,
        frontierPreview: () => queue.slice(head, head + PREVIEW).map(brief)
      });
      rec.mark('start', root);
    }
    while (head < queue.length) {
      track(st, queue.length - head, explored.size);
      if (st.expanded >= cap) return { status: 'limit' };
      const node = queue[head];
      queue[head] = null;
      head++;
      inFrontier.delete(node.state);
      if (node.state === goal) return { status: 'solved', node };
      explored.add(node.state);
      st.expanded++;
      st.steps++;
      if (rec) rec.noteExplored(node.state);
      const infos = [];
      for (const s of P.successors(node.state, order)) {
        if (explored.has(s.state)) {
          st.duplicates++;
          if (rec) infos.push({ state: s.state, move: s.move, status: 'explored', h: null, f: null, depth: node.depth + 1 });
        } else if (inFrontier.has(s.state)) {
          st.duplicates++;
          if (rec) infos.push({ state: s.state, move: s.move, status: 'frontier', h: null, f: null, depth: node.depth + 1 });
        } else {
          const child = makeNode(s.state, node, s.move, null);
          queue.push(child);
          inFrontier.add(s.state);
          st.generated++;
          if (child.depth > st.maxDepth) st.maxDepth = child.depth;
          if (rec) infos.push(childInfo(child, 'added'));
        }
      }
      if (rec) rec.take('expand', node, infos);
    }
    track(st, 0, explored.size);
    return { status: 'failed' };
  }

  function dfs(Q, st, rec) {
    const { start, goal, order, cap } = Q;
    const root = makeNode(start, null, null, null);
    const stack = [root];
    const explored = new Set();
    st.generated = 1;
    if (rec) {
      rec.bind({
        frontierSize: () => stack.length,
        exploredSize: () => explored.size,
        frontierPreview: () => {
          const out = [];
          for (let i = stack.length - 1; i >= 0 && out.length < PREVIEW; i--) out.push(brief(stack[i]));
          return out;
        }
      });
      rec.mark('start', root);
    }
    while (stack.length) {
      track(st, stack.length, explored.size);
      if (st.expanded >= cap) return { status: 'limit' };
      const node = stack.pop();
      if (explored.has(node.state)) {
        st.duplicates++;
        continue;
      }
      if (node.state === goal) return { status: 'solved', node };
      explored.add(node.state);
      st.expanded++;
      st.steps++;
      if (rec) rec.noteExplored(node.state);
      const infos = [];
      const fresh = [];
      for (const s of P.successors(node.state, order)) {
        if (explored.has(s.state)) {
          st.duplicates++;
          if (rec) infos.push({ state: s.state, move: s.move, status: 'explored', h: null, f: null, depth: node.depth + 1 });
        } else {
          const child = makeNode(s.state, node, s.move, null);
          fresh.push(child);
          st.generated++;
          if (child.depth > st.maxDepth) st.maxDepth = child.depth;
          if (rec) infos.push(childInfo(child, 'added'));
        }
      }
      for (let i = fresh.length - 1; i >= 0; i--) stack.push(fresh[i]);
      if (rec) rec.take('expand', node, infos);
    }
    track(st, 0, explored.size);
    return { status: 'failed' };
  }

  function depthLimitedPass(Q, st, rec, limit) {
    const { start, goal, order, cap } = Q;
    const root = makeNode(start, null, null, null);
    const stack = [root];
    const best = new Map();
    let cutoff = false;
    st.generated++;
    if (rec) {
      rec.bind({
        frontierSize: () => stack.length,
        exploredSize: () => best.size,
        frontierPreview: () => {
          const out = [];
          for (let i = stack.length - 1; i >= 0 && out.length < PREVIEW; i--) out.push(brief(stack[i]));
          return out;
        }
      });
    }
    while (stack.length) {
      track(st, stack.length, best.size);
      if (st.expanded >= cap) return { status: 'limit' };
      const node = stack.pop();
      if (node.state === goal) return { status: 'solved', node };
      const seenDepth = best.get(node.state);
      if (seenDepth !== undefined && seenDepth <= node.depth) {
        st.duplicates++;
        continue;
      }
      if (node.depth >= limit) {
        cutoff = true;
        st.cutoffs++;
        st.steps++;
        if (rec) rec.take('cutoff', node, [], { limit });
        continue;
      }
      best.set(node.state, node.depth);
      st.expanded++;
      st.steps++;
      if (rec) rec.noteExplored(node.state);
      const infos = [];
      const fresh = [];
      for (const s of P.successors(node.state, order)) {
        const known = best.get(s.state);
        if (known !== undefined && known <= node.depth + 1) {
          st.duplicates++;
          if (rec) infos.push({ state: s.state, move: s.move, status: 'explored', h: null, f: null, depth: node.depth + 1 });
        } else {
          const child = makeNode(s.state, node, s.move, null);
          fresh.push(child);
          st.generated++;
          if (child.depth > st.maxDepth) st.maxDepth = child.depth;
          if (rec) infos.push(childInfo(child, 'added'));
        }
      }
      for (let i = fresh.length - 1; i >= 0; i--) stack.push(fresh[i]);
      if (rec) rec.take('expand', node, infos, { limit });
    }
    track(st, 0, best.size);
    return { status: 'failed', cutoff };
  }

  function dls(Q, st, rec) {
    const limit = Q.depthLimit;
    st.iterations = 1;
    if (rec) rec.mark('iteration', null, [], { limit, iteration: 1, note: `Depth limit = ${limit}` });
    const out = depthLimitedPass(Q, st, rec, limit);
    if (out.status === 'failed') out.limitHit = out.cutoff;
    return out;
  }

  function iddls(Q, st, rec) {
    const maxDepth = Q.iterMax;
    let everCutoff = false;
    for (let limit = 0; limit <= maxDepth; limit++) {
      st.iterations = limit + 1;
      if (rec) rec.mark('iteration', null, [], { limit, iteration: limit + 1, note: `Starting iteration with depth limit = ${limit}` });
      const out = depthLimitedPass(Q, st, rec, limit);
      if (out.status === 'solved' || out.status === 'limit') return out;
      if (!out.cutoff) return { status: 'failed', limitHit: false };
      everCutoff = true;
    }
    return { status: 'failed', limitHit: everCutoff, exhaustedDepth: maxDepth };
  }

  function bestFirst(kind, Q, st, rec) {
    const { start, goal, order, cap } = Q;
    const hfn = kind === 'ucs' ? null : P.makeHeuristic(Q.heuristic, goal);
    let seq = 0;
    const key = (n) => (kind === 'ucs' ? n.g : kind === 'gbfs' ? n.h : n.f);
    const compare = (a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka !== kb) return ka - kb;
      if (kind === 'astar' && a.h !== b.h) return a.h - b.h;
      return a.seq - b.seq;
    };
    const heap = new MinHeap(compare);
    const open = new Map();
    const closed = new Map();
    const root = makeNode(start, null, null, hfn ? hfn(start) : null);
    root.seq = seq++;
    heap.push(root);
    open.set(start, root);
    st.generated = 1;
    if (rec) {
      rec.bind({
        frontierSize: () => open.size,
        exploredSize: () => closed.size,
        frontierPreview: () => heap.smallest(PREVIEW, n => open.get(n.state) === n, 600).map(brief)
      });
      rec.mark('start', root);
    }
    while (heap.size) {
      track(st, open.size, closed.size);
      if (st.expanded >= cap) return { status: 'limit' };
      const node = heap.pop();
      if (open.get(node.state) !== node) continue;
      open.delete(node.state);
      if (node.state === goal) return { status: 'solved', node };
      closed.set(node.state, node.g);
      st.expanded++;
      st.steps++;
      if (rec) rec.noteExplored(node.state);
      const infos = [];
      for (const s of P.successors(node.state, order)) {
        const g = node.g + 1;
        const closedG = closed.get(s.state);
        const existing = open.get(s.state);
        let skip = null;
        if (closedG !== undefined) {
          if (kind === 'astar' || kind === 'ucs') {
            if (closedG <= g) skip = 'explored';
          } else {
            skip = 'explored';
          }
        }
        if (skip === null && existing) {
          if (kind === 'gbfs' || existing.g <= g) skip = 'frontier';
        }
        if (skip !== null) {
          st.duplicates++;
          if (rec) infos.push({ state: s.state, move: s.move, status: skip, h: hfn ? hfn(s.state) : null, f: hfn ? g + hfn(s.state) : null, depth: g });
          continue;
        }
        if (closedG !== undefined) closed.delete(s.state);
        const child = makeNode(s.state, node, s.move, hfn ? hfn(s.state) : null);
        child.seq = seq++;
        heap.push(child);
        open.set(s.state, child);
        st.generated++;
        if (child.depth > st.maxDepth) st.maxDepth = child.depth;
        if (rec) infos.push(childInfo(child, existing ? 'improved' : 'added'));
      }
      if (rec) rec.take('expand', node, infos);
    }
    track(st, 0, closed.size);
    return { status: 'failed' };
  }

  const RUNNERS = {
    bfs,
    dfs,
    dls,
    iddls,
    gbfs: (Q, st, rec) => bestFirst('gbfs', Q, st, rec),
    astar: (Q, st, rec) => bestFirst('astar', Q, st, rec),
    ucs: (Q, st, rec) => bestFirst('ucs', Q, st, rec)
  };

  function normalize(algoId, start, goal, opts) {
    const o = opts || {};
    if (!RUNNERS[algoId]) throw new Error(`Unknown algorithm: ${algoId}`);
    if (!P.isValidState(start)) throw new Error('Initial state is not a valid 8-puzzle state.');
    if (!P.isValidState(goal)) throw new Error('Goal state is not a valid 8-puzzle state.');
    const depthLimit = Number.isFinite(o.depthLimit) ? Math.max(0, Math.floor(o.depthLimit)) : 10;
    return {
      start,
      goal,
      order: P.ORDERS.includes(o.order) ? o.order : P.DEFAULT_ORDER,
      cap: Number.isFinite(o.maxExpansions) && o.maxExpansions > 0 ? Math.floor(o.maxExpansions) : DEFAULT_CAP,
      depthLimit,
      iterMax: Number.isFinite(o.iterMax) ? Math.max(0, Math.floor(o.iterMax)) : DEFAULT_ITER_MAX,
      heuristic: o.heuristic === 'misplaced' ? 'misplaced' : 'manhattan'
    };
  }

  function runOnce(algoId, Q, recCfg) {
    const st = newStats();
    const rec = recCfg ? createRecorder(recCfg, st) : null;
    const t0 = now();
    const out = RUNNERS[algoId](Q, st, rec);
    const timeMs = now() - t0;
    return { out, st, rec, timeMs };
  }

  function describe(algoId, Q, out) {
    if (out.status === 'solved') return 'Goal reached.';
    if (out.status === 'limit') return `Stopped: safety limit of ${Q.cap.toLocaleString('en-US')} expansions reached before a solution was found.`;
    if (algoId === 'dls') {
      return out.limitHit
        ? `No solution found within depth limit ${Q.depthLimit}. The search was cut off at that depth; try a larger limit.`
        : 'Search space exhausted: no solution exists for this puzzle.';
    }
    if (algoId === 'iddls') {
      return out.limitHit
        ? `No solution found up to depth ${Q.iterMax}.`
        : 'Search space exhausted: no solution exists for this puzzle.';
    }
    return 'Search space exhausted: no solution exists for this puzzle.';
  }

  function finalize(algoId, Q, run, timeMs) {
    const { out, st } = run;
    const info = byId(algoId);
    const moves = out.status === 'solved' ? movesOf(out.node) : [];
    const solved = out.status === 'solved';
    return {
      algorithm: algoId,
      name: info.name,
      short: info.short,
      found: solved,
      status: solved ? 'solved' : out.status === 'limit' ? 'limit' : 'failed',
      message: describe(algoId, Q, out),
      moves,
      states: solved ? P.applyMoves(Q.start, moves) : [Q.start],
      pathCost: solved ? out.node.g : null,
      params: {
        order: Q.order,
        depthLimit: algoId === 'dls' ? Q.depthLimit : null,
        heuristic: algoId === 'gbfs' || algoId === 'astar' ? Q.heuristic : null,
        cap: Q.cap,
        iterMax: algoId === 'iddls' ? Q.iterMax : null
      },
      stats: {
        generated: st.generated,
        expanded: st.expanded,
        maxDepth: st.maxDepth,
        maxFrontier: st.maxFrontier,
        peakNodes: st.peakNodes,
        duplicates: st.duplicates,
        cutoffs: st.cutoffs,
        iterations: st.iterations,
        steps: st.steps,
        timeMs,
        memoryBytes: st.peakNodes * NODE_BYTES,
        pathLength: moves.length
      },
      events: [],
      stride: 1
    };
  }

  function analyze(algoId, start, goal, opts) {
    const Q = normalize(algoId, start, goal, opts);
    const first = runOnce(algoId, Q, null);
    let bestTime = first.timeMs;
    if (first.timeMs < 150) {
      const repeats = first.timeMs < 20 ? 4 : 2;
      for (let i = 0; i < repeats; i++) {
        const again = runOnce(algoId, Q, null);
        if (again.timeMs < bestTime) bestTime = again.timeMs;
      }
    }
    const result = finalize(algoId, Q, first, bestTime);
    if (opts && opts.trace) {
      const maxEvents = opts.maxTraceEvents || DEFAULT_TRACE_EVENTS;
      const stride = Math.max(1, Math.ceil(first.st.steps / maxEvents));
      const traced = runOnce(algoId, Q, { stride, maxEvents });
      const rec = traced.rec;
      const last = traced.out;
      if (last.status === 'solved') {
        rec.mark('goal', last.node, [], { note: 'Goal test passed.' });
      } else if (last.status === 'limit') {
        rec.mark('limit', null, [], { note: result.message });
      } else {
        rec.mark('fail', null, [], { note: result.message });
      }
      result.events = rec.events;
      result.stride = stride;
    }
    return result;
  }

  function timeline(result) {
    const events = result.events.slice();
    const total = result.moves.length;
    const finalStats = events.length ? events[events.length - 1].stats : null;
    const first = result.found ? 0 : 1;
    const last = result.found ? total : 0;
    for (let i = first; i <= last; i++) {
      events.push({
        kind: 'path',
        index: i,
        total,
        state: result.states[i],
        parent: i > 0 ? result.states[i - 1] : null,
        move: i > 0 ? result.moves[i - 1] : null,
        depth: i,
        g: i,
        h: null,
        f: null,
        children: [],
        frontier: [],
        explored: [],
        stats: finalStats
      });
    }
    return events;
  }

  function compareAll(start, goal, opts, ids) {
    const list = ids || ALGORITHMS.map(a => a.id);
    return list.map(id => analyze(id, start, goal, Object.assign({}, opts, { trace: false })));
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function formatTime(ms) {
    if (ms < 0.01) return '<0.01 ms';
    if (ms < 1000) return `${ms.toFixed(2)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  return {
    ALGORITHMS,
    NODE_BYTES,
    PREVIEW,
    DEFAULT_CAP,
    DEFAULT_ITER_MAX,
    DEFAULT_TRACE_EVENTS,
    byId,
    analyze,
    timeline,
    compareAll,
    movesOf,
    formatBytes,
    formatTime
  };
});
