/* net-switch.js — the switch engine, shared by switching_lab.html and the
   troubleshooting trainer. Port state, VLAN lists, trunks, EtherChannel
   (PAgP/LACP/on), port security, the SVI and default gateway, the IOS CLI
   and every show command, Layer 2 reachability and STP.

   It owns no devices. A page calls NetSwitch.create(world) once, where world
   supplies the topology it already keeps:
     devices()        every device (switches, PCs, routers)
     cables()         every cable {a:{d,i}, b:{d,i}}
     byId(id)         device lookup
     portCable(id,i)  the cable on a device's port, or undefined
     otherEnd(c,id)   the far end {d,i} of a cable seen from a device
     onIpChange()     optional: called after an SVI address changes
   and gets back an object of functions to destructure. A switch is
   {id, type:'switch', name, ports:[newPort(name)...], pos:{}, vlans:Set,
   vlanNames:{}, ip, ipVlan, sviShut, gw, priority, mac, cm, ci, cr, cpo, cv,
   log, hist, hi} — newSwitchState() supplies everything but the identity. */
(function(window){
  function create(world){
    const byId=function(id){ return world.byId(id); };
    const portCable=function(d,i){ return world.portCable(d,i); };
    const otherEnd=function(c,d){ return world.otherEnd(c,d); };
    const isValidIP=window.LabShared.isValidIP;
    function newPort(name){
      return {name:name, mode:'access', vlan:1, ch:0, chMode:null, native:1, allowed:null, shut:false, ps:psNew()};
    }
    function newSwitchState(portNames){
      return {ports:portNames.map(newPort), pos:{}, vlans:new Set([1]), vlanNames:{},
              ip:null, ipVlan:null, sviShut:false, gw:null,
              cm:'exec', ci:null, cr:null, cpo:null, cv:null, log:[], hist:[], hi:0};
    }
    /* ═══ Port state ══════════════════════════════════════════════════════════
       Everything that decides whether a switch port is forwarding lives here, so
       reachability, the show commands and the requirement checks all read one
       answer. A port is down when it is shut, err-disabled by port security, or a
       member of a shut port-channel. */
    function psNew(){
      return {on:false, max:1, sticky:false, violation:'shutdown',
              macs:[] /* {mac, type:'static'|'sticky'|'dynamic'} */, errd:false, count:0, last:null};
    }
    /* world.endUp(d,i), when given, says whether a non-switch end (a router
       interface) is up — so a switch port facing a shut router port reads
       notconnect, as it does on real kit. */
    function portUp(d,i){
      if(d.type!=='switch') return world.endUp?world.endUp(d,i):true;
      const p=d.ports[i];
      if(p.shut||p.ps.errd) return false;
      const po=p.ch>0?d.pos[p.ch]:null;
      return !(po&&po.shut);
    }
    function portLinkUp(d,i){
      const c=portCable(d.id,i); if(!c) return false;
      const o=otherEnd(c,d.id);
      return portUp(d,i)&&portUp(byId(o.d),o.i);
    }
    /* "dynamic" is IOS's default, dynamic auto: the port trunks only when the
       far end is a configured trunk, and otherwise behaves as an access port in
       its access VLAN. Everything that FORWARDS reads effMode; everything that
       GRADES configuration still reads p.mode, so a task that asks for
       "switchport mode access" is not satisfied by a port that merely acts like one. */
    function effMode(d,i){
      const p=d.ports[i];
      if(p.mode!=='dynamic') return p.mode;
      const c=portCable(d.id,i); if(!c) return 'access';
      const o=otherEnd(c,d.id), od=byId(o.d);
      return od.type==='switch'&&od.ports[o.i].mode==='trunk' ? 'trunk' : 'access';
    }
    function modeName(m){ return m==='dynamic'?'dynamic auto':m; }
    function portStatus(d,i){          /* the Status column of show interfaces status */
      const p=d.ports[i];
      if(p.ps.errd) return 'err-disabled';
      if(p.shut||(p.ch>0&&d.pos[p.ch]&&d.pos[p.ch].shut)) return 'disabled';
      return portLinkUp(d,i)?'connected':'notconnect';
    }
    function fullIf(n){ return n.replace(/^Fa/,'FastEthernet').replace(/^Gi/,'GigabitEthernet').replace(/^Po/,'Port-channel'); }

    /* VLAN lists: null means "all" (the default on a trunk), otherwise a sorted array. */
    function vlanListHas(list,v){ return list==null||list.includes(v); }
    function parseVlanList(s){
      const out=new Set();
      for(const part of s.split(',')){
        const m=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if(!m) return null;
        const a=+m[1], b=m[2]?+m[2]:a;
        if(a<1||b>4094||a>b) return null;
        for(let v=a;v<=b;v++) out.add(v);
      }
      return [...out].sort((x,y)=>x-y);
    }
    function vlanListStr(list){
      if(list==null) return '1-4094';
      if(!list.length) return 'none';
      const out=[]; let a=list[0], b=a;
      for(let k=1;k<=list.length;k++){
        if(k<list.length&&list[k]===b+1){ b=list[k]; continue; }
        out.push(a===b?String(a):a+'-'+b);
        if(k<list.length){ a=b=list[k]; }
      }
      return out.join(',');
    }
    function normVlanList(list){ return list&&list.length===4094?null:list; }

    /* EtherChannel. A member bundles (P) only when it is up, its settings match its
       port-channel interface, and the far end is a member whose mode can negotiate
       with this one. Anything else leaves the link carrying nothing. */
    const CH_MODES=['on','active','passive','desirable','auto'];
    const CH_PROTO={on:'-', active:'LACP', passive:'LACP', desirable:'PAgP', auto:'PAgP'};
    function chModesOk(a,b){
      if(a==='on'||b==='on') return a===b;
      if(CH_PROTO[a]!==CH_PROTO[b]) return false;
      return CH_PROTO[a]==='LACP' ? (a==='active'||b==='active') : (a==='desirable'||b==='desirable');
    }
    function swCfgKey(p){ return p.mode==='access' ? 'a'+p.vlan : 't'+p.native+'|'+vlanListStr(p.allowed); }
    function chMismatch(d,i){ const p=d.ports[i], po=d.pos[p.ch]; return !!po&&swCfgKey(p)!==swCfgKey(po); }
    function chPeers(d,n){
      return new Set(d.ports.map((q,j)=>q.ch===n?portCable(d.id,j):null).filter(Boolean).map(c=>otherEnd(c,d.id).d));
    }
    function chLocal(d,i){ return !portLinkUp(d,i)?'D':chMismatch(d,i)?'s':null; }
    function chanState(d,i){           /* null (not a member) | 'P' | 'I' | 's' | 'D' */
      const p=d.ports[i]; if(!(p.ch>0)) return null;
      const loc=chLocal(d,i); if(loc) return loc;
      const o=otherEnd(portCable(d.id,i),d.id), od=byId(o.d);
      if(od.type!=='switch') return 'I';
      const op=od.ports[o.i];
      if(!(op.ch>0)||chLocal(od,o.i)||!chModesOk(p.chMode,op.chMode)) return 'I';
      if(chPeers(d,p.ch).size>1||chPeers(od,op.ch).size>1) return 'I';
      return 'P';
    }

    /* Port security. psAllows is the pure question ("would a frame from this MAC
       get through?") used by every reachability check; psFrame is the same
       decision with its side effects (learning, violations), and only traffic —
       a ping from the PC panel — calls it. Same split as the NAT lab's
       translations: configuration never creates a learned address. */
    function macOk(s){ return /^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i.test(s); }
    function macUp(s){ return s.toUpperCase(); }
    function psAllows(sw,i,mac){
      const ps=sw.ports[i].ps;
      if(!ps.on) return true;
      if(ps.errd) return false;
      return ps.macs.some(m=>m.mac===mac) || ps.macs.length<ps.max;
    }
    function psFrame(sw,i,mac){
      const p=sw.ports[i], ps=p.ps;
      if(!ps.on) return true;
      if(ps.errd) return false;
      ps.last=mac;
      if(ps.macs.some(m=>m.mac===mac)) return true;
      if(ps.macs.length<ps.max){ ps.macs.push({mac, type:ps.sticky?'sticky':'dynamic'}); return true; }
      if(ps.violation==='protect') return false;
      ps.count++;
      sw.log.push(`%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address ${macUp(mac)} on port ${fullIf(p.name)}.`);
      if(ps.violation==='shutdown'){
        ps.errd=true;
        ps.macs=ps.macs.filter(m=>m.type!=='dynamic');
        sw.log.push(`%PM-4-ERR_DISABLE: psecure-violation error detected on ${p.name}, putting ${p.name} in err-disable state`);
      }
      return false;
    }

    /* ═══ CLI ═════════════════════════════════════════════════════════════════ */
    function prompt_(d){
      const m=d.cm==='conf'?'(config)':d.cm==='if'?(d.cr?'(config-if-range)':'(config-if)'):d.cm==='svi'?'(config-if)':d.cm==='vlan'?'(config-vlan)':'';
      return d.name+m+'#';
    }
    /* Tab-completion keyword tree. The walker itself (LabShared.tabComplete)
       lives in lab-shared.js, shared with routing_game.html's own tree (IP
       routing commands rather than VLAN/trunk ones) over the same walker. */
    const PS_KW={maximum:{}, 'mac-address':{sticky:{}}, violation:{shutdown:{},restrict:{},protect:{}}};
    const KW={
      configure:{terminal:{}}, enable:{}, end:{}, exit:{}, clear:{'port-security':{all:{},dynamic:{},sticky:{},configured:{}}},
      show:{vlan:{brief:{}}, 'running-config':{}, 'spanning-tree':{},
            interfaces:{status:{}, trunk:{}}, etherchannel:{summary:{}},
            'port-security':{interface:{}, address:{}}, ip:{interface:{brief:{}}}},
      vlan:{}, name:{}, interface:{vlan:{}, range:{}, 'port-channel':{}},
      ip:{address:{}, 'default-gateway':{}},
      switchport:{mode:{access:{},trunk:{},dynamic:{auto:{}}}, access:{vlan:{}},
                  trunk:{native:{vlan:{}}, allowed:{vlan:{add:{},remove:{},except:{},all:{},none:{}}}},
                  'port-security':PS_KW},
      'channel-group':{},   /* no root "shutdown": it would make "sh" ambiguous with show */
      'spanning-tree':{vlan:{}},
      no:{vlan:{}, switchport:{access:{vlan:{}}, mode:{}, trunk:{native:{vlan:{}}, allowed:{vlan:{}}}, 'port-security':PS_KW},
          'channel-group':{}, ip:{address:{}, 'default-gateway':{}}, shutdown:{}, interface:{'port-channel':{}}},
    };
    /* Interface names are looked up on the device itself, so a switch with any
       set of ports works: "fa0/1", "f0/1", "FastEthernet0/1", "gi0/1". A bare
       "0/1" matches whichever port has that number. */
    function portKind(t){
      t=(t||'').toLowerCase();
      if(!t) return '';
      if('fastethernet'.startsWith(t)) return 'fa';
      if('gigabitethernet'.startsWith(t)) return 'gi';
      return null;
    }
    function portIdx(d,kind,slot,num){
      return d.ports.findIndex(function(p){
        const m=p.name.toLowerCase().match(/^([a-z]+)(\d+)\/(\d+)$/);
        return m&&+m[2]===slot&&+m[3]===num&&(!kind||m[1]===kind);
      });
    }
    function parseIf(s,d){
      const m=String(s).trim().toLowerCase().match(/^([a-z]*)\s*(\d+)\s*\/\s*(\d+)\s*$/);
      if(!m) return -1;
      const k=portKind(m[1]); if(k===null) return -1;
      return portIdx(d,k,+m[2],+m[3]);
    }
    /* "fa0/1 - 3", "fa0/1-2, fa0/4", "f0/1 - fa0/3" → port indices */
    function parseIfRange(s,d){
      const out=new Set();
      for(const part of String(s).split(',')){
        const m=part.trim().toLowerCase().match(/^([a-z]*)\s*(\d+)\s*\/\s*(\d+)(?:\s*-\s*(?:[a-z]*\s*\d+\s*\/\s*)?(\d+))?$/);
        if(!m) return null;
        const k=portKind(m[1]); if(k===null) return null;
        const a=+m[3], b=m[4]?+m[4]:a;
        if(a>b) return null;
        for(let n=a;n<=b;n++){ const i=portIdx(d,k,+m[2],n); if(i<0) return null; out.add(i); }
      }
      return out.size?[...out].sort((x,y)=>x-y):null;
    }
    function portSpan(d){ return d.ports[0].name+' to '+d.ports[d.ports.length-1].name; }
    /* "port-channel 1", "po1", "vlan10", "vl 10" → the number, when the keyword
       abbreviates `full` (at least minLen letters) */
    function parseNamedIf(s,full,minLen){
      const m=s.replace(/\s+/g,'').match(/^([a-z-]+)(\d+)$/);
      return m&&m[1].length>=minLen&&full.startsWith(m[1]) ? +m[2] : null;
    }
    function clearIf(d){ d.ci=null; d.cr=null; d.cpo=null; }
    function ifPortIdx(d){ return d.cr ? d.cr : d.ci!=null ? [d.ci] : []; }
    /* What a switchport command edits: the selected ports, or a port-channel and
       every one of its members — configuring the bundle carries to them all. */
    function ifTargets(d){
      if(d.cpo!=null){ const po=d.pos[d.cpo]; return po?[po,...d.ports.filter(p=>p.ch===d.cpo)]:[]; }
      return ifPortIdx(d).map(i=>d.ports[i]);
    }
    const NO_IF='% select an interface first (e.g. int fa0/1)';
    function newPo(n,from){
      return {name:'Po'+n, mode:from?from.mode:'access', vlan:from?from.vlan:1, native:from?from.native:1,
              allowed:from&&from.allowed?[...from.allowed]:null, shut:false};
    }

    function cli(d,line){
      const t=line.trim().replace(/\s+/g,' ');
      if(!t) return '';
      const w=t.toLowerCase().split(' ');
      const M=(tok,cand)=>tok&&cand.startsWith(tok);

      /* navigation */
      if(M(w[0],'enable')) { d.cm='exec'; return ''; }
      if(M(w[0],'configure')||(w[0]==='conf')){ d.cm='conf'; clearIf(d); return ''; }
      if(M(w[0],'end')){ d.cm='exec'; clearIf(d); d.cv=null; return ''; }
      if(M(w[0],'exit')){
        if(d.cm==='if'){ d.cm='conf'; clearIf(d); }
        else if(d.cm==='vlan'||d.cm==='svi'){ d.cm='conf'; d.cv=null; }
        else d.cm='exec';
        return '';
      }

      /* clear port-security — flushes secure addresses (the "clear" alone below
         only wipes the terminal) */
      if(M(w[0],'clear')&&w[1]&&w[1].length>=2&&M(w[1],'port-security')){
        const USAGE='% usage: clear port-security all|dynamic|sticky|configured [interface fa0/n]';
        const kind=['all','dynamic','sticky','configured'].find(k=>w[2]&&M(w[2],k));
        if(!kind) return USAGE;
        let idx=d.ports.map((_,i)=>i);
        if(w[3]){
          if(!M(w[3],'interface')) return USAGE;
          const i=parseIf(w.slice(4).join(' '),d);
          if(i<0) return USAGE;
          idx=[i];
        }
        const type={dynamic:'dynamic',sticky:'sticky',configured:'static'}[kind];
        idx.forEach(i=>{ const ps=d.ports[i].ps; ps.macs=kind==='all'?[]:ps.macs.filter(m=>m.type!==type); });
        return '';
      }

      /* clear the terminal display (config untouched) */
      if(w[0]==='cls'||M(w[0],'clear')){
        d.log.length=0;
        return '';
      }

      if(M(w[0],'show')||w[0]==='sh') return swShow(d,w,M);

      /* vlan creation & config-vlan mode */
      if(M(w[0],'vlan')){
        if(!(w[1]&&/^\d+$/.test(w[1]))) return '% usage: vlan <n>';
        d.vlans.add(+w[1]);
        d.cv=+w[1]; d.cm='vlan';
        return '';
      }

      /* vlan naming (config-vlan mode) */
      if(M(w[0],'name')){
        if(d.cm!=='vlan'||d.cv==null)
          return '% name is only valid in VLAN config mode — enter "vlan <n>" first';
        const rawName=line.trim().replace(/\s+/g,' ').split(' ').slice(1).join(' ');
        if(!rawName) return '% usage: name <vlan-name>';
        d.vlanNames[d.cv]=rawName;
        return '';
      }

      /* interface selection: a port, a range of ports, a port-channel or an SVI */
      if(M(w[0],'interface')||w[0]==='int'){
        const rest=w.slice(1).join(' ');
        if(w[1]&&w[1].length>=2&&M(w[1],'range')){
          const idx=parseIfRange(w.slice(2).join(' '),d);
          if(!idx) return '% invalid range — e.g. "interface range fa0/1 - 3" (this switch has '+portSpan(d)+')';
          clearIf(d); d.cv=null; d.cr=idx; d.cm='if';
          return '';
        }
        const vn=parseNamedIf(rest,'vlan',1);
        if(vn!=null){
          d.cm='svi'; d.cv=vn; clearIf(d);
          return d.vlans.has(vn)?''
            :'% note: VLAN '+vn+' does not exist yet — create it or the SVI stays down';
        }
        const po=parseNamedIf(rest,'port-channel',2);
        if(po!=null){
          if(po<1||po>6) return '% port-channel number must be 1 to 6';
          if(!d.pos[po]) d.pos[po]=newPo(po,null);
          clearIf(d); d.cv=null; d.cpo=po; d.cm='if';
          return '';
        }
        const p=parseIf(rest,d);
        if(p<0) return '% invalid interface — this switch has '+portSpan(d)+' (or "interface vlan <n>", "interface port-channel <n>", "interface range ...")';
        clearIf(d); d.cv=null; d.ci=p; d.cm='if';
        return '';
      }

      /* management IP on an SVI, and the switch's own default gateway */
      if(w[0]==='ip'){
        if(w[1]&&M(w[1],'default-gateway')){
          if(!(w[2]&&isValidIP(w[2]))) return '% usage: ip default-gateway <a.b.c.d>';
          d.gw=w[2];
          return '';
        }
        if(d.cm!=='svi') return '% ip address is only valid on an SVI — enter "interface vlan <n>" first';
        if(w[1]&&M(w[1],'address')&&w[2]&&isValidIP(w[2])){
          if(w[3]&&w[3]!=='255.255.255.0') return '% this lab uses /24 subnets — the mask is 255.255.255.0';
          d.ip=w[2]; d.ipVlan=d.cv;
          if(world.onIpChange) world.onIpChange();   /* logs a conflict line into d.log itself if this creates a duplicate */
          return '';
        }
        return '% usage: ip address <a.b.c.d> 255.255.255.0';
      }

      if(w[0].length>=3&&M(w[0],'shutdown')) return swShutdown(d,true);

      /* no forms */
      if(w[0]==='no'){
        if(w[1]&&w[1].length>=3&&M(w[1],'shutdown')) return swShutdown(d,false);
        if(w[1]==='ip'&&w[2]&&M(w[2],'default-gateway')){ d.gw=null; return ''; }
        if(d.cm==='svi'&&w[1]==='ip'){ d.ip=null; d.ipVlan=null; return ''; }
        if(w[1]==='vlan'&&w[2]&&/^\d+$/.test(w[2])){
          const v=+w[2];
          if(v===1) return '%Default VLAN 1 may not be deleted.';
          d.vlans.delete(v); delete d.vlanNames[v];
          return '';
        }
        if(w[1]&&M(w[1],'interface')){
          const po=parseNamedIf(w.slice(2).join(' '),'port-channel',2);
          if(po==null) return '% only a port-channel interface can be removed';
          delete d.pos[po];
          d.ports.forEach(p=>{ if(p.ch===po){ p.ch=0; p.chMode=null; } });
          if(d.cpo===po){ clearIf(d); d.cm='conf'; }
          return '';
        }
        if(M(w[1],'channel-group')||w[1]==='channel'){
          const idx=ifPortIdx(d);
          if(!idx.length) return NO_IF;
          idx.forEach(i=>{ d.ports[i].ch=0; d.ports[i].chMode=null; });
          return '';
        }
        const T=ifTargets(d);
        if(!T.length) return NO_IF;
        if(M(w[1],'switchport')){
          if(w[2]&&w[2].length>=2&&M(w[2],'port-security')) return psNo(d,w.slice(3),M);
          if(w[2]&&M(w[2],'access')){ T.forEach(p=>p.vlan=1); return ''; }
          if(w[2]&&M(w[2],'mode')){ T.forEach(p=>p.mode=p.name.startsWith('Po')?'access':'dynamic'); return ''; }   /* back to the default */
          if(w[2]&&M(w[2],'trunk')&&w[3]&&M(w[3],'native')){ T.forEach(p=>p.native=1); return ''; }
          if(w[2]&&M(w[2],'trunk')&&w[3]&&M(w[3],'allowed')){ T.forEach(p=>p.allowed=null); return ''; }
        }
        return '% supported: no shutdown, no vlan <n>, no switchport access vlan, no switchport mode, no switchport trunk native|allowed vlan, no switchport port-security ..., no channel-group, no interface port-channel <n>, no ip default-gateway';
      }

      if(M(w[0],'switchport')||w[0]==='sw') return swSwitchport(d,w,M);

      /* spanning-tree priority configuration */
      if(M(w[0],'spanning-tree')||w[0]==='span'){
        if(!(w[1]&&M(w[1],'vlan')))
          return '% usage: spanning-tree vlan <n> priority <val> | spanning-tree vlan <n> root primary|secondary';
        if(!(w[2]&&/^\d+$/.test(w[2])))
          return '% usage: spanning-tree vlan <n> priority <val> | spanning-tree vlan <n> root primary|secondary';
        if(w[3]&&M(w[3],'priority')){
          const val=+w[4];
          if(!(w[4]&&/^\d+$/.test(w[4])&&val>=0&&val<=61440&&val%4096===0))
            return '% priority must be a multiple of 4096 between 0 and 61440 (e.g. 4096, 24576, 32768)';
          d.priority=val;
          d.priLabel = val===24576?'root primary':val===28672?'root secondary':val===32768?'default':null;
          return '';
        }
        if(w[3]&&M(w[3],'root')){
          if(w[4]&&M(w[4],'primary')){ d.priority=24576; d.priLabel='root primary'; return ''; }
          if(w[4]&&M(w[4],'secondary')){ d.priority=28672; d.priLabel='root secondary'; return ''; }
          return '% usage: spanning-tree vlan <n> root primary|secondary';
        }
        return '% usage: spanning-tree vlan <n> priority <val> | spanning-tree vlan <n> root primary|secondary';
      }

      if(M(w[0],'channel-group')||w[0]==='channel'||w[0]==='ch') return swChannelGroup(d,w,M);

      return '% unknown command: '+t;
    }

    /* shutdown / no shutdown. Shutting a port is also how an err-disabled one is
       recovered: the shut clears the err-disabled state and the no shut brings it
       back. A plain "no shutdown" on an err-disabled port does nothing, as on IOS. */
    function swShutdown(d,on){
      if(d.cm==='svi'){ d.sviShut=on; return ''; }
      if(d.cpo!=null){ d.pos[d.cpo].shut=on; return ''; }
      const idx=ifPortIdx(d);
      if(!idx.length) return NO_IF;
      idx.forEach(i=>{
        const p=d.ports[i];
        p.shut=on;
        if(on){ p.ps.errd=false; p.ps.macs=p.ps.macs.filter(m=>m.type!=='dynamic'); }
      });
      return '';
    }

    function swSwitchport(d,w,M){
      const T=ifTargets(d);
      if(!T.length) return NO_IF;
      if(w[1]&&w[1].length>=2&&M(w[1],'port-security')) return psCmd(d,w.slice(2),M);
      if(w[1]&&M(w[1],'mode')){
        let mode=w[2]&&M(w[2],'access')?'access':w[2]&&M(w[2],'trunk')?'trunk':null;
        if(w[2]&&M(w[2],'dynamic')){
          if(w[3]&&M(w[3],'desirable')) return '% this lab models dynamic auto, the IOS default — "switchport mode dynamic auto"';
          mode='dynamic';
        }
        if(!mode) return '% usage: switchport mode access | trunk | dynamic auto';
        if(mode==='trunk'){
          const sec=T.find(p=>p.ps&&p.ps.on);
          if(sec) return `% Command rejected: ${sec.name} has port security enabled — "no switchport port-security" before making it a trunk`;
        }
        T.forEach(p=>p.mode=mode);
        return '';
      }
      if(w[1]&&M(w[1],'access')){
        if(w[2]&&M(w[2],'vlan')&&w[3]&&/^\d+$/.test(w[3])){
          const vn=+w[3];
          if(!d.vlans.has(vn))
            return '% VLAN '+vn+' does not exist. Create it first: "vlan '+vn+'" (then "name <name>")';
          T.forEach(p=>p.vlan=vn);
          return T.some(p=>p.mode!=='access')?'% note: port is not in access mode yet':'';
        }
        return '% usage: switchport access vlan <n>';
      }
      if(w[1]&&M(w[1],'trunk')){
        if(w[2]&&M(w[2],'native')){
          if(w[3]&&M(w[3],'vlan')&&w[4]&&/^\d+$/.test(w[4])){
            const nv=+w[4];
            if(nv<1||nv>4094) return '% native VLAN must be between 1 and 4094';
            T.forEach(p=>p.native=nv);
            return '';
          }
          return '% usage: switchport trunk native vlan <n>';
        }
        if(w[2]&&M(w[2],'allowed')&&w[3]&&M(w[3],'vlan')) return swAllowed(T,w.slice(4),M);
        return '% usage: switchport trunk native vlan <n> | switchport trunk allowed vlan <list>';
      }
      return '% usage: switchport mode ... | switchport access vlan <n> | switchport trunk ... | switchport port-security ...';
    }

    /* switchport trunk allowed vlan <list> | add | remove | except | all | none.
       A bare list REPLACES the allowed list; add/remove edit it. */
    function swAllowed(T,args,M){
      const USAGE='% usage: switchport trunk allowed vlan <list> | add <list> | remove <list> | except <list> | all | none';
      if(!args.length) return USAGE;
      if(args[0]==='all'){ T.forEach(p=>p.allowed=null); return ''; }
      if(args[0]==='none'){ T.forEach(p=>p.allowed=[]); return ''; }
      let op='set', rest=args;
      if(args[0].length>=2&&M(args[0],'add')) op='add';
      else if(M(args[0],'remove')) op='remove';
      else if(M(args[0],'except')) op='except';
      if(op!=='set') rest=args.slice(1);
      const list=parseVlanList(rest.join(' '));
      if(!list) return USAGE;
      const ALL=()=>Array.from({length:4094},(_,k)=>k+1);
      T.forEach(p=>{
        let next;
        if(op==='set') next=list;
        else if(op==='add') next=p.allowed==null?null:[...new Set([...p.allowed,...list])].sort((a,b)=>a-b);
        else if(op==='remove') next=(p.allowed==null?ALL():p.allowed).filter(v=>!list.includes(v));
        else next=ALL().filter(v=>!list.includes(v));
        p.allowed=normVlanList(next);
      });
      return '';
    }

    function swChannelGroup(d,w,M){
      const USAGE='% usage: channel-group <1-6> mode active|passive|desirable|auto|on';
      const idx=ifPortIdx(d);
      if(!idx.length) return d.cpo!=null?'% channel-group goes on the member ports, not on the port-channel itself':NO_IF;
      if(!(w[1]&&/^\d+$/.test(w[1]))) return USAGE;
      const n=+w[1];
      if(n<1||n>6) return USAGE;
      if(!(w[2]&&M(w[2],'mode')&&w[3])) return USAGE;
      const hits=CH_MODES.filter(m=>M(w[3],m));
      if(hits.length!==1) return USAGE;
      const mode=hits[0];
      const clash=d.ports.find((q,j)=>q.ch===n&&!idx.includes(j)&&CH_PROTO[q.chMode]!==CH_PROTO[mode]);
      if(clash)
        return `% Command rejected: ${clash.name} is already in channel-group ${n} using ${clash.chMode==='on'?'mode on':CH_PROTO[clash.chMode]} — every member of a group uses the same protocol`;
      let out='';
      if(!d.pos[n]){
        d.pos[n]=newPo(n,d.ports[idx[0]]);   /* the first member's settings become the bundle's */
        out='Creating a port-channel interface Port-channel '+n;
      }
      idx.forEach(i=>{ d.ports[i].ch=n; d.ports[i].chMode=mode; });
      return out;
    }

    /* ── port security ── */
    const PS_USAGE='% usage: switchport port-security [maximum <n> | mac-address sticky | mac-address [sticky] <H.H.H> | violation shutdown|restrict|protect]';
    function psCmd(d,args,M){
      const idx=ifPortIdx(d);
      if(!idx.length) return d.cpo!=null?'% port security is set on the physical ports, not on a port-channel':NO_IF;
      const tr=idx.find(i=>d.ports[i].mode!=='access');
      if(tr!=null) return `% Command rejected: ${d.ports[tr].name} is a ${d.ports[tr].mode==='dynamic'?'dynamic':'trunk'} port — port security needs "switchport mode access"`;
      const P=idx.map(i=>d.ports[i]);
      if(!args.length){ P.forEach(p=>p.ps.on=true); return ''; }
      if(M(args[0],'maximum')){
        const n=+args[1];
        if(!(args[1]&&/^\d+$/.test(args[1])&&n>=1&&n<=132)) return '% usage: switchport port-security maximum <1-132>';
        const over=P.find(p=>p.ps.macs.length>n);
        if(over) return `% ${over.name} already holds ${over.ps.macs.length} secure addresses — remove some before lowering the maximum`;
        P.forEach(p=>p.ps.max=n);
        return '';
      }
      if(M(args[0],'mac-address')){
        const sticky=!!(args[1]&&M(args[1],'sticky'));
        const macArg=sticky?args[2]:args[1];
        if(!macArg){
          if(!sticky) return PS_USAGE;
          P.forEach(p=>{ p.ps.sticky=true; p.ps.macs.forEach(m=>{ if(m.type==='dynamic') m.type='sticky'; }); });
          return '';
        }
        if(P.length>1) return '% a secure MAC address belongs to one port — select a single interface';
        if(!macOk(macArg)) return '% invalid MAC address — use the dotted form, e.g. 0001.6450.2A0B';
        const mac=macArg.toLowerCase(), p=P[0];
        const ex=p.ps.macs.find(m=>m.mac===mac);
        if(ex){ ex.type=sticky?'sticky':'static'; return ''; }
        const other=d.ports.find(q=>q!==p&&q.ps.macs.some(m=>m.mac===mac));
        if(other) return `% ${macUp(mac)} is already secured on ${other.name}`;
        if(p.ps.macs.length>=p.ps.max) return `% Total secure mac-addresses on ${fullIf(p.name)} has reached maximum limit.`;
        p.ps.macs.push({mac, type:sticky?'sticky':'static'});
        return '';
      }
      if(M(args[0],'violation')){
        const v=['shutdown','restrict','protect'].find(x=>args[1]&&M(args[1],x));
        if(!v) return '% usage: switchport port-security violation shutdown|restrict|protect';
        P.forEach(p=>p.ps.violation=v);
        return '';
      }
      return PS_USAGE;
    }
    function psNo(d,args,M){
      const idx=ifPortIdx(d);
      if(!idx.length) return NO_IF;
      const P=idx.map(i=>d.ports[i]);
      if(!args.length){ P.forEach(p=>p.ps.on=false); return ''; }
      if(M(args[0],'maximum')){
        const over=P.find(p=>p.ps.macs.length>1);
        if(over) return `% ${over.name} holds ${over.ps.macs.length} secure addresses — remove some before going back to a maximum of 1`;
        P.forEach(p=>p.ps.max=1);
        return '';
      }
      if(M(args[0],'violation')){ P.forEach(p=>p.ps.violation='shutdown'); return ''; }
      if(M(args[0],'mac-address')){
        const sticky=!!(args[1]&&M(args[1],'sticky'));
        const macArg=sticky?args[2]:args[1];
        if(!macArg){
          if(!sticky) return PS_USAGE;
          P.forEach(p=>{ p.ps.sticky=false; p.ps.macs.forEach(m=>{ if(m.type==='sticky') m.type='dynamic'; }); });
          return '';
        }
        if(!macOk(macArg)) return '% invalid MAC address — use the dotted form, e.g. 0001.6450.2A0B';
        const mac=macArg.toLowerCase();
        for(const p of P){
          const ex=p.ps.macs.find(m=>m.mac===mac);
          if(!ex) continue;
          if(ex.type==='sticky'&&!sticky)
            return `% ${macUp(mac)} is a sticky address — remove it with "no switchport port-security mac-address sticky ${macUp(mac)}"`;
          if(ex.type!=='sticky'&&sticky)
            return `% ${macUp(mac)} is not a sticky address — remove it with "no switchport port-security mac-address ${macUp(mac)}"`;
          p.ps.macs=p.ps.macs.filter(m=>m!==ex);
          return '';
        }
        return `% ${macUp(mac)} is not a secure address on this port`;
      }
      return PS_USAGE;
    }

    /* ═══ show commands ═══════════════════════════════════════════════════════ */
    function swShow(d,w,M){
      const a=w[1]||'';
      if(a&&M(a,'vlan')){
        const map={};
        d.ports.forEach((p,i)=>{ if(effMode(d,i)==='access'){ (map[p.vlan]=map[p.vlan]||[]).push(p.name);} });
        const vl=[...new Set([...d.vlans,...(world.strictVlans?[]:Object.keys(map).map(Number))])].sort((a,b)=>a-b);
        let out='VLAN  Name              Ports';
        vl.forEach(v=>{
          out+='\n'+String(v).padEnd(6)+vlanName(d,v).padEnd(18)+(map[v]?map[v].join(', '):'');
        });
        return out;
      }
      if(a&&(M(a,'spanning-tree')||a==='span')){
        const sws=world.devices().filter(x=>x.type==='switch');
        if(sws.length<2) return '% spanning-tree needs at least two switches in the topology';
        const stp=computeSTP();
        const isRoot=stp.root===d;
        let out=isRoot
          ? `VLAN0001\n  This bridge is the root\n  Bridge ID  Priority ${d.priority}  Address ${d.mac}\n`
          : `VLAN0001\n  Root ID    Priority ${stp.root.priority}  Address ${stp.root.mac}\n  Bridge ID  Priority ${d.priority}  Address ${d.mac}\n`;
        out += 'Interface        Role  Sts  Cost\n';
        d.ports.forEach((p,i)=>{
          const c=portCable(d.id,i); if(!c) return;
          const other=byId(otherEnd(c,d.id).d);
          let role, sts;
          if(other.type!=='switch'){ role='DESG'; sts='FWD'; }
          else if(isRoot){ role='DESG'; sts='FWD'; }
          else if(stp.rootLink[d.id]===c.id){ role='ROOT'; sts='FWD'; }
          else if(stp.blocked.some(b=>b.end.d===d.id&&b.end.i===i)){ role='ALTN'; sts='BLK'; }
          else { role='DESG'; sts='FWD'; }
          out+=`${p.name.padEnd(16)} ${role.padEnd(5)} ${sts.padEnd(4)} 19\n`;
        });
        return out.trimEnd();
      }
      if(a&&(M(a,'running-config')||M(a,'run'))) return swShowRun(d);
      if(a==='ip'&&w[2]&&M(w[2],'interface')) return swShowIpBrief(d);
      if(a.length>=2&&M(a,'interfaces')) return swShowInterfaces(d,w.slice(2),M);
      if(a.length>=2&&M(a,'etherchannel')) return swShowEther(d);
      if(a.length>=2&&M(a,'port-security')) return swShowPsec(d,w.slice(2),M);
      return '% supported: show vlan brief, show interfaces status | trunk | fa0/n [switchport], show etherchannel summary, show port-security [interface fa0/n | address], show ip interface brief, show spanning-tree, show run';
    }
    function vlanName(d,v){ return d.vlanNames[v]||(v===1?'default':'VLAN'+String(v).padStart(4,'0')); }
    function swIfCfgLines(p){
      const L=[];
      if(p.mode!=='trunk'&&p.vlan!==1) L.push(' switchport access vlan '+p.vlan);
      if(p.native!==1) L.push(' switchport trunk native vlan '+p.native);
      if(p.allowed!=null) L.push(' switchport trunk allowed vlan '+vlanListStr(p.allowed));
      if(p.mode!=='dynamic') L.push(' switchport mode '+p.mode);   /* dynamic auto is the default: IOS prints nothing */
      return L;
    }
    function swShowRun(d){
      const L=[];
      Object.keys(d.pos).map(Number).sort((a,b)=>a-b).forEach(n=>{
        const po=d.pos[n];
        L.push('interface Port-channel'+n, ...swIfCfgLines(po));
        if(po.shut) L.push(' shutdown');
        L.push('!');
      });
      d.ports.forEach(p=>{
        const ps=p.ps;
        L.push('interface '+fullIf(p.name), ...swIfCfgLines(p));
        if(ps.on) L.push(' switchport port-security');
        if(ps.max!==1) L.push(' switchport port-security maximum '+ps.max);
        if(ps.sticky) L.push(' switchport port-security mac-address sticky');
        ps.macs.filter(m=>m.type==='sticky').forEach(m=>L.push(' switchport port-security mac-address sticky '+macUp(m.mac)));
        ps.macs.filter(m=>m.type==='static').forEach(m=>L.push(' switchport port-security mac-address '+macUp(m.mac)));
        if(ps.violation!=='shutdown') L.push(' switchport port-security violation '+ps.violation);
        if(p.ch>0) L.push(' channel-group '+p.ch+' mode '+p.chMode);
        if(p.shut) L.push(' shutdown');
        L.push('!');
      });
      if(d.ipVlan!=null){
        L.push('interface Vlan'+d.ipVlan);
        if(d.ip) L.push(' ip address '+d.ip+' 255.255.255.0');
        if(d.sviShut) L.push(' shutdown');
        L.push('!');
      }
      if(d.gw) L.push('ip default-gateway '+d.gw);
      return L.join('\n');
    }
    /* The SVI is up/up only when it isn't shut, its VLAN exists, and some up port
       carries that VLAN — the same three things show ip interface brief reports. */
    function sviState(d){
      if(d.ipVlan==null) return null;
      if(d.sviShut) return 'admin';
      const v=d.ipVlan;
      if(!d.vlans.has(v)) return 'down';
      const carried=d.ports.some((p,i)=>portLinkUp(d,i)&&(!(p.ch>0)||chanState(d,i)==='P')
        &&(effMode(d,i)==='access'?p.vlan===v:vlanListHas(p.allowed,v)));
      return carried?'up':'updown';
    }
    function sviUp(d){ return sviState(d)==='up'; }
    function poUp(d,n){ return !d.pos[n].shut&&d.ports.some((p,i)=>p.ch===n&&chanState(d,i)==='P'); }
    function swShowIpBrief(d){
      const row=(n,ip,st,pr)=>n.padEnd(23)+ip.padEnd(16)+'YES '+(ip==='unassigned'?'unset  ':'manual ')+st.padEnd(22)+pr;
      const L=['Interface              IP-Address      OK? Method Status                Protocol'];
      Object.keys(d.pos).map(Number).sort((a,b)=>a-b).forEach(n=>{
        const up=poUp(d,n);
        L.push(row('Port-channel'+n,'unassigned',d.pos[n].shut?'administratively down':up?'up':'down',up?'up':'down'));
      });
      d.ports.forEach((p,i)=>{
        const st=portStatus(d,i);
        L.push(row(fullIf(p.name),'unassigned',st==='disabled'?'administratively down':st==='connected'?'up':'down',st==='connected'?'up':'down'));
      });
      const sv=sviState(d);
      if(sv) L.push(row('Vlan'+d.ipVlan,d.ip||'unassigned',sv==='admin'?'administratively down':sv==='down'?'down':'up',sv==='up'?'up':'down'));
      return L.join('\n');
    }
    function swShowInterfaces(d,args,M){
      const poNums=Object.keys(d.pos).map(Number).sort((a,b)=>a-b);
      if(args[0]&&args[0].length>=2&&M(args[0],'status')){
        const L=['Port      Name               Status       Vlan       Duplex  Speed Type'];
        const row=(n,st,vl,ty)=>n.padEnd(10)+''.padEnd(19)+st.padEnd(13)+vl.padEnd(11)+'auto    auto  '+ty;
        poNums.forEach(n=>{
          const po=d.pos[n];
          L.push(row('Po'+n, po.shut?'disabled':poUp(d,n)?'connected':'notconnect', po.mode==='trunk'?'trunk':String(po.vlan), ''));
        });
        d.ports.forEach((p,i)=>L.push(row(p.name, portStatus(d,i), effMode(d,i)==='trunk'?'trunk':String(p.vlan), '10/100BaseTX')));
        return L.join('\n');
      }
      if(args[0]&&M(args[0],'trunk')) return swShowTrunk(d);
      let toks=args.slice();
      const sw=!!(toks.length&&toks[toks.length-1].length>=2&&M(toks[toks.length-1],'switchport'));
      if(sw) toks=toks.slice(0,-1);
      if(!toks.length) return d.ports.map((p,i)=>swIfLine(p.name,portStatus(d,i))).join('\n');
      const s=toks.join(' ');
      const po=parseNamedIf(s,'port-channel',2);
      if(po!=null){
        if(!d.pos[po]) return '% Port-channel'+po+' does not exist';
        const st=d.pos[po].shut?'disabled':poUp(d,po)?'connected':'notconnect';
        return sw ? swSwitchportDetail(d,d.pos[po],st,null) : swIfLine('Po'+po,st);
      }
      const i=parseIf(s,d);
      if(i<0) return '% invalid interface — '+portSpan(d)+' or a configured port-channel';
      const p=d.ports[i], st=portStatus(d,i);
      if(sw) return swSwitchportDetail(d,p,st,p.ch>0&&chanState(d,i)==='P'?p.ch:null,i);
      return swIfLine(p.name,st)+(p.ch>0?'\n  Member of Port-channel'+p.ch+' (flag '+chanState(d,i)+')':'');
    }
    function swIfLine(name,st){
      const s={connected:'up, line protocol is up', notconnect:'down, line protocol is down',
               disabled:'administratively down, line protocol is down', 'err-disabled':'down, line protocol is down'}[st];
      return fullIf(name)+' is '+s+' ('+st+')';
    }
    function swSwitchportDetail(d,p,st,bundle,i){
      const up=st==='connected';
      const eff=i!=null?effMode(d,i):p.mode;
      const op=!up?'down':(eff==='trunk'?'trunk':'static access')+(bundle?' (member of bundle Po'+bundle+')':'');
      return ['Name: '+p.name,
        'Switchport: Enabled',
        'Administrative Mode: '+(p.mode==='trunk'?'trunk':p.mode==='dynamic'?'dynamic auto':'static access'),
        'Operational Mode: '+op,
        'Administrative Trunking Encapsulation: dot1q',
        'Operational Trunking Encapsulation: '+(up&&eff==='trunk'?'dot1q':'native'),
        'Negotiation of Trunking: '+(p.mode==='dynamic'?'On':'Off'),
        'Access Mode VLAN: '+p.vlan+' ('+vlanName(d,p.vlan)+')',
        'Trunking Native Mode VLAN: '+p.native+' ('+vlanName(d,p.native)+')',
        'Trunking VLANs Enabled: '+(p.allowed==null?'ALL':vlanListStr(p.allowed).toUpperCase())].join('\n');
    }
    function swShowTrunk(d){
      /* a bundle trunks as its port-channel, so its members appear only as Po<n> */
      const rows=[];
      Object.keys(d.pos).map(Number).sort((a,b)=>a-b).forEach(n=>{
        if(d.pos[n].mode==='trunk'&&poUp(d,n)) rows.push(d.pos[n]);
      });
      d.ports.forEach((p,i)=>{ if(effMode(d,i)==='trunk'&&!(p.ch>0)&&portLinkUp(d,i)) rows.push(p); });
      if(!rows.length) return '';
      const act=p=>vlanListStr((p.allowed==null?[...d.vlans]:p.allowed.filter(v=>d.vlans.has(v))).sort((a,b)=>a-b));
      const L=['Port        Mode         Encapsulation  Status        Native vlan'];
      rows.forEach(p=>L.push(p.name.padEnd(12)+'on'.padEnd(13)+'802.1q'.padEnd(15)+'trunking'.padEnd(14)+p.native));
      L.push('','Port        Vlans allowed on trunk');
      rows.forEach(p=>L.push(p.name.padEnd(12)+vlanListStr(p.allowed)));
      L.push('','Port        Vlans allowed and active in management domain');
      rows.forEach(p=>L.push(p.name.padEnd(12)+act(p)));
      L.push('','Port        Vlans in spanning tree forwarding state and not pruned');
      rows.forEach(p=>L.push(p.name.padEnd(12)+act(p)));
      return L.join('\n');
    }
    function swShowEther(d){
      const ns=Object.keys(d.pos).map(Number).sort((a,b)=>a-b);
      const L=['Flags:  D - down        P - bundled in port-channel',
               '        I - stand-alone s - suspended',
               '        S - Layer2      U - in use',
               'Number of channel-groups in use: '+ns.length,
               'Number of aggregators:           '+ns.length,
               '',
               'Group  Port-channel  Protocol    Ports',
               '------+-------------+-----------+----------------------'];
      ns.forEach(n=>{
        const mem=d.ports.map((p,i)=>({p,i})).filter(x=>x.p.ch===n);
        const proto=mem.length?CH_PROTO[mem[0].p.chMode]:'-';
        L.push(String(n).padEnd(7)+('Po'+n+'(S'+(poUp(d,n)?'U':'D')+')').padEnd(14)+proto.padEnd(12)
          +mem.map(x=>x.p.name+'('+chanState(d,x.i)+')').join(' '));
      });
      return L.join('\n');
    }
    function swShowPsec(d,args,M){
      const ACTION={shutdown:'Shutdown',restrict:'Restrict',protect:'Protect'};
      const total=d.ports.reduce((n,p)=>n+(p.ps.on?Math.max(0,p.ps.macs.length-1):0),0);
      const foot=['Total Addresses in System (excluding one mac per port)     : '+total,
                  'Max Addresses limit in System (excluding one mac per port) : 1024'];
      if(args[0]&&M(args[0],'interface')){
        const i=parseIf(args.slice(1).join(' '),d);
        if(i<0) return '% usage: show port-security interface fa0/<n>';
        const p=d.ports[i], ps=p.ps;
        const status=!ps.on?'Secure-down':ps.errd?'Secure-shutdown':portLinkUp(d,i)?'Secure-up':'Secure-down';
        return ['Port Security              : '+(ps.on?'Enabled':'Disabled'),
          'Port Status                : '+status,
          'Violation Mode             : '+ACTION[ps.violation],
          'Aging Time                 : 0 mins',
          'Aging Type                 : Absolute',
          'SecureStatic Address Aging : Disabled',
          'Maximum MAC Addresses      : '+ps.max,
          'Total MAC Addresses        : '+ps.macs.length,
          'Configured MAC Addresses   : '+ps.macs.filter(m=>m.type==='static').length,
          'Sticky MAC Addresses       : '+ps.macs.filter(m=>m.type==='sticky').length,
          'Last Source Address:Vlan   : '+(ps.last?macUp(ps.last)+':'+p.vlan:'0000.0000.0000:0'),
          'Security Violation Count   : '+ps.count].join('\n');
      }
      if(args[0]&&M(args[0],'address')){
        const TYPE={static:'SecureConfigured',sticky:'SecureSticky',dynamic:'SecureDynamic'};
        const L=['          Secure Mac Address Table',
                 '-----------------------------------------------------------',
                 'Vlan    Mac Address       Type              Ports   Remaining Age',
                 '----    -----------       ----              -----   -------------'];
        d.ports.forEach(p=>{ if(p.ps.on) p.ps.macs.forEach(m=>
          L.push(String(p.vlan).padStart(4)+'    '+macUp(m.mac).padEnd(18)+TYPE[m.type].padEnd(18)+p.name.padEnd(8)+'    -')); });
        L.push('-----------------------------------------------------------',...foot);
        return L.join('\n');
      }
      const L=['Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action',
               '                (Count)       (Count)          (Count)',
               '---------------------------------------------------------------------------'];
      d.ports.forEach(p=>{ if(p.ps.on)
        L.push(p.name.padStart(10)+String(p.ps.max).padStart(15)+String(p.ps.macs.length).padStart(13)
          +String(p.ps.count).padStart(19)+'         '+ACTION[p.ps.violation]); });
      L.push('---------------------------------------------------------------------------',...foot);
      return L.join('\n');
    }

    /* ═══ Reachability ════════════════════════════════════════════════════════ */
    function pcUplink(pc){
      const c=portCable(pc.id,0);
      if(!c) return null;
      const o=otherEnd(c,pc.id);
      const sw=byId(o.d);
      if(sw.type!=='switch') return null;
      return {sw, port:sw.ports[o.i], i:o.i};
    }
    /* A PC's frames reach its switch: an up access port that port security lets
       this PC's MAC through (pure — learning only happens on real traffic). */
    function pcPortOk(up,pc){
      return effMode(up.sw,up.i)==='access' && portLinkUp(up.sw,up.i) && vlanOn(up.sw,up.port.vlan) && psAllows(up.sw,up.i,pc.mac);
    }

    /* VLAN `vlan` crosses this switch-to-switch cable when both ends are up, a
       bundle (if any) has formed, and either both ends are access ports in that
       VLAN or both are trunks that allow it. A native VLAN mismatch strands the
       two natives — their untagged frames land in the wrong VLAN at the far end —
       while every tagged VLAN still crosses. */
    /* With world.strictVlans a switch only carries a VLAN that exists in its
       own VLAN database — as on IOS, where a deleted VLAN takes its access
       ports inactive and a transit switch drops frames for VLANs it does not
       have. The switching lab leaves it off: its scenarios only ask for each
       VLAN on the switches that carry its PCs. */
    function vlanOn(sw,v){ return !world.strictVlans||sw.vlans.has(v); }
    function linkPasses(c,vlan){
      const A=byId(c.a.d), B=byId(c.b.d);
      if(A.type!=='switch'||B.type!=='switch') return false;
      if(!vlanOn(A,vlan)||!vlanOn(B,vlan)) return false;
      if(!portLinkUp(A,c.a.i)) return false;
      const pa=A.ports[c.a.i], pb=B.ports[c.b.i];
      if((pa.ch>0||pb.ch>0)&&(chanState(A,c.a.i)!=='P'||chanState(B,c.b.i)!=='P')) return false;
      const ma=effMode(A,c.a.i), mb=effMode(B,c.b.i);
      if(ma==='trunk'&&mb==='trunk'){
        if(!vlanListHas(pa.allowed,vlan)||!vlanListHas(pb.allowed,vlan)) return false;
        if(pa.native!==pb.native&&(vlan===pa.native||vlan===pb.native)) return false;
        return true;
      }
      if(ma==='access'&&mb==='access'&&pa.vlan===vlan&&pb.vlan===vlan) return true;
      return false;
    }

    function l2SwitchReach(fromSw,vlan,toSw){
      const seen=new Set([fromSw.id]);
      const queue=[fromSw.id];
      while(queue.length){
        const cur=queue.shift();
        if(cur===toSw.id) return true;
        world.cables().forEach(c=>{
          if(c.a.d!==cur&&c.b.d!==cur) return;
          if(!linkPasses(c,vlan)) return;
          const nxt=c.a.d===cur?c.b.d:c.a.d;
          if(!seen.has(nxt)){ seen.add(nxt); queue.push(nxt); }
        });
      }
      return false;
    }
    function reach(pcA,pcB){
      const upA=pcUplink(pcA), upB=pcUplink(pcB);
      if(!upA||!upB) return false;
      if(!pcPortOk(upA,pcA)||!pcPortOk(upB,pcB)) return false;
      if(upA.port.vlan!==upB.port.vlan) return false;
      return l2SwitchReach(upA.sw,upA.port.vlan,upB.sw);
    }

    /* ═══ STP computation ═════════════════════════════════════════════════════ */
    function bid(d){ return [d.priority, d.mac]; }
    function bidLess(a,b){ return a.priority!==b.priority ? a.priority<b.priority : a.mac<b.mac; }

    function computeSTP(){
      const sws=world.devices().filter(d=>d.type==='switch');
      if(sws.length<2) return null;
      const root=sws.reduce((r,s)=>bidLess(s,r)?s:r);
      /* Dijkstra: cost 19 per link */
      const dist={}; sws.forEach(s=>dist[s.id]=Infinity); dist[root.id]=0;
      const todo=[...sws];
      while(todo.length){
        todo.sort((a,b)=>dist[a.id]-dist[b.id]);
        const cur=todo.shift();
        if(dist[cur.id]===Infinity) break;
        world.cables().forEach(c=>{
          const A=byId(c.a.d),B=byId(c.b.d);
          if(A.type!=='switch'||B.type!=='switch')return;
          let nb=null;
          if(A===cur)nb=B; else if(B===cur)nb=A;
          if(!nb)return;
          if(dist[cur.id]+19<dist[nb.id]) dist[nb.id]=dist[cur.id]+19;
        });
      }
      /* root port per non-root switch */
      const rootLink={};
      sws.forEach(s=>{
        if(s===root) return;
        let best=null;
        world.cables().forEach(c=>{
          const A=byId(c.a.d),B=byId(c.b.d);
          if(A.type!=='switch'||B.type!=='switch')return;
          let nb=null,myEnd=null;
          if(A===s){nb=B;myEnd=c.a;} else if(B===s){nb=A;myEnd=c.b;}
          if(!nb)return;
          const cost=dist[nb.id]+19;
          if(!best||cost<best.cost||(cost===best.cost&&bidLess(nb,best.nb)))
            best={cable:c,cost,nb,myEnd};
        });
        if(best) rootLink[s.id]=best.cable.id;
      });
      /* blocked ports: non-tree segments */
      const blocked=[];
      world.cables().forEach(c=>{
        const A=byId(c.a.d),B=byId(c.b.d);
        if(A.type!=='switch'||B.type!=='switch')return;
        if(rootLink[A.id]===c.id||rootLink[B.id]===c.id)return;
        if(A===root||B===root)return; /* root's segments are all designated + other end is root port normally; but if redundant direct link to root existed it'd be root port anyway */
        /* designated end = lower (dist, bid); other end blocks */
        let des, blk;
        if(dist[A.id]!==dist[B.id]) { des = dist[A.id]<dist[B.id]?c.a:c.b; }
        else des = bidLess(A,B)?c.a:c.b;
        blk = des===c.a?c.b:c.a;
        blocked.push({cable:c, end:blk});
      });
      return {root, dist, rootLink, blocked};
    }


    return {newPort:newPort, newSwitchState:newSwitchState, vlanOn:vlanOn,
      psNew:psNew,
      portUp:portUp,
      portLinkUp:portLinkUp,
      effMode:effMode,
      modeName:modeName,
      portStatus:portStatus,
      fullIf:fullIf,
      vlanListHas:vlanListHas,
      parseVlanList:parseVlanList,
      vlanListStr:vlanListStr,
      normVlanList:normVlanList,
      chModesOk:chModesOk,
      swCfgKey:swCfgKey,
      chMismatch:chMismatch,
      chPeers:chPeers,
      chLocal:chLocal,
      chanState:chanState,
      macOk:macOk,
      macUp:macUp,
      psAllows:psAllows,
      psFrame:psFrame,
      prompt_:prompt_,
      portKind:portKind,
      portIdx:portIdx,
      parseIf:parseIf,
      parseIfRange:parseIfRange,
      portSpan:portSpan,
      parseNamedIf:parseNamedIf,
      clearIf:clearIf,
      ifPortIdx:ifPortIdx,
      ifTargets:ifTargets,
      newPo:newPo,
      cli:cli,
      swShutdown:swShutdown,
      swSwitchport:swSwitchport,
      swAllowed:swAllowed,
      swChannelGroup:swChannelGroup,
      psCmd:psCmd,
      psNo:psNo,
      swShow:swShow,
      vlanName:vlanName,
      swIfCfgLines:swIfCfgLines,
      swShowRun:swShowRun,
      sviState:sviState,
      sviUp:sviUp,
      poUp:poUp,
      swShowIpBrief:swShowIpBrief,
      swShowInterfaces:swShowInterfaces,
      swIfLine:swIfLine,
      swSwitchportDetail:swSwitchportDetail,
      swShowTrunk:swShowTrunk,
      swShowEther:swShowEther,
      swShowPsec:swShowPsec,
      pcUplink:pcUplink,
      pcPortOk:pcPortOk,
      linkPasses:linkPasses,
      l2SwitchReach:l2SwitchReach,
      reach:reach,
      bid:bid,
      bidLess:bidLess,
      computeSTP:computeSTP,
      CH_MODES:CH_MODES,
      CH_PROTO:CH_PROTO,
      PS_KW:PS_KW,
      KW:KW,
      NO_IF:NO_IF,
      PS_USAGE:PS_USAGE
    };
  }
  window.NetSwitch={create:create};
})(window);
