<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

## Intégrations (Sui / Seal / Walrus)

- Move package : `move/` (dépendance Sui pointée sur `rev = "testnet"`). Modules : `subscription`, `signal_registry`, helpers `types`, `errors`, `views`.
- Endpoints à définir dans l’environnement :
  - `NEXT_PUBLIC_SEAL_ENDPOINT` : service Seal (chiffrement/déchiffrement).
  - `NEXT_PUBLIC_WALRUS_ENDPOINT` : service Walrus (upload/fetch blobs).
  - `NEXT_PUBLIC_SUI_PACKAGE_ID` : package Move publié.
- Helpers TypeScript :
  - `lib/seal.ts` : chiffrement/déchiffrement (adapter les routes selon la doc Seal).
  - `lib/walrus.ts` : upload/fetch blobs (adapter les routes selon la doc Walrus).
  - `lib/sui.ts` : constantes modules/fonctions + helpers d’arguments pour les appels Move.

Les flux restent chiffrés de bout en bout : payload JSON → Seal (chiffre) → Walrus (blob) → on-chain (URI stockée) → déchiffrement uniquement côté client autorisé.
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
