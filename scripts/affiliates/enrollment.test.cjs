const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function setup({ existing = false, published = true } = {}) {
 const inserts = [];
 const admin = { from(table) {
   const query = { select: () => query, eq: () => query, not: () => query,
    insert: value => { inserts.push({table,value}); return query; },
    maybeSingle: async () => ({ data: table === 'affiliates' ? (published ? {id:'stored-affiliate'} : null) : table === 'profiles' && existing ? {id:'old-profile',organization_id:'old-org'} : null }),
    single: async () => ({data:{id:table+'-id'}}),
   }; return query;
 } };
 const imports = {
 'next/server': {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
 '@/lib/env':{hasResendEnv:()=>false},'@/lib/resend':{sendResendEmail:async()=>{throw new Error('No emails allowed in this test');}},
 '@/lib/supabase/admin':{createSupabaseAdminClient:()=>admin},
 '@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'user-test',email:'test@example.invalid',user_metadata:{affiliate_slug:'published-partner',initial_bps:9999,account_request:{fullName:'Sample Owner',companyName:'Sample Organization',phone:'5555550100',roleTitle:'Owner'}}}}})}})},
 };
 const mod={exports:{}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/app/api/account-requests/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>imports[name]||require(name),mod,mod.exports);
 return {inserts,run:()=>mod.exports.POST()};
}
test('confirmed signup metadata attaches only server-resolved affiliate; never client rates',async()=>{
 const t=setup();assert.equal((await t.run()).status,200);
 const org=t.inserts.find(row=>row.table==='organizations').value;
 assert.equal(org.affiliate_id,'stored-affiliate');assert.equal(org.affiliate_terms,undefined);assert.equal(org.initial_bps,undefined);
});
test('existing customer is not reassigned by referral metadata',async()=>{const t=setup({existing:true});assert.equal((await t.run()).status,200);assert.equal(t.inserts.length,0);});
test('unpublished partner blocks enrollment before creating a workspace',async()=>{const t=setup({published:false});assert.equal((await t.run()).status,409);assert.equal(t.inserts.length,0);});
