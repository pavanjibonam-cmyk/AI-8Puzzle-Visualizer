(function (root) {
  const P = root.Puzzle;
  const A = root.Algorithms;
  const V = root.BoardView;
  const INFO = root.AlgoInfo;

  const AppState = (root.AppState = { start: P.EXAMPLE_START, goal: P.SNAIL_GOAL });

  const ARROW = { U: '↑', D: '↓', L: '←', R: '→' };
  const SPEEDS = [0.5, 1, 2, 4, 8, 15, 30, 60, 150, 400];
  const OPTIMAL_ALGOS = ['bfs', 'iddls', 'astar', 'ucs'];
  const ORDER_LABEL = {
    UDLR: 'Up, Down, Left, Right',
    URDL: 'Up, Right, Down, Left',
    LRUD: 'Left, Right, Up, Down',
    RLDU: 'Right, Left, Down, Up',
    DRUL: 'Down, Right, Up, Left',
    ULDR: 'Up, Left, Down, Right'
  };
  const STRUCTURE = {
    bfs: 'FIFO queue',
    dfs: 'LIFO stack',
    dls: 'LIFO stack',
    iddls: 'LIFO stack',
    gbfs: 'priority queue (ordered by h)',
    astar: 'priority queue (ordered by f = g + h)',
    ucs: 'priority queue (ordered by g)'
  };
  const FRONTIER_HINT = {
    bfs: 'Queue: the front is expanded next. Showing the first 10 nodes.',
    dfs: 'Stack: the top is expanded next. Showing the top 10 entries.',
    dls: 'Stack: the top is expanded next. Showing the top 10 entries.',
    iddls: 'Stack: the top is expanded next. Showing the top 10 entries.',
    gbfs: 'Priority queue ordered by h(n): the lowest h is expanded next. Showing the best 10.',
    astar: 'Priority queue ordered by f(n) = g + h: the lowest f is expanded next. Showing the best 10.',
    ucs: 'Priority queue ordered by g(n): the cheapest is expanded next. Showing the best 10.'
  };

  const IDS = [
    'startInputs', 'goalInputs', 'puzzleStatus', 'btnFixSolvable', 'btnExample', 'btnStdGoal', 'btnSnailGoal', 'btnSwapStates',
    'difficulty', 'btnRandom', 'algoSelect', 'algoBlurb', 'depthWrap', 'depthLimit', 'heurWrap', 'heurManhattan', 'heurMisplaced',
    'orderSelect', 'capSelect', 'btnRunMain', 'btnRun', 'btnPause', 'btnResume', 'btnPrev', 'btnNext', 'btnEnd', 'btnReset',
    'speed', 'speedLabel', 'scrub', 'stepLabel', 'phaseBadge', 'boardStart', 'boardCurrent', 'boardGoal', 'curMove', 'narration',
    'sampleNote', 'stCurrent', 'stParent', 'stDepth', 'stG', 'stH', 'stF', 'stGenerated', 'stExpanded', 'stFrontier', 'stExplored',
    'stMaxDepth', 'stIter', 'tileH', 'tileF', 'tileIter', 'childrenTitle', 'childrenList', 'frontierTitle', 'frontierHint',
    'frontierList', 'exploredTitle', 'exploredList', 'pathList', 'pathCount', 'movesDetails', 'pathMoves', 'btnCopyMoves',
    'summary', 'busy', 'busyText', 'errorBox', 'assignedChip'
  ];

  const el = {};
  const S = {
    inputs: { start: [], goal: [] },
    boards: {},
    ready: false,
    result: null,
    timeline: null,
    searchEnd: 0,
    idx: 0,
    playing: false,
    sps: SPEEDS[4],
    raf: 0,
    last: 0,
    acc: 0,
    optimal: null,
    summaryFor: null,
    pathCards: [],
    pathGap: null,
    activeCard: null,
    busy: false
  };

  const fmt = n => (n === null || n === undefined ? '–' : Number(n).toLocaleString('en-US'));
  const delay = ms => new Promise(r => setTimeout(r, ms));

  function algoId() {
    return el.algoSelect.value;
  }

  function algoMeta() {
    return A.byId(algoId());
  }

  function isInformed() {
    return algoMeta().needsHeuristic;
  }

  function showError(msg) {
    el.errorBox.textContent = msg;
    el.errorBox.classList.remove('d-none');
  }

  function clearError() {
    el.errorBox.classList.add('d-none');
    el.errorBox.textContent = '';
  }

  function buildGrid(container, key) {
    container.textContent = '';
    for (let i = 0; i < P.CELLS; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.inputMode = 'text';
      input.setAttribute('aria-label', `${key === 'start' ? 'Initial' : 'Goal'} state, row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`);
      input.addEventListener('focus', () => input.select());
      input.addEventListener('input', () => {
        let v = input.value.trim();
        if (v === '' && input.value.length) v = '_';
        if (/^[1-8]$/.test(v)) {
          input.value = v;
        } else if (/^[0_\-.xXbB]$/.test(v) || input.value === ' ') {
          input.value = '_';
        } else {
          input.value = '';
        }
        if (input.value !== '' && S.inputs[key][i + 1]) S.inputs[key][i + 1].focus();
        onPuzzleEdited();
      });
      input.addEventListener('keydown', e => {
        const list = S.inputs[key];
        const go = idx => {
          if (list[idx]) {
            e.preventDefault();
            list[idx].focus();
          }
        };
        if (e.key === 'Backspace' && input.value === '') go(i - 1);
        else if (e.key === 'ArrowLeft') go(i - 1);
        else if (e.key === 'ArrowRight') go(i + 1);
        else if (e.key === 'ArrowUp') go(i - 3);
        else if (e.key === 'ArrowDown') go(i + 3);
      });
      input.addEventListener('paste', e => {
        const text = (e.clipboardData || root.clipboardData).getData('text');
        const parsed = P.parse(text);
        if (parsed.ok) {
          e.preventDefault();
          writeGrid(key, parsed.state);
          onPuzzleEdited();
        }
      });
      container.appendChild(input);
      S.inputs[key].push(input);
    }
  }

  function writeGrid(key, state) {
    S.inputs[key].forEach((input, i) => {
      input.value = state[i] === P.BLANK ? '_' : state[i];
    });
  }

  function readGrid(key) {
    const cells = S.inputs[key].map(i => i.value);
    const complete = cells.every(c => c !== '');
    const raw = cells.map(c => (c === '_' ? '0' : c)).join('');
    return { cells, complete, raw, valid: complete && P.isValidState(raw) };
  }

  function markDuplicates(key, info) {
    const counts = {};
    info.cells.forEach(c => {
      if (c !== '') counts[c] = (counts[c] || 0) + 1;
    });
    S.inputs[key].forEach((input, i) => {
      const c = info.cells[i];
      input.classList.toggle('bad', c !== '' && counts[c] > 1);
      input.classList.toggle('blank', c === '_');
    });
  }

  function setStatus(kind, html, icon) {
    el.puzzleStatus.className = `status ${kind}`;
    el.puzzleStatus.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i><span>${html}</span>`;
  }

  function validatePuzzle() {
    const s = readGrid('start');
    const g = readGrid('goal');
    markDuplicates('start', s);
    markDuplicates('goal', g);
    el.btnFixSolvable.classList.add('d-none');
    S.ready = false;
    if (!s.complete || !g.complete) {
      setStatus('', 'Fill every cell of both grids (tiles 1–8 and one blank).', 'bi-info-circle');
    } else if (!s.valid || !g.valid) {
      const which = !s.valid ? 'Initial' : 'Goal';
      setStatus('bad', `${which} state is not valid: use each of 1–8 exactly once and one blank.`, 'bi-exclamation-triangle');
    } else if (!P.isSolvable(s.raw, g.raw)) {
      setStatus(
        'bad',
        'This puzzle is <b>unsolvable</b>: the initial and goal states have different inversion parity, so no sequence of moves connects them.',
        'bi-x-octagon'
      );
      el.btnFixSolvable.classList.remove('d-none');
    } else {
      S.ready = true;
      AppState.start = s.raw;
      AppState.goal = g.raw;
      const same = s.raw === g.raw;
      setStatus(
        'ok',
        same ? 'Valid. The initial state already equals the goal (0 moves).' : `Valid and solvable. Initial h(n): Manhattan ${P.manhattan(s.raw, g.raw)}, Misplaced ${P.misplaced(s.raw, g.raw)}.`,
        'bi-check-circle'
      );
    }
    updateButtons();
    return S.ready;
  }

  function invalidate(message) {
    if (S.timeline || S.playing) resetView(message);
  }

  function onPuzzleEdited() {
    const ok = validatePuzzle();
    invalidate();
    if (ok) {
      S.boards.start.set(AppState.start, false);
      S.boards.goal.set(AppState.goal, false);
      S.boards.current.setGoal(AppState.goal);
      if (!S.timeline) S.boards.current.set(AppState.start, false);
      renderIdle();
    }
  }

  function setPuzzle(start, goal) {
    writeGrid('start', start);
    writeGrid('goal', goal);
    onPuzzleEdited();
  }

  function applyOptionVisibility() {
    const meta = algoMeta();
    el.depthWrap.classList.toggle('d-none', !meta.needsDepth);
    document.getElementById('heurWrap').classList.toggle('d-none', !meta.needsHeuristic);
    el.tileH.classList.toggle('d-none', !meta.needsHeuristic);
    el.tileF.classList.toggle('d-none', !meta.needsHeuristic);
    el.tileIter.classList.toggle('d-none', !(meta.id === 'dls' || meta.id === 'iddls'));
    el.algoBlurb.textContent = INFO[meta.id].description;
    el.frontierHint.textContent = FRONTIER_HINT[meta.id];
    el.assignedChip.classList.toggle('chip-accent', meta.id === 'dfs');
  }

  function getOptions() {
    const depth = parseInt(el.depthLimit.value, 10);
    return {
      depthLimit: Number.isFinite(depth) ? Math.min(60, Math.max(0, depth)) : 10,
      heuristic: el.heurMisplaced.checked ? 'misplaced' : 'manhattan',
      order: el.orderSelect.value,
      maxExpansions: parseInt(el.capSelect.value, 10),
      trace: true
    };
  }

  function setBusy(on, text) {
    S.busy = on;
    el.busy.hidden = !on;
    if (text) el.busyText.textContent = text;
    updateButtons();
  }

  async function run(autoplay) {
    clearError();
    if (!validatePuzzle()) {
      showError('Fix the puzzle first: ' + (el.puzzleStatus.textContent || 'the states are not valid.'));
      return false;
    }
    pause();
    const meta = algoMeta();
    setBusy(true, `Running ${meta.name}…`);
    await delay(50);
    let ok = false;
    try {
      const opts = getOptions();
      const result = A.analyze(meta.id, AppState.start, AppState.goal, opts);
      S.result = result;
      S.timeline = A.timeline(result);
      S.searchEnd = result.events.length - 1;
      S.optimal = null;
      if (result.found && !OPTIMAL_ALGOS.includes(meta.id)) {
        const ref = A.analyze('astar', AppState.start, AppState.goal, { heuristic: 'manhattan', maxExpansions: 400000 });
        S.optimal = ref.found ? ref.moves.length : null;
      }
      S.idx = 0;
      S.summaryFor = null;
      buildPath();
      ok = true;
    } catch (err) {
      showError(`Could not run the search: ${err.message}`);
      S.result = null;
      S.timeline = null;
    } finally {
      setBusy(false);
    }
    render();
    if (ok && autoplay) play();
    return ok;
  }

  function maxIdx() {
    return S.timeline ? S.timeline.length - 1 : 0;
  }

  function play() {
    if (!S.timeline) return;
    if (S.idx >= maxIdx()) S.idx = 0;
    S.playing = true;
    S.last = 0;
    S.acc = 0;
    applySpeedToBoard();
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(tick);
    el.narration.setAttribute('aria-live', 'off');
    render();
  }

  function pause() {
    if (!S.playing) return;
    S.playing = false;
    cancelAnimationFrame(S.raf);
    el.narration.setAttribute('aria-live', 'polite');
    updateButtons();
  }

  function tick(ts) {
    if (!S.playing) return;
    if (S.last) {
      const dt = Math.min(250, ts - S.last);
      S.acc += (dt * S.sps) / 1000;
    }
    S.last = ts;
    const n = Math.floor(S.acc);
    if (n > 0) {
      S.acc -= n;
      S.idx = Math.min(maxIdx(), S.idx + n);
      if (S.idx >= maxIdx()) {
        S.playing = false;
        el.narration.setAttribute('aria-live', 'polite');
      }
      render();
    }
    if (S.playing) S.raf = requestAnimationFrame(tick);
  }

  function goto(i) {
    if (!S.timeline) return;
    S.idx = Math.max(0, Math.min(maxIdx(), i));
    render();
  }

  async function next() {
    pause();
    if (!S.timeline) {
      const ok = await run(false);
      if (!ok) return;
    }
    goto(S.idx + 1);
  }

  function prev() {
    pause();
    goto(S.idx - 1);
  }

  function resetView(message) {
    pause();
    S.result = null;
    S.timeline = null;
    S.idx = 0;
    S.optimal = null;
    S.summaryFor = null;
    S.pathCards = [];
    S.pathGap = null;
    S.activeCard = null;
    clearError();
    renderIdle(message);
  }

  function applySpeedToBoard() {
    const ms = S.sps >= 30 ? 0 : Math.max(60, Math.min(380, 900 / S.sps));
    S.boards.current.setSpeed(ms);
  }

  function setSpeedFromSlider() {
    S.sps = SPEEDS[parseInt(el.speed.value, 10) - 1] || SPEEDS[4];
    el.speedLabel.textContent = `${S.sps < 1 ? S.sps : Math.round(S.sps)} steps/s`;
    applySpeedToBoard();
  }

  function updateButtons() {
    const has = !!S.timeline;
    const max = maxIdx();
    const busy = S.busy;
    el.btnRun.disabled = busy;
    el.btnRunMain.disabled = busy;
    el.btnPause.disabled = busy || !S.playing;
    el.btnResume.disabled = busy || !has || S.playing || S.idx >= max;
    el.btnPrev.disabled = busy || !has || S.idx <= 0;
    el.btnNext.disabled = busy || (has && S.idx >= max) || (!has && !S.ready);
    el.btnEnd.disabled = busy || !has || S.idx >= max;
    el.btnReset.disabled = busy;
    el.scrub.disabled = busy || !has;
    el.scrub.max = String(max);
    el.scrub.value = String(S.idx);
    el.stepLabel.textContent = has ? `Step ${fmt(S.idx)} / ${fmt(max)}` : 'Step 0 / 0';
  }

  function nodeHTML(item, opts) {
    const o = opts || {};
    const informed = isInformed();
    const parts = [`d${item.depth}`];
    if (informed && item.h !== null && item.h !== undefined) {
      parts.push(`g=${item.g !== undefined && item.g !== null ? item.g : item.depth}`);
      parts.push(`h=${item.h}`);
      parts.push(`f=${item.f}`);
    }
    const tag = o.status ? `<span class="tag tag-${o.status}">${{ added: 'new', improved: 'better path', explored: 'already explored', frontier: 'already in frontier' }[o.status]}</span>` : '';
    const mv = o.showMove ? `<span class="mv" title="blank moves ${P.MOVES[item.move].name}">${ARROW[item.move]}</span>` : '';
    const ord = o.order ? `<span class="ord">${o.order}</span>` : '';
    const skipped = o.status && o.status !== 'added' && o.status !== 'improved' ? ' is-skipped' : '';
    const next = o.isNext ? ' is-next' : '';
    return `<div class="node${skipped}${next}">${ord}${mv}${V.mini(item.state, { goal: AppState.goal })}<span class="meta">${parts.map(p => `<span>${p}</span>`).join('')}</span>${tag}</div>`;
  }

  function narrate(ev) {
    const meta = algoMeta();
    const informed = meta.needsHeuristic;
    switch (ev.kind) {
      case 'start':
        return `Start: the initial state goes into the frontier (a ${STRUCTURE[meta.id]}).`;
      case 'iteration':
        return ev.note + '.';
      case 'expand': {
        const added = ev.children.filter(c => c.status === 'added' || c.status === 'improved').length;
        const skipped = ev.children.length - added;
        const how = ev.move ? `reached by moving the blank ${P.MOVES[ev.move].name.toLowerCase()} ${ARROW[ev.move]}` : 'the start node';
        const vals = informed ? ` (g=${ev.g}, h=${ev.h}, f=${ev.f})` : '';
        let text = `Expanding the node ${how} at depth ${ev.depth}${vals}. `;
        text += `${added} successor${added === 1 ? '' : 's'} generated`;
        text += skipped ? `, ${skipped} skipped because ${skipped === 1 ? 'it was' : 'they were'} already seen.` : '.';
        return text;
      }
      case 'cutoff':
        return `Cutoff: this node is at the depth limit (${ev.limit}), so it is not expanded.`;
      case 'goal':
        return `Goal test passed at depth ${ev.depth}. Following the parent pointers back to the start gives the solution path.`;
      case 'fail':
      case 'limit':
        return ev.note;
      case 'path': {
        if (ev.index === 0) return `Solution replay: Step 0 is the initial state. ${fmt(ev.total)} move${ev.total === 1 ? '' : 's'} to go.`;
        const name = P.MOVES[ev.move].name.toLowerCase();
        if (ev.index === ev.total) return `Step ${fmt(ev.index)} of ${fmt(ev.total)}: slide the blank ${name} ${ARROW[ev.move]}. The goal state is reached.`;
        return `Step ${fmt(ev.index)} of ${fmt(ev.total)}: slide the blank ${name} ${ARROW[ev.move]}.`;
      }
      default:
        return '';
    }
  }

  function stateAt(i) {
    for (let j = i; j >= 0; j--) if (S.timeline[j].state) return S.timeline[j].state;
    return AppState.start;
  }

  function renderStats(stats, ev) {
    const zero = !stats;
    el.stGenerated.textContent = fmt(zero ? 0 : stats.generated);
    el.stExpanded.textContent = fmt(zero ? 0 : stats.expanded);
    el.stFrontier.textContent = fmt(zero ? 0 : stats.frontier);
    el.stExplored.textContent = fmt(zero ? 0 : stats.explored);
    el.stMaxDepth.textContent = fmt(zero ? 0 : stats.maxDepth);
    const hasNode = ev && ev.state;
    el.stDepth.textContent = hasNode ? fmt(ev.depth) : '–';
    el.stG.textContent = hasNode ? fmt(ev.g) : '–';
    el.stH.textContent = hasNode && ev.h !== null && ev.h !== undefined ? fmt(ev.h) : '–';
    el.stF.textContent = hasNode && ev.f !== null && ev.f !== undefined ? fmt(ev.f) : '–';
    if (algoId() === 'dls') {
      el.stIter.textContent = `limit ${getOptions().depthLimit}`;
    } else if (algoId() === 'iddls') {
      el.stIter.textContent = ev && ev.stats && ev.stats.iteration ? `#${ev.stats.iteration} · limit ${ev.stats.iteration - 1}` : '–';
    }
    el.stCurrent.innerHTML = hasNode ? V.mini(ev.state, { goal: AppState.goal, size: 'lg' }) : '–';
    if (hasNode) {
      el.stParent.innerHTML = ev.parent ? V.mini(ev.parent, { goal: AppState.goal, size: 'lg' }) : '<span class="empty">none (root)</span>';
    } else {
      el.stParent.textContent = '–';
    }
  }

  function renderLists(ev) {
    const stats = ev && ev.stats;
    el.frontierTitle.textContent = `Frontier (Open list) · ${fmt(stats ? stats.frontier : 0)} node${stats && stats.frontier === 1 ? '' : 's'}`;
    el.exploredTitle.textContent = `Explored (Closed list) · ${fmt(stats ? stats.explored : 0)} node${stats && stats.explored === 1 ? '' : 's'}`;
    if (ev && ev.frontier && ev.frontier.length) {
      el.frontierList.innerHTML = ev.frontier.map((n, i) => nodeHTML(n, { order: i + 1, isNext: i === 0 && ev.kind !== 'path' })).join('');
    } else {
      el.frontierList.innerHTML = `<span class="empty">${ev && ev.kind === 'path' ? 'Search finished.' : 'Empty.'}</span>`;
    }
    if (ev && ev.explored && ev.explored.length) {
      el.exploredList.innerHTML = ev.explored
        .map(s => `<div class="node">${V.mini(s, { goal: AppState.goal })}<span class="meta mono">${P.compact(s)}</span></div>`)
        .join('');
    } else {
      el.exploredList.innerHTML = '<span class="empty">Empty.</span>';
    }
    if (ev && ev.kind === 'expand') {
      el.childrenTitle.textContent = `Generated successor states · ${ev.children.length} legal move${ev.children.length === 1 ? '' : 's'}`;
      el.childrenList.innerHTML = ev.children.map(c => nodeHTML(c, { status: c.status, showMove: true })).join('');
    } else {
      el.childrenTitle.textContent = 'Generated successor states';
      let msg = 'Nothing expanded yet.';
      if (ev && ev.kind === 'cutoff') msg = 'Cutoff node: the depth limit stops it from generating successors.';
      else if (ev && ev.kind === 'path') msg = 'Search finished. The solution path is being replayed.';
      else if (ev && ev.kind === 'goal') msg = 'Goal reached. No more successors are needed.';
      else if (ev && (ev.kind === 'iteration' || ev.kind === 'start')) msg = 'Waiting for the first expansion.';
      else if (ev && (ev.kind === 'fail' || ev.kind === 'limit')) msg = 'The search has stopped.';
      el.childrenList.innerHTML = `<span class="empty">${msg}</span>`;
    }
  }

  function phaseOf(ev) {
    if (!ev) return ['Ready', ''];
    if (ev.kind === 'path') return ['Replaying solution', 'is-path'];
    if (ev.kind === 'goal') return ['Goal reached', 'is-path'];
    if (ev.kind === 'fail') return ['No solution', 'is-fail'];
    if (ev.kind === 'limit') return ['Limit reached', 'is-fail'];
    return ['Searching', 'is-search'];
  }

  function renderIdle(message) {
    S.boards.current.set(AppState.start, false);
    S.boards.current.setGoal(AppState.goal);
    renderStats(null, null);
    renderLists(null);
    el.curMove.hidden = true;
    el.narration.innerHTML = message || (S.ready ? 'Ready. Press <b>Run</b> to start the search, or <b>Next</b> to step through it.' : 'Set up a valid, solvable puzzle and press <b>Run</b>.');
    el.sampleNote.classList.add('d-none');
    el.phaseBadge.textContent = 'Ready';
    el.phaseBadge.className = 'phase';
    el.pathList.innerHTML = '<span class="empty">The solution path appears when a goal is found.</span>';
    el.pathCount.hidden = true;
    el.movesDetails.hidden = true;
    el.summary.innerHTML = '<p class="empty mb-0">Results appear when the search finishes. Press <b>Run</b> and let it play, or use the jump-to-end button.</p>';
    updateButtons();
  }

  function render() {
    if (!S.timeline) {
      renderIdle();
      return;
    }
    const ev = S.timeline[S.idx];
    const cur = ev.state || stateAt(S.idx);
    S.boards.current.set(cur, true);
    if (ev.move && (ev.kind === 'expand' || ev.kind === 'path' || ev.kind === 'goal')) {
      el.curMove.hidden = false;
      el.curMove.textContent = `blank ${ARROW[ev.move]}`;
    } else {
      el.curMove.hidden = true;
    }
    renderStats(ev.stats, ev.state ? ev : null);
    renderLists(ev);
    el.narration.textContent = narrate(ev);
    const [label, cls] = phaseOf(ev);
    el.phaseBadge.textContent = label;
    el.phaseBadge.className = `phase ${cls}`;
    if (S.result.stride > 1) {
      el.sampleNote.classList.remove('d-none');
      el.sampleNote.textContent = `To keep the animation readable, every ${S.result.stride}th node selection is shown (${fmt(S.result.events.length)} of about ${fmt(S.result.stats.steps)}). The counters and the summary come from the complete run.`;
    } else {
      el.sampleNote.classList.add('d-none');
    }
    renderPathHighlight(ev);
    if (S.idx >= S.searchEnd) renderSummary();
    else if (S.summaryFor) {
      S.summaryFor = null;
      el.summary.innerHTML = '<p class="empty mb-0">The search is still running. The summary appears when it finishes.</p>';
    }
    updateButtons();
  }

  function buildPath() {
    const r = S.result;
    S.pathCards = [];
    S.pathGap = null;
    S.activeCard = null;
    if (!r.found) {
      el.pathList.innerHTML = `<span class="empty">${V.esc(r.message)}</span>`;
      el.pathCount.hidden = true;
      el.movesDetails.hidden = true;
      return;
    }
    const n = r.moves.length;
    el.pathCount.hidden = false;
    el.pathCount.textContent = `${fmt(n)} move${n === 1 ? '' : 's'}`;
    const HEAD = 24;
    const TAIL = 24;
    const show = i => i <= HEAD || i > n - TAIL;
    let html = '';
    let gapDone = false;
    for (let i = 0; i <= n; i++) {
      if (!show(i) && i !== 0) {
        if (!gapDone) {
          html += `<div class="path-gap" id="pathGap">… ${fmt(n - HEAD - TAIL)} more moves …<br><small id="pathGapNow"></small></div>`;
          gapDone = true;
        }
        continue;
      }
      if (i > 0) {
        html += `<div class="step-arrow" aria-hidden="true">${ARROW[r.moves[i - 1]]}<small>${P.MOVES[r.moves[i - 1]].name}</small></div>`;
      }
      html += `<button type="button" class="step-card" data-i="${i}" aria-label="Jump to step ${i}"><span class="step-no-l">Step ${i}</span>${V.mini(r.states[i], { goal: AppState.goal, size: 'lg' })}</button>`;
    }
    el.pathList.innerHTML = html;
    S.pathCards = Array.from(el.pathList.querySelectorAll('.step-card'));
    S.pathGap = document.getElementById('pathGapNow');
    el.pathMoves.textContent = r.moves.map(m => ARROW[m]).join(' ');
    el.movesDetails.hidden = false;
  }

  function renderPathHighlight(ev) {
    const pathVisible = S.idx >= S.searchEnd;
    const stepIdx = ev.kind === 'path' ? ev.index : ev.kind === 'goal' ? -1 : -2;
    if (S.activeCard) {
      S.activeCard.classList.remove('is-active');
      S.activeCard = null;
    }
    S.pathCards.forEach(card => {
      const i = Number(card.dataset.i);
      card.classList.toggle('is-done', pathVisible && stepIdx >= 0 && i < stepIdx);
    });
    if (stepIdx >= 0) {
      const card = S.pathCards.find(c => Number(c.dataset.i) === stepIdx);
      if (card) {
        card.classList.add('is-active');
        S.activeCard = card;
        if (!S.playing || S.sps <= 15) {
          const box = el.pathList;
          box.scrollLeft = card.offsetLeft - box.clientWidth / 2 + card.clientWidth / 2;
        }
      }
      if (S.pathGap) S.pathGap.textContent = `now at step ${fmt(stepIdx)}`;
    }
  }

  function summaryTile(k, v, sub) {
    return `<div class="stat"><span class="stat-k">${k}</span><b class="stat-n">${v}</b>${sub ? `<span class="hint m-0">${sub}</span>` : ''}</div>`;
  }

  function renderSummary() {
    const r = S.result;
    if (S.summaryFor === r) return;
    S.summaryFor = r;
    const st = r.stats;
    const meta = algoMeta();
    const verdict = r.found
      ? '<span class="verdict yes"><i class="bi bi-check-circle-fill"></i> Solution Found</span>'
      : '<span class="verdict no"><i class="bi bi-x-circle-fill"></i> Solution Not Found</span>';
    const params = [`order: ${ORDER_LABEL[r.params.order]}`];
    if (r.params.depthLimit !== null) params.push(`depth limit: ${r.params.depthLimit}`);
    if (r.params.heuristic) params.push(`heuristic: ${P.HEURISTICS[r.params.heuristic].name}`);
    let tiles = '';
    tiles += summaryTile('Total moves', r.found ? fmt(r.moves.length) : '–');
    tiles += summaryTile('Nodes generated', fmt(st.generated));
    tiles += summaryTile('Nodes expanded', fmt(st.expanded));
    tiles += summaryTile('Maximum search depth', fmt(st.maxDepth));
    tiles += summaryTile('Execution time', A.formatTime(st.timeMs), 'search only, no animation');
    tiles += summaryTile('Path cost', r.found ? fmt(r.pathCost) : '–', 'one unit per move');
    tiles += summaryTile('Memory (approx.)', A.formatBytes(st.memoryBytes), `peak ${fmt(st.peakNodes)} nodes × ~${A.NODE_BYTES} B`);
    tiles += summaryTile('Peak frontier', fmt(st.maxFrontier), `${fmt(st.duplicates)} repeats skipped`);
    if (meta.id === 'iddls') tiles += summaryTile('Iterations', fmt(st.iterations), 'depth limits tried');
    if (meta.id === 'dls' || meta.id === 'iddls') tiles += summaryTile('Cutoffs', fmt(st.cutoffs), 'nodes stopped by the limit');
    let note = '';
    if (r.found) {
      const n = r.moves.length;
      if (S.optimal !== null && !OPTIMAL_ALGOS.includes(meta.id)) {
        if (n === S.optimal) {
          note = `${meta.short} found a solution of ${fmt(n)} moves, which matches the shortest possible length (checked with A*).`;
        } else {
          const ratio = n / Math.max(1, S.optimal);
          note = `${meta.short} found a valid solution of <b>${fmt(n)} moves</b>, but the shortest solution is only <b>${fmt(S.optimal)}</b> (checked with A*), so this path is ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× longer. ${meta.short} returns the first solution it meets, not the best one.`;
        }
      } else if (OPTIMAL_ALGOS.includes(meta.id)) {
        note = `${meta.short} is optimal for unit step costs, so ${fmt(n)} moves is the shortest possible solution.`;
      }
    } else {
      note = V.esc(r.message);
    }
    el.summary.innerHTML = `
      <div class="sum-head">${verdict}<span class="chip">${V.esc(meta.name)}</span><span class="hint m-0">${V.esc(params.join(' · '))}</span></div>
      <div class="sum-grid">${tiles}</div>
      ${note ? `<div class="sum-note">${note}</div>` : ''}`;
  }

  function fixSolvable() {
    const s = readGrid('start');
    if (!s.valid) return;
    const cells = s.raw.split('');
    const idxs = [];
    for (let i = 0; i < cells.length && idxs.length < 2; i++) if (cells[i] !== P.BLANK) idxs.push(i);
    const t = cells[idxs[0]];
    cells[idxs[0]] = cells[idxs[1]];
    cells[idxs[1]] = t;
    writeGrid('start', cells.join(''));
    onPuzzleEdited();
  }

  function randomPuzzle() {
    const g = readGrid('goal');
    const goal = g.valid ? g.raw : AppState.goal;
    if (!g.valid) writeGrid('goal', goal);
    const start = P.generate(goal, el.difficulty.value);
    writeGrid('start', start);
    onPuzzleEdited();
  }

  async function copyMoves() {
    const text = el.pathMoves.textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e2) {
        showError('Copy failed. Select the text and copy it manually.');
      }
      ta.remove();
    }
    const old = el.btnCopyMoves.innerHTML;
    el.btnCopyMoves.innerHTML = '<i class="bi bi-check2"></i> Copied';
    setTimeout(() => (el.btnCopyMoves.innerHTML = old), 1300);
  }

  function populateSelects() {
    el.algoSelect.innerHTML =
      A.ALGORITHMS.filter(a => !a.bonus)
        .map(a => `<option value="${a.id}">${a.short} · ${a.name}${a.id === 'dfs' ? ' ★ assigned' : ''}</option>`)
        .join('') +
      `<optgroup label="Bonus">${A.ALGORITHMS.filter(a => a.bonus).map(a => `<option value="${a.id}">${a.short} · ${a.name}</option>`).join('')}</optgroup>`;
    el.algoSelect.value = 'dfs';
    el.orderSelect.innerHTML = P.ORDERS.map(o => `<option value="${o}">${ORDER_LABEL[o]}${o === P.DEFAULT_ORDER ? ' (default)' : ''}</option>`).join('');
    el.difficulty.innerHTML = Object.values(P.DIFFICULTIES).map(d => `<option value="${d.id}"${d.id === 'medium' ? ' selected' : ''}>${d.name}</option>`).join('');
  }

  function bind() {
    el.btnRun.addEventListener('click', () => run(true));
    el.btnRunMain.addEventListener('click', () => run(true));
    el.btnPause.addEventListener('click', pause);
    el.btnResume.addEventListener('click', play);
    el.btnNext.addEventListener('click', next);
    el.btnPrev.addEventListener('click', prev);
    el.btnEnd.addEventListener('click', () => {
      pause();
      goto(maxIdx());
    });
    el.btnReset.addEventListener('click', () => resetView('Reset. Press <b>Run</b> to search again.'));
    el.speed.addEventListener('input', setSpeedFromSlider);
    el.scrub.addEventListener('input', () => {
      pause();
      goto(parseInt(el.scrub.value, 10));
    });
    el.btnRandom.addEventListener('click', randomPuzzle);
    el.btnFixSolvable.addEventListener('click', fixSolvable);
    el.btnExample.addEventListener('click', () => setPuzzle(P.EXAMPLE_START, P.SNAIL_GOAL));
    el.btnStdGoal.addEventListener('click', () => {
      writeGrid('goal', P.STANDARD_GOAL);
      onPuzzleEdited();
    });
    el.btnSnailGoal.addEventListener('click', () => {
      writeGrid('goal', P.SNAIL_GOAL);
      onPuzzleEdited();
    });
    el.btnSwapStates.addEventListener('click', () => {
      const s = readGrid('start');
      const g = readGrid('goal');
      if (s.complete && g.complete) {
        writeGrid('start', g.raw);
        writeGrid('goal', s.raw);
        onPuzzleEdited();
      }
    });
    el.algoSelect.addEventListener('change', () => {
      applyOptionVisibility();
      invalidate('Algorithm changed. Press <b>Run</b> to search again.');
    });
    [el.depthLimit, el.orderSelect, el.capSelect, el.heurManhattan, el.heurMisplaced].forEach(c =>
      c.addEventListener('change', () => invalidate('Settings changed. Press <b>Run</b> to search again.'))
    );
    el.btnCopyMoves.addEventListener('click', copyMoves);
    el.pathList.addEventListener('click', e => {
      const card = e.target.closest('.step-card');
      if (!card || !S.timeline) return;
      pause();
      goto(S.searchEnd + 1 + Number(card.dataset.i));
    });
    document.addEventListener('keydown', e => {
      const page = document.getElementById('page-solver');
      if (!page || page.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'select', 'textarea', 'button', 'a', 'summary'].includes(tag)) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (S.playing) pause();
        else if (S.timeline && S.idx < maxIdx()) play();
        else run(true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
    });
  }

  function init() {
    const missing = IDS.filter(id => !document.getElementById(id));
    if (missing.length) throw new Error('Missing elements: ' + missing.join(', '));
    IDS.forEach(id => (el[id] = document.getElementById(id)));
    populateSelects();
    buildGrid(el.startInputs, 'start');
    buildGrid(el.goalInputs, 'goal');
    S.boards.start = new V.LiveBoard(el.boardStart);
    S.boards.current = new V.LiveBoard(el.boardCurrent, { goal: AppState.goal });
    S.boards.goal = new V.LiveBoard(el.boardGoal);
    bind();
    applyOptionVisibility();
    setSpeedFromSlider();
    writeGrid('start', AppState.start);
    writeGrid('goal', AppState.goal);
    validatePuzzle();
    S.boards.start.set(AppState.start, false);
    S.boards.goal.set(AppState.goal, false);
    renderIdle();
  }

  root.Solver = {
    init,
    setPuzzle,
    getPuzzle: () => ({ start: AppState.start, goal: AppState.goal }),
    pause,
    state: S
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
