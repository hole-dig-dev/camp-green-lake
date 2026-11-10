'use strict';
/* public/js/61-title-scene.js -- the title screen as a scene (2026-11-10).
   The live camp fills the screen and the camera plays a short loop of slow shots (the gate and the jeep, the lake
   bed, the camp from above), dipping through black between them. The title is always lit at golden hour:
   titleView()/TITLE_T below are read by the "look" clock in 82-patrol.js (lookT/lookNightF), which only the sky and
   the lights use. The shared game clock (clockT, CLK) is never touched, so nothing changes for anyone in the game.
   Also here: the small title buttons (Controls panel, Options = the pause menu's options card). */
const TITLE_HOUR=18.05;            // golden hour: low warm sun in the west, long shadows across the lake bed
const TITLE_SHOT_S=20,TITLE_FADE_S=1.1;   // seconds per shot, and the dip to black at each end of it
/* each shot: camera from -> to, looking at la -> lb (world metres; the main gate is at x 0, z 27, the lake is at lower z).
   Kept within ~60 m of the gate: the title only streams detailed ground around there (90-loop.js). */
const TITLE_SHOTS=[
  {from:[-15,2.0,13],to:[-10,2.6,17],la:[6,3.2,31],lb:[5,3.0,31]},        // low on the lake bed, pushing in on the gate and the jeep
  {from:[17,6.2,45],to:[13,5.4,41],la:[-28,-3,-12],lb:[-30,-3,-16]},         // over the fence from inside camp, out across the holes toward the sun
  {from:[30,13,2],to:[20,11,-4],la:[-6,1,36],lb:[-8,1,38]},               // high and wide: the whole camp with the lake bed in front
];
const TITLE_SHIFT=0.13;            // the picture is slid this far (a share of the screen) away from the text: right on wide screens, up on tall ones
const TITLE={on:true,t:0,lens:'',fade:-1,el:null,p:new T.Vector3(),l:new T.Vector3()};
function titleView(){return TITLE.on}                 // true only while this browser is showing the title screen
function titleEnd(){TITLE.on=false;titleLens('')}     // called when play (or spectating) starts: real clock, normal lens
function titleCamera(dt){
  TITLE.t=Math.max(0,TITLE.t+dt);const n=TITLE_SHOTS.length,i=Math.floor(TITLE.t/TITLE_SHOT_S)%n,u=(TITLE.t%TITLE_SHOT_S)/TITLE_SHOT_S,s=TITLE_SHOTS[i];
  const e=u*u*(3-2*u)*0.5+u*0.5;                                   // mostly steady, a touch of ease so a shot never starts or stops dead
  TITLE.p.set(lerp(s.from[0],s.to[0],e),lerp(s.from[1],s.to[1],e),lerp(s.from[2],s.to[2],e));
  TITLE.l.set(lerp(s.la[0],s.lb[0],e),lerp(s.la[1],s.lb[1],e),lerp(s.la[2],s.lb[2],e));
  TITLE.p.y=Math.max(TITLE.p.y,groundAt(TITLE.p.x,TITLE.p.z)+1.2);  // never under a dune or in a hole someone dug
  camera.position.copy(TITLE.p);camera.lookAt(TITLE.l);
  const lens=innerWidth>innerHeight*1.15?'wide':'tall';if(TITLE.on&&lens!==TITLE.lens)titleLens(lens);
  /* dip to black around each cut (the very first shot just starts) */
  const sec=u*TITLE_SHOT_S,f=TITLE.t<TITLE_SHOT_S&&sec<TITLE_FADE_S?0:Math.max(1-sec/TITLE_FADE_S,1-(TITLE_SHOT_S-sec)/TITLE_FADE_S,0);
  const q=Math.round(f*40)/40;if(q!==TITLE.fade){TITLE.fade=q;if(!TITLE.el)TITLE.el=document.querySelector('.title-shade');if(TITLE.el)TITLE.el.style.setProperty('--cut',q)}
}
/* An off-centre lens (the same thing a film camera's shift does): the subject each shot aims at lands beside the logo
   instead of under it. Sizes are fractions, so it survives a window resize; titleLens('') puts the lens back for play. */
function titleLens(mode){
  TITLE.lens=mode;
  camera.view=mode?{enabled:true,fullWidth:1,fullHeight:1,offsetX:mode==='wide'?-TITLE_SHIFT:0,offsetY:mode==='tall'?TITLE_SHIFT:0,width:1,height:1}:null;
  camera.updateProjectionMatrix();
}

/* ---- Controls panel and Options, from the title ---- */
{
  const info=$('#titleInfo'),infoBtn=$('#titleInfoBtn'),pauseBox=$('#pause');
  const showInfo=on=>{info.hidden=!on;infoBtn.setAttribute('aria-expanded',on?'true':'false')};
  infoBtn.onclick=()=>showInfo(info.hidden);$('#titleInfoClose').onclick=()=>{showInfo(false);infoBtn.focus()};
  const optOpen=()=>!PAUSE.open&&!pauseBox.hidden,optClose=()=>{pauseBox.hidden=true;$('#titleOptionsBtn').focus()};
  /* Options borrows the pause menu's options card (95-pause.js). Nothing is paused on the title, so its Back
     button closes the card instead of going to the pause menu's first screen. */
  $('#titleOptionsBtn').onclick=()=>{showInfo(false);renderOptions();showPauseScreen('options');pauseBox.hidden=false};
  pauseBox.addEventListener('click',e=>{if(optOpen()&&e.target.id==='pOptBack'){e.stopPropagation();stopListening();optClose()}},true);
  addEventListener('keydown',e=>{if(e.key!=='Escape'||S.started)return;if(optOpen()){stopListening();optClose()}else if(!info.hidden)showInfo(false)});
}
