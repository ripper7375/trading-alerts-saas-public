/**
 * @jest-environment node
 */

/**
 * The two switches of the intake path (decision D16) and the lock of build step 7 part 7b (decision
 * D8): the intake routes make the Understand call with no hold, so they are dev-only and never on in
 * a production build, whatever the variable says.
 */

import {
  isInstantPromptsEnabled,
  isIntakeEnabled,
} from '@/lib/intake/server/flags';

describe('INTAKE_ENABLED', () => {
  it('is on only for the exact text true, in anything that is not a production build', () => {
    expect(isIntakeEnabled({ INTAKE_ENABLED: 'true' })).toBe(true);
    expect(
      isIntakeEnabled({ INTAKE_ENABLED: 'true', NODE_ENV: 'development' })
    ).toBe(true);
    expect(isIntakeEnabled({ INTAKE_ENABLED: 'true', NODE_ENV: 'test' })).toBe(
      true
    );
    for (const value of [
      undefined,
      '',
      'TRUE',
      'True',
      '1',
      'yes',
      'on',
      ' true',
      'true ',
      'false',
    ]) {
      expect(isIntakeEnabled({ INTAKE_ENABLED: value })).toBe(false);
    }
  });

  it('is never on in a production build: the routes are dev-only tools (D8)', () => {
    expect(
      isIntakeEnabled({ INTAKE_ENABLED: 'true', NODE_ENV: 'production' })
    ).toBe(false);
    expect(isIntakeEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('reads the process environment when it is given none', () => {
    const before = {
      flag: process.env['INTAKE_ENABLED'],
      mode: process.env['NODE_ENV'],
    };
    const env = process.env as Record<string, string | undefined>;
    try {
      env['INTAKE_ENABLED'] = 'true';
      env['NODE_ENV'] = 'development';
      expect(isIntakeEnabled()).toBe(true);
      env['NODE_ENV'] = 'production';
      expect(isIntakeEnabled()).toBe(false);
    } finally {
      if (before.flag === undefined) delete env['INTAKE_ENABLED'];
      else env['INTAKE_ENABLED'] = before.flag;
      env['NODE_ENV'] = before.mode;
    }
  });
});

describe('INTAKE_INSTANT_PROMPTS_ENABLED', () => {
  it('is on only for the exact text true, and is not a lock on the route', () => {
    expect(
      isInstantPromptsEnabled({ INTAKE_INSTANT_PROMPTS_ENABLED: 'true' })
    ).toBe(true);
    expect(
      isInstantPromptsEnabled({ INTAKE_INSTANT_PROMPTS_ENABLED: 'TRUE' })
    ).toBe(false);
    expect(isInstantPromptsEnabled({ INTAKE_ENABLED: 'true' })).toBe(false);
    expect(isInstantPromptsEnabled({})).toBe(false);
  });
});
