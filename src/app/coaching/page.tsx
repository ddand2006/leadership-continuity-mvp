import { CoachingWorkspace } from '@/components/coaching/workspace';
export default async function CoachingPage({ searchParams }: {
    searchParams: Promise<Record<string, string>>;
}) { return <CoachingWorkspace path={[]} filters={await searchParams}/>; }
