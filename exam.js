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
  {id:'ts',      name:'Troubleshooting'},
];
const TIER_NAME={1:'Easy',2:'Medium',3:'Hard'};
/* IP version, for the IPv4 / IPv6 filter. A card is IPv4 unless listed: the
   IPv6 cards by id, and the concept cards that hold for both versions
   (AD vs metric, OSPF's router ID, timers, roles, LSAs, ACL placement).
   RIP, NAT and DHCPv4 are IPv4 here even where no address is shown. */
const FAMS=[{id:'4', name:'IPv4'}, {id:'6', name:'IPv6'}];
const FAM_V6=['q3e-acl6','g3-acl6','q5d-v6','g5-v6flags','g5-v6msgs','g5-v6relay','g5-v6cfg'];
const FAM_BOTH=['q1a-dynamic','q1b-adpair','q1c-admetric','q2a-rid','q2b-metric','q2c-multiarea','q2d-timers','q2e-roles','q2f-lsa','q3c-place'];
const CARDS=[];
function card(def){
  def.fam=FAM_V6.indexOf(def.id)>=0?['6']:FAM_BOTH.indexOf(def.id)>=0?['4','6']:['4'];
  CARDS.push(def);
}

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
/* Derivational endings, longest first, stripped up to three times while at
   least four letters are left: acknowledgement / acknowledges, failure /
   fail, summary / summarise, security / secure, translation / translate,
   redundancy / redundant, scalability / scale all meet. Deliberately NOT
   -er/-or (router is not route), -ive (passive is not pass) or a bare -y
   (stubby is not stub). */
const KW_SUF=['ibility','ability','isation','ically','worthy','ising','ating','ation','ated','ates','ally','ment','ness','ence','ance','ency','ancy','able','ible','ised','ises','ise','ate','ity','ful','ing','ion','ent','ant','edly','ary','ery','ed','ly'];
const KW_REPL={ary:'ar', ery:'er', ically:'ic', ally:'al'};
/* families no ending rule joins */
const KW_IRREG={failur:'fail', denial:'deny', deni:'deny', permiss:'permit', transmiss:'transmit', decis:'decid', inclus:'includ', exclus:'exclud', respons:'respond', resolut:'resolv', reduct:'reduc'};
/* Comparatives and superlatives meet their base word ("smaller networks"
   answers "small networks"). A list, not an -er/-est rule: that rule would
   make router = route and request = requ. */
const KW_COMP={};
('small big large fast slow quick low high long short few great simple easy cheap safe close near wide narrow strong weak hard soft late early').split(' ').forEach(a=>{
  const stem=/e$/.test(a)?a.slice(0,-1):/y$/.test(a)?a.slice(0,-1)+'i':/^(big|wide|hot)$/.test(a)?a+a.slice(-1):a;
  KW_COMP[(a==='big'?'bigg':stem)+'er']=a; KW_COMP[(a==='big'?'bigg':stem)+'est']=a;
});
function kwStem(w){
  w=w.toLowerCase();
  if(KW_COMP[w]) w=KW_COMP[w];
  w=w.replace(/our/g,'or').replace(/iz/g,'is');
  if(w.length<=3||/^\d/.test(w)) return w;
  if(/ies$/.test(w)) w=w.slice(0,-3)+'y';
  else if(/sses$/.test(w)) w=w.slice(0,-2);
  else if(/[^su]s$/.test(w)) w=w.slice(0,-1);
  let cut=false;
  for(let pass=0;pass<3;pass++){
    const s=KW_SUF.find(x=>w.endsWith(x)&&w.length-x.length>=4);
    if(!s) break;
    w=w.slice(0,-s.length)+(KW_REPL[s]||''); cut=true;
  }
  if(/e$/.test(w)&&w.length>4) w=w.slice(0,-1);
  if(cut&&/([^lsfz])\1$/.test(w)&&w.length>4) w=w.slice(0,-1);   // permitted -> permit
  return KW_IRREG[w]||w;
}
/* Words of a text with their stems and where they sit in it. Each word also
   keeps the text before it (`gap`) and its sentence number (`sent`): a
   full stop, ; ! ? followed by a space, or a line break, starts a new one
   — "192.168.1.1" does not. */
function kwTokens(text){
  const out=[], re=/(?<![0-9.])0\.[0-9]+(?![0-9.])|[A-Za-z0-9]+/g;/* a bare decimal (0.1) is one token, not 0 and 1 */  let m, last=0, sent=0;
  const plain=String(text).replace(/&[a-z]+;/g,t=>' '+t.slice(1,-1)+' ');
  while((m=re.exec(plain))){
    const gap=plain.slice(last,m.index);
    if(out.length&&(/[.;!?]\s/.test(gap)||/\n/.test(gap))) sent++;
    out.push({stem:kwStem(m[0]), at:m.index, len:m[0].length, w:m[0], gap, sent});
    last=m.index+m[0].length;
  }
  return out;
}
/* Every place any form of key word k occurs in the learner's words.
   A multi-word form tolerates the small words people put in or leave out:
   up to two articles or "IP"s may sit between its words in the answer
   ("assigns an IP address" for "assigns the address"), and an article in
   the form may be missing from the answer — but only when the form keeps
   two other words, so "the pool" still needs its "the" and never shrinks
   to a generic "pool". */
const KW_ART=new Set(['a','an','the','its','their'].map(kwStem));
const KW_SKIP=new Set(['a','an','the','its','their','ip','ipv4','ipv6'].map(kwStem));
/* "IP" is how people write "IP address": "assigns an IP" means "assigns the
   address". So inside a multi-word form, after its first word, an answer's
   IP / IPs stands for "address" — unless it is followed by "address"
   itself. A one-word "address" key word is never satisfied this way. */
const KW_ADDR=kwStem('address');
function kwIpAddr(words,a,st,j){
  return j>0&&st[j]===KW_ADDR&&(words[a].stem==='ip'||words[a].stem==='ips')&&!(words[a+1]&&words[a+1].stem===KW_ADDR);
}
/* One form's words at word i, tolerating small words as above: the indexes
   of the words that matched, or null. */
function kwSeqAt(words,st,i){
  const optArt=st.filter(x=>!KW_ART.has(x)).length>=2;
  if(words[i].stem!==st[0]&&!(optArt&&KW_ART.has(st[0]))) return null;
  let a=i, j=0, skips=0; const got=[];
  while(j<st.length&&a<=words.length){
    if(a<words.length&&(words[a].stem===st[j]||kwIpAddr(words,a,st,j))){ got.push(a); a++; j++; }
    else if(optArt&&KW_ART.has(st[j])) j++;
    else if(got.length&&a<words.length&&KW_SKIP.has(words[a].stem)&&skips<2){ a++; skips++; }
    else break;
  }
  return j===st.length&&got.length?got:null;
}
/* "Subject~term" forms grade WHICH thing the answer says something about:
   [[R2 is an ABR|R2~ABR|R2~area border router]] counts only when the ABR
   in the answer belongs to R2, so "R2 is an ASBR and R5 is an ABR" scores
   nothing for it. The subjects are every left-hand side on the card, and a
   term belongs to one of them in its own sentence:
     1. the nearest subject BEFORE it, if only linking words sit between
        ("R2 is an ABR", "R2 is also the ABR");
     2. else the nearest subject AFTER it, if only linking words sit
        between ("the ABR is R2", "ABR: R2");
     3. else the nearest subject before it ("R2 has interfaces in two areas
        so it's an ABR"), or failing that the one after. */
const KW_LINK=/^(?:[\s:=()\-–—]|\b(?:is|are|was|be|being|would|will|also|both|the|a|an|as|its|it's|it|router|routers|role|one|acts?|acting|serves?|works?|then)\b)*$/i;
function kwSubjects(keys){
  const seen={}, out=[];
  keys.forEach(k=>k.forms.forEach(f=>{
    const i=f.indexOf('~'); if(i<0) return;
    const st=kwTokens(f.slice(0,i)).map(t=>t.stem), id=st.join(' ');
    if(st.length&&!seen[id]){ seen[id]=1; out.push({id,st}); }
  }));
  return out;
}
function kwBetween(words,a,b){   // the raw text from the end of word a to the start of word b
  let t=''; for(let x=a+1;x<=b;x++) t+=words[x].gap+(x<b?words[x].w:''); return t;
}
/* Opt-in extras for a form, written as a prefix so every existing key word
   behaves exactly as before:
     ">"  a pairing reads the way a person writes numbers: "110 for OSPF" and
          "AD is 110 for RIP and 120 for OSPF" belong to the name after "for";
          and a pairing whose sentence has no subject of its own but opens with
          a pronoun ("Its AD is 110") belongs to the first subject of the
          sentence before.
     "@"  everything ">" does, and the form is refused when it is negated
          ("OSPF is not chosen", "does not choose OSPF", "wouldn't pick OSPF",
          "not OSPF, RIP is chosen"). "so it is chosen" means the sentence's own
          first subject, not the one named last.
     "^"  the form must open its sentence (articles and "answer" aside) and
          be followed by a comma, the end of the sentence, or because/since/as
          — so "OSPF." and "OSPF, because ..." count but "OSPF (110) vs RIP"
          does not. */
const KW_NEG=/^(?:not|no|never|neither|nor|cannot|cant|dont|doesnt|isnt|arent|wasnt|werent|wont|wouldnt|didnt|shouldnt|without)$/i;
const KW_PRON=/^(?:it|its|this|their|they)$/i;
const KW_ENDS=new Set(['because','since','as','cause'].map(kwStem));
const KW_VS=new Set(['than','over','against','versus','vs','instead','compared','unlike'].map(kwStem));
function kwIsNeg(w){ return KW_NEG.test(w.w)||(w.w==='t'&&/['’]$/.test(w.gap)); }
function kwNegIn(words,a,b){ for(let x=Math.max(a,0);x<=b&&x<words.length;x++) if(kwIsNeg(words[x])) return true; return false; }
function kwNegBefore(words,i){   // a negator in the same clause, up to two words before word i
  for(let x=i-1;x>=Math.max(i-2,0);x--){
    if(words[x].sent!==words[i].sent||/,/.test(words[x+1].gap)) return false;
    if(kwIsNeg(words[x])) return true;
  }
  return false;
}
function kwAnchored(words,got){
  const s=got[0], e=got[got.length-1];
  for(let x=s-1;x>=0&&words[x].sent===words[s].sent;x--) if(!KW_ART.has(words[x].stem)&&!/^(?:answer|ans)$/i.test(words[x].w)) return false;
  const n=words[e+1];
  return !n||n.sent!==words[e].sent||(/,/.test(n.gap)&&!/[:\-–—(]/.test(n.gap))||(!/[:\-–—(,]/.test(n.gap)&&KW_ENDS.has(n.stem));
}
/* "110 against 120" / "AD 110 vs 120": two numbers set against each other go
   to the names in the order they were mentioned, in this sentence or else the
   one before. Returns the mention that owns the number at ts..te, or null. */
const KW_VSW=new Set(['vs','versus','against'].map(kwStem));
function kwOrdered(words,list,ts,te){
  const sent=words[ts].sent, dig=w=>w&&w.sent===sent&&/^\d+$/.test(w.w);
  const n=words[te+1], m=words[te+2], n3=words[te+3], p1=words[ts-1], p2=words[ts-2], p3=words[ts-3];
  let idx=-1;
  if(n&&n.sent===sent&&((KW_VSW.has(n.stem)&&dig(m))||(/^compared$/i.test(n.w)&&m&&/^(?:to|with)$/i.test(m.w)&&dig(n3)))) idx=0;
  else if(p1&&p1.sent===sent&&((KW_VSW.has(p1.stem)&&dig(p2))||(/^(?:to|with)$/i.test(p1.w)&&p2&&/^compared$/i.test(p2.w)&&dig(p3)))) idx=1;
  if(idx<0) return null;
  let ms=list.filter(o=>words[o.s].sent===sent&&o.e<ts);
  if(!ms.length) ms=list.filter(o=>words[o.s].sent===sent-1);
  ms=ms.filter(o=>!ms.some(q=>q!==o&&q.s<=o.s&&q.e>=o.e&&(q.s<o.s||q.e>o.e)));   // "static" inside "static route"
  const seen={}, order=[];
  ms.sort((x,y)=>x.s-y.s).forEach(o=>{ if(!seen[o.id]){ seen[o.id]=1; order.push(o); } });
  /* only the first name is known: the second number is the other one's */
  return order[idx]||(idx===1&&order.length===1?{id:null, not:order[0].id, s:-1, e:-2}:null);
}
function kwFind(words,k,subjects){
  const hits=[];
  subjects=subjects||kwSubjects([k]);
  let occ=null;   // every subject mention: {id, s, e} (first and last word)
  const mine=new Set(subjects.filter(sb=>k.forms.some(f=>kwTokens(f.slice(0,Math.max(f.indexOf('~'),0))).map(t=>t.stem).join(' ')===sb.id&&f.indexOf('~')>0)).map(sb=>sb.id));   // this key word's own names
  let vetoed=false;   // a "!subject~term" form that matched: the answer says the opposite, so the key word fails
  k.forms.forEach(f=>{
    let aware=false, carry=false, anchor=false, veto=false;
    for(;;){ if(f[0]==='@'){ aware=true; carry=true; } else if(f[0]==='>') carry=true; else if(f[0]==='^') anchor=true; else if(f[0]==='!') veto=true; else break; f=f.slice(1); }
    const tilde=f.indexOf('~');
    if(f.charAt(0)==='#'){   // "#150": that number standing alone, never an octet of a dotted address
      const n=f.slice(1);
      words.forEach((w,i)=>{ if(w.w===n&&w.gap!=='.'&&!(words[i+1]&&words[i+1].gap==='.')) hits.push(i); });
      return;
    }
    if(tilde<0){
      const st=kwTokens(f).map(t=>t.stem); if(!st.length) return;
      for(let i=0;i<words.length;i++){
        const got=kwSeqAt(words,st,i); if(!got) continue;
        if(aware&&kwNegBefore(words,got[0])) continue;
        if(anchor&&!kwAnchored(words,got)) continue;
        for(let x=got[0];x<=got[got.length-1];x++) hits.push(x);
      }
      return;
    }
    const subj=kwTokens(f.slice(0,tilde)).map(t=>t.stem).join(' ');
    const st=kwTokens(f.slice(tilde+1)).map(t=>t.stem); if(!st.length) return;
    if(!occ){ occ=[]; subjects.forEach(sb=>{ for(let i=0;i<words.length;i++){ const g=kwSeqAt(words,sb.st,i); if(g) occ.push({id:sb.id, s:g[0], e:g[g.length-1]}); } }); }
    const list=occ;
    for(let i=0;i<words.length;i++){
      const got=kwSeqAt(words,st,i); if(!got) continue;
      const ts=got[0], te=got[got.length-1], sent=words[ts].sent;
      if(words[te+1]&&/^(?:[kmgt]?(?:bps|bit|bits)|[kmgt]b)$/i.test(words[te+1].w)) continue;   // "1 Gbps" is a speed, not a count
      const same=list.filter(o=>words[o.s].sent===sent&&(o.e<ts||o.s>te));
      const before=same.filter(o=>o.e<ts).sort((x,y)=>y.e-x.e)[0];
      const after=same.filter(o=>o.s>te).sort((x,y)=>x.s-y.s)[0];
      let own=null, linked=true;
      if(before&&KW_LINK.test(kwBetween(words,before.e,ts))) own=before;
      else if(after&&(KW_LINK.test(kwBetween(words,te,after.s))||(carry&&/^\s*(?:for|from)\s*$/i.test(kwBetween(words,te,after.s))))) own=after;
      else {
        linked=false;
        if(carry&&!before){   // "Its AD is 110": the sentence has no subject of its own, so it is the last sentence's
          let a=ts; while(a>0&&words[a-1].sent===sent) a--;
          let pron=false; for(let x=a;x<ts;x++) if(KW_PRON.test(words[x].w)) pron=true;
          if(pron) own=list.filter(o=>words[o.s].sent===sent-1).sort((x,y)=>x.s-y.s)[0]||null;
        }
        if(!own&&carry) own=kwOrdered(words,list,ts,te);
        if(!own){
          /* "it" just before the term ("... than RIP, so it is chosen") means
             the sentence's own subject, not the one named last. */
          let it=false; for(let x=ts-1;x>=Math.max(ts-3,0)&&aware;x--) if(words[x].sent===sent&&/^(?:it|its)$/i.test(words[x].w)) it=true;
          const lead=it&&same.filter(o=>!(words[o.s-1]&&words[o.s-1].sent===sent&&KW_VS.has(words[o.s-1].stem))).sort((x,y)=>x.s-y.s)[0];
          own=lead||before||after;
        }
      }
      if(veto){ if(linked&&own&&own.id===subj) vetoed=true; continue; }   // a veto needs the term right next to its subject
      /* A sentence with no subject in it ("OSPF. Lower AD.") belongs to the last subject named just before it. */
      if(!own) own=list.filter(o=>words[o.s].sent===sent-1).sort((x,y)=>y.e-x.e)[0]||null;
      if(aware&&own&&own.s>=0){
        if(own.e<ts&&kwNegIn(words,own.e+1,ts-1)) continue;
        if(own.s>te&&kwNegIn(words,te+1,own.s-1)) continue;
        if(kwNegBefore(words,ts)) continue;
        const sp=own.s-1;   // "not OSPF": the name itself is negated
        if(sp>=0&&words[sp].sent===words[own.s].sent&&kwIsNeg(words[sp])) continue;
      }
      if(own&&(own.id===subj||(own.not&&!mine.has(own.not)))){ for(let x=ts;x<=te;x++) hits.push(x); if(own.s>=0&&words[own.s].sent===sent) for(let x=own.s;x<=own.e;x++) hits.push(x); }
    }
  });
  return vetoed?[]:hits;
}
/* The model answer as HTML with its key words wrapped, plus the key words. */
function kwModel(points){
  const keys=[];
  const html=ul(points.map(pt=>pt.replace(KW_RE,(m,body)=>{
    const forms=body.split('|'); keys.push({shown:forms[0].replace(/~/g,' '), forms});
    return '<mark class="ex-kw" data-k="'+(keys.length-1)+'">'+forms[0].replace(/~/g,' ')+'</mark>';
  })));
  return {html, keys};
}
/* Check an answer: which key words it used, and the answer as HTML with the
   words that matched highlighted. */
function kwCheck(text,keys){
  const words=kwTokens(text), by=new Map(), subjects=kwSubjects(keys);
  const found=keys.map(k=>{ const h=kwFind(words,k,subjects); h.forEach(i=>{ if(!by.has(i)) by.set(i,[]); if(by.get(i).indexOf(k.shown)<0) by.get(i).push(k.shown); }); return h.length>0; });
  /* Each matched word says which key word it counted for — "infinity" counts
     for "16 means unreachable", which is not obvious from the colour. */
  let html='', pos=0;
  words.forEach((w,i)=>{
    if(!by.has(i)) return;
    html+=esc(text.slice(pos,w.at))+'<mark class="ex-kw hit" title="'+esc('Counts for: '+by.get(i).join(', '))+'">'+esc(text.slice(w.at,w.at+w.len))+'</mark>';
    pos=w.at+w.len;
  });
  html+=esc(text.slice(pos));
  return {found, html};
}

/* ═══ Q1 — static and dynamic routing, AD, metrics, floating statics ═════ */
/* q1a: the two scenario prompts have opposite answers (a company outgrowing
   static routes; a small hub-and-spoke that should keep them), so the first
   key word is the VERDICT and is graded as a choice, not as vocabulary. It
   uses "subject~term" pairing (see kwFind): the option named in the answer
   (D = dynamic, S = static) has to own a choosing, praising or dismissing
   word. The prompts say "rely on static routes or on a dynamic routing
   protocol" and none of the verdict words are in them, so copying the
   question scores nothing; nor does restating the network's facts, because
   no reasoning key word is a word the scenario prompt uses.
   - D~verb is "move to / switch to / adopt ... dynamic"; a negator before
     it ("no need to", "don't", "rather than") owns the verb instead, which
     is what Q1A_NEG is for: subjects with nothing after the ~, registered
     only so they win ownership.
   - D~praise ("dynamic is better") and S~criticism ("static won't scale")
     both mean "go dynamic"; S~praise, D~dismissal ("OSPF is overkill") and
     "no need to move to dynamic" mean "keep static".
   - "Use OSPF", "Dynamic: it learns routes automatically ..." are terse
     verdicts, covered by protocol~use and D~learn/adapt/scale. A bare
     "Dynamic." or the question's own option names score nothing: they cannot
     be told apart from copying the prompt. */
const Q1A_DYN=['dynamic routing protocol','dynamic routing','dynamic protocol','routing protocol','dynamic','OSPF','EIGRP','RIP'];
const Q1A_PROTO=['OSPF','EIGRP','RIP'];
const Q1A_STA=['static routes','static routing','static'];
/* the tails of "dynamic routing protocol": "use dynamic" is owned by what follows it */
const Q1A_TAIL=['routing protocol','routing','protocol'];
const Q1A_NEG=['no need to','no need for','no reason to','no point in','not worth','not need to','t need to','t need','not','t','never','rather than','instead of','without','unless'];
const Q1A_MOVE=['move to','moving to','move over to','switch to','switching to','change to','changing to','migrate to','migrating to','convert to','upgrade to','transition to','go with','going with','go for','opt for','adopt','adopting','implement','implementing','deploy','deploying','choose','choosing','pick','select','start using','prefer','recommend','suggest','introduce','introducing','definitely','certainly','clearly','obviously','absolutely','probably','preferably','ideally','surely','need a','needs a','need an','needs an','will need','would need','should have','must have'];
const Q1A_USE=['use','using','run','running','configure','enable'];
const Q1A_D_GOOD=['better','best','preferable','preferred','suitable','ideal','appropriate','recommended','is needed','are needed','be needed','necessary','is required','are required','be required','essential','easier','easier to manage','more efficient','efficient','manageable','right choice','right call','correct choice','way to go','the answer','the solution','worth it','worthwhile','should be used','should be implemented','should be adopted','should be deployed'];
const Q1A_D_DOES=['learn','adapt','reroute','reconverge','automatically','automatic','scale','scalable','scalability','share routes','self healing'];
const Q1A_S_BAD=['impractical','not practical','unmanageable','not manageable','hard to manage','difficult to manage','too much work','too much effort','too much admin','too much configuration','too many','too hard','too difficult','too complex','too complicated',"won't scale",'will not scale',"doesn't scale",'does not scale',"don't scale",'do not scale',"can't scale",'cannot scale','not scalable','unscalable','not viable','not feasible','infeasible','not sustainable','unsustainable','not suitable','unsuitable','not appropriate','inappropriate',"won't work",'will not work','a nightmare','not enough','inadequate','outgrown','not good enough','a bad idea','error prone','time consuming','tedious','no longer'];
const Q1A_S_LEAVE=['move away from','moving away from','stop using','replace','replacing','get rid of','drop','abandon','phase out','outgrow','outgrown','no longer use','no longer need'];
const Q1A_S_KEEP=['keep','keeping','keep using','stay with','staying with','stay on','stick with','stick to','sticking with','continue using','continue with','continue to use','remain with','retain','carry on with','carry on using','go with','going with','opt for','choose','choosing','pick','select','use','using','prefer','recommend','suggest','stay','remain','definitely','certainly','clearly','obviously','absolutely','probably','preferably','ideally','surely'];
const Q1A_S_GOOD=['better','best','preferable','preferred','suitable','sufficient','enough','fine','adequate','appropriate','ideal','recommended','right choice','right call','correct choice','all it needs','all they need','will do','would do','works fine','work fine','perfectly fine','the answer','way to go','should be used','should be kept','should stay','should remain','definitely','certainly','clearly','obviously','absolutely','probably','preferably','ideally','surely'];
const Q1A_D_BAD=['overkill','unnecessary','not necessary','not needed','unneeded','not required','pointless','a waste','wasteful','no benefit','no advantage','nothing to gain','too complex','too complicated','more complex than needed','excessive','not justified','unjustified','useless','not worth it','not worth the effort','more than needed','more than necessary','not warranted','over the top'];
const Q1A_D_NO=q1aNot(Q1A_MOVE.concat(Q1A_USE,['bother with'])).concat(['no need for','no need to move to','no need to switch to','no need to use','no need to run','no need to implement','no need to deploy','no need to adopt','no need to change to','no reason to use','no reason to move to','no reason to switch to','no point in using','no point in moving to','not worth moving to','not worth using','not need','t need','t require','not require','no use for','rather than','instead of','without','avoid']);
/* stub variant, "dynamic would be better once ...": paired with D so that
   "the network will not grow" (owned by the static option) cannot score it */
const Q1A_GROWS=['grow','grows','growing','growth','expand','expands','expanding','expansion','large','larger','big','bigger','many routers','more routers','lots of routers','many sites','more sites','new sites','additional sites','extra sites','many branches','more branches','new branches','additional branches','extra branches','new routers'];
const Q1A_REDUND=['redundant','redundancy','multiple paths','more than one path','several paths','alternate path','alternative path','backup link','backup path','multiple links','more than one link','several links','extra links','additional links','mesh','failover','fail over','link fails','link failure','fails','failure','reroute','reconverge','convergence','adapts'];
function q1aNot(verbs){ const out=[]; ['t','not','never','no need to','no reason to'].forEach(n=>verbs.forEach(v=>out.push(n+' '+v))); return out; }
function q1aPair(subs,terms){ const out=[]; subs.forEach(s=>terms.forEach(t=>out.push(s+'~'+t))); return out; }
/* grow: choose dynamic */
const Q1A_TO_DYN=[].concat(
  q1aPair(Q1A_DYN,Q1A_MOVE), q1aPair(Q1A_PROTO,Q1A_USE),
  q1aPair(Q1A_DYN,Q1A_D_GOOD), q1aPair(Q1A_DYN,Q1A_D_DOES), q1aPair(Q1A_STA,Q1A_S_BAD), q1aPair(Q1A_STA,Q1A_S_LEAVE),
  Q1A_NEG.map(n=>n+'~'),
  /* last: the tails would otherwise tie with "static routes" for the word "routes" */
  q1aPair(Q1A_TAIL,['use dynamic','using dynamic'])).join('|');
/* stub: keep static. S and D are both registered so each owns its own words. */
const Q1A_TO_STA=[].concat(
  q1aPair(Q1A_STA,Q1A_S_KEEP), q1aPair(Q1A_STA,Q1A_S_GOOD), q1aPair(Q1A_DYN,Q1A_D_BAD), q1aPair(Q1A_DYN,Q1A_D_NO),
  Q1A_NEG.map(n=>n+'~'),
  ['stay static','remain static','leave it as it is','leave it as is','keep it as it is','keep it as is','no need to change','t need to change','not need to change','nothing needs to change','nothing to change','no changes needed','no change needed']).join('|');
card({id:'q1a-dynamic', area:'routing', tier:1, kind:'flash', src:'Q1 a', title:'Static vs dynamic routing', gen(){
  /* Key-word forms. None of them is a word a prompt uses ("growing",
     "redundant", "ISP" ...), and none is a bare "default route", "every
     router" or "manual": those are what an answer about anything says. */
  const kScale='scales|scale|scalable|scalability|automatically|automatic|auto|less admin|less configuration|less config|less work|less effort|large network|larger network|big network|bigger network|lots of routers|many routers|more routers|manual configuration|manually configure|manually configuring|manually add|manually adding|manually enter|manually entering|manually update|manually updating|manual updates|manual work|manual effort|by hand|no manual|without manual|less manual|typing routes|type the routes|enter routes|entering routes';
  const kFail='link fails|link failure|link failures|fails|fail|failure|failures|failover|fail over|goes down|go down|went down|link down|reroute|re-route|reconverge|converge|convergence|topology change|topology changes|adapts|adapt|self-healing|alternate path|alternative path|alternate route|alternative route|another path|other path|different path|another route|backup path|backup route|new path|new route|find another|finds another|use the redundant|use the other link|use the backup|use the other path|switch to the other|fall back';
  /* the ISP forms are owned by the static option ("static only for the ISP
     link"), so describing the network's own ISP link scores nothing */
  const kStub='stub network|stub networks|stub|single exit|one exit|only one exit|single way out|one way out|only one way out|only way out|only one path|single path|only one route|single route|only one link|one link out|single link|single connection|only one connection|no other path|'+q1aPair(Q1A_STA,['ISP','internet']).join('|');
  const kSmall="small network|small networks|small|few routers|few routes|few networks|handful|simple network|simple topology|tiny|rarely change|rarely changes|seldom change|does not change|doesn't change|not change|never change|won't change|will not change|stable";
  const dynWhy=[
    '<b>Dynamic:</b> routers learn and share routes automatically, so adding a network doesn\'t mean typing a route into every router &mdash; it [['+kScale+']] to large and growing networks.',
    '<b>Dynamic:</b> it adapts when a [['+kFail+']] &mdash; the routers reconverge onto another path with no admin action, where a static route stays pointed at the dead link.',
  ];
  const ask=' Decide whether it should rely on static routes or on a dynamic routing protocol. Give two reasons for your choice, using the details of this network, and describe two situations where the other option would be the better choice.';
  const v=pick(['why','two','grow','stub']);
  if(v==='why') return {
    prompt:'Why would you use a dynamic routing protocol rather than static routes? Give two reasons. When would it be preferable to use static routes? Describe two kinds of network where they are the better choice.',
    points: dynWhy.concat([
      '<b>Static:</b> a [['+kSmall+']] with few routes that rarely change.',
      '<b>Static:</b> a [['+kStub+']] with a single way out &mdash; e.g. a default route to the ISP.',
      'Static routes also send no routing updates (more secure, no CPU, memory or bandwidth spent) and can back up a dynamic route (a floating static route). Dynamic routing costs those resources and is more complex to configure and secure.',
    ]),
  };
  if(v==='two') return {
    prompt:'Give two advantages of a dynamic routing protocol over static routes, and two advantages of static routes over a dynamic routing protocol.',
    points: dynWhy.concat([
      '<b>Static:</b> more [[secure|more secure|security|no updates|no routing updates|not advertised|never advertised|nothing advertised|no advertisements|safer]] &mdash; no routing updates are sent, so there is nothing to intercept or spoof.',
      '<b>Static:</b> [[no overhead|overhead|CPU|processing|processor|memory|RAM|bandwidth|resources|resource|less load|lightweight]] &mdash; no CPU, memory or link bandwidth is spent running a protocol.',
      'Also: a static route always takes exactly the path the admin chose.',
    ]),
  };
  if(v==='grow'){
    const n0=ri(2,3), n1=ri(20,40);
    return {
      prompt:'A company is growing from '+n0+' routers to '+n1+', with redundant links between its sites.'+ask,
      points:[
        '<b>Here:</b> the company [[should move to a dynamic routing protocol|'+Q1A_TO_DYN+']] such as OSPF &mdash; '+n1+' routers with redundant links between sites is more than static routes can handle.',
        '<b>Why:</b> with static routes, every new network means a route typed into each of the '+n1+' routers; a protocol learns and shares routes automatically, so it [['+kScale+']].',
        '<b>Why:</b> the redundant links only help if traffic moves onto them when a [['+kFail+']] &mdash; a static route stays pointed at the dead link, while a protocol reconverges onto another path with no admin action.',
        '<b>Static is still better:</b> for a [['+kStub+']] with a single way out &mdash; e.g. the edge router\'s default route to the ISP.',
        '<b>Static is still better:</b> in a [['+kSmall+']] with few routes that rarely change.',
      ],
    };
  }
  const n=ri(3,4);
  const q1aG=['once it grows','once the company grows','once the network expands','once it expands','once the company expands','if the network grows','if it grows','if the company grows','if the network expands','if it expands','if the company expands','when the network grows','when it grows','when the company grows','when the network expands','when it expands','as the network grows','as it grows','as the company grows','as it expands','grows larger','grows bigger','grows to','grows into','expands to','gets bigger','gets larger','if more sites are added','once more sites are added','when more sites are added','if new sites are added','once new sites are added','when new sites are added','if sites are added','if more routers are added','once more routers are added','when more routers are added','if routers are added','if the company adds','once the company adds','when the company adds'].concat(q1aPair(Q1A_DYN,Q1A_GROWS)).join('|');
  const q1aR=['once there are redundant links','if there are redundant links','when there are redundant links','if there were redundant links','if it had redundant links','if it has redundant links','if the company has redundant links','once there is redundancy','if there is redundancy','if redundant links are added','once redundant links are added','when redundant links are added','if backup links are added','if there are backup links','if there were backup links','if there are multiple paths','if there were multiple paths','once there are multiple paths','when there are multiple paths','if there is more than one path','once there is more than one path','if links are added','if more links are added','once more links are added','if extra links are added','if there are multiple links','if there are several links','if there are alternate paths','if there are alternative paths'].concat(q1aPair(Q1A_DYN,Q1A_REDUND)).join('|');
  return {
    prompt:'A company has '+n+' routers: one at its head office and one at each of its '+(n-1)+' branches. Every branch router is cabled to the head office and to nothing else, and the head office is cabled to its ISP. The company has no plans to add any more sites.'+ask,
    points:[
      '<b>Here:</b> the company [[should keep its static routes|'+Q1A_TO_STA+']] &mdash; '+n+' routers, and every branch has only one way out, so a routing protocol would have nothing to choose between.',
      '<b>Why:</b> each branch is a [[stub network|stub|single exit|one exit|one way out|only one way out|single way out|only one path|single path|only one route|only route|only one link|one link|single link|single connection|no other path|no other route|nowhere else|hub and spoke|hub-and-spoke]]: one static default route pointing at the head office covers everything, and the head office needs just a default route to the ISP plus one route per branch LAN.',
      '<b>Why:</b> it is a [[small network|small|few routers|few routes|few networks|handful|simple network|simple topology|tiny|stays the same|stay the same|stable|not change|never change|won\'t change|doesn\'t change|not grow|won\'t grow|isn\'t growing|not growing|no growth|not expand|won\'t expand|not expanding|isn\'t expanding|no expansion|stay small|remain small]] that won\'t change &mdash; no sites are being added, so the routes are typed once and left alone.',
      '<b>Dynamic would be better:</b> [[once the network grows|'+q1aG+']] to many routers &mdash; a protocol learns and shares routes automatically instead of each one being typed into every router.',
      '<b>Dynamic would be better:</b> [[once there are redundant links|'+q1aR+']] &mdash; when one fails a protocol reconverges onto another path, where a static route stays pointed at the dead link.',
    ],
  };
}});

card({id:'q1b-adpair', area:'routing', tier:1, kind:'flash', src:'Q1 b', title:'Two protocols, one destination', gen(){
  const pair=chance(.45)?['ospf','rip']:pick([['eigrp','ospf'],['eigrp','rip'],['ospf','isis'],['ebgp','ospf'],['static','ospf']]);
  const [a,b]=shuffle(pair), W=PROTO[a].ad<PROTO[b].ad?a:b, L=W===a?b:a;
  const src=k=>k==='static'?'a static route':'the routing protocol '+PROTO[k].name;
  const nm=k=>k==='static'?'static':PROTO[k].name;
  /* Which source the answer picks, and which AD belongs to which source, are
     graded by pairing (subject~term): "RIP is chosen over OSPF" or "OSPF 120,
     RIP 110" score nothing for OSPF. Every name a learner might use (KW_NAME)
     is a subject, the loser's included, which is what lets a sentence naming
     both be read the right way round. The "@" forms ignore a negated choice
     ("OSPF is not chosen, RIP is preferred") and follow "Its AD is 110" back
     to the sentence before; "^" takes a bare "OSPF." / "OSPF, because ...". */
  const names=k=>KW_NAME[k].split('|');
  const said=(k,terms,fl)=>names(k).map(s=>terms.map(t=>(fl||'@')+s+'~'+t).join('|')).join('|');
  const each=(k,fn)=>names(k).map(fn).join('|');
  /* An active verb in front of the name ("uses the OSPF route") is the router
     choosing; "OSPF uses cost" is not, so use/take/go with are never paired. */
  const chosen=['chosen','choose','chooses','chose','choice','prefer','preferred','preferable','pick','picked','select','selected','install','installed','best','better','winner','beats','beat','outranks','outrank','overrides','override','overrule','overrules'];
  const takes=k=>each(k,s=>['use','using','take','taking','go with','goes with','going with','went with','opt for','opts for'].map(v=>'@'+v+' '+s).join('|'));
  const used=k=>each(k,s=>['is used','will be used','would be used','gets used','is the one used'].map(v=>'@'+s+' '+v).join('|'));
  const wins=k=>each(k,s=>['wins','win','would win','will win','should win'].map(v=>'@'+s+' '+v).join('|'));
  const bare=k=>each(k,s=>'^'+s+'|^'+s+' route|^'+s+' routes');
  const adOf=k=>'[['+PROTO[k].name+' '+PROTO[k].ad+'|'+said(k,[PROTO[k].ad],'>')+']]';
  const met=[a,b].filter(k=>k!=='static').map(k=>METRIC_NAME[k]);
  const units='[[different units|different metric|different scale|different type|different kind|different way|different method|different measure|different calculation|different formula|measured differently|calculated differently|worked out differently|them differently|it differently|metric differently|own metric|own way|not comparable|incomparable|aren\'t comparable|isn\'t comparable|metrics are different|metric is different|t be compared|cannot be compared|cant be compared|can\'t compare|cannot compare|can not compare|cant compare|couldn\'t compare|unable to compare|no way to compare|never compared|apples|same protocol|same routing protocol|same source'
    +(W==='static'||L==='static'?'|no metric|metric of 0|metric 0|metric is 0|metric of zero|zero metric|t have a metric':'')+']]';
  return {
    prompt:'If a router has a choice between two routes to a destination, one provided by '+src(a)+' and the other by '+src(b)+', which one will the router choose? Explain why: name the value the router compares, give it for both sources, and say what that value represents. Do the two routes\' metrics play any part? Why or why not?',
    points: [
      '<b>Here:</b> [[the '+nm(W)+' route is chosen|'+said(W,chosen)+'|'+takes(W)+'|'+wins(W)+'|'+used(W)+'|'+bare(W)+']]. The router compares the [[administrative distance|AD|admin distance]] of the two sources and the lower one wins: '+adOf(W)+' against '+adOf(L)+'.',
      'AD represents how [[trustworthy|trust|trustworthiness|reliable|believable|credible|confidence|priority|rank]] the source of a route is &mdash; the lower the number, the more it is trusted. When two sources offer the same prefix, only the one with the lowest AD is installed in the routing table.',
      met.length===2
        ? 'The metrics play no part: '+met[0]+' and '+met[1]+' are measured in '+units+', so they can\'t be compared across sources. A metric only chooses between routes from the same source.'
        : 'The metrics play no part: a static route has no metric (0) to set against '+met[0]+', and metrics from different sources are in '+units+' anyway, so they are never compared.',
      'The '+nm(L)+' route is kept in reserve and installed only if the '+nm(W)+' route disappears.',
    ],
  };
}});

card({id:'q1c-admetric', area:'routing', tier:1, kind:'flash', src:'Q1 c', title:'Metric vs administrative distance', gen(){
  /* Shared key-word forms. "Lowest AD wins" is the verdict on the paper's
     general question and the reason on R1's; the metric only decides within
     one source. "tie" alone is left out: the general prompt also asks what a
     tie on both values does. */
  const lowerAd='lower administrative distance|lowest administrative distance|lower AD|lowest AD|smaller AD|smallest AD|best AD|lower admin distance|lowest admin distance|low AD|AD is lower|AD is lowest|AD is smaller|AD is smallest|AD is better|AD first|AD is compared first|AD is checked first|AD is looked at first|AD comes first|AD goes first|AD is considered first|AD is used first|AD is looked at before|AD is checked before|AD is compared before|AD is considered before|AD is used before|AD is more important|AD matters more|AD takes priority|AD takes precedence|AD before|AD over the metric|AD over metric|AD wins|AD decides';
  const sameSrc='same routing protocol|same protocol|same source|same AD|same administrative distance|equal AD|equal administrative distance|same admin distance|same ADs|equal ADs|ADs are equal|ADs are the same|AD is the same|AD is equal|AD is tied|ADs are tied|ADs tie|one protocol|single protocol|same dynamic protocol|same dynamic routing protocol|same routing source|same routing protocols|same protocols|same type of route|within a protocol|within one protocol|within the protocol|inside one protocol|tie breaker|tiebreaker|tie-break';
  const units='different units|different unit|different metric|different metrics|metrics are different|metric is different|different scale|different scales|different type|different kind|different way|different ways|different method|different measure|different measurement|different calculation|different formula|measured differently|calculated differently|worked out differently|calculate differently|measure differently|metric differently|metrics differently|them differently|own metric|own way|not comparable|incomparable|aren\'t comparable|isn\'t comparable|not directly comparable|not compared|never compared|not be compared|t be compared|cannot be compared|can not be compared|cant be compared|can\'t compare|cannot compare|can not compare|cant compare|unable to compare|no way to compare|apples|arent comparable|isnt comparable|aren t comparable|isn t comparable|not comparable between|dont mean the same|don t mean the same|do not mean the same|does not mean the same|doesnt mean the same|doesn t mean the same|mean different things|mean different|not the same thing|not the same unit|not the same units|measure things differently|measure different things|measures different things|measure something different|measures something different|measured differently|different things|different between protocols|different between the protocols|different across protocols|differ between protocols|differ across protocols|differs between protocols|different for each protocol|different for every protocol|different in each protocol|different protocols calculate|different protocols use different|different protocols measure|use different metrics|uses different metrics|use a different metric|uses a different metric|use different measures|play no part|plays no part|have nothing to do with|has nothing to do with|metrics are ignored|metric is ignored|metrics are not used|metric is not used|metrics are not considered|metric is not considered|metrics arent considered|metric isnt considered|metrics aren t considered|metric isn t considered|metrics are irrelevant|metric is irrelevant|metrics are not relevant|metric is not relevant|metrics do not matter|metric does not matter|metrics dont matter|metric doesnt matter|metrics don t matter|metric doesn t matter|metrics are not looked at|metric is not looked at';
  /* The paper's own question is general, so the rule is the answer. The
     prompt spells out every part the key words grade. */
  if(chance(.5)) return {
    prompt:'Routing protocols use both metrics and administrative distance (AD). If there is a choice of routes to the same destination, which have different metrics and ADs, which route is chosen? Explain what AD and the metric each measure, and when the metric decides between routes. What happens if two routes have the same AD and the same metric?',
    points: [
      '<b>Lowest AD wins:</b> of the routes to the same prefix from different sources, the one with the [[lowest administrative distance|'+lowerAd+']] is installed, whatever its metric &mdash; AD is compared first.',
      '<b>AD</b> rates how [[trustworthy|trust|trusted|trusts|trustworthiness|reliable|reliability|believable|believability|credible|credibility|confidence|how good the source|how good a source]] the source of a route is (connected 0, static 1, EIGRP 90, OSPF 110, RIP 120): the lower the number, the more the router believes it.',
      '<b>The metric</b> measures how good a path is &mdash; the [[cost of the path|hop count|best path|best route|shortest path|shortest route|fastest path|fastest route|how far|how good the path|how good a path|how good the route|how good a route|quality of the path|path quality|length of the path|path length|cost of reaching|cost to reach|cost of getting|cost of the route|cost of the link|cost of the links|path cost|route cost|link cost|cost of that path|cost of that route|bandwidth and delay|number of hops|how many hops|distance to the network|distance to the destination|which path is best|which route is best|which path is the best|which route is the best]] of reaching the network that way, worked out by the routing protocol itself (OSPF cost, RIP hop count, EIGRP bandwidth and delay).',
      '<b>When the metric decides:</b> only between routes from the [[same routing protocol|'+sameSrc+']] (same AD) &mdash; e.g. two OSPF paths, the lower cost wins. Metrics from different protocols are in different units, so they are never compared.',
      '<b>Same AD and same metric:</b> both routes are installed and traffic is [[load balanced|load balance|load balancing|load balances|load share|load sharing|load shared|ECMP|multipath|both installed|both are installed|both get installed|both used|both are used|both get used|both routes are used|both routes are installed|both go in|use both|uses both|install both|installs both|split the traffic|traffic is split|share the traffic|traffic is shared]] across them (equal-cost multipath).',
    ],
  };
  /* R1's version names the two sources, so the model says which route R1
     installs. The lower-AD source always has the HIGHER metric: the metric
     is the trap. No address, so it stays a card for both IP versions (RIPng,
     OSPFv3 and EIGRP for IPv6 keep the same ADs). */
  const [W,L]=pick([['ospf','rip'],['ospf','rip'],['eigrp','ospf'],['eigrp','rip']]);
  let mW, mL; do{ mW=rMetric(W); mL=rMetric(L); }while(mL>=mW);
  const met=k=>k===W?mW:mL, nm=k=>PROTO[k].name, ad=k=>PROTO[k].ad;
  const [a,b]=shuffle([W,L]), src=k=>nm(k)+' with a metric of '+met(k)+' (AD '+ad(k)+')';
  /* Which route is installed is graded by pairing: "installed" / "chosen"
     count only when they belong to the winner in the learner's sentence,
     and "not installed" / "backup" only when they belong to the loser — so
     "R1 installs the RIP route, not OSPF" scores nothing. Both names are
     subjects. A bare "lower" is not a term (each route has something lower),
     but "its AD" is, for "OSPF, because its AD is lower". "route because" is
     not: "the RIP route rather than the OSPF route because…" would give it
     to OSPF. "use" is taken only in front of the name ("OSPF uses cost" is
     not the router choosing). */
  const NAMES={ospf:['OSPF','OSPFv2','OSPFv3'], rip:['RIP','RIPv2','RIPng'], eigrp:['EIGRP']};
  const said=(k,terms)=>NAMES[k].map(s=>terms.map(t=>s+'~'+t).join('|')).join('|');
  const usesIt=k=>NAMES[k].map(s=>['use','using','go with','goes with','take','takes'].map(v=>v+' '+s).join('|')).join('|');
  const won=said(W,['R1 installs','R1 will install','R1 would install','R1 should install','R1 must install','it installs','will install','would install','to install','should install','must install','is installed','gets installed','be installed','is chosen','gets chosen','be chosen','choose','chooses','chose','prefer','prefers','is preferred','gets preferred','be preferred','pick','picks','is picked','select','selects','is selected','wins','winner','is used','be used','gets used','goes in','routing table','its AD','lower AD','lowest AD','lower administrative distance','lowest administrative distance','lower admin distance','AD is compared first','AD is checked first','AD comes first','AD first','AD is lower','AD is lowest','AD is smaller','AD is less','AD is better','AD of '+ad(W),'AD '+ad(W),'trusted more','more trusted','more trustworthy','more reliable','better AD','has the better AD','has a better AD'])+'|'+
    said(L,['not installed','not chosen','not used','not picked','not selected','not preferred','t installed','t chosen','t used','t be installed','t be chosen','t be used','t get installed','loses','lose','backup','reserve','standby'])+'|'+usesIt(W)+'|'+NAMES[L].map(n=>['is installed','gets installed','is chosen','gets chosen','wins','is the winner','is preferred','is used','gets used','route is used','route is chosen','route is installed','route gets installed','route is preferred','route wins','R1 installs','R1 chooses','R1 picks','R1 prefers','R1 uses','is picked','is selected'].map(v=>'!'+n+'~'+v).join('|')).join('|');
  const adNum=ad(W)+' is lower|'+ad(W)+' is less|'+ad(W)+' is smaller|'+ad(W)+' is better|lower than '+ad(L)+'|less than '+ad(L)+'|smaller than '+ad(L)+'|'+ad(W)+' < '+ad(L)+'|'+ad(W)+' vs '+ad(L)+'|'+ad(W)+' beats '+ad(L);
  const twoOf=[W,L].map(k=>['two # routes','two # paths','two routes from #','both # routes','both # paths','both from #','both learned by #','both learned from #','both routes from #','both came from #','both come from #','both routes came from #','both routes come from #','both routes are from #','both routes were from #','both are from #','both were from #','both are #','both were #','both #','inside #','within #','in # only','only in #','only within #','only inside #','between # routes','between two # routes','among # routes','if the routes are #','when the routes are #','if both routes are #','when both routes are #'].map(f=>f.replace('#',nm(k))).join('|')).join('|');
  const UNIT={ospf:'cost', rip:'hop count', eigrp:'metric'};
  const USES={ospf:['cost','bandwidth'], rip:['hops','hop count','the hop count','number of hops'], eigrp:['bandwidth and delay','bandwidth','delay']};
  const unitsOf=[W,L].map(k=>NAMES[k].map(n=>USES[k].map(u=>[n+' uses '+u,n+' counts '+u,n+' is based on '+u,n+' measures '+u,n+' metric is '+u,n+' metric is based on '+u].join('|')).join('|')).join('|')).join('|');
  return {
    prompt:'R1 has two routes to the same network: one learned by '+src(a)+', the other learned by '+src(b)+'. Which route does R1 install, and why? Do the two metrics play any part here? Explain why or why not, and say when the metric does decide between routes.',
    points: [
      '<b>Here:</b> [[R1 installs the '+nm(W)+' route|'+won+']] &mdash; it has the [[lower administrative distance|'+lowerAd+'|'+adNum+']] ('+nm(W)+' '+ad(W)+' against '+nm(L)+' '+ad(L)+'), and AD is compared before the metric, so '+nm(L)+'\'s lower metric of '+mL+' never comes into it.',
      '<b>The metrics play no part:</b> '+METRIC_NAME[L]+' and '+METRIC_NAME[W]+' are measured in [['+units+'|'+unitsOf+']], so '+mL+' is not &ldquo;better&rdquo; than '+mW+' &mdash; metrics are never compared across sources.',
      '<b>When the metric decides:</b> only between routes from the [[same routing protocol|'+sameSrc+'|'+twoOf+']] (same AD) &mdash; e.g. if R1 had two '+nm(W)+' routes to that network, the one with the lower '+UNIT[W]+' would be installed; with equal metrics both would be installed and traffic load balanced.',
    ],
  };
}});

card({id:'q1d-floating', area:'routing', tier:1, kind:'flash', src:'Q1 d', title:'Floating static routes', gen(){
  const p=pick(['ospf','eigrp','rip']), N=PROTO[p].name, ad=PROTO[p].ad, eg=ad+10;
  const cmd=mono('ip route 10.1.1.0 255.255.255.0 10.2.2.2 '+eg);
  const lowest='[[lowest|lower|prefer|prefers|preferred|more trusted|most trusted|more believable|most believable|trustworthy]]';
  if(chance(.5)) return {
    prompt:'What is the purpose of a floating static route, and when does it get used? How do you make a static route a floating static route, and why does that work?',
    points: [
      'A floating static route is a [[backup|backup route|secondary|failover|fail over|standby]]: it stays out of the routing table while the primary route exists and is installed only if the primary [[fails|failure|goes down|lost|unavailable|disappears|removed]].',
      'Make it float by giving it an [[administrative distance|AD|admin distance|distance]] [[higher|greater|larger|bigger|more than|above]] than the primary route\'s &mdash; the AD goes at the end of the <span class="mono-inl">ip route</span> command.',
      '<b>Why it works:</b> of two routes to the same network the router installs the one with the '+lowest+' AD, so the primary wins while it exists; without the higher AD the static route gets the default AD of 1 and would replace the primary.',
      'e.g. primary learned by '+N+' (AD '+ad+'): '+cmd+' &mdash; any AD from '+(ad+1)+' to 254 works (255 means "never install").',
    ],
  };
  /* The scenario names the primary's protocol, so its answer is a number:
     any AD from ad+1 to 254. "#N" matches that number standing on its own,
     so a typed command's trailing AD or "set it to 150" counts but an
     octet of an address in the same answer never does. */
  const vals=['an AD of '+eg];
  for(let v=ad+1;v<255;v++) vals.push('#'+v);
  const site=pick(['head office','data centre','main site']), r='R'+ri(1,3);
  return {
    prompt: r+' learns the route to its '+site+' through '+N+'. You add a static route over a backup link that should be used only if the '+N+' route is lost. What is this kind of route called? State the AD of the '+N+' route and an AD you would give the static route, and explain why that stops the static route replacing the '+N+' route.',
    points: [
      '<b>Here:</b> it is a [[floating static route|floating static|floating route|floating]]. '+N+'\'s [[administrative distance|AD|admin distance|distance]] is [['+ad+']], so give the static route a higher one: [['+vals.join('|')+']] or anything from '+(ad+1)+' to 254, e.g. '+cmd+'.',
      '<b>Why:</b> of two routes to the same network the router installs the one with the '+lowest+' AD. '+N+'\'s '+ad+' beats the static route while the '+N+' route exists, so the static stays out of the routing table and is installed only if that route is lost &mdash; that is what makes it "float".',
      'Left at a static route\'s default AD of 1 it would beat '+N+'\'s '+ad+' and replace the '+N+' route at once. 255 means "never install", so it is no use here.',
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
        why: ul(['<b>Installed:</b> the '+PROTO[win.k].name+' route via '+win.nh+' (AD '+PROTO[win.k].ad+').',
          'Administrative distances: '+adList(keys)+'. Lowest AD wins: <b>'+PROTO[win.k].name+'</b>.',
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
      const inst=sh.filter((r,i)=>ans.indexOf(i)>=0);
      const what=inst.map(r=>'the '+PROTO[r.k].name+' route via '+r.nh+' (metric '+r.m+')').join(' and ');
      const why=['<b>Installed:</b> '+what+(inst.length>1?' &mdash; both, load-balanced.':'.'),
        'Step 1, AD: '+adList([...new Set(sh.map(r=>r.k))])+' &rarr; only the <b>'+PROTO[W].name+'</b> routes are considered.'];
      const ws=sh.filter(r=>r.k===W);
      if(ws.length>1) why.push('Step 2, metric: the '+PROTO[W].name+' routes have '+METRIC_NAME[W]+' '+ws.map(r=>r.m).join(' and ')+
        (ans.length>1?' &mdash; a tie, so <b>both</b> are installed and R1 load-balances across them.':' &rarr; the lower one, '+best+', wins.'));
      else why.push('There is only one '+PROTO[W].name+' route, so the metric never comes into it.');
      return {ok, verdict: ok?'Correct.':(ans.length>1?'Both equal-cost '+PROTO[W].name+' routes are installed.':'Only '+what+' is installed.'), why: ul(why)};
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
      const why=['<b>Used:</b> the '+PROTO[win.k].name+' '+cidr(win.net,win.p)+' route via '+win.nh+'.',
        int2ip(dest)+' matches '+match.map(r=>cidr(r.net,r.p)).join(', ')+'. The <b>longest prefix</b> wins: /'+longest+'.'];
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

/* ═══ Q1 — RIP (the exam brief lists it under Routing) ═══════════════════ */
card({id:'q1e-ripv2', area:'routing', tier:1, kind:'flash', src:'Q1', title:'RIPv1 vs RIPv2', gen(){
  if(chance(0.5)) return {
    prompt: 'Compare RIPv1 and RIPv2. Explain which of them is classful and which is classless (what their updates carry about the subnet mask), how each one sends its updates, and which one can authenticate them. Then say which metric both use, and which default behaviour at classful boundaries both start with but only RIPv2 can switch off.',
    points: [
      '<b>Masks:</b> [[RIPv1 classful and RIPv2 classless|RIPv1~classful|RIPv1~classfull|RIPv1~no mask|RIPv1~no masks|RIPv1~no subnet mask|RIPv1~no subnet masks|RIPv1~without mask|RIPv1~without masks|RIPv1~without a mask|RIPv1~without subnet masks|RIPv1~without a subnet mask|RIPv1~doesn\'t send mask|RIPv1~doesn\'t send masks|RIPv1~doesn\'t send subnet mask|RIPv1~doesn\'t send subnet masks|RIPv1~doesn\'t include mask|RIPv1~doesn\'t include masks|RIPv1~doesn\'t include subnet mask|RIPv1~doesn\'t include subnet masks|RIPv1~doesn\'t carry mask|RIPv1~doesn\'t carry masks|RIPv1~doesn\'t carry subnet mask|RIPv1~doesn\'t carry subnet masks|RIPv1~doesn\'t support VLSM|RIPv1~doesn\'t use mask|RIPv1~doesn\'t use masks|RIPv1~doesn\'t use subnet masks|RIPv1~doesn\'t have mask|RIPv1~doesn\'t have masks|RIPv1~doesn\'t have subnet masks|RIPv1~does not send mask|RIPv1~does not send masks|RIPv1~does not send subnet mask|RIPv1~does not send subnet masks|RIPv1~does not include mask|RIPv1~does not include masks|RIPv1~does not include subnet mask|RIPv1~does not include subnet masks|RIPv1~does not carry mask|RIPv1~does not carry masks|RIPv1~does not carry subnet mask|RIPv1~does not carry subnet masks|RIPv1~does not support VLSM|RIPv1~does not use mask|RIPv1~does not use masks|RIPv1~does not use subnet masks|RIPv1~does not have mask|RIPv1~does not have masks|RIPv1~does not have subnet masks|RIPv1~not send mask|RIPv1~not send masks|RIPv1~not send subnet masks|RIPv1~not include subnet masks|RIPv1~not carry subnet masks|RIPv1~not support VLSM|RIPv1~cannot do VLSM|RIPv1~can\'t do VLSM|RIPv1~cannot handle VLSM|RIPv1~can\'t handle VLSM|RIPv1~cannot use VLSM|RIPv1~can\'t use VLSM|RIPv1~no VLSM|RIPv1~without VLSM|RIPv1~lacks masks|RIPv1~lacks subnet masks|RIPv1~sends no mask|RIPv1~sends no subnet mask|RIP v1~classful|RIP v1~classfull|RIP v1~no mask|RIP v1~no masks|RIP v1~no subnet mask|RIP v1~no subnet masks|RIP v1~without mask|RIP v1~without masks|RIP v1~without a mask|RIP v1~without subnet masks|RIP v1~without a subnet mask|RIP v1~doesn\'t send mask|RIP v1~doesn\'t send masks|RIP v1~doesn\'t send subnet mask|RIP v1~doesn\'t send subnet masks|RIP v1~doesn\'t include mask|RIP v1~doesn\'t include masks|RIP v1~doesn\'t include subnet mask|RIP v1~doesn\'t include subnet masks|RIP v1~doesn\'t carry mask|RIP v1~doesn\'t carry masks|RIP v1~doesn\'t carry subnet mask|RIP v1~doesn\'t carry subnet masks|RIP v1~doesn\'t support VLSM|RIP v1~doesn\'t use mask|RIP v1~doesn\'t use masks|RIP v1~doesn\'t use subnet masks|RIP v1~doesn\'t have mask|RIP v1~doesn\'t have masks|RIP v1~doesn\'t have subnet masks|RIP v1~does not send mask|RIP v1~does not send masks|RIP v1~does not send subnet mask|RIP v1~does not send subnet masks|RIP v1~does not include mask|RIP v1~does not include masks|RIP v1~does not include subnet mask|RIP v1~does not include subnet masks|RIP v1~does not carry mask|RIP v1~does not carry masks|RIP v1~does not carry subnet mask|RIP v1~does not carry subnet masks|RIP v1~does not support VLSM|RIP v1~does not use mask|RIP v1~does not use masks|RIP v1~does not use subnet masks|RIP v1~does not have mask|RIP v1~does not have masks|RIP v1~does not have subnet masks|RIP v1~not send mask|RIP v1~not send masks|RIP v1~not send subnet masks|RIP v1~not include subnet masks|RIP v1~not carry subnet masks|RIP v1~not support VLSM|RIP v1~cannot do VLSM|RIP v1~can\'t do VLSM|RIP v1~cannot handle VLSM|RIP v1~can\'t handle VLSM|RIP v1~cannot use VLSM|RIP v1~can\'t use VLSM|RIP v1~no VLSM|RIP v1~without VLSM|RIP v1~lacks masks|RIP v1~lacks subnet masks|RIP v1~sends no mask|RIP v1~sends no subnet mask|v1~classful|v1~classfull|v1~no mask|v1~no masks|v1~no subnet mask|v1~no subnet masks|v1~without mask|v1~without masks|v1~without a mask|v1~without subnet masks|v1~without a subnet mask|v1~doesn\'t send mask|v1~doesn\'t send masks|v1~doesn\'t send subnet mask|v1~doesn\'t send subnet masks|v1~doesn\'t include mask|v1~doesn\'t include masks|v1~doesn\'t include subnet mask|v1~doesn\'t include subnet masks|v1~doesn\'t carry mask|v1~doesn\'t carry masks|v1~doesn\'t carry subnet mask|v1~doesn\'t carry subnet masks|v1~doesn\'t support VLSM|v1~doesn\'t use mask|v1~doesn\'t use masks|v1~doesn\'t use subnet masks|v1~doesn\'t have mask|v1~doesn\'t have masks|v1~doesn\'t have subnet masks|v1~does not send mask|v1~does not send masks|v1~does not send subnet mask|v1~does not send subnet masks|v1~does not include mask|v1~does not include masks|v1~does not include subnet mask|v1~does not include subnet masks|v1~does not carry mask|v1~does not carry masks|v1~does not carry subnet mask|v1~does not carry subnet masks|v1~does not support VLSM|v1~does not use mask|v1~does not use masks|v1~does not use subnet masks|v1~does not have mask|v1~does not have masks|v1~does not have subnet masks|v1~not send mask|v1~not send masks|v1~not send subnet masks|v1~not include subnet masks|v1~not carry subnet masks|v1~not support VLSM|v1~cannot do VLSM|v1~can\'t do VLSM|v1~cannot handle VLSM|v1~can\'t handle VLSM|v1~cannot use VLSM|v1~can\'t use VLSM|v1~no VLSM|v1~without VLSM|v1~lacks masks|v1~lacks subnet masks|v1~sends no mask|v1~sends no subnet mask|version 1~classful|version 1~classfull|version 1~no mask|version 1~no masks|version 1~no subnet mask|version 1~no subnet masks|version 1~without mask|version 1~without masks|version 1~without a mask|version 1~without subnet masks|version 1~without a subnet mask|version 1~doesn\'t send mask|version 1~doesn\'t send masks|version 1~doesn\'t send subnet mask|version 1~doesn\'t send subnet masks|version 1~doesn\'t include mask|version 1~doesn\'t include masks|version 1~doesn\'t include subnet mask|version 1~doesn\'t include subnet masks|version 1~doesn\'t carry mask|version 1~doesn\'t carry masks|version 1~doesn\'t carry subnet mask|version 1~doesn\'t carry subnet masks|version 1~doesn\'t support VLSM|version 1~doesn\'t use mask|version 1~doesn\'t use masks|version 1~doesn\'t use subnet masks|version 1~doesn\'t have mask|version 1~doesn\'t have masks|version 1~doesn\'t have subnet masks|version 1~does not send mask|version 1~does not send masks|version 1~does not send subnet mask|version 1~does not send subnet masks|version 1~does not include mask|version 1~does not include masks|version 1~does not include subnet mask|version 1~does not include subnet masks|version 1~does not carry mask|version 1~does not carry masks|version 1~does not carry subnet mask|version 1~does not carry subnet masks|version 1~does not support VLSM|version 1~does not use mask|version 1~does not use masks|version 1~does not use subnet masks|version 1~does not have mask|version 1~does not have masks|version 1~does not have subnet masks|version 1~not send mask|version 1~not send masks|version 1~not send subnet masks|version 1~not include subnet masks|version 1~not carry subnet masks|version 1~not support VLSM|version 1~cannot do VLSM|version 1~can\'t do VLSM|version 1~cannot handle VLSM|version 1~can\'t handle VLSM|version 1~cannot use VLSM|version 1~can\'t use VLSM|version 1~no VLSM|version 1~without VLSM|version 1~lacks masks|version 1~lacks subnet masks|version 1~sends no mask|version 1~sends no subnet mask|RIP version 1~classful|RIP version 1~classfull|RIP version 1~no mask|RIP version 1~no masks|RIP version 1~no subnet mask|RIP version 1~no subnet masks|RIP version 1~without mask|RIP version 1~without masks|RIP version 1~without a mask|RIP version 1~without subnet masks|RIP version 1~without a subnet mask|RIP version 1~doesn\'t send mask|RIP version 1~doesn\'t send masks|RIP version 1~doesn\'t send subnet mask|RIP version 1~doesn\'t send subnet masks|RIP version 1~doesn\'t include mask|RIP version 1~doesn\'t include masks|RIP version 1~doesn\'t include subnet mask|RIP version 1~doesn\'t include subnet masks|RIP version 1~doesn\'t carry mask|RIP version 1~doesn\'t carry masks|RIP version 1~doesn\'t carry subnet mask|RIP version 1~doesn\'t carry subnet masks|RIP version 1~doesn\'t support VLSM|RIP version 1~doesn\'t use mask|RIP version 1~doesn\'t use masks|RIP version 1~doesn\'t use subnet masks|RIP version 1~doesn\'t have mask|RIP version 1~doesn\'t have masks|RIP version 1~doesn\'t have subnet masks|RIP version 1~does not send mask|RIP version 1~does not send masks|RIP version 1~does not send subnet mask|RIP version 1~does not send subnet masks|RIP version 1~does not include mask|RIP version 1~does not include masks|RIP version 1~does not include subnet mask|RIP version 1~does not include subnet masks|RIP version 1~does not carry mask|RIP version 1~does not carry masks|RIP version 1~does not carry subnet mask|RIP version 1~does not carry subnet masks|RIP version 1~does not support VLSM|RIP version 1~does not use mask|RIP version 1~does not use masks|RIP version 1~does not use subnet masks|RIP version 1~does not have mask|RIP version 1~does not have masks|RIP version 1~does not have subnet masks|RIP version 1~not send mask|RIP version 1~not send masks|RIP version 1~not send subnet masks|RIP version 1~not include subnet masks|RIP version 1~not carry subnet masks|RIP version 1~not support VLSM|RIP version 1~cannot do VLSM|RIP version 1~can\'t do VLSM|RIP version 1~cannot handle VLSM|RIP version 1~can\'t handle VLSM|RIP version 1~cannot use VLSM|RIP version 1~can\'t use VLSM|RIP version 1~no VLSM|RIP version 1~without VLSM|RIP version 1~lacks masks|RIP version 1~lacks subnet masks|RIP version 1~sends no mask|RIP version 1~sends no subnet mask|RIPv2~classless|RIPv2~classless routing|RIPv2~carries the mask|RIPv2~carries masks|RIPv2~carries subnet masks|RIPv2~carries the subnet mask|RIPv2~sends the mask|RIPv2~sends masks|RIPv2~sends subnet masks|RIPv2~sends the subnet mask|RIPv2~sends the mask with|RIPv2~includes the mask|RIPv2~includes masks|RIPv2~includes subnet masks|RIPv2~includes the subnet mask|RIPv2~subnet mask|RIPv2~subnet masks|RIPv2~mask|RIPv2~masks|RIPv2~VLSM|RIPv2~supports VLSM|RIPv2~CIDR|RIPv2~variable-length|RIPv2~variable length|RIPv2~discontiguous|RIP v2~classless|RIP v2~classless routing|RIP v2~carries the mask|RIP v2~carries masks|RIP v2~carries subnet masks|RIP v2~carries the subnet mask|RIP v2~sends the mask|RIP v2~sends masks|RIP v2~sends subnet masks|RIP v2~sends the subnet mask|RIP v2~sends the mask with|RIP v2~includes the mask|RIP v2~includes masks|RIP v2~includes subnet masks|RIP v2~includes the subnet mask|RIP v2~subnet mask|RIP v2~subnet masks|RIP v2~mask|RIP v2~masks|RIP v2~VLSM|RIP v2~supports VLSM|RIP v2~CIDR|RIP v2~variable-length|RIP v2~variable length|RIP v2~discontiguous|v2~classless|v2~classless routing|v2~carries the mask|v2~carries masks|v2~carries subnet masks|v2~carries the subnet mask|v2~sends the mask|v2~sends masks|v2~sends subnet masks|v2~sends the subnet mask|v2~sends the mask with|v2~includes the mask|v2~includes masks|v2~includes subnet masks|v2~includes the subnet mask|v2~subnet mask|v2~subnet masks|v2~mask|v2~masks|v2~VLSM|v2~supports VLSM|v2~CIDR|v2~variable-length|v2~variable length|v2~discontiguous|version 2~classless|version 2~classless routing|version 2~carries the mask|version 2~carries masks|version 2~carries subnet masks|version 2~carries the subnet mask|version 2~sends the mask|version 2~sends masks|version 2~sends subnet masks|version 2~sends the subnet mask|version 2~sends the mask with|version 2~includes the mask|version 2~includes masks|version 2~includes subnet masks|version 2~includes the subnet mask|version 2~subnet mask|version 2~subnet masks|version 2~mask|version 2~masks|version 2~VLSM|version 2~supports VLSM|version 2~CIDR|version 2~variable-length|version 2~variable length|version 2~discontiguous|RIP version 2~classless|RIP version 2~classless routing|RIP version 2~carries the mask|RIP version 2~carries masks|RIP version 2~carries subnet masks|RIP version 2~carries the subnet mask|RIP version 2~sends the mask|RIP version 2~sends masks|RIP version 2~sends subnet masks|RIP version 2~sends the subnet mask|RIP version 2~sends the mask with|RIP version 2~includes the mask|RIP version 2~includes masks|RIP version 2~includes subnet masks|RIP version 2~includes the subnet mask|RIP version 2~subnet mask|RIP version 2~subnet masks|RIP version 2~mask|RIP version 2~masks|RIP version 2~VLSM|RIP version 2~supports VLSM|RIP version 2~CIDR|RIP version 2~variable-length|RIP version 2~variable length|RIP version 2~discontiguous]]: RIPv1\'s updates carry no subnet mask, so it can\'t handle VLSM or discontiguous networks, while every RIPv2 route is sent with its mask.',
      '<b>Updates:</b> [[RIPv1 broadcasts and RIPv2 multicasts|RIPv1~broadcast|RIPv1~broadcasts|RIPv1~broadcasting|RIPv1~255.255.255.255|RIPv1~broadcast address|RIP v1~broadcast|RIP v1~broadcasts|RIP v1~broadcasting|RIP v1~255.255.255.255|RIP v1~broadcast address|v1~broadcast|v1~broadcasts|v1~broadcasting|v1~255.255.255.255|v1~broadcast address|version 1~broadcast|version 1~broadcasts|version 1~broadcasting|version 1~255.255.255.255|version 1~broadcast address|RIP version 1~broadcast|RIP version 1~broadcasts|RIP version 1~broadcasting|RIP version 1~255.255.255.255|RIP version 1~broadcast address|RIPv2~multicast|RIPv2~multicasts|RIPv2~multicasting|RIPv2~224.0.0.9|RIPv2~multicast address|RIP v2~multicast|RIP v2~multicasts|RIP v2~multicasting|RIP v2~224.0.0.9|RIP v2~multicast address|v2~multicast|v2~multicasts|v2~multicasting|v2~224.0.0.9|v2~multicast address|version 2~multicast|version 2~multicasts|version 2~multicasting|version 2~224.0.0.9|version 2~multicast address|RIP version 2~multicast|RIP version 2~multicasts|RIP version 2~multicasting|RIP version 2~224.0.0.9|RIP version 2~multicast address]]: v1 sends to 255.255.255.255, v2 to 224.0.0.9, so hosts that don\'t run RIP aren\'t disturbed.',
      '<b>Security:</b> [[RIPv2 can authenticate|RIPv2~authenticate|RIPv2~authenticates|RIPv2~authentication|RIPv2~authenticated|RIPv2~MD5|RIPv2~password|RIPv2~passwords|RIPv2~secure|RIPv2~security|RIP v2~authenticate|RIP v2~authenticates|RIP v2~authentication|RIP v2~authenticated|RIP v2~MD5|RIP v2~password|RIP v2~passwords|RIP v2~secure|RIP v2~security|v2~authenticate|v2~authenticates|v2~authentication|v2~authenticated|v2~MD5|v2~password|v2~passwords|v2~secure|v2~security|version 2~authenticate|version 2~authenticates|version 2~authentication|version 2~authenticated|version 2~MD5|version 2~password|version 2~passwords|version 2~secure|version 2~security|RIP version 2~authenticate|RIP version 2~authenticates|RIP version 2~authentication|RIP version 2~authenticated|RIP version 2~MD5|RIP version 2~password|RIP version 2~passwords|RIP version 2~secure|RIP version 2~security]] its updates (plain text or MD5); v1 can\'t.',
      '<b>In common:</b> both use [[hop count|hops|hop]] as the metric (15 at most), AD 120 and updates every 30 s, and both [[auto-summarise|auto-summary|auto summary|automatically summarise|summarise|summarises|summarisation]] at classful boundaries by default &mdash; only v2 can turn that off with '+mono('no auto-summary')+'.',
    ],
  };
  return {
    prompt: 'Why would you configure '+mono('version 2')+' under '+mono('router rip')+' rather than leave RIP at version 1? Give three advantages of RIPv2 &mdash; how it handles subnet masks compared with v1, how it sends its updates, and what it adds for security &mdash; and say which default behaviour you would turn off once it is running.',
    points: [
      '<b>Masks:</b> RIPv2 is [[classless|subnet mask|subnet masks|carries the mask|sends the mask|includes the mask|carries masks|sends masks|includes masks|VLSM|CIDR|variable-length|variable length|discontiguous]]: every route is sent with its mask (v1, being classful, sends none), so VLSM and discontiguous networks work.',
      '<b>Updates:</b> RIPv2 [[multicasts|multicast|224.0.0.9]] them to 224.0.0.9 instead of broadcasting, so hosts that don\'t run RIP aren\'t disturbed.',
      '<b>Security:</b> RIPv2 can [[authenticate|authentication|MD5]] its updates, so a router won\'t accept routes from an unauthorised neighbour; v1 can\'t.',
      '<b>Then:</b> turn off [[auto-summary|auto-summarise|auto summary|automatic summarisation|automatically summarise|summarisation]] with '+mono('no auto-summary')+', so the subnets are advertised as they are rather than summarised to their classful network.',
    ],
  };
}});
card({id:'q1f-riploops', area:'routing', tier:1, kind:'flash', src:'Q1', title:'RIP hop limit and split horizon', gen(){
  const sh='<b>Split horizon:</b> a router doesn\'t [[advertise a route back out the interface it was learned on|advertise~back|send~back|announce~back|advertise~same interface|send~same interface|out the interface it|out the same interface|interface it was learned|interface it learned|interface it came|interface it was received|interface it received|interface it arrived]], so two neighbours can\'t keep [[feeding each other|feed each other|feeds each other|ping-pong|pass it between each other|keep passing it between]] a route that has gone.';
  const loop='[[routing loop|routing loops|forwarding loop|forwarding loops|endless loop|loop in the network|loops in the network|loop in a network|forms a loop|form a loop|creates a loop|create a loop|stuck in a loop|prevent loops|prevents loops|stop loops|stops loops|avoid loops|avoids loops]]';
  const inf='[[counting to infinity|count to infinity|count-to-infinity|counts to infinity|count up to infinity|counting up to infinity|count forever|counts forever|count up forever|counting up forever|infinite loop|infinite loops|infinite looping|infinitely looping|loop infinitely|loops infinitely|looping infinitely|infinite count|infinitely|loop forever|loops forever|looping forever|looped forever|keep looping|keeps looping|go on forever|goes on forever|going on forever|carry on forever|increase forever|increases forever|increasing forever|rise forever|rises forever|grow forever|grows forever|for ever|forever]]';
  const sixteen='[[16 means unreachable|16~unreachable|16~infinity|16~infinite|16~invalid|16~dropped|16~removed|16~discarded|16~down|16~too far|16~gone|16~forever|16~dead|16~invalid route|sixteen~unreachable|sixteen~infinity|sixteen~dropped|sixteen~gone|sixteen~forever|sixteen~dead|sixteen~removed|sixteen~infinite]]';
  if(chance(.5)) return {
    prompt:'Why is a RIP network limited to 15 hops? Say what RIP uses as its metric, what a metric of 16 means, and what problem the limit prevents. Then explain what split horizon is and why RIP uses it.',
    points: [
      'RIP\'s metric is the [[hop count|hop counts|hops|number of routers]]: each router adds one as it passes a route on to its neighbours (every 30 seconds).',
      'A metric of '+sixteen+', so 15 is the highest usable metric and a RIP network can be at most 15 hops across.',
      'The limit stops '+inf+': a dead route\'s metric keeps rising round the network until it reaches 16 and is dropped, instead of growing for ever.',
      sh,
      'RIP uses it to avoid a '+loop+': it is a distance-vector protocol that only knows what its neighbours tell it, so split horizon is what stops the simplest two-router loops forming. Route poisoning goes further: a failed route is advertised with metric 16 so neighbours remove it straight away.',
    ],
  };
  return {
    prompt:'A link fails in a RIP network. Describe the problem that can happen as the routers keep advertising the dead route to each other and what happens to its metric, then explain how the 16-hop limit and split horizon each stop it.',
    points: [
      'Without protection the routers form a '+loop+': each one thinks it can reach the dead network through the other and passes the route back and forth.',
      'Every time the route goes round, the router [[adds one hop|add one hop|adds a hop|add a hop|adds one|add one|plus one|increases by one|increase by one|increments|incremented|goes up by one|going up by one|keeps increasing|keep increasing|keeps going up|keep going up|keeps rising|keep rising|keeps growing|keep growing]] to its metric, so the routers are '+inf+'.',
      'The limit ends it: a metric of '+sixteen+', so once the count reaches 16 the route is dropped instead of growing for ever.',
      sh,
      'Route poisoning goes further: a failed route is advertised with metric 16 so neighbours remove it straight away.',
    ],
  };
}});
card({id:'q1g-autosum', area:'routing', tier:2, kind:'flash', src:'Q1', title:'RIP and discontiguous networks', gen(){
  /* One major network split in two by another: the two LAN routers each
     summarise their LAN to the classful network, and the router between
     them hears that one route from both sides. The class varies, so the
     summary has to be worked out rather than remembered as "the /16", and
     so does which router sits in the middle, so the answer has to name it. */
  const cls=pick(['B','B','A','C']);
  let maj, pfx, lans, lp, link;
  if(cls==='A'){ const p=ri(1,200), r=p+ri(1,54); maj='10.0.0.0'; pfx=8; lp=24; lans=['10.'+p+'.'+ri(0,255)+'.0','10.'+r+'.'+ri(0,255)+'.0']; link='172.'+ri(16,31)+'.0.0'; }
  else if(cls==='B'){ const b=ri(16,31), x=ri(1,120), y=x+ri(1,100); maj='172.'+b+'.0.0'; pfx=16; lp=24; lans=['172.'+b+'.'+x+'.0','172.'+b+'.'+y+'.0']; link='10.0.0.0'; }
  else { const c=ri(1,254), s=shuffle([1,2,3]).slice(0,2).sort((a,b)=>a-b); maj='192.168.'+c+'.0'; pfx=24; lp=26; lans=s.map(i=>'192.168.'+c+'.'+(64*i)); link='10.0.0.0'; }
  const sum=maj+'/'+pfx, lan=i=>lans[i]+'/'+lp;
  const mask=['','255.0.0.0','255.255.0.0','255.255.255.0'][pfx/8];
  const M=pick(['R1','R2','R3']), [A,B]=['R1','R2','R3'].filter(r=>r!==M);
  /* The summary: its own prefix length, never the bare network, so a
     /24 for a class A round does not count. */
  const sumF=[sum,maj+' '+mask,'/'+pfx+' summary','/'+pfx+' route','/'+pfx+' network','classful summary','classful network','major network'];
  /* Which router ends up with two routes is graded by pairing: the terms
     count only for the middle router (or "the middle router"), so "R1 gets
     the /16 from both sides" scores nothing when R2 is in the middle. The
     two LAN routers are subjects too, through "R1 ... to R2" (the direction
     the summary travels), which is what lets a sentence naming all three be
     read correctly. Bare "both" is not a term: it is a linking word, and
     "from both R1 and R3" would hand it to R1. */
  const T=['both sides','both directions','both neighbours','both neighbors','both routers','both ends','both interfaces','both links','both of its interfaces','both of its links','both of them','both of its neighbours','both of its neighbors','from both of them','from both of its',
    'each side','either side','either direction','either neighbour','two neighbours','two neighbors','two sides','two interfaces','two sources','two directions','two routes','two paths','two equal','two copies','two next hops','two entries','2 routes','2 paths','2 equal','2 entries','twice','duplicate routes',
    'equal cost','same hop count','same metric','equal metric','equal hop count','same network','same route','same summary','same prefix','same update','same advertisement'];
  [[A,B],[B,A]].forEach(([x,y])=>T.push('both '+x+' and '+y,'from '+x+' and '+y,'from '+x+' and from '+y,'via '+x+' and '+y,'through '+x+' and '+y,'between '+x+' and '+y));
  const both=[M,'middle'].map(s=>T.map(t=>s+'~'+t).join('|')).join('|')+'|'+[A,B].map(s=>s+'~to '+M).join('|');
  /* "no auto-summary" said any way a student says it. */
  const NOUN=['auto-summary','autosummary','automatic summarisation','automatic summary'];
  const VERB=['disabled','turned off','switched off','off','removed','stopped','deactivated','not enabled','not used','not on'];
  const LEAD=['','is ','are ','should be ','must be ','needs to be ','has to be ','have to be ','can be ','be '];
  const noAuto=[];
  NOUN.forEach(n=>{
    noAuto.push('no '+n,'without '+n,'turn '+n+' off','switch '+n+' off','turning '+n+' off','stop '+n,'stopping '+n);
    ['disable','disabling','turn off','turning off','switch off','switching off','remove','removing','deactivate'].forEach(v=>noAuto.push(v+' '+n));
    LEAD.forEach(l=>VERB.forEach(v=>noAuto.push(n+' '+l+v)));
  });
  noAuto.push('disable summarisation','disabling summarisation','turn off summarisation','turning off summarisation');
  /* Every router, said any way a student says it, including by name. */
  const every=['all three routers','every router','all routers','all three','all 3','all the routers','all of the routers','all of them','all of the three','the three routers','the 3 routers','three routers','3 routers','all 3 of the routers','all three of the routers','all three of them','each router','each of the routers','each of the three','each of them','every one of them','every RIP router','including the middle router','also the middle router','every router running RIP','including '+M,'also on '+M,'as well as '+M,'even '+M];
  [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]].forEach(p=>{ const n=p.map(i=>'R'+(i+1)); every.push(n[0]+' '+n[1]+' and '+n[2],n[0]+' '+n[1]+' '+n[2]); });
  /* Splitting the traffic between two equal routes, said any way a student
     says it. Not "half" or "the wrong way" on their own: a routing loop
     loses half the traffic too, and that is a different diagnosis. */
  const lb=['load-balances','load balance','load balancing','load balanced','load-share','load shares','load sharing','ECMP','equal cost load','round robin','round-robin','per packet','per-packet',
    'alternates between','alternate between','alternating between','alternates packets','alternate packets','alternating packets','alternates traffic','alternates the packets','alternates the traffic',
    'splits traffic','split traffic','splits the traffic','split the traffic','traffic is split','traffic gets split','traffic split','splits packets','split packets','split across','splits across','split between','splits between','splitting traffic','splitting the traffic',
    'divides traffic','divide traffic','divides the traffic','traffic is divided','divided between','divided across','divided equally',
    'shares traffic','share traffic','shares the traffic','share the traffic','shared between','shared across',
    'spreads traffic','spread traffic','spreads the traffic','spread the traffic','spread across','spread between','spread over','spreads across','spreads between',
    'distributes traffic','distribute traffic','distributes the traffic','distributes packets','distributed across','distributed between','distributed evenly',
    'balances traffic','balance traffic','balances the traffic','balances between','balance between','balances across',
    'uses both','use both','using both','used both','down both','over both','across both','through both','via both','sends to both','sends traffic to both','sends packets to both','sent to both',
    'both routes equally','both paths equally','both links equally','equally between','equally across','50/50','fifty fifty',
    'half to each','half the traffic to each','half of the traffic to each','half the packets to each','half of the packets to each','half via each','half down each','half each way','half goes to each'];
  return {
    prompt: A+'\'s LAN is '+lan(0)+' and '+B+'\'s LAN is '+lan(1)+'. Between them, '+M+' connects to both over '+link+' links. All three run RIP with the default settings, and the two LANs can\'t reliably reach each other. Explain why: what route do '+A+' and '+B+' advertise to '+M+', why, and what does '+M+' do with it? Then say what you would change, and on which routers.',
    points: [
      '<b>Here:</b> '+A+' and '+B+' each advertise their LAN only as [['+sumF.join('|')+']], so [['+M+' learns that one route from both '+A+' and '+B+'|'+both+']] and can\'t tell which side each LAN is on. Fix: [[version 2|v2|ripv2|RIP v2|RIP version 2]] and [[no auto-summary|'+noAuto.join('|')+']] under '+mono('router rip')+' on [[all three routers|'+every.join('|')+']].',
      '<b>Why:</b> RIP [[auto-summarises|autosummary|auto summary|auto summarisation|automatic summarisation|automatic summary|automatically summarise|RIP summarises|summarises at|summarises when|summarises as|summarises before|summarises across|are summarised|is summarised|get summarised|gets summarised|summarised by|classful boundary|classful boundaries|major network boundary]] at the classful boundary by default. '+lan(0)+' and '+lan(1)+' are both in the class '+cls+' network '+sum+', so crossing into '+link+' each LAN router advertises just '+sum+'.',
      'Both routes are 1 hop, so '+M+' [[load-balances|'+lb.join('|')+']] between them and about half the traffic for each LAN goes to the wrong one.',
      'This is a discontiguous network ('+sum+' split by '+link+'), and RIPv1 can\'t fix it because its updates carry no masks. With v2 and auto-summary off the /'+lp+'s are advertised as they are, so '+M+' learns '+lan(0)+' via '+A+' and '+lan(1)+' via '+B+'. '+M+' needs the fix too: it crosses the boundary again when it passes each LAN on.',
    ],
  };
}});

/* The classful network a RIP "network" statement stands for. */
function classfulNet(ip){ const o=ip>>>24; const p=o<128?8:o<192?16:24; return {net:netOf(ip,p), pfx:p}; }
card({id:'g1-rip', area:'routing', tier:2, kind:'graded', src:'Q1', title:'Configure RIPv2', gen(){
  const lanA=ip2int('192.168.'+ri(0,254)+'.0'), two=chance(.6), lanB=ip2int('172.'+ri(16,31)+'.'+ri(0,255)+'.0');
  const w1=rLink30(); let w2=null; if(chance(.5)) for(;;){ w2=ip2int('10.'+(w1>>>16&255)+'.'+ri(0,255)+'.'+(ri(0,63)*4)); if(w2!==w1) break; }
  const ifs=[{name:'G0/0', n:'g0/0', ip:lanA+1, pfx:24, lan:true}];
  if(two) ifs.push({name:'G0/1', n:'g0/1', ip:lanB+1, pfx:24, lan:true});
  ifs.push({name:'S0/0/0', n:'s0/0/0', ip:w1+1, pfx:30, lan:false, to:'R2'});
  if(w2!=null) ifs.push({name:'S0/0/1', n:'s0/0/1', ip:w2+1, pfx:30, lan:false, to:'R3'});
  const majors=[...new Set(ifs.map(f=>classfulNet(f.ip).net))];
  const lanIfs=ifs.filter(f=>f.lan).map(f=>f.n);
  const model=['router rip',' version 2',' no auto-summary'].concat(majors.map(m=>' network '+int2ip(m))).concat(ifs.filter(f=>f.lan).map(f=>' passive-interface '+f.name));
  return {
    prompt:'Configure <b>RIPv2</b> on R1 so that it advertises all of its connected networks, turn <b>off automatic summarisation</b>, and stop RIP updates being sent out of the LAN interface'+(two?'s':'')+'.',
    body:'<div class="ex-scroll"><table class="rt-table ex-table"><thead><tr><th>R1 interface</th><th>Address</th><th>Connects to</th></tr></thead><tbody>'+
      ifs.map(f=>'<tr><td>'+f.name+'</td><td>'+int2ip(f.ip)+'/'+f.pfx+'</td><td style="font-family:var(--font)">'+(f.lan?'LAN (PCs only)':f.to)+'</td></tr>').join('')+'</tbody></table></div>'+
      cmdsHtml('rip','Commands &mdash; one per line, Ctrl+Enter submits','e.g. router rip',6),
    grade(){
      let why=null, inRip=false, v2=false, noAuto=false, pasDef=false; const nets=new Set(), pas=new Set(), notPas=new Set();
      for(const raw of cmdLines('rip')){
        const l=iosNorm(raw); let m;
        if(l==='router rip'){ inRip=true; continue; }
        if(l==='exit'||l==='end') continue;
        if(!inRip){ why='"'+raw+'" goes under router rip &mdash; start with that.'; break; }
        if(l==='version 2'){ v2=true; continue; }
        if(l==='version 1'){ why='The brief asks for RIPv2.'; break; }
        if(l==='no auto-summary'){ noAuto=true; continue; }
        if((m=/^network (\S+)$/.exec(l))){ const a=ip2int(m[1]); if(a==null){ why='"'+raw+'" has an invalid address.'; break; } nets.add(classfulNet(a).net); continue; }
        if(l==='passive-interface default'){ pasDef=true; continue; }
        if((m=/^(no )?passive-interface (.+)$/.exec(l))){ (m[1]?notPas:pas).add(NR.acIfNorm(m[2].replace(/\s+/g,''))); continue; }
        why='"'+raw+'" isn\'t needed here.'; break;
      }
      if(!why&&!inRip) why='Start with router rip.';
      if(!why&&!v2) why='RIP runs version 1 until you type version 2.';
      if(!why&&!noAuto) why='Automatic summarisation is still on: add no auto-summary.';
      if(!why){ const miss=majors.filter(m=>!nets.has(m)), extra=[...nets].filter(n=>majors.indexOf(n)<0);
        if(miss.length) why='Nothing advertises '+miss.map(int2ip).join(', ')+'.';
        else if(extra.length) why='R1 has no interface in '+extra.map(int2ip).join(', ')+'.'; }
      if(!why){
        const isPas=n=>pasDef?!notPas.has(n):pas.has(n);
        const wanP=ifs.filter(f=>!f.lan&&isPas(f.n)), lanN=ifs.filter(f=>f.lan&&!isPas(f.n));
        if(wanP.length) why=wanP[0].name+' is passive, so R1 would stop exchanging updates with '+wanP[0].to+'.';
        else if(lanN.length) why=lanN[0].name+' still sends RIP updates onto the LAN &mdash; make it passive.';
      }
      markCmds('rip',!why,model.join('\n'),why);
      return {ok:!why, verdict: !why?'Correct.':'Not quite.', why: ul([...(why?[why]:[]),'e.g.<br>'+model.map(l=>mono(l.trim())).join('<br>'),
        'RIP '+mono('network')+' commands take the <b>classful</b> network'+(majors.length<ifs.length?' &mdash; one '+mono('network '+int2ip(classfulNet(w1+1).net))+' covers every interface in it':'')+'; a subnet address is turned into its classful network anyway.',
        mono('passive-interface')+' stops updates on the LANs (no routers there) while the LAN networks are still advertised.'])};
    },
  };
}});

card({id:'g1-riphops', area:'routing', tier:2, kind:'graded', src:'Q1', title:'RIP hop count along a chain', gen(){
  const net=rNet24(), unreach=chance(.45);
  let m, k;
  do{ m=ri(1,14); k=ri(1,5); }while((m+k>15)!==unreach);
  const far='R'+(2+k), hop=m+k, link=int2ip(rLink30()+1);
  const chain=['R1','R2'].concat(Array.from({length:k},(_,i)=>'R'+(3+i))).join(' &ndash; ');
  return {
    prompt:'The routers are chained '+chain+', all running RIPv2. R2 has learned <b>'+cidr(net,24)+'</b> from R1 as shown. The route is passed on down the chain to '+far+'. What hop count does <b>'+far+'</b> have for '+cidr(net,24)+', and is the route installed? (Type 16 if the network is unreachable.)',
    body: cliHtml('R      '+cidr(net,24)+' [120/'+m+'] via '+link+', 00:00:1'+ri(0,9)+', Serial0/0/0','R2# show ip route rip')+fieldHtml('hop','Hop count at '+far,'e.g. 7')+
      chipsHtml(['Installed in '+far+'\'s routing table','Not installed &mdash; unreachable']),
    grade(){
      const want=unreach?16:hop, okH=intOf(val('hop'))===want, okC=Q.choice===(unreach?1:0);
      markField('hop',okH,String(want)); markChips(unreach?1:0);
      const at16='R'+(2+16-m);
      return {ok:okH&&okC, verdict: okH&&okC?'Correct.':(unreach?'16 &mdash; unreachable.':hop+', installed.'), why: ul([
        unreach?'<b>'+far+': 16 &mdash; unreachable, so the route is not installed.</b>':'<b>'+far+': hop count '+hop+', and the route is installed.</b>',
        'In '+mono('[120/'+m+']')+', 120 is RIP\'s AD and '+m+' is R2\'s hop count. Each router further on adds 1: '+m+' + '+k+(unreach&&hop>16?' would be '+hop+'.':' = '+hop+'.'),
        unreach?'A metric of 16 is RIP\'s infinity: the count reaches 16 at '+(at16===far?far:at16+', so the route goes no further and '+far+' never learns it')+'. '+far+' treats '+cidr(net,24)+' as unreachable and doesn\'t install it &mdash; RIP networks can be at most 15 hops across.':
          hop+' is within RIP\'s 15-hop limit, so '+far+' installs the route.'])};
    },
  };
}});

/* ═══ Q2 — OSPF: router ID, cost, multi-area, timers ══════════════════════ */
card({id:'q2a-rid', area:'ospf', tier:1, kind:'flash', src:'Q2 a', title:'The OSPF router ID', gen(){
  return {
    prompt: pick([
      'How does OSPF use the router ID? Give two things it is used for. There are three ways that the value of the router ID can be determined: name them in the order the router tries them, and say when the router makes that choice.',
      'What is an OSPF router ID used for? Give two uses, then list the order in which a Cisco router chooses its router ID and say when the choice is made.',
    ]),
    points: [

      'The router ID is a 32-bit value written like an IPv4 address that [[uniquely identifies|unique|uniquely|identify|identifies|identifier|identification|identity]] the router in the OSPF domain: neighbours and the LSAs it originates are tracked by it, and it breaks ties in the [[DR/BDR election|DR|BDR|designated router|election]] (highest priority, then highest router ID).',
      '<b>1.</b> The <span class="mono-inl">[[router-id|router id]]</span> command under <span class="mono-inl">router ospf</span>.',
      '<b>2.</b> If there is none: the [[highest|largest|biggest]] IPv4 address on any [[loopback|loopbacks]] interface.',
      '<b>3.</b> If there are no loopbacks: the highest IPv4 address on an [[active|up interface|interfaces that are up|physical interface|physical interfaces|enabled|operational]] (up) physical interface.',
      'The first of those that exists [[when the OSPF process starts|process starts|process start|ospf starts|ospf start|startup|start up|boot|boots|reload|restart|clear ip ospf process|first configured|process is started]] is used. It then stays put until the process restarts &mdash; '+mono('clear ip ospf process')+' or a reload.',
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
  /* kwModel: keys shared by both variants. The prompts ask for the formula,
     the reference, which interfaces count and how they combine. */
  const IFBW='interface bandwidth|link bandwidth|port bandwidth|interface speed|link speed|port speed|speed of the interface|speed of the link|bandwidth of the interface|bandwidth of the link|bandwidth of each interface|bandwidth of each link|bandwidth of that interface|bandwidth of that link|divided by the bandwidth|divided by bandwidth|divide by the bandwidth|divide by bandwidth|divided by its bandwidth|divided by the link|divided by the speed|over the bandwidth|over bandwidth|over the link|by its bandwidth|by the bandwidth|by bandwidth|by the interface|by the link speed';
  const SUM='sum|total|add|added|adding|adds|summed|cumulative|accumulated|accumulate|combined|combine|combines|combining|equals|equal to|add up|adds up|added up|added together|plus';
  const OUT='outgoing|outbound|exit|egress|leaving|sent out|send out';
  if(chance(.5)) return {
    prompt:'What does OSPF use as its metric? If you do not specify the metric for a link explicitly, how does a Cisco router assign it a metric value? Give the formula and the default reference bandwidth it uses, and say how the link values combine along a path and which interfaces count.',
    points: [
      'OSPF\'s metric is [[cost]]. A route\'s cost is the [[' + SUM + ']] of the [[' + OUT + ']] interface costs along the path; lowest total wins.',
      'Default interface cost = [[reference bandwidth|reference|ref|ref bw|10^8|100000000]] &divide; [[' + IFBW + ']]. The reference is [[100 Mbps|100]], the result is rounded down, and the minimum is 1.',
      'So 10 Mbps &rarr; 10, a T1 serial (1544 kbps) &rarr; 64, and FastEthernet, GigabitEthernet and faster all &rarr; 1 &mdash; they can\'t be told apart.',
      'Fix that with '+mono('auto-cost reference-bandwidth 1000')+' (or higher) under '+mono('router ospf')+', the same on every router.',
      'You can also set it per interface: '+mono('ip ospf cost N')+', or change the '+mono('bandwidth')+' value the calculation uses.',
    ],
  };
  /* The two-link version names its links. Any link of 100 Mbps or faster
     costs 1 by default (the slower one exactly, the faster one because a
     cost can't go below 1), so the model answer is "both cost 1". */
  const LINKS=[
    {name:'FastEthernet', mbps:100, al:['FastEthernet','Fast Ethernet','Fa','FE']},
    {name:'GigabitEthernet', mbps:1000, al:['GigabitEthernet','Gigabit Ethernet','Gigabit','GigE','Gig','Gi','GE']},
    {name:'10-Gigabit Ethernet', mbps:10000, al:['10-Gigabit Ethernet','10 Gigabit','10-Gig','10GigE','10GE','10G','TenGigabitEthernet','Ten Gigabit','Ten Gig']}];
  const [A,B]=pick([[0,1],[0,2]]).map(i=>LINKS[i]);
  const mb=n=>n>=10000?'10,000':String(n);
  const calc=(L,lead)=>L.name+' ('+mb(L.mbps)+' Mbps)'+lead+' 100 &divide; '+mb(L.mbps)+(L.mbps===100?' = 1':' = '+(100/L.mbps)+', raised to 1');
  const ref=B.mbps>=10000?10000:1000, after=L=>Math.max(1,Math.floor(ref/L.mbps));
  const GEN=['both','each','they','same','equal','identical','all'];
  /* One key for the pair. A value is paired with a name ("Gigabit: 1",
     "1 for Gig") or with "both / each / they / same". It is the FASTER
     link's pairing that counts: the slower one is exactly 1 anyway, and the
     faster one being 1 as well is the answer. "0.1" is one token and "1 Gbps"
     is skipped (see kwTokens, kwFind), so neither is a cost of 1. */
  const f=['both cost 1','1 for both','1 each','one each','one for both',
    A.name+' costs 1 and '+B.name+' costs 1', A.name+' is 1 and '+B.name+' is 1'];
  GEN.concat(B.al).forEach(s=>{ f.push(s+'~1', s+'~costs one'); });
  B.al.forEach(s=>{ f.push('1 for '+s, 'one for '+s, '1 on '+s); });
  /* The slower link is declared as a subject too, so a value written next to
     ITS name is not handed to the faster link ("Fa is 1 but Gig is 0.1").
     The term can never be said, so these forms never match. */
  A.al.forEach(s=>{ f.push(s+'~no value of its own'); });
  const one=f.join('|');
  return {
    prompt:'How does a Cisco router work out the OSPF cost of a route? Give the formula for one interface, and say which interfaces along the path count and how their costs combine. By default, what cost does a '+A.name+' link get, and a '+B.name+' link? Explain why they end up the same, including the default reference bandwidth and the lowest cost an interface can have.',
    points: [
      '<b>Here:</b> by default the two links [['+one+']] &mdash; '+calc(A,' works out at')+', and '+calc(B,' at')+'. Equal costs, so OSPF can\'t tell the faster link from the slower one.',
      '<b>Why:</b> the default [[reference bandwidth|reference|ref|ref bw|10^8|100000000]] is only 100 Mbps, so any link of 100 Mbps or faster divides out to 1 or less &mdash; and a cost is a whole number with a '+
        '[[minimum of 1|minimum|lowest possible|lowest it can|lowest cost|below 1|less than 1|lower than 1|smaller than 1|at least 1|no lower than|no less than|round up|rounded up|rounds up|whole number|integer|fraction|fractional|decimal]], so a fraction counts as 1.',
      '<b>Cost of a route:</b> each interface\'s cost is the reference bandwidth &divide; the [['+IFBW+']]; '+
        'a route\'s cost is the [['+SUM+']] of the [['+OUT+']] interface costs along the path, and the lowest total wins.',
      'To tell them apart, set '+mono('auto-cost reference-bandwidth '+ref)+' (or higher) under '+mono('router ospf')+', the same on every router: '+A.name+' then costs '+after(A)+' and '+B.name+' costs '+after(B)+'.',
    ],
  };
}});

/* OSPF path cost. The exam gives every interface's cost — no bandwidth
   arithmetic (no calculators) — so these cards list them and test what to
   add up: the OUTGOING interface of each hop, the last router's LAN
   interface included, never the incoming ones. */
const COST_IF={
  ser: {pfx:'S0/0/', nums:[0,1],   costs:[64,64,48,128,390,781]},
  gig: {pfx:'G0/',   nums:[0,1,2], costs:[1,1,2,5,10]},
  fast:{pfx:'Fa0/',  nums:[0,1],   costs:[1,10,15]},
  eth: {pfx:'E0/',   nums:[0,1],   costs:[10]},
};
function costCell(n,c,lan){ return n+'<div class="ex-sub">cost '+c+(lan?' &middot; LAN':'')+'</div>'; }
card({id:'g2-cost-path', area:'ospf', tier:1, kind:'graded', src:'Q2 b', title:'Total cost of a path', gen(){
  const hops=ri(2,3), lan=rNet24(), routers=[];
  let inIf=null, inMed=null, prevOut=null;
  for(let i=0;i<=hops;i++){
    const r={name:'R'+(i+1)};
    if(inMed){
      r.inIf=inIf;
      // the far end of a link can carry a different cost; often it does, so adding everything up is wrong
      r.inC=chance(.7)?pick(COST_IF[inMed].costs.filter(c=>c!==prevOut).concat([prevOut+ri(2,30)])):prevOut;
    }
    const med=i<hops?pick(['ser','ser','gig','fast']):pick(['gig','fast','eth']);
    r.outIf=pick(COST_IF[med].nums.map(n=>COST_IF[med].pfx+n).filter(n=>n!==r.inIf)); r.out=pick(COST_IF[med].costs);
    routers.push(r);
    inMed=med; prevOut=r.out; inIf=COST_IF[med].pfx+pick(COST_IF[med].nums);
  }
  const total=routers.reduce((s,r)=>s+r.out,0);
  const rows=routers.map((r,i)=>[r.name, i?costCell(r.inIf,r.inC):'&mdash;', costCell(r.outIf,r.out,i===hops)]);
  return {
    prompt:'Traffic from R1 to the <b>'+cidr(lan,24)+'</b> LAN on R'+(hops+1)+' follows this path. Each interface\'s OSPF cost is shown. What is R1\'s total OSPF cost to that LAN?',
    body: '<div class="ex-scroll"><table class="rt-table ex-table"><thead><tr><th>Router</th><th>Interface in</th><th>Interface out</th></tr></thead><tbody>'+
      rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+fieldHtml('cost','Total cost','e.g. 75'),
    grade(){
      const ok=intOf(val('cost'))===total; markField('cost',ok,String(total));
      return {ok, verdict: ok?'Correct.':'The total cost is '+total+'.',
        why: ul(['R1\'s total cost to '+cidr(lan,24)+' is <b>'+total+'</b>: '+routers.map(r=>r.name+' '+r.outIf+' '+r.out).join(' + ')+'.',
          'OSPF adds up the cost of each <b>outgoing</b> interface along the path, including the last router\'s interface onto the LAN.',
          'The incoming interfaces don\'t count &mdash; their cost is what the far router uses for traffic coming back.'])};
    },
  };
}});

/* Two ways to the same LAN: R1–R2–R4, or R1–R3–R5–R4. Whether the path
   through fewer routers wins is decided up front at 50/50, so counting hops
   (RIP thinking) is worth nothing; the cheapest first hop is checked too. */
card({id:'g2-best-path', area:'ospf', tier:2, kind:'graded', src:'Q2 b', title:'Which way does OSPF go?', gen(){
  const C=[1,2,5,10,15,20,48,64,100], lan=rNet24(), wantShortWins=chance(.5), wantFirstWins=chance(.5);
  let c;
  for(let t=0;t<500;t++){
    c={a1:pick(C), a2:pick(C), b1:pick(C), b2:pick(C), b3:pick(C), L:pick([1,1,10])};
    const A=c.a1+c.a2+c.L, B=c.b1+c.b2+c.b3+c.L;
    if(A===B||c.a1===c.b1) continue;
    if((A<B)!==wantShortWins) continue;
    if(((A<B)===(c.a1<c.b1))!==wantFirstWins) continue;
    break;
  }
  const A=c.a1+c.a2+c.L, B=c.b1+c.b2+c.b3+c.L, viaR2=A<B;
  const back=()=>pick(C);
  const rows=[
    ['R1','S0/0/0','R2',c.a1],['R1','G0/1','R3',c.b1],
    ['R2','S0/0/0','R1',back()],['R2','S0/0/1','R4',c.a2],
    ['R3','G0/0','R1',back()],['R3','G0/1','R5',c.b2],
    ['R5','G0/0','R3',back()],['R5','G0/1','R4',c.b3],
    ['R4','G0/2','LAN '+cidr(lan,24),c.L],
  ];
  const opts=['Through R2','Through R3'];
  return {
    prompt:'R1 can reach the <b>'+cidr(lan,24)+'</b> LAN on R4 through R2 (R1&ndash;R2&ndash;R4) or through R3 (R1&ndash;R3&ndash;R5&ndash;R4). The OSPF cost of each interface is listed. Which way does R1 send the traffic, and what is its total cost to the LAN?',
    body: '<div class="ex-scroll"><table class="rt-table ex-table"><thead><tr><th>Router</th><th>Interface</th><th>Connects to</th><th>OSPF cost</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td><td style="font-family:var(--font)">'+r[2]+'</td><td>'+r[3]+'</td></tr>').join('')+'</tbody></table></div>'+
      chipsHtml(opts)+fieldHtml('cost','Total cost','e.g. 75'),
    grade(){
      const ans=viaR2?0:1, okC=Q.choice===ans, okT=intOf(val('cost'))===Math.min(A,B);
      markChips(ans); markField('cost',okT,String(Math.min(A,B)));
      return {ok:okC&&okT, verdict: okC&&okT?'Correct.':opts[ans]+', cost '+Math.min(A,B)+'.', why: ul([
        'R1 sends the traffic <b>'+(viaR2?'through R2':'through R3')+'</b>, total cost <b>'+Math.min(A,B)+'</b> &mdash; lower than the '+Math.max(A,B)+' '+(viaR2?'through R3':'through R2')+'.',
        'Via R2: '+c.a1+' (R1 S0/0/0) + '+c.a2+' (R2 S0/0/1) + '+c.L+' (R4 G0/2) = <b>'+A+'</b>.',
        'Via R3: '+c.b1+' (R1 G0/1) + '+c.b2+' (R3 G0/1) + '+c.b3+' (R5 G0/1) + '+c.L+' (R4 G0/2) = <b>'+B+'</b>.',
        'OSPF takes the lowest total cost'+(viaR2===false?' &mdash; even though it passes through more routers':'')+'. Only outgoing interfaces count, so the rows facing back towards R1 are ignored.'])};
    },
  };
}});

card({id:'q2c-multiarea', area:'ospf', tier:1, kind:'flash', src:'Q2 c', title:'Why multi-area OSPF', gen(){
  const LSDB='[[LSDB|link state database|link-state database|database|topology table]]',
        FLOOD='[[floods|flood|flooding|LSA|LSAs|updates]]',
        SPF='[[SPF|Dijkstra|recalculate|recalculation|recompute]]';
  const how=[
    '<b>Multi-area</b> is hierarchical: a [[backbone|area 0|area zero]] (area 0) with other areas attached to it through [[ABRs|ABR|area border router|area border routers|border router]].',
    'Detailed topology LSAs (types 1 and 2) stay inside their own area, so a change floods and triggers SPF [[only within the area|only within|stays within|kept within|within each area|inside each area|only in the area|only that area|only in that area|stays in the area|stays inside|kept in the area|confined to the area|limited to the area|stays local|contained within]] where it happened.',
    'ABRs pass a summary of each area to the others (type 3 LSAs) and can [[summarise|summary|summarisation|summarization|summarize|aggregate]] routes, giving [[smaller routing tables|smaller tables|routing tables are smaller|routing table is smaller|tables are smaller|fewer routes|less routes|fewer routing entries|reduces the routing table|reduced routing table]].',
    'Result: smaller LSDBs, fewer SPF runs, less flooding, faster convergence, and problems contained within one area.',
  ];
  if(Math.random()<0.5) return {
    prompt: 'How does multi-area OSPF overcome the problems with single area operation? Explain what goes wrong in one large area (what every router has to store, flood and recalculate), describe how a multi-area design is laid out (the central area and the routers that join the others to it), and explain how it reduces the load, including where changes are flooded and what happens to the routing tables and why.',
    points: ['<b>Single-area problems:</b> every router holds the whole topology, so the '+LSDB+' and routing table get large; every change '+FLOOD+' to every router and makes all of them re-run '+SPF+' &mdash; heavy CPU, memory and bandwidth use.'].concat(how),
  };
  /* A scenario: the model's first point says what is wrong with THIS network
     (its router count, and the cause of the symptom it was given). */
  const n=ri(60,150), sym=pick([
    {s:'its routers are struggling',
     here:'all '+n+' routers are in one area, so every one of them keeps the whole '+LSDB+' and a full routing table, and a change anywhere '+FLOOD+' to all '+n+' and makes each of them re-run '+SPF+' &mdash; that CPU, memory and bandwidth load is what they are struggling with.'},
    {s:'the CPU on every router spikes whenever a link anywhere in it flaps',
     here:'the CPU spikes are '+SPF+' runs: a flap anywhere '+FLOOD+' to all '+n+' routers and every one of them recalculates its routes. Each of them also keeps the whole '+LSDB+' and a full routing table for all '+n+' routers, which costs memory.'},
    {s:'its routers are running short of memory',
     here:'the memory goes on the '+LSDB+': every one of the '+n+' routers stores the whole topology, plus a full routing table. On top of that, any change '+FLOOD+' to all '+n+' and makes each of them re-run '+SPF+'.'},
  ]);
  return {
    prompt: 'A single-area OSPF network has grown to '+n+' routers and '+sym.s+'. Explain what in one big area is causing this (what every router has to store, flood and recalculate), then describe how a multi-area design would be laid out (the central area and the routers that join the others to it) and how splitting it reduces the load, including where changes are flooded and what happens to the routing tables and why.',
    points: ['<b>Here:</b> '+sym.here].concat(how),
  };
}});

card({id:'q2d-timers', area:'ospf', tier:1, kind:'flash', src:'Q2 d', title:'Hello and dead timers', gen(){
  const OVERHEAD='[[more overhead|overhead|bandwidth|more traffic|traffic|more hellos|more hello packets|hellos more often|cpu|processing]]';
  const FLAP='[[flapping|flap|unstable|instability|false|falsely|by mistake|mistakenly|wrongly|lossy|packet loss|lost hellos|missed hellos]]';
  const MATCHF='must match|match|matching|identical|mismatch|mismatched|same on both|same values|same timers|same hello|same dead|same intervals|same settings|set the same|configured the same|also set|also be set|also change|agree|equal|consistent|same as|to the same|hello too|hello as well|needs hello|also needs';
  const MATCH='[['+MATCHF+']]';
  if(Math.random()<0.5){
    return {
      prompt:'Why would you change the OSPF hello or dead timers? Give the benefit and two downsides of lowering them and the reason for raising them (and on what kind of link), say what must be true of the timers on two neighbouring routers, and say what happens to the dead timer when only the hello timer is changed.',
      points:[
        'Hellos discover neighbours and keep adjacencies alive. Defaults: hello 10 s and dead 40 s on Ethernet and point-to-point links (30/120 on NBMA). The dead interval is how long without a hello before the neighbour is declared down.',
        '<b>Lower them</b> to [[detect a failure|detect|detection|reconverge|converge|convergence|failover]] [[faster|quicker|quickly|sooner|speed|speeds]].',
        'The cost: '+OVERHEAD+' &mdash; more hello packets and CPU &mdash; and a risk of neighbours '+FLAP+' on a busy or lossy link.',
        '<b>Raise them</b> to cut overhead on [[slow links|slow|low bandwidth|unreliable|congested|less overhead|fewer hellos|reduce overhead|less traffic|less bandwidth]], at the cost of slower failure detection.',
        'Hello and dead intervals <b>'+MATCH+'</b> on both neighbours or the adjacency won\'t form. Set with '+mono('ip ospf hello-interval')+' / '+mono('ip ospf dead-interval')+' on the interface.',
        'If dead hasn\'t been set by hand, changing hello sets it to [[4 &times; hello|4 times|four times|4x|x4|quadruple|4 x|times 4|times four]].',
      ],
    };
  }
  const h=pick([1,2,3,5]), d=4*h, ifn=pick(['G0/0','G0/1','S0/0/0']), nb=pick(['R2','R3']);
  const sec=n=>n+(n===1?' second':' seconds');
  return {
    prompt:'An admin lowers the OSPF hello interval on R1\'s '+ifn+' (the link to '+nb+') to '+sec(h)+' and does not set the dead interval. What dead interval will that interface now use? Why might the admin make this change, what are two downsides, and what must they make sure of on '+nb+'?',
    points:[
      '<b>Here:</b> the dead interval becomes [['+sec(d)+'|'+d+' seconds|'+d+' second|'+d+' s|'+d+'s|'+d+' sec|'+d+' secs|dead '+d+'|dead interval '+d+'|dead timer '+d+'|dead to '+d+'|dead of '+d+'|4 times|four times|4x|x4|4 x|times 4|times four|quadruple]] &mdash; 4 &times; the '+h+' s hello, because dead was not set by hand &mdash; down from the default 40 s.',
      '<b>Why:</b> a failed neighbour is noticed within '+d+' s instead of 40 s, so OSPF can [[detect a failure|detect|detection|reconverge|converge|convergence|failover]] [[faster|quicker|quickly|sooner|speed|speeds]].',
      '<b>Downside:</b> hellos go out '+(h===1?'every second':'every '+h+' s')+' instead of every 10 s &mdash; '+OVERHEAD+' &mdash; and with such a short dead interval a few lost hellos on a busy or lossy link can drop the neighbour by mistake ('+FLAP+').',
      '<b>On '+nb+':</b> the hello and dead intervals [['+MATCHF+'|hello interval '+h+'|hello '+h+' on '+nb+'|hello '+h+' too|hello '+h+' as well]] on both ends, so '+nb+'\'s interface needs '+mono('ip ospf hello-interval '+h)+' too (giving dead '+d+' s); otherwise the adjacency goes down and won\'t re-form.',
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
      return {ok, verdict: ok?'Correct.':'The answer: '+OPTS[ans]+'.', why: ul(['<b>'+OPTS[ans]+'.</b> '+why, 'To form an adjacency the two ends need matching hello and dead timers, the same area, the same subnet and mask, matching authentication, and neither end passive.'])};
    },
  };
}});

card({id:'q2e-roles', area:'ospf', tier:1, kind:'flash', src:'Q2 c', title:'OSPF router roles', gen(){
  if(Math.random()<0.5) return {
    prompt: 'In multi-area OSPF, describe the roles of an internal router, a backbone router, an ABR and an ASBR: for each one, say which areas its interfaces are in (or what else it connects to) and what job it does.',
    points: [
      '<b>Internal router:</b> every interface in the [[same area|one area|single area|a single area]], so it holds one LSDB.',
      '<b>Backbone router:</b> has at least one interface in the [[backbone|area 0|area zero]]. Every other area must connect to area 0.',
      '<b>ABR</b> (Area Border Router): interfaces in [[two or more areas|more than one area|multiple areas|several areas|two areas|connects areas|between areas]], one of them area 0. It keeps a separate LSDB for each area and passes [[summaries|summary|summarise|summarises|type 3]] of each area to the others.',
      '<b>ASBR</b> (Autonomous System Boundary Router): connects OSPF to an [[external|outside OSPF|outside the network|to the outside|the outside world|outside world|outside routes|outside sources|out of the network|outside of the network|outside network|outside networks|other networks|another network|another routing protocol|other routing protocols|another routing domain|the Internet|ISP]] network and [[redistributes|redistribute|redistribution|injects|default-information originate]] those routes into OSPF.',
    ],
  };
  /* A scenario: which router is the ABR, which the ASBR, the area numbers,
     the interface split and where the external routes come from are all
     drawn here, and the model's first points name THESE routers' roles. */
  const names=['R1','R2','R3','R4','R5','R6'].sort(()=>Math.random()-0.5), A=names[0], B=names[1];
  const x=pick([1,2,3,4,5,10,20,51]), split=pick([[1,2],[2,1],[1,1],[1,3]]);
  const bInZero=Math.random()<0.35, bArea=bInZero?0:x;
  const src=pick([
    {txt:'a default route from the ISP', ext:'ISP|the ISP'},
    {txt:'routes learned from a partner company\'s EIGRP network', ext:'EIGRP|partner'},
    {txt:'static routes to a branch office that runs no routing protocol', ext:'static routes|static route|branch'},
  ]);
  const cnt=n=>n===1?'one':n===2?'two':'three';
  const prompt=A+' has '+cnt(split[0])+' interface'+(split[0]>1?'s':'')+' in area 0 and '+cnt(split[1])+' in area '+x+'. '+
    B+' has all of its interfaces in area '+bArea+', and it also redistributes '+src.txt+' into OSPF. '+
    'Name every OSPF role '+A+' and '+B+' each have and why, then explain what an ABR does and what an ASBR does.';
  const bRoles=bInZero
    ? 'all its interfaces are in area 0, so [[@B is an internal router|@B~internal]] and [[@B is a backbone router|@B~backbone]] too'
    : 'all its interfaces are in area '+x+', so [[@B is an internal router|@B~internal]] of area '+x+' (not a backbone router)';
  const points=[
    '<b>Here:</b> [[@A is an ABR|@A~ABR|@A~area border router|@A~border router|'+names.slice(2).map(n=>n+'~').join('|')+']], because it has interfaces in two areas (area 0 and area '+x+'), and, because one of them is in area 0, [[@A is a backbone router|@A~backbone]] as well. '+
      '[[@B is an ASBR|@B~ASBR|@B~autonomous system boundary router|@B~boundary router]], because it redistributes '+src.txt+' into OSPF; '+bRoles+'.',
    '<b>ABR:</b> joins its areas to the backbone. It keeps a separate LSDB for each area and [[passes summaries|summaries|summary|summarise|type 3|routes between areas|between areas|between the areas|connects areas|connects the areas|joins areas]] of each area\'s networks into the others (type 3 LSAs, '+mono('O IA')+' routes).',
    '<b>ASBR:</b> the point where routes from [[outside OSPF|external|outside network|outside the network|to the outside|the outside world|outside world|outside routes|outside sources|out of the network|outside of the network|outside networks|other networks|another network|another routing protocol|other routing protocols|another routing domain|the Internet|'+src.ext+']] enter: it [[redistributes|redistribute|redistribution|injects|imports|brings in|default-information originate]] them into OSPF as type 5 external LSAs ('+mono('O E2')+' routes), flooded to every normal area.',
    'For comparison: a backbone router has at least one interface in area 0; an internal router has every interface in one area and keeps a single LSDB.',
  ].map(p=>p.replace(/@A/g,A).replace(/@B/g,B));
  return {prompt, points};
}});

card({id:'q2f-lsa', area:'ospf', tier:2, kind:'flash', src:'Q2 c', title:'OSPF LSA types', gen(){
  /* Both variants are definitions, so the definitions are the answer. Each
     key word is PAIRED with the type it belongs to ("subject~term"), so a
     right phrase attached to the wrong type scores nothing: senders and
     scopes in the first variant, which group each type goes in in the
     second. Every type is recognised by number ("3", "type 3", "LSA 3") or by
     name ("summary LSA"). Types 1 and 2, and 3 and 4, are one key word each
     (any of them owning the phrase counts), because "types 1 and 2 stay
     local" gives the phrase to the nearest type only. In a form list the
     Type 4 names come before Type 3's, because "ASBR summary LSA" ends on the
     same word as "summary LSA" and the earlier subject wins that tie. */
  const NAMES={1:'router LSA', 2:'network LSA', 3:'summary LSA', 4:'ASBR summary LSA|ASBR summary', 5:'external LSA'};
  const subs=n=>['type '+n,'LSA '+n,''+n,'type'+n,'lsa'+n].concat(NAMES[n].split('|'));
  const subs12=subs(1).concat(subs(2)), subs34=subs(4).concat(subs(3));
  const kw=(display,ss,terms,extra)=>{
    const f=[display];
    ss.forEach(s=>terms.forEach(t=>f.push(s+'~'+t)));
    return '[['+f.concat(extra||[]).join('|')+']]';
  };
  const said=(who,ns)=>{   // "ASBR sends type 5" — the sender first, which the pairing can't see
    const out=[];
    who.forEach(w=>['send','originate','generate','create','advertise','produce','inject','flood'].forEach(v=>
      ns.forEach(n=>['type '+n,'LSA '+n,''+n].forEach(a=>out.push(w+' '+v+' '+a)))));
    return out;
  };
  const IN_AREA=['only within its area','within its area','within the area','within their area','within their own area','within its own area','within own area','within an area','inside its area','inside the area','inside their area','inside their own area','inside its own area','inside an area','stays in the area','stay in the area','stays in its area','stay in their area','stays in its own area','stay in their own area','stays in area','stay in area','in its own area','in their own area','in the same area','in own area','its own area','their own area','own area','its area','their area','same area','local to the area','local to its area','local','locally','area only','in the area','in an area','intra-area','intra area'];
  const BETWEEN=['between areas','between the areas','between different areas','between two areas','between multiple areas','into other areas','into another area','into the other areas','into the next area','into neighbouring areas','into adjacent areas','into a different area','into different areas','to other areas','to another area','to different areas','to all other areas','out to other areas','other areas','another area','different areas','a different area','across areas','across area boundaries','across the area boundary','area boundaries','area boundary','inter-area','interarea','inter area','into the backbone','to the backbone','into area 0','to area 0','from one area to another','one area to another','one area into another','one area to the next','outside the area','outside its area','outside of the area','beyond the area','beyond its area','into the rest of the network','the other areas','all other areas','the next area','neighbouring areas','adjacent areas'];
  const OUTSIDE=['outside OSPF','outside of OSPF','outside the OSPF','outside the autonomous system','outside the network','outside the domain','outside the routing domain','external routes','external networks','external route','external network','external prefixes','external destinations','routes from outside','routes outside','from outside','non-OSPF','not OSPF','another routing protocol','other routing protocols','different routing protocol','another protocol','other protocols','redistributed','redistribute','redistribution','redistributing','from the ISP','the ISP','ISP','internet','default route','static routes','another autonomous system'];
  const ASBR_REACH=['where the ASBR is','where the ASBR can be found','find the ASBR','finding the ASBR','locate the ASBR','locating the ASBR','reach the ASBR','reaching the ASBR','reach an ASBR','get to the ASBR','route to the ASBR','path to the ASBR','way to the ASBR','location of the ASBR','ASBR location','ASBR reachability','how to reach the ASBR','how to get to the ASBR','where to find the ASBR','about the ASBR','advertises the ASBR','advertise the ASBR','the ASBR itself','ASBR can be reached'];
  const EVERY_ROUTER=['every router','each router','all routers','every OSPF router','each OSPF router','all OSPF routers','any router','every router in the area','all routers in the area','every router in that area','routers in the area','routers in the same area','routers in that area','routers within the area','routers in its area','routers in an area','routers in each area','every single router','each router itself','the router itself','router itself','every router in an area','every one of the routers','all of the routers','all the routers','every router within the area','each router in the area','each router in the same area','routers in same area','all routers within the area'];
  const DR=['DR','designated router'];
  const ABR=['ABR','area border router'];
  const ASBR=['ASBR','AS boundary router','autonomous system boundary router','boundary router','redistributing router','router that redistributes','router redistributing'];
  const EVERY_AREA=['every area','all areas','all the areas','all other areas','all normal areas','every normal area','every other area','every non-stub area','all non-stub areas','all regular areas','every regular area','whole OSPF domain','entire OSPF domain','whole OSPF network','entire OSPF network','whole domain','entire domain','whole network','entire network','whole autonomous system','entire autonomous system','throughout the autonomous system','throughout OSPF','throughout the domain','throughout the network','all of OSPF','whole of OSPF','all OSPF areas','every OSPF area','everywhere','whole AS','entire AS','throughout the AS'];
  if(chance(.5)) return {
    prompt: 'Describe the OSPF LSA types 1 to 5. For each type, say which router originates it and how far it is flooded (inside its own area, into other areas, or across every area).',
    points: [
      kw('Type 1 Router LSAs come from every router',subs(1),EVERY_ROUTER,said(['every router','each router','all routers'],[1]))+', each describing its own links.',
      kw('Type 2 Network LSAs come from the DR',subs(2),DR,said(['DR','designated router'],[2]))+' of a multi-access network.',
      kw('Types 1 and 2 stay in their own area',subs12,IN_AREA)+': they are flooded only within the area they were created in.',
      kw('Types 3 and 4 come from the ABR',subs34,ABR,said(['ABR','area border router'],[3,4]))+': Type 3 Summary LSAs, and Type 4 ASBR summary LSAs, which tell other areas how to reach the ASBR.',
      kw('Type 3 floods into other areas',subs(3).concat(subs(4)),BETWEEN)+', advertising one area\'s networks there; they appear as '+mono('O IA')+' routes.',
      kw('Type 5 External LSAs come from the ASBR',subs(5),ASBR,said(['ASBR'],[5]))+' for routes from outside OSPF (e.g. a default route).',
      kw('Type 5 floods to every area',subs(5),EVERY_AREA)+' except stub areas; they appear as '+mono('O E2')+' / '+mono('O*E2')+' routes.',
    ],
  };
  return {
    prompt: 'Sort the OSPF LSA types 1 to 5 into these four groups, naming each group and listing the type numbers in it: stays inside the area it was created in; carries one area\'s networks into other areas; tells other areas how to reach the ASBR; brings in routes from outside OSPF.',
    points: [
      kw('Types 1 and 2 stay inside their own area',subs12,IN_AREA)+': Router LSAs (from every router) and Network LSAs (from the DR) are flooded only within their own area.',
      kw('Type 3 carries networks into other areas',subs34,BETWEEN)+': Summary LSAs, which ABRs send; they appear as '+mono('O IA')+' routes.',
      kw('Type 4 tells other areas where the ASBR is',subs(4),ASBR_REACH)+': the ASBR summary LSA, also sent by an ABR.',
      kw('Type 5 brings in routes from outside OSPF',subs(5),OUTSIDE)+': External LSAs, which the ASBR sends (e.g. for a default route) and which flood to every normal area.',
    ],
  };
}});

/* "network <address> <wildcard> area <n>" lines: what OSPF puts each
   interface in. Returns {err} or {stmts:[{a,w,area,line}], pid}. */
function parseOspfNets(lines){
  const stmts=[]; let inOspf=false;
  for(const raw of lines){
    const l=iosNorm(raw); let m;
    if(/^router ospf \d+$/.test(l)){ inOspf=true; continue; }
    if(/^(exit|end|log-adjacency-changes|passive-interface .+|router-id \S+|auto-cost .+)$/.test(l)) continue;
    if((m=/^network (\S+) (\S+) area (\S+)$/.exec(l))){
      if(!inOspf) return {err:'Start with router ospf 1 — network commands go under it.'};
      const a=ip2int(m[1]), w=ip2int(m[2]), ar=/^\d+$/.test(m[3])?+m[3]:ip2int(m[3]);
      if(a==null) return {err:'"'+raw+'" has an invalid address.'};
      if(w==null) return {err:'"'+raw+'" needs a wildcard mask after the address.'};
      if(ar==null) return {err:'"'+raw+'" has an invalid area.'};
      if((w>>>24)===255) return {err:'"'+raw+'": '+m[2]+' is a subnet mask — OSPF network commands take a wildcard (0.0.0.255 for a /24).'};
      stmts.push({a,w,area:ar,line:raw}); continue;
    }
    return {err:'"'+raw+'" isn\'t needed here.'};
  }
  if(!inOspf) return {err:'Start with router ospf 1.'};
  return {stmts};
}
function ospfAreaOf(stmts,ip){
  const hit=stmts.filter(s=>((ip&~s.w)>>>0)===((s.a&~s.w)>>>0));
  return {hit, areas:[...new Set(hit.map(s=>s.area))]};
}
function areaTxt(a){ return a>255?int2ip(a):String(a); }
card({id:'g2-net', area:'ospf', tier:2, kind:'graded', src:'Q2', title:'Write the OSPF network commands', gen(){
  const lanA=ip2int('192.168.'+ri(0,254)+'.0'), lanB=ip2int('172.'+ri(16,31)+'.'+ri(0,255)+'.0'), wan=rLink30(), isp=ip2int('209.165.'+ri(200,220)+'.'+(ri(1,62)*4));
  const abr=chance(.5), la=abr?pick([1,2,10]):0;
  const ifs=[
    {name:'G0/0', ip:lanA+1, pfx:24, area:la},
    {name:'G0/1', ip:lanB+1, pfx:pick([24,26]), area:la},
    {name:'S0/0/0', ip:wan+1, pfx:30, area:0},
    {name:'S0/0/1', ip:isp+2, pfx:30, area:null},
  ];
  ifs[1].ip=netOf(ifs[1].ip,ifs[1].pfx)+1;
  const wc=p=>int2ip((~pfxMask(p))>>>0);
  const model=['router ospf 1'].concat(ifs.filter(f=>f.area!=null).map(f=>' network '+int2ip(netOf(f.ip,f.pfx))+' '+wc(f.pfx)+' area '+f.area));
  return {
    prompt:'Configure <b>OSPF process 1</b> on R1 with <b>network</b> commands (wildcard masks) so each interface below runs OSPF in the area shown. The link to the ISP must <b>not</b> run OSPF.',
    body:'<div class="ex-scroll"><table class="rt-table ex-table"><thead><tr><th>R1 interface</th><th>Address</th><th>OSPF area</th></tr></thead><tbody>'+
      ifs.map(f=>'<tr><td>'+f.name+'</td><td>'+int2ip(f.ip)+'/'+f.pfx+'</td><td style="font-family:var(--font)">'+(f.area==null?'none &mdash; link to the ISP':'Area '+f.area)+'</td></tr>').join('')+'</tbody></table></div>'+
      cmdsHtml('net','Commands &mdash; one per line, Ctrl+Enter submits','e.g. network 198.51.100.0 0.0.0.255 area 0',5),
    grade(){
      const p=parseOspfNets(cmdLines('net'));
      let why=p.err||null;
      if(!why) for(const f of ifs){
        const r=ospfAreaOf(p.stmts,f.ip);
        if(f.area==null){ if(r.hit.length){ why='"'+r.hit[0].line+'" also matches '+f.name+' ('+int2ip(f.ip)+'), so OSPF would run towards the ISP.'; break; } continue; }
        if(!r.hit.length){ why=f.name+' ('+int2ip(f.ip)+') isn\'t matched by any network command.'; break; }
        if(r.areas.length>1){ why=f.name+' is matched by network commands for different areas.'; break; }
        if(r.areas[0]!==f.area){ why=f.name+' would be in area '+areaTxt(r.areas[0])+', not area '+f.area+'.'; break; }
      }
      markCmds('net',!why,model.join('\n'),why);
      return {ok:!why, verdict: !why?'Correct.':'Not quite.', why: ul([...(why?[why]:[]),'One network command per OSPF interface &mdash; '+ifs.filter(f=>f.area!=null).map(f=>f.name+' in area '+f.area).join(', ')+' &mdash; and none that matches S0/0/1, the ISP link:<br>'+model.map(l=>mono(l.trim())).join('<br>'),
        'The wildcard is the inverse of the mask: /24 &rarr; 0.0.0.255, /26 &rarr; 0.0.0.63, /30 &rarr; 0.0.0.3 (0.0.0.0 matches just the one interface address).',
        abr?'With its LANs in area '+la+' and the link to R2 in area 0, R1 is an <b>ABR</b>.':'Every OSPF interface is in area 0, so this is single-area OSPF.'])};
    },
  };
}});

/* DR/BDR election on one multi-access segment: highest priority, then
   highest router ID; priority 0 never stands. "Highest router ID wins" is
   only right about half the time. */
card({id:'g2-drbdr', area:'ospf', tier:2, kind:'graded', src:'Q2', title:'Who becomes DR and BDR?', gen(){
  let rs, dr, bdr;
  const ridWins=chance(.4);
  for(let t=0;t<500;t++){
    const n=ri(3,4), used=new Set();
    rs=Array.from({length:n},(_,i)=>{ let id; do{ id=ip2int(pick([ri(1,9)+'.'+ri(1,9)+'.'+ri(1,9)+'.'+ri(1,9), '10.'+ri(0,9)+'.'+ri(0,9)+'.'+ri(1,9), '192.168.'+ri(1,99)+'.'+ri(1,9)])); }while(used.has(id)); used.add(id);
      return {name:'R'+(i+1), pri:pick([1,1,1,0,10,50,100,255]), rid:id}; });
    const el=rs.filter(r=>r.pri>0).sort((a,b)=>b.pri-a.pri||b.rid-a.rid);
    if(el.length<2) continue;
    const hiRid=rs.reduce((a,r)=>r.rid>a.rid?r:a);
    dr=el[0]; bdr=el[1];
    if((hiRid===dr)!==ridWins) continue;
    break;
  }
  const isName=(v,r)=>v.replace(/\s+/g,'').toUpperCase()===r.name;
  return {
    prompt:'These routers share one Ethernet segment and start OSPF at the same time. Which router becomes the <b>DR</b>, and which the <b>BDR</b>?',
    body:'<div class="ex-scroll"><table class="rt-table ex-table"><thead><tr><th>Router</th><th>Interface priority</th><th>Router ID</th></tr></thead><tbody>'+
      rs.map(r=>'<tr><td>'+r.name+'</td><td>'+r.pri+'</td><td>'+int2ip(r.rid)+'</td></tr>').join('')+'</tbody></table></div>'+
      '<div class="ex-grid">'+fieldHtml('dr','DR','e.g. R9')+fieldHtml('bdr','BDR','e.g. R9')+'</div>',
    grade(){
      const okD=isName(val('dr'),dr), okB=isName(val('bdr'),bdr);
      markField('dr',okD,dr.name); markField('bdr',okB,bdr.name);
      const zero=rs.filter(r=>r.pri===0);
      return {ok:okD&&okB, verdict: okD&&okB?'Correct.':'DR '+dr.name+', BDR '+bdr.name+'.', why: ul([
        'DR: <b>'+dr.name+'</b> (priority '+dr.pri+', RID '+int2ip(dr.rid)+'). BDR: <b>'+bdr.name+'</b> (priority '+bdr.pri+', RID '+int2ip(bdr.rid)+').',
        'Highest <b>priority</b> wins; only if priorities tie does the highest <b>router ID</b> decide.',
        ...(zero.length?[zero.map(r=>r.name).join(' and ')+' '+(zero.length>1?'have':'has')+' priority 0, so '+(zero.length>1?'they':'it')+' can never be DR or BDR.']:[]),
        'The election isn\'t pre-emptive: a router that joins later with a higher priority doesn\'t take over until the DR fails or OSPF restarts.'])};
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
  'native','helper-address','dhcp','excluded-address','pool','network','default-router','dns-server',
  'router','rip','version','auto-summary','passive-interface','ospf','area','hello-interval','dead-interval',
  'nat','inside','outside','source','overload','static','list','netmask',
  'ipv6','traffic-filter','nd','other-config-flag','managed-config-flag','server','relay','destination','domain-name','prefix'];
/* Words kept exactly as typed: "in"/"out" are directions (never "inside"),
   "default" a keyword of its own (never "default-router"). */
const IOS_KEEP=['in','out','default'];
function iosNorm(line){
  return line.trim().split(/\s+/).map(t=>{
    const l=t.toLowerCase(); if(IOS_VOCAB.indexOf(l)>=0||IOS_KEEP.indexOf(l)>=0) return l;
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
    // a global command typed in interface mode drops back to global configuration, as on IOS
    if(/^(router |ip dhcp pool |ipv6 dhcp pool |ip access-list |ipv6 access-list |access-list |ip route |ip nat (inside source|outside source|pool) |ip dhcp excluded|hostname |ipv6 unicast-routing|line )/.test(n)) ifc='';
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
function q3Topo(P,pick,lab){
  const L=i=>lab?lab.lans[i]:cidr(P.lans[i],24);
  let s='<svg class="ex-topo'+(pick?' pickable':'')+'" viewBox="0 100 800 164" role="img" aria-label="R1 and R2 with four LANs">';
  s+='<path class="ln" d="M250 132 H172 M172 110 V154"/><path class="ln" d="M295 154 V214 M262 214 H328"/>'+
     '<path class="ln ser" d="M340 132 H470"/><path class="ln" d="M560 132 H638 M638 110 V154"/><path class="ln" d="M515 154 V214 M482 214 H548"/>';
  [['R1',250],['R2',470]].forEach(r=>{ s+='<rect class="rt" x="'+r[1]+'" y="110" width="90" height="44" rx="10"/><text class="rt-name" x="'+(r[1]+45)+'" y="137" text-anchor="middle">'+r[0]+'</text>'; });
  s+='<text x="162" y="128" text-anchor="end">'+L(0)+'</text><text class="t-sub" x="162" y="145" text-anchor="end">LAN1</text>'+
     '<text x="295" y="236" text-anchor="middle">'+L(1)+'</text><text class="t-sub" x="295" y="253" text-anchor="middle">LAN2</text>'+
     '<text x="648" y="128">'+L(2)+'</text><text class="t-sub" x="648" y="145">LAN3</text>'+
     '<text x="515" y="236" text-anchor="middle">'+L(3)+'</text><text class="t-sub" x="515" y="253" text-anchor="middle">LAN4</text>'+
     '<text class="t-sub" x="405" y="156" text-anchor="middle">'+(lab?lab.wan:cidr(P.wan,30))+'</text>';
  s+=ifPill('R1 G0/0','G0/0',211,132,pick)+ifPill('R1 G0/1','G0/1',326,184,pick)+ifPill('R1 S0/0/0','S0/0/0',374,132,pick)+
     ifPill('R2 S0/0/0','S0/0/0',436,132,pick)+ifPill('R2 G0/0','G0/0',599,132,pick)+ifPill('R2 G0/1','G0/1',546,184,pick);
  return '<div class="ex-topo-wrap">'+s.replace('class="ex-topo','class="ex-topo ex-topo-wide')+'</svg>'+q3TopoNarrow(P,pick,lab)+'</div>';
}
/* The same network stacked for a phone — R1 above R2, LANs either side — so
   every interface fits on screen at a readable size instead of scrolling.
   Both copies carry the same data-if, so picking and marking follow either. */
function q3TopoNarrow(P,pick,lab){
  const L=i=>lab?lab.lans[i]:cidr(P.lans[i],24), v6=lab?' class="t-v6"':'';   // IPv6 prefixes need the smaller type to fit
  let s='<svg class="ex-topo ex-topo-narrow'+(pick?' pickable':'')+'" viewBox="0 78 340 236" role="img" aria-label="R1 and R2 with four LANs">';
  s+='<path class="ln" d="M125 130 H70 M70 110 V150"/><path class="ln" d="M215 130 H270 M270 110 V150"/>'+
     '<path class="ln ser" d="M170 150 V230"/><path class="ln" d="M215 250 H270 M270 230 V270"/><path class="ln" d="M125 250 H70 M70 230 V270"/>';
  [['R1',110],['R2',230]].forEach(r=>{ s+='<rect class="rt" x="125" y="'+r[1]+'" width="90" height="40" rx="10"/><text class="rt-name" x="170" y="'+(r[1]+25)+'" text-anchor="middle">'+r[0]+'</text>'; });
  s+='<text'+v6+' x="70" y="90" text-anchor="middle">'+L(0)+'</text><text class="t-sub" x="70" y="104" text-anchor="middle">LAN1</text>'+
     '<text'+v6+' x="270" y="90" text-anchor="middle">'+L(1)+'</text><text class="t-sub" x="270" y="104" text-anchor="middle">LAN2</text>'+
     '<text'+v6+' x="270" y="290" text-anchor="middle">'+L(2)+'</text><text class="t-sub" x="270" y="304" text-anchor="middle">LAN3</text>'+
     '<text'+v6+' x="70" y="290" text-anchor="middle">'+L(3)+'</text><text class="t-sub" x="70" y="304" text-anchor="middle">LAN4</text>'+
     '<text class="t-sub'+(lab?' t-v6':'')+'" x="210" y="194">'+(lab?lab.wan:cidr(P.wan,30))+'</text>';
  s+=ifPill('R1 G0/0','G0/0',97,130,pick)+ifPill('R1 G0/1','G0/1',243,130,pick)+ifPill('R1 S0/0/0','S0/0/0',170,168,pick)+
     ifPill('R2 S0/0/0','S0/0/0',170,212,pick)+ifPill('R2 G0/0','G0/0',243,250,pick)+ifPill('R2 G0/1','G0/1',97,250,pick);
  return s+'</svg>';
}
function applyHtml(noDir){
  return '<div class="ex-apply"><span class="ex-apply-lbl">Apply on:</span> <b id="if-pick" class="ex-apply-if">click an interface on the diagram</b>'+
    (noDir?'':'<span class="ex-apply-lbl">Direction:</span>'+chipsHtml(['In','Out']))+'</div>';
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
  /* Placement is tied to the ACL type, so a swapped answer scores neither.
     Generic variant: "standard~near the destination" pairing. Scenario variant:
     enumerated phrases ("standard ACL on R3", "R3 should have the standard")
     plus "it should be on R3" for the standard one, because the pairing's
     fallback rule would let "standard ACL on R3, extended ACL on R1" (swapped)
     score the extended key word. No bare generic words. */
  const onlySrc='[[only matches the source|source only|only the source|only source|only on the source|only by the source|just the source|only check the source|only checks the source|only match the source|only filter on the source|only filter by the source|only filter by source|only look at the source|only looks at the source|only examine the source|only read the source|only see the source|only use the source|only uses the source|only care about the source|only based on the source|only filter traffic based on the source|only filter based on the source|source address only|source ip only|can not check the destination|cannot check the destination|can\'t check the destination|cannot see the destination|can\'t see the destination]]';
  const extMatch='[[destination, protocol and port|source, destination, protocol|destination and port|destination and protocol|protocol and port|protocol or port|port and protocol|port or protocol|protocol, port|tcp or udp port|source and destination|destination and source|destination as well|destination too|destination address and port|destination address as well]]';
  const early='[[before it wastes bandwidth|wastes bandwidth|wasting bandwidth|waste bandwidth|wasted bandwidth|saves bandwidth|save bandwidth|saving bandwidth|before it crosses the network|before it crosses|before it travels|before it reaches the rest of the network|before it uses|unnecessary traffic|unwanted traffic is dropped early|dropped before it]]';
  const stdT=['destination','destinations','destination router','close to the destination','closest to the destination','near the destination','nearest the destination','nearest to the destination','next to the destination','at the destination','near destination','close to destination'];
  const extT=['source','source router','close to the source','closest to the source','near the source','nearest the source','nearest to the source','next to the source','at the source','near source','close to source'];
  const pairs=(a,t,b)=>t.map(x=>a+'~'+x).concat(b?b.map(x=>x+'~'+a):[]);
  if(chance(.5)) return {
    prompt: 'Where is it best to place a standard ACL, and where is it best to place an extended ACL? For each one, say what that kind of ACL can match, explain why that decides where it goes, and say what the placement saves.',
    points: [
      'Place a [[standard ACL close to the destination|'+pairs('standard',stdT).join('|')+']].',
      'A standard ACL '+onlySrc+' address, so placed near the source it would stop that host reaching <i>every</i> destination, not just the one intended.',
      'Place an [[extended ACL close to the source|'+pairs('extended',extT).join('|')+']].',
      'An extended ACL can match source, '+extMatch+', so it can safely drop exactly the unwanted traffic near the source, '+early+' crossing the network.',
    ],
  };
  const r=chance(.5)?['R1','R3']:['R3','R1'], src=r[0], dst=r[1];
  const lans=shuffle(['Sales','HR','Finance','Marketing','Guest','Staff']), A=lans[0], B=lans[1];
  const x=ri(2,250), net='192.168.'+x+'.0';
  const lost=[];
  ['loses','lose','lost','loses access to','lose access to','cannot reach','can\'t reach','can not reach','unable to reach','blocked from','blocks','also blocks','is blocked from','denied access to','no access to','no longer reach','no longer reaches'].forEach(v=>{
    [B+' LAN','the '+B+' LAN',B].forEach(n=>lost.push(v+' '+n)); });
  ['every destination','all destinations','every other network','all other networks','everything beyond'].forEach(w=>lost.push(w));
  const verbs=['','on','at','in','onto','to','goes on','go on','goes at','goes to','should be on','should be at','should be in','should be','should go on','should go at','should go','would go on','would go at','would be on','is on','is at','belongs on','belongs at','belongs','must be on','must go on','needs to be on','needs to go on','is applied on','is applied to','is placed on','is placed at','is put on','can go on','is best on','is best at','is best placed on','is best placed at','is better on','is better at','ought to be on','has to be on','has to go on','be applied on','be applied to','be placed on','be placed at','be put on'];
  const plain=(names,dev)=>{ const o=[]; names.forEach((n,i)=>verbs.concat(['apply it on','apply it to','put it on','place it on','it goes on','it should go on','it belongs on','it should be on','it goes at','it should go at']).forEach(v=>{ if(!v&&i) return; o.push((n+' '+v+' '+dev).replace(/  +/g,' ')); })); return o; };
  const stdForms=plain(['standard','standard ACL','standard ACLs','standard one','standard list','standard access list'],dst);
  stdForms.push('standard~close to the destination','standard~closest to the destination','standard~near the destination','standard~next to the destination','standard~at the destination','standard~near the servers','standard~close to the servers');
  ['should have','has','gets','should get','needs','should hold','takes','should take'].forEach(v=>stdForms.push(dst+' '+v+' the standard ACL', dst+' '+v+' the standard'));
  ['it should be on','it should be applied on','it should be applied to','it should go on','it should go at','it should be at','it should be placed on','it should be placed at','it should be put on','it belongs on','it belongs at','it should move to','it should be moved to','move it to','moved it to','it needs to be on','it needs to go on','it must be on','it must go on','put it on','place it on','apply it on'].forEach(p=>stdForms.push(p+' '+dst));
  const extForms=plain(['extended','extended ACL','extended ACLs','extended one','extended list','extended access list'],src);
  extForms.push('extended~close to the source','extended~closest to the source','extended~near the source','extended~next to the source','extended~at the source','extended~near the '+A+' LAN','extended~close to the '+A+' hosts');
  ['should have','has','gets','should get','needs','should hold','takes','should take'].forEach(v=>extForms.push(src+' '+v+' the extended ACL', src+' '+v+' the extended'));
  return {
    prompt: 'R1, R2 and R3 are connected in a line (R1 &ndash; R2 &ndash; R3). Hosts on the '+A+' LAN ('+net+'/24, on '+src+') must not reach the Servers LAN on '+dst+', but must still reach the '+B+' LAN on R2. '+
      'An admin applies a standard ACL denying '+net+' 0.0.0.255 inbound on '+src+'\'s interface facing the '+A+' LAN. Explain what else this breaks and why. Then say which router the standard ACL should be applied on instead, '+
      'which router an extended ACL for the same job would go on, and what the extended ACL can match that the standard one cannot.',
    points: [
      '<b>Here:</b> the ACL on '+src+' drops <i>all</i> '+A+' traffic, so '+A+' [[also loses the '+B+' LAN|'+lost.join('|')+']] on R2, not only the Servers LAN. '+
        'So the [[standard ACL on '+dst+'|'+stdForms.join('|')+']] belongs outbound on the interface facing the Servers LAN, and '+
        'an [[extended ACL on '+src+'|'+extForms.join('|')+']] would go inbound on its '+A+' interface.',
      'Why it went wrong: a standard ACL '+onlySrc+' address, so wherever it sits it blocks '+A+' from <i>every</i> destination beyond that point. Close to the destination, only traffic heading for the Servers LAN passes it.',
      'An extended ACL also matches the '+extMatch+', so it can deny just '+A+' &rarr; Servers right at '+src+', '+early+' crossing R2.',
    ],
  };
}});

card({id:'q3d-established', area:'acl', tier:1, kind:'flash', src:'Q3 d', title:'The established keyword', gen(){
  return {
    prompt: pick([
      'What is the purpose of adding the keyword established at the end of an ACL command line? Say which protocol it matches and which flag bits it checks, which returning traffic it lets in and who must have started that connection, what it still keeps out, and give one limitation.',
      'An inbound ACL on the Internet-facing interface ends an entry with "established". Which protocol and flag bits does that entry match? Which traffic does it let in and who must have started that connection, what does it still block, and what is its main limitation?',
    ]),
    points: [
      '<b>Matches:</b> only [[TCP]] segments that belong to a session already set up &mdash; those with the [[ACK or RST|ACK|RST|acknowledgement|ACK bit|ACK flag]] bit set.',
      '<b>Lets in:</b> on an inbound ACL from outside, the [[return traffic|replies|reply|returning|responses|response|return packets|back in|come back in|comes back in|coming back in|let back in|allowed back in|traffic back]] &hellip;',
      '&hellip; for connections that were [[started by inside hosts|initiated from inside|started from inside|opened from inside|inside hosts initiated|began inside|begun inside|began from inside|that began inside|inside hosts started|inside hosts opened|initiated by inside|started by inside|opened by inside|initiated by the inside|started by the inside|inside initiated|inside-initiated|internal hosts initiated|started by internal|initiated by internal|initiated by a host inside|started by a host inside|initiated by hosts inside|started by hosts inside|initiated by an inside|started by an inside|started internally|internally started|initiated internally|internally initiated|started on the inside|initiated on the inside|started within|initiated within|started from within|initiated from within|we started|we initiated|started by us|initiated by us|you started|you initiated|already started|already initiated|previously started|previously initiated|started by the internal|initiated by the internal|started from the inside|initiated from the inside|started by the user|initiated by the user|user started|user initiated|started by the host|initiated by the host|inside started|internal started|started by the local|initiated by the local|started locally|initiated locally]].',
      '<b>Still blocks:</b> [[new connections|new sessions|new TCP|new connection|new session|start the connection|start a connection|starts the connection|starts a connection|starting connections|starting a connection|starting the connection|start connections|starts connections|start new connections|starting new connections|connection attempts|connection requests|incoming connections|started from outside|started by outside|initiated from outside|initiated by outside|started from the outside|initiated from the outside|started by an outside|initiated by an outside|started by the outside|initiated by the outside|outside-initiated|outside initiated|SYN]] from the outside (a SYN with no ACK does not match).',
      '<b>Limitation:</b> it only checks the TCP flags &mdash; it is [[not stateful|stateless|not a stateful|no state|does not track|doesn\'t track|not track|not a firewall|faked|forged ACK|spoofed ACK|faked ACK|fake ACK|crafted ACK]], so a forged ACK would get through.',
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
        return {ok:okF&&okL&&okC, verdict: okF&&okL&&okC?'Correct.':int2ip(first)+' to '+int2ip(last)+(cross?' ('+count.toLocaleString('en')+' addresses)':'')+'.', why: ul(why)};
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

/* A typed extended ACL — numbered (100–199, 2000–2699) or named with
   "ip access-list extended NAME" — parsed by the labs' engine. */
function parseExtAcl(lines){
  let num=null, name=null; const aces=[];
  for(const l of lines){
    const t=l.split(/\s+/), w0=t[0].toLowerCase(), w1=(t[1]||'').toLowerCase();
    if(w0==='ip'&&w1.length>=8&&'access-list'.startsWith(w1)){
      if(!/^ex/i.test(t[2]||'')) return {err:'A named extended list starts ip access-list extended <name>.'};
      if(!t[3]) return {err:'Name the list: ip access-list extended <name>.'};
      if(num!=null) return {err:'Use either a numbered list or a named one, not both.'};
      name=t[3]; continue;
    }
    let act, rest;
    if(w0.length>=8&&'access-list'.startsWith(w0)){
      if(name) return {err:'Inside a named list the entries start with permit or deny ("'+l+'").'};
      const n=+t[1];
      if(!/^\d+$/.test(t[1]||'')||NR.aclNumKind(n)!=='ext') return {err:'An extended ACL is numbered 100–199 or 2000–2699 — '+(t[1]||'no number')+' isn\'t.'};
      if(num!=null&&n!==num) return {err:'Every line must use the same ACL number.'};
      num=n; act=w1==='remark'?'remark':(t[2]||'').toLowerCase(); rest=t.slice(3);
    } else if(name){ const i=/^\d+$/.test(t[0])?1:0; act=(t[i]||'').toLowerCase(); rest=t.slice(i+1); }
    else return {err:'Each line starts with access-list (or use ip access-list extended <name>) ("'+l+'").'};
    if(act==='remark') continue;
    if(act!=='permit'&&act!=='deny') return {err:'Expected permit or deny ("'+l+'").'};
    const r=NR.acxParseAce(act,rest.map(x=>x.toLowerCase()));
    if(r.err) return {err:r.err.replace(/^%\s*/,'')+' ("'+l+'").'+(/http/i.test(l)?' IOS calls port 80 www (or type 80).':'')};
    aces.push(r.ace);
  }
  if(!aces.length) return {err:'There are no permit or deny lines.'};
  const acl=NR.aclMake(String(num!=null?num:name),num!=null,4,true);
  aces.forEach((a,i)=>{ a.seq=(i+1)*10; acl.aces.push(a); });
  return {acl};
}
const ACL_PKTS=[
  {proto:'tcp', sport:50001, dport:80, txt:'web (tcp 80)'},{proto:'tcp', sport:50002, dport:443, txt:'https (tcp 443)'},
  {proto:'tcp', sport:50003, dport:22, txt:'SSH (tcp 22)'},{proto:'tcp', sport:50004, dport:23, txt:'Telnet (tcp 23)'},
  {proto:'udp', sport:50005, dport:53, txt:'DNS (udp 53)'},{proto:'icmp', icmpType:'echo', txt:'a ping (ICMP echo)'},
  {proto:'icmp', icmpType:'echo-reply', txt:'a ping reply (ICMP echo-reply)'},
];
card({id:'g3-ext', area:'acl', tier:3, kind:'graded', src:'Q3', title:'Write and place an extended ACL', gen(){
  const P=q3Plan(), a=ri(0,3), b=pick([0,1,2,3].filter(i=>i!==a)), c=pick([0,1,2,3].filter(i=>i!==a&&i!==b));
  const L=i=>P.lans[i], kind=pick(['web','ping','ssh']);
  const srv=(L(b)+ri(10,250))>>>0, H=(L(a)+ri(10,250))>>>0;
  const inA=ip=>inNet(ip,L(a),24), inB=ip=>inNet(ip,L(b),24);
  let policy, deny, model;
  if(kind==='web'){
    policy='Hosts in <b>LAN'+(a+1)+'</b> must not reach the web server <b>'+int2ip(srv)+'</b> (LAN'+(b+1)+') over HTTP. All other traffic is allowed.';
    deny=(s,d,p)=>inA(s)&&d===srv&&p.proto==='tcp'&&p.dport===80;
    model=['access-list 110 deny tcp '+int2ip(L(a))+' 0.0.0.255 host '+int2ip(srv)+' eq www','access-list 110 permit ip any any'];
  } else if(kind==='ping'){
    policy='Hosts in <b>LAN'+(a+1)+'</b> must not be able to ping anything in <b>LAN'+(b+1)+'</b>. All other traffic &mdash; including LAN'+(b+1)+' pinging LAN'+(a+1)+' &mdash; is allowed.';
    deny=(s,d,p)=>inA(s)&&inB(d)&&p.proto==='icmp'&&p.icmpType==='echo';
    model=['access-list 120 deny icmp '+int2ip(L(a))+' 0.0.0.255 '+int2ip(L(b))+' 0.0.0.255 echo','access-list 120 permit ip any any'];
  } else {
    policy='Only host <b>'+int2ip(H)+'</b> in LAN'+(a+1)+' may SSH to the server <b>'+int2ip(srv)+'</b> (LAN'+(b+1)+'); no other LAN'+(a+1)+' host may. All other traffic is allowed.';
    deny=(s,d,p)=>inA(s)&&s!==H&&d===srv&&p.proto==='tcp'&&p.dport===22;
    model=['access-list 130 permit tcp host '+int2ip(H)+' host '+int2ip(srv)+' eq 22','access-list 130 deny tcp '+int2ip(L(a))+' 0.0.0.255 host '+int2ip(srv)+' eq 22','access-list 130 permit ip any any'];
  }
  // it sits inbound on LAN a's interface, so it only ever sees traffic from LAN a
  const srcs=[2,9,100,129,254].map(o=>(L(a)+o)>>>0).concat(kind==='ssh'?[H,H-1,H+1].filter(x=>inA(x)):[]);
  const dsts=[srv,(srv+1)>>>0,(L(b)+(srv-L(b)>100?3:200))>>>0,(L(c)+20)>>>0,ip2int('8.8.8.8')];
  const tgt=Q3_IF[a];
  return {
    prompt:policy+' Write an <b>extended ACL</b> for this, then say which interface it goes on and in which direction.',
    body: q3Topo(P,true)+cmdsHtml('acl','Extended ACL &mdash; one command per line, Ctrl+Enter submits','e.g. access-list 101 deny tcp 198.51.100.0 0.0.0.255 host 203.0.113.9 eq 23',3)+applyHtml(),
    grade(){
      const p=parseExtAcl(cmdLines('acl'));
      let aclWhy=p.err||null;
      if(!aclWhy) outer: for(const s of srcs) for(const d of dsts) for(const pk of ACL_PKTS){
        const want=deny(s,d,pk)?'deny':'permit', got=NR.aclEvaluate(p.acl,s,false,d,pk).action;
        if(got!==want){ aclWhy=(want==='permit'?'It blocks ':'It lets through ')+pk.txt+' from '+int2ip(s)+' to '+int2ip(d)+'.'; break outer; }
      }
      const okAcl=!aclWhy, okIf=Q.ifSel===tgt, okDir=Q.choice===0;
      markCmds('acl',okAcl,model.join('\n'),aclWhy); markIfs(tgt); markChips(0);
      const why=['e.g. '+model.map(mono).join('<br>')+(kind==='ssh'?' &mdash; the permit for '+int2ip(H)+' has to come <b>before</b> the deny, because the first match wins.':' &mdash; without the final '+mono('permit ip any any')+' the implicit deny would block everything else.'),
        'An extended ACL names the destination too, so it goes as close to the <b>source</b> as possible: <b>'+tgt+' inbound</b>, so the unwanted traffic never crosses the network.'];
      if(kind==='ping') why.push('The '+mono('echo')+' keyword matters: without it the entry would also drop LAN'+(a+1)+'\'s <i>replies</i> when LAN'+(b+1)+' pings it.');
      return {ok:okAcl&&okIf&&okDir, verdict: okAcl&&okIf&&okDir?'Correct.':'Check '+[okAcl?null:'the ACL', okIf&&okDir?null:'where it goes'].filter(Boolean).join(' and ')+'.', why: ul(why)};
    },
  };
}});

card({id:'q3e-acl6', area:'acl', tier:1, kind:'flash', src:'Q3', title:'IPv6 ACLs', gen(){
  /* ND is only credited when the answer says it is permitted / keeps working, so "ND is blocked" scores nothing. */
  const nd=[];
  ['neighbour discovery','neighbor discovery','ND','NDP','NS','NA','neighbour solicitation','neighbor solicitation','neighbour advertisement','neighbor advertisement'].forEach(t=>{
    nd.push('permit '+t,'allow '+t,'permit for '+t,'allow for '+t,t+' is permitted',t+' is allowed',t+' still works',t+' keeps working','not block '+t);
  });
  nd.push('solicitation and advertisement are permitted','solicitation and advertisement are allowed','solicitation and advertisement still work');
  return {
    prompt: pick([
      'How do IPv6 ACLs differ from IPv4 ACLs? Explain how an IPv6 list is identified (numbered or named), what each entry can match on, how addresses are written in it, which command applies it to an interface, and what the implicit entries at the end of every IPv6 ACL still permit.',
      'What do you have to do differently when you write and apply an ACL for IPv6 traffic? Describe how the list is identified, what each entry matches on, how you write the addresses, the command that applies it to an interface, and what IPv6 traffic the implicit entries at the end still allow.']),
    points: [
      'IPv6 ACLs are [[always named|only named|are named|is named|must be named|named list|named ACL|named access list|named not numbered|named rather than numbered|named instead of numbered|not numbered|no numbered|given a name|identified by name|use a name|use names]] &mdash; there are no numbered or standard IPv6 lists &mdash; and each entry works like an [[extended ACL|extended style|like extended|source and destination|source destination|destination and source|source plus destination|source address|destination address|destination|protocol and source|protocol source|protocol plus source]] entry: protocol, source and destination (and ports).',
      'There are no wildcard masks: addresses are written with a [[prefix length|prefix-length|/64|prefix|CIDR|slash notation|no wildcard|without wildcard]] (2001:db8:acad:10::/64), or host / any.',
      'A list is applied to an interface with '+mono('ipv6 traffic-filter <name> in|out')+' ([[traffic-filter|traffic filter]], not ip access-group), and to vty lines with ipv6 access-class.',
      'Every IPv6 ACL ends with [[implicit permits for neighbour discovery|'+nd.join('|')+']] (NS, Neighbour Solicitation, and NA, Neighbour Advertisement &mdash; IPv6\'s version of ARP) before the implicit deny ipv6 any any, so ND keeps working. An explicit deny ipv6 any any at the end would block ND too.',
    ],
  };
}});

/* The ACL network in IPv6: 2001:db8:acad:<n>::/64 per LAN. */
function q3Plan6(){
  const ns=shuffle([10,11,12,13,14,15,20,21,22,30,31,40,41,50,60,70,80,90]).slice(0,4).sort((x,y)=>x-y);
  return {ns, lans:ns.map(n=>'2001:db8:acad:'+n+'::/64'), wan:'2001:db8:acad:1::/64'};
}
card({id:'g3-acl6', area:'acl', tier:2, kind:'graded', src:'Q3', title:'Write and apply an IPv6 ACL', gen(){
  const P=q3Plan(), P6=q3Plan6(), a=ri(0,3), b=pick([0,1,2,3].filter(i=>i!==a)), c=pick([0,1,2,3].filter(i=>i!==a&&i!==b));
  const name=pick(['BLOCK-LAN'+(a+1),'NO-LAN'+(b+1),'LAN'+(a+1)+'-FILTER','POLICY6']);
  const K=s=>NR.ac6Parse(s), net=i=>K('2001:db8:acad:'+P6.ns[i]+'::'), inN=(k,i)=>k.slice(0,16)===net(i).slice(0,16);
  const host=(i,h)=>K('2001:db8:acad:'+P6.ns[i]+':'+h);   // h is the 64-bit interface ID, all four groups
  const srcs=['0:0:0:10','0:0:0:abc','1:2:3:4','ffff:ffff:ffff:fffe'].map(h=>host(a,h));
  const dsts=['0:0:0:5','0:0:0:99','ffff:ffff:ffff:fffe'].map(h=>host(b,h)).concat([host(c,'0:0:0:20'),K('2001:db8:cafe::1')]);
  const pkts=[ACL_PKTS[0],ACL_PKTS[4],ACL_PKTS[5]];
  const model=['ipv6 access-list '+name,' deny ipv6 2001:db8:acad:'+P6.ns[a]+'::/64 2001:db8:acad:'+P6.ns[b]+'::/64',' permit ipv6 any any'];
  const tgt=Q3_IF[a];
  return {
    prompt:'The network now runs IPv6. Hosts in <b>LAN'+(a+1)+'</b> must not reach anything in <b>LAN'+(b+1)+'</b>; all other IPv6 traffic is allowed. Write an IPv6 ACL named <b>'+name+'</b>, the command that applies it, and click the interface it goes on.',
    body: q3Topo(P,true,{lans:P6.lans, wan:P6.wan})+cmdsHtml('acl','IPv6 ACL &mdash; one command per line, Ctrl+Enter submits','e.g. ipv6 access-list EXAMPLE',3)+
      fieldHtml('apply','Command that applies it (interface configuration mode)','e.g. ipv6 traffic-filter EXAMPLE out',true)+applyHtml(true),
    grade(){
      const lines=cmdLines('acl'); let aclWhy=null; const acl=NR.aclMake(name,false,6,true);
      const head=(lines[0]||'').split(/\s+/);
      if(!/^ipv6$/i.test(head[0]||'')||!/^access-l/i.test(head[1]||'')) aclWhy='Start with ipv6 access-list '+name+'.';
      else if(head[2]!==name) aclWhy=(head[2]||'').toLowerCase()===name.toLowerCase()?'ACL names are case-sensitive: '+name+', not '+head[2]+'.':'The list should be named '+name+'.';
      else for(const l of lines.slice(1)){
        const t=l.split(/\s+/), i=0, act=(t[0]||'').toLowerCase();
        if(act==='remark') continue;
        if(act!=='permit'&&act!=='deny'){ aclWhy='Expected permit or deny ("'+l+'").'; break; }
        const r=NR.ac6ParseAce(act,t.slice(i+1));
        if(r.err){ aclWhy=r.err.replace(/^%\s*/,'')+' ("'+l+'").'; break; }
        r.ace.seq=(acl.aces.length+1)*10; acl.aces.push(r.ace);
      }
      if(!aclWhy&&!acl.aces.length) aclWhy='There are no permit or deny lines.';
      if(!aclWhy) outer: for(const s of srcs) for(const d of dsts) for(const pk of pkts){
        const want=inN(d,b)?'deny':'permit', got=NR.aclEvaluate(acl,s,false,d,pk).action;
        if(got!==want){ aclWhy=(want==='permit'?'It blocks ':'It lets through ')+pk.txt+' from '+NR.ac6Fmt(s)+' to '+NR.ac6Fmt(d)+'.'; break outer; }
      }
      const raw=(cmdLines('apply')[0]||''), n=iosNorm(raw), m=/^ipv6 traffic-filter (\S+) (in|out|outside)$/.exec(n);
      let applyWhy=null;
      if(/^ip access-group/.test(n)) applyWhy='IPv6 lists are applied with ipv6 traffic-filter, not ip access-group.';
      else if(!m) applyWhy='Expected ipv6 traffic-filter '+name+' in|out.';
      else if(raw.split(/\s+/)[2]!==name) applyWhy='Apply the list by its name, '+name+'.';
      else if(m[2]!=='in') applyWhy='Outbound on the interface facing LAN'+(a+1)+' it would only filter traffic going <i>into</i> LAN'+(a+1)+'.';
      const okAcl=!aclWhy, okApply=!applyWhy, okIf=Q.ifSel===tgt;
      markCmds('acl',okAcl,model.join('\n'),aclWhy); markField('apply',okApply,'ipv6 traffic-filter '+name+' in'); markIfs(tgt);
      return {ok:okAcl&&okApply&&okIf, verdict: okAcl&&okApply&&okIf?'Correct.':'Check '+[okAcl?null:'the ACL', okApply?null:'the apply command', okIf?null:'the interface'].filter(Boolean).join(', ')+'.',
        why: ul(['It goes on <b>'+tgt+' inbound</b>, the interface facing LAN'+(a+1)+' (the source), e.g.<br>'+model.map(l=>mono(l.trim())).join('<br>')+'<br>then on '+tgt.split(' ')[0]+': '+mono('interface '+tgt.split(' ')[1].toLowerCase())+', '+mono('ipv6 traffic-filter '+name+' in'),
          ...(applyWhy?[applyWhy]:[]),
          'IPv6 entries name the protocol, the source <b>and</b> the destination, with prefix lengths instead of wildcards.',
          'Like an extended ACL it goes near the <b>source</b>, so traffic for LAN'+(b+1)+' is dropped before it crosses the network.'])};
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
        why: ul(['<b>Here:</b> Packet 1 is <b>'+int2ip(S.ip)+' &rarr; '+int2ip(P.lo)+'</b>; Packet 2 is <b>'+int2ip(sc.global)+' &rarr; '+int2ip(P.lo)+'</b>.',
          'Packet 1 hasn\'t reached NAT yet, so it carries '+S.name+'\'s own (inside local) address, '+int2ip(S.ip)+'.',
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
        why: ul(['<b>Here:</b> Packet 3 is <b>'+int2ip(P.lo)+' &rarr; '+int2ip(sc.global)+'</b>; Packet 4 is <b>'+int2ip(P.lo)+' &rarr; '+int2ip(S.ip)+'</b>.',
          NAT_KIND_TEXT[kind]+', so the ping left as '+int2ip(sc.global)+' and the ISP replies to <b>that</b> address.',
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
      const why=['<b>Here:</b> Packet 2 leaves with source <b>'+int2ip(src)+'</b>'+(works?' (translated)':' (not translated)')+', and the ping <b>'+(works?'succeeds':'fails')+'</b>.'].concat(sc.global==null?
        [S.name+' ('+int2ip(S.ip)+') isn\'t matched by access-list 1, so NAT leaves it alone: Packet 2 still has the private source <b>'+int2ip(S.ip)+'</b>.',
         'The ISP has no route back to '+cidr(P.lan,24)+', so the reply is dropped &mdash; the ping <b>fails</b>.']:
        [NAT_KIND_TEXT[kind]+': <b>'+int2ip(src)+'</b>.','The ISP routes the public block back to the Gateway, which translates the reply &mdash; the ping <b>succeeds</b>.']);
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
  if(Math.random()<0.5) return {
    prompt:'Why would you use the static NAT option? Say what kind of mapping it creates, what kind of inside device needs it, and why dynamic NAT or PAT would not work for that device.',
    points: [
      'Static NAT is a permanent [[one-to-one|one to one|1 to 1|1:1|permanent mapping|permanently maps|permanently map|permanently mapped|static mapping|fixed mapping|one fixed|one public address|one for one]] mapping between one inside local and one inside global address.',
      'It is for inside devices that must be [[reachable from outside|reachable from outside|reachable from the internet|accessible from outside|accessible from the internet|from the internet|from outside|connect to|people outside|outside users|outside hosts|external users|inbound|can reach|reach it|access it]] &mdash; typically a [[server|servers|web server|mail server]].',
      'Outside hosts need a fixed public address to start a connection to; dynamic NAT and PAT only create a translation when the inside host [[sends first|sends traffic first|sends traffic out first|sends out first|goes out first|traffic goes out first|starts traffic|starts conversation|starts connection|starts first|initiates|initiated|initiate|outbound traffic|outbound connection|originates|first contact]].',
    ],
  };
  /* A scenario: the server, its private address and the public address it is
     published at are drawn here, and the first point answers for THIS server. */
  const srv=pick([{n:'web server',c:'browsers'},{n:'mail server',c:'other mail servers'},{n:'FTP server',c:'customers'}]);
  const lan=pick([{p:'192.168.1.',h:ri(10,30)},{p:'10.1.10.',h:ri(10,30)},{p:'172.16.5.',h:ri(10,30)}]);
  const priv=lan.p+lan.h, pubH=ri(225,230), pub='209.165.200.'+pubH;
  const prompt='The company\'s '+srv.n+' ('+priv+') sits on the inside network and is published at '+pub+
    '; everyone else gets out through a dynamic NAT pool of 209.165.200.242 to 209.165.200.254. '+
    'Why does the '+srv.n+' need static NAT rather than the pool? Say what static NAT gives it, and explain why a pool address would not work for it.';
  return {prompt, points:[
    '<b>Here:</b> static NAT maps '+priv+' to '+pub+' [[one-to-one|one to one|1 to 1|1:1|permanent mapping|permanently maps|permanently map|permanently mapped|static mapping|fixed mapping|one fixed|one public address|one for one]], so '+srv.c+' on the Internet can always [[reach the '+srv.n+'|reachable from outside|reachable from the internet|accessible from outside|accessible from the internet|from the internet|from outside|connect to|people outside|outside users|outside hosts|external users|inbound|can reach|reach it|access it]] at that [[fixed public address|permanent public address|permanent address|static address|same public address|same public IP|same address|same IP|fixed address|fixed IP|known address|never changes|does not change|stays the same|where to find it]].',
    '<b>Why not the pool:</b> dynamic NAT only creates a translation when the inside host [[sends first|sends traffic first|sends traffic out first|sends out first|goes out first|traffic goes out first|starts traffic|starts conversation|starts connection|starts first|initiates|initiated|initiate|outbound traffic|outbound connection|originates|first contact]], so a connection started from outside has no translation to arrive on.',
    'And a pool address is only lent while the translation lasts &mdash; it [[times out|time out|timeout|expire|expires|expired|temporary|temporarily|released|returned to the pool|may be different|might be different|could be different|different next time|different address|address changes|could change|can change|would change|might change|may change|not fixed|not permanent]], so the '+srv.n+' could come back on a different one and nobody outside would know which.',
  ]};
}});
card({id:'q4c-howmany', area:'nat', tier:1, kind:'flash', src:'Q4 c', title:'Public addresses for NAT and PAT', gen(){
  /* PAT's answer is "one", said many ways. The unpaired forms are built from
     number x address-word x with/for x PAT/overload, so "a single public
     address for overload" and "1 public address with PAT" count wherever they
     sit in a list; the paired forms (only/just/single/1/one address) need PAT
     to own them, so "PAT needs one for each host" does not. Bare "needs one"
     is left out on purpose: it would also match that wrong answer. */
  const nums=['one','1','single'], things=['address','public address','ip','public ip','ip address','public ip address'], preps=['with','for','using','via'], pats=['PAT','overload'];
  const pf=['PAT needs only one'];
  pats.forEach(function(p){
    ['only one','just one','single','1','one address','one public address','one ip','one public ip','only 1'].forEach(function(t){ pf.push(p+'~'+t); });
    nums.forEach(function(n){ preps.forEach(function(pr){ pf.push(n+' '+pr+' '+p); }); });
    nums.forEach(function(n){ things.forEach(function(t){ preps.forEach(function(pr){ pf.push(n+' '+t+' '+pr+' '+p); }); }); });
  });
  const PAT='[['+pf.join('|')+']]';
  const PORT='PAT tells the sessions apart by [[port number|port numbers|ports|port]], so many inside hosts share one inside global address.';
  const RUNOUT='When every pool address is in use, the next host [[can\'t|cannot|fail|denied|dropped|wait|unable|blocked|no translation]] get out until a translation times out.';
  if(Math.random()<0.5){
    const n=ri(30,120), m=ri(6,n-10);
    const df=['dynamic NAT needs '+m];
    ['needs','need','requires','require','uses','is','would need','will need'].forEach(function(v){ df.push(('dynamic NAT '+v+' '+m).replace('  ',' ')); });
    ['for','with','in'].forEach(function(pr){ ['','addresses ','public addresses ','ip addresses '].forEach(function(t){ df.push(m+' '+t+pr+' dynamic NAT'); }); });
    df.push(m+' for NAT', m+' addresses for NAT', m+' public addresses for NAT', m+' with NAT');
    return {
      prompt:'An office has '+n+' PCs. At the busiest time of day, at most '+m+' of them are using the Internet at once. How many public addresses does the company need with dynamic NAT, and how many with dynamic NAT with overload (PAT)? Explain why each needs that many, and say what happens with dynamic NAT if the pool is smaller than that.',
      points: [
        '<b>Here:</b> [['+df.join('|')+']] public addresses, and '+PAT+' public address. Only the peak counts: the other '+(n-m)+' PCs are not online then, so they need no address of their own.',
        '<b>Dynamic NAT:</b> each inside host online gets [[its own public address|own public address|own address|own public ip|own ip|one-to-one|one to one|1:1|1 to 1|at the same time|simultaneously|at once|concurrently|same time]] from the pool for as long as its translation lasts, so the pool must cover the '+m+' at the peak.',
        RUNOUT,
        '<b>Overload (PAT):</b> '+PORT,
      ],
    };
  }
  return {
    prompt:'How many public addresses would you need with dynamic NAT, and how many with dynamic NAT with overload (PAT)? Explain why each needs that many, and say what happens with dynamic NAT when every pool address is in use.',
    points: [
      '[[Dynamic NAT needs one address per host online at the same time|dynamic NAT~per host|dynamic NAT~each host|dynamic NAT~every host|dynamic NAT~for each|dynamic NAT~same time|dynamic NAT~simultaneous|dynamic NAT~at once|dynamic NAT~concurrent|dynamic NAT~as many]] &mdash; the pool must be as big as that peak.',
      'Each of those hosts is given [[its own public address|own public address|own address|own public ip|own ip|one-to-one|one to one|1:1|1 to 1]] from the pool while its translation lasts.',
      RUNOUT,
      '<b>Overload (PAT):</b> '+PAT+' public address for all of them.',
      PORT,
    ],
  };
}});
card({id:'q4d-patport', area:'nat', tier:1, kind:'flash', src:'Q4 d', title:'Two hosts, same source port', gen(){
  /* Generic: the rule itself. Scenario: two named PCs, one port, one public
     address, and which PC connects first is drawn — the model says which PC
     keeps the port and which one is moved, and the key words pair each
     outcome with its PC. */
  const tableKw='[[translation table|NAT table|PAT table|translations table|table entry|unique combination|unique pair|address and port|IP and port|socket]]';
  if(Math.random()<0.5) return {
    prompt:'What happens if two internal users select the same source port number for a communication which requires PAT? Explain what the router does with each user\'s port, how it keeps the two sessions apart, and how the replies get back to the right user.',
    points: [
      'The first session [[keeps its port|first keeps|first one keeps|first user keeps|first host keeps|first connection keeps|first session keeps|keeps the port|keeps its original port|keeps its source port]] on the public (inside global) address.',
      'That address and port are now taken, so for the second user the router [[assigns a different port|different port|new port|another port|next available port|unique port|changes the port|translates the port|other port|free port|port is changed|port translation]].',
      'Each session is a separate entry in the '+tableKw+': inside address and port mapped to the public address and its own port, so no two sessions share an entry.',
      'Replies come back to that public port, and the router [[translates them back|translate back|translated back|translates the reply back|translates replies back|translates it back|maps back|maps it back|changes it back|reverse translation|back to the original port|back to its original port]] to the right inside host and its original port.',
    ],
  };
  const n=ri(1025,60000), pub='209.165.200.'+ri(225,238), a=ri(10,60), b=a+ri(1,9);
  const pcs=[{name:'PC-A', ip:'192.168.1.'+a},{name:'PC-B', ip:'192.168.1.'+b}];
  const firstI=ri(0,1), F=pcs[firstI], L=pcs[1-firstI];
  const subj=(p,ord)=>[p.name, p.name.replace('-',''), ord];
  const pair=(p,ord,terms)=>subj(p,ord).map(s=>terms.map(t=>s+'~'+t).join('|')).join('|');
  const keepKw='[['+F.name+' keeps port '+n+'|'+pair(F,'first',['keeps','stays','retains','unchanged',String(n)])+']]';
  const moveKw='[['+L.name+' gets a different port|'+pair(L,'second',['different port','new port','another port','next available port','other port','unique port','free port','changed','changes','translated port',String(n+1),'1024'])+']]';
  return {
    prompt:'PC-A ('+pcs[0].ip+') and PC-B ('+pcs[1].ip+') both open a connection from source port '+n+' through a PAT router whose only public address is '+pub+'. '+F.name+' connects first. Which public (inside global) port does each PC end up with? Explain how the router keeps the two sessions apart and how each reply gets back to the right PC.',
    points: [
      '<b>Here:</b> '+keepKw+' on '+pub+' (it was first, and the port was free); '+moveKw+' on '+pub+', because '+pub+':'+n+' is already in use.',
      'Each session is a separate entry in the '+tableKw+': '+F.ip+':'+n+' &rarr; '+pub+':'+n+' and '+L.ip+':'+n+' &rarr; '+pub+':&lt;new port&gt;, so the two never share an entry.',
      'A reply arrives addressed to '+pub+' and one of those two ports; the router looks the port up and [[translates it back|translate back|translated back|translates the reply back|translates replies back|translates them back|maps back|maps it back|changes it back|reverse translation|back to port '+n+'|back to the original port|back to its original port]] to the right PC\'s address and port '+n+'.',
    ],
  };
}});

/* ═══ Q4 — writing the NAT configuration ═════════════════════════════════
   Graded line by line: the ACL by behaviour (it must match exactly the
   LAN), the inside/outside marks by interface, the rule by its words. Names
   (pools) are compared as typed — IOS names are case-sensitive. */
function natCfgCheck(P,kind,X,pool){
  const lines=cmdLines('nat'), aclLines=lines.filter(l=>/^acc/i.test(l)), rest=lines.filter(l=>!/^acc/i.test(l));
  const sc=iosScript(rest), any=re=>sc.map(o=>({o,m:re.exec(o.cmd)})).find(x=>x.m);
  const rawOf=o=>rest.find(l=>iosNorm(l)===o.cmd)||o.cmd;
  if(!hasCmd(sc,'g0/1','ip nat inside')) return 'G0/1 (the LAN side) needs ip nat inside.';
  if(!hasCmd(sc,'s0/0/1','ip nat outside')) return 'S0/0/1 (towards the ISP) needs ip nat outside.';
  if(hasCmd(sc,'g0/1','ip nat outside')||hasCmd(sc,'s0/0/1','ip nat inside')) return 'Each interface is either inside or outside, not both.';
  if(kind==='static'){
    const r=any(/^ip nat inside source static (\S+) (\S+)$/);
    if(!r) return 'Map the server with ip nat inside source static <inside local> <inside global>.';
    if(ip2int(r.m[1])!==P.pcs[0].ip||ip2int(r.m[2])!==X) return 'The mapping should be '+int2ip(P.pcs[0].ip)+' (inside local) to '+int2ip(X)+' (inside global), in that order.';
    return null;
  }
  const p=parseStdAcl(aclLines);
  if(p.err) return aclLines.length?p.err:'Add a standard ACL that matches the LAN.';
  for(const o of [2,77,254]) if(NR.aclEvaluate(p.acl,P.lan+o,false).action!=='permit') return 'The ACL doesn\'t match '+int2ip(P.lan+o)+', so that host wouldn\'t be translated.';
  for(const ip of [P.lan+256,P.lan-256,P.gwOut,ip2int('10.1.1.1')]) if(NR.aclEvaluate(p.acl,ip>>>0,false).action==='permit') return 'The ACL also matches '+int2ip(ip>>>0)+' &mdash; it should match only '+cidr(P.lan,24)+'.';
  const num=p.acl.name;
  if(kind==='pat'){
    const r=any(/^ip nat inside source list (\S+) interface (\S+) overload$/);
    if(!r) return any(/^ip nat inside source list \S+ interface \S+$/)?'Without overload only one host at a time could use the interface address.':'The rule is ip nat inside source list <acl> interface <outside interface> overload.';
    if(r.m[1]!==num) return 'The rule names list '+r.m[1]+' but your ACL is '+num+'.';
    if(NR.acIfNorm(r.m[2])!=='s0/0/1') return 'Overload onto S0/0/1, the interface facing the ISP.';
    return null;
  }
  const pl=any(/^ip nat pool (\S+) (\S+) (\S+) (?:netmask (\S+)|prefix-length (\d+))$/);
  if(!pl) return 'Define the pool: ip nat pool '+pool.name+' <first> <last> netmask <mask>.';
  const pname=rawOf(pl.o).split(/\s+/)[3];
  if(pname!==pool.name) return pname.toLowerCase()===pool.name.toLowerCase()?'Pool names are case-sensitive: '+pool.name+', not '+pname+'.':'The pool should be named '+pool.name+'.';
  if(ip2int(pl.m[2])!==pool.first||ip2int(pl.m[3])!==pool.last) return 'The pool runs from '+int2ip(pool.first)+' to '+int2ip(pool.last)+'.';
  if(pl.m[4]?pl.m[4]!=='255.255.255.224':+pl.m[5]!==27) return 'The public block is a /27: netmask 255.255.255.224 (or prefix-length 27).';
  const r=any(/^ip nat inside source list (\S+) pool (\S+)( overload)?$/);
  if(!r) return 'The rule is ip nat inside source list <acl> pool <name>.';
  if(r.m[3]) return 'Overload would make it PAT; the brief asks for dynamic NAT, one public address per host.';
  if(r.m[1]!==num) return 'The rule names list '+r.m[1]+' but your ACL is '+num+'.';
  if(rawOf(r.o).split(/\s+/).pop()!==pool.name) return 'The rule must name the pool exactly: '+pool.name+'.';
  return null;
}
function natCfgModel(P,kind,X,pool){
  const m=[];
  if(kind==='static') m.push('ip nat inside source static '+int2ip(P.pcs[0].ip)+' '+int2ip(X));
  else {
    m.push('access-list 1 permit '+int2ip(P.lan)+' 0.0.0.255');
    if(kind==='pat') m.push('ip nat inside source list 1 interface s0/0/1 overload');
    else m.push('ip nat pool '+pool.name+' '+int2ip(pool.first)+' '+int2ip(pool.last)+' netmask 255.255.255.224','ip nat inside source list 1 pool '+pool.name);
  }
  return m.concat(['interface g0/1',' ip nat inside','interface s0/0/1',' ip nat outside']);
}
function natCfgCard(id,tier,title,kinds){
  card({id, area:'nat', tier, kind:'graded', src:'Q4', title, gen(){
    const P=natPlan(), kind=pick(kinds), X=P.pub+ri(2,12), pool={name:pick(['PUBLIC','NAT-POOL','Pool1','INTERNET']), first:P.pub+ri(14,18), last:P.pub+30};
    const task={
      pat:'Configure <b>PAT</b> on the Gateway so every host on '+cidr(P.lan,24)+' shares the address of <b>S0/0/1</b>.',
      pool:'Configure <b>dynamic NAT</b> (no overload) on the Gateway: hosts on '+cidr(P.lan,24)+' are translated to public addresses from a pool named <b>'+pool.name+'</b>, '+int2ip(pool.first)+' to '+int2ip(pool.last)+' (from the /27 public block).',
      static:'PC-A ('+int2ip(P.pcs[0].ip)+') is a server that must be reachable from the Internet. Configure <b>static NAT</b> on the Gateway so it is always translated to <b>'+int2ip(X)+'</b>.',
    }[kind];
    const model=natCfgModel(P,kind,X,pool);
    return {
      prompt:task+' Include the interface commands.',
      body: natTableHtml(P,false)+cmdsHtml('nat','Gateway configuration &mdash; one command per line, Ctrl+Enter submits','e.g. ip nat inside source static 198.51.100.5 203.0.113.5',6),
      grade(){
        const why=natCfgCheck(P,kind,X,pool);
        markCmds('nat',!why,model.join('\n'),why);
        return {ok:!why, verdict: !why?'Correct.':'Not quite.', why: ul([...(why?[why]:[]),'e.g.<br>'+model.map(l=>mono(l.trim())).join('<br>'),
          'Every NAT needs '+mono('ip nat inside')+' on the LAN interface and '+mono('ip nat outside')+' on the interface towards the ISP &mdash; without them nothing is translated.',
          kind==='static'?'A static mapping needs no ACL: it always applies to that one host.':'The ACL says <i>which</i> inside hosts get translated; it must be a standard ACL that matches the LAN.'])};
      },
    };
  }});
}
natCfgCard('g4-natcfg',2,'Configure PAT',['pat']);
natCfgCard('g4-natcfg-x',3,'Configure dynamic or static NAT',['pool','static']);

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
    prompt: pick(['Describe how a PC obtains an IPv4 address using DHCPv4. Name the four messages in order and say what each one does, say who each message is sent to when the PC has no address yet, and say how long the PC may keep the address it is given.',
      'A PC boots with no IP address. Walk through the DHCPv4 exchange that gives it one: name each message in order and what it does, explain who the first message is sent to (the PC has no address to send from), and say how long the PC may keep the address.']),
    points: [
      '<b>1. [[Discover|DHCPDISCOVER]]</b> &mdash; the client has no address, so it [[broadcasts|broadcast|broadcasted|255.255.255.255|all-ones address|sent to everyone|to every device on the LAN|to all devices on the LAN|to all hosts]] to find a DHCP server.',
      '<b>2. [[Offer|DHCPOFFER]]</b> &mdash; a server offers an address (plus mask, gateway, DNS) and a lease time.',
      '<b>3. [[Request|DHCPREQUEST]]</b> &mdash; the client asks for that offer, still by broadcast, so any other servers know theirs was declined.',
      '<b>4. [[Acknowledgement|DHCPACK|ACK|acknowledge|acknowledges]]</b> &mdash; the server confirms; the client uses the address for the [[lease|leases|leased|lease period|expires|expiry|renew|renews|for a set time|limited time|time limit]] time and renews it before it runs out.',
    ],
  };
}});
card({id:'q5b-relay', area:'dhcp', tier:1, kind:'flash', src:'Q5 b', title:'Where the DHCP server must be', gen(){
  /* Shared key words: why the Discover never reaches a remote server, and
     what a relay does about it. */
  const bcast='[[broadcast|broadcasts|broadcasted|broadcasting]]';
  const noFwd='[[routers do not forward broadcasts|do not forward|not forward|t forward|never forward|not cross|t cross|not pass through|t pass through|block broadcast|blocks broadcast|drop broadcast|drops broadcast|stop broadcast|stops broadcast|t get forward|not get forward|t be forward|not be forward|isn t forward|aren t forward|is blocked|are blocked|get blocked|gets blocked|blocked by|blocked at|is dropped|are dropped|get dropped|gets dropped|dropped by|dropped at|stay on the LAN|stays on the LAN|stay in the LAN|stays in the LAN|stay on the local|stays on the local|stay in the local|stays in the local|stay local|stays local|not leave|never leave|t leave]]';
  const relay='[[DHCP relay|relay|relays|relay agent|relaying]]';
  const ucast='[[unicast|unicasts|unicasted|unicasting]]';
  if(chance(.5)) return {
    prompt: 'By default, where must the DHCP server for a PC be, and why? How can we overcome this restriction? Name the feature and the command, and say how the router then sends the client\'s DHCP messages on to the server.',
    points: [
      'By default the server must be on the [[same subnet|same network|same LAN|same broadcast domain|local subnet|local network|same segment|same VLAN]] as the client.',
      'Why: the client has no address yet, so its Discover is a '+bcast+', and '+noFwd+' &mdash; it never reaches a server on another network.',
      'Fix: make the router a '+relay+' with [[ip helper-address|helper-address|helper address|ip helper|helper]] &lt;server&gt; on the interface facing the clients.',
      'The router then forwards the client\'s DHCP broadcasts to the server as '+ucast+' (and passes the replies back).',
    ],
  };
  const gw=pick(['R1','R2','R3']), ifc=pick(['G0/0','G0/1','G0/2']), n=ifc.slice(-1);
  const lan='192.168.'+ri(10,250)+'.0/24', srv='10.'+ri(1,250)+'.'+ri(1,250)+'.'+pick([10,20,50,100,200]);
  const ifForms=['G0/'+n,'Gi0/'+n,'Gig0/'+n,'GigabitEthernet0/'+n,'GigabitEthernet 0/'+n,'LAN interface','interface facing the PCs','PC-facing interface','client-facing interface','interface facing the clients']
    .map(f=>gw+'~'+f).join('|');
  const help=['ip helper-address','helper-address','helper address','ip helper','helper-address pointing to','helper-address set to','helper-address of'].map(f=>f+' '+srv).join('|');
  return {
    prompt: 'PCs on '+gw+'\'s '+ifc+' LAN ('+lan+') got their addresses from a DHCP server on that LAN. The server is moved to a data-centre network two routers away, at '+srv+', and the PCs stop getting addresses. Explain why. Then give the command that fixes it, saying which router and interface it goes on, what role that router then plays, and how it sends the PCs\' DHCP messages on to the server.',
    points: [
      '<b>Here:</b> the server is no longer on the PCs\' subnet. Fix it on the PCs\' gateway, [['+gw+' '+ifc+'|'+ifForms+']], with [['+help+']].',
      'Why: the PCs have no address yet, so their Discover is a '+bcast+', and '+noFwd+' &mdash; it never leaves '+lan+' to reach '+srv+'.',
      'With the helper address, '+gw+' acts as a '+relay+': it picks up the PCs\' DHCP broadcasts on '+ifc+' and forwards them to '+srv+' as '+ucast+', then passes the server\'s replies back onto the LAN.',
    ],
  };
}});
card({id:'q5c-exclude', area:'dhcp', tier:1, kind:'flash', src:'Q5 c', title:'Excluded addresses', gen(){
  return {
    prompt: pick(['Why might we exclude some addresses from the range of addresses in a DHCP pool? Say which kinds of devices usually use the excluded addresses, how those devices get their addresses, and what could go wrong if they were not excluded.',
      'What problem does <span class="mono-inl">ip dhcp excluded-address</span> protect against? Explain how the problem would arise &mdash; which kinds of devices use the excluded addresses and how they get them.']),
    points: [
      'Some devices are configured with [[static|statically|manually|manual|fixed|hard-coded|hardcoded|by hand]] addresses from the same subnet &mdash; the [[default gateway|gateway|router interface|router\'s interface|router address|router\'s address|router\'s IP|gateway address]] address, [[printers and servers|printers|printer|file server|web server|DNS server|mail server|email server|switch management|management address|management IP|and servers|or servers|like servers|such as servers|static server|server\'s address|server\'s IP|servers]], and switch management addresses.',
      'If the pool could hand those out, a client could be given an address already in use: an IP address [[conflict|conflicts|duplicate|clash|same address|same IP|already in use|already used|already assigned|already taken|overlap|overlapping|overlaps]].',
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

/* ═══ Q5 — DHCPv6 ═════════════════════════════════════════════════════════ */
card({id:'q5d-v6', area:'dhcp', tier:1, kind:'flash', src:'Q5', title:'How an IPv6 host gets an address', gen(){
  /* Both variants are general (no scenario). Each prompt asks for exactly what
     its key words grade. Key words that say WHICH method does a thing are
     "method~term" pairings, so a bare list of the three names scores nothing,
     and the flags are graded by value (M = 1 / O = 1 / both 0). */
  const K=forms=>'[['+forms.join('|')+']]';
  const uniq=a=>a.filter((x,i)=>a.indexOf(x)===i);
  const pair=(subj,terms)=>terms.map(t=>subj+'~'+t);
  /* SLAAC: the host makes its own address */
  const OWN=K(['SLAAC the host builds its own address'].concat(pair('SLAAC',['own address','own','itself','builds','build','creates','create','generates','generate','makes','make','picks','pick','chooses','choose','selects','self','EUI-64','EUI64','random','randomly','autoconfigure','autoconfigures','autoconfigured'])));
  /* Stateless: the address is still SLAAC's */
  const SLESS=K(['Stateless takes its address from SLAAC'].concat(pair('stateless',['SLAAC address','SLAAC for the address','SLAAC for address','uses SLAAC','use SLAAC','is SLAAC','is SLAAC with','still SLAAC','own','itself','builds','creates','generates','makes','picks','chooses','information','other information','other settings','other config','other configuration','no record','keeps no record'])));
  /* Stateful: the server assigns the address */
  const ASSIGN=K(['the stateful DHCPv6 server assigns the address'].concat(pair('stateful',['assign','assigns','assigned','hands out','gives out','gives the address','gives addresses','gives it','provides the address','provides addresses','provides it','allocates','allocate','allocated','lease','leases','leased','picks','pick','issues','offers the address'])));
  const TRACK=K(['A stateful server keeps track of every client'].concat(pair('stateful',['track','tracks','record','records','log','logs','DUID','database','binding','bindings','table','remembers','remember','keeps a list'])));
  /* DNS: which server supplies it is part of the key word */
  const Ds=['DHCP','DHCPv6'], Ss=['DHCP','DHCPv6','DHCP server','DHCPv6 server'];
  const Vs=['provides','gives','supplies','sends','offers','hands out'];
  const Xs=['DNS','DNS server','DNS information','information like DNS','information such as DNS','info such as DNS','information to the device such as DNS','information to the devices such as DNS','other information such as DNS'];
  let dns=['DNS server from the DHCPv6 server'];
  Ds.forEach(d=>['from','comes from','is from','provided by','is provided by','supplied by','is supplied by','given by','is given by','is'].forEach(v=>['DNS','DNS server','DNS information'].forEach(x=>dns.push(x+' '+v+' '+d))));
  dns.push('DNS and other information from DHCP','DNS and other information from DHCPv6','DNS DHCP','DNS DHCPv6','DNS server DHCP','DNS server DHCPv6');
  Ss.forEach(sv=>Vs.forEach(v=>Xs.forEach(x=>{ dns.push(sv+' '+v+' '+x); if(/server/.test(sv)){ dns.push(sv+' which '+v+' '+x); dns.push(sv+' that '+v+' '+x); } })));
  const DNS=K(uniq(dns));
  /* Default gateway: from the RA, in so many words */
  const Gs=['gateway','default gateway'], Rs=['RA','RAs','router advertisement','router advertisements','router s RA','router s RAs','router s router advertisement'];
  let gw=['gateway from the RA'];
  Gs.forEach(g=>['from','learned from','is learned from','comes from','is from','taken from','is taken from','obtained from','is obtained from','got from','provided by','is provided by','supplied by','is supplied by','given by','is given by','set by','is set by','advertised by','is advertised by','advertised in','sent in','is sent in','learned via','is learned via','learned through'].forEach(v=>Rs.forEach(r=>gw.push(g+' '+v+' '+r))));
  Rs.forEach(r=>['for','gives','provides','supplies','sets','advertises','tells the host','is used for'].forEach(w=>['the gateway','the default gateway','gateway','default gateway'].forEach(g=>gw.push(r+' '+w+' '+g))));
  ['gateway is the router s link local','gateway is the link local','gateway is link local','gateway is fe80','gateway link local','gateway fe80','default gateway is the router s link local','default gateway is the link local','default gateway is fe80'].forEach(x=>gw.push(x));
  const GW=K(uniq(gw));
  /* The two flags, by value */
  const M=K(['M flag set to 1','M 1','M flag 1','M flag is 1','M flag set','M flag is set','M flag is set to 1','M bit 1','M bit set','M bit is set','M flag on','M flag means stateful','M flag for stateful','M flag is for stateful','managed flag 1','managed flag is 1','managed flag set','managed flag is set','managed config flag set','managed config flag 1','managed config flag is set','managed address flag set','M 0 and O 0','M and O 0','M and O both 0','both 0','both flags 0','both flags are 0']);
  const O=K(['O flag set to 1','O 1','O flag 1','O flag is 1','O flag set','O flag is set','O flag is set to 1','O bit 1','O bit set','O bit is set','O flag on','O flag means stateless','O flag for stateless','O flag is for stateless','other flag 1','other flag set','other flag is set','other config flag set','other config flag 1','other config flag is set','other configuration flag set','0 and O 0','O 0 and M 0','M and O are 0','both are 0','both flags set to 0','both off','both flags off','neither flag set']);
  const FLAGS='The RA\'s flags tell the host which: '+M+' (M = 1) &rarr; stateful; '+O+' (O = 1 with M = 0) &rarr; stateless; both 0 &rarr; SLAAC only.';
  if(chance(.5)) return {
    prompt:'Describe the three ways an IPv6 host can be given its address &mdash; SLAAC, stateless DHCPv6 and stateful DHCPv6. For each one, explain where the address comes from, what the DHCPv6 server provides (if there is one) and whether anything keeps track of the addresses. Then explain how the host knows which method to use: which two flags in the router\'s RA, and what value each has for each method.',
    points:[
      '<b>SLAAC:</b> no server is involved. The host takes the /64 prefix from the router\'s Router Advertisement (RA); with '+OWN+' from that prefix, using EUI-64 or a random interface ID. Nothing keeps track of which addresses are used.',
      '<b>Stateless DHCPv6:</b> '+SLESS+', exactly as above, but a DHCPv6 server also provides other information; the host gets the '+DNS+'. The server keeps no record of addresses.',
      '<b>Stateful DHCPv6:</b> '+ASSIGN+' (and the other information, like DNS), the same job as DHCPv4. '+TRACK+', so it knows which addresses are in use.',
      FLAGS,
    ],
  };
  return {
    prompt:'Compare SLAAC, stateless DHCPv6 and stateful DHCPv6. For each one, explain where the host gets its address, its DNS server and its default gateway. Then say which two flags in the router\'s RA tell the host which method to use, and what value each has for each method.',
    points:[
      '<b>Address:</b> with SLAAC the host takes the /64 prefix from the router\'s RA and '+OWN+' (EUI-64 or a random interface ID); '+SLESS+'; with stateful DHCPv6 '+ASSIGN+' and keeps track of it, like DHCPv4.',
      '<b>DNS server:</b> SLAAC alone gets none from DHCPv6 (only from the RA, if the router includes it); in stateless and stateful DHCPv6 the host gets the '+DNS+'.',
      '<b>Default gateway:</b> the same in all three &mdash; the host takes the '+GW+', which is the router\'s link-local address (e.g. fe80::1). DHCPv6 never hands out a gateway.',
      FLAGS,
    ],
  };
}});

const V6_METHOD=['SLAAC only','SLAAC + stateless DHCPv6','Stateful DHCPv6'];
card({id:'g5-v6flags', area:'dhcp', tier:1, kind:'graded', src:'Q5', title:'Which IPv6 method do the hosts use?', gen(){
  const n=ri(10,99), k=pick([0,1,1,2,2]), extra=k===2&&chance(.4);
  const cfg=['interface GigabitEthernet0/1',' ipv6 address 2001:db8:acad:'+n+'::1/64',' ipv6 address fe80::1 link-local'];
  if(k===1) cfg.push(' ipv6 nd other-config-flag',' ipv6 dhcp server LAN'+n);
  if(k===2) cfg.push(' ipv6 nd managed-config-flag'+(extra?'\n ipv6 nd prefix default no-autoconfig':''),' ipv6 dhcp server LAN'+n);
  const dns=['the DNS server isn\'t given by DHCPv6 &mdash; only the RA (or manual configuration)','the stateless DHCPv6 server','the stateful DHCPv6 server'];
  return {
    prompt:'The PCs on R1\'s G0/1 LAN are set to obtain their IPv6 settings automatically. How do they get their IPv6 address?',
    body: cliHtml(cfg.join('\n'),'R1# show running-config interface g0/1')+chipsHtml(V6_METHOD),
    grade(){
      const ok=Q.choice===k; markChips(k);
      const why=[
        ['No '+mono('ipv6 nd')+' flags are set, so the RA has M = 0 and O = 0: the PCs build their own address from the /64 prefix (SLAAC) and get nothing from DHCPv6.'],
        [mono('ipv6 nd other-config-flag')+' sets O = 1 (M = 0): the address comes from SLAAC, and the other information (DNS, domain) from '+dns[1]+'.'],
        [mono('ipv6 nd managed-config-flag')+' sets M = 1: the PCs ask the DHCPv6 server for their address &mdash; stateful DHCPv6.'+(extra?' '+mono('no-autoconfig')+' also tells them not to build a SLAAC address of their own.':'')],
      ][k];
      why.push('The default gateway always comes from the RA: R1\'s link-local address, fe80::1.');
      return {ok, verdict: ok?'Correct.':V6_METHOD[k]+'.', why: ul(why)};
    },
  };
}});

card({id:'g5-v6msgs', area:'dhcp', tier:2, kind:'graded', src:'Q5', title:'DHCPv6 messages in order', gen(){
  const stateful=chance(.65);
  const seq=stateful?['SOLICIT','ADVERTISE','REQUEST','REPLY']:['INFORMATION-REQUEST','REPLY'];
  const dist=shuffle(['DHCPDISCOVER','DHCPOFFER','DHCPACK','ROUTER SOLICITATION'].concat(stateful?['INFORMATION-REQUEST']:['SOLICIT','ADVERTISE'])).slice(0,stateful?2:3);
  const opts=shuffle(seq.concat(dist)), want=seq.map(m=>opts.indexOf(m));
  return {
    prompt:'A PC uses <b>'+(stateful?'stateful':'stateless')+' DHCPv6</b>. It has already received the router\'s RA. Click the DHCPv6 messages it exchanges with the server, in order &mdash; some of these aren\'t part of it. Click a chosen message again to undo it.',
    body: ordHtml(opts),
    grade(){
      const ok=Q.order.length===seq.length&&Q.order.every((v,i)=>v===want[i]);
      document.querySelectorAll('#qbody .ex-ord').forEach(b=>{
        const i=+b.dataset.o, pos=want.indexOf(i), mine=Q.order.indexOf(i); b.disabled=true; b.classList.remove('on');
        b.querySelector('.ex-ord-n').textContent=pos>=0?pos+1:'✕';
        if(pos>=0&&mine===pos) b.classList.add('ex-ok'); else if(mine>=0||pos>=0) b.classList.add('ex-bad');
      });
      return {ok, verdict: ok?'Correct.':seq.join(', ')+'.', why: ul([
        stateful?'Stateful DHCPv6 is four messages, like DORA: <b>SOLICIT</b> (client, to the all-DHCP-servers multicast ff02::1:2) &rarr; <b>ADVERTISE</b> &rarr; <b>REQUEST</b> &rarr; <b>REPLY</b>.':
          'Stateless DHCPv6 is just <b>INFORMATION-REQUEST</b> &rarr; <b>REPLY</b>: the client already has its SLAAC address and only asks for the other information (DNS, domain).',
        'Not part of it: '+dist.map(d=>({DHCPDISCOVER:'DHCPDISCOVER is DHCPv4 (DHCPv6 starts with SOLICIT)',DHCPOFFER:'DHCPOFFER is DHCPv4 (the DHCPv6 equivalent is ADVERTISE)',DHCPACK:'DHCPACK is DHCPv4 (DHCPv6 confirms with REPLY)',
          'ROUTER SOLICITATION':'the Router Solicitation is ICMPv6, sent to the router (not the server) before any of this &mdash; and the RA has already arrived',
          'INFORMATION-REQUEST':'INFORMATION-REQUEST is stateless DHCPv6 &mdash; it asks only for the other information, never for an address',
          SOLICIT:'SOLICIT starts stateful DHCPv6, looking for a server to lease an address &mdash; a stateless client already has its SLAAC address',
          ADVERTISE:'ADVERTISE is a server\'s answer to a stateful SOLICIT, which a stateless client never sends'})[d]).join('; ')+'.'])};
    },
  };
}});

card({id:'g5-v6relay', area:'dhcp', tier:2, kind:'graded', src:'Q5', title:'Configure a DHCPv6 relay', gen(){
  const lanIf=pick(['G0/0','G0/1']), other=lanIf==='G0/0'?'G0/1':'G0/0', n=ri(10,59), sn=n+ri(1,40), srv='2001:db8:acad:'+sn+'::'+pick(['5','10','53','100','a']);
  const ifs=['G0/0','G0/1','S0/0/0'];
  const rows=[[lanIf,'2001:db8:acad:'+n+'::1/64','the PCs'],[other,'2001:db8:acad:'+(n+60)+'::1/64','printers (no DHCPv6 server)'],['S0/0/0','2001:db8:acad:1::1/64','R2, whose LAN 2001:db8:acad:'+sn+'::/64 holds the DHCPv6 server '+srv]]
    .sort((a,b)=>a[0]<b[0]?-1:1);
  return {
    prompt:'The PCs on R1\'s <b>'+lanIf+'</b> LAN must get their IPv6 settings from the DHCPv6 server <b>'+srv+'</b>, on another network. Which R1 interface needs configuring, and what command goes on it?',
    body:'<div class="ex-scroll"><table class="rt-table ex-table"><thead><tr><th>R1 interface</th><th>Address</th><th>Connects to</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td><td style="font-family:var(--font)">'+r[2]+'</td></tr>').join('')+'</tbody></table></div>'+
      '<div class="ex-apply"><span class="ex-apply-lbl">Interface:</span>'+chipsHtml(ifs)+'</div>'+fieldHtml('cmd','Command (interface configuration mode)','e.g. ipv6 dhcp relay destination 2001:db8:ffff::5',true),
    grade(){
      const okI=Q.choice===ifs.indexOf(lanIf); markChips(ifs.indexOf(lanIf));
      const n2=iosNorm(cmdLines('cmd')[0]||''), m=/^ipv6 dhcp relay destination (\S+)( \S+)?$/.exec(n2);
      const okC=!!m&&NR.ac6Parse(m[1])===NR.ac6Parse(srv);
      markField('cmd',okC,'ipv6 dhcp relay destination '+srv);
      return {ok:okI&&okC, verdict: okI&&okC?'Correct.':'ipv6 dhcp relay destination '+srv+' on '+lanIf+'.', why: ul([
        /ip helper/.test(n2)?mono('ip helper-address')+' only relays DHCPv4. For DHCPv6 it is '+mono('ipv6 dhcp relay destination')+'.':'The relay goes on the interface that <b>hears the clients</b>: '+lanIf+'.',
        mono('ipv6 dhcp relay destination '+srv)+' makes R1 forward the clients\' DHCPv6 multicasts (to ff02::1:2) to the server as unicasts.'])};
    },
  };
}});

/* Stateless or stateful DHCPv6 server on R1, graded by mode: pool lines
   under "ipv6 dhcp pool", the rest under the LAN interface. */
card({id:'g5-v6cfg', area:'dhcp', tier:3, kind:'graded', src:'Q5', title:'Configure a DHCPv6 server', gen(){
  const stateful=chance(.5), n=ri(10,99), name=pick(['IPV6-STATELESS','IPV6-STATEFUL','LAN'+n,'R1-POOL']).replace('STATELESS',stateful?'STATEFUL':'STATELESS');
  const dns='2001:db8:acad:'+pick([1,2,3,100])+'::'+pick(['53','5','254']), dom=pick(['ccna-lab.com','example.net','branch.local','netacad.com']);
  const pfx='2001:db8:acad:'+n+'::';
  const model=['ipv6 dhcp pool '+name].concat(stateful?[' address prefix '+pfx+'/64']:[]).concat([' dns-server '+dns,' domain-name '+dom,'interface g0/1',' ipv6 dhcp server '+name,' ipv6 nd '+(stateful?'managed':'other')+'-config-flag']);
  return {
    prompt:'Make R1 a <b>'+(stateful?'stateful':'stateless')+' DHCPv6</b> server for its G0/1 LAN ('+pfx+'/64). Create a pool named <b>'+name+'</b> that gives out the DNS server <b>'+dns+'</b> and the domain name <b>'+dom+'</b>'+
      (stateful?', and leases addresses from the LAN\'s prefix':'')+'. Then enable it on G0/1 and set the RA flag the PCs need.',
    body: cmdsHtml('v6','Commands &mdash; one per line, Ctrl+Enter submits','e.g. ipv6 dhcp pool EXAMPLE',7),
    grade(){
      let why=null, mode='', seen={pool:false,dns:false,dom:false,addr:false,srv:false,flag:false};
      for(const raw of cmdLines('v6')){
        const l=iosNorm(raw), t=raw.trim().split(/\s+/); let m;
        if(l==='exit'||l==='end'){ mode=''; continue; }
        if(l==='ipv6 unicast-routing'){ mode=''; continue; }
        if(/^ipv6 dhcp pool \S+$/.test(l)){ if(t[3]!==name){ why=t[3].toLowerCase()===name.toLowerCase()?'Pool names are case-sensitive: '+name+', not '+t[3]+'.':'The pool should be named '+name+'.'; break; } mode='pool'; seen.pool=true; continue; }
        if((m=/^interface (\S+)$/.exec(l))){ mode=NR.acIfNorm(m[1]); continue; }
        if(mode==='pool'){
          if((m=/^dns-server (\S+)$/.exec(l))){ if(NR.ac6Parse(m[1])!==NR.ac6Parse(dns)){ why='The DNS server should be '+dns+'.'; break; } seen.dns=true; continue; }
          if((m=/^domain-name (\S+)$/.exec(l))){ if(m[1]!==dom){ why='The domain name should be '+dom+'.'; break; } seen.dom=true; continue; }
          if((m=/^address prefix (\S+)\/(\d+)( .*)?$/.exec(l))){ if(!stateful){ why='A stateless pool hands out no addresses &mdash; leave out address prefix.'; break; }
            if(NR.ac6Parse(m[1])!==NR.ac6Parse(pfx)||m[2]!=='64'){ why='The prefix should be '+pfx+'/64.'; break; } seen.addr=true; continue; }
          why='"'+raw+'" isn\'t a pool command needed here.'; break;
        }
        if(mode==='g0/1'){
          if((m=/^ipv6 dhcp server (\S+)( .*)?$/.exec(l))){ if(t[3]!==name){ why='ipv6 dhcp server must name the pool exactly: '+name+'.'; break; } seen.srv=true; continue; }
          if(l==='ipv6 nd managed-config-flag'){ if(!stateful){ why='The M (managed) flag makes the PCs use stateful DHCPv6 &mdash; stateless needs the O flag, ipv6 nd other-config-flag.'; break; } seen.flag=true; continue; }
          if(l==='ipv6 nd other-config-flag'){ if(stateful){ seen.o=true; continue; } seen.flag=true; continue; }
          if(/^ipv6 nd prefix default no-autoconfig$/.test(l)||/^ipv6 address /.test(l)||l==='no shutdown') continue;
          why='"'+raw+'" isn\'t needed on G0/1.'; break;
        }
        why=mode?'"'+raw+'" doesn\'t belong under interface '+mode+'.':'"'+raw+'": start the pool with ipv6 dhcp pool '+name+'.'; break;
      }
      if(!why&&!seen.pool) why='Create the pool: ipv6 dhcp pool '+name+'.';
      if(!why&&!seen.dns) why='The pool has no dns-server.';
      if(!why&&!seen.dom) why='The pool has no domain-name.';
      if(!why&&stateful&&!seen.addr) why='A stateful pool needs address prefix '+pfx+'/64 to lease addresses from.';
      if(!why&&!seen.srv) why='Enable the pool on G0/1 with ipv6 dhcp server '+name+'.';
      if(!why&&!seen.flag) why=stateful?'Set the M flag on G0/1 (ipv6 nd managed-config-flag) or the PCs will never ask for an address.':'Set the O flag on G0/1 (ipv6 nd other-config-flag) or the PCs will never ask for the DNS server.';
      markCmds('v6',!why,model.join('\n'),why);
      return {ok:!why, verdict: !why?'Correct.':'Not quite.', why: ul([...(why?[why]:[]),'e.g.<br>'+model.map(l=>mono(l.trim())).join('<br>'),
        stateful?'The M flag tells the PCs to get their address from DHCPv6; the pool\'s address prefix is where it comes from.':'Stateless: the PCs keep their SLAAC address, and the O flag tells them to ask DHCPv6 only for the other information.',
        'There is no default-router in a DHCPv6 pool: the gateway always comes from the RA.'])};
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

card({id:'q6-roas', area:'ts', tier:1, kind:'flash', src:'Q6', title:'Router-on-a-stick: what\'s wrong?', gen(){
  const P=chance(.6)?{x:10,y:20,h1:10,h2:10}:q6Plan();
  /* "Fa0/1 goes in VLAN x" is graded by fixed-order phrases, never by subject
     pairing, so an answer that swaps the two ports' VLANs scores neither:
     "switchport access vlan <y> on fa0/1 and ... <x> on fa0/2" contains no
     phrase that joins fa0/2 to <y> or fa0/1 to <x> the wrong way round. */
  const port=(n,h,v)=>{
    const ps=['Fa0/'+n,'F0/'+n,'Fa 0/'+n,'FastEthernet0/'+n,'FastEthernet 0/'+n,h,'port '+n];
    const link=['in','to','=','is in','are in','should be in','must be in','needs to be in','goes in','goes into','belongs in','belongs to','put in','placed in','assigned to','is assigned to','should be assigned to','is','access','->'];
    const out=[];
    ps.forEach(p=>{
      link.forEach(l=>{ out.push(p+' '+l+' VLAN '+v); out.push(p+' '+l+' vlan'+v); });
      out.push(p+' switchport access vlan '+v);
      out.push(p+' vlan '+v);
      out.push('VLAN '+v+' on '+p); out.push('VLAN '+v+' for '+p); out.push('VLAN '+v+' to '+p);
      out.push('switchport access vlan '+v+' on '+p);
    });
    return out.join('|');
  };
  return {
    prompt:'In the figure, host H1 cannot communicate with host H2. Clearly identify, describe and explain the cause of the problem &mdash; say which VLAN the hosts\' frames end up in and why R1 can\'t route them. What modifications do you need to make to fix it? Give the S1 commands.',
    body: q6Body(P,q6Config(P,'access'),false),
    points: [
      '<b>Here:</b> S1 makes Fa0/1 (H1) and Fa0/2 (H2) access ports but never assigns them a VLAN, so both stay in the [[default VLAN 1|VLAN 1|vlan1|default VLAN|native VLAN|no VLAN|not assigned|never assigned|unassigned]] instead of VLAN '+P.x+' and VLAN '+P.y+'.',
      'Why it breaks: their frames cross the trunk untagged (VLAN 1), but R1 only has subinterfaces for VLANs '+P.x+' and '+P.y+' &mdash; [[no subinterface for VLAN 1|no subinterface|no sub-interface|no matching subinterface|has no subinterface|have a subinterface for VLAN 1|without a subinterface|subinterface for VLAN 1|subinterface for the default VLAN|no encapsulation dot1q 1|no interface for VLAN 1|no gateway for VLAN 1|no router interface for VLAN 1|VLAN 1 is not configured on the router|VLAN 1 isn\'t configured on the router|doesn\'t know about VLAN 1|does not know about VLAN 1]] &mdash; so neither host can reach its default gateway. H1 and H2 are in different subnets, so they need the router.',
      'Fix on S1: put [[Fa0/1 in VLAN '+P.x+'|'+port(1,'H1',P.x)+']] and [[Fa0/2 in VLAN '+P.y+'|'+port(2,'H2',P.y)+']] with [[switchport access vlan|access vlan|switchport access|assign the VLAN|assign VLANs|assign the ports|assign the port|assign each port]] under each interface.',
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
  card({id, area:'ts', tier, kind:'graded', src:'Q6', title, gen(){
    const P=q6Plan(), fault=pick(faults), causes=Object.keys(Q6_CAUSE), ans=causes.indexOf(fault), cfg=q6Config(P,fault);
    /* the VLAN the planted tag fault really uses, read back from the config shown */
    const tags=cfg.r1.map(l=>/encapsulation dot1q (\d+)/.exec(l)).filter(Boolean), z=tags.length>1?+tags[1][1]:P.y;
    return {
      prompt:'Host H1 cannot communicate with host H2. Pick the cause, then type the commands that fix it (interface lines included).',
      body: q6Body(P,cfg,true)+chipsHtml(causes.map(k=>Q6_CAUSE[k]))+
        cmdsHtml('fix','Fix &mdash; one command per line, Ctrl+Enter submits','e.g. interface fa0/9',4),
      grade(){
        const okC=Q.choice===ans; markChips(ans);
        const sc=iosScript(cmdLines('fix')), need=q6Fix(P,fault), miss=need.filter(n=>!hasCmd(sc,n[0],n[1]));
        const okF=!miss.length;
        markCmds('fix',okF,q6ModelText(P,fault),okF?null:'Missing: '+miss.map(n=>n[1]+' (under '+n[0]+')').join('; '));
        const gw='so neither host reaches its gateway ('+mono('192.168.'+P.x+'.1')+' / '+mono('192.168.'+P.y+'.1')+'), and H1 and H2 are in different subnets, so they need R1 to talk.';
        const expl={
          access:['<b>Here:</b> S1 Fa0/1 and Fa0/2 are '+mono('switchport mode access')+' but have no '+mono('switchport access vlan')+', so H1 and H2 are both in VLAN 1 instead of VLAN '+P.x+' and VLAN '+P.y+'.',
            'R1 only has subinterfaces for VLANs '+P.x+' and '+P.y+' &mdash; none for VLAN 1 &mdash; '+gw],
          swap:['<b>Here:</b> S1 has the hosts\' ports swapped: Fa0/1 (H1) is in VLAN '+P.y+' and Fa0/2 (H2) is in VLAN '+P.x+'.',
            'H1 is addressed for VLAN '+P.x+' (192.168.'+P.x+'.'+P.h1+') and H2 for VLAN '+P.y+' (192.168.'+P.y+'.'+P.h2+'), so in the wrong VLAN each one\'s gateway is on the other subinterface and neither reaches it.'],
          trunk:['<b>Here:</b> S1 Gi0/1, the link to R1, is '+mono('switchport mode access')+' &mdash; it should be '+mono('switchport mode trunk')+'.',
            'An access port carries one VLAN untagged (VLAN 1 here), so the VLAN '+P.x+' and '+P.y+' frames never cross to R1 and R1\'s tagged replies are dropped &mdash; '+gw],
          shut:['<b>Here:</b> R1 Gi0/0 is never enabled &mdash; the configuration has no '+mono('no shutdown')+' under it.',
            'Router interfaces start shut down, and Gi0/0.'+P.x+' and Gi0/0.'+P.y+' stay down with their physical interface &mdash; '+gw],
          tag:['<b>Here:</b> R1 Gi0/0.'+P.y+' has '+mono('encapsulation dot1q '+z)+' &mdash; it should be '+mono('encapsulation dot1q '+P.y)+'.',
            'It tags and accepts VLAN '+z+' frames, so it never exchanges frames with VLAN '+P.y+': H2 can\'t reach its gateway 192.168.'+P.y+'.1, and H1 can\'t reach H2 through R1.'],
          ip:['<b>Here:</b> R1 Gi0/0.'+P.y+' has '+mono('ip address 192.168.'+(P.y+1)+'.1')+' &mdash; it should be '+mono('192.168.'+P.y+'.1 255.255.255.0')+'.',
            'H2\'s gateway 192.168.'+P.y+'.1 doesn\'t exist, and R1 has no interface in 192.168.'+P.y+'.0/24, so H1\'s traffic can\'t be routed to H2 either.'],
        }[fault];
        return {ok:okC&&okF, verdict: okC&&okF?'Correct.':Q6_CAUSE[fault]+'.', why: ul(expl.concat(['Fix:<br>'+q6ModelText(P,fault).split('\n').map(l=>mono(l.trim())).join('<br>')]))};
      },
    };
  }});
}
q6FaultCard('g6-fault',2,'Router-on-a-stick fault',['access','trunk','shut']);
q6FaultCard('g6-fault-hard',3,'Router-on-a-stick: subtler faults',['tag','ip','swap']);

card({id:'g6-subif', area:'ts', tier:2, kind:'graded', src:'Q6', title:'Add a VLAN to the router', gen(){
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

/* ═══ Q6 — troubleshooting beyond router-on-a-stick ══════════════════════
   The practice exam's Q6 shape: a symptom, the configuration, "identify the
   cause and fix it". Each scenario builds one random network with one fault
   and knows its cause, four plausible wrong causes, how to check a typed
   fix, a model fix, and key-word points for the written (flashcard) form. */
function tsPlan(){
  const t=shuffle(Array.from({length:200},(_,i)=>i+10)).slice(0,3);
  return {A:'192.168.'+t[0], B:'192.168.'+t[1], C:'192.168.'+t[2], wan:rLink30()};
}
function tsTable(P){
  const w1=int2ip(P.wan+1), w2=int2ip(P.wan+2);
  const r=(d,i,a,c)=>'<tr><td>'+d+'</td><td>'+i+'</td><td>'+a+'</td><td style="font-family:var(--font)">'+c+'</td></tr>';
  return '<div class="ex-scroll"><table class="rt-table ex-table"><thead><tr><th>Device</th><th>Interface</th><th>Address</th><th>Connects to</th></tr></thead><tbody>'+
    r('R1','G0/0',P.A+'.1/24','LAN-A (PCs)')+r('','G0/1',P.C+'.1/24','LAN-C')+r('','S0/0/0',w1+'/30','R2 S0/0/0')+
    r('R2','G0/0',P.B+'.1/24','LAN-B (servers, incl. '+P.B+'.10)')+r('','S0/0/0',w2+'/30','R1 S0/0/0')+'</tbody></table></div>';
}
/* every "ip access-group N in|out" (and its "no" form) under one interface */
function tsAclApplied(sc,ifc){
  return sc.filter(o=>o.ifc===ifc).map(o=>/^(no )?ip access-g\S* (\S+)(?: (in|out))?$/.exec(o.cmd)).filter(Boolean).map(m=>({no:!!m[1], num:m[2], dir:m[3]||null}));
}
const TS_SCEN={
  relay(){
    const P=tsPlan(), srv=P.B+'.10', wrong=chance(.5)?pick([int2ip(P.wan+2),P.B+'.1',P.B+'.11']):null;
    const r1='interface GigabitEthernet0/0\n ip address '+P.A+'.1 255.255.255.0'+(wrong?'\n ip helper-address '+wrong:'')+
      '\ninterface Serial0/0/0\n ip address '+int2ip(P.wan+1)+' 255.255.255.252\n!\nip route '+P.B+'.0 255.255.255.0 '+int2ip(P.wan+2);
    return {P, body:tsTable(P)+cliHtml(r1,'R1# show running-config (extract)'),
      symptom:'The PCs on LAN-A are set to get their addresses by DHCP, but they all end up with 169.254.x.x addresses. The DHCP server '+srv+' on LAN-B has a pool for LAN-A, and a LAN-A host with a static address can ping it.',
      cause:'R1 G0/0 doesn\'t relay the PCs\' DHCP requests to '+srv+' &mdash; its ip helper-address is '+(wrong?'wrong':'missing'),
      others:['The DHCP server must be on LAN-A &mdash; DHCP can never cross a router','R1 has no route to LAN-B','The relay belongs on R2 G0/0, next to the server','The PCs need a default gateway set before DHCP can work'],
      check(lines){ const sc=iosScript(lines);
        const h=sc.filter(o=>o.ifc==='g0/0').map(o=>/^(no )?ip helper-address (\S+)$/.exec(o.cmd)).filter(Boolean);
        if(!h.some(m=>!m[1]&&ip2int(m[2])===ip2int(srv))) return 'G0/0 needs ip helper-address '+srv+'.';
        if(wrong&&!h.some(m=>m[1]&&ip2int(m[2])===ip2int(wrong))) return 'Remove the wrong relay too: no ip helper-address '+wrong+'.';
        return null; },
      model:['interface g0/0'].concat(wrong?[' no ip helper-address '+wrong]:[]).concat([' ip helper-address '+srv]),
      points:['The PCs\' 169.254.x.x addresses mean DHCP failed. Their DHCPDISCOVER is a [[broadcast|broadcasts]], and R1 [[does not forward broadcasts|doesn\'t forward|not forwarded|drops|blocks|stops]] onto other networks, so it never reaches '+srv+'.',
        'R1 G0/0 '+(wrong?'relays to the wrong address ('+wrong+')':'has no relay configured')+' &mdash; the [[ip helper-address|helper-address|helper address|relay|relay agent]] must name the DHCP server.',
        'Fix: on R1 [[interface g0/0|g0/0|G0/0|GigabitEthernet0/0]] (the interface facing the clients) '+(wrong?'remove the wrong helper and ':'')+'add ip helper-address '+srv+'.']};
  },
  natin(){
    const P=natPlan(), wrongOut=chance(.4);
    const cfg='interface GigabitEthernet0/1\n ip address '+int2ip(P.gw)+' 255.255.255.0'+(wrongOut?'\n ip nat outside':'')+
      '\ninterface Serial0/0/1\n ip address '+int2ip(P.gwOut)+' 255.255.255.252\n ip nat outside\n!\naccess-list 1 permit '+int2ip(P.lan)+' 0.0.0.255\nip nat inside source list 1 interface Serial0/0/1 overload\nip route 0.0.0.0 0.0.0.0 '+int2ip(P.isp);
    return {P, body:natTableHtml(P,false)+cliHtml(cfg,'Gateway# show running-config (extract)'),
      symptom:'The PCs can ping the Gateway\'s G0/1 and S0/0/1 addresses, but not the ISP\'s Lo0 ('+int2ip(P.lo)+'). '+mono('show ip nat translations')+' on the Gateway is empty.',
      cause:'G0/1 isn\'t marked as the NAT inside interface',
      others:['access-list 1 doesn\'t match the LAN','PAT needs a pool &mdash; it can\'t use the interface address','The Gateway has no route to the ISP','S0/0/1 should be ip nat inside'],
      check(lines){ const sc=iosScript(lines);
        if(!hasCmd(sc,'g0/1','ip nat inside')) return 'G0/1 needs ip nat inside.';
        if(wrongOut&&!hasCmd(sc,'g0/1','no ip nat outside')) return 'G0/1 is also marked outside &mdash; remove it with no ip nat outside.';
        return null; },
      model:['interface g0/1'].concat(wrongOut?[' no ip nat outside']:[]).concat([' ip nat inside']),
      points:['Nothing is translated (the translation table is empty), so the PCs\' pings leave with their [[private|private address|private addresses|192.168]] source addresses and the ISP can\'t reply.',
        'NAT only translates traffic that arrives on an [[inside|ip nat inside|nat inside]] interface and leaves an outside one. G0/1 '+(wrongOut?'is marked outside instead':'isn\'t marked at all')+'.',
        'Fix: [[interface g0/1|g0/1|G0/1|GigabitEthernet0/1]] '+(wrongOut?'no ip nat outside, then ':'')+'ip nat inside.']};
  },
  natacl(){
    const P=natPlan(), k=pick(['mask','net']), x=(P.lan>>>8)&255;
    const bad=k==='mask'?'access-list 1 permit '+int2ip(P.lan)+' 255.255.255.0':'access-list 1 permit 192.168.'+((x+1)&255)+'.0 0.0.0.255';
    const cfg='interface GigabitEthernet0/1\n ip address '+int2ip(P.gw)+' 255.255.255.0\n ip nat inside\ninterface Serial0/0/1\n ip address '+int2ip(P.gwOut)+' 255.255.255.252\n ip nat outside\n!\n'+bad+'\nip nat inside source list 1 interface Serial0/0/1 overload\nip route 0.0.0.0 0.0.0.0 '+int2ip(P.isp);
    return {P, body:natTableHtml(P,false)+cliHtml(cfg,'Gateway# show running-config (extract)'),
      symptom:'The PCs can ping the Gateway\'s G0/1 and S0/0/1 addresses, but not the ISP\'s Lo0 ('+int2ip(P.lo)+'). '+mono('show ip nat translations')+' on the Gateway is empty.',
      cause:'access-list 1 doesn\'t match the PCs\' addresses, so NAT never translates them',
      others:['G0/1 isn\'t marked ip nat inside','The NAT rule is missing overload','The ISP has no route to the public address','NAT needs a pool &mdash; it can\'t use the interface address'],
      check(lines){
        const acc=lines.filter(l=>/^acc/i.test(l)), del=lines.some(l=>/^no acc\S* 1$/i.test(l.trim()));
        const p=parseStdAcl((del?[]:[bad]).concat(acc));
        if(p.err) return acc.length?p.err:'Add an access-list 1 line that matches '+cidr(P.lan,24)+'.';
        for(const o of [2,77,254]) if(NR.aclEvaluate(p.acl,P.lan+o,false).action!=='permit') return 'access-list 1 still doesn\'t match '+int2ip(P.lan+o)+'.';
        for(const ip of [P.lan+256,P.lan-256]) if(NR.aclEvaluate(p.acl,ip>>>0,false).action==='permit') return 'access-list 1 now also matches '+int2ip(ip>>>0)+'.';
        return null; },
      model:['no access-list 1','access-list 1 permit '+int2ip(P.lan)+' 0.0.0.255'],
      points:['The translation table is empty: NAT only translates sources that the [[access list|access-list|ACL|access-list 1]] permits.',
        k==='mask'?'access-list 1 uses '+mono('255.255.255.0')+' &mdash; a [[subnet mask|mask instead of a wildcard|not a wildcard|wrong wildcard]] &mdash; where a wildcard belongs, so it matches only addresses ending in .0.':
          'access-list 1 names the [[wrong network|wrong subnet|192.168.'+((x+1)&255)+'.0]] (192.168.'+((x+1)&255)+'.0), not the PCs\' '+cidr(P.lan,24)+'.',
        'Fix: replace it with access-list 1 permit '+int2ip(P.lan)+' [[0.0.0.255]].']};
  },
  staticnet(){
    const P=tsPlan(), bOct=+P.B.split('.')[2], wrongNet='192.168.'+(bOct===254?bOct-1:bOct+1)+'.0';
    const r1='interface Serial0/0/0\n ip address '+int2ip(P.wan+1)+' 255.255.255.252\n!\nip route '+wrongNet+' 255.255.255.0 '+int2ip(P.wan+2);
    const r2='interface Serial0/0/0\n ip address '+int2ip(P.wan+2)+' 255.255.255.252\n!\nip route '+P.A+'.0 255.255.255.0 '+int2ip(P.wan+1)+'\nip route '+P.C+'.0 255.255.255.0 '+int2ip(P.wan+1);
    return {P, body:tsTable(P)+cliHtml(r1,'R1 (extract)')+cliHtml(r2,'R2 (extract)'),
      symptom:'PCs on LAN-A can ping R2\'s S0/0/0 ('+int2ip(P.wan+2)+') but not the servers on LAN-B. LAN-B hosts can ping R1\'s S0/0/0.',
      cause:'R1\'s static route names the wrong network, so R1 has no route to LAN-B',
      others:['R2 has no route back to LAN-A','R1 S0/0/0 needs a clock rate','The static route needs an administrative distance','R2 G0/0 is shut down'],
      check(lines){
        const ok=lines.map(iosNorm).some(l=>{ const m=/^ip ro\S* (\S+) (\S+) (\S+)(?: \d+)?$/.exec(l); return m&&ip2int(m[1])===ip2int(P.B+'.0')&&m[2]==='255.255.255.0'&&(ip2int(m[3])===P.wan+2||NR.acIfNorm(m[3])==='s0/0/0'); });
        return ok?null:'R1 needs ip route '+P.B+'.0 255.255.255.0 '+int2ip(P.wan+2)+'.'; },
      model:['no ip route '+wrongNet+' 255.255.255.0 '+int2ip(P.wan+2),'ip route '+P.B+'.0 255.255.255.0 '+int2ip(P.wan+2)],
      points:['R1 can reach R2 (the serial link works) but has [[no route|no route to|missing route|not in the routing table]] to LAN-B, '+P.B+'.0/24, so it drops the PCs\' packets.',
        'Its static route was typed for '+wrongNet+' &mdash; the [[wrong network|wrong destination|typo|incorrect network]].',
        'R2\'s routes back to LAN-A and LAN-C are fine, which is why LAN-B can reach R1.',
        'Fix: on R1 add [[ip route '+P.B+'.0 255.255.255.0|ip route]] '+int2ip(P.wan+2)+' (and remove the wrong route).']};
  },
  acldir(){
    const P=tsPlan(), n=ri(1,99);
    const r2='access-list '+n+' deny '+P.C+'.0 0.0.0.255\naccess-list '+n+' permit any\n!\ninterface GigabitEthernet0/0\n ip address '+P.B+'.1 255.255.255.0\n ip access-group '+n+' in';
    return {P, body:tsTable(P)+cliHtml(r2,'R2# show running-config (extract)'),
      symptom:'The policy is that hosts on <b>LAN-C</b> ('+P.C+'.0/24) must not reach <b>LAN-B</b>; everything else is allowed. ACL '+n+' was written for it, but LAN-C hosts can still reach the LAN-B servers.',
      cause:'ACL '+n+' is applied inbound on R2 G0/0, so it only checks traffic leaving LAN-B',
      others:['A standard ACL must go near the source, on R1 G0/1','The wildcard 0.0.0.255 matches the wrong hosts','permit any has to come before the deny','A standard ACL can\'t do this &mdash; it needs an extended ACL'],
      check(lines){ const a=tsAclApplied(iosScript(lines),'g0/0');
        if(!a.some(x=>!x.no&&x.num===String(n)&&x.dir==='out')) return 'Apply it outbound on G0/0: ip access-group '+n+' out.';
        if(!a.some(x=>x.no&&x.num===String(n)&&x.dir!=='out')) return 'Remove the inbound one too: no ip access-group '+n+' in.';
        return null; },
      model:['interface g0/0',' no ip access-group '+n+' in',' ip access-group '+n+' out'],
      points:['ACL '+n+' matches the [[source address|source addresses|only the source|source only]] LAN-C, but it sits [[inbound|incoming|ip access-group '+n+' in]] on R2 G0/0, where every packet comes from LAN-B &mdash; nothing from LAN-C ever passes through it in that direction.',
        'A standard ACL goes near the [[destination|destinations]], on the interface facing LAN-B, but [[outbound|outgoing]] so it checks traffic going into LAN-B.',
        'Fix: on R2 interface g0/0, no ip access-group '+n+' in, then ip access-group '+n+' out.']};
  },
  ospf(){
    const P=tsPlan(), fault=pick(['timers','area']), h=pick([5,15,20,30]), ar=pick([1,2,5]);
    const w=int2ip(P.wan);
    const r1='interface Serial0/0/0\n ip address '+int2ip(P.wan+1)+' 255.255.255.252\n!\nrouter ospf 1\n network '+P.A+'.0 0.0.0.255 area 0\n network '+P.C+'.0 0.0.0.255 area 0\n network '+w+' 0.0.0.3 area 0';
    const r2='interface Serial0/0/0\n ip address '+int2ip(P.wan+2)+' 255.255.255.252'+(fault==='timers'?'\n ip ospf hello-interval '+h:'')+'\n!\nrouter ospf 1\n network '+P.B+'.0 0.0.0.255 area 0\n network '+w+' 0.0.0.3 area '+(fault==='area'?ar:0);
    return {P, body:tsTable(P)+cliHtml(r1,'R1 (extract)')+cliHtml(r2,'R2 (extract)'),
      symptom:'R1 and R2 never become OSPF neighbours ('+mono('show ip ospf neighbor')+' is empty on both), so LAN-A can\'t reach LAN-B. Fix it <b>on R2</b>.',
      cause: fault==='timers'?'The hello and dead intervals on the R1–R2 link don\'t match':'The R1–R2 link is in different areas on R1 and R2',
      others:[fault==='timers'?'The R1–R2 link is in different areas on R1 and R2':'The hello and dead intervals on the R1–R2 link don\'t match','R2\'s network command has the wrong wildcard','R2 S0/0/0 is a passive interface','R1 and R2 have the same router ID'],
      check(lines){
        let mode='', hello=fault==='timers'?h:10, dead=null; const nets=[{a:P.wan,w:3,area:fault==='area'?ar:0},{a:ip2int(P.B+'.0'),w:255,area:0}];
        for(const raw of lines){ const l=iosNorm(raw); let m;
          if((m=/^interface (\S+)$/.exec(l))){ mode=NR.acIfNorm(m[1]); continue; }
          if(/^router ospf \d+$/.test(l)){ mode='ospf'; continue; }
          if(mode==='s0/0/0'){
            if((m=/^ip ospf hello-interval (\d+)$/.exec(l))){ hello=+m[1]; continue; }
            if(l==='no ip ospf hello-interval'||/^no ip ospf hello-interval \d+$/.test(l)){ hello=10; continue; }
            if((m=/^ip ospf dead-interval (\d+)$/.exec(l))){ dead=+m[1]; continue; }
            if(/^no ip ospf dead-interval/.test(l)){ dead=null; continue; }
          }
          if(mode==='ospf'&&(m=/^(no )?network (\S+) (\S+) area (\S+)$/.exec(l))){
            const a=ip2int(m[2]), wc=ip2int(m[3]), A=/^\d+$/.test(m[4])?+m[4]:ip2int(m[4]); if(a==null||wc==null||A==null) return '"'+raw+'" has an invalid address, wildcard or area.';
            if(m[1]){ const i=nets.findIndex(s=>((s.a&~s.w)>>>0)===((a&~wc)>>>0)&&s.w===wc&&s.area===A); if(i>=0) nets.splice(i,1); }
            else nets.push({a,w:wc,area:A});
          }
        }
        const d=dead!=null?dead:4*hello;
        if(hello!==10||d!==40) return 'R2\'s link would still use hello '+hello+' / dead '+d+'; R1 uses 10 / 40.';
        const r=ospfAreaOf(nets,P.wan+2);
        if(!r.hit.length) return 'R2 S0/0/0 would no longer run OSPF at all.';
        if(r.areas.length>1) return 'R2 still has network commands putting the link in two areas &mdash; remove the wrong one with no network.';
        if(r.areas[0]!==0) return 'R2 would still put the link in area '+areaTxt(r.areas[0])+'; R1 has it in area 0.';
        return null; },
      model: fault==='timers'?['interface s0/0/0',' no ip ospf hello-interval']:['router ospf 1',' no network '+w+' 0.0.0.3 area '+ar,' network '+w+' 0.0.0.3 area 0'],
      points: fault==='timers'?[
        'R2 sets [[ip ospf hello-interval|hello-interval|hello interval|hello timer|hello]] '+h+' on S0/0/0, which also makes its dead interval '+(4*h)+'; R1 uses the defaults, 10 and 40.',
        'OSPF neighbours must have [[matching|must match|mismatch|mismatched|same on both|identical]] hello and dead intervals, so the adjacency never forms and no routes are exchanged.',
        'Fix: on R2 [[interface s0/0/0|s0/0/0|S0/0/0|Serial0/0/0]], no ip ospf hello-interval (back to 10/40).']:[
        'R2 puts the R1–R2 link in [[area '+ar+']] while R1 has it in area 0.',
        'Both ends of a link must be in the [[same area|matching area|area mismatch|different areas]], or their hellos are rejected and no adjacency forms.',
        'Fix: under [[router ospf 1|router ospf]] on R2, no network '+w+' 0.0.0.3 area '+ar+', then network '+w+' 0.0.0.3 area 0.'],
    };
  },
  poolgw(){
    const P=tsPlan(), name=pick(['LAN-A','POOL-A','PCS']), lo=ri(5,20), bad=pick([P.A+'.254',P.A+'.'+lo,P.B+'.1']);
    const r1='ip dhcp excluded-address '+P.A+'.1 '+P.A+'.'+lo+'\n!\nip dhcp pool '+name+'\n network '+P.A+'.0 255.255.255.0\n default-router '+bad+'\n dns-server '+P.B+'.10\n!\ninterface GigabitEthernet0/0\n ip address '+P.A+'.1 255.255.255.0';
    return {P, body:tsTable(P)+cliHtml(r1,'R1# show running-config (extract)'),
      symptom:'The PCs on LAN-A get addresses from R1 (e.g. '+P.A+'.'+(lo+1)+') and can ping each other, but can\'t reach anything off LAN-A &mdash; not even R1\'s S0/0/0.',
      cause:'R1\'s DHCP pool gives the PCs the wrong default gateway',
      others:['R1 G0/0 needs ip helper-address','The excluded range overlaps the pool','The pool\'s network command is wrong','R1 G0/0 is shut down'],
      check(lines){ let inPool=false, gw=null;
        for(const raw of lines){ const l=iosNorm(raw), t=raw.trim().split(/\s+/); let m;
          if(/^ip dhcp pool \S+$/.test(l)){ inPool=t[3]===name; if(!inPool) return t[3].toLowerCase()===name.toLowerCase()?'Pool names are case-sensitive: '+name+', not '+t[3]+'.':'The existing pool is '+name+'.'; continue; }
          if(/^interface /.test(l)){ inPool=false; continue; }
          if(inPool&&(m=/^default-router (\S+)$/.exec(l))) gw=m[1];
        }
        return gw!=null&&ip2int(gw)===ip2int(P.A+'.1')?null:'Under ip dhcp pool '+name+', set default-router '+P.A+'.1.'; },
      model:['ip dhcp pool '+name,' default-router '+P.A+'.1'],
      points:['The PCs get addresses, so DHCP itself works, but they are told their [[default gateway|gateway|default-router]] is '+bad+' &mdash; and R1\'s LAN interface is '+P.A+'.1.',
        'Traffic for other networks is sent to a gateway that '+(bad===P.B+'.1'?'isn\'t even on LAN-A':'doesn\'t exist')+', so nothing leaves the LAN, while traffic inside LAN-A still works.',
        'Fix: under [[ip dhcp pool '+name+'|ip dhcp pool|the pool]], default-router '+P.A+'.1; the PCs pick it up when they renew their lease.']};
  },
};
function tsBuild(id){
  const s=TS_SCEN[id](), opts=shuffle([s.cause].concat(s.others)); s.id=id; s.opts=opts; s.ans=opts.indexOf(s.cause); return s;
}
function tsCard(id,tier,title,scen){
  card({id, area:'ts', tier, kind:'graded', src:'Q6', title, gen(){
    const s=tsBuild(pick(scen));
    return {
      prompt:s.symptom+' Pick the cause, then type the commands that fix it (interface or mode lines included).',
      body: s.body+chipsHtml(s.opts)+cmdsHtml('fix','Fix &mdash; one command per line, Ctrl+Enter submits','e.g. interface g0/9',4),
      grade(){
        const okC=Q.choice===s.ans; markChips(s.ans);
        const err=s.check(cmdLines('fix')), okF=!err;
        markCmds('fix',okF,s.model.join('\n'),err);
        return {ok:okC&&okF, verdict: okC&&okF?'Correct.':s.cause.replace(/&mdash;.*/,'').trim()+'.',
          why: ul(['<b>Here:</b> '+s.cause+'.'].concat(s.points.map(p=>p.replace(KW_RE,(m,b)=>b.split('|')[0])),['Commands:<br>'+s.model.map(l=>mono(l.trim())).join('<br>')]))};
      },
    };
  }});
}
tsCard('g6-ts',2,'Troubleshoot: DHCP, NAT, static routes',['relay','natin','staticnet']);
tsCard('g6-ts-hard',3,'Troubleshoot: ACLs, OSPF, DHCP pools',['acldir','ospf','poolgw','natacl']);
/* q6-ts's own model answer for a TS_SCEN scenario: what is wrong HERE first
   (the device or interface and its value), then why that gives exactly this
   symptom, then the fix. Values are read back from the scenario that drew the
   prompt (its model fix and its config), so the two never differ; TS_SCEN's
   own points stay as the graded cards' explanation.
   Cause key words are PAIRED ("R2~term") so they count only for the right
   device or interface, and the first key of every variant carries DECOYS:
   forms that never match anything ("should be~zqx") but are subjects too. A
   decoy sitting between the real subject and the term takes ownership, so
   "R2 is outbound and should be inbound", "G0/1 is correctly outside" and
   "S0/0/1 should be inside" score nothing. Fix keys are commands or imperative
   phrases; none of them is a bare value. */
function q6tsPoints(s){
  const P=s.P, L=str=>str.split('|');
  const K=(shown,forms)=>'[['+[shown].concat(forms).join('|')+']]';
  const pair=(subs,terms)=>[].concat(...subs.map(a=>terms.map(t=>a+'~'+t)));
  const cat=(heads,sufs,val)=>[].concat(...heads.map(h=>sufs.map(f=>h+f+val)));
  const gen=(...lists)=>lists.reduce((acc,l)=>[].concat(...acc.map(x=>l.map(y=>(x+' '+y).trim()))),['']);
  const DEC=L("should be|needs to be|need to be|must be|has to be|supposed to be|instead of|rather than|not|correctly|correct|properly");
  const decoy=names=>pair(DEC.concat(names||[]),['zqx']);
  const R1=L("R1|Router 1|Router1"), R2=L("R2|Router 2|Router2");
  const G01=L("G0/1|Gi0/1|Gig0/1|GigabitEthernet0/1|GigabitEthernet 0/1|LAN interface|LAN-facing interface"), S001=L("S0/0/1|Serial0/0/1|Serial 0/0/1|Se0/0/1|serial interface|serial link|WAN interface|outside interface|ISP");
  const GI01=L("g0/1|gi0/1|gig0/1|gigabitethernet0/1|gigabitethernet 0/1"), GI00=L("g0/0|gi0/0|gig0/0|gigabitethernet0/0|gigabitethernet 0/0");
  const NOTRANS=L("aren't translated|isn't translated|never translated|not being translated|nothing is translated|nothing gets translated|no translation|no translations|untranslated|not natted|aren't natted|doesn't translate|does not translate|doesn't get translated|don't get translated|not get translated|are not translated|is not translated|not translated");
  const NOREPLY=L("can't reply|cannot reply|can't respond|cannot respond|has no route back|no route back|can't route back|cannot route back|no return route|can't route private|can't route to private|cannot route private|no route to the private|no route to 192.168|can't send replies|cannot send replies|replies never come back|reply never comes back|not routable|non-routable|unroutable|can't return|cannot return|drops the replies|doesn't know how to reply|can't be replied to|cannot be replied to|can't be answered");
  const NF=L("don't forward|doesn't forward|do not forward|does not forward|never forwarded|never forward|never cross|never crosses|never pass|never passes|never get forwarded|don't get forwarded|doesn't get forwarded|won't forward|will not forward|can't forward|cannot forward|can't cross|cannot cross|don't cross|doesn't cross|do not cross|does not cross|won't cross|will not cross|stop at the router|stops at the router|drops broadcasts|drop broadcasts|block broadcasts|blocks broadcasts|blocked by the router|don't pass|doesn't pass|do not pass|does not pass|are not forwarded|is not forwarded|are not passed|are not routed|is not routed|aren't forwarded|isn't forwarded|don't route|doesn't route|does not route|do not route|stays on the LAN|stay on the LAN|confined to the LAN|limited to the LAN|never leaves the LAN|never leave the LAN");
  const adj=L("never become neighbours|never become neighbors|no adjacency|adjacency never forms|adjacency doesn't form|adjacency can't form|adjacency won't form|adjacency isn't formed|adjacency is not formed|adjacency not formed|adjacency fails|never form an adjacency|don't form an adjacency|won't form an adjacency|can't form an adjacency|cannot form an adjacency|prevents an adjacency|prevent an adjacency|prevents the adjacency|prevents adjacency|no neighbour relationship|won't become neighbours|don't become neighbours|can't become neighbours|cannot become neighbours|never neighbours|not neighbours|aren't neighbours|no neighbourship|stop the neighbours forming|stops the neighbours forming|stop neighbours forming|stops neighbours forming|prevent neighbours forming|prevents neighbours forming|neighbours don't form|neighbours won't form|neighbours can't form|neighbours never form|neighbours do not form|neighbours cannot form|hellos are rejected|hellos are ignored|hellos rejected|ignore the hellos|ignore each other's hellos|reject the hellos|reject each other's hellos|no routes are exchanged|don't exchange routes|no routes exchanged|no routes");
  switch(s.id){
  case 'relay':{
    const srv=P.B+'.10', wl=s.model.find(l=>/no ip helper/.test(l)), wr=wl?wl.trim().split(' ').pop():null;
    const OBJ=L("helper|helper address|helper-address|ip helper-address|relay|relay agent|DHCP relay|DHCP helper");
    const missing=gen(L("no|missing|without|lacks|lacking|is missing a|is missing the|has no|doesn't have a|does not have a|hasn't got a|has not got a|needs a|need a|forgot the|forgot a|hasn't configured a|has not configured a|didn't configure a|did not configure a"),OBJ).concat(
      OBJ.map(o=>o+' is missing'),OBJ.map(o=>o+' missing'),OBJ.map(o=>o+" isn't configured"),OBJ.map(o=>o+' not configured'),OBJ.map(o=>o+' is not configured'),OBJ.map(o=>o+' is not set'),L("not relaying|isn't relaying|doesn't relay|does not relay|not configured with a helper|isn't configured with a helper"));
    const wrongT=gen(L("helper|helper address|helper-address|ip helper-address|relay|relay address"),L("on"),GI00.concat(L("the LAN interface|the LAN-facing interface|its LAN interface|the interface|the client interface|the clients interface")),L("is wrong|is incorrect|is set wrong|is configured wrong|is pointing at the wrong server")).concat(L("wrong helper|wrong helper address|wrong ip helper-address|wrong relay|wrong relay address|wrong server|wrong DHCP server|wrong address|incorrect helper|incorrect helper address|incorrect ip helper-address|incorrect relay|incorrect address|incorrect server|incorrect DHCP server|helper address is wrong|helper-address is wrong|helper is wrong|relay is wrong|helper address is incorrect|helper-address is incorrect|helper is incorrect|relay is incorrect|helper address set wrong|helper address is set wrong|helper address is configured wrong|is configured with the wrong|is pointing at the wrong|points to the wrong|pointing to the wrong")).concat(wr?
        ['points to '+wr,'pointing to '+wr,'pointed to '+wr,'points at '+wr,'relays to '+wr,'relaying to '+wr,'forwards to '+wr,'sends to '+wr,'helper address '+wr,'helper-address '+wr,'helper address is '+wr,'helper address set to '+wr,'helper address of '+wr,'helper address to '+wr]:[]);
    const addF=L("ip helper-address "+srv+"|helper-address "+srv+"|helper address "+srv+"|helper address to "+srv+"|helper address as "+srv+"|helper address set to "+srv+"|helper address of "+srv+"|helper address should be "+srv+"|helper to "+srv+"|helper as "+srv+"|relay to "+srv+"|relays to "+srv+"|points to "+srv+"|point to "+srv+"|point it to "+srv+"|pointing to "+srv+"|points at "+srv+"|point it at "+srv).concat(
      wr?['from '+wr+' to '+srv]:[],
      [].concat(...GI00.map(g=>[g+' r1 config if ip helper-address '+srv,g+' no ip helper-address '+(wr||'zqx')+' ip helper-address '+srv])));
    const remF=wr?L("no helper-address "+wr+"|no helper address "+wr+"|remove "+wr+"|delete "+wr+"|remove the wrong helper|delete the wrong helper|remove the old helper|remove the wrong one|remove the wrong address|remove the existing helper|remove the incorrect helper|replace "+wr+"|change "+wr+"|from "+wr+" to|instead of "+wr+"|rather than "+wr+"|"+wr+" with|"+wr+" to "+srv+"|"+wr+" for "+srv+"|"+wr+" by "+srv+"|swap "+wr).concat(
        [].concat(...GI00.map(g=>[g+' no ip helper-address '+wr,g+' no helper-address '+wr,g+' r1 config if no ip helper-address '+wr]))):[];
    return [
      '<b>Here:</b> '+K(wr?"R1's G0/0 ip helper-address is wrong":"R1's G0/0 has no ip helper-address",decoy(['R2','G0/1','Gi0/1','LAN-B']).concat(pair(R1,wr?wrongT:missing)))+
        (wr?' &mdash; it relays to '+wr+' instead of the DHCP server '+srv:'')+', so the PCs\' DHCP requests never reach '+srv+'.',
      'The 169.254.x.x addresses mean DHCP failed. A DHCPDISCOVER is a '+K('broadcast',['broadcasts','broadcasted','broadcasting'])+', and a router '+K('does not forward broadcasts',NF)+' onto other networks &mdash; an ip helper-address on the clients\' interface is what turns it into a unicast to the server.',
      'Fix: interface g0/0'+(wr?', '+K('no ip helper-address '+wr,remF)+', then ':', ')+K('add ip helper-address '+srv,addF)+'.'];
  }
  case 'natin':{
    const out=s.model.indexOf(' no ip nat outside')>=0;
    const INS=L("inside|nat inside|ip nat inside|an inside interface|the inside interface|an inside"), OUTS=L("outside|nat outside|ip nat outside|an outside interface|the outside interface");
    const cause=out?
      gen(L("is|is wrongly|is incorrectly|is mistakenly|has been|was"),L("marked|set|configured|defined|declared"),L("as|to|"),OUTS).concat(
        L("has ip nat outside|has nat outside|is ip nat outside|is nat outside|is an outside interface|wrongly outside|wrongly marked outside|outside instead of inside|outside rather than inside|outside instead of ip nat inside|outside instead of nat inside|outside but should|outside when it should|marked outside but|marked as outside but|marked outside when|set as outside when|set to outside when|outside by mistake|wrong side|set the wrong way|backwards|swapped"),
        gen(L("should be|needs to be|must be|should be marked|needs to be marked|should be set to|needs to be set to|should be marked as|needs to be marked as|should be configured as|needs to be configured as|needs"),[''],[''],INS),L("not inside|isn't inside|not nat inside|isn't nat inside")):
      gen(L("not|isn't"),L("marked|set|configured|defined|designated"),L("as|to|for|"),INS).concat(
        L("isn't configured for nat|not configured for nat|no nat inside|no ip nat inside|no nat configured|no nat|unmarked|missing ip nat inside|missing nat inside|missing inside|lacks ip nat inside|lacks nat inside|without ip nat inside|without nat inside|doesn't have ip nat inside|does not have ip nat inside|doesn't have nat inside|has no ip nat inside|has no nat inside|hasn't got ip nat inside|has no inside|not inside|isn't inside|not nat inside|isn't nat inside|not an inside interface|isn't an inside interface|not the inside interface|isn't the inside interface"),
        gen(L("should be|needs to be|must be|should be marked|needs to be marked|should be set to|needs to be set to|should be marked as|needs to be marked as|should be configured as|needs to be configured as|needs"),[''],[''],INS));
    const seqs=(cmds)=>[].concat(...GI01.map(g=>[g+' '+cmds.join(' '),g+' '+cmds.map(c=>'gateway config if '+c).join(' ')]));
    const addF=pair(G01,L("ip nat inside|nat inside|as inside|to inside")).concat(seqs(['ip nat inside']),out?seqs(['no ip nat outside','ip nat inside']).concat(seqs(['no nat outside','ip nat inside']),seqs(['ip nat inside','no ip nat outside'])):[]);
    const remF=out?pair(G01,L("no ip nat outside|no nat outside|remove ip nat outside|remove nat outside|remove outside|remove the outside|remove the ip nat outside|take off outside|delete ip nat outside|from outside to inside|outside to inside")).concat(seqs(['no ip nat outside']),seqs(['no nat outside'])):[];
    return [
      '<b>Here:</b> the Gateway\'s '+K(out?'G0/1 is marked ip nat outside instead of inside':'G0/1 is not marked ip nat inside',decoy(S001).concat(pair(G01,cause)))+' (S0/0/1 is correctly ip nat outside).',
      'NAT only translates packets that arrive on an inside interface and leave an outside one, so the PCs\' pings are '+K('not translated',NOTRANS)+'. They reach the ISP with their private source addresses, and the ISP '+K('can\'t reply',NOREPLY)+' to a private address.',
      'Fix: interface g0/1, '+(out?K('no ip nat outside on g0/1',remF)+', then ':'')+K('ip nat inside on g0/1',addF)+'.'];
  }
  case 'natacl':{
    const m=/access-list 1 permit (\S+) (\S+)/.exec(s.body), lan=int2ip(P.lan), isMask=m[2]==='255.255.255.0', wn=m[1];
    const ACL=L("ACL 1|access-list 1|access list 1|ACL|access-list|access list|acl1");
    const fixW=['wildcard 0.0.0.255','wildcard of 0.0.0.255','wildcard mask 0.0.0.255','wildcard mask of 0.0.0.255','permit '+lan+' 0.0.0.255',lan+' 0.0.0.255','with 0.0.0.255','use 0.0.0.255','using 0.0.0.255','to 0.0.0.255','should be 0.0.0.255','be 0.0.0.255','needs 0.0.0.255','need 0.0.0.255','255.255.255.0 with 0.0.0.255','255.255.255.0 to 0.0.0.255','255.255.255.0 for 0.0.0.255','255.255.255.0 by 0.0.0.255','0.0.0.255 instead of 255.255.255.0','0.0.0.255 rather than 255.255.255.0','0.0.0.255 not 255.255.255.0'];
    if(isMask) return [
      '<b>Here:</b> the Gateway\'s access-list 1 permits '+lan+' with 255.255.255.0 &mdash; '+K('a subnet mask instead of a wildcard',decoy().concat(pair(ACL,L("uses a subnet mask|used a subnet mask|using a subnet mask|has a subnet mask|is a subnet mask|as a subnet mask|subnet mask instead of a wildcard|subnet mask rather than a wildcard|subnet mask not a wildcard|subnet mask where a wildcard|mask instead of a wildcard|mask rather than a wildcard|mask not a wildcard|mask where a wildcard|netmask instead of a wildcard|uses a netmask|uses a mask|used a mask|has a mask|isn't a wildcard|is not a wildcard|not a wildcard mask|wildcard is wrong|wildcard mask is wrong|wrong wildcard|incorrect wildcard|wrong mask|wildcard is backwards|wildcard is inverted|inverted wildcard|should be a wildcard|should use a wildcard|needs a wildcard|needs to be a wildcard|needs a wildcard mask|should use a wildcard mask|uses 255.255.255.0 as the wildcard|uses 255.255.255.0 as a wildcard|has 255.255.255.0 as the wildcard|has 255.255.255.0 as a wildcard|wildcard is 255.255.255.0|wildcard of 255.255.255.0|wildcard 255.255.255.0|wildcard mask 255.255.255.0"))))+'.',
      'As a wildcard, 255.255.255.0 checks the first three octets loosely and the last one exactly, so it '+K('only matches addresses ending in .0',L("only matches .0|ending in .0|ends in .0|end in .0|only .0|only the .0|last octet must be 0|last octet is 0|last octet 0|only addresses ending|only matches the network address|only the network address"))+' &mdash; none of the PCs. Their traffic is '+K('not translated',NOTRANS)+', so it reaches the ISP with private addresses it '+K('can\'t reply',NOREPLY)+' to.',
      'Fix: no access-list 1, then access-list 1 permit '+lan+' '+K('wildcard 0.0.0.255',fixW)+'.'];
    const wnT=['wn instead of lan','wn rather than lan','wn not the lan','is for wn','is set to wn','is wn','contains wn','lists wn','matches wn','only matches wn','has wn','uses wn'].map(t=>t.replace('wn',wn).replace('lan',lan));
    return [
      '<b>Here:</b> the Gateway\'s '+K('access-list 1 permits the wrong network ('+wn+')',decoy().concat(pair(ACL,L("wrong network|wrong subnet|wrong address|wrong range|wrong LAN|wrong IP range|incorrect network|incorrect subnet|incorrect address|different network|different subnet|another network|another subnet|doesn't match the LAN|doesn't match the PCs|doesn't include the PCs|doesn't cover the PCs|isn't the PCs' network|isn't the LAN").concat(wnT))))+' instead of the PCs\' '+lan+'/24.',
      'NAT only translates sources the ACL permits, so the PCs\' pings are '+K('not translated',NOTRANS)+'. They reach the ISP with '+K('private source addresses',L("private source addresses|private source address|private addresses|private address|private IPs|private IP|private source"))+' it has no route back to.',
      'Fix: no access-list 1, then '+K('access-list 1 permit '+lan+' 0.0.0.255',L("access list 1 permit "+lan+" 0.0.0.255|permit "+lan+" 0.0.0.255|"+lan+" 0.0.0.255|permit "+lan+" with 0.0.0.255").concat(pair(ACL,L("should permit "+lan+"|needs to permit "+lan+"|must permit "+lan+"|should match "+lan+"|needs to match "+lan+"|should include "+lan+"|should be "+lan+"|needs to be "+lan))))+'.'];
  }
  case 'staticnet':{
    const wn=s.model[0].split(' ')[3], nh=int2ip(P.wan+2), b=P.B+'.0';
    const R1c=pair(R1,L("wrong network|wrong destination|wrong subnet|wrong address|wrong route|wrong prefix|incorrect network|incorrect route|incorrect destination|incorrect subnet|incorrect address|typo|mistyped|typed wrong|mistyped the network|route to LAN-B is wrong|route to LAN-B is incorrect|route for LAN-B is wrong|route is wrong|route is incorrect|static route is wrong|static route is incorrect|route has the wrong|route is for the wrong").concat(['route for '+wn,'route to '+wn,'static route for '+wn,'static route to '+wn,'points to '+wn,'is for '+wn,'names '+wn,'uses '+wn,'has '+wn,'route '+wn]));
    return [
      '<b>Here:</b> '+K('R1\'s static route is for the wrong network ('+wn+')',decoy(['R2','LAN-A','LAN-C']).concat(R1c))+' instead of LAN-B, '+b+'/24, so '+K('R1 has no route to LAN-B',pair(R1,L("no route|no route to LAN-B|no route to "+b+"|missing route|missing a route|doesn't have a route|does not have a route|has not got a route|lacks a route|no path|can't reach LAN-B|cannot reach LAN-B|can't route|cannot route|doesn't know how to reach|doesn't know how to get to|does not know how to get to|doesn't know the way to|doesn't know a route to|doesn't know about LAN-B|doesn't know LAN-B|has no way to reach|has no way of reaching|doesn't know where LAN-B is|can't get to|cannot get to|not in the routing table|isn't in the routing table|no entry for LAN-B")))+'.',
      'Packets from LAN-A for '+b+' reach R1, find no matching route and no default route, and R1 '+K('drops them',pair(R1,L("drops the packets|drops the traffic|drops it|drop them|drop the packets|dropped by R1|discards them|discards the packets|discards it|R1 drops|R1 discards|throws them away|can't forward them|cannot forward them|doesn't forward them|has nowhere to send")).concat(L("dropped by R1|R1 drops them|R1 drops the packets|R1 drops the traffic|R1 drops it|R1 discards them|R1 discards the packets")))+'. The serial link works and R2\'s routes back to LAN-A and LAN-C are correct, which is why LAN-B hosts can still ping R1.',
      'Fix: on R1, no ip route '+wn+' 255.255.255.0 '+nh+', then '+K('ip route '+b+' 255.255.255.0 '+nh,L("ip route "+b+"|route "+b+" 255.255.255.0|add a route to "+b+"|add a route for "+b+"|add a static route to "+b+"|add a static route for "+b+"|route to "+b+" 255.255.255.0|route for "+b+" 255.255.255.0|replace it with "+b+"|change it to "+b+"|should be "+b+"|should be for "+b+"|needs to be "+b+"|correct it to "+b))+'.'];
  }
  case 'acldir':{
    const n=s.model[1].trim().split(' ')[3];
    const noIn=pair(L('no ip access-group '+n+' out|no ip access-group '+n+' in|no ip access-group'),['zqx']);
    const A=L("applied inbound|applied in|applied incoming|is inbound|set inbound|configured inbound|ACL inbound|access-list inbound|access list inbound|has it inbound|has the ACL inbound|inbound instead of outbound|inbound rather than outbound|in instead of out|in rather than out|in the in direction|in the inbound direction|inbound direction|wrong direction|wrong way|direction is wrong|incorrect direction|wrong way round|the wrong way|backwards|ip access-group "+n+" in|access-group "+n+" in|in the wrong direction|facing the wrong way");
    const fixO=L("apply it outbound|apply outbound|apply the ACL outbound|apply it out|move it to outbound|change it to outbound|change to outbound|change it from inbound to outbound|change inbound to outbound|from in to out|from inbound to outbound|reapply it outbound|re-apply it outbound|apply it in the out direction|should be outbound|needs to be outbound|must be outbound|outbound instead of inbound|outbound rather than inbound|set it outbound|put it outbound|configure it outbound|apply it as outbound|apply it to outbound");
    return [
      '<b>Here:</b> '+K('R2\'s ACL '+n+' is applied inbound on G0/0',decoy(['R1','Router 1','G0/1','Gi0/1','Gig0/1','GigabitEthernet0/1','LAN-A']).concat(noIn,pair(R2,A)))+' &mdash; it should be outbound.',
      'A standard ACL checks only the '+K('source address',L("source addresses|source|sources|sender|source IP"))+'. Inbound on G0/0 it '+K('only sees traffic from LAN-B',L("only sees traffic from LAN-B|only sees LAN-B|sees traffic from LAN-B|only traffic from LAN-B|comes from LAN-B|come from LAN-B|never sees LAN-C|never sees traffic from LAN-C|doesn't see LAN-C|does not see LAN-C|never see LAN-C|never matches|never match|deny never matches|never hits|LAN-C never reaches|LAN-C is never seen|LAN-C traffic never"))+', whose source is never LAN-C, so its deny never matches and LAN-C traffic going the other way passes untested.',
      'Applied outbound on the same interface (near the destination, LAN-B) it checks every packet entering LAN-B. Fix: interface g0/0, '+K('no ip access-group '+n+' in',L("no access-group "+n+" in|remove the inbound|remove it from inbound|remove it from in|remove it inbound|take it off inbound|delete the inbound|remove ip access-group "+n+" in|remove access-group "+n+" in|undo ip access-group "+n+" in"))+', then '+K('apply ip access-group '+n+' out',L("in ip access-group "+n+" out|apply it outbound|apply outbound|apply the ACL outbound|apply it out|reapply it outbound|re-apply it outbound|apply it in the out direction|change it to outbound|change to outbound|move it to outbound|change it from inbound to outbound|change inbound to outbound|from inbound to outbound|from in to out").concat(pair(R2,fixO),pair(['ip access-group'],[n+' out'])))+'.'];
  }
  case 'ospf':{
    const w=int2ip(P.wan);
    if(s.model[0]==='interface s0/0/0'){
      const h=+/hello-interval (\d+)/.exec(s.body)[1], d=4*h;
      const hello=cat(L("hello-interval|hello interval|hello timer|hello timers|hello|ip ospf hello-interval"),['',' is',' set to',' of',' to',' at',' changed to',' configured as',' configured to'],' '+h).concat(cat(L("dead interval|dead timer|dead-interval"),['',' is',' of',' set to'],' '+d),['hello and dead '+h,'hello and dead '+h+' '+d,'timers '+h,'timers are '+h,'timers set to '+h,'is set to '+h,'set to '+h,'is configured as '+h,'is configured with '+h,'changed to '+h,'uses '+h,'using '+h],
        L("wrong hello|incorrect hello|wrong hello interval|wrong hello timer|incorrect hello interval|incorrect hello timer|wrong timers|wrong timer|incorrect timers|hello interval doesn't match|hello timer doesn't match|hello interval is different|hello timer is different|hello interval is wrong|hello timer is wrong|hello interval is incorrect|hello timer is incorrect|timers are different|timers don't match|timers do not match|timer mismatch|hello mismatch|hello interval mismatch|hello timer mismatch|non-default hello|changed hello"));
      return [
        '<b>Here:</b> '+K('R2\'s S0/0/0 has ip ospf hello-interval '+h,decoy(['R1','Router 1','Router1','default','defaults']).concat(pair(R2,hello)))+', so its hello/dead intervals are '+h+'/'+d+' while R1 uses the defaults, 10/40.',
        'OSPF neighbours must have '+K('matching hello and dead intervals',L("matching|must match|have to match|need to match|needs to match|don't match|do not match|doesn't match|mismatch|mismatched|not the same|aren't the same|same on both"))+', so the hellos are rejected, they '+K('never become neighbours',adj)+' and no routes are exchanged &mdash; LAN-A can\'t reach LAN-B.',
        'Fix: on R2, interface s0/0/0, '+K('no ip ospf hello-interval',L("no ip ospf hello|no hello-interval|no hello interval|remove the hello-interval|remove hello-interval|remove the hello interval|remove the hello timer|remove the hello|delete the hello-interval|delete the hello|ip ospf hello-interval 10|s0/0/0 ip ospf hello-interval 10|s0/0/0 no ip ospf hello-interval").concat(pair(R2,L("back to the default|back to default|default hello|default timers|back to 10|reset the hello to 10|reset the hello interval to 10|reset the hello-interval to 10|reset hello to 10|reset it to 10|reset to 10|set it to 10|set it back to 10|set hello to 10|set the hello to 10|set hello interval 10|set the hello interval to 10|change it to 10|change it back to 10|change the hello to 10|change the hello interval to 10|change hello to 10|hello-interval 10|hello interval 10|hello 10|hello timer 10|hello back to 10|revert the hello|revert to the default"))))+' (back to 10/40).'];
    }
    const ar=s.model[1].trim().split(' ').pop();
    return [
      '<b>Here:</b> '+K('R2 puts the R1–R2 link ('+w+' 0.0.0.3) in area '+ar,decoy(['R1','Router 1','Router1']).concat(pair(R2,['area '+ar,'in area '+ar,'to area '+ar,'area '+ar+' instead of area 0','area '+ar+' rather than area 0','not in area 0',"isn't in area 0",'not area 0','wrong area','in the wrong area','a different area','different area','mismatched area','area mismatch','network '+w+' 0.0.0.3 area '+ar])))+', while R1 has it in area 0.',
      'Both ends of a link must be in the '+K('same area',L("same area|matching area|matching areas|area mismatch|areas don't match|area doesn't match|areas do not match|different areas|different area|wrong area|mismatched areas|mismatched area|areas must match|area must match|not in the same area|area ID mismatch|area IDs don't match"))+', or their hellos are rejected: they '+K('never become neighbours',adj)+' and no routes are exchanged.',
      'Fix: on R2 under router ospf 1, no network '+w+' 0.0.0.3 area '+ar+', then '+K('network '+w+' 0.0.0.3 area 0',L("router ospf 1 network "+w+" 0.0.0.3 area 0|"+w+" 0.0.0.3 area 0").concat(pair(R2,L("change it to area 0|change to area 0|change the area to 0|change area to 0|put it in area 0|put the link in area 0|move it to area 0|move the link to area 0|set it to area 0|set the area to 0|into area 0|should be in area 0|should be area 0|needs to be in area 0|needs to be area 0|area 0 instead|replace area "+ar+" with area 0|change area "+ar+" to area 0|area "+ar+" with area 0|area "+ar+" to area 0|from area "+ar+" to area 0|area "+ar+" to 0|network "+w+" 0.0.0.3 area 0"))))+'.'];
  }
  case 'poolgw':{
    const bad=/default-router (\S+)/.exec(s.body)[1], name=s.model[0].replace('ip dhcp pool ',''), gw=P.A+'.1', off=bad===P.B+'.1';
    const GW=L("default gateway|gateway|default-router|default router|pool|DHCP pool");
    const fixT=L("default-router "+gw+"|default router "+gw+"|default-router to "+gw+"|default router to "+gw+"|gateway to "+gw+"|gateway "+gw+"|gateway of "+gw+"|gateway as "+gw+"|gateway should be "+gw+"|should be "+gw+"|change it to "+gw+"|change to "+gw+"|set it to "+gw+"|set to "+gw+"|replace "+bad+" with "+gw+"|"+bad+" with "+gw+"|"+bad+" to "+gw+"|from "+bad+" to "+gw+"|"+bad+" for "+gw+"|"+gw+" instead of "+bad+"|"+gw+" rather than "+bad+"|point it to "+gw+"|point to "+gw+"|use "+gw+"|set "+gw);
    return [
      '<b>Here:</b> R1\'s DHCP pool '+name+' hands out '+K('the wrong default gateway, '+bad,decoy().concat(pair(GW,L("wrong|wrong address|wrong gateway|wrong default gateway|incorrect|incorrect address|incorrect gateway|incorrect default gateway|is "+bad+"|set to "+bad+"|of "+bad+"|as "+bad+"|given as "+bad+"|configured as "+bad+"|configured to "+bad+"|points to "+bad+"|pointing to "+bad+"|"+bad))))+'; R1\'s G0/0 is '+gw+'.',
      'Traffic between PCs on LAN-A goes '+K('directly',L("directly to each other|same subnet|same LAN|same network|local traffic|locally|don't need the gateway|doesn't need the gateway|don't use the gateway|doesn't use the gateway|without the gateway|no gateway needed|isn't needed|not needed|doesn't go through the gateway|don't go through the gateway"))+', so it still works. Everything for another network is sent to the gateway, and '+bad+' '+
        K(off?'isn\'t on LAN-A':'is not a router',L("isn't on LAN-A|not on LAN-A|not on the LAN|isn't on the LAN|not in the subnet|different subnet|another subnet|wrong subnet|doesn't exist|does not exist|no device|nothing at|not a router|isn't a router|not R1|isn't R1|not the router|isn't the router|nonexistent|non-existent|no router|nothing answers|no one answers"))+(off?' (it is R2\'s address on LAN-B)':' (no device answers at it)')+', so nothing leaves the LAN.',
      'Fix: under ip dhcp pool '+name+', '+K('default-router '+gw,fixT)+'; the PCs pick it up when they renew their lease.'];
  }
  }
  return s.points;
}
card({id:'q6-ts', area:'ts', tier:2, kind:'flash', src:'Q6', title:'Troubleshoot it in writing', gen(){
  const s=tsBuild(pick(Object.keys(TS_SCEN)));
  return {
    prompt:s.symptom+' Identify the cause (which device, and which interface or line, is wrong), explain why it produces exactly this symptom, and give the commands that fix it.',
    body:s.body, points:q6tsPoints(s),
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
  ['rip','RIP','routing',['Routing Information Protocol','RIPv1','RIPv2'],['AD 120','hop count'],"A distance-vector routing protocol whose metric is hop count (15 at most; 16 means unreachable). Updates every 30 s. RIPv1 is classful and broadcasts; RIPv2 is classless (carries masks), multicasts to 224.0.0.9 and can authenticate. Blind to bandwidth, slow to converge."],
  ['hopcount','Hop count','routing',['hop count','hop counts'],['RIP metric','max 15'],"RIP's metric: how many routers lie between here and the destination. 15 is the most; 16 means unreachable (infinity), which stops a routing loop counting up for ever."],
  ['cti','Counting to infinity','routing',['count to infinity','counting to infinity','count-to-infinity'],['routing loop','RIP'],"What a routing loop does to a distance-vector route that has died: each router believes the other still reaches it, so they keep advertising it to each other with the metric going up by one each time. RIP caps it by calling 16 infinity (unreachable), and split horizon and route poisoning stop it starting."],
  ['splithorizon','Split horizon','routing',['split-horizon'],[],"A distance-vector rule: never advertise a route back out of the interface it was learned on. With route poisoning (advertising a failed route at metric 16) it stops routing loops."],
  ['poison','Route poisoning','routing',['route poisoning','poison reverse','poisoned route'],['metric 16'],"When a route fails, the router keeps advertising it but at metric 16 (RIP's infinity), so neighbours drop it at once instead of waiting for it to time out. Poison reverse is the same idea sent back the way the route came, overriding split horizon for a dead route."],
  ['autosum','Auto-summary','routing',['auto-summary','no auto-summary','discontiguous network','discontiguous networks'],[],"RIP summarises routes to their classful network when it advertises them across a major-network boundary. With a discontiguous network the same /16 then arrives from two directions; RIPv2's no auto-summary turns it off (RIPv1 can't)."],
  ['classful','Classful','routing',['classful','classless','classful network','classful boundary','major network'],[],"Classful: a network's size follows its first octet — class A /8 (1–126), B /16 (128–191), C /24 (192–223). RIPv1 is classful (no masks in its updates); RIPv2 and OSPF are classless."],
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
  ['multiarea','Multi-area OSPF','ospf',['multi-area','single-area','single area','multiple areas'],[],"Single-area OSPF puts every interface in area 0, which suits a small network but makes every router hold the whole topology. Multi-area OSPF is split into areas around area 0, so detailed LSAs and SPF runs stay inside each area: smaller LSDBs and routing tables, less flooding, faster convergence."],
  ['hello','Hello interval','ospf',['hello timer','hello timers','hellos','hello packets','hello-interval'],['10 s default'],"How often OSPF sends hellos to find and keep neighbours: 10 s on Ethernet and point-to-point links, 30 s on NBMA. Must match on both neighbours: ip ospf hello-interval."],
  ['dead','Dead interval','ospf',['dead timer','dead timers','dead-interval'],['4 × hello'],"How long without a hello before a neighbour is declared down: 4 × hello by default (40 s). Must match on both neighbours: ip ospf dead-interval."],
  ['nbr','Neighbour','routing',['neighbours','neighbor','neighbors'],['same link'],"A router on the same link as this one, that a routing protocol swaps updates with. RIP sends its whole table to its neighbours every 30 seconds; OSPF neighbours must agree on timers, area, subnet and mask before they become an adjacency. Not the same as IPv6 neighbour discovery, which finds MAC addresses."],
  ['adj','Adjacency','ospf',['adjacencies','adjacent'],['FULL'],"A working OSPF relationship between two routers, formed when hello and dead timers, area, subnet and mask, and authentication all match and neither interface is passive. FULL is the final state."],
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
  ['pat','PAT','nat',['overload','NAT overload','Port Address Translation','dynamic NAT with overload'],['many-to-one'],"Also called NAT overload. Many inside hosts share one public address (an interface's or a pool's), told apart by port number; a clashing source port is changed: ip nat inside source list 1 interface s0/0/1 overload."],
  ['natpool','NAT pool','nat',['ip nat pool'],[],"The public addresses dynamic NAT hands out: ip nat pool NAME <first> <last> netmask <mask>."],
  ['port','Port number','general',['port numbers','source port'],['TCP/UDP'],"16-bit numbers identifying each end of a TCP or UDP session (80 web, 22 SSH, 67/68 DHCP). PAT uses the source port to tell inside hosts apart."],
  ['private','Private address','general',['private addresses','RFC 1918'],[],"10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16 — not routed on the Internet, so they need NAT to get out."],
  ['dhcp','DHCPv4','dhcp',['DHCP','DHCP server','Dynamic Host Configuration Protocol'],['UDP 67/68'],"Leases IPv4 settings to clients automatically: address, mask, default gateway and DNS server. Servers listen on UDP 67, clients on UDP 68."],
  ['dora','DORA','dhcp',['DHCPDISCOVER','DHCPOFFER','DHCPREQUEST','DHCPACK','Discover','Offer','Request','Acknowledgement'],[],"The DHCPv4 exchange: Discover (client broadcast), Offer (server), Request (client, still a broadcast), Acknowledgement (server)."],
  ['lease','Lease','dhcp',['leases','lease time'],[],"How long a client may use a DHCP address; it renews, normally at half the lease time, to keep it."],
  ['relay','DHCP relay','dhcp',['relay agent','ip helper-address','helper address'],[],"A router that forwards clients' DHCP broadcasts to a server on another network as unicasts — ip helper-address <server> on the interface facing the clients."],
  ['exclude','Excluded addresses','dhcp',['excluded address','excluded-address','ip dhcp excluded-address','exclusions'],[],"Addresses a DHCP server must never lease because devices use them statically (router, servers, printers): ip dhcp excluded-address <first> [<last>], in global configuration."],
  ['dpool','DHCP pool','dhcp',['ip dhcp pool','address pool'],[],"What a DHCP server leases from: ip dhcp pool NAME, then network, default-router and dns-server. Pool names are case-sensitive."],
  ['broadcast','Broadcast','general',['broadcasts','broadcast domain'],[],"Sent to every host on the local network. Routers don't forward broadcasts — which is why DHCP needs a relay across networks, and why each VLAN is its own broadcast domain. OSPF also calls Ethernet a broadcast network type: hellos every 10 s, dead 40 s, and a DR/BDR is elected."],
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
  ['asbr','ASBR','ospf',['ASBRs','autonomous system boundary router'],['type 5 LSA'],"Autonomous System Boundary Router: connects OSPF to routes from outside it (another protocol, a static default to the ISP) and redistributes them in as type 5 LSAs."],
  ['acl6','IPv6 ACL','acl',['IPv6 ACLs','IPv6 ACL','ipv6 access-list','ipv6 traffic-filter','traffic-filter'],['named only'],"Always named; every entry names the protocol, source and destination, with prefix lengths instead of wildcards. Applied with ipv6 traffic-filter <name> in|out. Ends with implicit permits for neighbour discovery (NS/NA) before the implicit deny."],
  ['natif','ip nat inside / outside','nat',['ip nat inside','ip nat outside','inside interface','outside interface'],[],"Marks which interfaces face the private network (inside) and the ISP (outside). NAT only translates traffic that crosses from an inside interface to an outside one, and back."],
  ['slaac','SLAAC','dhcp',['SLAAC','stateless address autoconfiguration'],[],"An IPv6 host builds its own address from the /64 prefix in the router's RA plus an interface ID (EUI-64 or random). No server tracks it; the gateway is the router's link-local address."],
  ['dhcpv6','DHCPv6','dhcp',['DHCPv6','stateless DHCPv6','stateful DHCPv6','ipv6 dhcp pool','ipv6 dhcp relay destination'],['UDP 546/547'],"Stateless: SLAAC address, other settings (DNS, domain) from the server — INFORMATION-REQUEST, REPLY. Stateful: the server assigns the address too — SOLICIT, ADVERTISE, REQUEST, REPLY. Never gives a default gateway. Relay: ipv6 dhcp relay destination <server>."],
  ['ra','Router Advertisement','dhcp',['Router Advertisement','router advertisements','RA','RAs','M flag','O flag','managed-config-flag','other-config-flag'],['ICMPv6'],"Sent by an IPv6 router: the prefix, the gateway (its link-local address) and two flags. M = 1 → use stateful DHCPv6; O = 1 (M = 0) → SLAAC plus stateless DHCPv6; both 0 → SLAAC only."],
  ['nd','Neighbour Discovery','general',['neighbour discovery','neighbor discovery','NDP','ND','Neighbour Solicitation','Neighbor Solicitation','Neighbour Advertisement','Neighbor Advertisement','NS','NA'],['ICMPv6','replaces ARP'],"IPv6's replacement for ARP, carried in ICMPv6. A Neighbour Solicitation (NS) asks \"who has this IPv6 address — what's your MAC?\" and a Neighbour Advertisement (NA) answers \"that's me, here's my MAC\". Hosts also use it to check a device on the link is still reachable and to find routers. Every IPv6 ACL implicitly permits NS and NA, or hosts couldn't even reach their gateway."],
  ['linklocal','Link-local address','general',['link-local','link-local address','link-local addresses'],['FE80::/10'],"An IPv6 address valid only on its own link, starting fe80. Every IPv6 interface has one; IPv6 hosts use the router's link-local address as their default gateway."],
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
  /* group 1 is the form; a plural ending ("LSDBs", "routing tables") is
     part of the link but not of the lookup */
  DICT_RE=new RegExp('(?<![\\w-])('+forms.map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?:e?s)?(?![\\w-])','gi');
}
function dictPick(text){
  const c=(DICT_FORMS[text.toLowerCase()]||[]).find(x=>(x.d.cs||!/[a-z]/.test(x.f))?x.f===text:true);
  return c?c.d:null;
}
/* Turn the terms inside root into links: every mention in an answer or
   explanation (owner's ask — a term repeated later is just as worth
   looking up), only the first in a dictionary entry (`once`), where a
   description full of links would be noise. Code, commands and existing
   links are left alone. */
function dictLink(root,selfId,once){
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
      const d=dictPick(m[1]); if(!d||done.has(d.id)) continue;
      if(once) done.add(d.id);
      frag=frag||document.createDocumentFragment();
      frag.appendChild(document.createTextNode(t.slice(last,m.index)));
      /* an inline span with button semantics: a real <button> is inline-block
         and lets a line break fall between "(" and the term */
      const a=document.createElement('span'); a.className='ex-term'; a.setAttribute('role','button'); a.tabIndex=0; a.dataset.t=d.id; a.textContent=m[0];
      /* name the entry, and the word linked when it is another name for it */
      a.title=m[1].toLowerCase()===d.name.toLowerCase()?'Look up “'+d.name+'” in the dictionary':'Look up “'+m[0]+'” — in the dictionary under “'+d.name+'”';
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
  body.querySelectorAll('.ref-card').forEach(c=>dictLink(c.querySelector('.ref-card-desc'),c.id.slice(5),true));
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
/* The flash waits for the jump's scroll to finish: started on the click, it
   had mostly faded before the card arrived. "Finished" is the target on
   screen and the page still for four frames, capped at 1.5s in case the
   reader takes over the scroll. A second jump cancels a pending flash. */
let dictWait=0;
function afterScroll(el,fn){
  const tok=++dictWait, t0=performance.now(); let y=NaN, still=0;
  (function tick(){
    if(tok!==dictWait) return;
    const r=el.getBoundingClientRect(), ny=window.scrollY;
    still=(ny===y)?still+1:0; y=ny;
    if((still>=4&&r.top<innerHeight&&r.bottom>0)||performance.now()-t0>1500) fn();
    else requestAnimationFrame(tick);
  })();
}
function dictJump(id){
  const c=$('dict-'+id); if(!c) return;
  if(c.classList.contains('hidden')){ $('dict-q').value=''; dictFilter(''); }
  document.querySelectorAll('#dict-body .ex-flash').forEach(x=>x.classList.remove('ex-flash'));
  c.scrollIntoView({behavior:SMOOTH(), block:'center'});
  afterScroll(c,()=>{ void c.offsetWidth; c.classList.add('ex-flash'); });
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
function freshState(){ return {step:0, diff:1, off:[], foff:[], cards:{}, answered:0, correct:0, lastNew:null}; }
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
function famOn(c){ return c.fam.some(f=>S.foff.indexOf(f)<0); }
function inPool(c){ return inTier(c)&&S.off.indexOf(c.area)<0&&famOn(c); }
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
    $('q-prompt').innerHTML='There are no cards for these areas'+(S.foff.length?' in '+FAMS.filter(f=>S.foff.indexOf(f.id)<0).map(f=>f.name).join(' and '):'')+' at this difficulty yet.'; $('qbody').innerHTML='';
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
    /* just the rating: how many cards each one puts between you and the
       card again is the scheduler's business, not the learner's (owner's ask) */
    $('rate-hard').innerHTML='Hard <kbd>1</kbd>';
    $('nxtbtn').innerHTML='Good <kbd>2</kbd>';
    $('rate-easy').innerHTML='Easy <kbd>3</kbd>';
    show('rate-hard',true); show('rate-easy',true);
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
  if(e.key==='Escape'&&$('fam-menu').classList.contains('open')){ toggleFamMenu(false); $('fam-btn').focus(); return; }
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
/* ── The IP dropdown: IPv4 / IPv6, the same panel and rules as Areas. The
   unticked versions are stored (S.foff); one stays ticked; a card that
   holds for both versions shows whichever is ticked. */
function famChanged(){
  saveState(); syncControls();
  if(!cur||(phase==='answer'&&!famOn(cur))) loadQ(); else renderSide();
}
function toggleFamMenu(force){
  const m=$('fam-menu'), b=$('fam-btn'), open=force!=null?force:!m.classList.contains('open');
  m.classList.toggle('open',open); b.classList.toggle('open',open); b.setAttribute('aria-expanded',open?'true':'false');
}
$('fam-rows').addEventListener('change',e=>{
  const box=e.target.closest('input[data-f]'); if(!box) return;
  const id=box.dataset.f;
  if(box.checked) S.foff=S.foff.filter(x=>x!==id);
  else if(FAMS.filter(f=>S.foff.indexOf(f.id)<0&&f.id!==id).length===0){
    box.checked=true;
    const note=$('fam-note'); if(note){ note.textContent='Keep at least one ticked.'; note.classList.add('show'); }
    return;
  } else if(S.foff.indexOf(id)<0) S.foff.push(id);
  famChanged();
});
document.addEventListener('mousedown',e=>{ if(!e.target.closest('#fam-dd')) toggleFamMenu(false); });
function syncControls(){
  document.querySelectorAll('#diff-row .cbtn').forEach(b=>b.classList.toggle('on',+b.dataset.d===S.diff));
  const live=liveAreas();
  if(!live.some(a=>S.off.indexOf(a.id)<0)) S.off=[];
  $('area-rows').innerHTML=live.map(a=>{
    const n=CARDS.filter(c=>c.area===a.id&&inTier(c)).length;
    return '<label class="opt-row ex-area-row"><input type="checkbox" class="req-checkbox" data-a="'+a.id+'"'+(S.off.indexOf(a.id)<0?' checked':'')+'>'+
      '<span class="opt-row-label">'+a.name+'</span><span class="ex-area-n">'+n+'</span></label>';
  }).join('')+'<div class="ex-area-note" id="area-note"></div>';
  if(!Array.isArray(S.foff)||S.foff.length>=FAMS.length) S.foff=[];
  $('fam-rows').innerHTML=FAMS.map(f=>{
    const n=CARDS.filter(c=>c.fam.indexOf(f.id)>=0&&inTier(c)&&S.off.indexOf(c.area)<0).length;
    return '<label class="opt-row ex-area-row"><input type="checkbox" class="req-checkbox" data-f="'+f.id+'"'+(S.foff.indexOf(f.id)<0?' checked':'')+'>'+
      '<span class="opt-row-label">'+f.name+'</span><span class="ex-area-n">'+n+'</span></label>';
  }).join('')+'<div class="ex-area-note" id="fam-note"></div>';
  const fon=FAMS.filter(f=>S.foff.indexOf(f.id)<0);
  $('fam-btn-txt').textContent=fon.length===FAMS.length?'IPv4 & IPv6':fon[0].name+' only';
  const on=live.filter(a=>S.off.indexOf(a.id)<0);
  $('area-btn-txt').textContent=on.length===live.length?'All areas':on.length<=2?on.map(a=>a.name).join(', '):on.length+' areas';
  const n=pool().length, add=CARDS.filter(c=>c.tier===S.diff&&S.diff>1&&inPool(c)).length;
  $('pool-note').textContent=n+' card'+(n===1?'':'s')+(add?' ('+add+' added by '+TIER_NAME[S.diff]+')':'');
}
/* The progress table is updated in place, not rebuilt, so each bar's width
   transitions from where it was (styles: exam.css .ex-bar) and a bar that
   has just reached 100% comfortable flares once, then breathes; one that
   was already full when the page loaded only breathes. It is rebuilt only
   when the set of areas changes (difficulty). */
function renderSide(){
  const p=pool();
  $('ch-ans').textContent=S.answered;
  $('ch-pct').textContent=S.answered?Math.round(100*S.correct/S.answered)+'%':'–';
  $('ch-due').textContent=p.filter(c=>S.cards[c.id]&&S.cards[c.id].due<=S.step).length;
  const areas=AREAS.filter(a=>CARDS.some(c=>c.area===a.id&&inTier(c)));
  const body=$('prog-body'), key=areas.map(a=>a.id).join(',');
  const fresh=body.dataset.key!==key, first=!renderSide.seen;
  if(fresh){
    body.dataset.key=key;
    body.innerHTML='<table class="rt-table ex-prog"><thead><tr><th>Area</th><th>New</th><th>Learning</th><th>Comfortable</th><th></th></tr></thead><tbody>'+
      areas.map(a=>'<tr data-a="'+a.id+'"><td>'+a.name+'</td><td class="ex-n-new"></td><td class="ex-n-learn"></td><td class="ex-n-comf"></td>'+
        '<td class="ex-bar-cell"><div class="ex-bar"><span class="ex-b-comf" style="width:0"></span><span class="ex-b-learn" style="width:0"></span></div></td></tr>').join('')+
      '</tbody></table>';
  }
  const set=()=>areas.forEach(a=>{
    const tr=body.querySelector('tr[data-a="'+a.id+'"]'); if(!tr) return;
    const cs=CARDS.filter(c=>c.area===a.id&&inTier(c));
    const n={new:0,learn:0,comf:0}; cs.forEach(c=>n[cardStatus(c.id)]++);
    const off=S.off.indexOf(a.id)>=0;
    tr.classList.toggle('ex-off',off);
    if(off) tr.title='Not in the rotation (unticked under Areas)'; else tr.removeAttribute('title');
    tr.querySelector('.ex-n-new').textContent=n.new;
    tr.querySelector('.ex-n-learn').textContent=n.learn;
    tr.querySelector('.ex-n-comf').textContent=n.comf;
    const bar=tr.querySelector('.ex-bar'), full=cs.length>0&&n.comf===cs.length;
    bar.querySelector('.ex-b-comf').style.width=(100*n.comf/cs.length)+'%';
    bar.querySelector('.ex-b-learn').style.width=(100*n.learn/cs.length)+'%';
    bar.classList.toggle('ex-has',n.comf>0);
    if(!full) bar.classList.remove('ex-full','ex-flare');
    else if(!bar.classList.contains('ex-full')&&!bar.classList.contains('ex-flare')) bar.classList.add(first?'ex-full':'ex-flare');
  });
  /* a new table starts its bars at 0, so they fill on the next frame */
  if(fresh&&!first) requestAnimationFrame(set); else if(fresh) requestAnimationFrame(()=>requestAnimationFrame(set)); else set();
  renderSide.seen=true;
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
  const keep={diff:S.diff, off:S.off.slice(), foff:S.foff.slice()};
  Object.keys(S).forEach(k=>delete S[k]); Object.assign(S,freshState(),keep);
  saveState(); lastId=null; loadQ();
}

syncControls();
dictRender();
loadQ();
AnswerKeys.wire({answers:'#qbody .afield input, #qbody textarea.ex-flash', submit:'checkAll'});
