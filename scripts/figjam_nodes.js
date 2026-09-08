import { nodeId } from 'openfig-core';

// FigJam stores the actual shape and text as generated children, joined by
// guidPath rather than by array position. Materialize those saved children.
export function expandFigJamNodes(nodes) {
  const result = [];
  const used = new Set(nodes.map(nodeId));
  let next = 1;
  for (const node of nodes) {
    if (!['SHAPE_WITH_TEXT', 'STICKY', 'CONNECTOR'].includes(node.type)) {
      result.push(node); continue;
    }
    const annotation = node.type === 'STICKY'
      ? {annotationKind:'sticky', annotationSourceRootId:nodeId(node)} : {};
    result.push({...node, type:'FRAME', sourceNodeType:node.type, ...annotation,
      fillPaints:[], strokePaints:[], frameMaskDisabled:true});
    const key = override => JSON.stringify(override.guidPath?.guids || []);
    const styles = new Map((node.nodeGenerationData?.overrides || []).map(o => [key(o),o]));
    for (const [index, geometry] of (node.derivedImmutableFrameData?.overrides || []).entries()) {
      const style = styles.get(key(geometry)) || {};
      const isText = !!geometry.derivedTextData;
      if (isText && !style.textData?.characters) continue;
      if (!isText && !geometry.fillGeometry?.length && !geometry.strokeGeometry?.length) continue;
      while (used.has(`39999999:${next}`)) next++;
      const guid = {sessionID:39999999,localID:next++};
      used.add(`${guid.sessionID}:${guid.localID}`);
      result.push({...style,...geometry,guid,phase:node.phase,type:isText?'TEXT':'VECTOR',
        name:isText?style.textData.characters:`${node.name} · ${index}`,
        parentIndex:{guid:node.guid,position:String(index)}, sourceFigJamId:nodeId(node),
        sourceNodeType:node.type,
        ...(node.type === 'STICKY' ? {annotationSourceRootId:nodeId(node)} : {})});
    }
  }
  return result;
}
