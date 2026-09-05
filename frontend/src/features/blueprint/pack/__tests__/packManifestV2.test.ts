import {expect,test} from 'vitest';
import knowledge from '../../../../../../shared/packs/knowledge-base.v2.json';
import audit from '../../../../../../shared/packs/security-audit.v2.json';
import {validatePackV2,validatePackSchema} from '../packManifestV2';
import {validateManifest,type PackManifest} from '../packManifest';
import {createCoreCatalog} from '../../nodeCatalog';
test('shared Knowledge Base and Security Audit examples validate in dependency order',()=>{
  for(const example of [knowledge,audit]){expect(validatePackSchema(example)).toBe(true);const result=validatePackV2(example);expect(result.ok).toBe(true);if(result.ok)expect(result.order.indexOf('record-schema')).toBeLessThan(result.order.indexOf('record-template'));expect(validateManifest(example as unknown as PackManifest,createCoreCatalog()).ok).toBe(true);}
});
test('invalid references, undeclared capabilities, cycles, and future versions are rejected',()=>{
  let example=structuredClone(knowledge);example.resources[1].requires=['missing'];expect(validatePackV2(example).ok).toBe(false);
  example=structuredClone(knowledge);example.capabilities=[];expect(validatePackV2(example)).toMatchObject({ok:false,reason:'UNDECLARED_CAPABILITY'});
  example=structuredClone(knowledge);example.resources[0].requires=['record-template'];expect(validatePackV2(example).ok).toBe(false);
  example=structuredClone(knowledge);example.manifestVersion=99;expect(validatePackV2(example).ok).toBe(false);
  example=structuredClone(knowledge);example.minCatalogVersion='2.0.0';expect(validatePackV2(example).ok).toBe(false);
});
test('owner injection, unsafe removal, invalid schema refs and prototype fields fail closed',()=>{
  expect(validatePackV2({...knowledge,ownerId:99}).ok).toBe(false);
  expect(validatePackV2({...knowledge,policies:{...knowledge.policies,removal:'delete-user-content'}}).ok).toBe(false);
  expect(validatePackV2({...knowledge,resources:[{...knowledge.resources[1],spec:{title:'x',markdown:'',schemaRef:'missing'}}]}).ok).toBe(false);
  expect(validatePackV2(JSON.parse(JSON.stringify(knowledge).replace('"manifestVersion":2','"__proto__":{},"manifestVersion":2'))).ok).toBe(false);
});
