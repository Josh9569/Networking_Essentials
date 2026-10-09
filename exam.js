/* exam.js — the 3001ICT final-exam practice page (exam.html).

   A temporary page, not linked from index.html. There are no topics: one
   card at a time, drawn by a comfort scheduler from a bank built off the
   course's practice exam (Q1–Q6).

   Two kinds of card:
     · flash  — "explain in your own words". The answer box must hold
                something before Submit works; then the model answer is
                shown beside it and the learner marks themselves right or
                wrong.
     · graded — marked automatically: pick a row, pick a chip, or type an
                address / number / command.
   A wrong answer, either way, always counts as Again. A right one is then
   rated Hard / Good / Easy.

   Difficulty only grows the pool (card.tier <= S.diff): Easy is the core
   cards, Medium adds the harder variants, Hard the trickiest. Every card
   generates a fresh random variant each time it is shown.

   The scheduler is Anki's idea counted in CARDS rather than days, since this
   is for cramming in a session: a card's interval is how many other cards
   are answered before it is due again. Progress is kept in localStorage
   (`ne-exam-v1`).

   Reuses styles.css (.qcard, .afield, .rt-table/.rt-row.pick, .cli-block,
   .fbanner, .tool-block, .cbtn) and answer-keys.js (Enter submits, Enter
   on the focused rating button continues). Only what is new lives in
   exam.css. */

/* ═══ Small helpers ═══════════════════════════════════════════════════════ */
function ri(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function chance(p){ return Math.random()<p; }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function ip2int(s){
  const p=String(s).trim().split('.'); if(p.length!==4) return null;
  let n=0; for(const x of p){ if(!/^\d{1,3}$/.test(x)||+x>255) return null; n=n*256+(+x); }
  return n;
}
function int2ip(n){ return [n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.'); }
function pfxMask(p){ return p===0?0:(0xFFFFFFFF<<(32-p))>>>0; }
function maskStr(p){ return int2ip(pfxMask(p)); }
function netOf(n,p){ return (n&pfxMask(p))>>>0; }
function inNet(ip,net,p){ return netOf(ip,p)===net; }
function cidr(net,p){ return int2ip(net)+'/'+p; }
function mono(s){ return '<span class="mono-inl">'+esc(s)+'</span>'; }
function ul(items){ return '<ul class="ex-list">'+items.map(i=>'<li>'+i+'</li>').join('')+'</ul>'; }

/* A random private /24 (as an int). Generators never draw from
   198.51.100.0/24 or 203.0.113.0/24, so placeholders use those. */
function rNet24(){
  const k=ri(0,2);
  if(k===0) return ip2int('10.'+ri(1,254)+'.'+ri(0,255)+'.0');
  if(k===1) return ip2int('172.'+ri(16,31)+'.'+ri(0,255)+'.0');
  return ip2int('192.168.'+ri(0,255)+'.0');
}
/* A random point-to-point /30 in 10.0.0.0/8; returns the network int. */
function rLink30(){ return ip2int('10.'+ri(0,254)+'.'+ri(0,255)+'.'+(ri(0,63)*4)); }

/* Administrative distances (Cisco defaults, as taught in the course). */
const PROTO={
  connected:{name:'Connected',      ad:0},
  static:   {name:'Static',         ad:1},
  ebgp:     {name:'eBGP',           ad:20},
  eigrp:    {name:'EIGRP',          ad:90},
  ospf:     {name:'OSPF',           ad:110},
  isis:     {name:'IS-IS',          ad:115},
  rip:      {name:'RIP',            ad:120},
  eigrpEx:  {name:'External EIGRP', ad:170},
  ibgp:     {name:'iBGP',           ad:200},
};
const METRIC_NAME={
  ospf:'OSPF cost (from bandwidth)', rip:'RIP hop count', eigrp:'EIGRP composite metric (bandwidth and delay)',
  eigrpEx:'EIGRP composite metric', isis:'IS-IS metric', ebgp:'BGP path attributes', ibgp:'BGP path attributes', static:'no metric (0)',
};
function rMetric(p){
  if(p==='ospf') return ri(2,200);
  if(p==='rip') return ri(1,12);
  if(p==='eigrp'||p==='eigrpEx') return ri(2,90)*256+ri(0,255)+28160;
  if(p==='isis') return ri(10,80);
  return 0;
}
/* What a learner might type for each protocol, as key-word alternatives. */
const KW_NAME={static:'static|static route', ebgp:'eBGP|BGP|external BGP', eigrp:'EIGRP', ospf:'OSPF', isis:'IS-IS|ISIS', rip:'RIP'};
function adList(keys){ return keys.map(k=>PROTO[k].name+' '+PROTO[k].ad).join(', '); }

/* ═══ Card bank plumbing ══════════════════════════════════════════════════ */
const AREAS=[
  {id:'routing', name:'Routing'},
  {id:'ospf',    name:'OSPF'},
  {id:'acl',     name:'ACLs'},
  {id:'nat',     name:'NAT'},
  {id:'dhcp',    name:'DHCP'},
  {id:'vlan',    name:'VLANs'},
];
const TIER_NAME={1:'Easy',2:'Medium',3:'Hard'};
const CARDS=[];
function card(def){ CARDS.push(def); }

/* Typed answer box. Values are kept on a wrong answer: the hint says what
   was typed and what was wanted (access_control's convention). */
function fieldHtml(id,label,ph,wide){
  return '<div class="afield'+(wide?' ex-wide':'')+'" id="f-'+id+'"><label>'+label+'</label>'+
    '<input id="in-'+id+'" autocomplete="off" spellcheck="false" placeholder="'+esc(ph||'')+'">'+
    '<div class="ahint" id="h-'+id+'"></div></div>';
}
function val(id){ const el=document.getElementById('in-'+id); return el?el.value.trim():''; }
function markField(id,ok,correct){
  const f=document.getElementById('f-'+id), inp=document.getElementById('in-'+id), h=document.getElementById('h-'+id);
  if(!f) return;
  const typed=inp.value.trim(); inp.readOnly=true;
  if(ok){ f.className=f.className.replace(/\s(ok|bad|show)\b/g,'')+' ok'; h.textContent='Correct'; }
  else if(!typed){ f.className=f.className.replace(/\s(ok|bad|show)\b/g,'')+' show'; inp.value=correct; h.textContent='Revealed'; }
  else { f.className=f.className.replace(/\s(ok|bad|show)\b/g,'')+' bad'; h.textContent='You put '+typed+' — correct: '+correct; }
}
function intOf(s){ return /^\d+$/.test(s)?parseInt(s,10):null; }

/* A pick-a-row table on the shared .rt-table look. */
function pickTable(head,rows){
  return '<div class="ex-scroll"><table class="rt-table ex-table"><thead><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+
    rows.map((r,i)=>'<tr class="rt-row pick" data-i="'+i+'">'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+
    '</tbody></table></div>';
}
function markPicks(answer){
  document.querySelectorAll('#qbody .rt-row.pick').forEach(tr=>{
    const i=+tr.dataset.i; tr.classList.remove('sel','pick');
    if(answer.indexOf(i)>=0) tr.classList.add('correct');
    else if(Q.sel.has(i)) tr.classList.add('wrong');
  });
}
function sameSet(a,set){ return a.length===set.size&&a.every(i=>set.has(i)); }

/* Single-choice chips. */
function chipsHtml(opts){
  return '<div class="ex-chips">'+opts.map((o,i)=>'<button type="button" class="cbtn ex-chip" data-c="'+i+'">'+o+'</button>').join('')+'</div>';
}
function markChips(answer){
  document.querySelectorAll('#qbody .ex-chip').forEach(b=>{
    const i=+b.dataset.c; b.disabled=true; b.classList.remove('on');
    if(i===answer) b.classList.add('ex-ok'); else if(i===Q.choice) b.classList.add('ex-bad');
  });
}

/* IOS output / config, column spacing preserved. */
function cliHtml(text,title){
  return (title?'<div class="qlbl ex-cli-lbl">'+title+'</div>':'')+'<div class="cli-block ex-cli">'+esc(text)+'</div>';
}
function pad(s,n){ s=String(s); return s+' '.repeat(Math.max(1,n-s.length)); }

/* ═══ Key words (flashcards) ════════════════════════════════════════════════
   A flashcard's points mark their key words inline as [[shown|alt|alt]]: the
   first form is what the model answer shows, and any form counts when it
   appears in the learner's answer. Matching is on word stems, so plurals and
   word endings (fail / fails / failure needs listing, converge / convergence
   doesn't), British and US spelling (summarise / summarize, neighbour /
   neighbor), hyphens (router-id = router id) and case don't matter. A
   multi-word form must appear as consecutive words. */
const KW_RE=/\[\[([^\]]+)\]\]/g;
function kwStem(w){
  w=w.toLowerCase().replace(/our/g,'or').replace(/iz/g,'is');
  if(w.length<=3||/^\d/.test(w)) return w;
  if(/ies$/.test(w)) w=w.slice(0,-3)+'y';
  else if(/sses$/.test(w)) w=w.slice(0,-2);
  else if(/[^su]s$/.test(w)) w=w.slice(0,-1);
  const m=/(ation|ion|ment|ence|ance|ing|edly|ed|ally|ly)$/.exec(w);
  if(m&&w.length-m[0].length>=4) w=w.slice(0,-m[0].length);
  if(/e$/.test(w)&&w.length>4) w=w.slice(0,-1);
  return w;
}
/* Words of a text with their stems and where they sit in it. */
function kwTokens(text){
  const out=[], re=/[A-Za-z0-9]+/g; let m;
  const plain=String(text).replace(/&[a-z]+;/g,t=>' '+t.slice(1,-1)+' ');
  while((m=re.exec(plain))) out.push({stem:kwStem(m[0]), at:m.index, len:m[0].length});
  return out;
}
/* Every place any form of key word k occurs in the learner's words. */
function kwFind(words,k){
  const hits=[];
  k.forms.forEach(f=>{
    const st=kwTokens(f).map(t=>t.stem); if(!st.length) return;
    for(let i=0;i+st.length<=words.length;i++){
      let ok=true; for(let j=0;j<st.length;j++) if(words[i+j].stem!==st[j]){ ok=false; break; }
      if(ok) for(let j=0;j<st.length;j++) hits.push(i+j);
    }
  });
  return hits;
}
/* The model answer as HTML with its key words wrapped, plus the key words. */
function kwModel(points){
  const keys=[];
  const html=ul(points.map(pt=>pt.replace(KW_RE,(m,body)=>{
    const forms=body.split('|'); keys.push({shown:forms[0], forms});
    return '<mark class="ex-kw" data-k="'+(keys.length-1)+'">'+forms[0]+'</mark>';
  })));
  return {html, keys};
}
/* Check an answer: which key words it used, and the answer as HTML with the
   words that matched highlighted. */
function kwCheck(text,keys){
  const words=kwTokens(text), used=new Set();
  const found=keys.map(k=>{ const h=kwFind(words,k); h.forEach(i=>used.add(i)); return h.length>0; });
  let html='', pos=0;
  words.forEach((w,i)=>{
    if(!used.has(i)) return;
    html+=esc(text.slice(pos,w.at))+'<mark class="ex-kw hit">'+esc(text.slice(w.at,w.at+w.len))+'</mark>';
    pos=w.at+w.len;
  });
  html+=esc(text.slice(pos));
  return {found, html};
}

/* ═══ Q1 — static and dynamic routing, AD, metrics, floating statics ═════ */
card({id:'q1a-dynamic', area:'routing', tier:1, kind:'flash', src:'Q1 a', title:'Static vs dynamic routing', gen(){
  return {
    prompt: pick([
      'Why would you use a dynamic routing protocol rather than static routes? When would it be preferable to use static routes?',
      'A company is growing from '+ri(2,3)+' routers to '+ri(20,40)+', with redundant links between its sites. Should it keep using static routes or move to a dynamic routing protocol? When would static routes still be the better choice?',
      'Give two advantages of a dynamic routing protocol over static routes, and two situations where static routes are the better choice.',
    ]),
    points: [

      '<b>Dynamic:</b> routers learn and share routes [[automatically|automatic|auto]], so a large or growing network needs far less manual configuration &mdash; it [[scales|scale|scalable|scalability|large network|larger network|big network|growing|grows]].',
      '<b>Dynamic:</b> it adapts to topology changes &mdash; when a [[link fails|fails|failure|failures|goes down|failover|fail over|redundant|redundancy|alternate path|alternative path|backup path|topology change|reconverge|converge]] the routers reconverge onto another path with no admin action.',
      'The cost of dynamic routing: it uses router [[CPU|processing|memory|bandwidth|overhead|resources]], memory and link bandwidth, and is more complex to configure and secure.',
      '<b>Static:</b> [[small networks|small network|small|few routes|few routers]] with few routes that rarely change.',
      '<b>Static:</b> a [[stub network|stub|single exit|one exit|single path|one path|one way out|single link|one link|default route]] with a single way out &mdash; e.g. a default route to the ISP.',
      '<b>Static:</b> no routing updates are sent &mdash; more [[secure|security|no updates|no routing updates]], no overhead &mdash; and the path is exactly what the admin chose; also used as a backup (floating static route).',
    ],
  };
}});

card({id:'q1b-adpair', area:'routing', tier:1, kind:'flash', src:'Q1 b', title:'Two protocols, one destination', gen(){
  const pair=chance(.45)?['ospf','rip']:pick([['eigrp','ospf'],['eigrp','rip'],['ospf','isis'],['ebgp','ospf'],['static','ospf']]);
  const [a,b]=shuffle(pair), W=PROTO[a].ad<PROTO[b].ad?a:b, L=W===a?b:a;
  const src=k=>k==='static'?'a static route':'the routing protocol '+PROTO[k].name;
  return {
    prompt:'If a router has a choice between two routes to a destination, one provided by '+src(a)+' and the other by '+src(b)+', which one will the router choose? Why?',
    points: [
      'The <b>[['+KW_NAME[W]+']]</b> route, because it has the [[lower|lowest|smaller|smallest|less]] [[administrative distance|AD]] ('+adList([W,L])+').',
      'AD rates how [[trustworthy|trust|trusted|reliable|reliability|believable|believability|preferred]] a route\'s source is. When two sources offer the same prefix, the lower AD is installed in the routing table.',
      'The [[metrics|metric]] can\'t decide it: '+METRIC_NAME[a]+' and '+METRIC_NAME[b]+' are measured in different units, so they aren\'t compared across sources.',
      'The '+PROTO[L].name+' route is kept in reserve and installed only if the '+PROTO[W].name+' route [[disappears|fails|failure|goes down|lost|removed|withdrawn|unavailable|backup]].',
    ],
  };
}});

card({id:'q1c-admetric', area:'routing', tier:1, kind:'flash', src:'Q1 c', title:'Metric vs administrative distance', gen(){
  return {
    prompt: pick([
      'Routing protocols use both metrics and administrative distance (AD). If there is a choice of routes to the same destination, which have different metrics and ADs, which route is chosen?',
      'R1 has two routes to the same network: one with a lower metric, the other with a lower administrative distance. Which does it install, and when does the metric matter at all?',
    ]),
    points: [

      '<b>AD first:</b> of the routes to the same prefix from different sources, the one with the [[lowest|lower|smallest|smaller]] [[administrative distance|AD]] is installed, whatever its metric.',
      '<b>Metric second:</b> the [[metric]] only chooses between routes from the [[same protocol|same source|same routing protocol|same AD|same administrative distance|equal AD|equal administrative distance]] (same AD) &mdash; e.g. two OSPF paths, lowest cost wins.',
      'Same AD and same metric: both are installed and traffic is [[load balanced|load balance|load balancing|load share|load sharing|ECMP|equal cost|both installed|both used]] (equal-cost multipath).',
      'Different prefix lengths are different routes and can all be installed; when forwarding, the [[longest prefix match|longest prefix|longest match|most specific|more specific|prefix length]] is used before AD is ever considered.',
    ],
  };
}});

card({id:'q1d-floating', area:'routing', tier:1, kind:'flash', src:'Q1 d', title:'Floating static routes', gen(){
  const p=pick(['ospf','eigrp','rip']);
  return {
    prompt: pick([
      'What is the purpose of a floating static route? How do you ensure that a static route is treated as a floating static route?',
      'R1 learns the route to its head office through '+PROTO[p].name+'. You add a static route over a backup link that should be used only if the '+PROTO[p].name+' route is lost. What is this route called, and how do you stop it replacing the '+PROTO[p].name+' route?',
    ]),
    points: [

      'A floating static route is a [[backup|backup route|secondary|failover|fail over|standby]]: it stays out of the [[routing table|table]] while the primary route exists and is installed only if the primary [[fails|failure|goes down|lost|unavailable|disappears|removed]].',
      'Make it float by giving it an [[administrative distance|AD]] [[higher|greater|larger|bigger|more than|above]] than the primary route\'s &mdash; the AD goes at the end of the <span class="mono-inl">ip route</span> command.',
      'e.g. primary learned by '+PROTO[p].name+' (AD '+PROTO[p].ad+'): '+mono('ip route 10.1.1.0 255.255.255.0 10.2.2.2 '+(PROTO[p].ad+10))+' &mdash; any AD from '+(PROTO[p].ad+1)+' to 254 works (255 means "never install").',
      'Without it the static route gets the default AD of 1 and would replace the primary instead of waiting behind it.',
    ],
  };
}});

/* Which route is installed: one prefix, 2–3 sources. */
card({id:'g1-adpick', area:'routing', tier:1, kind:'graded', src:'Q1 b', title:'Which route is installed?', gen(){
  const net=rNet24(), n=chance(.5)?2:3;
  /* "Pick the smallest metric" must be worth only chance (1/n): decide up
     front whether this round is one it would solve, then redraw until it is.
     A static route (metric 0, AD 1) always satisfies it, so it only appears
     in rounds that are meant to. */
  const easyRound=chance(1/n);
  let keys, rows, win;
  for(let t=0;t<500;t++){
    keys=shuffle(chance(.7)?['eigrp','ospf','rip','static']:['eigrp','ospf','rip','static','isis','ebgp']).slice(0,n);
    if(!easyRound&&keys.indexOf('static')>=0) continue;
    rows=keys.map((k,i)=>({k, m:rMetric(k), nh:'10.0.'+ri(1,99)+'.'+(i*4+2)}));
    win=rows.reduce((a,r)=>PROTO[r.k].ad<PROTO[a.k].ad?r:a);
    const minM=Math.min(...rows.map(r=>r.m));
    if((win.m===minM&&rows.filter(r=>r.m===minM).length===1)===easyRound) break;
  }
  const ans=[rows.indexOf(win)];
  return {
    prompt:'R1 has learned <b>'+cidr(net,24)+'</b> from '+n+' sources. Which route does R1 install in its routing table?',
    body: pickTable(['Source','Next hop','Metric'], rows.map(r=>[PROTO[r.k].name, r.nh, String(r.m)])),
    pick:{multi:false},
    grade(){
      const ok=sameSet(ans,Q.sel); markPicks(ans);
      return {ok, verdict: ok?'Correct &mdash; '+PROTO[win.k].name+' has the lowest AD.':'The '+PROTO[win.k].name+' route is installed.',
        why: ul(['Administrative distances: '+adList(keys)+'. Lowest AD wins: <b>'+PROTO[win.k].name+'</b>.',
          'The metric column is a trap here &mdash; metrics from different protocols are in different units and are never compared.'])};
    },
  };
}});

/* Several candidates, one protocol twice: AD picks the source, then the
   metric picks within it; a tie installs both. */
card({id:'g1-admetric', area:'routing', tier:2, kind:'graded', src:'Q1 c', title:'AD, then metric', gen(){
  const net=rNet24(), pfx=pick([24,24,23,26]);
  let keys=shuffle(chance(.3)?['eigrp','ospf','rip','isis','static']:['eigrp','ospf','rip','isis']).slice(0,ri(2,3));
  const dynamic=keys.filter(k=>k!=='static');
  if(!dynamic.length){ keys.push('ospf'); dynamic.push('ospf'); }
  const lowest=keys.reduce((a,k)=>PROTO[k].ad<PROTO[a].ad?k:a);
  const dup=chance(.7)&&lowest!=='static'?lowest:pick(dynamic);
  const ecmp=chance(.35);
  const rows=keys.map(k=>({k, m:rMetric(k)}));
  const first=rows.find(r=>r.k===dup);
  let m2=rMetric(dup); while(m2===first.m) m2=rMetric(dup);
  rows.push({k:dup, m:ecmp?first.m:m2});
  const sh=shuffle(rows); sh.forEach((r,i)=>{ r.nh='10.0.'+ri(1,99)+'.'+(i*4+2); });
  const W=sh.reduce((a,r)=>PROTO[r.k].ad<PROTO[a.k].ad?r:a).k;
  const best=Math.min(...sh.filter(r=>r.k===W).map(r=>r.m));
  const ans=sh.map((r,i)=>r.k===W&&r.m===best?i:-1).filter(i=>i>=0);
  return {
    prompt:'R1 has these candidate routes to <b>'+cidr(netOf(net,pfx),pfx)+'</b>. Select <b>every</b> route R1 installs in its routing table &mdash; it may be one or more.',
    body: pickTable(['Source','Next hop','Metric'], sh.map(r=>[PROTO[r.k].name, r.nh, String(r.m)])),
    pick:{multi:true},
    grade(){
      const ok=sameSet(ans,Q.sel); markPicks(ans);
      const why=['Step 1, AD: '+adList([...new Set(sh.map(r=>r.k))])+' &rarr; only the <b>'+PROTO[W].name+'</b> routes are considered.'];
      const ws=sh.filter(r=>r.k===W);
      if(ws.length>1) why.push('Step 2, metric: the '+PROTO[W].name+' routes have '+METRIC_NAME[W]+' '+ws.map(r=>r.m).join(' and ')+
        (ans.length>1?' &mdash; a tie, so <b>both</b> are installed and R1 load-balances across them.':' &rarr; the lower one wins.'));
      else why.push('There is only one '+PROTO[W].name+' route, so the metric never comes into it.');
      return {ok, verdict: ok?'Correct.':(ans.length>1?'Both equal-cost '+PROTO[W].name+' routes are installed.':'Only the highlighted route is installed.'), why: ul(why)};
    },
  };
}});

/* Longest prefix match before AD. */
card({id:'g1-lpm', area:'routing', tier:3, kind:'graded', src:'Q1 c', title:'Longest match beats AD', gen(){
  const base=rNet24(), b16=netOf(base,16);
  const rows=[
    {k:pick(['ospf','eigrp']), net:b16, p:16},
    {k:pick(['rip','eigrpEx','static']), net:base, p:24},
    {k:'static', net:0, p:0},
  ];
  if(chance(.5)){ // the same /24 from a better source as well
    const lowK=PROTO[rows[1].k].ad>PROTO.ospf.ad?pick(['ospf','eigrp']):'static';
    if(lowK!==rows[1].k) rows.push({k:lowK, net:base, p:24});
  }
  const q=ri(0,3);
  if(chance(.6)) rows.push({k:pick(['ospf','rip','eigrp']), net:(base+q*64)>>>0, p:26});
  const sub=rows.find(r=>r.p===26);
  // where the destination falls: inside the /26, elsewhere in the /24, elsewhere in the /16, or nowhere
  const where=pick(sub?['26','24','24','16','0']:['24','24','16','0']);
  let dest;
  for(let t=0;t<200;t++){
    if(where==='26') dest=(sub.net+ri(1,62))>>>0;
    else if(where==='24') dest=(base+ri(1,254))>>>0;
    else if(where==='16') dest=(b16+ri(0,255)*256+ri(1,254))>>>0;
    else dest=ip2int(pick(['8.8.8.8','1.1.1.1','203.0.113.'+ri(1,254),'198.51.100.'+ri(1,254)]));
    if(where==='24'&&sub&&inNet(dest,sub.net,26)) continue;
    if(where==='16'&&inNet(dest,base,24)) continue;
    break;
  }
  const sh=shuffle(rows); sh.forEach((r,i)=>{ r.nh='10.0.'+ri(1,99)+'.'+(i*4+2); });
  const match=sh.filter(r=>inNet(dest,r.net,r.p));
  const longest=Math.max(...match.map(r=>r.p));
  const top=match.filter(r=>r.p===longest);
  const win=top.reduce((a,r)=>PROTO[r.k].ad<PROTO[a.k].ad?r:a);
  const ans=[sh.indexOf(win)];
  return {
    prompt:'R1 has learned the routes below. A packet arrives for <b>'+int2ip(dest)+'</b>. Which route does R1 use to forward it?',
    body: pickTable(['Source','Network','Next hop'], sh.map(r=>[PROTO[r.k].name, cidr(r.net,r.p), r.nh])),
    pick:{multi:false},
    grade(){
      const ok=sameSet(ans,Q.sel); markPicks(ans);
      const why=[int2ip(dest)+' matches '+match.map(r=>cidr(r.net,r.p)).join(', ')+'. The <b>longest prefix</b> wins: /'+longest+'.'];
      if(top.length>1) why.push('Two sources offer that /'+longest+': '+adList(top.map(r=>r.k))+' &rarr; the lower AD is the one in the table.');
      const higherAd=match.filter(r=>r.p<longest&&PROTO[r.k].ad<PROTO[win.k].ad);
      if(higherAd.length) why.push('AD never compares routes of different lengths &mdash; the '+PROTO[higherAd[0].k].name+' /'+higherAd[0].p+' has a lower AD but is less specific, so it loses.');
      if(longest===0) why.push('Nothing more specific covers it, so the default route is used.');
      return {ok, verdict: ok?'Correct.':'The '+PROTO[win.k].name+' '+cidr(win.net,win.p)+' route forwards it.', why: ul(why)};
    },
  };
}});

/* Write the floating static route. */
function parseIpRoute(s){
  const t=s.replace(/^\S*\(config\)#\s*/i,'').trim().split(/\s+/);
  if(t.length<2||t[0].toLowerCase()!=='ip'||!/^ro(u(t(e)?)?)?$/i.test(t[1])) return {err:'Start with ip route.'};
  if(t.some(x=>x.indexOf('/')>=0&&/^\d/.test(x))) return {err:'IOS takes a dotted mask (e.g. 255.255.255.0), not /24.'};
  const net=ip2int(t[2]||''), mask=ip2int(t[3]||'');
  if(net==null||mask==null) return {err:'Expected ip route <network> <mask> <next hop> [AD].'};
  const rest=t.slice(4);
  let ad=null;
  if(rest.length>1&&/^\d+$/.test(rest[rest.length-1])) ad=+rest.pop();
  const nh=rest.map(ip2int).find(x=>x!=null);
  return {net, mask, nh:nh==null?null:nh, ad};
}
card({id:'g1-float', area:'routing', tier:2, kind:'graded', src:'Q1 d', title:'Write a floating static route', gen(){
  const prim=pick(['ospf','ospf','eigrp','rip','static','ebgp']), A=PROTO[prim].ad;
  const dflt=chance(.35), pfx=dflt?0:pick([24,24,23,22,25,26,27]);
  const net=dflt?0:netOf((rNet24()+ri(0,255))>>>0,pfx);
  const l1=rLink30(), l2=rLink30(), nh1=l1+2, nh2=l2+2;
  const what=dflt?'its <b>default route</b> to the ISP':'<b>'+cidr(net,pfx)+'</b>';
  const how=prim==='static'?'a static route via '+int2ip(nh1):PROTO[prim].name+' (via '+int2ip(nh1)+')';
  const goodAd=Math.min(254,A+(A<10?4:10));
  const model='ip route '+int2ip(net)+' '+maskStr(pfx)+' '+int2ip(nh2)+' '+goodAd;
  return {
    prompt:'R1 reaches '+what+' through '+how+' over its primary link. Write the <b>floating static route</b> that sends this traffic to the backup next hop <b>'+int2ip(nh2)+'</b>, used only if the primary route is lost.',
    body: fieldHtml('cmd','Command (global configuration mode)','e.g. ip route 198.51.100.0 255.255.255.0 203.0.113.2',true),
    grade(){
      const r=parseIpRoute(val('cmd'));
      let why=null;
      if(r.err) why=r.err;
      else if(r.net!==net||r.mask!==pfxMask(pfx)) why='The destination should be '+int2ip(net)+' '+maskStr(pfx)+(dflt?' (a default route).':' ('+cidr(net,pfx)+').');
      else if(r.nh===nh1) why=int2ip(nh1)+' is the primary next hop &mdash; the backup goes via '+int2ip(nh2)+'.';
      else if(r.nh!==nh2) why='The next hop should be the backup, '+int2ip(nh2)+'.';
      else if(r.ad==null) why='No AD, so it gets a static route\'s default of 1 and replaces the '+PROTO[prim].name+' route (AD '+A+') instead of waiting behind it.';
      else if(r.ad<=A) why='AD '+r.ad+' is not higher than '+PROTO[prim].name+'\'s '+A+', so this route would win (or tie) and take over straight away.';
      else if(r.ad>=255) why='AD 255 means "never install" &mdash; it would never take over. Use '+(A+1)+'&ndash;254.';
      const ok=!why;
      markField('cmd',ok,model);
      return {ok, verdict: ok?'Correct &mdash; AD '+r.ad+' floats above '+PROTO[prim].name+'\'s '+A+'.':'Not quite.',
        why: ul([...(why?[why]:[]), 'Any AD from <b>'+(A+1)+' to 254</b> works: higher than '+PROTO[prim].name+' ('+A+'), lower than 255.',
          'e.g. '+mono(model)])};
    },
  };
}});

/* ═══ Q2 — OSPF: router ID, cost, multi-area, timers ══════════════════════ */
card({id:'q2a-rid', area:'ospf', tier:1, kind:'flash', src:'Q2 a', title:'The OSPF router ID', gen(){
  return {
    prompt: pick([
      'How does OSPF use the router ID? There are three ways that the value of the router ID can be determined. What decides which way is used?',
      'What is an OSPF router ID used for, and in what order does a Cisco router choose it?',
    ]),
    points: [

      'The router ID is a 32-bit value written like an IPv4 address that [[uniquely identifies|unique|uniquely|identify|identifies|identifier|identification|identity]] the router in the OSPF domain: neighbours and the LSAs it originates are tracked by it, and it breaks ties in the [[DR/BDR election|DR|BDR|designated router|election]] (highest priority, then highest router ID).',
      '<b>1.</b> The <span class="mono-inl">[[router-id|router id]]</span> command under <span class="mono-inl">router ospf</span>.',
      '<b>2.</b> If there is none: the [[highest|largest|biggest]] IPv4 address on any [[loopback|loopbacks]] interface.',
      '<b>3.</b> If there are no loopbacks: the highest IPv4 address on an [[active|up interface|interfaces that are up|physical interface|physical interfaces|enabled|operational]] (up) physical interface.',
      'The first of those that exists [[when the OSPF process starts|process starts|process start|ospf starts|ospf start|startup|start up|boot|boots|reload|restart|clear ip ospf process]] is used. It then stays put until the process restarts &mdash; '+mono('clear ip ospf process')+' or a reload.',
    ],
  };
}});

/* A router's interfaces for the router-ID cards. */
const PHYS=['GigabitEthernet0/0','GigabitEthernet0/1','Serial0/0/0','Serial0/0/1'];
function ridIfaces(nPhys,nLoop){
  const used=new Set(), ips=[];
  function fresh(gen){ for(;;){ const ip=gen(); if(!used.has(ip)){ used.add(ip); return ip; } } }
  // addresses that sort differently as strings and as numbers keep "highest" honest
  const first=ri(1,30)*8, gens=[
    ()=>ip2int('192.168.'+ri(1,99)+'.'+ri(1,254)),
    ()=>ip2int('192.168.'+ri(100,250)+'.1'),
    ()=>ip2int('172.'+ri(16,31)+'.'+ri(0,255)+'.'+ri(1,254)),
    ()=>ip2int('10.'+ri(1,250)+'.'+ri(0,255)+'.'+(first+1)),
    ()=>ip2int('10.'+ri(1,9)+'.'+ri(0,255)+'.'+ri(1,254)),
  ];
  const phys=shuffle(PHYS).slice(0,nPhys).sort().map(n=>({name:n, ip:fresh(pick(gens)), up:true}));
  const loops=Array.from({length:nLoop},(_,i)=>({name:'Loopback'+i, ip:fresh(()=>ip2int(pick(['1.1.1.','2.2.2.','10.10.10.','172.16.'+ri(0,9)+'.','192.168.'+ri(0,9)+'.','100.'+ri(1,99)+'.'+ri(0,9)+'.'])+ri(1,254))), up:true, loop:true}));
  return phys.concat(loops);
}
function ridBrief(ifs){
  const rows=['Interface              IP-Address      OK? Method Status                Protocol'];
  ifs.forEach(f=>{
    const st=f.up?'up':'administratively down', pr=f.up?'up':'down';
    rows.push(pad(f.name,23)+pad(int2ip(f.ip),16)+'YES manual '+pad(st,22)+pr);
  });
  return rows.join('\n');
}
function ridAuto(ifs){
  const L=ifs.filter(f=>f.loop&&f.up), P=ifs.filter(f=>!f.loop&&f.up);
  const best=a=>a.reduce((x,f)=>f.ip>x.ip?f:x);
  return L.length?{f:best(L), why:'no '+mono('router-id')+' command, so the highest loopback address'}:
                  {f:best(P), why:'no '+mono('router-id')+' command and no loopbacks, so the highest address on an up physical interface'};
}
function ridCard(id,tier,title,build){
  card({id, area:'ospf', tier, kind:'graded', src:'Q2 a', title, gen(){
    const r=build();
    return {
      prompt:r.prompt||'Using the output below, what router ID is OSPF process 1 on R1 using?',
      body: r.body+fieldHtml('rid','Router ID','e.g. 198.51.100.1'),
      grade(){
        const ok=ip2int(val('rid'))===r.rid;
        markField('rid',ok,int2ip(r.rid));
        return {ok, verdict: ok?'Correct.':'R1\'s router ID is '+int2ip(r.rid)+'.', why: ul(r.why)};
      },
    };
  }});
}
ridCard('g2-rid-basic',1,'Work out the router ID',()=>{
  const ifs=ridIfaces(ri(3,4),0), cfg=chance(.35)?ip2int(ri(1,9)+'.'+ri(1,9)+'.'+ri(1,9)+'.'+ri(1,9)):null;
  const a=ridAuto(ifs);
  return {
    body: cliHtml(ridBrief(ifs),'R1# show ip interface brief')+cliHtml('router ospf 1\n'+(cfg!=null?' router-id '+int2ip(cfg)+'\n':'')+' network 0.0.0.0 255.255.255.255 area 0','R1# show running-config | section router ospf'),
    rid: cfg!=null?cfg:a.f.ip,
    why: cfg!=null?['A '+mono('router-id')+' command always wins: '+int2ip(cfg)+'. The interface addresses are never looked at.']:
      ['There is '+a.why+': '+a.f.name+' ('+int2ip(a.f.ip)+').','"Highest" means numerically, octet by octet &mdash; not alphabetically.'],
  };
});
ridCard('g2-rid-loop',2,'Router ID with loopbacks',()=>{
  const ifs=ridIfaces(ri(2,3),ri(1,2)), cfg=chance(.25)?ip2int(ri(1,9)+'.'+ri(1,9)+'.'+ri(1,9)+'.'+ri(1,9)):null;
  const a=ridAuto(ifs), hiPhys=ifs.filter(f=>!f.loop).reduce((x,f)=>f.ip>x.ip?f:x);
  const why=cfg!=null?['A '+mono('router-id')+' command beats loopbacks and physical interfaces alike: '+int2ip(cfg)+'.']:
    ['There is '+a.why+': '+a.f.name+' ('+int2ip(a.f.ip)+').'];
  if(cfg==null&&hiPhys.ip>a.f.ip) why.push(hiPhys.name+' has a higher address ('+int2ip(hiPhys.ip)+') but a loopback beats any physical interface.');
  return {
    body: cliHtml(ridBrief(ifs),'R1# show ip interface brief')+cliHtml('router ospf 1\n'+(cfg!=null?' router-id '+int2ip(cfg)+'\n':'')+' network 0.0.0.0 255.255.255.255 area 0','R1# show running-config | section router ospf'),
    rid: cfg!=null?cfg:a.f.ip, why,
  };
});
ridCard('g2-rid-trap',3,'Router ID traps',()=>{
  const v=pick(['down','late','cleared']);
  const ifs=ridIfaces(ri(3,4),v==='down'?0:(chance(.4)?1:0));
  /* Only on the "down" variant: on the other two OSPF has been running for a
     week, and a shutdown since start-up would leave the old ID in place. */
  if(v==='down') ifs.filter(f=>!f.loop).sort((x,y)=>y.ip-x.ip)[0].up=false;
  const a=ridAuto(ifs);
  const brief=cliHtml(ridBrief(ifs),'R1# show ip interface brief');
  const why=[];
  const shut=ifs.find(f=>!f.up);
  if(shut) why.push(shut.name+' has the highest address but is administratively down, so it can\'t be the router ID.');
  if(v==='down'){
    why.unshift('There is '+a.why+': '+a.f.name+' ('+int2ip(a.f.ip)+').');
    return {body: brief+cliHtml('router ospf 1\n network 0.0.0.0 255.255.255.255 area 0','R1# show running-config | section router ospf'), rid:a.f.ip, why};
  }
  const nid=ip2int(ri(1,9)+'.'+ri(1,9)+'.'+ri(1,9)+'.'+ri(1,9));
  let log='R1(config)# router ospf 1\nR1(config-router)# router-id '+int2ip(nid)+'\n% OSPF: Reload or use "clear ip ospf process" command, for this to take effect\nR1(config-router)# end';
  if(v==='cleared') log+='\nR1# clear ip ospf process\nReset ALL OSPF processes? [no]: yes';
  const prompt='R1 has been running OSPF for a week with FULL neighbours. The admin then types the commands below. What router ID is OSPF using <b>now</b>?';
  if(v==='late'){
    why.unshift('The new '+mono('router-id')+' only takes effect when the process restarts, and it hasn\'t been &mdash; IOS says so. OSPF is still using the ID it chose at start-up: '+a.why+', '+a.f.name+' ('+int2ip(a.f.ip)+').');
    return {prompt, body: brief+cliHtml(log,'R1 console'), rid:a.f.ip, why};
  }
  return {prompt, body: brief+cliHtml(log,'R1 console'), rid:nid,
    why:[''+mono('clear ip ospf process')+' restarted OSPF, so the configured '+mono('router-id')+' ('+int2ip(nid)+') now applies &mdash; it beats every interface.']};
});

card({id:'q2b-metric', area:'ospf', tier:1, kind:'flash', src:'Q2 b', title:'The OSPF metric', gen(){
  return {
    prompt: pick([
      'What does OSPF use as its metric? If you do not specify the metric for a link explicitly, how does a Cisco router assign it a metric value?',
      'How does a Cisco router work out the OSPF cost of a route, and why do a FastEthernet and a GigabitEthernet link end up with the same cost by default?',
    ]),
    points: [

      'OSPF\'s metric is [[cost]]. A route\'s cost is the [[sum|total|add|added|adding|adds|cumulative|accumulated]] of the [[outgoing|outbound|exit|egress]] interface costs along the path; lowest total wins.',
      'Default interface cost = [[reference bandwidth|reference]] &divide; interface [[bandwidth]]. The reference is [[100 Mbps|100|10^8|100000000]], the result is rounded down, and the minimum is 1.',
      'So 10 Mbps &rarr; 10, a T1 serial (1544 kbps) &rarr; 64, and FastEthernet, GigabitEthernet and faster all &rarr; 1 &mdash; they can\'t be told apart.',
      'Fix that with '+mono('auto-cost reference-bandwidth 1000')+' (or higher) under '+mono('router ospf')+', the same on every router.',
      'You can also set it per interface: '+mono('ip ospf cost N')+', or change the '+mono('bandwidth')+' value the calculation uses.',
    ],
  };
}});

/* OSPF cost: 10^8 / bw, floored, minimum 1. Bandwidths in kbps. */
function ospfCost(bwK,refMbps){ return Math.min(65535,Math.max(1,Math.floor((refMbps||100)*1000/bwK))); }
const BW_TYPES=[
  {name:'Ethernet0/0', bw:10000, label:'10 Mbit/sec'},
  {name:'FastEthernet0/1', bw:100000, label:'100 Mbit/sec'},
  {name:'GigabitEthernet0/0', bw:1000000, label:'1 Gbit/sec'},
  {name:'Serial0/0/0', bw:1544, label:'1544 Kbit/sec'},
];
card({id:'g2-cost-if', area:'ospf', tier:1, kind:'graded', src:'Q2 b', title:'Cost of one interface', gen(){
  const t=pick(BW_TYPES.concat([{name:'Serial0/0/1', bw:pick([64,128,256,512,768,2048])}]));
  const ip=int2ip(rLink30()+1), dly=t.bw>=1000000?10:t.bw>=100000?100:t.bw>=10000?1000:20000;
  const out=t.name+' is up, line protocol is up\n  Internet address is '+ip+'/30\n  MTU 1500 bytes, BW '+t.bw+' Kbit/sec, DLY '+dly+' usec,';
  const cost=ospfCost(t.bw);
  return {
    prompt:'R1 has no OSPF cost configured and uses the default reference bandwidth. What OSPF cost does it give this interface?',
    body: cliHtml(out,'R1# show interfaces '+t.name)+fieldHtml('cost','OSPF cost','e.g. 12'),
    grade(){
      const ok=intOf(val('cost'))===cost; markField('cost',ok,String(cost));
      return {ok, verdict: ok?'Correct.':'The cost is '+cost+'.',
        why: ul(['Cost = 100,000 kbps &divide; '+t.bw+' kbps = '+(100000/t.bw).toFixed(2).replace(/\.?0+$/,'')+(cost===1&&100000/t.bw<1?', below the minimum of 1, so <b>1</b>.':' &rarr; rounded down to <b>'+cost+'</b>.')])};
    },
  };
}});

/* Interface media and the bandwidths they run at (kbps). A serial link's
   two ends can carry different `bandwidth` settings; Ethernet runs at its
   speed. */
const MEDIA={
  ser: {pfx:'S0/0/', nums:[0,1], bws:[1544,1544,512,2048,256,128]},
  gig: {pfx:'G0/', nums:[0,1,2], bws:[1000000]},
  fast:{pfx:'Fa0/', nums:[0,1], bws:[100000]},
  eth: {pfx:'E0/', nums:[0,1], bws:[10000]},
};
/* Round figures in Gbps/Mbps; anything else in kbps, as IOS shows it. */
function bwTxt(b){ return b>=1000000&&b%1000000===0?(b/1000000)+' Gbps':b>=1000&&b%1000===0?(b/1000)+' Mbps':b+' kbps'; }
card({id:'g2-cost-path', area:'ospf', tier:2, kind:'graded', src:'Q2 b', title:'Total cost of a path', gen(){
  const hops=ri(2,3), lan=rNet24(), routers=[];
  let inIf=null, inMed=null, prevOut=null;
  for(let i=0;i<=hops;i++){
    const r={name:'R'+(i+1)};
    if(inMed){
      r.inIf=inIf;
      r.in=inMed==='ser'&&chance(.6)?pick(MEDIA.ser.bws.filter(b=>b!==prevOut)):prevOut;
    }
    const med=i<hops?pick(['ser','ser','gig','fast']):pick(['gig','fast','eth']);
    const names=MEDIA[med].nums.map(n=>MEDIA[med].pfx+n).filter(n=>n!==r.inIf);
    r.outIf=pick(names); r.out=pick(MEDIA[med].bws);
    routers.push(r);
    inMed=med; prevOut=r.out;
    inIf=MEDIA[med].pfx+pick(MEDIA[med].nums);
  }
  const total=routers.reduce((s,r)=>s+ospfCost(r.out),0);
  const cell=(n,b,lan)=>n+'<div class="ex-sub">'+bwTxt(b)+(lan?' &middot; LAN':'')+'</div>';
  const rows=routers.map((r,i)=>[r.name, i?cell(r.inIf,r.in):'&mdash;', cell(r.outIf,r.out,i===hops)]);
  return {
    prompt:'Traffic from R1 to the <b>'+cidr(lan,24)+'</b> LAN on R'+(hops+1)+' follows this path. Each interface\'s bandwidth is shown. What is R1\'s total OSPF cost to that LAN (default reference bandwidth)?',
    body: '<div class="ex-scroll"><table class="rt-table ex-table"><thead><tr><th>Router</th><th>Interface in</th><th>Interface out</th></tr></thead><tbody>'+
      rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+fieldHtml('cost','Total cost','e.g. 75'),
    grade(){
      const ok=intOf(val('cost'))===total; markField('cost',ok,String(total));
      return {ok, verdict: ok?'Correct.':'The total cost is '+total+'.',
        why: ul(['OSPF adds up the cost of each <b>outgoing</b> interface, including the last router\'s interface onto the LAN: '+
          routers.map(r=>r.name+' '+ospfCost(r.out)).join(' + ')+' = <b>'+total+'</b>.',
          'The incoming interfaces don\'t count &mdash; their bandwidth is what the far router uses for traffic coming back.'])};
    },
  };
}});

card({id:'g2-cost-ref', area:'ospf', tier:3, kind:'graded', src:'Q2 b', title:'Cost with reference bandwidth and overrides', gen(){
  const t=pick(BW_TYPES), ip=int2ip(rLink30()+1);
  const ref=chance(.75)?pick([1000,10000]):null;
  const bwCmd=t.name.startsWith('Serial')&&chance(.5)?pick([128,256,512,2048]):null;
  const ovr=chance(.3)?ri(5,90):null;
  let ref2=ref; const bw=bwCmd||t.bw;
  if(ref2&&ref2*1000/bw>65535) ref2=1000;
  const cost=ovr!=null?ovr:ospfCost(bw,ref2||100);
  let cfg='interface '+t.name+'\n ip address '+ip+' 255.255.255.252\n'+(bwCmd?' bandwidth '+bwCmd+'\n':'')+(ovr!=null?' ip ospf cost '+ovr+'\n':'')+'!\nrouter ospf 1\n'+(ref2?' auto-cost reference-bandwidth '+ref2+'\n':'')+' network '+int2ip(netOf(ip2int(ip),30))+' 0.0.0.3 area 0';
  const why=[];
  if(ovr!=null) why.push(mono('ip ospf cost '+ovr)+' sets the cost directly &mdash; bandwidth and reference bandwidth are ignored. Cost = <b>'+ovr+'</b>.');
  else {
    if(!bwCmd) why.push('A '+t.name.replace(/\d.*$/,'')+' interface defaults to '+t.label+' ('+t.bw+' kbps).');
    else why.push(mono('bandwidth '+bwCmd)+' overrides the default, so the calculation uses '+bwCmd+' kbps.');
    why.push('Reference bandwidth '+(ref2?ref2+' Mbps (from '+mono('auto-cost')+')':'100 Mbps (the default)')+': '+((ref2||100)*1000)+' &divide; '+bw+' = '+((ref2||100)*1000/bw).toFixed(2).replace(/\.?0+$/,'')+' &rarr; <b>'+cost+'</b> (rounded down, minimum 1).');
  }
  return {
    prompt:'What OSPF cost does R1 use for '+t.name+'?',
    body: cliHtml(cfg,'R1# show running-config (extract)')+fieldHtml('cost','OSPF cost','e.g. 12'),
    grade(){
      const ok=intOf(val('cost'))===cost; markField('cost',ok,String(cost));
      return {ok, verdict: ok?'Correct.':'The cost is '+cost+'.', why: ul(why)};
    },
  };
}});

card({id:'q2c-multiarea', area:'ospf', tier:1, kind:'flash', src:'Q2 c', title:'Why multi-area OSPF', gen(){
  return {
    prompt: pick([
      'How does multi-area OSPF overcome the problems with single area operation?',
      'A single-area OSPF network has grown to '+ri(60,150)+' routers and its routers are struggling. What problems does one big area cause, and how does splitting it into multiple areas help?',
    ]),
    points: [

      '<b>Single-area problems:</b> every router holds the whole topology, so the [[LSDB|link state database|link-state database|database|topology table]] and routing table get large; every change [[floods|flood|flooding|LSA|LSAs|updates]] to every router and makes all of them re-run [[SPF|Dijkstra|recalculate|recalculation|recompute]] &mdash; heavy CPU, memory and bandwidth use.',
      '<b>Multi-area</b> is hierarchical: a [[backbone|area 0|area zero]] (area 0) with other areas attached to it through [[ABRs|ABR|area border router|area border routers|border router]].',
      'Detailed topology LSAs (types 1 and 2) stay inside their own area, so a change floods and triggers SPF only [[within the area|that area|its own area|one area|local area|contained|inside the area|in the area]] where it happened.',
      'ABRs pass a summary of each area to the others (type 3 LSAs) and can [[summarise|summary|summarisation|summarization|summarize|aggregate]] routes, giving [[smaller routing tables|smaller tables|smaller|fewer routes|reduced]].',
      'Result: smaller LSDBs, fewer SPF runs, less flooding, faster convergence, and problems contained within one area.',
    ],
  };
}});

card({id:'q2d-timers', area:'ospf', tier:1, kind:'flash', src:'Q2 d', title:'Hello and dead timers', gen(){
  return {
    prompt: pick([
      'Why would you modify the hello timer or the dead timer? What effects would the changes have?',
      'An admin lowers the OSPF hello interval on a link to 1 second. Why might they do that, what is the downside, and what must they make sure of on the neighbouring router?',
    ]),
    points: [

      'Hellos discover neighbours and keep adjacencies alive. Defaults: hello 10 s and dead 40 s on Ethernet and point-to-point links (30/120 on NBMA). The dead interval is how long without a hello before the neighbour is declared down.',
      '<b>Lower them</b> to detect a failed neighbour, and [[reconverge|converge|convergence|failover]], [[faster|quicker|quickly|sooner|speed|speeds]].',
      'The cost: more hello packets &mdash; more [[bandwidth|overhead|traffic|more packets|processing]] and CPU &mdash; and a risk of neighbours [[flapping|flap|unstable|instability|false]] on a busy or lossy link.',
      '<b>Raise them</b> to cut overhead on [[slow links|slow|low bandwidth]], at the cost of slower failure detection.',
      'Hello and dead intervals <b>[[must match|match|matching|identical|mismatch|mismatched|same on both|same values|same timers|agree]]</b> on both neighbours or the adjacency won\'t form. Set with '+mono('ip ospf hello-interval')+' / '+mono('ip ospf dead-interval')+' on the interface; if dead hasn\'t been set by hand, changing hello sets it to [[4 &times; hello|4 times|four times|4x|x4|quadruple|4 x|times 4|times four]].',
    ],
  };
}});

card({id:'g2-dead', area:'ospf', tier:2, kind:'graded', src:'Q2 d', title:'Hello and dead intervals', gen(){
  const v=pick(['hello','hello','dead','both','none']);
  const ifn=pick(['GigabitEthernet0/0','GigabitEthernet0/1','Serial0/0/0']), ip=int2ip(rLink30()+1);
  let hello=10, dead=40; const lines=[];
  if(v==='hello'||v==='both'){ hello=pick([1,2,3,4,5,6,15,20,30]); dead=hello*4; lines.push(' ip ospf hello-interval '+hello); }
  if(v==='dead'||v==='both'){ dead=pick([20,30,60,80,120]); if(v==='both'&&dead<=hello) dead=hello*3; lines.push(' ip ospf dead-interval '+dead); }
  const why={
    hello:['Only the hello interval is set ('+hello+' s). Changing hello automatically sets dead to <b>4 &times; hello = '+dead+' s</b>.'],
    dead:['Only the dead interval is set. Hello keeps its default of <b>10 s</b>; dead is <b>'+dead+' s</b> as configured &mdash; setting dead never changes hello.'],
    both:['Both are set explicitly, so both are used as configured: hello <b>'+hello+' s</b>, dead <b>'+dead+' s</b>.'],
    none:['Nothing is configured, so this '+(ifn.startsWith('Serial')?'point-to-point':'Ethernet (broadcast)')+' link uses the defaults: hello <b>10 s</b>, dead <b>40 s</b>.'],
  }[v];
  return {
    prompt:'What hello and dead intervals does OSPF use on R1\'s '+ifn+'?',
    body: cliHtml('interface '+ifn+'\n ip address '+ip+' 255.255.255.252'+(lines.length?'\n'+lines.join('\n'):''),'R1# show running-config interface '+ifn)+
      '<div class="ex-grid">'+fieldHtml('hello','Hello (seconds)','e.g. 12')+fieldHtml('dead','Dead (seconds)','e.g. 48')+'</div>',
    grade(){
      const okH=intOf(val('hello'))===hello, okD=intOf(val('dead'))===dead;
      markField('hello',okH,String(hello)); markField('dead',okD,String(dead));
      return {ok:okH&&okD, verdict: okH&&okD?'Correct.':'Hello '+hello+' s, dead '+dead+' s.', why: ul(why)};
    },
  };
}});

card({id:'g2-adj', area:'ospf', tier:3, kind:'graded', src:'Q2 d', title:'Will they become neighbours?', gen(){
  const OPTS=['Yes &mdash; they become FULL neighbours','No &mdash; the hello/dead timers don\'t match','No &mdash; the interfaces are in different areas','No &mdash; the interfaces are in different subnets','No &mdash; one interface is passive'];
  const fault=pick(['none','none','timers','timers','area','subnet','passive']);
  const net=rLink30(), area=pick([0,0,1,2,10]);
  const R1={ifn:'GigabitEthernet0/0', ip:net+1, net, t:[], area:String(area), passive:null};
  const R2={ifn:'GigabitEthernet0/1', ip:net+2, net, t:[], area:String(area), passive:null};
  let why;
  if(fault==='timers'){
    const k=ri(0,2);
    if(k===0){ const h=pick([5,15,20]); R2.t.push('ip ospf hello-interval '+h); why='R1 uses the defaults (10/40); R2\'s hello of '+h+' s makes its dead '+(4*h)+' s. Both must match.'; }
    else if(k===1){ R1.t.push('ip ospf hello-interval 5'); R2.t.push('ip ospf dead-interval 20'); why='R1: hello 5, dead 20 (4 &times; 5). R2: hello 10 (default), dead 20. The dead intervals agree but the hellos don\'t.'; }
    else { const d=pick([30,60,120]); R1.t.push('ip ospf dead-interval '+d); why='R1\'s dead interval is '+d+' s, R2 keeps the default 40 s. Both timers must match.'; }
  } else if(fault==='area'){
    R2.area=String(area===0?pick([1,2,5]):0); why='R1 puts the link in area '+R1.area+', R2 in area '+R2.area+'. Both ends of a link must be in the same area.';
  } else if(fault==='subnet'){
    R2.ip=net+4+2; R2.net=net+4; why='R1 is '+int2ip(R1.ip)+'/30 and R2 is '+int2ip(R2.ip)+'/30 &mdash; different subnets ('+cidr(R1.net,30)+' vs '+cidr(R2.net,30)+'), so their hellos are rejected.';
  } else if(fault==='passive'){
    R2.passive=R2.ifn; why=mono('passive-interface '+R2.ifn)+' stops R2 sending hellos on the link, so no adjacency forms (the subnet is still advertised).';
  } else {
    // healthy, but with something that looks wrong at a glance
    const k=ri(0,3);
    if(k===0){ R1.t.push('ip ospf hello-interval 5'); R2.t.push('ip ospf hello-interval 5'); why='Both set hello 5, so both get dead 20 &mdash; the timers match.'; }
    else if(k===1){ R1.t.push('ip ospf hello-interval 5','ip ospf dead-interval 20'); R2.t.push('ip ospf hello-interval 5'); why='R2\'s hello of 5 sets its dead to 20 automatically, which is exactly what R1 sets by hand &mdash; they match.'; }
    else if(k===2&&area===0){ R2.area='0.0.0.0'; why='Area 0 and area 0.0.0.0 are the same area, written two ways. Everything else matches.'; }
    else { R2.passive='GigabitEthernet0/0'; why='R2 is passive on G0/0, its LAN &mdash; not on G0/1, the link to R1. Everything on the link matches.'; }
  }
  const cfg=r=>'interface '+r.ifn+'\n ip address '+int2ip(r.ip)+' 255.255.255.252'+r.t.map(x=>'\n '+x).join('')+
    '\n!\nrouter ospf 1'+(r.passive?'\n passive-interface '+r.passive:'')+'\n network '+int2ip(r.net)+' 0.0.0.3 area '+r.area;
  const ans={none:0,timers:1,area:2,subnet:3,passive:4}[fault];
  return {
    prompt:'R1 G0/0 and R2 G0/1 are cabled together. Will R1 and R2 become OSPF neighbours?',
    body: '<div class="ex-grid"><div>'+cliHtml(cfg(R1),'R1 (extract)')+'</div><div>'+cliHtml(cfg(R2),'R2 (extract)')+'</div></div>'+chipsHtml(OPTS),
    grade(){
      const ok=Q.choice===ans; markChips(ans);
      return {ok, verdict: ok?'Correct.':'The answer: '+OPTS[ans]+'.', why: ul([why, 'To form an adjacency the two ends need matching hello and dead timers, the same area, the same subnet and mask, matching authentication, and neither end passive.'])};
    },
  };
}});

/* ═══ Second pass: shared pieces ══════════════════════════════════════════
   The ACL cards grade with the labs' own ACL engine (net-router.js): the
   same parser (acParseAce/acxParseAce), first-match walk with the implicit
   deny (aclEvaluate) and interface-name normaliser (acIfNorm). */
const NR=window.NetRouter;

/* A multi-line command box. Enter adds a line (answer-keys.js only submits
   from single-line boxes and .ex-flash); Ctrl+Enter submits. */
function cmdsHtml(id,label,ph,rows){
  return '<div class="afield ex-wide" id="f-'+id+'"><label>'+label+'</label>'+
    '<textarea id="in-'+id+'" class="ex-cmds" rows="'+(rows||4)+'" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="'+esc(ph||'')+'"></textarea>'+
    '<div class="ahint" id="h-'+id+'"></div></div>';
}
/* The box's lines, with any pasted IOS prompt ("R1(config-if)#") taken off. */
function cmdLines(id){
  return val(id).split('\n').map(l=>l.replace(/^\s*\S*\(config[^)]*\)#\s*/i,'').replace(/^\s*[A-Za-z][\w-]*#\s*/,'').trim()).filter(Boolean);
}
function markCmds(id,ok,model,why){
  const f=document.getElementById('f-'+id), ta=document.getElementById('in-'+id), h=document.getElementById('h-'+id);
  ta.readOnly=true; f.classList.remove('ok','bad','show');
  if(ok){ f.classList.add('ok'); h.textContent='Correct'; }
  else if(!ta.value.trim()){ f.classList.add('show'); ta.value=model; h.textContent='Revealed'; }
  else { f.classList.add('bad'); h.textContent=why||'Not quite'; }
}
/* IOS keywords, so the usual abbreviations (int, sw acc vl, enc dot, no sh,
   ip helper, ip dhcp ex, def, dns) are read as the full command. A word only
   expands when exactly one keyword starts with it. */
const IOS_VOCAB=['interface','switchport','access','vlan','mode','trunk','no','shutdown','encapsulation','dot1q','ip','address',
  'native','helper-address','dhcp','excluded-address','pool','network','default-router','dns-server'];
function iosNorm(line){
  return line.trim().split(/\s+/).map(t=>{
    const l=t.toLowerCase(); if(IOS_VOCAB.indexOf(l)>=0) return l;
    const m=IOS_VOCAB.filter(w=>w.startsWith(l)); return l.length>=2&&m.length===1?m[0]:l;
  }).join(' ');
}
/* Commands with the interface each was typed under ('' = global). */
function iosScript(lines){
  let ifc=''; const out=[];
  lines.forEach(l=>{
    const n=iosNorm(l);
    if(/^interface /.test(n)){ ifc=NR.acIfNorm(n.slice(10).replace(/\s+/g,'')); return; }
    if(n==='exit'||n==='end'){ ifc=''; return; }
    out.push({ifc, cmd:n});
  });
  return out;
}
function hasCmd(script,ifc,cmd){ return script.some(o=>o.ifc===ifc&&o.cmd===cmd); }

/* Clickable interfaces on a diagram. */
function markIfs(ans){
  document.querySelectorAll('#qbody .ex-if').forEach(g=>{
    g.classList.remove('sel');
    if(g.dataset.if===ans) g.classList.add('ok'); else if(g.dataset.if===Q.ifSel) g.classList.add('bad');
  });
}
function ifPill(id,name,x,y,pick){
  const w=name.length*7.4+14;
  return '<g class="ex-if'+(pick?' pk':'')+'" data-if="'+id+'"><rect x="'+(x-w/2)+'" y="'+(y-11)+'" width="'+w+'" height="20" rx="6"/>'+
    '<text x="'+x+'" y="'+(y+3)+'" text-anchor="middle">'+name+'</text></g>';
}
/* Ordering chips: click in order; click a chosen one again to undo it and
   everything after it. */
function ordHtml(opts){
  return '<div class="ex-chips">'+opts.map((o,i)=>'<button type="button" class="cbtn ex-ord" data-o="'+i+'"><span class="ex-ord-n"></span>'+o+'</button>').join('')+'</div>';
}

/* ═══ Q3 — ACLs ═══════════════════════════════════════════════════════════ */
/* The practice exam's two-router network: R1 with LAN1 (G0/0) and LAN2
   (G0/1), R2 with LAN3 (G0/0) and LAN4 (G0/1), serial between them. Every
   round draws its own addresses. */
const Q3_IF=['R1 G0/0','R1 G0/1','R2 G0/0','R2 G0/1'];   // the interface facing LAN1..LAN4
function q3Plan(){
  const tenStyle=chance(.4), sec=ri(1,250), used=new Set(), lans=[];
  while(lans.length<4){ const x=ri(1,250); if(used.has(x)) continue; used.add(x); lans.push(tenStyle?ip2int('10.'+sec+'.'+x+'.0'):ip2int('192.168.'+x+'.0')); }
  return {lans, wan:ip2int('172.16.'+ri(0,255)+'.'+(ri(0,63)*4))};
}
function q3Topo(P,pick){
  const L=i=>cidr(P.lans[i],24);
  let s='<svg class="ex-topo'+(pick?' pickable':'')+'" viewBox="0 100 800 164" role="img" aria-label="R1 and R2 with four LANs">';
  s+='<path class="ln" d="M250 132 H172 M172 110 V154"/><path class="ln" d="M295 154 V214 M262 214 H328"/>'+
     '<path class="ln ser" d="M340 132 H470"/><path class="ln" d="M560 132 H638 M638 110 V154"/><path class="ln" d="M515 154 V214 M482 214 H548"/>';
  [['R1',250],['R2',470]].forEach(r=>{ s+='<rect class="rt" x="'+r[1]+'" y="110" width="90" height="44" rx="10"/><text class="rt-name" x="'+(r[1]+45)+'" y="137" text-anchor="middle">'+r[0]+'</text>'; });
  s+='<text x="162" y="128" text-anchor="end">'+L(0)+'</text><text class="t-sub" x="162" y="145" text-anchor="end">LAN1</text>'+
     '<text x="295" y="236" text-anchor="middle">'+L(1)+'</text><text class="t-sub" x="295" y="253" text-anchor="middle">LAN2</text>'+
     '<text x="648" y="128">'+L(2)+'</text><text class="t-sub" x="648" y="145">LAN3</text>'+
     '<text x="515" y="236" text-anchor="middle">'+L(3)+'</text><text class="t-sub" x="515" y="253" text-anchor="middle">LAN4</text>'+
     '<text class="t-sub" x="405" y="156" text-anchor="middle">'+cidr(P.wan,30)+'</text>';
  s+=ifPill('R1 G0/0','G0/0',211,132,pick)+ifPill('R1 G0/1','G0/1',326,184,pick)+ifPill('R1 S0/0/0','S0/0/0',374,132,pick)+
     ifPill('R2 S0/0/0','S0/0/0',436,132,pick)+ifPill('R2 G0/0','G0/0',599,132,pick)+ifPill('R2 G0/1','G0/1',546,184,pick);
  return '<div class="ex-topo-wrap">'+s.replace('class="ex-topo','class="ex-topo ex-topo-wide')+'</svg>'+q3TopoNarrow(P,pick)+'</div>';
}
/* The same network stacked for a phone — R1 above R2, LANs either side — so
   every interface fits on screen at a readable size instead of scrolling.
   Both copies carry the same data-if, so picking and marking follow either. */
function q3TopoNarrow(P,pick){
  const L=i=>cidr(P.lans[i],24);
  let s='<svg class="ex-topo ex-topo-narrow'+(pick?' pickable':'')+'" viewBox="0 78 340 236" role="img" aria-label="R1 and R2 with four LANs">';
  s+='<path class="ln" d="M125 130 H70 M70 110 V150"/><path class="ln" d="M215 130 H270 M270 110 V150"/>'+
     '<path class="ln ser" d="M170 150 V230"/><path class="ln" d="M215 250 H270 M270 230 V270"/><path class="ln" d="M125 250 H70 M70 230 V270"/>';
  [['R1',110],['R2',230]].forEach(r=>{ s+='<rect class="rt" x="125" y="'+r[1]+'" width="90" height="40" rx="10"/><text class="rt-name" x="170" y="'+(r[1]+25)+'" text-anchor="middle">'+r[0]+'</text>'; });
  s+='<text x="70" y="90" text-anchor="middle">'+L(0)+'</text><text class="t-sub" x="70" y="104" text-anchor="middle">LAN1</text>'+
     '<text x="270" y="90" text-anchor="middle">'+L(1)+'</text><text class="t-sub" x="270" y="104" text-anchor="middle">LAN2</text>'+
     '<text x="270" y="290" text-anchor="middle">'+L(2)+'</text><text class="t-sub" x="270" y="304" text-anchor="middle">LAN3</text>'+
     '<text x="70" y="290" text-anchor="middle">'+L(3)+'</text><text class="t-sub" x="70" y="304" text-anchor="middle">LAN4</text>'+
     '<text class="t-sub" x="210" y="194">'+cidr(P.wan,30)+'</text>';
  s+=ifPill('R1 G0/0','G0/0',97,130,pick)+ifPill('R1 G0/1','G0/1',243,130,pick)+ifPill('R1 S0/0/0','S0/0/0',170,168,pick)+
     ifPill('R2 S0/0/0','S0/0/0',170,212,pick)+ifPill('R2 G0/0','G0/0',243,250,pick)+ifPill('R2 G0/1','G0/1',97,250,pick);
  return s+'</svg>';
}
function applyHtml(){
  return '<div class="ex-apply"><span class="ex-apply-lbl">Apply on:</span> <b id="if-pick" class="ex-apply-if">click an interface on the diagram</b>'+
    '<span class="ex-apply-lbl">Direction:</span>'+chipsHtml(['In','Out'])+'</div>';
}
/* A typed numbered standard ACL, parsed by the labs' engine. */
function parseStdAcl(lines){
  let num=null; const aces=[];
  for(const l of lines){
    const t=l.split(/\s+/), w0=t[0].toLowerCase();
    if(w0!=='access-list'&&!(w0.length>=8&&'access-list'.startsWith(w0))) return {err:'Each line starts with access-list ("'+l+'").'};
    const n=+t[1];
    if(!/^\d+$/.test(t[1]||'')||NR.aclNumKind(n)!=='std') return {err:'A standard ACL is numbered 1–99 or 1300–1999 — '+(t[1]||'no number')+' isn\'t.'};
    if(num!=null&&n!==num) return {err:'Every line must use the same ACL number.'};
    num=n;
    const act=(t[2]||'').toLowerCase();
    if(act==='remark') continue;
    if(act!=='permit'&&act!=='deny') return {err:'Expected permit or deny after the number ("'+l+'").'};
    const r=NR.acParseAce(act,t.slice(3).map(x=>x.toLowerCase()));
    if(r.err) return {err:r.err.replace(/^%\s*/,'')+' ("'+l+'").'};
    aces.push(r.ace);
  }
  if(!aces.length) return {err:'There are no permit or deny lines.'};
  const acl=NR.aclMake(String(num),true,4,false);
  aces.forEach((a,i)=>{ a.seq=(i+1)*10; acl.aces.push(a); });
  return {acl};
}

card({id:'q3c-place', area:'acl', tier:1, kind:'flash', src:'Q3 c', title:'Where ACLs go', gen(){
  return {
    prompt: pick([
      'Where is it best to place a standard ACL? What about an extended ACL? Why?',
      'An admin puts a standard ACL on the router interface closest to the hosts it is meant to filter. Why is that usually a mistake, and where do standard and extended ACLs belong?',
    ]),
    points: [
      '<b>Standard ACL:</b> as close to the [[destination|destinations]] as possible.',
      'It matches only the [[source address|source only|only the source|only source|source ip]], so placed near the source it would stop that host reaching <i>every</i> destination, not just the one intended.',
      '<b>Extended ACL:</b> [[as close to the source|close to the source|near the source|closest to the source|nearest the source|near source|at the source]] as possible.',
      'It can match source, destination, protocol and port, so it drops exactly the unwanted traffic before it [[wastes bandwidth|bandwidth|crosses the network|travels|resources]] crossing the network.',
    ],
  };
}});

card({id:'q3d-established', area:'acl', tier:1, kind:'flash', src:'Q3 d', title:'The established keyword', gen(){
  return {
    prompt: pick([
      'What is the purpose of adding the keyword established at the end of an ACL command line?',
      'An inbound ACL on the Internet-facing interface ends an entry with "established". What traffic does that entry let in, and why is it useful?',
    ]),
    points: [
      '<b>established</b> matches only [[TCP]] segments that belong to a session already set up &mdash; those with the [[ACK|RST|ACK or RST]] bit set.',
      'On an inbound ACL from outside it lets the [[return traffic|replies|reply|returning|responses|response]] in for connections that inside hosts [[initiated|initiate|initiates|opened|began|started from inside|inside hosts started|from inside]] &hellip;',
      '&hellip; while [[new connections|new sessions|blocking new|initiated from outside|started from outside]] from the outside are still denied.',
      'It only checks the TCP flags &mdash; it is not a [[stateful|state]] firewall, so a forged ACK would get through.',
    ],
  };
}});

function wcCard(id,tier,title,cross){
  card({id, area:'acl', tier, kind:'graded', src:'Q3 a', title, gen(){
    const pfx=cross?pick([17,18,19,20,21,22,23,12,13,14]):pick([8,16,24,24,25,26,27,28,29,30]);
    const wc=(~pfxMask(pfx))>>>0;
    let base=netOf(rNet24()+ri(0,255),pfx);
    if(cross&&chance(.75)) base=(base|(Math.floor(Math.random()*wc)&wc))>>>0;     // address bits under the wildcard: the practice exam's trap (not always, or it's a pattern)
    const first=NR.wcFirst(base,wc), last=NR.wcLast(base,wc), count=wc+1;
    const ace='access-list 1 permit '+int2ip(base)+' '+int2ip(wc);
    return {
      prompt:'Which IPv4 addresses are selected by this ACL command?',
      body: cliHtml(ace)+'<div class="ex-grid">'+fieldHtml('first','First address','e.g. 198.51.100.0')+fieldHtml('last','Last address','e.g. 198.51.100.255')+'</div>'+
        (cross?fieldHtml('count','How many addresses','e.g. 512'):''),
      grade(){
        const okF=ip2int(val('first'))===first, okL=ip2int(val('last'))===last, okC=!cross||intOf(val('count').replace(/,/g,''))===count;
        markField('first',okF,int2ip(first)); markField('last',okL,int2ip(last)); if(cross) markField('count',okC,String(count));
        const why=['First = address AND NOT wildcard = <b>'+int2ip(first)+'</b>; last = address OR wildcard = <b>'+int2ip(last)+'</b>.'];
        if(cross&&base!==first) why.push('The address isn\'t the start of the block: '+int2ip(base)+' has bits set where the wildcard has 1s, and the router ignores those bits, so the range starts at '+int2ip(first)+'.');
        if(cross) why.push(int2ip(wc)+' has '+(32-pfx)+' one-bits &rarr; 2<sup>'+(32-pfx)+'</sup> = <b>'+count.toLocaleString('en')+'</b> addresses.');
        return {ok:okF&&okL&&okC, verdict: okF&&okL&&okC?'Correct.':int2ip(first)+' to '+int2ip(last)+'.', why: ul(why)};
      },
    };
  }});
}
wcCard('g3-wild',1,'Which addresses does the ACE match?',false);
wcCard('g3-wild-x',2,'Wildcard across an octet',true);

card({id:'g3-acl', area:'acl', tier:2, kind:'graded', src:'Q3 b', title:'Write and place a standard ACL', gen(){
  const P=q3Plan(), t=ri(0,3), others=shuffle([0,1,2,3].filter(i=>i!==t)), hl=others[0], nl=others[1];
  const host=(P.lans[hl]+ri(2,254))>>>0, num=ri(1,99);
  const tests=[];
  P.lans.forEach((net,i)=>{
    if(i===t) return;
    const offs=new Set([2,10,63,64,65,127,128,129,191,192,254]);
    if(i===hl){ const h=host-net; [h-1,h,h+1].forEach(o=>{ if(o>=2&&o<=254) offs.add(o); }); }
    offs.forEach(o=>{ const ip=(net+o)>>>0; tests.push({ip, want:(i===nl||ip===host)?'permit':'deny', what:ip===host?'the permitted host':'LAN'+(i+1)}); });
  });
  tests.push({ip:P.wan+1, want:'deny', what:'the R1–R2 link'},{ip:P.wan+2, want:'deny', what:'the R1–R2 link'},{ip:ip2int('8.8.8.8'), want:'deny', what:'an outside network'});
  const model=['access-list '+num+' permit host '+int2ip(host),'access-list '+num+' permit '+int2ip(P.lans[nl])+' 0.0.0.255'];
  const tgt=Q3_IF[t];
  return {
    prompt:'Write a <b>standard ACL</b> that controls access into <b>LAN'+(t+1)+'</b> ('+cidr(P.lans[t],24)+'). Host <b>'+int2ip(host)+'</b> and all hosts in <b>LAN'+(nl+1)+
      '</b> are permitted; all other networks are not. Then say which router interface it goes on, and in which direction.',
    body: q3Topo(P,true)+cmdsHtml('acl','Standard ACL &mdash; one command per line, Ctrl+Enter submits','e.g. access-list 7 permit host 198.51.100.9',3)+applyHtml(),
    grade(){
      const p=parseStdAcl(cmdLines('acl'));
      let aclWhy=p.err||null;
      if(!aclWhy) for(const s of tests){
        const got=NR.aclEvaluate(p.acl,s.ip,false).action;
        if(got!==s.want){ aclWhy=(s.want==='permit'?'It blocks ':'It lets in ')+int2ip(s.ip)+' ('+s.what+').'; break; }
      }
      const okAcl=!aclWhy, okIf=Q.ifSel===tgt, okDir=Q.choice===1;
      markCmds('acl',okAcl,model.join('\n'),aclWhy); markIfs(tgt); markChips(1);
      const why=['e.g. '+model.map(mono).join('<br>')+' &mdash; the implicit <b>deny any</b> at the end blocks everyone else.',
        'A standard ACL matches only the source, so it goes as close to the destination as possible: <b>'+tgt+' outbound</b>, on the interface facing LAN'+(t+1)+'.'];
      if(Q.ifSel===tgt&&!okDir) why.push('Inbound on that interface would filter traffic <i>leaving</i> LAN'+(t+1)+', not entering it.');
      else if(Q.ifSel&&!okIf) why.push('On '+Q.ifSel+' it would also filter traffic that isn\'t going to LAN'+(t+1)+'.');
      return {ok:okAcl&&okIf&&okDir, verdict: okAcl&&okIf&&okDir?'Correct.':
        'Check '+[okAcl?null:'the ACL', okIf&&okDir?null:'where it goes'].filter(Boolean).join(' and ')+'.', why: ul(why)};
    },
  };
}});

card({id:'g3-place', area:'acl', tier:3, kind:'graded', src:'Q3 c', title:'Where does this ACL go?', gen(){
  const P=q3Plan(), kind=pick(['std','std','web','icmp']), a=ri(0,3), b=pick([0,1,2,3].filter(i=>i!==a));
  const L=i=>int2ip(P.lans[i]);
  let lines, policy, ans;
  if(kind==='std'){
    const n=ri(1,99); lines=['access-list '+n+' deny '+L(a)+' 0.0.0.255','access-list '+n+' permit any'];
    policy='Stop hosts in LAN'+(a+1)+' reaching LAN'+(b+1)+'. All other traffic is allowed.'; ans=Q3_IF[b];
  } else if(kind==='web'){
    const n=ri(100,199), srv=(P.lans[b]+ri(2,254))>>>0;
    lines=['access-list '+n+' deny tcp '+L(a)+' 0.0.0.255 host '+int2ip(srv)+' eq 80','access-list '+n+' permit ip any any'];
    policy='Stop hosts in LAN'+(a+1)+' browsing the web server '+int2ip(srv)+' in LAN'+(b+1)+'. Everything else is allowed.'; ans=Q3_IF[a];
  } else {
    const n=ri(100,199), h=(P.lans[a]+ri(2,254))>>>0;
    lines=['access-list '+n+' deny icmp host '+int2ip(h)+' '+L(b)+' 0.0.0.255 echo','access-list '+n+' permit ip any any'];
    policy='Stop host '+int2ip(h)+' (LAN'+(a+1)+') pinging anything in LAN'+(b+1)+'. Everything else is allowed.'; ans=Q3_IF[a];
  }
  const dir=kind==='std'?1:0;
  return {
    prompt:policy+' Where should this ACL be applied?',
    body: cliHtml(lines.join('\n'),'The ACL')+q3Topo(P,true)+applyHtml(),
    grade(){
      const ok=Q.ifSel===ans&&Q.choice===dir; markIfs(ans); markChips(dir);
      const why=kind==='std'?
        ['A <b>standard</b> ACL sees only the source, so it goes near the <b>destination</b>: '+ans+' <b>outbound</b>.',
         'Inbound on LAN'+(a+1)+'\'s interface it would stop LAN'+(a+1)+' reaching <i>every</i> network, not just LAN'+(b+1)+'.']:
        ['An <b>extended</b> ACL names the destination too, so it goes near the <b>source</b>: '+ans+' <b>inbound</b>, on the interface facing LAN'+(a+1)+'.',
         'Outbound towards LAN'+(b+1)+' would still work, but the unwanted traffic would cross the network first.'];
      return {ok, verdict: ok?'Correct.':ans+' '+(dir?'outbound':'inbound')+'.', why: ul(why)};
    },
  };
}});

/* ═══ Q4 — NAT ════════════════════════════════════════════════════════════
   The practice exam's network (the course's Lab 10A): PCs on 192.168.x.0/24
   behind Gateway G0/1, Gateway S0/0/1 to ISP S0/0/0, ISP Lo0 standing in for
   the Internet, and a /27 of public addresses on no interface. */
function natPlan(){
  const lan=ip2int('192.168.'+ri(0,254)+'.0'), h=shuffle(Array.from({length:80},(_,i)=>i+10)).slice(0,3).sort((a,b)=>a-b);
  const link=ip2int('209.165.'+ri(201,209)+'.'+(ri(1,62)*4));
  return {
    lan, gw:lan+1, link, gwOut:link+2, isp:link+1,
    pcs:[{name:'PC-A', ip:lan+h[0]},{name:'PC-B', ip:lan+h[1]},{name:'PC-C', ip:lan+h[2]}],
    pub:ip2int('209.165.'+pick([200,202,210,212])+'.'+pick([0,32,64,96,128,160,192,224])),
    lo:ip2int('192.31.'+ri(1,250)+'.1'),
  };
}
function natTableHtml(P,withC){
  const r=(d,i,ip,m,g)=>'<tr><td>'+d+'</td><td>'+i+'</td><td>'+ip+'</td><td>'+m+'</td><td>'+g+'</td></tr>';
  return '<div class="ex-scroll"><table class="rt-table ex-table ex-addr"><thead><tr><th>Device</th><th>Interface</th><th>IP address</th><th>Mask</th><th>Gateway</th></tr></thead><tbody>'+
    r('Gateway','G0/1',int2ip(P.gw),'255.255.255.0','N/A')+r('','S0/0/1',int2ip(P.gwOut),'255.255.255.252','N/A')+
    r('ISP','S0/0/0 (DCE)',int2ip(P.isp),'255.255.255.252','N/A')+r('','Lo0',int2ip(P.lo),'255.255.255.255','N/A')+
    P.pcs.slice(0,withC?3:2).map(p=>r(p.name,'NIC',int2ip(p.ip),'255.255.255.0',int2ip(P.gw))).join('')+
    '<tr><td>Public block</td><td colspan="4">'+cidr(P.pub,27)+'</td></tr></tbody></table></div>';
}
/* Gateway's NAT configuration and translation table for one round, and the
   inside global the sender ends up with (null = not translated). */
function natScenario(P,kind,sender){
  const lines=['interface GigabitEthernet0/1',' ip nat inside','interface Serial0/0/1',' ip nat outside'];
  /* the static address (pub+2..12) must not fall inside the pool, so a round
     with both starts the pool at .18 of the block, as Lab 10A does */
  const first=P.pub+(kind==='staticwins'?18:pick([1,1,18])), last=P.pub+30, rows=[];
  let global=null, aclLine='access-list 1 permit '+int2ip(P.lan)+' 0.0.0.255';
  const pool='ip nat pool PUBLIC '+int2ip(first)+' '+int2ip(last)+' netmask 255.255.255.224';
  const S=P.pcs[sender];
  if(kind==='static'||kind==='staticwins'){
    const g=P.pub+ri(2,12);
    lines.push('ip nat inside source static '+int2ip(S.ip)+' '+int2ip(g)); rows.push([g,S.ip]); global=g;
    if(kind==='staticwins'){ lines.push(aclLine,pool,'ip nat inside source list 1 pool PUBLIC'); }
  } else if(kind==='dyn'||kind==='dynhas'){
    lines.push(aclLine,pool,'ip nat inside source list 1 pool PUBLIC');
    const others=P.pcs.filter((p,i)=>i!==sender).slice(0,ri(0,2));
    let k=0;
    if(kind==='dynhas'){ rows.push([first,S.ip]); global=first; k=1; }
    others.forEach(p=>{ rows.push([first+k,p.ip]); k++; });
    if(kind==='dyn') global=first+k;
  } else if(kind==='pat'){
    lines.push(aclLine,'ip nat inside source list 1 interface Serial0/0/1 overload'); global=P.gwOut;
  } else if(kind==='patpool'){
    lines.push(aclLine,pool,'ip nat inside source list 1 pool PUBLIC overload'); global=first;
  } else if(kind==='acl'){
    // the list doesn't cover the sender: its packet goes out untranslated
    const permitted=P.pcs.filter((p,i)=>i!==sender);
    aclLine=chance(.5)?permitted.map(p=>'access-list 1 permit host '+int2ip(p.ip)).join('\n'):null;
    if(!aclLine){ // a /28 that misses the sender
      let net; for(let t=0;t<100;t++){ net=netOf(P.lan+ri(0,240),28); if(!inNet(S.ip,net,28)) break; }
      aclLine='access-list 1 permit '+int2ip(net)+' 0.0.0.15';
    }
    lines.push(...aclLine.split('\n'),pool,'ip nat inside source list 1 pool PUBLIC'); global=null;
  }
  const tbl=rows.length?'Pro Inside global      Inside local       Outside local      Outside global\n'+
    rows.map(r=>'--- '+pad(int2ip(r[0]),19)+pad(int2ip(r[1]),19)+pad('---',19)+'---').join('\n'):'';
  return {cfg:lines.join('\n'), tbl, global};
}
/* Full width, stacked: in a half-width column the long "ip nat inside
   source … overload" line scrolled, hiding the one word that decides it. */
function natBody(P,sc,withC){
  return natTableHtml(P,withC)+'<div>'+cliHtml(sc.cfg,'Gateway# show running-config (NAT)')+'</div>'+
    (sc.tbl?'<div>'+cliHtml(sc.tbl,'Gateway# show ip nat translations')+'</div>':'');
}
function pktFields(a,b){
  return '<div class="ex-grid">'+fieldHtml(a+'s',a.replace('p','Packet ')+' — source','e.g. 198.51.100.7')+fieldHtml(a+'d',a.replace('p','Packet ')+' — destination','e.g. 198.51.100.7')+
    fieldHtml(b+'s',b.replace('p','Packet ')+' — source','e.g. 203.0.113.7')+fieldHtml(b+'d',b.replace('p','Packet ')+' — destination','e.g. 203.0.113.7')+'</div>';
}
function gradeIps(want){
  let ok=true;
  Object.keys(want).forEach(k=>{ const g=ip2int(val(k))===want[k]; markField(k,g,int2ip(want[k])); ok=ok&&g; });
  return ok;
}
const NAT_KIND_TEXT={
  dyn:'Dynamic NAT hands the sender the next free pool address',
  dynhas:'The sender already has a dynamic binding, so it keeps that address',
  static:'A static mapping always translates this host to the same address',
  staticwins:'A static mapping is used before the dynamic pool is even looked at',
  pat:'PAT (overload) on Serial0/0/1 translates every host to that interface\'s own address',
  patpool:'Overload on a pool shares the first pool address between every host (they\'re told apart by port)',
};

card({id:'g4-nat', area:'nat', tier:1, kind:'graded', src:'Q4 a', title:'Addresses before and after NAT', gen(){
  const P=natPlan(), kind=pick(['dyn','dyn','static','pat']), sender=kind==='static'?0:1, S=P.pcs[sender], sc=natScenario(P,kind,sender);
  return {
    prompt:'<b>'+S.name+'</b> pings the ISP\'s Lo0 interface. What are the source and destination IP addresses of <b>Packet 1</b> (as it leaves '+S.name+') and <b>Packet 2</b> (as it leaves the Gateway towards the ISP)?',
    body: natBody(P,sc,true)+pktFields('p1','p2'),
    grade(){
      const ok=gradeIps({p1s:S.ip,p1d:P.lo,p2s:sc.global,p2d:P.lo});
      return {ok, verdict: ok?'Correct.':'Packet 2 leaves as '+int2ip(sc.global)+' &rarr; '+int2ip(P.lo)+'.',
        why: ul(['Packet 1 is untranslated: inside local '+int2ip(S.ip)+' &rarr; '+int2ip(P.lo)+'.',
          NAT_KIND_TEXT[kind]+': inside global <b>'+int2ip(sc.global)+'</b>.',
          'NAT only rewrites the inside address &mdash; the destination stays '+int2ip(P.lo)+' both times.'])};
    },
  };
}});

card({id:'g4-nat-reply', area:'nat', tier:2, kind:'graded', src:'Q4 a', title:'The reply, back through NAT', gen(){
  const P=natPlan(), kind=pick(['dyn','dynhas','patpool','static']), sender=kind==='static'?0:ri(1,2), S=P.pcs[sender], sc=natScenario(P,kind,sender);
  return {
    prompt:'<b>'+S.name+'</b> pings the ISP\'s Lo0 interface and the ISP replies. What are the addresses of <b>Packet 3</b> (the reply, arriving at the Gateway from the ISP) and <b>Packet 4</b> (the reply, leaving the Gateway towards '+S.name+')?',
    body: natBody(P,sc,true)+pktFields('p3','p4'),
    grade(){
      const ok=gradeIps({p3s:P.lo,p3d:sc.global,p4s:P.lo,p4d:S.ip});
      return {ok, verdict: ok?'Correct.':'Packet 3: '+int2ip(P.lo)+' &rarr; '+int2ip(sc.global)+'; Packet 4: '+int2ip(P.lo)+' &rarr; '+int2ip(S.ip)+'.',
        why: ul([NAT_KIND_TEXT[kind]+', so the ping left as '+int2ip(sc.global)+' and the ISP replies to <b>that</b> address.',
          'The Gateway finds the translation and rewrites the destination back to the inside local, <b>'+int2ip(S.ip)+'</b>, for Packet 4.',
          'The source, '+int2ip(P.lo)+', is never changed.'])};
    },
  };
}});

card({id:'g4-nat-trap', area:'nat', tier:3, kind:'graded', src:'Q4 a', title:'Is it translated at all?', gen(){
  const P=natPlan(), kind=pick(['acl','acl','staticwins','patpool']), sender=kind==='staticwins'?0:ri(1,2), S=P.pcs[sender], sc=natScenario(P,kind,sender);
  const src=sc.global==null?S.ip:sc.global, works=sc.global!=null;
  return {
    prompt:'<b>'+S.name+'</b> pings the ISP\'s Lo0 interface. What is the source address of <b>Packet 2</b> as it leaves the Gateway &mdash; and does the ping succeed?',
    body: natBody(P,sc,true)+fieldHtml('p2s','Packet 2 — source','e.g. 198.51.100.7')+chipsHtml(['Yes, the ping succeeds','No, the ping fails']),
    grade(){
      const okS=ip2int(val('p2s'))===src; markField('p2s',okS,int2ip(src));
      const okC=Q.choice===(works?0:1); markChips(works?0:1);
      const why=sc.global==null?
        [S.name+' ('+int2ip(S.ip)+') isn\'t matched by access-list 1, so NAT leaves it alone: Packet 2 still has the private source <b>'+int2ip(S.ip)+'</b>.',
         'The ISP has no route back to '+cidr(P.lan,24)+', so the reply is dropped &mdash; the ping <b>fails</b>.']:
        [NAT_KIND_TEXT[kind]+': <b>'+int2ip(src)+'</b>.','The ISP routes the public block back to the Gateway, which translates the reply &mdash; the ping <b>succeeds</b>.'];
      return {ok:okS&&okC, verdict: okS&&okC?'Correct.':'Source '+int2ip(src)+'; the ping '+(works?'succeeds':'fails')+'.', why: ul(why)};
    },
  };
}});

card({id:'g4-count', area:'nat', tier:2, kind:'graded', src:'Q4 c', title:'How many public addresses?', gen(){
  const N=pick([24,30,45,60,80,120,200,250]), M=ri(5,Math.min(N-1,60)), stat=chance(.35);
  return {
    prompt:'A site has <b>'+N+'</b> hosts that need Internet access, but never more than <b>'+M+'</b> are online at the same time. How many public IPv4 addresses does the Gateway need for&hellip;',
    body:'<div class="ex-grid">'+fieldHtml('dyn','(a) Dynamic NAT, every online host out at once','e.g. 12')+fieldHtml('pat','(b) Dynamic NAT with overload (PAT)','e.g. 12')+
      (stat?fieldHtml('stat','(c) Static NAT for every host','e.g. 12'):'')+'</div>',
    grade(){
      const okD=intOf(val('dyn'))===M, okP=intOf(val('pat'))===1, okS=!stat||intOf(val('stat'))===N;
      markField('dyn',okD,String(M)); markField('pat',okP,'1'); if(stat) markField('stat',okS,String(N));
      const why=['Dynamic NAT maps one public address to one inside host while its translation lasts &mdash; '+M+' online at once need <b>'+M+'</b>.',
        'PAT tells the hosts apart by port number, so they can all share <b>one</b> address.'];
      if(stat) why.push('Static NAT is a permanent one-to-one mapping, so every host needs its own: <b>'+N+'</b>.');
      return {ok:okD&&okP&&okS, verdict: okD&&okP&&okS?'Correct.':'Dynamic '+M+', PAT 1'+(stat?', static '+N:'')+'.', why: ul(why)};
    },
  };
}});

card({id:'q4b-static', area:'nat', tier:1, kind:'flash', src:'Q4 b', title:'Why static NAT', gen(){
  return {
    prompt: pick(['Why would you use the static NAT option?','The company\'s web server sits on the inside network. Why does it need static NAT rather than the dynamic pool everyone else uses?']),
    points: [
      'Static NAT is a permanent [[one-to-one|one to one|1 to 1|1:1|fixed|permanent]] mapping between one inside local and one inside global address.',
      'It is for inside devices that must be [[reachable from outside|reachable|accessible from outside|from the internet|from outside|accessible]] &mdash; typically a [[server|servers|web server]].',
      'Outside hosts need a fixed public address to start a connection to; dynamic NAT and PAT only create a translation when the inside host [[sends first|initiates|initiated|initiate|sends traffic first|first contact]].',
    ],
  };
}});
card({id:'q4c-howmany', area:'nat', tier:1, kind:'flash', src:'Q4 c', title:'Public addresses for NAT and PAT', gen(){
  return {
    prompt:'How many public addresses would you need with dynamic NAT? With dynamic NAT with overload? Explain your answer.',
    points: [
      '<b>Dynamic NAT:</b> one public address per inside host using the Internet [[at the same time|simultaneously|concurrently|at once|same time]] &mdash; the pool must be as big as that peak.',
      'When the pool runs out, further hosts [[can\'t|cannot|fail|denied|dropped|wait|unable]] get out until a translation times out.',
      '<b>Overload (PAT):</b> as few as [[one public address|one address|1 public address|1 address|single public address|single address|one ip|single ip|one public ip]] for all of them.',
      'PAT tells the sessions apart by [[port number|port numbers|ports|port]], so many inside hosts share one inside global address.',
    ],
  };
}});
card({id:'q4d-patport', area:'nat', tier:1, kind:'flash', src:'Q4 d', title:'Two hosts, same source port', gen(){
  return {
    prompt: pick(['What happens if two internal users select the same port number for a communication which requires PAT?',
      'Two inside PCs both open a connection from source port '+ri(1025,60000)+' through a PAT router with one public address. How does the router keep them apart?']),
    points: [
      'PAT identifies each session by its inside address and [[source port|port number|port]].',
      'The second host can\'t use the same inside global address and port, so the router [[assigns a different port|different port|another port|new port|next available port|changes the port|translates the port|unique port]] for it.',
      'Replies come back to that port, and the router [[translates them back|translate back|maps back|maps it back|original port]] to the right inside host and its original port.',
    ],
  };
}});

/* ═══ Q4 e — reading a routing table ══════════════════════════════════════ */
function rtPlan(){
  const M=ip2int(ri(128,191)+'.'+ri(1,254)+'.0.0'), th=shuffle(Array.from({length:22},(_,i)=>i+1)).slice(0,4);
  const lan=ip2int('192.168.'+ri(0,254)+'.0');
  const rN=M+th[0]*256, c1=M+th[1]*256, c2=M+th[2]*256, oP=pick([26,27,28]), oN=M+th[3]*256+ri(0,(1<<(32-24))/(1<<(32-oP))-1)*(1<<(32-oP));
  const sP=pick([13,14,15]), sN=ip2int(ri(200,223)+'.'+(ri(0,255)&~((1<<(16-sP))-1)&255)+'.0.0');
  const routes=[
    {code:'S*', net:0, pfx:0, text:'0.0.0.0/0 [1/0] via '+int2ip(c1+1)},
    {code:'R',  net:rN, pfx:24, text:cidr(rN,24)+' [120/1] via '+int2ip(c1+1)+', 00:00:'+pad2(ri(1,29))+', Serial0/0/0'},
    {code:'C',  net:c1, pfx:30, text:cidr(c1,30)+' is directly connected, Serial0/0/0'},
    {code:'L',  net:c1+2, pfx:32, text:cidr(c1+2,32)+' is directly connected, Serial0/0/0'},
    {code:'C',  net:c2, pfx:30, text:cidr(c2,30)+' is directly connected, Serial0/0/1'},
    {code:'L',  net:c2+1, pfx:32, text:cidr(c2+1,32)+' is directly connected, Serial0/0/1'},
    {code:'O',  net:oN, pfx:oP, text:cidr(oN,oP)+' [110/'+ri(2,129)+'] via '+int2ip(c2+2)+', 00:00:'+pad2(ri(1,29))+', Serial0/0/1'},
    {code:'C',  net:lan, pfx:30, text:cidr(lan,30)+' is directly connected, GigabitEthernet0/0'},
    {code:'L',  net:lan+1, pfx:32, text:cidr(lan+1,32)+' is directly connected, GigabitEthernet0/0'},
    {code:'S',  net:sN, pfx:sP, text:cidr(sN,sP)+' [1/0] via '+int2ip(lan+2)},
  ];
  const sub=routes.slice(1).sort((a,b)=>a.net-b.net||a.pfx-b.pfx);
  const inM=sub.filter(r=>inNet(r.net,M,16)), masks=new Set(inM.map(r=>r.pfx));
  const rows=[{hdr:'Gateway of last resort is '+int2ip(c1+1)+' to network 0.0.0.0'},routes[0],
    {hdr:cidr(M,16)+' is variably subnetted, '+inM.length+' subnets, '+masks.size+' masks'}].concat(inM).concat(
    [{hdr:cidr(lan,24)+' is variably subnetted, 2 subnets, 2 masks'}],sub.filter(r=>inNet(r.net,lan,24)),sub.filter(r=>r.code==='S'));
  return {M, th, rN, c1, c2, oN, oP, lan, sN, sP, routes, rows};
}
function pad2(n){ return (n<10?'0':'')+n; }
function rtBest(routes,dest){
  const m=routes.filter(r=>inNet(dest,r.net,r.pfx));
  return m.reduce((a,r)=>r.pfx>a.pfx?r:a);
}
function rtCard(id,tier,title,pickDest){
  card({id, area:'routing', tier, kind:'graded', src:'Q4 e', title, gen(){
    const P=rtPlan(), dest=pickDest(P)>>>0, best=rtBest(P.routes,dest);
    const routeRows=P.rows.filter(r=>!r.hdr), ans=[routeRows.indexOf(best)];
    let i=0;
    const body='<div class="ex-scroll"><table class="rt-table ex-table ex-rtab"><tbody>'+P.rows.map(r=>r.hdr?
      '<tr class="ex-rt-hdr"><td></td><td>'+esc(r.hdr)+'</td></tr>':
      '<tr class="rt-row pick" data-i="'+(i++)+'"><td>'+r.code+'</td><td'+(r.pfx&&!(r.code==='S'&&r.pfx<16)?' class="ex-rt-sub"':'')+'>'+esc(r.text)+'</td></tr>').join('')+'</tbody></table></div>';
    return {
      prompt:'Assume the following extract from a router\'s routing table. Which routing entry is the best match for packets with the destination IP address <b>'+int2ip(dest)+'</b>?',
      body, pick:{multi:false},
      grade(){
        const ok=sameSet(ans,Q.sel); markPicks(ans);
        const all=P.routes.filter(r=>inNet(dest,r.net,r.pfx));
        const why=[int2ip(dest)+' matches: '+all.map(r=>r.code+' '+cidr(r.net,r.pfx)).join(', ')+'. The longest prefix wins: <b>'+best.code+' '+cidr(best.net,best.pfx)+'</b>.'];
        if(best.pfx===0&&inNet(dest,P.M,16)) why.push('It is inside '+cidr(P.M,16)+', but that line is only a heading &mdash; none of the subnets under it covers '+int2ip(dest)+', so the default route is used.');
        if(best.code==='S'&&best.pfx<16) why.push(cidr(best.net,best.pfx)+' covers '+int2ip(best.net)+' to '+int2ip((best.net|~pfxMask(best.pfx))>>>0)+'.');
        if(best.pfx===32) why.push(int2ip(dest)+' is the router\'s own address, so the /32 local route is the most specific match.');
        return {ok, verdict: ok?'Correct.':'The best match is '+best.code+' '+cidr(best.net,best.pfx)+'.', why: ul(why)};
      },
    };
  }});
}
rtCard('g4-rt-basic',1,'Read the routing table',P=>pick([
  ()=>P.rN+ri(1,254), ()=>P.oN+ri(1,(1<<(32-P.oP))-2), ()=>P.lan+2, ()=>P.c1+1, ()=>P.c2+2])());
rtCard('g4-rt-trap',2,'Inside the major network, but no subnet',P=>{
  const used=new Set(P.th);
  return pick([
    ()=>{ let t; do t=ri(1,254); while(used.has(t)); return P.M+t*256+ri(1,254); },
    ()=>{ let t; do t=ri(1,254); while(used.has(t)); return P.M+t*256+ri(1,254); },
    ()=>{ const size=1<<(32-P.oP); let d; do d=netOf(P.oN,24)+ri(1,254); while(inNet(d,P.oN,P.oP)); return d; },
    ()=>P.oN+(1<<(32-P.oP))-2,
  ])();
});
/* a third each: inside the static supernet (but not its first /24), just
   past it, and one of the router's own addresses */
rtCard('g4-rt-hard',3,'Supernets and local routes',P=>pick([
  ()=>P.sN+ri(1,(1<<(32-P.sP))/256-1)*256+ri(1,254),
  ()=>((P.sN+(1<<(32-P.sP)))>>>0)+ri(0,255)*256+ri(1,254),
  ()=>pick([P.c1+2,P.c2+1,P.lan+1])])());

/* ═══ Q5 — DHCPv4 ═════════════════════════════════════════════════════════ */
card({id:'q5a-dora', area:'dhcp', tier:1, kind:'flash', src:'Q5 a', title:'How a PC gets an address', gen(){
  return {
    prompt: pick(['Describe how a PC obtains an IPv4 address using DHCPv4.','A PC boots with no IP address. Walk through the DHCPv4 exchange that gives it one.']),
    points: [
      '<b>1. [[Discover|DHCPDISCOVER]]</b> &mdash; the client has no address, so it [[broadcasts|broadcast]] to find a DHCP server.',
      '<b>2. [[Offer|DHCPOFFER]]</b> &mdash; a server offers an address (plus mask, gateway, DNS) and a lease time.',
      '<b>3. [[Request|DHCPREQUEST]]</b> &mdash; the client asks for that offer, still by broadcast, so any other servers know theirs was declined.',
      '<b>4. [[Acknowledgement|DHCPACK|ACK|acknowledge|acknowledges]]</b> &mdash; the server confirms; the client uses the address for the [[lease|leases|leased]] time and renews it before it runs out.',
    ],
  };
}});
card({id:'q5b-relay', area:'dhcp', tier:1, kind:'flash', src:'Q5 b', title:'Where the DHCP server must be', gen(){
  return {
    prompt: pick(['By default, where must the DHCP server for a PC be? How can we overcome this restriction?',
      'The DHCP server is moved to a data-centre network two routers away from the PCs, and the PCs stop getting addresses. Why, and how do you fix it?']),
    points: [
      'By default the server must be on the [[same subnet|same network|same LAN|same broadcast domain|local subnet|local network|same segment|same VLAN]] as the client.',
      'The client\'s Discover is a [[broadcast|broadcasts]], and routers [[do not forward broadcasts|don\'t forward|do not forward|not forwarded|block|blocks|drop|drops|stop]].',
      'Fix: make the router a [[DHCP relay|relay|relay agent]] &mdash; [[ip helper-address|helper-address|helper address|helper]] &lt;server&gt; on the interface facing the clients.',
      'The router then forwards the DHCP broadcasts to the server as [[unicast|unicasts]].',
    ],
  };
}});
card({id:'q5c-exclude', area:'dhcp', tier:1, kind:'flash', src:'Q5 c', title:'Excluded addresses', gen(){
  return {
    prompt: pick(['Why might we exclude some addresses from the range of addresses in a DHCP pool?','What does ip dhcp excluded-address protect against?']),
    points: [
      'Some devices are configured with [[static|statically|manually|fixed]] addresses from the same subnet &mdash; the [[default gateway|gateway|router interface|router\'s interface|router address|gateway address]] address, [[servers|server|printer|printers]], switch management addresses.',
      'If the pool could hand those out, a client could be given an address already in use: an IP address [[conflict|conflicts|duplicate|clash|same address]].',
      'Exclusions keep them out of the pool: '+mono('ip dhcp excluded-address 192.168.1.1 192.168.1.10')+'.',
    ],
  };
}});

card({id:'g5-dora', area:'dhcp', tier:1, kind:'graded', src:'Q5 a', title:'DHCP messages in order', gen(){
  const seq=['DHCPDISCOVER','DHCPOFFER','DHCPREQUEST','DHCPACK'];
  const opts=shuffle(seq.concat(chance(.5)?[pick(['DHCPNAK','DHCPRELEASE','DHCPDECLINE'])]:[]));
  const want=seq.map(m=>opts.indexOf(m));
  return {
    prompt:'A PC boots with no IP address. Click the DHCPv4 messages in the order they are exchanged'+(opts.length>4?' &mdash; one of them isn\'t part of it':'')+'. Click a chosen message again to undo it.',
    body: ordHtml(opts),
    grade(){
      const ok=Q.order.length===4&&Q.order.every((v,i)=>v===want[i]);
      document.querySelectorAll('#qbody .ex-ord').forEach(b=>{
        const i=+b.dataset.o, pos=want.indexOf(i), mine=Q.order.indexOf(i); b.disabled=true; b.classList.remove('on');
        b.querySelector('.ex-ord-n').textContent=pos>=0?pos+1:'✕';
        if(pos>=0&&mine===pos) b.classList.add('ex-ok'); else if(mine>=0||pos>=0) b.classList.add('ex-bad');
      });
      return {ok, verdict: ok?'Correct.':'Discover, Offer, Request, Acknowledgement.', why: ul([
        '<b>D</b>iscover (client broadcast) &rarr; <b>O</b>ffer (server) &rarr; <b>R</b>equest (client) &rarr; <b>A</b>ck (server): "DORA".',
        ...(opts.length>4?[opts.find(o=>seq.indexOf(o)<0)+' isn\'t part of getting an address: '+({DHCPNAK:'a server refuses a Request with it',DHCPRELEASE:'a client gives its address back with it',DHCPDECLINE:'a client rejects an offered address that is already in use'})[opts.find(o=>seq.indexOf(o)<0)]+'.']:[])])};
    },
  };
}});

card({id:'g5-relay', area:'dhcp', tier:2, kind:'graded', src:'Q5 b', title:'Configure a DHCP relay', gen(){
  const lanIf=pick(['G0/0','G0/1']), other=lanIf==='G0/0'?'G0/1':'G0/0', remote=chance(.5);
  const cl=ip2int('192.168.'+ri(0,254)+'.0'), sn=ip2int('10.'+ri(1,254)+'.'+ri(0,255)+'.0'), srv=sn+ri(2,250);
  const rows=[[lanIf,cidr(cl,24),'the PCs']];
  rows.push([other,remote?cidr(ip2int('172.16.'+ri(0,255)+'.0'),24):cidr(sn,24),remote?'printers (no DHCP server)':'the DHCP server '+int2ip(srv)]);
  rows.push(['S0/0/0','10.0.'+ri(1,99)+'.0/30',remote?'R2, whose LAN '+cidr(sn,24)+' holds the DHCP server '+int2ip(srv):'R2']);
  rows.sort((a,b)=>a[0]<b[0]?-1:1);
  const ifs=['G0/0','G0/1','S0/0/0'];
  return {
    prompt:'The PCs on R1\'s <b>'+lanIf+'</b> LAN get their addresses from the DHCP server <b>'+int2ip(srv)+'</b>, which is on a different network. Which R1 interface needs configuring, and what command goes on it?',
    body:'<div class="ex-scroll"><table class="rt-table ex-table"><thead><tr><th>R1 interface</th><th>Network</th><th>Connects to</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td><td style="font-family:var(--font)">'+r[2]+'</td></tr>').join('')+'</tbody></table></div>'+
      '<div class="ex-apply"><span class="ex-apply-lbl">Interface:</span>'+chipsHtml(ifs)+'</div>'+fieldHtml('cmd','Command (interface configuration mode)','e.g. ip helper-address 198.51.100.5',true),
    grade(){
      const okI=Q.choice===ifs.indexOf(lanIf); markChips(ifs.indexOf(lanIf));
      const n=iosNorm(cmdLines('cmd')[0]||''), m=/^ip helper-address (\S+)$/.exec(n);
      const okC=!!m&&ip2int(m[1])===srv;
      markField('cmd',okC,'ip helper-address '+int2ip(srv));
      return {ok:okI&&okC, verdict: okI&&okC?'Correct.':'ip helper-address '+int2ip(srv)+' on '+lanIf+'.', why: ul([
        'The relay goes on the interface that <b>receives the clients\' broadcasts</b>: '+lanIf+', facing the PCs &mdash; not the one facing the server.',
        mono('ip helper-address '+int2ip(srv))+' makes R1 forward each DHCP broadcast to the server as a unicast.'])};
    },
  };
}});

/* Every address a set of "ip dhcp excluded-address A [B]" lines covers. */
function parseExclusions(lines){
  const set=new Set();
  for(const l of lines){
    const m=/^ip dhcp excluded-address (\S+)(?: (\S+))?$/.exec(iosNorm(l));
    if(!m) return {err:'Expected ip dhcp excluded-address <first> [<last>] ("'+l+'").'};
    const a=ip2int(m[1]), b=m[2]?ip2int(m[2]):a;
    if(a==null||b==null) return {err:'"'+l+'" has an invalid address.'};
    if(b<a) return {err:'In "'+l+'" the last address comes before the first.'};
    if(b-a>65536) return {err:'"'+l+'" excludes far too much.'};
    for(let x=a;x<=b;x++) set.add(x);
  }
  return {set};
}
card({id:'g5-exclude', area:'dhcp', tier:2, kind:'graded', src:'Q5 c', title:'Write the DHCP exclusions', gen(){
  const net=chance(.5)?ip2int('192.168.'+ri(0,254)+'.0'):ip2int('10.'+ri(1,254)+'.'+ri(0,255)+'.0');
  const gw=pick([1,1,254]), s=gw===1?ri(2,6):ri(1,5), e=s+ri(2,8), pr=ri(200,gw===254?250:253);
  const mg=chance(.5)?ri(e+5,180):null;
  const want=new Set([gw]); for(let x=s;x<=e;x++) want.add(x); want.add(pr); if(mg) want.add(mg);
  const H=o=>int2ip(net+o);
  const model=[]; // tidy ranges
  const sorted=[...want].sort((a,b)=>a-b); let i=0;
  while(i<sorted.length){ let j=i; while(j+1<sorted.length&&sorted[j+1]===sorted[j]+1) j++; model.push('ip dhcp excluded-address '+H(sorted[i])+(j>i?' '+H(sorted[j]):'')); i=j+1; }
  return {
    prompt:'R1 hands out addresses in <b>'+cidr(net,24)+'</b>. These are set statically and must never be leased: the default gateway <b>'+H(gw)+'</b>, the servers <b>'+H(s)+'&ndash;'+H(e)+
      '</b>, the printer <b>'+H(pr)+'</b>'+(mg?' and switch S1\'s management address <b>'+H(mg)+'</b>':'')+'. Write the command(s) that exclude exactly those addresses.',
    body: cmdsHtml('ex','Exclusions &mdash; one command per line, Ctrl+Enter submits','e.g. ip dhcp excluded-address 198.51.100.1 198.51.100.9',3),
    grade(){
      const p=parseExclusions(cmdLines('ex'));
      let why=p.err||null;
      if(!why){
        const miss=[...want].filter(o=>!p.set.has(net+o)), extra=[...p.set].filter(x=>!(inNet(x,net,24)&&want.has(x-net)));
        if(miss.length) why='Still leasable: '+miss.slice(0,6).map(H).join(', ')+(miss.length>6?'…':'')+'.';
        else if(extra.length) why='Also excludes '+extra.length+' address'+(extra.length>1?'es':'')+' that should be leased (e.g. '+int2ip(extra[0])+').';
      }
      markCmds('ex',!why,model.join('\n'),why);
      return {ok:!why, verdict: !why?'Correct.':'Not quite.', why: ul([...(why?[why]:[]),'e.g. '+model.map(mono).join('<br>'),
        'One line can take a range (first and last) or a single address; exclusions are global configuration, outside the pool.'])};
    },
  };
}});

card({id:'g5-pool', area:'dhcp', tier:3, kind:'graded', src:'Q5', title:'Build a DHCP pool', gen(){
  const pfx=pick([24,24,25,26,27]), net=netOf((chance(.5)?ip2int('192.168.'+ri(0,254)+'.0'):ip2int('10.'+ri(1,254)+'.'+ri(0,255)+'.0'))+ri(0,255),pfx);
  const size=1<<(32-pfx), gw=chance(.6)?net+1:net+size-2, dns=ip2int(pick(['8.8.8.8','1.1.1.1','208.67.222.222','10.10.'+ri(1,99)+'.10']));
  const name=pick(['LAN-A','SALES','STAFF-POOL','VLAN10','BRANCH']);
  const model=['ip dhcp pool '+name,' network '+int2ip(net)+' '+maskStr(pfx),' default-router '+int2ip(gw),' dns-server '+int2ip(dns)];
  return {
    prompt:'Make R1 the DHCP server for <b>'+cidr(net,pfx)+'</b>: create a pool named <b>'+name+'</b> that leases addresses from that network, with default gateway <b>'+int2ip(gw)+'</b> and DNS server <b>'+int2ip(dns)+'</b>.',
    body: cmdsHtml('pool','Pool &mdash; one command per line, Ctrl+Enter submits','e.g. ip dhcp pool EXAMPLE',5),
    grade(){
      const L=cmdLines('pool').map(iosNorm);
      let why=null, inPoolMode=false, seen={net:false,gw:false,dns:false};
      for(const l of L){
        let m;
        if((m=/^ip dhcp pool (\S+)$/.exec(l))){
          const typed=cmdLines('pool').find(x=>/pool/i.test(x)).split(/\s+/).pop();
          if(typed!==name){ why=typed.toLowerCase()===name.toLowerCase()?'Pool names are case-sensitive: it should be '+name+', not '+typed+'.':'The pool should be named '+name+'.'; break; }
          inPoolMode=true; continue;
        }
        if(!inPoolMode){ why='"'+l+'" is a pool command &mdash; create the pool (ip dhcp pool '+name+') first.'; break; }
        if((m=/^network (\S+) (\S+)$/.exec(l))){
          const a=ip2int(m[1]), mk=m[2][0]==='/'?+m[2].slice(1):(()=>{ const x=ip2int(m[2]); if(x==null) return -1; const b=(~x)>>>0; return (b&(b+1))===0?32-Math.log2(b+1):-1; })();
          if(a!==net||mk!==pfx){ why='The network should be '+int2ip(net)+' '+maskStr(pfx)+' ('+cidr(net,pfx)+').'; break; }
          seen.net=true; continue;
        }
        if((m=/^default-router (\S+)$/.exec(l))){ if(ip2int(m[1])!==gw){ why='The default router should be '+int2ip(gw)+'.'; break; } seen.gw=true; continue; }
        if((m=/^dns-server (.+)$/.exec(l))){ if(m[1].split(/\s+/).map(ip2int).indexOf(dns)<0){ why='The DNS server should be '+int2ip(dns)+'.'; break; } seen.dns=true; continue; }
        if(/^(domain-name|lease) /.test(l)) continue;
        why='"'+l+'" isn\'t needed here.'; break;
      }
      if(!why&&!inPoolMode) why='Start with ip dhcp pool '+name+'.';
      if(!why&&!seen.net) why='The pool has no network statement.';
      if(!why&&!seen.gw) why='The pool has no default-router.';
      if(!why&&!seen.dns) why='The pool has no dns-server.';
      markCmds('pool',!why,model.join('\n'),why);
      return {ok:!why, verdict: !why?'Correct.':'Not quite.', why: ul([...(why?[why]:[]),'e.g.<br>'+model.map(mono).join('<br>'),
        'The '+mono('network')+' line takes a dotted mask ('+maskStr(pfx)+') or a prefix length written /'+pfx+'.'])};
    },
  };
}});

/* ═══ Q6 — Router-on-a-stick ══════════════════════════════════════════════ */
function q6Plan(){ const v=pick([[10,20],[30,40],[15,25],[100,200],[50,60],[11,22]]); return {x:v[0], y:v[1], h1:ri(10,99), h2:ri(10,99)}; }
const Q6_CAUSE={
  access:'Fa0/1 and Fa0/2 were never put in their VLANs',
  trunk:'S1 Gi0/1 is not a trunk',
  shut:'R1 Gi0/0 is still shut down',
  tag:'An R1 subinterface tags the wrong VLAN',
  ip:'An R1 subinterface is in the wrong subnet',
  swap:'H1 and H2\'s ports are in each other\'s VLANs',
};
/* The configuration the practice exam shows, with one fault planted. */
function q6Config(P,fault){
  const z=fault==='tag'?pick([P.y+10,P.y+1,P.y-1].filter(v=>v!==P.x&&v>1)):P.y;
  const r1=['R1(config)# interface gi0/0'];
  if(fault!=='shut') r1.push('R1(config-if)# no shutdown');
  r1.push('R1(config-if)# interface gi0/0.'+P.x,'R1(config-subif)# encapsulation dot1q '+P.x,'R1(config-subif)# ip address 192.168.'+P.x+'.1 255.255.255.0',
    'R1(config-if)# interface gi0/0.'+P.y,'R1(config-subif)# encapsulation dot1q '+z,
    'R1(config-subif)# ip address 192.168.'+(fault==='ip'?P.y+1:P.y)+'.1 255.255.255.0');
  const s1=['S1(config)# interface gi0/1','S1(config-if)# switchport mode '+(fault==='trunk'?'access':'trunk'),
    'S1(config)# interface fa0/1','S1(config-if)# switchport mode access'];
  if(fault!=='access') s1.push('S1(config-if)# switchport access vlan '+(fault==='swap'?P.y:P.x));
  s1.push('S1(config)# interface fa0/2','S1(config-if)# switchport mode access');
  if(fault!=='access') s1.push('S1(config-if)# switchport access vlan '+(fault==='swap'?P.x:P.y));
  return {r1, s1};
}
function q6Topo(P){
  return '<svg class="ex-topo ex-q6fig" viewBox="0 0 260 250" role="img" aria-label="R1 trunked to S1, H1 and H2 below">'+
    '<path class="ln" d="M130 52 V104 M110 134 L70 186 M150 134 L190 186"/>'+
    '<rect class="rt" x="90" y="10" width="80" height="42" rx="10"/><text class="rt-name" x="130" y="36" text-anchor="middle">R1</text>'+
    '<rect class="rt" x="90" y="104" width="80" height="30" rx="6"/><text class="rt-name" x="130" y="124" text-anchor="middle">S1</text>'+
    '<text class="t-sub" x="138" y="68">Gi0/0</text><text class="t-sub" x="138" y="98">Gi0/1</text>'+
    '<text class="t-sub" x="80" y="160" text-anchor="end">Fa0/1</text><text class="t-sub" x="180" y="160">Fa0/2</text>'+
    '<rect class="rt" x="40" y="186" width="60" height="28" rx="6"/><text class="rt-name" x="70" y="205" text-anchor="middle">H1</text>'+
    '<rect class="rt" x="160" y="186" width="60" height="28" rx="6"/><text class="rt-name" x="190" y="205" text-anchor="middle">H2</text>'+
    '<text x="70" y="234" text-anchor="middle">VLAN '+P.x+'</text><text x="190" y="234" text-anchor="middle">VLAN '+P.y+'</text></svg>';
}
function q6Body(P,cfg,hosts){
  return '<div class="ex-q6"><div class="ex-topo-wrap">'+q6Topo(P)+'</div><div>'+cliHtml(cfg.r1.join('\n'))+cliHtml(cfg.s1.join('\n'))+'</div></div>'+
    (hosts?'<div class="ex-scroll"><table class="rt-table ex-table"><thead><tr><th>Host</th><th>VLAN</th><th>Address</th><th>Gateway</th></tr></thead><tbody>'+
      '<tr><td>H1</td><td>'+P.x+'</td><td>192.168.'+P.x+'.'+P.h1+'/24</td><td>192.168.'+P.x+'.1</td></tr>'+
      '<tr><td>H2</td><td>'+P.y+'</td><td>192.168.'+P.y+'.'+P.h2+'/24</td><td>192.168.'+P.y+'.1</td></tr></tbody></table></div>':'');
}

card({id:'q6-roas', area:'vlan', tier:1, kind:'flash', src:'Q6', title:'Router-on-a-stick: what\'s wrong?', gen(){
  const P=chance(.6)?{x:10,y:20,h1:10,h2:10}:q6Plan();
  return {
    prompt:'In the figure, host H1 cannot communicate with host H2. Clearly identify, describe and explain the cause of the problem. What modifications do you need to make to fix it?',
    body: q6Body(P,q6Config(P,'access'),false),
    points: [
      'S1 makes Fa0/1 and Fa0/2 access ports but never assigns them a VLAN, so both stay in the [[default VLAN 1|VLAN 1|default VLAN|vlan1|native VLAN]].',
      'Their frames cross the trunk untagged (VLAN 1), but R1 only has subinterfaces for VLANs '+P.x+' and '+P.y+', so neither host can reach its [[default gateway|gateway|subinterface|subinterfaces]] &mdash; and H1 and H2 are in different subnets, so they need the router.',
      'Fix on S1: put Fa0/1 in [[VLAN '+P.x+'|vlan'+P.x+']] and Fa0/2 in [[VLAN '+P.y+'|vlan'+P.y+']] with [[switchport access vlan|access vlan]] under each interface.',
      'e.g. '+mono('interface fa0/1')+' '+mono('switchport access vlan '+P.x)+', then '+mono('interface fa0/2')+' '+mono('switchport access vlan '+P.y)+' (and '+mono('vlan '+P.x)+' / '+mono('vlan '+P.y)+' if the VLANs don\'t exist yet).',
    ],
  };
}});

/* Commands that fix each fault, as [interface, command] pairs (interfaces in
   acIfNorm form). */
function q6Fix(P,fault){
  const sub=y=>'g0/0.'+y;
  return {
    access:[['f0/1','switchport access vlan '+P.x],['f0/2','switchport access vlan '+P.y]],
    swap:[['f0/1','switchport access vlan '+P.x],['f0/2','switchport access vlan '+P.y]],
    trunk:[['g0/1','switchport mode trunk']],
    shut:[['g0/0','no shutdown']],
    tag:[[sub(P.y),'encapsulation dot1q '+P.y]],
    ip:[[sub(P.y),'ip address 192.168.'+P.y+'.1 255.255.255.0']],
  }[fault];
}
function q6ModelText(P,fault){
  const name={'f0/1':'fa0/1','f0/2':'fa0/2','g0/1':'gi0/1','g0/0':'gi0/0'};
  return q6Fix(P,fault).map(p=>'interface '+(name[p[0]]||p[0].replace(/^g/,'gi'))+'\n '+p[1]).join('\n');
}
function q6FaultCard(id,tier,title,faults){
  card({id, area:'vlan', tier, kind:'graded', src:'Q6', title, gen(){
    const P=q6Plan(), fault=pick(faults), causes=Object.keys(Q6_CAUSE), ans=causes.indexOf(fault);
    return {
      prompt:'Host H1 cannot communicate with host H2. Pick the cause, then type the commands that fix it (interface lines included).',
      body: q6Body(P,q6Config(P,fault),true)+chipsHtml(causes.map(k=>Q6_CAUSE[k]))+
        cmdsHtml('fix','Fix &mdash; one command per line, Ctrl+Enter submits','e.g. interface fa0/9',4),
      grade(){
        const okC=Q.choice===ans; markChips(ans);
        const sc=iosScript(cmdLines('fix')), need=q6Fix(P,fault), miss=need.filter(n=>!hasCmd(sc,n[0],n[1]));
        const okF=!miss.length;
        markCmds('fix',okF,q6ModelText(P,fault),okF?null:'Missing: '+miss.map(n=>n[1]+' (under '+n[0]+')').join('; '));
        const expl={
          access:'Fa0/1 and Fa0/2 are access ports with no VLAN, so both sit in VLAN 1; R1 has no subinterface for VLAN 1, so neither host reaches its gateway.',
          swap:'H1\'s port is in VLAN '+P.y+' and H2\'s in VLAN '+P.x+', but each host is addressed for the other VLAN, so neither reaches its own gateway.',
          trunk:'S1 Gi0/1 is an access port, so it carries one VLAN untagged and drops the tagged frames R1\'s subinterfaces send.',
          shut:'Router interfaces start shut down, and nothing enables Gi0/0 &mdash; its subinterfaces stay down with it.',
          tag:'Gi0/0.'+P.y+' tags frames with the wrong VLAN, so it never exchanges frames with VLAN '+P.y+'.',
          ip:'Gi0/0.'+P.y+' has an address in 192.168.'+(P.y+1)+'.0/24, so H2\'s gateway 192.168.'+P.y+'.1 doesn\'t exist.',
        }[fault];
        return {ok:okC&&okF, verdict: okC&&okF?'Correct.':Q6_CAUSE[fault]+'.', why: ul([expl,'Fix:<br>'+q6ModelText(P,fault).split('\n').map(l=>mono(l.trim())).join('<br>')])};
      },
    };
  }});
}
q6FaultCard('g6-fault',2,'Router-on-a-stick fault',['access','trunk','shut']);
q6FaultCard('g6-fault-hard',3,'Router-on-a-stick: subtler faults',['tag','ip','swap']);

card({id:'g6-subif', area:'vlan', tier:2, kind:'graded', src:'Q6', title:'Add a VLAN to the router', gen(){
  const v=pick([30,40,50,60,70,99,110,150]), native=chance(.3), gwo=pick([1,1,254]);
  const model=['interface gi0/0.'+v,' encapsulation dot1q '+v+(native?' native':''),' ip address 192.168.'+v+'.'+gwo+' 255.255.255.0'];
  return {
    prompt:'R1 Gi0/0 is trunked to S1 (router-on-a-stick). Add routing for <b>VLAN '+v+'</b>, network 192.168.'+v+'.0/24, with R1 as the gateway <b>192.168.'+v+'.'+gwo+'</b>'+
      (native?'. VLAN '+v+' is the trunk\'s <b>native VLAN</b>.':'.')+' Write the commands.',
    body: cmdsHtml('sub','Commands &mdash; one per line, Ctrl+Enter submits','e.g. interface gi0/0.5',3),
    grade(){
      const sc=iosScript(cmdLines('sub'));
      const subs=[...new Set(sc.map(o=>o.ifc).filter(f=>/^g0\/0\.\d+$/.test(f)))];
      let why=null;
      if(!subs.length) why='Create a subinterface of Gi0/0 (e.g. interface gi0/0.'+v+').';
      else {
        const f=subs[0];
        if(!hasCmd(sc,f,'encapsulation dot1q '+v+(native?' native':''))) why=native?'The subinterface needs encapsulation dot1q '+v+' native.':'The subinterface needs encapsulation dot1q '+v+'.';
        else if(!hasCmd(sc,f,'ip address 192.168.'+v+'.'+gwo+' 255.255.255.0')) why='The subinterface needs ip address 192.168.'+v+'.'+gwo+' 255.255.255.0.';
      }
      markCmds('sub',!why,model.join('\n'),why);
      return {ok:!why, verdict: !why?'Correct.':'Not quite.', why: ul([...(why?[why]:[]),'e.g.<br>'+model.map(mono).join('<br>'),
        'The subinterface number doesn\'t have to match the VLAN, but matching it is the convention; the '+mono('encapsulation dot1q')+' line is what ties it to VLAN '+v+
        (native?', and <b>native</b> makes it send and receive that VLAN untagged':'')+'.'])};
    },
  };
}});

/* ═══ Dictionary ══════════════════════════════════════════════════════════
   Terms used across the cards, shown at the bottom of the page in the OSI
   trainer's reference style (.ref-search/.ref-grid/.ref-card/.rbadge from
   styles.css). After a card is answered, terms in its model answer and
   explanation become links (dictLink) that scroll to their entry; entries
   link to each other the same way. Each entry: [id, name, area, aliases,
   badges, description]. An alias that is all capitals (OSPF, AD, DR) only
   matches in capitals; cs:true makes every alias of an entry match case
   exactly (DORA's Discover/Offer/Request, which are ordinary words in
   lower case). Aliases must be specific: a generic word ("cost", "pool",
   "gateway") would link in the wrong place. */
const DICT_AREAS=[...AREAS,{id:'general', name:'General'}];
const DICT=[
  ['static','Static route','routing',['static routes','static routing'],['AD 1'],"A route typed in by an administrator: ip route <network> <mask> <next hop | exit interface>. It never changes by itself and sends no updates. Good for small and stub networks, and as a backup (floating static route)."],
  ['dynamic','Dynamic routing protocol','routing',['dynamic routing','routing protocol','routing protocols','dynamic routing protocols'],[],"Routers share routes automatically and recalculate when the topology changes (OSPF, EIGRP, RIP). Scales and adapts to failures, at the cost of CPU, memory and bandwidth."],
  ['ad','Administrative distance','routing',['AD','administrative distances'],['0–255','lower wins'],"How trustworthy a route's source is. When different sources offer the same prefix, the lowest AD is installed. Connected 0, static 1, eBGP 20, EIGRP 90, OSPF 110, IS-IS 115, RIP 120, external EIGRP 170, iBGP 200; 255 means never install."],
  ['metric','Metric','routing',['metrics'],['lower wins'],"How a routing protocol ranks its own routes. Each protocol measures differently (OSPF cost, RIP hop count, EIGRP bandwidth and delay), so metrics are never compared across protocols."],
  ['floating','Floating static route','routing',['floating static routes','floating static'],[],"A backup static route with an administrative distance higher than the primary route's, so it stays out of the routing table until the primary disappears: ip route 10.1.1.0 255.255.255.0 10.2.2.2 130."],
  ['default','Default route','routing',['default routes','0.0.0.0/0'],['S*'],"The route to 0.0.0.0/0, which matches every destination and is used only when nothing more specific does: ip route 0.0.0.0 0.0.0.0 <next hop>."],
  ['glr','Gateway of last resort','routing',[],[],"The next hop of the default route, printed at the top of show ip route."],
  ['lpm','Longest prefix match','routing',['longest match','longest prefix','most specific'],[],"How a router picks the route for a packet: of every route that contains the destination, the one with the longest prefix wins — before administrative distance or metric, because routes of different lengths are different routes."],
  ['ecmp','Equal-cost load balancing','routing',['load balancing','load balanced','load-balance','ECMP','equal-cost multipath'],[],"Two routes to the same prefix with the same administrative distance and the same metric: both are installed and traffic is shared between them."],
  ['nexthop','Next hop','routing',['next-hop','next hops'],[],"The address of the neighbouring router a packet is handed to on its way to the destination."],
  ['stub','Stub network','routing',['stub networks'],[],"A network with only one way in and out; a default static route is usually all it needs."],
  ['rtable','Routing table','routing',['routing tables','show ip route'],[],"The routes a router will forward with, one best route per prefix. Codes: C connected, L local, S static, S* static default, R RIP, O OSPF, O IA OSPF inter-area, D EIGRP, D EX external EIGRP, B BGP. [AD/metric] follows each learned route, e.g. [110/65]."],
  ['connected','Connected route','routing',['connected routes','directly connected','connected network'],['C','AD 0'],"The network on one of the router's own up/up interfaces, added automatically. AD 0, so it always wins."],
  ['local','Local route','routing',['local routes','local route'],['L','/32'],"A /32 route for the router's own interface address, added next to each connected network. A packet to that address is for the router itself."],
  ['summary','Summary route','routing',['summary routes','supernet','supernets','summarise','summarize','summarisation','summarization','route summarisation'],[],"One route with a shorter prefix covering several contiguous networks — e.g. 210.84.0.0/14 covers 210.84.0.0 to 210.87.255.255. Smaller routing tables, fewer updates."],
  ['rip','RIP','routing',['Routing Information Protocol','RIPv1','RIPv2'],['AD 120','hop count'],"A distance-vector routing protocol whose metric is hop count (15 at most; 16 means unreachable). Blind to bandwidth, slow to converge."],
  ['eigrp','EIGRP','routing',['Enhanced Interior Gateway Routing Protocol','External EIGRP'],['AD 90','external 170'],"Cisco's advanced distance-vector protocol, with a metric from bandwidth and delay. Internal routes AD 90; external routes (D EX) AD 170."],
  ['bgp','BGP','routing',['eBGP','iBGP','Border Gateway Protocol'],['eBGP 20','iBGP 200'],"The routing protocol between organisations on the Internet. Routes from another AS (eBGP) have AD 20; from your own AS (iBGP) AD 200."],
  ['isis','IS-IS','routing',['ISIS'],['AD 115'],"A link-state interior routing protocol, like OSPF; mostly used by service providers."],
  ['ospf','OSPF','ospf',['Open Shortest Path First','OSPFv2','OSPFv3'],['AD 110','link-state'],"A link-state routing protocol: every router in an area holds the same map (LSDB) and runs SPF to find lowest-cost paths. Metric is cost. Areas let it scale. OSPFv2 is IPv4, OSPFv3 IPv6."],
  ['rid','Router ID','ospf',['router-id','RID','router IDs'],[],"A 32-bit value written like an IPv4 address that names a router in OSPF. Chosen when the process starts: the router-id command, else the highest loopback address, else the highest active physical interface address. A change needs clear ip ospf process or a reload."],
  ['cost','OSPF cost','ospf',['interface cost','interface costs','ip ospf cost'],[],"OSPF's metric. Interface cost = reference bandwidth ÷ interface bandwidth, rounded down, minimum 1; a route's cost is the sum of the outgoing interface costs along the path. Set directly with ip ospf cost."],
  ['refbw','Reference bandwidth','ospf',['auto-cost reference-bandwidth','auto-cost'],['100 Mbps default'],"What OSPF divides by an interface's bandwidth to get its cost. At the default 100 Mbps, every link of 100 Mbps or faster costs 1. Raise it with auto-cost reference-bandwidth <Mbps>, the same on every router."],
  ['bw','Interface bandwidth','ospf',['bandwidth command'],['kbps'],"The bandwidth value a router uses in metric calculations — not necessarily the real speed. Serial interfaces default to 1544 kbps. Set with bandwidth <kbps> under the interface."],
  ['spf','SPF','ospf',['Dijkstra','shortest path first'],[],"Dijkstra's shortest-path-first algorithm: each OSPF router runs it over its LSDB to find the lowest-cost path to every network, again whenever its area's topology changes."],
  ['lsa','LSA','ospf',['LSAs','link-state advertisement','link-state advertisements'],[],"A piece of OSPF topology information. Types 1 (router) and 2 (network) stay in their area; type 3 (summary) carries routes between areas through ABRs; type 5 carries external routes."],
  ['lsdb','LSDB','ospf',['link-state database','link state database','topology table'],[],"The LSAs a router holds — its map of the area. Every router in an area has an identical LSDB."],
  ['area','OSPF area','ospf',['area 0','backbone','backbone area'],[],"A group of routers sharing one LSDB. Area 0 is the backbone and every other area connects to it. Both ends of a link must be in the same area."],
  ['abr','ABR','ospf',['ABRs','area border router','area border routers'],[],"A router with interfaces in area 0 and another area. It keeps an LSDB per area and passes summarised routes (type 3 LSAs) between them."],
  ['multiarea','Multi-area OSPF','ospf',['multi-area','single-area','single area','multiple areas'],[],"OSPF split into areas around area 0, so detailed LSAs and SPF runs stay inside each area: smaller LSDBs and routing tables, less flooding, faster convergence."],
  ['hello','Hello interval','ospf',['hello timer','hello timers','hellos','hello packets','hello-interval'],['10 s default'],"How often OSPF sends hellos to find and keep neighbours: 10 s on Ethernet and point-to-point links, 30 s on NBMA. Must match on both neighbours: ip ospf hello-interval."],
  ['dead','Dead interval','ospf',['dead timer','dead timers','dead-interval'],['4 × hello'],"How long without a hello before a neighbour is declared down: 4 × hello by default (40 s). Must match on both neighbours: ip ospf dead-interval."],
  ['adj','Adjacency','ospf',['adjacencies','neighbour','neighbours','neighbor','neighbors'],['FULL'],"A working OSPF relationship between two routers, formed when hello and dead timers, area, subnet and mask, and authentication all match and neither interface is passive. FULL is the final state."],
  ['drbdr','DR / BDR','ospf',['DR/BDR election','DR','BDR','designated router','backup designated router'],[],"On a multi-access network OSPF elects a designated router and a backup to cut down adjacencies: highest priority wins, then highest router ID; priority 0 never becomes DR."],
  ['passive','Passive interface','ospf',['passive-interface'],[],"An interface OSPF still advertises but sends no hellos on, so no adjacency forms — for LANs with no other routers: passive-interface g0/0 under router ospf."],
  ['convergence','Convergence','ospf',['converge','converges','reconverge','reconverges','converged'],[],"The point where every router has a consistent view of the network again after a change. Faster convergence means less time with lost or looping traffic."],
  ['loopback','Loopback interface','ospf',['loopback','loopbacks','Lo0'],[],"A virtual interface that is always up unless shut down. A stable OSPF router ID, and a handy test address (the ISP's Lo0 in the exam)."],
  ['flapping','Flapping','ospf',['flap','flaps'],[],"A link or neighbour going up and down repeatedly; every change triggers updates and recalculation."],
  ['acl','ACL','acl',['ACLs','access control list','access list','access lists'],[],"An ordered list of permit and deny statements (ACEs). Packets are checked top to bottom, the first match decides, and anything unmatched hits the implicit deny. Applied to an interface in or out (ip access-group) or to vty lines (access-class)."],
  ['ace','ACE','acl',['ACEs','access control entry'],[],"One line of an ACL: a permit or deny and what it matches."],
  ['stdacl','Standard ACL','acl',['standard ACLs','standard access list'],['1–99','1300–1999'],"Matches only the source IPv4 address, so it goes as close to the destination as possible — near the source it would block that host from everything."],
  ['extacl','Extended ACL','acl',['extended ACLs','extended access list'],['100–199','2000–2699'],"Matches protocol, source, destination and port, so it goes as close to the source as possible and drops unwanted traffic before it crosses the network."],
  ['wildcard','Wildcard mask','acl',['wildcard','wildcards','wildcard masks'],[],"Which address bits must match: 0 = must match, 1 = ignore. Usually the inverse of the subnet mask (/24 → 0.0.0.255). First address = address AND NOT wildcard; last = address OR wildcard."],
  ['implicit','Implicit deny','acl',['implicit deny any','deny any'],[],"The invisible last line of every ACL: anything not permitted earlier is denied. An ACL of only deny lines blocks everything."],
  ['inout','Inbound / outbound','acl',['inbound','outbound'],['in','out'],"Which way an ACL filters on an interface: in = packets arriving on it, before routing; out = packets leaving through it, after routing. ip access-group 10 out."],
  ['established','established','acl',[],['TCP'],"On an extended ACE, matches only TCP segments with ACK or RST set — replies in sessions already started — so return traffic for connections inside hosts initiated is let in, and new connections from outside are not."],
  ['hostany','host / any','acl',[],[],"ACE shorthands: host 10.1.1.5 is 10.1.1.5 0.0.0.0 (one address); any is 0.0.0.0 255.255.255.255 (every address)."],
  ['nat','NAT','nat',['Network Address Translation'],[],"Rewrites private inside addresses to public ones as packets leave, and back again on the replies, so many private hosts can share few public addresses. ip nat inside / ip nat outside mark the interfaces."],
  ['il','Inside local','nat',['inside local address','inside locals'],[],"The inside host's own (usually private) address, as seen inside — e.g. 192.168.1.20."],
  ['ig','Inside global','nat',['inside global address','inside globals'],[],"The public address an inside host appears as on the outside, after translation."],
  ['ol','Outside local','nat',[],[],"An outside host's address as seen from the inside — the same as its outside global unless the outside is translated too."],
  ['og','Outside global','nat',[],[],"An outside host's real address on the Internet."],
  ['staticnat','Static NAT','nat',['static translation','static mapping','static mappings'],['one-to-one'],"A permanent mapping of one inside local to one inside global address, so the host — typically a server — is reachable from outside: ip nat inside source static 192.168.1.20 209.165.200.229."],
  ['dynnat','Dynamic NAT','nat',['dynamic translation','dynamic binding','dynamic bindings'],[],"Inside hosts are given a public address from a pool when they send traffic — one host per address while the translation lasts: ip nat inside source list 1 pool NAME."],
  ['pat','PAT','nat',['overload','NAT overload','Port Address Translation','dynamic NAT with overload'],['many-to-one'],"Many inside hosts share one public address (an interface's or a pool's), told apart by port number; a clashing source port is changed: ip nat inside source list 1 interface s0/0/1 overload."],
  ['natpool','NAT pool','nat',['ip nat pool'],[],"The public addresses dynamic NAT hands out: ip nat pool NAME <first> <last> netmask <mask>."],
  ['port','Port number','general',['port numbers','source port'],['TCP/UDP'],"16-bit numbers identifying each end of a TCP or UDP session (80 web, 22 SSH, 67/68 DHCP). PAT uses the source port to tell inside hosts apart."],
  ['private','Private address','general',['private addresses','RFC 1918'],[],"10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16 — not routed on the Internet, so they need NAT to get out."],
  ['dhcp','DHCPv4','dhcp',['DHCP','DHCP server','Dynamic Host Configuration Protocol'],['UDP 67/68'],"Leases IPv4 settings to clients automatically: address, mask, default gateway and DNS server. Servers listen on UDP 67, clients on UDP 68."],
  ['dora','DORA','dhcp',['DHCPDISCOVER','DHCPOFFER','DHCPREQUEST','DHCPACK','Discover','Offer','Request','Acknowledgement'],[],"The DHCPv4 exchange: Discover (client broadcast), Offer (server), Request (client, still a broadcast), Acknowledgement (server)."],
  ['lease','Lease','dhcp',['leases','lease time'],[],"How long a client may use a DHCP address; it renews, normally at half the lease time, to keep it."],
  ['relay','DHCP relay','dhcp',['relay agent','ip helper-address','helper address'],[],"A router that forwards clients' DHCP broadcasts to a server on another network as unicasts — ip helper-address <server> on the interface facing the clients."],
  ['exclude','Excluded addresses','dhcp',['excluded address','excluded-address','ip dhcp excluded-address','exclusions'],[],"Addresses a DHCP server must never lease because devices use them statically (router, servers, printers): ip dhcp excluded-address <first> [<last>], in global configuration."],
  ['dpool','DHCP pool','dhcp',['ip dhcp pool','address pool'],[],"What a DHCP server leases from: ip dhcp pool NAME, then network, default-router and dns-server. Pool names are case-sensitive."],
  ['broadcast','Broadcast','general',['broadcasts','broadcast domain'],[],"Sent to every host on the local network. Routers don't forward broadcasts — which is why DHCP needs a relay across networks, and why each VLAN is its own broadcast domain."],
  ['unicast','Unicast','general',['unicasts'],[],"Traffic sent to one specific host."],
  ['gw','Default gateway','general',['default gateways'],[],"The router address a host sends traffic to when the destination is on another network. It has to be in the host's own subnet."],
  ['vlan','VLAN','vlan',['VLANs','virtual LAN'],[],"A separate broadcast domain on a switch, assigned per port. Hosts in different VLANs need a router — inter-VLAN routing — to talk."],
  ['accessport','Access port','vlan',['access ports','switchport access vlan','switchport mode access'],[],"A switch port in one VLAN, carrying untagged frames to an end device: switchport mode access, switchport access vlan 10. With no VLAN assigned it stays in VLAN 1."],
  ['trunk','Trunk','vlan',['trunks','trunk link','trunk port','switchport mode trunk','trunked'],[],"A link carrying many VLANs, each frame tagged with its VLAN ID (802.1Q) — between switches, or to a router-on-a-stick: switchport mode trunk."],
  ['dot1q','802.1Q','vlan',['dot1Q','encapsulation dot1q','VLAN tag'],[],"The trunking standard: a 4-byte tag with the VLAN ID is added to every frame on a trunk, except the native VLAN's. On a router subinterface: encapsulation dot1q 20."],
  ['native','Native VLAN','vlan',[],[],"The VLAN whose frames cross a trunk untagged — VLAN 1 unless changed. It must match at both ends; on a router subinterface: encapsulation dot1q 99 native."],
  ['vlan1','Default VLAN','vlan',['VLAN 1','default VLAN 1'],[],"VLAN 1: every switch port starts in it, and it is the native VLAN unless changed."],
  ['roas','Router-on-a-stick','vlan',['router on a stick','inter-VLAN routing'],[],"Inter-VLAN routing over one router interface trunked to the switch, with a subinterface per VLAN acting as that VLAN's default gateway."],
  ['subif','Subinterface','vlan',['subinterfaces','sub-interface'],[],"A logical interface on a physical one, such as G0/0.20. On a router-on-a-stick each carries one VLAN (encapsulation dot1q) and holds that VLAN's gateway address."],
  ['shutdown','shutdown / no shutdown','general',['no shutdown','shut down'],[],"Disables / enables an interface. Router interfaces start shut down and need no shutdown; subinterfaces go down with their parent."],
].map(r=>({id:r[0], name:r[1], area:r[2], aka:r[3], badges:r[4], desc:r[5], cs:r[0]==='dora'}));

/* One regex over every name and alias, longest first; dictPick decides which
   entry a match belongs to (and enforces capitals-only aliases). */
let DICT_RE=null, DICT_FORMS=null;
function dictIndex(){
  DICT_FORMS={};
  const forms=[];
  DICT.forEach(d=>[d.name].concat(d.aka).forEach(f=>{
    if(f===d.name&&/ \/ /.test(f)) return;   // "DR / BDR"-style names are reached through their aliases
    forms.push(f); (DICT_FORMS[f.toLowerCase()]=DICT_FORMS[f.toLowerCase()]||[]).push({f,d});
  }));
  forms.sort((a,b)=>b.length-a.length);
  DICT_RE=new RegExp('(?<![\\w-])('+forms.map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?![\\w-])','gi');
}
function dictPick(text){
  const c=(DICT_FORMS[text.toLowerCase()]||[]).find(x=>(x.d.cs||!/[a-z]/.test(x.f))?x.f===text:true);
  return c?c.d:null;
}
/* Turn the first mention of each term inside root into a link. Code,
   commands and existing links are left alone. */
function dictLink(root,selfId){
  if(!root) return;
  if(!DICT_RE) dictIndex();
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>
    n.parentElement.closest('.mono-inl,code,.ex-term,.ex-cli,.qlbl,button')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
  const done=new Set(selfId?[selfId]:[]);
  nodes.forEach(node=>{
    const t=node.nodeValue; let m, last=0, frag=null;
    DICT_RE.lastIndex=0;
    while((m=DICT_RE.exec(t))){
      const d=dictPick(m[0]); if(!d||done.has(d.id)) continue;
      done.add(d.id); frag=frag||document.createDocumentFragment();
      frag.appendChild(document.createTextNode(t.slice(last,m.index)));
      /* an inline span with button semantics: a real <button> is inline-block
         and lets a line break fall between "(" and the term */
      const a=document.createElement('span'); a.className='ex-term'; a.setAttribute('role','button'); a.tabIndex=0; a.dataset.t=d.id; a.textContent=m[0];
      a.title='Look up “'+d.name+'” in the dictionary';
      frag.appendChild(a); last=m.index+m[0].length;
    }
    if(frag){ frag.appendChild(document.createTextNode(t.slice(last))); node.parentNode.replaceChild(frag,node); }
  });
}
function dictRender(){
  if(!DICT_RE) dictIndex();
  const body=$('dict-body');
  body.innerHTML=DICT_AREAS.map(a=>{
    const es=DICT.filter(d=>d.area===a.id).sort((x,y)=>x.name.localeCompare(y.name));
    if(!es.length) return '';
    return '<div class="ref-section-hdr">'+a.name+'</div><div class="ref-grid">'+es.map(d=>
      '<div class="ref-card" id="dict-'+d.id+'" data-search="'+esc([d.name].concat(d.aka,d.badges,[d.desc]).join(' ').toLowerCase())+'">'+
        '<div class="ref-card-top"><div class="ref-card-name">'+esc(d.name)+'</div><div class="ref-badges">'+
          d.badges.map(b=>'<span class="rbadge rb-port">'+esc(b)+'</span>').join('')+'</div></div>'+
        '<div class="ref-card-desc">'+esc(d.desc)+'</div></div>').join('')+'</div>';
  }).join('')+'<div class="ref-empty" id="dict-empty" style="display:none">No terms found</div>';
  body.querySelectorAll('.ref-card').forEach(c=>dictLink(c.querySelector('.ref-card-desc'),c.id.slice(5)));
}
function dictFilter(q){
  const term=q.toLowerCase().trim(); let shown=0;
  $('dict-body').querySelectorAll('.ref-card').forEach(c=>{ const ok=!term||c.dataset.search.indexOf(term)>=0; c.classList.toggle('hidden',!ok); if(ok) shown++; });
  $('dict-body').querySelectorAll('.ref-grid').forEach(g=>{
    const any=[...g.children].some(c=>!c.classList.contains('hidden'));
    g.style.display=any?'':'none'; g.previousElementSibling.style.display=any?'':'none';
  });
  $('dict-empty').style.display=shown?'none':'block';
}
const SMOOTH=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
function dictJump(id){
  const c=$('dict-'+id); if(!c) return;
  if(c.classList.contains('hidden')){ $('dict-q').value=''; dictFilter(''); }
  c.scrollIntoView({behavior:SMOOTH(), block:'center'});
  c.classList.remove('ex-flash'); void c.offsetWidth; c.classList.add('ex-flash');
  show('dict-back',true);
}
function dictBack(){
  document.querySelector('.qcard').scrollIntoView({behavior:SMOOTH(), block:'start'});
  show('dict-back',false);
  const n=$('nxtbtn'); if(n.style.display!=='none') n.focus({preventScroll:true});
}
document.addEventListener('click',e=>{ const t=e.target.closest('.ex-term'); if(t){ e.preventDefault(); dictJump(t.dataset.t); } });
/* Enter / Space on a focused term looks it up. Capture phase, so it runs
   before answer-keys.js's Enter-to-continue (which would otherwise rate the
   card) and the page's own key handler. */
document.addEventListener('keydown',e=>{
  const t=e.target.closest&&e.target.closest('.ex-term');
  if(t&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); e.stopPropagation(); dictJump(t.dataset.t); }
},true);

/* ═══ Scheduler and persistence ═══════════════════════════════════════════ */
const KEY='ne-exam-v1', COMFORT=20;
function freshState(){ return {step:0, diff:1, off:[], cards:{}, answered:0, correct:0, lastNew:null}; }
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY));
    if(s&&typeof s==='object'&&s.cards){
      /* Progress saved before the area checkboxes kept one area; carry it over
         as "every other area unticked". */
      if(s.area!=null&&!Array.isArray(s.off)) s.off=s.area==='all'?[]:AREAS.map(a=>a.id).filter(id=>id!==s.area);
      delete s.area;
      return Object.assign(freshState(),s);
    }
  }catch(e){}
  return freshState();
}
function saveState(){ try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(e){} }
const S=loadState();

/* How many cards until a card returns, for each rating. The first two
   Good steps are fixed (5, then 10); after that the gap grows by the card's
   ease. The three are forced into order — Hard < Good < Easy — because a
   card that was rated Easy before carries a long interval, and Hard's ×1.2
   of it would otherwise outrun Good's fixed second step. */
function nextIvls(c){
  const reps=c?c.reps:0, ivl=c?c.ivl:0, ease=c?c.ease:2.5;
  const hard=Math.max(3,Math.round(ivl*1.2));
  let good=reps===0?5:reps===1?10:Math.round(ivl*ease);
  good=Math.max(good,hard+1,ivl+1);
  let easy=reps===0?12:Math.round(Math.max(ivl,5)*ease*1.3);
  easy=Math.max(easy,good+2);
  return {again:2, hard, good, easy};
}
function nextIvl(c,r){ return nextIvls(c)[r]; }
function applyRating(id,r){
  const c=S.cards[id]||(S.cards[id]={reps:0, ivl:0, ease:2.5, lapses:0, seen:0});
  const ivl=Math.min(400,nextIvl(c,r));
  if(r==='again'){ c.reps=0; c.lapses++; c.ease=Math.max(1.3,c.ease-0.2); }
  else { c.reps++; if(r==='hard') c.ease=Math.max(1.3,c.ease-0.15); if(r==='easy') c.ease=Math.min(3.5,c.ease+0.15); }
  c.ivl=ivl; c.seen++; c.last=r;
  S.step++; c.due=S.step+ivl;
}
function cardStatus(id){ const c=S.cards[id]; if(!c) return 'new'; return c.last!=='again'&&c.ivl>=COMFORT?'comf':'learn'; }
/* Unticked areas are stored, not ticked ones, so an area added later (the
   second pass) starts ticked. */
function inTier(c){ return c.tier<=S.diff; }
function inPool(c){ return inTier(c)&&S.off.indexOf(c.area)<0; }
function pool(){ return CARDS.filter(inPool); }

/* Most overdue first; then something new; then whatever is due soonest
   (studying ahead). Never the same card twice running unless it's alone.

   New cards are mixed in among the reviews, as Anki does: while any remain,
   at least every NEW_EVERY-th card is a new one even if reviews are due.
   Without that, a learner who keeps answering wrong never gets past the
   first three cards — each Again card is due again two cards later, so
   there is always a review waiting. */
const NEW_EVERY=3;
let lastId=null;
function pickNext(){
  let p=pool(); if(!p.length) return null;
  if(p.length>1) p=p.filter(c=>c.id!==lastId);
  const rec=c=>S.cards[c.id];
  const due=p.filter(c=>rec(c)&&rec(c).due<=S.step);
  const fresh=p.filter(c=>!rec(c));
  const newTurn=S.lastNew==null||S.step-S.lastNew>=NEW_EVERY;
  if(fresh.length&&(!due.length||newTurn)) return pick(fresh);
  if(due.length){ const m=Math.min(...due.map(c=>rec(c).due)); return pick(due.filter(c=>rec(c).due===m)); }
  const m=Math.min(...p.map(c=>rec(c).due)); return pick(p.filter(c=>rec(c).due===m));
}

/* ═══ Round flow ══════════════════════════════════════════════════════════ */
let cur=null, Q=null, phase='answer', forced=null;
const $=id=>document.getElementById(id);

function banner(type,html){ const fb=$('fb'); fb.className='fbanner '+type; fb.innerHTML=html; fb.style.display='block'; }
function hideBanner(){ $('fb').style.display='none'; }
function show(id,on){ $(id).style.display=on?'':'none'; }

function loadQ(){
  cur=pickNext(); phase='answer'; forced=null; hideBanner();
  show('self-row',false); show('rate-hard',false); show('rate-easy',false); show('rate-lbl',false);
  show('chkbtn',true); show('skipbtn',true);
  $('nxtbtn').style.display='none';
  if(!cur){
    Q=null; $('q-tag').textContent='No cards'; $('q-pill').textContent=''; $('q-pill').className='ex-pill';
    $('q-prompt').innerHTML='There are no cards for this area at this difficulty yet.'; $('qbody').innerHTML='';
    show('chkbtn',false); show('skipbtn',false); renderSide(); return;
  }
  lastId=cur.id;
  if(!S.cards[cur.id]) S.lastNew=S.step;
  Q=cur.gen(); Q.sel=new Set(); Q.choice=null; Q.order=[]; Q.ifSel=null;
  const area=AREAS.find(a=>a.id===cur.area);
  $('q-tag').textContent=cur.src+' · '+area.name+' · '+(cur.kind==='flash'?'Flashcard':'Auto-marked')+' · '+TIER_NAME[cur.tier];
  const st=cardStatus(cur.id);
  $('q-pill').textContent={new:'New',learn:'Learning',comf:'Comfortable'}[st];
  $('q-pill').className='ex-pill ex-'+st;
  $('q-prompt').innerHTML=Q.prompt;
  if(cur.kind==='flash'){
    $('qbody').innerHTML=(Q.body||'')+
      '<div class="afield ex-flash-f" id="f-flash"><label>Your answer</label>'+
      '<textarea id="in-flash" class="ex-flash" rows="5" spellcheck="true" placeholder="In your own words &mdash; Enter submits, Shift+Enter for a new line"></textarea></div>'+
      '<div id="flash-cmp"></div>';
    $('chkbtn').disabled=true;
    $('in-flash').addEventListener('input',()=>{ $('chkbtn').disabled=!$('in-flash').value.trim(); });
  } else {
    $('qbody').innerHTML=Q.body+'<div class="expl-box ex-why" id="q-why"></div>';
    $('chkbtn').disabled=false;
  }
  Q.hasBoxes=!!$('qbody').querySelector('input, textarea');
  renderSide();
}

function checkAll(){
  if(phase!=='answer'||!Q) return;
  if(cur.kind==='flash'){
    const ta=$('in-flash'), text=ta.value.trim();
    if(!text){ banner('warn','Type your answer first &mdash; the model answer only appears once you\'ve put it in your own words.'); ta.focus(); return; }
    const model=kwModel(Q.points), kw=kwCheck(text,model.keys);
    const n=kw.found.filter(Boolean).length, all=model.keys.length;
    const cov=n===all?'all':n?'some':'none';
    const missing=model.keys.filter((k,i)=>!kw.found[i]).map(k=>k.shown.replace(/&[a-z]+;/g,c=>({'&times;':'\u00d7'}[c]||c)));
    $('flash-cmp').innerHTML='<div class="ex-cmp"><div class="ex-pane"><div class="qlbl">Your answer</div><div class="ex-yours">'+kw.html+'</div></div>'+
      '<div class="ex-pane ex-model ex-kw-'+cov+'"><div class="qlbl ex-kw-head">Model answer <span class="ex-kw-count">'+n+' of '+all+' key words</span></div>'+model.html+'</div></div>';
    $('flash-cmp').querySelectorAll('.ex-model .ex-kw').forEach(m=>m.classList.add(kw.found[+m.dataset.k]?'hit':'miss'));
    dictLink($('flash-cmp').querySelector('.ex-model'));
    show('f-flash',false); ta.blur();
    phase='self'; show('chkbtn',false); show('skipbtn',false); show('self-row',true);
    banner({all:'ok',some:'warn',none:'err'}[cov],(cov==='all'?'You used every key word.':cov==='none'?'None of the key words were in your answer.':
      'Missing: <b>'+missing.map(esc).join(', ')+'</b>.')+' Compare with the model answer, then mark yourself.');
    return;
  }
  const r=Q.grade();
  if(r.why){ const w=$('q-why'); w.innerHTML=r.why; w.classList.add('open'); dictLink(w); }
  finish(r.ok,'<b>'+r.verdict+'</b>');
}

function selfMark(ok){
  if(phase!=='self') return;
  show('self-row',false);
  finish(ok, ok?'<b>Marked right.</b>':'<b>Marked wrong.</b>');
}

function finish(ok,msg){
  S.answered++; if(ok) S.correct++; saveState();
  phase='rate'; show('chkbtn',false); show('skipbtn',false);
  const c=S.cards[cur.id];
  if(ok){
    forced=null;
    banner('ok',msg+' How comfortable are you with it?');
    $('rate-lbl').textContent='Shown again after:';
    $('rate-hard').innerHTML='Hard &middot; '+nextIvl(c,'hard')+' cards <kbd>1</kbd>';
    $('nxtbtn').innerHTML='Good &middot; '+nextIvl(c,'good')+' cards <kbd>2</kbd>';
    $('rate-easy').innerHTML='Easy &middot; '+nextIvl(c,'easy')+' cards <kbd>3</kbd>';
    show('rate-lbl',true); show('rate-hard',true); show('rate-easy',true);
  } else {
    forced='again';
    banner('err',msg+' Counts as <b>Again</b> &mdash; it comes back after 2 cards.');
    $('nxtbtn').innerHTML='Next &rarr;';
  }
  $('nxtbtn').style.display=''; // answer-keys.js focuses it, so Enter takes the default
  renderSide();
}

function rate(r){
  if(phase!=='rate'||!cur) return;
  if(forced) r=forced;
  applyRating(cur.id,r); saveState(); loadQ();
}
function nextQ(){ rate(forced||'good'); }

function skipQ(){
  if(phase!=='answer'||!cur) return;
  const c=S.cards[cur.id]; if(c) c.due=S.step+3;
  saveState(); loadQ();
}

/* Row and chip picks. */
$('qbody').addEventListener('click',e=>{
  if(phase!=='answer'||!Q) return;
  const row=e.target.closest('.rt-row.pick');
  if(row&&Q.pick){
    const i=+row.dataset.i;
    if(Q.pick.multi){ if(Q.sel.has(i)) Q.sel.delete(i); else Q.sel.add(i); } else Q.sel=new Set([i]);
    $('qbody').querySelectorAll('.rt-row.pick').forEach(tr=>tr.classList.toggle('sel',Q.sel.has(+tr.dataset.i)));
    return;
  }
  const chip=e.target.closest('.ex-chip');
  if(chip){ Q.choice=+chip.dataset.c; $('qbody').querySelectorAll('.ex-chip').forEach(b=>b.classList.toggle('on',+b.dataset.c===Q.choice)); return; }
  const ifg=e.target.closest('.ex-topo.pickable .ex-if');
  if(ifg){
    Q.ifSel=ifg.dataset.if;
    $('qbody').querySelectorAll('.ex-if').forEach(g=>g.classList.toggle('sel',g.dataset.if===Q.ifSel));
    const lbl=$('if-pick'); if(lbl){ lbl.textContent=Q.ifSel; lbl.classList.add('on'); }
    return;
  }
  const ord=e.target.closest('.ex-ord');
  if(ord){
    const i=+ord.dataset.o, at=Q.order.indexOf(i);
    if(at>=0) Q.order=Q.order.slice(0,at); else Q.order.push(i);
    $('qbody').querySelectorAll('.ex-ord').forEach(b=>{ const n=Q.order.indexOf(+b.dataset.o); b.classList.toggle('on',n>=0); b.querySelector('.ex-ord-n').textContent=n>=0?n+1:''; });
  }
});

/* Keys: Y/N to self-mark, 1/2/3 to rate, Enter to submit a pick-only card.
   Typed answers and the focused rating button are answer-keys.js's job. */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('area-menu').classList.contains('open')){ toggleAreaMenu(false); $('area-btn').focus(); return; }
  /* Ctrl+Enter submits from anywhere, including the multi-line command boxes
     where a plain Enter starts a new line. */
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&phase==='answer'){ e.preventDefault(); checkAll(); return; }
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  const el=document.activeElement, t=el&&el.tagName;
  if(t==='INPUT'||t==='TEXTAREA'||t==='SELECT'||(el&&el.isContentEditable)) return;
  const k=e.key.toLowerCase();
  if(phase==='self'){
    if(k==='y'){ e.preventDefault(); selfMark(true); } else if(k==='n'){ e.preventDefault(); selfMark(false); }
    return;
  }
  if(phase==='rate'&&!forced){
    if(k==='1'){ e.preventDefault(); rate('hard'); } else if(k==='2'){ e.preventDefault(); rate('good'); } else if(k==='3'){ e.preventDefault(); rate('easy'); }
    return;
  }
  if(phase==='answer'&&e.key==='Enter'&&Q&&!Q.hasBoxes&&(!el||el===document.body||el.classList.contains('ex-chip')||el.classList.contains('ex-ord'))){
    e.preventDefault(); checkAll();
  }
});

/* ═══ Controls, chips and the progress panel ══════════════════════════════ */
function setDiff(d){ S.diff=d; saveState(); syncControls(); loadQ(); }
/* ── The Areas dropdown: one checkbox per area that has cards. At least one
   stays ticked. Changing it keeps the card on screen if its area is still
   ticked, so an answer in progress isn't thrown away. */
function liveAreas(){ return AREAS.filter(a=>CARDS.some(c=>c.area===a.id)); }
function areasChanged(){
  saveState(); syncControls();
  if(!cur||(phase==='answer'&&S.off.indexOf(cur.area)>=0)) loadQ(); else renderSide();
}
function toggleAreaMenu(force){
  const m=$('area-menu'), b=$('area-btn'), open=force!=null?force:!m.classList.contains('open');
  m.classList.toggle('open',open); b.classList.toggle('open',open); b.setAttribute('aria-expanded',open?'true':'false');
}
function allAreas(){ S.off=[]; areasChanged(); }
$('area-rows').addEventListener('change',e=>{
  const box=e.target.closest('input[data-a]'); if(!box) return;
  const id=box.dataset.a, live=liveAreas().map(a=>a.id);
  if(box.checked) S.off=S.off.filter(x=>x!==id);
  else if(live.filter(x=>S.off.indexOf(x)<0&&x!==id).length===0){
    box.checked=true; // the last ticked area: keep it, say why
    const note=$('area-note'); if(note){ note.textContent='Keep at least one area ticked.'; note.classList.add('show'); }
    return;
  } else if(S.off.indexOf(id)<0) S.off.push(id);
  areasChanged();
});
document.addEventListener('mousedown',e=>{ if(!e.target.closest('#area-dd')) toggleAreaMenu(false); });
function syncControls(){
  document.querySelectorAll('#diff-row .cbtn').forEach(b=>b.classList.toggle('on',+b.dataset.d===S.diff));
  const live=liveAreas();
  if(!live.some(a=>S.off.indexOf(a.id)<0)) S.off=[];
  $('area-rows').innerHTML=live.map(a=>{
    const n=CARDS.filter(c=>c.area===a.id&&inTier(c)).length;
    return '<label class="opt-row ex-area-row"><input type="checkbox" class="req-checkbox" data-a="'+a.id+'"'+(S.off.indexOf(a.id)<0?' checked':'')+'>'+
      '<span class="opt-row-label">'+a.name+'</span><span class="ex-area-n">'+n+'</span></label>';
  }).join('')+'<div class="ex-area-note" id="area-note"></div>';
  const on=live.filter(a=>S.off.indexOf(a.id)<0);
  $('area-btn-txt').textContent=on.length===live.length?'All areas':on.length<=2?on.map(a=>a.name).join(', '):on.length+' areas';
  const n=pool().length, add=CARDS.filter(c=>c.tier===S.diff&&S.diff>1&&inPool(c)).length;
  $('pool-note').textContent=n+' card'+(n===1?'':'s')+(add?' ('+add+' added by '+TIER_NAME[S.diff]+')':'');
}
function renderSide(){
  const p=pool();
  $('ch-ans').textContent=S.answered;
  $('ch-pct').textContent=S.answered?Math.round(100*S.correct/S.answered)+'%':'–';
  $('ch-due').textContent=p.filter(c=>S.cards[c.id]&&S.cards[c.id].due<=S.step).length;
  const areas=AREAS.filter(a=>CARDS.some(c=>c.area===a.id&&inTier(c)));
  const rows=areas.map(a=>{
    const cs=CARDS.filter(c=>c.area===a.id&&inTier(c));
    const n={new:0,learn:0,comf:0}; cs.forEach(c=>n[cardStatus(c.id)]++);
    const pct=k=>(100*n[k]/cs.length)+'%';
    return '<tr'+(S.off.indexOf(a.id)>=0?' class="ex-off" title="Not in the rotation (unticked under Areas)"':'')+'><td>'+a.name+'</td><td>'+n.new+'</td><td>'+n.learn+'</td><td>'+n.comf+'</td>'+
      '<td class="ex-bar-cell"><div class="ex-bar"><span class="ex-b-comf" style="width:'+pct('comf')+'"></span><span class="ex-b-learn" style="width:'+pct('learn')+'"></span></div></td></tr>';
  });
  $('prog-body').innerHTML='<table class="rt-table ex-prog"><thead><tr><th>Area</th><th>New</th><th>Learning</th><th>Comfortable</th><th></th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';
}

let resetArmed=null;
function resetProgress(){
  const b=$('reset-btn');
  if(!resetArmed){
    b.textContent='Click again to reset'; b.classList.add('ex-armed');
    resetArmed=setTimeout(()=>{ resetArmed=null; b.textContent='Reset progress'; b.classList.remove('ex-armed'); },3000);
    return;
  }
  clearTimeout(resetArmed); resetArmed=null; b.textContent='Reset progress'; b.classList.remove('ex-armed');
  const keep={diff:S.diff, off:S.off.slice()};
  Object.keys(S).forEach(k=>delete S[k]); Object.assign(S,freshState(),keep);
  saveState(); lastId=null; loadQ();
}

syncControls();
dictRender();
loadQ();
AnswerKeys.wire({answers:'#qbody .afield input, #qbody textarea.ex-flash', submit:'checkAll'});
