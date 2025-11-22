/**
 * Walrus client wrapper aligné sur la doc officielle : HTTP PUT sur le publisher,
 * GET sur l'aggregator, chemins /v1/blobs.
 */

export interface WalrusUploadResponse {
  newlyCreated?: {
    blobObject: {
      id: string;
      blobId: string;
      size: number;
      encodingType: string;
      registeredEpoch: number;
      certifiedEpoch: number;
      deletable: boolean;
    };
    cost: number;
  };
  alreadyCertified?: {
    blobId: string;
    event: { txDigest: string; eventSeq: string };
    endEpoch: number;
  };
}

const PUBLISHER = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER; // ex: https://publisher.walrus-testnet.walrus.space
const AGGREGATOR = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR; // ex: https://aggregator.walrus-testnet.walrus.space

function requirePublisher(): string {
  if (!PUBLISHER) throw new Error('Walrus publisher non défini (NEXT_PUBLIC_WALRUS_PUBLISHER)');
  return PUBLISHER;
}
function requireAggregator(): string {
  if (!AGGREGATOR) throw new Error('Walrus aggregator non défini (NEXT_PUBLIC_WALRUS_AGGREGATOR)');
  return AGGREGATOR;
}

/**
 * Upload d’un blob chiffré. `data` doit déjà être chiffré (Seal).
 * Options : epochs, permanent/deletable, send_object_to (query string).
 */
export async function uploadWalrusBlob(
  data: ArrayBuffer | Blob,
  opts?: { epochs?: number; permanent?: boolean; deletable?: boolean; sendObjectTo?: string }
): Promise<WalrusUploadResponse> {
  const endpoint = requirePublisher();
  const params = new URLSearchParams();
  if (opts?.epochs !== undefined) params.set('epochs', String(opts.epochs));
  if (opts?.permanent) params.set('permanent', 'true');
  if (opts?.deletable) params.set('deletable', 'true');
  if (opts?.sendObjectTo) params.set('send_object_to', opts.sendObjectTo);

  const url = `${endpoint}/v1/blobs${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, {
    method: 'PUT',
    body: data,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Walrus upload failed: ${res.status} ${text}`);
  }
  return (await res.json()) as WalrusUploadResponse;
}

/**
 * Récupère un blob chiffré via son blobId (renvoyé par l’upload).
 */
export async function fetchWalrusBlob(blobId: string): Promise<ArrayBuffer> {
  const endpoint = requireAggregator();
  const res = await fetch(`${endpoint}/v1/blobs/${encodeURIComponent(blobId)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Walrus fetch failed: ${res.status} ${text}`);
  }
  return await res.arrayBuffer();
}
