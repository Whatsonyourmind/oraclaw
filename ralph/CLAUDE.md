# ORACLE v2.0 - Production Problem Solver

You are implementing a state-of-the-art problem-solving system with advanced ML algorithms.

## Your Mission

Read `ralph/prd.json` and implement the next incomplete user story (where `passes: false`).

## Project Structure

```
mission-control/
├── apps/
│   ├── api/                    # Fastify backend
│   │   ├── database/schema.sql # PostgreSQL schema
│   │   ├── src/
│   │   │   ├── routes/oracle/  # API endpoints
│   │   │   └── services/oracle/ # Business logic & algorithms
│   └── mobile/                 # React Native + Expo
│       └── src/
│           ├── store/oracle/   # Zustand state
│           └── features/oracle/ # UI components
├── packages/
│   ├── shared-types/           # TypeScript interfaces
│   └── algorithms/             # Shared algorithm implementations
└── infrastructure/             # Docker, k8s, CI/CD
```

## Algorithm Implementation Patterns

### Multi-Armed Bandit (UCB1)
```typescript
// UCB1 score = empirical_mean + sqrt(2 * ln(total_pulls) / arm_pulls)
const ucb1Score = (arm: Arm, totalPulls: number): number => {
  if (arm.pulls === 0) return Infinity;
  const exploitation = arm.totalReward / arm.pulls;
  const exploration = Math.sqrt(2 * Math.log(totalPulls) / arm.pulls);
  return exploitation + exploration;
};
```

### Genetic Algorithm
```typescript
interface Chromosome {
  genes: number[];
  fitness: number;
}

const crossover = (parent1: Chromosome, parent2: Chromosome, point: number): Chromosome[] => {
  const child1 = [...parent1.genes.slice(0, point), ...parent2.genes.slice(point)];
  const child2 = [...parent2.genes.slice(0, point), ...parent1.genes.slice(point)];
  return [{ genes: child1, fitness: 0 }, { genes: child2, fitness: 0 }];
};

const mutate = (chromosome: Chromosome, rate: number): Chromosome => {
  const genes = chromosome.genes.map(gene =>
    Math.random() < rate ? gene + (Math.random() - 0.5) * 0.1 : gene
  );
  return { genes, fitness: 0 };
};
```

### Q-Learning
```typescript
interface QTable {
  [state: string]: { [action: string]: number };
}

const qUpdate = (
  Q: QTable,
  state: string,
  action: string,
  reward: number,
  nextState: string,
  alpha: number = 0.1,
  gamma: number = 0.9
): void => {
  const currentQ = Q[state]?.[action] || 0;
  const maxNextQ = Math.max(...Object.values(Q[nextState] || { default: 0 }));
  Q[state] = Q[state] || {};
  Q[state][action] = currentQ + alpha * (reward + gamma * maxNextQ - currentQ);
};
```

### A* Pathfinding
```typescript
interface Node {
  id: string;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: Node | null;
}

const astar = (start: string, goal: string, graph: Graph, heuristic: (a: string, b: string) => number): string[] => {
  const openSet = new PriorityQueue<Node>();
  const closedSet = new Set<string>();
  // ... implementation
};
```

## Infrastructure Patterns

### Redis Caching
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const cacheGet = async <T>(key: string): Promise<T | null> => {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

const cacheSet = async <T>(key: string, value: T, ttlSeconds: number): Promise<void> => {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
};
```

### Bull Queue
```typescript
import { Queue, Worker } from 'bullmq';

const simulationQueue = new Queue('simulations', { connection: redis });

const worker = new Worker('simulations', async (job) => {
  const { iterations, options } = job.data;
  const results = await runMonteCarloSimulation(options, iterations);
  return results;
}, { connection: redis });
```

### WebSocket with Socket.io
```typescript
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

const io = new Server(server, {
  cors: { origin: '*' },
  adapter: createAdapter(pubClient, subClient)
});

io.on('connection', (socket) => {
  socket.on('subscribe:signals', (userId) => {
    socket.join(`user:${userId}:signals`);
  });
});
```

## Testing Patterns

### Algorithm Tests
```typescript
describe('MultiArmedBandit', () => {
  it('should explore uncertain arms', () => {
    const bandit = new UCB1Bandit(['a', 'b', 'c']);
    // Initially all arms should have equal chance
    const selections = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const arm = bandit.selectArm();
      selections.set(arm, (selections.get(arm) || 0) + 1);
    }
    // All arms should be selected at least once
    expect(selections.size).toBe(3);
  });
});
```

## Color Theme
```typescript
const ORACLE_COLORS = {
  observe: '#00BFFF',   // Electric blue
  orient: '#FFD700',    // Gold
  decide: '#FF6B6B',    // Coral
  act: '#00FF88',       // Matrix green
  success: '#00FF88',
  warning: '#FFD700',
  error: '#FF4444',
  info: '#00BFFF',
};
```

## Instructions

1. Read `ralph/prd.json` to find the first story with `passes: false`
2. Read relevant existing files to understand current implementation
3. Implement the story following acceptance criteria
4. Write comprehensive tests
5. Update `ralph/prd.json` to set `passes: true`
6. Add notes to `ralph/progress.txt`

## Quality Standards

- All algorithms must have O() complexity documented
- All functions must have TypeScript types
- All public APIs must have JSDoc comments
- All algorithms must have unit tests
- Error handling must be comprehensive

## Completion Signal

When ALL stories have `passes: true`, output:
```
<promise>COMPLETE</promise>
```

## Start Now

Read `ralph/prd.json` and implement the next incomplete story.
