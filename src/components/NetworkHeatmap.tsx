import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

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

    const expertiseAreas = [
      { id: 'climate', name: 'Climate Change', type: 'expertise' as const },
      { id: 'pollution', name: 'Marine Pollution', type: 'expertise' as const },
      { id: 'conservation', name: 'Conservation Biology', type: 'expertise' as const },
      { id: 'ecosystem', name: 'Ecosystem Health', type: 'expertise' as const },
      { id: 'biodiversity', name: 'Marine Biodiversity', type: 'expertise' as const },
      { id: 'oceanography', name: 'Physical Oceanography', type: 'expertise' as const }
    ];

    const researcherExpertiseConnections = [
      { researcher: 'chen', expertise: 'climate', strength: 0.9 },
      { researcher: 'chen', expertise: 'conservation', strength: 0.7 },
      { researcher: 'rodriguez', expertise: 'climate', strength: 0.8 },
      { researcher: 'rodriguez', expertise: 'oceanography', strength: 0.9 },
      { researcher: 'thompson', expertise: 'pollution', strength: 0.9 },
      { researcher: 'thompson', expertise: 'ecosystem', strength: 0.6 },
      { researcher: 'wilson', expertise: 'pollution', strength: 0.8 },
      { researcher: 'park', expertise: 'oceanography', strength: 0.8 },
      { researcher: 'park', expertise: 'climate', strength: 0.6 },
      { researcher: 'kim', expertise: 'oceanography', strength: 0.7 },
      { researcher: 'garcia', expertise: 'biodiversity', strength: 0.9 },
      { researcher: 'garcia', expertise: 'conservation', strength: 0.8 },
      { researcher: 'lee', expertise: 'ecosystem', strength: 0.9 },
      { researcher: 'lee', expertise: 'biodiversity', strength: 0.7 },
      { researcher: 'patel', expertise: 'conservation', strength: 0.8 },
      { researcher: 'nakamura', expertise: 'biodiversity', strength: 0.8 },
      { researcher: 'nakamura', expertise: 'ecosystem', strength: 0.7 }
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

    // Default canvas dimensions
    const canvasWidth = 1000;
    const canvasHeight = 600;

    // Create nodes
    const allNodes: Node[] = [];
    
    // Expertise nodes
    const expertiseNodes = expertiseAreas.map((expertise, index) => {
      const researcherCount = expertiseConnectionsMap[expertise.id].researchers.length;
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const radius = Math.min(canvasWidth, canvasHeight) * 0.32;
      const angle = (index / expertiseAreas.length) * 2 * Math.PI;
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
        radius: 50 + researcherCount * 3,
        color: '#0891b2',
        connections: [
          ...expertiseConnectionsMap[expertise.id].researchers,
          ...expertiseConnectionsMap[expertise.id].connectedExpertise.map(conn => conn.id)
        ],
        connectionCount: researcherCount,
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

  // Handle expertise hover (only zoom/focus, no researcher reveal)
  // Handle expertise hover (focus should stay until clicked again)
  const handleExpertiseHover = useCallback((expertiseId: string | null) => {
    return}, [clickedExpertise, expertiseConnections, nodes]);

  // Handle expertise click (toggle focus mode)
  const handleExpertiseClick = useCallback((expertiseId: string | null) => {
    if (clickedExpertise === expertiseId) {
      // Click the same expertise again to return to overview
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
    } else {
      // Lock and focus on clicked expertise
      setClickedExpertise(expertiseId);
      setHoveredResearcher(null);

      if (expertiseId && expertiseConnections[expertiseId]) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const connectedResearchers = expertiseConnections[expertiseId].researchers;
        const expertiseNode = nodes.find(n => n.id === expertiseId);

        if (!expertiseNode) return;

        const focusScale = 1.8;
        const focusX = -(expertiseNode.baseX - canvas.width / 2);
        const focusY = -(expertiseNode.baseY - canvas.height / 2);

        setTransform(prev => ({
          ...prev,
          targetX: focusX,
          targetY: focusY,
          targetScale: focusScale
        }));

        // Update node visibility
        setNodes(prevNodes => {
          const expertiseNodes = prevNodes.filter(n => n.type === 'expertise');
          const researcherNodes = prevNodes.filter(n => n.type === 'researcher');

          const updatedExpertiseNodes = expertiseNodes.map(node => ({
            ...node,
            isExpanded: node.id === expertiseId,
            targetOpacity: node.id === expertiseId ? 1 : 0,
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
              return layouted;
            } else {
              return { ...node, targetOpacity: 0, visible: false };
            }
          });

          return [...updatedExpertiseNodes, ...updatedResearcherNodes];
        });

        // Show expertise-researcher connections
        setConnections(prevConnections =>
          prevConnections.map(conn => {
            let opacity = 0;
            let shouldShow = false;

            if (conn.type === 'expertise-expertise') {
              shouldShow = true;
              opacity = conn.from === expertiseId || conn.to === expertiseId ? 
                conn.strength * 0.4 : conn.strength * 0.1;
            } else if (conn.type === 'expertise-researcher') {
              shouldShow = conn.from === expertiseId || conn.to === expertiseId;
              opacity = shouldShow ? conn.strength * 0.7 : 0;
            }

            return { ...conn, targetOpacity: opacity, visible: shouldShow };
          })
        );
      }
    }
  }, [clickedExpertise, expertiseConnections, nodes, calculateResearcherLayout]);

  // Handle researcher hover (show interconnections when in focus mode)
  const handleResearcherHover = useCallback((researcherId: string | null) => {
    if (!clickedExpertise) return; // Only works in focus mode
    
    setHoveredResearcher(researcherId);
    
    if (researcherId && clickedExpertise && expertiseConnections[clickedExpertise]) {
      const connectedResearchers = expertiseConnections[clickedExpertise].researchers;
      
      // Show researcher-researcher connections for hovered researcher
      setConnections(prevConnections =>
        prevConnections.map(conn => {
          let opacity = 0;
          let shouldShow = false;
          
          if (conn.type === 'expertise-expertise') {
            shouldShow = true;
            opacity = conn.from === clickedExpertise || conn.to === clickedExpertise ? 
              conn.strength * 0.4 : conn.strength * 0.1;
          } else if (conn.type === 'expertise-researcher') {
            shouldShow = conn.from === clickedExpertise || conn.to === clickedExpertise;
            opacity = shouldShow ? conn.strength * 0.7 : 0;
          } else if (conn.type === 'researcher-researcher') {
            // Show connections involving the hovered researcher
            shouldShow = (conn.from === researcherId || conn.to === researcherId) &&
                        connectedResearchers.includes(conn.from) && 
                        connectedResearchers.includes(conn.to);
            opacity = shouldShow ? conn.strength * 0.8 : 0;
          }
          
          return { ...conn, targetOpacity: opacity, visible: shouldShow };
        })
      );
    } else {
      // Reset to focus mode view (no researcher interconnections)
      setConnections(prevConnections =>
        prevConnections.map(conn => {
          if (conn.type === 'researcher-researcher') {
            return { ...conn, targetOpacity: 0, visible: false };
          }
          return conn;
        })
      );
    }
  }, [clickedExpertise, expertiseConnections]);

  // Transform screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const worldX = (screenX - canvas.width / 2) / transform.scale - transform.x + canvas.width / 2;
    const worldY = (screenY - canvas.height / 2) / transform.scale - transform.y + canvas.height / 2;
    
    return { x: worldX, y: worldY };
  }, [transform]);

  // Mouse event handlers
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
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
    if (clickedExpertise) {
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
  }, [nodes, hoveredExpertise, hoveredResearcher, clickedExpertise, transform, screenToWorld, handleExpertiseHover, handleResearcherHover]);

  const handleMouseClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const { x: worldX, y: worldY } = screenToWorld(screenX, screenY);

    // Only expertise nodes can be clicked
    const clickedExpertiseId = nodes.find(node => {
      if (node.type !== 'expertise' || node.opacity < 0.1) return false;
      
      const distance = Math.sqrt(
        Math.pow(worldX - node.x, 2) + Math.pow(worldY - node.y, 2)
      );
      const adjustedRadius = node.radius / Math.max(1, Math.sqrt(transform.scale));
      return distance <= adjustedRadius;
    })?.id || null;

    if (clickedExpertiseId) {
      handleExpertiseClick(clickedExpertiseId);
    }
  }, [nodes, transform, screenToWorld, handleExpertiseClick]);

  const handleMouseLeave = useCallback(() => {
    if (!clickedExpertise) {
      handleExpertiseHover(null);
    }
    if (clickedExpertise) {
      handleResearcherHover(null);
    }
  }, [clickedExpertise, handleExpertiseHover, handleResearcherHover]);

  // Initialize network data
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 1000;
    canvas.height = 600;

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
  }, [generateNetworkData]);

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
        
        // Expansion indicator for expertise nodes
        if (node.type === 'expertise' && node.connectionCount > 0 && !isExpanded && !isClickedExpertise) {
          ctx.fillStyle = `rgba(255, 255, 255, ${node.opacity * 0.8})`;
          ctx.strokeStyle = `rgba(255, 255, 255, ${node.opacity * 0.8})`;
          ctx.lineWidth = 2 / scale;
          
          const plusSize = displayRadius * 0.3;
          ctx.beginPath();
          ctx.moveTo(node.x - plusSize, node.y);
          ctx.lineTo(node.x + plusSize, node.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(node.x, node.y - plusSize);
          ctx.lineTo(node.x, node.y + plusSize);
          ctx.stroke();
        }
        
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
              Hover to focus on expertise areas. Click to lock focus and reveal researchers. 
              In focus mode, hover researchers to see their collaborations.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onClick={handleMouseClick}
                onMouseLeave={handleMouseLeave}
                className="border border-blue-200 rounded-lg shadow-inner cursor-pointer"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
            
            <div className="mt-6 flex justify-center gap-8">
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
                  <span className="text-xs text-teal-600">🔒</span>
                </div>
                <span className="text-sm text-gray-600">Click to Lock</span>
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
                    ? hoveredResearcher
                      ? 'Showing collaborations for highlighted researcher'
                      : 'Hover over researchers to see their collaborations'
                    : 'Click to lock focus and reveal research team'
                  }
                </p>
              </div>
            )}

            <div className="mt-4 text-center text-xs text-gray-500">
              <p>Hover: Focus • Click: Lock & reveal team • In focus mode: Hover researchers for collaborations</p>
              <p>Click the same expertise area again to return to overview</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}