import assert from 'node:assert/strict';
import { decodeGlyph } from '../scripts/fig_glyphs.js';
import { CanvasRenderer } from '../src/engine/renderer.js';

const bytes = new Uint8Array(27);
const view = new DataView(bytes.buffer);
bytes[0] = 0; bytes[1] = 1;
view.setFloat32(2, 0.25, true); view.setFloat32(6, 0.5, true);
bytes[10] = 3;
[0.5, 1, 1, 0].forEach((value, i) => view.setFloat32(11 + i * 4, value, true));
assert.equal(decodeGlyph(bytes), 'M0.25 0.5 Q0.5 1 1 0');
assert.throws(() => decodeGlyph(bytes.slice(0, 24)), /Truncated/);
assert.throws(() => decodeGlyph(new Uint8Array([9])), /Unsupported/);

const calls = [];
globalThis.Path2D = class { constructor(path) { this.path = path; } };
const ctx = Object.fromEntries(['save','restore','translate','rotate','scale','fill','fillText'].map(key => [key, (...args) => calls.push([key, ...args])]));
ctx.measureText = text => ({ width: text.length * 8 });
const layer = {x:100,y:200,width:80,height:30,text:'A',sourceText:'A',fontSize:12,fontFamily:'Arial',fontWeight:'400',textAlign:'center',lineHeight:1.2,letterSpacing:0,
  sourceGlyphs:[{path:'M0 0 L1 0 L0 1 Z',x:23,y:18,fontSize:12,rotation:0}]};
layer.sourceTextStyle = JSON.stringify([12,'Arial','400','center',1.2,0,80,30]);
CanvasRenderer.prototype.drawText.call(CanvasRenderer.prototype,ctx,layer);
assert.deepEqual(calls.find(call=>call[0]==='translate'),['translate',123,218]);
assert.deepEqual(calls.find(call=>call[0]==='scale'),['scale',12,-12]);
assert.equal(calls.some(call=>call[0]==='fillText'),false);
calls.length=0;
CanvasRenderer.prototype.drawText.call(CanvasRenderer.prototype,ctx,{...layer,text:'Edited'});
assert.equal(calls.some(call=>call[0]==='fillText'),true);
console.log('Glyph decoding, original baseline rendering and edit fallback passed');
calls.length = 0;
ctx.stroke = (...args) => calls.push(['stroke', ...args]);
CanvasRenderer.prototype.drawVectorLayer.call({}, ctx, {x:0,y:0,
  vectorStrokePaths:[{path:'M0 0 L10 0 L10 2 L0 2 Z',stroke:'#000',outlined:true,fillRule:'nonzero'}]});
assert.equal(calls.filter(call => call[0] === 'fill').length, 1);
assert.equal(calls.filter(call => call[0] === 'stroke').length, 0);
calls.length = 0;
CanvasRenderer.prototype.drawVectorLayer.call({}, ctx, {x:0,y:0,
  vectorStrokePaths:[{path:'M0 0 L10 0',stroke:'#000'}]});
assert.equal(calls.filter(call => call[0] === 'stroke').length, 1);
console.log('Imported stroke outlines filled; legacy centerlines still stroked');
calls.length = 0;
CanvasRenderer.prototype.drawText.call(CanvasRenderer.prototype, ctx, {...layer,width:160,height:45,textTransform:{width:80,height:30,scaleX:2,scaleY:1.5}});
assert.deepEqual(calls.find(call => call[0] === 'translate'),['translate',100,200]);
assert.deepEqual(calls.find(call => call[0] === 'scale'),['scale',2,1.5]);
assert.equal(calls.some(call => call[0] === 'fillText'),false,'Resizing must preserve original glyph rendering');
console.log('Resized imported text retains original glyph paths and scales its logical box');
