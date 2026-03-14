import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@lib/prisma", () => ({
  default: {
    contact: {
      findMany: vi.fn(),
    },
    link: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from "@lib/prisma";
import { updateInferredLinksBulk } from "./inference";

const mockPrisma = prisma as unknown as {
  contact: { findMany: ReturnType<typeof vi.fn> };
  link: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("updateInferredLinksBulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates shared_group links for contacts that share groups and deletes stale shared_group links, regardless of metadata.source", async () => {
    // Two contacts share group "G1"; one has an existing shared_group link with metadata.source = 'manual'
    mockPrisma.contact.findMany
      // First call: fetch involved contacts
      .mockResolvedValueOnce([
        { id: "a", groups: ["G1"], ownerId: "user1" },
        { id: "b", groups: ["G1"], ownerId: "user1" },
      ])
      // Second call: fetch potential targets
      .mockResolvedValueOnce([
        { id: "a", groups: ["G1"] },
        { id: "b", groups: ["G1"] },
      ]);

    // Existing shared_group link between a and b with arbitrary metadata.source
    mockPrisma.link.findMany.mockResolvedValueOnce([
      {
        id: "link1",
        fromId: "a",
        toId: "b",
        label: "shared_group",
        metadata: { source: "manual", group: "G1" },
      },
    ]);

    mockPrisma.link.deleteMany.mockResolvedValue({ count: 0 });

    const createdLinks: any[] = [];
    mockPrisma.link.create.mockImplementation(({ data }) => {
      createdLinks.push(data);
      return Promise.resolve(data);
    });
    mockPrisma.$transaction.mockImplementation(async (ops: any[]) => {
      for (const op of ops) {
        // each op is prisma.link.create({ data })
        // call it to simulate creation
        await op;
      }
    });

    await updateInferredLinksBulk(["a", "b"]);

    // Because we now treat all shared_group links the same (no precedence),
    // we should:
    // - NOT delete the existing valid shared_group link
    // - NOT create a duplicate shared_group link
    expect(mockPrisma.link.deleteMany).not.toHaveBeenCalled();
    expect(createdLinks).toHaveLength(0);
  });

  it("reconciles links when groups change (creates new link and deletes stale one)", async () => {
    // Contact a was in G1 with b; now moved to G2 with c
    mockPrisma.contact.findMany
      // First call: involved contacts (only "a" is passed in)
      .mockResolvedValueOnce([
        { id: "a", groups: ["G2"], ownerId: "user1" },
      ])
      // Second call: potential targets (b in G1, c in G2)
      .mockResolvedValueOnce([
        { id: "a", groups: ["G2"] },
        { id: "b", groups: ["G1"] },
        { id: "c", groups: ["G2"] },
      ]);

    // Existing links: one stale (a-b, G1), one missing (a-c, G2)
    mockPrisma.link.findMany.mockResolvedValueOnce([
      {
        id: "stale",
        fromId: "a",
        toId: "b",
        label: "shared_group",
        metadata: { group: "G1" },
      },
    ]);

    const deletedIds: string[] = [];
    mockPrisma.link.deleteMany.mockImplementation(({ where }) => {
      deletedIds.push(...where.id.in);
      return Promise.resolve({ count: deletedIds.length });
    });

    const createdLinks: any[] = [];
    mockPrisma.link.create.mockImplementation(({ data }) => {
      createdLinks.push(data);
      return Promise.resolve(data);
    });
    mockPrisma.$transaction.mockImplementation(async (ops: any[]) => {
      for (const op of ops) {
        await op;
      }
    });

    await updateInferredLinksBulk(["a"]);

    // Stale link should be deleted
    expect(deletedIds).toEqual(["stale"]);

    // New link between a and c for group G2 should be created
    expect(createdLinks).toHaveLength(1);
    expect(createdLinks[0]).toMatchObject({
      label: "shared_group",
      metadata: { rule: "shared_group", group: "G2" },
    });
  });
});
