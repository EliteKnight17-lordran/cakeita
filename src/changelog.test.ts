import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, CHANGELOG } from './changelog';

describe('changelog', () => {
  it('matches package.json version', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });
  it('has both languages, newest first, unique versions', () => {
    const versions = CHANGELOG.map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (const r of CHANGELOG) {
      expect(r.en.length).toBeGreaterThan(0);
      expect(r.tl.length).toBe(r.en.length);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const num = (v: string) => v.split('.').map(Number).reduce((a, n) => a * 1000 + n, 0);
    for (let i = 1; i < versions.length; i++) expect(num(versions[i - 1]!)).toBeGreaterThan(num(versions[i]!));
  });
});
