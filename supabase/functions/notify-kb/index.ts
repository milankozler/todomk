// =====================================================================
//  Supabase Edge Function: notify-kb  (todomk · Znalosti)
//  E-mail při:
//    - novém komentáři k poznámce  → autor poznámky, kdo smí upravovat,
//      kdo už v poznámce komentoval, a kdo je v komentáři zmíněn @jménem
//    - nasdílení poznámky vybraným lidem → nově přidaní čtenáři / editoři
//  Posílá jen lidem, kteří poznámku smějí číst. Autor akce e-mail nedostane.
//  Kdo má profiles.notify = false, nedostane nic.
//  Volání musí nést hlavičku x-hook-secret (private.settings.hook_secret).
//  Secrets: RESEND_API_KEY, NOTIFY_FROM (volitelně), APP_URL (volitelně)
// =====================================================================
const RESEND = Deno.env.get("RESEND_API_KEY")!;
const FROM = Deno.env.get("NOTIFY_FROM") ?? "Úkoly <onboarding@resend.dev>";
const APP = Deno.env.get("APP_URL") ?? "https://todomk.netlify.app/";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SVC, Authorization: `Bearer ${SVC}` };

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const link = (id: string) => `${APP.replace(/#.*$/, "")}#kb/${id}`;

async function rest(path: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
  return r.ok ? await r.json() : [];
}
async function secretOk(s: string | null) {
  if (!s) return false;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/check_hook_secret`, {
    method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ s }),
  });
  return r.ok && (await r.json()) === true;
}
function canRead(note: any, p: any) {
  if (p.id === note.owner) return true;
  if (note.visibility === "team") return true;
  if (note.visibility === "people") return [...(note.readers ?? []), ...(note.editors ?? [])].includes(p.name);
  return false;
}
function shell(headline: string, title: string, inner: string, id: string) {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2328;max-width:560px">
    <p style="color:#6b7280;margin:0 0 4px">${headline}</p>
    <h2 style="margin:0 0 10px">${esc(title || "Bez názvu")}</h2>
    ${inner}
    <p><a href="${link(id)}" style="color:#2563eb">Otevřít poznámku ve Znalostech →</a></p>
  </div>`;
}
async function send(to: any[], subject: string, html: string) {
  const out: string[] = [];
  for (const p of to) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: p.email, subject, html }),
    });
    out.push(`${p.name}:${r.status}`);
    if (!r.ok) console.error("resend", p.email, r.status, await r.text());
  }
  return out.join(" ") || "nobody";
}

Deno.serve(async (req) => {
  try {
    if (!(await secretOk(req.headers.get("x-hook-secret")))) return new Response("unauthorized", { status: 401 });
    const body = await req.json();
    const rec = body.record ?? {};
    const people: any[] = await rest("profiles?select=id,name,email,notify");
    const ok = (p: any) => p && p.email && p.notify !== false;

    // ---- nový komentář ----
    if (body.table === "kb_comments") {
      const [note] = await rest(`kb_notes?select=id,title,owner,owner_name,visibility,readers,editors,team_edit&id=eq.${rec.note_id}`);
      if (!note) return new Response("note not found", { status: 200 });
      const prev: any[] = await rest(`kb_comments?select=author_id&note_id=eq.${rec.note_id}`);
      const want = new Set<string>();
      want.add(note.owner);
      for (const c of prev) want.add(c.author_id);
      for (const p of people) if ((note.editors ?? []).includes(p.name)) want.add(p.id);
      const text = norm(String(rec.body ?? ""));
      for (const p of people) {
        const n = norm(p.name ?? "");
        if (n && new RegExp(`(^|[\\s(])@${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[\\s.,;:!?)])`).test(text)) want.add(p.id);
      }
      const to = people.filter((p) => want.has(p.id) && p.id !== rec.author_id && ok(p) && canRead(note, p));
      const inner = (rec.quote ? `<div style="color:#6b7280;border-left:3px solid #F2B544;padding:4px 10px;margin:0 0 8px">„${esc(rec.quote)}“</div>` : "") +
        `<div style="background:#f4f5f7;border-left:3px solid #2563eb;padding:8px 12px;white-space:pre-wrap">${esc(rec.body)}</div>`;
      const html = shell(`💬 Komentář od <b>${esc(rec.author_name)}</b>`, note.title, inner, note.id);
      return new Response(await send(to, `💬 ${rec.author_name}: ${note.title || "poznámka"}`, html), { status: 200 });
    }

    // ---- poznámka nasdílena vybraným lidem ----
    if (body.table === "kb_notes") {
      if (rec.visibility !== "people") return new Response("not people", { status: 200 });
      const old = body.old_record ?? {};
      const before = new Set<string>(old.visibility === "people" ? [...(old.readers ?? []), ...(old.editors ?? [])] : []);
      const added = [...(rec.readers ?? []), ...(rec.editors ?? [])].filter((n: string) => !before.has(n));
      if (!added.length) return new Response("nobody new", { status: 200 });
      const to = people.filter((p) => added.includes(p.name) && p.id !== rec.owner && ok(p));
      const results: string[] = [];
      for (const p of to) {
        const edit = (rec.editors ?? []).includes(p.name);
        const html = shell(`📄 <b>${esc(rec.owner_name)}</b> s tebou sdílí poznámku`, rec.title,
          `<p style="margin:0 0 8px">Můžeš ji ${edit ? "číst i upravovat" : "číst a komentovat"}.</p>`, rec.id);
        results.push(await send([p], `📄 ${rec.owner_name} s tebou sdílí: ${rec.title || "poznámku"}`, html));
      }
      return new Response(results.join(" ") || "nobody", { status: 200 });
    }
    return new Response("ignored", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("err: " + (e as Error).message, { status: 200 });
  }
});
