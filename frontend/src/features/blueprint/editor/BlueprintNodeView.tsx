// Custom React Flow node for blueprints (#274). Renders the node title plus a
// typed handle for each pin: exec pins on the top/edges (white), data pins on
// the sides, colour-coded by data type. Handle ids are encoded by reactFlowAdapter.

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { DataType } from '../nodeModel';
import {
  BlueprintNodeData,
  EXEC_IN_HANDLE,
  dataInHandle,
  dataOutHandle,
  execOutHandle,
} from './reactFlowAdapter';

const CATEGORY_COLORS: Record<string, string> = {
  trigger: '#16a34a',
  action: '#4f46e5',
  logic: '#d97706',
};

const TYPE_COLORS: Record<string, string> = {
  string: '#38bdf8',
  number: '#a3e635',
  boolean: '#f472b6',
  note: '#fbbf24',
  noteList: '#fb923c',
  tag: '#c084fc',
  link: '#2dd4bf',
  user: '#f87171',
  any: '#9ca3af',
};

function typeColor(type: DataType): string {
  return TYPE_COLORS[type] ?? '#9ca3af';
}

function BlueprintNodeViewImpl({ data, selected }: NodeProps<BlueprintNodeData>) {
  const { descriptor } = data;
  const accent = CATEGORY_COLORS[descriptor.category] ?? '#6b7280';

  return (
    <div
      className="bp-node"
      style={{ borderColor: selected ? accent : '#2a2a32', boxShadow: selected ? `0 0 0 1px ${accent}` : undefined }}
    >
      <div className="bp-node__header" style={{ background: accent }}>
        <span className="bp-node__title">{descriptor.title}</span>
        <span className="bp-node__category">{descriptor.category}</span>
      </div>

      {/* Exec row: input handle on the left, output handles stacked on the right. */}
      <div className="bp-node__exec">
        <div className="bp-node__exec-in">
          {descriptor.execIn && (
            <>
              <Handle
                id={EXEC_IN_HANDLE}
                type="target"
                position={Position.Left}
                className="bp-handle bp-handle--exec"
              />
              <span className="bp-pin-label">▶ in</span>
            </>
          )}
        </div>
        <div className="bp-node__exec-out">
          {descriptor.execOut.map((name) => (
            <div key={name} className="bp-pin-row bp-pin-row--out">
              <span className="bp-pin-label">{name} ▶</span>
              <Handle
                id={execOutHandle(name)}
                type="source"
                position={Position.Right}
                className="bp-handle bp-handle--exec"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Data pins: inputs on the left, outputs on the right. */}
      <div className="bp-node__data">
        <div className="bp-node__data-col">
          {descriptor.inputs.map((pin) => (
            <div key={pin.id} className="bp-pin-row bp-pin-row--in" title={`${pin.name}: ${pin.type}`}>
              <Handle
                id={dataInHandle(pin.id)}
                type="target"
                position={Position.Left}
                className="bp-handle bp-handle--data"
                style={{ background: typeColor(pin.type) }}
              />
              <span className="bp-pin-label">{pin.name}</span>
            </div>
          ))}
        </div>
        <div className="bp-node__data-col bp-node__data-col--out">
          {descriptor.outputs.map((pin) => (
            <div key={pin.id} className="bp-pin-row bp-pin-row--out" title={`${pin.name}: ${pin.type}`}>
              <span className="bp-pin-label">{pin.name}</span>
              <Handle
                id={dataOutHandle(pin.id)}
                type="source"
                position={Position.Right}
                className="bp-handle bp-handle--data"
                style={{ background: typeColor(pin.type) }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const BlueprintNodeView = memo(BlueprintNodeViewImpl);
