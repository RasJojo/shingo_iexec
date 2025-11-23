# NOTASCAM – Sui + Seal + Walrus

Plateforme de signaux crypto où :

- Les abonnements et références de signaux sont on-chain (Sui).
- Le contenu des signaux est chiffré (Seal) et stocké off-chain (Walrus).
- Tant qu’un signal est actif, un pass on-chain est requis pour le lire ; une fois expiré, il devient public.

## Architecture

- **Move / Sui**

  - `subscription` : enregistrement d’un trader (prix en SUI), pass d’abonnement (`SubscriptionPass`), profil partagé.
  - `signal_registry` : publication d’un `SignalRef` partagé (trader, URI Walrus, `valid_until`). Aucune donnée sensible on-chain.
  - `seal_policy` : policy d’accès pour Seal : actif → pass requis ; expiré → public.
  - `types` : définitions (`TraderCap`, `TraderProfile`, `SubscriptionPass`, `SignalRef`) et helpers ; les signaux sont `share_object` pour être lisibles par la policy.

- **Seal (chiffrement & contrôle d’accès)**

  - Chiffre le JSON du signal côté client avec : `packageId`, `policyId`, key servers.
  - Déchiffre via un PTB qui appelle `seal_approve_subscription`. Si pass valide (ou signal expiré), le key server délivre la clé.

- **Walrus (stockage)**
  - Stocke le blob chiffré, renvoie une URI `walrus://...`.
  - On-chain : on ne garde que l’URI ; le contenu reste chiffré off-chain.

## Flux utilisateur

1. Trader s’enregistre (`register_trader_open`), définit un prix.
2. Trader chiffre son signal (Seal), upload Walrus → obtient l’URI.
3. Trader publie l’URI + `valid_until` via `publish_signal` → crée un `SignalRef` partagé.
4. Abonné achète un pass (SUI) pour le trader.
5. Pour lire : télécharge le blob Walrus, appelle `seal_approve_subscription` (Seal). Actif → pass requis ; expiré → public.

## Environnements (testnet)

- `NEXT_PUBLIC_SUI_PACKAGE_ID` / `NEXT_PUBLIC_SEAL_PACKAGE_ID` : `0xf96349f40d1a24c2cd6cea10bbc5c265f32a18a35a51993e616ff4b20357b7c6`
- `NEXT_PUBLIC_SEAL_POLICY_ID_HEX` : `6e6f74617363616d5f7369676e616c73`
- `NEXT_PUBLIC_SEAL_KEY_SERVERS` : `["0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75","0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"]`
- Walrus testnet : publisher/aggregator déjà en .env.
- Backend (Adonis) : `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:3333` (ou ton endpoint hébergé).

## Front (Next.js)

- Pages principales : Marketplace (listing mock + on-chain), Trader (profil + perf mock + souscription), Terminal (signaux actifs pour les passes).
- DA : fond sombre “glassmorphism”, accents cyan/émeraude néon, typographie techno/mono, courbes lissées.

## Backend (AdonisJS)

- Rôles : API REST, indexation on-chain, agrégation, stats, auth par wallet. (À héberger séparément si déployé en prod).
- Variables clés : `APP_KEY`, config Postgres, CORS (autoriser le domaine front).

## Smart contracts (tech)

- `register_trader_open(price_mist)` : crée `TraderCap` + `TraderProfile` partagé.
- `mint_subscription_public_profile(profile, subscriber, expires_at, clock, coin)` : crée `SubscriptionPass`.
- `publish_signal(trader_cap, walrus_uri, valid_until, clock)` : crée `SignalRef` partagé.
- `seal_approve_subscription(id, signal, pass, clock, ctx)` : policy Seal (actif → pass requis ; expiré → public).

## Immutabilité

- Un signal publié est figé : pas de fonction de mise à jour/suppression ; on-chain ne stocke que la référence (URI + timestamps). Le blob chiffré Walrus reste inchangé.

## Déploiement (suggestion)

- Front → Vercel : fournir les `NEXT_PUBLIC_*`.
- Backend → Render (ou autre) : Adonis build (`node ace build --production`, `node build/server.js`), Postgres, migrations (`node ace migration:run`), CORS.
- Testnet uniquement : wallet Sui avec du gas pour publier/payer les passes.

## Limitations actuelles / TODO

- Deux anciens signaux ont des blobs invalides (placeholder / threshold Seal non satisfaisant). Publier de nouveaux signaux via Creator avec un vrai upload Walrus + threshold cohérent.
- Perf/history mock en front ; à remplacer par des stats réelles via indexation + Birdeye.
- Terminal désactive la déchiffre auto pour éviter les pop-ups ; réactiver sur action explicite si besoin.

## Quickstart local

```bash
pnpm install
pnpm dev
# Vérifie .env.local (package ID testnet ci-dessus)
```
