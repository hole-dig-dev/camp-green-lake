export function createAudio(){
  let ctx=null,enabled=true;
  function start(){if(!ctx){ctx=new AudioContext();}if(ctx.state==='suspended')ctx.resume().catch(()=>{});}
  function tone(freq,time=.1,volume=.035,type='sine',delay=0){if(!ctx||!enabled)return;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,ctx.currentTime+delay);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+delay+time);o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+time);}
  return {start,toggle(){enabled=!enabled;return enabled;},get enabled(){return enabled;},dig(){tone(105,.11,.05,'triangle');tone(68,.09,.035,'sine',.03);},gold(){tone(660,.16);tone(880,.22,.03,'sine',.10);tone(1320,.25,.025,'sine',.20);},buy(){tone(330,.1);tone(440,.12,.035,'triangle',.1);},emote(){tone(270,.13,.02,'square');tone(400,.18,.02,'triangle',.12);}};
}
