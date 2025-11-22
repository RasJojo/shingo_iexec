/**
 * Seal client wrapper en s’appuyant sur le SDK officiel @mysten/seal.
 * Le chiffrement se fait côté client, le backend ne voit jamais le clair.
 */
import { SealClient, SessionKey } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { fromHEX } from '@mysten/sui/utils';

export interface SignalPayload {
  market: string;
  side: 'BUY' | 'SELL';
  position_type: 'LONG' | 'SHORT';
  entry_type: 'MARKET' | 'LIMIT';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  leverage?: number;
  size_type: 'PERCENT' | 'ABSOLUTE';
  size_value: number;
  slippage_bps?: number;
  valid_until: string; // ISO string
  note?: string;
}

export interface SealEncryptResult {
  encryptedBytes: Uint8Array;
  backupKey: Uint8Array;
}

const SEAL_KEY_SERVERS = process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS; // comma-separated URLs
const SEAL_PACKAGE_ID = process.env.NEXT_PUBLIC_SEAL_PACKAGE_ID; // hex

function requireKeyServers(): string[] {
  if (!SEAL_KEY_SERVERS) throw new Error('NEXT_PUBLIC_SEAL_KEY_SERVERS manquant');
  return SEAL_KEY_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
}
function requireSealPackage(): string {
  if (!SEAL_PACKAGE_ID) throw new Error('NEXT_PUBLIC_SEAL_PACKAGE_ID manquant');
  return SEAL_PACKAGE_ID;
}

/**
 * Chiffre un payload JSON de signal avec Seal.
 * @param policyIdHex identifiant de policy (hex sans 0x) défini dans votre module Seal (seal_approve*)
 * @param threshold nombre minimal de key servers pour déchiffrer
 */
export async function sealEncrypt(payload: SignalPayload, policyIdHex: string, threshold = 2): Promise<SealEncryptResult> {
  const keyServers = requireKeyServers();
  const packageId = fromHEX(requireSealPackage());
  const id = fromHEX(policyIdHex);

  const client = new SealClient({ keyServers, verifyKeyServers: true });
  const { encryptedObject: encryptedBytes, key: backupKey } = await client.encrypt({
    threshold,
    packageId,
    id,
    data: payload,
  });
  return { encryptedBytes, backupKey };
}

/**
 * Initialise un SessionKey pour le déchiffrement.
 * L’app doit demander à l’utilisateur de signer sessionKey.getPersonalMessage().
 */
export async function createSealSessionKey(address: string, ttlMin = 10) {
  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  const sessionKey = await SessionKey.create({
    address,
    packageId: fromHEX(requireSealPackage()),
    ttlMin,
    suiClient,
  });
  return sessionKey;
}
