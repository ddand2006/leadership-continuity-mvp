const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');
const mammoth = require('mammoth');
function load(file, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, Buffer, Error, require: (name) => mocks[name] ?? require(name) });
  return module.exports;
}
const worksheet = { assignmentSummary: 'Assignment summary', firstSteps: ['First action'], weeklyCheckpoints: ['Weekly checkpoint'], reportBackPrompts: ['Report progress'], reflectionQuestions: ['Reflect on learning'] };
(async () => {
  const builder = load('src/lib/mentee-worksheet-document.ts');
  const buffer = await builder.buildMenteeWorksheetDocumentBuffer({ candidateName: 'Test Mentee', targetRole: 'Operations', mentorName: 'Test Mentor', projectTitle: 'Test project', worksheet, reportNotes: 'Edited notes\nSecond line' });
  const text = (await mammoth.extractRawText({ buffer })).value;
  for (const expected of ['Test Mentee', 'Test Mentor', 'Operations', 'Test project', ...Object.values(worksheet).flat(), 'Edited notes', 'Second line']) assert.ok(text.includes(expected), `Missing ${expected}`);
  class ApiRouteError extends Error { constructor(message, status) { super(message); this.status = status; } }
  let generationCalls = 0, saves = [], failSave = false, active = true;
  const route = load('src/app/api/mentoring/leadership-development-record/project-tools/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/mentee-worksheet-document': builder,
    '@/lib/mentoring-documents': { saveMentoringDocument: async (input) => { if (failSave) throw new Error('Storage unavailable'); saves.push(input); return 'saved-id'; } },
    '@/lib/leadership-development-record': { leadershipDevelopmentRecordPayloadSchema: z.object({ menteeWorksheet: z.object({ assignmentSummary: z.string(), firstSteps: z.array(z.string()), weeklyCheckpoints: z.array(z.string()), reportBackPrompts: z.array(z.string()), reflectionQuestions: z.array(z.string()) }).nullable().default(null) }) },
    '@/lib/api-route': { ApiRouteError, createApiErrorResponse: (error) => Response.json({ error: error.message }, { status: error.status ?? 500 }), requireApiWorkspaceProfile: async () => ({ account: null, profile: { id: 'admin', role: 'system_admin', organization_id: 'org' }, admin: { from: () => { const q = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: active ? {} : null }) }; return q; } } }) },
    '@/lib/env': { hasOpenAIEnv: () => true },
    '@/lib/mentor-access': { isAdminAppRole: () => true, isCandidateSelfAccess: () => false },
    '@/lib/development-record-project-tools': { generateMenteeWorksheet: async () => { generationCalls++; return worksheet; }, expandManualDevelopmentProject: async () => ({ projectSummary: 'Expanded' }) },
  });
  const payload = { action: 'generate_worksheet', candidateId: '11111111-1111-4111-8111-111111111111', roleId: '22222222-2222-4222-8222-222222222222', mentorId: '33333333-3333-4333-8333-333333333333', candidateName: 'Test Mentee', targetRole: 'Operations', primaryMentor: 'Test Mentor', experienceTitle: 'Test project', menteeTask: '', projectSummary: '', projectPurpose: '', workingGoal: '', whyItFits: '', mentorFocus: '', firstStep: '', growthAreas: [], selectedStrengths: [], leadershipActionsRequired: [], successMeasures: [], reflectionQuestions: [], menteeReportNotes: 'Saved notes' };
  const post = (overrides) => route.POST(new Request('https://app.test', { method: 'POST', body: JSON.stringify({ ...payload, ...overrides }) }));
  assert.equal((await (await post()).json()).documentId, 'saved-id');
  assert.equal(saves.length, 1, 'Generate must immediately save a document');
  assert.equal(saves[0].candidateId, payload.candidateId);
  assert.equal(saves[0].roleId, payload.roleId);
  assert.ok((await mammoth.extractRawText({ buffer: saves[0].buffer })).value.includes('Saved notes'));
  await post({ action: 'save_worksheet', menteeWorksheet: { ...worksheet, firstSteps: ['Edited first step'] } });
  assert.equal(generationCalls, 1, 'Export existing worksheet must not regenerate it');
  assert.ok((await mammoth.extractRawText({ buffer: saves[1].buffer })).value.includes('Edited first step'));
  failSave = true;
  const partial = await (await post()).json();
  assert.equal(partial.result.assignmentSummary, worksheet.assignmentSummary);
  assert.equal(partial.documentError, 'Storage unavailable');
  assert.equal(partial.documentId, undefined);
  active = false;
  assert.equal((await post()).status, 404);
  console.log('Passed: complete Word content, auto-save on generation, existing/edited worksheet export without AI, storage failure recovery, assignment check.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
