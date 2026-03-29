"use client";
import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

import { DueSoonList } from "@/components/DueSoonList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GraphZoomControls } from "@/components/graph-zoom-controls";
import { GraphLegendPanel } from "@/components/graph-legend-panel";

const ContactImportModal = dynamic(() => import("@/components/contact-import-modal").then(m => ({ default: m.ContactImportModal })), { ssr: false });
const LinkedInImportModal = dynamic(() => import("@/components/linkedin-import-modal").then(m => ({ default: m.LinkedInImportModal })), { ssr: false });
const BulkEditModal = dynamic(() => import("@/components/bulk-edit-modal").then(m => ({ default: m.BulkEditModal })), { ssr: false });
const ContactDetailSheet = dynamic(() => import("@/components/contact-detail-sheet").then(m => ({ default: m.ContactDetailSheet })), { ssr: false });
const EditLinkDialog = dynamic(() => import("@/components/edit-link-dialog").then(m => ({ default: m.EditLinkDialog })), { ssr: false });
const AddContactModal = dynamic(() => import("@/components/add-contact-modal").then(m => ({ default: m.AddContactModal })), { ssr: false });
const AddLinkModal = dynamic(() => import("@/components/add-link-modal").then(m => ({ default: m.AddLinkModal })), { ssr: false });
const ReachOutModal = dynamic(() => import("@/components/reach-out-modal").then(m => ({ default: m.ReachOutModal })), { ssr: false });
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "next-themes";
import { classifyGroupType, classifyGroupTypeWithOverrides, GROUP_TYPE_COLORS, type GroupType } from "@/lib/group-type-classifier";
import { updateGroupTypeOverrides as saveGroupTypeOverrides, getGroupTypeOverrides } from "@/app/settings/actions";
import { useGraphSettings, type GraphSettings } from "@/hooks/use-graph-settings";
import { ListTodo, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactProfile } from "@/lib/contact-profile";

type NodeMetadata = { groups?: string[];[key: string]: any };

const INFERRED_AFFINITY_RULES = new Set([
  "shared_group",
  "shared_current_company",
  "shared_current_school",
  "shared_prior_company",
  "shared_prior_school",
]);

type Contact = {
  id: string;
  name: string;
  description?: string;
  groups?: string[];
  profile?: ContactProfile | null;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  commonPlatform?: string | null;
  metadata?: NodeMetadata;
  lastInteractionAt?: string;
  interactions?: { date: string }[];
  strengthScore?: number;
  monthsKnown?: number;
  estimatedFrequencyCount?: number | null;
  estimatedFrequencyCadence?: string | null;
  estimatedFrequencyPlatform?: string | null;
  estimatedFrequencyIsAuto?: boolean;
};

type NodeType = Contact; // Alias for graph compatibility if needed, or just use Contact


// type NodeType = { id: string; title: string; description?: string; group?: string | null; metadata?: NodeMetadata };
type LinkType = { id: string; fromId: string; toId: string; label?: string; metadata?: any };

const GRAPH_VIEW_STORAGE_KEY = "networkplus-graph-view";

export default function Home() {
  const { resolvedTheme } = useTheme();
  const graphRef = useRef<HTMLDivElement | null>(null);
  const graphInstanceRef = useRef<any>(null);
  const asyncCleanupRef = useRef<(() => void) | null>(null);
  const graphDataRef = useRef<{ nodes: unknown[]; links: unknown[] }>({ nodes: [], links: [] });
  const nodeLinksRef = useRef<LinkType[]>([]);
  const [nodes, setNodes] = useState<NodeType[]>([]);
  const [links, setLinks] = useState<LinkType[]>([]);

  const [selectedGroupFilters, setSelectedGroupFilters] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeType | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [showDueNodes, setShowDueNodes] = useState(false);
  const [dueNodeIds, setDueNodeIds] = useState<Set<string>>(new Set());
  const [dueContacts, setDueContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<{ id: string; label?: string; fromName?: string; toName?: string } | null>(null);
  const [reachOutContact, setReachOutContact] = useState<Contact | null>(null);
  const [reachOutPreselectedIds, setReachOutPreselectedIds] = useState<string[] | null>(null);
  const [reachOutInitialTab, setReachOutInitialTab] = useState<"message" | "email" | "meeting" | "other" | null>(null);
  const [groupTypeOverrides, setGroupTypeOverrides] = useState<Record<string, GroupType> | null>(null);
  const [userGroups, setUserGroups] = useState<string[]>([]);

  // Zoom Controls
  const [currentZoom, setCurrentZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const DEFAULT_ZOOM = 1;

  // Overlay mode: fullscreen OR small/cramped screen — show Catch up + Tools as overlay buttons
  // Default true so mobile gets overlay UI on first paint before matchMedia runs
  const [isSmallScreen, setIsSmallScreen] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handle = () => setIsSmallScreen(mq.matches);
    handle();
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);
  const overlayMode = isFullscreen || isSmallScreen;

  // Graph Settings
  const { settings } = useGraphSettings();
  const settingsRef = useRef<GraphSettings>(settings);
  const highlightNodesRef = useRef<Set<string>>(new Set());
  const showDueNodesRef = useRef(false);
  const dueNodeIdsRef = useRef<Set<string>>(new Set());
  const resolvedThemeRef = useRef<string | undefined>(undefined);
  const nodesRef = useRef<NodeType[]>([]);
  const CLUSTER_ENTER_ZOOM = settings.clusterThreshold;  // collapse groups when zoomed out to here
  const CLUSTER_EXIT_ZOOM = settings.clusterThreshold + 1.0;   // expand groups only when zoomed in to here (added hysteresis gap)
  const CLUSTER_MIN_SIZE = 3;      // min group members to form a cluster
  const CLUSTER_DEBOUNCE_MS = 400;
  const spacingRatio = Math.min(1, Math.max(0, (settings.contactSpacing ?? 50) / 100));
  const chargeStrength = -86 - (60 * spacingRatio);
  const sharedGroupLinkDistance = 67 + (60 * spacingRatio);
  const defaultLinkDistance = 52 + (30 * spacingRatio);
  const sharedGroupLinkStrength = Math.max(0.008, 0.058 - (0.05 * spacingRatio));
  const defaultLinkStrength = Math.max(0.02, 0.105 - (0.06 * spacingRatio));

  const [isClusterMode, setIsClusterMode] = useState(false);
  const clusterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimization refs
  const lastUpdateRef = useRef<number>(0);
  const saveViewStateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // Fetch user groups
      fetch("/api/user/profile")
        .then(res => res.ok ? res.json() : {})
        .then((data: any) => setUserGroups(data.groups || []))
        .catch(err => console.error("Failed to fetch user groups:", err));

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
    getGroupTypeOverrides().then(o => setGroupTypeOverrides(o as Record<string, GroupType>));
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
      // Do not cluster groups that are currently used as filters;
      // when a user is focusing on a group, they should see individual contacts.
      if (selectedGroupFilters.includes(g)) return;
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
        const gType = classifyGroupTypeWithOverrides(g, groupTypeOverrides);
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
      links: nodeLinks.map((l) => {
        const rule = (l.metadata as any)?.rule;
        const linkGroupLabel = (l.metadata as any)?.group;
        const effectiveLabel =
          typeof rule === "string" &&
          INFERRED_AFFINITY_RULES.has(rule) &&
          typeof linkGroupLabel === "string"
            ? linkGroupLabel
            : (l.label ?? "");
        return {
          source: l.fromId,
          target: l.toId,
          label: effectiveLabel,
          metadata: l.metadata,
          id: l.id,
        };
      }),
    };
  }, [visibleNodes, nodeLinks, isClusterMode, selectedGroupFilters, groupTypeOverrides]);

  useLayoutEffect(() => {
    settingsRef.current = settings;
    highlightNodesRef.current = highlightNodes;
    showDueNodesRef.current = showDueNodes;
    dueNodeIdsRef.current = dueNodeIds;
    resolvedThemeRef.current = resolvedTheme;
    nodesRef.current = nodes;
    graphDataRef.current = graphData;
    nodeLinksRef.current = nodeLinks;
  }, [settings, highlightNodes, showDueNodes, dueNodeIds, resolvedTheme, nodes, graphData, nodeLinks]);

  const saveViewState = useCallback((k: number, x: number, y: number) => {
    if (saveViewStateTimeoutRef.current) clearTimeout(saveViewStateTimeoutRef.current);

    saveViewStateTimeoutRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(GRAPH_VIEW_STORAGE_KEY, JSON.stringify({ k, x, y }));
      } catch {
        /* ignore quota / private mode */
      }
    }, 250); // Debounce to prevent high-frequency blocking I/O
  }, []);

  // ── Create / rebuild ForceGraph only when structure or force params change ─
  // Data, highlights, and theme update via graphData + graphStyle effects; refs keep canvas callbacks current.
  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;

    let cachedPairMap: Map<string, string[]> | null = null;
    let cachedPairMapVersion = -1;

    const getCurvature = (link: any) => {
      const currentLinks = nodeLinksRef.current;
      if (!cachedPairMap || cachedPairMapVersion !== currentLinks.length) {
        cachedPairMap = new Map<string, string[]>();
        for (const l of currentLinks) {
          const [a, b] = [l.fromId, l.toId].sort();
          const key = `${a}:${b}`;
          if (!cachedPairMap.has(key)) cachedPairMap.set(key, []);
          cachedPairMap.get(key)!.push(l.id);
        }
        cachedPairMapVersion = currentLinks.length;
      }
      const sId = typeof link.source === "object" ? link.source.id : link.source;
      const tId = typeof link.target === "object" ? link.target.id : link.target;
      const [id1, id2] = [sId, tId].sort();
      const key = `${id1}:${id2}`;
      const siblings = cachedPairMap.get(key) || [];
      const index = siblings.indexOf(link.id);
      const count = siblings.length;
      if (count <= 1) return 0;
      return (index - (count - 1) / 2) * 0.2;
    };

    let myGraph: any;
    import("force-graph").then(({ default: ForceGraph }) => {
      myGraph = new ForceGraph(el)
        .nodeAutoColorBy("group")
        .linkColor(() =>
          resolvedThemeRef.current === "dark" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.2)"
        )
        .linkLineDash((link: any) => (link.metadata?.source === "inferred" ? [4, 4] : []))
        .linkCurvature((link: any) => getCurvature(link))
        .nodeVal((node: any) => {
          if (node.isCluster) return Math.max(15, Math.min(node.clusterSize * 3, 50));
          const s = settingsRef.current;
          if (s.sizeNodesByStrength === false) return 8;
          return Math.max(3, Math.min((node.strengthScore || 0) / 4, 15));
        })
        .nodeCanvasObject((node: any, ctx) => {
          const themeDark = resolvedThemeRef.current === "dark";
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
            ctx.fillStyle = themeDark ? "#fff" : "#111";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(node.name, node.x, node.y);

            const countFontSize = fontSize * 0.7;
            ctx.font = `${countFontSize}px Sans-Serif`;
            ctx.fillStyle = themeDark ? "#aaa" : "#666";
            ctx.fillText(`${memberCount} contacts`, node.x, node.y + fontSize + 2);
            return;
          }

          const score = node.strengthScore || 0;
          const s = settingsRef.current;
          const size =
            s.sizeNodesByStrength === false ? 6.5 : 3 + (score / 100) * 12;
          const isHighlighted = highlightNodesRef.current.has(node.id);

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

          if (showDueNodesRef.current && dueNodeIdsRef.current.has(node.id)) {
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
          ctx.fillStyle = isHighlighted
            ? themeDark
              ? "#fff"
              : "#000"
            : themeDark
              ? "#aaa"
              : "#666";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, node.x, node.y + size + fontSize);
        })
        .linkCanvasObjectMode(() => "after")
        .linkCanvasObject(() => {
          return;
        })
        .enablePanInteraction(true)
        .enableZoomInteraction(true)
        .onZoom((zoomParams: { k: number; x: number; y: number }) => {
          const now = Date.now();
          // Throttle state updates to ~20FPS while zooming to reduce React overhead
          if (now - lastUpdateRef.current > 50) {
            setCurrentZoom(zoomParams.k);
            lastUpdateRef.current = now;
          }
          saveViewState(zoomParams.k, zoomParams.x, zoomParams.y);
        })
        .onZoomEnd((zoomParams: { k: number; x: number; y: number }) => {
          setCurrentZoom(zoomParams.k); // Ensure final zoom is always accurate
          saveViewState(zoomParams.k, zoomParams.x, zoomParams.y);
        })
        .onNodeClick((node: any) => {
          const clusterExit = settingsRef.current.clusterThreshold + 1.0;
          if (node.isCluster) {
            myGraph.centerAt(node.x, node.y, 1000);
            myGraph.zoom(clusterExit + 0.5, 1500);
            return;
          }
          myGraph.centerAt(node.x, node.y, 1000);
          myGraph.zoom(8, 2000);
          const originalNode = nodesRef.current.find((n) => n.id === node.id);
          setSelectedNode(originalNode || null);
        })
        .onLinkClick((link: any) => {
          if (link.id?.startsWith("cl-")) return;
          const fromName = link.source.name || link.source.id;
          const toName = link.target.name || link.target.id;
          setSelectedLink({ id: link.id, label: link.label, fromName, toName });
        })
        .graphData(graphDataRef.current as any);

      // Contact spacing is controlled from Graph Settings via a single slider.
      const chargeForce = myGraph.d3Force("charge");
      if (chargeForce && typeof chargeForce.strength === "function") {
        chargeForce.strength(chargeStrength);
      }
      const linkForce = myGraph.d3Force("link");
      if (linkForce) {
        if (typeof linkForce.distance === "function") {
          linkForce.distance((link: any) =>
            link?.metadata?.rule &&
            INFERRED_AFFINITY_RULES.has(String(link.metadata.rule))
              ? sharedGroupLinkDistance
              : defaultLinkDistance
          );
        }
        if (typeof linkForce.strength === "function") {
          linkForce.strength((link: any) =>
            link?.metadata?.rule &&
            INFERRED_AFFINITY_RULES.has(String(link.metadata.rule))
              ? sharedGroupLinkStrength
              : defaultLinkStrength
          );
        }
      }
      myGraph.d3ReheatSimulation();

      graphInstanceRef.current = myGraph;

      const applySavedView = () => {
        try {
          const raw = sessionStorage.getItem(GRAPH_VIEW_STORAGE_KEY);
          if (!raw) return;
          const parsed = JSON.parse(raw) as { k?: number; x?: number; y?: number };
          const { k, x, y } = parsed;
          if (
            typeof k === "number" &&
            Number.isFinite(k) &&
            typeof x === "number" &&
            Number.isFinite(x) &&
            typeof y === "number" &&
            Number.isFinite(y)
          ) {
            myGraph.zoom(k, 0);
            myGraph.centerAt(x, y, 0);
            setCurrentZoom(k);
          }
        } catch {
          /* ignore */
        }
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(applySavedView);
      });

      // Resize graph when container size changes (e.g. mobile layout, orientation, window resize)
      const resizeObserver = new ResizeObserver(() => {
        if (!el || !myGraph) return;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        if (w > 0 && h > 0) {
          myGraph.width(w).height(h);
        }
      });
      resizeObserver.observe(el);

      asyncCleanupRef.current = () => {
        resizeObserver.disconnect();
        if (saveViewStateTimeoutRef.current) clearTimeout(saveViewStateTimeoutRef.current);
        try {
          if (myGraph) myGraph.graphData({ nodes: [], links: [] });
        } catch {
          // ignore
        }
        graphInstanceRef.current = null;
      };
    });

    return () => {
      if (asyncCleanupRef.current) {
        asyncCleanupRef.current();
        asyncCleanupRef.current = null;
      }
      graphInstanceRef.current = null;
    };
    // Intentionally omit nodes/links/theme/highlights/selectedGroupFilters:
    // graphData + graphStyle effects update those without a full rebuild.
  }, [
    saveViewState,
    chargeStrength,
    sharedGroupLinkDistance,
    defaultLinkDistance,
    sharedGroupLinkStrength,
    defaultLinkStrength,
  ]);

  // ── Push graph data in-place (preserves zoom/pan) ───────────────────
  useEffect(() => {
    const instance = graphInstanceRef.current;
    if (!instance) return;
    instance.graphData(graphData as any);
  }, [graphData]);

  // ── Re-apply accessors so canvas repaints when theme, highlights, or node sizing change ─
  useEffect(() => {
    const instance = graphInstanceRef.current;
    if (!instance) return;
    const dark = resolvedTheme === "dark";
    instance.linkColor(() => (dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.2)"));
    instance.nodeVal((node: any) => {
      if (node.isCluster) return Math.max(15, Math.min(node.clusterSize * 3, 50));
      if (settings.sizeNodesByStrength === false) return 8;
      return Math.max(3, Math.min((node.strengthScore || 0) / 4, 15));
    });
  }, [resolvedTheme, highlightNodes, showDueNodes, dueNodeIds, settings.sizeNodesByStrength]);

  // Handle selected groups cleanup
  useEffect(() => {
    const valid = selectedGroupFilters.filter(g => groups.includes(g));
    if (valid.length !== selectedGroupFilters.length) {
      setSelectedGroupFilters(valid);
    }
  }, [groups, selectedGroupFilters]);

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
          // Only update selection if this contact is still open (avoid stale closure after close/switch)
          setSelectedNode((prev) => (prev?.id === id ? updatedNode : prev));
        }
      } catch (e) {
        console.error(`Failed to refresh contact ${id}:`, e);
      }
    }));
  }

  async function updateNode(id: string, updates: Partial<NodeType>) {
    const targetNode = nodes.find(n => n.id === id);
    if (!targetNode) return;

    let updatedProfile = targetNode.profile;
    if (updates.profile && typeof updates.profile === "object") {
      updatedProfile = { ...(targetNode.profile || {}), ...updates.profile } as ContactProfile;
    }
    const updatedNode = { ...targetNode, ...updates, profile: updatedProfile };

    setNodes(prev => prev.map(n => n.id === id ? updatedNode : n));
    setSelectedNode((prev) => (prev?.id === id ? updatedNode : prev));

    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        let detail = `Update failed (${res.status})`;
        try {
          const errBody = await res.json();
          if (errBody && typeof errBody.error === "string") {
            detail = errBody.error;
          }
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }

      const updatedData = await res.json();

      // Update local state with the actual server response (includes merged profile)
      setNodes(prev => prev.map(n => n.id === id ? updatedData : n));
      setSelectedNode((prev) => (prev?.id === id ? updatedData : prev));

      // Only re-fetch links when groups/profile change (inference may create new links)
      if (updates.groups || updates.profile) {
        fetch("/api/links", { credentials: "include" })
          .then(res => res.ok ? res.json() : [])
          .then(data => setLinks(Array.isArray(data) ? data : []))
          .catch(err => console.error("Failed to refresh links:", err));
      }
    } catch (err: any) {
      console.error("Update node failed:", err);
      setNodes(prev => prev.map(n => n.id === id ? targetNode : n));
      setSelectedNode((prev) => (prev?.id === id ? targetNode : prev));
      setError(String(err?.message ?? err));
      throw err;
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
      const updated = await res.json();
      setLinks(prev => prev.map(l => l.id === id ? updated : l));
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
      setLinks((prev) => prev.filter((l) => l.id !== id));
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

  const dueSoonSelect = useCallback((contact: Contact) => {
    const targetNode = nodes.find(n => n.id === contact.id);
    if (targetNode) {
      setReachOutContact(targetNode);
    } else {
      setReachOutContact(contact as Contact);
    }
  }, [nodes]);

  const toolsContentBody = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 p-4 border border-border rounded-xl bg-card/50 shadow-sm">
        <h3 className="font-semibold text-sm px-1 flex items-center gap-2">Data Tools</h3>
        <div className="flex flex-col gap-2">
          <div id="tour-import-contacts">
            <ContactImportModal onSuccess={() => loadData()} />
          </div>
          <div id="tour-import-messages">
            <LinkedInImportModal onSuccess={() => loadData()} />
          </div>
          <BulkEditModal
            contacts={nodes}
            allGroups={groups}
            initialGroupFilter={selectedGroupFilters}
            onSuccess={() => loadData()}
            onOpenReachOutForLog={(ids) => {
              setReachOutPreselectedIds(ids);
              setReachOutInitialTab("other");
            }}
            groupTypeOverrides={groupTypeOverrides}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4 border rounded-xl bg-card/50 shadow-sm">
        <h3 className="font-semibold text-sm px-1 flex items-center gap-2">Management</h3>
        <div className="flex flex-col gap-2">
          <AddContactModal groups={groups} onSuccess={loadData} />
          <AddLinkModal nodes={nodes} links={links} onSuccess={loadData} />
        </div>
      </div>
      <div className="py-2">
        <h3 className="font-semibold text-sm mb-2">Recent Contacts</h3>
        <ul className="space-y-1">
          {nodes.slice(-5).reverse().map((n) => (
            <li
              key={n.id}
              className="text-xs text-muted-foreground truncate hover:text-foreground cursor-pointer"
              onClick={() => focusNode(n.id)}
            >
              {n.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const toolsContent = (
    <div className="flex flex-col gap-6 overflow-y-auto h-full">
      <h2 className="font-semibold text-lg">Tools</h2>
      {toolsContentBody}
    </div>
  );

  // Match zoom/legend: same glass on buttons; stronger blur on overlay panels so they match bottom FABs
  const overlayPanelGlass = "bg-background/70 backdrop-blur-xl border border-border/30 shadow-lg rounded-xl";
  const overlayButtonBase =
    "rounded-xl shadow-lg border hover:bg-accent/80 transition-all duration-300 flex items-center justify-center gap-2 text-foreground px-3 py-2.5 text-sm font-medium bg-background/60 backdrop-blur-xl";

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-zinc-50 dark:bg-black font-sans touch-none">
      {/* Fixed full-viewport graph layer: sits behind navbar; receives drag/pan when UI layer passes events through */}
      <div className="fixed inset-0 z-0 bg-zinc-100 dark:bg-zinc-900/50" aria-hidden>
        <div
          id="graph"
          ref={graphRef}
          className="h-full w-full touch-none"
        />
      </div>

      {/* UI layer: pointer-events-none so graph gets drag/pan; re-enable on sidebars and controls */}
      <div className="pointer-events-none relative z-10 flex h-full min-h-0 w-full overflow-hidden">
      {!overlayMode && (
        <aside id="tour-sidebar" className="pointer-events-auto hidden md:flex w-80 border-r border-border/30 bg-background/70 backdrop-blur-xl p-6 flex-col gap-6 shrink-0 overflow-y-auto">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Network+" className="size-8 rounded-lg" />
            <h1 className="font-bold text-xl tracking-tight">Network+</h1>
          </div>
          <DueSoonList contacts={dueContacts} onSelect={dueSoonSelect} />
        </aside>
      )}

      {/* Main: transparent over graph; pointer-events-none so drag/pan hits the graph layer */}
      <main className="pointer-events-none flex-1 relative overflow-hidden min-w-0 min-h-0">
        {overlayMode && (
          <div className="pointer-events-auto absolute top-0 left-0 right-0 z-20 flex items-start justify-between p-4 gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className={cn(overlayButtonBase)}
                    title="Contacts due for outreach"
                    aria-label="Open Catch up list"
                  >
                    <ListTodo className="size-5 shrink-0" />
                    <span>Catch up</span>
                  </button>
                </DialogTrigger>
                <DialogContent
                  className={cn("max-w-sm max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden", overlayPanelGlass)}
                  showCloseButton
                >
                  <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
                    <DialogTitle>Catch up</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto min-h-0 p-4">
                    <DueSoonList contacts={dueContacts} onSelect={dueSoonSelect} />
                  </div>
                </DialogContent>
              </Dialog>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(overlayButtonBase)}
                    title="Import, add contact, and more"
                    aria-label="Open Tools menu"
                  >
                    <Wrench className="size-5 shrink-0" />
                    <span>Tools</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  className={cn(
                    "w-[min(20rem,calc(100vw-2rem))] max-h-[min(70vh,28rem)] overflow-y-auto p-0",
                    overlayPanelGlass
                  )}
                >
                  <div className="p-3 border-b border-border/50">
                    <h3 className="font-semibold text-sm">Tools</h3>
                  </div>
                  <div className="p-3 overflow-y-auto">
                    {toolsContentBody}
                  </div>
                </PopoverContent>
              </Popover>
          </div>
        )}
        <GraphZoomControls
          className="pointer-events-auto"
          currentZoom={currentZoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onSetZoom={handleSetZoom}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(f => !f)}
        />
        <GraphLegendPanel
          className="pointer-events-auto"
          nodes={nodes}
          groups={groups}
          selectedGroupFilters={selectedGroupFilters}
          onGroupFiltersChange={setSelectedGroupFilters}
          onFocusNode={focusNode}
          groupTypeOverrides={groupTypeOverrides}
          onUpdateGroupTypeOverrides={async (overrides) => {
            setGroupTypeOverrides(overrides);
            await saveGroupTypeOverrides(overrides);
          }}
        />
        {
          error && (
            <div className="pointer-events-auto absolute top-4 left-4 right-4 z-20 p-3 rounded-xl text-sm text-destructive bg-destructive/10 backdrop-blur-lg border border-destructive/30 shadow-lg">
              {error}
            </div>
          )
        }
        <ReachOutModal 
          allContacts={nodes}
          initialContact={reachOutContact ?? (reachOutPreselectedIds?.[0] ? (nodes.find(n => n.id === reachOutPreselectedIds[0]) ?? null) : null)} 
          open={!!reachOutContact || !!(reachOutPreselectedIds && reachOutPreselectedIds.length > 0)} 
          onOpenChange={(open) => {
            if (!open) {
              setReachOutContact(null);
              setReachOutPreselectedIds(null);
              setReachOutInitialTab(null);
            }
          }} 
          onSuccess={handleInteractionLogged}
          initialPreselectedIds={reachOutPreselectedIds ?? undefined}
          initialTab={reachOutInitialTab ?? undefined}
        />
      </main>

      {!overlayMode && (
        <aside className="pointer-events-auto hidden md:flex w-80 border-l border-border/30 bg-background/70 backdrop-blur-xl p-6 flex-col gap-6 shrink-0 overflow-y-auto">
          {toolsContent}
        </aside>
      )}
      </div>

      <ContactDetailSheet
        open={!!selectedNode}
        onOpenChange={(open) => !open && setSelectedNode(null)}
        node={selectedNode}
        groups={groups}
        dueNodeIds={dueNodeIds}
        onLogInteraction={handleInteractionLogged}
        onOpenReachOutForLog={(ids) => {
          setReachOutPreselectedIds(ids);
          setReachOutInitialTab("other");
        }}
        onUpdateNode={updateNode}
        onFocusNode={focusNode}
        connectedNeighbors={connectedNeighbors}
        groupTypeOverrides={groupTypeOverrides}
        userGroups={userGroups}
      />

      <EditLinkDialog
        open={!!selectedLink}
        onOpenChange={(open) => !open && setSelectedLink(null)}
        link={selectedLink}
        onUpdate={updateLink}
        onDelete={deleteLink}
      />
    </div>
  );
}