import type { RpcBlock } from "./detect";

/**
 * Minimal Bitcoin Core JSON-RPC client with ordered failover across endpoints.
 * Public endpoints (e.g. publicnode) need no auth; a private node can be given
 * as http://user:pass@host:8332.
 */
export class BitcoinRpc {
  private next = 0;

  constructor(
    private readonly urls: string[],
    private readonly timeoutMs = 90_000,
  ) {
    if (urls.length === 0) throw new Error("BitcoinRpc needs at least one URL");
  }

  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.urls.length; attempt++) {
      const url = this.urls[(this.next + attempt) % this.urls.length];
      try {
        const result = await this.post<T>(url, method, params);
        this.next = (this.next + attempt) % this.urls.length; // stick with what works
        return result;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  private async post<T>(rawUrl: string, method: string, params: unknown[]): Promise<T> {
    const u = new URL(rawUrl);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (u.username) {
      headers.authorization = "Basic " + Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString("base64");
      u.username = "";
      u.password = "";
    }
    const res = await fetch(u, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "1.0", id: method, method, params }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok && res.status !== 500) throw new Error(`${method} via ${u.host}: HTTP ${res.status}`);
    const body = (await res.json()) as { result: T; error: { message: string } | null };
    if (body.error) throw new Error(`${method} via ${u.host}: ${body.error.message}`);
    return body.result;
  }

  tipHeight() {
    return this.call<number>("getblockcount");
  }
  blockHash(height: number) {
    return this.call<string>("getblockhash", [height]);
  }
  header(hash: string) {
    return this.call<{ hash: string; height: number; time: number; previousblockhash?: string }>("getblockheader", [hash]);
  }
  /** Full block with every input's prevout (height, value, script). */
  blockWithPrevouts(hash: string) {
    return this.call<RpcBlock>("getblock", [hash, 3]);
  }
}

export function rpcFromEnv(): BitcoinRpc {
  const urls = (process.env.BITCOIN_RPC_URLS ?? "https://bitcoin-rpc.publicnode.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new BitcoinRpc(urls);
}
