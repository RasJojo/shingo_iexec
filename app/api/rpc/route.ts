import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_UPSTREAMS = [
  "https://sepolia-rollup.arbitrum.io/rpc",
  "https://arbitrum-sepolia-rpc.publicnode.com",
  "https://arbitrum-sepolia.gateway.tenderly.co",
  "https://arbitrum-sepolia.drpc.org",
];

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 421614);
const chainIdHex = `0x${chainId.toString(16)}`;

function parseUpstreams(): string[] {
  const explicitCsv =
    process.env.ARBITRUM_SEPOLIA_RPC_URLS ||
    process.env.RPC_UPSTREAMS ||
    "";
  const single =
    process.env.ARBITRUM_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ||
    "";

  const raw = [
    ...explicitCsv
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
    single.trim(),
    ...DEFAULT_UPSTREAMS,
  ].filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const url of raw) {
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    deduped.push(url);
  }
  return deduped;
}

function toSleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number) {
  return status === 429 || status === 408 || status === 500 || status === 502 || status === 503 || status === 504;
}

function buildJsonRpcError(id: unknown, message: string) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code: -32000,
      message,
    },
  };
}

async function requestUpstream(upstream: string, body: string) {
  const response = await fetch(upstream, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.text();
  return { response, payload };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }

  // Fast-path for the most frequent network detection calls.
  if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
    const payload = parsed as { id?: unknown; method?: string };
    if (payload.method === "eth_chainId") {
      return NextResponse.json({ jsonrpc: "2.0", id: payload.id ?? null, result: chainIdHex });
    }
    if (payload.method === "net_version") {
      return NextResponse.json({ jsonrpc: "2.0", id: payload.id ?? null, result: String(chainId) });
    }
  }

  const upstreams = parseUpstreams();
  const maxAttemptsPerUpstream = Number(process.env.RPC_PROXY_RETRIES ?? 2);
  let lastStatus = 0;
  let lastPayload = "";
  let lastError: unknown = null;

  for (const upstream of upstreams) {
    for (let attempt = 1; attempt <= maxAttemptsPerUpstream; attempt += 1) {
      try {
        const { response, payload } = await requestUpstream(upstream, body);
        lastStatus = response.status;
        lastPayload = payload;

        if (response.ok) {
          return new NextResponse(payload, {
            status: response.status,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
              "x-rpc-upstream": upstream,
            },
          });
        }

        if (!shouldRetry(response.status)) {
          return new NextResponse(payload, {
            status: response.status,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
              "x-rpc-upstream": upstream,
            },
          });
        }
      } catch (error) {
        lastError = error;
      }

      // Backoff before retrying same upstream.
      await toSleep(200 * attempt);
    }
  }

  const rpcId =
    parsed && !Array.isArray(parsed) && typeof parsed === "object"
      ? (parsed as { id?: unknown }).id
      : null;
  const message =
    lastStatus === 429
      ? "All RPC upstreams are rate-limited (429). Configure ARBITRUM_SEPOLIA_RPC_URL with a dedicated endpoint."
      : `RPC upstream unavailable${lastError ? `: ${String(lastError)}` : ""}`;
  const errorPayload = buildJsonRpcError(rpcId, message);

  return NextResponse.json(errorPayload, {
    status: lastStatus === 429 ? 429 : 503,
    headers: {
      "cache-control": "no-store",
      "x-rpc-last-status": String(lastStatus || 0),
      "x-rpc-last-payload-bytes": String(lastPayload.length),
    },
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    proxy: "/api/rpc",
    chainId,
    chainIdHex,
    upstreams: parseUpstreams(),
  });
}
