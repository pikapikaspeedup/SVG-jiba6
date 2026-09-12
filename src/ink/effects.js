/* INK 2 FX clips. Retained node pool; pure frame evaluation, safe reverse seek.
 * The very same event descriptors are used by the studio and the live match.
 */
'use strict';
(() => {
 const {node,assign}=INK.SVG,{clamp}=INK;
 const SHAPES={
  streak:['M-94 9Q-18-4 35 0Q-28 9-103 23L-63 12Z','M-61-7Q-13-13 26-4Q-7-4-43 0Z','M-57 26L11 11-20 22Z'],
  wave:['M-97 19Q-93-25-55-43Q-5-66 53-24L92 0 57 27Q11 53-51 44L-31 19-80 26-58 3Z','M-42-15Q-3-43 58-5L75 1 38 17Q3 31-27 22L-9 7-45 5Z','M-23-15Q19-25 58 0Q21 22-17 12L6 0Z'],
  flame:['M-81 31Q-41 4-68-22Q-6 8-19-68Q4-42 18-57Q4-14 46-37Q28 2 83-12Q56 38 12 45Q-47 58-81 31Z','M-43 32Q-8 6-23-12Q5 2 9-36Q32-5 20 5L55 7Q26 39-43 32Z','M-13 30Q-4 20 1 5L17 16 26 20Q9 38-13 30Z'],
  silk:['M-125 44Q-49-85 75-42Q-27-65-97 31L-57 17-125 44Z','M-78 30Q-4-67 96-28Q14-35-62 35Z','M-113 52Q-23-7 81 12Q-7-20-113 52Z'],
  spiral:['M-119 13Q-7-93 81-20Q105 23 10 37Q-63 43-41-7Q-24-25 40-17Q-4-36-54-9Q-80 37 16 48Q108 44 113 5Q79-67-37-37Z','M-68 10Q-2-56 77-10Q55-25 17-17Q-29-25-57 12Z','M-125 48L58 1-37 33Z'],
  shock:['M-121-33L-53-26-78-47 61-10 99 0 38 21-57 47-30 27-111 31-59 5Z','M-73-17L23-7-12-24 66 0-18 23 7 9-63 17Z','M-26-5L65 0-30 9-3 1Z'],
  crescent:['M-105 52Q-99-79 55-62Q-62-36-62 10Q-49 56 45 45Q-52 93-105 52Z','M-87 38Q-78-30 17-56Q-102-34-87 38Z','M-81 52Q-28 80 49 49Q-20 96-81 52Z'],
  claw:['M-85-44Q-24-33 69 33L-11-7-71-14Z','M-103-9Q-14 1 82 50L-29 14-88 20Z','M-92 32Q-1 40 64 65L-21 56-81 56Z'],
  pillar:['M-94 58Q-26-46-69-108Q-9-87-24-233Q24-193 0-304Q65-241 42-172Q92-196 52-69Q94-73 104 58Z','M-57 51Q-10-14-21-106L1-85Q31-155 17-203Q58-147 17-11L54-21 70 53Z','M-18 55Q17 21 2-29Q45 17 38 53Z'],
  ring:['M0-71C39-71 71-39 71 0C71 39 39 71 0 71C-39 71-71 39-71 0C-71-39-39-71 0-71ZM0-63C-35-63-63-35-63 0C-63 35-35 63 0 63C35 63 63 35 63 0C63-35 35-63 0-63Z','',''],
  impact:['M0-89L13-23 55-55 25-6 94 6 27 17 55 56 10 32-8 91-15 30-65 50-32 14-99-1-32-13-64-61-16-33Z','M-6-43L10-11 40-8 10 9 2 46-11 10-43-1-12-10Z','M-4-17L12 0-2 18-17-2Z'],
  fan:['M-53-54Q28-74 71-5L0 34Z','M-39-46L0 34 53-7Q13-46-39-46Z','M-33-40L0 31M-12-49L0 31M12-39L0 31M36-25L0 31']
 };
 class Effects {
  constructor(parent){this.root=node('g',{'data-ink-fx':'authored','pointer-events':'none'},parent);this.group=this.root;this.nodes=Array.from({length:12},()=>{const g=node('g',{},this.root),p=[0,1,2].map(()=>node('path',{},g));return{g,p};});this.visible=true;}
  render(record,frame,pose,rig){if(!record||!this.visible){assign(this.root,'display','none');return;}assign(this.root,'display','inline');let count=0;
   for(const ev of record.fx){const age=frame-ev.frame;if(age<0||age>=ev.duration||count>=this.nodes.length)continue;const u=age/ev.duration,q=INK.Runtime.socket(pose,rig,ev.socket),v=this.nodes[count++],scale=ev.scale*(.72+Math.sin(Math.min(1,u*2)*Math.PI/2)*.42),turn=ev.rotation+(ev.type==='spiral'?u*190:ev.type==='crescent'?u*65:ev.type==='fan'?u*230:ev.type==='silk'?u*30:0),drift=ev.type==='wave'?u*95:ev.type==='shock'?u*34:0;
    assign(v.g,'display','inline');assign(v.g,'transform',`translate(${q[0]+drift} ${q[1]}) rotate(${turn}) scale(${scale} ${scale*(ev.type==='streak'?.5:1)})`);assign(v.g,'opacity',ev.opacity*Math.min(1,(1-u)*2.4));const paths=SHAPES[ev.type];
    v.p.forEach((p,i)=>{assign(p,'d',paths[i]||'');assign(p,'fill',i===0?ev.color:i===1?'#ffdea5':'#fffbea');assign(p,'opacity',i===0?.64:i===1?.84:1);assign(p,'stroke',ev.type==='fan'&&i===2?'#ffeab8':'none');assign(p,'stroke-width',1.6);assign(p,'fill-rule','evenodd');});
   }
   for(let i=count;i<this.nodes.length;i++)assign(this.nodes[i].g,'display','none');
  }
  destroy(){this.root.remove();}
 }
 INK.Effects=Effects;
})();
