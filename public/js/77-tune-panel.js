'use strict';
/* public/js/77-tune-panel.js -- the play-tester's control center: sliders for every knob in TUNE_DEFS (11-tune.js).
   Open/close with F2, or the console's `tune` command. While it's open the mouse is free and the game ignores your keys.
   "Keep on screen" leaves it showing (see-through, hands-off) after you close it, so you can watch values while you play.
   Same people as the console can use it: the host, anyone on the play-test server, or anyone playing solo. */
const tuneEl=$('#tune'),tuneBody=$('#tuneBody'),tuneTabsEl=$('#tuneTabs');
const TUNE_TABS=[...new Set(TUNE_DEFS.map(d=>d.tab))];
let tuneTab=TUNE_TABS[0],tuneIsOpen=false;
try{const t=localStorage.getItem('cgl-tune-tab');if(TUNE_TABS.includes(t))tuneTab=t}catch(e){}
function tuneOpen(){return tuneIsOpen}
function tuneFmt(d,v){
  if(d.kind==='flag')return v?'on':'off';
  if(d.pct)return Math.round(v*100)+'% hp';
  if(d.fmt)return d.fmt(v);
  if(v===0&&d.zero)return'off';
  const a=Math.abs(v),s=a>=10?v.toFixed(1):a>=1?v.toFixed(2):v.toFixed(3);
  return s.replace(/\.?0+$/,'')+d.unit;
}
function tuneRow(d){
  if(d.kind==='action'){   // a button
    const row=document.createElement('div');row.className='tune-row tune-action';
    row.innerHTML='<label></label><button type="button" class="ui-button ui-button--sm"></button>';
    row.querySelector('label').textContent=d.label;const b=row.querySelector('button');b.textContent='Do it';
    b.onclick=()=>{const r=d.run();if(r)toast(String(r),'',2200)};return row;
  }
  if(d.kind==='flag'){   // an on/off switch
    const row=document.createElement('div');row.className='tune-row tune-flag'+(d.key in TUNE_OVR?' changed':'');
    row.innerHTML='<label><input type="checkbox"> <span></span></label><output></output><button type="button" title="Back to default">↺</button><small></small>';
    const cb=row.querySelector('input'),out=row.querySelector('output');row.querySelector('span').textContent=d.label;
    cb.checked=!!tune(d.key);out.textContent=cb.checked?'on':'off';row.querySelector('small').textContent='default '+(d.def?'on':'off');
    cb.onchange=()=>{tuneSet(d.key,cb.checked?1:0);out.textContent=cb.checked?'on':'off';row.classList.toggle('changed',d.key in TUNE_OVR);tuneCount()};
    row.querySelector('button').onclick=()=>{tuneSet(d.key,d.def);renderTune()};
    return row;
  }
  const v=tune(d.key),changed=d.key in TUNE_OVR;
  const row=document.createElement('div');row.className='tune-row'+(changed?' changed':'');
  row.innerHTML='<label></label><input type="range" min="-1" max="1" step="0.005"><output></output><button type="button" title="Back to default">↺</button><small></small>';
  const [lab,rng,out,btn,def]=row.children;
  lab.textContent=d.label;rng.value=tuneToPos(d,v);out.textContent=tuneFmt(d,v);
  def.textContent='default '+tuneFmt(d,d.def);rng.setAttribute('aria-label',d.label);
  rng.oninput=()=>{let p=+rng.value;if(Math.abs(p)<0.02)p=0;   // a little detent at the middle, so default is easy to hit
    const nv=p===0?d.def:+tuneFromPos(d,p).toPrecision(3);tuneSet(d.key,nv);out.textContent=tuneFmt(d,nv);row.classList.toggle('changed',d.key in TUNE_OVR);tuneCount()};
  btn.onclick=()=>{tuneSet(d.key,d.def);renderTune()};
  return row;
}
function tuneCount(){
  const n=Object.keys(TUNE_OVR).length;
  $('#tuneCount').textContent=n?`${n} changed from default`:'Everything at default';
  for(const b of tuneTabsEl.children){const k=TUNE_DEFS.filter(d=>d.tab===b.dataset.tab&&d.key in TUNE_OVR).length;b.querySelector('i').textContent=k?k:''}
}
function renderTune(){
  tuneTabsEl.textContent='';
  for(const t of TUNE_TABS){const b=document.createElement('button');b.type='button';b.dataset.tab=t;b.className=t===tuneTab?'on':'';b.innerHTML='<span></span><i></i>';b.firstChild.textContent=t;
    b.onclick=()=>{tuneTab=t;try{localStorage.setItem('cgl-tune-tab',t)}catch(e){}renderTune()};tuneTabsEl.appendChild(b)}
  {const c=$('#tuneChaos');c.textContent='';c.appendChild(tuneRow(TUNE_DEFS.find(d=>d.key==='haz.chaos')))}   /* CHAOS, pinned above the tabs */
  tuneBody.textContent='';
  for(const d of TUNE_DEFS)if(d.tab===tuneTab&&d.key!=='haz.chaos')tuneBody.appendChild(tuneRow(d));
  tuneCount();
}
function tuneApplyAll(){if(!tuneEl.hidden)renderTune()}
function openTune(){
  if(!canConsole()){toast('The control center is only for the host.','bad',2000);return}
  if(consoleOpen())closeConsole();
  tuneIsOpen=true;tuneEl.hidden=false;tuneEl.classList.remove('ghost');releaseLock();digHeld=false;for(const k in KEYS)KEYS[k]=false;
  renderTune();
}
function closeTune(){
  if(!tuneIsOpen)return;
  tuneIsOpen=false;document.activeElement&&document.activeElement.blur&&document.activeElement.blur();
  if($('#tunePin').checked)tuneEl.classList.add('ghost');else tuneEl.hidden=true;
  if(S.started&&!overlayBlocking())lockMouse();
}
/* called first thing from the keydown handler (55-input.js); true = the key was ours */
function tuneKey(e){
  if(e.key==='F2'&&S.started){e.preventDefault();tuneIsOpen?closeTune():openTune();return true}
  if(!tuneIsOpen)return false;
  if(e.key==='Escape'){e.preventDefault();closeTune()}
  return true;   // swallow everything else (arrow keys still nudge a focused slider)
}
$('#tuneClose').onclick=closeTune;
$('#tunePin').onchange=()=>{try{localStorage.setItem('cgl-tune-pin',$('#tunePin').checked?'1':'')}catch(e){}};
try{$('#tunePin').checked=localStorage.getItem('cgl-tune-pin')==='1'}catch(e){}
$('#tuneResetTab').onclick=()=>{for(const d of TUNE_DEFS)if(d.tab===tuneTab)delete TUNE_OVR[d.key];tuneSync();renderTune()};
$('#tuneResetAll').onclick=()=>{if(!confirm('Put every slider back to its default?'))return;TUNE_OVR={};tuneSync();renderTune()};
$('#tuneCopy').onclick=()=>{
  const lines=TUNE_DEFS.filter(d=>d.key in TUNE_OVR).map(d=>`${d.tab} / ${d.label}: ${tuneFmt(d,d.def)} -> ${tuneFmt(d,tune(d.key))}  [${d.key}=${tune(d.key)}]`);
  const txt=lines.length?lines.join('\n'):'Everything at default.';
  (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('Copied your changes.','',1800),()=>{prompt('Copy your changes:',txt)});
};

command('tune',{usage:'tune [list|reset]',help:'Open the control center (also F2). list: what you changed. reset: everything back to default.',
  run([a]){a=(a||'').toLowerCase();
    if(a==='list'){const ch=TUNE_DEFS.filter(d=>d.key in TUNE_OVR);return ch.length?ch.map(d=>`${d.tab}/${d.label}: ${tuneFmt(d,tune(d.key))} (default ${tuneFmt(d,d.def)})`).join('\n'):'Everything at default.'}
    if(a==='reset'){TUNE_OVR={};tuneSync();tuneApplyAll();return'Every slider back to default.'}
    setTimeout(openTune,0);return'Opening the control center.'}});
