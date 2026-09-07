# Reglas de Desarrollo para Agentes Autónomos (KDD Governance)

Bienvenido agente. Este repositorio está formalmente gobernado por la metodología **Knowledge-Driven Development (KDD)** de Mauricio Perera ([MauricioPerera/KDD](https://github.com/MauricioPerera/KDD)).

## Reglas Obligatorias:
1. **Gobernanza por Contratos (CCDD)**: Antes de modificar cualquier archivo de producción, consulta su contrato en `knowledge/contracts/`. Toda implementación debe ajustarse a las interfaces (`signature`) y umbrales definidos en el Frontmatter.
2. **Pruebas Congeladas**: Ejecuta determinísticamente los tests correspondientes (`node tests/run_tests.js`). No se permite alterar las aserciones de los tests para forzar su aprobación.
3. **Estándar WebMCP ([webmcp.com](https://webmcp.com))**: Cualquier capacidad nueva debe exponerse tanto en la API imperativa de `fastwebmcp` como en los formularios declarativos WebMCP.
4. **Validación Continua**: Todo cambio debe pasar `python scripts/validate_okf.py` y `python scripts/validate_contracts.py`.
