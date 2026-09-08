import { extractDesignRules, validateDesign, exportDesignRules } from '../engine/design_rules.js';

const clone = value => JSON.parse(JSON.stringify(value));
const numericFields = new Set(['x','y','width','height','strokeWidth','cornerRadius','fontSize','lineHeight','letterSpacing']);
const stringFields = new Set(['fill','stroke','text','fontFamily','fontWeight']);
const updateProperties = Object.fromEntries([
  ...[...numericFields].map(key => [key,{type:'number'}]),
  ...[...stringFields].map(key => [key,{type:'string'}]),
  ['visible',{type:'boolean'}]
]);
const objectSchema = (properties = {}, required = []) => ({type:'object',properties,required,additionalProperties:false});

function assertObject(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Argumentos inválidos o propiedades no permitidas.');
}

function assertIds(ids) {
  if (ids !== undefined && (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id))) {
    throw new Error('ids debe ser una lista de identificadores.');
  }
}

function validateProperties(properties) {
  assertObject(properties,Object.keys(updateProperties));
  if (!Object.keys(properties).length) throw new Error('La actualización debe contener propiedades.');
  for (const [key,value] of Object.entries(properties)) {
    if (numericFields.has(key) && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error(`${key} debe ser un número finito.`);
    if (['width','height','fontSize','lineHeight'].includes(key) && value <= 0) throw new Error(`${key} debe ser positivo.`);
    if (['strokeWidth','cornerRadius'].includes(key) && value < 0) throw new Error(`${key} no puede ser negativo.`);
    if (stringFields.has(key) && typeof value !== 'string') throw new Error(`${key} debe ser texto.`);
    if (key === 'visible' && typeof value !== 'boolean') throw new Error('visible debe ser booleano.');
  }
}

/** Proposals never activate contracts. Only an unchanged, validated snapshot can be applied. */
export function registerDesignRulesTools(store, fastwebmcp) {
  const pending = new Map();
  const register = (name,title,description,inputSchema,execute,readOnlyHint = true) => fastwebmcp.registerTool({
    name,title,description,inputSchema,annotations:{readOnlyHint},execute
  });
  const active = () => {
    if (!store.state.designContract) throw new Error('No hay contrato de diseño activo. Actívalo desde la plataforma antes de validar cambios.');
    return store.state.designContract;
  };
  const empty = input => assertObject(input,[]);
  const protectionProposals = new Map();
  register('figma_prepare_design_protection','Prepare Design Protection','Prepares exact observed or imported rules without activating them. Returns a 60-second token. Obtain user authorization before activation.',objectSchema(),async (input = {}) => {
    empty(input);
    if (store.state.designContract) throw new Error('Ya existe protección activa. No se reemplaza mediante esta herramienta.');
    const contract = clone(store.state.designContractProposal || extractDesignRules(store.state.layers,{}));
    const validation = validateDesign(store.state.layers,contract);
    if (!validation.valid || !contract.rules.length) throw new Error('La propuesta no es válida para este diseño.');
    protectionProposals.clear();
    const token = globalThis.crypto.randomUUID();
    protectionProposals.set(token,{contract,state:JSON.stringify(store.state),expiresAt:Date.now()+60000});
    return {confirmationToken:token,ruleCount:contract.rules.length,expiresInMs:60000,requiresUserAuthorization:true};
  });
  register('figma_activate_design_rules','Activate Design Rules','Activates only the exact prepared rules after explicit user authorization. Rejects changed designs, expired tokens and replacement of existing protection.',objectSchema({confirmationToken:{type:'string'}},['confirmationToken']),async (input = {}) => {
    assertObject(input,['confirmationToken']);
    const proposal = protectionProposals.get(input.confirmationToken);
    protectionProposals.delete(input.confirmationToken);
    if (!proposal || proposal.expiresAt <= Date.now()) throw new Error('Propuesta inválida o caducada.');
    if (store.state.designContract || proposal.state !== JSON.stringify(store.state)) throw new Error('El diseño o protección cambió. Prepara otra propuesta.');
    store.activateDesignContract(proposal.contract);
    const persistence = await store.flushPersistence?.();
    return {status:'active',ruleCount:proposal.contract.rules.length,persistence};
  },false);

  register('figma_extract_design_rules','Extract Design Rules','Extracts a proposal from current layers without activating or changing the design contract.',
    objectSchema({ids:{type:'array',items:{type:'string'}}}),async (input = {}) => {
      assertObject(input,['ids']); assertIds(input.ids);
      if (input.ids?.some(id => !store.state.layers.some(layer => layer.id === id))) throw new Error('Una capa solicitada no existe.');
      return {status:'proposal',contract:clone(extractDesignRules(clone(store.state.layers),{ids:input.ids}))};
    });
  register('figma_get_design_rules','Get Design Rules','Returns the active contract, or an explicitly unactivated proposal when none exists.',objectSchema(),async (input = {}) => {
    empty(input);
    return store.state.designContract
      ? {status:'active',contract:clone(store.state.designContract)}
      : {status:'proposal',contract:clone(store.state.designContractProposal || extractDesignRules(clone(store.state.layers),{}))};
  });
  register('figma_validate_design','Validate Design','Validates current layers against the active contract without modifying them.',objectSchema(),async (input = {}) => {
    empty(input); return clone(validateDesign(clone(store.state.layers),clone(active())));
  });
  register('figma_preview_changes','Preview Validated Changes','Validates whitelisted layer updates on a private copy. Returns a 60-second apply token only for valid changes; does not alter the canvas.',
    objectSchema({updates:{type:'array',minItems:1,items:objectSchema({id:{type:'string'},properties:objectSchema(updateProperties)},['id','properties'])}},['updates']),async (input = {}) => {
      assertObject(input,['updates']);
      const contract = clone(active());
      if (!Array.isArray(input.updates) || !input.updates.length) throw new Error('updates debe contener al menos una actualización.');
      const stateSnapshot = JSON.stringify(store.state);
      const candidate = clone(store.state.layers);
      const index = new Map(candidate.map(layer => [layer.id,layer]));
      const updatedIds = new Set();
      for (const update of input.updates) {
        assertObject(update,['id','properties']);
        if (typeof update.id !== 'string' || !index.has(update.id)) throw new Error('La capa solicitada no existe.');
        validateProperties(update.properties);
        const layer = index.get(update.id);
        const seen = new Set();
        for (let ancestor = layer; ancestor; ancestor = ancestor.parentId == null ? null : index.get(ancestor.parentId)) {
          if (seen.has(ancestor.id)) throw new Error('Jerarquía de capas cíclica.');
          seen.add(ancestor.id);
          if (ancestor.locked) throw new Error('No se permite actualizar una capa bloqueada o descendiente de una capa bloqueada.');
        }
        Object.assign(layer,clone(update.properties)); updatedIds.add(update.id);
      }
      const validation = clone(validateDesign(candidate,contract));
      if (!validation.valid) return {...validation,applied:false};
      for (const [key,value] of pending) if (value.expiresAt <= Date.now()) pending.delete(key);
      // Stored JSON is immutable and never shared with callers.
      const token = globalThis.crypto.randomUUID();
      pending.set(token,{candidate:JSON.stringify(candidate),stateSnapshot,contract:JSON.stringify(contract),expiresAt:Date.now()+60000});
      return {...validation,applied:false,confirmationToken:token,expiresInMs:60000,updatedIds:[...updatedIds]};
    });
  register('figma_apply_validated_changes','Apply Validated Changes','Applies the exact previewed candidate only while its token is fresh and the entire project state and active contract are unchanged.',
    objectSchema({confirmationToken:{type:'string'}},['confirmationToken']),async (input = {}) => {
      assertObject(input,['confirmationToken']);
      if (typeof input.confirmationToken !== 'string') throw new Error('Token inválido.');
      const entry = pending.get(input.confirmationToken);
      pending.delete(input.confirmationToken);
      if (!entry || entry.expiresAt <= Date.now()) throw new Error('Token inválido o caducado; vuelve a previsualizar.');
      if (entry.stateSnapshot !== JSON.stringify(store.state) || entry.contract !== JSON.stringify(active())) throw new Error('El proyecto o contrato cambió; vuelve a previsualizar.');
      store.recordHistory();
      store.state.layers = JSON.parse(entry.candidate);
      store.notify('layer:validated-update');
      return {success:true,applied:true};
    },false);
  register('figma_export_design_rules','Export Design Rules','Exports the active contract, or a clearly labelled proposal if there is no active contract.',objectSchema(),async (input = {}) => {
    empty(input);
    const contract = clone(store.state.designContract || store.state.designContractProposal || extractDesignRules(clone(store.state.layers),{}));
    return {status:store.state.designContract ? 'active' : 'proposal',content:exportDesignRules(contract)};
  });
}
