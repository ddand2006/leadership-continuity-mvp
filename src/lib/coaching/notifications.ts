import 'server-only';
import {hasResendEnv,getAppUrl} from '@/lib/env';
import {sendResendEmail} from '@/lib/resend';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
// The service client is used only for the recipient-address outbox, never coaching content.
export async function deliverCoachingNotifications(actorId:string){
 if(!hasResendEnv())return;
 const db=createSupabaseAdminClient();
 const {data,error}=await db.rpc('coaching_email_claim',{actor:actorId});
 if(error)throw new Error(error.message);
 for(const n of data??[]){
  try{
   const url=new URL(n.href,getAppUrl()).toString();
   const text=`${n.title}\n\nOpen Leader Continuity to review: ${url}`;
   await sendResendEmail({to:n.email,subject:`Leader Continuity: ${n.title}`,text,html:`<p>${n.title}</p><p><a href="${url.replaceAll('&','&amp;').replaceAll('"','&quot;')}">Open Leader Continuity</a></p>`,idempotencyKey:`coaching-notification-${n.id}`});
   await db.rpc('coaching_email_complete',{notification_id:n.id,claim:n.claim});
  }catch{console.warn('Coaching notification email deferred; in-app notification remains available.');}
 }
}
