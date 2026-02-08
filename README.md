# Shingo

Private trading signals with on-chain subscriptions on Arbitrum Sepolia and confidential decryption via iExec TEE.

Built for Hack4Privacy.

## Live

- Frontend: `https://shingo-iexec.vercel.app`
- Network: Arbitrum Sepolia (`chainId=421614`)

## What It Does

- Traders create a profile and open a paid season.
- Traders publish encrypted signals.
- Followers subscribe on-chain using USDC.
- Only authorized users can decrypt active season signals.
- Once the trader closes a season, signals become publicly decryptable (public history / track record).

## Why It Matters

- On-chain business logic: seasons, subscriptions, and signal metadata are enforced by smart contract.
- Confidential payloads: sensitive signal details are processed through iExec TEE.
- Practical monetization model: per-season pricing with a clean OPEN/CLOSED lifecycle.

## Architecture

- Frontend: Next.js + React + ethers + shadcn/ui
- Smart contract: `evm/contracts/ShingoHub.sol`
- Backend relay/API: AdonisJS (`backend/`)
- Confidential compute: iExec DataProtector + TEE app (`shingo-tee-app/`)

### Responsibilities

| Layer | Responsibility |
|---|---|
| On-chain (`ShingoHub`) | Trader registration, unique pseudonym, seasons, subscriptions, signal metadata |
| Backend (`/tee/*`) | Protect payload, grant access, decrypt request orchestration, sync from on-chain events |
| iExec TEE | Decrypt/process protected data under granted access rules |
| Frontend | User UX, wallet interactions, trader/follower flows |

## End-to-End Flow

1. Trader calls `registerTrader(pseudo)` then `openSeason(priceToken)`.
2. Trader publishes a signal:
   - Frontend sends payload to `POST /tee/protect`
   - Backend returns `protectedData` address
   - Frontend stores metadata on-chain via `publishSignal(protectedDataAddr)`
3. Follower subscribes with `subscribe(seasonId)` (USDC transfer on-chain).
4. Sync service catches events and grants access (`grantAccess`) to season subscribers.
5. Follower requests `POST /tee/decrypt` with `signalId` + wallet address.
6. If authorized, backend executes TEE processing and returns decrypted payload.
7. When season is closed, signals become public and can be decrypted by anyone.

## Repository Layout

- `app/`, `components/`, `lib/`: frontend app
- `backend/`: AdonisJS API and TEE sync/grant/decrypt services
- `evm/`: Hardhat contracts, tests, deployment, E2E scripts
- `shingo-tee-app/`: iExec app code
- `feedback.md`: hackathon feedback

## Smart Contract

File: `evm/contracts/ShingoHub.sol`

Core capabilities:
- Unique trader pseudonyms
- Season lifecycle (`OPEN` / `CLOSED`)
- Paid subscriptions per season
- Signal registry per season
- Public history after close

## Backend API

Routes file: `backend/start/routes.ts`

- `POST /tee/protect`
- `POST /tee/decrypt`
- `POST /tee/grant-subscriber`
- `POST /tee/grant-season-subscribers`
- `POST /tee/publicize-season`
- `GET /tee/sync/status`
- `POST /tee/sync/catchup`

## Local Setup

### Prerequisites

- Node.js 18+ (Node 20+ recommended)
- `pnpm`
- Wallet private keys for testnet flows

### 1) Install dependencies

```bash
pnpm install
pnpm --dir backend install
cd evm && npm install && cd ..
```

### 2) Configure environment

#### Frontend (`.env.local`)

Required:

```bash
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:3333
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_SHINGO_HUB_ADDRESS=0x...
NEXT_PUBLIC_SHINGO_DEPLOY_BLOCK=...
NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
NEXT_PUBLIC_PAYMENT_TOKEN_SYMBOL=USDC
NEXT_PUBLIC_PAYMENT_TOKEN_DECIMALS=6
```

#### EVM / shared runtime (`evm/.env`)

Required:

```bash
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
IEXEC_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
RELAY_PRIVATE_KEY=0x...
SHINGO_HUB_ADDRESS=0x...
IEXEC_TEE_APP=0x...
PAYMENT_TOKEN_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
```

Optional but recommended for sync:

```bash
TEE_SYNC_ENABLED=true
TEE_SYNC_START_BLOCK_DELTA=4000
TEE_SYNC_CATCHUP_INTERVAL_MS=30000
TEE_SYNC_LIVE_LISTENERS=false
```

#### Backend (`backend/.env`)

You can keep regular Adonis values in `backend/.env`.
TEE/EVM values can be set in either:
- `evm/.env` (shared)
- or `backend/.env` (backend-only deployment)

The backend now supports both locations.

### 3) Run locally

```bash
pnpm dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:3333`

### 4) Health checks

```bash
curl http://127.0.0.1:3333/
curl http://127.0.0.1:3333/tee/sync/status
```

## EVM Commands

```bash
cd evm
npm run compile
npm run test
npm run deploy:arbitrum-sepolia
npm run e2e:devnet-tee
npm run e2e:onchain-tee
```

## Production Notes

- Frontend runs on Vercel.
- Backend is deployed privately (URL intentionally omitted).
- Backend service must run with a valid Node path and loaded env values.

## Troubleshooting

### `Missing SHINGO_HUB_ADDRESS` or `Missing RELAY_PRIVATE_KEY`

- Ensure variables are present in `evm/.env` or `backend/.env`.
- Restart backend process after env changes.

### `Failed to grant access`

- If access already exists, backend now treats it as non-fatal.
- If still failing, verify:
  - `IEXEC_TEE_APP`
  - relay wallet ownership/authorization over the protected data
  - RPC health

### `No compatible iExec orderbook triplet found`

- App order or workerpool order unavailable.
- Retry later or switch to a known working TEE app for Arbitrum Sepolia.

### `RPC 429 / Too Many Requests`

- Use a dedicated Arbitrum Sepolia RPC endpoint.
- Avoid public endpoint overload for production.

### `TEE decrypt timeout`

- Jobs can take time on testnet.
- Retry once; check backend logs and orderbook conditions.

## Security Model (Short)

- On-chain decides who is subscribed and when a season is closed.
- Backend enforces those on-chain checks before decrypt requests.
- Plaintext signal details are processed in iExec TEE flow, not stored on-chain.

## Hackathon Assets

- Feedback: `feedback.md`

## License

Hackathon prototype, all rights reserved by project authors unless stated otherwise.
