/* net-ospf.js — the OSPF engine, shared by dynamic_routing.html's OSPF Lab
   and the troubleshooting trainer. OSPFv2 and OSPFv3 in one engine: every
   address question goes through OP_FAM[fam] (a key is a Number for IPv4 and
   a 32-nibble hex string for IPv6), so adjacency, SPF and route building
   never know which family they are in.

   What it models, because these are the things the exam's OSPF tickets
   turn on:
     · an interface runs OSPF when a network statement (v2) or an interface
       "ip ospf <pid> area <n>" / "ipv6 ospf <pid> area <n>" puts it in an area;
     · neighbours form only with matching areas, a matching subnet (v2), no
       passive interface on either side, and distinct router IDs;
     · the router ID is chosen when the process starts — configured, else the
       highest loopback, else the highest up interface — and a later
       router-id waits for "clear ip ospf process" once neighbours are up, as
       on IOS. OSPFv3 on an IPv6-only router has to be given one;
     · SPF per area, intra-area routes (O) always preferred to inter-area
       (O IA) ones through an ABR, and a default injected with
       "default-information originate" arrives as O*E2 (metric 1) everywhere;
     · loopbacks are advertised as host routes (/32, /128).

   It owns no devices. NetOspf.create(world) takes:
     routers()        every router
     ifaces(r)        every interface record the router has (physical,
                      sub-interface, serial, loopback)
     neighbors(r,f)   the routers reachable out of interface f, as
                      [{router, iface}] — whatever the page's L2 or serial
                      model says is on the far side
     parseIf(r,text)  an interface record from what the learner typed
     currentIf(r)     the interface being configured in interface mode
     ifUp(r,f)        optional: line protocol (default f.up)
     staticDefault(r,fam)  does the router have a default route of its own
     fullIf(name)     optional: the long form of an interface name
   A router carries ospf and ospf6 (opNew()) and unicast6; an interface
   carries name, up, loopback, ip, pfx, ip6, pfx6, ll6, area2, area6, cost. */
(function(window){
  const isValidIP=window.LabShared.isValidIP;
  function ip2int(ip){ const p=ip.split('.').map(Number); return((p[0]<<24)|(p[1]<<16)|(p[2]<<8)|p[3])>>>0; }
  function int2ip(n){ return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.'); }
  function maskInt(c){ return c<=0?0:(c>=32?0xFFFFFFFF>>>0:(0xFFFFFFFF<<(32-c))>>>0); }
  function netIntOf(ip,c){ return (ip & maskInt(c))>>>0; }

  function op6Parse(str){
    if(typeof str!=='string') return null;
    const s=str.trim().toLowerCase();
    if(!s||/[^0-9a-f:]/.test(s)||s.indexOf(':::')>=0) return null;
    const halves=s.split('::');
    if(halves.length>2) return null;
    const head=halves[0]?halves[0].split(':'):[];
    const tail=halves.length===2&&halves[1]?halves[1].split(':'):[];
    if(halves.length===1&&head.length!==8) return null;
    if(halves.length===2&&head.length+tail.length>7) return null;
    const groups=head.concat(new Array(8-head.length-tail.length).fill('0')).concat(tail);
    for(let i=0;i<8;i++) if(!/^[0-9a-f]{1,4}$/.test(groups[i])) return null;
    return groups.map(function(g){ return ('0000'+g).slice(-4); }).join('');
  }
  function op6Fmt(hex){
    const g=[]; for(let i=0;i<32;i+=4) g.push(parseInt(hex.slice(i,i+4),16).toString(16));
    let bs=-1,bl=0,cs=-1,cl=0;
    g.forEach(function(x,i){ if(x==='0'){ if(cs<0){cs=i;cl=0;} cl++; if(cl>bl){bl=cl;bs=cs;} } else cs=-1; });
    if(bl<2) return g.join(':');
    return g.slice(0,bs).join(':')+'::'+g.slice(bs+bl).join(':');
  }
  function op6Net(hex, pfx){
    const full=pfx>>2, rem=pfx&3;
    let out=hex.slice(0,full);
    if(rem) out+=(parseInt(hex[full],16)&(0xF<<(4-rem))&0xF).toString(16);
    return (out+'00000000000000000000000000000000').slice(0,32);
  }
  function op6Up(s){ return op6Fmt(op6Parse(s)).toUpperCase(); }
  const OP_FAM={
    4:{ addr:function(p){ return p.ip?{key:ip2int(p.ip), pfx:p.pfx}:null; },
        net:function(k,pfx){ return netIntOf(k,pfx); },
        fmt:function(k){ return int2ip(k); },
        host:32, zero:0 },
    6:{ addr:function(p){ return p.ip6?{key:op6Parse(p.ip6), pfx:p.pfx6}:null; },
        net:function(k,pfx){ return op6Net(k,pfx); },
        fmt:function(k){ return op6Fmt(k).toUpperCase(); },
        host:128, zero:'00000000000000000000000000000000' }
  };
  function opNew(){ return {on:false, pid:1, rid:null, ridActive:null, networks:[], passive:[], defOrig:false, always:false}; }
  function opProc(r,fam){ return fam===6?r.ospf6:r.ospf; }
  function opRidStr(n){ return n==null?'0.0.0.0':int2ip(n); }
  function opPop(n){ let c=0; n=n>>>0; while(n){ c+=n&1; n>>>=1; } return c; }
  function opParseArea(s){
    if(s==null) return null;
    if(/^\d+$/.test(s)) return +s;
    if(isValidIP(s)) return ip2int(s);
    return null;
  }

  /* The shapes of the commands ospfCli understands, for a page that checks
     lines against a grammar before running them (lab-shared.js cliCheck). */
  /* grouped by mode: 'router' is any (config-router) — RIP or OSPF — 'ospf'
     an OSPFv2 process only, 'rtr' the OSPFv3 process (config-rtr) */
  const GRAMMAR=window.LabShared.cliGrammar({
    'config': ['router ospf <n>', 'no router ospf <n>', 'ipv6 router ospf <n>', 'no ipv6 router ospf <n>',
      'ipv6 unicast-routing', 'no ipv6 unicast-routing'],
    'ospf rtr': ['router-id <ip>', 'no router-id [<ip>]', 'auto-cost reference-bandwidth <n>', 'log-adjacency-changes [detail]'],
    'router rtr': ['passive-interface <if>', 'no passive-interface <if>',
      'default-information originate [always]', 'no default-information originate [always]'],
    'ospf': ['network <ip> <ip> area <area>', 'no network <ip> <ip> [area <area>]'],
    'routed': ['ip ospf <n> area <area>', 'ip ospf cost <n>', 'no ip ospf [<n> area <area>]', 'no ip ospf cost [<n>]',
      'ipv6 ospf <n> area <area>', 'ipv6 ospf cost <n>', 'no ipv6 ospf [<n> area <area>]', 'no ipv6 ospf cost [<n>]'],
    'exec': ['clear ip|ipv6 ospf process',
      'show ip|ipv6 ospf [neighbor]', 'show ip|ipv6 ospf interface [brief]', 'show ip|ipv6 ospf interface <if>',
      'show ip|ipv6 protocols']
  });
  function create(world){
    const fullIf=world.fullIf||function(n){ return n.replace(/^Gi/,'GigabitEthernet').replace(/^S(?=\d)/,'Serial').replace(/^Lo(?=\d)/,'Loopback'); };
    const ifUp=world.ifUp||function(r,f){ return !!f.up; };
    function opLL(r,p){
      if(p.ll6) return p.ll6;
      const i=world.ifaces(r).indexOf(p);
      return op6Fmt(op6Parse('fe80::'+(r.name.replace(/\D/g,'')||'0')+':'+(i+1)));
    }
    function opDerivedRid(r){
      const all=world.ifaces(r).filter(function(p){ return p.up&&p.ip; });
      const best=function(list){ const v=list.map(function(p){ return ip2int(p.ip); });
        return v.length?v.reduce(function(a,b){ return a>b?a:b; }):null; };
      const lb=best(all.filter(function(p){ return p.loopback; }));
      return lb!=null?lb:best(all.filter(function(p){ return !p.loopback; }));
    }
    /* The router ID in use. It is locked the moment one can be chosen, and a
       configured router-id replaces it only through a process clear. */
    function opRid(r,fam){
      const pr=opProc(r,fam);
      if(!pr.on||(fam===6&&!r.unicast6)) return null;
      if(pr.ridActive==null){ const v=pr.rid!=null?pr.rid:opDerivedRid(r); if(v!=null) pr.ridActive=v; }
      return pr.ridActive;
    }
    /* The area this interface runs OSPF in, or null. Interface configuration
       wins; otherwise the most specific matching network statement. */
    function opIfArea(r,p,fam){
      const pr=opProc(r,fam);
      if(!ifUp(r,p)) return null;
      if(fam===6){
        if(!r.unicast6||!pr.on||!p.ip6||p.area6==null) return null;
        return p.area6;
      }
      if(!pr.on||!p.ip) return null;
      if(p.area2!=null) return p.area2;
      const ipI=ip2int(p.ip);
      const hits=pr.networks.filter(function(n){ return ((ipI & ~n.wc)>>>0)===((n.net & ~n.wc)>>>0); });
      if(!hits.length) return null;
      hits.sort(function(a,b){ return opPop(a.wc)-opPop(b.wc); });
      return hits[0].area;
    }
    function opIsPassive(r,p,fam){ return opProc(r,fam).passive.indexOf(p.name)>=0; }
    function opIfCost(p){ return p.cost!=null?p.cost:1; }

    /* Every neighbour relationship a router's interfaces try to form, with
       the reason when one does not come up. state:'FULL' is an adjacency. */
    function opNeighbors(r,fam){
      const out=[];
      if(opRid(r,fam)==null) return out;
      world.ifaces(r).forEach(function(p){
        if(p.loopback) return;
        const area=opIfArea(r,p,fam);
        if(area==null) return;
        world.neighbors(r,p).forEach(function(nb){
          const n=nb.router, q=nb.iface;
          const e={nb:n, myIf:p, theirIf:q, area:area, state:null, why:null, addr: fam===6?opLL(n,q):q.ip};
          const qa=opIfArea(n,q,fam);
          if(qa==null) e.why=n.name+' '+q.name+' is not running '+(fam===6?'OSPFv3':'OSPF');
          else if(opIsPassive(r,p,fam)) e.why=r.name+' '+p.name+' is passive, so it sends no hellos';
          else if(opIsPassive(n,q,fam)) e.why=n.name+' '+q.name+' is passive, so it sends no hellos';
          else if(qa!==area) e.why='area mismatch — '+r.name+' '+p.name+' is in area '+area+', '+n.name+' '+q.name+' is in area '+qa;
          else if(fam===4&&(q.pfx!==p.pfx||netIntOf(ip2int(q.ip),p.pfx)!==netIntOf(ip2int(p.ip),p.pfx)))
            e.why=r.name+' '+p.name+' and '+n.name+' '+q.name+' are not in the same subnet';
          else if(opRid(n,fam)==null) e.why=n.name+"'s "+(fam===6?'OSPFv3':'OSPF')+' process has no router ID, so it cannot start';
          else if(opRid(n,fam)===opRid(r,fam)) e.why='duplicate router ID '+opRidStr(opRid(r,fam))+' on '+r.name+' and '+n.name;
          else e.state='FULL';
          out.push(e);
        });
      });
      return out;
    }

    /* ── SPF ── per family, cached and thrown away on any change */
    let cache={};
    function opInvalidate(){ cache={}; }
    function opSpf(fam){
      if(cache[fam]) return cache[fam];
      const routers=world.routers().filter(function(r){ return opRid(r,fam)!=null; });
      const F=OP_FAM[fam];
      const edges={}, areasOf={}, nets=[];
      routers.forEach(function(r){
        areasOf[r.id]=new Set();
        opNeighbors(r,fam).forEach(function(e){
          if(e.state!=='FULL'||routers.indexOf(e.nb)<0) return;
          (edges[e.area]=edges[e.area]||[]).push({from:r, to:e.nb, cost:opIfCost(e.myIf), iface:e.myIf.name, nh:e.addr});
        });
        world.ifaces(r).forEach(function(p){
          const area=opIfArea(r,p,fam); if(area==null) return;
          areasOf[r.id].add(area);
          const a=F.addr(p); if(!a) return;
          const pfx=p.loopback?F.host:a.pfx;
          nets.push({router:r, area:area, net:F.net(a.key,pfx), pfx:pfx, cost:opIfCost(p)});
        });
      });
      const dist={};
      const areaList=new Set(Object.keys(edges));
      routers.forEach(function(r){ areasOf[r.id].forEach(function(a){ areaList.add(String(a)); }); });
      areaList.forEach(function(A){
        dist[A]={};
        const inA=routers.filter(function(r){ return areasOf[r.id].has(+A); });
        inA.forEach(function(src){
          const d={}; inA.forEach(function(r){ d[r.id]=Infinity; }); d[src.id]=0;
          const todo=inA.slice();
          while(todo.length){
            todo.sort(function(a,b){ return d[a.id]-d[b.id]; });
            const cur=todo.shift();
            if(d[cur.id]===Infinity) break;
            (edges[A]||[]).forEach(function(e){
              if(e.from!==cur||d[e.to.id]==null) return;
              if(d[cur.id]+e.cost<d[e.to.id]) d[e.to.id]=d[cur.id]+e.cost;
            });
          }
          dist[A][src.id]=d;
        });
      });
      const D=function(A,x,y){ const t=dist[A]&&dist[A][x.id]; return t&&t[y.id]!=null?t[y.id]:Infinity; };
      const hopsToward=function(A,x,t){
        const out=[]; if(x===t) return out;
        (edges[A]||[]).forEach(function(e){
          if(e.from!==x) return;
          if(e.cost+D(A,e.to,t)===D(A,x,t)) out.push({nextHop:e.nh, iface:e.iface});
        });
        return out;
      };
      const isAbr=function(r){ return !!areasOf[r.id]&&areasOf[r.id].has(0)&&areasOf[r.id].size>1; };
      const intra=function(b,n){
        let best=Infinity;
        nets.forEach(function(m){ if(m.area!==n.area||m.net!==n.net||m.pfx!==n.pfx) return;
          const c=D(n.area,b,m.router)+m.cost; if(c<best) best=c; });
        return best;
      };
      const routes={};
      routers.forEach(function(x){
        const mine=areasOf[x.id], conn=new Set();
        world.ifaces(x).forEach(function(p){ const a=F.addr(p); if(a&&ifUp(x,p)){ conn.add(F.net(a.key,a.pfx)+'/'+a.pfx); if(p.loopback) conn.add(F.net(a.key,F.host)+'/'+F.host); } });
        const best=new Map();
        const offer=function(k,net,pfx,code,metric,hops){
          const rank=code==='O'?0:1, cur=best.get(k);
          if(!cur||rank<cur.rank||(rank===cur.rank&&metric<cur.metric)) best.set(k,{net:net,pfx:pfx,code:code,metric:metric,rank:rank,via:hops.slice()});
          else if(rank===cur.rank&&metric===cur.metric) hops.forEach(function(h){ if(!cur.via.some(function(v){ return v.nextHop===h.nextHop&&v.iface===h.iface; })) cur.via.push(h); });
        };
        const abrs=routers.filter(isAbr);
        nets.forEach(function(n){
          const k=n.net+'/'+n.pfx;
          if(conn.has(k)) return;
          if(mine.has(n.area)){
            const c=D(n.area,x,n.router);
            if(c===Infinity||n.router===x) return;
            offer(k,n.net,n.pfx,'O',c+n.cost,hopsToward(n.area,x,n.router));
            return;
          }
          /* inter-area: through an ABR into the backbone and out again */
          if(mine.has(0)){
            abrs.forEach(function(b){ if(b===x||!areasOf[b.id].has(n.area)) return;
              const c=D(0,x,b)+intra(b,n); if(c<Infinity) offer(k,n.net,n.pfx,'O IA',c,hopsToward(0,x,b)); });
          } else mine.forEach(function(A){
            abrs.forEach(function(b){ if(!areasOf[b.id].has(A)) return;
              let t=areasOf[b.id].has(n.area)?intra(b,n):Infinity;
              if(t===Infinity) abrs.forEach(function(c2){ if(c2!==b&&areasOf[c2.id].has(n.area)) t=Math.min(t,D(0,b,c2)+intra(c2,n)); });
              const c=D(A,x,b)+t; if(c<Infinity) offer(k,n.net,n.pfx,'O IA',c,hopsToward(A,x,b)); });
          });
        });
        /* the external default, from every router that originates one */
        if(!world.staticDefault(x,fam)){
          routers.forEach(function(a){
            const pr=opProc(a,fam);
            if(a===x||!pr.defOrig||!(world.staticDefault(a,fam)||pr.always)) return;
            let cost=Infinity, hops=[];
            mine.forEach(function(A){ if(areasOf[a.id].has(A)){ const c=D(A,x,a); if(c<cost){ cost=c; hops=hopsToward(A,x,a); } } });
            if(cost===Infinity) abrs.forEach(function(b){
              mine.forEach(function(A){ if(!areasOf[b.id].has(A)) return;
                let t=Infinity; areasOf[a.id].forEach(function(Z){ if(areasOf[b.id].has(Z)) t=Math.min(t,D(Z,b,a)); });
                if(t===Infinity) abrs.forEach(function(c2){ areasOf[a.id].forEach(function(Z){ if(areasOf[c2.id].has(Z)) t=Math.min(t,D(0,b,c2)+D(Z,c2,a)); }); });
                const c=D(A,x,b)+t; if(c<cost){ cost=c; hops=hopsToward(A,x,b); } });
            });
            if(cost<Infinity) offer('dflt',F.zero,0,'O*E2',1,hops);
          });
        }
        routes[x.id]=Array.from(best.values());
      });
      cache[fam]={routes:routes, areasOf:areasOf, isAbr:isAbr, routers:routers};
      return cache[fam];
    }
    /* [{net, pfx, code:'O'|'O IA'|'O*E2', metric, via:[{nextHop, iface}]}],
       iface being the outgoing interface's name */
    function opRoutesOf(r,fam){ return (opSpf(fam).routes[r.id])||[]; }

    /* ── show output ── */
    function opShowNbr(r,fam){
      const L=[fam===6?'Neighbor ID     Pri   State           Dead Time   Interface ID    Interface':'Neighbor ID     Pri   State           Dead Time   Address         Interface'];
      const me=opRid(r,fam);
      opNeighbors(r,fam).filter(function(e){ return e.state==='FULL'; }).forEach(function(e){
        const them=opRid(e.nb,fam), role=them>me?'DR':'BDR';
        L.push(opRidStr(them).padEnd(16)+'1'.padEnd(6)+('FULL/'+role).padEnd(16)+'00:00:3'+(e.nb.id%10)+'    '+
          (fam===6?String(world.ifaces(e.nb).indexOf(e.theirIf)+3).padEnd(16):String(e.addr).padEnd(16))+fullIf(e.myIf.name));
      });
      return L.join('\n');
    }
    function opShowIfBriefTable(r,fam){
      const L=['Interface    PID   Area            '+(fam===6?'Intf ID    ':'IP Address/Mask    ')+'Cost  State Nbrs F/C'];
      const nbs=opNeighbors(r,fam);
      world.ifaces(r).forEach(function(p,ix){
        const a=opIfArea(r,p,fam); if(a==null) return;
        const full=nbs.filter(function(e){ return e.myIf===p&&e.state==='FULL'; });
        const st=p.loopback?'LOOP':full.length?(opRid(r,fam)>opRid(full[0].nb,fam)?'DR':'BDR'):'DR';
        L.push(p.name.replace(/^Loopback/,'Lo').padEnd(13)+String(opProc(r,fam).pid).padEnd(6)+String(a).padEnd(16)+
          (fam===6?String(ix+3).padEnd(11):(p.ip+'/'+p.pfx).padEnd(19))+String(opIfCost(p)).padEnd(6)+st.padEnd(6)+full.length+'/'+full.length);
      });
      return L.join('\n');
    }
    function opShowIf(r,fam,p){
      const a=opIfArea(r,p,fam);
      if(a==null) return fullIf(p.name)+' is '+(p.up?'up':'administratively down')+', line protocol is '+(ifUp(r,p)?'up':'down')+'\n  '+(fam===6?'OSPFv3':'OSPF')+' not enabled on this interface';
      const nbs=opNeighbors(r,fam).filter(function(e){ return e.myIf===p; });
      const L=[fullIf(p.name)+' is up, line protocol is up',
        fam===6?'  Link Local Address '+opLL(r,p).toUpperCase()+', Interface ID '+(world.ifaces(r).indexOf(p)+3):'  Internet Address '+p.ip+'/'+p.pfx+', Area '+a,
        (fam===6?'  Area '+a+', ':'  ')+'Process ID '+opProc(r,fam).pid+', Router ID '+opRidStr(opRid(r,fam))+', Network Type '+(p.loopback?'LOOPBACK':'BROADCAST')+', Cost: '+opIfCost(p)];
      if(opIsPassive(r,p,fam)) L.push('  No Hellos (Passive interface)');
      else if(!p.loopback){
        L.push('  Timer intervals configured, Hello 10, Dead 40, Wait 40, Retransmit 5');
        L.push('  Neighbor Count is '+nbs.length+', Adjacent neighbor count is '+nbs.filter(function(e){ return e.state==='FULL'; }).length);
        nbs.forEach(function(e){ if(e.state==='FULL') L.push('    Adjacent with neighbor '+opRidStr(opRid(e.nb,fam))); });
      }
      return L.join('\n');
    }
    function opShowProtocols(r,fam){
      const pr=opProc(r,fam);
      if(!pr.on) return null;
      const sp=opSpf(fam), areas=sp.areasOf[r.id]?Array.from(sp.areasOf[r.id]).sort():[];
      const L=[(fam===6?'IPv6 Routing Protocol is "ospf ':'Routing Protocol is "ospf ')+pr.pid+'"',
        '  Router ID '+opRidStr(opRid(r,fam))];
      if(sp.isAbr(r)) L.push('  It is an area border router');
      if(pr.defOrig) L.push('  It is an autonomous system boundary router');
      L.push('  Number of areas in this router is '+areas.length+'. '+areas.length+' normal 0 stub 0 nssa');
      if(fam===4){
        L.push('  Routing for Networks:');
        if(!pr.networks.length) L.push('    (none)');
        pr.networks.forEach(function(n){ L.push('    '+int2ip(n.net)+' '+int2ip(n.wc)+' area '+n.area); });
      } else {
        areas.forEach(function(a){
          L.push('  Interfaces (Area '+a+'):');
          world.ifaces(r).forEach(function(p){ if(opIfArea(r,p,6)===a) L.push('    '+fullIf(p.name)); });
        });
      }
      if(pr.passive.length){ L.push('  Passive Interface(s):'); pr.passive.forEach(function(n){ L.push('    '+fullIf(n)); }); }
      L.push('  Distance: (default is 110)');
      return L.join('\n');
    }

    /* ── CLI ── the OSPF commands and "ipv6 unicast-routing"; returns null
       for anything else, so a page runs it ahead of its own handlers. */
    function opStart(d,fam,pid){
      const pr=opProc(d,fam);
      const was=pr.on;
      pr.on=true; pr.pid=pid;
      if(!was){
        pr.ridActive=null;
        const rid=opRid(d,fam);
        if(rid==null&&fam===6) return '%OSPFv3-4-NORTRID: Process '+pid+' could not pick a router-id, please configure manually';
      }
      return '';
    }
    function ospfCli(d,t,w,M){
      opInvalidate();
      const raw=t.split(' ');
      /* the yes/no question "clear ip ospf process" asks */
      if(d.cm==='opclear'){
        if(t&&!/^(y(es)?|no?)$/i.test(t)) return "% Please answer 'yes' or 'no'.";
        d.cm=d.cmBefore||'exec';
        if(/^y(es)?$/i.test(t)){ opProc(d,d.opClearFam).ridActive=null; opRid(d,d.opClearFam); }
        return '';
      }
      if(M(w[0],'clear')&&(w[1]==='ip'||w[1]==='ipv6')&&w[2]&&M(w[2],'ospf')&&w[3]&&M(w[3],'process')){
        d.cmBefore=d.cm; d.cm='opclear'; d.opClearFam=w[1]==='ipv6'?6:4;
        return '';
      }
      if(M(w[0],'show')||w[0]==='sh'){
        const fam=w[1]==='ipv6'?6:(w[1]&&M(w[1],'ip'))?4:null;
        if(!fam) return null;
        if(w[2]&&M(w[2],'ospf')){
          if(!opProc(d,fam).on) return '%'+(fam===6?'OSPFv3':'OSPF')+': Router process not running';
          if(w[3]&&M(w[3],'neighbor')) return opShowNbr(d,fam);
          if(w[3]&&M(w[3],'interface')){
            if(w[4]&&M(w[4],'brief')) return opShowIfBriefTable(d,fam);
            if(raw[4]){ const p=world.parseIf(d,raw.slice(4).join('')); return p?opShowIf(d,fam,p):'% Invalid interface'; }
            return world.ifaces(d).filter(function(p){ return opIfArea(d,p,fam)!=null; }).map(function(p){ return opShowIf(d,fam,p); }).join('\n');
          }
          return '% Try "show '+(fam===6?'ipv6':'ip')+' ospf neighbor" or "show '+(fam===6?'ipv6':'ip')+' ospf interface [brief]"';
        }
        if(w[2]&&M(w[2],'protocols')){
          const s=opShowProtocols(d,fam);
          if(fam===6) return s||'(no IPv6 routing protocol is running)';
          return s&&!(d.rip&&d.rip.on)?s:null;
        }
        return null;
      }
      if(w[0]==='ipv6'&&w[1]&&M(w[1],'unicast-routing')){ d.unicast6=true; return ''; }
      if(w[0]==='no'&&w[1]==='ipv6'&&w[2]&&M(w[2],'unicast-routing')){ d.unicast6=false; return ''; }

      /* processes */
      if(M(w[0],'router')&&w[1]&&M(w[1],'ospf')){
        if(!/^\d+$/.test(w[2]||'')) return '% Usage: router ospf <process-id>';
        const out=opStart(d,4,+w[2]); d.cm='ospf'; return out;
      }
      if(w[0]==='ipv6'&&w[1]&&M(w[1],'router')&&w[2]&&M(w[2],'ospf')){
        if(!d.unicast6) return '% IPv6 routing not enabled — "ipv6 unicast-routing" first';
        if(!/^\d+$/.test(w[3]||'')) return '% Usage: ipv6 router ospf <process-id>';
        const out=opStart(d,6,+w[3]); d.cm='ospf6'; return out;
      }
      if(w[0]==='no'&&M(w[1],'router')&&w[2]&&M(w[2],'ospf')){ d.ospf=opNew(); world.ifaces(d).forEach(function(p){ p.area2=null; }); d.cm='conf'; return ''; }
      /* "ospf" is required: "no ipv6 route ..." would otherwise abbreviate
         "router" and wipe the whole OSPFv3 process. */
      if(w[0]==='no'&&w[1]==='ipv6'&&w[2]&&M(w[2],'router')&&w[3]&&M(w[3],'ospf')){ d.ospf6=opNew(); world.ifaces(d).forEach(function(p){ p.area6=null; }); d.cm='conf'; return ''; }

      /* router-configuration mode, both versions */
      if(d.cm==='ospf'||d.cm==='ospf6'){
        const fam=d.cm==='ospf6'?6:4, pr=opProc(d,fam);
        if(M(w[0],'router-id')){
          if(!isValidIP(w[1]||'')) return '% Usage: router-id <a.b.c.d>';
          pr.rid=ip2int(w[1]);
          /* IOS changes the ID straight away unless the process already has
             neighbours; then it waits for a restart. */
          if(pr.ridActive!=null&&pr.ridActive!==pr.rid&&opNeighbors(d,fam).some(function(e){ return e.state==='FULL'; }))
            return '% OSPF: Reload or use "clear '+(fam===6?'ipv6':'ip')+' ospf process" command, for this to take effect';
          pr.ridActive=null; opRid(d,fam);
          return '';
        }
        if(w[0]==='no'&&M(w[1],'router-id')){ pr.rid=null; return ''; }
        if(fam===4&&M(w[0],'network')){
          if(!isValidIP(w[1]||'')||!isValidIP(w[2]||'')||!(w[3]&&M(w[3],'area'))||opParseArea(w[4])==null)
            return '% Usage: network <address> <wildcard> area <area-id>';
          const n={net:ip2int(w[1]), wc:ip2int(w[2]), area:opParseArea(w[4])};
          const ex=pr.networks.find(function(x){ return x.net===n.net&&x.wc===n.wc; });
          if(ex) return ex.area===n.area?'':'% '+w[1]+' '+w[2]+' is already in area '+ex.area+' — remove it with "no network" first';
          pr.networks.push(n);
          return '';
        }
        if(fam===4&&w[0]==='no'&&M(w[1],'network')){
          if(!isValidIP(w[2]||'')||!isValidIP(w[3]||'')) return '% Usage: no network <address> <wildcard> area <area-id>';
          const net=ip2int(w[2]), wc=ip2int(w[3]);
          const before=pr.networks.length;
          pr.networks=pr.networks.filter(function(x){ return !(x.net===net&&x.wc===wc); });
          return pr.networks.length===before?'% No such network statement':'';
        }
        if(M(w[0],'passive-interface')){
          const p=world.parseIf(d,raw.slice(1).join(''));
          if(!p) return '% Invalid interface — try "passive-interface Gi0/0"';
          if(pr.passive.indexOf(p.name)<0) pr.passive.push(p.name);
          return '';
        }
        if(w[0]==='no'&&M(w[1],'passive-interface')){
          const p=world.parseIf(d,raw.slice(2).join(''));
          if(!p) return '% Invalid interface';
          pr.passive=pr.passive.filter(function(n){ return n!==p.name; });
          return '';
        }
        if(M(w[0],'default-information')&&w[1]&&M(w[1],'originate')){
          pr.defOrig=true; pr.always=!!(w[2]&&M(w[2],'always'));
          return world.staticDefault(d,fam)||pr.always?'':'% Note: there is no default route to originate yet — add one in global configuration.';
        }
        if(w[0]==='no'&&M(w[1],'default-information')){ pr.defOrig=false; pr.always=false; return ''; }
        if(M(w[0],'auto-cost')||M(w[0],'log-adjacency-changes')) return '';
      }

      /* interface mode: area membership and cost */
      if(d.cm==='if'){
        const p=world.currentIf(d);
        if(!p) return null;
        if(w[0]==='ipv6'&&w[1]&&M(w[1],'ospf')){
          if(w[2]&&M(w[2],'cost')){ const c=+w[3]; if(!(c>=1&&c<=65535)) return '% Usage: ipv6 ospf cost <1-65535>'; p.cost=c; return ''; }
          if(!d.unicast6) return '% IPv6 routing not enabled — "ipv6 unicast-routing" first';
          if(!/^\d+$/.test(w[2]||'')||!(w[3]&&M(w[3],'area'))||opParseArea(w[4])==null) return '% Usage: ipv6 ospf <process-id> area <area-id>';
          if(!p.ip6) return '% '+p.name+' has no IPv6 address yet';
          p.area6=opParseArea(w[4]);
          return d.ospf6.on?'':opStart(d,6,+w[2]);
        }
        if(w[0]==='no'&&w[1]==='ipv6'&&w[2]&&M(w[2],'ospf')){ if(w[3]&&M(w[3],'cost')) p.cost=null; else p.area6=null; return ''; }
        if(M(w[0],'ip')&&w[1]&&M(w[1],'ospf')){
          if(w[2]&&M(w[2],'cost')){ const c=+w[3]; if(!(c>=1&&c<=65535)) return '% Usage: ip ospf cost <1-65535>'; p.cost=c; return ''; }
          if(!/^\d+$/.test(w[2]||'')||!(w[3]&&M(w[3],'area'))||opParseArea(w[4])==null) return '% Usage: ip ospf <process-id> area <area-id>';
          p.area2=opParseArea(w[4]);
          return d.ospf.on?'':opStart(d,4,+w[2]);
        }
        if(w[0]==='no'&&M(w[1],'ip')&&w[2]&&M(w[2],'ospf')){ if(w[3]&&M(w[3],'cost')) p.cost=null; else p.area2=null; return ''; }
      }
      return null;
    }
    /* show run: the global lines, and the per-interface ones */
    function ospfRunLines(d){
      const L=[];
      if(d.unicast6) L.push('ipv6 unicast-routing','!');
      [[d.ospf,'router ospf '],[d.ospf6,'ipv6 router ospf ']].forEach(function(x){
        const pr=x[0];
        if(!pr.on) return;
        L.push(x[1]+pr.pid);
        if(pr.rid!=null) L.push(' router-id '+int2ip(pr.rid));
        pr.passive.forEach(function(n){ L.push(' passive-interface '+n); });
        if(pr===d.ospf) pr.networks.forEach(function(n){ L.push(' network '+int2ip(n.net)+' '+int2ip(n.wc)+' area '+n.area); });
        if(pr.defOrig) L.push(' default-information originate'+(pr.always?' always':''));
        L.push('!');
      });
      return L;
    }
    function ospfIfRunLines(d,p){
      const L=[];
      if(p.area2!=null) L.push(' ip ospf '+d.ospf.pid+' area '+p.area2);
      if(p.area6!=null) L.push(' ipv6 ospf '+d.ospf6.pid+' area '+p.area6);
      if(p.cost!=null) L.push(' ip ospf cost '+p.cost);
      return L;
    }
    return {opLL:opLL, opDerivedRid:opDerivedRid, opRid:opRid, opIfArea:opIfArea, opIsPassive:opIsPassive,
      opIfCost:opIfCost, opNeighbors:opNeighbors, opInvalidate:opInvalidate, opSpf:opSpf, opRoutesOf:opRoutesOf,
      opShowNbr:opShowNbr, opShowIfBriefTable:opShowIfBriefTable, opShowIf:opShowIf, opShowProtocols:opShowProtocols,
      opStart:opStart, ospfCli:ospfCli, ospfRunLines:ospfRunLines, ospfIfRunLines:ospfIfRunLines};
  }
  window.NetOspf={create:create, GRAMMAR:GRAMMAR, OP_FAM:OP_FAM, opNew:opNew, opProc:opProc, opRidStr:opRidStr, opParseArea:opParseArea,
    op6Parse:op6Parse, op6Fmt:op6Fmt, op6Net:op6Net, op6Up:op6Up};
})(window);
