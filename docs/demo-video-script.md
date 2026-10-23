# Demo video script (target 4:00, limit 3-5 minutes)

Record the live GitHub Pages site. Use the brief's example (it is preloaded).

**0:00 Intro (20 s).** "I am Bonam Pavanji, 24BCI0083. This is my 8-puzzle solver for Artificial Intelligence. My assigned algorithm is DFS, but the app implements all the algorithms in the brief." Show the Home page and navigation.

**0:20 Puzzle input (30 s).** Solver page. Show the two grids and the example. Type a duplicate tile to show validation. Make an unsolvable puzzle and click *Make it solvable*. Click *Generate Random Puzzle* with different difficulties.

**0:50 DFS, the assigned algorithm (75 s).**
- Select DFS, press Run. Point out the animated blank, current node, parent, depth, frontier as a **stack**, explored list, generated and expanded counters.
- Use Pause, Next Step, Previous Step, the speed slider and the timeline.
- Jump to the end. Open the summary: a valid path, but about 100,000 moves with the default order, while the shortest is 5. Explain why: DFS returns the first solution it meets, and move order decides it. Change the move order under Advanced options and run again.
- Mention the explored set: without it DFS loops forever; with it DFS is complete here.

**2:05 Other algorithms (50 s).** Run BFS (optimal, queue), DLS with limit 4 then 5 (cutoff vs found), IDDLS (repeats limits 0, 1, 2…), then GBFS and A*.

**2:55 Heuristics (30 s).** Select A*. Show the Manhattan and Misplaced Tiles radio buttons, and h(n), g(n), f(n) = g + h updating. State the formulas. Compare expanded nodes for both heuristics.

**3:25 Comparison page (30 s).** Run all algorithms, read the table: BFS/IDDLS/A* optimal, GBFS/A* expand the fewest nodes, DFS long. Show *Both* heuristics.

**3:55 Wrap-up (15 s).** Algorithm Information page, theme toggle, mobile view, GitHub Pages deployment, tests.
