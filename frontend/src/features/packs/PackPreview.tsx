import {useState} from 'react';
import type {PackManifest} from '../blueprint/pack/packManifest';
import {validatePackV2} from '../blueprint/pack/packManifestV2';
export function PackPreview({manifest}:{manifest:PackManifest}){
  const resources=manifest.resources??[];const checked=validatePackV2(manifest);const order=checked.ok?checked.order:[];
  const byId=new Map(resources.map(resource=>[resource.id,resource]));const levels=new Map<string,number>();for(const id of order)levels.set(id,Math.max(0,...byId.get(id)!.requires.map(ref=>(levels.get(ref)??0)+1)));
  const visible=order.slice(0,40);const positions=new Map(visible.map((id,index)=>[id,{x:20+(levels.get(id)??0)*190,y:20+index*54}]));
  const views=resources.filter(resource=>resource.kind==='view');const [selected,setSelected]=useState('');const view=views.find(resource=>resource.id===selected)??views[0];
  const query=byId.get(String(view?.spec.queryRef));const schema=byId.get(String(query?.spec.schemaRef));const fields=(schema?.spec.fields??[]) as {id:string;title:string;options?:string[]}[];
  const groups=fields.find(field=>field.id===view?.spec.groupBy)?.options??['Unassigned'];
  return <section aria-label="Pack preview" className="space-y-6">
    <div><h3 className="font-medium">Dependency graph</h3><div className="mt-2 max-h-96 overflow-auto border border-border"><svg role="img" aria-label="Pack resource dependency graph" width={Math.max(340,...[...positions.values()].map(point=>point.x+170))} height={Math.max(80,visible.length*54+20)}>
      {visible.flatMap(id=>byId.get(id)!.requires.filter(ref=>positions.has(ref)).map(ref=>{const from=positions.get(ref)!;const to=positions.get(id)!;return <path key={`${ref}:${id}`} d={`M${from.x+150},${from.y+16} C${from.x+175},${from.y+16} ${to.x-25},${to.y+16} ${to.x},${to.y+16}`} fill="none" stroke="currentColor" opacity="0.4"/>;}))}
      {visible.map(id=>{const point=positions.get(id)!;return <g key={id}><rect x={point.x} y={point.y} width="150" height="32" fill="hsl(var(--background))" stroke="currentColor"/><text x={point.x+7} y={point.y+21} fontSize="12" fill="currentColor">{id.slice(0,21)}</text></g>;})}
    </svg></div>{order.length>40&&<p className="text-sm">Showing 40 of {order.length} resources; the resource list contains every dependency.</p>}</div>
    <div><h3 className="font-medium">Navigation preview</h3><nav aria-label="Pack navigation preview" className="my-2 flex flex-wrap gap-2">{views.map(resource=><button key={resource.id} className="border border-border px-3 py-2 text-sm" aria-pressed={view?.id===resource.id} onClick={()=>setSelected(resource.id)}>{resource.title}</button>)}</nav>
      <p className="mb-3 text-sm text-muted-foreground">Layout preview. No workspace data is loaded or installed.</p>
      {view&&<div className="overflow-auto border border-border p-3"><h4 className="mb-2 font-medium">{view.title} · {String(view.spec.layout)}</h4>{view.spec.layout==='table'?<table className="w-full text-left text-sm"><thead><tr><th className="p-2">Title</th>{fields.map(field=><th key={field.id} className="p-2">{field.title}</th>)}</tr></thead><tbody><tr><td className="p-2" colSpan={fields.length+1}>Matching records will appear here.</td></tr></tbody></table>:view.spec.layout==='board'?<div className="flex gap-3">{groups.map(group=><section key={group} className="min-w-40 flex-1 border-l border-border pl-3"><h5 className="text-sm font-medium">{group}</h5><p className="my-2 text-sm text-muted-foreground">Matching records</p></section>)}</div>:<p className="text-sm">Records appear as {view.spec.layout==='card'?'cards':'a list'} using the selected query.</p>}</div>}
    </div>
    <div><h3 className="font-medium">Dashboards</h3>{resources.filter(resource=>resource.kind==='dashboard').map(dashboard=><section key={dashboard.id} className="my-3 border-t border-border pt-3"><h4>{dashboard.title}</h4><ol className="mt-2 space-y-2 text-sm">{(dashboard.spec.viewRefs as string[]).map(ref=><li key={ref}>{byId.get(ref)?.title??ref}</li>)}</ol></section>)}</div>
  </section>;
}
