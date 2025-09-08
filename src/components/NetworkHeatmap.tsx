import { useEffect, useRef, useState } from 'react';
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
  type: 'researcher' | 'publication' | 'theme';
  x: number;
  y: number;
  radius: number;
  color: string;
  connections: string[];
}

interface Connection {
  from: string;
  to: string;
  strength: number;
}

export default function NetworkHeatmap({ searchQuery, filters }: NetworkHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Mock data for network visualization
  const generateNetworkData = () => {
    const researchers = [
      { id: 'chen', name: 'Dr. S. Chen', type: 'researcher' as const },
      { id: 'rodriguez', name: 'Prof. M. Rodriguez', type: 'researcher' as const },
      { id: 'thompson', name: 'Dr. E. Thompson', type: 'researcher' as const },
      { id: 'wilson', name: 'Dr. J. Wilson', type: 'researcher' as const },
      { id: 'park', name: 'Dr. L. Park', type: 'researcher' as const },
      { id: 'kim', name: 'Dr. R. Kim', type: 'researcher' as const }
    ];

    const publications = [
      { id: 'coral-climate', name: 'Coral Climate Resilience', type: 'publication' as const },
      { id: 'deep-carbon', name: 'Deep Ocean Carbon', type: 'publication' as const },
      { id: 'microplastics', name: 'Microplastic Impact', type: 'publication' as const },
      { id: 'acidification', name: 'Ocean Acidification', type: 'publication' as const }
    ];

    const themes = [
      { id: 'climate', name: 'Climate Change', type: 'theme' as const },
      { id: 'pollution', name: 'Marine Pollution', type: 'theme' as const },
      { id: 'conservation', name: 'Conservation', type: 'theme' as const }
    ];

    const allNodes = [...researchers, ...publications, ...themes];
    const canvas = canvasRef.current;
    if (!canvas) return { nodes: [], connections: [] };

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Position nodes in clusters with ocean-themed colors
    const processedNodes: Node[] = allNodes.map((node, index) => {
      let x, y, radius, color;
      
      if (node.type === 'researcher') {
        // Researchers in a circular pattern
        const angle = (index / researchers.length) * 2 * Math.PI;
        const distance = 120;
        x = centerX + Math.cos(angle) * distance;
        y = centerY + Math.sin(angle) * distance;
        radius = 25;
        color = '#0ea5e9'; // Ocean blue
      } else if (node.type === 'publication') {
        // Publications in inner circle
        const angle = ((index - researchers.length) / publications.length) * 2 * Math.PI;
        const distance = 60;
        x = centerX + Math.cos(angle) * distance;
        y = centerY + Math.sin(angle) * distance;
        radius = 18;
        color = '#06b6d4'; // Cyan
      } else {
        // Themes in outer ring
        const angle = ((index - researchers.length - publications.length) / themes.length) * 2 * Math.PI;
        const distance = 200;
        x = centerX + Math.cos(angle) * distance;
        y = centerY + Math.sin(angle) * distance;
        radius = 30;
        color = '#0891b2'; // Dark cyan
      }

      return {
        id: node.id,
        name: node.name,
        type: node.type,
        x: x + (Math.random() - 0.5) * 40, // Add some randomness
        y: y + (Math.random() - 0.5) * 40,
        radius,
        color,
        connections: []
      };
    });

    // Generate connections
    const generatedConnections: Connection[] = [
      { from: 'chen', to: 'coral-climate', strength: 0.9 },
      { from: 'rodriguez', to: 'coral-climate', strength: 0.7 },
      { from: 'rodriguez', to: 'deep-carbon', strength: 0.9 },
      { from: 'thompson', to: 'microplastics', strength: 0.8 },
      { from: 'chen', to: 'microplastics', strength: 0.6 },
      { from: 'wilson', to: 'acidification', strength: 0.8 },
      { from: 'park', to: 'deep-carbon', strength: 0.7 },
      { from: 'kim', to: 'deep-carbon', strength: 0.6 },
      { from: 'coral-climate', to: 'climate', strength: 0.9 },
      { from: 'deep-carbon', to: 'climate', strength: 0.8 },
      { from: 'microplastics', to: 'pollution', strength: 0.9 },
      { from: 'acidification', to: 'pollution', strength: 0.7 },
      { from: 'coral-climate', to: 'conservation', strength: 0.8 }
    ];

    return { nodes: processedNodes, connections: generatedConnections };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 800;
    canvas.height = 500;

    const { nodes: newNodes, connections: newConnections } = generateNetworkData();
    setNodes(newNodes);
    setConnections(newConnections);
  }, [searchQuery, filters]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

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

    // Draw connections
    connections.forEach(connection => {
      const fromNode = nodes.find(n => n.id === connection.from);
      const toNode = nodes.find(n => n.id === connection.to);
      
      if (fromNode && toNode) {
        ctx.strokeStyle = `rgba(6, 182, 212, ${connection.strength * 0.6})`;
        ctx.lineWidth = connection.strength * 3;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const isHovered = hoveredNode === node.id;
      
      // Node shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = isHovered ? 15 : 5;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // Node circle
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, isHovered ? node.radius * 1.2 : node.radius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Node border
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Node text
      ctx.fillStyle = '#ffffff';
      ctx.font = `${isHovered ? '12px' : '10px'} Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Wrap long text
      const words = node.name.split(' ');
      if (words.length > 1 && node.name.length > 12) {
        words.forEach((word, index) => {
          ctx.fillText(word, node.x, node.y + (index - 0.5) * 12);
        });
      } else {
        ctx.fillText(node.name, node.x, node.y);
      }
      
      // Type indicator
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '8px Arial';
      ctx.fillText(node.type, node.x, node.y + node.radius + 15);
    });
  }, [nodes, connections, hoveredNode]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const hoveredNodeId = nodes.find(node => {
      const distance = Math.sqrt(
        Math.pow(mouseX - node.x, 2) + Math.pow(mouseY - node.y, 2)
      );
      return distance <= node.radius;
    })?.id || null;

    setHoveredNode(hoveredNodeId);
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
  };

  return (
    <section className="bg-gradient-to-b from-slate-50 to-blue-50 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-blue-900 text-center">
              Research Network Visualization
            </CardTitle>
            <p className="text-gray-600 text-center">
              Explore connections between researchers, publications, and research themes
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
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                <span className="text-sm text-gray-600">Researchers</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-cyan-500"></div>
                <span className="text-sm text-gray-600">Publications</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-teal-600"></div>
                <span className="text-sm text-gray-600">Research Themes</span>
              </div>
            </div>

            {hoveredNode && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  Hovering over: <span className="font-medium">{nodes.find(n => n.id === hoveredNode)?.name}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}