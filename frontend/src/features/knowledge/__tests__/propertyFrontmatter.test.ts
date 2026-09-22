import {expect,test} from 'vitest';
import {readPropertyFrontmatter,writePropertyFrontmatter,type PropertyDefinition} from '../propertyFrontmatter';
const defs:PropertyDefinition[]=[{key:'status',title:'Status',type:'select',options:['Open','Closed'],revision:1},{key:'due',title:'Due',type:'date',options:[],revision:1}];
test('changes only the managed block and keeps unrelated YAML and body bytes',()=>{
 const source='---\r\n# Keep this comment\r\nauthor: "Ada"\r\nmoduloProperties:\r\n  status: Open\r\n  vendor: {x: 2}\r\ncustom:\r\n  nested: yes\r\n---\r\n# Body\r\n\r\n```yaml\r\na: b\r\n```\r\n';
 const result=writePropertyFrontmatter(source,{status:'Closed',due:null},defs);
 expect(result).toContain('# Keep this comment\r\nauthor: "Ada"\r\n');expect(result).toContain('custom:\r\n  nested: yes\r\n---\r\n# Body\r\n\r\n```yaml\r\na: b\r\n```\r\n');
 expect(readPropertyFrontmatter(result,defs)).toEqual({values:{status:'Closed',due:null},unknown:['vendor']});expect(writePropertyFrontmatter(result,{status:'Closed',due:null},defs)).toBe(result);
});
test('missing values are removed, null remains explicit and unsupported known types fail',()=>{
 const source='---\nmoduloProperties:\n  status: Open\n  due: null\n---\nBody';
 expect(readPropertyFrontmatter(writePropertyFrontmatter(source,{due:null},defs),defs).values).toEqual({due:null});
 expect(()=>readPropertyFrontmatter('---\nmoduloProperties:\n  status: [Open]\n---\nBody',defs)).toThrow('Status');
});
test('rejects duplicate keys and aliases without rewriting source',()=>{
 expect(()=>readPropertyFrontmatter('---\na: 1\na: 2\n---\n',defs)).toThrow('invalid YAML');
 expect(()=>readPropertyFrontmatter('---\na: &x [1]\nb: *x\n---\n',defs)).toThrow('aliases');
});
