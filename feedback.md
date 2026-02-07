# Hack4Privacy Feedback (Shingo Team)

## What worked well

- The iExec documentation around DataProtector and orderbook concepts was useful once the full flow was understood.
- The hackathon format pushed us to ship a real end-to-end prototype (smart contract + frontend + backend + TEE).
- Arbitrum + iExec is a strong combination for UX/business logic + privacy compute.

## Pain points we hit

- Testnet funding/friction for RLC and execution resources caused repeated blocking during debugging.
- It is not immediately obvious to newcomers which parts are on-chain vs off-chain in TEE flows.
- Public RPC limits (rate limits / CORS issues) slowed iteration in local frontend development.
- TEE failure modes (timeout/orderbook mismatch) are hard to diagnose without deep logs.

## Suggestions for future editions

- Provide a clearly documented “golden path” starter for Arbitrum Sepolia + iExec with known working app/orderbook.
- Add a dedicated faucet or sponsored credits for hackathon participants for smoother E2E testing.
- Publish a troubleshooting matrix for common TEE errors (funds, orderbook, app mismatch, timeout).
- Provide a minimal reference architecture diagram explicitly separating:
  - on-chain authorization/state
  - off-chain TEE execution/orchestration
  - who pays at each step.

## Overall

Great challenge and very relevant privacy stack. With a bit more onboarding and testnet DX support, teams can spend more time innovating and less time unblocking infra.
