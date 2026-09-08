# Reproducible Figma import

Run from the repository root after `npm ci`:

```sh
npm run import:fig -- "source.fig" "imports/project.figma.json"
```

The command parses the binary archive, converts each public page, extracts
embedded images, preserves saved glyph outlines and positions, and verifies
direct layer geometry, text metrics, glyph positions and baselines. Failure
returns a nonzero exit code. Each page produces a project JSON; the adjacent
`.manifest.json` lists them in source page order. Internal component canvases
are excluded as pages and remain available for instance resolution.

Output includes the source SHA-256 and page ID, and has no generated timestamp.
With the same input, output path and locked dependencies, project bytes repeat.
Assets must be served with the repository root as the HTTP root. Custom output
directories outside that root are useful for offline processing, but their
image URLs must be remapped before loading in the web editor.

Load a project using the existing WebMCP prepare/confirm import tools with its
`projectUrl`, then focus the imported layers. This CLI does not itself upload,
publish, or modify an open browser document.

## Fidelity contract and limits

Saved glyph outlines preserve the original text appearance without installing
the referenced fonts. Editing text or its typography switches to font-based
composition. Missing glyph data is reported as a fallback warning.

Unsupported node types, fills, masks and effects are reported in
`importReport.warnings`; `fidelity: partial` means known losses. A warning-free
result is labeled `unverified-visual`, never pixel-perfect. Instance expansion
currently supports image/vector artwork, not all override and layout semantics.
Arbitrary affine transforms, complex masks, gradients, text decorations,
auto-layout editing, prototypes and future .fig format versions are not fully
covered. The verifier counts expanded instances but does not prove their visual
fidelity. This is a deterministic supported-subset importer, not universal Figma
compatibility.

## Post-its and design output

Imported FigJam `STICKY` nodes retain `sourceNodeType`, `annotationKind: sticky`
and `annotationRootId`; their visual children retain membership. Shapes and
connectors are not automatically classified as notes. Project JSON preserves
annotations, including hidden/soft-deleted ones. Design SVG, PNG and code exports
exclude annotations by default; explicit `includeAnnotations` opts into visible
notes. Soft deletion hides the annotation hierarchy without deleting IDs or
overwriting child visibility. Restoring does not reveal children originally hidden.

Imported post-it resizing scales the entire note (body, content and author),
not auto-layout reflow. Text uses a persistent logical box (`textTransform`),
keeping saved glyph outlines and their original metrics intact. Recoloring changes
the first vector body only, not author text or other decoration. Both operations
use the same undoable `updatePostit` data-layer action as WebMCP.

## Regression checks

`npm test` includes a generated binary .fig with two differently named pages,
repeated import byte comparison, glyph curve decoding, baseline placement and
editable-text fallback. Validate a specific source/output pair with:

```sh
npm run verify:fig-import -- "source.fig" "imports/project.figma.json"
```
