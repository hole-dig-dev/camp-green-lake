#!/usr/bin/env node
// Render a review reel from the game's actual Web Audio graph and shipped CC0 clips.
// Usage: node scripts/render-audio-showcase.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'docs/audio-showcase.mp3');
const SHEET=path.join(ROOT,'docs/audio-showcase.md');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cgl-audio-reel-'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error(`${cmd} failed: ${r.stderr}`);return r.stdout}
function duration(file){return +run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file]).trim()}
function firstSound(file){
  const r=spawnSync('ffmpeg',['-v','error','-i',file,'-f','f32le','-ac','1','-ar','22050','-'],{maxBuffer:16*1024*1024});
  if(r.status!==0)throw Error(`Cannot decode ${file}: ${r.stderr}`);
  const b=r.stdout,window=441;
  for(let i=0;i+window*4<=b.length;i+=window*4){
    let sum=0;for(let j=0;j<window;j++){const v=b.readFloatLE(i+j*4);sum+=v*v}
    if(Math.sqrt(sum/window)>0.000316)return Math.max(0,i/4/22050-0.04);
  }
  return null;
}
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})}
async function health(port){for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${port}/healthz`)).ok)return}catch{}await wait(100)}throw Error('preview server did not start')}
const items=[];
function add(group,label,file,seconds,gain=1,offset=0){items.push({group,label,file,seconds,gain,offset})}
function source(label,file,seconds,group='Recordings',gain=1){add(group,label,path.join(ROOT,'public/audio',file),seconds,gain)}

let server,browser,success=false;
try{
  const port=await freePort();
  server=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,PORT:String(port),DEV_MODE:'1',DATA_DIR:path.join(tmp,'data')},stdio:'ignore'});
  await health(port);
  console.log('Preview server ready');
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  console.log('Chromium started');
  const page=await browser.newPage({viewport:{width:800,height:600}});
  await page.goto(`http://127.0.0.1:${port}/?r=1#dbg`);
  console.log('Game page loaded');
  await page.waitForFunction(()=>!!window.__cgl,null,{polling:100});
  await page.evaluate(()=>document.querySelector('#startBtn').click());
  await page.waitForFunction(()=>!document.querySelector('#hud').hidden,null,{polling:100});
  console.log('Game started');
  await page.evaluate(async()=>{
    // The host display denies this account iGPU access. Keep game timing and Web Audio,
    // but skip every 3D draw while making an audio-only review file.
    renderer.render=()=>{};
    await AC.resume();setAudioMode('all','original');
    windNoiseGain.disconnect();rainGain.disconnect();
    // Keep scene updates from fading demonstration-only hazard loops.
    updateAudioScene=()=>{};updateNightSound=()=>{};
  });
  async function capture(group,label,kind,seconds=1.4){
    const file=path.join(tmp,`capture-${items.length}.webm`);
    let offset=null;
    for(let attempt=1;attempt<=4;attempt++){
    const data=await page.evaluate(async({kind,seconds})=>{
      const dest=AC.createMediaStreamDestination();master.connect(dest);
      const rec=new MediaRecorder(dest.stream),chunks=[];
      rec.ondataavailable=e=>chunks.push(e.data);
      await AC.resume();
      await new Promise(r=>{rec.onstart=r;rec.start()});
      await new Promise(r=>setTimeout(r,650));
      let reset=()=>{};
      switch(kind){
        case 'scoop-old':setAudioMode('dig','original');sfx.scoop();break;
        case 'scoop-new':setAudioMode('dig','recorded');sfx.scoop();break;
        case 'clank-old':setAudioMode('metal','original');sfx.clank();break;
        case 'clank-new':setAudioMode('metal','recorded');sfx.clank();break;
        case 'rain-old':rainGain.connect(fxBus);rainGain.gain.value=0.18;reset=()=>rainGain.disconnect();break;
        case 'twister':twSound(1);twWind.gain.value=0.6;reset=()=>twWind.gain.value=0;break;
        case 'tumbleweed':tbSound(1);tbWind.gain.value=0.5;reset=()=>tbWind.gain.value=0;break;
        case 'haboob':hbSound(1);hbWind.gain.value=0.5;reset=()=>hbWind.gain.value=0;break;
        case 'landslide':lsSound(1);lsRumbleNode.gain.value=0.55;reset=()=>lsRumbleNode.gain.value=0;break;
        case 'sinkhole':sinkSound(1);sinkRumbleNode.gain.value=0.6;reset=()=>sinkRumbleNode.gain.value=0;break;
        case 'zeroni-drone':loops();LOOP.drone.gain.value=0.16;LOOP.whisper.gain.value=0.05;reset=()=>{LOOP.drone.gain.value=0;LOOP.whisper.gain.value=0};break;
        case 'disco':startMusic();reset=()=>stopMusic();break;
        case 'find':sfx.find();break;
        case 'gold':sfx.gold();break;
        case 'coin':sfx.coin();break;
        case 'beep':sfx.beep(0.8);break;
        case 'hiss':sfx.hiss();break;
        case 'bite':sfx.bite();break;
        case 'shout':sfx.shout();break;
        case 'splash':sfx.splash();break;
        case 'thud':sfx.thud();break;
        case 'vulture':vScreech(true);break;
        case 'javelina-squeal':javSqueal(true);break;
        case 'javelina-snort':javSnort();break;
        case 'lion-roar':roar();break;
        case 'lion-growl':lionLoop();LGROWL.g.gain.value=0.05;reset=()=>LGROWL.g.gain.value=0;break;
        case 'lion-heartbeat':tone(58,0.14,'sine',0.28,42);setTimeout(()=>tone(52,0.16,'sine',0.22,38),160);break;
        case 'lion-target':tone(60,0.5,'sine',0.15,45);break;
        case 'lion-pounce':tone(200,0.15,'sawtooth',0.08,700);break;
        case 'lion-swat':tone(320,0.08,'square',0.05,180);break;
        case 'curfew':siren();break;
        case 'patrol-arrival':tone(200,1.2,'sawtooth',0.08,120);break;
        case 'spot':tone(900,0.4,'square',0.06,1400);setTimeout(()=>tone(900,0.4,'square',0.06,1400),450);break;
        case 'zeroni-sting':zeroniSting();break;
        case 'jumpscare':jumpScare();break;
        case 'cards':cardSnd();break;
        case 'flashlight':tone(1800,0.05,'square',0.05);break;
        case 'flashlight-off':tone(1200,0.05,'square',0.05);break;
        case 'onion':tone(220,0.3,'triangle',0.1,160);break;
        case 'chat':tone(700,0.06,'triangle',0.05);break;
        case 'landslide-warning':tone(1500,1.3,'sine',0.16,260);noise(0.7,2400,0.6,0.13,'highpass');break;
        default:throw Error(`unknown cue: ${kind}`);
      }
      await new Promise(r=>setTimeout(r,seconds*1000));reset();
      const done=new Promise(r=>rec.onstop=r);rec.stop();await done;master.disconnect(dest);
      const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let s='';
      for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.slice(i,i+8192));
      return btoa(s);
    },{kind,seconds});
    fs.writeFileSync(file,Buffer.from(data,'base64'));
    offset=firstSound(file);
    if(offset!==null)break;
    if(attempt===4)throw Error(`Silent capture after four attempts: ${label}`);
    console.warn(`Retrying silent capture: ${label}`);
    }
    add(group,label,file,seconds,1,offset);
    console.log(label);
  }

  // Old/new comparisons use the exact audio functions and mix settings in the game.
  add('A/B comparisons','Wind A: original',path.join(ROOT,'docs/audio-ab/wind-old.webm'),4);
  add('A/B comparisons','Wind B: recorded',path.join(ROOT,'docs/audio-ab/wind-new.webm'),4);
  await capture('A/B comparisons','Rain A: original','rain-old',3.5);
  source('Rain B: recorded','rain.mp3',3.5,'A/B comparisons',0.33);
  await page.waitForFunction(()=>audioBuffers.has('shovel')&&audioBuffers.has('metalClick'),null,{polling:100});
  await capture('A/B comparisons','Dig A: original','scoop-old');
  await capture('A/B comparisons','Dig B: recorded','scoop-new');
  await capture('A/B comparisons','Metal A: original','clank-old');
  await capture('A/B comparisons','Metal B: recorded','clank-new');

  source('Day birds','birds.mp3',4,'Background ambience',0.24);
  source('Night crickets','crickets.mp3',4,'Background ambience',0.43);
  for(const [kind,file] of [['Sand step 1','step-sand-1.mp3'],['Sand step 2','step-sand-2.mp3'],['Sand step 3','step-sand-3.mp3'],['Stone step 1','step-stone-1.mp3'],['Stone step 2','step-stone-2.mp3'],['Stone step 3','step-stone-3.mp3']])source(kind,file,0.85,'Footsteps',0.4);
  for(const [kind,file] of [['Tent cloth 1','cloth1.mp3'],['Bunk cloth 2','cloth2.mp3'],['House door open','doorOpen_1.mp3'],['House door close','doorClose_1.mp3']])source(kind,file,1.3,'Tent and house',0.45);

  for(const [label,kind,seconds] of [
    ['Twister wind','twister',2.6],['Tumbleweed gust','tumbleweed',2.6],['Haboob wind','haboob',2.6],
    ['Landslide warning','landslide-warning',1.8],['Landslide rumble','landslide',2.6],['Sinkhole rumble','sinkhole',2.6],
    ['Vulture screech','vulture',1.2],['Javelina squeal','javelina-squeal',1.2],['Javelina snort','javelina-snort',1.2],
    ['Lion growl','lion-growl',2.2],['Lion target warning','lion-target',1.1],['Lion pounce rise','lion-pounce',1.1],
    ['Lion roar','lion-roar',1.3],['Lion swat','lion-swat',1.1],['Lion heartbeat','lion-heartbeat',1.2],
    ['Lizard hiss','hiss',1.2],['Lizard bite','bite',1.2],
  ])await capture('Hazards and wildlife',label,kind,seconds);
  for(const [label,kind,seconds] of [
    ['Curfew siren','curfew',5.2],['Patrol arrival','patrol-arrival',1.6],['Police spotting beeps','spot',1.5],['Zeroni drone and whisper','zeroni-drone',3.3],
    ['Zeroni sting','zeroni-sting',2.8],['Jumpscare','jumpscare',1.4],
  ])await capture('Night and patrol',label,kind,seconds);
  for(const [label,kind,seconds] of [
    ['Ordinary find','find',1.2],['Important find or level up','gold',1.6],['Seeds or coin','coin',1.1],
    ['Detector beep','beep',1.1],['Shout','shout',1.1],['Canteen splash','splash',1.1],['Impact or damage','thud',1.1],
    ['Card click','cards',1.1],['Flashlight on','flashlight',1.1],['Flashlight off','flashlight-off',1.1],
    ['Onion use','onion',1.1],['Chat notification','chat',1.1],
  ])await capture('Game cues',label,kind,seconds);
  await capture('Music','Disco party loop','disco',8);

  let at=0;const lines=['# Camp Green Lake audio A/B reel','','[Download the single MP3](audio-showcase.mp3). It includes every fixed sound family in the game. A/B means previous game audio followed by the new option. Recordings are CC0; synthesized cues were captured from the running game. Cue times are approximate and include a short pause between sounds.','','| Time | Section | Sound |','| --- | --- | --- |'];
  const concat=[];
  for(let i=0;i<items.length;i++){
    const x=items[i],d=Math.min(x.seconds,duration(x.file)-x.offset),total=x.seconds+0.3;
    const wav=path.join(tmp,`${String(i).padStart(2,'0')}.wav`);
    run('ffmpeg',['-y','-loglevel','error','-i',x.file,'-af',`atrim=start=${x.offset}:duration=${d},asetpts=PTS-STARTPTS,volume=${x.gain},apad=pad_dur=${total-d}`,'-t',String(total),'-ar','44100','-ac','2','-c:a','pcm_s16le',wav]);
    concat.push(`file '${wav}'`);
    const mm=String(Math.floor(at/60)).padStart(2,'0'),ss=(at%60).toFixed(1).padStart(4,'0');
    lines.push(`| ${mm}:${ss} | ${x.group} | ${x.label} |`);
    at+=total;
  }
  const list=path.join(tmp,'concat.txt');fs.writeFileSync(list,concat.join('\n')+'\n');
  run('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',list,'-af','alimiter=limit=0.95','-c:a','libmp3lame','-q:a','3',OUT]);
  lines.push('','The old game had no birds, crickets, footsteps, or tent/house/bunk Foley, so those A-side cues would be silence. The reel covers every shipped recording and the distinct synthesized sound families. Live player microphone chat and browser text-to-speech vary by player and browser and cannot be fixed into one representative game recording. The old police-car engine and siren loops are inactive in the current walking-patrol game.','');
  fs.writeFileSync(SHEET,lines.join('\n'));
  success=true;
  console.log(`Wrote ${OUT} (${Math.round(at)} seconds, ${items.length} cues)`);
}finally{
  if(browser)await browser.close();
  if(server)server.kill();
  if(success)fs.rmSync(tmp,{recursive:true,force:true});
  else console.error(`Audio capture files retained for inspection: ${tmp}`);
}
