// Creates GhostWatch's Nostr key and writes it straight into the server's settings file,
// printing only the public address (npub). The secret never appears on screen.
// Usage (on the server, as root):  npm run nostr:key -- /etc/ghostwatch/env
import { appendFileSync, readFileSync } from "node:fs";
import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { parseSecret } from "../src/lib/publish/nostr";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run nostr:key -- /etc/ghostwatch/env");
  process.exit(1);
}

const text = readFileSync(file, "utf8");
const existing = parseSecret(text.match(/^NOSTR_SECRET_KEY=(.*)$/m)?.[1]);
if (existing) {
  console.log(`A key is already set. GhostWatch's Nostr address: ${nip19.npubEncode(getPublicKey(existing))}`);
  process.exit(0);
}
if (/^NOSTR_SECRET_KEY=/m.test(text)) {
  console.error(`${file} has an empty or invalid NOSTR_SECRET_KEY line. Remove it, then run this again.`);
  process.exit(1);
}

const sk = generateSecretKey();
appendFileSync(file, `${text.endsWith("\n") ? "" : "\n"}NOSTR_SECRET_KEY=${nip19.nsecEncode(sk)}\n`);
console.log(`Saved a new key to ${file}.`);
console.log(`GhostWatch's Nostr address: ${nip19.npubEncode(getPublicKey(sk))}`);
console.log("Restart the worker to start posting:  systemctl restart ghostwatch-worker");
