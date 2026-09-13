// Run with node scripts/test-mentoring-documents.cjs. All storage and email calls are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Buffer, URL, Request, Response, require: (name) => mocks[name] ?? require(name) }, { filename: file });
  return module.exports;
}
class ApiRouteError extends Error { constructor(message, status) { super(message); this.status = status; } }
const api = { ApiRouteError, createApiErrorResponse: (error) => Response.json({ error: error.message }, { status: error.status ?? 500 }) };
const access = load('src/lib/mentor-access.ts', {});
const candidateId = '11111111-1111-4111-8111-111111111111';
const documentId = '22222222-2222-4222-8222-222222222222';
const recipientId = '33333333-3333-4333-8333-333333333333';
const requestId = '44444444-4444-4444-8444-444444444444';
(async () => {
  let removed = false;
  let inserted = false;
  let uploadError = false;
  let insertError = false;
  const storage = {
    upload: async () => ({ error: uploadError ? new Error('upload failed') : null }),
    remove: async () => { removed = true; },
  };
  const admin = { storage: { from: () => storage }, from: () => ({ insert: async () => { inserted = true; return { error: insertError ? new Error('insert failed') : null }; } }) };
  const library = load('src/lib/mentoring-documents.ts', { '@/lib/api-route': api, '@/lib/mentor-access': access });
  const input = { admin, organizationId: 'org', candidateId, profileId: 'mentor', title: 'Plan', fileName: 'plan.docx', buffer: Buffer.from('word bytes') };
  assert.match(await library.saveMentoringDocument(input), /^[0-9a-f-]{36}$/);
  uploadError = true; inserted = false;
  await assert.rejects(library.saveMentoringDocument(input));
  assert.equal(inserted, false, 'Upload failure must not create an available document');
  uploadError = false; insertError = true;
  await assert.rejects(library.saveMentoringDocument(input));
  assert.equal(removed, true, 'Failed metadata insert must clean up the uploaded file');

  let fileError = false;
  let sent = [];
  let documentRole = 'role-a';
  const context = {
    unrestricted: false, profile: { id: 'mentor', organization_id: 'org', full_name: 'Mentor' },
    candidate: { id: candidateId, full_name: 'Mentee' },
    assignments: [{ candidate_id: candidateId, role_id: 'role-a', mentor_profile_id: 'mentor', status: 'active' }],
    admin: {
      from: (table) => {
        const doc = { id: documentId, role_id: documentRole, title: 'Plan', file_name: 'plan.docx', storage_path: 'private/plan.docx' };
        const users = [{ id: recipientId, first_name: 'Test', last_name: 'Mentee', email: 'mentee@example.com', candidate_id: candidateId, is_candidate: true }];
        const query = { select() { return this; }, eq() { return this; }, in() { return this; }, is() { return this; }, maybeSingle: async () => ({ data: doc }), then: (resolve) => resolve({ data: table === 'organization_users' ? users : [] }) };
        return query;
      },
      storage: { from: () => ({ download: async () => ({ error: fileError, data: new Blob(['saved document bytes']) }) }) },
    },
  };
  const route = load('src/app/api/mentoring/documents/route.ts', {
    'next/server': { NextResponse: Response }, '@/lib/api-route': api, '@/lib/mentor-access': access,
    '@/lib/mentoring-documents': { ...library, requireMentoringDocumentAccess: async () => context },
    '@/lib/resend': { sendResendEmail: async (input) => { sent.push(input); } },
  });
  const post = (overrides = {}) => route.POST(new Request('https://app.test/api/mentoring/documents', { method: 'POST', body: JSON.stringify({ candidateId, documentId, recipientId, requestId, ...overrides }) }));
  assert.equal((await post()).status, 200);
  assert.equal(sent[0].to, 'mentee@example.com');
  assert.equal(Buffer.from(sent[0].attachments[0].content, 'base64').toString(), 'saved document bytes');
  await post();
  assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey, 'Retry must preserve provider deduplication key');
  const count = sent.length;
  assert.equal((await post({ recipientId: requestId })).status, 400);
  documentRole = 'other-role';
  assert.equal((await post()).status, 403);
  documentRole = 'role-a'; fileError = true;
  assert.equal((await post()).status, 500);
  assert.equal(sent.length, count, 'Invalid recipient, unauthorized track, or missing attachment must not send email');
  assert.equal((await route.GET(new Request('https://app.test/api/mentoring/documents?candidateId=invalid'))).status, 400);
  console.log('Passed: persistence, upload/metadata failures, exact attachment, retry deduplication, recipient validation, track authorization, missing file, invalid request.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
