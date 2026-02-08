import fs from 'node:fs/promises';
import path from 'node:path';
import { IExecDataProtectorDeserializer } from '@iexec/dataprotector-deserializer';

const SUPPORTED_FIELDS = [
  'market',
  'marketBase',
  'marketQuote',
  'side',
  'sideLabel',
  'entryKind',
  'entryKindLabel',
  'entryPrice',
  'stopLoss',
  'takeProfitPrice',
  'takeProfitSize',
  'sizeUsd',
  'leverage',
  'venue',
  'venueLabel',
  'timeframe',
  'timeframeLabel',
  'entry',
  'stop',
  'takeProfit',
  'seasonId',
  'timestamp',
  // Useful for local scaffolded mocks.
  'secretText',
];

const NUMERIC_FIELDS = new Set([
  'side',
  'entryKind',
  'entryPrice',
  'stopLoss',
  'takeProfitPrice',
  'takeProfitSize',
  'sizeUsd',
  'leverage',
  'venue',
  'timeframe',
  'entry',
  'stop',
  'takeProfit',
]);

async function tryGetValue(deserializer, key, type) {
  try {
    return await deserializer.getValue(key, type);
  } catch {
    return undefined;
  }
}

async function buildPassThroughPayload() {
  const deserializer = new IExecDataProtectorDeserializer();
  const payload = {};

  for (const key of SUPPORTED_FIELDS) {
    let value;

    if (NUMERIC_FIELDS.has(key)) {
      // Try schemas in order:
      //  1. 'string'  – new signals (numbers stored as strings by backend)
      //  2. 'f64'     – current borsh format used by protectData for JS numbers
      //  3. 'number'  – legacy format (raw text bytes)
      value = await tryGetValue(deserializer, key, 'string');
      if (value === undefined) {
        value = await tryGetValue(deserializer, key, 'f64');
      }
      if (value === undefined) {
        value = await tryGetValue(deserializer, key, 'number');
      }

      if (value === undefined) {
        continue;
      }

      // Convert to number regardless of which schema succeeded.
      const str = String(value).trim().replace(',', '.');
      if (str !== '') {
        const parsed = Number(str);
        if (Number.isFinite(parsed)) {
          value = parsed;
        }
      }
    } else {
      // String fields: try 'string' first, then 'f64'/'number' as fallback.
      value = await tryGetValue(deserializer, key, 'string');
      if (value === undefined) {
        value = await tryGetValue(deserializer, key, 'f64');
      }
      if (value === undefined) {
        value = await tryGetValue(deserializer, key, 'number');
      }

      if (value === undefined) {
        continue;
      }

      // Coerce non-string results to string.
      if (typeof value !== 'string') {
        value = String(value);
      }
    }

    payload[key] = value;
  }

  if (Object.keys(payload).length === 0) {
    return {
      error: 'No supported field found in protected data',
      expectedFields: SUPPORTED_FIELDS,
    };
  }

  return payload;
}

async function main() {
  const outputDir = process.env.IEXEC_OUT || '/iexec_out';
  const resultPath = path.join(outputDir, 'result.json');
  const computedPath = path.join(outputDir, 'computed.json');

  let resultPayload;
  let computedPayload;

  try {
    resultPayload = await buildPassThroughPayload();
    computedPayload = {
      'deterministic-output-path': resultPath,
    };
  } catch (error) {
    resultPayload = {
      error: 'Unable to deserialize protected data',
      details: error instanceof Error ? error.message : String(error),
    };
    computedPayload = {
      'deterministic-output-path': resultPath,
      'error-message': resultPayload.details,
    };
  }

  await fs.writeFile(resultPath, JSON.stringify(resultPayload, null, 2));
  await fs.writeFile(computedPath, JSON.stringify(computedPayload, null, 2));
}

main();
