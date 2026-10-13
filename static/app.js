'use strict';
const $=id=>document.getElementById(id);
let currentPrices=[];
async function api(path,options){const r=await fetch(path,options);const data=await r.json();if(!r.ok)throw Error(data.error||`HTTP ${r.status}`);return data;}
function chart(){if(!currentPrices.length)return;const c=$('chart'),ratio=window.devicePixelRatio||1;c.width=c.clientWidth*ratio;c.height=c.clientHeight*ratio;const ctx=c.getContext('2d');ctx.scale(ratio,ratio);const w=c.clientWidth,h=c.clientHeight,min=Math.min(...currentPrices)*.98,max=Math.max(...currentPrices)*1.02;const x=i=>i/(currentPrices.length-1)*(w-65)+10,y=v=>h-20-(v-min)/(max-min)*(h-40);ctx.strokeStyle='#3b5042';ctx.fillStyle='#96ae9c';ctx.font='10px Arial';for(let i=0;i<4;i++){const v=min+(max-min)*i/3;ctx.beginPath();ctx.moveTo(10,y(v));ctx.lineTo(w-55,y(v));ctx.stroke();ctx.fillText(Math.round(v).toLocaleString(),w-50,y(v)+3);}ctx.beginPath();currentPrices.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.strokeStyle='#c8ec9a';ctx.lineWidth=2.5;ctx.stroke();ctx.lineTo(x(currentPrices.length-1),h-20);ctx.lineTo(10,h-20);ctx.closePath();const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(179,224,142,.22)');g.addColorStop(1,'rgba(179,224,142,0)');ctx.fillStyle=g;ctx.fill();}
async function loadAsset(){const symbol=$('asset').value;$('error').textContent='';try{const d=await api('/api/analysis?symbol='+symbol);if(symbol!==$('asset').value)return;currentPrices=d.prices;$('asset-name').textContent={BTC:'Bitcoin / BTC',ETH:'Ethereum / ETH',SOL:'Solana / SOL'}[symbol];$('return').textContent=d.return_pct+'%';$('volatility').textContent=d.annualized_volatility_pct+'%';$('drawdown').textContent=d.max_drawdown_pct+'%';$('method').textContent=d.methodology;chart();}catch(e){$('error').textContent=e.message;}}
function card(title,body,stamp,cls){const el=document.createElement('div');el.className=cls;const h=document.createElement('strong');h.textContent=title;const p=document.createElement('p');p.textContent=body;el.append(h,p);if(stamp){const small=document.createElement('small');small.textContent=stamp;el.append(small);}return el;}
function noteCard(post){
  const el=card(post.author,post.body,new Date(post.created_at).toLocaleString(),'note');
  const remove=document.createElement('button');remove.type='button';remove.className='delete-note';remove.textContent='Delete note';
  remove.setAttribute('aria-label',`Delete note by ${post.author}`);
  remove.addEventListener('click',async()=>{
    remove.disabled=true;$('post-status').textContent='';
    try{await api('/api/posts/'+post.id,{method:'DELETE'});await posts();$('post-status').textContent='Note deleted from your local workspace.';}
    catch(e){$('post-status').textContent=e.message;remove.disabled=false;}
  });
  el.append(remove);return el;
}
async function posts(){
  const d=await api('/api/posts');
  if(d.items.length){$('posts').replaceChildren(...d.items.map(noteCard));return;}
  const empty=document.createElement('p');empty.className='empty-notes';empty.textContent='No saved notes in this local workspace.';$('posts').replaceChildren(empty);
}
$('asset').addEventListener('change',loadAsset);window.addEventListener('resize',chart);
$('post-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.target,button=form.querySelector('button');button.disabled=true;try{await api('/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.elements.body.value='';await posts();$('post-status').textContent='Saved to your local workspace.';}catch(e){$('post-status').textContent=e.message;}finally{button.disabled=false;}});
loadAsset();posts().catch(e=>$('post-status').textContent=e.message);api('/api/news').then(d=>$('news').replaceChildren(...d.items.map(n=>card(n.title,n.body,null,'news-item')))).catch(e=>$('error').textContent=e.message);
