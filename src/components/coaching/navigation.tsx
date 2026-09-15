import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {coachingContext} from '@/lib/coaching/server';
import {availableViews, currentView, viewHomes, viewLabels, viewLinks, type ViewAccess, type CoachingView} from '@/lib/coaching/views';
export async function CoachingNavigation({access,path}:{access:ViewAccess;path:string[]}) {
 const selected=currentView(access,path,(await cookies()).get('coaching-view')?.value);
 async function switchView(form:FormData) {
  'use server';
  const ctx=await coachingContext(), view=String(form.get('view')) as CoachingView;
  if(!availableViews(ctx).includes(view)) throw new Error('View not available');
  (await cookies()).set('coaching-view',view,{httpOnly:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});
  redirect(viewHomes[view]);
 }
 const pathname=path[0]==='admin'?'/admin/coaching/'+(path[1]??'overview'):'/coaching/'+(path.join('/')||'');
 return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
   <div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Coaching workspace</p><h2 className="mt-1 text-xl font-semibold text-teal-950">{viewLabels[selected]}</h2></div>
   <form action={switchView} aria-label="Choose coaching view" className="flex flex-wrap gap-2">{availableViews(access).map(view=><button key={view} name="view" value={view} aria-pressed={selected===view} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selected===view?'border-teal-950 bg-teal-950 text-white':'border-slate-300 text-teal-950 hover:bg-teal-50'}`}>{viewLabels[view]}</button>)}</form>
  </div>
  <nav aria-label={`${viewLabels[selected]} navigation`} className="mt-4 flex flex-wrap gap-2">{viewLinks[selected].map(([route,label])=>{const href=selected==='platform'?'/admin/coaching/'+route:'/coaching/'+route;const active=pathname===href;return <Link key={href} href={href} aria-current={active?'page':undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold ${active?'bg-teal-100 text-teal-950':'text-slate-600 hover:bg-slate-100'}`}>{label}</Link>;})}</nav>
  {access.platformAdmin&&selected!=='platform'&&<p className="mt-3 text-xs text-slate-500">Reviewing this workspace with your existing account permissions.</p>}
 </section>;
}
