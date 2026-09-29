'use strict';
/* public/js/81-mood.js -- the Warden's daily mood and the curse, after Greg's branch (claude/intense-change-1-test-2026-09-27-1829).
   Rules in public/sim.js (MOODS, rollMood, CURSE); the server keeps both in world.run and sends them with 'run'.
   Solo play keeps them in RUN (saved with the run).
   Moods: heatwave (water drains faster, sunburn x2), sandstorm (murky air, the map only works in camp), breeding
   (hatchlings everywhere), stingy (3 water refills each), fullmoon (Zeroni all night, no police), digday (double quota,
   double pay), inspection (the Warden walks the lake all day).
   The curse: up when campers are out past curfew or get knocked out; down at dawn, when the quota's met, and when
   someone sings Madame Zeroni away (hold H close to her). It means more monsters and hazards, likelier bad moods, and
   from 40 up, Clyde Livingston's sneakers fall out of the sky. */
const moodOf=()=>RUN.mood||'normal';
let moodShownDay=-1,sneakT=25;
function moodAnnounce(){
  if(!S.started||moodShownDay===RUN.day)return;moodShownDay=RUN.day;
  const M=SIM.MOODS[moodOf()];if(!M)return;
  toast(`Day ${RUN.day}. The Warden's mood: ${M.name}. ${M.desc}`,moodOf()==='normal'?'':'bad',8000);
}
function moodHud(){
  const M=SIM.MOODS[moodOf()];$('#dayTag').textContent='Day '+RUN.day+(M&&moodOf()!=='normal'?' · '+M.name:'');
  $('#mapbox').classList.toggle('sand',moodOf()==='sandstorm'&&clockT()<DAYMS&&!inCamp(P.x,P.z)&&!ZONE_H);
  const c=Math.round(RUN.curse||0),row=$('#curseRow');if(row){row.hidden=c<=0;$('#curseV').textContent=c+'%';row.classList.toggle('hot',c>=40)}
}
/* solo: the same rules the server runs */
function soloCurse(d,why){if(online())return;const was=RUN.curse||0;RUN.curse=clamp(was+d,0,100);saveRun();curseNote(d,Math.round(RUN.curse),why);moodHud()}
function curseNote(d,c,why){if(!S.started||!why||why==='dawn')return;toast(d>0?`The curse grows (${c}%): ${why}.`:`The curse eases (${c}%): ${why}.`,d>0?'bad':'good',4500)}
function curseKo(){if(online())wsSend({t:'koCurse'});else soloCurse(SIM.CURSE.KO,'you got knocked out')}
let moodLastT=-1;
function updateMood(dt){
  if(!S.started)return;
  moodAnnounce();if((moodHud.t=(moodHud.t||0)-dt)<=0){moodHud.t=1;moodHud()}
  const t=clockT();
  if(!online()&&moodLastT>=0){
    if(moodLastT<DAYMS&&t>=DAYMS&&!inCamp(P.x,P.z)&&!S.inTown&&!ZONE_H)soloCurse(SIM.CURSE.CURFEW_OUT,'you were outside the fence at curfew');
    if(moodLastT>t+CYCLE/2&&(RUN.curse||0)>0)soloCurse(SIM.CURSE.DAWN,'dawn');
  }
  moodLastT=t;
  // sandstorm: murky air out on the lake by day (on top of whatever the sky code set this frame)
  if(moodOf()==='sandstorm'&&t<DAYMS&&!inCamp(P.x,P.z)&&!inTent()&&!S.inTown&&!ZONE_H){scene.fog.color.lerp(new T.Color(0xc9a070),0.6);scene.fog.near=Math.min(scene.fog.near,4);scene.fog.far=Math.min(scene.fog.far,70)}
  // the curse: Clyde Livingston's sneakers fall out of the sky (the movie)
  if((RUN.curse||0)>=40&&t<DAYMS&&!inCamp(P.x,P.z)&&!inTent()&&!S.inTown&&!S.ko&&(sneakT-=dt)<=0){sneakT=20;if(Math.random()<((RUN.curse||0)-30)/140)sneakersFall()}
}
function sneakersFall(){
  countUp('clyde',1,'clyde');sfx.thud();tone(900,0.5,'sine',0.05,300);say(meL,'OW!',2500);
  hurt(8,'Sneakers','A pair of sneakers fell out of the sky and hit you on the head.');
  toast('A pair of sneakers fell out of the sky and hit you on the head. They say CLYDE LIVINGSTON on them. (The curse)','bad',6000);
  if(S.sack.length<sackMax())S.sack.push('sneakers');logEv('sneakers',{});
}
/* solo: singing close to Madame Zeroni */
let zSongSolo=0;
function moodSing(){
  if(online()||!MONL.zer)return;
  if(Math.hypot(MONL.zer.x-P.x,MONL.zer.z-P.z)<14&&++zSongSolo>=SIM.CURSE.SONG){zSongSolo=0;MONL.zer=null;MONL.appeased=true;MONV.zer=null;monEvent({k:'appeased',by:S.name});soloCurse(SIM.CURSE.LULLABY,'you sang Madame Zeroni away')}
}
command('curse',{usage:'curse [0-100]',help:'Show or set the crew\'s curse (testing).',
  run([a]){if(a==null)return`Curse: ${Math.round(RUN.curse||0)}%.`;const v=numArg(a,0,0,100);if(online())wsSend({t:'runset',curse:v});else{RUN.curse=v;saveRun();moodHud()}return`Curse set to ${v}%.`}});
command('mood',{usage:'mood [name]',help:'Show or set the Warden\'s mood: '+Object.keys(SIM.MOODS).join(', ')+' (testing).',
  run([a]){if(!a)return`Today: ${SIM.MOODS[moodOf()].name}.`;if(!SIM.MOODS[a])throw new Error('Moods: '+Object.keys(SIM.MOODS).join(', '));
    if(online())wsSend({t:'runset',mood:a});else{RUN.mood=a;saveRun();moodHud()}moodShownDay=-1;return`Mood set to ${SIM.MOODS[a].name}.`}});
