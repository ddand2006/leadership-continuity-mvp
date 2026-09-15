import { CoachingWorkspace } from '@/components/coaching/workspace';
export default async function CoachingAdmin({ params,searchParams }: {params:Promise<{section:string}>;searchParams:Promise<Record<string,string|undefined>>}) { return <CoachingWorkspace path={['admin', (await params).section]} filters={await searchParams}/>;}
