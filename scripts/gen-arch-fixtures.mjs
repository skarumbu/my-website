// Generates known-good effective-page JSON fixtures straight from the frontend's
// TypeScript resolvePage() (src/architecture/PageDetail.tsx), serialized with the
// shared canonical serializer.
//
// scripts/tests/test_arch_effective_page.py asserts that the Python
// build_effective_page() reproduces these byte-for-byte. Regenerate whenever
// resolvePage(), PACKAGE_TEMPLATES, repoUrlByPackage, or the overlays for the
// pinned keys change — and eyeball the diff, since these fixtures are the
// cross-language contract.
//
// Usage:  node scripts/gen-arch-fixtures.mjs [--check]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsModule } from './lib/load-ts.mjs';
import { canonicalize } from './lib/canonical-json.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(repoRoot, 'scripts', 'fixtures');

// One service page carrying reverse relatedPages links (posts-api gets
// azure-infrastructure + authentication back), the cross-cutting page with no
// template (authentication), and the null-dataFlow overlay edge case
// (my-website overlay sets "dataFlow": null and its template has no dataFlow,
// so the key must be omitted).
const PINNED_KEYS = ['posts-api', 'authentication', 'my-website'];

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
