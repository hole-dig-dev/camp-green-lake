export function createAudio(){
 let ctx=null,enabled=true,noise=null,active=0,lastCatch=0,lastMachine=0,lastScrape=0,lastEvent='',eventCount=0,lastRod=0;
 const metrics=()=>({enabled,eventCount,lastEvent,activeVoices:active});
 function start(){if(!ctx){ctx=new AudioContext();noise=ctx.createBuffer(1,ctx.sampleRate*.8,ctx.sampleRate);const a=noise.getChannelData(0);let brown=0;for(let i=0;i<a.length;i++){brown=(brown+(Math.random()*2-1)*.12)/1.02;a[i]=brown;}}if(ctx.state==='suspended')ctx.resume().catch(()=>{});}
 function route(gain,pan=0){const p=ctx.createStereoPanner();p.pan.value=pan;gain.connect(p);p.connect(ctx.destination);return p;}
 function tone(freq,time=.1,volume=.035,type='sine',delay=0,pan=0){if(!ctx||!enabled||active>14)return;active++;const o=ctx.createOscillator(),g=ctx.createGain(),p=route(g,pan);o.type=type;o.frequency.setValueAtTime(freq,ctx.currentTime+delay);o.frequency.exponentialRampToValueAtTime(Math.max(15,freq*.65),ctx.currentTime+delay+time);g.gain.setValueAtTime(volume,ctx.currentTime+delay);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+delay+time);o.connect(g);o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+time);o.onended=()=>{active--;o.disconnect();g.disconnect();p.disconnect();};}
 function rustle(time=.18,volume=.07,cut=650,pan=0){if(!ctx||!enabled||active>14)return;active++;const o=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain(),p=route(g,pan);o.buffer=noise;f.type='lowpass';f.frequency.value=cut;g.gain.setValueAtTime(volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+time);o.connect(f);f.connect(g);o.start();o.stop(ctx.currentTime+time);o.onended=()=>{active--;o.disconnect();f.disconnect();g.disconnect();p.disconnect();};}
 function spatial(e,local){if(!local)return {volume:1,pan:0};const dx=e.x-local.x,dz=e.z-local.z,d=Math.hypot(dx,dz);return {volume:Math.max(0,1-d/25),pan:Math.max(-.9,Math.min(.9,(Math.cos(local.yaw)*dx-Math.sin(local.yaw)*dz)/8))};}
 function effect(e,local){const s=spatial(e,local);if(s.volume<=0||!enabled)return;const v=s.volume,p=s.pan;lastEvent=e.type;eventCount++;
  if(e.type.startsWith('relic')){tone(660,.14,.05*v,'sine',0,p);tone(880,.18,.04*v,'sine',.12,p);if(e.type==='relicSale')tone(1320,.24,.04*v,'sine',.24,p);}
  if(['guardShout','guardWindup'].includes(e.type)){tone(e.type==='guardWindup'?180:120,.18,.08*v,'sawtooth',0,p);tone(e.type==='guardWindup'?240:95,.17,.045*v,'triangle',.18,p);}
  if(e.type==='guardDance'){for(let i=0;i<4;i++)tone(i%2?240:120,.10,.04*v,'triangle',i*.14,p);}
  if(e.type==='guardBump'){rustle(.25,.16*v,430,p);tone(65,.20,.08*v,'triangle',0,p);tone(290,.16,.04*v,'sine',.08,p);}
  if(e.type==='plant'){rustle(.19,.11*v,e.mine?1500:400,p);tone(e.mine?220:90,.1,.035*v,'triangle',0,p);}
  if(e.type==='dig'){rustle(.25,.13*v,700,p);tone(75,.16,.055*v,'triangle',0,p);}
  if(e.type==='catch'){if(performance.now()-lastCatch<70)return;lastCatch=performance.now();rustle(.12,.11*v,1600,p);tone(320,.12,.065*v,'triangle',0,p);tone(580,.08,.025*v,'sine',.025,p);}
  if(['spill','mud','beltBurp'].includes(e.type)){rustle(.38,.19*v,430,p);tone(e.type==='beltBurp'?55:80,.22,.07*v,'sawtooth',0,p);}
  if(['beltJam','roofCrack','caveIn'].includes(e.type)){rustle(.38,.15*v,2100,p);tone(95,.2,.08*v,'square',0,p);tone(155,.14,.05*v,'triangle',.15,p);}
  if(['chop','treeFall','motorFit'].includes(e.type)){rustle(.18,.1*v,1300,p);tone(150,.11,.06*v,'triangle',0,p);}
 }
 function update(state,local,gesture){if(!state||!enabled||!ctx)return;const t=performance.now(),strength=state.self.relicSignal?.strength||0;if(strength>.12&&t-lastRod>1100-strength*900){lastRod=t;tone(180+strength*450,.075,.025,'triangle');rustle(.06,strength*.025,1400);}
  if(['planted','planting'].includes(gesture.phase)&&t-lastScrape>150){lastScrape=t;rustle(.09,.025+Math.min(gesture.pull||0,42)*.0008,480);}
  if(t-lastMachine>240){lastMachine=t;const m=state.machines.filter(m=>m.running||m.jammed).sort((a,b)=>Math.hypot(a.x-local.x,a.z-local.z)-Math.hypot(b.x-local.x,b.z-local.z))[0];if(m){const s=spatial(m,local);if(s.volume>0){tone(m.jammed||m.strain>2?95:m.type==='feeder'?62:130,.1,s.volume*.026,m.jammed||m.strain>2?'square':'triangle',0,s.pan);rustle(.12,.04*s.volume,m.jammed||m.strain>2?2400:700,s.pan);}}
   const c=state.carts?.find(c=>c.id===state.self.cart);if(c&&Math.hypot(c.vx,c.vz)>.4){rustle(.12,.018+c.wobble*.065,1100);if(c.wobble>.45)tone(230,.09,.025,'triangle');}
  }
 }
 return {start,toggle(){enabled=!enabled;return enabled;},get enabled(){return enabled;},get metrics(){return metrics();},effect,update,chop(){effect({type:'chop',x:0,z:0});},crack(){effect({type:'roofCrack',x:0,z:0});},dig(){effect({type:'dig',x:0,z:0});},gold(){tone(660,.16);tone(880,.22,.03,'sine',.10);tone(1320,.25,.025,'sine',.20);},buy(){tone(330,.1);tone(440,.12,.035,'triangle',.1);},emote(){tone(270,.13,.02,'square');tone(400,.18,.02,'triangle',.12);}};
}
