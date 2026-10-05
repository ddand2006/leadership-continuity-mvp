import { execFileSync } from 'node:child_process';

const sourceUrl = 'https://hnrwovfgttenymnhowsf.supabase.co/rest/v1';
const organizationId = 'f46b8238-98d5-42f7-94ec-a639be885712';
const localDb = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const password = 'LocalTest123!';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required and must be the hosted service key.');

async function get(table, query = `organization_id=eq.${organizationId}`) {
  const response = await fetch(`${sourceUrl}/${table}?${query}&limit=1000`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  return response.json();
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runSql(sql) {
  execFileSync('psql', [localDb, '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'inherit' });
}

function insert(table, row) {
  const json = JSON.stringify(row).replaceAll("'", "''");
  runSql(`insert into public.${table} select * from json_populate_record(null::public.${table}, '${json}') on conflict do nothing;`);
}

const sourceProfiles = await get('profiles');
const sourceUsers = await get('organization_users');
const sourceCandidates = await get('candidates');
const sourceRoles = await get('roles');
const sourceCompetencies = await get('role_competencies');
const sourceAssignments = await get('mentor_role_assignments');
const sourceProjectAssignments = await get('candidate_project_assignments');
const sourceDevelopmentRecords = await get('development_records');
const sourceProjects = await get('development_projects');
const sourceOrganization = (await get('organizations', `id=eq.${organizationId}`))[0];

if (!sourceOrganization) throw new Error('Source organization was not found.');

runSql(`create extension if not exists pgcrypto;`);
runSql(`insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) select gen_random_uuid(), 'authenticated', 'authenticated', email, crypt(${sqlLiteral(password)}, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb from (values ${sourceProfiles.map((p) => `(${sqlLiteral(p.email)})`).join(',')}) as source(email) where not exists (select 1 from auth.users u where lower(u.email)=lower(source.email));`);

const localUsers = execFileSync('psql', [localDb, '-Atc', `select id::text || chr(9) || email from auth.users where email is not null`], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean).map((line) => { const [id, email] = line.split('\t'); return [email.toLowerCase(), id]; });
const authByEmail = new Map(localUsers);
if (authByEmail.size < sourceProfiles.length) throw new Error('Not all source profile emails have local auth users.');

insert('organizations', sourceOrganization);
for (const profile of sourceProfiles) insert('profiles', { ...profile, auth_user_id: authByEmail.get(profile.email.toLowerCase()) });
for (const role of sourceRoles) insert('roles', role);
for (const competency of sourceCompetencies) insert('role_competencies', competency);
for (const candidate of sourceCandidates) insert('candidates', candidate);
for (const user of sourceUsers) insert('organization_users', user);
for (const assignment of sourceAssignments) insert('mentor_role_assignments', assignment);
for (const project of sourceProjects) insert('development_projects', { ...project, source_development_record_id: null, source_project_assignment_id: null });
for (const assignment of sourceProjectAssignments) insert('candidate_project_assignments', assignment);
for (const record of sourceDevelopmentRecords) insert('development_records', { ...record, source_project_assignment_id: null });

console.log(JSON.stringify({ imported: { profiles: sourceProfiles.length, organization_users: sourceUsers.length, candidates: sourceCandidates.length, roles: sourceRoles.length, role_competencies: sourceCompetencies.length, mentor_role_assignments: sourceAssignments.length, development_records: sourceDevelopmentRecords.length, development_projects: sourceProjects.length }, password: 'LocalTest123!' }, null, 2));
