/* Ordered external commands at simulation-step boundaries. This is transport,
 * not the move buffer: rejected moves still reach the game's normal rules.
 * The caller supplies the same executor for live input and playback.
 */
'use strict';
(() => {
 const buttons=new Set(['up','down','left','right','LP','MP','HP','LK','MK','HK','PP','KK','PAR','DI','RUSH','THROW']);
 const slots=new Set(['special','special2','special3','special4','SA1','SA2','SA3']);
 const copy=v=>JSON.parse(JSON.stringify(v));
 function object(v,allowed){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw TypeError('无效输入命令字段');}
 const actor=v=>{if(v!==0&&v!==1)throw TypeError('输入角色必须是 0 或 1');};
 const list=v=>{if(!Array.isArray(v)||v.length>buttons.size||new Set(v).size!==v.length||v.some(x=>!buttons.has(x)))throw TypeError('无效输入按钮');};
 function validate(command){
  const c=command;object(c,['type','actor','press','release','id','buffer','slot']);
  switch(c.type){
   case 'buttons':object(c,['type','actor','press','release']);actor(c.actor);list(c.press);list(c.release);if(!c.press.length&&!c.release.length)throw TypeError('空输入命令');break;
   case 'move':object(c,['type','actor','id','buffer']);actor(c.actor);if(typeof c.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(c.id)||typeof c.buffer!=='boolean')throw TypeError('无效招式命令');break;
   case 'assist':object(c,['type','actor','slot']);actor(c.actor);if(!slots.has(c.slot))throw TypeError('无效辅助命令');break;
   case 'retreat':object(c,['type','actor']);actor(c.actor);break;
   case 'neutral':object(c,['type']);break;
   default:throw TypeError('未知输入命令');
  }
  return copy(c);
 }
 class CommandStream {
  constructor({maxTicks=3600,maxCommands=12000,maxPerTick=128}={}){
   for(const n of [maxTicks,maxCommands,maxPerTick])if(!Number.isSafeInteger(n)||n<1)throw TypeError('输入容量必须是正整数');
   this.limits=Object.freeze({maxTicks,maxCommands,maxPerTick});this.reset();
  }
  reset(){if(this.executing)throw Error('不能在执行命令期间重置输入流');this.mode='idle';this.tick=0;this.pending=[];this.events=[];this.cursor=0;this.executing=false;this.failure=null;}
  begin(){this.reset();this.mode='record';}
  fail(message){this.failure=message;this.mode='failed';this.pending=[];throw Error(message);}
  seal(message){this.failure=message;this.mode='sealed';this.pending=[];throw Error(message);}
  submit(command){
   if(this.executing)throw Error('不能把命令执行产生的内部请求再次录入');
   const c=validate(command);
   if(this.mode==='playback')return false;
   if(this.mode!=='record')throw Error('输入流未在录制');
   if(this.tick>=this.limits.maxTicks||this.events.length+this.pending.length>=this.limits.maxCommands||this.pending.length>=this.limits.maxPerTick)this.seal('输入记录达到容量上限；已保留最后完整边界');
   this.pending.push(c);return true;
  }
  load(data){
   // Validate fully before replacing a usable recording.
   object(data,['version','ticks','events']);
   if(data.version!==1||!Number.isSafeInteger(data.ticks)||data.ticks<0||data.ticks>this.limits.maxTicks||!Array.isArray(data.events)||data.events.length>this.limits.maxCommands)throw TypeError('无效输入时间轴');
   let previous=0,order=-1;const events=[];
   for(const e of data.events){object(e,['tick','order','command']);
    if(!Number.isSafeInteger(e.tick)||e.tick<1||e.tick>data.ticks||e.tick<previous||e.order!==(e.tick===previous?order+1:0)||e.order>=this.limits.maxPerTick)throw TypeError('输入事件顺序无效');
    events.push({tick:e.tick,order:e.order,command:validate(e.command)});previous=e.tick;order=e.order;
   }
   this.reset();this.mode='playback';this.events=events;this.endTick=data.ticks;
  }
  advance(execute){
   if(typeof execute!=='function'||this.executing)throw TypeError('输入执行器无效或重入');
   if(!['record','playback'].includes(this.mode))return false;
   if(this.mode==='playback'&&this.tick===this.endTick)return false;
   if(this.tick>=this.limits.maxTicks)this.seal('输入记录达到时间上限；已保留最后完整边界');
   const tick=this.tick+1;
   const batch=this.mode==='record'?this.pending.map((command,order)=>({tick,order,command})):[];
   if(this.mode==='playback'){let i=this.cursor;while(this.events[i]?.tick===tick)batch.push(this.events[i++]);}
   this.executing=true;
   try{for(const e of batch)execute(copy(e.command),{tick,order:e.order});}
   catch(error){this.mode='failed';this.failure='命令执行失败：'+error.message;this.pending=[];throw error;}
   finally{this.executing=false;}
   if(this.mode==='record'){this.events.push(...batch);this.pending=[];}else this.cursor+=batch.length;
   this.tick=tick;return true;
  }
  export(){if(this.executing)throw Error('命令执行尚未结束');if(this.mode==='failed')throw Error(this.failure);if(this.pending.length)throw Error('存在尚未执行的输入，请先推进模拟步');return {version:1,ticks:this.tick,events:copy(this.events.filter(e=>e.tick<=this.tick))};}
  inspect(){return {mode:this.mode,tick:this.tick,pending:this.pending.length,commands:this.events.length,failure:this.failure};}
 }
 INK.CommandStream=CommandStream;INK.CommandSchema=Object.freeze({validate});
})();
