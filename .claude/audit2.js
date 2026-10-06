window.__cableAudit2=function(canvasSel){
  const cv=document.querySelector(canvasSel); if(!cv) return null;
  const C=cv.getBoundingClientRect();
  const rel=r=>({l:r.left-C.left, t:r.top-C.top, r:r.right-C.left, b:r.bottom-C.top});
  const devs=[...cv.querySelectorAll('.dev')].map(e=>({name:(e.querySelector('.dev-name')||e).textContent.trim().split(/\s/)[0], ...rel(e.getBoundingClientRect())}));
  const ports=[...cv.querySelectorAll('.port')].map(e=>{ const r=rel(e.getBoundingClientRect()); return {x:(r.l+r.r)/2, y:(r.t+r.b)/2, rad:(r.r-r.l)/2}; });
  const svg=cv.querySelector('svg'), S=rel(svg.getBoundingClientRect());
  const cabs=[...svg.querySelectorAll('.cable')].filter(el=>el.getTotalLength&&el.getTotalLength()>45).map(el=>{
    const L=el.getTotalLength(), pts=[]; for(let d=0; d<=L; d+=3){ const p=el.getPointAtLength(d); pts.push({x:p.x+S.l, y:p.y+S.t}); }
    const e=el.getPointAtLength(L); pts.push({x:e.x+S.l,y:e.y+S.t}); return {pts, len:L}; });
  const issues=[];
  const segX=(p1,p2,p3,p4)=>{ const o=(a,b,c)=>Math.sign((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)); return o(p1,p2,p3)*o(p1,p2,p4)<0&&o(p3,p4,p1)*o(p3,p4,p2)<0; };
  cabs.forEach((c,i)=>{
    const A=c.pts[0], B=c.pts[c.pts.length-1];
    const mid=c.pts.filter(p=>Math.hypot(p.x-A.x,p.y-A.y)>10&&Math.hypot(p.x-B.x,p.y-B.y)>10);
    devs.forEach(b=>{ const n=mid.filter(p=>p.x>b.l+2&&p.x<b.r-2&&p.y>b.t+2&&p.y<b.b-2).length; if(n*3>12) issues.push('through box '+b.name+' ('+n*3+'px)'); });
    ports.forEach(p=>{ const own=Math.hypot(p.x-A.x,p.y-A.y)<p.rad+3||Math.hypot(p.x-B.x,p.y-B.y)<p.rad+3;
      if(!own&&c.pts.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<p.rad+1)) issues.push('over a port'); });
    cabs.forEach((d,j)=>{ if(j<=i) return;
      const D0=d.pts[0], D1=d.pts[d.pts.length-1];
      const shared=[A,B].some(p=>[D0,D1].some(q=>Math.hypot(p.x-q.x,p.y-q.y)<3));
      let crosses=false;
      for(let a=0;a<c.pts.length-1&&!crosses;a++) for(let b=0;b<d.pts.length-1;b++){
        const p1=c.pts[a],p2=c.pts[a+1],p3=d.pts[b],p4=d.pts[b+1];
        if(shared&&[p1,p2,p3,p4].some(p=>[A,B,D0,D1].some(q=>Math.hypot(p.x-q.x,p.y-q.y)<8))) continue;
        if(segX(p1,p2,p3,p4)){ crosses=true; break; } }
      if(crosses) issues.push('cables cross');
      const close=c.pts.filter(p=>d.pts.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<4)).length;
      if(close*3>20) issues.push('cables overlap ('+close*3+'px)'); });
  });
  return [...new Set(issues)];
};
