import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localTime} from '../../src/lib/coaching/workflow-model.ts';
test('Repeated fall-back hour displays distinct time zone abbreviations',()=>{
 const first=localTime('2026-11-01T07:00:00Z','America/Denver');
 const second=localTime('2026-11-01T08:00:00Z','America/Denver');
 assert.notEqual(first,second);assert.match(first,/MDT|GMT-6/);assert.match(second,/MST|GMT-7/);
});
test('Coach and coachee see the same instant in their local zones',()=>{
 assert.match(localTime('2026-09-17T16:00:00Z','America/Denver'),/10:00/);
 assert.match(localTime('2026-09-17T16:00:00Z','America/Los_Angeles'),/9:00/);
});
test('Invalid IANA time zone is rejected',()=>assert.throws(()=>localTime('2026-09-17T16:00:00Z','Not/AZone'),RangeError));
