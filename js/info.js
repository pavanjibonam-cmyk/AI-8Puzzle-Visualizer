(function (root) {
  const INFO = {
    bfs: {
      description:
        'Breadth-First Search explores the state space level by level. It expands every node at depth d before any node at depth d + 1, using a FIFO queue as the frontier.',
      principle:
        'Remove the oldest node from the queue, test it for the goal, expand it, and append its unseen successors to the back of the queue. An explored set stops the same board from being queued twice.',
      pros: [
        'Complete: always finds a solution if one exists.',
        'Optimal for unit step costs: the first solution found has the fewest moves.',
        'Simple to implement and reason about.'
      ],
      cons: [
        'Stores every node of the current level, so memory grows exponentially.',
        'Slow and memory-hungry on deep puzzles (up to all 181,440 reachable states).',
        'Ignores any knowledge about where the goal is.'
      ],
      time: 'O(b^d)',
      space: 'O(b^d)',
      complete: 'Yes (finite branching factor)',
      optimal: 'Yes, when every move costs the same',
      note: 'For the 8-puzzle b ≤ 4, so the worst case visits all 181,440 reachable boards. The hardest boards need 31 moves.'
    },
    dfs: {
      description:
        'Depth-First Search always expands the deepest node in the frontier. It dives down one branch as far as it can before backing up, using a LIFO stack as the frontier.',
      principle:
        'Pop the newest node from the stack, test it for the goal, and push its unseen successors. Successors are pushed in reverse so the first move in the chosen order is explored first. An explored set prevents the endless back-and-forth loops that plain DFS suffers on the 8-puzzle.',
      pros: [
        'Very small frontier in tree form: only the current branch (O(b·m)) is stored.',
        'Finds a solution quickly when it happens to dive down the right branch.',
        'With an explored set it is complete on the 8-puzzle because the space is finite.'
      ],
      cons: [
        'Not optimal: solutions are usually hundreds or thousands of moves longer than necessary.',
        'Result depends heavily on the move order (Up/Down/Left/Right priority).',
        'Without an explored set it can loop forever; with one, memory grows to the size of the explored region.'
      ],
      time: 'O(b^m)',
      space: 'O(b·m) as a tree search, O(states) with an explored set',
      complete: 'No in general; Yes on the 8-puzzle once an explored set is used (finite space)',
      optimal: 'No',
      note: 'This is the algorithm assigned to registration number 24BCI0083. The explored set caps the work at 181,440 expansions, but the path found is typically very long compared with BFS.'
    },
    dls: {
      description:
        'Depth-Limited Search is DFS with a cut-off. Nodes at the depth limit l are treated as if they had no successors, which stops the search from running away down an infinitely deep branch.',
      principle:
        'Run DFS, but never expand a node whose depth equals l. This version also remembers the shallowest depth at which each board was expanded and re-expands a board when it is reached via a shorter route, so a solution within the limit is never missed.',
      pros: [
        'Guaranteed to terminate, and needs memory proportional to the limit only.',
        'Good when a bound on the solution depth is known.',
        'Building block for Iterative Deepening.'
      ],
      cons: [
        'Incomplete when the limit is smaller than the shallowest solution (it reports a cut-off).',
        'Not optimal: it may return a solution that is deeper than the best one.',
        'Choosing a good limit needs knowledge about the problem.'
      ],
      time: 'O(b^l)',
      space: 'O(b·l)',
      complete: 'No (only if l ≥ d)',
      optimal: 'No',
      note: 'Every 8-puzzle board is at most 31 moves from the standard goal, so a limit of 31 or more always succeeds on solvable puzzles, but may return a long path.'
    },
    iddls: {
      description:
        'Iterative Deepening Depth-Limited Search repeats Depth-Limited Search with limits 0, 1, 2, 3 and so on until a solution appears. It combines the shallow-first guarantee of BFS with the small frontier of DFS.',
      principle:
        'For l = 0, 1, 2, …: run DLS with limit l from scratch. The first limit that succeeds yields a shortest solution. Work in earlier iterations is repeated, but the deepest level dominates the total cost.',
      pros: [
        'Complete and optimal for unit step costs, like BFS.',
        'Frontier stays small (O(b·d)), like DFS.',
        'No need to guess a depth limit.'
      ],
      cons: [
        'Repeats the work of shallow levels in every iteration.',
        'Without an explored set, it re-expands the same boards many times; this build keeps a depth-aware table to bound that cost.',
        'Still exponential in the solution depth.'
      ],
      time: 'O(b^d)',
      space: 'O(b·d)',
      complete: 'Yes',
      optimal: 'Yes, when every move costs the same',
      note: 'On 31-move boards IDDLS needs several million expansions, so the safety cap may stop it. That is a real property of the algorithm, not a bug.'
    },
    gbfs: {
      description:
        'Greedy Best-First Search always expands the node that looks closest to the goal according to a heuristic h(n). It ignores the cost already paid to reach the node.',
      principle:
        'Keep the frontier in a priority queue ordered by h(n) only. Pop the lowest h, test for the goal, expand it, and insert unseen successors. Misplaced Tiles or Manhattan Distance can be chosen as h.',
      pros: [
        'Often reaches the goal after expanding very few nodes.',
        'Fast and light when the heuristic is informative.',
        'Simple extension of uninformed search.'
      ],
      cons: [
        'Not optimal: it can pick a long route that merely looks promising.',
        'Can be misled by local minima in h.',
        'Without an explored set it may loop; worst-case time and space are exponential.'
      ],
      time: 'O(b^m) worst case, usually far better',
      space: 'O(b^m) worst case',
      complete: 'No in general; Yes on a finite space with an explored set',
      optimal: 'No',
      note: 'f(n) is shown for reference but ordering uses h(n) alone.'
    },
    astar: {
      description:
        'A* Search expands the node with the smallest f(n) = g(n) + h(n), where g(n) is the cost paid so far and h(n) estimates the remaining cost. It balances what has been spent with what is left.',
      principle:
        'Keep a priority queue ordered by f(n), breaking ties by lower h. If a cheaper route to a known board is found, replace the older entry. With an admissible and consistent heuristic the first time the goal is popped its path is optimal.',
      pros: [
        'Complete and optimal with an admissible heuristic (both heuristics here are admissible and consistent).',
        'Expands far fewer nodes than BFS because h steers the search.',
        'Optimally efficient among algorithms using the same heuristic.'
      ],
      cons: [
        'Keeps all generated nodes in memory, so space is still exponential.',
        'Quality depends on the heuristic: Misplaced Tiles is weak, Manhattan Distance is much stronger.',
        'Priority queue operations add overhead per node.'
      ],
      time: 'O(b^d) worst case, much lower with a good heuristic',
      space: 'O(b^d)',
      complete: 'Yes',
      optimal: 'Yes, with an admissible heuristic',
      note: 'Manhattan Distance dominates Misplaced Tiles (h2 ≥ h1), so A* with Manhattan never expands more nodes than with Misplaced Tiles, ties aside.'
    },
    ucs: {
      description:
        'Uniform Cost Search expands the node with the lowest path cost g(n). It is the general form of BFS for problems where actions have different costs.',
      principle:
        'Keep a priority queue ordered by g(n). Pop the cheapest node, test it for the goal, expand it, and queue cheaper routes to boards already seen.',
      pros: ['Complete and optimal for any positive step costs.', 'Needs no heuristic.'],
      cons: ['Explores in all directions like BFS.', 'Exponential memory.'],
      time: 'O(b^(1 + ⌊C*/ε⌋))',
      space: 'O(b^(1 + ⌊C*/ε⌋))',
      complete: 'Yes',
      optimal: 'Yes',
      note: 'Every 8-puzzle move costs 1, so UCS behaves exactly like BFS here. Included as a bonus because it is listed in the assignment.'
    }
  };

  const HEURISTICS = {
    misplaced: {
      name: 'Misplaced Tiles',
      formula: 'h₁(n) = number of tiles (blank excluded) that are not on their goal square',
      detail:
        'Counts how many tiles are in the wrong place. Every misplaced tile needs at least one move, so h₁ never overestimates: it is admissible. It is cheap but coarse.',
      example: 'For 2 8 3 / 1 6 4 / 7 _ 5 against 1 2 3 / 8 _ 4 / 7 6 5 the misplaced tiles are 2, 8, 1 and 6, so h₁ = 4.'
    },
    manhattan: {
      name: 'Manhattan Distance',
      formula: 'h₂(n) = Σ over tiles of ( |row − goal row| + |column − goal column| )',
      detail:
        'Adds up how many squares each tile must travel horizontally and vertically. Each move shifts one tile by one square, so h₂ never overestimates: it is admissible and also consistent. It dominates h₁ (h₂ ≥ h₁), which makes A* much faster.',
      example: 'For the same board: tile 2 is 1 square away, tile 8 is 2, tile 1 is 1, tile 6 is 1 and the rest are home, so h₂ = 5.'
    }
  };

  root.AlgoInfo = INFO;
  root.HeuristicInfo = HEURISTICS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
