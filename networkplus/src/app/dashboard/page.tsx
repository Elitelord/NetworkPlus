"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Navbar from "../../components/navbar";
import { Button } from "@/components/ui/button";
import ForceGraph from "force-graph";

type NodeType = { id: string; title: string; description?: string };
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

  async function loadData() {
    const [nRes, lRes] = await Promise.all([fetch("/api/nodes"), fetch("/api/links")]);
    const [nJson, lJson] = await Promise.all([nRes.json(), lRes.json()]);
    setNodes(nJson || []);
    setLinks(lJson || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const graphData = {
      nodes: nodes.map((n) => ({ id: n.id, name: n.title, group: "default" })),
      links: links.map((l) => ({ source: l.fromId, target: l.toId })),
    };
    const myGraph = new ForceGraph(el)
      .nodeAutoColorBy("group")
      .enablePanInteraction(true)
      .enableZoomInteraction(true)
      .onNodeClick((node: any) => {
        myGraph.centerAt(node.x, node.y, 1000);
        myGraph.zoom(8, 2000);
      })
      .graphData(graphData as any);

    return () => {
      try {
        myGraph.graphData({ nodes: [], links: [] });
      } catch {
        // ignore
      }
    };
  }, [nodes, links]);

  async function createNode(e?: FormEvent) {
    e?.preventDefault();
    await fetch("/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    setTitle("");
    setDescription("");
    await loadData();
  }

  async function createLink(e?: FormEvent) {
    e?.preventDefault();
    await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromId, toId, label: linkLabel }),
    });
    setFromId("");
    setToId("");
    setLinkLabel("");
    await loadData();
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 font-sans dark:bg-black p-6">
      <main className="w-full max-w-5xl">
        <header className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Network Editor</h1>
        </header>

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