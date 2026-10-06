window.__cableAudit=function(canvasSel){
  const cv=document.querySelector(canvasSel); if(!cv) return null;
  const C=cv.getBoundingClientRect();
  const rel=r=>({l:r.left-C.left, t:r.top-C.top, r:r.right-C.left, b:r.bottom-C.top});
  const devs=[...cv.querySelectorAll('.dev')].map(e=>({name:(e.querySelector('.dev-name')||e).textContent.trim().split(/\s/)[0], ...rel(e.getBoundingClientRect())}));
  const ports=[...cv.querySelectorAll('.port')].map(e=>{ const r=rel(e.getBoundingClientRect()); return {x:(r.l+r.r)/2, y:(r.t+r.b)/2, rad:(r.r-r.l)/2}; });
  const svg=cv.querySelector('svg'), S=rel(svg.getBoundingClientRect());
  const lines=[...svg.querySelectorAll('line.cable')].map(l=>({x1:+l.getAttribute('x1')+S.l, y1:+l.getAttribute('y1')+S.t, x2:+l.getAttribute('x2')+S.l, y2:+l.getAttribute('y2')+S.t}))
    .filter(s=>Math.hypot(s.x2-s.x1,s.y2-s.y1)>45);
  const distSeg=(px,py,s)=>{ const dx=s.x2-s.x1, dy=s.y2-s.y1, L=dx*dx+dy*dy; let t=L?((px-s.x1)*dx+(py-s.y1)*dy)/L:0; t=Math.max(0,Math.min(1,t)); return Math.hypot(px-(s.x1+t*dx), py-(s.y1+t*dy)); };
  const cross=(a,b)=>{ const o=(p,q,r)=>Math.sign((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x));
    const A={x:a.x1,y:a.y1},B={x:a.x2,y:a.y2},Cc={x:b.x1,y:b.y1},D={x:b.x2,y:b.y2};
    return o(A,B,Cc)*o(A,B,D)<0 && o(Cc,D,A)*o(Cc,D,B)<0; };
  const issues=[];
  lines.forEach((s,i)=>{
    const len=Math.hypot(s.x2-s.x1,s.y2-s.y1);
    devs.forEach(b=>{ let inside=0;
      for(let k=1;k<40;k++){ const t=k/40, px=s.x1+t*(s.x2-s.x1), py=s.y1+t*(s.y2-s.y1);
        if(Math.hypot(px-s.x1,py-s.y1)<10||Math.hypot(px-s.x2,py-s.y2)<10) continue;
        if(px>b.l+2&&px<b.r-2&&py>b.t+2&&py<b.b-2) inside++; }
      if(inside*len/40>12) issues.push('through box '+b.name); });
    ports.forEach(p=>{ const own=Math.hypot(p.x-s.x1,p.y-s.y1)<p.rad+3||Math.hypot(p.x-s.x2,p.y-s.y2)<p.rad+3;
      if(!own&&distSeg(p.x,p.y,s)<p.rad+2) issues.push('over a port'); });
    lines.forEach((t,j)=>{ if(j<=i) return;
      const shareEnd=[[s.x1,s.y1],[s.x2,s.y2]].some(([x,y])=>[[t.x1,t.y1],[t.x2,t.y2]].some(([u,v])=>Math.hypot(x-u,y-v)<3));
      if(!shareEnd&&cross(s,t)) issues.push('cables cross');
      let close=0; for(let k=0;k<=40;k++){ const tt=k/40, px=s.x1+tt*(s.x2-s.x1), py=s.y1+tt*(s.y2-s.y1); if(distSeg(px,py,t)<5) close++; }
      if(close*len/40>20) issues.push('cables overlap'); });
  });
  return [...new Set(issues)];
};
