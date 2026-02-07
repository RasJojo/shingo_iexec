# Shingo Demo Script (<= 4 min)

## 0:00 - 0:25 | Intro

"Hi, we are Shingo. We built a private trading signal platform for Hack4Privacy.  
Users subscribe on Arbitrum, and signal decryption is enforced through iExec TEE."

Show:
- Landing page
- Brief architecture slide or README snippet

## 0:25 - 1:10 | Problem + Solution

"Traders want to monetize alpha without leaking full signal data.  
Followers want transparent on-chain subscription logic.  
Shingo combines both: on-chain subscription state and TEE-protected signal payloads."

Show:
- `ShingoHub.sol` key functions: `openSeason`, `publishSignal`, `subscribe`, `closeSeason`

## 1:10 - 2:05 | Trader flow

"A trader registers, opens a season with a USDC price, and publishes a signal.  
The payload is encrypted through iExec DataProtector.  
Only protected data metadata is stored on-chain."

Show in UI:
- Register trader
- Open season
- Publish/encrypt signal

## 2:05 - 3:00 | Subscriber flow

"A follower subscribes on-chain with USDC.  
Then they click decrypt; backend checks on-chain rights and executes TEE decrypt flow.  
Authorized users see plaintext, unauthorized users are blocked."

Show in UI:
- Subscribe transaction
- Signal list
- Decrypt result panel (mapped fields + raw JSON)

## 3:00 - 3:35 | Public history

"When the trader closes the season, historical signals become public.  
The profile page reads real on-chain closed-season history and supports decryption display inline."

Show:
- Close season action
- Trader profile public history table

## 3:35 - 4:00 | Wrap up

"Shingo demonstrates an onchain-first privacy product:  
transparent subscription economics on Arbitrum + confidential compute with iExec TEE."

"Thanks for watching."

---

## Recording checklist

- Keep one speaker voice throughout the demo.
- Keep runtime under 4:00.
- Include at least one on-chain tx and one decrypt action.
- Show repository README + feedback file briefly at the end.
