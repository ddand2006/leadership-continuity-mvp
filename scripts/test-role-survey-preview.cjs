const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const requests = [];
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync('src/components/role-survey-response-form.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, { exports: exportsObject, fetch: async (...args) => { requests.push(args); return { ok: true, json: async () => ({}) }; }, require: (name) => {
 if (name === 'react') return { ...React, useEffect: (callback) => callback(), useRef: (current) => ({ current }), useState: (value) => [value, () => {}], useTransition: () => [false, (callback) => callback()] };
 if (name === '@/lib/role-competency-surveys') return { roleSurveyQuestionDefinitions: [{ key: 'essential_knowledge', shortLabel: 'Knowledge', prompt: 'What knowledge?', helpText: 'Help' }] };
 return require(name);
} });
function all(node) { if (!node || typeof node !== 'object') return []; return [node, ...React.Children.toArray(node.props?.children).flatMap(all)]; }
const props = { token: 'test-token', recipientName: 'Test', surveyTitle: 'Draft title', roleTitle: 'Role', introMessage: 'Draft introduction', thankYouMessage: '', surveyStatus: 'draft', recipientStatus: 'pending', completedAt: null };
for (const surveyStatus of ['draft', 'active', 'closed']) {
 const nodes = all(exportsObject.RoleSurveyResponseForm({ ...props, preview: true, surveyStatus }));
 assert.ok(nodes.some((node) => node.type === 'textarea'), 'Preview must show questions in every survey status');
 const button = nodes.find((node) => node.type === 'button');
 assert.equal(button.props.disabled, true);
 button.props.onClick();
 assert.equal(requests.length, 0, 'Preview must never mark opened or submit, including direct handler invocation');
}
const unavailable = all(exportsObject.RoleSurveyResponseForm(props));
assert.equal(unavailable.some((node) => node.type === 'textarea'), false, 'Live draft must remain unavailable');
const live = all(exportsObject.RoleSurveyResponseForm({ ...props, surveyStatus: 'active' }));
assert.equal(requests[0][1].method, 'PATCH');
assert.equal(live.find((node) => node.type === 'button').props.disabled, false);
console.log('Passed: preview questions for draft/active/closed, zero preview requests, disabled submission, live draft restriction, live open tracking.');
