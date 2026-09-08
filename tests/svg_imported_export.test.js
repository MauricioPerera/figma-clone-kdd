import assert from 'node:assert/strict';
import { exportToSVG, layerToTailwind } from '../src/engine/export.js';

const image = { id:'image', type:'image', x:10, y:20, width:200, height:100, src:'data:image/png;base64,AAAA', imageScaleMode:'FILL', cornerRadius:8 };
const fill = exportToSVG([image]);
assert.match(fill, /<image /);
assert.match(fill, /preserveAspectRatio="xMidYMid slice"/);
assert.match(fill, /width="200" height="100" rx="8"/);
const transformed = exportToSVG([{ ...image, imageTransform:{m00:2,m01:0,m02:0.25,m10:0,m11:4,m12:0.5} }]);
assert.match(transformed,/matrix\(0.5 0 0 0.25 -25 -12.5\)/);
assert.match(transformed,/clip-path=/);
assert.match(transformed,/translate\(10 20\)/);
assert.throws(() => exportToSVG([{...image,src:'javascript:alert(1)'}]), /Unsupported/);
assert.throws(() => exportToSVG([{...image,src:null}]), /no source/);
assert.throws(() => exportToSVG([{...image,imageTransform:{m00:0,m01:0,m02:0,m10:0,m11:0,m12:0}}]), /singular/);
assert.match(exportToSVG([{...image,src:'https://example.test/image.png?a=1&b="quoted"'}]), /a=1&amp;b=&quot;quoted&quot;/);

const vector = {id:'vector',type:'vector',x:2,y:3,width:40,height:50,rotation:20,opacity:0.6,vectorScaleX:2,vectorScaleY:3,
  vectorPaths:[{path:'M0 0 L10 0 Z',fill:'#123456'}],
  vectorStrokePaths:[{path:'M1 1 L2 2 Z',stroke:'#abcdef',outlined:true,fillRule:'evenodd'},{path:'M0 0 L4 4',stroke:'#ffffff'}]};
const svg = exportToSVG([vector]);
assert.match(svg,/translate\(2 3\) scale\(2 3\)/);
assert.match(svg,/opacity="0.6"/);
assert.match(svg,/rotate\(20/);
assert.match(svg,/<path d="M1 1 L2 2 Z" fill="#abcdef" fill-rule="evenodd"/);
assert.match(svg,/fill="none" stroke="#ffffff"/);
assert.match(layerToTailwind(image),/<image /);
assert.match(layerToTailwind(vector),/<path /);
assert.throws(() => exportToSVG([{...vector,vectorPaths:[],vectorStrokePaths:[]}]), /no exportable/);
assert.throws(() => exportToSVG([{...image,type:'unsupported'}]), /Unsupported SVG/);
assert.match(exportToSVG([{id:'arrow',type:'arrow',x:0,y:0,width:20,height:10,stroke:'#123456'}]),/marker-end=/);
const star = exportToSVG([{id:'star',type:'star',x:0,y:0,width:100,height:20,fill:'#123456'}]);
assert.match(star,/points="50,0 /);
console.log('SVG imported export: image crop/matrix/clipping, vector silhouettes/scales, URL escaping, Tailwind embedding and explicit errors passed');
