/**
 * 2FA backup codes are hashed at bcrypt cost 10, not the password cost of 12 (CODE-13, WS-6).
 *
 * `two-factor.util.ts` had no spec. Ten codes are hashed in a row, so cost 12 made generating them
 * take about 4 s (plan WS-6, Deviation 8). The cost is stored inside every hash, so codes hashed
 * at either cost verify.
 */
import bcrypt from 'bcryptjs';

import {
  BACKUP_CODE_BCRYPT_COST,
  BCRYPT_COST,
} from '../auth/password-hash.const';
import { generateBackupCodes, verifyBackupCode } from './two-factor.util';

// The ten backup codes are hashed one after the other.
const SLOW = 30_000;

describe('generateBackupCodes', () => {
  it(
    'hashes the ten codes at BACKUP_CODE_BCRYPT_COST (10, not the password cost), and each verifies against its plain code',
    async () => {
      const { plainCodes, hashedCodes } = await generateBackupCodes();

      expect(plainCodes).toHaveLength(10);
      expect(hashedCodes).toHaveLength(10);
      expect(BACKUP_CODE_BCRYPT_COST).not.toBe(BCRYPT_COST);
      for (const hashed of hashedCodes) {
        expect(bcrypt.getRounds(hashed)).toBe(BACKUP_CODE_BCRYPT_COST);
        expect(bcrypt.getRounds(hashed)).toBe(10);
      }
      await expect(verifyBackupCode(plainCodes[7], hashedCodes)).resolves.toBe(
        7
      );
      await expect(verifyBackupCode('0000-0000', hashedCodes)).resolves.toBe(
        -1
      );
    },
    SLOW
  );
});

describe('verifyBackupCode', () => {
  it('verifies codes whichever cost they were hashed at (the cost is inside the hash)', async () => {
    const hashed = [
      await bcrypt.hash('abcd-ef01', 10),
      await bcrypt.hash('1234-5678', 12),
    ];

    await expect(verifyBackupCode('1234-5678', hashed)).resolves.toBe(1);
    await expect(verifyBackupCode('ABCD-EF01', hashed)).resolves.toBe(0);
  });
});
