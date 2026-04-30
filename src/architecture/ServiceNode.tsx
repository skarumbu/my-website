import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ServiceNodeData } from './arch-graph-data.ts';

const COLOR_STYLES: Record<ServiceNodeData['color'], { border: string; label: string }> = {
  blue:   { border: '#388bfd', label: '#58a6ff' },
  green:  { border: '#2ea043', label: '#3fb950' },
  orange: { border: '#9e6a03', label: '#d29922' },
  purple: { border: '#6e40c9', label: '#bc8cff' },
  gray:   { border: '#30363d', label: '#8b949e' },
};

export default function ServiceNode({ data, selected }: NodeProps<ServiceNodeData>) {
  const colors = COLOR_STYLES[data.color];

  return (
    <div
      style={{
        background: selected ? '#1c2128' : '#161b22',
        border: `1.5px solid ${selected ? colors.label : colors.border}`,
        borderRadius: 8,
        padding: '10px 14px',
        minWidth: 150,
        maxWidth: 180,
        cursor: 'pointer',
        boxShadow: selected ? `0 0 0 2px ${colors.border}44` : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: colors.border, border: 'none', width: 8, height: 8 }} />

      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: colors.label, marginBottom: 3 }}>
        {data.label}
      </div>
      <div style={{ fontSize: '0.68rem', color: '#8b949e', lineHeight: 1.3 }}>
        {data.subtitle}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, border: 'none', width: 8, height: 8 }} />
    </div>
  );
}
