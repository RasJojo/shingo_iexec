# Shingo EVM (Arbitrum + iExec TEE)

Custom stablecoin subscription contract on Arbitrum with iExec TEE orchestration.

## Stack

- Solidity + Hardhat
- Payment token: USDC/USDT (configurable)
- iExec DataProtector Core for TEE encryption and access control

## Quick start

```bash
cd evm
cp .env.example .env
npm install
npm run compile
npm run test
npm run e2e:devnet-tee
npm run e2e:onchain-tee
```

## Deploy

```bash
npm run deploy:arbitrum-sepolia
# or
npm run deploy:arbitrum
```

## Onchain-first sync relay

Access sync is derived from on-chain events only:

- `Subscribed` => grant subscriber access to current season signals
- `SignalPublished` => grant new signal to all season subscribers
- `SeasonClosed` => publicize all season signals in iExec

In the backend (Adonis), this relay now starts automatically in `web` environment.

Useful API endpoints:

- `GET /tee/sync/status`
- `POST /tee/sync/catchup`

Env switches:

- `TEE_SYNC_ENABLED=true` (default)
- `TEE_SYNC_START_BLOCK_DELTA=4000`
- `TEE_SYNC_CATCHUP_INTERVAL_MS=30000`

## E2E Devnet + Real TEE

`e2e:devnet-tee` runs:
- local devnet deployment (`MockUSDC` + `ShingoHub`)
- trader registration + season opening + subscription payment
- real iExec `protectData` + `grantAccess` + `processProtectedData`

`e2e:onchain-tee` runs the full same flow on Arbitrum Sepolia with on-chain contracts.

Required in `evm/.env`:
- `RELAY_PRIVATE_KEY`
- `SUBSCRIBER_PRIVATE_KEY`
- `ARBITRUM_SEPOLIA_RPC_URL` (or set `IEXEC_RPC_URL`)
- `IEXEC_TEE_APP` strongly recommended (Arbitrum Sepolia validated: `0x8bda493af230369ed36d29c17e9eb7ed171acd55`)
- optional `IEXEC_PROCESS_TIMEOUT_MS` (default `420000`)
