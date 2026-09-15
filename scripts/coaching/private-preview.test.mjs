import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(new URL('../../src/lib/coaching/preview.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const module={exports:{}};new Function('module','exports',code)(module,module.exports);
const {canAccessCoachingPreview}=module.exports;
test('only the exact authenticated preview email is allowed',()=>{
 assert.equal(canAccessCoachingPreview({email:'david@cycleofbusiness.com'}),true);
 assert.equal(canAccessCoachingPreview({email:'DAVID@CYCLEOFBUSINESS.COM'}),true);
 for(const user of [null,undefined,{}, {email:'other@cycleofbusiness.com'}, {email:'david+test@cycleofbusiness.com'}, {email:'david@cycleofbusiness.com.evil.test'}, {email:'other@example.com',user_metadata:{email:'david@cycleofbusiness.com'},role:'system_admin'}]) assert.equal(canAccessCoachingPreview(user),false);
});
