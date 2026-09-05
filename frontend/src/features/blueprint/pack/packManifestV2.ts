import schema from '../../../../../backend/src/main/resources/pack-manifest-v2.schema.json';
export interface PackResource {id:string;kind:'plugin'|'blueprint'|'propertySchema'|'template'|'savedQuery'|'view'|'dashboard'|'workspaceMode'|'permissionPreset'|'demoData';title:string;requires:string[];capabilities:string[];spec:Record<string,unknown>}
export const resourceCapabilities:Record<PackResource['kind'],string>={plugin:'plugins:install',blueprint:'blueprints:write',propertySchema:'properties:schema',template:'templates:write',savedQuery:'queries:write',view:'workspace:configure',dashboard:'dashboard:configure',workspaceMode:'workspace:configure',permissionPreset:'permissions:request',demoData:'notes:write'};
type Schema={oneOf?:Schema[];enum?:unknown[];type?:string|string[];minLength?:number;maxLength?:number;pattern?:string;minItems?:number;maxItems?:number;uniqueItems?:boolean;items?:Schema;required?:string[];properties?:Record<string,Schema>;additionalProperties?:boolean};
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
function isType(value:unknown,type:string){return type==='object'?object(value):type==='array'?Array.isArray(value):type==='null'?value===null:type==='integer'?Number.isInteger(value):typeof value===type;}
export function validatePackSchema(value:unknown,rule:Schema=schema as unknown as Schema):boolean {
  if(rule.oneOf&&rule.oneOf.filter(choice=>validatePackSchema(value,choice)).length!==1)return false;
  if(rule.enum&&!rule.enum.some(option=>JSON.stringify(option)===JSON.stringify(value)))return false;
  if(rule.type&&!(Array.isArray(rule.type)?rule.type:[rule.type]).some(type=>isType(value,type)))return false;
  if(typeof value==='string'&&(Array.from(value).length<(rule.minLength??0)||Array.from(value).length>(rule.maxLength??Infinity)||rule.pattern&&!new RegExp(rule.pattern).test(value)))return false;
  if(Array.isArray(value)){if(value.length<(rule.minItems??0)||value.length>(rule.maxItems??Infinity))return false;if(rule.uniqueItems&&new Set(value.map(item=>JSON.stringify(item))).size!==value.length)return false;if(rule.items&&!value.every(item=>validatePackSchema(item,rule.items)))return false;}
  if(object(value)){if(rule.required?.some(key=>!Object.prototype.hasOwnProperty.call(value,key)))return false;for(const [key,item] of Object.entries(value)){const property=rule.properties&&Object.prototype.hasOwnProperty.call(rule.properties,key)?rule.properties[key]:undefined;if(property&&!validatePackSchema(item,property))return false;if(!property&&rule.additionalProperties===false)return false;}}
  return true;
}
export function validatePackV2(input:unknown):{ok:true;order:string[]}|{ok:false;reason:string} {
  const fail=(reason:string)=>({ok:false as const,reason});
  try {
    const bounded=(value:unknown,depth=0):boolean=>depth<=32&&(!(object(value)||Array.isArray(value))||Object.values(value).every(item=>bounded(item,depth+1)));
    if(new TextEncoder().encode(JSON.stringify(input)).length>2097152||!bounded(input)||!validatePackSchema(input))return fail('INVALID_V2_SCHEMA');
    const root=input as {id:string;resources:PackResource[];capabilities:string[];minCatalogVersion?:string;dependencies?:{id:string;minVersion:string}[]};
    const version=(value:string)=>value.split('.').map(Number);
    if(root.minCatalogVersion&&version(root.minCatalogVersion).some((part,index,all)=>part>2147483647||index===0&&part>1||index>0&&all[0]===1&&part>0))return fail('INCOMPATIBLE_CATALOG_VERSION');
    const dependencies=new Set<string>();for(const dependency of root.dependencies??[]){if(dependency.id===root.id||dependencies.has(dependency.id)||version(dependency.minVersion).some(part=>part>2147483647))return fail('INVALID_DEPENDENCY');dependencies.add(dependency.id);}
    const resources=new Map(root.resources.map(resource=>[resource.id,resource]));if(resources.size!==root.resources.length)return fail('DUPLICATE_RESOURCE_ID');
    const declared=new Set(root.capabilities);
    for(const resource of resources.values()){
      const caps=new Set(resource.capabilities);if(!caps.has(resourceCapabilities[resource.kind])||[...caps].some(cap=>!declared.has(cap)))return fail('UNDECLARED_CAPABILITY');
      const required=new Set(resource.requires);if(required.has(resource.id)||[...required].some(id=>!resources.has(id)))return fail('INVALID_RESOURCE_REFERENCE');
      const reference=(id:unknown,kind:PackResource['kind'])=>{const target=resources.get(String(id));if(!target||target.kind!==kind||!required.has(String(id)))throw new Error();return target;};
      const spec=resource.spec;
      if(resource.kind==='permissionPreset'&&(spec.requested as string[]).some(cap=>!caps.has(cap)||!declared.has(cap)))return fail('UNDECLARED_CAPABILITY');
      if(resource.kind==='template'&&spec.schemaRef)reference(spec.schemaRef,'propertySchema');
      if(resource.kind==='savedQuery'){const target=reference(spec.schemaRef,'propertySchema');const fields=new Set((target.spec.fields as {id:string}[]).map(field=>field.id));if((spec.filters as {property:string}[]).some(filter=>!fields.has(filter.property)))return fail('UNKNOWN_QUERY_PROPERTY');}
      if(resource.kind==='view'){const query=reference(spec.queryRef,'savedQuery');if(spec.layout==='board'&&!spec.groupBy)return fail('BOARD_REQUIRES_GROUP_PROPERTY');if(spec.groupBy){const target=resources.get(String(query.spec.schemaRef));if(!(target?.spec.fields as {id:string}[]).some(field=>field.id===spec.groupBy))return fail('UNKNOWN_QUERY_PROPERTY');}}
      if(resource.kind==='dashboard'||resource.kind==='workspaceMode')for(const id of spec.viewRefs as string[])reference(id,'view');
      if(resource.kind==='workspaceMode'&&spec.dashboardRef)reference(spec.dashboardRef,'dashboard');
      if(resource.kind==='demoData'){reference(spec.templateRef,'template');const notes=spec.notes as {id:string}[];if(new Set(notes.map(note=>note.id)).size!==notes.length)return fail('DUPLICATE_DEMO_ID');}
      if(resource.kind==='propertySchema'){const fields=spec.fields as {id:string;type:string;options?:string[]}[];if(new Set(fields.map(field=>field.id)).size!==fields.length)return fail('DUPLICATE_PROPERTY_ID');if(fields.some(field=>field.type==='select'&&!field.options?.length))return fail('SELECT_REQUIRES_OPTIONS');}
    }
    const order:string[]=[];const active=new Set<string>();const complete=new Set<string>();
    const visit=(id:string)=>{if(complete.has(id))return;if(active.has(id))throw new Error();active.add(id);for(const dependency of [...resources.get(id)!.requires].sort())visit(dependency);active.delete(id);complete.add(id);order.push(id);};
    for(const id of [...resources.keys()].sort())visit(id);return {ok:true,order};
  }catch{return fail('INVALID_RESOURCE_CONTRACT');}
}
