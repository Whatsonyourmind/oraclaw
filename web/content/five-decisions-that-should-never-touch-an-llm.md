---
title: 5 Decisions Your Agent Makes Daily That Should Never Touch an LLM
date: 2026-04-04
excerpt: Five categories of decisions that agents routinely solve with LLM reasoning -- and the exact, deterministic alternatives that are faster, cheaper, and actually correct.
---

# 5 Decisions Your Agent Makes Daily That Should Never Touch an LLM

LLMs are general-purpose reasoning engines. This is their strength and their trap. Because they *can* reason about anything, teams use them to reason about everything -- including problems that were solved decades ago by algorithms that run in microseconds and never get the answer wrong.

Here are five decisions your agent is probably making with token generation right now, and what it should be using instead.

## 1. "Which option should I try next?"

**The LLM approach:** The agent receives performance data for multiple options (API providers, content variants, pricing tiers) and reasons about which to try next. "Based on the data, Option B has the highest conversion rate, but Option D has limited data, so perhaps we should explore it further..."

**The cost:** 800-2,000 tokens per decision. 1-3 seconds latency. The reasoning sounds thoughtful but has no mathematical guarantee of optimality. Over thousands of sequential decisions, the cumulative regret -- the gap between what the agent chose and what it should have chosen -- compounds silently.

**The right tool:** This is a bandit problem. Algorithms exist that provably minimize cumulative regret over any sequence of decisions. They run in under 1ms. They cost nothing. They have been mathematically proven optimal since 2002.

**The difference:** An agent using LLM reasoning to select variants finds the best option in ~2,000 trials. The same agent using a proper bandit algorithm finds it in ~200. That is 10x less wasted spend during exploration, and the answer is guaranteed correct by proof, not by the persuasiveness of a chain-of-thought.

## 2. "Is this data point normal or anomalous?"

**The LLM approach:** Feed the agent a data point and some historical context. "This server's response time is 847ms. Over the past hour, the average was 312ms. Is this anomalous?"

**The cost:** 500-1,500 tokens. The LLM will usually say "yes, that seems high" -- but it cannot tell you *how* anomalous, whether it is a statistical outlier or just noise, or what the false positive rate of its judgment is. It has no principled threshold. It is guessing with good vocabulary.

**The right tool:** Statistical anomaly detection. Z-scores, IQR fencing, Grubbs' test, DBSCAN -- depending on the distribution and context. These methods give you an exact probability that the observation is an outlier, with a known and controllable false positive rate.

**The difference:** LLM-based anomaly detection has no measurable false positive rate. You cannot tune it. You cannot audit it. Statistical detection gives you a p-value you can set a policy around. "Alert if p < 0.01" is a policy. "Alert if the LLM thinks it is weird" is not.

## 3. "What will this metric be next week?"

**The LLM approach:** Show the agent a time series and ask it to forecast. "Based on the upward trend and the seasonal pattern visible in Q4, I predict next week's revenue will be approximately $142,000."

**The cost:** 2,000-5,000 tokens if you include the data in the prompt. The forecast has no confidence interval, no decomposition of trend vs. seasonality vs. noise, and no way to measure its accuracy against proper baselines. It is an educated guess formatted as a number.

**The right tool:** Time series forecasting models. These decompose the signal into trend, seasonal, and residual components. They fit parameters to historical data. They produce point estimates *and* confidence intervals. They can be backtested against held-out data to measure actual forecast accuracy.

**The difference:** An LLM forecast is a single number with no error bars. A proper forecast says "$142,000 +/- $8,400 at 95% confidence, with seasonal component contributing $23,000 of the estimate." One is a guess. The other is a decision-grade signal.

## 4. "How should I schedule these tasks?"

**The LLM approach:** Give the agent a list of tasks with durations, dependencies, deadlines, and resource constraints. Ask it to produce a schedule. It will generate something plausible. It will not generate the optimal solution.

**The cost:** 3,000-8,000 tokens. High latency. The schedule will satisfy some constraints and violate others in ways that are hard to detect by reading the output. The agent cannot tell you if the schedule is optimal, feasible, or the best possible given the constraints -- because it is not solving the problem, it is narrating an approximate answer.

**The right tool:** Constraint optimization. Linear programming, mixed-integer programming, or constraint propagation depending on the problem structure. These solvers guarantee feasibility (every constraint satisfied) and optimality (no better solution exists). They handle hundreds of tasks and dozens of constraints in milliseconds.

**The difference:** An LLM-generated schedule for 20 tasks might take 8 seconds and violate 2 constraints you do not notice until execution. A solver produces the provably optimal schedule in 3ms, satisfying every constraint, and can tell you exactly which constraints are binding (the bottlenecks) and by how much relaxing them would improve the objective.

## 5. "How risky is this portfolio?"

**The LLM approach:** Describe a portfolio to the agent and ask for a risk assessment. "This portfolio has moderate risk due to concentration in tech equities and limited fixed-income allocation. I estimate a potential downside of 12-15% in an adverse scenario."

**The cost:** 1,000-3,000 tokens. The "12-15% downside" is not computed from any model. It is a narrative that sounds like quantitative analysis. There is no specified time horizon, no confidence level, no tail risk assessment, no correlation accounting.

**The right tool:** Quantitative risk metrics. Value-at-Risk (VaR) tells you the maximum expected loss at a specific confidence level over a specific time horizon. Conditional VaR (CVaR) tells you the expected loss in the tail -- what happens in the worst cases. Monte Carlo simulation stress-tests the portfolio across thousands of scenarios including correlated moves and fat tails.

**The difference:** "Moderate risk" is not actionable. "95% VaR of $47,200 over 30 days, with CVaR of $68,100" is actionable. One is an opinion. The other is a measurement.

## The Common Thread

None of these problems require intelligence. They require computation. The distinction matters.

Intelligence is understanding context, interpreting ambiguity, generating creative solutions. LLMs excel here. Computation is applying mathematical operations to structured data and returning provably correct results. Algorithms excel here.

Every token your agent spends on computation is a token wasted -- and a result you cannot trust.

These five problems are solved. Stop re-solving them with prompts.

---

*OraClaw provides deterministic, sub-millisecond solutions for all five categories. [GitHub](https://github.com/Whatsonyourmind/oraclaw) | [ClawHub](https://oraclaw.com/clawhub)*
