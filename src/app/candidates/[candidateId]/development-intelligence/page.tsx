import {DevelopmentWorkspace} from '@/components/development-intelligence/workspace';
export default async function Page({params}:{params:Promise<{candidateId:string}>}){return <DevelopmentWorkspace candidate={(await params).candidateId} view='priorities'/>;}
