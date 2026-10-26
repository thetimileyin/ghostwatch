/** How a coin was locked, in plain words (Bitcoin Core script type names). */
export const SCRIPT: Record<string, string> = {
  pubkey: "a pay-to-public-key script (P2PK), the format of Bitcoin's earliest years, which writes the public key itself onto the chain",
  pubkeyhash: "a standard pay-to-public-key-hash address (P2PKH), the classic address starting with 1",
  scripthash: "a pay-to-script-hash address (P2SH), the kind starting with 3",
  witness_v0_keyhash: "a native SegWit address (P2WPKH), starting with bc1q",
  witness_v0_scripthash: "a native SegWit script address (P2WSH)",
  witness_v1_taproot: "a Taproot address (P2TR), starting with bc1p",
  multisig: "a bare multisignature script",
};

/** Short tag for a script type, e.g. for tables. */
export const SCRIPT_TAG: Record<string, string> = {
  pubkey: "P2PK",
  pubkeyhash: "P2PKH",
  scripthash: "P2SH",
  witness_v0_keyhash: "P2WPKH",
  witness_v0_scripthash: "P2WSH",
  witness_v1_taproot: "P2TR",
  multisig: "Multisig",
  nulldata: "OP_RETURN",
};
