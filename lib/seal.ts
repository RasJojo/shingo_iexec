/**
 * Seal client wrapper en s’appuyant sur le SDK officiel @mysten/seal.
 * Le chiffrement se fait côté client, le backend ne voit jamais le clair.
 */
import { SealClient, SessionKey } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { fromHEX } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
export type SignMessageFn = (args: { message: Uint8Array }) => Promise<{ signature: string } | { bytes: Uint8Array; signature: string }>;

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

const SEAL_KEY_SERVERS = process.env.NEXT_PUBLIC_SEAL_KEY_SERVERS; // JSON array de key server IDs (objectId)
const SEAL_PACKAGE_ID = process.env.NEXT_PUBLIC_SEAL_PACKAGE_ID; // hex
const SEAL_POLICY_ID_HEX = process.env.NEXT_PUBLIC_SEAL_POLICY_ID_HEX;

function requireKeyServers(): string[] {
  if (!SEAL_KEY_SERVERS) throw new Error('NEXT_PUBLIC_SEAL_KEY_SERVERS manquant');
  try {
    return JSON.parse(SEAL_KEY_SERVERS);
  } catch {
    // fallback split
    return SEAL_KEY_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  }
}
function requireSealPackage(): string {
  if (!SEAL_PACKAGE_ID) throw new Error('NEXT_PUBLIC_SEAL_PACKAGE_ID manquant');
  return SEAL_PACKAGE_ID;
}
function requirePolicyId(): string {
  if (!SEAL_POLICY_ID_HEX) throw new Error('NEXT_PUBLIC_SEAL_POLICY_ID_HEX manquant');
  return SEAL_POLICY_ID_HEX;
}
export function getPolicyBytes(): Uint8Array {
  return fromHEX(requirePolicyId());
}

function buildClient() {
  const keyServers = requireKeyServers();
  // On désactive verifyKeyServers pour rester simple en testnet Open mode.
  return new SealClient({
    suiClient: new SuiClient({ url: getFullnodeUrl('testnet') }),
    serverConfigs: keyServers.map((id) => ({ objectId: id, weight: 1 })),
    verifyKeyServers: false,
  });
}

/**
 * Chiffre un payload JSON de signal avec Seal.
 * @param threshold nombre minimal de key servers pour déchiffrer
 */
export async function sealEncrypt(payload: SignalPayload, threshold = 2): Promise<SealEncryptResult> {
  const packageId = requireSealPackage(); // hex string
  const id = requirePolicyId(); // hex string
  const client = buildClient();
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const { encryptedObject: encryptedBytes, key: backupKey } = await client.encrypt({
    threshold,
    packageId,
    id,
    data,
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
    packageId: requireSealPackage(),
    ttlMin,
    suiClient,
  });
  return sessionKey;
}

/**
 * Déchiffre un blob chiffré (Uint8Array) en utilisant une session key signée par l'utilisateur.
 * `signPersonalMessage` doit venir de useSignPersonalMessage().mutateAsync.
 */
export async function sealDecrypt(
  encrypted: Uint8Array,
  address: string,
  signMessage: SignMessageFn,
  txBytes: Uint8Array,
  threshold = 2
): Promise<Uint8Array> {
  const client = buildClient();
  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  const sessionKey = await SessionKey.create({
    address,
    // SessionKey.create attend une string hex, pas un Uint8Array.
    packageId: requireSealPackage(),
    ttlMin: 10,
    suiClient,
  });
  const personalMessage = sessionKey.getPersonalMessage();
  const signed = await signMessage({ message: personalMessage });
  await sessionKey.setPersonalMessageSignature((signed as any).signature);
  const plain = await client.decrypt({
    data: encrypted,
    sessionKey,
    txBytes,
    threshold,
  });
  return plain as Uint8Array;
}

/**
 * Variante qui réutilise une session key déjà signée pour plusieurs déchiffrements
 * afin d'éviter de demander une signature personnelle à chaque signal.
 */
export async function sealDecryptWithSession(
  encrypted: Uint8Array,
  sessionKey: SessionKey,
  txBytes: Uint8Array,
  threshold = 2
): Promise<Uint8Array> {
  const client = buildClient();
  const plain = await client.decrypt({
    data: encrypted,
    sessionKey,
    txBytes,
    threshold,
  });
  return plain as Uint8Array;
}

/**
 * Construit les tx bytes pour seal_approve_subscription (policy id + pass).
 */
export async function buildSealApproveTx(passId: string, packageId: string, sender: string): Promise<Uint8Array> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::seal_policy::seal_approve_subscription`,
    arguments: [tx.pure.vector('u8', getPolicyBytes()), tx.object(passId)],
  });
  tx.setSender(sender);
  return await tx.build({
    client: new SuiClient({ url: getFullnodeUrl('testnet') }),
    onlyTransactionKind: true,
    overrides: { gasBudget: 5_000_000 },
  });
}
