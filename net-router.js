/* net-router.js — the router services shared by access_control.html, the
   routing trainer and the troubleshooting trainer: ACLs (standard, extended
   and IPv6 — matching, parsing, the CLI that builds and applies them, show
   access-lists), NAT (static, dynamic, PAT — translation, the CLI, the show
   commands), the SSH server model and its CLI, PPP link state, and IOS
   interface naming.

   None of it owns a topology. A router is {name, ifaces:[{name, ip, pfx,
   up, nat, aclIn, aclOut, ...}], acls:{}, nat:natNew(), ssh:sshNew(), cm, ci,
   log} — forwarding packets through one is the page's job, because the
   pages model the network underneath differently. Pages destructure what
   they use: const {aclEvaluate, natOut, ...}=NetRouter. */
(function(window){
  const isValidIP=window.LabShared.isValidIP;
  function ip2int(ip){ const p=ip.split('.').map(Number); return((p[0]<<24)|(p[1]<<16)|(p[2]<<8)|p[3])>>>0; }
  function int2ip(n){ return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.'); }
  function maskInt(c){ return c<=0?0:(c>=32?0xFFFFFFFF>>>0:(0xFFFFFFFF<<(32-c))>>>0); }
  function cidr2mask(c){ return int2ip(maskInt(c)); }
  function netIntOf(ip,c){ return (ip & maskInt(c))>>>0; }

  /* The shapes of the ACL, NAT and SSH commands this file's handlers
     understand, for a page that checks lines against a grammar before
     running them (lab-shared.js cliCheck). The ACE bodies are spelled out,
     so a stray word inside an entry gets IOS's caret too; whether a shape
     suits the list it is typed into (a protocol in a standard list, say) is
     still the parsers' call, and they say so in words. */
  const SIDE4='( any | host <ip> | <ip> <ip> )', SIDE6='( any | host <v6> | <v6p> )';
  const PORT='[ ( eq|neq|gt|lt <word> | range <word> <word> ) ]';
  const STD_ACE='( any | host <ip> | <ip> [<ip>] ) [log]';
  const EXT_ACE='ip|icmp|tcp|udp '+SIDE4+' '+PORT+' '+SIDE4+' '+PORT+' [echo|echo-reply] [log]';
  const V6_ACE='ipv6|icmp|tcp|udp '+SIDE6+' '+PORT+' '+SIDE6+' '+PORT+' [echo-request|echo-reply] [log] [sequence <n>]';
  const ACL_GRAMMAR=window.LabShared.cliGrammar([
    'access-list <n> permit|deny '+STD_ACE, 'access-list <n> permit|deny '+EXT_ACE, 'no access-list <n>',
    'ip access-list standard|extended <word>', 'no ip access-list standard|extended <word>',
    'ipv6 access-list <word>', 'no ipv6 access-list <word>',
    '[<n>] permit|deny '+STD_ACE, '[<n>] permit|deny '+EXT_ACE, '[<n>] permit|deny '+V6_ACE,
    'no <n>', 'no sequence <n>',
    'ip access-group <word> in|out', 'no ip access-group [<word>] in|out',
    'ipv6 traffic-filter <word> in|out', 'no ipv6 traffic-filter <word> in|out',
    'access-class <word> in', 'no access-class [<word> in]', 'ipv6 access-class <word> in', 'no ipv6 access-class [<word> in]',
    'show access-lists [<word>]', 'show ip access-lists [<word>]', 'show ipv6 access-list [<word>]'
  ]);
  const NAT_GRAMMAR=window.LabShared.cliGrammar([
    'ip nat inside|outside', 'no ip nat inside|outside',
    'ip nat pool <word> <ip> <ip> ( netmask <ip> | prefix-length <n> )',
    'no ip nat pool <word> [<ip> <ip> ( netmask <ip> | prefix-length <n> )]',
    'ip nat inside source static <ip> <ip>', 'no ip nat inside source static <ip> <ip>',
    'ip nat inside source list <word> pool <word> [overload]', 'ip nat inside source list <word> interface <if> overload',
    'no ip nat inside source list <word> [pool <word> [overload]]', 'no ip nat inside source list <word> interface <if> [overload]',
    'clear ip nat translation *', 'show ip nat translations|statistics'
  ]);
  const SSH_GRAMMAR=window.LabShared.cliGrammar([
    'ip domain-name <word>', 'ip domain name <word>', 'no ip domain-name [<word>]', 'no ip domain name [<word>]',
    'ip ssh version 1|2', 'ip ssh time-out <n>', 'ip ssh authentication-retries <n>', 'no ip ssh version [1|2]',
    'crypto key generate rsa [general-keys] [modulus <n>]', 'crypto key zeroize rsa',
    'username <word> [privilege <n>] secret|password <line>', 'no username <word>',
    'enable secret|password <line>', 'service password-encryption', 'hostname <word>',
    'login [local]', 'no login', 'password <line>',
    'transport input ssh|telnet|all|none [ssh|telnet]', 'exec-timeout <n> [<n>]', 'show ip ssh'
  ]);

  function ac6Parse(str){
    const t=String(str||'').trim().toLowerCase();
    if(!t||!/^[0-9a-f:]+$/.test(t)||t.indexOf(':::')>=0) return null;
    const halves=t.split('::');
    if(halves.length>2) return null;
    const head=halves[0]?halves[0].split(':'):[];
    const tail=halves.length===2&&halves[1]?halves[1].split(':'):[];
    if(halves.length===1&&head.length!==8) return null;
    if(halves.length===2&&head.length+tail.length>7) return null;
    const groups=head.concat(new Array(8-head.length-tail.length).fill('0')).concat(tail);
    for(let i=0;i<8;i++) if(!/^[0-9a-f]{1,4}$/.test(groups[i])) return null;
    return groups.map(function(g){ return ('0000'+g).slice(-4); }).join('');
  }
  /* RFC 5952 form: lowercase, leading zeros dropped, the longest run of two or
     more zero groups (the first if tied) becomes :: */
  function ac6Fmt(hex){
    const g=[]; for(let i=0;i<32;i+=4) g.push(parseInt(hex.slice(i,i+4),16).toString(16));
    let bs=-1,bl=0,cs=-1,cl=0;
    g.forEach(function(x,i){
      if(x==='0'){ if(cs<0){cs=i;cl=0;} cl++; if(cl>bl){bl=cl;bs=cs;} } else cs=-1;
    });
    if(bl<2) return g.join(':');
    return g.slice(0,bs).join(':')+'::'+g.slice(bs+bl).join(':');
  }
  function ac6Net(hex, pfx){
    const full=pfx>>2, rem=pfx&3;
    let out=hex.slice(0,full);
    if(rem) out+=(parseInt(hex[full],16)&(0xF<<(4-rem))&0xF).toString(16);
    return (out+'00000000000000000000000000000000').slice(0,32);
  }

  /* ═══ ACL core ═════════════════════════════════════════════════════
     Pure functions over plain data: an ACL is a list of ACEs, an ACE is an
     action plus an address and a wildcard, and evaluating one against an
     address is arithmetic. Nothing here knows about devices, interfaces or
     canvases — it moved here from access_control.html once the
     troubleshooting trainer became its second user. */

  /* kind is only ever a display choice — 'host' renders "permit host X" and
     'any' renders "permit any", but both are stored as an address and a
     wildcard and matched by exactly the same arithmetic. */
  function aceMake(seq, action, kind, ipInt, wcInt){
    return {seq:seq, action:action, kind:kind, ipInt:ipInt>>>0, wcInt:wcInt>>>0, matches:0};
  }
  function aceHost(seq, action, ip){ return aceMake(seq, action, 'host', ip2int(ip), 0); }
  function aceNet(seq, action, ip, wc){ return aceMake(seq, action, 'net', ip2int(ip), ip2int(wc)); }
  function aceAny(seq, action){ return aceMake(seq, action, 'any', 0, 0xFFFFFFFF); }
  /* An IPv6 ACE names a protocol, a source AND a destination, each as any /
     host X / X/len, and matches on prefix length — there are no wildcards in
     IPv6. The protocol defaults to "ipv6" (everything). */
  function ace6Make(seq, action, src, dst, proto, opts){
    opts=opts||{};
    return {seq:seq, action:action, fam:6, proto:proto||'ipv6', src:src, dst:dst,
            sport:opts.sport||null, dport:opts.dport||null, icmp:opts.icmp||null, matches:0};
  }
  function ace6Side(kind, key, pfx){ return {kind:kind, key:key, pfx:pfx}; }
  function ace6SideMatches(side, key){
    if(side.kind==='any') return true;
    return ac6Net(key, side.pfx)===ac6Net(side.key, side.pfx);
  }
  /* An extended IPv4 ACE: a protocol, a source AND a destination (each an
     address and a wildcard — "any" and "host X" are stored that way too),
     optional tcp/udp ports and an optional ICMP type. Standard entries keep
     their own flatter shape, so the drills that read them are untouched. */
  function acexMake(seq, action, proto, src, dst, opts){
    opts=opts||{};
    return {seq:seq, action:action, ext:true, proto:proto, src:src, dst:dst,
            sport:opts.sport||null, dport:opts.dport||null, icmp:opts.icmp||null, matches:0};
  }
  function acexSide(kind, ip, wc){
    if(kind==='any') return {kind:'any', ipInt:0, wcInt:0xFFFFFFFF};
    if(kind==='host') return {kind:'host', ipInt:ip2int(ip), wcInt:0};
    return {kind:'net', ipInt:ip2int(ip), wcInt:ip2int(wc)};
  }
  /* pkt: {proto:'icmp'|'tcp'|'udp', sport, dport, icmpType:'echo'|'echo-reply'} */
  function portHits(spec, port){
    if(!spec) return true;
    if(port==null) return false;
    switch(spec.op){
      case 'eq': return port===spec.a;
      case 'neq': return port!==spec.a;
      case 'gt': return port>spec.a;
      case 'lt': return port<spec.a;
      default: return port>=spec.a && port<=spec.b;
    }
  }
  function aceProtoHits(ace, pkt){
    const p=ace.proto||'ip';
    if(p==='ip'||p==='ipv6') return true;
    if(!pkt||pkt.proto!==p) return false;
    if(p==='icmp') return !ace.icmp || ace.icmp===pkt.icmpType;
    return portHits(ace.sport, pkt.sport) && portHits(ace.dport, pkt.dport);
  }
  /* One entry point for the lab, whichever family and kind the ACE is. dstKey
     and pkt are only consulted by entries that name a destination or a
     protocol (extended IPv4 and IPv6), and dstKey may be omitted. */
  function aceHits(ace, srcKey, dstKey, pkt){
    if(ace.fam===6) return ace6SideMatches(ace.src, srcKey) && (dstKey==null || ace6SideMatches(ace.dst, dstKey)) && aceProtoHits(ace, pkt);
    if(ace.ext) return wcMatches(ace.src.ipInt, ace.src.wcInt, srcKey) &&
      (dstKey==null || wcMatches(ace.dst.ipInt, ace.dst.wcInt, dstKey)) && aceProtoHits(ace, pkt);
    return aceMatches(ace, srcKey);
  }
  /* Well-known ports by the names IOS prints them with. */
  const PORT_NAMES={ftp:21, ssh:22, telnet:23, smtp:25, domain:53, tftp:69, www:80, pop3:110, ntp:123, snmp:161};
  function portNum(tok){
    if(tok==null) return null;
    const t=String(tok).toLowerCase();
    if(PORT_NAMES[t]!=null) return PORT_NAMES[t];
    if(!/^\d+$/.test(t)) return null;
    const n=+t; return n>=0&&n<=65535 ? n : null;
  }
  function portName(n){
    for(const k in PORT_NAMES) if(PORT_NAMES[k]===n&&k!=='ssh') return k;
    return String(n);
  }
  function portText(spec){
    if(!spec) return '';
    return ' '+spec.op+' '+portName(spec.a)+(spec.op==='range'?' '+portName(spec.b):'');
  }
  /* The page's one piece of wildcard arithmetic. A 1-bit is "don't care", so
     the covered block runs from every don't-care bit at 0 up to every one at
     1, and matching is "mask both sides with the inverse". The ACL core and
     the Wildcard Ranges drill are the same question wearing different names —
     an address plus a wildcard IS an ACE — so they share these three. */
  function wcFirst(ipInt, wcInt){ return (ipInt & ~wcInt)>>>0; }
  function wcLast(ipInt, wcInt){ return (ipInt | wcInt)>>>0; }
  function wcMatches(ipInt, wcInt, testInt){
    const care=(~wcInt)>>>0;
    return ((testInt & care)>>>0) === ((ipInt & care)>>>0);
  }
  function aceMatches(ace, ipInt){ return wcMatches(ace.ipInt, ace.wcInt, ipInt); }
  function ace6SideText(side){
    if(side.kind==='any') return 'any';
    if(side.kind==='host') return 'host '+ac6Fmt(side.key);
    return ac6Fmt(side.key)+'/'+side.pfx;
  }
  function acexSideText(s){
    if(s.kind==='any') return 'any';
    if(s.kind==='host') return 'host '+int2ip(s.ipInt);
    return int2ip(s.ipInt)+' '+int2ip(s.wcInt);
  }
  /* A trailing "log" changes nothing about what an entry matches — it asks
     IOS to log hits — so it is kept only so show commands print it back. */
  function aceText(ace){ return aceTextBody(ace)+(ace.log?' log':''); }
  function takeLog(parts){
    const p=parts.slice(), n=p.length, low=p.map(function(x){ return String(x).toLowerCase(); });
    if(n&&low[n-1]==='log'){ p.pop(); return {parts:p, log:true}; }
    if(n>=3&&low[n-3]==='log'&&low[n-2]==='sequence'){ p.splice(n-3,1); return {parts:p, log:true}; }
    return {parts:p, log:false};
  }
  function withLog(parse){
    return function(action, parts){
      const L=takeLog(parts), r=parse(action, L.parts);
      if(r.ace&&L.log) r.ace.log=true;
      return r;
    };
  }
  function aceTextBody(ace){
    if(ace.fam===6) return ace.action+' '+(ace.proto||'ipv6')+' '+ace6SideText(ace.src)+portText(ace.sport)+' '+
      ace6SideText(ace.dst)+portText(ace.dport)+(ace.icmp?' '+(ace.icmp==='echo'?'echo-request':ace.icmp):'');
    if(ace.ext) return ace.action+' '+ace.proto+' '+acexSideText(ace.src)+portText(ace.sport)+' '+
      acexSideText(ace.dst)+portText(ace.dport)+(ace.icmp?' '+ace.icmp:'');
    if(ace.kind==='any') return ace.action+' any';
    if(ace.kind==='host') return ace.action+' host '+int2ip(ace.ipInt);
    return ace.action+' '+int2ip(ace.ipInt)+' '+int2ip(ace.wcInt);
  }
  function aclMake(name, numbered, fam, ext){
    return {name:String(name), numbered:!!numbered, fam:fam||4, ext:!!ext, aces:[]};
  }
  /* IOS's numbered ranges decide a numbered list's type. */
  function aclNumKind(n){
    if((n>=1&&n<=99)||(n>=1300&&n<=1999)) return 'std';
    if((n>=100&&n<=199)||(n>=2000&&n<=2699)) return 'ext';
    return null;
  }
  /* IOS hands out sequence numbers in tens, which is exactly what leaves room
     to insert a line between two existing ones later — the whole point of
     Part 4's "Option 2". */
  function aclNextSeq(acl){
    return acl.aces.length ? (Math.floor(acl.aces[acl.aces.length-1].seq/10)+1)*10 : 10;
  }
  function aclInsert(acl, ace){
    acl.aces=acl.aces.filter(function(a){ return a.seq!==ace.seq; });
    acl.aces.push(ace);
    acl.aces.sort(function(a,b){ return a.seq-b.seq; });
  }
  function aclRemoveSeq(acl, seq){
    const before=acl.aces.length;
    acl.aces=acl.aces.filter(function(a){ return a.seq!==seq; });
    return acl.aces.length!==before;
  }
  /* First match wins, and there is always an implicit deny at the end.
     count:true bumps the per-ACE hit counters, so show access-lists reflects
     the traffic the learner has actually sent — the counters in the real lab
     only appear because pings were run. */
  function aclEvaluate(acl, srcKey, count, dstKey, pkt){
    for(let i=0;i<acl.aces.length;i++){
      if(aceHits(acl.aces[i], srcKey, dstKey, pkt)){
        if(count) acl.aces[i].matches++;
        return {action:acl.aces[i].action, ace:acl.aces[i], implicit:false};
      }
    }
    return {action:'deny', ace:null, implicit:true};
  }
  function aclShowLines(acl){
    /* show ipv6 access-list: IOS prints the address in capitals and puts the
       sequence number LAST, the opposite of the IPv4 layout. */
    if(acl.fam===6){
      return ['IPv6 access list '+acl.name].concat(acl.aces.map(function(a){
        return '    '+aceText(a).replace(/[0-9a-f:]+(?=\/|\s|$)/g, function(m){ return m.indexOf(':')>=0 ? m.toUpperCase() : m; })+
          (a.matches?' ('+a.matches+' match'+(a.matches===1?'':'es')+')':'')+' sequence '+a.seq;
      }));
    }
    if(acl.ext){
      return ['Extended IP access list '+acl.name].concat(acl.aces.map(function(a){
        return '    '+a.seq+' '+aceText(a)+(a.matches?' ('+a.matches+' match'+(a.matches===1?'':'es')+')':'');
      }));
    }
    const head='Standard IP access list '+acl.name;
    const rows=acl.aces.map(function(a){
      /* IOS pads the action so permit/deny line up, and only shows a counter
         once the ACE has actually been hit. */
      const body = (a.kind==='any' ? a.action+(a.action==='deny'?'   ':' ')+'any'
                 : a.kind==='host' ? a.action+' host '+int2ip(a.ipInt)
                 : a.action+' '+int2ip(a.ipInt)+' '+int2ip(a.wcInt))+(a.log?' log':'');
      return '    '+a.seq+' '+body+(a.matches?' ('+a.matches+' match'+(a.matches===1?'':'es')+')':'');
    });
    return [head].concat(rows);
  }

  /* Any spelling IOS would take: "g0/1", "Gi0/1", "GigabitEthernet 0/1". */
  function acIfNorm(name){
    return String(name).toLowerCase().replace(/\s+/g,'')
      .replace(/^(gigabitethernet|gig|gi|g)(?=\d)/,'g').replace(/^(fastethernet|fa|f)(?=\d)/,'f')
      .replace(/^(serial|se|s)(?=\d)/,'s').replace(/^(loopback|lo)(?=\d)/,'lo');
  }
  function acIface(r, name){
    const n=acIfNorm(name);
    return r.ifaces.find(function(f){ return acIfNorm(f.name)===n; })||null;
  }
  /* IOS prints full interface names in the brief tables. */
  function acFullIf(n){
    return n.replace(/^Gi(?=\d)/,'GigabitEthernet').replace(/^G(?=\d)/,'GigabitEthernet').replace(/^Fa(?=\d)/,'FastEthernet')
      .replace(/^S(?=\d)/,'Serial').replace(/^Lo(?=\d)/,'Loopback');
  }
  /* only, when given, is "show access-lists <name>": that list alone. */
  function acShowAcls(d, only){
    const names=Object.keys(d.acls).filter(function(n){ return !only||n===only; });
    if(!names.length) return only?'':'(no access lists configured)';
    /* IOS lists numbered ACLs before named ones. */
    names.sort(function(a,b){
      const na=/^\d+$/.test(a), nb=/^\d+$/.test(b);
      if(na&&nb) return +a-+b;
      if(na!==nb) return na?-1:1;
      return a<b?-1:1;
    });
    const out=[];
    names.forEach(function(n){ aclShowLines(d.acls[n]).forEach(function(l){ out.push(l); }); });
    return out.join('\n');
  }

  /* ═══ SSH ═════════════════════════════════════════════════════════
     A router's SSH server is configuration like anything else: a domain name
     and RSA keys switch it on (version 2 needs keys of 768 bits or more), and
     the vty lines decide who gets in — transport input has to allow ssh,
     login local has to point at a username, and an access-class can refuse
     the source outright. sshNew() is a router fresh out of the box: no domain,
     no keys, and IOS's default vty "login" with no password set. */
  function sshNew(){
    return {domain:null, rsa:0, ver:null, users:{}, enable:null, encrypt:false,
            vty:{login:'line', password:null, transport:'all'}};
  }
  /* The configuration the ACL and NAT labs arrive with: SSH already done, so
     those labs keep testing filtering rather than this. */
  function sshReady(r, user, pass){
    r.ssh.domain='ccna-lab.com'; r.ssh.rsa=1024; r.ssh.ver=2;
    r.ssh.users[user||'admin']={secret:pass||'cisco'};
    r.ssh.vty.login='local'; r.ssh.vty.transport='ssh';
  }
  function sshEnabled(r){ return !!(r.ssh.domain&&r.ssh.rsa&&!(r.ssh.ver===2&&r.ssh.rsa<768)); }
  function sshAllowsTransport(t){ return t==='all'||t.split(' ').indexOf('ssh')>=0; }
  /* Why the SSH server itself would turn this login away, or null. Credentials
     are optional — a grader asking "would SSH work at all?" leaves them out. */
  function sshServerProblem(r, creds){
    const s=r.ssh, v=s.vty;
    if(!s.domain&&!s.rsa) return r.name+' has no SSH server running: it needs a domain name and RSA keys (ip domain-name, then crypto key generate rsa)';
    if(!s.rsa) return r.name+' has no RSA keys, so SSH is off — "crypto key generate rsa" (and a domain name has to exist first)';
    if(s.ver===2&&s.rsa<768) return r.name+' is set to "ip ssh version 2", which needs RSA keys of at least 768 bits — its keys are '+s.rsa+' bits';
    if(!sshAllowsTransport(v.transport)) return r.name+"'s vty lines only accept "+(v.transport==='none'?'nothing':v.transport)+' — "transport input ssh"';
    if(v.login!=='local') return r.name+"'s vty lines use "+(v.login==='none'?'"no login"':'"login" (a line password)')+' — SSH logs in with a username, so it needs "login local"';
    const names=Object.keys(s.users);
    if(!names.length) return r.name+' has "login local" on its vty lines but no usernames configured';
    if(creds){
      const u=s.users[creds.user];
      if(!u||(u.secret!=null?u.secret:u.password)!==creds.pass) return '% Login invalid — '+(u?'wrong password for '+creds.user:'there is no user "'+creds.user+'" on '+r.name);
    }
    return null;
  }
  /* SSH to a router: a TCP connection to port 22 has to get through the
     network (interface ACLs included), then the vty access-class decides,
     then the SSH server's own configuration and the login. */
  const acParseAce=withLog(function(action, parts){
    if(!parts.length) return {err:'% Incomplete command'};
    if(['ip','icmp','tcp','udp'].indexOf(String(parts[0]).toLowerCase())>=0)
      return {err:'% A standard list matches only the source address — protocols and destinations need an extended list (100-199, or "ip access-list extended <name>")'};
    const extra=function(i){ return parts.length>i?{err:'% Invalid input detected at "'+parts[i]+'"'}:null; };
    if(parts[0]==='any') return extra(1)||{ace:aceAny(0, action)};
    if(parts[0]==='host'){
      if(!parts[1]||!isValidIP(parts[1])) return {err:'% Invalid host address'};
      return extra(2)||{ace:aceHost(0, action, parts[1])};
    }
    if(!isValidIP(parts[0])) return {err:'% Invalid address'};
    if(parts.length===1) return {ace:aceHost(0, action, parts[0])};
    if(!isValidIP(parts[1])) return {err:'% Invalid wildcard mask'};
    return extra(2)||{ace:aceNet(0, action, parts[0], parts[1])};
  });
  /* ── extended IPv4: "<proto> <src> [port] <dst> [port] [icmp-type]" ── */
  function acxParseSide(parts, i){
    const t=String(parts[i]||'').toLowerCase();
    if(t==='any') return {side:acexSide('any'), next:i+1};
    if(t==='host'){
      if(!isValidIP(parts[i+1]||'')) return {err:'% Invalid host address'};
      return {side:acexSide('host',parts[i+1]), next:i+2};
    }
    if(!isValidIP(parts[i]||'')) return {err:'% Expected any, host <address>, or <address> <wildcard>'};
    if(!isValidIP(parts[i+1]||'')) return {err:'% An extended entry needs a wildcard after '+parts[i]+' — or use "host '+parts[i]+'"'};
    return {side:acexSide('net',parts[i],parts[i+1]), next:i+2};
  }
  /* An optional port match after an address: eq | neq | gt | lt | range. */
  function acParsePortOp(parts, i, proto){
    const op=String(parts[i]||'').toLowerCase();
    if(['eq','neq','gt','lt','range'].indexOf(op)<0) return {port:null, next:i};
    if(proto!=='tcp'&&proto!=='udp') return {err:'% Port numbers only go with tcp or udp, not '+proto};
    const a=portNum(parts[i+1]);
    if(a==null) return {err:'% Invalid port "'+(parts[i+1]||'')+'"'};
    if(op==='range'){
      const b=portNum(parts[i+2]);
      if(b==null||b<a) return {err:'% Invalid port range'};
      return {port:{op:op, a:a, b:b}, next:i+3};
    }
    return {port:{op:op, a:a}, next:i+2};
  }
  const acxParseAce=withLog(function(action, parts){
    const proto=String(parts[0]||'').toLowerCase();
    if(['ip','icmp','tcp','udp'].indexOf(proto)<0)
      return {err:'% An extended entry names the protocol first: "'+action+' ip|icmp|tcp|udp <source> <destination>"'};
    const s=acxParseSide(parts,1); if(s.err) return s;
    const sp=acParsePortOp(parts,s.next,proto); if(sp.err) return sp;
    const d=acxParseSide(parts,sp.next); if(d.err) return d;
    const dp=acParsePortOp(parts,d.next,proto); if(dp.err) return dp;
    let i=dp.next, icmp=null;
    const t=String(parts[i]||'').toLowerCase();
    if(proto==='icmp'&&(t==='echo'||t==='echo-reply')){ icmp=t; i++; }
    if(i<parts.length) return {err:'% Invalid input detected at "'+parts[i]+'"'};
    return {ace:acexMake(0, action, proto, s.side, d.side, {sport:sp.port, dport:dp.port, icmp:icmp})};
  });

  /* One side of an IPv6 entry: any | host X | X/len. Returns where parsing
     got to, so the destination can pick up after the source. */
  function ac6ParseSide(parts, i){
    const tok=(parts[i]||'').toLowerCase();
    if(tok==='any') return {side:ace6Side('any',null,0), next:i+1};
    if(tok==='host'){
      const k=ac6Parse(parts[i+1]);
      if(k===null) return {err:'% Invalid IPv6 host address'};
      return {side:ace6Side('host',k,128), next:i+2};
    }
    const m=/^([0-9a-f:]+)\/(\d{1,3})$/i.exec(parts[i]||'');
    if(!m) return {err:'% Expected any, host <address>, or <prefix>/<length>'};
    const k=ac6Parse(m[1]), pfx=+m[2];
    if(k===null||pfx>128) return {err:'% Invalid IPv6 prefix'};
    return {side:ace6Side('net',k,pfx), next:i+1};
  }
  /* "permit ipv6|icmp|tcp|udp <src> [port] <dst> [port] [sequence N]" — the
     protocol keyword is not
     optional in IOS, and the sequence number goes LAST, which is the opposite
     of an IPv4 named list. Both are the sort of thing a lab should make you
     type rather than smooth over. */
  const ac6ParseAce=withLog(function(action, parts){
    const proto=(parts[0]||'').toLowerCase();
    if(['ipv6','icmp','tcp','udp'].indexOf(proto)<0)
      return {err:'% An IPv6 entry names the protocol: "'+action+' ipv6|icmp|tcp|udp <source> <destination>"'};
    const a=ac6ParseSide(parts,1); if(a.err) return a;
    const sp=acParsePortOp(parts,a.next,proto); if(sp.err) return sp;
    const b=ac6ParseSide(parts,sp.next); if(b.err) return b;
    const dp=acParsePortOp(parts,b.next,proto); if(dp.err) return dp;
    let seq=null, i=dp.next, icmp=null;
    const t=(parts[i]||'').toLowerCase();
    if(proto==='icmp'&&(t==='echo-request'||t==='echo-reply')){ icmp=t==='echo-request'?'echo':t; i++; }
    if((parts[i]||'').toLowerCase()==='sequence'){
      if(!/^\d+$/.test(parts[i+1]||'')) return {err:'% "sequence" needs a number'};
      seq=+parts[i+1]; i+=2;
    }
    if(i<parts.length) return {err:'% Invalid input detected'};
    return {ace:ace6Make(seq||0, action, a.side, b.side, proto, {sport:sp.port, dport:dp.port, icmp:icmp}), seq:seq};
  });

  /* ── SSH and device-access commands, in global config and on the vty lines.
     Returns null for anything that isn't one of them. ── */
  function sshGenKeys(d, n){
    d.ssh.rsa=n;
    return '% Generating '+n+' bit RSA keys, keys will be non-exportable...[OK]\n'+
      '*Mar 1 00:12:41.123: %SSH-5-ENABLED: SSH 1.99 has been enabled';
  }
  function acSshCli(d, w, raw, M){
    const s=d.ssh;
    if(M(w[0],'ip')&&w[1]&&(M(w[1],'domain-name')||(w[1]==='domain'&&w[2]&&M(w[2],'name')))){
      const name=w[1]==='domain'?raw[3]:raw[2];
      if(!name) return '% Usage: ip domain-name <name>';
      s.domain=name; return '';
    }
    if(w[0]==='no'&&M(w[1],'ip')&&w[2]&&(M(w[2],'domain-name')||w[2]==='domain')){ s.domain=null; return ''; }
    if(M(w[0],'ip')&&w[1]==='ssh'){
      if(w[2]&&M(w[2],'version')){
        if(w[3]!=='1'&&w[3]!=='2') return '% Usage: ip ssh version 1|2';
        s.ver=+w[3];
        return s.ver===2&&s.rsa&&s.rsa<768 ? '% Please create RSA keys (of at least 768 bits size) to enable SSH v2.' : '';
      }
      if(w[2]&&(M(w[2],'time-out')||M(w[2],'authentication-retries'))) return '';
      return '% Usage: ip ssh version 2 | ip ssh time-out <secs> | ip ssh authentication-retries <n>';
    }
    if(w[0]==='no'&&M(w[1],'ip')&&w[2]==='ssh'&&w[3]&&M(w[3],'version')){ s.ver=null; return ''; }
    if(M(w[0],'crypto')&&w[1]&&M(w[1],'key')){
      if(w[2]&&M(w[2],'zeroize')){ s.rsa=0; return '% All keys will be removed.\n%SSH-5-DISABLED: SSH 1.99 has been disabled'; }
      if(!(w[2]&&M(w[2],'generate')&&w[3]&&M(w[3],'rsa')))
        return '% Usage: crypto key generate rsa [general-keys modulus <360-4096>]';
      if(!s.domain) return '% Please define a domain-name first.';
      const head='The name for the keys will be: '+d.name+'.'+s.domain;
      const mi=w.indexOf('modulus');
      if(mi>=0){
        const n=+w[mi+1];
        if(!(n>=360&&n<=4096)) return '% The modulus is 360 to 4096 bits';
        return head+'\n'+sshGenKeys(d,n);
      }
      /* No modulus on the line: IOS asks for it, and so does this. */
      d.cmBeforeRsa=d.cm; d.cm='rsa';
      return head+'\nChoose the size of the key modulus in the range of 360 to 4096 for your\n'+
        '  General Purpose Keys. Choosing a key modulus greater than 512 may take\n  a few minutes.';
    }
    if(w[0]==='username'){
      const USAGE='% Usage: username <name> [privilege 15] secret <password>';
      const name=raw[1];
      if(!name) return USAGE;
      let i=2;
      if(w[i]==='privilege') i+=2;
      const kind=w[i];
      if(kind!=='secret'&&kind!=='password') return USAGE;
      let val=raw.slice(i+1).join(' ');
      if(/^[05] \S/.test(val)) val=val.slice(2);
      if(!val) return USAGE;
      s.users[name]=kind==='secret'?{secret:val}:{password:val};
      return '';
    }
    if(w[0]==='no'&&w[1]==='username'){ delete s.users[raw[2]]; return ''; }
    if(M(w[0],'enable')&&w[1]&&(M(w[1],'secret')||M(w[1],'password'))){ s.enable=raw.slice(2).join(' ')||null; return ''; }
    if(M(w[0],'service')&&w[1]&&M(w[1],'password-encryption')){ s.encrypt=true; return ''; }
    if(M(w[0],'hostname')&&w[0].length>=4)
      return raw[1]===d.name ? '' : '% The device names come from the topology in this lab — '+d.name+' stays '+d.name;
    if(d.cm==='line'){
      if(w[0]==='login'){
        if(!w[1]){ s.vty.login='line'; return ''; }
        if(M(w[1],'local')){ s.vty.login='local'; return ''; }
        return '% Usage: login | login local';
      }
      if(w[0]==='no'&&w[1]==='login'){ s.vty.login='none'; return ''; }
      if(M(w[0],'password')&&w[0].length>=4){ s.vty.password=raw.slice(1).join(' ')||null; return ''; }
      if(M(w[0],'transport')&&w[1]&&M(w[1],'input')){
        const USAGE='% Usage: transport input ssh | telnet | telnet ssh | all | none';
        const opts=w.slice(2);
        if(!opts.length) return USAGE;
        if(opts.length===1&&(opts[0]==='all'||opts[0]==='none')){ s.vty.transport=opts[0]; return ''; }
        if(!opts.every(function(o){ return o==='ssh'||o==='telnet'; })) return USAGE;
        s.vty.transport=opts.filter(function(o,i){ return opts.indexOf(o)===i; }).sort().join(' ');
        return '';
      }
      if(M(w[0],'exec-timeout')) return '';
    }
    return null;
  }
  function acShowIpSsh(d){
    const s=d.ssh, v=s.ver===2?'2.0':s.ver===1?'1.5':'1.99';
    if(!sshEnabled(d)) return 'SSH Disabled - version '+v+'\n%Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2).';
    return 'SSH Enabled - version '+v+'\nAuthentication timeout: 120 secs; Authentication retries: 3';
  }
  /* show run never prints a secret back — only its hash — so a forgotten
     password stays forgotten, as on a real router. */
  function acFakeHash(str, kind){
    let h=0; for(let i=0;i<str.length;i++) h=(Math.imul(h,31)+str.charCodeAt(i))>>>0;
    const abc='./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let out=''; for(let i=0;i<22;i++){ h=(Math.imul(h,1103515245)+12345)>>>0; out+=abc[(h>>>16)%64]; }
    if(kind===7){ let x=''; for(let i=0;i<str.length;i++) x+=('0'+((str.charCodeAt(i)^(0x30+i))&255).toString(16).toUpperCase()).slice(-2); return '08'+x; }
    return '$1$'+out.slice(0,4)+'$'+out.slice(4);
  }

  /* ── the ACL commands ── building lists (numbered, named standard and
     extended, IPv6), their sub-modes, and applying them to interfaces and the
     vty lines. slots names the fields a list is applied into, so a single-
     family page can keep one pair of slots and a dual-stack router can keep
     IPv4 and IPv6 apart: {in4, out4, in6, out6, vty4, vty6}. Returns null for
     any line that is not an ACL command. */
  function aclCli(d, w, raw, M, slots){
    /* ── IPv6 named ACL, global config ── */
    if(w[0]==='ipv6'&&w[1]==='access-list'){
      const name=raw[2];
      if(!name) return '% Give the access list a name';
      if(!d.acls[name]) d.acls[name]=aclMake(name, false, 6);
      d.cm='nacl6'; d.ci=name; return '';
    }
    if(w[0]==='no'&&w[1]==='ipv6'&&w[2]==='access-list'){ delete d.acls[raw[3]]; return ''; }

    if(d.cm==='nacl6'){
      const acl=d.acls[d.ci];
      if(/^\d+$/.test(w[0]))
        return '% In an IPv6 access list the sequence number goes last: "permit ipv6 <src> <dst> sequence '+w[0]+'"';
      if(w[0]==='no'&&w[1]==='sequence'){
        return aclRemoveSeq(acl, +w[2]) ? '' : '% Sequence number not found in this access list';
      }
      if(w[0]==='permit'||w[0]==='deny'){
        const p=ac6ParseAce(w[0], raw.slice(1));
        if(p.err) return p.err;
        p.ace.seq = p.seq!=null ? p.seq : aclNextSeq(acl);
        aclInsert(acl, p.ace);
        return '';
      }
    }

    /* ── numbered ACL, global config. The number decides the type: 1-99 and
       1300-1999 standard, 100-199 and 2000-2699 extended. ── */
    if(w[0]==='access-list'){
      const num=raw[1];
      if(!/^\d+$/.test(num)) return '% Invalid access list number';
      const kind=aclNumKind(+num);
      if(!kind) return '% Standard lists are 1-99 or 1300-1999, extended lists 100-199 or 2000-2699';
      const act=w[2];
      if(act!=='permit'&&act!=='deny') return '% Expected permit or deny';
      const p=kind==='ext' ? acxParseAce(act, raw.slice(3)) : acParseAce(act, raw.slice(3));
      if(p.err) return p.err;
      if(!d.acls[num]) d.acls[num]=aclMake(num, true, 4, kind==='ext');
      p.ace.seq=aclNextSeq(d.acls[num]);
      aclInsert(d.acls[num], p.ace);
      return '';
    }
    if(w[0]==='no'&&w[1]==='access-list'){ delete d.acls[raw[2]]; return ''; }

    /* ── named ACL sub-mode. "ip access-list extended 100" also edits numbered
       list 100 by sequence number, as IOS allows. ── */
    if(M(w[0],'ip')&&w[1]==='access-list'){
      const type=w[2]&&M(w[2],'standard')?'std':w[2]&&M(w[2],'extended')?'ext':null;
      if(!type) return '% "ip access-list standard <name>" or "ip access-list extended <name>"';
      const name=raw[3];
      if(!name) return '% Give the access list a name';
      const isNum=/^\d+$/.test(name);
      if(isNum&&aclNumKind(+name)!==type)
        return '% '+name+' is not a valid '+(type==='ext'?'extended':'standard')+' list number';
      const ex=d.acls[name];
      if(ex&&ex.ext!==(type==='ext'))
        return '% A '+(ex.ext?'named extended':'standard')+' IP access list with this name already exists';
      if(!ex) d.acls[name]=aclMake(name, isNum, 4, type==='ext');
      d.cm=type==='ext'?'xacl':'nacl'; d.ci=name; return '';
    }
    if(w[0]==='no'&&M(w[1],'ip')&&w[2]==='access-list'){ delete d.acls[raw[4]]; return ''; }

    if(d.cm==='nacl'||d.cm==='xacl'){
      const acl=d.acls[d.ci];
      const parse=d.cm==='xacl'?acxParseAce:acParseAce;
      /* "30 permit ..." inserts at that sequence number — Option 2 in Part 4. */
      if(/^\d+$/.test(w[0])){
        const seq=+w[0], act=w[1];
        if(act!=='permit'&&act!=='deny') return '% Expected permit or deny';
        const p=parse(act, raw.slice(2));
        if(p.err) return p.err;
        if(acl.aces.some(function(a){ return a.seq===seq; })) return '% Duplicate sequence number';
        p.ace.seq=seq;
        aclInsert(acl, p.ace);
        return '';
      }
      if(w[0]==='no'&&/^\d+$/.test(w[1])){
        return aclRemoveSeq(acl, +w[1]) ? '' : '% Sequence number not found in this access list';
      }
      if(w[0]==='permit'||w[0]==='deny'){
        const p=parse(w[0], raw.slice(1));
        if(p.err) return p.err;
        p.ace.seq=aclNextSeq(acl);
        aclInsert(acl, p.ace);
        return '';
      }
    }

    if(d.cm==='if'){
      const f=acIface(d, d.ci);
      if(w[0]==='ipv6'&&w[1]==='traffic-filter'){
        const name=raw[2], dir=w[3];
        if(!d.acls[name]) return '% Access list '+name+' does not exist yet';
        if(dir!=='in'&&dir!=='out') return '% Direction must be "in" or "out"';
        f[dir==='in'?slots.in6:slots.out6]=name;
        return '';
      }
      if(w[0]==='no'&&w[1]==='ipv6'&&w[2]==='traffic-filter'){
        f[w[4]==='in'?slots.in6:slots.out6]=null;
        return '';
      }
      if(M(w[0],'ip')&&w[1]==='access-group'){
        const name=raw[2], dir=w[3];
        if(!d.acls[name]) return '% Access list '+name+' does not exist yet';
        if(dir!=='in'&&dir!=='out') return '% Direction must be "in" or "out"';
        f[dir==='in'?slots.in4:slots.out4]=name;
        return '';
      }
      if(w[0]==='no'&&M(w[1],'ip')&&w[2]==='access-group'){
        f[(w[4]==='in'||w[3]==='in')?slots.in4:slots.out4]=null;
        return '';
      }
    }

    if(d.cm==='line'){
      if(w[0]==='ipv6'&&w[1]==='access-class'){
        const name=raw[2], dir=w[3];
        if(!d.acls[name]) return '% Access list '+name+' does not exist yet';
        if(dir!=='in') return '% Use "ipv6 access-class <name> in" to filter inbound sessions';
        d[slots.vty6]=name; return '';
      }
      if(w[0]==='no'&&w[1]==='ipv6'&&w[2]==='access-class'){ d[slots.vty6]=null; return ''; }
      if(w[0]==='access-class'){
        const name=raw[1], dir=w[2];
        if(!d.acls[name]) return '% Access list '+name+' does not exist yet';
        if(dir!=='in') return '% Use "access-class <name> in" to filter inbound sessions';
        d[slots.vty4]=name; return '';
      }
      if(w[0]==='no'&&w[1]==='access-class'){ d[slots.vty4]=null; return ''; }
    }

    return null;
  }

  function natNew(){ return {statics:[], pools:{}, rules:[], table:[], hits:0, misses:0}; }
  function natEnabled(r){
    return r.ifaces.some(function(f){ return f.nat==='inside'; }) && r.ifaces.some(function(f){ return f.nat==='outside'; });
  }
  function natPoolAddrs(pool){
    const out=[]; for(let k=ip2int(pool.first); k<=ip2int(pool.last); k++) out.push(k); return out;
  }
  function natRuleFor(r, srcKey, dstKey, pkt){
    for(const rule of r.nat.rules){
      const acl=r.acls[rule.acl];
      if(!acl) continue;
      if(aclEvaluate(acl, srcKey, false, dstKey, pkt).action==='permit') return rule;
    }
    return null;
  }
  /* A free port on this global address for this protocol: the original if
     nobody else on the same global has it, otherwise the next from 1024 —
     which is what IOS does, and why the first PAT entry usually shows the
     source port unchanged. */
  function natFreePort(r, ig, proto, want, scratch){
    const used=r.nat.table.concat(scratch||[]).filter(function(e){ return e.proto===proto && e.ig===ig; }).map(function(e){ return e.igPort; });
    if(used.indexOf(want)<0) return want;
    let p=1024; while(used.indexOf(p)>=0) p++; return p;
  }
  /* inside → outside. Returns {src, sport} for a translated packet, null to
     pass it through untranslated (no rule matched — IOS does the same), or
     {drop, reason} when a rule matched but the pool is empty. With count
     false nothing is recorded: the graders ask "would this work" without
     leaving a translation behind that the learner did not create. */
  function natOut(r, pkt, count){
    const N=r.nat, src=int2ip(pkt.src);
    const store=function(rows){
      if(count){ N.hits++; rows.forEach(function(row){ natRecord(N.table, row); }); }
      else if(pkt.scratch) rows.forEach(function(row){ natRecord(pkt.scratch, row); });
    };
    const flow=function(igKey, sport, kind){
      return {proto:pkt.proto, il:src, ilPort:pkt.sport, ig:int2ip(igKey), igPort:sport,
              og:int2ip(pkt.dst), ogPort:pkt.dport, kind:kind};
    };
    const st=N.statics.find(function(s){ return s.local===src; });
    if(st){
      const g=ip2int(st.global);
      store([flow(g, pkt.sport, 'static')]);
      return {src:g, sport:pkt.sport};
    }
    const rule=natRuleFor(r, pkt.src, pkt.dst, pkt);
    if(!rule) return null;
    let igKey, overload=!!rule.overload, rows=[];
    if(rule.iface){
      const f=acIface(r, rule.iface);
      if(!f||!f.ip) return {drop:true, reason:r.name+"'s NAT rule points at "+rule.iface+', which has no address'};
      igKey=ip2int(f.ip); overload=true;
    } else {
      const pool=N.pools[rule.pool];
      if(!pool) return {drop:true, reason:'pool '+rule.pool+' does not exist on '+r.name};
      const addrs=natPoolAddrs(pool);
      const known=N.table.concat(pkt.scratch||[]);
      const have=known.find(function(e){ return e.proto===null && e.il===src; });
      if(have) igKey=ip2int(have.ig);
      else if(overload) igKey=addrs[0];
      else {
        const taken=known.filter(function(e){ return e.proto===null; }).map(function(e){ return ip2int(e.ig); });
        igKey=addrs.find(function(a){ return taken.indexOf(a)<0; });
        if(igKey==null){
          if(count) N.misses++;
          return {drop:true, reason:r.name+' could not translate '+src+' — pool '+rule.pool+' has no free address ('+
            addrs.length+' of '+addrs.length+' lent out). One-to-one NAT gives each inside host a whole public address'};
        }
        rows.push({proto:null, il:src, ig:int2ip(igKey)});
      }
    }
    const sport = overload ? natFreePort(r, int2ip(igKey), pkt.proto, pkt.sport, pkt.scratch) : pkt.sport;
    rows.push(flow(igKey, sport, overload?'pat':'dynamic'));
    store(rows);
    return {src:igKey, sport:sport};
  }
  function natRecord(list, row){
    const dup=list.find(function(e){ return e.proto===row.proto && e.il===row.il && e.ilPort===row.ilPort &&
      e.ig===row.ig && e.igPort===row.igPort && e.og===row.og; });
    if(!dup) list.push(row);
  }
  /* outside → inside: a packet arriving on an outside interface addressed to
     an inside global is handed to the inside local it belongs to. */
  function natIn(r, pkt){
    const N=r.nat, dst=int2ip(pkt.dst), known=N.table.concat(pkt.scratch||[]);
    const st=N.statics.find(function(s){ return s.global===dst; });
    if(st) return {dst:ip2int(st.local), dport:pkt.dport};
    const flow=known.find(function(e){ return e.proto===pkt.proto && e.ig===dst && e.igPort===pkt.dport; });
    if(flow) return {dst:ip2int(flow.il), dport:flow.ilPort};
    const bind=known.find(function(e){ return e.proto===null && e.ig===dst; });
    if(bind) return {dst:ip2int(bind.il), dport:pkt.dport};
    return null;
  }
  /* Clearing drops every entry traffic made; the static maps stay, because
     they live in the configuration, not in the table. */
  function natClear(r){ r.nat.table=[]; }
  function natSnapshot(r){ return {table:r.nat.table.slice(), hits:r.nat.hits, misses:r.nat.misses}; }
  function natRestore(r, s){ r.nat.table=s.table; r.nat.hits=s.hits; r.nat.misses=s.misses; }

  /* ── show output ── shared with the NAT Terms drill, which prints the same
     table for the learner to read. */
  function natPad(s,n){ s=String(s==null?'':s); while(s.length<n) s+=' '; return s; }
  function natTableLines(statics, table){
    const lines=['Pro  Inside global          Inside local           Outside local          Outside global'];
    statics.forEach(function(s){ lines.push('---  '+natPad(s.global,23)+natPad(s.local,23)+natPad('---',23)+'---'); });
    table.forEach(function(e){
      if(e.proto===null){ lines.push('---  '+natPad(e.ig,23)+natPad(e.il,23)+natPad('---',23)+'---'); return; }
      lines.push(natPad(e.proto,5)+natPad(e.ig+':'+e.igPort,23)+natPad(e.il+':'+e.ilPort,23)+
                 natPad(e.og+':'+e.ogPort,23)+e.og+':'+e.ogPort);
    });
    return lines;
  }
  function natShowTranslations(r){
    const N=r.nat;
    if(!N.statics.length&&!N.table.length) return '(no translations)';
    return natTableLines(N.statics, N.table).join('\n');
  }
  function natShowStats(r){
    const N=r.nat;
    const flows=N.table.filter(function(e){ return e.proto!==null; }), binds=N.table.filter(function(e){ return e.proto===null; });
    const ins=r.ifaces.filter(function(f){ return f.nat==='inside'; }).map(function(f){ return f.name; });
    const outs=r.ifaces.filter(function(f){ return f.nat==='outside'; }).map(function(f){ return f.name; });
    const lines=['Total active translations: '+(N.statics.length+N.table.length)+' ('+N.statics.length+' static, '+
      (binds.length+flows.length)+' dynamic; '+flows.length+' extended)',
      'Outside interfaces:', '  '+(outs.join(', ')||'(none)'),
      'Inside interfaces:', '  '+(ins.join(', ')||'(none)'),
      'Hits: '+N.hits+'  Misses: '+N.misses,
      'Dynamic mappings:'];
    if(!N.rules.length) lines.push('  (none)');
    N.rules.forEach(function(rule,i){
      lines.push('-- Inside Source');
      lines.push('[Id: '+(i+1)+'] access-list '+rule.acl+' '+(rule.pool?'pool '+rule.pool:'interface '+rule.iface)+(rule.overload?' overload':'')+' refcount '+flows.length);
      if(rule.pool&&N.pools[rule.pool]){
        const p=N.pools[rule.pool], n=natPoolAddrs(p).length;
        /* Addresses in use, however they were lent: a binding (one-to-one) or
           a shared PAT address — which is why overload shows "allocated 1". */
        const used=new Set(N.table.filter(function(b){ return ip2int(b.ig)>=ip2int(p.first)&&ip2int(b.ig)<=ip2int(p.last); })
          .map(function(b){ return b.ig; })).size;
        lines.push(' pool '+rule.pool+': netmask '+p.mask);
        lines.push('        start '+p.first+' end '+p.last);
        lines.push('        type generic, total addresses '+n+', allocated '+used+' ('+Math.round(100*used/n)+'%), misses '+N.misses);
      }
    });
    return lines.join('\n');
  }
  function natRunLines(r){
    const N=r.nat, out=[];
    N.statics.forEach(function(s){ out.push('ip nat inside source static '+s.local+' '+s.global); });
    Object.keys(N.pools).forEach(function(n){ const p=N.pools[n]; out.push('ip nat pool '+n+' '+p.first+' '+p.last+' netmask '+p.mask); });
    N.rules.forEach(function(rule){
      out.push('ip nat inside source list '+rule.acl+' '+(rule.pool?'pool '+rule.pool:'interface '+rule.iface)+(rule.overload?' overload':''));
    });
    return out;
  }
  /* What the router box on the canvas says under its name. */
  function natSummary(r){
    const N=r.nat, bits=[];
    if(N.statics.length) bits.push('static');
    N.rules.forEach(function(rule){ bits.push(rule.overload?'PAT':'dynamic'); });
    if(!bits.length) return natEnabled(r)?'NAT: no rules':'no NAT';
    const flows=N.table.filter(function(e){ return e.proto!==null; }).length;
    return 'NAT: '+bits.join(' + ')+(flows?' · '+flows+' xlat':'');
  }

  /* ── CLI ── everything that starts "ip nat" / "no ip nat", in interface or
     global config. Refused outside a NAT round rather than half-accepted. */
  function natCli(d, w, raw){
    const neg = w[0]==='no';
    const a = neg ? w.slice(1) : w, ra = neg ? raw.slice(1) : raw;   /* a[0]='ip', a[1]='nat' */
    const N=d.nat;
    if(d.cm==='if'){
      const f=acIface(d, d.ci);
      if(a[2]==='inside'||a[2]==='outside'){
        if(a.length>3) return '% In interface mode it is just "ip nat inside" or "ip nat outside"';
        f.nat = neg ? (f.nat===a[2]?null:f.nat) : a[2];
        return '';
      }
      return '% In interface mode: "ip nat inside" or "ip nat outside"';
    }
    if(d.cm!=='conf') return '% NAT is configured in global configuration mode';
    if(a[2]==='pool'){
      const name=ra[3];
      if(!name) return '% Usage: ip nat pool <name> <first> <last> netmask <mask>';
      if(neg){ delete N.pools[name]; return ''; }
      if(!isValidIP(a[4])||!isValidIP(a[5])) return '% Usage: ip nat pool <name> <first> <last> netmask <mask>';
      let mask=null;
      if(a[6]==='netmask'&&isValidIP(a[7])) mask=a[7];
      else if(a[6]==='prefix-length'&&/^\d+$/.test(a[7]||'')) mask=cidr2mask(+a[7]);
      else return '% The pool needs "netmask <mask>" (or "prefix-length <n>") after the last address';
      if(ip2int(a[5])<ip2int(a[4])) return '% The end address is lower than the start address';
      const first=a[4], last=a[5], pfx=natPfxOfMask(mask);
      if(pfx===null) return '% Invalid netmask';
      if(netIntOf(ip2int(first),pfx)!==netIntOf(ip2int(last),pfx))
        return '% Start and end address are not in the same network under that netmask';
      N.pools[name]={first:first, last:last, mask:mask};
      return '';
    }
    if(a[2]==='inside'&&a[3]==='source'){
      if(a[4]==='static'){
        if(!isValidIP(a[5])||!isValidIP(a[6])) return '% Usage: ip nat inside source static <inside-local> <inside-global>';
        if(neg){ N.statics=N.statics.filter(function(s){ return !(s.local===a[5]&&s.global===a[6]); }); return ''; }
        if(N.statics.some(function(s){ return s.global===a[6]&&s.local!==a[5]; })) return '% '+a[6]+' is already mapped to another inside address';
        N.statics=N.statics.filter(function(s){ return s.local!==a[5]; });
        N.statics.push({local:a[5], global:a[6]});
        return '';
      }
      if(a[4]==='list'){
        const acl=ra[5];
        if(!acl) return '% Usage: ip nat inside source list <acl> pool <name> [overload]  |  ... interface <iface> overload';
        if(neg){ N.rules=N.rules.filter(function(x){ return x.acl!==acl; }); natClear(d); return ''; }
        if(!d.acls[acl]) return '% Access list '+acl+' does not exist yet — it decides which inside addresses get translated';
        let rule;
        if(a[6]==='pool'){
          if(!ra[7]) return '% Name the pool';
          if(!N.pools[ra[7]]) return '% Pool '+ra[7]+' does not exist yet — define it with "ip nat pool" first';
          if(a[8]&&a[8]!=='overload') return '% The only option after the pool is "overload"';
          rule={acl:acl, pool:ra[7], iface:null, overload:a[8]==='overload'};
        } else if(a[6]==='interface'){
          const f=acIface(d, ra[7]);
          if(!f) return '% Invalid interface';
          if(a[8]!=='overload') return '% Translating to one interface address only works with "overload" — many hosts share it by port';
          rule={acl:acl, pool:null, iface:f.name, overload:true};
        } else return '% After the list: "pool <name> [overload]" or "interface <iface> overload"';
        /* Re-entering the rule for the same list replaces it, as IOS does. */
        N.rules=N.rules.filter(function(x){ return x.acl!==acl; });
        N.rules.push(rule); natClear(d);
        return '';
      }
      return '% After "ip nat inside source": "static <local> <global>" or "list <acl> pool|interface …"';
    }
    if((a[2]==='inside'||a[2]==='outside')&&a.length===3) return '% "ip nat '+a[2]+'" goes on an interface — enter interface mode first';
    if(a[2]==='outside') return '% Outside source translation is not part of this lab';
    return '% Usage: ip nat inside source static … | ip nat inside source list … | ip nat pool … | (config-if) ip nat inside|outside';
  }
  function natPfxOfMask(mask){
    const n=ip2int(mask); let p=0;
    while(p<32 && ((n>>>(31-p))&1)) p++;
    for(let b=p;b<32;b++) if((n>>>(31-b))&1) return null;
    return p;
  }


  /* ═══ PPP ══════════════════════════════════════════════════════════
     A serial link's line protocol from its two ends, each {router, ifName, up,
     encap, auth, clock, dce, users}: both up, a clock on the DCE end, matching
     encapsulation, and — when either end asks for CHAP — each router holding a
     username for the other's exact hostname with the same password. Cabling
     (is there a serial cable, and to what) is the caller's question. */
  function pppLinkState(A, B){
    if(!A.up) return {up:false, why:A.router+' '+A.ifName+' is shut down'};
    if(!B.up) return {up:false, why:B.router+' '+B.ifName+' at the far end is shut down'};
    const dce=A.dce?A:B;
    if(!dce.clock) return {up:false, noClock:true, why:'the DCE end ('+dce.router+' '+dce.ifName+') has no clock rate'};
    if(A.encap!==B.encap) return {up:false, why:'encapsulation mismatch — '+A.router+' '+A.ifName+' runs '+A.encap.toUpperCase()+', '+B.router+' '+B.ifName+' runs '+B.encap.toUpperCase()};
    if(A.encap==='ppp'&&(A.auth==='chap'||B.auth==='chap')){
      const a=A.users[B.router], b=B.users[A.router];
      if(a==null) return {up:false, auth:true, why:'CHAP fails: '+A.router+' has no "username '+B.router+'" (CHAP looks the peer up by its exact hostname)'};
      if(b==null) return {up:false, auth:true, why:'CHAP fails: '+B.router+' has no "username '+A.router+'" (CHAP looks the peer up by its exact hostname)'};
      if(a!==b) return {up:false, auth:true, why:'CHAP fails: the passwords for the '+A.router+'–'+B.router+' link differ at the two ends'};
    }
    return {up:true};
  }


  window.NetRouter={
    ACL_GRAMMAR:ACL_GRAMMAR,
    NAT_GRAMMAR:NAT_GRAMMAR,
    SSH_GRAMMAR:SSH_GRAMMAR,
    ac6Parse:ac6Parse,
    ac6Fmt:ac6Fmt,
    ac6Net:ac6Net,
    aceMake:aceMake,
    aceHost:aceHost,
    aceNet:aceNet,
    aceAny:aceAny,
    ace6Make:ace6Make,
    ace6Side:ace6Side,
    ace6SideMatches:ace6SideMatches,
    acexMake:acexMake,
    acexSide:acexSide,
    portHits:portHits,
    aceProtoHits:aceProtoHits,
    aceHits:aceHits,
    portNum:portNum,
    portName:portName,
    portText:portText,
    wcFirst:wcFirst,
    wcLast:wcLast,
    wcMatches:wcMatches,
    aceMatches:aceMatches,
    ace6SideText:ace6SideText,
    acexSideText:acexSideText,
    aceText:aceText,
    aclMake:aclMake,
    aclNumKind:aclNumKind,
    aclNextSeq:aclNextSeq,
    aclInsert:aclInsert,
    aclRemoveSeq:aclRemoveSeq,
    aclEvaluate:aclEvaluate,
    aclShowLines:aclShowLines,
    acIfNorm:acIfNorm,
    acIface:acIface,
    acFullIf:acFullIf,
    acShowAcls:acShowAcls,
    sshNew:sshNew,
    sshReady:sshReady,
    sshEnabled:sshEnabled,
    sshAllowsTransport:sshAllowsTransport,
    sshServerProblem:sshServerProblem,
    acParseAce:acParseAce,
    acxParseSide:acxParseSide,
    acParsePortOp:acParsePortOp,
    acxParseAce:acxParseAce,
    ac6ParseSide:ac6ParseSide,
    ac6ParseAce:ac6ParseAce,
    sshGenKeys:sshGenKeys,
    acSshCli:acSshCli,
    acShowIpSsh:acShowIpSsh,
    acFakeHash:acFakeHash,
    aclCli:aclCli,
    natNew:natNew,
    natEnabled:natEnabled,
    natPoolAddrs:natPoolAddrs,
    natRuleFor:natRuleFor,
    natFreePort:natFreePort,
    natOut:natOut,
    natRecord:natRecord,
    natIn:natIn,
    natClear:natClear,
    natSnapshot:natSnapshot,
    natRestore:natRestore,
    natPad:natPad,
    natTableLines:natTableLines,
    natShowTranslations:natShowTranslations,
    natShowStats:natShowStats,
    natRunLines:natRunLines,
    natSummary:natSummary,
    natCli:natCli,
    natPfxOfMask:natPfxOfMask,
    pppLinkState:pppLinkState,
    PORT_NAMES:PORT_NAMES
  };
})(window);
