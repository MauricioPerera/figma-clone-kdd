import { nodeId } from 'openfig-core';

export function publicPages(nodes) {
  return nodes.filter(node => node.type === 'CANVAS' && !node.internalOnly && node.phase !== 'REMOVED')
    .sort((a, b) => String(a.parentIndex?.position || '').localeCompare(String(b.parentIndex?.position || ''), 'en') || nodeId(a).localeCompare(nodeId(b), 'en'));
}

export function selectPage(nodes, id) {
  const pages = publicPages(nodes);
  const page = id ? pages.find(page => nodeId(page) === id) : pages[0];
  if (!page) throw new Error(id ? `Page ${id} not found` : 'No public Figma pages found');
  return page;
}
