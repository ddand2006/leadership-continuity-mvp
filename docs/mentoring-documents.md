# Saved mentoring documents

The Word export actions for individual mentoring projects, development idea sets, and candidate progress reports save a private copy before returning the download. Saved copies appear in the mentoring flow and the related report/idea views; later downloads retrieve those exact bytes. Generating a mentee worksheet also saves a Word copy automatically. The worksheet section provides the document library and a Save Word document action for existing worksheets or subsequent edits, without another AI generation. The Word copy includes the assignment, first steps, weekly checkpoints, report-back prompts, reflection questions, and notes. Worksheet edits are also saved to the development record.

The library offers each document's mentee and active assigned mentors as email recipients, showing their account email before sending. The server resolves the recipient again at send time and attaches the saved Word file through the existing Resend integration. There is no automatic email on generation. A successful response means Resend accepted the email, not confirmation of inbox delivery.

## Rollout

Apply `supabase/migrations/202609120001_mentoring_documents.sql` before deploying the application changes. It creates the `mentoring_documents` table and private storage bucket. No direct authenticated or anonymous table access is granted: authenticated API handlers enforce organization, candidate, and mentoring-track access using the service client.

The existing Resend environment settings must be configured. Mentee/mentor recipients need an active or invited organization account with an email; mentees need their candidate association and mentors their active track assignment. Existing downloads are not backfilled because their files were not retained.

Verify with a test candidate: save a Word export, see it appear without refreshing, reload the page, download the stored copy, and explicitly send it to a test mentor or mentee. Check a user from another organization and an unassigned mentor cannot list, download, or email the files. A storage or metadata failure should fail the export rather than claim the document was saved.

## Local validation

`node scripts/test-mentoring-documents.cjs` checks persistence, failure cleanup, exact email attachments, retry keys, recipient checks, track authorization, and invalid requests with mocked external services. No live emails are sent by the tests.

Mentor Direction also saves a Word copy automatically on generation. Existing direction can be exported without AI using Save mentor direction as Word. Its section includes the same saved-document download and email controls. `node scripts/test-mentor-direction-document.cjs` verifies the document content, automatic saving, export without regeneration, and storage-failure recovery.
