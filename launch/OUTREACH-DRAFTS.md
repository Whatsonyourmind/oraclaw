# Lead Outreach Drafts — Apr 5, 2026

**RULE: Never post API keys in public GitHub comments. Ask for email/DM first.**

---

## 1. juliosuas — airbnb-manager#13

**Context:** He installed @oraclaw/bandit, got a Thompson sampling implementation guide. Last message was from us suggesting `strategy: "thompson_sampling"`.

**Reply draft:**

> Hey @juliosuas — how's the bandit integration going? Curious if Thompson sampling is giving you better results than epsilon-greedy for the listing optimization.
>
> I recently shipped an MCP server version that bundles all 12 algorithms (bandits, LP scheduler, forecasting, etc.) — could be useful for the multi-property allocation side of airbnb-manager. Happy to set you up with a free API key if you want to try the full suite. DM me or drop your email and I'll send it over.

---

## 2. radoxtech — diricode (pick #536 or #537)

**Context:** 7 issues answered, building our exact algorithm stack. #536 = context compression, #537 = subagent delegation.

**Reply draft (on whichever issue has latest activity):**

> [Technical reply relevant to the specific issue first — 2-3 sentences addressing their question]
>
> BTW — I built a hosted API for the algorithms we've been discussing across these issues (bandits, convergence scoring, LP solver, etc.). If you want to try them programmatically in diricode instead of reimplementing, I can send you a free API key. Just let me know.

---

## 3. hideya — langchain-mcp-tools#51

**Context:** Confirmed all 12 tools work, gave Medium marketing advice, offered collaboration. MCP ecosystem builder.

**Reply draft:**

> Hi @hideya — I just shipped v1.1.1 of the MCP server with a free/premium tier split (6 free tools, 6 premium including LP solver and graph analytics). Would love to add an OraClaw example to the langchain-mcp-tools README showing the integration in action — happy to submit a PR if you're open to it.
>
> I also set up a beta API key for you with full access to all 12 tools (growth tier, 16K calls/day, 30 days free). Want me to DM it?

---

## 4. vstash — #89

**Context:** Owner @stffns accepted our IDF weighting approach over OOV, implementing it.

**Reply draft:**

> Hey @stffns — how's the IDF implementation coming along? Did the stratified approach help with the relevance scoring?
>
> If you want to validate the rankings programmatically, I have a convergence scoring API that measures multi-source agreement — useful for checking if different ranking signals are converging on the same results. Happy to send you a free key to try it. Just let me know.

---

## 5. heisenberg — #50

**Context:** Owner @kamilpajak shipped V1 (PR #51 merged), we posted Brier skill score advice, invited input on calibration.

**Reply draft:**

> Hey @kamilpajak — how's the prediction data coming in? Once you have ~100 resolved predictions, the Brier skill score will start showing meaningful calibration patterns.
>
> I have a calibration scoring API (Brier + log score + reliability diagrams) that can process your prediction history automatically — returns decomposed scores so you can see if the issue is discrimination vs reliability. Want me to send you a free API key to try it?

---

## Sending Protocol

1. Post the message on the relevant GitHub issue
2. If they respond positively, send the key via:
   - GitHub DM (preferred)
   - Email (if they share it)
   - In a follow-up comment with a note: "Sending via DM"
3. After sending, update launch/BETA-KEYS.md "Sent" column
4. Update launch/LEAD-TRACKER.md "Beta Key" column
5. Follow up in 3 days if no response
