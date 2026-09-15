import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterLog, logMetrics, logCsv } from '../../src/lib/coaching/model.ts';
const rows=[
 {id:'1',engagement_id:'e1',client_id:'a',client_name:'=Dangerous formula',client_email:'a@example.test',organization_id:'o1',organization:'Org, A',session_date:'2026-09-15',duration_minutes:90,compensation_category:'paid',coaching_category:'individual',engagement_status:'active',consent_recorded:true},
 {id:'2',engagement_id:'e2',client_id:'b',client_name:'Client B',organization_id:'o2',organization:'Org B',session_date:'2026-10-15',duration_minutes:45,compensation_category:'pro_bono',coaching_category:'group',engagement_status:'completed',consent_recorded:false},
 {id:'3',engagement_id:'e1',client_id:'a',client_name:'Client A',organization_id:'o1',organization:'Org A',session_date:'2026-09-16',duration_minutes:30,compensation_category:'paid',coaching_category:'team',engagement_status:'active',consent_recorded:true},
];
test('Every filter applies to the same records used for metrics and export',()=>{
 for(const [key,value] of Object.entries({from:'2026-10-01',client:'b',organization:'o2',engagement:'e2',compensation:'pro_bono',category:'group'})) assert.deepEqual(filterLog(rows,{[key]:value}),[rows[1]]);
 assert.deepEqual(filterLog(rows,{from:'2026-09-15',to:'2026-09-15'}),[rows[0]]);
 assert.deepEqual(filterLog(rows,{client:'a',organization:'o2'}),[]);
});
test('Totals use duration without multiplying group participants or duplicate clients',()=>{
 const metrics=logMetrics(rows);assert.equal(metrics['Total Coaching Hours'],2.75);assert.equal(metrics['Paid Hours'],2);assert.equal(metrics['Pro Bono Hours'],.75);assert.equal(metrics['Individual Hours'],1.5);assert.equal(metrics['Group Hours'],.75);assert.equal(metrics['Team Hours'],.5);assert.equal(metrics['Number of Clients'],2);assert.equal(metrics['Active Clients'],1);assert.equal(metrics['Completed Engagements'],1);
 assert.equal(logMetrics([])['Total Coaching Hours'],0);
});
test('CSV quotes fields, prevents formula execution, and respects filtering',()=>{
 const csv=logCsv(filterLog(rows,{client:'a',to:'2026-09-15'}));assert.ok(csv.includes('"\'=Dangerous formula"'));assert.ok(csv.includes('"Org, A"'));assert.ok(!csv.includes('Client B'));assert.equal(csv.split('\r\n').length,2);
});
