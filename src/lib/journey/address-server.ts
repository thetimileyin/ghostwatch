import { MEMPOOL, cached, getJson, getJsonOrReason } from "./fetch";
import { addressType, buildAddressStory, normalizeAddress, type AddressStory, type RawAddrTx, type RawAddressStats, type RawUtxo } from "./address";

export type AddressResult = { kind: "ok"; story: AddressStory } | { kind: "invalid" } | { kind: "error" };

/**
 * One address's story, looked up by our server (the visitor's browser never contacts
 * mempool.space) and kept for a minute. Searches aren't stored or logged.
 */
export async function getAddressStory(input: string): Promise<AddressResult> {
  const address = normalizeAddress(input);
  if (!addressType(address)) return { kind: "invalid" };
  return cached(`addr:${address}`, () => load(address), (v) => (v.kind === "ok" ? 60_000 : v.kind === "invalid" ? 10 * 60_000 : 0));
}

async function load(address: string): Promise<AddressResult> {
  const stats = await getJsonOrReason<RawAddressStats>(`${MEMPOOL}/address/${address}`);
  if (!stats.ok) return stats.status === 400 ? { kind: "invalid" } : { kind: "error" };
  const [utxo, txs] = await Promise.all([
    // Very busy addresses (500+ coins) can't be listed; the story then shows totals only.
    getJsonOrReason<RawUtxo[]>(`${MEMPOOL}/address/${address}/utxo`),
    getJson<RawAddrTx[]>(`${MEMPOOL}/address/${address}/txs`),
  ]);
  if (!utxo.ok && utxo.status !== 400) return { kind: "error" };
  return { kind: "ok", story: buildAddressStory(address, stats.data, utxo.ok ? utxo.data : null, txs ?? []) };
}
