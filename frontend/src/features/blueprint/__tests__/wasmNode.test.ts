import { describe, it, expect } from 'vitest';
import { createCoreCatalog } from '../nodeCatalog';
import { deriveRequiredCapabilities, capabilityLabel } from '../capabilities';
import { readWasmModuleFile, WASM_MODULE_MAX_BYTES } from '../editor/BlueprintNodeView';
import type { FlowNode } from '../editor/reactFlowAdapter';

// action.wasm.execute frontend surface (#404): catalog descriptor, capability
// gating, and the client-side module pre-checks behind the attach UI.

const catalog = createCoreCatalog();

function makeNode(type: string): FlowNode {
  const descriptor = catalog.get(type)!;
  return {
    id: 'n_' + type,
    type: 'blueprintNode',
    position: { x: 0, y: 0 },
    data: { descriptor, nodeVersion: descriptor.version },
  };
}

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

// jsdom's File lacks arrayBuffer(); every real browser has it.
if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function (this: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

describe('action.wasm.execute descriptor', () => {
  it('is registered in the core catalog with the expected pins', () => {
    const d = catalog.get('action.wasm.execute')!;
    expect(d).toBeDefined();
    expect(d.category).toBe('action');
    expect(d.inputs.map((p) => p.id)).toEqual(['note']);
    expect(d.outputs.map((p) => p.id)).toEqual(['output']);
    expect(d.execOut).toEqual(['then']);
  });

  it('requires the wasm:execute capability', () => {
    expect(deriveRequiredCapabilities([makeNode('action.wasm.execute')])).toEqual(['wasm:execute']);
    expect(capabilityLabel('wasm:execute')).toContain('WASM');
  });
});

describe('readWasmModuleFile', () => {
  it('accepts a module with wasm magic bytes and returns base64 + sha256 + size', async () => {
    const bytes = new Uint8Array([...WASM_MAGIC, 1, 2, 3]);
    const file = new File([bytes], 'demo.wasm');
    const result = await readWasmModuleFile(file);
    expect(result.moduleName).toBe('demo.wasm');
    expect(result.moduleSize).toBe(bytes.length);
    expect(result.moduleSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(atob(result.module).charCodeAt(1)).toBe(0x61);
  });

  it('rejects a file without the wasm magic', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], 'not-wasm.wasm');
    await expect(readWasmModuleFile(file)).rejects.toThrow(/magic/i);
  });

  it('rejects an oversized module before reading it', async () => {
    const big = new File([new Uint8Array(WASM_MODULE_MAX_BYTES + 1)], 'big.wasm');
    await expect(readWasmModuleFile(big)).rejects.toThrow(/limit/i);
  });
});
