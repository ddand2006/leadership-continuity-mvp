import { NextRequest } from 'next/server';
import { coachingContext, rpc } from '@/lib/coaching/server';
import { filterLog, logCsv, type LogRow } from '@/lib/coaching/model';
export async function GET(request: NextRequest) {
    const { db, coach } = await coachingContext();
    if (!coach)
        return new Response('Coach access required', { status: 403 });
    const rows = filterLog(await rpc<LogRow[]>(db, 'coaching_credential_log'), Object.fromEntries(request.nextUrl.searchParams));
    return new Response(logCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="coaching-log.csv"', 'Cache-Control': 'private, no-store' } });
}
