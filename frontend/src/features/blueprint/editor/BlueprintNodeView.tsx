// Custom React Flow node for blueprints (#274). Renders the node title plus a
// typed handle for each pin: exec pins on the top/edges, data pins on the
// sides, colour-coded by data type (with a visible type chip as the non-colour
// affordance). Handle ids are encoded by reactFlowAdapter. All colours derive
// from design tokens (categoryMeta.ts + editor.css), so nodes follow themes.

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { cn } from '@/ui';
import { categoryMeta, pinTypeMeta } from './categoryMeta';
import {
  FlowNode,
  EXEC_IN_HANDLE,
  dataInHandle,
  dataOutHandle,
  execOutHandle,
} from './reactFlowAdapter';

const CODE_EXECUTE_DEFAULT = `function(note) {
  // note.title, note.content
  return note.title;
}`;

function BlueprintNodeViewImpl({ id, data, selected }: NodeProps<FlowNode>) {
  const { descriptor } = data;
  const category = categoryMeta(descriptor.category);
  const { updateNodeData } = useReactFlow();

  const onCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { ...data, config: { ...(data.config ?? {}), code: e.target.value } });
    },
    [id, data, updateNodeData],
  );

  return (
    <div
      className={cn(
        'bp-node border bg-surface',
        selected ? 'border-primary-hover ring-2 ring-primary-hover/60' : 'border-border-strong',
      )}
    >
      {/* Tinted header (Badge pattern): category /15 tint + category text colour + left accent. */}
      <div
        className={cn(
          'bp-node__header border-l-[3px]',
          category.borderClass,
          category.bgClass,
          category.textClass,
        )}
      >
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
              <span className="bp-pin-label">in</span>
            </>
          )}
        </div>
        <div className="bp-node__exec-out">
          {descriptor.execOut.map((name) => (
            <div key={name} className="bp-pin-row bp-pin-row--out">
              <span className="bp-pin-label">{name}</span>
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
          {descriptor.inputs.map((pin) => {
            const meta = pinTypeMeta(pin.type);
            return (
              <div key={pin.id} className="bp-pin-row bp-pin-row--in" title={`${pin.name}: ${pin.type}`}>
                <Handle
                  id={dataInHandle(pin.id)}
                  type="target"
                  position={Position.Left}
                  className="bp-handle bp-handle--data"
                  style={{ background: meta.color }}
                />
                <span className="bp-pin-label">{pin.name}</span>
                <span className="bp-pin-type">{meta.label}</span>
              </div>
            );
          })}
        </div>
        <div className="bp-node__data-col bp-node__data-col--out">
          {descriptor.outputs.map((pin) => {
            const meta = pinTypeMeta(pin.type);
            return (
              <div key={pin.id} className="bp-pin-row bp-pin-row--out" title={`${pin.name}: ${pin.type}`}>
                <span className="bp-pin-type">{meta.label}</span>
                <span className="bp-pin-label">{pin.name}</span>
                <Handle
                  id={dataOutHandle(pin.id)}
                  type="source"
                  position={Position.Right}
                  className="bp-handle bp-handle--data"
                  style={{ background: meta.color }}
                />
              </div>
            );
          })}
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
