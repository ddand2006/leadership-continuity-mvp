import { CandidateProgressPage } from "@/components/candidate-progress-page";

export default async function Page({ params }: { params: Promise<{ candidateId: string }> }) {
  return <CandidateProgressPage candidateId={(await params).candidateId} />;
}
