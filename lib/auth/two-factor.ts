import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Configure TOTP settings
authenticator.options = {
  digits: 6,
  step: 30, // 30 seconds
  window: 1, // Allow 1 step before/after for clock drift
};

const APP_NAME = 'Trading Alerts';

/**
 * Generate a new TOTP secret for a user
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate the otpauth:// URI for authenticator apps
 */
export function generateOtpauthURL(email: string, secret: string): string {
  return authenticator.keyuri(email, APP_NAME, secret);
}

/**
 * Generate a QR code as a data URL for the authenticator app
 */
export async function generateQRCodeDataURL(otpauthURL: string): Promise<string> {
  return QRCode.toDataURL(otpauthURL, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256,
  });
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Generate backup codes (10 codes, each 8 characters)
 * Returns both the plain codes (to show user once) and hashed codes (to store)
 */
export async function generateBackupCodes(): Promise<{
  plainCodes: string[];
  hashedCodes: string[];
}> {
  const BACKUP_CODE_COUNT = 10;

  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // Generate a random code with format: xxxx-xxxx
    const part1 = crypto.randomBytes(2).toString('hex');
    const part2 = crypto.randomBytes(2).toString('hex');
    const code = `${part1}-${part2}`;

    plainCodes.push(code);

    // Hash the code for storage
    const hashedCode = await bcrypt.hash(code, 10);
    hashedCodes.push(hashedCode);
  }

  return { plainCodes, hashedCodes };
}

/**
 * Verify a backup code against stored hashed codes
 * Returns the index of the matched code (to mark it as used) or -1 if not found
 */
export async function verifyBackupCode(
  inputCode: string,
  hashedCodes: string[]
): Promise<number> {
  // Normalize input (remove dashes, lowercase)
  const normalizedInput = inputCode.toLowerCase().replace(/-/g, '');

  for (let i = 0; i < hashedCodes.length; i++) {
    const hashedCode = hashedCodes[i];
    // Skip empty/used codes
    if (!hashedCode) continue;

    // Try matching with the dash format
    const withDash = `${normalizedInput.slice(0, 4)}-${normalizedInput.slice(4)}`;
    const isMatch = await bcrypt.compare(withDash, hashedCode);

    if (isMatch) {
      return i;
    }
  }

  return -1;
}

/**
 * Encrypt a TOTP secret for storage
 * Uses AES-256-GCM with a key derived from the environment
 */
export function encryptSecret(secret: string): string {
  const encryptionKey = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a TOTP secret from storage
 */
export function decryptSecret(encryptedData: string): string {
  const encryptionKey = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Get or generate the encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env['TWO_FACTOR_ENCRYPTION_KEY'];

  if (!key) {
    throw new Error('TWO_FACTOR_ENCRYPTION_KEY environment variable is not set');
  }

  // Ensure the key is 32 bytes (256 bits) for AES-256
  return crypto.scryptSync(key, 'salt', 32);
}

/**
 * Format backup codes for display (groups of 2)
 */
export function formatBackupCodesForDisplay(codes: string[]): string[][] {
  const formatted: string[][] = [];
  for (let i = 0; i < codes.length; i += 2) {
    formatted.push(codes.slice(i, i + 2));
  }
  return formatted;
}

/**
 * Check if a code looks like a backup code (8 chars with optional dash)
 * vs a TOTP code (6 digits)
 */
export function isBackupCode(code: string): boolean {
  const normalized = code.replace(/-/g, '');
  // Backup codes are 8 hex characters
  // TOTP codes are 6 digits
  return normalized.length === 8 && /^[a-f0-9]+$/i.test(normalized);
}

/**
 * Validate TOTP code format (6 digits)
 */
export function isValidTOTPFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}
