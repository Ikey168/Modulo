import { afterEach, expect, it, vi } from 'vitest';
import { PluginStateClient, StateRequestError, type StateRecord, type StateTransport } from '../pluginStateClient';
import { BrowserStatePersistence } from '../pluginStateTransport';
const firstGeneration='00000000-0000-0000-0000-000000000001', restoredGeneration='00000000-0000-0000-0000-000000000002';
const clients: PluginStateClient[]=[];
afterEach(()=>{ clients.forEach(client=>client.close()); clients.length=0; localStorage.clear(); });
function fixture() {
  let generation=firstGeneration, online=true, expired=false;
  const records=new Map<string,StateRecord>();
  const puts=vi.fn();
  const transport=(owner:string):StateTransport=>{
    let pinned:string|undefined;
    const available=()=>{ if(!online) throw new TypeError('offline'); if(expired) throw new StateRequestError(401,'expired'); };
    return {
      generation:async()=>{available(); return generation;}, useGeneration:value=>{pinned=value;},
      get:async key=>{available();return records.get(`${owner}:${key}`);},
      list:async()=>{available();return {records:[...records.entries()].filter(([key])=>key.startsWith(`${owner}:`)).map(([,value])=>value)};},
      put:async(key,request)=>{
        available(); puts(owner,key);
        if(pinned!==generation) throw new StateRequestError(412,'STATE_STORAGE_GENERATION_CHANGED');
        const previous=records.get(`${owner}:${key}`);
        if((previous?.version??0)!==request.expectedVersion) throw new StateRequestError(409,'conflict',previous);
        const record={key,schemaId:request.schemaId,schemaVersion:request.schemaVersion,value:request.value,version:request.expectedVersion+1,deleted:false,createdAt:'',updatedAt:''};
        records.set(`${owner}:${key}`,record);return record;
      },
      delete:async()=>{throw new Error('unused');},
    };
  };
  const open=async(owner='alice',replica='a',persistence=new BrowserStatePersistence(localStorage))=>{
    const client=await PluginStateClient.open({origin:'https://app',issuer:'https://id',subject:owner,workspace:'personal',namespace:'acceptance',replica},persistence,transport(owner),{autoRetry:false}); clients.push(client);return client;
  };
  return {open,records,puts,online:(value:boolean)=>{online=value;},expired:(value:boolean)=>{expired=value;},restore:()=>{generation=restoredGeneration;}};
}
it('pins a new online cache before its first edit',async()=>{
  const server=fixture();const client=await server.open();
  await client.set('document',{text:'saved'},'fixture',2);await client.synchronize();
  expect(client.status).toBe('idle');expect(client.conflicts()).toEqual([]);
  expect(client.recoverySnapshot().generation).toBe(firstGeneration);expect(server.records.get('alice:document')?.version).toBe(1);
});
it('preserves offline work across restart and fences matching restored versions',async()=>{
  const server=fixture();let client=await server.open();
  await client.set('document',{text:'backup'},'fixture',2);await client.synchronize();
  const backup=JSON.parse(JSON.stringify(server.records.get('alice:document')));
  server.online(false);await client.set('document',{text:'offline'},'fixture',2);await client.synchronize();client.close();
  server.restore();server.records.set('alice:document',backup);server.online(true);client=await server.open();await client.refreshAll();
  expect(client.status).toBe('conflict');expect(client.get('document')?.value).toEqual({text:'offline'});
  const calls=server.puts.mock.calls.length;await client.synchronize();expect(server.puts).toHaveBeenCalledTimes(calls);
  expect(client.get('document')?.conflict?.remote?.value).toEqual({text:'backup'});
  await client.resolve('document','local');await client.synchronize();
  expect(server.records.get('alice:document')?.value).toEqual({text:'offline'});
  expect(server.records.get('alice:document')?.schemaVersion).toBe(2);
});
it('refreshes restored reads and permits an explicit remote conflict decision',async()=>{
  const server=fixture();const client=await server.open();
  await client.set('document',{text:'later'},'fixture',2);await client.synchronize();
  await client.set('pending',{text:'unsent'},'fixture',2);server.restore();server.records.clear();
  await client.refreshAll();
  expect(client.get('document')).toBeUndefined();expect(client.get('pending')?.conflict).toBeDefined();
  await client.resolve('pending','remote');expect(client.list()).toEqual([]);
});
it('offline and expired authentication preserve the queue and prohibit transmission',async()=>{
  const server=fixture();const client=await server.open();
  server.online(false);await client.set('first',{value:1},'fixture',1);await client.set('second',{value:2},'fixture',1);
  await client.synchronize();expect(client.status).toBe('offline');expect(server.puts).not.toHaveBeenCalled();
  server.online(true);server.expired(true);await client.synchronize();expect(client.status).toBe('error');expect(server.puts).not.toHaveBeenCalled();
  server.expired(false);await client.synchronize();expect(server.puts.mock.calls.map(call=>call[1])).toEqual(['first','second']);
});
it('partitions retained offline queues for two owners on the same browser',async()=>{
  const server=fixture();const alice=await server.open();server.online(false);await alice.set('private',{text:'alice'},'fixture',1);alice.close();
  server.online(true);const bob=await server.open('bob');expect(bob.list()).toEqual([]);await bob.synchronize();expect(server.records.size).toBe(0);
  const resumed=await server.open();await resumed.synchronize();expect(server.records.get('alice:private')?.value).toEqual({text:'alice'});expect(server.records.has('bob:private')).toBe(false);
});
it('does not acknowledge a mutation when the recovery cache is full',async()=>{
  const server=fixture();const persistence=new BrowserStatePersistence({getItem:()=>null,setItem:()=>{throw new DOMException('quota','QuotaExceededError');}} as unknown as Storage);
  const client=await server.open('alice','quota',persistence);
  await expect(client.set('private',{value:1},'fixture',1)).rejects.toThrow('quota');
  expect(client.list()).toEqual([]);expect(server.puts).not.toHaveBeenCalled();
});
it('renders a retained cache even while the storage handshake cannot reach the server',async()=>{
  const server=fixture();const saved=await server.open();await saved.set('cached',{text:'available offline'},'fixture',1);await saved.synchronize();saved.close();
  const client=await PluginStateClient.open({origin:'https://app',issuer:'https://id',subject:'alice',workspace:'personal',namespace:'acceptance',replica:'a'},new BrowserStatePersistence(localStorage),{
    generation:()=>new Promise<string>(()=>{}),get:async()=>undefined,put:async()=>{throw new Error('blocked');},delete:async()=>{throw new Error('blocked');},
  },{autoRetry:false});clients.push(client);
  expect(client.get('cached')?.value).toEqual({text:'available offline'});
});
