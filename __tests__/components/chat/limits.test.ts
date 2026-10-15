/**
 * @jest-environment node
 */

/**
 * The words of the contracts the browser repeats (build step 7 part 8): `components/chat/limits.ts`
 * and the lists in `wire.ts` may not import the contracts' VALUES (they sit on the intake pipeline and
 * `node:crypto`), so each is held here to the contract it repeats. A contract that moves fails this.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

import {
  CHAT_ROUTES,
  CLIENT_ERROR_CODES,
  COMPOSER_MAX_CHARS,
  INSTANT_INTENTS_UI,
  REFUSAL_CODES_UI,
  SERVER_ERROR_CODES,
  STAGES,
} from '@/components/chat/limits';
import { QUESTION_MAX_CHARS } from '@/lib/intake/packet';
import { INSTANT_INTENTS } from '@/lib/intake/intents';
import { REFUSAL_CODES } from '@/lib/intake/refusal';
import {
  REPLY_ERROR_CODES,
  REPLY_STAGES,
} from '@/lib/reply/contracts/stage-events';
import { RESULT_KINDS } from '@/lib/reply/contracts/result';

const ROOT = join(__dirname, '..', '..', '..');

describe('what the browser repeats of the contracts', () => {
  it('the stages and their order are the contract’s', () => {
    expect([...STAGES]).toEqual([...REPLY_STAGES]);
  });

  it('the errors the server can send after the stream began are the contract’s', () => {
    expect([...SERVER_ERROR_CODES]).toEqual([...REPLY_ERROR_CODES]);
  });

  it('the refusal codes are the intake path’s, in the order the gate decides', () => {
    expect([...REFUSAL_CODES_UI]).toEqual([...REFUSAL_CODES]);
  });

  it('the two Panel C labels are the intake path’s', () => {
    expect([...INSTANT_INTENTS_UI]).toEqual([...INSTANT_INTENTS]);
  });

  it('the longest question is the door’s limit', () => {
    expect(COMPOSER_MAX_CHARS).toBe(QUESTION_MAX_CHARS);
    expect(COMPOSER_MAX_CHARS).toBe(500);
  });

  it('the client’s own error codes do not collide with the server’s', () => {
    for (const code of CLIENT_ERROR_CODES) {
      expect((SERVER_ERROR_CODES as readonly string[]).includes(code)).toBe(
        false
      );
    }
  });

  it('the four kinds of reply the wire accepts are the contract’s', () => {
    const wire = readFileSync(join(ROOT, 'components/chat/wire.ts'), 'utf8');
    const listed = /const RESULT_KINDS = \[([^\]]*)\]/.exec(wire);
    expect(listed).not.toBeNull();
    const kinds = (listed?.[1] ?? '')
      .split(',')
      .map((part) => part.trim().replace(/'/g, ''))
      .filter(Boolean);
    expect(kinds).toEqual([...RESULT_KINDS]);
  });

  it('every route the panel calls exists, and is the one the plan names', () => {
    for (const path of Object.values(CHAT_ROUTES)) {
      const file = path.replace('/api/', 'app/api/') + '/route.ts';
      expect(() => readFileSync(join(ROOT, file), 'utf8')).not.toThrow();
    }
    expect(CHAT_ROUTES.message).toBe('/api/chat/message');
    expect(CHAT_ROUTES.state).toBe('/api/chat/state');
  });
});

describe('the one file of components/ that imports lib/reply', () => {
  it('imports types only: nothing of it reaches the browser at run time', () => {
    const source = ts.createSourceFile(
      'types.ts',
      readFileSync(join(ROOT, 'components/chat/types.ts'), 'utf8'),
      ts.ScriptTarget.ES2020,
      true
    );
    const imports = source.statements.filter(ts.isImportDeclaration);
    expect(imports.length).toBeGreaterThan(0);
    for (const declaration of imports) {
      expect({
        from: (declaration.moduleSpecifier as ts.StringLiteral).text,
        typeOnly: declaration.importClause?.isTypeOnly === true,
      }).toEqual({
        from: (declaration.moduleSpecifier as ts.StringLiteral).text,
        typeOnly: true,
      });
    }
    // and it re-exports types, not values
    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement)) {
        expect(statement.isTypeOnly).toBe(true);
      }
    }
  });

  it('is the only file of components/chat that names lib/reply, lib/platform or lib/intake', () => {
    const { readdirSync } = require('fs') as typeof import('fs');
    const dir = join(ROOT, 'components/chat');
    for (const name of readdirSync(dir)) {
      if (name === 'types.ts') continue;
      const source = readFileSync(join(dir, name), 'utf8');
      expect({
        name,
        hit: /@\/lib\/(reply|platform|intake)/.test(source),
      }).toEqual({
        name,
        hit: false,
      });
    }
    const shell = readFileSync(join(ROOT, 'components/chat-panel.tsx'), 'utf8');
    expect(/@\/lib\/(reply|platform|intake)/.test(shell)).toBe(false);
  });
});
