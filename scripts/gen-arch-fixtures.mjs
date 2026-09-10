// Generates known-good effective-page JSON fixtures straight from the frontend's
// TypeScript resolvePage() (src/architecture/PageDetail.tsx), serialized with the
// shared canonical serializer.
//
// scripts/tests/test_arch_effective_page.py asserts that the Python
// build_effective_page() reproduces these byte-for-byte. Regenerate whenever
// resolvePage(), PACKAGE_TEMPLATES, repoUrlByPackage, or the overlays change —
// and eyeball the diff, since these fixtures are the cross-language contract.
//
// One fixture per key in src/architecture-pages.json (all 11), so the pin
// covers every shape currently in production: service pages, the cross-cutting
// `authentication` page (no template), reverse relatedPages links, and the
// `my-website` null-dataFlow overlay edge case.
//
// Usage:  node scripts/gen-arch-fixtures.mjs [--check]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsModule } from './lib/load-ts.mjs';
import { canonicalize } from './lib/canonical-json.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(repoRoot, 'scripts', 'fixtures');
const OVERLAYS_PATH = path.join(repoRoot, 'src', 'architecture-pages.json');

const PINNED_KEYS = Object.keys(
  JSON.parse(fs.readFileSync(OVERLAYS_PATH, 'utf8')),
);

function main() {
  const check = process.argv.includes('--check');
  const { resolvePage } = loadTsModule(
    path.join(repoRoot, 'src', 'architecture', 'PageDetail.tsx'),
  );

  let stale = false;
  for (const key of PINNED_KEYS) {
    const rendered = canonicalize(resolvePage(key));
    const file = path.join(FIXTURE_DIR, `${key}.effective.json`);
    if (check) {
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (current !== rendered) {
        console.error(`fixture stale: ${path.relative(repoRoot, file)}`);
        stale = true;
      }
    } else {
      fs.writeFileSync(file, rendered);
      console.log(`wrote ${path.relative(repoRoot, file)} (${Buffer.byteLength(rendered)} bytes)`);
    }
  }
  if (check && stale) {
    console.error('Run: node scripts/gen-arch-fixtures.mjs');
    process.exit(1);
  }
  if (check) console.log('arch effective-page fixtures are up to date.');
}

main();
