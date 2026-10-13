/**
 * Parser payload QRIS / QR pembayaran statis (EMVCo-compatible).
 *
 * Fungsi murni: menerima string payload QR dan mengembalikan nominal dalam
 * rupiah. Tidak menyentuh React maupun state — aman dipanggil dari loop
 * pemindaian kamera.
 *
 * Format EMVCo TLV: `TAG` + `LEN` + `VALUE` (LEN 2 digit desimal).
 * Tag yang dipakai:
 *  - `01` Payload Format Indicator
 *  - `26` Merchant Account Information (TLV bersarang, bisa memuat nama merchant)
 *  - `52` Merchant Category Code
 *  - `53` Transaction Currency → `360` = IDR
 *  - `54` Transaction Amount (desimal titik/koma, mis. "18200.00")
 *  - `58` Country Code → `ID`
 *  - `59` Merchant Name
 *  - `60` Merchant City
 *
 * Referensi: EMVCo QRCPS Merchant-presented / Consumer-presented spec.
 */

const EMV_HEADER = '000201';

export interface ParsedQrPayload {
  /** Nominal dalam rupiah, atau null bila QR tidak membawa nominal. */
  amount: number | null;
  /** Nama merchant bila terbaca, null bila tidak ada. */
  merchantName: string | null;
  /** Kode mata uang (360 = IDR). */
  currency: string | null;
}

/** walked state machine untuk membaca satu tag TLV pada `pos`. */
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

/** Pecah seluruh TLV di level pertama menjadi peta tag → value. */
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
 * Cari tag `54` (Transaction Amount). Mengembalikan nominal rupiah, atau null
 * bila tidak ada / tidak valid / di luar rentang yang masuk akal.
 *
 * Guard penting: string dari QR adalah input tak dipercaya, jadi setiap nilai
 * wajib divalidasi sebelum dipakai sebagai nominal uang.
 */
function parseAmount(tags: Map<string, string>): number | null {
  const raw = tags.get('54');
  if (!raw) return null;
  // EMVCo memakai titik atau koma sebagai desimal.
  const normalized = raw.replace(',', '.').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  // Batasi agar QR PHY dengan nominal gila tidak merusak state.
  if (value > 1_000_000_000) return null;
  return Math.round(value);
}

/** Nama merchant: coba tag 59 dulu, lalu nested TLV di dalam tag 26. */
function parseMerchantName(tags: Map<string, string>): string | null {
  const direct = tags.get('59');
  if (direct && direct.trim()) return direct.trim();

  const mai = tags.get('26');
  if (mai) {
    // Tag 26 adalah TLV bersarang: cari tag `08` (Merchant Name) di dalamnya.
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
 * Parse payload QR pembayaran.
 *
 * Mengembalikan objek berisi `amount: null` bila payload tidak memakai format
 * EMVCo atau tidak memuat nominal — pemanggil dapat memakai input manual
 * sebagai gantinya alih-alih menebak angka.
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