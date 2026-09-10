// Serializes the frontend's architecture template data to a machine-readable
// file the Python pipeline can read:
//
//   src/architecture/arch-templates.generated.json
//     { "packageTemplates": <PACKAGE_TEMPLATES>, "repoUrlByPackage": <repoUrlByPackage> }
//
// PACKAGE_TEMPLATES (src/architecture/packageTemplates.ts) and repoUrlByPackage
// (src/architecture/arch-graph-data.ts) stay the single source of truth for the
// still-rendered frontend; this file is a derived copy. A CI staleness check
// (npm run arch:templates:check) regenerates and fails on any diff.
//
// Usage:
//   node scripts/export-arch-templates.mjs           # write the file
//   node scripts/export-arch-templates.mjs --check    # exit 1 if stale

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsModule } from './lib/load-ts.mjs';
import { canonicalize } from './lib/canonical-json.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(repoRoot, 'src', 'architecture', 'arch-templates.generated.json');

export function buildTemplateExport() {
  const { PACKAGE_TEMPLATES } = loadTsModule(
    path.join(repoRoot, 'src', 'architecture', 'packageTemplates.ts'),
  );
  const { repoUrlByPackage } = loadTsModule(
    path.join(repoRoot, 'src', 'architecture', 'arch-graph-data.ts'),
  );
  if (!PACKAGE_TEMPLATES || !repoUrlByPackage) {
    throw new Error('export failed: PACKAGE_TEMPLATES / repoUrlByPackage not found');
  }
  return {
    packageTemplates: PACKAGE_TEMPLATES,
    repoUrlByPackage,
  };
}

function main() {
  const check = process.argv.includes('--check');
  const rendered = canonicalize(buildTemplateExport());

  if (check) {
    const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
    if (current !== rendered) {
      console.error(
        'arch-templates.generated.json is stale. Run: npm run arch:templates\n' +
          'The .ts template sources changed without regenerating the export.',
      );
      process.exit(1);
    }
    console.log('arch-templates.generated.json is up to date.');
    return;
  }

  fs.writeFileSync(OUT_FILE, rendered);
  console.log(`wrote ${path.relative(repoRoot, OUT_FILE)} (${Buffer.byteLength(rendered)} bytes)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
