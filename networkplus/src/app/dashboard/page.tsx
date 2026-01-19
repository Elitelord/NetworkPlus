"use client";
import { useEffect, useRef, useState, useMemo, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { DueSoonList } from "@/components/DueSoonList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type NodeMetadata = { group?: string;[key: string]: any };

type NodeType = { id: string; title: string; description?: string; metadata?: NodeMetadata };
type LinkType = { id: string; fromId: string; toId: string; label?: string };

export default function Home() {
  const graphRef = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes] = useState<NodeType[]>([]);
  const [links, setLinks] = useState<LinkType[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
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
      const g = (n as NodeType & { group?: string }).group ?? n.metadata?.group;
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
      const g = (n as NodeType & { group?: string }).group ?? n.metadata?.group;
      return String(g) === selectedGroup;
    });
    const visibleIds = new Set(visibleNodes.map((n) => n.id));

    const graphData = {
      nodes: visibleNodes.map((n) => ({
        id: n.id,
        name: n.title,
        group: (n as NodeType & { group?: string }).group ?? n.metadata?.group ?? "default",
      })),

      links: links
        .filter((l) => visibleIds.has(l.fromId) && visibleIds.has(l.toId))
        .map((l) => ({ source: l.fromId, target: l.toId })),
    };

    let myGraph: any;
    import("force-graph").then(({ default: ForceGraph }) => {
      myGraph = new ForceGraph(el)
        .nodeAutoColorBy("group")
        .enablePanInteraction(true)
        .enableZoomInteraction(true)
        .onNodeClick((node: any) => {
          myGraph.centerAt(node.x, node.y, 1000);
          myGraph.zoom(8, 2000);
        })
        .graphData(graphData as any);
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
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("Create node failed:", res.status, txt);
        setError(`Create node failed: ${res.status}`);
        return;
      }
      setTitle("");
      setDescription("");
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
                // Start simple - maybe center graph on it later?
              }}>
                {n.title}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}