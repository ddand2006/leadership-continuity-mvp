const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/lib/affiliate-commission.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(require,mod,mod.exports);
const calculate=mod.exports.calculateAffiliateCommission;
const start=Date.parse('2026-09-17T00:00:00Z')/1000;
const terms={initial_bps:2000,renewal_bps:1000,renewal_years:2,attributed_at:'2026-09-17T00:00:00Z'};
const invoice={status:'paid',amount_remaining:0,currency:'usd',billing_reason:'subscription_create',total_excluding_tax:240000,total:264000,amount_paid:264000};
const line={amount:300000,pricing:{price_details:{price:'foundation'}},period:{start,end:start+365*86400},parent:{subscription_item_details:{proration:false}}};
test('initial commission excludes tax and uses discounted revenue',()=>{assert.equal(calculate(invoice,[line],terms,['foundation']).commission_cents,48000);});
test('annual renewal uses individual frozen renewal rate',()=>{const renewal={...line,period:{start:start+365*86400,end:start+730*86400}};const r=calculate({...invoice,billing_reason:'subscription_cycle'},[renewal],terms,['foundation']);assert.equal(r.commission_cents,24000);assert.equal(r.renewal_number,1);});
test('renewal term ends without resetting on a replacement subscription',()=>{const renewal={...line,period:{start:start+1096*86400,end:start+1461*86400}};assert.equal(calculate(invoice,[renewal],terms,['foundation']).status,'ineligible');});
test('manual adjustments, unknown products, prorations, unpaid and credit balances are held',()=>{
 for(const i of [{...invoice,billing_reason:'subscription_update'},{...invoice,status:'open'},{...invoice,amount_paid:100},{...invoice,total_excluding_tax:null}]) assert.equal(calculate(i,[line],terms,['foundation']).status,'held');
 assert.equal(calculate(invoice,[line],terms,['different']).status,'held');
 assert.equal(calculate(invoice,[{...line,parent:{subscription_item_details:{proration:true}}}],terms,['foundation']).status,'held');
});
test('fractional cents are rounded and zero invoices earn zero',()=>{assert.equal(calculate({...invoice,total_excluding_tax:101,total:101,amount_paid:101},[line],terms,['foundation']).commission_cents,20);assert.equal(calculate({...invoice,total_excluding_tax:0,total:0,amount_paid:0},[line],terms,['foundation']).commission_cents,0);});

test('database timestamp offsets are accepted',()=>{assert.equal(calculate(invoice,[line],{...terms,attributed_at:'2026-09-17T00:00:00+00:00'},['foundation']).commission_cents,48000);});
