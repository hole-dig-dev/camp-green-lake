'use strict';
/* public/js/88-habits.js -- the D Tent crew's habits (JT 2026-10-02: in-depth crew pathing and habits).
   - Chatter that fits what's going on (crewChatter, from 30-npcs.js's idle talk): his own lines, plus the gold rush:
     a nearly full bucket, a long sifter queue, low morale, a rich vein glittering, an empty soda machine, a crewmate
     taken by the UFO, or one who's come back... different.
   - Saying hello: walk up to a crew member and he looks round, waves if he's not mid-dig, says hi (once in a while).
   - Lunch: at noon (LUNCH_AT) the crew walk in through the gate and sit at the mess tables for LUNCH_T seconds (a
     little morale), then head back out to their holes. The siren still sends everyone to the tent. */
const LUNCH_AT=12,LUNCH_T=22,GREET_R=4,GREET_EVERY=90;
const HAB={lunchDay:-1};
function crewChatter(b){
  const r=botRng(),n=b.d.n,others=bots.filter(o=>o!==b&&crewHired(o)),ctx=[];
  const mx=crewBucketMax(b);if(mx>0&&(b.bucket||0)>=mx*0.8)ctx.push(crewPack(b)?'This pack weighs a ton.':'Almost a full bucket.','One more hole and I\'m off to the sifter.');
  if(SIFTQ.length>=3)ctx.push('The sifter line\'s a mile long.','Who\'s hogging the sifter?');
  if(typeof moraleOf==='function'&&moraleOf(b)<40)ctx.push('Why do I even bother.','I want a soda.');
  if(typeof VEIN!=='undefined'&&VEIN.on)ctx.push('Did you see the ground glittering out there?','Somebody\'s getting rich today. Not me.');
  if(typeof campHas==='function'&&campHas('sodaMachine')&&typeof sodaStock==='function'&&sodaStock()<1)ctx.push('Somebody fill the soda machine!');
  const gone=others.find(o=>typeof isAbducted==='function'&&isAbducted(o)),alien=others.find(o=>typeof isAlien==='function'&&isAlien(o));
  if(gone)ctx.push(`Has anyone seen ${gone.d.n}?`,`${gone.d.n} just... went up. Into the sky.`);
  if(alien)ctx.push(`${alien.d.n}'s been weird lately.`,`Is it me, or is ${alien.d.n} kind of green?`,`${alien.d.n} keeps telling me he's ${alien.d.n}.`);
  if(clockT()>tAtHour(11)&&clockT()<tAtHour(12))ctx.push('Is it lunch yet?','I could eat a lizard.');
  if(ctx.length&&r<0.55)return pick(ctx);
  return b.d.lines[Math.floor(botRng()*b.d.lines.length)];
}
/* lunch: the seats at the mess tables, one each */
const lunchSeat=b=>{const L=SEATS.filter(s=>s.tent==null&&s.what==='the bench');return L.length?L[bots.indexOf(b)%L.length]:null};
function crewLunchStep(b,dt){   /* 30-npcs.js, while b.state==='lunch' */
  const s=lunchSeat(b),g=b.p.g;
  if(!s||curfewSoon()){b.state='gotent';b.tx=D_TENT_DOOR.x;b.tz=D_TENT_DOOR.z;b.errand=null;return}
  if(b.t==null){const fx=s.x+s.out[0],fz=s.z+s.out[1];if(!walkTo(b,fx,fz,dt,2.2))return;b.t=LUNCH_T;if(nearCam(fx,fz,30))say(b.L,pick(['Lunch!','Mystery meat again.','Finally, a seat.']),2400)}
  sitPose(b.p,s.x,groundAt(s.x,s.z)+s.y,s.z,s.h,dt);
  b.t-=dt;if(b.t<=0){b.t=null;b.errand=null;if(typeof moraleOf==='function')b.morale=Math.min(100,moraleOf(b)+15);b.water=crewWaterMax(b);
    const fx=s.x+s.out[0],fz=s.z+s.out[1];g.position.set(fx,groundAt(fx,fz),fz);b.state='gatebackin';b.tx=gateX(b);b.tz=CREW_GATE.in}
}
function updateHabits(dt){
  /* lunchtime: everyone working outside heads in (once a day) */
  const t=clockT();
  if(t>=tAtHour(LUNCH_AT)&&t<tAtHour(LUNCH_AT+0.5)&&HAB.lunchDay!==RUN.day){HAB.lunchDay=RUN.day;
    for(const b of bots)if(crewHired(b)&&b.p.g.visible&&!b.errand&&(b.state==='dig'||b.state==='rest'||b.state==='walk'||b.state==='return')){b.errand='lunch';b.state='gateout';b.tx=gateX(b);b.tz=CREW_GATE.out}}
  /* saying hello */
  if(!S.started||S.tent!=null)return;
  for(const b of bots){b.greetT=(b.greetT||0)-dt;if(b.greetT>0||!crewHired(b)||!b.p.g.visible||!OUTDOOR.has(b.state))continue;
    const g=b.p.g.position;if(Math.hypot(P.x-g.x,P.z-g.z)>GREET_R)continue;b.greetT=GREET_EVERY;
    if(b.state!=='dig'){b.p.waveT=1.4;let dr=Math.atan2(P.x-g.x,P.z-g.z)-b.p.g.rotation.y;dr=Math.atan2(Math.sin(dr),Math.cos(dr));b.p.g.rotation.y+=dr}
    say(b.L,pick([`Hey, ${S.name}.`,`${S.name}! How's the digging?`,'Oh, hey.',`Morning, ${S.name}.`,'You again.']),2400)}
}
