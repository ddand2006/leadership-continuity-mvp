import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAppRole } from "@/lib/mentor-access";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

type Rating = { respondent_id: string; snapshot_question_id: string; rating: number | null; not_observed: boolean };
type Respondent = { id: string; invited_relationship: string; confirmed_relationship: string | null; status: string };

const mean = (values: number[]) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
const formatScore = (score: number | null) => score === null ? "—" : score.toFixed(1);

function respondentRelationship(respondent: Respondent) { return respondent.confirmed_relationship ?? respondent.invited_relationship; }

export default async function Page({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  const { profile, supabase } = await requirePaidWorkspaceProfile();
  if (!isAdminAppRole(profile.role)) redirect("/dashboard");

  const [reviewResult, competencyResult, questionResult, respondentResult, ratingResult] = await Promise.all([
    supabase.from("review_360_cycles").select("id,title,role_title,employee_organization_user_id,candidate_id,confidentiality_threshold,status,due_date").eq("id", reviewId).eq("organization_id", profile.organization_id).maybeSingle(),
    supabase.from("review_360_snapshot_competencies").select("id,name,definition,display_order").eq("review_cycle_id", reviewId).eq("organization_id", profile.organization_id).order("display_order"),
    supabase.from("review_360_snapshot_questions").select("id,snapshot_competency_id,prompt,display_order").eq("review_cycle_id", reviewId).eq("organization_id", profile.organization_id).order("display_order"),
    supabase.from("review_360_respondents").select("id,invited_relationship,confirmed_relationship,status").eq("review_cycle_id", reviewId).eq("organization_id", profile.organization_id),
    supabase.from("review_360_question_ratings").select("respondent_id,snapshot_question_id,rating,not_observed").eq("review_cycle_id", reviewId).eq("organization_id", profile.organization_id),
  ]);
  const error = reviewResult.error ?? competencyResult.error ?? questionResult.error ?? respondentResult.error ?? ratingResult.error;
  if (error) throw new Error(error.message);
  if (!reviewResult.data) notFound();

  const subject = reviewResult.data.candidate_id
    ? await supabase.from("candidates").select("full_name").eq("id", reviewResult.data.candidate_id).maybeSingle()
    : await supabase.from("organization_users").select("first_name,last_name").eq("id", reviewResult.data.employee_organization_user_id).maybeSingle();
  if (subject.error) throw new Error(subject.error.message);

  const review = reviewResult.data;
  const threshold = review.confidentiality_threshold;
  const respondents = (respondentResult.data ?? []) as Respondent[];
  const respondentById = new Map(respondents.map((respondent) => [respondent.id, respondent]));
  const ratings = ((ratingResult.data ?? []) as Rating[]).filter((rating) => respondentById.get(rating.respondent_id)?.status === "completed" && !rating.not_observed && rating.rating !== null);
  const questions = questionResult.data ?? [];
  const questionsByCompetency = new Map<string, typeof questions>();
  questions.forEach((question) => questionsByCompetency.set(question.snapshot_competency_id, [...(questionsByCompetency.get(question.snapshot_competency_id) ?? []), question]));
  const completed = respondents.filter((respondent) => respondent.status === "completed").length;
  const nonSelfRespondents = new Set(respondents.filter((respondent) => respondent.status === "completed" && respondentRelationship(respondent) !== "self").map((respondent) => respondent.id));
  const employeeName = reviewResult.data.candidate_id
    ? subject.data && "full_name" in subject.data ? subject.data.full_name : "Candidate"
    : subject.data && "first_name" in subject.data ? `${subject.data.first_name} ${subject.data.last_name}` : "Employee";

  function scoresForQuestions(questionIds: string[], relationship?: string) {
    return ratings.filter((rating) => questionIds.includes(rating.snapshot_question_id) && (!relationship || respondentRelationship(respondentById.get(rating.respondent_id)!) === relationship)).map((rating) => rating.rating as number);
  }
  function responseCountForQuestions(questionIds: string[], relationship?: string) {
    return new Set(ratings.filter((rating) => questionIds.includes(rating.snapshot_question_id) && (!relationship || respondentRelationship(respondentById.get(rating.respondent_id)!) === relationship)).map((rating) => rating.respondent_id)).size;
  }
  function protectedScore(questionIds: string[], relationship: string) {
    return responseCountForQuestions(questionIds, relationship) >= threshold ? formatScore(mean(scoresForQuestions(questionIds, relationship))) : "Protected";
  }
  function feedbackScore(questionIds: string[]) {
    const values = ratings.filter((rating) => questionIds.includes(rating.snapshot_question_id) && respondentRelationship(respondentById.get(rating.respondent_id)!) !== "self").map((rating) => rating.rating as number);
    const count = new Set(ratings.filter((rating) => questionIds.includes(rating.snapshot_question_id) && respondentRelationship(respondentById.get(rating.respondent_id)!) !== "self").map((rating) => rating.respondent_id)).size;
    return count >= threshold ? formatScore(mean(values)) : "Protected";
  }

  const competencyRows = (competencyResult.data ?? []).map((competency) => {
    const questionIds = (questionsByCompetency.get(competency.id) ?? []).map((question) => question.id);
    return { ...competency, questionIds, feedback: feedbackScore(questionIds), self: formatScore(mean(scoresForQuestions(questionIds, "self"))), supervisor: formatScore(mean(scoresForQuestions(questionIds, "supervisor"))), peer: protectedScore(questionIds, "peer"), directReport: protectedScore(questionIds, "direct_report") };
  });
  const allQuestionIds = questions.map((question) => question.id);
  const overallFeedback = feedbackScore(allQuestionIds);

  return <main className="app-page"><div className="mx-auto max-w-[1380px] px-6 py-12">
    <Link href={`/360-review/${reviewId}`} className="text-sm font-semibold text-teal-800">← Back to review workspace</Link>
    <div className="mt-5 flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm font-semibold tracking-[.16em] text-teal-700 uppercase">Confidential 360 report</p><h1 className="mt-2 font-display text-5xl">{employeeName}</h1><p className="mt-2 text-lg text-slate-600">{review.role_title} · {review.title}</p></div><div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-right shadow-sm"><p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Overall feedback</p><p className="mt-1 font-display text-4xl text-teal-900">{overallFeedback}</p><p className="text-xs text-slate-500">out of 5</p></div></div>
    <section className="mt-8 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Invited respondents</p><p className="mt-2 font-display text-4xl">{respondents.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Completed responses</p><p className="mt-2 font-display text-4xl">{completed}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Questions scored</p><p className="mt-2 font-display text-4xl">{questions.length}</p></div></section>
    <section className="mt-7 rounded-2xl border border-teal-100 bg-teal-50 p-5 text-sm text-teal-950"><strong>Confidentiality protection:</strong> peer and direct-report scores are shown only when at least {threshold} completed respondents in that relationship group answered the questions. “Protected” means the threshold has not been met. Individual respondent answers are never displayed.</section>
    {!completed ? <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">No completed responses yet. This dashboard will populate automatically as respondents submit their surveys.</section> : <>
      <section className="mt-7 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"><div className="p-7"><p className="text-sm font-semibold tracking-[.16em] text-teal-700 uppercase">Competency scorecard</p><h2 className="mt-2 font-display text-3xl">Group-level results</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="border-y bg-slate-50 text-slate-500"><tr><th className="px-6 py-4">Competency</th><th className="px-4 py-4">Feedback</th><th className="px-4 py-4">Self</th><th className="px-4 py-4">Supervisor</th><th className="px-4 py-4">Peer</th><th className="px-4 py-4">Direct report</th></tr></thead><tbody>{competencyRows.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="px-6 py-5"><p className="font-semibold text-slate-900">{row.name}</p><p className="mt-1 max-w-xl text-xs text-slate-500">{row.definition}</p></td><td className="px-4 py-5 font-semibold text-teal-900">{row.feedback}</td><td className="px-4 py-5">{row.self}</td><td className="px-4 py-5">{row.supervisor}</td><td className="px-4 py-5">{row.peer}</td><td className="px-4 py-5">{row.directReport}</td></tr>)}</tbody></table></div></section>
      <section className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm"><p className="text-sm font-semibold tracking-[.16em] text-teal-700 uppercase">Question detail</p><h2 className="mt-2 font-display text-3xl">Observable behaviors</h2><div className="mt-6 grid gap-6">{competencyRows.map((competency) => <div key={competency.id} className="rounded-2xl border border-slate-100 p-5"><h3 className="font-display text-2xl">{competency.name}</h3><div className="mt-4 grid gap-3">{(questionsByCompetency.get(competency.id) ?? []).map((question, index) => <div key={question.id} className="flex items-start justify-between gap-6 border-t border-slate-100 pt-3 first:border-0 first:pt-0"><p className="text-sm text-slate-700">{index + 1}. {question.prompt}</p><p className="shrink-0 text-sm font-semibold text-teal-900">{feedbackScore([question.id])} <span className="font-normal text-slate-500">feedback</span></p></div>)}</div></div>)}</div></section>
    </>}
  </div></main>;
}
