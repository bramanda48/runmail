import { bytesToHex } from "./encoding";

/**
 * RFC 9562 UUIDv7 generator: millisecond timestamp prefix + random bits,
 * suitable for sortable primary keys.
 */
export function uuidv7(): string {
  const bytes = new Uint8Array(16);
  const timestamp = Date.now();
  bytes[0] = (timestamp >>> 40) & 0xff;
  bytes[1] = (timestamp >>> 32) & 0xff;
  bytes[2] = (timestamp >>> 24) & 0xff;
  bytes[3] = (timestamp >>> 16) & 0xff;
  bytes[4] = (timestamp >>> 8) & 0xff;
  bytes[5] = timestamp & 0xff;
  // Fill bytes 7..15 with random, then set version/variant bits
  const rand = crypto.getRandomValues(new Uint8Array(10));
  bytes[6] = (rand[0] & 0x0f) | 0x70; // version 7 in high nibble of byte 6
  bytes[7] = rand[1];
  bytes[8] = (rand[2] & 0x3f) | 0x80; // variant 10 in high bits of byte 8
  bytes[9] = rand[3];
  bytes[10] = rand[4];
  bytes[11] = rand[5];
  bytes[12] = rand[6];
  bytes[13] = rand[7];
  bytes[14] = rand[8];
  bytes[15] = rand[9];

  const hex = bytesToHex(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join("-");
}
