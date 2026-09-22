// Minimal in-process TypeScript/TSX loader for the architecture build scripts.
//
// The frontend's template data (packageTemplates.ts, arch-graph-data.ts) and
// the resolvePage() merge (PageDetail.tsx) are .ts/.tsx modules that cannot be
// require()d directly. This loader transpiles them with Babel (the same
// preset-typescript / preset-react already in the CRA toolchain) and evaluates
// them in a throwaway CommonJS module graph, so the export + fixture scripts
// read the real values instead of a hand-maintained copy that could drift.
//
// Relative .ts/.tsx/.json imports are resolved recursively. `react` is stubbed
// (resolvePage and the template data never touch React at module-eval time).
// Bare specifiers fall through to the normal Node resolver.

import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { createRequire } from 'node:module';
import babel from '@babel/core';

const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.json'];

// Satisfies `import React from 'react'` for components we load only to reach a
// non-component export (e.g. resolvePage in PageDetail.tsx).
const reactStub = new Proxy(
  { createElement: () => null, Fragment: Symbol('Fragment') },
  { get: (target, prop) => (prop in target ? target[prop] : () => null) },
);

function resolveRelative(fromDir, request) {
  const base = path.resolve(fromDir, request);
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of EXTS) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTS) {
    const idx = path.join(base, 'index' + ext);
    if (fs.existsSync(idx)) return idx;
  }
  return null;
}

export function loadTsModule(entryFile) {
  const cache = new Map();

  function loadFile(absFile) {
    if (cache.has(absFile)) return cache.get(absFile).exports;

    if (absFile.endsWith('.json')) {
      const moduleObj = { exports: JSON.parse(fs.readFileSync(absFile, 'utf8')) };
      cache.set(absFile, moduleObj);
      return moduleObj.exports;
    }

    // Stylesheets are side-effect-only imports in the webpack/CRA build
    // (handled by css-loader); this loader only cares about JS/TS export
    // values reachable from an entry point like PageDetail.tsx, so a
    // stylesheet import resolves to an empty, inert module.
    if (absFile.endsWith('.css')) {
      const moduleObj = { exports: {} };
      cache.set(absFile, moduleObj);
      return moduleObj.exports;
    }

    const src = fs.readFileSync(absFile, 'utf8');
    const { code } = babel.transformSync(src, {
      filename: absFile,
      babelrc: false,
      configFile: false,
      presets: [
        ['@babel/preset-typescript', { allowDeclareFields: true, onlyRemoveTypeImports: false }],
        ['@babel/preset-react', { runtime: 'classic' }],
      ],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });

    const moduleObj = { exports: {} };
    cache.set(absFile, moduleObj);

    const nodeRequire = createRequire(absFile);
    const customRequire = (request) => {
      if (request === 'react') return reactStub;
      if (request.startsWith('./') || request.startsWith('../')) {
        const resolved = resolveRelative(path.dirname(absFile), request);
        if (resolved) return loadFile(resolved);
        throw new Error(`Cannot resolve ${request} from ${absFile}`);
      }
      return nodeRequire(request);
    };
    customRequire.resolve = nodeRequire.resolve;

    const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', code);
    fn(moduleObj.exports, customRequire, moduleObj, absFile, path.dirname(absFile));
    return moduleObj.exports;
  }

  return loadFile(path.resolve(entryFile));
}
