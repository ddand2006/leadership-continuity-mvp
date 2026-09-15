import { CoachingWorkspace } from '@/components/coaching/workspace';
export default async function CoachingPage({ params, searchParams }: {
    params: Promise<{
        path: string[];
    }>;
    searchParams: Promise<Record<string, string>>;
}) { return <CoachingWorkspace path={(await params).path} filters={await searchParams}/>; }
