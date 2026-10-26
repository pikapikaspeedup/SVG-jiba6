/* FLOW 07 — gameplay time, explicit cancel edges and presentation rhythm.
 * The clock is in actionable 60 Hz frames, NOT render callbacks or hitstop.
 * Extra edges are opt-in assets; no whiff cancels, infinite chains or free meter.
 * This module does not start attacks. game.js owns one atomic decision/commit.
 */
'use strict';
(() => {
  const settings = {rhythm:'fluid', speed:1, rules:'flow', buffer:9};
  const profiles = {
    fluid:{label:'连贯节奏',light:4,medium:5,heavy:7,block:3,superStart:18,superMid:2,superEnd:9},
    legacy:{label:'v6 节奏', light:3,medium:5,heavy:7,block:4,superStart:20,superMid:6,superEnd:6},
    weighted:{label:'重心节奏', light:7,medium:9,heavy:12,block:6,superStart:28,superMid:4,superEnd:14}
  };
  const reasons = {
    ready:'可以发动', hitstop:'命中定格中；输入会等待解冻', phase:'当前不在交战阶段',
    captured:'抓取 / 倒地状态不可出招', landing:'等待落地硬直结束', airLock:'当前空中动作尚未允许追击',
    air:'此招需要在空中发动', ground:'此招需要在地面发动', health:'CA 需要生命不高于 25%',
    super:'超级能量不足', drive:'斗气不足', burnout:'疲劳状态不能消耗斗气',
    confirm:'等待命中或防御确认', recovery:'不能取消到此招；可在收招后目押',
    window:'取消窗口已结束；等待收招', branch:'不符合派生招式的前置条件',
    reversal:'斗气反击仅在防御硬直中使用', chain:'额外连携次数已达上限',
    hitOnly:'此连携只允许命中取消，防御时不开放', follow:'追投窗口尚未开放', unknown:'未知招式'
  };
  const age = (G,a) => !a ? Infinity : Number.isFinite(a.confirmFrame) && Number.isFinite(G.actionTick)
    ? Math.max(0,G.actionTick-a.confirmFrame) : Math.max(0,G.tick-(a.confirmTick??-1e9));
  function validate(data,record) {
    if(data===undefined)return;
    const fail=s=>{throw TypeError('连携规则：'+s);};
    if(!data||data.version!==1||!Array.isArray(data.edges)||data.edges.length>12)fail('需要 version:1 和最多 12 条 edges');
    if(record?.gameId?.startsWith('@')&&data.edges.length)fail('状态动作不能声明攻击取消');
    const live=globalThis.SVG_FIGHTER?.moves?.[record?.character]?.find(m=>m.id===record?.gameId);
    if(data.edges.length&&(record?.category==='super'||/^(SA[123]|CA|throw|backthrow|airthrow)$/.test(record?.gameId||'')||live?.super||live?.throw))fail('超级必杀或投技不能作为额外连携的起点');
    const names=new Set();
    for(const e of data.edges){
      if(!e||typeof e.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(e.id)||names.has(e.id))fail('边 ID 无效或重复');names.add(e.id);
      if(!Array.isArray(e.targets)||!e.targets.length||e.targets.length>16||new Set(e.targets).size!==e.targets.length||e.targets.some(x=>typeof x!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(x)))fail('目标招式无效或重复');
      if(!['hit','contact'].includes(e.on))fail('必须以 hit 或 contact 确认，不支持挥空取消');
      for(const [key,lo,hi] of [['start',0,20],['end',0,20],['minHits',1,20],['maxChain',1,3]])if(!Number.isInteger(e[key])||e[key]<lo||e[key]>hi)fail(key+' 越界');
      if(e.end<e.start)fail('窗口结束早于开始');
      if(e.label!==undefined&&(typeof e.label!=='string'||e.label.length>80))fail('说明过长');
    }
  }
  function extra(f,m,G) {
    const a=f.attack;
    if(settings.rules!=='flow'||!a||!m||a.m.super||a.m.throw||m.throw||['PAR','RUSH','REV','DI'].includes(m.id))return null;
    const record=INK.Runtime?.record(f,a.m),edges=record?.transitions?.edges||[];
    let failed=null;
    for(const edge of edges){
      if(!edge.targets.includes(m.id))continue;
      let code='ready';
      if(!a.confirmed)code='confirm';
      else if(edge.on==='hit'&&!a.hitConfirmed)code='hitOnly';
      else if((edge.on==='hit'?(a.contactHits??a.hitsDone?.size??0):(a.contactCount??a.hitsDone?.size??0))<edge.minHits)code='confirm';
      else if((a.flowChain||0)>=edge.maxChain)code='chain';
      else if(age(G,a)<edge.start)code='confirm';
      else if(age(G,a)>edge.end||a.t>=a.m.total)code='window';
      const result={ok:code==='ready',kind:'asset-chain',code,edge:edge.id,label:edge.label||edge.id,remaining:Math.max(0,edge.end-age(G,a)),chainDepth:(a.flowChain||0)+1};
      if(result.ok)return result;
      // A later edge may supply a different confirmation gate to the same target.
      if(!failed)failed=result;
    }
    return failed;
  }
  function cancel(f,m,G) {
    const a=f.attack;
    if(!a||!m)return {ok:false,code:'recovery',kind:'link',remaining:0};
    const remaining=Math.max(0,20-age(G,a));
    if(a.confirmed&&age(G,a)<=20){
      if(f.install>0&&m.category==='normal'&&a.m.id!==m.id)return {ok:true,code:'ready',kind:'install',remaining};
      if(a.m.category==='normal'&&a.m.cancel&&['special','super','branch'].includes(m.category))return {ok:true,code:'ready',kind:'special-cancel',remaining};
      if(['special','branch'].includes(a.m.category)&&m.category==='super'&&(m.super===3||a.m.od&&m.super>=2))return {ok:true,code:'ready',kind:'super-cancel',remaining};
    }
    const chain=INK.FlowChain?.decision(f,m,G);if(chain)return chain;
    const custom=extra(f,m,G);if(custom)return custom;
    return {ok:false,code:!a.confirmed?'confirm':age(G,a)>20?'window':'recovery',kind:'link',remaining};
  }
  const Tempo={settings,profiles,reasons,age,validateTransitions:validate,cancel,
    stats:{ticks:0,action:0,freeze:0,slow:0,other:0}, events:[],
    record(G,type){this.stats.ticks++;this.stats[type]=(this.stats[type]||0)+1;},
    contact(G,m,result,last,context={}){
      const p=profiles[settings.rhythm];
      const n=result==='block'?p.block:m.super?(last?p.superEnd:p.superMid):m.hits>1&&!last&&settings.rhythm==='fluid'?Math.min(3,m.level>=2?3:2):m.hits>1&&!last&&settings.rhythm==='weighted'?Math.min(5,m.level>=2?5:4):m.level>=3?p.heavy:m.level===2?p.medium:p.light;
      let freeze=n;
      if(INK.Kinetic?.settings.enabled&&settings.rhythm!=='legacy'){
        const intermediate=(m.hits||1)>1&&!last;
        if(result==='hit'&&!intermediate){freeze+=m.super?2:m.level>=3?2:m.level===1?-1:0;freeze+=context.punish?2:context.counter?1:0;}
        if(result==='block'&&m.level>=3)freeze+=1;
        freeze=Math.max(2,Math.min(18,freeze));
      }
      this.events.push({tick:G.tick,actionFrame:G.actionTick||0,move:m.id,result,last:!!last,freeze,profile:settings.rhythm});if(this.events.length>120)this.events.shift();return freeze;
    },
    superStart(m){return profiles[settings.rhythm].superStart+(m.ca?6:0);},
    set(patch){
      for(const [k,v] of Object.entries(patch)){
        if(k==='rhythm'&&!Object.hasOwn(profiles,v)||k==='rules'&&!['flow','legacy'].includes(v)||k==='speed'&&![.5,.75,.85,1].includes(v)||k==='buffer'&&![3,6,9,12].includes(v)||!['rhythm','rules','speed','buffer'].includes(k))throw TypeError('不支持的节奏设置 '+k);
      }
      const changeSpeed=patch.speed!==undefined&&patch.speed!==settings.speed;
      Object.assign(settings,patch);if(INK.Input)INK.Input.window=settings.buffer;if(changeSpeed)INK.EngineClock?.reset();
      // An explicit mode/buffer switch cannot leave a request from old rules armed.
      if(patch.rules!==undefined||patch.buffer!==undefined){for(const f of globalThis.SVG_FIGHTER?.fighters||[])INK.Input?.reset(f);if(INK.Combo)INK.Combo.pending=null;}
      return {...settings};
    },
    resetStats(){this.stats={ticks:0,action:0,freeze:0,slow:0,other:0};this.events=[];},
    inspect(){return {settings:{...settings},...this.stats,freezeRatio:this.stats.ticks?this.stats.freeze/this.stats.ticks:0,clock:INK.EngineClock?.inspect()};}
  };
  INK.CombatFlow=Tempo;
})();
