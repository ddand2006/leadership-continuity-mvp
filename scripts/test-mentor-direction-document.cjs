const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mammoth = require('mammoth');
function load(file, mocks = {}) {
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
 { module, exports: module.exports, Buffer, Error, require: (name) => mocks[name] ?? require(name) });
 return module.exports;
}
(async () => {
 const builder = load('src/lib/mentor-direction-document.ts');
 let saves = [], generated = 0, failSave = false, active = true, openAI = true;
 class ApiRouteError extends Error { constructor(message, status) { super(message); this.status = status; } }
 const route = load('src/app/api/mentoring/leadership-development-record/generate-mentor-direction/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/mentor-direction-document': builder,
  '@/lib/mentoring-documents': { saveMentoringDocument: async (input) => { if (failSave) throw new Error('Storage unavailable'); saves.push(input); return 'saved-id'; } },
  '@/lib/api-route': { ApiRouteError, createApiErrorResponse: (e) => Response.json({ error: e.message }, { status: e.status ?? 500 }), requireApiWorkspaceProfile: async () => ({ account: null, profile: { id: 'admin', role: 'system_admin', organization_id: 'org' }, admin: { from: () => { const q = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: active ? {} : null }) }; return q; } } }) },
  '@/lib/env': { hasOpenAIEnv: () => openAI },
  '@/lib/mentor-access': { isAdminAppRole: () => true, isCandidateSelfAccess: () => false },
  '@/lib/development-record-mentor-direction': { generateDevelopmentRecordMentorDirection: async () => { generated++; return 'Generated mentor direction.\nKeep this second paragraph.'; } },
 });
 const payload = { candidateId: '11111111-1111-4111-8111-111111111111', roleId: '22222222-2222-4222-8222-222222222222', mentorId: '33333333-3333-4333-8333-333333333333', candidateName: 'Test Mentee', targetRole: 'Operations', primaryMentor: 'Test Mentor', experienceTitle: 'Test project', menteeTask: '', projectSummary: '', projectPurpose: '', workingGoal: '', whyItFits: '', mentorFocus: '', firstStep: '', growthAreas: ['Collaboration'], selectedStrengths: [{ themeName: 'Focus', rank: 1, domain: 'Executing', helpDescription: 'Stay focused' }], leadershipActionsRequired: [], successMeasures: [] };
 const post = (overrides) => route.POST(new Request('https://app.test', { method: 'POST', body: JSON.stringify({ ...payload, ...overrides }) }));
 assert.equal((await (await post()).json()).documentId, 'saved-id');
 assert.equal(saves.length, 1);
 const text = (await mammoth.extractRawText({ buffer: saves[0].buffer })).value;
 for (const expected of ['Test Mentee','Test Mentor','Operations','Test project','Generated mentor direction.','Keep this second paragraph.']) assert.ok(text.includes(expected));
 assert.equal(saves[0].candidateId, payload.candidateId); assert.equal(saves[0].roleId, payload.roleId);
 openAI = false;
 assert.equal((await post({ action: 'save_document', mentorDirectionNarrative: 'Original unchanged direction.', growthAreas: [], selectedStrengths: [] })).status, 200);
 assert.equal(generated, 1);
 assert.ok((await mammoth.extractRawText({ buffer: saves[1].buffer })).value.includes('Original unchanged direction.'));
 failSave = true;
 const partial = await (await post({ action: 'save_document', mentorDirectionNarrative: 'Keep original' })).json();
 assert.equal(partial.narrative, 'Keep original'); assert.equal(partial.documentError, 'Storage unavailable'); assert.equal(partial.documentId, undefined);
 assert.equal((await post({ action: 'save_document', mentorDirectionNarrative: '' })).status, 400);
 active = false;
 assert.equal((await post({ action: 'save_document', mentorDirectionNarrative: 'Original' })).status, 404);
 console.log('Passed: mentor direction Word content, automatic save, existing text saved without AI, storage failure recovery, empty direction and inactive assignment rejection.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
