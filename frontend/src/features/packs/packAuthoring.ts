import schema from '../blueprint/pack/pack-manifest-v2.schema.json';
import {validatePackV2,resourceCapabilities,type PackResource} from '../blueprint/pack/packManifestV2';
import {validateManifest,type PackManifest} from '../blueprint/pack/packManifest';
import {createCoreCatalog} from '../blueprint/nodeCatalog';
export type FormSchema={type?:string|string[];enum?:unknown[];properties?:Record<string,FormSchema>;required?:string[];items?:FormSchema;minLength?:number;maxLength?:number;maxItems?:number;minItems?:number;oneOf?:FormSchema[];additionalProperties?:boolean;pattern?:string};
export const manifestSchema=schema as unknown as FormSchema;
export function resourceSchema(kind:string):FormSchema{return manifestSchema.properties!.resources.items!.oneOf!.find(rule=>rule.properties!.kind.enum![0]===kind)?.properties?.spec??{type:'object'};}
export function defaultValue(rule:FormSchema):unknown{if(rule.enum)return rule.enum[0];if(rule.type==='object')return Object.fromEntries((rule.required??[]).map(key=>[key,defaultValue(rule.properties?.[key]??{})]));if(rule.type==='array')return [];if(rule.type==='boolean')return false;if(rule.type==='number'||rule.type==='integer')return 0;return '';}
export function referencedIds(spec:Record<string,unknown>):string[]{if(!spec||typeof spec!=='object')return [];return [...['schemaRef','queryRef','templateRef','dashboardRef'].flatMap(key=>typeof spec[key]==='string'&&spec[key]?[spec[key] as string]:[]),...(Array.isArray(spec.viewRefs)?spec.viewRefs as string[]:[])];}
export function updateResource(resource:PackResource,spec:Record<string,unknown>):PackResource{
  const old=new Set(referencedIds(resource.spec));const requires=[...new Set([...resource.requires.filter(id=>!old.has(id)),...referencedIds(spec)])].sort();
  const capabilities=new Set(resource.capabilities);capabilities.add(resourceCapabilities[resource.kind]);
  if(resource.kind==='permissionPreset'&&Array.isArray(spec.requested))for(const cap of spec.requested)if(typeof cap==='string')capabilities.add(cap);
  if(resource.kind==='blueprint'&&spec.ir&&typeof spec.ir==='object'){const ir=spec.ir as {nodes?:{type:string}[]};for(const node of ir.nodes??[]){const cap=createCoreCatalog().get(node.type)?.capability;if(cap)capabilities.add(cap);}}
  return {...resource,spec,requires,capabilities:[...capabilities].sort()};
}
export function withResources(manifest:PackManifest,resources:PackResource[]):PackManifest{return {...manifest,resources,capabilities:[...new Set(resources.flatMap(resource=>resource.capabilities))].sort()};}
export interface Diagnostic {path:string;message:string}
export function diagnosePack(manifest:PackManifest):Diagnostic[]{
  const errors:Diagnostic[]=[];const resources=Array.isArray(manifest.resources)?manifest.resources:[];const ids=new Set(resources.filter(resource=>resource&&typeof resource==='object').map(resource=>resource.id));
  const walk=(value:unknown,rule:FormSchema,path:string)=>{
    if(rule.oneOf){const selected=rule.oneOf.find(choice=>choice.properties?.kind.enum?.includes((value as {kind?:string})?.kind));if(selected)walk(value,selected,path);else errors.push({path,message:'Choose a supported contribution kind.'});return;}
    if(rule.type==='object'){if(!value||typeof value!=='object'||Array.isArray(value)){errors.push({path,message:'An object is required.'});return;}const object=value as Record<string,unknown>;for(const key of rule.required??[])if(!Object.prototype.hasOwnProperty.call(object,key))errors.push({path:`${path}.${key}`,message:'Required field is missing.'});for(const [key,item] of Object.entries(object)){if(rule.properties&&Object.prototype.hasOwnProperty.call(rule.properties,key))walk(item,rule.properties[key],`${path}.${key}`);else if(rule.additionalProperties===false)errors.push({path:`${path}.${key}`,message:'Unknown field.'});}}
    else if(rule.type==='array'){if(!Array.isArray(value)){errors.push({path,message:'A list is required.'});return;}if(value.length>(rule.maxItems??Infinity))errors.push({path,message:'Too many entries.'});if(value.length<(rule.minItems??0))errors.push({path,message:'Add at least one entry.'});value.forEach((item,index)=>{if(rule.items)walk(item,rule.items,`${path}[${index}]`);});}
    else if(rule.type==='string'){if(typeof value!=='string'||Array.from(value).length<(rule.minLength??0)||Array.from(value).length>(rule.maxLength??Infinity)||rule.pattern&&!new RegExp(rule.pattern).test(value))errors.push({path,message:'Invalid value or identifier.'});}
    if(rule.enum&&!rule.enum.includes(value))errors.push({path,message:`Choose one of: ${rule.enum.join(', ')}.`});
  };
  walk(manifest,manifestSchema,'manifest');
  resources.forEach((resource,index)=>{if(!resource||typeof resource!=='object')return;const path=`resources[${index}] (${resource.id})`;(Array.isArray(resource.requires)?resource.requires:[]).forEach((ref,position)=>{if(!ids.has(ref))errors.push({path:`${path}.requires[${position}]`,message:`Missing resource: ${ref}.`});});for(const ref of referencedIds(resource.spec))if(!ids.has(ref))errors.push({path:`${path}.spec`,message:`Reference ${ref} does not exist.`});for(const capability of Array.isArray(resource.capabilities)?resource.capabilities:[])if(!manifest.capabilities?.includes(capability))errors.push({path:`${path}.capabilities`,message:`Undeclared capability: ${capability}.`});});
  if(!errors.length){
    const byId=new Map(resources.map(resource=>[resource.id,resource]));
    resources.forEach((resource,index)=>{
      const path=`resources[${index}] (${resource.id})`;
      const expected:Record<string,string>={schemaRef:'propertySchema',queryRef:'savedQuery',templateRef:'template',dashboardRef:'dashboard'};
      const checkRef=(ref:unknown,kind:string,field:string)=>{const target=byId.get(String(ref));if(!target||target.kind!==kind)errors.push({path:`${path}.spec.${field}`,message:`Reference ${String(ref)} must identify a ${kind}.`});else if(!resource.requires.includes(target.id))errors.push({path:`${path}.requires`,message:`Declare prerequisite ${target.id}.`});};
      for(const [field,kind] of Object.entries(expected))if(resource.spec[field])checkRef(resource.spec[field],kind,field);
      if(Array.isArray(resource.spec.viewRefs))resource.spec.viewRefs.forEach((ref,i)=>checkRef(ref,'view',`viewRefs[${i}]`));
      if(resource.kind==='savedQuery'){
        const fields=byId.get(String(resource.spec.schemaRef))?.spec.fields as {id:string}[]|undefined;
        (resource.spec.filters as {property:string}[]).forEach((filter,i)=>{if(!fields?.some(field=>field.id===filter.property))errors.push({path:`${path}.spec.filters[${i}].property`,message:`Unknown property: ${filter.property}.`});});
      }
      if(resource.kind==='view'&&resource.spec.layout==='board'&&!resource.spec.groupBy)errors.push({path:`${path}.spec.groupBy`,message:'Choose a property for board columns.'});
    });
    const active=new Set<string>(),done=new Set<string>();
    const visit=(id:string)=>{if(done.has(id))return;if(active.has(id)){errors.push({path:`resources (${id}).requires`,message:`Dependency cycle includes ${id}.`});return;}active.add(id);for(const ref of byId.get(id)?.requires??[])visit(ref);active.delete(id);done.add(id);};
    for(const id of byId.keys())visit(id);
  }
  if(!errors.length){const check=validatePackV2(manifest);if(!check.ok)errors.push({path:'resources',message:check.reason});else {const full=validateManifest(manifest,createCoreCatalog());if(!full.ok)errors.push({path:resources.filter(resource=>resource.kind==='blueprint').map(resource=>resource.id).join(', ')||'manifest',message:full.reason});}}
  return errors;
}
