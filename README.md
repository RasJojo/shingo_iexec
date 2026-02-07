# Shingo – Private Trading Signals (Arbitrum + iExec TEE)

Hackathon project (Hack4Privacy): private signal monetization with on-chain subscriptions and TEE-based decryption.

## What Shingo does

- Traders publish encrypted signals.
- Followers subscribe on-chain with a stablecoin (USDC on Arbitrum Sepolia).
- Only authorized users can decrypt active signals.
- When a season is closed, signals become publicly decryptable.

## Why this is innovative

- `Onchain-first` access model: subscription state, seasons, and signal metadata are enforced by smart contract.
- `TEE privacy`: signal plaintext is decrypted inside iExec trusted execution environment.
- `Season model`: business-friendly pricing and lifecycle (`OPEN` / `CLOSED`) with public track record after closure.

## Architecture

- Frontend: Next.js + ethers + shadcn/ui
- On-chain contract: `evm/contracts/ShingoHub.sol` (Arbitrum)
- Backend relay/API: AdonisJS (`backend/`) for iExec DataProtector operations and sync
- TEE execution: iExec app (`shingo-tee-app/`) called by backend

Flow:
1. Trader registers and opens a season with a price.
2. Trader publishes a signal:
   - backend encrypts payload (`/tee/protect`)
   - contract stores `protectedDataAddr` metadata on-chain.
3. Subscriber pays on-chain with `subscribe(seasonId)`.
4. Backend sync grants decryption access for subscribers.
5. Signal decrypt request goes through `/tee/decrypt`.
6. When season is closed, signals are considered public and can be decrypted without subscription.

## Smart Contract Scope

Main contract: `evm/contracts/ShingoHub.sol`

- Trader profile with unique pseudo
- Season lifecycle (`openSeason`, `closeSeason`)
- Signal registry per season
- Stablecoin subscription per season
- On-chain checks used by backend for authorization

## Key Backend Endpoints

- `POST /tee/protect`
- `POST /tee/decrypt`
- `POST /tee/grant-subscriber`
- `GET /tee/sync/status`
- `POST /tee/sync/catchup`

Routes file: `backend/start/routes.ts`.

## Repository Structure

- `app/`, `components/`, `lib/`: frontend
- `backend/`: AdonisJS API + iExec orchestration
- `evm/`: Hardhat project, contract, deploy scripts, tests, E2E scripts
- `shingo-tee-app/`: iExec app code (TEE worker payload extraction)

## Quickstart (Local)

Prerequisites:
- Node 18+
- pnpm
- wallets/private keys for Arbitrum Sepolia testing

1. Install dependencies

```bash
pnpm install
pnpm --dir backend install
cd evm && npm install && cd ..
```

2. Configure environment

- Frontend env: `.env.local`
  - set `NEXT_PUBLIC_SHINGO_HUB_ADDRESS`
  - set `NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS`
  - set `NEXT_PUBLIC_CHAIN_ID=421614`
- Backend env: `backend/.env` (from `backend/.env.example`)
  - set `RELAY_PRIVATE_KEY`
  - set `SHINGO_HUB_ADDRESS`
  - set `IEXEC_TEE_APP`
  - set RPC URL (`IEXEC_RPC_URL` or `ARBITRUM_SEPOLIA_RPC_URL`)
- EVM env: `evm/.env` (from `evm/.env.example`)

3. Start app

```bash
pnpm dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:3333`

## Contract / E2E Commands

```bash
cd evm
npm run compile
npm run test
npm run deploy:arbitrum-sepolia
npm run e2e:onchain-tee
```

## Submission Notes for Judges

- `feedback.md` contains builder feedback requested by hackathon organizers.
- Public history in trader profile now reads real on-chain closed-season signals and supports decrypt display inline.

## Known Constraints

- iExec decryption jobs depend on available testnet resources/orderbook.
- Backend is required for current iExec integration path (`protect/decrypt/grants` orchestration).
- Testnet faucet and token liquidity limits can throttle repeated end-to-end runs.
