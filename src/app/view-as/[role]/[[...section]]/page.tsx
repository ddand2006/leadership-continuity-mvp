import {notFound} from 'next/navigation';
import {requirePlatformPreviewAdministrator} from '@/lib/platform-preview/server';
import {isPreviewRole,rolePages,resolveSample} from '@/lib/platform-preview/model';
import {PreviewWorkspace} from '@/components/platform-preview/workspace';
export default async function ViewAsPage({params,searchParams}:{params:Promise<{role:string;section?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 await requirePlatformPreviewAdministrator();
 const {role,section=[]}=await params;
 if(!isPreviewRole(role)||section.length>1)notFound();
 const page=section[0]??'home';
 if(!rolePages[role].some(p=>p.id===page))notFound();
 const query=await searchParams;
 const company=typeof query.company==='string'?query.company:undefined;
 const person=typeof query.person==='string'?query.person:undefined;
 const sample=resolveSample(company,person);
 return <PreviewWorkspace key={`${role}-${sample.company.id}-${sample.person}-${page}`} role={role} section={page} company={sample.company.id} person={sample.person?'second':'first'}/>;
}
