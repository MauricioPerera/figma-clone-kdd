/**
 * Runner principal de pruebas deterministas para Figma Clone KDD.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
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
