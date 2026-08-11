import crypto from "crypto";

const KEY_LENGTH = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const LEGACY_SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export function hashPassword(password: string): string {
  const cleanPassword = String(password || "").trim();

  if (!cleanPassword) {
    return "";
  }

  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(cleanPassword, salt, KEY_LENGTH, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
    })
    .toString("hex");

  return [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt,
    hash,
  ].join("$");
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const cleanPassword = String(password || "").trim();
  const savedHash = String(passwordHash || "").trim();

  if (!cleanPassword || !savedHash) {
    return false;
  }

  if (LEGACY_SHA256_PATTERN.test(savedHash)) {
    const legacyHash = crypto
      .createHash("sha256")
      .update(cleanPassword, "utf8")
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(legacyHash, "hex"),
      Buffer.from(savedHash, "hex")
    );
  }

  const parts = savedHash.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  const salt = parts[4];
  const originalHash = parts[5];

  if (!cost || !blockSize || !parallelization || !salt || !originalHash) {
    return false;
  }

  const hash = crypto
    .scryptSync(cleanPassword, salt, KEY_LENGTH, {
      N: cost,
      r: blockSize,
      p: parallelization,
    })
    .toString("hex");

  const originalBuffer = Buffer.from(originalHash, "hex");
  const currentBuffer = Buffer.from(hash, "hex");

  if (originalBuffer.length !== currentBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(originalBuffer, currentBuffer);
}