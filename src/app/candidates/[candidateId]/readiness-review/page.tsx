import {DevelopmentWorkspace} from '@/components/development-intelligence/workspace';
export default async function Page({params,searchParams}:{params:Promise<{candidateId:string}>;searchParams:Promise<{roleId?:string}>}){return <DevelopmentWorkspace candidate={(await params).candidateId} view='readiness' roleId={(await searchParams).roleId}/>;}
