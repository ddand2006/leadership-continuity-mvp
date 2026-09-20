"use client";
import { useState } from "react";
export function ShareAffiliateLink({ path, title }: { path: string; title: string }) {
 const [message, setMessage] = useState("");
 async function copy() {
  try { await navigator.clipboard.writeText(new URL(path, window.location.origin).href); setMessage("Link copied. Paste it into your email or message."); }
  catch { setMessage("Open the link and copy the address from your browser."); }
 }
 function email() {
  const url = new URL(path, window.location.origin).href;
  window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`;
 }
 return <div className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{title}</h3><a className="break-all underline" href={path}>{path}</a><div className="flex flex-wrap gap-3"><button type="button" className="rounded border p-3" onClick={() => void copy()}>Copy link</button><button type="button" className="rounded border p-3" onClick={email}>Draft email with link</button></div>{message && <p role="status">{message}</p>}</div>;
}
