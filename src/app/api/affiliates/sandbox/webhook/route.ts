import { NextResponse } from "next/server";
import { getAffiliateStripe } from "@/lib/affiliate-stripe";
import { handleSandboxEvent } from "@/lib/affiliate-sandbox";
export async function POST(request:Request) {
 const secret=process.env.STRIPE_AFFILIATE_TEST_WEBHOOK_SECRET;
 if(!secret) return NextResponse.json({error:'Sandbox webhook is not configured.'},{status:503});
 let event;
 try {
  event=getAffiliateStripe(true).webhooks.constructEvent(await request.text(),request.headers.get('stripe-signature')??'',secret);
  if(event.livemode) return NextResponse.json({error:'Live events are not accepted here.'},{status:400});
 }catch{return NextResponse.json({error:'Invalid sandbox signature or configuration.'},{status:400});}
 try{await handleSandboxEvent(event);return NextResponse.json({received:true});}
 catch{return NextResponse.json({error:'Sandbox event processing failed.'},{status:500});}
}
