import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { X } from 'lucide-react';
import { getAllResearchers, getAllOutcomes } from '../data/api';  // Added API imports
import { Researcher } from '../data/mockData';  // Import the Researcher type for better type checking

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
    const researchers = [
      { id: 'chen', name: 'Dr. S. Chen', type: 'researcher' as const },
      { id: 'rodriguez', name: 'Prof. M. Rodriguez', type: 'researcher' as const },
      { id: 'thompson', name: 'Dr. E. Thompson', type: 'researcher' as const },
      { id: 'wilson', name: 'Dr. J. Wilson', type: 'researcher' as const },
      { id: 'park', name: 'Dr. L. Park', type: 'researcher' as const },
      { id: 'kim', name: 'Dr. R. Kim', type: 'researcher' as const },
      { id: 'garcia', name: 'Dr. A. Garcia', type: 'researcher' as const },
      { id: 'lee', name: 'Prof. H. Lee', type: 'researcher' as const },
      { id: 'patel', name: 'Dr. K. Patel', type: 'researcher' as const },
      { id: 'nakamura', name: 'Dr. T. Nakamura', type: 'researcher' as const }
    ];
    // const researchers: Researcher[] = getAllResearchers();

    const expertiseAreas = [
      { id: 'climate', name: 'Climate Change', type: 'expertise' as const },
      { id: 'pollution', name: 'Marine Pollution', type: 'expertise' as const },
      { id: 'conservation', name: 'Conservation Biology', type: 'expertise' as const },
      { id: 'ecosystem', name: 'Ecosystem Health', type: 'expertise' as const },
      { id: 'biodiversity', name: 'Marine Biodiversity', type: 'expertise' as const },
      { id: 'oceanography', name: 'Physical Oceanography', type: 'expertise' as const },
      { id: 'coral', name: 'Coral Reef Health', type: 'expertise' as const },
      { id: 'fisheries', name: 'Fisheries Science', type: 'expertise' as const },
      { id: 'chemistry', name: 'Marine Chemistry', type: 'expertise' as const },
      { id: 'geology', name: 'Marine Geology', type: 'expertise' as const },
      { id: 'microbiology', name: 'Marine Microbiology', type: 'expertise' as const },
      { id: 'acoustics', name: 'Marine Acoustics', type: 'expertise' as const },
      { id: 'remote', name: 'Remote Sensing', type: 'expertise' as const },
      { id: 'modeling', name: 'Ocean Modeling', type: 'expertise' as const },
      { id: 'policy', name: 'Marine Policy', type: 'expertise' as const },
      { id: 'genetics', name: 'Marine Genetics', type: 'expertise' as const }
    ];

    const researcherExpertiseConnections = [
      { researcher: 'chen', expertise: 'climate', strength: 0.9 },
      { researcher: 'chen', expertise: 'conservation', strength: 0.7 },
      { researcher: 'chen', expertise: 'modeling', strength: 0.8 },
      { researcher: 'rodriguez', expertise: 'climate', strength: 0.8 },
      { researcher: 'rodriguez', expertise: 'oceanography', strength: 0.9 },
      { researcher: 'rodriguez', expertise: 'remote', strength: 0.7 },
      { researcher: 'thompson', expertise: 'pollution', strength: 0.9 },
      { researcher: 'thompson', expertise: 'ecosystem', strength: 0.6 },
      { researcher: 'thompson', expertise: 'chemistry', strength: 0.8 },
      { researcher: 'wilson', expertise: 'pollution', strength: 0.8 },
      { researcher: 'wilson', expertise: 'policy', strength: 0.7 },
      { researcher: 'park', expertise: 'oceanography', strength: 0.8 },
      { researcher: 'park', expertise: 'climate', strength: 0.6 },
      { researcher: 'park', expertise: 'geology', strength: 0.9 },
      { researcher: 'kim', expertise: 'oceanography', strength: 0.7 },
      { researcher: 'kim', expertise: 'acoustics', strength: 0.9 },
      { researcher: 'garcia', expertise: 'biodiversity', strength: 0.9 },
      { researcher: 'garcia', expertise: 'conservation', strength: 0.8 },
      { researcher: 'garcia', expertise: 'coral', strength: 0.9 },
      { researcher: 'garcia', expertise: 'genetics', strength: 0.7 },
      { researcher: 'lee', expertise: 'ecosystem', strength: 0.9 },
      { researcher: 'lee', expertise: 'biodiversity', strength: 0.7 },
      { researcher: 'lee', expertise: 'microbiology', strength: 0.8 },
      { researcher: 'patel', expertise: 'conservation', strength: 0.8 },
      { researcher: 'patel', expertise: 'fisheries', strength: 0.9 },
      { researcher: 'nakamura', expertise: 'biodiversity', strength: 0.8 },
      { researcher: 'nakamura', expertise: 'ecosystem', strength: 0.7 },
      { researcher: 'nakamura', expertise: 'coral', strength: 0.8 }
    ];

    // Build expertise connections mapping
    const expertiseConnectionsMap: ExpertiseConnections = {};
    expertiseAreas.forEach(expertise => {
      expertiseConnectionsMap[expertise.id] = {
        researchers: researcherExpertiseConnections
          .filter(conn => conn.expertise === expertise.id)
          .map(conn => conn.researcher),
        connectedExpertise: []
      };
    });

    // Calculate inter-expertise connections
    expertiseAreas.forEach(expertise1 => {
      expertiseAreas.forEach(expertise2 => {
        if (expertise1.id !== expertise2.id) {
          const shared = expertiseConnectionsMap[expertise1.id].researchers.filter(r =>
            expertiseConnectionsMap[expertise2.id].researchers.includes(r)
          );
          
          if (shared.length > 0) {
            const existing = expertiseConnectionsMap[expertise1.id].connectedExpertise
              .find(conn => conn.id === expertise2.id);
            
            if (!existing) {
              expertiseConnectionsMap[expertise1.id].connectedExpertise.push({
                id: expertise2.id,
                connectionCount: shared.length
              });
            }
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
        radius = Math.min(canvasWidth, canvasHeight) * 0.18;
        angle = ((index - 1) / 6) * 2 * Math.PI;
      } else {
        // Outer ring - remaining nodes
        radius = Math.min(canvasWidth, canvasHeight) * 0.3;
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
        radius: 45 + expertise.researcherCount * 4,
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

    // Researcher nodes
    const researcherNodes = researchers.map(researcher => {
      const userExpertise = researcherExpertiseConnections.filter(conn => conn.researcher === researcher.id);
      
      return {
        id: researcher.id,
        name: researcher.name,
        type: 'researcher' as const,
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        targetX: canvasWidth / 2,
        targetY: canvasHeight / 2,
        baseX: canvasWidth / 2,
        baseY: canvasHeight / 2,
        radius: 35 + userExpertise.length * 2,
        color: '#0ea5e9',
        connections: userExpertise.map(conn => conn.expertise),
        connectionCount: userExpertise.length,
        visible: false,
        opacity: 0,
        targetOpacity: 0
      };
    });

    allNodes.push(...expertiseNodes, ...researcherNodes);

    // Create connections
    const allConnections: Connection[] = [];

    // Expertise-expertise connections
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

    // Expertise-researcher connections
    researcherExpertiseConnections.forEach(conn => {
      allConnections.push({
        from: conn.expertise,
        to: conn.researcher,
        strength: conn.strength,
        type: 'expertise-researcher',
        visible: false,
        opacity: 0,
        targetOpacity: 0
      });
    });

    // Researcher-researcher connections
    researchers.forEach((researcher1, i) => {
      researchers.slice(i + 1).forEach(researcher2 => {
        const researcher1Expertise = researcherExpertiseConnections
          .filter(conn => conn.researcher === researcher1.id)
          .map(conn => conn.expertise);
        const researcher2Expertise = researcherExpertiseConnections
          .filter(conn => conn.researcher === researcher2.id)
          .map(conn => conn.expertise);
        
        const sharedExpertise = researcher1Expertise.filter(exp => 
          researcher2Expertise.includes(exp)
        );
        
        if (sharedExpertise.length > 0) {
          allConnections.push({
            from: researcher1.id,
            to: researcher2.id,
            strength: Math.min(sharedExpertise.length / 2, 1),
            type: 'researcher-researcher',
            visible: false,
            opacity: 0,
            targetOpacity: 0
          });
        }
      });
    });

    return { 
      nodes: allNodes, 
      connections: allConnections, 
      expertiseConnections: expertiseConnectionsMap 
    };
  }, []);

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
    const baseRadius = 140;
    
    return researcherNodes.map((node, index) => {
      const angle = (index / researcherNodes.length) * 2 * Math.PI;
      const radiusVariation = Math.sin(index * 1.7) * 25;
      const radius = baseRadius + radiusVariation;
      
      let targetX = expertiseNode.x + Math.cos(angle) * radius;
      let targetY = expertiseNode.y + Math.sin(angle) * radius;

      // Keep within bounds
      const margin = node.radius + 15;
      targetX = Math.max(margin, Math.min(canvas.width - margin, targetX));
      targetY = Math.max(margin, Math.min(canvas.height - margin, targetY));
      
      return {
        ...node,
        targetX,
        targetY,
        targetOpacity: 0.9,
        visible: true
      };
    });
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
    
    if (expertiseId && expertiseConnections[expertiseId]) {
      const expertiseNode = nodes.find(n => n.id === expertiseId);
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

      const connectedResearchers = expertiseConnections[expertiseId].researchers;
      
      // Enhanced zoom for locked focus
      const focusScale = 1.8;
      const focusX = -(expertiseNode.baseX - canvas.width / 2);
      const focusY = -(expertiseNode.baseY - canvas.height / 2);

      setTransform(prev => ({
        ...prev,
        targetX: focusX,
        targetY: focusY,
        targetScale: focusScale
      }));
      
      // Show researchers and grey out other nodes
      setNodes(prevNodes => {
        const expertiseNodes = prevNodes.filter(n => n.type === 'expertise');
        const researcherNodes = prevNodes.filter(n => n.type === 'researcher');
        
        const updatedExpertiseNodes = expertiseNodes.map(node => ({
          ...node,
          isExpanded: node.id === expertiseId,
          // Make non-focused expertise very transparent
          targetOpacity: node.id === expertiseId ? 1 : 0.15
        }));

        const connectedResearcherNodes = researcherNodes.filter(n => 
          connectedResearchers.includes(n.id)
        );
        
        const layoutedResearchers = calculateResearcherLayout(
          expertiseNode, 
          connectedResearcherNodes, 
          canvas
        );

        const updatedResearcherNodes = researcherNodes.map(node => {
          const layouted = layoutedResearchers.find(r => r.id === node.id);
          if (layouted) {
            // Make connected researchers solid/opaque
            return { ...layouted, targetOpacity: 1 };
          } else {
            return { ...node, targetOpacity: 0, visible: false };
          }
        });

        return [...updatedExpertiseNodes, ...updatedResearcherNodes];
      });
      
      // Show expertise-researcher connections with transparency for non-focused
      setConnections(prevConnections =>
        prevConnections.map(conn => {
          let opacity = 0;
          let shouldShow = false;
          
          if (conn.type === 'expertise-expertise') {
            shouldShow = true;
            // Make non-focused expertise connections very transparent
            opacity = conn.from === expertiseId || conn.to === expertiseId ? 
              conn.strength * 0.4 : conn.strength * 0.05;
          } else if (conn.type === 'expertise-researcher') {
            shouldShow = conn.from === expertiseId || conn.to === expertiseId;
            // Make connected researcher lines solid
            opacity = shouldShow ? conn.strength * 0.8 : 0;
          }
          
          return { ...conn, targetOpacity: opacity, visible: shouldShow };
        })
      );
    }
  }, [viewMode, expertiseConnections, nodes, calculateResearcherLayout]);

  // Handle researcher click (show their expertise areas)
  const handleResearcherClick = useCallback((researcherId: string | null) => {
    if (!researcherId) return;
    
    const researcherNode = nodes.find(n => n.id === researcherId);
    if (!researcherNode) return;

    // Get researcher's expertise areas
    const researcherExpertise = connections
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
    setNodes(prevNodes => {
      const expertiseNodes = prevNodes.filter(n => n.type === 'expertise');
      const researcherNodes = prevNodes.filter(n => n.type === 'researcher');
      
      // Arrange relevant expertise nodes around researcher
      const relevantExpertiseNodes = expertiseNodes.filter(n => 
        researcherExpertise.includes(n.id)
      );

      const updatedExpertiseNodes = expertiseNodes.map(node => {
        if (researcherExpertise.includes(node.id)) {
          const index = relevantExpertiseNodes.findIndex(n => n.id === node.id);
          const radius = 140;
          const angle = (index / relevantExpertiseNodes.length) * 2 * Math.PI;
          const targetX = researcherNode.x + Math.cos(angle) * radius;
          const targetY = researcherNode.y + Math.sin(angle) * radius;
          
          return {
            ...node,
            targetX: Math.max(node.radius, Math.min(canvas.width - node.radius, targetX)),
            targetY: Math.max(node.radius, Math.min(canvas.height - node.radius, targetY)),
            targetOpacity: 0.9,
            visible: true
          };
        } else {
          return { ...node, targetOpacity: 0, visible: false };
        }
      });

      const updatedResearcherNodes = researcherNodes.map(node => ({
        ...node,
        targetOpacity: node.id === researcherId ? 1 : 0,
        visible: node.id === researcherId
      }));

      return [...updatedExpertiseNodes, ...updatedResearcherNodes];
    });

    // Show connections
    setConnections(prevConnections =>
      prevConnections.map(conn => {
        let opacity = 0;
        let shouldShow = false;
        
        if (conn.type === 'expertise-researcher' && conn.to === researcherId) {
          shouldShow = true;
          opacity = conn.strength * 0.8;
        }
        
        return { ...conn, targetOpacity: opacity, visible: shouldShow };
      })
    );
  }, [nodes, connections]);

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
    
    setNodes(prevNodes => 
      prevNodes.map(node => ({
        ...node,
        isExpanded: false,
        targetX: node.baseX,
        targetY: node.baseY,
        targetOpacity: node.type === 'expertise' ? 1 : 0,
        visible: node.type === 'expertise'
      }))
    );
    
    setConnections(prevConnections =>
      prevConnections.map(conn => {
        if (conn.type === 'expertise-expertise') {
          return { ...conn, targetOpacity: conn.strength * 0.6, visible: true };
        }
        return { ...conn, targetOpacity: 0, visible: false };
      })
    );
  }, []);

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
  }, [generateNetworkData]);

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

      // Draw background gradient
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 2
      );
      gradient.addColorStop(0, '#f0f9ff');
      gradient.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
        
        // Color with opacity
        const r = parseInt(node.color.slice(1, 3), 16);
        const g = parseInt(node.color.slice(3, 5), 16);
        const b = parseInt(node.color.slice(5, 7), 16);
        
        const intensity = node.type === 'expertise' ? 0.9 : 0.8;
        const alpha = node.opacity * intensity;
        
        // Node circle
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, displayRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Node border
        ctx.shadowColor = 'transparent';
        const borderColor = isHoveredExpertise || isExpanded || isClickedExpertise || isHoveredResearcher ? 
          '#ffffff' : `rgba(255, 255, 255, ${node.opacity * 0.9})`;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = (isHoveredExpertise || isExpanded || isClickedExpertise || isHoveredResearcher ? 4 : 2) / scale;
        ctx.stroke();
        
        // Removed crosshairs as requested
        
        // Connection count indicator
        if (node.type === 'expertise' && node.connectionCount > 0 && scale > 0.5) {
          ctx.fillStyle = `rgba(255, 255, 255, ${node.opacity * 0.9})`;
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
          ctx.fillStyle = `rgba(255, 255, 255, ${node.opacity})`;
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
          ctx.fillStyle = `rgba(255, 255, 255, ${node.opacity * 0.7})`;
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
            <div className="flex justify-center relative">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={handleMouseClick}
                onMouseLeave={handleMouseLeave}
                onContextMenu={(e) => e.preventDefault()}
                className="border border-blue-200 rounded-lg shadow-inner cursor-pointer"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
              
              {/* View Mode Popup */}
              {viewMode.type !== 'overview' && (
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm border border-blue-200 rounded-lg px-4 py-3 shadow-lg">
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