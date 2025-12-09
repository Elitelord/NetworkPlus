import localforage from "localforage";

const NODES_KEY = "networkplus_nodes";
const LINKS_KEY = "networkplus_links";

localforage.config({ name: "networkplus" });

export async function saveNodes(nodes: any[]) {
  await localforage.setItem(NODES_KEY, nodes);
}

export async function loadNodes(): Promise<any[]> {
  const v = await localforage.getItem<any[]>(NODES_KEY);
  return v ?? [];
}

export async function saveLinks(links: any[]) {
  await localforage.setItem(LINKS_KEY, links);
}

export async function loadLinks(): Promise<any[]> {
  const v = await localforage.getItem<any[]>(LINKS_KEY);
  return v ?? [];
}

export async function clearLocal() {
  await Promise.all([localforage.removeItem(NODES_KEY), localforage.removeItem(LINKS_KEY)]);
}

// Simple sync helper: fetch current server state via provided fetchers,
// store locally and return the server data.
export async function syncWithServer(fetchNodes: () => Promise<any[]>, fetchLinks: () => Promise<any[]>) {
  const [nodes, links] = await Promise.all([fetchNodes(), fetchLinks()]);
  await Promise.all([saveNodes(nodes), saveLinks(links)]);
  return { nodes, links };
}

export default {
  saveNodes,
  loadNodes,
  saveLinks,
  loadLinks,
  clearLocal,
  syncWithServer,
};
