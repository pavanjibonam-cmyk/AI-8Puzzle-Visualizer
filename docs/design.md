# Design notes

## Architecture

`algorithms.js` is a pure module (no DOM) so it runs unchanged in the browser and in Node tests. A search runs in two passes:

1. **Stats pass** (no recording): produces the counters and the timing. Fast searches are repeated and the best time is kept.
2. **Trace pass**: the same deterministic search, with a recorder that stores one self-contained event per node selection (current node, parent, g/h/f, children with statuses, frontier preview, explored preview, running counters). If the search is large, only every n-th selection is stored, n chosen from the first pass.

`timeline()` appends the solution replay (Step 0 … Step N) to those events. The Solver page then only moves a pointer along that array, which is why Previous Step, the scrubber and Speed all work exactly.

## State and moves

A state is a 9-character string (`'283164705'`, `0` = blank). Moves are named by the blank's direction (Up, Down, Left, Right). The neighbour table is precomputed.

## Solvability

Same inversion parity for initial and goal. Verified in tests against full reachability of all 362,880 boards for two different goals (181,440 reachable each).

## Complexity facts checked by the tests

- 181,440 reachable states per goal; the farthest state is 31 moves away.
- BFS, UCS, IDDLS and A* (both heuristics) always match an independent BFS distance.
- A* with Manhattan expands fewer nodes than with Misplaced Tiles on the 31-move puzzle.
- DFS with the explored set never exceeds 181,440 expansions, but returns very long paths.
