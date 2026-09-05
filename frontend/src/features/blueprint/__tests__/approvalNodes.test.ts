import { expect, test } from 'vitest';
import { createCoreCatalog } from '../nodeCatalog';
import { DataTypes, isAssignable } from '../nodeModel';
import { validateIR, type BlueprintIR } from '../blueprintIR';
import sample from '../../../../../docs/blueprint/examples/approval-request.json';
test('sample approval graph type checks with dedicated request and decision references',()=>{
  const catalog=createCoreCatalog();expect(validateIR(sample as BlueprintIR,catalog)).toEqual({ok:true});
  expect(catalog.get('logic.approval.result')?.execOut).toEqual(['approved','rejected','expired']);
  expect(isAssignable(DataTypes.ApprovalRequest,DataTypes.Boolean)).toBe(false);
  expect(isAssignable(DataTypes.ApprovalDecision,DataTypes.ApprovalRequest)).toBe(false);
  expect(catalog.get('logic.approval.result')?.outputs.find(pin=>pin.id==='approved')?.type).toBe(DataTypes.Boolean);
});
