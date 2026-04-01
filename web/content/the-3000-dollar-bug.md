---
title: The $3,000 Bug: When Your Agent's Math Looks Right But Isn't
date: 2026-04-01
excerpt: An e-commerce agent ran A/B tests with LLM reasoning for 3 weeks. The chain-of-thought looked perfect. The variant selection was wrong. Cost: $3,000 in lost conversions.
---

# The $3,000 Bug: When Your Agent's Math Looks Right But Isn't

Here is the scariest kind of bug: the one that explains itself well.

A mid-size e-commerce team deployed an AI agent to manage their checkout flow A/B tests. Three variants of the payment page. The agent observed conversion data each day, reasoned about which variant was performing best, and allocated traffic accordingly. Standard stuff.

The chain-of-thought was beautiful. "Variant B shows a 4.2% conversion rate compared to Variant A's 3.8%. However, Variant C has a smaller sample size (n=340), so I'll allocate slightly more traffic to gather statistical significance before drawing conclusions." Thoughtful. Measured. Wrong.

Three weeks later, a junior data scientist looked at the raw numbers and ran a proper analysis. Variant C was actually the winner -- by a wide margin. The agent had been starving it of traffic for 21 days.

The cost: approximately $3,000 in lost conversions. Not catastrophic for this company. Catastrophic for confidence in the system.

## Why the Chain-of-Thought Fooled Everyone

The agent's reasoning *read* correctly. It mentioned sample sizes. It mentioned statistical significance. It even hedged appropriately. But underneath the fluent language, it was doing something fundamentally broken: using vibes-based heuristics to solve a problem with an exact mathematical solution.

The specific failure: the agent treated "small sample size" as a reason to be cautious about a variant's performance. In reality, small sample size is a reason to *explore more*, not less. The variant with 340 observations had massive uncertainty -- which means it could be much better than its current estimate suggests. A proper framework doesn't just acknowledge uncertainty; it uses uncertainty as a signal to explore.

The agent did the opposite. It saw uncertainty and pulled back. This is the default human intuition, and LLMs inherit it because that is what the training data reflects. But in sequential decision-making under uncertainty, the human intuition is provably suboptimal.

## The Invisible Failure Mode

This bug has a unique property: it is invisible under normal code review.

If an algorithm produces wrong output, you can trace the logic, find the faulty line, fix it. If an LLM produces wrong output, you read the chain-of-thought and it sounds reasonable. There is no line to trace. There is no formula to audit. The reasoning is a narrative, not a proof.

The team reviewed the agent's outputs weekly. They read the reasoning. It made sense every time. Nobody questioned it because there was nothing obviously wrong to question. The bug only surfaced when someone bypassed the agent entirely and ran the numbers independently.

This is the pattern you should be worried about: agents that are wrong in ways that are undetectable by reading their output.

## What the Fix Looks Like

The team replaced the LLM-based variant selection with a proper bandit algorithm. Same agent, same data pipeline, same reporting. The only change: instead of the LLM reasoning about which variant to show, it calls a deterministic service that solves the explore/exploit tradeoff mathematically.

Results from the first week:

- **Time to identify winning variant:** 48 hours (down from "never" under the old system)
- **Conversion lift:** 23% over the previously selected "winner"
- **Token cost for variant selection:** Zero. The computation takes less than a millisecond and costs nothing.
- **Auditability:** Every decision has a numeric score that can be independently verified. No narratives to interpret.

The agent still does what it is good at -- interpreting results, generating reports, deciding when to end a test. It just no longer pretends to be a statistician.

## The Broader Pattern

This is not an edge case. Every time an agent uses chain-of-thought to make a quantitative decision, the same failure mode exists. The math *looks right* because LLMs are trained to produce plausible-sounding reasoning, not correct reasoning. These are different things.

A/B test allocation. Budget optimization. Pricing decisions. Capacity planning. If the decision has a mathematical structure, there is an algorithm that solves it correctly, deterministically, in sub-millisecond time. Using an LLM instead is like using a novelist to do your taxes -- the output will be eloquent, detailed, and wrong in ways you will not catch until the audit.

The $3,000 bug is the one this team found. The question every agent builder should be asking: how many $3,000 bugs are running right now that nobody has checked?

## Stop the Bleeding

The variant selection problem has been solved since 2002. Your agent should not be re-deriving the solution through token generation.

```bash
clawhub install oraclaw-bandit
```

Correct variant selection. Sub-millisecond. Auditable. No chain-of-thought required.

---

*OraClaw is the math layer for AI agents. 19 algorithms, deterministic results. [GitHub](https://github.com/Whatsonyourmind/oraclaw) | [ClawHub](https://oraclaw.com/clawhub)*
