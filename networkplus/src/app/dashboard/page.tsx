"use client";
import { useEffect, useRef, useState, useMemo, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"

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
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 font-sans dark:bg-black p-6">
      <main className="w-full max-w-5xl">
        <header className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Network Editor</h1>
        </header>
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        <section className="grid grid-cols-2 gap-6">
          <div className="p-4 bg-white rounded shadow">
            <h2 className="font-semibold mb-2">Add Node</h2>
            <form onSubmit={createNode}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full p-2 border mb-2" />
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full p-2 border mb-2" />
              <div className="flex gap-2">
                <Button type="submit">Create Node</Button>
              </div>
            </form>

            <h3 className="mt-4 font-semibold">Nodes</h3>
            <ul>
              {nodes.map((n) => (
                <li key={n.id} className="text-sm">{n.title} — {n.id}</li>
              ))}
            </ul>

            <label className="block mt-4 text-sm font-medium text-muted-foreground">Filter by group</label>
            <NativeSelect value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
              <NativeSelectOption value="">All groups</NativeSelectOption>
              {groups.length === 0 && <NativeSelectOption value="" disabled>No groups found</NativeSelectOption>}
              {groups.map((g) => (
                <NativeSelectOption key={g} value={g}>{g}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="p-4 bg-white rounded shadow">
            <h2 className="font-semibold mb-2">Add Link</h2>
            <form onSubmit={createLink}>
              <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="w-full p-2 border mb-2">
                <option value="">Select source</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
              <select value={toId} onChange={(e) => setToId(e.target.value)} className="w-full p-2 border mb-2">
                <option value="">Select target</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
              <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label" className="w-full p-2 border mb-2" />
              <div className="flex gap-2">
                <Button type="submit">Create Link</Button>
              </div>
            </form>

            <h3 className="mt-4 font-semibold">Links</h3>
            <ul>
              {links.map((l) => (
                <li key={l.id} className="text-sm">{l.label ?? "link"} — {l.fromId} → {l.toId}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-6 p-4 bg-white rounded shadow">
          <div id="graph" ref={graphRef} style={{ width: "100%", height: "500px" }}></div>
        </section>
      </main>
    </div>
  );
}