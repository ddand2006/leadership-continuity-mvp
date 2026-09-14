const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, Buffer, Date, Intl, require: (name) => mocks[name] ?? require(name) });
  return module.exports;
}
const evidence = load('src/lib/progress-development-evidence.ts');
assert.equal(evidence.projectScoreChange(2.5, 3.75), '+1.25 points');
assert.equal(evidence.projectScoreChange(4, 3.5), '-0.5 points');
assert.equal(evidence.projectScoreChange(3, 3), 'No change');
assert.equal(evidence.projectScoreChange(null, 3), 'Not enough scores');
assert.equal(evidence.projectScoreChange(3, null), 'Not enough scores');
assert.equal(evidence.projectCompletionLabel('assigned', null), 'Not completed');
assert.equal(evidence.projectCompletionLabel('completed', null), 'Not recorded');
assert.equal(evidence.projectCompletionLabel('completed', '2026-09-01'), '2026-09-01');
assert.equal(evidence.projectScore(null), 'Not recorded');
(async () => {
  const deps = process.env.DOCUMENT_PACKAGES;
  const docx = require(deps ? `${deps}/docx` : 'docx');
  const mammoth = require('mammoth');
  const builder = load('src/lib/candidate-progress-report-document.ts', { docx, '@/lib/progress-development-evidence': evidence });
  const record = {
    title: 'Cross-department service improvement', roleTitle: 'Operations Director',
    summary: 'Coordinate a project across teams and review the results with the mentor.',
    status: 'completed', occurredAt: '2026-09-14T12:00:00Z', dateAssigned: '2026-07-01',
    completionDate: '2026-09-01', mentorName: 'Example Mentor', mentorReviewDate: '2026-09-03', mentorReviewed: true,
    mentorImprovementObserved: 'Communicated decisions clearly and followed through on commitments.\nInvited feedback from partner teams.',
    mentorDevelopmentNeeded: 'Continue practicing delegation.', nextRecommendedExperience: 'Lead a larger cross-team assignment.',
    competencyScores: [
      { competency_name: 'Collaboration', baseline_score: 2.5, current_score: 3.75, target_score: 4 },
      { competency_name: 'Delegation', baseline_score: 4, current_score: 3.5, target_score: 4.5 },
      { competency_name: 'Communication', baseline_score: 3, current_score: 3, target_score: 4 },
      { competency_name: 'Judgment', baseline_score: 3, current_score: null, target_score: 4 },
    ],
  };
  const buffer = await builder.buildCandidateProgressReportDocumentBuffer({
    candidateName: 'Example Candidate', periodLabel: '2026 Year to Date',
    narrative: 'Development activity includes one completed project and one assigned project. Review the project evidence and mentor feedback below.',
    scorecard: [{ measure: 'Development records', value: 2 }, { measure: 'Completed development records', value: 1 }],
    developmentRecords: [record, { ...record, title: 'New leadership assignment', status: 'assigned', completionDate: null, mentorReviewDate: null, mentorImprovementObserved: null, mentorDevelopmentNeeded: null, nextRecommendedExperience: null, competencyScores: [] }], events: [],
  });
  const text = (await mammoth.extractRawText({ buffer })).value;
  for (const expected of ['Completion date: Sep 1, 2026', 'Completion date: Not completed', 'Mentor observations:', 'Example Mentor', '+1.25 points', '-0.5 points', 'No change', 'Not enough scores', 'No scores recorded for this project.', 'Last updated:']) assert.ok(text.includes(expected), `Missing ${expected}`);
  if (process.env.REPORT_QA_PATH) fs.writeFileSync(process.env.REPORT_QA_PATH, buffer);
  console.log('Passed: project completion dates, missing evidence, mentor notes, positive/negative/unchanged scores, and Word report content.');
})();
