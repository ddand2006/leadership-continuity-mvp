import ExcelJS from 'exceljs';
import {coachingContext,rpc} from '@/lib/coaching/server';
import {analyticsFilters,type ScaleData,type ScaleRow} from '@/lib/coaching/scale';
import {financialCsv} from '@/lib/coaching/commerce-model';
import {logMetrics,type LogRow} from '@/lib/coaching/model';
export const runtime='nodejs';
export async function GET(request:Request){
 const ctx=await coachingContext(),q=new URL(request.url).searchParams;const rows:ScaleRow[]=[];
 if(q.get('section')==='practice'){
  if(!ctx.coach)return Response.json({error:'Coach account required'},{status:403});
  const d=await rpc<ScaleData>(ctx.db,'coaching_scale_read');
  for(const section of ['quality','professional_development'])for(const row of (d[section]??[]) as ScaleRow[])rows.push({section,...row});
  const hours=logMetrics(await rpc<LogRow[]>(ctx.db,'coaching_credential_log'));for(const [metric,value]of Object.entries(hours))rows.push({section:'Practice hours',metric,value});
 }else{
  if(!ctx.admin)return Response.json({error:'Organization administrator required'},{status:403});
  const filters=analyticsFilters(Object.fromEntries(q));const {data,error}=await ctx.db.rpc('coaching_scale_read',{section:'analytics',filters});
  if(error)return Response.json({error:error.message},{status:403});const snapshot=data?.snapshot as ScaleData|undefined;
  if(!snapshot)return Response.json({error:'Refresh this report before exporting.'},{status:409});
  for(const [section,value]of Object.entries(snapshot)){if(Array.isArray(value))for(const record of value)rows.push({section,...(typeof record==='object'?record:{definition:record})});else if(value&&typeof value==='object')for(const [metric,result]of Object.entries(value))rows.push({section,metric,value:result});}
  rows.unshift({section:'methodology',calculated_at:data.calculated_at,version:data.version});
  const authorized=await rpc<ScaleData>(ctx.db,'coaching_scale_read');for(const r of (authorized.roi??[]) as ScaleRow[]){const {notes,...safe}=r;void notes;rows.push({section:'Organization-provided estimate',...safe});}
 }
 const format=q.get('format')==='xlsx'?'xlsx':'csv';let body:BodyInit;let type='text/csv; charset=utf-8';
 if(format==='xlsx'){const wb=new ExcelJS.Workbook();const sheet=wb.addWorksheet('Coaching report');const keys=[...new Set(rows.flatMap(Object.keys))];sheet.addRow(keys);for(const row of rows)sheet.addRow(keys.map(k=>typeof row[k]==='object'?JSON.stringify(row[k]):row[k]??''));sheet.getRow(1).font={bold:true};sheet.columns.forEach(c=>{c.width=24});body=new Uint8Array(await wb.xlsx.writeBuffer());type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';}
 else body=financialCsv(rows as never[]);
 return new Response(body,{headers:{'Content-Type':type,'Content-Disposition':`attachment; filename="leadership-coaching-report.${format}"`,'Cache-Control':'private, no-store'}});
}
