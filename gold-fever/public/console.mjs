import {COMMANDS,DESTINATIONS} from '/shared/console.mjs';

export function createConsole({onOpen,onClose,onCommand,getState,getRules}){
  const panel=document.createElement('section');panel.id='dev-console';panel.hidden=true;panel.setAttribute('aria-label','Hidden game console');
  panel.innerHTML='<header><strong>GOLDFIELD CONSOLE</strong><span>~ / Esc closes · help lists commands</span></header><div id="console-log" role="log" aria-live="polite"></div><form id="console-form" autocomplete="off"><label for="console-input">›</label><input id="console-input" spellcheck="false" maxlength="200" aria-label="Console command" placeholder="help"><button type="submit">Run ↵</button></form>';
  document.body.append(panel);const log=panel.querySelector('#console-log'),input=panel.querySelector('input'),history=[];let cursor=0,draft='';
  function write(lines,kind='output'){for(const text of(Array.isArray(lines)?lines:[lines])){const row=document.createElement('div');row.className=`console-${kind}`;row.textContent=text;log.append(row);}while(log.children.length>250)log.firstChild.remove();log.scrollTop=log.scrollHeight;}
  write(['Hidden console ready. Changes to cash, gear and bookmarks are saved in this world.','Try: money 10000 · tp creek · fly on · speed 3 · give all · spawn truck','Type help for the full list. Up/Down history · Tab autocomplete.']);
  function close(){if(panel.hidden)return;panel.hidden=true;input.blur();onClose();}
  function toggle(){if(!panel.hidden){close();return;}onOpen();panel.hidden=false;input.focus({preventScroll:true});}
  panel.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const command=input.value.trim();if(!command)return;history.push(command);if(history.length>100)history.shift();cursor=history.length;draft='';input.value='';write(`› ${command}`,'prompt');if(command.toLowerCase()==='clear'){log.replaceChildren();return;}onCommand(command);input.focus({preventScroll:true});});
  input.addEventListener('keydown',e=>{if((e.code==='Backquote'||e.key==='~'))return;e.stopPropagation();if(e.code==='Escape'){e.preventDefault();close();return;}if(e.code==='ArrowUp'||e.code==='ArrowDown'){e.preventDefault();if(cursor===history.length)draft=input.value;cursor=Math.max(0,Math.min(history.length,cursor+(e.code==='ArrowUp'?-1:1)));input.value=cursor===history.length?draft:history[cursor];input.setSelectionRange(input.value.length,input.value.length);}
    if(e.code==='Tab'){e.preventDefault();const source=input.value,prefix=source.match(/\S*$/)[0].toLowerCase(),tokens=source.trim().split(/\s+/),state=getState(),pool=source.includes(' ')?[...DESTINATIONS,'all','on','off','add','set',...(getRules()?.catalog||[]).map(i=>i.id),...Object.keys(state?.self.consoleMarks||{}),...(state?.players||[]).map(p=>p.id),...(state?.carts||[]).map(c=>c.id),...(state?.machines||[]).map(m=>m.id),...(state?.vehicles||[]).map(v=>v.id)]:COMMANDS;
      const matches=[...new Set(pool)].filter(s=>s.startsWith(prefix));if(matches.length===1)input.value=source.slice(0,source.length-prefix.length)+matches[0]+' ';else if(matches.length)write(matches.join('   '),'hint');}
  });
  return{toggle,close,write,get isOpen(){return !panel.hidden;}};
}
