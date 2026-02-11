"use client";
import { useEffect, useRef, useState, useMemo, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { DueSoonList } from "@/components/DueSoonList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ContactImportModal } from "@/components/contact-import-modal";
import { ContactDetailSheet } from "@/components/contact-detail-sheet";
import { EditLinkDialog } from "@/components/edit-link-dialog";
import { MultiSelect } from "@/components/ui/multi-select";

type NodeMetadata = { groups?: string[];[key: string]: any };

type Contact = {
  id: string;
  name: string;
  description?: string;
  groups?: string[];
  phone?: string | null;
  email?: string | null;
  commonPlatform?: string | null;
  metadata?: NodeMetadata;
  lastInteractionAt?: string;
  interactions?: { date: string }[];
  strengthScore?: number;
  monthsKnown?: number;
};

type NodeType = Contact; // Alias for graph compatibility if needed, or just use Contact


// type NodeType = { id: string; title: string; description?: string; group?: string | null; metadata?: NodeMetadata };
type LinkType = { id: string; fromId: string; toId: string; label?: string; metadata?: any };

export default function Home() {
  const graphRef = useRef<HTMLDivElement | null>(null);
  const graphInstanceRef = useRef<any>(null);
  const [nodes, setNodes] = useState<NodeType[]>([]);
  const [links, setLinks] = useState<LinkType[]>([]);
  const [title, setTitle] = useState("");

  const [description, setDescription] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedNode, setSelectedNode] = useState<NodeType | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [showDueNodes, setShowDueNodes] = useState(false);
  const [dueNodeIds, setDueNodeIds] = useState<Set<string>>(new Set());
  const [dueContacts, setDueContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<{ id: string; label?: string; fromName?: string; toName?: string } | null>(null);

  async function loadData() {
    setError(null);
    try {
      const [nRes, lRes] = await Promise.all([fetch("/api/contacts", {
        credentials: "include",
      }), fetch("/api/links", {
        credentials: "include",
      })]);

      const parseResponse = async (res: Response) => {
        const ct = res.headers.get("content-type") || "";
        if (!res.ok) {
          const txt = await res.text();
          console.error("Fetch failed:", res.status, txt);
          throw new Error(`Request failed (${res.status})`);
        }
        if (ct.includes("application/json")) {
          try {
            return await res.json();
          } catch (err) {
            console.error("JSON parse error:", err);
            throw new Error("Invalid JSON response");
          }
        }
        // not JSON
        const txt = await res.text();
        console.error("Unexpected content type while fetching JSON:", ct, txt.slice(0, 500));
        throw new Error("Unexpected response format");
      };

      const [nJson, lJson] = await Promise.all([parseResponse(nRes), parseResponse(lRes)]);
      setNodes(Array.isArray(nJson) ? nJson : []);
      setLinks(Array.isArray(lJson) ? lJson : []);

      // Fetch due nodes
      // Fetch due nodes
      fetch("/api/contacts/due-soon")
        .then(res => res.ok ? res.json() : [])
        .then((data: Contact[]) => {
          setDueContacts(data);
          const ids = new Set<string>();
          if (Array.isArray(data)) {
            data.forEach(c => {
              ids.add(c.id);
            });
          }
          setDueNodeIds(ids);
        })
        .catch(err => console.error("Failed to fetch due nodes:", err));

    } catch (err: unknown) {
      console.error("loadData error:", err);
      setError(String(err));
      setNodes([]);
      setLinks([]);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const groups = useMemo(() => {
    const s = new Set<string>();
    nodes.forEach((n) => {
      // Prioritize `groups` array, fallback to `group` (legacy) if exists and not in array?
      // But we just use `groups` primarily now.
      const gs = n.groups ?? n.metadata?.groups ?? [];
      gs.forEach(g => {
        if (g) s.add(g);
      });
      // Handle legacy single-group if any (though migration should fix it)
      if ((n as any).group && !gs.includes((n as any).group)) {
        s.add((n as any).group);
      }
    });
    return Array.from(s).sort();
  }, [nodes]);

  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;

    // compute visible nodes/links based on selectedGroup
    const visibleNodes = nodes.filter((n) => {
      if (!selectedGroup) return true; // show all
      const gs = n.groups ?? n.metadata?.groups ?? [];
      return gs.includes(selectedGroup);
    });
    const visibleIds = new Set(visibleNodes.map((n) => n.id));

    // Calculate Curvature for multi-links
    // Map of "A:B" -> [linkId, linkId...]
    const pairMap = new Map<string, string[]>();
    const nodeLinks = links
      .filter((l) => visibleIds.has(l.fromId) && visibleIds.has(l.toId));

    nodeLinks.forEach(l => {
      const [a, b] = [l.fromId, l.toId].sort();
      const key = `${a}:${b}`;
      if (!pairMap.has(key)) pairMap.set(key, []);
      pairMap.get(key)?.push(l.id);
    });

    const getCurvature = (link: any) => {
      const [a, b] = [link.source, link.target].sort(); // source/target might be objects or ids
      // ForceGraph might pass objects for source/target if they exist.
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;
      const [id1, id2] = [sId, tId].sort();
      const key = `${id1}:${id2}`;
      const siblings = pairMap.get(key) || [];
      const index = siblings.indexOf(link.id);
      const count = siblings.length;

      if (count <= 1) return 0;

      // Spread curvature: 0, 0.2, -0.2, 0.4, -0.4 ...
      // Or simpler: (index - (count - 1) / 2) * scale
      return (index - (count - 1) / 2) * 0.2;
    };

    const graphData = {
      nodes: visibleNodes.map((n) => ({
        id: n.id,
        name: n.name, // was title
        groups: n.groups ?? n.metadata?.groups ?? [],
        // Use first group for color or "default"
        group: (n.groups && n.groups.length > 0) ? n.groups[0] : "default",
        strengthScore: n.strengthScore || 0, // Pass strengthScore to graph
      })),

      links: nodeLinks.map((l) => ({
        source: l.fromId,
        target: l.toId,
        label: l.label,
        metadata: l.metadata,
        id: l.id // Ensure ID is passed
      })),
    };

    let myGraph: any;
    import("force-graph").then(({ default: ForceGraph }) => {
      myGraph = new ForceGraph(el)
        .nodeAutoColorBy("group")
        .linkLineDash((link: any) => link.metadata?.source === "inferred" ? [4, 4] : [])
        .linkCurvature((link: any) => getCurvature(link))
        // Physics size
        .nodeVal((node: any) => Math.max(3, Math.min((node.strengthScore || 0) / 4, 15)))
        .nodeCanvasObject((node: any, ctx) => {
          // Visual size: range 3 to 15 based on score 0-100? 
          // 0 -> 3, 100 -> 15. Linear: 3 + (score/100)*12
          const score = node.strengthScore || 0;
          const size = 3 + (score / 100) * 12; // Smoother scaling
          const isHighlighted = highlightNodes.has(node.id);

          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.color || "#ccc"; // autoColorBy adds .color
          ctx.fill();

          if (isHighlighted) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI, false);
            ctx.strokeStyle = "#facc15"; // Yellow highlight
            ctx.lineWidth = 2;
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          if (showDueNodes && dueNodeIds.has(node.id)) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI, false);
            ctx.strokeStyle = "#ff4444"; // Red alarm
            ctx.lineWidth = 2;
            ctx.setLineDash([2, 1]); // Dotted line
            ctx.stroke();
            ctx.setLineDash([]); // Reset
          }

          // Node Label
          const label = node.name;
          const fontSize = 3.5;
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.fillStyle = isHighlighted ? "#000" : "#666";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, node.x, node.y + size + fontSize);
        })
        .linkCanvasObjectMode(() => "after")
        .linkCanvasObject((link: any, ctx) => {
          // No labels drawn anymore, just the interaction
          // Use a wider transparent line for easier clicking if needed, but default interaction usually works.
          // The request said "just a line". So we remove the text drawing code.
          return;
        })
        .enablePanInteraction(true)
        .enableZoomInteraction(true)
        .onNodeClick((node: any) => {
          myGraph.centerAt(node.x, node.y, 1000);
          myGraph.zoom(8, 2000);
          const originalNode = nodes.find((n) => n.id === node.id);
          setSelectedNode(originalNode || null);
        })
        .onLinkClick((link: any) => {
          // link.source and link.target are objects in force-graph
          const fromName = link.source.name || link.source.id;
          const toName = link.target.name || link.target.id;
          setSelectedLink({ id: link.id, label: link.label, fromName, toName });
        })
        .graphData(graphData as any);

      graphInstanceRef.current = myGraph;
    });

    return () => {
      try {
        if (myGraph) myGraph.graphData({ nodes: [], links: [] });
      } catch {
        // ignore
      }
    };
  }, [nodes, links, selectedGroup, highlightNodes, showDueNodes, dueNodeIds]);

  // if groups change and current selection no longer exists, reset to all
  useEffect(() => {
    if (selectedGroup && !groups.includes(selectedGroup)) {
      setSelectedGroup("");
    }
  }, [groups, selectedGroup]);

  async function createNode(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title, description, groups: selectedGroups }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("Create contact failed:", res.status, txt);
        setError(`Create contact failed: ${res.status}`);
        return;
      }
      setTitle("");
      setDescription("");
      setSelectedGroups([]);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(String(err?.message ?? err));
    }
  }

  async function createLink(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId, toId, label: linkLabel }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("Create link failed:", res.status, txt);
        setError(`Create link failed: ${res.status}`);
        return;
      }
      setFromId("");
      setToId("");
      setLinkLabel("");
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(String(err?.message ?? err));
    }
  }


  async function handleInteractionLogged(contactIds: string[]) {
    // Optimistic update: Remove from due list and highlights immediately
    const previousDueContacts = [...dueContacts];
    setDueContacts(prev => prev.filter(c => !contactIds.includes(c.id)));

    // Update IDs set
    const newIds = new Set(dueNodeIds);
    contactIds.forEach(id => {
      newIds.delete(id);
    });
    setDueNodeIds(newIds);

    // Refresh due contacts from server to be sure
    fetch("/api/contacts/due-soon")
      .then(res => res.ok ? res.json() : [])
      .then((data: Contact[]) => {
        setDueContacts(data);
        const ids = new Set<string>();
        if (Array.isArray(data)) {
          data.forEach(c => ids.add(c.id));
        }
        setDueNodeIds(ids);
      })
      .catch(err => console.error("Failed to refresh due contacts:", err));

    // Refresh specific nodes to get updated strengthScore
    // We do this in parallel for all involved contacts
    await Promise.all(contactIds.map(async (id) => {
      try {
        const res = await fetch(`/api/contacts/${id}`);
        if (res.ok) {
          const updatedNode = await res.json();
          // Update nodes list
          setNodes(prev => prev.map(n => n.id === id ? updatedNode : n));
          // Update selected node if it's the one currently open
          if (selectedNode?.id === id) {
            setSelectedNode(updatedNode);
          }
        }
      } catch (e) {
        console.error(`Failed to refresh contact ${id}:`, e);
      }
    }));
  }

  async function updateNode(id: string, updates: Partial<NodeType>) {
    // Optimistic update
    const previousNodes = [...nodes];
    const targetNode = nodes.find(n => n.id === id);
    if (!targetNode) return;

    const updatedNode = { ...targetNode, ...updates };

    // Update local state immediately
    setNodes(nodes.map(n => n.id === id ? updatedNode : n));
    if (selectedNode?.id === id) {
      setSelectedNode(updatedNode);
    }

    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        throw new Error(`Update failed: ${res.status}`);
      }

      const updatedData = await res.json();

      // Update local state with the actual server response (contains recalculated score)
      setNodes(prev => prev.map(n => n.id === id ? updatedData : n));

      // If groups were updated, refresh links because the backend might have created/deleted inferred links
      if (updates.groups) {
        await loadData();
      }

      // Update selected node if it's the one currently open
      if (selectedNode?.id === id) {
        setSelectedNode(updatedData);
      }
    } catch (err: any) {
      console.error("Update node failed:", err);
      // Revert on error
      setNodes(previousNodes);
      if (selectedNode?.id === id) {
        setSelectedNode(targetNode);
      }
      setError(String(err?.message ?? err));
    }
  }

  async function updateLink(id: string, label: string) {
    try {
      const res = await fetch(`/api/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error("Update failed");
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError("Failed to update link");
    }
  }

  async function deleteLink(id: string) {
    try {
      const res = await fetch(`/api/links/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setSelectedLink(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError("Failed to delete link");
    }
  }

  const focusNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      const instance = graphInstanceRef.current;
      if (instance) {
        // centerAt(x, y, duration)
        // force-graph nodes have x, y properties added by the engine
        // We find the internal node object from the graph data if needed, 
        // but often the data object we pass in gets mutated with x/y.
        // To be safe, let's try to pass the coordinates if we can find them in the instance's graphData.

        // ForceGraph doesn't expose a "getNode" method directly, but we can look at the graphData()
        const internalNode = instance.graphData().nodes.find((n: any) => n.id === nodeId);
        if (internalNode) {
          instance.centerAt(internalNode.x, internalNode.y, 1000);
          instance.zoom(8, 2000);
        }
      }
    }
  };

  const connectedNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    return links
      .filter((l) => l.fromId === selectedNode.id || l.toId === selectedNode.id)
      .map((l) => {
        const neighborId = l.fromId === selectedNode.id ? l.toId : l.fromId;
        return nodes.find((n) => n.id === neighborId);
      })
      .filter((n): n is NodeType => n !== undefined);
  }, [selectedNode, links, nodes]);

  // Validation Logic
  const isNodeNameEmpty = title.trim() === "";

  const isSelfLink = fromId !== "" && toId !== "" && fromId === toId;
  const isDuplicateLink = useMemo(() => {
    if (fromId === "" || toId === "") return false;
    // Basic check for duplicate MANUAL link?
    // User might want to create multiple links now manually?
    // But usually one link per pair manually.
    // Let's keep duplicate check for Manual creation to avoid accidental double clicks.
    return links.some(l => l.fromId === fromId && l.toId === toId);
  }, [fromId, toId, links]);

  const isLinkInvalid = fromId === "" || toId === "" || isSelfLink || isDuplicateLink;

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black font-sans">
      {/* Left Sidebar */}
      <aside className="w-80 border-r bg-background p-6 flex flex-col gap-6 shrink-0 h-screen sticky top-0 overflow-y-auto">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-primary rounded-lg"></div>
          <h1 className="font-bold text-xl tracking-tight">Network+</h1>
        </div>

        <DueSoonList contacts={dueContacts} onSelect={(contact) => {
          // Find logic to center on node
          const targetNode = nodes.find(n => n.id === contact.id); // Direct ID match
          if (targetNode) {
            const instance = graphInstanceRef.current;
            if (instance) {
              // Find internal node for coordinates
              const internalNode = instance.graphData().nodes.find((n: any) => n.id === targetNode.id);
              if (internalNode) {
                instance.centerAt(internalNode.x, internalNode.y, 1000);
                instance.zoom(6, 2000); // Fairly zoomed in
              }
            }

            // Highlight logic
            // Only highlight the target node itself
            const neighborIds = new Set<string>();
            neighborIds.add(targetNode.id);
            setHighlightNodes(neighborIds);

            // Clear highlight after 3 seconds
            setTimeout(() => {
              setHighlightNodes(new Set());
            }, 3000);
          } else {
            console.warn("No matching node found for contact:", contact.name);
          }
        }} />

        {/* Existing Navigation or Filters could go here */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Filter by group</label>
            <NativeSelect value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
              <NativeSelectOption value="">All groups</NativeSelectOption>
              {groups.length === 0 && <NativeSelectOption value="" disabled>No groups found</NativeSelectOption>}
              {groups.map((g) => (
                <NativeSelectOption key={g} value={g}>{g}</NativeSelectOption>
              ))}
            </NativeSelect>
          </CardContent>
        </Card>
      </aside >

      {/* Main Content - Graph */}
      < main className="flex-1 relative overflow-hidden flex flex-col" >
        <div id="graph" ref={graphRef} className="flex-1 w-full h-full bg-zinc-100 dark:bg-zinc-900/50"></div>
        {
          error && (
            <div className="absolute top-4 left-4 right-4 bg-destructive/10 text-destructive p-3 rounded-md border border-destructive/20 text-sm">
              {error}
            </div>
          )
        }
      </main >

      {/* Right Sidebar - Tools */}
      < aside className="w-80 border-l bg-background p-6 flex flex-col gap-6 shrink-0 h-screen sticky top-0 overflow-y-auto" >
        <h2 className="font-semibold text-lg">Tools</h2>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createNode} className="flex flex-col gap-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name" className="w-full p-2 border rounded-md text-sm bg-background" />
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full p-2 border rounded-md text-sm bg-background" />

              <div className="relative">
                <MultiSelect
                  options={groups}
                  selected={selectedGroups}
                  onChange={setSelectedGroups}
                  placeholder="Select groups..."
                />
              </div>

              <Button type="submit" className="w-full" disabled={isNodeNameEmpty}>
                Create Contact
              </Button>
              {isNodeNameEmpty && title !== "" && (
                <p className="text-xs text-destructive">Name is required.</p>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Link</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createLink} className="flex flex-col gap-3">
              <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="w-full p-2 border rounded-md text-sm bg-background">
                <option value="">Select source</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
              <select value={toId} onChange={(e) => setToId(e.target.value)} className="w-full p-2 border rounded-md text-sm bg-background">
                <option value="">Select target</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
              <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label (optional)" className="w-full p-2 border rounded-md text-sm bg-background" />
              <Button type="submit" className="w-full" disabled={isLinkInvalid}>
                Create Link
              </Button>
              {isSelfLink && <p className="text-xs text-destructive">Cannot link a contact to itself.</p>}
              {isDuplicateLink && <p className="text-xs text-destructive">Link already exists.</p>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Data</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactImportModal onSuccess={() => {
              loadData();
              // Optional: show a toast or something, but modal success state handles feedback
            }} />
          </CardContent>
        </Card>

        <div className="py-4">
          <h3 className="font-semibold text-sm mb-2">Recent Contacts</h3>
          <ul className="space-y-1">
            {nodes.slice(-5).reverse().map((n) => (
              <li key={n.id} className="text-xs text-muted-foreground truncate hover:text-foreground cursor-pointer" onClick={() => {
                focusNode(n.id);
              }}>
                {n.name}
              </li>
            ))}
          </ul>
        </div>
      </aside >


      <ContactDetailSheet
        open={!!selectedNode}
        onOpenChange={(open) => !open && setSelectedNode(null)}
        node={selectedNode ? {
          id: selectedNode.id,
          name: selectedNode.name,
          description: selectedNode.description || "",
          groups: selectedNode.groups || [],
          email: selectedNode.email || "",
          phone: selectedNode.phone || "",
          commonPlatform: selectedNode.commonPlatform || "",
          interactions: selectedNode.interactions,
          lastInteractionAt: selectedNode.lastInteractionAt,
          strengthScore: selectedNode.strengthScore,
          monthsKnown: selectedNode.monthsKnown,
        } : null}
        groups={groups}
        dueNodeIds={dueNodeIds}
        onLogInteraction={handleInteractionLogged}
        onUpdateNode={updateNode}
        onFocusNode={focusNode}
        connectedNeighbors={connectedNeighbors}
      />

      <EditLinkDialog
        open={!!selectedLink}
        onOpenChange={(open) => !open && setSelectedLink(null)}
        link={selectedLink}
        onUpdate={updateLink}
        onDelete={deleteLink}
      />
    </div >
  );
}