import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(new URL('../../src/lib/coaching/preview.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const module={exports:{}};new Function('module','exports',code)(module,module.exports);
const {canAccessCoachingWorkspace}=module.exports;
test('assigned organization roles can enter the authorized coaching workspace',()=>{
 for(const role of ['system_admin','hospital_admin','mentor','candidate'])assert.equal(canAccessCoachingWorkspace(role,false),true);
 for(const role of [null,undefined,'partner','anonymous',''])assert.equal(canAccessCoachingWorkspace(role,false),false);
});
test('standalone coach accounts can onboard without organization-admin privileges',()=>{
 assert.equal(canAccessCoachingWorkspace(null,true),true);
 assert.equal(canAccessCoachingWorkspace('partner',false),false);
});
