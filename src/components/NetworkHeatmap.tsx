// NetworkHeatmap.tsx
// -----------------------------------------------------------------------------
// Canvas-based network of Expertise and Researchers.
//
// What’s new in this patch:
//   • PANNING is now **middle-mouse (wheel) click & drag** only.
//     - Left-click is reserved for node interactions (no clashes).
//     - Hover behaviors remain responsive while not panning.
//   • Keeps earlier upgrades: top-15 Expertise, concentric rings (exp & res),
//     toned-down size scaling, widened canvas and ring gaps, HiDPI rendering,
//     edge caps + idle RAF for performance, background panning, etc.
//
// Interaction model:
//   • Hover Expertise: soft focus preview (unchanged).
//   • Left-click Expertise: lock/unlock focus (unchanged).
//   • While focused: hover Researcher highlights their intra-focus links (fixed).
//   • Middle-click & drag anywhere on the canvas: pan the camera.
//   • Right-click is ignored; we also suppress the context menu for cleaner UX.
//
// Notes:
//   • Expertise “connectivity” ordering = (#researchers desc) then (sum of pairwise
//     overlaps desc). Most-connected sits at the center; others form rings outward.
//   • Researcher placement in focus uses degree within the focus subgraph (excluding
//     the focused expertise) → inner-to-outer rings.
//
// Performance highlights:
//   • HiDPI scaling without changing logical coordinates.
//   • O(E) edge rendering via id→node map.
//   • RAF auto-stops when idle.
//   • Caps on researcher↔researcher edges (global + per-node).
// -----------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

// Shared store + mocks (same usage as Results/SearchSection.tsx)
import { getAllResearchers, subscribe } from '../data/api';
import { mockResearchers } from '../data/mockData';

type DataSource = 'api' | 'mock';

interface NetworkHeatmapProps {
  searchQuery: string;
  filters: {
    yearRange: number[];
    tags: string[];
    researchArea: string;
  };
  dataSource?: DataSource;
}

type NodeType = 'expertise' | 'researcher';

interface Node {
  id: string;
  name: string;
  type: NodeType;

  x: number; y: number;           // current (world)
  targetX: number; targetY: number;
  baseX: number; baseY: number;   // layout home

  radius: number;
  color: string;

  connections: string[];
  connectionCount: number;

  visible: boolean;
  opacity: number;
  targetOpacity: number;

  isExpanded?: boolean;
}

type EdgeType = 'expertise-expertise' | 'expertise-researcher' | 'researcher-researcher';

interface Edge {
  from: string;
  to: string;
  strength: number;      // 0..1
  type: EdgeType;
  visible: boolean;
  opacity: number;
  targetOpacity: number;
}

interface Transform {
  x: number; y: number; scale: number;
  targetX: number; targetY: number; targetScale: number;
}

type Researcher = {
  id: string;
  name: string;
  expertise?: string[];
  publicationsCount?: number;
};

// ---------- Tunables & Constants ---------------------------------------------

const CANVAS_W = 1400;  // logical space
const CANVAS_H = 900;

const COLORS = {
  expertise: '#0891b2',   // teal-600
  researcher: '#0ea5e9',  // sky-500
  bg0: '#f0f9ff',
  bg1: '#e0f2fe',
};

const LERP = {
  nodePos: 0.15,
  nodeOpacity: 0.2,
  transform: 0.12,
};

const RENDER = {
  minTextScale: 0.35,
  minNodeOpacity: 0.01,
};

const EXP_RING0 = 260;
const EXP_RING_GAP = 220;
const RES_RING0 = 160;
const RES_RING_GAP = 110;

const MAX_FOCUS_RR_EDGES = 450;
const MAX_FOCUS_RR_DEGREE = 12;

// ---------- Utility -----------------------------------------------------------

function screenToWorld(
  sxLogical: number,
  syLogical: number,
  logicalW: number,
  logicalH: number,
  t: Transform
) {
  const cx = logicalW / 2;
  const cy = logicalH / 2;
  const x = (sxLogical - cx) / t.scale + (cx - (cx - t.x));
  const y = (syLogical - cy) / t.scale + (cy - (cy - t.y));
  return { x, y };
}

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx; const dy = ay - by;
  return dx * dx + dy * dy;
}

// toned-down size scaling
function expertiseRadius(count: number) { return Math.min(96, 38 + 6 * Math.sqrt(Math.max(0, count))); }
function researcherRadius(expertiseCount: number) { return 24 + Math.min(6, expertiseCount * 2); }

// ---------- Layout helpers ----------------------------------------------------

function circlePositions(count: number, center: { x: number; y: number }, radius: number, startAngle = -Math.PI / 2) {
  const out: { x: number; y: number; angle: number }[] = [];
  if (count <= 0) return out;
  const step = (2 * Math.PI) / count;
  for (let i = 0; i < count; i++) {
    const a = startAngle + i * step;
    out.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius, angle: a });
  }
  return out;
}

function layoutResearchersInRings(
  focus: Node,
  researcherNodes: Node[],
  degreeById: Map<string, number>,
  ring0 = RES_RING0,
  ringGap = RES_RING_GAP,
  ringCapacity = (ringIndex: number) => 8 + ringIndex * 6
) {
  const ordered = [...researcherNodes].sort((a, b) => {
    const da = degreeById.get(a.id) ?? 0;
    const db = degreeById.get(b.id) ?? 0;
    if (db !== da) return db - da;
    return (a.name || '').localeCompare(b.name || '');
  });

  const rings: Node[][] = [];
  let idx = 0;
  for (let ringIx = 0; idx < ordered.length; ringIx++) {
    const cap = ringCapacity(ringIx);
    rings.push(ordered.slice(idx, idx + cap));
    idx += cap;
  }

  const updated: Node[] = [];
  for (let r = 0; r < rings.length; r++) {
    const radius = ring0 + r * ringGap;
    const ring = rings[r];
    const pts = circlePositions(ring.length, { x: focus.baseX, y: focus.baseY }, radius, -Math.PI / 2);
    for (let i = 0; i < ring.length; i++) {
      const n = ring[i];
      const p = pts[i];
      updated.push({ ...n, targetX: p.x, targetY: p.y, targetOpacity: 1, visible: true });
    }
  }
  return updated;
}

function layoutExpertiseInRings(
  center: { x: number; y: number },
  nodes: Node[],
  ring0 = EXP_RING0,
  ringGap = EXP_RING_GAP,
  ringCapacity = (ringIndex: number) => 6 + ringIndex * 8
) {
  if (!nodes.length) return nodes;

  const placed: Node[] = [];

  const first = { ...nodes[0] };
  first.baseX = center.x; first.baseY = center.y;
  first.x = center.x; first.y = center.y;
  first.targetX = center.x; first.targetY = center.y;
  placed.push(first);

  const rest = nodes.slice(1);
  let idx = 0;
  for (let ringIx = 0; idx < rest.length; ringIx++) {
    const cap = ringCapacity(ringIx);
    const batch = rest.slice(idx, idx + cap);
    const radius = ring0 + ringIx * ringGap;
    const pts = circlePositions(batch.length, center, radius, -Math.PI / 2);
    for (let i = 0; i < batch.length; i++) {
      const n = { ...batch[i] };
      const p = pts[i];
      n.baseX = p.x; n.baseY = p.y;
      n.x = p.x; n.y = p.y;
      n.targetX = p.x; n.targetY = p.y;
      placed.push(n);
    }
    idx += cap;
  }
  return placed;
}

// ---------- Connectivity helpers ---------------------------------------------

function buildFocusAdjacency(focusExpertise: string, researcherList: Researcher[]) {
  const idByIndex = researcherList.map(r => r.id);
  const expertiseById = new Map<string, Set<string>>();
  for (const r of researcherList) {
    const set = new Set((r.expertise || []).filter(e => e && e !== focusExpertise));
    expertiseById.set(r.id, set);
  }

  const edges: [string, string, number][] = [];
  const degree = new Map<string, number>(idByIndex.map(id => [id, 0]));

  for (let i = 0; i < idByIndex.length; i++) {
    for (let j = i + 1; j < idByIndex.length; j++) {
      const a = idByIndex[i];
      const b = idByIndex[j];
      const ea = expertiseById.get(a)!;
      const eb = expertiseById.get(b)!;
      let overlap = 0;
      for (const e of ea) if (eb.has(e)) overlap++;
      if (overlap > 0) {
        const strength = Math.min(1, 0.3 + overlap * 0.35);
        edges.push([a, b, strength]);
        degree.set(a, (degree.get(a) || 0) + 1);
        degree.set(b, (degree.get(b) || 0) + 1);
      }
    }
  }
  return { edges, degree };
}

function capEdges(rrEdges: [string, string, number][], maxTotal: number, maxPerNode: number) {
  const out: [string, string, number][] = [];
  const deg = new Map<string, number>();
  const sorted = [...rrEdges].sort((a, b) => b[2] - a[2]);
  for (const [u, v, s] of sorted) {
    const du = deg.get(u) || 0;
    const dv = deg.get(v) || 0;
    if (du >= maxPerNode || dv >= maxPerNode) continue;
    out.push([u, v, s]);
    deg.set(u, du + 1);
    deg.set(v, dv + 1);
    if (out.length >= maxTotal) break;
  }
  return out;
}

function rankTopExpertise(expertiseToResearchers: Map<string, Set<string>>, topK: number) {
  const exps = Array.from(expertiseToResearchers.keys());
  const counts = new Map<string, number>();
  for (const e of exps) counts.set(e, expertiseToResearchers.get(e)?.size ?? 0);

  const sharedSum = new Map<string, number>(exps.map(e => [e, 0]));
  for (let i = 0; i < exps.length; i++) {
    for (let j = i + 1; j < exps.length; j++) {
      const a = exps[i], b = exps[j];
      const A = expertiseToResearchers.get(a) ?? new Set<string>();
      const B = expertiseToResearchers.get(b) ?? new Set<string>();
      let shared = 0;
      for (const id of A) if (B.has(id)) shared++;
      if (shared > 0) {
        sharedSum.set(a, (sharedSum.get(a) || 0) + shared);
        sharedSum.set(b, (sharedSum.get(b) || 0) + shared);
      }
    }
  }

  const ordered = exps.sort((a, b) => {
    const ca = counts.get(a) || 0;
    const cb = counts.get(b) || 0;
    if (cb !== ca) return cb - ca;
    const sa = sharedSum.get(a) || 0;
    const sb = sharedSum.get(b) || 0;
    if (sb !== sa) return sb - sa;
    return a.localeCompare(b);
  });

  return ordered.slice(0, topK);
}

// ---------- Component ---------------------------------------------------------

export default function NetworkHeatmap({ searchQuery, filters, dataSource = 'api' }: NetworkHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dprRef = useRef<number>(typeof window !== 'undefined' ? Math.max(1, Math.min(2.5, window.devicePixelRatio || 1)) : 1);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const [hoveredExpertise, setHoveredExpertise] = useState<string | null>(null);
  const [clickedExpertise, setClickedExpertise] = useState<string | null>(null);
  const [hoveredResearcher, setHoveredResearcher] = useState<string | null>(null);

  const [transform, setTransform] = useState<Transform>({
    x: 0, y: 0, scale: 1,
    targetX: 0, targetY: 0, targetScale: 1,
  });

  // middle-mouse panning state
  const isPanningRef = useRef(false);
  const lastPanRef = useRef<{ sx: number; sy: number } | null>(null);

  const ensureRAF = useCallback(() => { if (rafRef.current == null) rafRef.current = requestAnimationFrame(animate); }, []); // eslint-disable-line

  // ----- Data hookup -----
  const [storeResearchers, setStoreResearchers] = useState<Researcher[]>(getAllResearchers());
  useEffect(() => { const unsub = subscribe(() => setStoreResearchers(getAllResearchers())); return () => unsub(); }, []);
  const sourceResearchers: Researcher[] = useMemo(() => (dataSource === 'mock' ? (mockResearchers as any) : storeResearchers), [dataSource, storeResearchers]);

  const filteredResearchers: Researcher[] = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    return (sourceResearchers || []).filter(r => {
      const matchesQuery = !q || (r.name || '').toLowerCase().includes(q) || (r.expertise || []).some(e => (e || '').toLowerCase().includes(q));
      const matchesTags = (filters.tags?.length ?? 0) === 0 || filters.tags.some(tag => (r.expertise || []).some(exp => (exp || '').toLowerCase().includes((tag || '').toLowerCase())));
      return matchesQuery && matchesTags;
    });
  }, [sourceResearchers, searchQuery, filters.tags]);

  const expertiseToResearchers = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of filteredResearchers) for (const e of (r.expertise || [])) { if (!e) continue; if (!map.has(e)) map.set(e, new Set()); map.get(e)!.add(r.id); }
    return map;
  }, [filteredResearchers]);

  const topExpertiseIds = useMemo(() => rankTopExpertise(expertiseToResearchers, 15), [expertiseToResearchers]);

  const idToNode = useMemo(() => { const m = new Map<string, Node>(); for (const n of nodes) m.set(n.id, n); return m; }, [nodes]);

  // ----- Scene building -----
  const createOverviewScene = useCallback(() => {
    const center = { x: CANVAS_W / 2, y: CANVAS_H / 2 };

    const expNodesRaw: Node[] = topExpertiseIds.map((exp) => {
      const researcherCount = (expertiseToResearchers.get(exp)?.size ?? 0);
      return {
        id: exp, name: exp, type: 'expertise',
        x: center.x, y: center.y, targetX: center.x, targetY: center.y,
        baseX: center.x, baseY: center.y,
        radius: expertiseRadius(researcherCount),
        color: COLORS.expertise,
        connections: Array.from(expertiseToResearchers.get(exp) ?? []),
        connectionCount: researcherCount,
        visible: true, opacity: 1, targetOpacity: 1, isExpanded: false,
      };
    });

    const expNodes = layoutExpertiseInRings(center, expNodesRaw, EXP_RING0, EXP_RING_GAP, (r) => 6 + r * 8);

    const resNodes: Node[] = filteredResearchers.map((r) => {
      const exps = (r.expertise || []).filter(Boolean);
      return {
        id: r.id, name: r.name, type: 'researcher',
        x: center.x, y: center.y, targetX: center.x, targetY: center.y,
        baseX: center.x, baseY: center.y,
        radius: researcherRadius(exps.length),
        color: COLORS.researcher,
        connections: exps, connectionCount: exps.length,
        visible: false, opacity: 0, targetOpacity: 0,
      };
    });

    const expEdges: Edge[] = [];
    for (let i = 0; i < topExpertiseIds.length; i++) {
      for (let j = i + 1; j < topExpertiseIds.length; j++) {
        const a = topExpertiseIds[i], b = topExpertiseIds[j];
        const A = expertiseToResearchers.get(a) ?? new Set<string>();
        const B = expertiseToResearchers.get(b) ?? new Set<string>();
        let shared = 0; for (const id of A) if (B.has(id)) shared++;
        if (shared > 0) {
          expEdges.push({
            from: a, to: b, strength: Math.min(1, 0.2 + shared * 0.12),
            type: 'expertise-expertise', visible: true,
            opacity: 0.22 + Math.min(0.45, shared * 0.05),
            targetOpacity: 0.22 + Math.min(0.45, shared * 0.05),
          });
        }
      }
    }

    setNodes([...expNodes, ...resNodes]);
    setEdges(expEdges);

    setTransform({ x: 0, y: 0, scale: 1, targetX: 0, targetY: 0, targetScale: 1 });
    setHoveredExpertise(null);
    setClickedExpertise(null);
    setHoveredResearcher(null);

    ensureRAF();
  }, [topExpertiseIds, expertiseToResearchers, filteredResearchers, ensureRAF]);

  useEffect(() => { createOverviewScene(); }, [createOverviewScene]);

  // ----- Picking -----
  function pickNodeAt(e: React.MouseEvent<HTMLCanvasElement, MouseEvent>): Node | null {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sxLogical = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const syLogical = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    const world = screenToWorld(sxLogical, syLogical, CANVAS_W, CANVAS_H, transform);

    let best: Node | null = null;
    let bestD2 = Infinity;
    for (const n of nodes) {
      if (!n.visible || n.opacity < 0.2) continue;
      const rr = n.type === 'expertise' ? n.radius * 1.2 : n.radius * 1.05;
      const d2 = dist2(world.x, world.y, n.x, n.y);
      if (d2 <= rr * rr && d2 < bestD2) { best = n; bestD2 = d2; }
    }
    return best;
  }

  // ----- Focus / layout -----
  const lockExpertise = useCallback((expertiseId: string) => {
    const focusNode = nodes.find(n => n.id === expertiseId && n.type === 'expertise');
    if (!focusNode) return;

    const connectedResIds = Array.from(expertiseToResearchers.get(expertiseId) ?? []);
    const connectedResearchers = filteredResearchers.filter(r => connectedResIds.includes(r.id));

    const { edges: rrEdges, degree } = buildFocusAdjacency(expertiseId, connectedResearchers);
    const cappedRREdges = capEdges(rrEdges, MAX_FOCUS_RR_EDGES, MAX_FOCUS_RR_DEGREE);

    const currentResNodes = nodes.filter(n => n.type === 'researcher');
    const toPlace = currentResNodes.filter(n => connectedResIds.includes(n.id));
    const placed = layoutResearchersInRings(focusNode, toPlace, degree, RES_RING0, RES_RING_GAP);

    const focusScale = 1.85;
    const focusX = -(focusNode.baseX - CANVAS_W / 2);
    const focusY = -(focusNode.baseY - CANVAS_H / 2);

    setTransform(prev => ({ ...prev, targetX: focusX, targetY: focusY, targetScale: focusScale }));

    setNodes(prev => {
      const exp = prev.filter(n => n.type === 'expertise').map(n => ({ ...n, isExpanded: n.id === expertiseId, targetOpacity: n.id === expertiseId ? 1 : 0.08 }));
      const res = prev.filter(n => n.type === 'researcher').map(n => {
        const layouted = placed.find(p => p.id === n.id);
        if (layouted) return { ...n, ...layouted };
        return { ...n, targetOpacity: 0, visible: false };
      });
      return [...exp, ...res];
    });

    const newEdges: Edge[] = [];
    for (const e of edges) {
      if (e.type !== 'expertise-expertise') continue;
      const touches = e.from === expertiseId || e.to === expertiseId;
      newEdges.push({ ...e, visible: true, targetOpacity: touches ? e.strength * 0.45 : e.strength * 0.12 });
    }
    for (const rid of connectedResIds) {
      newEdges.push({ from: expertiseId, to: rid, strength: 0.9, type: 'expertise-researcher', visible: true, opacity: 0, targetOpacity: 0.7 });
    }
    for (const [a, b, s] of cappedRREdges) {
      newEdges.push({ from: a, to: b, strength: s, type: 'researcher-researcher', visible: true, opacity: 0, targetOpacity: 0.5 * s });
    }

    setEdges(newEdges);
    setClickedExpertise(expertiseId);
    setHoveredResearcher(null);
    ensureRAF();
  }, [nodes, edges, filteredResearchers, expertiseToResearchers, ensureRAF]);

  const clearFocus = useCallback(() => {
    setTransform(prev => ({ ...prev, targetX: 0, targetY: 0, targetScale: 1 }));
    createOverviewScene();
  }, [createOverviewScene]);

  // ----- Mouse handlers (middle-mouse panning) --------------------------------

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    if (!canvas) return;

    if (isPanningRef.current && lastPanRef.current) {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const dx = sx - lastPanRef.current.sx;
      const dy = sy - lastPanRef.current.sy;
      lastPanRef.current = { sx, sy };

      setTransform(t => ({
        ...t,
        targetX: t.targetX + (dx / t.scale) * (CANVAS_W / rect.width),
        targetY: t.targetY + (dy / t.scale) * (CANVAS_H / rect.height),
      }));
      ensureRAF();
      return;
    }

    // HOVER: expertise (overview or focus)
    const hit = pickNodeAt(e);
    setHoveredExpertise(hit?.type === 'expertise' ? hit.id : null);

    // HOVER: researcher highlight only when focused
    if (clickedExpertise) {
      if (hit?.type === 'researcher') {
        setHoveredResearcher(hit.id);
        setEdges(prev =>
          prev.map(ed => {
            if (ed.type !== 'researcher-researcher') return ed;
            const touches = ed.from === hit.id || ed.to === hit.id;
            return { ...ed, targetOpacity: touches ? Math.min(1, ed.strength * 0.9) : 0.15 * ed.strength };
          })
        );
      } else {
        setHoveredResearcher(null);
        setEdges(prev => prev.map(ed => ed.type === 'researcher-researcher' ? { ...ed, targetOpacity: 0.5 * ed.strength } : ed));
      }
      ensureRAF();
    }
  }, [clickedExpertise, ensureRAF]);

  const handleMouseLeave = useCallback(() => {
    setHoveredExpertise(null);
    setHoveredResearcher(null);
    isPanningRef.current = false;
    lastPanRef.current = null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only start panning with **middle mouse** (button === 1)
    if (e.button === 1) {
      e.preventDefault();
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      lastPanRef.current = { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
      isPanningRef.current = true;
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1) { e.preventDefault(); isPanningRef.current = false; lastPanRef.current = null; }
  }, []);

  const handleAuxClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Prevent browser auto-scroll on middle click
    if (e.button === 1) e.preventDefault();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Optional: suppress right-click context menu over the visualization
    e.preventDefault();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // React onClick is left-button only; perfect for node interactions
    const hit = pickNodeAt(e);

    if (hit?.type === 'expertise') {
      if (clickedExpertise === hit.id) clearFocus();
      else lockExpertise(hit.id);
      return;
    }
    // Clicking researchers is a no-op; hover handles highlighting.
  }, [clickedExpertise, lockExpertise, clearFocus]);

  // ----- Animation loop -------------------------------------------------------

  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

  const animate = useCallback(() => {
    let moved = false;
    const EPS_T = 0.001;
    const EPS_N = 0.001;

    setTransform(prev => {
      const nx = lerp(prev.x, prev.targetX, LERP.transform);
      const ny = lerp(prev.y, prev.targetY, LERP.transform);
      const ns = lerp(prev.scale, prev.targetScale, LERP.transform);
      const changed = Math.abs(nx - prev.x) > EPS_T || Math.abs(ny - prev.y) > EPS_T || Math.abs(ns - prev.scale) > EPS_T;
      moved = moved || changed;
      return changed ? { ...prev, x: nx, y: ny, scale: ns } : prev;
    });

    setNodes(prev => {
      let any = false;
      const next = prev.map(n => {
        const x = lerp(n.x, n.targetX, LERP.nodePos);
        const y = lerp(n.y, n.targetY, LERP.nodePos);
        const opacity = lerp(n.opacity, n.targetOpacity, LERP.nodeOpacity);
        const changed = Math.abs(x - n.x) > EPS_N || Math.abs(y - n.y) > EPS_N || Math.abs(opacity - n.opacity) > EPS_N;
        if (changed) any = true;
        return changed ? { ...n, x, y, opacity } : n;
      });
      moved = moved || any;
      return any ? next : prev;
    });

    setEdges(prev => {
      let any = false;
      const next = prev.map(e => {
        const opacity = lerp(e.opacity, e.targetOpacity, LERP.nodeOpacity);
        if (Math.abs(opacity - e.opacity) > EPS_N) { any = true; return { ...e, opacity }; }
        return e;
      });
      moved = moved || any;
      return any ? next : prev;
    });

    if (moved) rafRef.current = requestAnimationFrame(animate);
    else rafRef.current = null;
  }, []);

  useEffect(() => { ensureRAF(); return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }; }, [ensureRAF]);

  // HiDPI canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = dprRef.current;
    c.width = Math.floor(CANVAS_W * dpr);
    c.height = Math.floor(CANVAS_H * dpr);
  }, []);

  // ----- Drawing --------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = dprRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
    ctx.scale(transform.scale, transform.scale);
    ctx.translate(-CANVAS_W / 2 + transform.x, -CANVAS_H / 2 + transform.y);

    const grad = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, 0,
      CANVAS_W / 2, CANVAS_H / 2, Math.max(CANVAS_W, CANVAS_H) / 2
    );
    grad.addColorStop(0, COLORS.bg0);
    grad.addColorStop(1, COLORS.bg1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // edges
    for (const e of edges) {
      if (e.opacity < 0.01) continue;
      const a = idToNode.get(e.from);
      const b = idToNode.get(e.to);
      if (!a || !b || a.opacity < RENDER.minNodeOpacity || b.opacity < RENDER.minNodeOpacity) continue;

      let color = COLORS.expertise;
      let width = 2 / Math.sqrt(transform.scale);

      if (e.type === 'expertise-researcher') {
        color = `rgba(14, 165, 233, ${e.opacity})`;
        width = (e.strength * 2.5 + 1) / Math.sqrt(transform.scale);
      } else if (e.type === 'researcher-researcher') {
        color = `rgba(6, 182, 212, ${e.opacity})`;
        width = (e.strength * 1.8 + 0.8) / Math.sqrt(transform.scale);
      } else {
        color = `rgba(8, 145, 178, ${e.opacity})`;
        width = Math.max(1.5, e.strength * 6) / Math.sqrt(transform.scale);
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = width;

      if (e.type === 'expertise-expertise') {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.max(1e-3, Math.hypot(dx, dy));
        const curvature = Math.min(d * 0.1, 26);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const cx = mx + (dy / d) * curvature;
        const cy = my - (dx / d) * curvature;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(cx, cy, b.x, b.y);
        ctx.stroke();
      }
    }

    // nodes
    for (const n of nodes) {
      if (n.opacity < RENDER.minNodeOpacity) continue;

      const scale = transform.scale;
      const adjustedRadius = n.radius / Math.max(1, Math.sqrt(scale));
      const isHoveredE = hoveredExpertise === n.id && n.type === 'expertise';
      const isHoveredR = hoveredResearcher === n.id && n.type === 'researcher';
      const isExpanded = !!n.isExpanded;

      let displayRadius = adjustedRadius;
      if (isExpanded && n.type === 'expertise') displayRadius *= 1.15;
      else if (isHoveredE || isHoveredR) displayRadius *= 1.05;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = (isHoveredE || isHoveredR ? 14 : (n.type === 'expertise' ? 8 : 6)) / scale;
      ctx.shadowOffsetX = 2 / scale;
      ctx.shadowOffsetY = 2 / scale;

      const r = parseInt(n.color.slice(1, 3), 16);
      const g = parseInt(n.color.slice(3, 5), 16);
      const b = parseInt(n.color.slice(5, 7), 16);
      const baseAlpha = n.type === 'expertise' ? (isExpanded ? 0.95 : 0.85) : 0.9;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, baseAlpha * n.opacity))})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, displayRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2 / Math.sqrt(scale);
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * n.opacity})`;
      ctx.stroke();

      if (n.type === 'expertise' && n.connectionCount > 0 && transform.scale > 0.55) {
        const badgeR = Math.max(11, Math.min(16, displayRadius * 0.26));
        ctx.fillStyle = `rgba(255,255,255,${0.95 * n.opacity})`;
        ctx.beginPath();
        ctx.arc(n.x + displayRadius * 0.65, n.y - displayRadius * 0.65, badgeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = n.color;
        ctx.font = `bold ${Math.max(8, 10 / scale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(n.connectionCount), n.x + displayRadius * 0.65, n.y - displayRadius * 0.65);
      }

      if (n.opacity > 0.2 && transform.scale > RENDER.minTextScale) {
        ctx.fillStyle = `rgba(255,255,255,${n.opacity})`;
        const baseFont = n.type === 'expertise' ? (isHoveredE ? 14 : 12) : (isHoveredR ? 12 : 10);
        const fontSize = Math.max(8, baseFont / scale);
        ctx.font = `${n.type === 'expertise' ? 'bold ' : ''}${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (n.type === 'expertise' && n.name.length > 16) {
          const words = n.name.split(' ');
          const lines: string[] = [];
          let line = '';
          for (const w of words) {
            const test = line ? `${line} ${w}` : w;
            if (test.length > 12) { if (line) lines.push(line); line = w; }
            else { line = test; }
          }
          if (line) lines.push(line);
          lines.forEach((ln, i) => ctx.fillText(ln, n.x, n.y + (i - (lines.length - 1) / 2) * (fontSize + 2)));
        } else {
          const short = transform.scale < 0.8 && n.name.length > 14 ? n.name.slice(0, 14) + '…' : n.name;
          ctx.fillText(short, n.x, n.y);
        }
      }

      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }, [nodes, edges, transform, hoveredExpertise, hoveredResearcher, idToNode]);

  // ----- Render ---------------------------------------------------------------

  return (
    <section className="bg-gradient-to-b from-slate-50 to-blue-50 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-blue-900 text-center">
              Research Expertise Network
            </CardTitle>
            <p className="text-gray-600 text-center">
              Hover to preview. Left-click an expertise to lock focus and reveal its team.
              <span className="ml-1 font-medium">Middle-click (mouse wheel) & drag to pan.</span>
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                width={Math.floor(CANVAS_W * dprRef.current)}
                height={Math.floor(CANVAS_H * dprRef.current)}
                className="border border-blue-200 rounded-lg shadow-inner cursor-auto"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onAuxClick={handleAuxClick}
                onContextMenu={handleContextMenu}
                onClick={handleClick}
                style={{ width: `${CANVAS_W}px`, height: 'auto', maxWidth: '100%' }}
              />
            </div>

            <div className="mt-6 flex justify-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: COLORS.expertise }} />
                <span className="text-sm text-gray-600">Expertise (Top 15)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS.researcher }} />
                <span className="text-sm text-gray-600">Researchers</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded" style={{ backgroundColor: COLORS.expertise }} />
                <span className="text-sm text-gray-600">Connections</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-white border-2 border-teal-600 relative flex items-center justify-center">
                  <span className="text-xs text-teal-600">🔒</span>
                </div>
                <span className="text-sm text-gray-600">Left-click to Lock</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border border-gray-300 grid place-items-center">
                  <span className="text-xs">🖱️</span>
                </div>
                <span className="text-sm text-gray-600">Middle-click & drag to Pan</span>
              </div>
            </div>

            {(hoveredExpertise || clickedExpertise) && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  {clickedExpertise ? 'Locked: ' : 'Focusing: '}
                  <span className="font-medium">
                    {nodes.find(n => n.id === (clickedExpertise || hoveredExpertise))?.name}
                  </span>
                  {nodes.find(n => n.id === (clickedExpertise || hoveredExpertise)) && (
                    <span className="ml-2 text-xs text-blue-600">
                      ({nodes.find(n => n.id === (clickedExpertise || hoveredExpertise))?.connectionCount} researchers)
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {clickedExpertise
                    ? (hoveredResearcher
                        ? 'Showing collaborations for highlighted researcher • middle-drag to pan'
                        : 'Hover researchers to see their collaborations • middle-drag to pan')
                    : 'Left-click to lock focus and reveal research team'}
                </p>
              </div>
            )}

            <div className="mt-4 text-center text-xs text-gray-500">
              <p>Hover: Preview • Left-click Expertise: Lock/Unlock • Middle-click & drag: Pan • Hover Researcher (when focused): Highlight collaborators</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
