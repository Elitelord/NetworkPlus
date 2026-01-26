"use client";
import { useEffect, useRef, useState, useMemo, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { DueSoonList } from "@/components/DueSoonList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type NodeMetadata = { group?: string;[key: string]: any };

type Contact = {
  id: string;
  name: string;
  description?: string;
  group?: string | null;
  metadata?: NodeMetadata;
  lastInteractionAt?: string;
  interactions?: { date: string }[];
};

type NodeType = Contact; // Alias for graph compatibility if needed, or just use Contact


// type NodeType = { id: string; title: string; description?: string; group?: string | null; metadata?: NodeMetadata };
type LinkType = { id: string; fromId: string; toId: string; label?: string };

function GroupEditor({
  initialGroup,
  groups,
  onSave
}: {
  initialGroup: string;
  groups: string[];
  onSave: (newGroup: string) => void;
}) {
  const [value, setValue] = useState(initialGroup);

  // Reset value when the node (represented by initialGroup) changes externally
  // We use initialGroup as a key/dependency to reset local state
  useEffect(() => {
    setValue(initialGroup);
  }, [initialGroup]);

  return (
    <div className="relative">
      <input
        list="group-suggestions-edit"
        className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-inset ring-gray-500/10 border-0 focus:ring-2 focus:ring-primary w-40"
        placeholder="None"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== initialGroup) {
            onSave(value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
      <datalist id="group-suggestions-edit">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
    </div>
  );
}

export default function Home() {
  const graphRef = useRef<HTMLDivElement | null>(null);
  const graphInstanceRef = useRef<any>(null);
  const [nodes, setNodes] = useState<NodeType[]>([]);
  const [links, setLinks] = useState<LinkType[]>([]);
  const [title, setTitle] = useState("");

  const [description, setDescription] = useState("");
  const [groupInput, setGroupInput] = useState("");
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

  async function loadData() {
    setError(null);
    try {
      const [nRes, lRes] = await Promise.all([fetch("/api/contacts"), fetch("/api/links")]);

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
      fetch("/api/contacts/due-soon?days=30")
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
      const g = n.group ?? (n as any).group ?? n.metadata?.group;
      if (g !== undefined && g !== null && g !== "") s.add(String(g));
    });
    return Array.from(s).sort();
  }, [nodes]);

  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;

    // compute visible nodes/links based on selectedGroup
    const visibleNodes = nodes.filter((n) => {
      if (!selectedGroup) return true; // show all
      const g = n.group ?? (n as any).group ?? n.metadata?.group;
      return String(g) === selectedGroup;
    });
    const visibleIds = new Set(visibleNodes.map((n) => n.id));

    const graphData = {
      nodes: visibleNodes.map((n) => ({
        id: n.id,
        name: n.name, // was title
        group: n.group ?? (n as any).group ?? n.metadata?.group ?? "default",
      })),

      links: links
        .filter((l) => visibleIds.has(l.fromId) && visibleIds.has(l.toId))
        .map((l) => ({ source: l.fromId, target: l.toId, label: l.label })),
    };

    let myGraph: any;
    import("force-graph").then(({ default: ForceGraph }) => {
      myGraph = new ForceGraph(el)
        .nodeAutoColorBy("group")
        .nodeCanvasObject((node: any, ctx) => {
          const size = 5;
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
          const label = link.label;
          if (!label) return;

          const MAX_FONT_SIZE = 4;
          const LABEL_NODE_MARGIN = myGraph.nodeRelSize() * 1.5;

          const start = link.source;
          const end = link.target;

          // ignore unbound links
          if (typeof start !== "object" || typeof end !== "object") return;

          // calculate label positioning
          const textPos = Object.assign(
            {},
            ...["x", "y"].map((c) => ({
              [c]: start[c] + (end[c] - start[c]) / 2, // calc middle point
            }))
          );

          const relLink = { x: end.x - start.x, y: end.y - start.y };

          const maxTextLength = Math.sqrt(Math.pow(relLink.x, 2) + Math.pow(relLink.y, 2)) - LABEL_NODE_MARGIN * 2;

          let textAngle = Math.atan2(relLink.y, relLink.x);
          // maintain label vertical orientation for legibility
          if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
          if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

          // estimate fontSize to fit in link length
          ctx.font = "1px Sans-Serif";
          const fontSize = Math.min(MAX_FONT_SIZE, maxTextLength / ctx.measureText(label).width);
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map((n) => n + fontSize * 0.2); // some padding

          // draw text label (with background rect)
          ctx.save();
          ctx.translate(textPos.x, textPos.y);
          ctx.rotate(textAngle);

          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.fillRect(-bckgDimensions[0] / 2, -bckgDimensions[1] / 2, ...bckgDimensions as [number, number]);

          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#666"; // dark gray text
          ctx.fillText(label, 0, 0);
          ctx.restore();
        })
        .enablePanInteraction(true)
        .enableZoomInteraction(true)
        .onNodeClick((node: any) => {
          myGraph.centerAt(node.x, node.y, 1000);
          myGraph.zoom(8, 2000);
          const originalNode = nodes.find((n) => n.id === node.id);
          setSelectedNode(originalNode || null);
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
        body: JSON.stringify({ name: title, description, group: groupInput }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("Create node failed:", res.status, txt);
        setError(`Create node failed: ${res.status}`);
        return;
      }
      setTitle("");
      setDescription("");
      setGroupInput("");
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


  async function logInteraction(contactName: string) {
    // Find contact ID from dueContacts
    const contact = dueContacts.find(c => c.name === contactName);
    if (!contact) return;

    // Optimistic update: Remove from list and highlights immediately
    const previousDueContacts = [...dueContacts];
    setDueContacts(prev => prev.filter(c => c.id !== contact.id));

    // Update IDs set
    const newIds = new Set(dueNodeIds);
    // Find node ID for this contact
    const node = nodes.find(n => n.id === contact.id);
    if (node && newIds.has(node.id)) {
      newIds.delete(node.id);
      setDueNodeIds(newIds);
    }

    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          type: "OTHER",
          content: "Logged via Dashboard",
          date: new Date().toISOString()
        })
      });

      if (!res.ok) throw new Error("Failed to log interaction");

    } catch (err) {
      console.error("Log interaction failed", err);
      // Revert state
      setDueContacts(previousDueContacts);
      if (node) {
        newIds.add(node.id);
        setDueNodeIds(newIds);
      }
      setError("Failed to log interaction");
    }
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

      // Optionally reload data to ensure consistency, but if optimistic works, maybe not strictly needed
      // await loadData(); 
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
            // Find neighbors
            const neighborIds = new Set<string>();
            neighborIds.add(targetNode.id);
            links.forEach(l => {
              if (l.fromId === targetNode.id) neighborIds.add(l.toId);
              if (l.toId === targetNode.id) neighborIds.add(l.fromId);
            });

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
            <CardTitle className="text-base">Add Node</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createNode} className="flex flex-col gap-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full p-2 border rounded-md text-sm bg-background" />
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full p-2 border rounded-md text-sm bg-background" />

              <div className="relative">
                <input
                  list="group-suggestions"
                  value={groupInput}
                  onChange={(e) => setGroupInput(e.target.value)}
                  placeholder="Group (optional)"
                  className="w-full p-2 border rounded-md text-sm bg-background"
                />
                <datalist id="group-suggestions">
                  {groups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>

              <Button type="submit" className="w-full" disabled={isNodeNameEmpty}>
                Create Node
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
              {isSelfLink && <p className="text-xs text-destructive">Cannot link a node to itself.</p>}
              {isDuplicateLink && <p className="text-xs text-destructive">Link already exists.</p>}
            </form>
          </CardContent>
        </Card>

        <div className="py-4">
          <h3 className="font-semibold text-sm mb-2">Recent Nodes</h3>
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


      <Sheet open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>{selectedNode?.name}</SheetTitle>
            <SheetDescription>
              {selectedNode?.description || "No description provided."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {selectedNode && dueNodeIds.has(selectedNode.id) && (
              <div className="mb-6 p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Due for follow-up</h4>
                  <p className="text-xs text-red-600/80">Last interaction was over 30 days ago.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => selectedNode && logInteraction(selectedNode.name)}>
                  Log Interaction
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-muted-foreground">Group:</span>
              <GroupEditor
                key={selectedNode?.id}
                initialGroup={selectedNode?.group ?? (selectedNode as any)?.group ?? selectedNode?.metadata?.group ?? ""}
                groups={groups}
                onSave={(newGroup) => selectedNode && updateNode(selectedNode.id, { group: newGroup })}
              />
            </div>

            <h3 className="font-semibold text-sm mb-3">Connected Nodes ({connectedNeighbors.length})</h3>
            {connectedNeighbors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No connections found.</p>
            ) : (
              <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                {connectedNeighbors.map((neighbor) => (
                  <li
                    key={neighbor.id}
                    className="flex flex-col gap-1 p-3 rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    onClick={() => focusNode(neighbor.id)}
                  >
                    <span className="font-medium text-sm">{neighbor.name}</span>
                    {neighbor.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">{neighbor.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div >
  );
}