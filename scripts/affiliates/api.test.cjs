const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, imports = {}) {
 const mod = { exports: {} };
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name => imports[name] || require(name),mod,mod.exports);
 return mod.exports;
}
const model = load('src/lib/affiliates.ts');
const payload = { name:'Partner',slug:'partner', branding:{displayName:'Partner',headline:'Build leaders',description:'Leadership development for your entire team.',contactEmail:'partner@example.com',color:'#0f766e',logoUrl:''},initialPercent:20,renewalPercent:10,renewalYears:null,action:'save' };
function setup(role) {
 const writes=[];
 class ApiRouteError extends Error {constructor(message,status){super(message);this.status=status;}}
 const query={insert:v=>{writes.push(v);return query;},update:v=>{writes.push(v);return query;},eq:()=>query,select:()=>query,single:async()=>({data:{id:'saved'}})};
 const route=load('src/app/api/affiliates/route.ts',{
 'next/server':{NextResponse:{json:body=>({status:200,body})}},
 '@/lib/affiliates':model,
 '@/lib/api-route':{ApiRouteError,createApiErrorResponse:e=>({status:e.status||500}),requireApiWorkspaceProfile:async()=>({profile:{role},admin:{from:()=>query}})},
 });
 return {writes,run:p=>route.POST({json:async()=>p})};
}
test('organization admins cannot edit affiliate financial terms',async()=>{const t=setup('hospital_admin');assert.equal((await t.run(payload)).status,403);assert.equal(t.writes.length,0);});
test('publication requires explicit approval',async()=>{const t=setup('system_admin');assert.equal((await t.run({...payload,action:'publish'})).status,400);assert.equal(t.writes.length,0);});
test('saving draft preserves published branding and converts rates to basis points',async()=>{const t=setup('system_admin');assert.equal((await t.run(payload)).status,200);assert.equal(t.writes[0].initial_bps,2000);assert.equal(t.writes[0].published_branding,undefined);});
test('unsafe URLs and invalid rates are rejected',()=>{for(const p of [{...payload,initialPercent:101},{...payload,renewalPercent:-1},{...payload,branding:{...payload.branding,logoUrl:'javascript:alert(1)'}}]) assert.equal(model.affiliateInput.safeParse(p).success,false);});
