import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { coachingContext, rpc } from '@/lib/coaching/server';
import { exportTables, financialCsv, type CommerceData, type CommerceRow } from '@/lib/coaching/commerce-model';
export const runtime = 'nodejs';
export async function GET(request: Request) {
    const ctx = await coachingContext();
    if (!ctx.platformAdmin)
        return NextResponse.json({ error: 'Platform administrator required' }, { status: 403 });
    const query = new URL(request.url).searchParams;
    const type = query.get('type') ?? 'payments';
    if (!Object.hasOwn(exportTables, type))
        return NextResponse.json({ error: 'Invalid export' }, { status: 400 });
    const d = await rpc<CommerceData>(ctx.db, 'coaching_commerce_read', { section: 'admin' });
    const rows = d[exportTables[type]] as CommerceRow[];
    const format = query.get('format') === 'xlsx' ? 'xlsx' : 'csv';
    let body: Uint8Array | string;
    let contentType = 'text/csv; charset=utf-8';
    if (format === 'xlsx') {
        const wb = new ExcelJS.Workbook();
        const sheet = wb.addWorksheet(type);
        const keys = [...new Set(rows.flatMap(Object.keys))];
        sheet.addRow(keys);
        for (const row of rows)
            sheet.addRow(keys.map(k => typeof row[k] === 'object' ? JSON.stringify(row[k]) : row[k] ?? ''));
        sheet.getRow(1).font = { bold: true };
        sheet.columns.forEach(c => { c.width = 25; });
        body = new Uint8Array(await wb.xlsx.writeBuffer());
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    else
        body = financialCsv(rows);
    return new Response(body as BodyInit, { headers: { 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="coaching-${type}.${format}"`, 'Cache-Control': 'private, no-store' } });
}
