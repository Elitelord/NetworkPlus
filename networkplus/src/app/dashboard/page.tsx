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

type NodeType = { id: string; title: string; description?: string; group?: string | null; metadata?: NodeMetadata };
type LinkType = { id: string; fromId: string; toId: string; label?: string };

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
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setError(null);
    try {
      const [nRes, lRes] = await Promise.all([fetch("/api/nodes"), fetch("/api/links")]);

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
        name: n.title,
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
  }, [nodes, links, selectedGroup]);

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
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, group: groupInput }),
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

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black font-sans">
      {/* Left Sidebar */}
      <aside className="w-80 border-r bg-background p-6 flex flex-col gap-6 shrink-0 h-screen sticky top-0 overflow-y-auto">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-primary rounded-lg"></div>
          <h1 className="font-bold text-xl tracking-tight">Network+</h1>
        </div>

        <DueSoonList />

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
      </aside>

      {/* Main Content - Graph */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <div id="graph" ref={graphRef} className="flex-1 w-full h-full bg-zinc-100 dark:bg-zinc-900/50"></div>
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-destructive/10 text-destructive p-3 rounded-md border border-destructive/20 text-sm">
            {error}
          </div>
        )}
      </main>

      {/* Right Sidebar - Tools */}
      <aside className="w-80 border-l bg-background p-6 flex flex-col gap-6 shrink-0 h-screen sticky top-0 overflow-y-auto">
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

              <Button type="submit" className="w-full">Create Node</Button>
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
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
              <select value={toId} onChange={(e) => setToId(e.target.value)} className="w-full p-2 border rounded-md text-sm bg-background">
                <option value="">Select target</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
              <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label (optional)" className="w-full p-2 border rounded-md text-sm bg-background" />
              <Button type="submit" className="w-full">Create Link</Button>
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
                {n.title}
              </li>
            ))}
          </ul>
        </div>
      </aside>


      <Sheet open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>{selectedNode?.title}</SheetTitle>
            <SheetDescription>
              {selectedNode?.description || "No description provided."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-muted-foreground">Group:</span>
              <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-inset ring-gray-500/10">
                {selectedNode?.group ?? (selectedNode as any)?.group ?? selectedNode?.metadata?.group ?? "None"}
              </span>
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
                    <span className="font-medium text-sm">{neighbor.title}</span>
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