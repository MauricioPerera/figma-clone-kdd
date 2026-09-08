import { getBlobBytes } from 'openfig-core';

// Glyph outlines also use quadratic curves (opcode 3), which the vector
// decoder in openfig-core 0.4.1 does not support. Reject truncated geometry.
export function decodeGlyph(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const parts = [];
  const commands = ['Z', 'M', 'L', 'Q', 'C'];
  const sizes = [0, 2, 2, 4, 6];
  while (offset < bytes.length) {
    const opcode = bytes[offset++];
    if (opcode > 4) throw new Error(`Unsupported glyph opcode ${opcode}`);
    const count = sizes[opcode];
    if (offset + count * 4 > bytes.length) throw new Error('Truncated glyph');
    const values = [];
    for (let i = 0; i < count; i++, offset += 4) {
      const value = view.getFloat32(offset, true);
      if (!Number.isFinite(value)) throw new Error('Invalid glyph coordinate');
      values.push(value);
    }
    // Figma prefixes outlines with CLOSE even before the first contour.
    // SVG requires an initial MOVE; a leading CLOSE invalidates Path2D.
    if (opcode !== 0 || parts.length) parts.push(commands[opcode] + values.join(' '));
  }
  return parts.join(' ');
}

export function extractGlyphs(fig, node) {
  return (node.derivedTextData?.glyphs || []).map(glyph => {
    const bytes = getBlobBytes(fig, glyph.commandsBlob);
    if (!bytes) throw new Error(`Missing glyph blob ${glyph.commandsBlob}`);
    return { path: decodeGlyph(bytes), x: glyph.position.x, y: glyph.position.y,
      fontSize: glyph.fontSize, rotation: glyph.rotation || 0,
      firstCharacter: glyph.firstCharacter };
  });
}
