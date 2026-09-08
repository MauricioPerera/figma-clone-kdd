/**
 * Runner principal de pruebas deterministas para Figma Clone KDD.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  'design_rules.test.js',
  'design_rules_integration.test.js',
  'project_roundtrip.test.js',
  'project_persistence.test.js',
  'all_tools_coverage.test.js',
  'schema_validation.test.js',
  'template_identity.test.js',
  'annotation_export.test.js',
  'svg_imported_export.test.js',
  'fig_glyphs.test.js',
  'fig_import.test.js',
  'figjam_nodes.test.js',
  'canvas_engine.test.js',
  'state_store.test.js',
  'webmcp_tools.test.js',
  'adversarial_e2e_battery.test.js'
];

console.log('========================================================');
console.log('  EJECUTANDO SUITE DE PRUEBAS DETERMINISTAS KDD');
console.log('========================================================');

let allPassed = true;

for (const tf of testFiles) {
  const fullPath = path.join(__dirname, tf);
  console.log(`\n▶ Ejecutando: ${tf}`);
  const result = spawnSync(process.execPath, [fullPath], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    allPassed = false;
    console.error(`❌ FALLÓ: ${tf} (Exit code: ${result.status})`);
  } else {
    console.log(`✅ PASÓ: ${tf}`);
  }
}

console.log('\n========================================================');
if (allPassed) {
  console.log('🎉 TODAS LAS PRUEBAS UNITARIAS PASARON EXITOSAMENTE.');
  process.exit(0);
} else {
  console.error('❌ SE ENCONTRARON ERRORES EN LAS PRUEBAS.');
  process.exit(1);
}
