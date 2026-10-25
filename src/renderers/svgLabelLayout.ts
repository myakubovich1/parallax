/** Runs only inside the opaque-origin iframe. No generated code runs in the app. */
export const SVG_LABEL_LAYOUT = String.raw`
(() => {
  let timer;
  const observer = new MutationObserver(schedule);
  const observe = () => observer.observe(document.body, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['x','y','cx','cy','transform','d','viewBox'] });
  function schedule() { if (!timer) timer=setTimeout(layout,80); }
  function intersects(a,b) { return a.left < b.right+6 && a.right > b.left-6 && a.top < b.bottom+4 && a.bottom > b.top-4; }
  function layout() {
    timer=null; observer.disconnect();
    try {
      for (const svg of document.querySelectorAll('svg')) {
        const bounds=svg.getBoundingClientRect();
        if (!bounds.width || !bounds.height) continue;
        const labels=[...svg.querySelectorAll('text')].filter(el=>el.textContent.trim() && !el.closest('defs')).slice(0,60);
        // Reset only our offset before measuring the generator's current positions.
        for (const label of labels) label.style.translate='0px 0px';
        const placed=[];
        const shapes=[...svg.querySelectorAll('circle,ellipse,rect')].filter(el=>!el.closest('defs')).map(el=>el.getBoundingClientRect()).filter(b=>b.width>8 && b.height>8 && b.width*b.height < bounds.width*bounds.height*.2);
        for (const label of labels) {
          const box=label.getBoundingClientRect(), matrix=label.getScreenCTM();
          if (!box.width || !box.height || !matrix || Math.abs(matrix.a*matrix.d-matrix.b*matrix.c)<1e-8) continue;
          const inv=matrix.inverse(), candidates=[];
          const row=Math.max(20,box.height+8);
          for (const dy of [0,-row,row,-2*row,2*row,-3*row,3*row,-4*row,4*row]) {
            for (const dx of [0,-box.width-12,box.width+12]) {
              const x=Math.max(bounds.left+8-box.left,Math.min(bounds.right-8-box.right,dx));
              const y=Math.max(bounds.top+8-box.top,Math.min(bounds.bottom-8-box.bottom,dy));
              const b={left:box.left+x,right:box.right+x,top:box.top+y,bottom:box.bottom+y};
              const score=placed.filter(p=>intersects(b,p)).length*100000+shapes.filter(p=>intersects(b,p)).length*10000+Math.abs(x)+Math.abs(y);
              candidates.push({x,y,b,score});
            }
          }
          const best=candidates.sort((a,b)=>a.score-b.score)[0];
          label.style.translate=(inv.a*best.x+inv.c*best.y)+'px '+(inv.b*best.x+inv.d*best.y)+'px';
          placed.push(best.b);
        }
      }
    } finally { observe(); }
  }
  observe(); schedule();
  addEventListener('resize',schedule);
  addEventListener('message',e=>{if(e.source===parent && e.data?.type==='params')schedule();});
})();
`;
