import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import localforage from 'localforage';
import { saveNodes, loadNodes, saveLinks, loadLinks, clearLocal } from '@/lib/localstore';

describe('localstore persistence', () => {
  beforeEach(async () => {
    await clearLocal();
  });

  afterEach(async () => {
    await clearLocal();
  });

  it('saves and loads nodes', async () => {
    const nodes = [{ id: 'n1', title: 'A' }];
    await saveNodes(nodes);
    const loaded = await loadNodes();
    expect(loaded).toEqual(nodes);
  });

  it('saves and loads links', async () => {
    const links = [{ id: 'l1', fromId: 'n1', toId: 'n2' }];
    await saveLinks(links);
    const loaded = await loadLinks();
    expect(loaded).toEqual(links);
  });

  it('handles heavy load: saving and loading 10,000 nodes and links', async () => {
    const nodes = Array.from({ length: 10000 }).map((_, i) => ({ id: `n${i}`, title: `Node ${i}` }));
    const links = Array.from({ length: 10000 }).map((_, i) => ({
      id: `l${i}`,
      fromId: `n${i}`,
      toId: `n${i + 1}`
    }));

    const saveStart = performance.now();
    await saveNodes(nodes);
    await saveLinks(links);
    const saveEnd = performance.now();

    const loadStart = performance.now();
    const loadedNodes = await loadNodes();
    const loadedLinks = await loadLinks();
    const loadEnd = performance.now();

    expect(loadedNodes).toHaveLength(10000);
    expect(loadedLinks).toHaveLength(10000);
    expect(loadedNodes[9999].title).toBe('Node 9999');

    // Performance will depend on fake-indexeddb but locally should be < 2 seconds
    expect(saveEnd - saveStart).toBeLessThan(3000);
    expect(loadEnd - loadStart).toBeLessThan(3000);
  });

  it('handles edge cases: saving empty, broken, or weird-typed objects without crashing', async () => {
    // Note: IndexedDB is fairly robust about storing whatever object we give it, 
    // but verifying we can read/write undefined properties safely.
    const weirdNodes = [
      { id: '1', title: undefined as any },
      { id: '2', title: '💥', extra: 'ghost data' as any }
    ];
    await saveNodes(weirdNodes);
    const loaded = await loadNodes();

    expect(loaded).toHaveLength(2);
    expect((loaded[0] as any).title).toBeUndefined();
    expect((loaded[1] as any).extra).toBe('ghost data');
  });
});

