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
});
