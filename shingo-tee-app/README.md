# Shingo TEE App (Pass-through)

Cette iApp iExec sert a decrypter un `protectedData` et renvoyer le payload signal tel quel (sans scoring, sans transformation metier).

## Prerequis

- `iapp` installe globalement
- Docker lance
- wallet avec un peu de fonds testnet pour deploy

## Utilisation rapide

```bash
cd shingo-tee-app
npm install
npm run test:local
```

Le test local ecrit le resultat dans `output/result.json`.

## Deploy sur Arbitrum Sepolia

```bash
cd shingo-tee-app
iapp wallet import
iapp deploy --chain arbitrum-sepolia-testnet
```

A la fin du deploy, copie l'adresse de l'app et mets-la dans `evm/.env`:

```env
IEXEC_TEE_APP=0xYOUR_DEPLOYED_APP_ADDRESS
```

Puis relance backend + front.

## Ce que fait l'app

- Lit le `protectedData` via `@iexec/dataprotector-deserializer`
- Tente de recuperer les champs Shingo connus (`market`, `side`, `entryPrice`, etc.)
- Ecrit le payload dans `result.json`
- Ecrit `computed.json` avec `deterministic-output-path` vers `result.json`

