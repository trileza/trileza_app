/**
 * Cryptographically secure random generators.
 *
 * Every value in this file guards something: session bearer tokens, 2FA codes,
 * invite tokens, backup codes. `Math.random()` is a seeded PRNG whose output is
 * predictable from a handful of observed values, so it must never be used for
 * any of them — always go through `crypto.getRandomValues`.
 */

const getCrypto = (): Crypto => {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!c || typeof c.getRandomValues !== 'function') {
    // Failing loudly is correct here: silently degrading to Math.random would
    // reintroduce the vulnerability this module exists to close.
    throw new Error('Secure random number generation is unavailable in this environment.');
  }
  return c;
};

/**
 * A URL-safe, high-entropy token. 32 bytes → 64 hex characters (256 bits).
 * Used for admin session bearer tokens and admin invite tokens.
 */
export const generateSecureToken = (byteLength = 32): string => {
  const bytes = new Uint8Array(byteLength);
  getCrypto().getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * A uniformly distributed integer in [0, max) with no modulo bias.
 */
const secureRandomInt = (max: number): number => {
  if (max <= 0) throw new Error('max must be greater than 0');
  // Largest multiple of `max` that fits in a uint32 — values above it are
  // rejected and re-drawn so every outcome stays equally likely.
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    getCrypto().getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % max;
};

/**
 * A numeric one-time code of fixed length, e.g. the 6-digit admin 2FA code.
 * Leading zeros are preserved, so every code in the range is reachable.
 */
export const generateNumericCode = (digits = 6): string => {
  let code = '';
  for (let i = 0; i < digits; i++) {
    code += secureRandomInt(10).toString();
  }
  return code;
};

/**
 * A single recovery code in `xxxx-xxxx` form, drawn from an unambiguous
 * alphabet (no 0/o/1/l) so codes survive being read aloud or copied by hand.
 */
export const generateBackupCode = (): string => {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(secureRandomInt(chars.length));
  }
  return code;
};

/**
 * `count` distinct recovery codes.
 */
export const generateBackupCodes = (count = 8): string[] => {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateBackupCode());
  }
  return Array.from(codes);
};
