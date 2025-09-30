import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { X } from 'lucide-react';
import { getAllResearchers, subscribe } from '../data/api';
import type { Researcher } from '../data/api';

// Interfaces
interface NetworkHeatmapProps {
  searchQuery: string;
  filters: {
    yearRange: number[];
    tags: string[];
    researchArea: string;
  };
}

interface Node {
  id: string;
  name: string;
  type: 'researcher' | 'expertise';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  baseX: number;
  baseY: number;
  radius: number;
  color: string;
  connections: string[];
  connectionCount: number;
  visible: boolean;
  opacity: number;
  targetOpacity: number;
  isExpanded?: boolean;
}

interface Connection {
  from: string;
  to: string;
  strength: number;
  type: 'expertise-expertise' | 'expertise-researcher' | 'researcher-researcher';
  visible: boolean;
  opacity: number;
  targetOpacity: number;
}

interface ExpertiseConnections {
  [expertiseId: string]: {
    researchers: string[];
    connectedExpertise: { id: string; connectionCount: number }[];
  };
}

interface Transform {
  x: number;
  y: number;
  scale: number;
  targetX: number;
  targetY: number;
  targetScale: number;
}

interface ViewMode {
  type: 'overview' | 'expertise' | 'researcher';
  targetId: string | null;
  targetName: string | null;
}

// Helper: normalize values into [0.1, 1.0]
function normalizeToRange(value: number, min: number, max: number) {
  if (min === max) return 0.55;
  return 0.1 + (0.9 * (value - min)) / (max - min);
}


export default function NetworkHeatmap({ searchQuery, filters }: NetworkHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [hoveredExpertise, setHoveredExpertise] = useState<string | null>(null);
  const [clickedExpertise, setClickedExpertise] = useState<string | null>(null);
  const [hoveredResearcher, setHoveredResearcher] = useState<string | null>(null);
  const [expertiseConnections, setExpertiseConnections] = useState<ExpertiseConnections>({});
  const [transform, setTransform] = useState<Transform>({
    x: 0, y: 0, scale: 1,
    targetX: 0, targetY: 0, targetScale: 1
  });

  // 🔴 NEW: keep a live snapshot of researchers from the central store
  const [storeResearchers, setStoreResearchers] = useState<Researcher[]>(getAllResearchers());
  useEffect(() => {
    const unsub = subscribe(() => setStoreResearchers(getAllResearchers()));
    return () => unsub();
  }, []);
  
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>({
    type: 'overview',
    targetId: null,
    targetName: null
  });
  
  // Mouse dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragButton, setDragButton] = useState<number | null>(null);

  // Generate network data
  const generateNetworkData = useCallback(() => {
    // 🔁 Derive everything from real researchers in the store
    const slug = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '-');
    const researchers = storeResearchers.map(r => ({
      id: String(r.id),
      name: r.name || String(r.id),
      type: 'researcher' as const,
      expertise: Array.isArray(r.expertise) ? r.expertise : [],
    }));

    // Build expertise universe from researcher.expertise
    const expertiseNameSet = new Set<string>();
    researchers.forEach(r => r.expertise.forEach(e => e && expertiseNameSet.add(e)));
    const expertiseAreas = Array.from(expertiseNameSet).map(name => ({
      id: slug(name),
      name,
      type: 'expertise' as const,
    }));

    // Map expertise -> researcher IDs
    const expertiseConnectionsMap: ExpertiseConnections = {};
    expertiseAreas.forEach(exp => { expertiseConnectionsMap[exp.id] = { researchers: [], connectedExpertise: [] };});
    researchers.forEach(r => {
      (r.expertise || []).forEach(name => {
        const id = slug(name);
        if (!expertiseConnectionsMap[id]) {
          expertiseConnectionsMap[id] = { researchers: [], connectedExpertise: [] };
        }
        expertiseConnectionsMap[id].researchers.push(r.id);
      });
    });

    // Inter-expertise shared-researcher counts
    expertiseAreas.forEach(a => {
      expertiseAreas.forEach(b => {
        if (a.id === b.id) return;
        const shared = expertiseConnectionsMap[a.id].researchers.filter(rid =>
          expertiseConnectionsMap[b.id].researchers.includes(rid)
        );
        if (shared.length > 0) {
          const exists = expertiseConnectionsMap[a.id].connectedExpertise.find(c => c.id === b.id);
          if (!exists) {
            expertiseConnectionsMap[a.id].connectedExpertise.push({ id: b.id, connectionCount: shared.length });
          }
        }
      });
    });

    // Expanded canvas dimensions
    const canvasWidth = 1400;
    const canvasHeight = 800;

    // Create nodes
    const allNodes: Node[] = [];
    
    // Sort expertise areas by researcher count (most connected first) and limit to top 15
    const sortedExpertiseAreas = expertiseAreas
      .map(expertise => ({
        ...expertise,
        researcherCount: expertiseConnectionsMap[expertise.id].researchers.length
      }))
      .sort((a, b) => b.researcherCount - a.researcherCount)
      .slice(0, 15);
    // ---- (1) SIZE CAP: limit expertise node scaling to 2x smallest ----
    // We map counts -> radii in the range [minSize, maxSize] with maxSize = 2 * minSize
    const sizeCounts = sortedExpertiseAreas.map(e => e.researcherCount);
    const countMin = sizeCounts.length ? Math.min(...sizeCounts) : 0;
    const countMax = sizeCounts.length ? Math.max(...sizeCounts) : 1;
    const minSize = 42;           // smallest expertise node radius (px)
    const maxSize = minSize * 2;  // enforce <= 2x ratio
    const scaleRadius = (count: number) => {
      if (countMax === countMin) return (minSize + maxSize) / 2;
      const t = (count - countMin) / (countMax - countMin);
      return minSize + t * (maxSize - minSize);
    };

    // Expertise nodes arranged in concentric rings
    const expertiseNodes = sortedExpertiseAreas.map((expertise, index) => {
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      
      // Arrange in concentric rings - most connected at center
      let radius, angle;
      if (index === 0) {
        // Center node
        radius = 0;
        angle = 0;
      } else if (index <= 6) {
        // Inner ring - 6 nodes
        // ---- (3) MORE SPACING ----
        radius = Math.min(canvasWidth, canvasHeight) * 0.24;

        angle = ((index - 1) / 6) * 2 * Math.PI;
      } else {
        // ---- (3) MORE SPACING ----
        radius = Math.min(canvasWidth, canvasHeight) * 0.42;
        angle = ((index - 7) / (sortedExpertiseAreas.length - 7)) * 2 * Math.PI;
      }
      
      const baseX = centerX + Math.cos(angle) * radius;
      const baseY = centerY + Math.sin(angle) * radius;
      
      return {
        id: expertise.id,
        name: expertise.name,
        type: 'expertise' as const,
        x: baseX,
        y: baseY,
        targetX: baseX,
        targetY: baseY,
        baseX,
        baseY,
        // ---- (1) SIZE CAP APPLIED HERE ----
        radius: scaleRadius(expertise.researcherCount),
        color: '#0891b2',
        connections: [
          ...expertiseConnectionsMap[expertise.id].researchers,
          ...expertiseConnectionsMap[expertise.id].connectedExpertise.map(conn => conn.id)
        ],
        connectionCount: expertise.researcherCount,
        visible: true,
        opacity: 1,
        targetOpacity: 1
      };
    });

    // Researcher nodes (connectionCount = number of expertise)
    const researcherNodes = researchers.map(r => {
      const exps = (r.expertise || []).map(slug);
      return {
        id: r.id,
        name: r.name,
        type: 'researcher' as const,
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        targetX: canvasWidth / 2,
        targetY: canvasHeight / 2,
        baseX: canvasWidth / 2,
        baseY: canvasHeight / 2,
        radius: 35 + exps.length * 2,
        color: '#0ea5e9',
        connections: exps,
        connectionCount: exps.length,
        visible: false,
        opacity: 0,
        targetOpacity: 0
      };
    });

    allNodes.push(...expertiseNodes, ...researcherNodes);

    // Create connections
    const allConnections: Connection[] = [];

    // Expertise-researcher connections with normalized strength
    // Strength is based on expertise popularity (how many researchers have it)
    const expPopularity = new Map<string, number>();
    expertiseAreas.forEach(e => expPopularity.set(e.id, expertiseConnectionsMap[e.id].researchers.length || 1));
    const popValues = Array.from(expPopularity.values());
    const popMin = Math.min(...popValues);
    const popMax = Math.max(...popValues);

    researchers.forEach(r => {
      (r.expertise || []).forEach(name => {
        const expId = slug(name);
        const raw = expPopularity.get(expId) || 1;
        const strength = normalizeToRange(raw, popMin, popMax);
        allConnections.push({
          from: expId,
          to: r.id,
          strength,
          type: 'expertise-researcher',
          visible: false,
          opacity: 0,
          targetOpacity: 0,
        });
      });
    });

    // Expertise-expertise connections (shared researchers)
    expertiseAreas.forEach(expertise1 => {
      expertiseConnectionsMap[expertise1.id].connectedExpertise.forEach(conn => {
        const exists = allConnections.find(existing => 
          (existing.from === expertise1.id && existing.to === conn.id) ||
          (existing.from === conn.id && existing.to === expertise1.id)
        );
        
        if (!exists) {
          allConnections.push({
            from: expertise1.id,
            to: conn.id,
            strength: Math.min(conn.connectionCount / 3, 1),
            type: 'expertise-expertise',
            visible: true,
            opacity: Math.min(conn.connectionCount / 3 * 0.6, 0.6),
            targetOpacity: Math.min(conn.connectionCount / 3 * 0.6, 0.6)
          });
        }
      });
    });


    // Researcher-researcher connections
    researchers.forEach((r1, i) => {
      const e1 = new Set((r1.expertise || []).map(slug));
      researchers.slice(i + 1).forEach(r2 => {
        const e2 = new Set((r2.expertise || []).map(slug));
        const shared: string[] = [];
        e1.forEach(id => { if (e2.has(id)) shared.push(id); });
        if (shared.length > 0) {
          allConnections.push({
            from: r1.id,
            to: r2.id,
            strength: Math.min(shared.length / 2, 1),
            type: 'researcher-researcher',
            visible: false,
            opacity: 0,
            targetOpacity: 0,
          });
        }
      });
    });

    return { 
      nodes: allNodes, 
      connections: allConnections, 
      expertiseConnections: expertiseConnectionsMap 
    };
  }, [storeResearchers]);

  // Animation system
  const animate = useCallback(() => {
    const lerpFactor = 0.08;
    let needsUpdate = false;

    setNodes(prevNodes => {
      const updatedNodes = prevNodes.map(node => {
        const newX = node.x + (node.targetX - node.x) * lerpFactor;
        const newY = node.y + (node.targetY - node.y) * lerpFactor;
        const newOpacity = node.opacity + (node.targetOpacity - node.opacity) * lerpFactor;
        
        if (Math.abs(node.targetX - node.x) > 0.5 || 
            Math.abs(node.targetY - node.y) > 0.5 || 
            Math.abs(node.targetOpacity - node.opacity) > 0.01) {
          needsUpdate = true;
        }
        
        return { ...node, x: newX, y: newY, opacity: newOpacity };
      });

      // ---- (3) SIMPLE COLLISION AVOIDANCE FOR EXPERTISE NODES ----
      // Push overlapping expertise nodes apart a little each frame.
      const sepPadding = 16;      // extra spacing between bubbles
      const sepStrength = 0.12;   // how strongly to push apart
      for (let i = 0; i < updatedNodes.length; i++) {
        const a = updatedNodes[i];
        if (a.type !== 'expertise' || a.opacity < 0.05) continue;
        for (let j = i + 1; j < updatedNodes.length; j++) {
          const b = updatedNodes[j];
          if (b.type !== 'expertise' || b.opacity < 0.05) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) dist = 0.001;
          const minDist = a.radius + b.radius + sepPadding;
          if (dist < minDist) {
            const overlap = minDist - dist;
            const ux = dx / dist;
            const uy = dy / dist;
            const push = (overlap * sepStrength) / 2;
            a.x -= ux * push; a.y -= uy * push;
            b.x += ux * push; b.y += uy * push;
            needsUpdate = true;
          }
        }
      }
      return updatedNodes;
    });

    setConnections(prevConnections => {
      const updatedConnections = prevConnections.map(conn => {
        const newOpacity = conn.opacity + (conn.targetOpacity - conn.opacity) * lerpFactor;
        
        if (Math.abs(conn.targetOpacity - conn.opacity) > 0.01) {
          needsUpdate = true;
        }
        
        return { ...conn, opacity: newOpacity };
      });
      return updatedConnections;
    });

    setTransform(prevTransform => {
      const newX = prevTransform.x + (prevTransform.targetX - prevTransform.x) * lerpFactor;
      const newY = prevTransform.y + (prevTransform.targetY - prevTransform.y) * lerpFactor;
      const newScale = prevTransform.scale + (prevTransform.targetScale - prevTransform.scale) * lerpFactor;
      
      if (Math.abs(prevTransform.targetX - prevTransform.x) > 0.5 || 
          Math.abs(prevTransform.targetY - prevTransform.y) > 0.5 || 
          Math.abs(prevTransform.targetScale - prevTransform.scale) > 0.01) {
        needsUpdate = true;
      }
      
      return { ...prevTransform, x: newX, y: newY, scale: newScale };
    });

    if (needsUpdate) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // Keep animating at low frequency even when "idle"
      setTimeout(() => {
        animationRef.current = requestAnimationFrame(animate);
      }, 16);
    }
  }, []);

  // Calculate researcher layout around expertise
  const calculateResearcherLayout = useCallback((
    expertiseNode: Node,
    researcherNodes: Node[],
    canvas: HTMLCanvasElement
  ) => {
    // Concentric-ring layout:
    // - Sort researchers by total connectivity (connectionCount) descending.
    // - Pack into rings from inside out, ensuring no overlap in each ring by
    //   reserving angular "slots" based on node diameter at that radius.
    // - Inner rings contain the most connected researchers.

    // Safety: if nothing to place, return early.
    if (!researcherNodes.length) return [];

    // 1) Sort: most connected (and largest) first → inner rings.
    const sorted = [...researcherNodes].sort((a, b) => {
      if (b.connectionCount !== a.connectionCount) return b.connectionCount - a.connectionCount;
      // tie-break by radius so larger bubbles get precedence
      return b.radius - a.radius;
    });

    // 2) Ring parameters
    // Inner radius should comfortably clear the expertise node.
    const innerRadius = Math.max(160, expertiseNode.radius + 70);
    // Distance between rings. Needs to exceed largest expected diameter to avoid ring collisions.
    const ringGap = 110;
    // Extra padding between adjacent nodes along a ring arc.
    const padding = 14;

    // Helper: angular width needed for a node at the given ring radius.
    const angularWidthAt = (node: Node, ringR: number) => {
      // half-chord approximation; clamp to avoid asin domain errors
      const halfChord = (node.radius * 1.15 + padding) / Math.max(1, ringR);
      const clamped = Math.min(0.99, Math.max(0.02, halfChord));
      return 2 * Math.asin(clamped);
    };

    // 3) Greedy packing of nodes into rings by angular capacity (<= 2π)
    type Ring = { radius: number; nodes: Node[]; angles?: number[] };
    const rings: Ring[] = [];

    let i = 0;
    let ringIndex = 0;
    while (i < sorted.length) {
      const radius = innerRadius + ringIndex * ringGap;
      const ringNodes: Node[] = [];
      let usedAngle = 0;

      // Always place at least one node in a ring
      while (i < sorted.length) {
        const candidate = sorted[i];
        const w = angularWidthAt(candidate, radius);
        if (ringNodes.length > 0 && usedAngle + w > 2 * Math.PI) break;
        ringNodes.push(candidate);
        usedAngle += w;
        i++;
      }
      rings.push({ radius, nodes: ringNodes });
      ringIndex++;
    }

    // 4) Assign angles within each ring using the exact angular widths,
    //    distributing from the top (−π/2) around clockwise.
    const laidOut: Node[] = [];
    rings.forEach(ring => {
      let theta = -Math.PI / 2; // start at 12 o'clock
      ring.angles = [];
      ring.nodes.forEach(node => {
        const w = angularWidthAt(node, ring.radius);
        theta += w / 2; // center of the slot
        ring.angles!.push(theta);
        theta += w / 2;
      });

      // 5) Convert polar -> Cartesian, clamp to canvas bounds
      ring.nodes.forEach((node, idx) => {
        const a = ring.angles![idx];
        let targetX = expertiseNode.x + Math.cos(a) * ring.radius;
        let targetY = expertiseNode.y + Math.sin(a) * ring.radius;

        // Keep within canvas bounds to avoid clipping
        const margin = node.radius + 18;
        targetX = Math.max(margin, Math.min(canvas.width - margin, targetX));
        targetY = Math.max(margin, Math.min(canvas.height - margin, targetY));

        laidOut.push({
          ...node,
          targetX,
          targetY,
          targetOpacity: 0.95,
          visible: true
        });
      });
    });

    return laidOut;
  }, []);

  // Handle expertise hover (only enlargement effect, no focus/zoom)
  const handleExpertiseHover = useCallback((expertiseId: string | null) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredExpertise(expertiseId);
      
      // Only update node appearance for enlargement effect, no zoom/focus behavior
      if (expertiseId) {
        setNodes(prevNodes => 
          prevNodes.map(node => {
            if (node.type === 'expertise') {
              return {
                ...node,
                isExpanded: node.id === expertiseId
              };
            }
            return node;
          })
        );
      } else {
        setNodes(prevNodes => 
          prevNodes.map(node => ({
            ...node,
            isExpanded: false
          }))
        );
      }
    }, 30);
  }, []);

  // Handle expertise click (show researchers in focus mode)
  const handleExpertiseClick = useCallback((expertiseId: string | null) => {
    if (viewMode.type === 'expertise' && viewMode.targetId === expertiseId) {
      return; // Already viewing this expertise
    }
    
    if (expertiseId) {
      // ---- (2) HARD CLEAR + REBUILD A TINY GRAPH FOR THIS FOCUS ----
      const fullData = generateNetworkData();
      const expertiseNode = fullData.nodes.find(n => n.id === expertiseId && n.type === 'expertise');
      if (!expertiseNode) return;

      // Set expertise view mode
      setViewMode({
        type: 'expertise',
        targetId: expertiseId,
        targetName: expertiseNode.name
      });
      
      setClickedExpertise(expertiseId);
      setHoveredResearcher(null);
      
      const canvas = canvasRef.current;
      if (!canvas) return;

      const connectedResearchers = (fullData.expertiseConnections[expertiseId] || { researchers: [] }).researchers;
      
      // Enhanced zoom for locked focus - use current position, not base position
      const focusScale = 1.8;
      const focusX = -(expertiseNode.x - canvas.width / 2);
      const focusY = -(expertiseNode.y - canvas.height / 2);

      setTransform(prev => ({
        ...prev,
        targetX: focusX,
        targetY: focusY,
        targetScale: focusScale
      }));
      
      // Build a minimal node list: just the focused expertise + its researchers
      const researcherNodes = fullData.nodes.filter(
        n => n.type === 'researcher' && connectedResearchers.includes(n.id)
      );
      const layoutedResearchers = calculateResearcherLayout(
        expertiseNode as Node,
        researcherNodes as Node[],
        canvas
      ).map(n => ({ ...n, targetOpacity: 1 } as Node));

      const focusedExpertise: Node = {
        ...(expertiseNode as Node),
        isExpanded: true,
        targetOpacity: 1,
        visible: true
      };
      setNodes([focusedExpertise, ...layoutedResearchers]);
      
      // Only the relevant expertise->researcher connections
      const focusedConnections = fullData.connections.filter(
        c => c.type === 'expertise-researcher' && (c.from === expertiseId || c.to === expertiseId)
      ).map(c => ({ ...c, targetOpacity: c.strength * 0.8, visible: true }));
      setConnections(focusedConnections);
    }
  }, [viewMode, calculateResearcherLayout, generateNetworkData]);

  // Handle researcher click (show their expertise areas)
  const handleResearcherClick = useCallback((researcherId: string | null) => {
    if (!researcherId) return;
    // ---- (2) HARD CLEAR + REBUILD FOR RESEARCHER FOCUS ----
    const fullData = generateNetworkData();
    const researcherNode = fullData.nodes.find(n => n.id === researcherId && n.type === 'researcher');
    if (!researcherNode) return;

    // Get researcher's expertise areas
    const researcherExpertise = fullData.connections
      .filter(conn => conn.type === 'expertise-researcher' && conn.to === researcherId)
      .map(conn => conn.from);

    // Set researcher view mode
    setViewMode({
      type: 'researcher',
      targetId: researcherId,
      targetName: researcherNode.name
    });

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Focus on researcher
    const focusScale = 1.8;
    const focusX = -(researcherNode.x - canvas.width / 2);
    const focusY = -(researcherNode.y - canvas.height / 2);

    setTransform(prev => ({
      ...prev,
      targetX: focusX,
      targetY: focusY,
      targetScale: focusScale
    }));

    // Show researcher's expertise areas in concentric rings
    // Arrange only relevant expertise nodes around this researcher
    const relevantExpertiseNodes = fullData.nodes.filter(
      n => n.type === 'expertise' && researcherExpertise.includes(n.id)
    ) as Node[];
    const arrangedExpertise = relevantExpertiseNodes.map((node, index) => {
      const radius = 170; // slightly larger than before for spacing
      const angle = (index / relevantExpertiseNodes.length) * 2 * Math.PI;
      const targetX = (researcherNode as Node).x + Math.cos(angle) * radius;
      const targetY = (researcherNode as Node).y + Math.sin(angle) * radius;
      return {
        ...node,
        targetX: Math.max(node.radius, Math.min(canvas.width - node.radius, targetX)),
        targetY: Math.max(node.radius, Math.min(canvas.height - node.radius, targetY)),
        targetOpacity: 0.9,
        visible: true
      } as Node;
    });

    const focusedResearcher: Node = {
      ...(researcherNode as Node),
      targetOpacity: 1,
      visible: true
    };
    setNodes([focusedResearcher, ...arrangedExpertise]);

    // Only the connections related to this researcher
    const relConnections = fullData.connections.filter(
      c => c.type === 'expertise-researcher' && c.to === researcherId
    ).map(c => ({ ...c, targetOpacity: c.strength * 0.8, visible: true }));
    setConnections(relConnections);
  }, [generateNetworkData]);

  // Exit to overview mode
  const exitToOverview = useCallback(() => {
    setViewMode({
      type: 'overview',
      targetId: null,
      targetName: null
    });
    
    setClickedExpertise(null);
    setHoveredResearcher(null);
    
    setTransform(prev => ({
      ...prev,
      targetX: 0,
      targetY: 0,
      targetScale: 1
    }));
    // ---- (2) HARD CLEAR: rebuild a fresh overview graph ----
    const data = generateNetworkData();
    setNodes(data.nodes);
    setConnections(data.connections);
    setExpertiseConnections(data.expertiseConnections);
  }, [generateNetworkData]);

  // Handle researcher hover (only enlargement effect, no connection changes)
  const handleResearcherHover = useCallback((researcherId: string | null) => {
    if (viewMode.type !== 'expertise') return; // Only works in expertise focus mode
    
    setHoveredResearcher(researcherId);
    
    // Only update for enlargement effect, no connection changes
  }, [viewMode]);

  // Transform screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    // Fix hitbox calculation - account for transform properly
    const worldX = (screenX - canvas.width / 2) / transform.scale - transform.x + canvas.width / 2;
    const worldY = (screenY - canvas.height / 2) / transform.scale - transform.y + canvas.height / 2;
    
    return { x: worldX, y: worldY };
  }, [transform]);

  // Mouse event handlers
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button === 1) { // Middle mouse button
      event.preventDefault();
      setIsDragging(true);
      setDragButton(1);
      setDragStart({ x: event.clientX, y: event.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle dragging
    if (isDragging && dragButton === 1) {
      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      
      setTransform(prev => ({
        ...prev,
        targetX: prev.targetX + deltaX / prev.scale,
        targetY: prev.targetY + deltaY / prev.scale
      }));
      
      setDragStart({ x: event.clientX, y: event.clientY });
      return;
    }

    const rect = canvas.getBoundingClientRect();
    // Account for canvas scaling due to CSS
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screenX = (event.clientX - rect.left) * scaleX;
    const screenY = (event.clientY - rect.top) * scaleY;
    const { x: worldX, y: worldY } = screenToWorld(screenX, screenY);

    // Check for expertise node hover
    const hoveredExpertiseId = nodes.find(node => {
      if (node.type !== 'expertise' || node.opacity < 0.1) return false;
      
      const distance = Math.sqrt(
        Math.pow(worldX - node.x, 2) + Math.pow(worldY - node.y, 2)
      );
      const adjustedRadius = node.radius / Math.max(1, Math.sqrt(transform.scale));
      return distance <= adjustedRadius;
    })?.id || null;

    // Check for researcher node hover (only in focus mode)
    let hoveredResearcherId = null;
    if (viewMode.type === 'expertise') {
      hoveredResearcherId = nodes.find(node => {
        if (node.type !== 'researcher' || node.opacity < 0.1) return false;
        
        const distance = Math.sqrt(
          Math.pow(worldX - node.x, 2) + Math.pow(worldY - node.y, 2)
        );
        const adjustedRadius = node.radius / Math.max(1, Math.sqrt(transform.scale));
        return distance <= adjustedRadius;
      })?.id || null;
    }

    if (hoveredExpertiseId !== hoveredExpertise) {
      handleExpertiseHover(hoveredExpertiseId);
    }

    if (hoveredResearcherId !== hoveredResearcher) {
      handleResearcherHover(hoveredResearcherId);
    }
  }, [nodes, hoveredExpertise, hoveredResearcher, viewMode, transform, screenToWorld, handleExpertiseHover, handleResearcherHover, isDragging, dragButton, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragButton(null);
  }, []);

  const handleMouseClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return; // Only handle left clicks
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Account for canvas scaling due to CSS
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screenX = (event.clientX - rect.left) * scaleX;
    const screenY = (event.clientY - rect.top) * scaleY;
    const { x: worldX, y: worldY } = screenToWorld(screenX, screenY);

    // Check for expertise node clicks
    const clickedExpertiseId = nodes.find(node => {
      if (node.type !== 'expertise' || node.opacity < 0.1) return false;
      
      const distance = Math.sqrt(
        Math.pow(worldX - node.x, 2) + Math.pow(worldY - node.y, 2)
      );
      const adjustedRadius = node.radius / Math.max(1, Math.sqrt(transform.scale));
      return distance <= adjustedRadius;
    })?.id || null;

    // Check for researcher node clicks (only in expertise view mode)
    const clickedResearcherId = viewMode.type === 'expertise' ? nodes.find(node => {
      if (node.type !== 'researcher' || node.opacity < 0.1) return false;
      
      const distance = Math.sqrt(
        Math.pow(worldX - node.x, 2) + Math.pow(worldY - node.y, 2)
      );
      const adjustedRadius = node.radius / Math.max(1, Math.sqrt(transform.scale));
      return distance <= adjustedRadius;
    })?.id || null : null;

    if (clickedExpertiseId) {
      handleExpertiseClick(clickedExpertiseId);
    } else if (clickedResearcherId) {
      handleResearcherClick(clickedResearcherId);
    }
  }, [nodes, transform, screenToWorld, viewMode, handleExpertiseClick, handleResearcherClick]);

  const handleMouseLeave = useCallback(() => {
    if (viewMode.type === 'overview') {
      handleExpertiseHover(null);
    }
    if (viewMode.type === 'expertise') {
      handleResearcherHover(null);
    }
  }, [viewMode, handleExpertiseHover, handleResearcherHover]);

  // Initialize network data
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 1400;
    canvas.height = 800;

    // Rebuild from current store snapshot (runs initially and whenever storeResearchers changes)
    const data = generateNetworkData();
    setNodes(data.nodes);
    setConnections(data.connections);
    setExpertiseConnections(data.expertiseConnections);
    
    setTransform({
      x: 0, y: 0, scale: 1,
      targetX: 0, targetY: 0, targetScale: 1
    });
    setHoveredExpertise(null);
    setClickedExpertise(null);
    setHoveredResearcher(null);
    setViewMode({
      type: 'overview',
      targetId: null,
      targetName: null
    });
  }, [generateNetworkData, storeResearchers]);

  // Global mouse event listeners for dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragButton(null);
    };

    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (isDragging && dragButton === 1) {
        const deltaX = event.clientX - dragStart.x;
        const deltaY = event.clientY - dragStart.y;
        
        setTransform(prev => ({
          ...prev,
          targetX: prev.targetX + deltaX / prev.scale,
          targetY: prev.targetY + deltaY / prev.scale
        }));
        
        setDragStart({ x: event.clientX, y: event.clientY });
      }
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isDragging, dragButton, dragStart]);

  // Start continuous animation loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || nodes.length === 0) return;

    let renderFrame: number;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save context for transformations
      ctx.save();

      // Apply zoom and pan transformations
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(transform.scale, transform.scale);
      ctx.translate(-canvas.width / 2 + transform.x, -canvas.height / 2 + transform.y);

      // ---- (4) "INFINITE" BACKGROUND ----
      // Instead of a finite box, fill a very large world-space area so you never see edges.
      const BG_SIZE = 50000; // 50k px in all directions is effectively "infinite" for UX
      const worldCenterX = canvas.width / 2 + transform.x;
      const worldCenterY = canvas.height / 2 + transform.y;
      const gradient = ctx.createRadialGradient(
        worldCenterX, worldCenterY, 0,
        worldCenterX, worldCenterY, BG_SIZE * 0.6
      );
      gradient.addColorStop(0, '#f0f9ff');
      gradient.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = gradient;
      ctx.fillRect(worldCenterX - BG_SIZE, worldCenterY - BG_SIZE, BG_SIZE * 2, BG_SIZE * 2);

      // Draw connections
      connections.forEach(connection => {
        if (connection.opacity < 0.01) return;
        
        const fromNode = nodes.find(n => n.id === connection.from);
        const toNode = nodes.find(n => n.id === connection.to);
        
        if (fromNode && toNode && fromNode.opacity > 0.01 && toNode.opacity > 0.01) {
          let strokeColor, lineWidth;
          
          if (connection.type === 'expertise-expertise') {
            strokeColor = `rgba(8, 145, 178, ${connection.opacity})`;
            lineWidth = Math.max(2, connection.strength * 8) / Math.sqrt(transform.scale);
          } else if (connection.type === 'expertise-researcher') {
            strokeColor = `rgba(14, 165, 233, ${connection.opacity})`;
            lineWidth = (connection.strength * 3 + 1) / Math.sqrt(transform.scale);
          } else {
            strokeColor = `rgba(6, 182, 212, ${connection.opacity})`;
            lineWidth = (connection.strength * 2 + 1) / Math.sqrt(transform.scale);
          }
          
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          
          if (connection.type === 'expertise-expertise') {
            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.lineTo(toNode.x, toNode.y);
            ctx.stroke();
          } else {
            // Curved lines for researcher connections
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const curvature = Math.min(distance * 0.1, 30);
            
            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2;
            const ctrlX = midX + (dy / distance) * curvature;
            const ctrlY = midY - (dx / distance) * curvature;
            
            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.quadraticCurveTo(ctrlX, ctrlY, toNode.x, toNode.y);
            ctx.stroke();
          }
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        if (node.opacity < 0.01) return;
        
        const isHoveredExpertise = hoveredExpertise === node.id;
        const isClickedExpertise = clickedExpertise === node.id;
        const isHoveredResearcher = hoveredResearcher === node.id;
        const isExpanded = node.isExpanded;
        
        const scale = transform.scale;
        const adjustedRadius = node.radius / Math.max(1, Math.sqrt(scale));
        
        // Node shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = (isHoveredExpertise || isHoveredResearcher ? 20 : (node.type === 'expertise' ? 12 : 8)) / scale;
        ctx.shadowOffsetX = 3 / scale;
        ctx.shadowOffsetY = 3 / scale;
        
        // Calculate display radius
        let displayRadius = adjustedRadius;
        if (isExpanded && node.type === 'expertise') displayRadius *= 1.2;
        else if (isHoveredExpertise || isHoveredResearcher) displayRadius *= 1.05;
        
        // Node circle (solid)
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, displayRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Node border
        ctx.shadowColor = 'transparent';
        const borderColor = '#ffffff';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = (isHoveredExpertise || isExpanded || isClickedExpertise || isHoveredResearcher ? 4 : 2) / scale;
        ctx.stroke();
                
        // Connection count indicator
        if (node.type === 'expertise' && node.connectionCount > 0 && scale > 0.5) {
          ctx.fillStyle = '#ffffff';
          const countRadius = Math.min(14, node.connectionCount * 1.5 + 8) / scale;
          ctx.beginPath();
          ctx.arc(node.x + displayRadius * 0.65, node.y - displayRadius * 0.65, countRadius, 0, 2 * Math.PI);
          ctx.fill();
          
          ctx.fillStyle = node.color;
          ctx.font = `bold ${Math.max(8, 11 / scale)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.connectionCount.toString(), 
                      node.x + displayRadius * 0.65, 
                      node.y - displayRadius * 0.65);
        }
        
        // Node text
        if (node.opacity > 0.2 && scale > 0.3) {
          ctx.fillStyle = '#ffffff';
          const baseFontSize = node.type === 'expertise' ? 
            (isHoveredExpertise ? 14 : 12) : (isHoveredResearcher ? 12 : 10);
          const fontSize = Math.max(8, baseFontSize / scale);
          ctx.font = `${node.type === 'expertise' ? 'bold' : ''} ${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          if (scale < 0.8) {
            const abbreviated = node.name.length > 10 ? node.name.substring(0, 10) + '...' : node.name;
            ctx.fillText(abbreviated, node.x, node.y);
          } else {
            const words = node.name.split(' ');
            if (words.length > 1 && node.name.length > 15) {
              words.forEach((word, index) => {
                ctx.fillText(word, node.x, node.y + (index - (words.length - 1) / 2) * (fontSize + 2));
              });
            } else {
              ctx.fillText(node.name, node.x, node.y);
            }
          }
        }
        
        // Type indicator for researcher nodes
        if (node.type === 'researcher' && node.opacity > 0.4 && scale > 0.7) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `${Math.max(6, 8 / scale)}px Arial`;
          ctx.fillText('researcher', node.x, node.y + displayRadius + 14 / scale);
        }
      });

      ctx.restore();
      renderFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (renderFrame) {
        cancelAnimationFrame(renderFrame);
      }
    };
  }, [nodes, connections, hoveredExpertise, clickedExpertise, hoveredResearcher, transform]);

  return (
    <section className="bg-gradient-to-b from-slate-50 to-blue-50 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-blue-900 text-center">
              Research Expertise Network
            </CardTitle>
            <p className="text-gray-600 text-center">
              Click expertise areas to view researchers • Click researchers to view their expertise • Middle-click and drag to navigate
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center relative isolate">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={handleMouseClick}
                onMouseLeave={handleMouseLeave}
                onContextMenu={(e) => e.preventDefault()}
                 className="relative z-0 border border-blue-200 rounded-lg shadow-inner cursor-pointer"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
              
              {/* View Mode Popup */}
              {viewMode.type !== 'overview' && (
                <div className="absolute z-[9999] top-4 right-4 bg-white border border-blue-200 rounded-lg px-4 py-3 shadow-lg pointer-events-auto">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-900">
                        Viewing {viewMode.type === 'expertise' ? 'Expertise' : 'Researcher'}:
                      </div>
                      <div className="text-lg text-gray-800 truncate max-w-48">
                        {viewMode.targetName}
                      </div>
                    </div>
                    <button
                      onClick={exitToOverview}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                      title="Return to overview"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-center gap-8 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-teal-600"></div>
                <span className="text-sm text-gray-600">Expertise Areas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                <span className="text-sm text-gray-600">Researchers</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 bg-teal-600 rounded"></div>
                <span className="text-sm text-gray-600">Connections</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-white border-2 border-teal-600 relative flex items-center justify-center">
                  <span className="text-xs text-teal-600">🖱️</span>
                </div>
                <span className="text-sm text-gray-600">Middle-click to Pan</span>
              </div>
            </div>

            <div className="mt-4 text-center text-xs text-gray-500">
              <p>
                {viewMode.type === 'overview' && 'Top 15 expertise areas arranged by research activity • Click to explore'}
                {viewMode.type === 'expertise' && 'Click researchers to view their expertise areas • Hover for collaborations'}
                {viewMode.type === 'researcher' && 'Expertise areas connected to this researcher'}
              </p>
              <p className="mt-1">Middle-click and drag to navigate • Use the × button to return to overview</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}