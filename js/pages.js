(function (root) {
  const A = root.Algorithms;
  const INFO = root.AlgoInfo;
  const HEUR = root.HeuristicInfo;
  const V = root.BoardView;

  const PSEUDO = {
    bfs: `frontier ← queue containing start
explored ← empty set
while frontier is not empty:
    node ← frontier.popFront()
    if node = goal: return path(node)
    explored.add(node)
    for each child of expand(node):
        if child not in explored and not in frontier:
            frontier.pushBack(child)
return failure`,
    dfs: `frontier ← stack containing start
explored ← empty set
while frontier is not empty:
    node ← frontier.pop()
    if node in explored: continue
    if node = goal: return path(node)
    explored.add(node)
    for each child of expand(node), in reverse move order:
        if child not in explored: frontier.push(child)
return failure`,
    dls: `DLS(limit):
    frontier ← stack containing start
    bestDepth ← empty map;  cutoff ← false
    while frontier is not empty:
        node ← frontier.pop()
        if node = goal: return path(node)
        if bestDepth[node] ≤ depth(node): continue
        if depth(node) = limit: cutoff ← true; continue
        bestDepth[node] ← depth(node)
        push every child that is new or reached at a smaller depth
    return cutoff ? "cutoff" : failure`,
    iddls: `for limit ← 0, 1, 2, 3, …:
    result ← DLS(limit)
    if result is not "cutoff": return result`,
    gbfs: `frontier ← priority queue ordered by h(n), containing start
explored ← empty set
while frontier is not empty:
    node ← frontier.popLowestH()
    if node = goal: return path(node)
    explored.add(node)
    for each child of expand(node):
        if child not in explored and not in frontier:
            frontier.push(child, key = h(child))
return failure`,
    astar: `frontier ← priority queue ordered by f = g + h, containing start
closed ← empty map
while frontier is not empty:
    node ← frontier.popLowestF()
    if node = goal: return path(node)
    closed[node] ← g(node)
    for each child of expand(node):
        g' ← g(node) + 1
        if closed[child] ≤ g' or frontier holds child with g ≤ g': continue
        frontier.push(child, key = g' + h(child))
return failure`,
    ucs: `frontier ← priority queue ordered by g(n), containing start
closed ← empty map
while frontier is not empty:
    node ← frontier.popLowestG()
    if node = goal: return path(node)
    closed[node] ← g(node)
    for each child of expand(node):
        g' ← g(node) + 1
        if child is new or g' is cheaper than before: frontier.push(child, key = g')
return failure`
  };

  function list(items) {
    return `<ul>${items.map(i => `<li>${V.esc(i)}</li>`).join('')}</ul>`;
  }

  function renderDetail(id) {
    const meta = A.byId(id);
    const d = INFO[id];
    const chips = [];
    if (id === 'dfs') chips.push('<span class="chip chip-accent"><i class="bi bi-person-badge"></i> Assigned to 24BCI0083</span>');
    if (meta.bonus) chips.push('<span class="chip">Bonus</span>');
    chips.push(`<span class="chip">${meta.needsHeuristic ? 'Informed' : 'Uninformed'}</span>`);
    document.getElementById('algoDetail').innerHTML = `
      <h2>${V.esc(meta.name)} <small class="text-secondary fw-normal">(${V.esc(meta.short)})</small> ${chips.join(' ')}</h2>
      <h3>Description</h3><p>${V.esc(d.description)}</p>
      <h3>Working principle</h3><p>${V.esc(d.principle)}</p>
      <h3>Pseudocode</h3><pre class="formula mb-0">${V.esc(PSEUDO[id])}</pre>
      <div class="row g-4">
        <div class="col-md-6"><h3>Advantages</h3>${list(d.pros)}</div>
        <div class="col-md-6"><h3>Limitations</h3>${list(d.cons)}</div>
      </div>
      <h3>Properties</h3>
      <div class="prop-grid">
        <div class="prop"><b>Time complexity</b><span>${V.esc(d.time)}</span></div>
        <div class="prop"><b>Space complexity</b><span>${V.esc(d.space)}</span></div>
        <div class="prop"><b>Completeness</b><span>${V.esc(d.complete)}</span></div>
        <div class="prop"><b>Optimality</b><span>${V.esc(d.optimal)}</span></div>
      </div>
      <p class="hint mt-2 mb-0">b = branching factor (at most 4), d = depth of the shallowest solution, m = maximum depth, l = depth limit.</p>
      <div class="note-box"><b>On the 8-puzzle.</b> ${V.esc(d.note)}</div>
      <div class="mt-3"><a class="btn btn-accent" href="#solver" data-route="solver" data-algo="${id}"><i class="bi bi-play-fill"></i> Try ${V.esc(meta.short)} in the Solver</a></div>`;
  }

  function selectAlgo(id) {
    document.querySelectorAll('#algoTabs .nav-link').forEach(b => {
      const on = b.dataset.id === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    renderDetail(id);
    document.getElementById('algoDetail').setAttribute('aria-labelledby', `tab-${id}`);
  }

  function init() {
    const tabs = document.getElementById('algoTabs');
    tabs.innerHTML = A.ALGORITHMS.map(
      a => `<li class="nav-item" role="presentation"><button class="nav-link" id="tab-${a.id}" type="button" role="tab" data-id="${a.id}" aria-selected="false">${a.short}${a.id === 'dfs' ? ' ★' : ''}</button></li>`
    ).join('');
    tabs.addEventListener('click', e => {
      const b = e.target.closest('.nav-link');
      if (b) selectAlgo(b.dataset.id);
    });
    tabs.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const btns = Array.from(tabs.querySelectorAll('.nav-link'));
      const i = btns.findIndex(b => b.classList.contains('active'));
      const n = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
      n.focus();
      selectAlgo(n.dataset.id);
    });
    document.getElementById('algoDetail').addEventListener('click', e => {
      const link = e.target.closest('[data-algo]');
      if (link) root.pendingAlgo = link.dataset.algo;
    });
    selectAlgo('dfs');

    document.querySelector('#theoryTable tbody').innerHTML = A.ALGORITHMS.map(a => {
      const d = INFO[a.id];
      return `<tr${a.id === 'dfs' ? ' class="is-assigned"' : ''}><th scope="row" class="algo-name">${a.short}<small>${V.esc(a.name)}</small></th><td class="mono">${V.esc(d.time)}</td><td class="mono">${V.esc(d.space)}</td><td>${V.esc(d.complete)}</td><td>${V.esc(d.optimal)}</td></tr>`;
    }).join('');

    document.getElementById('heuristicCards').innerHTML = Object.keys(HEUR)
      .map(k => {
        const h = HEUR[k];
        return `<div class="col-lg-6"><div class="panel h-100 mb-0"><h3 class="h5">${V.esc(h.name)}</h3><p class="formula">${V.esc(h.formula)}</p><p>${V.esc(h.detail)}</p><p class="hint mb-0">${V.esc(h.example)}</p></div></div>`;
      })
      .join('');
  }

  root.Pages = { init, selectAlgo };
})(typeof globalThis !== 'undefined' ? globalThis : this);
