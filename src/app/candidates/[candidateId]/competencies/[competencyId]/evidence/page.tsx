import {DevelopmentWorkspace} from '@/components/development-intelligence/workspace';
export default async function Page({params}:{params:Promise<{candidateId:string;competencyId:string}>}){const p=await params;return <DevelopmentWorkspace candidate={p.candidateId} competency={p.competencyId} view='evidence'/>;}
