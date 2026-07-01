// Custom React Flow node for blueprints (#274). Renders the node title plus a
// typed handle for each pin: exec pins on the top/edges (white), data pins on
// the sides, colour-coded by data type. Handle ids are encoded by reactFlowAdapter.

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { DataType } from '../nodeModel';
import {
  FlowNode,
  EXEC_IN_HANDLE,
  dataInHandle,
  dataOutHandle,
  execOutHandle,
} from './reactFlowAdapter';

const CATEGORY_COLORS: Record<string, string> = {
  trigger: '#22c55e',
  action: '#4f46e5',
  logic: '#f59e0b',
};

const TYPE_COLORS: Record<string, string> = {
  string: '#3b82f6',
  number: '#a3e635',
  boolean: '#f472b6',
  note: '#f59e0b',
  noteList: '#fb923c',
  tag: '#c084fc',
  link: '#2dd4bf',
  user: '#f87171',
  any: '#71717a',
};

function typeColor(type: DataType): string {
  return TYPE_COLORS[type] ?? '#71717a';
}

const CODE_EXECUTE_DEFAULT = `function(note) {
  // note.title, note.content
  return note.title;
}`;

function BlueprintNodeViewImpl({ id, data, selected }: NodeProps<FlowNode>) {
  const { descriptor } = data;
  const accent = CATEGORY_COLORS[descriptor.category] ?? '#71717a';
  const { updateNodeData } = useReactFlow();

  const onCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { ...data, config: { ...(data.config ?? {}), code: e.target.value } });
    },
    [id, data, updateNodeData],
  );

  return (
    <div
      className="bp-node"
      style={{ borderColor: selected ? '#6366f1' : '#2a2a30', boxShadow: selected ? '0 0 0 2px #6366f1' : undefined }}
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

      {descriptor.type === 'action.code.execute' && (
        <div className="bp-node__code">
          <textarea
            className="bp-code-textarea"
            value={(data.config?.code as string) ?? CODE_EXECUTE_DEFAULT}
            onChange={onCodeChange}
            onMouseDown={(e) => e.stopPropagation()}
            rows={5}
            spellCheck={false}
            aria-label="JavaScript function body"
          />
        </div>
      )}
    </div>
  );
}

export const BlueprintNodeView = memo(BlueprintNodeViewImpl);
