'use client';

import Link from 'next/link';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {useTransition,type ReactNode} from 'react';
import {isPreviewRole,previewRoles,roleLabels,rolePages,previewHref,safeReturnPath,sampleCompanies,sampleIdentity} from '@/lib/platform-preview/model';

export function PlatformPreviewChrome({children}:{children:ReactNode}) {
 const pathname=usePathname(),query=useSearchParams(),router=useRouter();
 const [pending,startTransition]=useTransition();
 const parts=pathname.split('/').filter(Boolean);
 const role=parts[0]==='view-as'&&isPreviewRole(parts[1])?parts[1]:null;
 const section=parts[2]??'home';
 const returnTo=role?safeReturnPath(query.get('returnTo')):safeReturnPath(pathname+(query.size?'?'+query.toString():''));
 const sample=sampleIdentity(role??'candidate',query.get('company'),query.get('person'));
 const values={company:sample.company.id,person:sample.person?'second':'first',returnTo};
 function navigate(href:string){startTransition(()=>router.push(href));}
 const selector=<label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-teal-950">View as
  <select aria-label="View as" value={role??'platform'} disabled={pending} onChange={event=>{const next=event.target.value;navigate(isPreviewRole(next)?previewHref(next,role?section:'home',values):returnTo);}} className="max-w-full rounded-xl border border-teal-800/25 bg-white px-3 py-2 text-sm">
   <option value="platform">Platform Administrator</option>{previewRoles.map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}
  </select>
 </label>;
 if(!role)return <><div className="mx-auto mt-4 flex w-full max-w-[1380px] flex-wrap items-center justify-end gap-3 px-5 sm:px-8">{selector}<span className="text-xs text-slate-500">Explore sample role workspaces</span><span role="status" className="text-sm">{pending?'Opening workspace…':''}</span></div>{children}</>;
 return <header className="relative z-10 px-5 pt-4 sm:px-8 lg:px-10">
  <div className="mx-auto max-w-[1380px]">
   <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950" role="region" aria-label="Role preview banner">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Viewing as: {roleLabels[role]}</p><p className="mt-1 text-sm">Sample workspace · Fictional people and records · Changes stay in this preview</p></div><Link href={returnTo} className="rounded-full border border-amber-900/30 bg-white px-4 py-2 text-sm font-semibold">Return to Administrator</Link></div>
   </div>
   <div className="theme-panel-strong mt-3 rounded-[2rem] p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><Link href={previewHref(role,'home',values)} className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-950 font-display text-teal-50">LC</span><span><span className="block text-xs font-semibold uppercase tracking-widest text-teal-700">Leader Continuity</span><span className="block text-sm text-slate-600">{sample.company.shortName}</span></span></Link>{selector}</div>
    <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl bg-slate-50 p-3">
     <label className="grid gap-1 text-xs font-semibold text-slate-600">Sample company<select aria-label="Sample company" value={sample.company.id} disabled={pending} onChange={e=>navigate(previewHref(role,section,{...values,company:e.target.value}))} className="max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">{sampleCompanies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     <label className="grid gap-1 text-xs font-semibold text-slate-600">{role==='candidate'||role==='coachee'?'Sample person':'Sample leader in this workspace'}<select aria-label="Sample person" value={values.person} disabled={pending} onChange={e=>navigate(previewHref(role,section,{...values,person:e.target.value}))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">{sample.company.people.map((name,i)=><option key={name} value={i?'second':'first'}>{name}</option>)}</select></label>
     <p className="pb-2 text-sm text-slate-600">{sample.name} · {roleLabels[role]}</p>
     <span role="status" className="pb-2 text-sm text-slate-500">{pending?'Opening workspace…':''}</span>
    </div>
    <nav aria-label={`${roleLabels[role]} platform navigation`} className="mt-4 flex flex-wrap gap-1">{rolePages[role].map(page=><Link key={page.id} href={previewHref(role,page.id,values)} aria-current={section===page.id?'page':undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold ${section===page.id?'interactive-contrast bg-teal-950 text-white':'text-teal-950 hover:bg-teal-50'}`}>{page.label}</Link>)}</nav>
   </div>
  </div>
 </header>;
}
