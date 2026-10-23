(function (root) {
  const P = root.Puzzle;
  const A = root.Algorithms;
  const V = root.BoardView;

  const IDS = [
    'cmpStart', 'cmpGoal', 'cmpDepth', 'cmpHeur', 'cmpDifficulty', 'btnCmpRun', 'btnCmpRandom', 'cmpStatus', 'cmpBody', 'cmpNote',
    'cmpChartsPanel', 'cmpCharts'
  ];
  const el = {};
  const S = { boards: {}, results: null, puzzleKey: null, running: false };
  const fmt = n => Number(n).toLocaleString('en-US');
  const delay = ms => new Promise(r => setTimeout(r, ms));

  function memoryLevel(bytes) {
    if (bytes < 100 * 1024) return 'Low';
    if (bytes < 1024 * 1024) return 'Medium';
    return 'High';
  }

  function jobList(mode) {
    const jobs = [];
    for (const a of A.ALGORITHMS) {
      if (a.needsHeuristic && mode === 'both') {
        jobs.push({ algo: a, heuristic: 'manhattan', label: `${a.short} (Manhattan)` });
        jobs.push({ algo: a, heuristic: 'misplaced', label: `${a.short} (Misplaced)` });
      } else if (a.needsHeuristic) {
        const h = mode === 'misplaced' ? 'misplaced' : 'manhattan';
        jobs.push({ algo: a, heuristic: h, label: `${a.short} (${P.HEURISTICS[h].short})` });
      } else {
        jobs.push({ algo: a, heuristic: null, label: a.short });
      }
    }
    return jobs;
  }

  function puzzleKey() {
    const p = root.AppState;
    return `${p.start}>${p.goal}`;
  }

  function syncBoards() {
    S.boards.start.set(root.AppState.start, false);
    S.boards.goal.set(root.AppState.goal, false);
  }

  function setBusy(on) {
    S.running = on;
    el.btnCmpRun.disabled = on;
    el.btnCmpRandom.disabled = on;
  }

  async function runAll() {
    if (S.running) return;
    const solver = root.Solver.getPuzzle();
    const { start, goal } = solver;
    if (!P.isSolvable(start, goal)) {
      el.cmpStatus.textContent = 'The current puzzle is not solvable. Fix it in the Solver first.';
      return;
    }
    const depth = Math.min(60, Math.max(0, parseInt(el.cmpDepth.value, 10) || 0));
    const jobs = jobList(el.cmpHeur.value);
    setBusy(true);
    const results = [];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      el.cmpStatus.textContent = `Running ${job.label} (${i + 1} of ${jobs.length})…`;
      await delay(30);
      try {
        const r = A.analyze(job.algo.id, start, goal, { depthLimit: depth, heuristic: job.heuristic || 'manhattan', trace: false });
        results.push({ job, r });
      } catch (err) {
        el.cmpStatus.textContent = `Error while running ${job.label}: ${err.message}`;
        setBusy(false);
        return;
      }
    }
    S.results = { items: results, depth, start, goal };
    S.puzzleKey = `${start}>${goal}`;
    render();
    el.cmpStatus.textContent = `Finished ${jobs.length} runs on the same puzzle.`;
    setBusy(false);
  }

  function bestSet(items, pick) {
    const found = items.filter(x => x.r.found);
    if (!found.length) return new Set();
    const min = Math.min(...found.map(pick));
    return new Set(found.filter(x => pick(x) === min).map(x => x.job.label));
  }

  function render() {
    const res = S.results;
    if (!res) return;
    const items = res.items;
    const bestMoves = bestSet(items, x => x.r.moves.length);
    const bestExp = bestSet(items, x => x.r.stats.expanded);
    const bestTime = bestSet(items, x => x.r.stats.timeMs);
    el.cmpBody.innerHTML = items
      .map(({ job, r }) => {
        const found = r.found
          ? '<span class="pill yes"><i class="bi bi-check-lg"></i> Yes</span>'
          : r.status === 'limit'
            ? '<span class="pill warn" title="Stopped by the safety cap">Stopped</span>'
            : '<span class="pill no"><i class="bi bi-x-lg"></i> No</span>';
        const level = memoryLevel(r.stats.memoryBytes);
        const tag = job.algo.bonus ? '<small>bonus · same as BFS for unit costs</small>' : job.algo.id === 'dfs' ? '<small>assigned algorithm</small>' : `<small>${V.esc(job.algo.name)}</small>`;
        const cls = job.algo.id === 'dfs' ? ' class="is-assigned"' : '';
        const mark = (set, text) => (set.has(job.label) ? `<span class="best">${text}</span>` : text);
        return `<tr${cls}>
          <th scope="row" class="algo-name">${V.esc(job.label)}${tag}</th>
          <td>${found}</td>
          <td class="num">${fmt(r.stats.generated)}</td>
          <td class="num">${mark(bestExp, fmt(r.stats.expanded))}</td>
          <td class="num">${r.found ? mark(bestMoves, fmt(r.moves.length)) : '–'}</td>
          <td class="num">${fmt(r.stats.maxDepth)}</td>
          <td class="num">${mark(bestTime, A.formatTime(r.stats.timeMs))}</td>
          <td><span class="mem-${level}"><b>${level}</b></span> <small class="text-secondary mono">${A.formatBytes(r.stats.memoryBytes)}</small></td>
        </tr>`;
      })
      .join('');
    el.cmpNote.innerHTML = buildNote(res);
    renderCharts(items);
  }

  function buildNote(res) {
    const items = res.items;
    const optimalIds = ['bfs', 'iddls', 'astar', 'ucs'];
    const optimalRows = items.filter(x => optimalIds.includes(x.job.algo.id) && x.r.found);
    const lines = [];
    if (!optimalRows.length) {
      lines.push('No optimal algorithm finished within the safety cap on this puzzle, so the shortest length is unknown.');
    } else {
      const best = Math.min(...optimalRows.map(x => x.r.moves.length));
      lines.push(`The shortest solution has <b>${fmt(best)}</b> move${best === 1 ? '' : 's'}.`);
      const worse = items.filter(x => x.r.found && x.r.moves.length > best);
      if (worse.length) {
        lines.push(
          worse.map(x => `${V.esc(x.job.label)} used ${fmt(x.r.moves.length)}`).join(', ') + ': valid, but not optimal.'
        );
      }
      const dls = items.find(x => x.job.algo.id === 'dls');
      if (dls && !dls.r.found && dls.r.status === 'failed') {
        lines.push(`DLS found nothing at depth limit ${res.depth} because the shallowest solution is at depth ${fmt(best)}. Raise the limit to at least ${fmt(best)}.`);
      }
      const bfs = items.find(x => x.job.algo.id === 'bfs');
      const astar = items.filter(x => x.job.algo.id === 'astar' && x.r.found);
      if (bfs && bfs.r.found && astar.length) {
        const a = astar.reduce((m, x) => (x.r.stats.expanded < m.r.stats.expanded ? x : m));
        if (bfs.r.stats.expanded > 0) {
          const pct = Math.round((1 - a.r.stats.expanded / bfs.r.stats.expanded) * 100);
          if (pct > 0) lines.push(`${V.esc(a.job.label)} expanded ${pct}% fewer nodes than BFS.`);
        }
      }
    }
    const capped = items.filter(x => x.r.status === 'limit');
    if (capped.length) lines.push(`${capped.map(x => V.esc(x.job.label)).join(', ')} hit the safety cap before finishing.`);
    lines.push('★ marks the best value among the algorithms that found a solution. Memory is an estimate from peak frontier + explored nodes.');
    return lines.join(' ');
  }

  function bars(title, rows, formatter, note) {
    const max = Math.max(...rows.map(r => r.v), 1);
    const scale = v => (v <= 0 ? 0 : (Math.log10(1 + v) / Math.log10(1 + max)) * 100);
    return `<div class="col-lg-4 bars"><h3>${title}${note ? ` <span class="text-secondary text-lowercase">${note}</span>` : ''}</h3>${rows
      .map(
        r => `<div class="bar-row"><span class="lab" title="${V.esc(r.label)}">${V.esc(r.label)}</span><div class="bar-track" role="presentation"><div class="bar-fill" style="width:${scale(r.v).toFixed(1)}%"></div></div><span class="val">${formatter(r.v)}</span></div>`
      )
      .join('')}</div>`;
  }

  function renderCharts(items) {
    el.cmpChartsPanel.hidden = false;
    const exp = items.map(x => ({ label: x.job.label, v: x.r.stats.expanded }));
    const mov = items.filter(x => x.r.found).map(x => ({ label: x.job.label, v: x.r.moves.length }));
    const tim = items.map(x => ({ label: x.job.label, v: x.r.stats.timeMs }));
    el.cmpCharts.innerHTML =
      bars('Nodes expanded', exp, v => fmt(v), '(log scale)') +
      bars('Solution length (moves)', mov, v => fmt(v), '(log scale)') +
      bars('Execution time', tim, v => A.formatTime(v), '(log scale)');
  }

  function randomPuzzle() {
    const goal = root.Solver.getPuzzle().goal;
    const start = P.generate(goal, el.cmpDifficulty.value);
    root.Solver.setPuzzle(start, goal);
    onEnter();
    el.cmpStatus.textContent = 'New random puzzle ready. Press Run all algorithms.';
  }

  function onEnter() {
    syncBoards();
    if (S.results && S.puzzleKey !== puzzleKey()) {
      el.cmpStatus.textContent = 'The puzzle changed since the last run. Press Run all algorithms to refresh the table.';
    }
  }

  function init() {
    const missing = IDS.filter(id => !document.getElementById(id));
    if (missing.length) throw new Error('Missing elements: ' + missing.join(', '));
    IDS.forEach(id => (el[id] = document.getElementById(id)));
    S.boards.start = new V.LiveBoard(el.cmpStart);
    S.boards.goal = new V.LiveBoard(el.cmpGoal);
    el.cmpDifficulty.innerHTML = Object.values(P.DIFFICULTIES)
      .map(d => `<option value="${d.id}"${d.id === 'medium' ? ' selected' : ''}>${d.name}</option>`)
      .join('');
    el.btnCmpRun.addEventListener('click', runAll);
    el.btnCmpRandom.addEventListener('click', randomPuzzle);
    syncBoards();
  }

  root.Compare = { init, onEnter, runAll, state: S };
})(typeof globalThis !== 'undefined' ? globalThis : this);
