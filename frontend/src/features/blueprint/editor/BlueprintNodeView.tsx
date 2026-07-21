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

/** ADR 0003: inline module cap (raw bytes). Mirrors WasmModuleValidator.MAX_MODULE_BYTES. */
export const WASM_MODULE_MAX_BYTES = 512 * 1024;

/** Client-side pre-checks for a .wasm file; the backend re-validates the full rule set. */
export async function readWasmModuleFile(
  file: File,
): Promise<{ module: string; moduleName: string; moduleSha256: string; moduleSize: number }> {
  if (file.size > WASM_MODULE_MAX_BYTES) {
    throw new Error(
      `Module is ${(file.size / 1024).toFixed(0)} KiB — the limit is ${WASM_MODULE_MAX_BYTES / 1024} KiB.`,
    );
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    throw new Error('Not a WebAssembly module (missing \\0asm magic bytes).');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const moduleSha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { module: btoa(binary), moduleName: file.name, moduleSha256, moduleSize: bytes.length };
}

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

  const onModuleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // allow re-selecting the same file
      if (!file) return;
      readWasmModuleFile(file)
        .then((moduleConfig) =>
          updateNodeData(id, {
            ...data,
            config: { ...(data.config ?? {}), ...moduleConfig, moduleError: undefined },
          }),
        )
        .catch((err: Error) =>
          updateNodeData(id, {
            ...data,
            config: { ...(data.config ?? {}), moduleError: err.message },
          }),
        );
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

      {descriptor.type === 'action.wasm.execute' && (
        <div className="bp-node__code" onMouseDown={(e) => e.stopPropagation()}>
          {data.config?.module ? (
            <div className="text-xs" data-testid="wasm-module-info">
              <div className="font-medium truncate" title={data.config.moduleName as string}>
                {(data.config.moduleName as string) ?? 'module.wasm'}
              </div>
              <div className="text-muted-foreground">
                {Math.max(1, Math.round(((data.config.moduleSize as number) ?? 0) / 1024))} KiB
                {' · sha256 '}
                <code>{((data.config.moduleSha256 as string) ?? '').slice(0, 12)}</code>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No module attached.</div>
          )}
          <label className="bp-wasm-attach text-xs underline cursor-pointer">
            {data.config?.module ? 'Replace module…' : 'Attach .wasm module…'}
            <input
              type="file"
              accept=".wasm,application/wasm"
              onChange={onModuleFile}
              className="hidden"
              aria-label="WebAssembly module file"
            />
          </label>
          {typeof data.config?.moduleError === 'string' && (
            <div className="text-xs text-destructive" role="alert" data-testid="wasm-module-error">
              {data.config.moduleError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const BlueprintNodeView = memo(BlueprintNodeViewImpl);
