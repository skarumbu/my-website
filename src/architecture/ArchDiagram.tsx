import React, { useState, useCallback } from 'react';
import '@xyflow/react/dist/style.css';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  NodeMouseHandler,
} from '@xyflow/react';
import { initialNodes, initialEdges, ArchNode } from './arch-graph-data.ts';
import ServiceNode from './ServiceNode.tsx';
import ServicePanel from './ServicePanel.tsx';

const nodeTypes = { service: ServiceNode };

const miniMapNodeColor = (node: ArchNode) => {
  const map: Record<string, string> = {
    blue: '#388bfd', green: '#2ea043', orange: '#9e6a03', purple: '#6e40c9', gray: '#30363d',
  };
  return map[(node.data as any).color] ?? '#30363d';
};

export default function ArchDiagram() {
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(node as ArchNode);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          width: '100%',
          height: 560,
          background: '#0d1117',
          borderRadius: 8,
          border: '1px solid #30363d',
        }}
      >
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#21262d" />
          <Controls style={{ background: '#161b22', border: '1px solid #30363d' }} />
          <MiniMap
            nodeColor={miniMapNodeColor as any}
            maskColor="rgba(13,17,23,0.75)"
            style={{ background: '#161b22', border: '1px solid #30363d' }}
          />
        </ReactFlow>
      </div>

      {selectedNode && (
        <ServicePanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}

      <p style={{ fontSize: '0.75rem', color: '#6e7681', marginTop: '0.5rem' }}>
        Click any node to see details · Scroll to zoom · Drag to pan
      </p>
    </div>
  );
}
