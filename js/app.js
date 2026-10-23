(function (root) {
  const P = root.Puzzle;
  const A = root.Algorithms;
  const V = root.BoardView;

  const ROUTES = ['home', 'solver', 'compare', 'algorithms'];
  const TITLES = { home: 'Home', solver: 'Solver', compare: 'Comparison', algorithms: 'Algorithm Information' };
  let current = null;
  let demo = null;

  function storedTheme() {
    try {
      return localStorage.getItem('puzzle-theme');
    } catch (e) {
      return null;
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    const icon = document.querySelector('#themeToggle i');
    if (icon) icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1020' : '#f4f1ea');
    try {
      localStorage.setItem('puzzle-theme', theme);
    } catch (e) {
      /* storage unavailable */
    }
  }

  function initTheme() {
    const saved = storedTheme();
    const prefersLight = root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(saved || (prefersLight ? 'light' : 'dark'));
    document.getElementById('themeToggle').addEventListener('click', () => {
      applyTheme(document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  function readRoute() {
    const r = (location.hash || '').replace(/^#\/?/, '');
    return ROUTES.includes(r) ? r : 'home';
  }

  function show(route) {
    if (current === 'solver' && route !== 'solver') root.Solver.pause();
    ROUTES.forEach(r => {
      document.getElementById(`page-${r}`).hidden = r !== route;
    });
    document.querySelectorAll('.app-nav .nav-link').forEach(a => {
      const on = a.dataset.route === route;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = `${TITLES[route]} | 8-Puzzle Solver`;
    const nav = document.getElementById('navMenu');
    if (nav.classList.contains('show') && root.bootstrap) {
      const inst = root.bootstrap.Collapse.getInstance(nav);
      if (inst) inst.hide();
    }
    if (route === 'solver' && root.pendingAlgo) {
      const sel = document.getElementById('algoSelect');
      sel.value = root.pendingAlgo;
      sel.dispatchEvent(new Event('change'));
      root.pendingAlgo = null;
    }
    if (route === 'compare') root.Compare.onEnter();
    if (current !== route) {
      root.scrollTo(0, 0);
      document.getElementById('main').focus({ preventScroll: true });
    }
    current = route;
  }

  function startDemo() {
    const host = document.getElementById('homeDemo');
    const caption = document.getElementById('homeDemoCaption');
    const result = A.analyze('astar', P.EXAMPLE_START, P.SNAIL_GOAL, { heuristic: 'manhattan' });
    const states = result.states;
    const board = new V.LiveBoard(host, { goal: P.SNAIL_GOAL });
    board.setSpeed(520);
    board.set(states[0], false);
    const still = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    caption.textContent = `Step 0 of ${result.moves.length}: scrambled`;
    if (still) return;
    let i = 0;
    let hold = 0;
    demo = setInterval(() => {
      if (current !== 'home' || document.hidden) return;
      if (hold > 0) {
        hold--;
        return;
      }
      if (i >= states.length - 1) {
        i = 0;
        hold = 2;
        board.set(states[0], false);
        caption.textContent = `Step 0 of ${result.moves.length}: scrambled`;
        return;
      }
      i++;
      board.set(states[i], true);
      caption.textContent =
        i === states.length - 1
          ? `Step ${i} of ${result.moves.length}: goal reached`
          : `Step ${i} of ${result.moves.length}: blank ${P.MOVES[result.moves[i - 1]].name.toLowerCase()}`;
      if (i === states.length - 1) hold = 3;
    }, 1000);
  }

  function fatal(err) {
    console.error(err);
    const box = document.createElement('div');
    box.className = 'alert alert-danger m-3';
    box.setAttribute('role', 'alert');
    box.textContent = `The application failed to start: ${err.message}`;
    document.body.prepend(box);
  }

  function boot() {
    try {
      initTheme();
      root.Pages.init();
      root.Solver.init();
      root.Compare.init();
      startDemo();
      root.addEventListener('hashchange', () => show(readRoute()));
      show(readRoute());
    } catch (err) {
      fatal(err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
