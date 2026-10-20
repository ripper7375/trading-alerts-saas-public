/**
 * @jest-environment node
 */
/**
 * `operation-service` deploys on its own and cannot import `lib/`, so the
 * e-mail texts and builders (`lib/email/i18n/`) are copied into
 * `operation-service/src/email/i18n/`. The two must stay the same bytes: an
 * edit made on one side only would send the monolith's mail in one wording and
 * operation-service's in another. After editing `lib/email/i18n/`, copy the
 * folder over (it is pure TypeScript, nothing to adapt).
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'lib/email/i18n');
const MIRROR = path.join(ROOT, 'operation-service/src/email/i18n');

function filesUnder(dir: string, prefix = ''): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? filesUnder(path.join(dir, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`]
    )
    .sort();
}

/** The checkout is CRLF on Windows and LF in CI: compare the text, not the endings. */
const text = (file: string): string =>
  fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

describe('operation-service e-mail i18n mirror', () => {
  const sourceFiles = filesUnder(SOURCE);

  it('finds the source folder', () => {
    expect(sourceFiles).toContain('catalog.ts');
    expect(sourceFiles).toContain('templates.ts');
    expect(sourceFiles.filter((f) => f.startsWith('messages/'))).toHaveLength(
      19
    );
  });

  it('has the same files', () => {
    expect(filesUnder(MIRROR)).toEqual(sourceFiles);
  });

  it.each(sourceFiles)('%s is identical', (relative) => {
    expect(text(path.join(MIRROR, relative))).toBe(
      text(path.join(SOURCE, relative))
    );
  });

  it('imports nothing outside its own folder (so it can be copied)', () => {
    const offenders: string[] = [];
    for (const relative of sourceFiles) {
      const source = text(path.join(SOURCE, relative));
      for (const match of source.matchAll(/from '([^']+)'/g)) {
        const spec = match[1] as string;
        if (!spec.startsWith('.')) offenders.push(`${relative}: ${spec}`);
        else if (spec.startsWith('../') && !relative.startsWith('messages/')) {
          offenders.push(`${relative}: ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
