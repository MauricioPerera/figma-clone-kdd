import assert from 'node:assert/strict';
import {FastWebMcpRuntime} from '../src/mcp/fastwebmcp_runtime.js';
import {validateSchemaInput} from '../src/mcp/schema_validation.js';
const schema={type:'object',required:['value','list'],additionalProperties:false,properties:{
  value:{type:'number',exclusiveMinimum:0,maximum:10},
  list:{type:'array',minItems:1,items:{type:'string',enum:['a','b']}},
  nested:{type:'object',required:['flag'],properties:{flag:{type:'boolean'}}}
}};
const valid={value:2,list:['a']};
assert.doesNotThrow(()=>validateSchemaInput(valid,schema));
for(const invalid of [null,[],{}, {...valid,value:Infinity},{...valid,value:NaN},{...valid,value:'2'},
  {...valid,value:0},{...valid,value:11},{...valid,list:[]},{...valid,list:['c']},
  {...valid,list:[4]},{...valid,extra:true},{...valid,nested:{}},{...valid,nested:{flag:'true'}}]){
  assert.throws(()=>validateSchemaInput(invalid,schema),/Invalid tool input/);
}
assert.doesNotThrow(()=>validateSchemaInput({extra:true},{type:'object',properties:{}}),'Absent additionalProperties remains permissive');
assert.throws(()=>validateSchemaInput(JSON.parse('{"value":2,"list":["a"],"__proto__":{}}'),schema),/additional property/);
assert.throws(()=>validateSchemaInput(1.2,{type:'integer'}),/integer/);
assert.throws(()=>validateSchemaInput(-1,{type:'number',minimum:0}),/minimum/);
assert.throws(()=>validateSchemaInput(2,{type:'number',exclusiveMaximum:2}),/exclusiveMaximum/);
assert.throws(()=>validateSchemaInput([1,2],{type:'array',maxItems:1}),/maxItems/);
let nativeTool;
globalThis.document={modelContext:{registerTool(tool){nativeTool=tool;}}};
const runtime=new FastWebMcpRuntime();
let mutations=0;
runtime.registerTool({name:'schema_test',inputSchema:schema,execute:()=>{mutations++;return mutations;}});
delete globalThis.document;
assert.equal((await runtime.invokeTool('schema_test',{...valid,value:'2'})).success,false);
assert.equal(mutations,0,'Fallback validation rejects before handler mutation');
await assert.rejects(()=>nativeTool.execute({...valid,value:'2'}),/Invalid tool input/);
assert.equal(mutations,0,'Native WebMCP registration shares pre-handler validation');
assert.equal((await runtime.invokeTool('schema_test',valid)).success,true);
assert.equal(await nativeTool.execute(valid),2);
console.log('WebMCP schema: types/finite/required/enum/nesting/array/bounds and native+fallback pre-mutation validation passed');
