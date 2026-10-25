/** Runs inside the opaque-origin iframe. Reports display issues, never touches the parent DOM. */
export const STAGE_HEALTH = `(() => {
  const send = issue => parent.postMessage({type:'stage-issue',issue},'*');
  addEventListener('error', () => send('The visualization encountered an error.'));
  addEventListener('unhandledrejection', () => send('The visualization could not complete.'));
  let timer;
  const check = () => {
    clearTimeout(timer); timer=setTimeout(() => {
      if (document.documentElement.scrollWidth > innerWidth + 3) return send('The scene exceeds its available width.');
      const boxes=[];
      for (const text of document.querySelectorAll('svg text')) {
        const b=text.getBoundingClientRect();
        if (!b.width || !b.height || !text.textContent.trim()) continue;
        if (b.left < -3 || b.right > innerWidth+3 || b.top < -3 || b.bottom > innerHeight+3) return send('A diagram label is clipped.');
        if (b.height < 10) return send('Diagram labels are too small at this screen size.');
        if (boxes.some(a=>b.left<a.right-1 && b.right>a.left+1 && b.top<a.bottom-1 && b.bottom>a.top+1)) return send('Diagram labels overlap.');
        boxes.push(b);
      }
      parent.postMessage({type:'stage-checked'},'*');
    }, 450);
  };
  addEventListener('resize',check);
  addEventListener('message', e=>{
    if(e.source!==parent) return;
    if(e.data?.type==='params') check();
    if(e.data?.type==='focus') for(const el of document.querySelectorAll('[data-term]')) el.style.opacity=!e.data.id||el.dataset.term===e.data.id?'1':'.4';
  });
  check();
})();`;
