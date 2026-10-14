/**
 * Parser for QRIS / static payment QR payloads (EMVCo-compatible).
 *
 * Pure function: takes a QR payload string and returns the amount in
 * rupiah. It touches neither React nor state — safe to call from the
 * camera scanning loop.
 *
 * EMVCo TLV format: `TAG` + `LEN` + `VALUE` (LEN is 2 decimal digits).
 * Tags used:
 *  - `01` Payload Format Indicator
 *  - `26` Merchant Account Information (nested TLV, may carry the merchant name)
 *  - `52` Merchant Category Code
 *  - `53` Transaction Currency → `360` = IDR
 *  - `54` Transaction Amount (dot/comma decimal, e.g. "18200.00")
 *  - `58` Country Code → `ID`
 *  - `59` Merchant Name
 *  - `60` Merchant City
 *
 * Reference: EMVCo QRCPS Merchant-presented / Consumer-presented spec.
 */

const EMV_HEADER = '000201';

export interface ParsedQrPayload {
  /** Amount in rupiah, or null when the QR carries no amount. */
  amount: number | null;
  /** Merchant name when readable, null when absent. */
  merchantName: string | null;
  /** Currency code (360 = IDR). */
  currency: string | null;
}

/** Walked state machine that reads a single TLV tag at `pos`. */
function readTag(
  data: string,
  pos: number
): { tag: string; length: number; value: string; next: number } | null {
  if (pos + 4 > data.length) return null;
  const tag = data.slice(pos, pos + 2);
  const length = Number.parseInt(data.slice(pos + 2, pos + 4), 10);
  if (!Number.isFinite(length) || length < 0) return null;
  const start = pos + 4;
  const end = start + length;
  if (end > data.length) return null;
  return { tag, length, value: data.slice(start, end), next: end };
}

/** Splits all first-level TLVs into a tag → value map. */
function topLevelTags(data: string): Map<string, string> {
  const map = new Map<string, string>();
  let pos = 0;
  while (pos < data.length) {
    const field = readTag(data, pos);
    if (!field) break;
    map.set(field.tag, field.value);
    pos = field.next;
  }
  return map;
}

/**
 * Finds tag `54` (Transaction Amount). Returns the amount in rupiah, or null
 * when absent / invalid / outside a plausible range.
 *
 * Important guard: strings from a QR are untrusted input, so every value
 * must be validated before being used as a money amount.
 */
function parseAmount(tags: Map<string, string>): number | null {
  const raw = tags.get('54');
  if (!raw) return null;
  // EMVCo uses either a dot or a comma as the decimal separator.
  const normalized = raw.replace(',', '.').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  // Cap the value so a physically printed QR with an absurd amount cannot corrupt state.
  if (value > 1_000_000_000) return null;
  return Math.round(value);
}

/** Merchant name: try tag 59 first, then the nested TLV inside tag 26. */
function parseMerchantName(tags: Map<string, string>): string | null {
  const direct = tags.get('59');
  if (direct && direct.trim()) return direct.trim();

  const mai = tags.get('26');
  if (mai) {
    // Tag 26 is a nested TLV: look for tag `08` (Merchant Name) inside it.
    let pos = 0;
    while (pos < mai.length) {
      const field = readTag(mai, pos);
      if (!field) break;
      if (field.tag === '08' && field.value.trim()) return field.value.trim();
      pos = field.next;
    }
  }
  return null;
}

/**
 * Parses a payment QR payload.
 *
 * Returns an object with `amount: null` when the payload does not use the
 * EMVCo format or carries no amount — the caller can fall back to manual
 * input instead of guessing a number.
 */
export function parseQrPayload(payload: string): ParsedQrPayload {
  const data = (payload ?? '').trim();
  const empty: ParsedQrPayload = { amount: null, merchantName: null, currency: null };
  if (!data || !data.startsWith(EMV_HEADER)) return empty;

  const tags = topLevelTags(data);
  return {
    amount: parseAmount(tags),
    merchantName: parseMerchantName(tags),
    currency: tags.get('53') ?? null,
  };
}