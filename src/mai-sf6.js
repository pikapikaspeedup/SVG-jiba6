/* Mai's SF6 rules. Timings/damage are deliberately tuned for this SVG game,
 * not a frame-data emulator. Legacy save IDs remain stable:
 * ryuenbu = Hishou Ryuuenjin; hissatsu = Ryuuenbu.
 * Reference: Capcom, 2025-02-06, https://www.capcomfrance.fr/sortie-mai/
 */
(() => {
'use strict';
const fmt=s=>({236:'↓↘→',214:'↓↙←',623:'→↓↘',236236:'↓↘→↓↘→',214214:'↓↙←↓↙←'}[s]||s);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const FAN_GAP=20;
const spec={
 kachosen:{name:'花蝶扇',motion:'236',button:'P',contactPart:'fan',kind:'projectile',pose:'wave',note:'按住 P 蓄力：扇子不能被拳脚击落；接触后弹起再落下。OD 蓄力版先连续投出两把，第二次出手后 → + P 接乱花蝶扇，再同时追加两把；三次投掷动作，共四把扇。'},
 ryuenbu:{name:'飞翔龙炎阵',motion:'623',button:'K',contactPart:'foot',kind:'upper',pose:'upper',note:'收膝起跳、上升踢击、后空翻收势。不是拳升龙，也不是龙炎舞。'},
 hissatsu:{name:'龙炎舞',motion:'214',button:'P',contactPart:'fan',kind:'spin',pose:'punch',note:'横向转身挥扇，火焰围绕扇面铺开；与飞翔龙炎阵的垂直踢击区分。'},
 shinobibachi:{name:'必杀忍蜂',motion:'236',button:'K',contactPart:'elbow',kind:'rush',pose:'punch',note:'侧手翻起势后以肘部前冲。OD 命中后反弹腾空，可以接空中特殊技或 SA2。'},
 musabi:{name:'鼯鼠之舞',motion:'214',button:'P',contactPart:'body',kind:'dive',pose:'punch',air:true,note:'空中 ↓↙← + P；缩身后斜向俯冲，以身体撞击，不是俯冲踢。'}
};
function configure(chars,moves,bases){
 const c=chars.find(c=>c.id==='mai');
 c.trait='FLAME STOCK · 阳炎之舞补充5枚火焰';
 c.style='不知火流忍术 / 扇、火焰、空中肘击';
 for(const d of bases.mai){const v=spec[d[0]];if(!v)continue;d[1]=v.name;d[2]=v.motion;d[3]=v.button;d[4]=v.kind;d[5]=v.pose;d[9]={...(d[9]||{}),contactPart:v.contactPart,air:!!v.air,weaponReach:v.contactPart==='fan'?38:0};}
 for(const m of moves.mai){
  if(m.category==='special'&&spec[m.base]){
   const v=spec[m.base],s=m.strength||0;
   Object.assign(m,v,{name:(m.od?'OD ':['轻·','中·','重·'][s])+v.name,weaponReach:v.contactPart==='fan'?38:0,cmd:(v.air?'空中 ':'')+fmt(v.motion)+' + '+(m.od?v.button+v.button:v.button),air:!!v.air});
   if(m.base==='kachosen')Object.assign(m,{startup:[14,15,16,12][s],active:6,recovery:[18,20,24,21][s],hits:m.od?2:1,damage:[580,640,710,900][s],knockdown:false,fanChargeable:true,fanCharged:false,travel:0,speed:[7.4,11,16.5,12.5][s]});
   if(m.base==='ryuenbu')Object.assign(m,{startup:[5,7,9,6][s],active:[17,20,24,24][s],recovery:[22,25,29,28][s],hits:m.od?3:2,launch:-12,travel:2.1,invuln:m.od?17:0,knockdown:true});
   if(m.base==='hissatsu')Object.assign(m,{startup:[14,14,15,12][s],active:[15,20,22,25][s],recovery:[15,19,12,22][s],hits:[1,2,2,3][s],travel:[1.2,1.7,2.1,2.6][s],knockdown:s>0,...(s===2?{launchLast:-15}:{})});
   if(m.base==='shinobibachi')Object.assign(m,{startup:[10,18,20,14][s],active:18,recovery:[22,25,28,23][s],hits:m.od?2:1,travel:[7.5,9.2,11,11.2][s],knockdown:true});
   if(m.base==='musabi')Object.assign(m,{startup:[10,12,14,9][s],active:24,recovery:18,hits:m.od?2:1,travel:0,knockdown:true});
  }
  if(m.super){
   const lv=m.super;
   Object.assign(m,{motion:lv===3?'214214':'236236',button:lv===2?'K':'P',airAllowed:lv===2,air:false,weaponReach:0,projectileStyle:undefined});
   m.name=(m.ca?'CRITICAL ART · ':'')+['','阳炎之舞','超必杀忍蜂','不知火流·炎舞仇樱'][lv];
   m.cmd=(m.ca?'生命≤25% · ':'')+fmt(m.motion)+' + '+m.button+(lv===2?'（地面 / 空中）':'');
   if(lv===1)Object.assign(m,{kind:'burst',pose:'guard',contactPart:'pillar',geometry:'pillar',travel:0,range:230,startup:8,active:42,recovery:27,hits:5,damage:1900,knock:12,launch:0,note:'近身双侧火柱；收势完成后火焰库存补至5枚。库存强化后续必杀及SA1/SA2，每次消耗1枚。'});
   if(lv===2)Object.assign(m,{kind:'superrush',pose:'punch',contactPart:'elbow',travel:14,range:285,startup:9,active:45,recovery:28,hits:5,damage:2850,projectileImmune:true,note:'地面或空中双波动 + K；翻身接火焰肘击，可穿过飞行道具。'});
   if(lv===3)Object.assign(m,{kind:'superrush',pose:'punch',contactPart:'fan',weaponReach:38,travel:13,range:275,startup:12,active:88,recovery:27,hits:8,damage:m.ca?4600:3900,note:'双反摇 + P；扇舞、交叉切击和升空终结。低生命自动升级CA；不消耗火焰库存。'});
  }
  if(m.category==='branch'){
   // The user's extra routes are retained, but never presented as official SF6 moves.
   m.note='同人扩展派生（非官方招式表）。'+m.note;
   if(m.kind==='upper'){m.contactPart='foot';m.weaponReach=0;}
   if(m.kind==='rush'){m.contactPart='elbow';m.weaponReach=0;}
   if(m.kind==='dive'){m.contactPart='body';m.weaponReach=0;}
  }
  m.total=m.startup+m.active+m.recovery;
 }
 // Route-relevant Mai normals use the published SF6 frame data as a starting
 // point; the SVG engine still owns its own geometry and hitstop model.
 const normals={sLP:{startup:4,active:3,recovery:7,stun:17},cLP:{startup:4,active:3,recovery:7,stun:13},sHP:{startup:9,active:3,recovery:21,stun:24},cMP:{startup:6,active:4,recovery:15,stun:23}};
 for(const [id,timing] of Object.entries(normals)){const m=moves.mai.find(x=>x.id===id);if(m){Object.assign(m,timing);m.total=m.startup+m.active+m.recovery;}}
 const heavyKick=moves.mai.find(m=>m.id==='sHK');
 if(heavyKick)moves.mai.push({...heavyKick,id:'bHK',name:'星孔雀',cmd:'← + HK / ← + O',startup:8,active:5,recovery:20,total:33,damage:800,stun:29,blockstun:23,cancel:false,forceStand:true,note:'后重脚，命中时迫使对手站立；绿冲后可接蹲中拳。'});
 const add=(id,source,values)=>{if(!source)return;const m={...source,...values,id};m.total=m.startup+m.active+m.recovery;moves.mai.push(m);};
 const medium=moves.mai.find(m=>m.id==='sMP'),lightKick=moves.mai.find(m=>m.id==='sLK'),throwMove=moves.mai.find(m=>m.id==='throw');
 add('fMP',medium,{name:'扇骨打',category:'unique',cmd:'→ + MP / → + K',kind:'punch',height:'overhead',startup:20,active:3,recovery:18,damage:600,stun:23,blockstun:18,fanClosed:true,cancel:false,note:'折扇举至头顶后下敲；必须站立防御。绿冲命中后可接蹲中拳。'});
 add('hien2',lightKick,{name:'飞燕连脚·二段',category:'branch',from:'sLK',followBtn:'LK',cmd:'站立 LK → LK / U → U',startup:7,active:2,recovery:20,damage:400,stun:25,blockstun:12,forceStand:true,cancel:false,knockdown:false,note:'站立轻脚确认后再按轻脚，换腿追踢；继续轻脚进入腾空第三段。'});
 add('hien3',lightKick,{name:'飞燕连脚·三段',category:'branch',from:'hien2',followBtn:'LK',cmd:'站立 LK → LK → LK / U → U → U',startup:10,active:3,recovery:28,damage:500,stun:30,blockstun:18,launch:-7,knockdown:true,cancel:false,note:'腾空回旋踢；确认后动作第18—33帧可接鼯鼠之舞或空中SA2。'});
 add('hoshi2',heavyKick,{name:'星孔雀·二段',category:'branch',from:'bHK',followBtn:'HK',cmd:'← + HK → HK / ← + O → O',startup:9,active:4,recovery:38,damage:1200,stun:32,blockstun:22,launch:-12,knockdown:true,cancel:false,note:'星孔雀确认后追加翻身上踢，击飞终结；墙角可继续追击。'});
 add('airthrow',throwMove,{name:'梦樱·空中投',cmd:'空中近身 LP + LK / V',kind:'airthrow',air:true,range:145,damage:1200,throwStyle:'fan-vault',note:'双方都在空中时抓握翻身摔落；需近身，不能从地面抓住跳跃中的对手。'});
 const names={sLP:'扇柄突',sMP:'扇子突',sHP:'大扇打',sLK:'飞燕脚',sMK:'舞蹴击',sHK:'背身蹴',cLP:'低扇突',cMP:'背肘击',cHP:'回转扇打',cLK:'贴地轻蹴',cMK:'捌脚',cHK:'反扫蹴',aLP:'翔扇打',aMP:'天仰扇',aHP:'扇刃下刺',aLK:'翔脚',aMK:'空中前蹴',aHK:'隼蹴击'};
 for(const m of moves.mai)if(names[m.id])m.name=names[m.id];
 const elbow=moves.mai.find(m=>m.id==='cMP');if(elbow){elbow.contactPart='elbow';elbow.weaponReach=0;}
 const od=moves.mai.find(m=>m.id==='kachosen_3');
 moves.mai.push({...od,id:'midare',base:'kachosen',name:'乱花蝶扇',category:'followup',cmd:'OD 蓄力花蝶扇两次出手后 → + P',kind:'fan_follow',fanChargeable:false,cost:0,startup:6,active:14,recovery:20,total:40,hits:1,damage:0,note:'先按住两枚拳键释放 OD 花蝶扇，连续投出两把；第二次出手后前＋拳，第三次动作同时追加两把。追加扇接触后分高低轨迹弹起、落下；全程四把扇，不再额外消耗斗气。'});
}
function start(f,m){
 if(f.ch.id!=='mai')return m;
 if((m.category==='special'||m.super===1||m.super===2)&&f.flameStock>0){
  f.flameStock--;m.flameEnhanced=true;m.damage=Math.round(m.damage*1.12);m.stun+=4;m.blockstun+=2;
  if(['kachosen','ryuenbu','hissatsu','shinobibachi'].includes(m.base))m.hits++;
  if(m.base==='ryuenbu')m.invuln=Math.max(m.invuln||0,8);
 }
 return m;
}
function holdTick(f){
 const a=f.attack,m=a?.m;if(f.ch.id!=='mai'||!m?.fanChargeable||a.projectileSent||a.t<m.startup-2)return false;
 if(a.fanChargeResolved)return false;
 const down=['LP','MP','HP','PP'].some(b=>f.input.held.has(b));
 a.fanChargeTicks=(a.fanChargeTicks||0)+(down?1:0);
 if(down&&a.fanChargeTicks<20){a.fanCharging=true;return true;}
 a.fanCharging=false;a.fanChargeResolved=true;
 if(a.fanChargeTicks>=20){m.fanCharged=true;m.hits=m.od?(m.flameEnhanced?4:2):(m.flameEnhanced?3:2);m.damage=Math.round(m.damage*1.24);m.knockdown=!m.od;m.stun=Math.max(m.stun,37);m.knock=9;a.fanReady=true;
  // The held OD uses a separate two-release clip. No FX have begun at this
  // pre-release frame, so its timeline can bind before either throw occurs.
  if(m.od){a._inkTimeline=null;a._inkCursor=null;}
 }
 return false;
}
// A held OD cast releases two independently simulated fans; a normal cast
// remains one projectile with an optional falling follow-up.
function fanShots(f,m,beat=0){
 if(f.ch.id!=='mai'||m.base!=='kachosen')return beat===0?[m]:[];
 if(m.id==='midare')return beat===0?[0,1].map(i=>({...m,kind:'projectile',fanCharged:true,fanFollow:true,fanChargeable:false,flameEnhanced:!!f.maiFollowEnhanced,maiFollowFan:i+1,speed:14,hits:2,damage:500,knockdown:true})):[];
 if(!m.od||!m.fanCharged||m.fanFollow)return beat===0?[m]:[];
 return beat===0||beat===1?[{...m,hits:m.flameEnhanced?2:1,damage:m.damage/2,maiTwin:beat+1}]:[];
}
// The air dive first gathers in the air, then commits to its diagonal path.
// Keep this in the simulation rather than moving the SVG independently of its hitbox.
function beginDive(f,m){
 if(f.ch.id!=='mai'||m.base!=='musabi')return false;
 f.vx=0;f.vy=0;return true;
}
function uniqueInput(f,buttons,getMove,relative){
 if(f.ch.id!=='mai'||buttons.length!==1)return null;
 const button=buttons[0],from=f.attack?.m.id;
 if(button==='LK'&&f.attack?.confirmed&&['sLK','hien2'].includes(from))return getMove(f,from==='sLK'?'hien2':'hien3');
 if(button==='HK'&&from==='bHK'&&f.attack?.confirmed)return getMove(f,'hoshi2');
 if(f.y!==0)return null;
 const direction=relative(f.input.dir,f.intentDir||f.dir);
 return button==='MP'&&direction===6?getMove(f,'fMP'):button==='HK'&&direction===4?getMove(f,'bHK'):null;
}
function airCancel(f,m){
 const a=f.attack;
 return !!(f.ch.id==='mai'&&a?.m.id==='hien3'&&a.confirmed&&a.t>=18&&a.t<=33&&f.y<-8&&(m.base==='musabi'||m.super===2));
}
function finish(f,a,notify){
 if(f.ch.id!=='mai'||a?.m?.id!=='SA1'||a.stockGranted)return;
 a.stockGranted=true;f.flameStock=5;notify(f,'FLAME STOCK · 火焰库存 5 / 5');
}
function canFollow(f,G){
 const a=f.attack;
 return !!(f.ch.id==='mai'&&f.maiFollowUntil&&G.actionTick<=f.maiFollowUntil&&!f.captured&&(!f.state||['idle','attack','recovery'].includes(f.state))&&(!a||a.m.base==='kachosen'&&a.maiSecondFan&&!a.m.fanFollow&&a.m.id!=='midare'));
}
function tick(f,G,spawn,notify){
 if(f.ch.id!=='mai')return;const a=f.attack,m=a?.m;
 if(f.maiFollowUntil&&!canFollow(f,G))f.maiFollowUntil=0;
 if(!a)return;
 if(['hien3','hoshi2'].includes(m.id)&&a.t===m.startup&&!a.maiJumpStarted){
  a.maiJumpStarted=true;f.y=Math.min(-1,f.y);f.vy=m.id==='hien3'?-8.4:-8.8;f.vx=0;f.airLock=true;
 }
 if(m.base==='musabi'){
  if(a.t<m.startup){f.vx=0;f.vy=0;}
  else if(!a.maiDiveStarted){a.maiDiveStarted=true;f.vx=f.dir*10;f.vy=9;}
 }
 if(m.base==='kachosen'&&m.id!=='midare'&&m.od&&m.fanCharged&&a.projectileSent&&a.t>=m.startup+FAN_GAP&&!a.maiSecondFan){
  a.maiSecondFan=true;for(const shot of fanShots(f,m,1))spawn(f,shot);
  f.maiFollowUntil=G.actionTick+32;f.maiFollowEnhanced=!!m.flameEnhanced;
  notify(f,'乱花蝶扇 · 前＋拳追加双扇');
 }
 if(m.id==='midare'&&a.t===m.startup&&!a.maiFollowSent){a.maiFollowSent=true;for(const shot of fanShots(f,m))spawn(f,shot);}
 if(m.base==='shinobibachi'&&m.od&&a.hitConfirmed&&!a.odBounce&&a.t>=m.startup+Math.max(5,m.active-4)){
  a.odBounce=true;SVG_FIGHTER.setState(f,'idle');f.vy=-11.8;f.vx=-f.dir*1.8;f.y=Math.min(f.y,-1);f.airLock=false;f.maiAirFollow=G.actionTick+42;notify(f,'OD 忍蜂 · 腾空追击');
 }
}
function follow(f,bs,G,getMove,request,relative){
 if(!canFollow(f,G)||!bs.some(b=>b.endsWith('P'))||![3,6,9].includes(relative(f.input.dir,f.dir)))return false;
 const m=getMove(f,'midare');if(!m)return false;
 // This is an explicit cancel window, not a global bypass of recovery.
 f.maiFollowCancel=true;const ok=request(f,m,true);f.maiFollowCancel=false;
 if(ok)f.maiFollowUntil=0;return ok||!!f.input.queue.find(q=>q.m.id==='midare');
}
function initShot(s){
 if(s.owner.ch.id!=='mai'||s.m.base!=='kachosen')return;
 s.isMaiFan=true;s.fanCharged=!!s.m.fanCharged;s.vulnerable=!s.fanCharged&&!s.m.od&&!s.m.flameEnhanced;
 s.fanPhase='outbound';s.fanVy=0;s.r=29;s.clashDurability=s.m.flameEnhanced?2:1;
 if(s.m.maiTwin){s.x-=s.dir*(s.m.maiTwin===2?24:0);s.y+=s.m.maiTwin===2?10:-10;}
 if(s.m.fanFollow){s.y-=25;if(s.m.maiFollowFan===2){s.x-=s.dir*10;s.y+=20;}}
}
function moveShot(s){
 if(!s.isMaiFan||s.fanPhase==='outbound')return false;
 s.lockedTarget=null;s.x+=s.dir*s.v;
 s.y+=s.fanVy;s.fanVy+=.45;
 if(s.fanVy>=0)s.fanPhase='falling';
 if(s.y>650)s.life=0;
 return true;
}
function bounce(s,d){
 if(!s.isMaiFan||s.fanPhase!=='outbound'||s.hits<=0)return;
 const bounce=!!s.m.maiFollowFan||(s.m.maiTwin?!!s.m.flameEnhanced:s.fanCharged||s.m.od);
 const outgoingHits=s.m.maiTwin||s.m.maiFollowFan?1:s.m.flameEnhanced?2:1;
 if(!bounce||s.m.hits-s.hits<outgoingHits)return;
 s.lockedTarget=null;s.fanPhase='rising';s.fanVy=s.m.maiFollowFan===2?-10.2:s.m.maiFollowFan===1?-6.8:-7.4;s.v=.7;s.cool=24;
 // The second hit descends physically; it does not attach itself to the opponent.
 s.x=d.x-s.dir*8;
}
function destroyByStrike(s,geometry,overlap){
 if(!s.vulnerable||s.life<=0)return false;
 const b={x:s.x-s.r,y:s.y-s.r,w:s.r*2,h:s.r*2};
 if(geometry.hit.some(h=>overlap(h,b))){s.life=0;return true;}return false;
}
function clash(s,o){
 if(s.vulnerable&&o.vulnerable){s.life=o.life=0;return true;}
 if(s.vulnerable){s.life=0;return true;}if(o.vulnerable){o.life=0;return true;}return false;
}
window.SF6Mai={configure,start,holdTick,fanShots,beginDive,uniqueInput,airCancel,finish,tick,canFollow,follow,initShot,moveShot,bounce,destroyByStrike,clash,spec};
})();
