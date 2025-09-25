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

export default function NetworkHeatmap({ searchQuery, filters }: NetworkHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [hoveredExpertise, setHoveredExpertise] = useState<string | null>(null);
  const [expertiseConnections, setExpertiseConnections] = useState<ExpertiseConnections>({});

  // Animation system for smooth transitions
  const animateNodes = useCallback(() => {
    setNodes(prevNodes => 
      prevNodes.map(node => ({
        ...node,
        x: node.x + (node.targetX - node.x) * 0.12,
        y: node.y + (node.targetY - node.y) * 0.12,
        opacity: node.opacity + (node.targetOpacity - node.opacity) * 0.12
      }))
    );

    setConnections(prevConnections =>
      prevConnections.map(conn => ({
        ...conn,
        opacity: conn.opacity + (conn.targetOpacity - conn.opacity) * 0.12
      }))
    );
  }, []);

  // Layout expertise nodes in a clean circle
  const layoutExpertiseNodes = useCallback((expertiseNodes: Node[], canvas: HTMLCanvasElement) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.32;

    expertiseNodes.forEach((node, index) => {
      const angle = (index / expertiseNodes.length) * 2 * Math.PI;
      node.targetX = centerX + Math.cos(angle) * radius;
      node.targetY = centerY + Math.sin(angle) * radius;
      node.targetOpacity = 1;
      node.visible = true;
    });
  }, []);

  // Layout researcher nodes in a star pattern around hovered expertise
  const layoutResearcherNodes = useCallback((
    hoveredExpertiseNode: Node, 
    researcherNodes: Node[], 
    canvas: HTMLCanvasElement
  ) => {
    const baseRadius = 120;
    const maxRadius = 180;
    
    researcherNodes.forEach((node, index) => {
      const angle = (index / researcherNodes.length) * 2 * Math.PI;
      // Vary radius slightly to create more organic layout
      const radiusVariation = Math.sin(index * 2.5) * 30;
      const radius = baseRadius + radiusVariation + (index % 2) * 30;
      
      node.targetX = hoveredExpertiseNode.x + Math.cos(angle) * radius;
      node.targetY = hoveredExpertiseNode.y + Math.sin(angle) * radius;
      node.targetOpacity = 0.85;
      node.visible = true;

      // Keep nodes within canvas bounds
      const margin = node.radius + 10;
      node.targetX = Math.max(margin, Math.min(canvas.width - margin, node.targetX));
      node.targetY = Math.max(margin, Math.min(canvas.height - margin, node.targetY));
    });
  }, []);

  // Generate expertise-focused network data
  const generateNetworkData = () => {
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

    // Define researcher-expertise relationships
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

    const canvas = canvasRef.current;
    if (!canvas) return { nodes: [], connections: [], expertiseConnections: {} };

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

    // Calculate inter-expertise connections based on shared researchers
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

    // Create nodes
    const allNodes: Node[] = [];
    
    // Expertise nodes (always visible)
    expertiseAreas.forEach(expertise => {
      const researcherCount = expertiseConnectionsMap[expertise.id].researchers.length;
      const baseRadius = 50;
      const radius = baseRadius + researcherCount * 3;
      
      allNodes.push({
        id: expertise.id,
        name: expertise.name,
        type: 'expertise',
        x: canvas.width / 2,
        y: canvas.height / 2,
        targetX: canvas.width / 2,
        targetY: canvas.height / 2,
        radius,
        color: '#0891b2',
        connections: [
          ...expertiseConnectionsMap[expertise.id].researchers,
          ...expertiseConnectionsMap[expertise.id].connectedExpertise.map(conn => conn.id)
        ],
        connectionCount: researcherCount,
        visible: true,
        opacity: 1,
        targetOpacity: 1
      });
    });

    // Researcher nodes (hidden by default)
    researchers.forEach(researcher => {
      const userExpertise = researcherExpertiseConnections.filter(conn => conn.researcher === researcher.id);
      const connectionCount = userExpertise.length;
      
      allNodes.push({
        id: researcher.id,
        name: researcher.name,
        type: 'researcher',
        x: canvas.width / 2,
        y: canvas.height / 2,
        targetX: canvas.width / 2,
        targetY: canvas.height / 2,
        radius: 35 + connectionCount * 2,
        color: '#0ea5e9',
        connections: userExpertise.map(conn => conn.expertise),
        connectionCount,
        visible: false,
        opacity: 0,
        targetOpacity: 0
      });
    });

    // Create connections
    const allConnections: Connection[] = [];

    // Expertise-expertise connections (visible by default)
    expertiseAreas.forEach(expertise1 => {
      expertiseConnectionsMap[expertise1.id].connectedExpertise.forEach(conn => {
        // Avoid duplicate connections
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

    // Expertise-researcher connections (hidden by default)
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

    // Researcher-researcher connections (for when both are visible)
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
  };

  // Handle expertise node hover
  const handleExpertiseHover = useCallback((expertiseId: string | null) => {
    setHoveredExpertise(expertiseId);
    
    if (expertiseId && expertiseConnections[expertiseId]) {
      const connectedResearchers = expertiseConnections[expertiseId].researchers;
      
      // Show connected researchers
      setNodes(prevNodes => 
        prevNodes.map(node => {
          if (node.type === 'researcher' && connectedResearchers.includes(node.id)) {
            return { ...node, targetOpacity: 0.85, visible: true };
          } else if (node.type === 'researcher') {
            return { ...node, targetOpacity: 0, visible: false };
          } else if (node.id === expertiseId) {
            return { ...node, isExpanded: true };
          } else {
            return { ...node, isExpanded: false };
          }
          return node;
        })
      );
      
      // Update connections visibility
      setConnections(prevConnections =>
        prevConnections.map(conn => {
          let shouldShow = false;
          let opacity = 0;
          
          if (conn.type === 'expertise-expertise') {
            // Keep expertise-expertise connections but dim them
            shouldShow = true;
            opacity = conn.from === expertiseId || conn.to === expertiseId ? 
              conn.strength * 0.8 : conn.strength * 0.3;
          } else if (conn.type === 'expertise-researcher') {
            // Show if connected to hovered expertise
            shouldShow = conn.from === expertiseId || conn.to === expertiseId;
            opacity = shouldShow ? conn.strength * 0.7 : 0;
          } else if (conn.type === 'researcher-researcher') {
            // Show if both researchers are visible
            const fromVisible = connectedResearchers.includes(conn.from);
            const toVisible = connectedResearchers.includes(conn.to);
            shouldShow = fromVisible && toVisible;
            opacity = shouldShow ? conn.strength * 0.5 : 0;
          }
          
          return {
            ...conn,
            targetOpacity: opacity,
            visible: shouldShow
          };
        })
      );
    } else {
      // Hide all researchers and reset connections
      setNodes(prevNodes => 
        prevNodes.map(node => {
          if (node.type === 'researcher') {
            return { ...node, targetOpacity: 0, visible: false };
          } else {
            return { ...node, isExpanded: false };
          }
          return node;
        })
      );
      
      setConnections(prevConnections =>
        prevConnections.map(conn => {
          if (conn.type === 'expertise-expertise') {
            return { ...conn, targetOpacity: conn.strength * 0.6, visible: true };
          } else {
            return { ...conn, targetOpacity: 0, visible: false };
          }
        })
      );
    }
  }, [expertiseConnections]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 1000;
    canvas.height = 600;

    const { nodes: newNodes, connections: newConnections, expertiseConnections: newExpertiseConnections } = generateNetworkData();
    setNodes(newNodes);
    setConnections(newConnections);
    setExpertiseConnections(newExpertiseConnections);
  }, [searchQuery, filters]);

  // Update layout when nodes change or expertise is hovered
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const expertiseNodes = nodes.filter(n => n.type === 'expertise');
    const researcherNodes = nodes.filter(n => n.type === 'researcher' && n.visible);
    
    // Layout expertise nodes
    layoutExpertiseNodes(expertiseNodes, canvas);
    
    // Layout researcher nodes around hovered expertise
    if (hoveredExpertise && researcherNodes.length > 0) {
      const hoveredExpertiseNode = expertiseNodes.find(n => n.id === hoveredExpertise);
      if (hoveredExpertiseNode) {
        layoutResearcherNodes(hoveredExpertiseNode, researcherNodes, canvas);
      }
    }
  }, [nodes, hoveredExpertise, layoutExpertiseNodes, layoutResearcherNodes]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      animateNodes();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animateNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background gradient
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 2
      );
      gradient.addColorStop(0, '#f0f9ff');
      gradient.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw connections with animated opacity
      connections.forEach(connection => {
        if (connection.opacity < 0.01) return;
        
        const fromNode = nodes.find(n => n.id === connection.from);
        const toNode = nodes.find(n => n.id === connection.to);
        
        if (fromNode && toNode && fromNode.opacity > 0.01 && toNode.opacity > 0.01) {
          let strokeColor, lineWidth;
          
          if (connection.type === 'expertise-expertise') {
            strokeColor = `rgba(8, 145, 178, ${connection.opacity})`;
            lineWidth = Math.max(2, connection.strength * 8); // Thicker lines for stronger connections
          } else if (connection.type === 'expertise-researcher') {
            strokeColor = `rgba(14, 165, 233, ${connection.opacity})`;
            lineWidth = connection.strength * 3 + 1;
          } else {
            strokeColor = `rgba(6, 182, 212, ${connection.opacity})`;
            lineWidth = connection.strength * 2 + 1;
          }
          
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          
          // Use different line styles for different connection types
          if (connection.type === 'expertise-expertise') {
            // Straight lines for expertise connections
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

      // Draw nodes with animated opacity
      nodes.forEach(node => {
        if (node.opacity < 0.01) return;
        
        const isHovered = hoveredExpertise === node.id;
        const isExpanded = node.isExpanded;
        
        // Node shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = isHovered ? 20 : (node.type === 'expertise' ? 12 : 8);
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        
        // Calculate display radius with expansion effect
        let displayRadius = node.radius;
        if (isExpanded && node.type === 'expertise') displayRadius *= 1.25;
        else if (isHovered) displayRadius *= 1.1;
        
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
        ctx.strokeStyle = isHovered || isExpanded ? '#ffffff' : `rgba(255, 255, 255, ${node.opacity * 0.9})`;
        ctx.lineWidth = isHovered || isExpanded ? 4 : 2;
        ctx.stroke();
        
        // Expansion indicator for expertise nodes with researchers
        if (node.type === 'expertise' && node.connectionCount > 0 && !isExpanded) {
          ctx.fillStyle = `rgba(255, 255, 255, ${node.opacity * 0.8})`;
          ctx.strokeStyle = `rgba(255, 255, 255, ${node.opacity * 0.8})`;
          ctx.lineWidth = 2;
          
          const plusSize = displayRadius * 0.3;
          // Horizontal line
          ctx.beginPath();
          ctx.moveTo(node.x - plusSize, node.y);
          ctx.lineTo(node.x + plusSize, node.y);
          ctx.stroke();
          // Vertical line
          ctx.beginPath();
          ctx.moveTo(node.x, node.y - plusSize);
          ctx.lineTo(node.x, node.y + plusSize);
          ctx.stroke();
        }
        
        // Connection count indicator for expertise nodes
        if (node.type === 'expertise' && node.connectionCount > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${node.opacity * 0.9})`;
          const countRadius = Math.min(14, node.connectionCount * 1.5 + 8);
          ctx.beginPath();
          ctx.arc(node.x + displayRadius * 0.65, node.y - displayRadius * 0.65, countRadius, 0, 2 * Math.PI);
          ctx.fill();
          
          ctx.fillStyle = node.color;
          ctx.font = 'bold 11px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.connectionCount.toString(), 
                      node.x + displayRadius * 0.65, 
                      node.y - displayRadius * 0.65);
        }
        
        // Node text with better visibility
        if (node.opacity > 0.2) {
          ctx.fillStyle = `rgba(255, 255, 255, ${node.opacity})`;
          const fontSize = node.type === 'expertise' ? (isHovered ? 14 : 12) : (isHovered ? 12 : 10);
          ctx.font = `${node.type === 'expertise' ? 'bold' : ''} ${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Multi-line text for longer names
          const words = node.name.split(' ');
          if (words.length > 1 && node.name.length > 15) {
            words.forEach((word, index) => {
              ctx.fillText(word, node.x, node.y + (index - (words.length - 1) / 2) * (fontSize + 2));
            });
          } else {
            ctx.fillText(node.name, node.x, node.y);
          }
        }
        
        // Type indicator for researcher nodes
        if (node.type === 'researcher' && node.opacity > 0.4) {
          ctx.fillStyle = `rgba(255, 255, 255, ${node.opacity * 0.7})`;
          ctx.font = '8px Arial';
          ctx.fillText('researcher', node.x, node.y + displayRadius + 14);
        }
      });
      
      requestAnimationFrame(draw);
    };

    draw();
  }, [nodes, connections, hoveredExpertise]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Only detect expertise nodes for hover
    const hoveredExpertiseId = nodes.find(node => {
      if (node.type !== 'expertise' || node.opacity < 0.1) return false;
      
      const distance = Math.sqrt(
        Math.pow(mouseX - node.x, 2) + Math.pow(mouseY - node.y, 2)
      );
      return distance <= node.radius;
    })?.id || null;

    handleExpertiseHover(hoveredExpertiseId);
  };

  const handleMouseLeave = () => {
    handleExpertiseHover(null);
  };

  return (
    <section className="bg-gradient-to-b from-slate-50 to-blue-50 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-blue-900 text-center">
              Research Expertise Network
            </CardTitle>
            <p className="text-gray-600 text-center">
              Hover over expertise areas to reveal connected researchers and their collaboration networks. 
              Line thickness represents the strength of connections between expertise areas.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
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
                <span className="text-sm text-gray-600">Expertise Connections</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-white border-2 border-teal-600 relative flex items-center justify-center">
                  <span className="text-xs text-teal-600">+</span>
                </div>
                <span className="text-sm text-gray-600">Expandable</span>
              </div>
            </div>

            {hoveredExpertise && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  Exploring: <span className="font-medium">{nodes.find(n => n.id === hoveredExpertise)?.name}</span>
                  {nodes.find(n => n.id === hoveredExpertise) && (
                    <span className="ml-2 text-xs text-blue-600">
                      ({nodes.find(n => n.id === hoveredExpertise)?.connectionCount} researchers)
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Showing connected researchers and their collaboration networks
                </p>
              </div>
            )}

            <div className="mt-4 text-center text-xs text-gray-500">
              <p>The network shows expertise areas connected by shared researchers.</p>
              <p>Hover over any expertise area to see its research community and internal collaborations.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}