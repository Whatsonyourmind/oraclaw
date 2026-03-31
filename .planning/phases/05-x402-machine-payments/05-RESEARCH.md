# Phase 5: x402 Machine Payments - Research

**Researched:** 2026-03-30
**Domain:** x402 payment protocol, blockchain USDC settlement, Fastify middleware
**Confidence:** HIGH

## Summary

The x402 protocol by Coinbase enables HTTP-native machine payments where AI agents include USDC payment in request headers. The server verifies payment via a facilitator service, processes the request, then settles payment on-chain. The protocol uses HTTP 402 Payment Required status code with `PAYMENT-SIGNATURE` (request) and `PAYMENT-REQUIRED` / `PAYMENT-RESPONSE` (response) headers carrying Base64-encoded JSON payloads.

The core npm packages `@x402/core` v2.8.0 and `@x402/evm` v2.8.0 are published and stable. An official `@x402/fastify` package exists in the Coinbase repo source (supporting Fastify 5) but is NOT yet published to npm. The x402 architecture is framework-agnostic: `x402ResourceServer` (core) handles verify/settle, `x402HTTPResourceServer` handles HTTP protocol, and thin framework adapters wrap it. We will use the published packages and build a focused Fastify preHandler hook following the exact patterns from the official (unpublished) Fastify adapter source code.

The Coinbase Developer Platform (CDP) hosts the production facilitator at `https://x402.org/facilitator` (testnet, free, no auth) and `https://api.cdp.coinbase.com/platform/v2/x402` (mainnet, requires CDP API keys). Base mainnet uses network identifier `eip155:8453` with USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` -- matching the existing wallet configuration in `.env.wallet`.

**Primary recommendation:** Install `@x402/core` and `@x402/evm` (both v2.8.0), build a Fastify preHandler hook using `x402ResourceServer` + `ExactEvmScheme` + `HTTPFacilitatorClient`, and wire it into the existing hook chain BEFORE Unkey auth so x402-paid requests bypass API key verification.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add `'x402'` as a third `billingPath` value on FastifyRequest (alongside existing `'stripe'` and `'free'`)
- x402 preHandler runs BEFORE Unkey auth -- if valid x402 payment header is present, skip API key verification entirely
- x402-paid requests skip Stripe meter-usage hook (they paid via USDC, not metered billing)
- Free tier rate limiting still applies if no x402 header and no API key
- Implement as a Fastify preHandler hook (consistent with existing auth middleware pattern)
- Use @x402/core for protocol validation and @x402/evm for Base chain settlement
- Hook validates the `X-PAYMENT` or `402` header, verifies USDC payment on Base, then sets `request.billingPath = 'x402'`
- The hook is registered on public API routes only (same scope as auth middleware)
- Per-call USDC pricing: match the Stripe per-call price (e.g., $0.001/call for starter equivalent)
- Single flat price per API call -- no tiered USDC pricing (simplicity for machine agents)
- Price is set in the x402 paywall configuration, not dynamically computed
- Use the existing wallet infrastructure (scripts/create-wallet.ts already generates Base wallets)
- Receiving wallet address from RECEIVING_WALLET_ADDRESS env var (already in .env.wallet)
- USDC contract on Base mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- x402 payment errors use RFC 9457 problem details format (consistent with Phase 4's sendProblem helper)
- Return 402 Payment Required with `type: 'https://web-olive-one-89.vercel.app/errors/payment-required'` when payment header is missing/invalid
- Return 402 with payment details in response body so agents know how much to pay and where
- Unit tests for the x402 preHandler hook (mock @x402/core verification)
- Integration tests verifying the three billing paths coexist (free, stripe, x402)
- Test that x402 requests bypass Unkey auth and Stripe metering

### Claude's Discretion
- Exact @x402/core and @x402/evm API usage patterns (researcher will investigate)
- Whether to use x402 facilitator service or direct on-chain verification
- Hook ordering details within Fastify lifecycle
- Testnet vs mainnet configuration for development

### Deferred Ideas (OUT OF SCOPE)
- INFRA-03 (end-to-end billing verification including x402) -- Phase 8
- Unified Stripe + x402 revenue dashboard -- v2 requirement (INFRA-06)
- Dynamic pricing based on algorithm complexity -- future consideration
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-04 | AI agents can pay per call via x402 USDC machine payments (native Fastify preHandler) | x402ResourceServer verify/settle flow, ExactEvmScheme for EVM, HTTPFacilitatorClient for CDP facilitator, PAYMENT-SIGNATURE header, hook factory pattern |
| INFRA-02 | x402 packages installed (@x402/core, @x402/evm) with native Fastify hook | @x402/core v2.8.0 + @x402/evm v2.8.0 published on npm, Fastify adapter pattern from official source |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @x402/core | 2.8.0 | Protocol types, x402ResourceServer, HTTPFacilitatorClient, header encode/decode | Official Coinbase SDK, handles verify/settle flow with facilitator |
| @x402/evm | 2.8.0 | ExactEvmScheme for Base chain USDC settlement | Official EVM implementation, uses viem internally, supports EIP-3009 TransferWithAuthorization |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| viem | ^2.47.6 | Ethereum client (already installed) | Used by @x402/evm internally, also used by create-wallet.ts |
| fastify | ^5.8.4 | Web framework (already installed) | preHandler/onSend hooks for payment middleware |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Fastify hook | @x402/fastify (unpublished) | Official Fastify adapter exists in coinbase/x402 repo but is NOT published to npm. Building our own hook using @x402/core directly gives us full control over billingPath integration and is more maintainable than vendoring unpublished code |
| CDP facilitator (mainnet) | x402.org facilitator (testnet) | Use x402.org for dev/test (free, no auth), CDP for production (requires API keys, supports Base mainnet) |
| x402 full middleware | Minimal preHandler hook | Full middleware handles paywall HTML, settlement timing, etc. We only need the verify step in preHandler -- settlement can be fire-and-forget in onResponse like meter-usage |

**Installation:**
```bash
cd mission-control/apps/api && npm install @x402/core@2.8.0 @x402/evm@2.8.0
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── hooks/
│   ├── x402-payment.ts       # x402 preHandler hook factory (NEW)
│   ├── x402-settle.ts        # x402 onResponse settlement hook (NEW)
│   ├── meter-usage.ts        # Stripe meter hook (existing, already skips non-stripe)
│   └── free-tier-rate-limit.ts  # (existing)
├── middleware/
│   └── auth.ts               # Unkey auth (existing, extend billingPath type)
├── test-utils/
│   ├── mock-unkey.ts          # (existing)
│   ├── mock-stripe.ts         # (existing)
│   └── mock-x402.ts           # x402 ResourceServer mock (NEW)
└── index.ts                   # Hook registration (modify ordering)
```

### Pattern 1: x402 preHandler Hook (Verify Before Auth)
**What:** A Fastify preHandler that checks for the `PAYMENT-SIGNATURE` header, verifies payment via x402ResourceServer, and sets `request.billingPath = 'x402'` if valid. If no payment header, the hook passes through to Unkey auth.
**When to use:** On every `/api/v1/*` request, registered BEFORE the Unkey auth hook.
**Example:**
```typescript
// Source: Official @x402/fastify source code + OraClaw hook patterns
import { x402ResourceServer } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { decodePaymentSignatureHeader } from '@x402/core/http'; // NOTE: might be '@x402/core'
import type { FastifyRequest, FastifyReply } from 'fastify';
import { sendProblem, ProblemTypes } from '../utils/problem-details';

// Add 'payment-required' to ProblemTypes registry
// ProblemTypes.PAYMENT_REQUIRED = 'https://web-olive-one-89.vercel.app/errors/payment-required'

export function createX402PaymentHook(
  resourceServer: x402ResourceServer,
  walletAddress: string,
  pricePerCall: string,  // e.g. "$0.001"
  network: string,       // e.g. "eip155:8453"
) {
  return async function x402PaymentHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Check for x402 payment header
    const paymentHeader =
      (request.headers['payment-signature'] as string | undefined) ||
      (request.headers['x-payment'] as string | undefined);

    // No payment header = pass through to Unkey auth
    if (!paymentHeader) {
      return;
    }

    try {
      // Decode the base64 payment payload
      const paymentPayload = decodePaymentSignatureHeader(paymentHeader);

      // Build payment requirements for this request
      const requirements = await resourceServer.buildPaymentRequirements({
        scheme: 'exact',
        payTo: walletAddress,
        price: pricePerCall,
        network,
      });

      // Find matching requirements
      const matching = resourceServer.findMatchingRequirements(
        requirements,
        paymentPayload,
      );

      if (!matching) {
        return sendProblem(reply, 402, ProblemTypes.PAYMENT_REQUIRED,
          'Payment Required',
          'No matching payment requirements',
          { paymentRequirements: requirements });
      }

      // Verify payment with facilitator
      const verifyResult = await resourceServer.verifyPayment(paymentPayload, matching);

      if (!verifyResult.isValid) {
        return sendProblem(reply, 402, ProblemTypes.PAYMENT_REQUIRED,
          'Payment Required',
          `Payment verification failed: ${verifyResult.invalidReason}`,
          { paymentRequirements: requirements });
      }

      // Payment verified -- set billing path
      request.billingPath = 'x402';
      request.tier = 'x402';
      // Store payment context for settlement in onResponse
      request.x402Payment = { paymentPayload, requirements: matching };
    } catch (err) {
      request.log.error({ err }, 'x402 payment verification failed');
      return sendProblem(reply, 402, ProblemTypes.PAYMENT_REQUIRED,
        'Payment Required',
        'Invalid payment header');
    }
  };
}
```

### Pattern 2: x402 Settlement onResponse Hook (Fire-and-Forget)
**What:** After the route handler completes successfully (2xx), settle the x402 payment on-chain via the facilitator. Same fire-and-forget pattern as meter-usage.ts.
**When to use:** Registered as onResponse hook, runs only when `request.billingPath === 'x402'` and response is 2xx.
**Example:**
```typescript
// Source: meter-usage.ts pattern + x402ResourceServer.settlePayment API
export function createX402SettleHook(resourceServer: x402ResourceServer) {
  return async function x402SettleHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (request.billingPath !== 'x402' || !request.x402Payment || reply.statusCode >= 400) {
      return;
    }

    const { paymentPayload, requirements } = request.x402Payment;

    // Fire-and-forget: settle payment without blocking the response
    resourceServer.settlePayment(paymentPayload, requirements)
      .then(result => {
        if (result.success) {
          request.log.info({ tx: result.transaction }, 'x402 payment settled');
        } else {
          request.log.error({ reason: result.errorReason }, 'x402 settlement failed');
        }
      })
      .catch(err => {
        request.log.error({ err }, 'x402 settlement error');
      });
  };
}
```

### Pattern 3: Hook Registration Ordering in index.ts
**What:** The x402 hook MUST be registered before the Unkey auth hook. If x402 payment is valid, it sets billingPath='x402' and the auth hook checks billingPath before calling Unkey.
**When to use:** In index.ts when registering hooks.
**Example:**
```typescript
// Hook ordering (critical):
// 1. @fastify/rate-limit (onRequest) -- free tier IP limiting
// 2. x402 payment (preHandler) -- checks PAYMENT-SIGNATURE header
// 3. Unkey auth (preHandler) -- skips if billingPath already set
// 4. Rate limit headers (onSend) -- response headers
// 5. x402 settlement (onResponse) -- settle USDC after success
// 6. Stripe meter (onResponse) -- already filters billingPath !== 'stripe'

// Register x402 BEFORE Unkey:
const x402Handler = createX402PaymentHook(x402Server, walletAddress, '$0.001', 'eip155:8453');
server.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/api/v1/')) {
    await x402Handler(request, reply);
  }
});

// Then Unkey (modify to skip if x402 already paid):
const unkeyAuthHandler = createAuthMiddleware(unkey);
server.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/api/v1/') && !request.billingPath) {
    await unkeyAuthHandler(request, reply);
  }
});
```

### Pattern 4: x402ResourceServer Initialization
**What:** The x402ResourceServer must call `initialize()` to fetch supported payment kinds from the facilitator before processing payments. This should happen at server startup.
**When to use:** In index.ts or a dedicated setup function.
**Example:**
```typescript
// Source: Official x402 examples
import { x402ResourceServer } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
const WALLET_ADDRESS = process.env.RECEIVING_WALLET_ADDRESS;
const NETWORK = process.env.X402_NETWORK || 'eip155:84532'; // testnet default

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const x402Server = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme());

// Must initialize before handling requests
await x402Server.initialize();
```

### Pattern 5: FastifyRequest Type Augmentation
**What:** Extend the existing billingPath union to include 'x402' and add x402Payment context.
**When to use:** In auth.ts type augmentation.
**Example:**
```typescript
// Source: Existing auth.ts pattern + @x402/fastify source
declare module 'fastify' {
  interface FastifyRequest {
    tier: string;
    keyId?: string;
    stripeCustomerId?: string;
    rateLimitRemaining?: number;
    rateLimitLimit?: number;
    rateLimitReset?: number;
    billingPath: 'stripe' | 'free' | 'x402';
    x402Payment?: {
      paymentPayload: PaymentPayload;
      requirements: PaymentRequirements;
    };
  }
}
```

### Anti-Patterns to Avoid
- **DO NOT use @x402/fastify directly:** It is NOT published to npm. Use @x402/core and @x402/evm.
- **DO NOT verify AND settle in preHandler:** Verification in preHandler (before route), settlement in onResponse (after route succeeds). The official Fastify adapter uses onRequest for verify and onSend for settle.
- **DO NOT block on settlement:** Use fire-and-forget pattern like meter-usage.ts. Settlement takes on-chain time.
- **DO NOT hardcode facilitator URL:** Use env var X402_FACILITATOR_URL for testnet/mainnet switching.
- **DO NOT skip initialize():** x402ResourceServer MUST call initialize() to fetch facilitator supported kinds before use. Failure to do so causes "Facilitator does not support exact on eip155:8453" errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment header encoding/decoding | Custom Base64 JSON parsing | `decodePaymentSignatureHeader` from @x402/core | Handles v1 and v2 formats, validates structure |
| Payment verification | Direct blockchain RPC calls | `x402ResourceServer.verifyPayment()` + facilitator | Facilitator handles balance checks, signature recovery, time validity, gas simulation |
| On-chain settlement | Direct viem transaction calls | `x402ResourceServer.settlePayment()` + facilitator | Facilitator manages gas, monitors confirmation, handles EIP-3009 TransferWithAuthorization |
| Payment requirements building | Manual price/asset/amount calculation | `x402ResourceServer.buildPaymentRequirements()` | Handles atomic unit conversion ($0.001 -> 1000 for 6-decimal USDC), scheme-specific enhancements |
| Network/chain config | Hardcoded chain IDs and RPC URLs | ExactEvmScheme from @x402/evm + viem chain definitions | Knows USDC addresses per network, handles EIP-155 format |

**Key insight:** The x402 protocol deliberately pushes complexity into the facilitator service. The server-side code is minimal: check header -> verify via facilitator -> process request -> settle via facilitator. Do NOT try to handle blockchain interactions directly.

## Common Pitfalls

### Pitfall 1: Forgetting to Initialize x402ResourceServer
**What goes wrong:** `buildPaymentRequirements()` throws "Facilitator does not support exact on eip155:8453" even when configuration is correct.
**Why it happens:** `x402ResourceServer.initialize()` fetches supported payment kinds from the facilitator. Without it, the internal supportedResponsesMap is empty.
**How to avoid:** Call `await x402Server.initialize()` at server startup, before registering hooks.
**Warning signs:** Error messages mentioning "no supported payment kinds" or "facilitator does not support".

### Pitfall 2: Hook Ordering (x402 Must Run Before Unkey)
**What goes wrong:** x402 requests get rejected with 401 because Unkey auth rejects the request before x402 hook can verify payment.
**Why it happens:** Fastify preHandler hooks run in registration order. If Unkey auth is registered first, it runs first and rejects requests without an Authorization header.
**How to avoid:** Register x402 preHandler BEFORE Unkey preHandler. Check `request.billingPath` in the Unkey hook and skip if already set to 'x402'.
**Warning signs:** x402-paying agents getting 401 Unauthorized instead of algorithm results.

### Pitfall 3: Payment Header Name Confusion
**What goes wrong:** Payment header is not found even though the client is sending it correctly.
**Why it happens:** x402 protocol evolved through versions. Headers used: `X-PAYMENT` (v1 legacy), `PAYMENT-SIGNATURE` (v2 current). Fastify lowercases all header names.
**How to avoid:** Check both `request.headers['payment-signature']` AND `request.headers['x-payment']` for backwards compatibility. The official Fastify adapter does exactly this.
**Warning signs:** All x402 requests falling through to Unkey auth instead of being processed as payments.

### Pitfall 4: Testnet vs Mainnet Facilitator Mismatch
**What goes wrong:** Payment verification fails in production but works in development.
**Why it happens:** The testnet facilitator (`https://x402.org/facilitator`) only supports Base Sepolia (eip155:84532). The mainnet facilitator (`https://api.cdp.coinbase.com/platform/v2/x402`) supports Base mainnet (eip155:8453) and requires CDP API keys.
**How to avoid:** Use env vars for both FACILITATOR_URL and NETWORK. Default to testnet for development.
**Warning signs:** "Facilitator does not support" errors when deploying to production.

### Pitfall 5: Settling Before Response Completes
**What goes wrong:** Payment is settled on-chain but the API response fails (5xx), meaning the agent paid but got nothing.
**Why it happens:** If settlement runs in preHandler alongside verification, a later route error means the agent loses their USDC.
**How to avoid:** Verify in preHandler, settle in onResponse ONLY when `reply.statusCode < 400`. The official x402 Fastify adapter settles in onSend after the route handler completes.
**Warning signs:** Agents losing USDC on failed requests.

### Pitfall 6: billingPath Type Not Extended
**What goes wrong:** TypeScript compilation errors on `request.billingPath = 'x402'`.
**Why it happens:** The existing type declaration in auth.ts defines `billingPath: 'stripe' | 'free'` -- needs to add `| 'x402'`.
**How to avoid:** Update the `declare module 'fastify'` block in auth.ts to include 'x402' in the union type.
**Warning signs:** TypeScript errors during build.

## Code Examples

Verified patterns from official sources:

### x402ResourceServer Setup
```typescript
// Source: coinbase/x402 examples/typescript/servers/express/index.ts
import { x402ResourceServer } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
});

const x402Server = new x402ResourceServer(facilitatorClient)
  .register('eip155:8453', new ExactEvmScheme());  // Base mainnet

await x402Server.initialize();
```

### Payment Header Decoding
```typescript
// Source: @x402/core/src/http/index.ts
import { decodePaymentSignatureHeader } from '@x402/core'; // or '@x402/core/http'
// NOTE: Import path may vary - check actual exports

// Header value is Base64-encoded JSON
const paymentPayload = decodePaymentSignatureHeader(headerValue);
// Returns: { x402Version: 2, resource: {...}, accepted: {...}, payload: {...} }
```

### Building Payment Requirements
```typescript
// Source: x402ResourceServer.buildPaymentRequirements()
const requirements = await x402Server.buildPaymentRequirements({
  scheme: 'exact',
  payTo: process.env.RECEIVING_WALLET_ADDRESS!,
  price: '$0.001',           // Human-readable USD price
  network: 'eip155:8453',   // Base mainnet
});
// Returns: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000', asset: '0x833589...', payTo: '0x077E...', maxTimeoutSeconds: 300, extra: {...} }]
```

### Verify + Settle Flow
```typescript
// Source: x402ResourceServer source code analysis
// Step 1: Verify (in preHandler)
const matchingReqs = x402Server.findMatchingRequirements(requirements, paymentPayload);
const verifyResult = await x402Server.verifyPayment(paymentPayload, matchingReqs);
// verifyResult: { isValid: boolean, invalidReason?: string, invalidMessage?: string }

// Step 2: Settle (in onResponse, fire-and-forget)
const settleResult = await x402Server.settlePayment(paymentPayload, matchingReqs);
// settleResult: { success: boolean, transaction: string, network: string, errorReason?: string }
```

### Payment Types (from @x402/core)
```typescript
// Source: @x402/core/src/types/payments.ts
type PaymentRequirements = {
  scheme: string;           // "exact"
  network: string;          // "eip155:8453"
  asset: string;            // USDC contract address
  amount: string;           // Atomic units (1000 = $0.001 for 6-decimal USDC)
  payTo: string;            // Receiving wallet address
  maxTimeoutSeconds: number; // Default 300 (5 min)
  extra: Record<string, unknown>;
};

type PaymentPayload = {
  x402Version: number;      // 2
  resource?: ResourceInfo;
  accepted: PaymentRequirements;
  payload: Record<string, unknown>;  // EIP-3009 signature data
};

type PaymentRequired = {
  x402Version: number;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
};
```

### 402 Error Response Pattern
```typescript
// Source: OraClaw problem-details.ts pattern + x402 protocol
// Add to ProblemTypes registry:
// PAYMENT_REQUIRED: 'https://web-olive-one-89.vercel.app/errors/payment-required'

sendProblem(reply, 402, ProblemTypes.PAYMENT_REQUIRED,
  'Payment Required',
  'This endpoint requires x402 USDC payment. Include a PAYMENT-SIGNATURE header.',
  {
    paymentRequirements: requirements,
    protocol: 'x402',
    network: 'eip155:8453',
    currency: 'USDC',
    price: '$0.001',
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| X-PAYMENT header (v1) | PAYMENT-SIGNATURE header (v2) | x402 v2 (2026) | Both should be checked for compatibility |
| Legacy x402 (monolithic package) | Scoped @x402/* packages | v2.0.0 (Feb 2026) | Import paths changed, old `x402` package is legacy |
| Direct on-chain verification | Facilitator-mediated verify+settle | v2.0.0 | Facilitator handles gas, RPC, and confirmation monitoring |
| Stripe MPP only | x402 open protocol + Stripe MPP | Feb 2026 | x402 is the open standard; Stripe's machine payments preview also supports x402 |
| @x402/fastify (published) | Source only (not yet on npm) | Current state (Mar 2026) | Must use @x402/core + @x402/evm directly and build custom Fastify hook |

**Deprecated/outdated:**
- `x402` (unscoped npm package): Legacy, use `@x402/core` v2+ instead
- `x402-express` (unscoped): Legacy, use `@x402/express` v2+ instead
- `X-PAYMENT` header: v1 format, still supported but `PAYMENT-SIGNATURE` is canonical for v2

## Open Questions

1. **@x402/fastify publication timeline**
   - What we know: Source code exists in coinbase/x402 repo, supports Fastify 5, well-tested
   - What's unclear: When/if it will be published to npm
   - Recommendation: Build custom hook using @x402/core. The official source is a reference, not a dependency. If published later, we can migrate.

2. **CDP facilitator API key requirements for mainnet**
   - What we know: Testnet facilitator (x402.org) requires no auth. Mainnet (api.cdp.coinbase.com) requires CDP API keys.
   - What's unclear: Exact CDP API key provisioning process and HTTPFacilitatorClient auth configuration
   - Recommendation: Use testnet for development/testing, document mainnet setup as deployment prerequisite. The HTTPFacilitatorClient constructor accepts `{ url, authHeaders }` for authenticated facilitators.

3. **Import path for header decode utilities**
   - What we know: `decodePaymentSignatureHeader` is in @x402/core/src/http/index.ts
   - What's unclear: Whether the published package exports this at `@x402/core` root, `@x402/core/http`, or `@x402/core/server`
   - Recommendation: After installing, check actual exports via `node -e "console.log(Object.keys(require('@x402/core')))"`. The source shows re-exports from multiple entry points.

4. **Settlement timing: onResponse vs onSend**
   - What we know: Official @x402/fastify uses onSend (can modify payload). Meter-usage uses onResponse (cannot modify payload). Both work for fire-and-forget.
   - What's unclear: Whether settlement should include response body hash (the official implementation passes responseBody to processSettlement)
   - Recommendation: Use onResponse to match meter-usage pattern for consistency. The response body hash is optional and not critical for the "exact" scheme.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 1.2.0 |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd mission-control/apps/api && npx vitest run src/hooks/x402-payment.test.ts` |
| Full suite command | `cd mission-control && npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-02a | @x402/core and @x402/evm installed | unit | `cd mission-control/apps/api && node -e "require('@x402/core'); require('@x402/evm')"` | N/A (package install) |
| INFRA-02b | x402ResourceServer initializes with ExactEvmScheme | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "initializes"` | Wave 0 |
| BILL-04a | Valid PAYMENT-SIGNATURE header sets billingPath='x402' | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "valid payment"` | Wave 0 |
| BILL-04b | Missing payment header passes through (returns undefined) | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "no payment header"` | Wave 0 |
| BILL-04c | Invalid payment returns 402 with payment requirements | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "invalid payment"` | Wave 0 |
| BILL-04d | x402-paid requests bypass Unkey auth | integration | `npx vitest run src/hooks/x402-payment.test.ts -t "bypasses Unkey"` | Wave 0 |
| BILL-04e | x402-paid requests skip Stripe meter | integration | `npx vitest run src/hooks/x402-payment.test.ts -t "skips meter"` | Wave 0 |
| BILL-04f | Three billing paths coexist (free, stripe, x402) | integration | `npx vitest run src/hooks/x402-payment.test.ts -t "three billing paths"` | Wave 0 |
| BILL-04g | 402 response includes RFC 9457 format + payment details | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "402 response"` | Wave 0 |
| BILL-04h | Settlement fires on 2xx, skips on 4xx/5xx | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "settlement"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd mission-control/apps/api && npx vitest run src/hooks/x402-payment.test.ts`
- **Per wave merge:** `cd mission-control && npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/x402-payment.test.ts` -- covers BILL-04a through BILL-04h, INFRA-02b
- [ ] `src/test-utils/mock-x402.ts` -- mock x402ResourceServer factory (verify/settle/buildPaymentRequirements/findMatchingRequirements)
- [ ] Package install: `npm install @x402/core@2.8.0 @x402/evm@2.8.0` -- INFRA-02a

## Sources

### Primary (HIGH confidence)
- [coinbase/x402 GitHub repo](https://github.com/coinbase/x402) -- full source code analyzed for x402ResourceServer (1042 lines), x402HTTPResourceServer (550+ lines), Fastify adapter (400+ lines), Express example, payment types, HTTP header utilities
- npm registry: @x402/core v2.8.0, @x402/evm v2.8.0 confirmed published; @x402/fastify confirmed NOT published (E404)
- [CDP Network Support docs](https://docs.cdp.coinbase.com/x402/network-support) -- facilitator URLs, USDC addresses, network identifiers, pricing

### Secondary (MEDIUM confidence)
- [x402 EVM Exact Scheme spec](https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md) -- EIP-3009 TransferWithAuthorization flow, header format, verification process
- [QuickNode x402 guide](https://www.quicknode.com/guides/infrastructure/how-to-use-x402-payment-required) -- paymentMiddleware configuration pattern, facilitator setup

### Tertiary (LOW confidence)
- Header naming (X-PAYMENT vs PAYMENT-SIGNATURE) -- verified in official Fastify adapter source but protocol evolved; both should be supported

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- packages confirmed published on npm with exact versions, source code fully analyzed
- Architecture: HIGH -- official Fastify adapter source provides exact pattern to follow; existing OraClaw hook patterns are well-established
- Pitfalls: HIGH -- all derived from actual source code analysis (initialize() requirement, hook ordering, header naming, settlement timing)

**Research date:** 2026-03-30
**Valid until:** 2026-04-15 (x402 is evolving; monitor for @x402/fastify publication and v3 changes)
