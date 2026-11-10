'use strict';
/* public/js/81-mood.js -- the Superintendent's daily mood and the bad luck, after Greg's branch (claude/intense-change-1-test-2026-09-27-1829).
   Rules in public/sim.js (MOODS, rollMood, BADLUCK); the server keeps both in world.run and sends them with 'run'.
   Solo play keeps them in RUN (saved with the run).
   Moods: heatwave (water drains faster, sunburn x2), sandstorm (murky air, the map only works in camp), breeding
   (hatchlings everywhere), stingy (3 water refills each), fullmoon (the Bride all night, no police), digday (double quota,
   double pay), inspection (the Superintendent walks the lake all day).
   The bad luck: up when campers are out past curfew or get knocked out; down at dawn, when the quota's met, and when
   someone sings the Drowned Bride away (hold H close to her). It means more monsters and hazards, likelier bad moods, and
   from 40 up, a pair of old boots falls out of the sky. */
const moodOf=()=>RUN.mood||'normal';
let moodShownDay=-1,sneakT=25;
function moodAnnounce(){
  if(!S.started||moodShownDay===RUN.day)return;moodShownDay=RUN.day;
  const M=SIM.MOODS[moodOf()];if(!M)return;
  /* one short line: an ordinary day is just the day number; a special mood still says what it changes */
  if(moodOf()==='normal')toast(`Day ${RUN.day}. ${M.name}.`,'',3500);else toast(`Day ${RUN.day}. ${M.name}: ${M.desc}`,'bad',7000);
}
function moodHud(){
  const M=SIM.MOODS[moodOf()];$('#dayTag').textContent='Day '+RUN.day+(M&&moodOf()!=='normal'?' · '+M.name:'');
  $('#mapbox').classList.toggle('sand',moodOf()==='sandstorm'&&clockT()<DAYMS&&!inCamp(P.x,P.z)&&!ZONE_H);
  const c=Math.round(RUN.badluck||0),row=$('#badluckRow');if(row){row.hidden=c<=0;$('#badluckV').textContent=c+'%';row.classList.toggle('hot',c>=40)}
}
/* solo: the same rules the server runs */
function soloBadLuck(d,why){if(online())return;const was=RUN.badluck||0;RUN.badluck=clamp(was+d,0,100);saveRun();badluckNote(d,Math.round(RUN.badluck),why);moodHud()}
function badluckNote(d,c,why){if(!S.started||!why||why==='dawn')return;toast(d>0?`Lil's luck gets worse (${c}%): ${why}.`:`Lil's luck eases (${c}%): ${why}.`,d>0?'bad':'good',4500)}
function badluckKo(){if(online())wsSend({t:'koBadLuck'});else soloBadLuck(tune('badluck.ko'),'you got knocked out')}
let moodLastT=-1;
function updateMood(dt){
  if(!S.started)return;
  moodAnnounce();if((moodHud.t=(moodHud.t||0)-dt)<=0){moodHud.t=1;moodHud()}
  const t=clockT();
  if(!online()&&moodLastT>=0){
    if(moodLastT<DAYMS&&t>=DAYMS&&!inCamp(P.x,P.z)&&!S.inTown&&!ZONE_H)soloBadLuck(tune('badluck.curfew'),'you were outside the fence at lights-out');
    if(moodLastT>t+CYCLE/2&&(RUN.badluck||0)>0)soloBadLuck(-tune('badluck.dawn'),'dawn');
  }
  moodLastT=t;
  // sandstorm: murky air out on the lake by day (on top of whatever the sky code set this frame)
  if(moodOf()==='sandstorm'&&t<DAYMS&&!inCamp(P.x,P.z)&&!inTent()&&!S.inTown&&!ZONE_H){scene.fog.color.lerp(new T.Color(0xc9a070),0.6);scene.fog.near=Math.min(scene.fog.near,4);scene.fog.far=Math.min(scene.fog.far,70)}
  // the bad luck: a pair of old boots falls out of the sky
  if((RUN.badluck||0)>=40&&t<DAYMS&&!inCamp(P.x,P.z)&&!inTent()&&!S.inTown&&!S.ko&&(sneakT-=dt)<=0){sneakT=20;if(Math.random()<((RUN.badluck||0)-30)/140)sneakersFall()}
}
function sneakersFall(){
  countUp('clyde',1,'clyde');sfx.thud();tone(900,0.5,'sine',0.05,300);say(meL,'OW!',2500);
  hurt(8,'Old boots','A pair of old boots fell out of the sky and hit you on the head.');
  toast('A pair of old boots fell out of the sky and hit you on the head. They are still wet. (Lil\'s luck)','bad',6000);
  if(S.sack.length<sackMax())S.sack.push('sneakers');logEv('sneakers',{});
}
/* solo: singing close to the Drowned Bride */
let brideSongSolo=0;
function moodSing(){
  if(online()||!MONL.bride)return;
  if(Math.hypot(MONL.bride.x-P.x,MONL.bride.z-P.z)<14&&++brideSongSolo>=SIM.BADLUCK.SONG){brideSongSolo=0;MONL.bride=null;MONL.appeased=true;MONV.bride=null;monEvent({k:'appeased',by:S.name});soloBadLuck(-tune('badluck.lullaby'),'you sang the Drowned Bride away')}
}
command('badluck',{usage:'badluck [0-100]',help:'Show or set the crew\'s bad luck (testing).',
  run([a]){if(a==null)return`Bad luck: ${Math.round(RUN.badluck||0)}%.`;const v=numArg(a,0,0,100);if(online())wsSend({t:'runset',badluck:v});else{RUN.badluck=v;saveRun();moodHud()}return`Bad luck set to ${v}%.`}});
command('mood',{usage:'mood [name]',help:'Show or set the day\'s mood: '+Object.keys(SIM.MOODS).join(', ')+' (testing).',
  run([a]){if(!a)return`Today: ${SIM.MOODS[moodOf()].name}.`;if(!SIM.MOODS[a])throw new Error('Moods: '+Object.keys(SIM.MOODS).join(', '));
    if(online())wsSend({t:'runset',mood:a});else{RUN.mood=a;saveRun();moodHud()}moodShownDay=-1;return`Mood set to ${SIM.MOODS[a].name}.`}});
