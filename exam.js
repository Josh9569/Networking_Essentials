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

/* ═══ Q1 — static and dynamic routing, AD, metrics, floating statics ═════ */
card({id:'q1a-dynamic', area:'routing', tier:1, kind:'flash', src:'Q1 a', title:'Static vs dynamic routing', gen(){
  return {
    prompt: pick([
      'Why would you use a dynamic routing protocol rather than static routes? When would it be preferable to use static routes?',
      'A company is growing from '+ri(2,3)+' routers to '+ri(20,40)+', with redundant links between its sites. Should it keep using static routes or move to a dynamic routing protocol? When would static routes still be the better choice?',
      'Give two advantages of a dynamic routing protocol over static routes, and two situations where static routes are the better choice.',
    ]),
    model: ul([
      '<b>Dynamic:</b> routers learn and share routes automatically, so a large or growing network needs far less manual configuration (and fewer typing errors).',
      '<b>Dynamic:</b> it adapts to topology changes &mdash; when a link fails the routers reconverge onto an alternate path with no admin action.',
      'The cost of dynamic routing: it uses router CPU, memory and link bandwidth, and is more complex to configure and secure.',
      '<b>Static:</b> small networks with few routes that rarely change.',
      '<b>Static:</b> a stub network with a single way out &mdash; e.g. a default route to the ISP.',
      '<b>Static:</b> no routing updates are sent (more secure, no overhead) and the path is exactly what the admin chose; also used as a backup (floating static route).',
    ]),
  };
}});

card({id:'q1b-adpair', area:'routing', tier:1, kind:'flash', src:'Q1 b', title:'Two protocols, one destination', gen(){
  const pair=chance(.45)?['ospf','rip']:pick([['eigrp','ospf'],['eigrp','rip'],['ospf','isis'],['ebgp','ospf'],['static','ospf']]);
  const [a,b]=shuffle(pair), W=PROTO[a].ad<PROTO[b].ad?a:b, L=W===a?b:a;
  const src=k=>k==='static'?'a static route':'the routing protocol '+PROTO[k].name;
  return {
    prompt:'If a router has a choice between two routes to a destination, one provided by '+src(a)+' and the other by '+src(b)+', which one will the router choose? Why?',
    model: ul([
      'The <b>'+PROTO[W].name+'</b> route, because it has the lower <b>administrative distance</b> ('+adList([W,L])+').',
      'AD rates how trustworthy a route\'s source is. When two sources offer the same prefix, the lower AD is installed in the routing table.',
      'The metrics can\'t decide it: '+METRIC_NAME[a]+' and '+METRIC_NAME[b]+' are measured in different units, so they aren\'t compared across sources.',
      'The '+PROTO[L].name+' route is kept in reserve and installed only if the '+PROTO[W].name+' route disappears.',
    ]),
  };
}});

card({id:'q1c-admetric', area:'routing', tier:1, kind:'flash', src:'Q1 c', title:'Metric vs administrative distance', gen(){
  return {
    prompt: pick([
      'Routing protocols use both metrics and administrative distance (AD). If there is a choice of routes to the same destination, which have different metrics and ADs, which route is chosen?',
      'R1 has two routes to the same network: one with a lower metric, the other with a lower administrative distance. Which does it install, and when does the metric matter at all?',
    ]),
    model: ul([
      '<b>AD first:</b> of the routes to the same prefix from different sources, the one with the lowest AD is installed, whatever its metric.',
      '<b>Metric second:</b> the metric only chooses between routes from the <i>same</i> source (same AD) &mdash; e.g. two OSPF paths, lowest cost wins.',
      'Same AD and same metric: both are installed and traffic is load-balanced (equal-cost multipath).',
      'Different prefix lengths are different routes and can all be installed; when forwarding, the <b>longest prefix match</b> is used before AD is ever considered.',
    ]),
  };
}});

card({id:'q1d-floating', area:'routing', tier:1, kind:'flash', src:'Q1 d', title:'Floating static routes', gen(){
  const p=pick(['ospf','eigrp','rip']);
  return {
    prompt: pick([
      'What is the purpose of a floating static route? How do you ensure that a static route is treated as a floating static route?',
      'R1 learns the route to its head office through '+PROTO[p].name+'. You add a static route over a backup link that should be used only if the '+PROTO[p].name+' route is lost. What is this route called, and how do you stop it replacing the '+PROTO[p].name+' route?',
    ]),
    model: ul([
      'A <b>floating static route</b> is a backup: it stays out of the routing table while the primary route exists and is installed only if the primary fails.',
      'Make it float by giving it an <b>administrative distance higher than the primary route\'s</b> &mdash; the AD goes at the end of the <span class="mono-inl">ip route</span> command.',
      'e.g. primary learned by '+PROTO[p].name+' (AD '+PROTO[p].ad+'): '+mono('ip route 10.1.1.0 255.255.255.0 10.2.2.2 '+(PROTO[p].ad+10))+' &mdash; any AD from '+(PROTO[p].ad+1)+' to 254 works (255 means "never install").',
      'Without it the static route gets the default AD of 1 and would replace the primary instead of waiting behind it.',
    ]),
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
    model: ul([
      'The router ID is a 32-bit value written like an IPv4 address that <b>uniquely identifies the router</b> in the OSPF domain: neighbours and the LSAs it originates are tracked by it, and it breaks ties in the DR/BDR election (highest priority, then highest router ID).',
      '<b>1.</b> The '+mono('router-id')+' command under '+mono('router ospf')+'.',
      '<b>2.</b> If there is none: the highest IPv4 address on any <b>loopback</b> interface.',
      '<b>3.</b> If there are no loopbacks: the highest IPv4 address on an <b>active (up) physical</b> interface.',
      'The first of those that exists <b>when the OSPF process starts</b> is used. It then stays put until the process restarts &mdash; '+mono('clear ip ospf process')+' or a reload.',
    ]),
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
    model: ul([
      'OSPF\'s metric is <b>cost</b>. A route\'s cost is the <b>sum of the outgoing-interface costs</b> along the path; lowest total wins.',
      'Default interface cost = <b>reference bandwidth &divide; interface bandwidth</b>. The reference is 100 Mbps, the result is rounded down, and the minimum is 1.',
      'So 10 Mbps &rarr; 10, a T1 serial (1544 kbps) &rarr; 64, and FastEthernet, GigabitEthernet and faster all &rarr; 1 &mdash; they can\'t be told apart.',
      'Fix that with '+mono('auto-cost reference-bandwidth 1000')+' (or higher) under '+mono('router ospf')+', the same on every router.',
      'You can also set it per interface: '+mono('ip ospf cost N')+', or change the '+mono('bandwidth')+' value the calculation uses.',
    ]),
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
    model: ul([
      '<b>Single-area problems:</b> every router holds the whole topology, so the LSDB and routing table get large; every change floods to every router and makes all of them re-run SPF &mdash; heavy CPU, memory and bandwidth use.',
      '<b>Multi-area</b> is hierarchical: a backbone <b>area 0</b> with other areas attached to it through <b>ABRs</b>.',
      'Detailed topology LSAs (types 1 and 2) stay inside their own area, so a change floods and triggers SPF only <b>in the area where it happened</b>.',
      'ABRs pass a summary of each area to the others (type 3 LSAs) and can <b>summarise</b> routes, giving smaller routing tables.',
      'Result: smaller LSDBs, fewer SPF runs, less flooding, faster convergence, and problems contained within one area.',
    ]),
  };
}});

card({id:'q2d-timers', area:'ospf', tier:1, kind:'flash', src:'Q2 d', title:'Hello and dead timers', gen(){
  return {
    prompt: pick([
      'Why would you modify the hello timer or the dead timer? What effects would the changes have?',
      'An admin lowers the OSPF hello interval on a link to 1 second. Why might they do that, what is the downside, and what must they make sure of on the neighbouring router?',
    ]),
    model: ul([
      'Hellos discover neighbours and keep adjacencies alive. Defaults: hello 10 s and dead 40 s on Ethernet and point-to-point links (30/120 on NBMA). The dead interval is how long without a hello before the neighbour is declared down.',
      '<b>Lower them</b> to detect a failed neighbour, and reconverge, faster.',
      'The cost: more hello packets &mdash; more bandwidth and CPU &mdash; and a risk of neighbours flapping on a busy or lossy link.',
      '<b>Raise them</b> to cut overhead on slow links, at the cost of slower failure detection.',
      'Hello and dead intervals <b>must match on both neighbours</b> or the adjacency won\'t form. Set with '+mono('ip ospf hello-interval')+' / '+mono('ip ospf dead-interval')+' on the interface; if dead hasn\'t been set by hand, changing hello sets it to 4 &times; hello.',
    ]),
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

/* ═══ Scheduler and persistence ═══════════════════════════════════════════ */
const KEY='ne-exam-v1', COMFORT=20;
function freshState(){ return {step:0, diff:1, area:'all', cards:{}, answered:0, correct:0, lastNew:null}; }
function loadState(){
  try{ const s=JSON.parse(localStorage.getItem(KEY)); if(s&&typeof s==='object'&&s.cards) return Object.assign(freshState(),s); }catch(e){}
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
function inPool(c,area){ return c.tier<=S.diff&&(!area||area==='all'||c.area===area); }
function pool(){ return CARDS.filter(c=>inPool(c,S.area)); }

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
  Q=cur.gen(); Q.sel=new Set(); Q.choice=null;
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
    $('flash-cmp').innerHTML='<div class="ex-cmp"><div class="ex-pane"><div class="qlbl">Your answer</div><div class="ex-yours">'+esc(text)+'</div></div>'+
      '<div class="ex-pane ex-model"><div class="qlbl">Model answer</div>'+Q.model+'</div></div>';
    show('f-flash',false); ta.blur();
    phase='self'; show('chkbtn',false); show('skipbtn',false); show('self-row',true);
    banner('warn','Compare with the model answer. Did you cover the key points?');
    return;
  }
  const r=Q.grade();
  if(r.why){ const w=$('q-why'); w.innerHTML=r.why; w.classList.add('open'); }
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
  if(chip){ Q.choice=+chip.dataset.c; $('qbody').querySelectorAll('.ex-chip').forEach(b=>b.classList.toggle('on',+b.dataset.c===Q.choice)); }
});

/* Keys: Y/N to self-mark, 1/2/3 to rate, Enter to submit a pick-only card.
   Typed answers and the focused rating button are answer-keys.js's job. */
document.addEventListener('keydown',e=>{
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
  if(phase==='answer'&&e.key==='Enter'&&Q&&!Q.hasBoxes&&(!el||el===document.body||el.classList.contains('ex-chip'))){
    e.preventDefault(); checkAll();
  }
});

/* ═══ Controls, chips and the progress panel ══════════════════════════════ */
function setDiff(d){ S.diff=d; saveState(); syncControls(); loadQ(); }
function setArea(a){ S.area=a; saveState(); syncControls(); loadQ(); }
function syncControls(){
  document.querySelectorAll('#diff-row .cbtn').forEach(b=>b.classList.toggle('on',+b.dataset.d===S.diff));
  const sel=$('area-sel');
  const live=AREAS.filter(a=>CARDS.some(c=>c.area===a.id));
  sel.innerHTML='<option value="all">All areas</option>'+live.map(a=>'<option value="'+a.id+'">'+a.name+'</option>').join('');
  if(S.area!=='all'&&!live.some(a=>a.id===S.area)) S.area='all';
  sel.value=S.area;
  const n=pool().length, add=CARDS.filter(c=>c.tier===S.diff&&S.diff>1&&inPool(c,S.area)).length;
  $('pool-note').textContent=n+' card'+(n===1?'':'s')+(add?' ('+add+' added by '+TIER_NAME[S.diff]+')':'');
}
function renderSide(){
  const p=pool();
  $('ch-ans').textContent=S.answered;
  $('ch-pct').textContent=S.answered?Math.round(100*S.correct/S.answered)+'%':'–';
  $('ch-due').textContent=p.filter(c=>S.cards[c.id]&&S.cards[c.id].due<=S.step).length;
  const areas=AREAS.filter(a=>CARDS.some(c=>c.area===a.id&&inPool(c,'all')));
  const rows=areas.map(a=>{
    const cs=CARDS.filter(c=>c.area===a.id&&inPool(c,'all'));
    const n={new:0,learn:0,comf:0}; cs.forEach(c=>n[cardStatus(c.id)]++);
    const pct=k=>(100*n[k]/cs.length)+'%';
    return '<tr'+(S.area===a.id?' class="ex-cur"':'')+'><td>'+a.name+'</td><td>'+n.new+'</td><td>'+n.learn+'</td><td>'+n.comf+'</td>'+
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
  const keep={diff:S.diff, area:S.area};
  Object.keys(S).forEach(k=>delete S[k]); Object.assign(S,freshState(),keep);
  saveState(); lastId=null; loadQ();
}

syncControls();
loadQ();
AnswerKeys.wire({answers:'#qbody .afield input, #qbody textarea.ex-flash', submit:'checkAll'});
