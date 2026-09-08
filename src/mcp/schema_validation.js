// Deterministic subset of JSON Schema used by the site's WebMCP catalog.
const predicates = {
  object: value => value !== null && typeof value === 'object' && !Array.isArray(value),
  array: Array.isArray,
  number: value => typeof value === 'number' && Number.isFinite(value),
  integer: Number.isInteger,
  string: value => typeof value === 'string',
  boolean: value => typeof value === 'boolean',
  null: value => value === null
};
const fail = (path, message) => {throw new Error(`Invalid tool input ${path}: ${message}`);};
function validateObject(value, schema, path) {
  for (const key of schema.required || []) {
    if (!Object.hasOwn(value,key)) fail(`${path}.${key}`,'required');
  }
  for (const [key,item] of Object.entries(value)) {
    const child = Object.hasOwn(schema.properties || {},key) ? schema.properties[key] : undefined;
    if (child) validateSchemaInput(item,child,`${path}.${key}`);
    else if (schema.additionalProperties === false) fail(`${path}.${key}`,'additional property not allowed');
  }
}
function validateArray(value,schema,path) {
  if (schema.minItems !== undefined && value.length < schema.minItems) fail(path,`minItems ${schema.minItems}`);
  if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(path,`maxItems ${schema.maxItems}`);
  if (schema.items) value.forEach((item,index)=>validateSchemaInput(item,schema.items,`${path}[${index}]`));
}
function validateNumber(value,schema,path) {
  const limits = [
    ['minimum',(a,b)=>a>=b],['maximum',(a,b)=>a<=b],
    ['exclusiveMinimum',(a,b)=>a>b],['exclusiveMaximum',(a,b)=>a<b]
  ];
  if (!Number.isFinite(value)) fail(path,'must be finite');
  for (const [key,valid] of limits) {
    if (schema[key] !== undefined && !valid(value,schema[key])) fail(path,`${key} ${schema[key]}`);
  }
}
export function validateSchemaInput(value,schema,path='$') {
  if (schema.type && !predicates[schema.type]?.(value)) fail(path,`expected ${schema.type}`);
  if (schema.enum && !schema.enum.includes(value)) fail(path,'el valor no existe en enum');
  if (typeof value === 'number') validateNumber(value,schema,path);
  if (Array.isArray(value)) validateArray(value,schema,path);
  else if (predicates.object(value)) validateObject(value,schema,path);
}
