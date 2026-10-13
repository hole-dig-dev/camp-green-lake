// the two-handed Scoop on film: Alpha digs, a spectator circles them, then Alpha's own first-person view
const {browser,player}=require('./lib2.cjs');const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const PORT=process.argv[2],OUT=process.argv[3];const W=1280,H=720;
async function film(ctx,page,dir,ms,act){const cdp=await ctx.newCDPSession(page);const frames=[];fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  cdp.on('Page.screencastFrame',async f=>{const i=frames.length;fs.writeFileSync(path.join(dir,String(i).padStart(5,'0')+'.jpg'),Buffer.from(f.data,'base64'));frames.push(f.metadata.timestamp);try{await cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId})}catch(e){}});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:W,maxHeight:H,everyNthFrame:1});await act();await page.waitForTimeout(ms);await cdp.send('Page.stopScreencast');
  const list=[];for(let i=0;i<frames.length;i++){const d=i+1<frames.length?frames[i+1]-frames[i]:0.04;list.push(`file '${String(i).padStart(5,'0')}.jpg'`,`duration ${Math.max(0.005,d).toFixed(4)}`)}
  fs.writeFileSync(path.join(dir,'list.txt'),list.join('\n'));return frames.length}
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);
await A.setViewportSize({width:W,height:H});
await A.evaluate(()=>{tuneSet('haz.all',0);runCommand('time 10:00');S.up.shovel=true;P.x=0;P.z=-15;P.y=groundAt(0,-15);P.yaw=0;P.fa=Math.PI});
const ctx=await b.newContext({viewport:{width:W,height:H}});const V=await ctx.newPage();V.on('pageerror',e=>errs.push('V: '+e.message));
await V.goto(`http://127.0.0.1:${PORT}/?r=1&spectate`);await V.waitForFunction(()=>!document.querySelector('#startBtn').disabled,null,{timeout:30000});
await V.evaluate(()=>{document.querySelector('#startBtn').click()});await V.waitForTimeout(2500);await V.keyboard.press('h');
await V.evaluate(()=>{const p=document.getElementById('specHelp');if(p)p.hidden=true;SPEC.follow('Alpha',{r:3.4,h:1.3,spin:0.12})});await V.waitForTimeout(1000);
await A.keyboard.down('e');await A.waitForTimeout(400);
console.log('clip on Alpha:',await A.evaluate(()=>me&&me.cur),'| friend sees:',await V.evaluate(()=>{const r=[...remotes.values()].find(r=>r.name==='Alpha');return r&&r.p.cur}));
const n1=await film(ctx,V,OUT+'-3p',6500,async()=>{});
await A.keyboard.up('e');
const actx=A.context();await A.evaluate(()=>{if(!FP)toggleView();P.pitch=0.55});await A.waitForTimeout(800);
const n2=await film(actx,A,OUT+'-fp',4500,async()=>{await A.keyboard.down('e')});await A.keyboard.up('e');
for(const s of['-3p','-fp'])execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(OUT+s,'list.txt'),'-vf','fps=30,format=yuv420p,scale=960:-2','-c:v','libx264','-crf','23','-preset','medium','-movflags','+faststart',OUT+s+'.mp4']);
console.log('frames',n1,n2,'errors:',errs.join(' | ')||'none');await b.close()})();
