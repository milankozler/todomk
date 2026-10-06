/* =====================================================================
   todomk · ZNALOSTI – sdílená znalostní báze
   (poznámky, záznamy ze schůzek, postupy, rozhodnutí, kontakty, nápady)

   Veřejné API
     KB.boot(cfg)                 – připojí modul (cfg: api, me, people, host)
     KB.open({noteId, q, kind})   – otevře obrazovku Znalosti
     KB.close() / KB.isOpen()
     KB.refresh()                 – znovu načte seznam
     KB.renderTaskLinks(taskId, el, beforeOpen) – poznámky, ze kterých úkol vznikl
     KB.importLegacy(notes)       – převod starých „sticky" poznámek
     KB.supabaseApi(sb, me)       – datová vrstva nad Supabase (tabulky kb_*)
     KB.memoryApi(seed, me)       – datová vrstva v paměti (náhled, testy)
     KB.ui                        – dialogy a toast (dlg, confirm, prompt, toast)

   Zápis úkolu do poznámky: {{ukol:ID}}   Odkaz na poznámku: [[Název]] / [[Název|text]]
   Příloha: ![soubor](https://kb.local/<noteId>/<soubor>)   Zmínka: @jméno
   ===================================================================== */
(function(){
'use strict';
const KB = window.KB = {};

/* ------------------------------------------------------------------ ikony */
const P = {
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  pin:'<path d="M12 17v5M9 3h6l-1 6 4 4v2H6v-2l4-4z"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  team:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clip:'<path d="m21 11-8.6 8.6a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.3-2.4l7.9-7.9"/>',
  task:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  dots:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
  note:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  olist:'<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  checklist:'<path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  quote:'<path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6"/>',
  brackets:'<path d="M8 4H5v16h3M16 4h3v16h-3"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  fileimp:'<path d="M14 3v5h5"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2zM12 11v6M9 14l3 3 3-3"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'
};
const ICON = (n, cls='') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n]||''}</svg>`;

/* --------------------------------------------------------------- pomocné */
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const sleep = ms => new Promise(r=>setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));
function lsGet(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
function lsSet(k, v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
const todayISO = ()=>{ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
function plural(n, one, few, many){ return n===1 ? one : (n>=2 && n<=4 ? few : many); }
function relTime(iso){
  if(!iso) return '';
  const d=new Date(iso), now=new Date(), s=(now-d)/1000;
  if(s<60) return 'teď';
  if(s<3600) return Math.floor(s/60)+' min';
  if(d.toDateString()===now.toDateString()) return d.toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'});
  const y=new Date(now); y.setDate(now.getDate()-1);
  if(d.toDateString()===y.toDateString()) return 'včera';
  if(now-d < 6*86400000) return d.toLocaleDateString('cs-CZ',{weekday:'short'});
  return d.getDate()+'. '+(d.getMonth()+1)+'.'+(d.getFullYear()!==now.getFullYear()?' '+d.getFullYear():'');
}
function fullTime(iso){
  if(!iso) return '';
  const d=new Date(iso);
  return d.getDate()+'. '+(d.getMonth()+1)+'. '+d.getFullYear()+' '+d.toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'});
}
function fmtDay(ds){ if(!ds) return ''; const d=new Date(ds+'T00:00:00'); return d.getDate()+'. '+(d.getMonth()+1)+'. '+d.getFullYear(); }
function fmtShort(ds){ if(!ds) return ''; const d=new Date(ds+'T00:00:00'); return d.getDate()+'. '+(d.getMonth()+1)+'.'; }

const KINDS = [
  {id:'poznamka',   name:'Poznámka',   plural:'Poznámky'},
  {id:'schuzka',    name:'Schůzka',    plural:'Schůzky'},
  {id:'postup',     name:'Postup',     plural:'Postupy'},
  {id:'rozhodnuti', name:'Rozhodnutí', plural:'Rozhodnutí'},
  {id:'kontakt',    name:'Kontakt',    plural:'Kontakty'},
  {id:'napad',      name:'Nápad',      plural:'Nápady'}
];
const KIND = Object.fromEntries(KINDS.map(k=>[k.id,k]));
const kindOf = k => KIND[k] || KIND.poznamka;
const kc = k => `var(--k-${KIND[k]?k:'poznamka'})`;
const TEMPLATES = {
  poznamka:'',
  schuzka:'## Shrnutí\n\n\n## Rozhodnutí\n- \n\n## Úkoly\n\n\n## Poznámky\n',
  postup:'## K čemu to je\n\n\n## Postup\n1. \n2. \n3. \n\n## Na co si dát pozor\n- \n',
  rozhodnuti:'## Situace\n\n\n## Rozhodnutí\n\n\n## Proč\n- \n\n## Kdo a do kdy\n',
  kontakt:'**Firma:** \n**Telefon:** \n**E-mail:** \n**Web:** \n\n## Spolupráce\n\n\n## Poznámky\n',
  napad:'## O co jde\n\n\n## Proč by to fungovalo\n- \n\n## Další krok\n- [ ] \n'
};
const PCOLORS = ['#F2B544','#7DB3F7','#8BD3A6','#F59E8B','#C4A7F5','#6FD0D8','#F7A8D0','#B8C27A'];

/* odvozená pole – stejná pravidla jako trigger v databázi */
const TASK_RE = /\{\{ukol:([A-Za-z0-9_-]{1,64})\}\}/g;
const LINK_RE = /\[\[([^\]\n]{1,200})\]\]/g;
function deriveTasks(body){ const out=[]; let m; TASK_RE.lastIndex=0; while((m=TASK_RE.exec(body||''))) if(!out.includes(m[1])) out.push(m[1]); return out; }
function deriveLinks(body){ const out=[]; let m; LINK_RE.lastIndex=0; while((m=LINK_RE.exec(body||''))){ const t=norm(m[1].split('|')[0]); if(t && !out.includes(t)) out.push(t); } return out; }
/* hledání: zjednodušené české koncovky (obce/obci/obcí, kalendáře/kalendářů) – stejné pravidlo jako kb_search v databázi */
function stemCs(w){
  if(w.length<4) return w;
  const s=w.replace(/(ami|ach|ech|ich|ovi|em|um|ou|y|a|e|i|o|u)$/,'');
  return s.length>=3 ? s : w;
}
function plainText(body){
  return String(body||'').replace(/\{\{ukol:[^}]*\}\}|!?\[[^\]]*\]\(https:\/\/kb\.local\/[^)]*\)/g,' ')
    .replace(/\[\[([^\]|\n]*)\|([^\]\n]*)\]\]/g,'$2')
    .replace(/\[\[|\]\]|[#>*_`~|]+|^\s*(?:[-+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/gm,'');
}
function excerptOf(body){ return plainText(body).replace(/\s+/g,' ').trim().slice(0,240); }

/* ------------------------------------------------------------------ stav */
const S = {
  api:null, me:{id:'', name:''}, people:[], host:{},
  notes:[], cstats:new Map(), seen:new Map(),
  f:{scope:'all', kind:null, folder:null, tag:null}, sort: lsGet('kb-sort') || 'updated',
  q:'', results:null, searching:false,
  cur:null, editing:false, dirty:false, saving:false, saveAgain:false, conflict:null, remoteNewer:null, draft:null,
  comments:[], cfilter:'open', quote:null, replyTo:null, backlinks:[],
  dialogs:[], loaded:false, open:false, booted:false
};
const E = {};
const isOwner = n => !!n && n.owner === S.me.id;
function canEdit(n){
  if(!n) return false;
  if(n.owner===S.me.id) return true;
  if(n.visibility==='people') return (n.editors||[]).includes(S.me.name);
  if(n.visibility==='team') return !!n.team_edit || (n.editors||[]).includes(S.me.name);
  return false;
}
function pColor(name){
  if(S.host.personColor) try{ return S.host.personColor(name); }catch(e){}
  let h=0; for(const c of String(name||'')) h=(h*31+c.charCodeAt(0))>>>0; return PCOLORS[h%PCOLORS.length];
}
function initials(n){ const p=String(n||'?').trim().split(/\s+/); const a=p[0]||'?'; return (a[0]+(p[1]?p[1][0]:(a[1]||''))).toUpperCase(); }
const av = (name, cls='') => `<span class="kb-av ${cls}" style="background:${pColor(name)}" title="${esc(name)}">${esc(initials(name))}</span>`;
const pinnedOf = id => !!(S.seen.get(id)||{}).pinned;
function isUnread(n){
  const s=S.seen.get(n.id), seenAt = s ? Date.parse(s.seen_at) : 0;
  const st=S.cstats.get(n.id);
  const newC = !!st && st.lastOther > seenAt;
  if(n.owner===S.me.id && !s) return newC;
  const changed = !!n.updated_by && n.updated_by!==S.me.name && Date.parse(n.updated_at) > seenAt + 1000;
  return changed || newC;
}
function shareLabel(n){
  if(n.visibility==='team') return n.team_edit ? 'Tým · úpravy' : 'Tým · čtení';
  if(n.visibility==='people'){ const c=new Set([...(n.readers||[]),...(n.editors||[])]).size; return c+' '+plural(c,'člověk','lidé','lidí'); }
  return 'Jen já';
}
function visIcon(n){
  if(n.visibility==='team') return `<span title="Celý tým">${ICON('team','sm-ico')}</span>`;
  if(n.visibility==='people') return `<span title="Sdíleno: ${esc([...new Set([...(n.readers||[]),...(n.editors||[])])].join(', '))}">${ICON('users','sm-ico')}</span>`;
  return `<span title="Jen já">${ICON('lock','sm-ico')}</span>`;
}

/* ================================================================ UI kit */
function toast(msg, ms=2600){
  const t=document.createElement('div'); t.className='kb-toast'; t.setAttribute('role','status'); t.textContent=msg;
  (E.root||document.body).appendChild(t); setTimeout(()=>t.remove(), ms);
}
function dlg({title, body, buttons=[], wide=false, onClose}){
  const wrap=document.createElement('div'); wrap.className='kb-dlgwrap';
  const box=document.createElement('div'); box.className='kb-dlg'+(wide?' wide':''); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
  box.innerHTML=`<header><h3>${esc(title)}</h3><button type="button" class="kb-ibtn" data-x aria-label="Zavřít">${ICON('x')}</button></header>`;
  const b=document.createElement('div'); b.className='body';
  if(typeof body==='string') b.innerHTML=body; else if(body) b.appendChild(body);
  box.appendChild(b);
  let closed=false;
  const close=()=>{ if(closed) return; closed=true; wrap.remove(); S.dialogs=S.dialogs.filter(x=>x!==close); if(onClose) onClose(); };
  if(buttons.length){
    const f=document.createElement('footer');
    for(const bt of buttons){
      const el=document.createElement('button'); el.type='button';
      el.className='kb-btn'+(bt.primary?' primary':'')+(bt.danger?' danger':''); el.textContent=bt.label;
      if(bt.id) el.id=bt.id;
      el.onclick=async()=>{ el.disabled=true; let r; try{ r = bt.onClick ? await bt.onClick() : undefined; } finally{ el.disabled=false; } if(r!==false) close(); };
      f.appendChild(el);
    }
    box.appendChild(f);
  }
  wrap.appendChild(box);
  (E.root && E.root.isConnected ? E.root : document.body).appendChild(wrap);
  wrap.addEventListener('mousedown', e=>{ if(e.target===wrap) close(); });
  box.querySelector('[data-x]').onclick=close;
  S.dialogs.push(close);
  setTimeout(()=>{ const f=box.querySelector('input:not([type=radio]):not([type=checkbox]),textarea,.kb-btn.primary'); if(f) f.focus(); }, 0);
  return {close, box, body:b};
}
function confirmDlg(title, text, okLabel='Potvrdit', danger=false){
  return new Promise(res=>{
    let v=false;
    dlg({title, body:`<p>${esc(text)}</p>`, onClose:()=>res(v), buttons:[
      {label:'Zrušit'}, {label:okLabel, primary:!danger, danger, onClick:()=>{ v=true; }}
    ]});
  });
}
function promptDlg(title, label, value='', okLabel='OK', multiline=false){
  return new Promise(res=>{
    let v=null; const id='kbp'+Math.random().toString(36).slice(2,7);
    const d=dlg({title, body:`<label class="muted" for="${id}">${esc(label)}</label>${multiline?`<textarea id="${id}" class="kb-inp" style="height:auto;min-height:120px;padding:8px 10px;resize:vertical">${esc(value)}</textarea>`:`<input id="${id}" class="kb-inp" style="height:36px" value="${esc(value)}">`}`,
      onClose:()=>res(v), buttons:[{label:'Zrušit'}, {label:okLabel, primary:true, onClick:()=>{ v=d.box.querySelector('#'+id).value; }}]});
    const inp=d.box.querySelector('#'+id);
    if(!multiline) inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); v=inp.value; d.close(); } });
    setTimeout(()=>{ inp.focus(); inp.select(); }, 0);
  });
}
function copyText(text, okMsg='Zkopírováno'){
  const fallback=()=>{
    const d=dlg({title:'Zkopíruj si text', body:`<textarea class="kb-inp" style="height:auto;min-height:90px;padding:8px 10px;width:100%" readonly>${esc(text)}</textarea><span class="muted">Text je označený, stačí Ctrl+C.</span>`, buttons:[{label:'Hotovo', primary:true}]});
    const ta=d.box.querySelector('textarea'); setTimeout(()=>{ ta.focus(); ta.select(); }, 0);
  };
  try{ navigator.clipboard.writeText(text).then(()=>toast(okMsg), fallback); }catch(e){ fallback(); }
}
function lightbox(src){
  const d=dlg({title:'Náhled', wide:true, body:`<img src="${esc(src)}" alt="" style="max-width:100%;border-radius:8px;margin:0 auto">`});
  d.box.style.width='auto';
}
KB.ui = {dlg, toast, confirm:confirmDlg, prompt:promptDlg, copy:copyText};

/* ------------------------------------------------------------ menu */
let MENU=null;
function closeMenu(){ if(MENU){ MENU.remove(); MENU=null; } }
function menu(anchor, items){
  closeMenu();
  const m=document.createElement('div'); m.className='kb-menu'; m.setAttribute('role','menu');
  for(const it of items){
    if(it==='-'){ m.appendChild(document.createElement('hr')); continue; }
    if(it.head){ const h=document.createElement('div'); h.className='mh'; h.textContent=it.head; m.appendChild(h); continue; }
    const b=document.createElement('button'); b.type='button'; b.setAttribute('role','menuitem');
    if(it.danger) b.className='danger';
    b.innerHTML=(it.color?`<i style="background:${it.color}"></i>`:'')+(it.icon?ICON(it.icon):'')+`<span>${esc(it.label)}</span>`+(it.hint?`<small>${esc(it.hint)}</small>`:'');
    b.onclick=()=>{ closeMenu(); it.onClick(); };
    m.appendChild(b);
  }
  (E.root||document.body).appendChild(m);
  const r=anchor.getBoundingClientRect(), mw=m.offsetWidth, mh=m.offsetHeight;
  let x=Math.min(r.right-mw, window.innerWidth-mw-8); if(x<8) x=Math.max(8, Math.min(r.left, window.innerWidth-mw-8));
  let y=r.bottom+6; if(y+mh>window.innerHeight-8) y=Math.max(8, r.top-mh-6);
  m.style.left=x+'px'; m.style.top=y+'px';
  MENU=m;
  setTimeout(()=>{ const f=m.querySelector('button'); if(f) f.focus(); }, 0);
}
document.addEventListener('mousedown', e=>{ if(MENU && !MENU.contains(e.target)) closeMenu(); });

/* ------------------------------------------------------------ našeptávač */
const AC={el:null, items:[], idx:0, pick:null};
function acHide(){ if(AC.el){ AC.el.remove(); AC.el=null; AC.items=[]; } }
function acShow(x, y, items, pick, emptyText){
  acHide();
  const el=document.createElement('div'); el.className='kb-ac'; el.setAttribute('role','listbox');
  AC.items=items; AC.idx=0; AC.pick=pick;
  if(!items.length){ el.innerHTML=`<div class="none">${esc(emptyText||'Nic nenalezeno')}</div>`; }
  items.forEach((it,i)=>{
    const b=document.createElement('button'); b.type='button'; b.setAttribute('role','option'); if(i===0) b.className='on';
    b.innerHTML=(it.color?`<i style="background:${it.color}"></i>`:'')+`<span>${esc(it.label)}</span>`+(it.sub?`<small>${esc(it.sub)}</small>`:'');
    b.onmousedown=e=>{ e.preventDefault(); pick(it); acHide(); };
    el.appendChild(b);
  });
  (E.root||document.body).appendChild(el);
  const w=el.offsetWidth, h=el.offsetHeight;
  el.style.left=Math.max(8, Math.min(x, window.innerWidth-w-8))+'px';
  el.style.top=(y+h > window.innerHeight-8 ? Math.max(8, y-h-28) : y)+'px';
  AC.el=el;
}
function acKey(e){
  if(!AC.el || !AC.items.length) return false;
  if(e.key==='ArrowDown' || e.key==='ArrowUp'){
    e.preventDefault(); AC.idx=(AC.idx+(e.key==='ArrowDown'?1:-1)+AC.items.length)%AC.items.length;
    [...AC.el.children].forEach((c,i)=>c.classList.toggle('on', i===AC.idx));
    AC.el.children[AC.idx].scrollIntoView({block:'nearest'}); return true;
  }
  if(e.key==='Enter' || e.key==='Tab'){ e.preventDefault(); const it=AC.items[AC.idx]; const p=AC.pick; acHide(); p(it); return true; }
  if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); acHide(); return true; }
  return false;
}
function caretXY(ta, pos){
  const cs=getComputedStyle(ta), div=document.createElement('div');
  ['boxSizing','width','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','paddingTop','paddingRight','paddingBottom','paddingLeft',
   'fontStyle','fontVariant','fontWeight','fontStretch','fontSize','lineHeight','fontFamily','textAlign','textTransform','textIndent','letterSpacing','wordSpacing','tabSize']
   .forEach(p=>{ div.style[p]=cs[p]; });
  div.style.position='absolute'; div.style.visibility='hidden'; div.style.whiteSpace='pre-wrap'; div.style.overflowWrap='break-word'; div.style.top='0'; div.style.left='-9999px';
  div.textContent=ta.value.slice(0,pos);
  const sp=document.createElement('span'); sp.textContent=ta.value.slice(pos)||'.'; div.appendChild(sp);
  document.body.appendChild(div);
  const r=ta.getBoundingClientRect(); const lh=parseFloat(cs.lineHeight)||20;
  const res={x:r.left+sp.offsetLeft-ta.scrollLeft, y:r.top+sp.offsetTop-ta.scrollTop+lh+4};
  div.remove(); return res;
}
function peopleItems(q){
  const qq=norm(q);
  return S.people.filter(p=>!qq || norm(p).startsWith(qq) || norm(p).includes(qq)).slice(0,8).map(p=>({label:'@'+p, value:p, color:pColor(p)}));
}
function checkAutocomplete(ta, mode){
  const pos=ta.selectionStart; if(pos!==ta.selectionEnd){ acHide(); return; }
  const before=ta.value.slice(Math.max(0,pos-80), pos);
  const m = mode==='body' ? before.match(/\[\[([^\]\n|]{0,60})$/) : null;
  if(m){
    const q=norm(m[1]);
    const list=S.notes.filter(n=>!n.archived && n.title && (S.cur ? n.id!==S.cur.id : true) && (!q || norm(n.title).includes(q)))
      .sort((a,b)=>(norm(b.title).startsWith(q)?1:0)-(norm(a.title).startsWith(q)?1:0) || Date.parse(b.updated_at)-Date.parse(a.updated_at))
      .slice(0,8).map(n=>({label:n.title, sub:kindOf(n.kind).name, color:kc(n.kind), value:n.title}));
    if(m[1].trim() && !list.some(i=>norm(i.value)===q)) list.push({label:`Nová poznámka „${m[1].trim()}“`, sub:'vznikne kliknutím', value:m[1].trim()});
    const xy=caretXY(ta, pos-m[1].length-2);
    acShow(xy.x, xy.y, list, it=>{
      const start=pos-m[1].length; const after=ta.value.slice(pos, pos+2)===']]' ? '' : ']]';
      replaceIn(ta, start, pos, it.value+after); const np=start+it.value.length+2; ta.setSelectionRange(np, np); onSrcInput();
    });
    return;
  }
  const m2=before.match(/(?:^|[\s(])@([\p{L}\d_.-]{0,30})$/u);
  if(m2){
    const items=peopleItems(m2[1]);
    if(!items.length){ acHide(); return; }
    const xy=caretXY(ta, pos-m2[1].length-1);
    acShow(xy.x, xy.y, items, it=>{
      const start=pos-m2[1].length; replaceIn(ta, start, pos, it.value+' ');
      if(mode==='body') onSrcInput();
    });
    return;
  }
  acHide();
}

/* ============================================================ markdown */
let PEOPLE_RE=null;
function buildPeopleRe(){
  const names=[...new Set(S.people)].filter(Boolean).sort((a,b)=>b.length-a.length).map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  PEOPLE_RE = names.length ? new RegExp('(^|[\\s(>])@('+names.join('|')+')(?=$|[\\s.,;:!?)<])','giu') : null;
}
function mentionize(html){ return PEOPLE_RE ? html.replace(PEOPLE_RE, (m,a,b)=>`${a}<span class="kb-mention">@${b}</span>`) : html; }
function mdToHtml(md){
  const store=[];
  const keep=s=>{ store.push(s); return '\u0000'+(store.length-1)+'\u0000'; };
  let src=String(md||'')
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, keep)
    .replace(/`[^`\n]+`/g, keep);
  src=src.replace(/\{\{ukol:([A-Za-z0-9_-]{1,64})\}\}/g, (m,id)=>`<span class="kb-task" data-task="${esc(id)}"></span>`);
  src=src.replace(/\[\[([^\]\n]{1,200})\]\]/g, (m,inner)=>{
    const [t, alias]=inner.split('|'); const target=t.trim(); const label=(alias||t).trim();
    return `<a href="#" class="kb-wl" data-target="${esc(target)}">${esc(label)}</a>`;
  });
  src=mentionize(src);
  src=src.replace(/\u0000(\d+)\u0000/g, (m,i)=>store[+i]);
  let html;
  try{ html=window.marked.parse(src, {gfm:true, breaks:true}); }
  catch(e){ html='<p>'+esc(md).replace(/\n/g,'<br>')+'</p>'; }
  return window.DOMPurify ? window.DOMPurify.sanitize(html, {ADD_ATTR:['target']}) : esc(md);
}
function checklistLines(body){
  const lines=String(body||'').split('\n'), out=[]; let fence=false;
  lines.forEach((l,i)=>{
    if(/^\s*(```|~~~)/.test(l)){ fence=!fence; return; }
    if(!fence && /^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\]/.test(l)) out.push(i);
  });
  return out;
}
function toggleChecklist(body, k, on){
  const idx=checklistLines(body); if(k>=idx.length) return body;
  const lines=body.split('\n'); const i=idx[k];
  lines[i]=lines[i].replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\]/, (m,a)=>a+(on?'[x]':'[ ]'));
  return lines.join('\n');
}
function findNoteByTitle(t){ const q=norm(t); return S.notes.find(n=>n.title_norm===q || norm(n.title)===q); }
function taskChip(sp, id){
  const t = S.host.getTask ? S.host.getTask(id) : null;
  sp.dataset.task=id;
  if(!t){ sp.className='kb-task missing'; sp.textContent='Úkol není dostupný (smazaný, nebo ho nevidíš)'; return; }
  sp.className='kb-task'+(t.done?' done':'');
  const who=(t.assignees&&t.assignees.length) ? t.assignees : (t.ownerName?[t.ownerName]:[]);
  sp.innerHTML=`<input type="checkbox" ${t.done?'checked':''} aria-label="Hotovo"><button type="button" class="tt">${esc(t.title||'(bez názvu)')}</button>`+
    `<span class="tm">${t.due?`<span class="${t.hard?'hard':''}">do ${esc(fmtShort(t.due))}</span>`:''}${who.map(n=>av(n)).join('')}</span>`;
  const cb=sp.querySelector('input');
  cb.onchange=async()=>{ try{ await S.host.toggleTask(id, cb.checked); }catch(e){ toast('Úkol se nepodařilo změnit'); } taskChip(sp, id); };
  sp.querySelector('.tt').onclick=()=>{ if(S.host.openTask) S.host.openTask(id); };
}
function hydrate(el, opts={}){
  const n=opts.note;
  el.querySelectorAll('table').forEach(t=>{ const w=document.createElement('div'); w.className='kb-tablewrap'; t.parentNode.insertBefore(w,t); w.appendChild(t); });
  el.querySelectorAll('a[href]').forEach(a=>{
    const href=a.getAttribute('href')||'';
    if(a.classList.contains('kb-wl')){
      const tgt=a.dataset.target; if(!findNoteByTitle(tgt)) a.classList.add('missing');
      a.title = findNoteByTitle(tgt) ? 'Otevřít poznámku' : 'Poznámka zatím neexistuje – kliknutím ji založíš';
      a.onclick=e=>{ e.preventDefault(); openWikilink(tgt); };
    } else if(href.startsWith('https://kb.local/')){
      const path=decodeURIComponent(href.slice('https://kb.local/'.length));
      a.className='kb-file'; a.removeAttribute('href'); a.setAttribute('role','link'); a.tabIndex=0;
      a.insertAdjacentHTML('afterbegin', ICON('clip','sm-ico'));
      a.onclick=async e=>{ e.preventDefault(); try{ const u=await S.api.fileUrl(path); window.open(u, '_blank', 'noopener'); }catch(err){ toast('Soubor se nepodařilo otevřít'); } };
      S.api.fileUrl(path).then(u=>{ a.href=u; a.target='_blank'; a.rel='noopener'; a.onclick=null; }).catch(()=>{});
    } else if(/^https?:/i.test(href)){ a.target='_blank'; a.rel='noopener noreferrer'; }
  });
  el.querySelectorAll('img').forEach(img=>{
    const src=img.getAttribute('src')||'';
    if(src.startsWith('https://kb.local/')){
      const path=decodeURIComponent(src.slice('https://kb.local/'.length));
      img.removeAttribute('src'); img.alt=img.alt||'příloha';
      S.api.fileUrl(path).then(u=>{ img.src=u; }).catch(()=>{ img.alt='Obrázek se nepodařilo načíst'; });
    }
    img.loading='lazy';
    img.onclick=()=>{ if(img.src) lightbox(img.src); };
  });
  el.querySelectorAll('.kb-task').forEach(sp=>taskChip(sp, sp.dataset.task));
  const boxes=[...el.querySelectorAll('li > input[type=checkbox]')];
  boxes.forEach(cb=>{ const li=cb.parentElement; li.classList.add('task-list-item'); li.classList.toggle('checked', cb.checked); });
  if(n && opts.editable && boxes.length===checklistLines(n.body).length){
    boxes.forEach((cb,k)=>{
      cb.disabled=false; cb.setAttribute('aria-label','Hotovo');
      cb.onchange=()=>{ n.body=toggleChecklist(n.body, k, cb.checked); cb.parentElement.classList.toggle('checked', cb.checked); changed(); };
    });
  }
}

/* ============================================================ DOM kostra */
function mount(){
  if(E.root) return;
  const root=document.createElement('div'); root.className='kb'; root.id='kb'; root.dataset.pane='list';
  root.setAttribute('aria-label','Znalosti');
  root.innerHTML=`
  <div class="kb-top">
    <button type="button" class="kb-ibtn kb-mob" data-act="nav" aria-label="Filtry a složky">${ICON('menu')}</button>
    <div class="kb-brand"><span class="logo">${ICON('book','sm-ico')}</span><span class="txt">Znalosti</span></div>
    <label class="kb-search">${ICON('search')}<input id="kbQ" type="search" placeholder="Hledat v poznámkách i úkolech…" autocomplete="off" aria-label="Hledat"><kbd>/</kbd></label>
    <span class="grow"></span>
    <button type="button" class="kb-btn primary" data-act="new" aria-label="Nová poznámka">${ICON('plus')}<span class="kb-desk">Nová</span></button>
    <button type="button" class="kb-btn" data-act="close" id="kbCloseBtn" aria-label="Zavřít Znalosti">${ICON('x')}<span class="kb-desk">Zavřít</span></button>
  </div>
  <div class="kb-shell">
    <nav class="kb-nav" id="kbNav" aria-label="Filtry"></nav>
    <div class="kb-navshade" data-act="navclose"></div>
    <section class="kb-list" aria-label="Seznam poznámek"><div class="kb-lhead" id="kbLHead"></div><div class="kb-items" id="kbItems"></div></section>
    <main class="kb-pane" id="kbPane"></main>
  </div>
  <input type="file" id="kbImport" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple hidden>
  <input type="file" id="kbUpload" multiple hidden>`;
  document.body.appendChild(root);
  E.root=root; E.nav=root.querySelector('#kbNav'); E.lhead=root.querySelector('#kbLHead'); E.items=root.querySelector('#kbItems');
  E.pane=root.querySelector('#kbPane'); E.q=root.querySelector('#kbQ'); E.imp=root.querySelector('#kbImport'); E.up=root.querySelector('#kbUpload');

  root.addEventListener('click', e=>{
    const a=e.target.closest('[data-act]'); if(!a) return;
    const act=a.dataset.act;
    if(act==='nav') root.classList.toggle('nav-open');
    else if(act==='navclose') root.classList.remove('nav-open');
    else if(act==='new') newMenu(a);
    else if(act==='close') KB.close();
  });
  let qT=null;
  E.q.addEventListener('input', ()=>{ clearTimeout(qT); qT=setTimeout(()=>runSearch(E.q.value), 220); });
  E.q.addEventListener('keydown', e=>{ if(e.key==='Escape' && E.q.value){ e.preventDefault(); e.stopPropagation(); E.q.value=''; runSearch(''); } });
  E.items.addEventListener('click', e=>{
    const it=e.target.closest('.kb-item'); if(!it) return;
    if(it.dataset.task){ if(S.host.openTask) S.host.openTask(it.dataset.task); return; }
    if(it.dataset.id) openNote(it.dataset.id);
  });
  E.imp.addEventListener('change', ()=>{ importFiles([...E.imp.files]); E.imp.value=''; });
  E.up.addEventListener('change', ()=>{ uploadFiles([...E.up.files]); E.up.value=''; });
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('selectionchange', ()=>{ if(BUB && !(window.getSelection()||{}).toString()) hideBubble(); });
  window.addEventListener('resize', ()=>{ hideBubble(); acHide(); closeMenu(); });
}
function setPane(p){ if(E.root) E.root.dataset.pane=p; }

/* ============================================================ navigace */
const SCOPES=[
  ['all','Všechny poznámky','note'], ['unread','Nepřečtené','inbox'], ['pinned','Připnuté','pin'],
  ['mine','Moje','user'], ['shared','Sdílené se mnou','users'], ['team','Týmové','team'], ['archive','Archiv','archive']
];
function scopeFn(sc){
  return {
    all:n=>!n.archived, pinned:n=>!n.archived && pinnedOf(n.id), mine:n=>!n.archived && n.owner===S.me.id,
    shared:n=>!n.archived && n.owner!==S.me.id, team:n=>!n.archived && n.visibility==='team',
    unread:n=>!n.archived && isUnread(n), archive:n=>!!n.archived
  }[sc] || (n=>!n.archived);
}
function folderTree(notes){
  const counts=new Map();
  for(const n of notes){ if(!n.folder) continue; const parts=n.folder.split('/'); for(let i=1;i<=parts.length;i++){ const p=parts.slice(0,i).join('/'); counts.set(p,(counts.get(p)||0)+1); } }
  return [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0],'cs')).map(([path,c])=>({path, depth:path.split('/').length-1, name:path.split('/').pop(), c}));
}
function renderNav(){
  const live=S.notes.filter(n=>!n.archived);
  let h='<div class="sec">Přehled</div>';
  for(const [id,label,ic] of SCOPES){
    const c=S.notes.filter(scopeFn(id)).length;
    if((id==='pinned'||id==='unread'||id==='archive'||id==='shared'||id==='team') && !c && S.f.scope!==id) continue;
    const hot = id==='unread' && c>0;
    h+=`<button type="button" class="kb-nv${S.f.scope===id?' on':''}" data-scope="${id}">${ICON(ic)}<span class="lbl">${label}</span><span class="n${hot?' hot':''}">${c}</span></button>`;
  }
  h+='<div class="sec">Typ</div>';
  for(const k of KINDS){
    const c=live.filter(n=>n.kind===k.id).length;
    h+=`<button type="button" class="kb-nv${S.f.kind===k.id?' on':''}" data-kind="${k.id}"><span class="dot" style="background:${kc(k.id)}"></span><span class="lbl">${k.plural}</span><span class="n">${c||''}</span></button>`;
  }
  const tree=folderTree(live);
  h+=`<div class="sec">Složky${S.f.folder?'<button type="button" data-clear="folder">zrušit</button>':''}</div>`;
  if(!tree.length) h+=`<div class="kb-meta" style="padding:2px 10px 4px">Složku nastavíš v detailu poznámky, např. <i>Westprint/Obchod</i>.</div>`;
  for(const f of tree){
    if(f.depth>0){ const parent=f.path.split('/').slice(0,-1).join('/'), sf=S.f.folder||''; if(!(sf===parent || sf.startsWith(parent+'/'))) continue; }
    h+=`<button type="button" class="kb-nv lvl${Math.min(f.depth,3)}${S.f.folder===f.path?' on':''}" data-folder="${esc(f.path)}">${ICON('folder','sm-ico')}<span class="lbl">${esc(f.name)}</span><span class="n">${f.c}</span></button>`;
  }
  const tc=new Map(); for(const n of live) for(const t of n.tags||[]) tc.set(t,(tc.get(t)||0)+1);
  const tags=[...tc.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'cs')).slice(0,30);
  if(tags.length){
    h+=`<div class="sec">Štítky${S.f.tag?'<button type="button" data-clear="tag">zrušit</button>':''}</div><div class="kb-tagcloud">`;
    for(const [t,c] of tags) h+=`<button type="button" class="${S.f.tag===t?'on':''}" data-tag="${esc(t)}" title="${c} ${plural(c,'poznámka','poznámky','poznámek')}">#${esc(t)}</button>`;
    h+='</div>';
  }
  E.nav.innerHTML=h;
  E.nav.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{ S.f.scope=b.dataset.scope; afterFilter(); });
  E.nav.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{ S.f.kind = S.f.kind===b.dataset.kind ? null : b.dataset.kind; afterFilter(); });
  E.nav.querySelectorAll('[data-folder]').forEach(b=>b.onclick=()=>{ S.f.folder = S.f.folder===b.dataset.folder ? null : b.dataset.folder; afterFilter(); });
  E.nav.querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{ S.f.tag = S.f.tag===b.dataset.tag ? null : b.dataset.tag; afterFilter(); });
  E.nav.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{ S.f[b.dataset.clear]=null; afterFilter(); });
  const unread=S.notes.filter(scopeFn('unread')).length;
  if(S.host.onUnread) try{ S.host.onUnread(unread); }catch(e){}
}
function afterFilter(){
  if(E.q.value){ E.q.value=''; S.q=''; S.results=null; }
  E.root.classList.remove('nav-open'); setPane('list'); renderNav(); renderList();
}

/* ============================================================ seznam */
function filtered(){
  let a=S.notes.filter(scopeFn(S.f.scope));
  if(S.f.kind) a=a.filter(n=>n.kind===S.f.kind);
  if(S.f.folder) a=a.filter(n=>n.folder===S.f.folder || (n.folder||'').startsWith(S.f.folder+'/'));
  if(S.f.tag) a=a.filter(n=>(n.tags||[]).includes(S.f.tag));
  const by={
    updated:(x,y)=>Date.parse(y.updated_at)-Date.parse(x.updated_at),
    created:(x,y)=>Date.parse(y.created_at)-Date.parse(x.created_at),
    title:(x,y)=>(x.title||'').localeCompare(y.title||'','cs'),
    meeting:(x,y)=>(y.meeting_date||'').localeCompare(x.meeting_date||'') || Date.parse(y.updated_at)-Date.parse(x.updated_at)
  }[S.sort] || ((x,y)=>0);
  a.sort((x,y)=> (S.f.scope==='all' ? (pinnedOf(y.id)?1:0)-(pinnedOf(x.id)?1:0) : 0) || by(x,y));
  return a;
}
function itemHTML(n){
  const k=kindOf(n.kind), st=S.cstats.get(n.id), unread=isUnread(n);
  return `<button type="button" class="kb-item${S.cur&&S.cur.id===n.id?' on':''}" data-id="${n.id}">
    ${unread?'<span class="unread" title="Nové změny nebo komentáře"></span>':''}
    <div class="r1"><span class="kind"><i style="background:${kc(n.kind)}"></i>${k.name}</span>${n.kind==='schuzka'&&n.meeting_date?`<span>${esc(fmtDay(n.meeting_date))}</span>`:''}${pinnedOf(n.id)?`<span title="Připnuto">${ICON('pin','sm-ico')}</span>`:''}${n.archived?'<span>archiv</span>':''}<span class="when">${esc(relTime(n.updated_at))}</span></div>
    <div class="t${n.title?'':' untitled'}">${esc(n.title||'Bez názvu')}</div>
    ${n.kb_excerpt?`<div class="x">${esc(n.kb_excerpt)}</div>`:''}
    <div class="r3">${n.folder?`<span class="fold">${ICON('folder','sm-ico')}${esc(n.folder)}</span>`:''}<span class="right">${st&&st.open?`<span title="Otevřené komentáře">${ICON('msg','sm-ico')}${st.open}</span>`:''}${(n.task_ids||[]).length?`<span title="Úkoly v poznámce">${ICON('task','sm-ico')}${n.task_ids.length}</span>`:''}${visIcon(n)}${av(n.owner_name)}</span></div>
  </button>`;
}
function snippetHTML(s){ return esc(s||'').replace(/⟦/g,'<mark>').replace(/⟧/g,'</mark>'); }
function renderList(){
  if(S.q){ renderResults(); return; }
  const list=filtered();
  const scopeName=(SCOPES.find(s=>s[0]===S.f.scope)||SCOPES[0])[1];
  const chips=[];
  if(S.f.kind) chips.push(`<button type="button" class="kb-chip" data-clear="kind"><i style="width:7px;height:7px;border-radius:50%;background:${kc(S.f.kind)}"></i>${esc(kindOf(S.f.kind).plural)} ${ICON('x','sm-ico')}</button>`);
  if(S.f.folder) chips.push(`<button type="button" class="kb-chip" data-clear="folder">${ICON('folder','sm-ico')}${esc(S.f.folder)} ${ICON('x','sm-ico')}</button>`);
  if(S.f.tag) chips.push(`<button type="button" class="kb-chip" data-clear="tag">#${esc(S.f.tag)} ${ICON('x','sm-ico')}</button>`);
  E.lhead.innerHTML=`<h2>${esc(scopeName)}</h2><span class="cnt">${list.length}</span>
    <select id="kbSort" aria-label="Řazení"><option value="updated">Naposledy upravené</option><option value="created">Nejnovější</option><option value="title">Podle názvu</option><option value="meeting">Podle data schůzky</option></select>
    ${chips.length?`<div class="kb-chips">${chips.join('')}</div>`:''}`;
  const sel=E.lhead.querySelector('#kbSort'); sel.value=S.sort; sel.onchange=()=>{ S.sort=sel.value; lsSet('kb-sort', S.sort); renderList(); };
  E.lhead.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{ S.f[b.dataset.clear]=null; afterFilter(); });
  if(!S.loaded){ E.items.innerHTML='<div class="kb-empty">Načítám…</div>'; return; }
  if(!list.length){
    const any=S.notes.some(n=>!n.archived);
    E.items.innerHTML = any
      ? `<div class="kb-empty"><b>Tady nic není</b>Zkus zrušit filtr, nebo založ novou poznámku.</div>`
      : `<div class="kb-empty"><b>Znalostní báze je zatím prázdná</b>Začni zápisem ze schůzky nebo postupem, který ostatní potřebují znát. Tlačítko <b style="display:inline">Nová</b> nahoře.</div>`;
    return;
  }
  E.items.innerHTML=list.map(itemHTML).join('');
}
async function runSearch(q){
  S.q=(q||'').trim();
  if(!S.q){ S.results=null; renderList(); return; }
  S.searching=true; renderResults();
  const my=S.q;
  try{
    const rows=await S.api.search(my);
    if(my!==S.q) return;
    S.results={ notes:rows.filter(r=>r.res_type==='note'), tasks:rows.filter(r=>r.res_type==='task') };
  }catch(e){ console.warn(e); S.results={notes:[], tasks:[], error:true}; }
  S.searching=false; renderResults();
}
function renderResults(){
  E.lhead.innerHTML=`<h2>Hledání: „${esc(S.q)}“</h2>${S.results?`<span class="cnt">${S.results.notes.length+S.results.tasks.length}</span>`:''}`;
  if(!S.results){ E.items.innerHTML='<div class="kb-empty">Hledám…</div>'; return; }
  if(S.results.error){ E.items.innerHTML='<div class="kb-empty"><b>Hledání selhalo</b>Zkontroluj připojení a zkus to znovu.</div>'; return; }
  const {notes, tasks}=S.results;
  if(!notes.length && !tasks.length){ E.items.innerHTML=`<div class="kb-empty"><b>Nic nenalezeno</b>Hledá se v názvech, textu, štítcích, složkách i v úkolech. Diakritiku psát nemusíš.</div>`; return; }
  let h='';
  if(notes.length){
    h+=`<div class="kb-sres">Poznámky · ${notes.length}</div>`;
    for(const r of notes){
      const meta=S.notes.find(n=>n.id===r.id) || {};
      const info=r.info||{};
      h+=`<button type="button" class="kb-item${S.cur&&S.cur.id===r.id?' on':''}" data-id="${esc(r.id)}">
        <div class="r1"><span class="kind"><i style="background:${kc(info.kind)}"></i>${kindOf(info.kind).name}</span>${info.archived?'<span>archiv</span>':''}<span class="when">${esc(relTime(r.updated_at))}</span></div>
        <div class="t">${esc(r.title||'Bez názvu')}</div>
        ${r.snippet?`<div class="x">${snippetHTML(r.snippet)}</div>`:''}
        <div class="r3">${info.folder?`<span class="fold">${ICON('folder','sm-ico')}${esc(info.folder)}</span>`:''}<span class="right">${meta.id?visIcon(meta):''}${av(info.owner_name||'')}</span></div>
      </button>`;
    }
  }
  if(tasks.length){
    h+=`<div class="kb-sres">Úkoly · ${tasks.length}</div>`;
    for(const r of tasks){
      const info=r.info||{};
      h+=`<button type="button" class="kb-item task" data-task="${esc(r.id)}">
        <div class="r1"><span class="kind">${ICON('task','sm-ico')}Úkol</span>${info.due?`<span>do ${esc(fmtShort(info.due))}</span>`:''}<span class="when">${esc(relTime(r.updated_at))}</span></div>
        <div class="t${info.done?' done':''}">${esc(r.title)}</div>
        ${r.snippet && /⟦/.test(r.snippet)?`<div class="x">${snippetHTML(r.snippet)}</div>`:''}
        <div class="r3"><span class="right">${(info.assignees&&info.assignees.length?info.assignees:[info.owner_name]).filter(Boolean).map(n=>av(n)).join('')}</span></div>
      </button>`;
    }
  }
  E.items.innerHTML=h;
}

/* ============================================================ detail poznámky */
function welcomeHTML(){
  const n=S.notes.filter(x=>!x.archived).length;
  return `<div class="kb-nscroll"><div class="kb-welcome">
    <h2>${n?'Vyber poznámku vlevo, nebo založ novou':'Začni první poznámkou'}</h2>
    <p>Znalosti jsou společné místo pro zápisy ze schůzek, postupy, rozhodnutí a kontakty. Co sdílíš s týmem, kolegové najdou, okomentují a můžou na to navázat úkolem.</p>
    <ul>
      <li><span class="k">[[ ]]</span><span><b>Propojuj poznámky.</b> Napiš <b>[[</b> a název jiné poznámky. Odkaz funguje oběma směry.</span></li>
      <li><span class="k">úkol</span><span><b>Z textu udělej úkol.</b> Označ větu a zvol „Vytvořit úkol“. Úkol se objeví v todomk a v poznámce uvidíš, jestli je hotový.</span></li>
      <li><span class="k">@</span><span><b>Zmiň kolegu</b> v komentáři a dostane upozornění. Komentovat jde i konkrétní označenou pasáž.</span></li>
      <li><span class="k">/</span><span><b>Hledej</b> v poznámkách i úkolech zároveň, klidně bez diakritiky.</span></li>
    </ul>
    <div class="row">
      <button type="button" class="kb-btn primary" data-new="schuzka">${ICON('calendar')}Zápis ze schůzky</button>
      <button type="button" class="kb-btn" data-new="postup">${ICON('list')}Postup</button>
      <button type="button" class="kb-btn" data-new="poznamka">${ICON('note')}Poznámka</button>
    </div>
  </div></div>`;
}
function crumbHTML(n){
  const parts=(n.folder||'').split('/').filter(Boolean);
  let h=`<span class="kind" style="display:inline-flex;align-items:center;gap:6px"><i style="width:8px;height:8px;border-radius:50%;background:${kc(n.kind)}"></i>${esc(kindOf(n.kind).name)}</span>`;
  parts.forEach((p,i)=>{ const path=parts.slice(0,i+1).join('/'); h+=`<span class="sep">/</span><button type="button" data-crumb="${esc(path)}">${esc(p)}</button>`; });
  return h;
}
function renderPane(){
  hideBubble(); acHide();
  if(!S.cur){
    E.pane.innerHTML=welcomeHTML();
    E.pane.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>createNote(b.dataset.new));
    return;
  }
  const n=S.cur, ed=canEdit(n), pin=pinnedOf(n.id);
  E.pane.innerHTML=`
  <div class="kb-ntop">
    <button type="button" class="kb-ibtn kb-mob" data-a="back" aria-label="Zpět na seznam">${ICON('back')}</button>
    <div class="kb-crumb">${crumbHTML(n)}</div>
    <span class="kb-status" id="kbStatus"></span>
    ${ed?`<button type="button" class="kb-btn sm${S.editing?' primary':''}" data-a="mode" title="${S.editing?'Zobrazit výsledek (Ctrl+E)':'Upravit text (Ctrl+E)'}">${S.editing?ICON('check')+'<span class="lbl">Hotovo</span>':ICON('edit')+'<span class="lbl">Upravit</span>'}</button>`:''}
    <button type="button" class="kb-btn sm kb-sharebtn" data-a="share" title="Kdo poznámku vidí">${n.visibility==='team'?ICON('team'):n.visibility==='people'?ICON('users'):ICON('lock')}<span class="lbl">${esc(shareLabel(n))}</span></button>
    <button type="button" class="kb-ibtn${pin?' on':''}" data-a="pin" title="${pin?'Odepnout':'Připnout nahoru'}" aria-pressed="${pin}">${ICON('pin')}</button>
    <button type="button" class="kb-ibtn" data-a="more" aria-label="Další akce" title="Další akce">${ICON('dots')}</button>
  </div>
  <div class="kb-nscroll" id="kbScroll"><div class="kb-doc">
    <div id="kbBanners" style="display:flex;flex-direction:column;gap:8px"></div>
    <textarea class="kb-title" id="kbTitle" rows="1" placeholder="Název poznámky" aria-label="Název" ${ed?'':'readonly'}>${esc(n.title)}</textarea>
    <div class="kb-props" id="kbProps"></div>
    <div id="kbBodyWrap" style="display:flex;flex-direction:column;gap:10px"></div>
    <div class="kb-sect" id="kbTasksSect"></div>
    <div class="kb-sect" id="kbBackSect" hidden></div>
    <div class="kb-sect" id="kbComments"></div>
  </div></div>`;
  E.status=E.pane.querySelector('#kbStatus');
  E.pane.querySelectorAll('[data-crumb]').forEach(b=>b.onclick=()=>{ S.f.folder=b.dataset.crumb; afterFilter(); });
  E.pane.querySelector('[data-a=back]').onclick=async()=>{ await flushSave(); setPane('list'); renderList(); };
  const mb=E.pane.querySelector('[data-a=mode]'); if(mb) mb.onclick=()=>setEditing(!S.editing);
  E.pane.querySelector('[data-a=share]').onclick=openShare;
  E.pane.querySelector('[data-a=pin]').onclick=togglePin;
  E.pane.querySelector('[data-a=more]').onclick=e=>moreMenu(e.currentTarget);
  const ti=E.pane.querySelector('#kbTitle');
  ti.addEventListener('input', ()=>{ if(!canEdit(S.cur)) return; S.cur.title=ti.value.replace(/\n/g,' '); changed(); });
  ti.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); if(!S.editing) setEditing(true); else { const s=E.pane.querySelector('#kbSrc'); if(s) s.focus(); } } });
  renderBanners(); renderProps(); renderBody(); renderTaskSect(); loadBacklinks(); renderComments(); setStatus();
}
function setStatus(txt, err){
  if(!E.status || !E.status.isConnected) return;
  if(txt==null){
    if(S.dirty) txt='Neuloženo'; else if(S.cur) txt = S.cur.updated_by ? `Uloženo ${relTime(S.cur.updated_at)} · ${S.cur.updated_by}` : '';
  }
  E.status.textContent=txt||''; E.status.classList.toggle('err', !!err);
}
function renderBanners(){
  const box=E.pane.querySelector('#kbBanners'); if(!box) return;
  const n=S.cur; let h='';
  if(S.conflict){
    h+=`<div class="kb-banner"><span class="grow"><b>${esc(S.conflict.updated_by||'Někdo')}</b> mezitím uložil(a) jinou verzi. Tvoje poslední změny zatím uložené nejsou.</span>
      <button type="button" class="kb-btn sm" data-b="theirs">Načíst jejich verzi</button><button type="button" class="kb-btn sm primary" data-b="mine">Uložit mou verzi</button></div>`;
  } else if(S.remoteNewer){
    h+=`<div class="kb-banner info"><span class="grow"><b>${esc(S.remoteNewer.updated_by||'Kolega')}</b> právě uložil(a) novější verzi.</span><button type="button" class="kb-btn sm" data-b="reload">Načíst</button></div>`;
  }
  if(S.draft){
    h+=`<div class="kb-banner"><span class="grow">Máš neuložený koncept z ${esc(fullTime(new Date(S.draft.ts).toISOString()))}.</span><button type="button" class="kb-btn sm" data-b="dropdraft">Zahodit</button><button type="button" class="kb-btn sm primary" data-b="usedraft">Obnovit koncept</button></div>`;
  }
  if(n.archived) h+=`<div class="kb-banner info"><span class="grow">Poznámka je v archivu. Ve výchozím seznamu ani v našeptávači se neukazuje.</span>${canEdit(n)?'<button type="button" class="kb-btn sm" data-b="unarch">Vrátit z archivu</button>':''}</div>`;
  if(!canEdit(n)){
    const who=[n.owner_name, ...(n.editors||[])].filter(Boolean);
    h+=`<div class="kb-banner info"><span class="grow">Poznámku můžeš číst a komentovat. Upravovat ji může ${esc(who.join(', '))}${n.visibility==='team'&&!n.team_edit?'':''}.</span></div>`;
  }
  box.innerHTML=h;
  const on=(k,f)=>{ const b=box.querySelector(`[data-b=${k}]`); if(b) b.onclick=f; };
  on('theirs', resolveTheirs); on('mine', resolveMine); on('reload', ()=>reloadCurrent());
  on('dropdraft', ()=>{ lsSet('kb-draft-'+n.id, null); S.draft=null; renderBanners(); });
  on('usedraft', ()=>{ const d=S.draft; S.draft=null; lsSet('kb-draft-'+n.id, null); S.cur.title=d.title; S.cur.body=d.body; changed(); renderPane(); });
  on('unarch', ()=>setArchived(false));
}
function renderProps(){
  const box=E.pane.querySelector('#kbProps'); if(!box) return;
  const n=S.cur, ed=canEdit(n);
  const folders=[...new Set(S.notes.map(x=>x.folder).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'cs'));
  const allTags=[...new Set(S.notes.flatMap(x=>x.tags||[]))].sort((a,b)=>a.localeCompare(b,'cs'));
  let h=`<span class="pl">Typ</span><div class="pv kb-kindsel">${KINDS.map(k=>`<button type="button" data-kind="${k.id}" class="${n.kind===k.id?'on':''}" ${ed?'':'disabled'}><i style="background:${kc(k.id)}"></i>${k.name}</button>`).join('')}</div>`;
  h+=`<span class="pl">Složka</span><div class="pv">${ed?`<input class="kb-inp ghost" id="kbFolder" list="kbFolderList" value="${esc(n.folder||'')}" placeholder="např. Westprint/Obchod" style="width:min(320px,100%)"><datalist id="kbFolderList">${folders.map(f=>`<option value="${esc(f)}">`).join('')}</datalist>`:`<span>${esc(n.folder||'—')}</span>`}</div>`;
  h+=`<span class="pl">Štítky</span><div class="pv" id="kbTags">${(n.tags||[]).map(t=>`<span class="kb-tag${ed?'':' nox'}">#${esc(t)}${ed?`<button type="button" data-rmtag="${esc(t)}" aria-label="Odebrat štítek ${esc(t)}">${ICON('x','sm-ico')}</button>`:''}</span>`).join('')}${ed?`<input class="kb-inp ghost" id="kbTagIn" list="kbTagList" placeholder="+ štítek" style="width:120px"><datalist id="kbTagList">${allTags.filter(t=>!(n.tags||[]).includes(t)).map(t=>`<option value="${esc(t)}">`).join('')}</datalist>`:(n.tags||[]).length?'':'<span>—</span>'}</div>`;
  if(n.kind==='schuzka'){
    h+=`<span class="pl">Datum</span><div class="pv">${ed?`<input type="date" class="kb-inp" id="kbDate" value="${esc(n.meeting_date||'')}">`:`<span>${esc(fmtDay(n.meeting_date)||'—')}</span>`}</div>`;
    h+=`<span class="pl">Účastníci</span><div class="pv">${(n.attendees||[]).map(a=>`<span class="kb-tag${ed?'':' nox'}">${av(a)}&nbsp;${esc(a)}${ed?`<button type="button" data-rmatt="${esc(a)}" aria-label="Odebrat ${esc(a)}">${ICON('x','sm-ico')}</button>`:''}</span>`).join('')}${ed?`<input class="kb-inp ghost" id="kbAttIn" list="kbPeopleList" placeholder="+ účastník" style="width:130px"><datalist id="kbPeopleList">${S.people.filter(p=>!(n.attendees||[]).includes(p)).map(p=>`<option value="${esc(p)}">`).join('')}</datalist>`:''}</div>`;
  }
  h+=`<span class="pl">Autor</span><div class="pv kb-meta">${av(n.owner_name)}<span>${esc(n.owner_name||'?')} · založeno ${esc(fullTime(n.created_at))}${n.source&&n.source!=='manual'?` · zdroj: ${esc(n.source==='plaud'?'nahrávka Plaud':n.source==='claude'?'Claude':n.source)}`:''}</span></div>`;
  box.innerHTML=h;
  if(!ed) return;
  box.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{
    if(S.cur.kind===b.dataset.kind) return;
    S.cur.kind=b.dataset.kind;
    if(S.cur.kind==='schuzka' && !S.cur.meeting_date){ S.cur.meeting_date=todayISO(); if(!(S.cur.attendees||[]).length) S.cur.attendees=[S.me.name]; }
    if(!S.cur.body.trim() && TEMPLATES[S.cur.kind]){ S.cur.body=TEMPLATES[S.cur.kind]; renderBody(); }
    changed(); renderProps(); E.pane.querySelector('.kb-crumb').innerHTML=crumbHTML(S.cur);
  });
  const fo=box.querySelector('#kbFolder');
  fo.addEventListener('change', ()=>{ S.cur.folder=fo.value.split('/').map(s=>s.trim()).filter(Boolean).join('/'); fo.value=S.cur.folder; changed(); E.pane.querySelector('.kb-crumb').innerHTML=crumbHTML(S.cur); E.pane.querySelectorAll('[data-crumb]').forEach(b=>b.onclick=()=>{ S.f.folder=b.dataset.crumb; afterFilter(); }); });
  fo.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); fo.blur(); } });
  const addChip=(inp, field)=>{
    const v=inp.value.replace(/^#/,'').trim(); inp.value='';
    if(!v) return;
    const arr=S.cur[field]||[]; if(!arr.includes(v)){ S.cur[field]=[...arr, v]; changed(); }
    renderProps(); const again=E.pane.querySelector(field==='tags'?'#kbTagIn':'#kbAttIn'); if(again) again.focus();
  };
  const ti=box.querySelector('#kbTagIn');
  ti.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===','){ e.preventDefault(); addChip(ti,'tags'); } else if(e.key==='Backspace' && !ti.value && (S.cur.tags||[]).length){ S.cur.tags=S.cur.tags.slice(0,-1); changed(); renderProps(); const a=E.pane.querySelector('#kbTagIn'); if(a) a.focus(); } });
  ti.addEventListener('change', ()=>{ if(ti.value.trim()) addChip(ti,'tags'); });
  box.querySelectorAll('[data-rmtag]').forEach(b=>b.onclick=()=>{ S.cur.tags=S.cur.tags.filter(t=>t!==b.dataset.rmtag); changed(); renderProps(); });
  const da=box.querySelector('#kbDate'); if(da) da.addEventListener('change', ()=>{ S.cur.meeting_date=da.value||null; changed(); });
  const ai=box.querySelector('#kbAttIn');
  if(ai){
    ai.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===','){ e.preventDefault(); addChip(ai,'attendees'); } });
    ai.addEventListener('change', ()=>{ if(ai.value.trim()) addChip(ai,'attendees'); });
  }
  box.querySelectorAll('[data-rmatt]').forEach(b=>b.onclick=()=>{ S.cur.attendees=S.cur.attendees.filter(t=>t!==b.dataset.rmatt); changed(); renderProps(); });
}

/* ----------------------------------------------- tělo: náhled / editor */
function renderBody(){
  const wrap=E.pane.querySelector('#kbBodyWrap'); if(!wrap) return;
  const n=S.cur, ed=canEdit(n);
  hideBubble();
  if(S.editing && ed){
    wrap.innerHTML=`<div class="kb-tools" role="toolbar" aria-label="Formátování">
      <button type="button" data-t="h2" title="Nadpis">H2</button><button type="button" data-t="h3" title="Podnadpis">H3</button>
      <button type="button" data-t="b" class="b" title="Tučně (Ctrl+B)">B</button><button type="button" data-t="i" class="i" title="Kurzíva (Ctrl+I)">I</button>
      <span class="vs"></span>
      <button type="button" data-t="ul" title="Odrážky">${ICON('list')}</button><button type="button" data-t="ol" title="Číslovaný seznam">${ICON('olist')}</button>
      <button type="button" data-t="cl" title="Zaškrtávací seznam">${ICON('checklist')}</button><button type="button" data-t="q" title="Citace">${ICON('quote')}</button>
      <button type="button" data-t="tb" title="Tabulka">${ICON('table')}</button>
      <span class="vs"></span>
      <button type="button" data-t="wl" title="Odkaz na jinou poznámku ([[ ]])">${ICON('brackets')}<span>Odkaz</span></button>
      <button type="button" data-t="task" title="Udělat z označeného textu nebo řádku úkol v todomk">${ICON('task')}<span>Úkol</span></button>
      <button type="button" data-t="file" title="Vložit obrázek nebo soubor (jde i přetáhnout nebo Ctrl+V)">${ICON('clip')}<span>Příloha</span></button>
    </div>
    <textarea class="kb-src" id="kbSrc" spellcheck="true" aria-label="Text poznámky (Markdown)" placeholder="Piš sem. # Nadpis, - odrážka, - [ ] úkol k odškrtnutí, [[ odkaz na poznámku, @ zmínka kolegy">${esc(n.body)}</textarea>
    <div class="kb-edithint"><span>Ctrl+E přepne na náhled</span><span>[[ propojí poznámku</span><span>@ zmíní kolegu</span><span>Obrázky jde vložit přes Ctrl+V</span></div>`;
    const ta=wrap.querySelector('#kbSrc'); E.src=ta;
    ta.addEventListener('input', onSrcInput);
    ta.addEventListener('keydown', onSrcKey);
    ta.addEventListener('click', ()=>checkAutocomplete(ta,'body'));
    ta.addEventListener('blur', ()=>setTimeout(acHide, 120));
    ta.addEventListener('paste', e=>{
      const files=[...(e.clipboardData&&e.clipboardData.files||[])];
      if(files.length){ e.preventDefault(); uploadFiles(files); }
    });
    ta.addEventListener('dragover', e=>{ if(e.dataTransfer && [...e.dataTransfer.types].includes('Files')){ e.preventDefault(); ta.classList.add('drag'); } });
    ta.addEventListener('dragleave', ()=>ta.classList.remove('drag'));
    ta.addEventListener('drop', e=>{ ta.classList.remove('drag'); const f=[...(e.dataTransfer&&e.dataTransfer.files||[])]; if(f.length){ e.preventDefault(); uploadFiles(f); } });
    wrap.querySelectorAll('[data-t]').forEach(b=>{ b.onmousedown=e=>e.preventDefault(); b.onclick=()=>tool(b.dataset.t); });
  } else {
    E.src=null;
    const empty=!n.body.trim();
    wrap.innerHTML=`<div class="kb-md${empty?' empty':''}" id="kbMd">${empty?(ed?'Zatím prázdné. Klikni na Upravit, nebo sem dvakrát klepni.':'Poznámka je zatím prázdná.'):mdToHtml(n.body)}</div>`;
    const md=wrap.querySelector('#kbMd');
    if(!empty) hydrate(md, {note:n, editable:ed});
    if(ed) md.addEventListener('dblclick', e=>{ if(!(window.getSelection()||'').toString().trim() || empty){ setEditing(true); } });
    md.addEventListener('mouseup', ()=>setTimeout(()=>maybeBubble(md), 0));
    md.addEventListener('touchend', ()=>setTimeout(()=>maybeBubble(md), 250));
    md.addEventListener('keyup', e=>{ if(e.shiftKey) maybeBubble(md); });
  }
}
function setEditing(on){
  if(!canEdit(S.cur)) return;
  const sc=E.pane.querySelector('#kbScroll'); const top=sc?sc.scrollTop:0;
  S.editing=on;
  if(!on) acHide();
  const mb=E.pane.querySelector('[data-a=mode]');
  if(mb){ mb.classList.toggle('primary', on); mb.innerHTML = on ? ICON('check')+'<span class="lbl">Hotovo</span>' : ICON('edit')+'<span class="lbl">Upravit</span>'; mb.title = on ? 'Zobrazit výsledek (Ctrl+E)' : 'Upravit text (Ctrl+E)'; }
  renderBody(); renderTaskSect();
  if(sc) sc.scrollTop=top;
  if(on && E.src){ E.src.focus({preventScroll:true}); if(!S.cur.body.trim() || S.cur.body===TEMPLATES[S.cur.kind]) { const p=S.cur.body.indexOf('\n\n'); const pos=p>=0?p+1:S.cur.body.length; E.src.setSelectionRange(pos,pos); } }
  if(!on) flushSave();
}
function onSrcInput(){
  if(!E.src) return;
  S.cur.body=E.src.value; changed();
  checkAutocomplete(E.src, 'body');
  renderTaskSectSoon();
}
let _tsT=null; function renderTaskSectSoon(){ clearTimeout(_tsT); _tsT=setTimeout(renderTaskSect, 500); }
function replaceIn(ta, start, end, text){
  ta.focus();
  ta.setSelectionRange(start, end);
  let ok=false; try{ ok=document.execCommand('insertText', false, text); }catch(e){}
  if(!ok || ta.value.slice(start, start+text.length)!==text){ ta.setRangeText(text, start, end, 'end'); }
}
function lineBounds(v, pos){ const s=v.lastIndexOf('\n', pos-1)+1; let e=v.indexOf('\n', pos); if(e<0) e=v.length; return [s,e]; }
function tool(t){
  const ta=E.src; if(!ta) return;
  const v=ta.value, s=ta.selectionStart, e=ta.selectionEnd, sel=v.slice(s,e);
  const wrapSel=(a,b,ph)=>{ const inner=sel||ph; replaceIn(ta, s, e, a+inner+b); ta.setSelectionRange(s+a.length, s+a.length+inner.length); onSrcInput(); };
  const prefixLines=(fn)=>{
    const [ls]=lineBounds(v, s); const [,le]=lineBounds(v, e>s && v[e-1]==='\n' ? e-1 : e);
    const lines=v.slice(ls, le).split('\n'); const out=lines.map(fn).join('\n');
    replaceIn(ta, ls, le, out); ta.setSelectionRange(ls, ls+out.length); onSrcInput();
  };
  const toggle=(re, add)=>(l,i)=> re.test(l) ? l.replace(re,'') : add(l,i);
  if(t==='b') wrapSel('**','**','tučný text');
  else if(t==='i') wrapSel('*','*','kurzíva');
  else if(t==='h2') prefixLines(toggle(/^## /, l=>'## '+l.replace(/^#+\s*/,'')));
  else if(t==='h3') prefixLines(toggle(/^### /, l=>'### '+l.replace(/^#+\s*/,'')));
  else if(t==='ul') prefixLines(toggle(/^(\s*)[-*+] (?!\[)/, l=>'- '+l));
  else if(t==='ol') prefixLines(toggle(/^\s*\d+[.)] /, (l,i)=>(i+1)+'. '+l));
  else if(t==='cl') prefixLines(toggle(/^(\s*)[-*+] \[[ xX]\] /, l=>'- [ ] '+l.replace(/^[-*+] /,'')));
  else if(t==='q') prefixLines(toggle(/^> ?/, l=>'> '+l));
  else if(t==='tb'){ const tbl=(s>0&&v[s-1]!=='\n'?'\n\n':'')+'| Sloupec | Sloupec |\n| --- | --- |\n|  |  |\n'; replaceIn(ta, s, e, tbl); onSrcInput(); }
  else if(t==='wl'){ wrapSel('[[',']]',''); if(!sel){ checkAutocomplete(ta,'body'); } }
  else if(t==='file'){ E.up.click(); }
  else if(t==='task') taskFromEditor();
}
function onSrcKey(e){
  const ta=e.target;
  if(acKey(e)) return;
  const mod=e.ctrlKey||e.metaKey;
  if(mod && !e.shiftKey && e.key.toLowerCase()==='b'){ e.preventDefault(); tool('b'); return; }
  if(mod && !e.shiftKey && e.key.toLowerCase()==='i'){ e.preventDefault(); tool('i'); return; }
  if(e.key==='Tab'){
    e.preventDefault();
    const v=ta.value, s=ta.selectionStart, en=ta.selectionEnd;
    const [ls]=lineBounds(v,s); const [,le]=lineBounds(v,en);
    const lines=v.slice(ls,le).split('\n');
    const out=lines.map(l=> e.shiftKey ? l.replace(/^( {1,2}|\t)/,'') : '  '+l).join('\n');
    replaceIn(ta, ls, le, out);
    if(s===en && !e.shiftKey){ ta.setSelectionRange(s+2, s+2); } else ta.setSelectionRange(ls, ls+out.length);
    onSrcInput(); return;
  }
  if(e.key==='Enter' && !e.shiftKey && !mod){
    const v=ta.value, s=ta.selectionStart; if(s!==ta.selectionEnd) return;
    const [ls]=lineBounds(v,s); const line=v.slice(ls, s);
    const m=line.match(/^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)([.)]) |> )(.*)$/);
    if(!m) return;
    e.preventDefault();
    if(!m[5].trim()){ replaceIn(ta, ls, s, m[1]); onSrcInput(); return; }
    let mk=m[2];
    if(m[3]) mk=(parseInt(m[3],10)+1)+m[4]+' ';
    else if(/\[[xX]\]/.test(mk)) mk=mk.replace(/\[[xX]\]/,'[ ]');
    replaceIn(ta, s, s, '\n'+m[1]+mk); onSrcInput();
  }
}

/* ----------------------------------------------- úkoly z poznámky */
async function createTaskFor(title){
  if(!S.host.createTask){ toast('Úkoly tady nejdou zakládat'); return null; }
  try{ return await S.host.createTask({title:(title||'').trim().slice(0,200), noteId:S.cur.id, noteTitle:S.cur.title}); }
  catch(e){ console.warn(e); toast('Úkol se nepodařilo založit'); return null; }
}
async function taskFromEditor(){
  const ta=E.src; if(!ta) return;
  const v=ta.value, s=ta.selectionStart, e=ta.selectionEnd;
  let start=s, end=e, title=v.slice(s,e).trim(), indent='';
  if(!title){
    const [ls,le]=lineBounds(v,s); const line=v.slice(ls,le);
    const m=line.match(/^(\s*)(?:[-*+] \[[ xX]\] |[-*+] |\d+[.)] )?(.*)$/);
    indent=m[1]; title=m[2].replace(/\{\{ukol:[^}]*\}\}/g,'').trim(); start=ls; end=le;
    if(!title){ start=s; end=s; }
  }
  const t=await createTaskFor(title);
  if(!t) return;
  const token=`{{ukol:${t.id}}}`;
  if(start===end){ const pre = (start>0 && v[start-1]!=='\n') ? '\n' : ''; replaceIn(ta, start, end, pre+'- '+token+'\n'); }
  else if(/\n/.test(v.slice(start,end)) || end===lineBounds(v,start)[1] && start===lineBounds(v,start)[0]) replaceIn(ta, start, end, indent+'- '+token);
  else replaceIn(ta, start, end, token);
  onSrcInput(); renderTaskSect(); toast('Úkol založen a vložen do poznámky');
}
function appendTaskToken(body, id){
  const token=`- {{ukol:${id}}}`;
  const lines=body.split('\n');
  const h=lines.findIndex(l=>/^#{1,4}\s*Úkoly\s*$/i.test(l.trim()));
  if(h<0) return body.replace(/\s*$/,'')+(body.trim()?'\n\n':'')+'## Úkoly\n'+token+'\n';
  let i=h+1; while(i<lines.length && !/^#{1,4}\s/.test(lines[i])) i++;
  let j=i-1; while(j>h && !lines[j].trim()) j--;
  lines.splice(j+1, 0, token);
  return lines.join('\n');
}
async function taskFromText(text){
  if(!canEdit(S.cur)){ toast('Do cizí poznámky úkol vložit nemůžeš. Napiš autorovi komentář.'); return; }
  const t=await createTaskFor(text);
  if(!t) return;
  S.cur.body=appendTaskToken(S.cur.body, t.id); changed();
  renderBody(); renderTaskSect(); toast('Úkol založen, najdeš ho v sekci Úkoly');
}
function renderTaskSect(){
  const box=E.pane.querySelector('#kbTasksSect'); if(!box) return;
  const ids=deriveTasks(S.cur.body), ed=canEdit(S.cur);
  const open=ids.filter(id=>{ const t=S.host.getTask&&S.host.getTask(id); return t && !t.done; }).length;
  box.innerHTML=`<h3>${ICON('task')}Úkoly z poznámky <span class="n">${ids.length?open+' otevřených / '+ids.length:''}</span><span class="act">${ed?`<button type="button" class="kb-btn sm" data-a="newtask">${ICON('plus','sm-ico')}Nový úkol</button>`:''}</span></h3>
    ${ids.length?'<div class="kb-tasklist"></div>':`<div class="kb-meta">${ed?'Označ v textu větu a zvol „Vytvořit úkol“. Úkol se založí v todomk a tady uvidíš jeho stav.':'K poznámce zatím nejsou úkoly.'}</div>`}`;
  const list=box.querySelector('.kb-tasklist');
  if(list) for(const id of ids){ const sp=document.createElement('span'); list.appendChild(sp); taskChip(sp, id); }
  const nb=box.querySelector('[data-a=newtask]');
  if(nb) nb.onclick=async()=>{
    if(S.editing && E.src){ E.src.focus(); const p=E.src.value.length; E.src.setSelectionRange(p,p); }
    const t=await createTaskFor('');
    if(!t) return;
    if(S.editing && E.src){ const p=E.src.value.length; replaceIn(E.src, p, p, (E.src.value.endsWith('\n')||!E.src.value?'':'\n')+'- {{ukol:'+t.id+'}}\n'); onSrcInput(); }
    else { S.cur.body=appendTaskToken(S.cur.body, t.id); changed(); renderBody(); }
    renderTaskSect();
  };
}

/* ----------------------------------------------- zpětné odkazy */
async function loadBacklinks(){
  const box=E.pane.querySelector('#kbBackSect'); if(!box) return;
  const id=S.cur.id, tn=norm(S.cur.title);
  if(!tn){ box.hidden=true; return; }
  try{
    const rows=await S.api.backlinks(tn, id);
    if(!S.cur || S.cur.id!==id) return;
    S.backlinks=rows;
    if(!rows.length){ box.hidden=true; return; }
    box.hidden=false;
    box.innerHTML=`<h3>${ICON('link')}Odkazují sem <span class="n">${rows.length}</span></h3><div class="kb-links">${rows.map(r=>`<button type="button" class="kb-link" data-open="${esc(r.id)}"><i style="background:${kc(r.kind)}"></i>${esc(r.title||'Bez názvu')}</button>`).join('')}</div>`;
    box.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openNote(b.dataset.open));
  }catch(e){ box.hidden=true; }
}

/* ----------------------------------------------- komentáře */
function commentBodyHTML(t){ return mentionize(esc(t)); }
async function loadComments(){
  if(!S.cur) return;
  const id=S.cur.id;
  try{ const rows=await S.api.listComments(id); if(S.cur && S.cur.id===id){ S.comments=rows; renderComments(); } }
  catch(e){ const box=E.pane.querySelector('#kbComments'); if(box) box.querySelector('.kb-clist').innerHTML='<div class="kb-meta">Komentáře se nepodařilo načíst.</div>'; }
}
function renderComments(){
  const box=E.pane.querySelector('#kbComments'); if(!box || !S.cur) return;
  const keep=box.querySelector('#kbCm'); const draft=keep?keep.value:'';
  const focused=keep && document.activeElement===keep;
  const top=S.comments.filter(c=>!c.parent_id);
  const nOpen=top.filter(c=>!c.resolved).length, nRes=top.length-nOpen;
  const shown=top.filter(c=> S.cfilter==='all' || (S.cfilter==='open' ? !c.resolved : c.resolved));
  const ed=canEdit(S.cur);
  const cm=(c, reply)=>{
    const mine=c.author_id===S.me.id;
    const canRes=!reply && (mine || ed);
    const canDel=mine || isOwner(S.cur);
    return `<div class="kb-cm${reply?' reply':''}${c.resolved?' resolved':''}" data-cid="${esc(c.id)}">
      ${av(c.author_name,'lg')}
      <div class="kb-cmain">
        <div class="kb-chead"><b>${esc(c.author_name||'?')}</b><span class="tm" title="${esc(fullTime(c.created_at))}">${esc(relTime(c.created_at))}</span>${c.resolved?'<span class="ok">Vyřešeno</span>':''}</div>
        ${c.quote?`<div class="kb-cquote" data-q title="Ukázat v textu">„${esc(c.quote)}“</div>`:''}
        <div class="kb-cbody">${commentBodyHTML(c.body)}</div>
        <div class="kb-cact">${!reply?'<button type="button" data-c="reply">Odpovědět</button>':''}${canRes?`<button type="button" data-c="res">${c.resolved?'Znovu otevřít':'Vyřešeno'}</button>`:''}${canDel?'<button type="button" data-c="del" class="del">Smazat</button>':''}</div>
      </div></div>`;
  };
  let list='';
  for(const c of shown){ list+=cm(c,false); for(const r of S.comments.filter(x=>x.parent_id===c.id)) list+=cm(r,true); }
  const replyTo=S.replyTo ? S.comments.find(c=>c.id===S.replyTo) : null;
  box.innerHTML=`<h3>${ICON('msg')}Komentáře <span class="n">${top.length||''}</span>${top.length?`<span class="act kb-cfilter"><button type="button" data-cf="open" class="${S.cfilter==='open'?'on':''}">Otevřené ${nOpen}</button><button type="button" data-cf="resolved" class="${S.cfilter==='resolved'?'on':''}">Vyřešené ${nRes}</button><button type="button" data-cf="all" class="${S.cfilter==='all'?'on':''}">Vše</button></span>`:''}</h3>
    <div class="kb-clist" style="display:flex;flex-direction:column;gap:14px">${list || (top.length?`<div class="kb-meta">${S.cfilter==='open'?'Všechny komentáře jsou vyřešené.':'Žádné vyřešené komentáře.'}</div>`:'')}</div>
    <div class="kb-cnew">
      ${S.quote?`<div class="kb-qchip"><span>„${esc(S.quote)}“</span><button type="button" data-c="noquote" aria-label="Zrušit citaci">${ICON('x','sm-ico')}</button></div>`:''}
      ${replyTo?`<div class="kb-qchip"><span>Odpověď pro <b>${esc(replyTo.author_name)}</b></span><button type="button" data-c="noreply" aria-label="Zrušit odpověď">${ICON('x','sm-ico')}</button></div>`:''}
      <textarea id="kbCm" placeholder="${S.quote?'Co k té pasáži?':'Napiš komentář. @jméno upozorní kolegu.'}" aria-label="Nový komentář">${esc(draft)}</textarea>
      <div class="r"><span>Ctrl+Enter odešle</span><span class="grow"></span><button type="button" class="kb-btn sm primary" data-c="send">Odeslat</button></div>
    </div>`;
  box.querySelectorAll('[data-cf]').forEach(b=>b.onclick=()=>{ S.cfilter=b.dataset.cf; renderComments(); });
  const ta=box.querySelector('#kbCm');
  ta.addEventListener('input', ()=>checkAutocomplete(ta,'comment'));
  ta.addEventListener('blur', ()=>setTimeout(acHide,120));
  ta.addEventListener('keydown', e=>{ if(acKey(e)) return; if(e.key==='Enter' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); sendComment(); } });
  if(focused){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  box.querySelector('[data-c=send]').onclick=sendComment;
  const nq=box.querySelector('[data-c=noquote]'); if(nq) nq.onclick=()=>{ S.quote=null; renderComments(); };
  const nr=box.querySelector('[data-c=noreply]'); if(nr) nr.onclick=()=>{ S.replyTo=null; renderComments(); };
  box.querySelectorAll('.kb-cm').forEach(el=>{
    const c=S.comments.find(x=>x.id===el.dataset.cid); if(!c) return;
    const on=(k,f)=>{ const b=el.querySelector(`:scope > .kb-cmain > .kb-cact [data-c=${k}]`); if(b) b.onclick=f; };
    on('reply', ()=>{ S.replyTo=c.id; renderComments(); const t=E.pane.querySelector('#kbCm'); t.focus(); t.scrollIntoView({block:'center', behavior:'smooth'}); });
    on('res', async()=>{ try{ await S.api.updateComment(c.id, {resolved:!c.resolved}); c.resolved=!c.resolved; renderComments(); refreshStats(); }catch(e){ toast('Nepodařilo se uložit'); } });
    on('del', async()=>{ if(!(await confirmDlg('Smazat komentář?', 'Komentář i odpovědi na něj zmizí pro všechny.', 'Smazat', true))) return; try{ await S.api.deleteComment(c.id); S.comments=S.comments.filter(x=>x.id!==c.id && x.parent_id!==c.id); renderComments(); refreshStats(); }catch(e){ toast('Komentář se nepodařilo smazat'); } });
    const q=el.querySelector(':scope > .kb-cmain > [data-q]'); if(q) q.onclick=()=>showQuote(c.quote);
  });
}
async function sendComment(){
  const ta=E.pane.querySelector('#kbCm'); if(!ta) return;
  const body=ta.value.trim(); if(!body){ ta.focus(); return; }
  const btn=E.pane.querySelector('[data-c=send]'); if(btn) btn.disabled=true;
  try{
    const parent = S.replyTo && S.comments.find(c=>c.id===S.replyTo) ? S.replyTo : null;
    const row=await S.api.addComment({note_id:S.cur.id, body, quote:S.quote||null, parent_id:parent});
    S.comments.push(row); S.quote=null; S.replyTo=null; ta.value='';
    if(S.cfilter==='resolved') S.cfilter='open';
    renderComments(); markSeen(S.cur.id); refreshStats();
  }catch(e){ console.warn(e); toast('Komentář se neodeslal: '+(e.message||'chyba')); }
  finally{ if(btn) btn.disabled=false; }
}
function showQuote(q){
  if(S.editing) setEditing(false);
  const md=E.pane.querySelector('#kbMd'); if(!md || !q) return;
  const nodes=[]; const w=document.createTreeWalker(md, NodeFilter.SHOW_TEXT); let full='';
  while(w.nextNode()){ nodes.push({n:w.currentNode, at:full.length}); full+=w.currentNode.nodeValue; }
  const flat=s=>s.replace(/\s+/g,' ');
  const mapIdx=[]; let flatFull=''; for(let i=0;i<full.length;i++){ const ch=/\s/.test(full[i])?' ':full[i]; if(ch===' ' && flatFull.endsWith(' ')) continue; mapIdx.push(i); flatFull+=ch; }
  const k=flatFull.indexOf(flat(q).trim());
  if(k<0){ toast('Citovaná pasáž už v textu není'); return; }
  const a=mapIdx[k], b=mapIdx[k+flat(q).trim().length-1]+1;
  const pos=i=>{ for(let j=nodes.length-1;j>=0;j--) if(nodes[j].at<=i) return {node:nodes[j].n, off:Math.min(i-nodes[j].at, nodes[j].n.nodeValue.length)}; return null; };
  const s=pos(a), e=pos(b-1); if(!s||!e) return;
  const r=document.createRange(); r.setStart(s.node, s.off); r.setEnd(e.node, e.off+1);
  const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  const rect=r.getBoundingClientRect(); const sc=E.pane.querySelector('#kbScroll');
  if(sc) sc.scrollBy({top: rect.top - sc.getBoundingClientRect().top - 120, behavior:'smooth'});
}

/* ----------------------------------------------- bublina nad výběrem */
let BUB=null;
function hideBubble(){ if(BUB){ BUB.remove(); BUB=null; } }
function maybeBubble(md){
  const sel=window.getSelection(); if(!sel || sel.isCollapsed){ hideBubble(); return; }
  if(!md.contains(sel.anchorNode) || !md.contains(sel.focusNode)){ hideBubble(); return; }
  const text=sel.toString().replace(/\s+/g,' ').trim();
  if(text.length<2){ hideBubble(); return; }
  const r=sel.getRangeAt(0).getBoundingClientRect();
  hideBubble();
  const b=document.createElement('div'); b.className='kb-bubble';
  b.innerHTML=`<button type="button" data-bb="cm">${ICON('msg','sm-ico')}Komentovat</button>${canEdit(S.cur)?`<button type="button" data-bb="task">${ICON('task','sm-ico')}Vytvořit úkol</button>`:''}<button type="button" data-bb="copy">${ICON('copy','sm-ico')}Kopírovat</button>`;
  b.addEventListener('mousedown', e=>e.preventDefault());
  E.root.appendChild(b);
  const w=b.offsetWidth;
  b.style.left=Math.max(8, Math.min(r.left + r.width/2 - w/2, window.innerWidth-w-8))+'px';
  b.style.top=Math.max(8, Math.min(r.top > 60 ? r.top-46 : r.bottom+8, window.innerHeight-48))+'px';
  b.querySelector('[data-bb=cm]').onclick=()=>{
    S.quote=text.slice(0,1000); hideBubble(); sel.removeAllRanges(); renderComments();
    const t=E.pane.querySelector('#kbCm'); t.focus(); t.scrollIntoView({block:'center', behavior:'smooth'});
  };
  const tb=b.querySelector('[data-bb=task]'); if(tb) tb.onclick=()=>{ hideBubble(); sel.removeAllRanges(); taskFromText(text.slice(0,200)); };
  b.querySelector('[data-bb=copy]').onclick=()=>{ hideBubble(); copyText(text); };
  BUB=b;
}

/* ============================================================ akce */
function newMenu(anchor){
  menu(anchor, [
    {head:'Nová poznámka'},
    ...KINDS.map(k=>({label:k.name, color:kc(k.id), hint:k.id==='poznamka'?'N':'', onClick:()=>createNote(k.id)})),
    '-',
    {label:'Importovat soubory .md', icon:'fileimp', onClick:()=>E.imp.click()}
  ]);
}
async function createNote(kind='poznamka', title=''){
  await flushSave();
  const f={ title, body:TEMPLATES[kind]||'', kind, folder:S.f.folder||'', tags:S.f.tag?[S.f.tag]:[],
    visibility:'private', readers:[], editors:[], team_edit:false };
  if(kind==='schuzka'){ f.meeting_date=todayISO(); f.attendees=[S.me.name]; }
  try{
    const n=await S.api.createNote(f);
    upsertMeta(n);
    if(S.q){ E.q.value=''; S.q=''; S.results=null; }
    renderNav(); renderList();
    await openNote(n.id, {edit:true, note:n});
    const ti=E.pane.querySelector('#kbTitle'); if(ti) ti.focus();
  }catch(e){ console.warn(e); toast('Poznámku se nepodařilo založit: '+(e.message||'chyba')); }
}
async function openWikilink(target){
  const n=findNoteByTitle(target);
  if(n){ openNote(n.id); return; }
  if(!(await confirmDlg('Poznámka zatím neexistuje', `Poznámka „${target}“ ještě není. Založit ji teď?`, 'Založit'))) return;
  createNote('poznamka', target);
}
async function openNote(id, opts={}){
  if(S.cur && S.cur.id===id && !opts.force){ setPane('note'); return; }
  await flushSave();
  hideBubble(); acHide();
  try{
    const n = opts.note || await S.api.getNote(id);
    if(!n){ toast('Poznámka neexistuje, nebo k ní nemáš přístup'); return; }
    S.cur=Object.assign({tags:[], attendees:[], readers:[], editors:[]}, n);
    S.editing=!!opts.edit && canEdit(S.cur); S.dirty=false; S.conflict=null; S.remoteNewer=null;
    S.comments=[]; S.quote=null; S.replyTo=null; S.cfilter='open';
    const d=lsGet('kb-draft-'+id);
    S.draft = (d && d.ts > Date.parse(n.updated_at) && (d.body!==n.body || d.title!==n.title)) ? d : null;
    if(d && !S.draft) lsSet('kb-draft-'+id, null);
    setPane('note'); renderPane();
    E.items.querySelectorAll('.kb-item').forEach(x=>x.classList.toggle('on', x.dataset.id===id));
    loadComments(); markSeen(id);
    if(S.host.onRoute) try{ S.host.onRoute(id); }catch(e){}
    const sc=E.pane.querySelector('#kbScroll'); if(sc) sc.scrollTop=0;
  }catch(e){ console.warn(e); toast('Poznámku se nepodařilo otevřít'); }
}
async function reloadCurrent(){
  if(!S.cur) return;
  const id=S.cur.id, ed=S.editing;
  const sc=E.pane.querySelector('#kbScroll'); const top=sc?sc.scrollTop:0;
  try{
    const n=await S.api.getNote(id); if(!n || !S.cur || S.cur.id!==id) return;
    S.cur=Object.assign({tags:[], attendees:[], readers:[], editors:[]}, n); S.dirty=false; S.conflict=null; S.remoteNewer=null;
    lsSet('kb-draft-'+id, null);
    S.editing=ed && canEdit(S.cur);
    renderPane(); const s2=E.pane.querySelector('#kbScroll'); if(s2) s2.scrollTop=top;
    upsertMeta(n); renderList(); loadComments(); markSeen(id);
  }catch(e){ toast('Nepodařilo se načíst'); }
}
function pick(n){ return {title:n.title||'', body:n.body||'', kind:n.kind, folder:n.folder||'', tags:n.tags||[], meeting_date:n.meeting_date||null, attendees:n.attendees||[]}; }
function changed(){
  if(!S.cur) return;
  S.dirty=true;
  lsSet('kb-draft-'+S.cur.id, {title:S.cur.title, body:S.cur.body, ts:Date.now()});
  setStatus('Neuloženo');
  clearTimeout(S.saveT); S.saveT=setTimeout(saveNow, 900);
  const meta=S.notes.find(x=>x.id===S.cur.id);
  if(meta){ Object.assign(meta, {title:S.cur.title, kind:S.cur.kind, folder:S.cur.folder, tags:S.cur.tags, meeting_date:S.cur.meeting_date}); }
}
async function saveNow(){
  clearTimeout(S.saveT);
  if(!S.cur || !S.dirty || S.conflict) return;
  if(S.saving){ S.saveAgain=true; return; }
  const n=S.cur, snap=pick(n), sj=JSON.stringify(snap);
  S.saving=true; setStatus('Ukládám…');
  let failed=false;
  try{
    const res=await S.api.updateNote(n.id, snap, n.version);
    if(res.conflict){
      if(S.cur===n){ S.conflict=res.conflict; renderBanners(); setStatus('Nesouhlasí verze', true); }
      return;
    }
    const srv=res.note;
    if(S.cur===n){
      const still=JSON.stringify(pick(S.cur))===sj;
      for(const k of ['version','updated_at','updated_by','links','task_ids','title_norm','owner_name','created_at','visibility','readers','editors','team_edit','archived']) if(k in srv) n[k]=srv[k];
      if(still){ S.dirty=false; lsSet('kb-draft-'+n.id, null); }
      setStatus(still?null:'Neuloženo');
    }
    upsertMeta(srv, true); renderListSoon();
  }catch(e){
    console.warn(e); failed=true;
    setStatus('Neuloženo – zkusím znovu', true);
    clearTimeout(S.saveT); S.saveT=setTimeout(saveNow, 6000);
    if(/oprávn/i.test(e.message||'')) toast(e.message);
  }finally{
    S.saving=false;
    if(!failed && S.cur && S.dirty && !S.conflict){ S.saveAgain=false; clearTimeout(S.saveT); S.saveT=setTimeout(saveNow, 500); }
  }
}
async function flushSave(){
  clearTimeout(S.saveT);
  if(S.cur && S.dirty && !S.conflict) await saveNow();
  let guard=0; while(S.saving && guard++<200) await sleep(50);
}
async function resolveTheirs(){
  const mine=pick(S.cur);
  const d=dlg({title:'Tvoje verze', body:`<p class="muted">Načítám verzi kolegy. Tvůj text si odsud zkopíruj, ať o nic nepřijdeš.</p><textarea class="kb-inp" readonly style="height:auto;min-height:220px;padding:8px 10px;font-family:var(--mono);font-size:12.5px;width:100%">${esc('# '+mine.title+'\n\n'+mine.body)}</textarea>`, buttons:[{label:'Zkopírovat', onClick:()=>{ copyText('# '+mine.title+'\n\n'+mine.body); return false; }},{label:'Hotovo', primary:true}]});
  void d;
  const theirs=S.conflict; S.conflict=null; S.dirty=false; lsSet('kb-draft-'+S.cur.id, null);
  S.cur=Object.assign({tags:[], attendees:[], readers:[], editors:[]}, theirs); upsertMeta(theirs); renderPane(); renderList();
}
async function resolveMine(){
  const latest=S.conflict; S.conflict=null; S.cur.version=latest.version; S.dirty=true; renderBanners(); await saveNow(); toast('Uloženo, tvoje verze teď platí');
}
function upsertMeta(n, quiet){
  const meta=Object.assign({}, n); delete meta.body; meta.kb_excerpt = n.body!=null ? excerptOf(n.body) : n.kb_excerpt;
  const i=S.notes.findIndex(x=>x.id===n.id);
  if(i>=0){ const old=S.notes[i]; S.notes[i]=Object.assign({}, old, meta); if(n.body==null) S.notes[i].kb_excerpt=old.kb_excerpt; }
  else S.notes.unshift(meta);
  if(!quiet) renderNav();
}
let _rlT=null; function renderListSoon(){ clearTimeout(_rlT); _rlT=setTimeout(()=>{ if(!S.q) renderList(); renderNav(); }, 300); }
async function markSeen(id){
  const prev=S.seen.get(id)||{};
  const row={seen_at:new Date().toISOString(), pinned:!!prev.pinned};
  S.seen.set(id, Object.assign({note_id:id}, row));
  renderListSoon();
  try{ await S.api.setSeen(id, row); }catch(e){}
}
async function togglePin(){
  const id=S.cur.id, prev=S.seen.get(id)||{seen_at:new Date().toISOString()};
  const row={seen_at:prev.seen_at||new Date().toISOString(), pinned:!prev.pinned};
  S.seen.set(id, Object.assign({note_id:id}, row));
  const b=E.pane.querySelector('[data-a=pin]'); if(b){ b.classList.toggle('on', row.pinned); b.setAttribute('aria-pressed', row.pinned); b.title=row.pinned?'Odepnout':'Připnout nahoru'; }
  renderNav(); renderList();
  try{ await S.api.setSeen(id, row); toast(row.pinned?'Připnuto':'Odepnuto'); }catch(e){ toast('Nepodařilo se uložit'); }
}
async function setArchived(on){
  await flushSave();
  try{
    const res=await S.api.updateNote(S.cur.id, {archived:on}, S.cur.version);
    if(res.conflict){ toast('Poznámku mezitím někdo upravil, zkus to znovu'); reloadCurrent(); return; }
    Object.assign(S.cur, {archived:on, version:res.note.version, updated_at:res.note.updated_at, updated_by:res.note.updated_by});
    upsertMeta(res.note); renderList(); renderBanners(); toast(on?'Přesunuto do archivu':'Vráceno z archivu');
  }catch(e){ toast('Nepodařilo se: '+(e.message||'chyba')); }
}
function noteMarkdown(n){
  const body=String(n.body||'').replace(/\{\{ukol:([A-Za-z0-9_-]+)\}\}/g, (m,id)=>{ const t=S.host.getTask&&S.host.getTask(id); return t ? `[${t.done?'x':' '}] ${t.title}` : '[úkol]'; });
  const meta=[`Typ: ${kindOf(n.kind).name}`, n.folder?`Složka: ${n.folder}`:'', (n.tags||[]).length?`Štítky: ${n.tags.map(t=>'#'+t).join(' ')}`:'', n.kind==='schuzka'&&n.meeting_date?`Datum: ${fmtDay(n.meeting_date)}`:'', n.kind==='schuzka'&&(n.attendees||[]).length?`Účastníci: ${n.attendees.join(', ')}`:''].filter(Boolean);
  return `# ${n.title||'Bez názvu'}\n\n${meta.map(m=>'> '+m).join('\n')}\n\n${body}\n`;
}
function moreMenu(anchor){
  const n=S.cur, ed=canEdit(n), own=isOwner(n);
  const items=[
    {label:'Kopírovat odkaz', icon:'link', onClick:()=>copyText((S.host.linkFor?S.host.linkFor(n.id):location.href), 'Odkaz zkopírován')},
    {label:'Stáhnout jako .md', icon:'download', onClick:()=>{
      const md=noteMarkdown(n);
      if(S.host.canDownload===false){ copyText(md, 'Markdown zkopírován'); return; }
      const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([md],{type:'text/markdown'}));
      a.download=(n.title||'poznamka').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)+'.md';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
    }},
    {label:'Historie verzí', icon:'history', onClick:openHistory}
  ];
  if(ed) items.push('-', {label:n.archived?'Vrátit z archivu':'Přesunout do archivu', icon:'archive', onClick:()=>setArchived(!n.archived)});
  if(own) items.push({label:'Smazat poznámku', icon:'trash', danger:true, onClick:deleteCurrent});
  menu(anchor, items);
}
async function deleteCurrent(){
  const n=S.cur;
  if(!(await confirmDlg('Smazat poznámku?', `„${n.title||'Bez názvu'}“ zmizí i s komentáři a historií, pro všechny, se kterými je sdílená. Když ji chceš jen schovat, dej ji do archivu.`, 'Smazat natrvalo', true))) return;
  try{
    await S.api.deleteNote(n.id);
    S.notes=S.notes.filter(x=>x.id!==n.id); S.cur=null; S.dirty=false; lsSet('kb-draft-'+n.id, null);
    setPane('list'); renderNav(); renderList(); renderPane(); toast('Poznámka smazána');
    if(S.host.onRoute) try{ S.host.onRoute(null); }catch(e){}
  }catch(e){ toast('Smazání se nepovedlo: '+(e.message||'chyba')); }
}

/* ----------------------------------------------- sdílení */
function openShare(){
  const n=S.cur, own=isOwner(n);
  let vis=n.visibility||'private', teamEdit=!!n.team_edit;
  const perm=new Map(); (n.readers||[]).forEach(p=>perm.set(p,'read')); (n.editors||[]).forEach(p=>perm.set(p,'edit'));
  const others=S.people.filter(p=>p!==n.owner_name);
  const body=document.createElement('div'); body.style.display='contents';
  const draw=()=>{
    body.innerHTML=`
      ${own?'':`<div class="kb-banner info"><span class="grow">Sdílení může měnit jen autor, <b>${esc(n.owner_name)}</b>.</span></div>`}
      <label class="kb-opt${vis==='private'?' on':''}"><input type="radio" name="kbvis" value="private" ${vis==='private'?'checked':''} ${own?'':'disabled'}><div><b>Jen já</b><span>Soukromá poznámka. Nikdo jiný ji nevidí ani nenajde.</span></div></label>
      <label class="kb-opt${vis==='team'?' on':''}"><input type="radio" name="kbvis" value="team" ${vis==='team'?'checked':''} ${own?'':'disabled'}><div><b>Celý tým</b><span>Vidí a komentují všichni přihlášení kolegové. Vhodné pro postupy a znalosti firmy.</span></div></label>
      ${vis==='team'?`<label class="kb-check" style="margin:-4px 0 0 34px"><input type="checkbox" id="kbTeamEdit" ${teamEdit?'checked':''} ${own?'':'disabled'}> Upravovat můžou všichni (jinak jen ty)</label>`:''}
      <label class="kb-opt${vis==='people'?' on':''}"><input type="radio" name="kbvis" value="people" ${vis==='people'?'checked':''} ${own?'':'disabled'}><div><b>Vybraní lidé</b><span>Jen ti, které zvolíš níže. Každému nastavíš čtení, nebo úpravy.</span></div></label>
      ${vis==='people'?`<div>${others.length?others.map(p=>{ const v=perm.get(p)||''; return `<div class="kb-prow">${av(p)}<span class="nm">${esc(p)}</span><span class="kb-seg" data-p="${esc(p)}"><button type="button" data-v="" class="${!v?'on':''}" ${own?'':'disabled'}>Ne</button><button type="button" data-v="read" class="${v==='read'?'on':''}" ${own?'':'disabled'}>Číst</button><button type="button" data-v="edit" class="${v==='edit'?'on':''}" ${own?'':'disabled'}>Upravovat</button></span></div>`; }).join(''):'<div class="kb-meta">Zatím tu nejsou další uživatelé.</div>'}</div>`:''}
      <p class="muted">Kolegové se do todomk přihlašují svým e-mailem @westprint.cz. Kdo tu ještě není, založí si účet na přihlašovací obrazovce a pak se objeví v seznamu.</p>`;
    body.querySelectorAll('input[name=kbvis]').forEach(r=>r.onchange=()=>{ vis=r.value; draw(); });
    const te=body.querySelector('#kbTeamEdit'); if(te) te.onchange=()=>{ teamEdit=te.checked; };
    body.querySelectorAll('.kb-seg').forEach(sg=>sg.querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.dataset.v) perm.set(sg.dataset.p, b.dataset.v); else perm.delete(sg.dataset.p); draw(); }));
  };
  draw();
  dlg({title:'Kdo poznámku vidí', body, buttons: own ? [{label:'Zrušit'}, {label:'Uložit sdílení', primary:true, onClick:async()=>{
    const f={visibility:vis, team_edit: vis==='team' ? teamEdit : false,
      readers: vis==='people' ? [...perm].filter(([,v])=>v==='read').map(([p])=>p) : [],
      editors: vis==='people' ? [...perm].filter(([,v])=>v==='edit').map(([p])=>p) : []};
    if(vis==='people' && !f.readers.length && !f.editors.length){ toast('Vyber aspoň jednoho člověka, nebo zvol Jen já'); return false; }
    await flushSave();
    try{
      const res=await S.api.updateNote(n.id, f, S.cur.version);
      if(res.conflict){ toast('Poznámku mezitím někdo upravil, zkus to znovu'); reloadCurrent(); return; }
      Object.assign(S.cur, f, {version:res.note.version, updated_at:res.note.updated_at});
      upsertMeta(res.note); renderPane(); renderList();
      toast(vis==='private'?'Poznámka je soukromá':vis==='team'?'Sdíleno s celým týmem':'Sdíleno s vybranými lidmi');
    }catch(e){ toast('Sdílení se neuložilo: '+(e.message||'chyba')); return false; }
  }}] : [{label:'Zavřít', primary:true}]});
}

/* ----------------------------------------------- historie verzí */
function lineDiff(a, b){
  const A=a.split('\n'), B=b.split('\n');
  if(A.length*B.length > 4e6) return null;
  const m=A.length, n=B.length, L=Array.from({length:m+1},()=>new Uint16Array(n+1));
  for(let i=m-1;i>=0;i--) for(let j=n-1;j>=0;j--) L[i][j] = A[i]===B[j] ? L[i+1][j+1]+1 : Math.max(L[i+1][j], L[i][j+1]);
  const out=[]; let i=0, j=0;
  while(i<m && j<n){ if(A[i]===B[j]){ out.push([' ',A[i]]); i++; j++; } else if(L[i+1][j]>=L[i][j+1]) out.push(['-',A[i++]]); else out.push(['+',B[j++]]); }
  while(i<m) out.push(['-',A[i++]]); while(j<n) out.push(['+',B[j++]]);
  return out;
}
async function openHistory(){
  await flushSave();
  const n=S.cur, ed=canEdit(n);
  const body=document.createElement('div'); body.className='kb-hist';
  body.innerHTML='<div class="vl"></div><div class="vp"><div class="kb-meta">Načítám…</div></div>';
  const d=dlg({title:'Historie verzí', wide:true, body});
  d.body.style.padding='0';
  let vers=[];
  try{ vers=await S.api.listVersions(n.id); }catch(e){ body.querySelector('.vp').innerHTML='<div class="kb-meta">Historii se nepodařilo načíst.</div>'; return; }
  const items=[{id:'cur', title:n.title, body:n.body, edited_by:n.updated_by, edited_at:n.updated_at, current:true}, ...vers];
  let sel=items.length>1?1:0, mode='diff';
  const vl=body.querySelector('.vl'), vp=body.querySelector('.vp');
  const draw=()=>{
    vl.innerHTML=items.map((v,i)=>`<button type="button" class="${i===sel?'on':''}" data-i="${i}">${v.current?'<b>Aktuální verze</b>':esc(fullTime(v.edited_at||v.saved_at))}<small>${esc(v.edited_by||'?')}${v.current?' · '+esc(relTime(v.edited_at)):''}</small></button>`).join('')
      + (items.length===1?'<div class="kb-meta" style="padding:10px">Starší verze zatím nejsou. Ukládají se, když poznámku upraví někdo jiný, nebo po 15 minutách od poslední změny.</div>':'');
    vl.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ sel=+b.dataset.i; draw(); });
    const v=items[sel];
    let content;
    if(v.current) content=`<div class="kb-md">${mdToHtml(v.body)||''}</div>`;
    else if(mode==='diff'){
      const df=lineDiff(v.body||'', n.body||'');
      content = df ? `<pre style="font-family:var(--mono);font-size:12.5px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;margin:0">${df.map(([k,l])=>`<div class="${k==='+'?'kb-diff-add':k==='-'?'kb-diff-del':''}">${k===' '?'&nbsp; ':k+' '}${esc(l)||'&nbsp;'}</div>`).join('')}</pre>` : '<div class="kb-meta">Text je příliš dlouhý na porovnání.</div>';
    } else content=`<div class="kb-md">${mdToHtml(v.body)}</div>`;
    vp.innerHTML=`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
        <b style="flex:1;min-width:160px">${esc(v.title||'Bez názvu')}</b>
        ${v.current?'':`<span class="kb-seg"><button type="button" data-m="diff" class="${mode==='diff'?'on':''}">Změny proti aktuální</button><button type="button" data-m="view" class="${mode==='view'?'on':''}">Celý text</button></span>`}
        ${!v.current&&ed?'<button type="button" class="kb-btn sm primary" data-restore>Obnovit tuto verzi</button>':''}
      </div>${!v.current&&mode==='diff'?'<p class="kb-meta" style="margin-bottom:10px">Zeleně je, co přibylo od této verze. Přeškrtnuté se od té doby smazalo.</p>':''}${content}`;
    vp.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ mode=b.dataset.m; draw(); });
    const r=vp.querySelector('[data-restore]');
    if(r) r.onclick=async()=>{
      if(!(await confirmDlg('Obnovit starší verzi?', 'Text poznámky se nahradí touto verzí. Současný stav zůstane v historii, takže se k němu dá vrátit.', 'Obnovit'))) return;
      S.cur.title=v.title; S.cur.body=v.body; changed(); await flushSave(); d.close(); renderPane(); toast('Verze obnovena');
    };
  };
  draw();
}

/* ----------------------------------------------- přílohy a import */
async function uploadFiles(files){
  if(!S.cur || !canEdit(S.cur)) return;
  if(!S.api.uploadFile){ toast('Přílohy tady nejdou nahrát'); return; }
  if(!S.editing) setEditing(true);
  for(const f of files){
    if(f.size > 25*1024*1024){ toast(`„${f.name}“ je větší než 25 MB`); continue; }
    setStatus('Nahrávám '+(f.name||'soubor')+'…');
    try{
      const path=await S.api.uploadFile(S.cur.id, f);
      const name=(f.name||'obrázek').replace(/[\[\]]/g,'');
      const md=(f.type||'').startsWith('image/') ? `![${name}](https://kb.local/${encodeURI(path)})` : `[${name}](https://kb.local/${encodeURI(path)})`;
      const ta=E.src; if(ta){ const p=ta.selectionStart; const pre=(p>0 && ta.value[p-1]!=='\n')?'\n':''; replaceIn(ta, p, ta.selectionEnd, pre+md+'\n'); onSrcInput(); }
      else { S.cur.body+= '\n'+md+'\n'; changed(); }
    }catch(e){ console.warn(e); toast('Nahrání se nepovedlo: '+(e.message||'chyba')); }
  }
  setStatus();
}
async function importFiles(files){
  let ok=0;
  for(const f of files){
    try{
      const text=await f.text();
      const m=text.match(/^\s*#\s+(.+)\n/);
      const title=(m?m[1]:f.name.replace(/\.(md|markdown|txt)$/i,'')).trim().slice(0,300);
      const body=(m?text.slice(m[0].length):text).replace(/^\s+/,'');
      const n=await S.api.createNote({title, body, kind:'poznamka', folder:S.f.folder||'', tags:S.f.tag?[S.f.tag]:[], visibility:'private', readers:[], editors:[], team_edit:false});
      upsertMeta(n, true); ok++;
    }catch(e){ console.warn(e); }
  }
  renderNav(); renderList();
  toast(ok ? `Importováno: ${ok} ${plural(ok,'poznámka','poznámky','poznámek')}` : 'Nic se nenaimportovalo');
}
function htmlToMd(html){
  const root=document.createElement('div'); root.innerHTML=html||'';
  const walk=(node)=>{
    let out='';
    node.childNodes.forEach(c=>{
      if(c.nodeType===3){ out+=c.nodeValue; return; }
      if(c.nodeType!==1) return;
      const t=c.tagName.toLowerCase(), inner=walk(c);
      if(t==='b'||t==='strong') out+= inner.trim()?`**${inner.trim()}**`:'';
      else if(t==='i'||t==='em') out+= inner.trim()?`*${inner.trim()}*`:'';
      else if(t==='s'||t==='strike'||t==='del') out+= inner.trim()?`~~${inner.trim()}~~`:'';
      else if(t==='br') out+='\n';
      else if(t==='li') out+='- '+inner.trim()+'\n';
      else if(t==='ul'||t==='ol') out+='\n'+inner+'\n';
      else if(/^h[1-6]$/.test(t)) out+='\n## '+inner.trim()+'\n';
      else if(t==='a') out+= c.getAttribute('href') ? `[${inner}](${c.getAttribute('href')})` : inner;
      else if(t==='div'||t==='p') out+= (out && !out.endsWith('\n') ? '\n' : '') + inner + '\n';
      else out+=inner;
    });
    return out;
  };
  return walk(root).replace(/ /g,' ').replace(/\n{3,}/g,'\n\n').trim();
}

/* ============================================================ klávesy */
function typingIn(el){ return !!(el && el.closest && el.closest('input,textarea,select,[contenteditable=true]')); }
function onKey(e){
  if(!S.open) return;
  if(S.host.isBlocked && S.host.isBlocked()) return;
  const mod=e.ctrlKey||e.metaKey;
  if(e.key==='Escape'){
    if(S.dialogs.length){ e.preventDefault(); S.dialogs[S.dialogs.length-1](); return; }
    if(MENU){ e.preventDefault(); closeMenu(); return; }
    if(AC.el){ e.preventDefault(); acHide(); return; }
    if(BUB){ e.preventDefault(); hideBubble(); return; }
    if(E.root.classList.contains('nav-open')){ E.root.classList.remove('nav-open'); return; }
    if(document.activeElement===E.q){ if(E.q.value) return; E.q.blur(); }
    if(S.editing){ e.preventDefault(); setEditing(false); return; }
    if(E.root.dataset.pane==='note' && window.innerWidth<=900){ e.preventDefault(); flushSave(); setPane('list'); return; }
    if(S.host.closable!==false){ e.preventDefault(); KB.close(); }
    return;
  }
  if(S.dialogs.length) return;
  if(mod && e.key.toLowerCase()==='k'){ e.preventDefault(); E.q.focus(); E.q.select(); return; }
  if(mod && e.key.toLowerCase()==='s'){ if(S.cur){ e.preventDefault(); flushSave().then(()=>{ if(!S.dirty) setStatus('Uloženo'); }); } return; }
  if(mod && e.key.toLowerCase()==='e'){ if(S.cur && canEdit(S.cur)){ e.preventDefault(); setEditing(!S.editing); } return; }
  if(typingIn(e.target) || mod || e.altKey) return;
  if(e.key==='/'){ e.preventDefault(); E.q.focus(); E.q.select(); }
  else if(e.key==='n'){ e.preventDefault(); createNote('poznamka'); }
  else if(e.key==='e' && S.cur && canEdit(S.cur) && !S.editing){ e.preventDefault(); setEditing(true); }
}

/* ============================================================ načtení */
async function refreshStats(){
  try{
    const rows=await S.api.commentStats();
    const m=new Map();
    for(const r of rows){
      const s=m.get(r.note_id)||{count:0, open:0, lastOther:0};
      s.count++; if(!r.parent_id && !r.resolved) s.open++;
      if(r.author_id!==S.me.id) s.lastOther=Math.max(s.lastOther, Date.parse(r.created_at));
      m.set(r.note_id, s);
    }
    S.cstats=m;
  }catch(e){}
  renderListSoon();
}
async function loadAll(quiet){
  try{
    const [notes, stats, seen]=await Promise.all([S.api.listNotes(), S.api.commentStats().catch(()=>[]), S.api.seenList().catch(()=>[])]);
    S.notes=notes.map(n=>Object.assign({tags:[], attendees:[], readers:[], editors:[], task_ids:[], links:[]}, n));
    const m=new Map();
    for(const r of stats){ const s=m.get(r.note_id)||{count:0, open:0, lastOther:0}; s.count++; if(!r.parent_id && !r.resolved) s.open++; if(r.author_id!==S.me.id) s.lastOther=Math.max(s.lastOther, Date.parse(r.created_at)); m.set(r.note_id, s); }
    S.cstats=m;
    S.seen=new Map(seen.map(r=>[r.note_id, r]));
    S.loaded=true; S.loadError=null;
    if(S.cur){
      const meta=S.notes.find(n=>n.id===S.cur.id);
      if(meta && meta.version>S.cur.version){
        if(!S.dirty && !S.editing && !S.saving) reloadCurrent();
        else if(!S.conflict){ S.remoteNewer=meta; renderBanners(); }
      }
    }
  }catch(e){
    console.warn(e); S.loaded=true;
    S.loadError=e;
    if(!quiet){
      const missing=/kb_notes|does not exist|schema cache|42P01|PGRST20/i.test((e.message||'')+(e.code||''));
      E.items.innerHTML = missing
        ? `<div class="kb-empty"><b>Databáze pro Znalosti ještě není připravená</b>Je potřeba jednou spustit skript <code>db/2026-10-06_znalosti.sql</code> v Supabase (SQL Editor).</div>`
        : `<div class="kb-empty"><b>Poznámky se nepodařilo načíst</b>${esc(e.message||'Zkontroluj připojení.')}</div>`;
      return;
    }
  }
  if(!S.open) return;
  renderNav(); renderList();
}

/* ============================================================ veřejné API */
KB.boot = function(cfg){
  S.api=cfg.api; S.me=cfg.me||S.me; S.host=cfg.host||{};
  S.people=[...new Set([...(cfg.people||[]), S.me.name].filter(Boolean))];
  buildPeopleRe();
  if(typeof window.marked!=='undefined' && window.marked.use) try{ window.marked.use({gfm:true, breaks:true}); }catch(e){}
  mount();
  const cb=E.root.querySelector('#kbCloseBtn'); if(cb) cb.hidden = S.host.closable===false;
  if(S.host.badge && !E.root.querySelector('.kb-badge')){
    E.root.querySelector('.kb-brand').insertAdjacentHTML('afterend', `<span class="kb-chip kb-badge" title="${esc(S.host.badge)}">${esc(S.host.badge)}</span>`);
  }
  S.booted=true; S.loaded=false;
  if(!S._poll){
    S._poll=setInterval(()=>{ if(S.open && document.visibilityState==='visible'){ loadAll(true); if(S.cur && !(document.activeElement && document.activeElement.id==='kbCm')) loadComments(); } }, 45000);
    window.addEventListener('focus', ()=>{ if(S.open) loadAll(true); });
    window.addEventListener('beforeunload', ()=>{ if(S.dirty) saveNow(); });
  }
  loadAll(true).then(()=>{ if(S.host.onUnread) try{ S.host.onUnread(S.notes.filter(scopeFn('unread')).length); }catch(e){} });
};
KB.setPeople = function(list){ S.people=[...new Set([...(list||[]), S.me.name].filter(Boolean))]; buildPeopleRe(); };
KB.open = async function(opts={}){
  if(!S.booted) return;
  S.open=true; E.root.classList.add('show');
  if(!S.loaded || !S.notes.length) await loadAll();
  else { renderNav(); renderList(); }
  if(!S.cur) renderPane();
  if(opts.q!=null){ E.q.value=opts.q; runSearch(opts.q); }
  if(opts.kind){ S.f.kind=opts.kind; renderNav(); renderList(); }
  if(opts.noteId) await openNote(opts.noteId, {force:!!opts.force});
  else if(!opts.q && window.innerWidth>900) setTimeout(()=>{ if(!typingIn(document.activeElement)) E.q.focus({preventScroll:true}); }, 30);
};
KB.close = async function(){
  await flushSave();
  S.open=false; E.root.classList.remove('show','nav-open'); hideBubble(); acHide(); closeMenu();
  if(S.host.onClose) try{ S.host.onClose(); }catch(e){}
};
KB.isOpen = ()=>S.open;
KB.refresh = ()=>loadAll(true);
KB.currentId = ()=> S.cur ? S.cur.id : null;
KB.refreshTasks = ()=>{ if(S.cur && E.pane){ E.pane.querySelectorAll('.kb-task').forEach(sp=>taskChip(sp, sp.dataset.task)); } };
KB.renderTaskLinks = async function(taskId, el, beforeOpen){
  if(!el || !S.api) return;
  el.hidden=true;
  try{
    const rows=await S.api.notesForTask(taskId);
    if(!rows.length) return;
    el.hidden=false;
    el.innerHTML=`<div class="bt" style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px">${ICON('book','sm-ico')}Vzniklo z poznámky</div><div class="kb-tasklinks">${rows.map(r=>`<button type="button" class="kb-link" data-open="${esc(r.id)}"><i style="background:${kc(r.kind)}"></i>${esc(r.title||'Bez názvu')}</button>`).join('')}</div>`;
    el.querySelectorAll('[data-open]').forEach(b=>b.onclick=async()=>{ if(beforeOpen && (await beforeOpen())===false) return; KB.open({noteId:b.dataset.open}); });
  }catch(e){}
};
KB.importLegacy = async function(notes){
  const existing=await S.api.listNotes();
  const have=new Set(existing.filter(n=>n.folder==='Staré poznámky').map(n=>norm(n.title)));
  let ok=0;
  for(const o of notes||[]){
    const body=htmlToMd(o.html||'');
    if(!(o.title||'').trim() && !body.trim()) continue;
    if(have.has(norm((o.title||'Poznámka').slice(0,300)))) continue;
    try{ const n=await S.api.createNote({title:(o.title||'Poznámka').slice(0,300), body, kind:'poznamka', folder:'Staré poznámky', tags:[], visibility:'private', readers:[], editors:[], team_edit:false, archived:!!o.archived}); upsertMeta(n, true); ok++; }
    catch(e){ console.warn(e); throw e; }
  }
  if(S.open){ renderNav(); renderList(); }
  return ok;
};

/* ============================================================ Supabase */
function pgArr(vals){ return '{'+vals.map(v=>'"'+String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"').join(',')+'}'; }
KB.supabaseApi = function(sb, me){
  const COLS='id,title,kind,folder,tags,owner,owner_name,visibility,readers,editors,team_edit,archived,meeting_date,attendees,source,source_ref,task_ids,links,title_norm,version,created_at,updated_at,updated_by';
  const LIST=COLS+',kb_excerpt', FULL=COLS+',body';
  const chk=({data, error})=>{ if(error) throw error; return data; };
  const urls=new Map();
  const api={
    async listNotes(){ return chk(await sb.from('kb_notes').select(LIST).order('updated_at',{ascending:false}).limit(5000)); },
    async getNote(id){ return chk(await sb.from('kb_notes').select(FULL).eq('id',id).maybeSingle()); },
    async createNote(f){ return chk(await sb.from('kb_notes').insert(f).select(FULL).single()); },
    async updateNote(id, f, version){
      const {data, error}=await sb.from('kb_notes').update(f).eq('id',id).eq('version',version).select(FULL);
      if(error) throw error;
      if(data && data.length) return {note:data[0]};
      const latest=await api.getNote(id);
      if(!latest) throw new Error('Poznámka už neexistuje, nebo k ní nemáš přístup.');
      if(latest.version===version) throw new Error('Tuhle poznámku nemáš oprávnění upravovat.');
      return {conflict:latest};
    },
    async deleteNote(id){ chk(await sb.from('kb_notes').delete().eq('id',id)); },
    async listComments(nid){ return chk(await sb.from('kb_comments').select('*').eq('note_id',nid).order('created_at')); },
    async addComment(c){ return chk(await sb.from('kb_comments').insert(c).select('*').single()); },
    async updateComment(id, f){ chk(await sb.from('kb_comments').update(f).eq('id',id)); },
    async deleteComment(id){ chk(await sb.from('kb_comments').delete().eq('id',id)); },
    async commentStats(){ return chk(await sb.from('kb_comments').select('note_id,created_at,author_id,resolved,parent_id').limit(20000)); },
    async listVersions(nid){ return chk(await sb.from('kb_versions').select('id,title,body,edited_by,edited_at,saved_at').eq('note_id',nid).order('saved_at',{ascending:false}).limit(60)); },
    async backlinks(tn, exclude){ return chk(await sb.from('kb_notes').select('id,title,kind').filter('links','cs',pgArr([tn])).neq('id',exclude).limit(50)); },
    async notesForTask(tid){ return chk(await sb.from('kb_notes').select('id,title,kind').filter('task_ids','cs',pgArr([tid])).limit(20)); },
    async search(q){ return chk(await sb.rpc('kb_search',{q, lim:60})) || []; },
    async seenList(){ return chk(await sb.from('kb_seen').select('note_id,seen_at,pinned')); },
    async setSeen(nid, f){ chk(await sb.from('kb_seen').upsert(Object.assign({user_id:me.id, note_id:nid}, f), {onConflict:'user_id,note_id'})); },
    async uploadFile(nid, file){
      const safe=(file.name||'soubor').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+/,'').slice(-80)||'soubor';
      const path=`${nid}/${Date.now().toString(36)}-${safe}`;
      const {error}=await sb.storage.from('kb').upload(path, file, {contentType:file.type||undefined, upsert:false});
      if(error) throw error; return path;
    },
    async fileUrl(path){
      const c=urls.get(path); if(c && c.exp>Date.now()) return c.url;
      const {data, error}=await sb.storage.from('kb').createSignedUrl(path, 3600);
      if(error) throw error; urls.set(path, {url:data.signedUrl, exp:Date.now()+50*60000}); return data.signedUrl;
    }
  };
  return api;
};

/* ============================================================ paměť (náhled) */
KB.memoryApi = function(seed, me){
  const now=()=>new Date().toISOString();
  const uuid=()=>'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g,()=>(Math.random()*16|0).toString(16));
  const db={ notes:(seed.notes||[]).map(clone), comments:(seed.comments||[]).map(clone), versions:(seed.versions||[]).map(clone), seen:(seed.seen||[]).map(clone), files:new Map(Object.entries(seed.files||{})) };
  let vid=1000;
  const fix=n=>{
    n.tags=[...new Set((n.tags||[]).map(s=>String(s).trim()).filter(Boolean))];
    n.attendees=[...new Set((n.attendees||[]).map(s=>String(s).trim()).filter(Boolean))];
    if(n.visibility==='private'){ n.readers=[]; n.editors=[]; n.team_edit=false; }
    n.folder=String(n.folder||'').split('/').map(s=>s.trim()).filter(Boolean).join('/');
    n.title_norm=norm(n.title); n.links=deriveLinks(n.body); n.task_ids=deriveTasks(n.body);
    return n;
  };
  db.notes.forEach(fix);
  const canRead=n=> n.owner===me.id || n.visibility==='team' || (n.visibility==='people' && [...n.readers,...n.editors].includes(me.name));
  const canEd=n=> n.owner===me.id || (n.visibility==='people' && n.editors.includes(me.name)) || (n.visibility==='team' && (n.team_edit || n.editors.includes(me.name)));
  const out=v=>new Promise(r=>setTimeout(()=>r(v===undefined?undefined:clone(v)), 40));
  const meta=n=>{ const m=clone(n); delete m.body; m.kb_excerpt=excerptOf(n.body); return m; };
  const words=t=>norm(t).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const qTokens=q=>norm(q).split(/[\s,.;:!?()"'„“”\[\]{}<>/\\|+=*&^%$#@~`-]+/).filter(Boolean).map(stemCs);
  const matches=(text, toks)=>{ const w=words(text); return toks.every(t=>w.some(x=>x.startsWith(t))); };
  const snippet=(text, toks)=>{
    const clean=plainText(text).replace(/\s+/g,' ').trim();
    const nc=clean.normalize('NFC'); const nn=nc.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    let first=-1; for(const t of toks){ const re=new RegExp('(^|[^\\p{L}\\p{N}])'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'u'); const m=re.exec(nn); if(m){ const p=m.index+m[1].length; if(first<0||p<first) first=p; } }
    if(first<0) return nc.slice(0,160);
    const a=Math.max(0, first-60), b=Math.min(nc.length, first+150);
    let seg=nc.slice(a,b), sn=nn.slice(a,b), res='', i=0;
    while(i<seg.length){
      let hit=0;
      if(i===0 || /[^\p{L}\p{N}]/u.test(sn[i-1])) for(const t of toks) if(sn.startsWith(t,i)){ let e=i+t.length; while(e<sn.length && /[\p{L}\p{N}]/u.test(sn[e])) e++; hit=Math.max(hit,e-i); }
      if(hit){ res+='⟦'+seg.slice(i,i+hit)+'⟧'; i+=hit; } else { res+=seg[i]; i++; }
    }
    return (a>0?'… ':'')+res+(b<nc.length?' …':'');
  };
  return {
    listNotes(){ return out(db.notes.filter(canRead).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at)).map(meta)); },
    getNote(id){ const n=db.notes.find(x=>x.id===id && canRead(x)); return out(n||null); },
    createNote(f){
      const n=fix(Object.assign({id:uuid(), title:'', body:'', kind:'poznamka', folder:'', tags:[], visibility:'private', readers:[], editors:[], team_edit:false, archived:false, meeting_date:null, attendees:[], source:'manual', source_ref:null}, clone(f),
        {owner:me.id, owner_name:me.name, version:1, created_at:now(), updated_at:now(), updated_by:me.name}));
      db.notes.unshift(n); return out(n);
    },
    updateNote(id, f, version){
      const n=db.notes.find(x=>x.id===id);
      if(!n || !canRead(n)) return Promise.reject(new Error('Poznámka už neexistuje, nebo k ní nemáš přístup.'));
      if(!canEd(n)) return Promise.reject(new Error('Tuhle poznámku nemáš oprávnění upravovat.'));
      if(n.owner!==me.id && ['visibility','readers','editors','team_edit'].some(k=>k in f && JSON.stringify(f[k])!==JSON.stringify(n[k]))) return Promise.reject(new Error('Sdílení může měnit jen autor poznámky'));
      if(n.version!==version) return out({conflict:n});
      if(((('body' in f) && f.body!==n.body) || (('title' in f) && f.title!==n.title)) && n.body.length && (n.updated_by!==me.name || Date.now()-Date.parse(n.updated_at) > 15*60000))
        db.versions.unshift({id:++vid, note_id:n.id, title:n.title, body:n.body, edited_by:n.updated_by, edited_at:n.updated_at, saved_at:now()});
      Object.assign(n, clone(f)); n.version++; n.updated_at=now(); n.updated_by=me.name; fix(n);
      return out({note:n});
    },
    deleteNote(id){ const n=db.notes.find(x=>x.id===id); if(!n || n.owner!==me.id) return Promise.reject(new Error('Smazat může jen autor')); db.notes=db.notes.filter(x=>x.id!==id); db.comments=db.comments.filter(c=>c.note_id!==id); return out(); },
    listComments(nid){ return out(db.comments.filter(c=>c.note_id===nid).sort((a,b)=>a.created_at.localeCompare(b.created_at))); },
    addComment(c){ const row=Object.assign({id:uuid(), author_id:me.id, author_name:me.name, resolved:false, created_at:now(), parent_id:null, quote:null}, clone(c)); db.comments.push(row); return out(row); },
    updateComment(id, f){ const c=db.comments.find(x=>x.id===id); if(c) Object.assign(c, f); return out(); },
    deleteComment(id){ db.comments=db.comments.filter(c=>c.id!==id && c.parent_id!==id); return out(); },
    commentStats(){ const vis=new Set(db.notes.filter(canRead).map(n=>n.id)); return out(db.comments.filter(c=>vis.has(c.note_id)).map(c=>({note_id:c.note_id, created_at:c.created_at, author_id:c.author_id, resolved:c.resolved, parent_id:c.parent_id}))); },
    listVersions(nid){ return out(db.versions.filter(v=>v.note_id===nid).sort((a,b)=>b.saved_at.localeCompare(a.saved_at))); },
    backlinks(tn, exclude){ return out(db.notes.filter(n=>canRead(n) && n.id!==exclude && n.links.includes(tn)).map(n=>({id:n.id, title:n.title, kind:n.kind}))); },
    notesForTask(tid){ return out(db.notes.filter(n=>canRead(n) && n.task_ids.includes(tid)).map(n=>({id:n.id, title:n.title, kind:n.kind}))); },
    search(q){
      const toks=qTokens(q); if(!toks.length) return out([]);
      const res=[];
      for(const n of db.notes.filter(canRead)){
        const hay=[n.title, (n.tags||[]).join(' '), (n.folder||'').replace(/\//g,' '), (n.attendees||[]).join(' '), n.body].join(' \n ');
        if(!matches(hay, toks)) continue;
        res.push({res_type:'note', id:n.id, title:n.title, snippet:snippet(n.body, toks), rank:(matches(n.title,toks)?2:1), updated_at:n.updated_at, info:{kind:n.kind, folder:n.folder, owner_name:n.owner_name, visibility:n.visibility, archived:n.archived, tags:n.tags}});
      }
      for(const t of (seed.tasks ? seed.tasks() : [])){
        if(!matches(t.title+' '+(t.note||''), toks)) continue;
        res.push({res_type:'task', id:t.id, title:t.title, snippet:snippet(t.note||'', toks), rank:(matches(t.title,toks)?1.8:0.8), updated_at:t.updated_at||now(), info:{done:t.done, due:t.due, owner_name:t.ownerName, assignees:t.assignees}});
      }
      res.sort((a,b)=>b.rank-a.rank || b.updated_at.localeCompare(a.updated_at));
      return out(res.slice(0,60));
    },
    seenList(){ return out(db.seen); },
    setSeen(nid, f){ const s=db.seen.find(x=>x.note_id===nid); if(s) Object.assign(s,f); else db.seen.push(Object.assign({note_id:nid}, f)); return out(); },
    uploadFile(nid, file){ const path=`${nid}/${Date.now().toString(36)}-${(file.name||'soubor').replace(/[^A-Za-z0-9._-]+/g,'-')}`; db.files.set(path, URL.createObjectURL(file)); return out(path); },
    fileUrl(path){ const u=db.files.get(path); return u ? Promise.resolve(u) : Promise.reject(new Error('Soubor nenalezen')); }
  };
};
})();
