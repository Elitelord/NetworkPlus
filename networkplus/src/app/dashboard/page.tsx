"use client";
import { useEffect, useRef, useState, useMemo, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

import { DueSoonList } from "@/components/DueSoonList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ContactImportModal } from "@/components/contact-import-modal";
import { LinkedInImportModal } from "@/components/linkedin-import-modal";
import { BulkEditModal } from "@/components/bulk-edit-modal";
import { ContactDetailSheet } from "@/components/contact-detail-sheet";
import { EditLinkDialog } from "@/components/edit-link-dialog";
import { MultiSelect } from "@/components/ui/multi-select";
import { GraphZoomControls } from "@/components/graph-zoom-controls";
import { GraphLegendPanel } from "@/components/graph-legend-panel";
import { useTheme } from "next-themes";
import { classifyGroupType, GROUP_TYPE_COLORS, type GroupType } from "@/lib/group-type-classifier";
import { useGraphSettings } from "@/hooks/use-graph-settings";

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
  const { resolvedTheme } = useTheme();
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
  const [selectedGroupFilters, setSelectedGroupFilters] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeType | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [showDueNodes, setShowDueNodes] = useState(false);
  const [dueNodeIds, setDueNodeIds] = useState<Set<string>>(new Set());
  const [dueContacts, setDueContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<{ id: string; label?: string; fromName?: string; toName?: string } | null>(null);

  // Zoom Controls
  const [currentZoom, setCurrentZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const DEFAULT_ZOOM = 1;

  // Graph Settings
  const { settings } = useGraphSettings();
  const CLUSTER_ENTER_ZOOM = settings.clusterThreshold;  // collapse groups when zoomed out to here
  const CLUSTER_EXIT_ZOOM = settings.clusterThreshold + 1.0;   // expand groups only when zoomed in to here (added hysteresis gap)
  const CLUSTER_MIN_SIZE = 3;      // min group members to form a cluster
  const CLUSTER_DEBOUNCE_MS = 400;

  const [isClusterMode, setIsClusterMode] = useState(false);
  const clusterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced cluster mode transition
  useEffect(() => {
    if (clusterTimerRef.current) clearTimeout(clusterTimerRef.current);

    clusterTimerRef.current = setTimeout(() => {
      setIsClusterMode((prev) => {
        // Special case overrides
        if (settings.clusterThreshold >= 5.0) return true;
        if (settings.clusterThreshold <= 0.0) return false;

        // Normal zoom-based hysteresis
        if (!prev && currentZoom < CLUSTER_ENTER_ZOOM) return true;
        if (prev && currentZoom > CLUSTER_EXIT_ZOOM) return false;
        return prev; // in dead-zone → keep current state
      });
    }, CLUSTER_DEBOUNCE_MS);

    return () => {
      if (clusterTimerRef.current) clearTimeout(clusterTimerRef.current);
    };
  }, [currentZoom, settings.clusterThreshold, CLUSTER_ENTER_ZOOM, CLUSTER_EXIT_ZOOM]);

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

  // ── Compute visible nodes/links ─────────────────────────────────────
  const { visibleNodes, nodeLinks } = useMemo(() => {
    const vis = nodes.filter((n) => {
      if (selectedGroupFilters.length === 0) return true;
      const gs = n.groups ?? n.metadata?.groups ?? [];
      return selectedGroupFilters.some(g => gs.includes(g));
    });
    const visIds = new Set(vis.map((n) => n.id));

    const nl = links.filter((l) => {
      if (!visIds.has(l.fromId) || !visIds.has(l.toId)) return false;
      if (selectedGroupFilters.length === 0) return true;
      if (l.metadata?.source !== "inferred") return true;
      const linkGroup = l.metadata?.group;
      if (!linkGroup) return true;
      return !selectedGroupFilters.includes(linkGroup);
    });

    return { visibleNodes: vis, nodeLinks: nl };
  }, [nodes, links, selectedGroupFilters]);

  // ── Build graph data (cluster or normal) ───────────────────────────
  const graphData = useMemo(() => {
    // Build group membership
    const groupMembers = new Map<string, Set<string>>();
    visibleNodes.forEach(n => {
      const gs = n.groups ?? n.metadata?.groups ?? [];
      gs.forEach((g: string) => {
        if (!groupMembers.has(g)) groupMembers.set(g, new Set());
        groupMembers.get(g)!.add(n.id);
      });
    });

    const clusterGroups = new Map<string, Set<string>>();
    groupMembers.forEach((members, g) => {
      if (members.size >= CLUSTER_MIN_SIZE) clusterGroups.set(g, members);
    });

    const nodeToCluster = new Map<string, string>();
    if (isClusterMode) {
      visibleNodes.forEach(n => {
        const gs = n.groups ?? n.metadata?.groups ?? [];
        for (const g of gs) {
          if (clusterGroups.has(g)) {
            nodeToCluster.set(n.id, g);
            break;
          }
        }
      });
    }

    if (isClusterMode && clusterGroups.size > 0) {
      const clusterNodesArr: any[] = [];
      const soloNodesArr: any[] = [];

      clusterGroups.forEach((members, g) => {
        const clusterId = `cluster:${g}`;
        const gType = classifyGroupType(g);
        clusterNodesArr.push({
          id: clusterId,
          name: g,
          group: g,
          isCluster: true,
          clusterSize: members.size,
          clusterType: gType,
          strengthScore: 50,
        });
      });

      visibleNodes.forEach(n => {
        if (!nodeToCluster.has(n.id)) {
          soloNodesArr.push({
            id: n.id,
            name: n.name,
            groups: n.groups ?? n.metadata?.groups ?? [],
            group: (n.groups && n.groups.length > 0) ? n.groups[0] : "default",
            strengthScore: n.strengthScore || 0,
            isCluster: false,
          });
        }
      });

      const interLinkSet = new Set<string>();
      const clusterLinksArr: any[] = [];

      nodeLinks.forEach(l => {
        const fromCluster = nodeToCluster.get(l.fromId);
        const toCluster = nodeToCluster.get(l.toId);
        const srcId = fromCluster ? `cluster:${fromCluster}` : l.fromId;
        const tgtId = toCluster ? `cluster:${toCluster}` : l.toId;

        if (srcId === tgtId) return;

        const [a, b] = [srcId, tgtId].sort();
        const key = `${a}|${b}`;
        if (interLinkSet.has(key)) return;
        interLinkSet.add(key);

        clusterLinksArr.push({
          source: srcId,
          target: tgtId,
          id: `cl-${key}`,
          label: undefined,
          metadata: undefined,
        });
      });

      return {
        nodes: [...clusterNodesArr, ...soloNodesArr],
        links: clusterLinksArr,
      };
    }

    return {
      nodes: visibleNodes.map((n) => ({
        id: n.id,
        name: n.name,
        groups: n.groups ?? n.metadata?.groups ?? [],
        group: (n.groups && n.groups.length > 0) ? n.groups[0] : "default",
        strengthScore: n.strengthScore || 0,
        isCluster: false,
      })),
      links: nodeLinks.map((l) => ({
        source: l.fromId,
        target: l.toId,
        label: l.label,
        metadata: l.metadata,
        id: l.id,
      })),
    };
  }, [visibleNodes, nodeLinks, isClusterMode]);

  // ── Create / rebuild ForceGraph when core deps change ──────────────
  // (NOT triggered by isClusterMode — that uses data-swap below)
  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;

    // Curvature helper for multi-links
    const pairMap = new Map<string, string[]>();
    nodeLinks.forEach(l => {
      const [a, b] = [l.fromId, l.toId].sort();
      const key = `${a}:${b}`;
      if (!pairMap.has(key)) pairMap.set(key, []);
      pairMap.get(key)?.push(l.id);
    });

    const getCurvature = (link: any) => {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;
      const [id1, id2] = [sId, tId].sort();
      const key = `${id1}:${id2}`;
      const siblings = pairMap.get(key) || [];
      const index = siblings.indexOf(link.id);
      const count = siblings.length;
      if (count <= 1) return 0;
      return (index - (count - 1) / 2) * 0.2;
    };

    let myGraph: any;
    import("force-graph").then(({ default: ForceGraph }) => {
      myGraph = new ForceGraph(el)
        .nodeAutoColorBy("group")
        .linkColor(() => resolvedTheme === "dark" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.2)")
        .linkLineDash((link: any) => link.metadata?.source === "inferred" ? [4, 4] : [])
        .linkCurvature((link: any) => getCurvature(link))
        .nodeVal((node: any) => {
          if (node.isCluster) return Math.max(15, Math.min(node.clusterSize * 3, 50));
          return Math.max(3, Math.min((node.strengthScore || 0) / 4, 15));
        })
        .nodeCanvasObject((node: any, ctx) => {
          if (node.isCluster) {
            const memberCount = node.clusterSize || 3;
            const baseRadius = 8 + memberCount * 1.5;
            const radius = Math.min(baseRadius, 40);
            const typeColor = GROUP_TYPE_COLORS[node.clusterType as GroupType] || "#71717a";

            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.strokeStyle = typeColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.fillStyle = typeColor + "22";
            ctx.fill();

            const dotCount = Math.min(memberCount, 12);
            const dotRadius = 2;
            for (let i = 0; i < dotCount; i++) {
              const angle = (2 * Math.PI * i) / dotCount - Math.PI / 2;
              const dx = node.x + (radius - 5) * Math.cos(angle);
              const dy = node.y + (radius - 5) * Math.sin(angle);
              ctx.beginPath();
              ctx.arc(dx, dy, dotRadius, 0, 2 * Math.PI, false);
              ctx.fillStyle = typeColor;
              ctx.fill();
            }

            const fontSize = Math.max(4, Math.min(radius / 3, 8));
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.fillStyle = resolvedTheme === "dark" ? "#fff" : "#111";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(node.name, node.x, node.y);

            const countFontSize = fontSize * 0.7;
            ctx.font = `${countFontSize}px Sans-Serif`;
            ctx.fillStyle = resolvedTheme === "dark" ? "#aaa" : "#666";
            ctx.fillText(`${memberCount} contacts`, node.x, node.y + fontSize + 2);
            return;
          }

          const score = node.strengthScore || 0;
          const size = 3 + (score / 100) * 12;
          const isHighlighted = highlightNodes.has(node.id);

          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.color || "#ccc";
          ctx.fill();

          if (isHighlighted) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI, false);
            ctx.strokeStyle = "#facc15";
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          if (showDueNodes && dueNodeIds.has(node.id)) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI, false);
            ctx.strokeStyle = "#ff4444";
            ctx.lineWidth = 2;
            ctx.setLineDash([2, 1]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          const label = node.name;
          const fontSize = 3.5;
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.fillStyle = isHighlighted ? (resolvedTheme === "dark" ? "#fff" : "#000") : (resolvedTheme === "dark" ? "#aaa" : "#666");
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, node.x, node.y + size + fontSize);
        })
        .linkCanvasObjectMode(() => "after")
        .linkCanvasObject((link: any, ctx) => {
          return;
        })
        .enablePanInteraction(true)
        .enableZoomInteraction(true)
        .onZoom((zoomParams: { k: number, x: number, y: number }) => {
          setCurrentZoom(zoomParams.k);
        })
        .onZoomEnd((zoomParams: { k: number, x: number, y: number }) => {
          setCurrentZoom(zoomParams.k);
        })
        .onNodeClick((node: any) => {
          if (node.isCluster) {
            myGraph.centerAt(node.x, node.y, 1000);
            myGraph.zoom(CLUSTER_EXIT_ZOOM + 0.5, 1500);
            return;
          }
          myGraph.centerAt(node.x, node.y, 1000);
          myGraph.zoom(8, 2000);
          const originalNode = nodes.find((n) => n.id === node.id);
          setSelectedNode(originalNode || null);
        })
        .onLinkClick((link: any) => {
          if (link.id?.startsWith('cl-')) return;
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
  }, [nodes, links, selectedGroupFilters, highlightNodes, showDueNodes, dueNodeIds, resolvedTheme]);

  // ── Swap graph data in-place when cluster mode changes ─────────────
  // This avoids destroying/rebuilding the ForceGraph (which resets zoom).
  useEffect(() => {
    const instance = graphInstanceRef.current;
    if (!instance) return;
    instance.graphData(graphData as any);
  }, [isClusterMode, graphData]);

  // if groups change and any active filter no longer exists, clean up
  useEffect(() => {
    const valid = selectedGroupFilters.filter(g => groups.includes(g));
    if (valid.length !== selectedGroupFilters.length) {
      setSelectedGroupFilters(valid);
    }
  }, [groups, selectedGroupFilters]);

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

      // Update selected node with freshest data
      if (selectedNode?.id === id) {
        // After loadData(), derive from the fresh nodes state rather than stale PATCH response
        setSelectedNode(prev => {
          // Use a functional update: we'll read freshest from the nodes set by loadData
          return updatedData; // fallback to PATCH response; loadData's setNodes will trigger connectedNeighbors recalc via useMemo
        });
        // Re-fetch the individual contact to get the absolute freshest data (including links)
        try {
          const freshRes = await fetch(`/api/contacts/${id}`);
          if (freshRes.ok) {
            const freshData = await freshRes.json();
            setSelectedNode(freshData);
            setNodes(prev => prev.map(n => n.id === id ? freshData : n));
          }
        } catch { /* fallback to updatedData already set */ }
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
    return links.some(l => l.fromId === fromId && l.toId === toId);
  }, [fromId, toId, links]);

  const isLinkInvalid = fromId === "" || toId === "" || isSelfLink || isDuplicateLink;

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    if (!graphInstanceRef.current) return;
    const newZoom = currentZoom * 1.5;
    graphInstanceRef.current.zoom(newZoom, 400); // 400ms transition
    setCurrentZoom(newZoom);
  }, [currentZoom]);

  const handleZoomOut = useCallback(() => {
    if (!graphInstanceRef.current) return;
    const newZoom = currentZoom / 1.5;
    graphInstanceRef.current.zoom(newZoom, 400);
    setCurrentZoom(newZoom);
  }, [currentZoom]);

  const handleResetZoom = useCallback(() => {
    if (!graphInstanceRef.current) return;
    graphInstanceRef.current.zoomToFit(400);
    // After zooming to fit, let's optionally reset to a specific zoom and center
    setTimeout(() => {
      // If no nodes, just zoom out
      if (nodes.length === 0) {
        graphInstanceRef.current.zoom(DEFAULT_ZOOM, 400);
      }
    }, 450);
  }, [nodes.length]);

  const handleSetZoom = useCallback((zoomLevel: number) => {
    if (!graphInstanceRef.current) return;
    graphInstanceRef.current.zoom(zoomLevel, 400);
    setCurrentZoom(zoomLevel);
  }, []);

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden bg-zinc-50 dark:bg-black font-sans">
      {/* Left Sidebar */}
      {!isFullscreen && (
        <aside id="tour-sidebar" className="w-80 border-r bg-background p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
          <div className="flex items-center gap-2">
            <div className="size-8 bg-primary rounded-lg"></div>
            <h1 className="font-bold text-xl tracking-tight">Network+</h1>
          </div>

          <DueSoonList contacts={dueContacts} onSelect={(contact) => {
            const targetNode = nodes.find(n => n.id === contact.id);
            if (targetNode) {
              setSelectedNode(targetNode);

              const instance = graphInstanceRef.current;
              if (instance) {
                const internalNode = instance.graphData().nodes.find((n: any) => n.id === targetNode.id);
                if (internalNode) {
                  instance.centerAt(internalNode.x, internalNode.y, 1000);
                  instance.zoom(6, 2000);
                }
              }

              const neighborIds = new Set<string>();
              neighborIds.add(targetNode.id);
              setHighlightNodes(neighborIds);
              setTimeout(() => {
                setHighlightNodes(new Set());
              }, 3000);
            } else {
              console.warn("No matching node found for contact:", contact.name);
            }
          }} />
        </aside >
      )}

      {/* Main Content - Graph */}
      < main className="flex-1 relative overflow-hidden flex flex-col" >
        <div id="graph" ref={graphRef} className="flex-1 w-full h-full bg-zinc-100 dark:bg-zinc-900/50"></div>
        <GraphZoomControls
          currentZoom={currentZoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onSetZoom={handleSetZoom}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(f => !f)}
        />
        <GraphLegendPanel
          nodes={nodes}
          groups={groups}
          selectedGroupFilters={selectedGroupFilters}
          onGroupFiltersChange={setSelectedGroupFilters}
          onFocusNode={focusNode}
        />
        {
          error && (
            <div className="absolute top-4 left-4 right-4 bg-destructive/10 text-destructive p-3 rounded-md border border-destructive/20 text-sm">
              {error}
            </div>
          )
        }
      </main >

      {/* Right Sidebar - Tools */}
      {!isFullscreen && (
        < aside className="w-80 border-l bg-background p-6 flex flex-col gap-6 shrink-0 h-[calc(100vh-57px)] sticky top-0 overflow-y-auto" >
          <h2 className="font-semibold text-lg">Tools</h2>

          <Card id="tour-add-contact">
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
            <CardContent className="flex flex-col gap-2">
              <div id="tour-import-contacts">
                <ContactImportModal onSuccess={() => {
                  loadData();
                }} />
              </div>
              <div id="tour-import-messages">
                <LinkedInImportModal onSuccess={() => {
                  loadData();
                }} />
              </div>
              <BulkEditModal
                contacts={nodes}
                allGroups={groups}
                initialGroupFilter={selectedGroupFilters}
                onSuccess={() => {
                  loadData();
                }}
              />
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
      )}


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