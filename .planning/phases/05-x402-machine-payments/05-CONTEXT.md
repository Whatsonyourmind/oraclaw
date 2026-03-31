# Phase 5: x402 Machine Payments - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning
**Source:** Auto-advance (decisions derived from codebase patterns, requirements, and x402 protocol)

<domain>
## Phase Boundary

AI agents can pay for OraClaw API calls with USDC via the x402 protocol without any human involvement. This adds a third billing path (`x402`) alongside existing `stripe` and `free` paths. The x402 flow works independently of Stripe -- an agent with a funded wallet needs no API key or subscription.

</domain>

<decisions>
## Implementation Decisions

### Billing path integration
- Add `'x402'` as a third `billingPath` value on FastifyRequest (alongside existing `'stripe'` and `'free'`)
- x402 preHandler runs BEFORE Unkey auth — if valid x402 payment header is present, skip API key verification entirely
- x402-paid requests skip Stripe meter-usage hook (they paid via USDC, not metered billing)
- Free tier rate limiting still applies if no x402 header and no API key

### x402 hook architecture
- Implement as a Fastify preHandler hook (consistent with existing auth middleware pattern)
- Use @x402/core for protocol validation and @x402/evm for Base chain settlement
- Hook validates the `X-PAYMENT` or `402` header, verifies USDC payment on Base, then sets `request.billingPath = 'x402'`
- The hook is registered on public API routes only (same scope as auth middleware)

### Pricing model
- Per-call USDC pricing: match the Stripe per-call price (e.g., $0.001/call for starter equivalent)
- Single flat price per API call — no tiered USDC pricing (simplicity for machine agents)
- Price is set in the x402 paywall configuration, not dynamically computed

### Wallet configuration
- Use the existing wallet infrastructure (scripts/create-wallet.ts already generates Base wallets)
- Receiving wallet address from RECEIVING_WALLET_ADDRESS env var (already in .env.wallet)
- USDC contract on Base mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

### Error responses
- x402 payment errors use RFC 9457 problem details format (consistent with Phase 4's sendProblem helper)
- Return 402 Payment Required with `type: 'https://web-olive-one-89.vercel.app/errors/payment-required'` when payment header is missing/invalid
- Return 402 with payment details in response body so agents know how much to pay and where

### Testing strategy
- Unit tests for the x402 preHandler hook (mock @x402/core verification)
- Integration tests verifying the three billing paths coexist (free, stripe, x402)
- Test that x402 requests bypass Unkey auth and Stripe metering

### Claude's Discretion
- Exact @x402/core and @x402/evm API usage patterns (researcher will investigate)
- Whether to use x402 facilitator service or direct on-chain verification
- Hook ordering details within Fastify lifecycle
- Testnet vs mainnet configuration for development

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/middleware/auth.ts`: createAuthMiddleware pattern — preHandler hook factory returning async handler. x402 hook should follow same pattern
- `src/hooks/meter-usage.ts`: createMeterUsageHook — onResponse hook that checks `request.billingPath`. Already filters on `billingPath !== 'stripe'`, so x402 requests will naturally be excluded
- `src/hooks/free-tier-rate-limit.ts`: Free tier rate limiting hook — x402 hook must run before this to set billingPath
- `src/utils/problem-details.ts`: sendProblem helper with ProblemTypes registry — use for 402 error responses
- `scripts/create-wallet.ts`: Wallet generator using viem — Base chain config and USDC addresses already defined

### Established Patterns
- `request.billingPath` flag (`'stripe' | 'free'`) controls downstream hooks — extend to `'stripe' | 'free' | 'x402'`
- `request.tier` set by auth middleware — x402 requests need a tier assignment (e.g., `'x402'` or `'unlimited'`)
- preHandler hooks are registered per-route scope via Fastify plugin encapsulation
- RFC 9457 error format for all error responses (sendProblem helper)

### Integration Points
- `src/index.ts`: Where hooks are registered on the public API routes (line ~115)
- `src/routes/oracle/api-public.ts`: The 14 algorithm endpoints that accept x402 payments
- FastifyRequest type augmentation in auth.ts — extend billingPath union type
- `.env.wallet`: RECEIVING_WALLET_ADDRESS for x402 settlement target

</code_context>

<specifics>
## Specific Ideas

- x402 is a protocol where AI agents include USDC payment in HTTP request headers — the server verifies payment before processing
- The wallet address 0x077E...Cdde is already generated and configured
- USDC on Base (L2) for low gas fees — not Ethereum mainnet
- ClawHub skills already reference x402/USDC pricing in their SKILL.md files
- The goal is zero-friction for AI agents: no signup, no API key, just pay and call

</specifics>

<deferred>
## Deferred Ideas

- INFRA-03 (end-to-end billing verification including x402) — Phase 8
- Unified Stripe + x402 revenue dashboard — v2 requirement (INFRA-06)
- Dynamic pricing based on algorithm complexity — future consideration

</deferred>

---

*Phase: 05-x402-machine-payments*
*Context gathered: 2026-03-30*
