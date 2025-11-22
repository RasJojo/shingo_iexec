/**
 * Helpers de configuration Sui pour utiliser les modules Move publiés.
 * Aucun appel réseau ici : seulement des constantes et helpers d’arguments.
 */

export const SUI_PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID ?? '0xPLACEHOLDER_PACKAGE';
export const MODULES = {
  subscription: 'subscription',
  signalRegistry: 'signal_registry',
};

export const FUNCTIONS = {
  registerTrader: 'register_trader',
  mintSubscription: 'mint_subscription',
  revokeSubscription: 'revoke',
  publishSignal: 'publish_signal',
};

export interface PublishSignalArgs {
  traderCapId: string; // object ID de la TraderCap
  walrusUri: Uint8Array; // URI Walrus en bytes
  validUntil: bigint; // timestamp (u64)
}

/**
 * Prépare les args Move pour publish_signal.
 * Le wallet/SDK (ex: @mysten/sui.js) utilisera ces valeurs pour construire la TransactionBlock.
 */
export function buildPublishSignalArgs(args: PublishSignalArgs) {
  return [args.traderCapId, Array.from(args.walrusUri), args.validUntil];
}

export interface MintSubscriptionArgs {
  traderCapId: string;
  subscriber: string; // address Sui
  expiresAt: bigint;
}

export function buildMintSubscriptionArgs(args: MintSubscriptionArgs) {
  return [args.traderCapId, args.subscriber, args.expiresAt];
}
