const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks) {
 const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:require(name),m,m.exports);
 return m.exports;
}
test('unverified or signed-out identities cannot look up affiliate ownership', async()=>{
 const {getOwnedAffiliates}=load('src/lib/affiliate-access.ts',{'@/lib/supabase/admin':{createSupabaseAdminClient:()=>{throw Error('must not query');}}});
 assert.deepEqual(await getOwnedAffiliates(null),[]);
 assert.deepEqual(await getOwnedAffiliates({email:'owner@example.com'}),[]);
});
test('ownership lookup uses verified email and excludes sandbox records', async()=>{
 const filters=[]; const query={select(){return this},eq(...args){filters.push(args);return this},order:async()=>({data:[{id:'owned'}],error:null})};
 const {getOwnedAffiliates}=load('src/lib/affiliate-access.ts',{'@/lib/supabase/admin':{createSupabaseAdminClient:()=>({from:()=>query})}});
 assert.deepEqual(await getOwnedAffiliates({email:'Owner@Example.com',email_confirmed_at:'yes'}),[{id:'owned'}]);
 assert.deepEqual(filters,[['payout_email','owner@example.com'],['is_sandbox',false]]);
});
for(const requested of ['owned','another-affiliate']) test(`portal scopes referrals for ${requested}`,async()=>{
 const calls=[];
 const query={select(fields){calls.push(['select',fields]);return this},eq(...args){calls.push(args);return this},order:async()=>({data:[],error:null})};
 const Page=load('src/app/affiliate-payments/page.tsx',{
 'next/link':{default:()=>null},
 '@/components/affiliate-payments':{AffiliatePayments:()=>null},
 '@/components/share-affiliate-link':{ShareAffiliateLink:()=>null},
 '@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{email:'owner@example.com'}}})}})},
 '@/lib/supabase/admin':{createSupabaseAdminClient:()=>({from:()=>query})},
 '@/lib/affiliate-access':{getOwnedAffiliates:async()=>[{id:'owned',name:'Owned company',slug:'owned'}]}
 }).default;
 await Page({searchParams:Promise.resolve({id:requested})});
 assert.deepEqual(calls,requested==='owned'?[['select','name,subscription_status'],['affiliate_id','owned']]:[]);
});
