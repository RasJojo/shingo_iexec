/**
 * Seed 5 signals (passé/actif/futur) pour le trader de démo.
 * Utilise @mysten/seal, Walrus (testnet) et publie via publish_signal.
 *
 * Prérequis :
 * - .env.local rempli (keys Seal/Walrus + package)
 * - Wallet testnet avec la TraderCap : 0xffcfcc4d1e303d5927419ba0fae35090e959e4314aa09fc2f34101d13dfc037d
 * - SUI testnet pour payer le gas
 *
 * Usage (avec ts-node) :
 *   pnpm ts-node scripts/seed_signals.ts
 */
import 'dotenv/config';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromHEX } from '@mysten/sui/utils';
import { SealClient } from '@mysten/seal';
import fetch from 'node-fetch';

// Env
const PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID!;
const SEAL_POLICY_ID_HEX = process.env.NEXT_PUBLIC_SEAL_POLICY_ID_HEX!;
const SEAL_KEY_SERVERS = JSON.parse(process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS || '[]');
const WALRUS_PUBLISHER = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER!;
const WALRUS_AGGREGATOR = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR!;

// Objets
const TRADER_CAP_ID = '0xffcfcc4d1e303d5927419ba0fae35090e959e4314aa09fc2f34101d13dfc037d';
const CLOCK_ID = '0x6';

// Signaux à publier (5 scénarios, dont un intraday SUI short 23/11/2025)
type SeedPayload = {
  label: string;
  walrus_uri?: string;
  valid_until_ms: number;
  payload: any;
};

const now = Date.now();
const oneDay = 24 * 3600 * 1000;

const seeds: SeedPayload[] = [
  {
    label: 'SUI short intraday 23/11/2025',
    valid_until_ms: now - oneDay, // expiré
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
    valid_until_ms: now - oneDay * 2, // expiré
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
    valid_until_ms: now + oneDay * 3, // actif
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
    valid_until_ms: now - oneDay / 2, // expiré
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
    valid_until_ms: now + oneDay * 7, // actif/futur
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

async function main() {
  console.log('Seeding signals…');
  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  const seal = new SealClient({
    suiClient,
    serverConfigs: SEAL_KEY_SERVERS.map((id: string) => ({ objectId: id, weight: 1 })),
    verifyKeyServers: false,
  });

  for (const seed of seeds) {
    try {
      console.log(`- ${seed.label}`);
      const data = new TextEncoder().encode(JSON.stringify(seed.payload));
      const { encryptedObject } = await seal.encrypt({
        threshold: 2,
        packageId: PACKAGE_ID,
        id: fromHEX(SEAL_POLICY_ID_HEX),
        data,
      });
      const walrusUri = await uploadWalrus(encryptedObject);

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::signal_registry::publish_signal`,
        arguments: [
          tx.object(TRADER_CAP_ID),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(walrusUri))),
          tx.pure.u64(BigInt(seed.valid_until_ms)),
          tx.object(CLOCK_ID),
        ],
      });
      tx.setSender(await suiClient.getAddress());
      const res = await suiClient.signAndExecuteTransaction({
        signer: await suiClient.getSignerInstance(),
        transaction: tx,
        options: { showEffects: true },
      } as any);
      console.log(`  → published ${walrusUri}, digest ${res.digest}`);
    } catch (e: any) {
      console.error(`  x ${seed.label}: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
