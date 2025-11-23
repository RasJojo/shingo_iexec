/**
 * Seed 5 signaux (passé/actif/futur) pour le trader 0xffcfcc... avec Walrus + Seal + sui client call.
 * Utilise le wallet actif de `sui client active-address` pour signer.
 * Pré-requis :
 *   - .env.local rempli (package ID, SEAL policy, key servers, Walrus endpoints)
 *   - TraderCap : 0xffcfcc4d1e303d5927419ba0fae35090e959e4314aa09fc2f34101d13dfc037d
 *   - Clock : 0x6
 *   - SUI testnet pour payer le gas
 *
 * Exécution :
 *   node scripts/seed_signals.js
 */

require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');
const { SealClient } = require('@mysten/seal');
const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');
const { fromHEX } = require('@mysten/sui/utils');

const PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID;
const POLICY_HEX = process.env.NEXT_PUBLIC_SEAL_POLICY_ID_HEX;
const SEAL_KEY_SERVERS = JSON.parse(process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS || '[]');
const WALRUS_PUBLISHER = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER;
const TRADER_CAP_ID = '0xffcfcc4d1e303d5927419ba0fae35090e959e4314aa09fc2f34101d13dfc037d';
const CLOCK_ID = '0x6';

if (!PACKAGE_ID || !POLICY_HEX || !WALRUS_PUBLISHER || SEAL_KEY_SERVERS.length === 0) {
  console.error('Env manquantes. Vérifie .env.local');
  process.exit(1);
}

const now = Date.now();
const oneDay = 24 * 3600 * 1000;

const seeds = [
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

async function uploadWalrus(data) {
  const url = `${WALRUS_PUBLISHER}/v1/blobs`;
  const resp = await fetch(url, {
    method: 'PUT',
    body: Buffer.from(data),
  });
  if (!resp.ok) throw new Error(`Walrus upload failed: ${resp.status} ${resp.statusText}`);
  const json = await resp.json();
  const blobId = json.newlyCreated?.blobObject?.blobId || json.alreadyCertified?.blobId;
  if (!blobId) throw new Error('No blobId returned by Walrus');
  return `walrus://${blobId}`;
}

function toHexVector(str) {
  return '0x' + Buffer.from(str, 'utf8').toString('hex');
}

async function main() {
  console.log('Seeding 5 signals with active wallet…');
  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  const seal = new SealClient({
    suiClient,
    serverConfigs: SEAL_KEY_SERVERS.map((id) => ({ objectId: id, weight: 1 })),
    verifyKeyServers: false,
  });

  for (const seed of seeds) {
    console.log(`\n[seed] ${seed.label}`);
    try {
      // 1) Chiffrer
      const data = new TextEncoder().encode(JSON.stringify(seed.payload));
      const { encryptedObject } = await seal.encrypt({
        threshold: 2,
        packageId: PACKAGE_ID,
        id: POLICY_HEX,
        data,
      });

      // 2) Upload Walrus
      const walrusUri = await uploadWalrus(encryptedObject);
      console.log(`  walrusUri=${walrusUri}`);

      // 3) Publish on-chain via sui client call (walrus_uri en hex vector<u8>)
      const hexUri = toHexVector(walrusUri);
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
    } catch (e) {
      console.error(`  x ${seed.label}: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
