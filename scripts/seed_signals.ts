/**
 * Seed 5 signals (passé / actif / futur) via Seal + Walrus + sui client call.
 *
 * Prérequis :
 *  - .env.local rempli (package ID, seal policy, walrus endpoints)
 *  - Wallet actif dans `sui client active-address` avec la TraderCap :
 *        0xffcfcc4d1e303d5927419ba0fae35090e959e4314aa09fc2f34101d13dfc037d
 *  - SUI testnet pour le gas.
 *
 * Usage :
 *   pnpm ts-node scripts/seed_signals.ts
 *
 * Le script :
 *   - chiffre chaque payload avec Seal
 *   - uploade sur Walrus
 *   - appelle `sui client call` pour publish_signal (walrus_uri hex, valid_until, clock 0x6)
 */
import 'dotenv/config';
import { fromHEX } from '@mysten/sui/utils';
import { SealClient } from '@mysten/seal';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import fetch from 'node-fetch';
import { execSync } from 'child_process';

const PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID!;
const POLICY_ID_HEX = process.env.NEXT_PUBLIC_SEAL_POLICY_ID_HEX!;
const SEAL_KEY_SERVERS = JSON.parse(process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS || '[]');
const WALRUS_PUBLISHER = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER!;

const TRADER_CAP_ID = '0xffcfcc4d1e303d5927419ba0fae35090e959e4314aa09fc2f34101d13dfc037d';
const CLOCK_ID = '0x6';

const now = Date.now();
const oneDay = 24 * 3600 * 1000;

type SeedPayload = {
  label: string;
  valid_until_ms: number;
  payload: any;
};

const seeds: SeedPayload[] = [
  {
    label: 'SUI short intraday 23/11/2025',
    valid_until_ms: now - oneDay,
    payload: {
      market: 'SUI/USDC',
      side: 'SELL',
      position_type: 'SHORT',
      entry_type: 'MARKET',
      entry_price: 1.3890,
      stop_loss: 1.3945,
      take_profit: 1.3415,
      leverage: 1,
      size_type: 'PERCENT',
      size_value: 2,
      slippage_bps: 50,
      valid_until: new Date(now - oneDay).toISOString(),
      created_at: '2025-11-23T09:00:00Z',
      resolved_at: '2025-11-23T16:00:00Z',
      outcome: 'TP',
      pnl_pct: 3.4,
      note: 'Short intraday basé sur OHLC du 23/11/2025',
    },
  },
  {
    label: 'CETUS short intraday',
    valid_until_ms: now - oneDay * 2,
    payload: {
      market: 'CETUS/USDC',
      side: 'SELL',
      position_type: 'SHORT',
      entry_type: 'MARKET',
      entry_price: 0.038,
      stop_loss: 0.0385,
      take_profit: 0.0353,
      leverage: 1,
      size_type: 'PERCENT',
      size_value: 2,
      slippage_bps: 50,
      valid_until: new Date(now - oneDay * 2).toISOString(),
      created_at: '2025-11-06T09:00:00Z',
      resolved_at: '2025-11-06T13:00:00Z',
      outcome: 'TP',
      pnl_pct: 7.1,
      note: 'Short intraday CETUS',
    },
  },
  {
    label: 'CETUS long swing',
    valid_until_ms: now + oneDay * 3,
    payload: {
      market: 'CETUS/USDC',
      side: 'BUY',
      position_type: 'LONG',
      entry_type: 'MARKET',
      entry_price: 0.0348,
      stop_loss: 0.0335,
      take_profit: 0.037,
      leverage: 1,
      size_type: 'PERCENT',
      size_value: 2,
      slippage_bps: 50,
      valid_until: new Date(now + oneDay * 3).toISOString(),
      created_at: new Date(now - oneDay * 5).toISOString(),
      note: 'Swing haussier CETUS',
    },
  },
  {
    label: 'NAVX long intraday gagnant',
    valid_until_ms: now - oneDay / 2,
    payload: {
      market: 'NAVX/USDC',
      side: 'BUY',
      position_type: 'LONG',
      entry_type: 'MARKET',
      entry_price: 0.0139,
      stop_loss: 0.0134,
      take_profit: 0.0168,
      leverage: 1,
      size_type: 'PERCENT',
      size_value: 2,
      slippage_bps: 50,
      valid_until: new Date(now - oneDay / 2).toISOString(),
      created_at: '2025-11-22T09:00:00Z',
      resolved_at: '2025-11-22T15:00:00Z',
      outcome: 'TP',
      pnl_pct: 21.0,
      note: 'NAVX intraday haussier',
    },
  },
  {
    label: 'NAVX long swing perdant',
    valid_until_ms: now + oneDay * 7,
    payload: {
      market: 'NAVX/USDC',
      side: 'BUY',
      position_type: 'LONG',
      entry_type: 'MARKET',
      entry_price: 0.0207,
      stop_loss: 0.0134,
      take_profit: 0.025,
      leverage: 1,
      size_type: 'PERCENT',
      size_value: 2,
      slippage_bps: 50,
      valid_until: new Date(now + oneDay * 7).toISOString(),
      created_at: new Date(now - oneDay * 10).toISOString(),
      note: 'Exemple de swing risqué NAVX',
    },
  },
];

async function uploadWalrus(data: Uint8Array): Promise<string> {
  const resp = await fetch(`${WALRUS_PUBLISHER}/v1/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: data,
  });
  if (!resp.ok) throw new Error(`Walrus upload failed: ${resp.status} ${resp.statusText}`);
  const json: any = await resp.json();
  const blobId = json.newlyCreated?.blobObject?.blobId || json.alreadyCertified?.blobId;
  if (!blobId) throw new Error('No blobId returned by Walrus');
  return `walrus://${blobId}`;
}

function toHexVector(u: string): string {
  return '0x' + Buffer.from(u, 'utf8').toString('hex');
}

async function main() {
  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  const seal = new SealClient({
    suiClient,
    serverConfigs: SEAL_KEY_SERVERS.map((id: string) => ({ objectId: id, weight: 1 })),
    verifyKeyServers: false,
  });

  for (const seed of seeds) {
    console.log(`\n[seed] ${seed.label}`);
    try {
      const data = new TextEncoder().encode(JSON.stringify(seed.payload));
      const { encryptedObject } = await seal.encrypt({
        threshold: 2,
        packageId: PACKAGE_ID,
        id: fromHEX(POLICY_ID_HEX),
        data,
      });
      const walrusUri = await uploadWalrus(encryptedObject);
      const hexUri = toHexVector(walrusUri);
      console.log(`  walrusUri=${walrusUri}`);

      const cmd = [
        'sui', 'client', 'call',
        '--package', PACKAGE_ID,
        '--module', 'signal_registry',
        '--function', 'publish_signal',
        '--args',
        TRADER_CAP_ID,
        hexUri,
        seed.valid_until_ms.toString(),
        CLOCK_ID,
        '--gas-budget', '20000000'
      ];
      const out = execSync(cmd.join(' '), { encoding: 'utf8' });
      console.log(out);
    } catch (e: any) {
      console.error(`  x ${seed.label}: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
