# Development Practices

## Reference Before Implementing

Before adding new features or creating parity between flows (e.g., Share flow vs Create flow):

1. **Inspect existing implementation first** — The Create flow (`src/app/cards/create/[recipientId]/page.tsx`) and related APIs are the tested reference. Understand current paths, API usage, and state handling before writing new code.

2. **Analyze what to implement — and what to skip** — Not everything needs parity:
   - Does the API support it?
   - Does it make sense for this flow?
   - Can we reuse tested patterns instead of inventing new ones?

3. **Follow proven paths** — Reuse the same API call patterns, state structures, and UX flows. Inconsistent implementations hurt UX and introduce bugs.
