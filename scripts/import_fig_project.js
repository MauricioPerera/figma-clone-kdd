#!/usr/bin/env node

/** Import + fidelity gate in one deterministic command. */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseFig, nodeId } from 'openfig-core';
import { publicPages } from './fig_pages.js';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [input, requestedOutput] = process.argv.slice(2);
if (!input) {
  console.error('Usage: node scripts/import_fig_project.js <source.fig> [output.figma.json]');
  process.exit(1);
}

const source = resolve(input);
if (!existsSync(source)) {
  console.error(`Source .fig not found: ${source}`);
  process.exit(1);
}
const slug = basename(source, extname(source)).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
const output = resolve(requestedOutput || `imports/${slug}.figma.json`);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicAssetBase = `/${relative(repoRoot, resolve(dirname(output), 'assets', basename(output, extname(output)).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase())).replaceAll('\\', '/')}`;

function run(script, args) {
  const result = spawnSync(process.execPath, [resolve(repoRoot, 'scripts', script), ...args], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

const pages = publicPages(parseFig(new Uint8Array(readFileSync(source))).nodes || []);
if (!pages.length) throw new Error('No public Figma pages found');
const results = [];
for (const [index, page] of pages.entries()) {
  const pageOutput = index === 0 ? output : output.replace(/\.json$/i, `-page-${nodeId(page).replace(':', '-')}.json`);
  const pageAssetBase = `/${relative(repoRoot, resolve(dirname(pageOutput), 'assets', basename(pageOutput, extname(pageOutput)).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase())).replaceAll('\\', '/')}`;
  run('convert_fig_to_project.js', [source, pageOutput, pageAssetBase, nodeId(page)]);
  run('verify_fig_import.js', [source, pageOutput]);
  results.push({ pageId: nodeId(page), name: page.name, project: basename(pageOutput) });
}
writeFileSync(`${output}.manifest.json`, JSON.stringify({ version: 1, pages: results }, null, 2) + '\n');
console.log(`Verified ${results.length} page project(s). Manifest: ${output}.manifest.json`);
