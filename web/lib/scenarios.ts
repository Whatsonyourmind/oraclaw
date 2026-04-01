import type { Scenario } from "@/components/ScenarioButtons";

export const ALGORITHM_SCENARIOS: Record<string, Scenario[]> = {
  bandit: [
    {
      name: "A/B Test Winner",
      description: "3 landing page variants with different conversion data",
      input: {
        arms: [
          { id: "page-a", name: "Original", pulls: 200, totalReward: 48 },
          { id: "page-b", name: "New Hero", pulls: 150, totalReward: 42 },
          { id: "page-c", name: "Video CTA", pulls: 50, totalReward: 18 },
        ],
        algorithm: "ucb1",
      },
    },
    {
      name: "Ad Budget Allocation",
      description: "Distribute budget across 4 ad channels with unknown ROI",
      input: {
        arms: [
          { id: "google", name: "Google Ads", pulls: 100, totalReward: 35 },
          { id: "meta", name: "Meta Ads", pulls: 80, totalReward: 32 },
          { id: "tiktok", name: "TikTok Ads", pulls: 20, totalReward: 9 },
          { id: "linkedin", name: "LinkedIn Ads", pulls: 40, totalReward: 18 },
        ],
        algorithm: "thompson",
      },
    },
    {
      name: "Feature Rollout",
      description: "Thompson Sampling to decide which feature to ship next",
      input: {
        arms: [
          { id: "dark-mode", name: "Dark Mode", pulls: 30, totalReward: 24 },
          { id: "export", name: "PDF Export", pulls: 30, totalReward: 15 },
          { id: "collab", name: "Real-time Collab", pulls: 10, totalReward: 8 },
        ],
        algorithm: "thompson",
      },
    },
  ],

  "contextual-bandit": [
    {
      name: "Personalized Offers",
      description: "Select best offer based on user behavior context",
      input: {
        arms: [
          { id: "discount", name: "20% Discount" },
          { id: "freeship", name: "Free Shipping" },
          { id: "bundle", name: "Bundle Deal" },
        ],
        context: [0.9, 0.3, 0.7],
        history: [
          { armId: "discount", reward: 0.8, context: [0.8, 0.2, 0.6] },
          { armId: "freeship", reward: 0.3, context: [0.4, 0.9, 0.2] },
          { armId: "bundle", reward: 0.6, context: [0.7, 0.5, 0.8] },
        ],
        alpha: 1.0,
      },
    },
    {
      name: "Content Recommendation",
      description: "Choose article type by reader engagement context",
      input: {
        arms: [
          { id: "tutorial", name: "Tutorial" },
          { id: "case-study", name: "Case Study" },
          { id: "opinion", name: "Opinion Piece" },
        ],
        context: [0.6, 0.8, 0.4],
        history: [
          { armId: "tutorial", reward: 0.9, context: [0.7, 0.6, 0.3] },
          { armId: "case-study", reward: 0.5, context: [0.3, 0.9, 0.5] },
        ],
        alpha: 0.8,
      },
    },
  ],

  evolve: [
    {
      name: "Portfolio Weights",
      description: "Evolve optimal allocation across 5 asset classes",
      input: {
        geneLength: 5,
        populationSize: 100,
        maxGenerations: 200,
        bounds: { min: 0, max: 1, type: "real" },
        mutationRate: 0.02,
        crossoverRate: 0.85,
        selectionMethod: "tournament",
        fitnessWeights: [3, 2, 1, 2, 1],
      },
    },
    {
      name: "Pricing Tiers",
      description: "Find optimal pricing for 3 product tiers",
      input: {
        geneLength: 3,
        populationSize: 80,
        maxGenerations: 150,
        bounds: { min: 5, max: 200, type: "real" },
        mutationRate: 0.015,
        crossoverRate: 0.9,
        selectionMethod: "tournament",
        fitnessWeights: [5, 3, 1],
      },
    },
  ],

  cmaes: [
    {
      name: "Model Hyperparameters",
      description: "Tune 4 hyperparameters for a ML model",
      input: {
        dimension: 4,
        initialMean: [0.1, 0.01, 64, 0.5],
        initialSigma: 0.3,
        maxIterations: 1000,
        objectiveWeights: [1.0, 2.0, 0.5, 1.5],
      },
    },
    {
      name: "Engineering Design",
      description: "Optimize 3 physical design parameters",
      input: {
        dimension: 3,
        initialMean: [5.0, 10.0, 2.0],
        initialSigma: 1.0,
        maxIterations: 500,
        objectiveWeights: [3.0, 1.0, 2.0],
      },
    },
  ],

  montecarlo: [
    {
      name: "Project Cost Estimate",
      description: "Triangular distribution for uncertain project costs",
      input: {
        simulations: 2000,
        distribution: "triangular",
        params: { min: 50000, max: 200000, mode: 85000 },
      },
    },
    {
      name: "Revenue Forecast",
      description: "Log-normal distribution for monthly revenue",
      input: {
        simulations: 1500,
        distribution: "lognormal",
        params: { mean: 11.5, stddev: 0.3 },
      },
    },
    {
      name: "Server Uptime",
      description: "Beta distribution for reliability estimation",
      input: {
        simulations: 1000,
        distribution: "beta",
        params: { alpha: 50, beta: 2 },
      },
    },
  ],

  scenario: [
    {
      name: "SaaS Growth Paths",
      description: "Compare aggressive, steady, and conservative growth",
      input: {
        baseCase: { mrr: 50000, churn: 5, cac: 200, ltv: 2400 },
        scenarios: [
          {
            name: "Aggressive",
            variables: { mrr: 120000, churn: 8, cac: 350, ltv: 1800 },
          },
          {
            name: "Steady",
            variables: { mrr: 75000, churn: 4, cac: 180, ltv: 2700 },
          },
          {
            name: "Conservative",
            variables: { mrr: 55000, churn: 3, cac: 150, ltv: 3000 },
          },
        ],
      },
    },
    {
      name: "Market Entry Options",
      description: "Evaluate 3 market entry strategies",
      input: {
        baseCase: { revenue: 500000, costs: 300000, market_share: 5, nps: 40 },
        scenarios: [
          {
            name: "Premium Position",
            variables: { revenue: 800000, costs: 500000, market_share: 3, nps: 65 },
          },
          {
            name: "Mass Market",
            variables: { revenue: 1200000, costs: 900000, market_share: 12, nps: 30 },
          },
          {
            name: "Niche Expert",
            variables: { revenue: 400000, costs: 200000, market_share: 2, nps: 80 },
          },
        ],
      },
    },
  ],

  constraints: [
    {
      name: "Factory Production",
      description: "Maximize profit with labor and material limits",
      input: {
        objective: {
          coefficients: [12, 8, 15],
          direction: "maximize",
        },
        constraints: [
          { coefficients: [2, 1, 3], rhs: 120, type: "leq" },
          { coefficients: [4, 3, 2], rhs: 200, type: "leq" },
          { coefficients: [1, 2, 1], rhs: 80, type: "leq" },
        ],
        bounds: [{ lower: 0 }, { lower: 0 }, { lower: 0 }],
      },
    },
    {
      name: "Diet Optimization",
      description: "Minimize cost while meeting nutritional constraints",
      input: {
        objective: {
          coefficients: [2, 3, 1.5, 4],
          direction: "minimize",
        },
        constraints: [
          { coefficients: [10, 5, 15, 8], rhs: 50, type: "geq" },
          { coefficients: [3, 8, 2, 6], rhs: 30, type: "geq" },
          { coefficients: [1, 1, 1, 1], rhs: 10, type: "leq" },
        ],
        bounds: [{ lower: 0 }, { lower: 0 }, { lower: 0 }, { lower: 0 }],
      },
    },
  ],

  schedule: [
    {
      name: "Sprint Planning",
      description: "Assign 6 sprint tasks across 3 time blocks",
      input: {
        tasks: [
          { id: "auth", duration: 3, priority: 5 },
          { id: "api-refactor", duration: 2, priority: 4 },
          { id: "ui-tests", duration: 1, priority: 3 },
          { id: "docs", duration: 1, priority: 2 },
          { id: "perf-audit", duration: 2, priority: 4 },
          { id: "bugfix", duration: 1, priority: 5 },
        ],
        slots: [
          { id: "monday-am", start: "09:00", end: "12:00", capacity: 3 },
          { id: "monday-pm", start: "13:00", end: "17:00", capacity: 4 },
          { id: "tuesday-am", start: "09:00", end: "12:00", capacity: 3 },
        ],
      },
    },
    {
      name: "Meeting Scheduler",
      description: "Fit 4 meetings into available room slots",
      input: {
        tasks: [
          { id: "standup", duration: 1, priority: 5 },
          { id: "design-review", duration: 2, priority: 3 },
          { id: "1on1", duration: 1, priority: 4 },
          { id: "retro", duration: 2, priority: 2 },
        ],
        slots: [
          { id: "room-a-am", start: "09:00", end: "12:00", capacity: 3 },
          { id: "room-a-pm", start: "13:00", end: "16:00", capacity: 3 },
          { id: "room-b-am", start: "10:00", end: "12:00", capacity: 2 },
        ],
      },
    },
  ],

  graph: [
    {
      name: "Tech Stack Decision",
      description: "Analyze dependencies between technology choices",
      input: {
        nodes: [
          { id: "react", type: "decision", weight: 0.9 },
          { id: "nextjs", type: "decision", weight: 0.85 },
          { id: "postgres", type: "decision", weight: 0.8 },
          { id: "redis", type: "decision", weight: 0.6 },
          { id: "deploy", type: "goal", weight: 1.0 },
        ],
        edges: [
          { source: "react", target: "nextjs", weight: 0.95 },
          { source: "nextjs", target: "deploy", weight: 0.9 },
          { source: "postgres", target: "deploy", weight: 0.85 },
          { source: "redis", target: "deploy", weight: 0.5 },
          { source: "react", target: "postgres", weight: 0.3 },
        ],
        sourceGoal: "react",
        targetGoal: "deploy",
      },
    },
    {
      name: "Org Influence Map",
      description: "Map influence and information flow in a team",
      input: {
        nodes: [
          { id: "ceo", type: "decision", weight: 1.0 },
          { id: "cto", type: "decision", weight: 0.9 },
          { id: "pm", type: "decision", weight: 0.7 },
          { id: "eng-lead", type: "decision", weight: 0.8 },
          { id: "designer", type: "decision", weight: 0.6 },
          { id: "ship", type: "goal", weight: 1.0 },
        ],
        edges: [
          { source: "ceo", target: "cto", weight: 0.9 },
          { source: "cto", target: "eng-lead", weight: 0.95 },
          { source: "pm", target: "designer", weight: 0.8 },
          { source: "pm", target: "eng-lead", weight: 0.7 },
          { source: "eng-lead", target: "ship", weight: 0.9 },
          { source: "designer", target: "ship", weight: 0.6 },
        ],
        sourceGoal: "ceo",
        targetGoal: "ship",
      },
    },
  ],

  risk: [
    {
      name: "Crypto Portfolio",
      description: "High-volatility 3-asset crypto portfolio VaR",
      input: {
        weights: [0.5, 0.3, 0.2],
        returns: [
          [0.05, -0.03, 0.08, -0.06, 0.04, 0.02, -0.07, 0.06, -0.01, 0.03],
          [-0.02, 0.06, -0.04, 0.09, -0.05, 0.03, 0.07, -0.08, 0.04, -0.02],
          [0.03, 0.01, -0.02, 0.04, -0.03, 0.05, -0.01, 0.02, 0.06, -0.04],
        ],
        confidence: 0.99,
        horizonDays: 5,
      },
    },
    {
      name: "Bond-Heavy Portfolio",
      description: "Conservative allocation with low volatility",
      input: {
        weights: [0.2, 0.6, 0.2],
        returns: [
          [0.002, -0.001, 0.003, 0.001, -0.002, 0.001, 0.002, -0.001, 0.001, 0.003],
          [0.001, 0.001, 0.001, 0.002, 0.001, 0.001, 0.001, 0.002, 0.001, 0.001],
          [0.003, -0.002, 0.004, 0.001, -0.001, 0.002, -0.003, 0.005, 0.001, -0.001],
        ],
        confidence: 0.95,
        horizonDays: 10,
      },
    },
  ],

  bayesian: [
    {
      name: "Startup Due Diligence",
      description: "Update investment thesis with market + team signals",
      input: {
        prior: 0.3,
        evidence: [
          { factor: "market_size", weight: 0.9, value: 0.85 },
          { factor: "team_experience", weight: 0.7, value: 0.9 },
          { factor: "revenue_traction", weight: 0.8, value: 0.6 },
          { factor: "competitive_moat", weight: 0.6, value: 0.4 },
        ],
      },
    },
    {
      name: "Bug Severity Triage",
      description: "Estimate true severity from user reports and logs",
      input: {
        prior: 0.5,
        evidence: [
          { factor: "user_reports", weight: 0.6, value: 0.8 },
          { factor: "error_rate_spike", weight: 0.9, value: 0.95 },
          { factor: "affected_users", weight: 0.7, value: 0.3 },
        ],
      },
    },
    {
      name: "Medical Screening",
      description: "Update disease probability with test results",
      input: {
        prior: 0.01,
        evidence: [
          { factor: "screening_positive", weight: 0.95, value: 0.9 },
          { factor: "family_history", weight: 0.5, value: 0.7 },
          { factor: "age_risk_factor", weight: 0.3, value: 0.6 },
        ],
      },
    },
  ],

  ensemble: [
    {
      name: "Sales Forecast Blend",
      description: "Combine 4 forecasting models for quarterly revenue",
      input: {
        predictions: [
          { modelId: "arima", prediction: 0.82, confidence: 0.88, historicalAccuracy: 0.79 },
          { modelId: "prophet", prediction: 0.78, confidence: 0.85, historicalAccuracy: 0.83 },
          { modelId: "xgboost", prediction: 0.85, confidence: 0.72, historicalAccuracy: 0.87 },
          { modelId: "lstm", prediction: 0.80, confidence: 0.68, historicalAccuracy: 0.81 },
        ],
        method: "bayesian-averaging",
      },
    },
    {
      name: "Churn Risk Ensemble",
      description: "Stack 3 classifiers for customer churn prediction",
      input: {
        predictions: [
          { modelId: "logistic", prediction: 0.65, confidence: 0.90, historicalAccuracy: 0.76 },
          { modelId: "random-forest", prediction: 0.72, confidence: 0.85, historicalAccuracy: 0.82 },
          { modelId: "svm", prediction: 0.58, confidence: 0.78, historicalAccuracy: 0.74 },
        ],
        method: "stacking",
      },
    },
  ],

  forecast: [
    {
      name: "Monthly Revenue",
      description: "12-month revenue history, forecast next quarter",
      input: {
        data: [45000, 48000, 52000, 49000, 55000, 58000, 54000, 60000, 63000, 59000, 65000, 68000],
        steps: 3,
        method: "holt-winters",
        seasonLength: 4,
      },
    },
    {
      name: "Weekly Traffic",
      description: "8 weeks of web traffic, predict next 4 weeks",
      input: {
        data: [1200, 1350, 1100, 1400, 1250, 1500, 1300, 1550],
        steps: 4,
        method: "arima",
      },
    },
    {
      name: "Seasonal Sales",
      description: "2 years of quarterly sales with strong seasonality",
      input: {
        data: [200, 150, 300, 400, 220, 170, 330, 440],
        steps: 4,
        method: "holt-winters",
        seasonLength: 4,
      },
    },
  ],

  anomaly: [
    {
      name: "Server Latency Spikes",
      description: "Detect unusual response times in API monitoring",
      input: {
        data: [45, 48, 42, 50, 47, 200, 44, 46, 43, 350, 49, 47, 45, 42, 48, 44, 180, 46, 43, 47],
        method: "zscore",
        threshold: 2.0,
      },
    },
    {
      name: "Transaction Amounts",
      description: "Flag suspicious transaction values using IQR",
      input: {
        data: [25, 30, 28, 32, 27, 5000, 29, 31, 26, 33, 28, 8000, 30, 27, 32, 25, 29, 31, 27, 30],
        method: "iqr",
        threshold: 1.5,
      },
    },
  ],

  convergence: [
    {
      name: "Analyst Consensus",
      description: "3 equity analysts forecasting same stock",
      input: {
        sources: [
          { id: "analyst_bull", distribution: [0.05, 0.10, 0.20, 0.40, 0.25] },
          { id: "analyst_neutral", distribution: [0.10, 0.25, 0.35, 0.20, 0.10] },
          { id: "analyst_bear", distribution: [0.30, 0.30, 0.25, 0.10, 0.05] },
        ],
      },
    },
    {
      name: "Sensor Fusion",
      description: "3 IoT sensors measuring same variable",
      input: {
        sources: [
          { id: "sensor_1", distribution: [0.02, 0.08, 0.60, 0.25, 0.05] },
          { id: "sensor_2", distribution: [0.03, 0.10, 0.55, 0.27, 0.05] },
          { id: "sensor_3", distribution: [0.01, 0.07, 0.62, 0.24, 0.06] },
        ],
      },
    },
  ],

  calibration: [
    {
      name: "Weather Forecaster",
      description: "Evaluate a weather model's rain probability calibration",
      input: {
        predictions: [0.8, 0.9, 0.2, 0.6, 0.1, 0.7, 0.95, 0.3, 0.5, 0.85],
        outcomes: [1, 1, 0, 0, 0, 1, 1, 0, 1, 1],
      },
    },
    {
      name: "Spam Filter Accuracy",
      description: "How well does the spam classifier's confidence match reality",
      input: {
        predictions: [0.95, 0.88, 0.12, 0.76, 0.05, 0.92, 0.35, 0.68, 0.03, 0.81],
        outcomes: [1, 1, 0, 1, 0, 1, 0, 1, 0, 0],
      },
    },
  ],

  pathfind: [
    {
      name: "Product Launch Path",
      description: "Find cheapest path from idea to market launch",
      input: {
        nodes: [
          { id: "idea", cost: 0 },
          { id: "research", cost: 5000, time: 14, risk: 0.1 },
          { id: "prototype", cost: 15000, time: 30, risk: 0.3 },
          { id: "beta", cost: 8000, time: 21, risk: 0.2 },
          { id: "marketing", cost: 10000, time: 14, risk: 0.15 },
          { id: "launch", cost: 0 },
        ],
        edges: [
          { from: "idea", to: "research", cost: 5000, time: 14 },
          { from: "idea", to: "prototype", cost: 15000, time: 30 },
          { from: "research", to: "prototype", cost: 10000, time: 21 },
          { from: "research", to: "beta", cost: 8000, time: 14 },
          { from: "prototype", to: "beta", cost: 5000, time: 7 },
          { from: "beta", to: "marketing", cost: 10000, time: 14 },
          { from: "beta", to: "launch", cost: 3000, time: 7 },
          { from: "marketing", to: "launch", cost: 2000, time: 3 },
        ],
        start: "idea",
        end: "launch",
        heuristic: "cost",
        kPaths: 3,
      },
    },
    {
      name: "Fastest Delivery Route",
      description: "Minimize time through a 6-node delivery network",
      input: {
        nodes: [
          { id: "warehouse", cost: 0 },
          { id: "hub-a", cost: 5, time: 2, risk: 0.05 },
          { id: "hub-b", cost: 3, time: 3, risk: 0.02 },
          { id: "hub-c", cost: 4, time: 1, risk: 0.1 },
          { id: "customer", cost: 0 },
        ],
        edges: [
          { from: "warehouse", to: "hub-a", cost: 5, time: 2 },
          { from: "warehouse", to: "hub-b", cost: 3, time: 3 },
          { from: "hub-a", to: "hub-c", cost: 2, time: 1 },
          { from: "hub-a", to: "customer", cost: 8, time: 4 },
          { from: "hub-b", to: "hub-c", cost: 4, time: 2 },
          { from: "hub-c", to: "customer", cost: 3, time: 1 },
        ],
        start: "warehouse",
        end: "customer",
        heuristic: "time",
        kPaths: 2,
      },
    },
  ],
};
