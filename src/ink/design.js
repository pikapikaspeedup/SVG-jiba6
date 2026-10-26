/* INK FORGE art direction: original vector-only cel portraits and costume planes.
 * Attachment variants are authored views, not squashed front-facing images.
 */
'use strict';
(()=>{
 const {P,F,L}=INK.assets;
 const profiles=INK.assets.profiles;

 function face(c,mood,side){const a=SF6Art.palette[c.id],female=c.female;let s='';
  const hurt=mood==='hurt',power=mood==='power';
  if(hurt)return L('M-13-5l10 3-8 2M9-4l13-3-6 7',a.hair[2],1.7)+P('M5 17Q12 12 20 15L16 23 9 22Z','#723c40',.6);
  if(!side){s+=F(female?'M-15-6Q-8-10-2-5L-6-2-12-3Z':'M-16-6L-8-9-2-5-6-2-13-3Z','#f7ede1');s+=F('M-7-7L-4-6-4-3-7-3Z',a.eye)+L('M-15-6Q-8-10-2-5',a.hair[2],1.45);}
  s+=F(female?'M7-5Q15-10 25-7L20-2 12-2Z':'M7-5L17-9 25-6 20-2 11-2Z','#fff6e9');
  s+=F('M17-7L21-7 20-2 17-2Z',a.eye)+F('M19-7L20-6 20-3 19-3Z','#232631')+L('M7-5Q17-11 25-7',a.hair[2],female?1.65:1.9);
  s+=L(power?'M-15-16L-2-11M8-11L28-18':female?'M-15-15Q-8-18-1-13M9-14Q19-19 27-16':'M-16-17L-2-14M8-15L28-19',a.hair[2],female?1.25:2.35);
  s+=F('M10-3L9 6 15 8 19 6 13 5Z',a.skin[2],'opacity=".42"')+L('M21 5L25 5',a.skin[2],.7);
  if(power)s+=P('M5 16Q12 12 21 15L19 23 10 25 6 21Z','#673a43',.65)+F('M8 16L19 16 18 18 9 18Z','#fff4dd');
  else s+=L(c.id==='juri'?'M5 17Q15 22 23 13':female?'M6 17Q13 19 21 15':'M5 17L13 16 21 17',female?'#a75460':'#72483e',1.05)+L('M10 22L16 22',a.skin[0],.95);
  if(c.id==='ryu')s+=F('M-15 16L-4 23 6 30 14 29 22 21 18 30 10 35-4 31-16 20Z','#493b3a','opacity=".74"')+L('M-11 19l2 3M-6 24l3 3M1 28l3 2M13 30l3-2',a.skin[0],.5);
  if(c.id==='luke')s+=L('M-13 7l4 6M-16 8l4 6',a.skin[2],1.3);
  return s;
 }
 function head(c,view='front'){
  const a=SF6Art.palette[c.id],female=c.female,skin=`url(#atelier-${c.id}-skin)`,hair=`url(#atelier-${c.id}-hair)`,side=view==='profile';
  let s=P('M-12 11L-16 32-25 45Q-6 56 25 44L16 31 17 12Z',skin,1.15)+F('M-13 20L0 29 13 22 16 33 5 43-11 34Z',a.skin[2],'opacity=".52"');
  if(view==='back'){
   s+=P('M-28-29Q-15-47 6-43Q31-41 32-18L25 14 12 29-8 25-26 10Z',hair,1.4)+F('M-19-29Q-3-41 13-34L2-22-13-7Z',a.hair[0],'opacity=".55"');
  }else{
   s+=P(side?'M-24-27Q-7-45 14-35L27-25 28-9 27-2 35 5 28 9 25 22 11 33-4 29-19 14-24-4Z':female?'M-24-27Q-10-45 11-38L26-28 28-12 26-3 32 4 27 9 24 22 10 34-2 30-19 14-24-5Z':'M-26-25L-17-36-2-41 15-36 27-26 29-10 28-2 34 5 28 10 26 24 11 35-4 32-21 15-26-5Z',skin,1.35);
   s+=F('M-23-16L-13-8-12 8-4 23 9 33-3 29-20 14Z',a.skin[2],'opacity=".33"')+F('M16 11L26 9 23 20 16 23 10 20Z',a.skin[0],'opacity=".32"');
   s+=P('M-23-3Q-32-9-31 2L-25 11-21 8-20 0Z',skin,.9)+L('M-27 0Q-22-3-24 5',a.skin[2],.8);
   for(const mood of ['rest','power','hurt'])s+=`<g data-expression="${mood}"${mood==='rest'?'':' visibility="hidden"'}>${face(c,mood,side)}</g>`;
   s+=P(INK.Art[c.id].hair,hair,1.3);
   s+=L(c.id==='iori'?'M-25-31Q-6-44 15-34L-3-4M-17-25L-20 5':c.id==='ken'?'M-24-27Q-6-43 13-32M-17-29L-19-6M19-30L24-8':'M-21-29Q-8-39 9-33M-16-30L-17-21',a.hair[0],1.2,'opacity=".65"');
  }
  s+=INK.Art[c.id].decoration(c,a,skin,hair);
  return s;
 }
 // Costume-specific planes follow the existing three-influence torso skin.
 // They articulate rib cage / waist volume without changing the combat rig.
 function volumePlanes(c,a){
  const {F,L}=INK.assets;
  const planes={
   ryu:['M5-298Q23-309 34-292L28-280 8-282Z','M7-269L29-272 24-256 12-260Z','M-39-280L-27-265-25-241-15-220-31-230Z'],
   ken:['M-31-303L-15-314-21-290-12-263-24-271Z','M17-302L33-297 30-275 20-267Z','M-24-250L-11-237 3-219-16-224Z'],
   chun:['M-25-296Q-7-306 13-294L19-281-6-282Z','M-22-263L-9-248-8-226-18-216Z','M15-265L25-278 19-246 24-225 11-230Z'],
   cammy:['M-24-296Q-8-307 14-294L19-282-9-280Z','M-19-265L-5-254-7-232-19-221Z','M12-263L24-277 18-245 25-222 10-230Z'],
   luke:['M-31-302L-14-312-17-282-29-273Z','M17-307L34-296 28-278 14-283Z','M-26-265L-13-251-12-227 3-211-18-217Z'],
   juri:['M-24-291Q-8-299 10-284L5-273-15-277Z','M-18-253L-5-246-5-226-16-218Z','M14-268L22-276 17-248 23-222 12-229Z'],
   mai:['M-24-296L-13-303-8-282-15-266Z','M12-293L24-307 24-284 13-267Z','M-18-253L-6-244-7-228-17-219Z'],
   iori:['M-36-302L-22-313-18-284-27-268Z','M18-306L37-297 29-278 14-283Z','M-27-259L-13-247-9-222-22-213Z']
  }[c.id];
  const bare=['ryu','juri','mai'].includes(c.id),light=bare?a.skin[0]:a.cloth[0],shade=bare?a.skin[2]:a.cloth[2];
  return F(planes[0],light,'opacity=".19"')+F(planes[1],light,'opacity=".12"')+F(planes[2],shade,'opacity=".24"')+
   L(c.female?'M-19-246Q-8-251 1-246M8-227L17-223':'M-26-244L-15-239-9-227M14-218L26-221',shade,.85,'opacity=".4"');
 }
 function torso(c,back=false){
  if(back)return SF6Art.torso(c,true);
  const a=SF6Art.palette[c.id],skin=`url(#atelier-${c.id}-skin)`,cloth=`url(#atelier-${c.id}-cloth)`,dark=`url(#atelier-${c.id}-dark)`;
  let s=P(c.female?'M-30-315Q-7-327 23-315L38-297 28-274 19-244 28-214 14-195-19-196-31-215-24-243-31-277-40-295Z':'M-40-314Q-10-331 27-315L48-299 37-267 28-233 34-204 13-185-21-188-37-208-29-238-42-273-49-296Z',skin,1.5);
  s+=F('M-31-295Q-16-306-2-300L-4-273-15-264-21-241-14-218-26-213-27-251Z',a.skin[2],'opacity=".32"');
  s+=INK.Art[c.id].front(c,a,skin,cloth,dark);
  s+=volumePlanes(c,a);
  return s;
 }

 function backTorso(c){
  const a=SF6Art.palette[c.id],skin=`url(#atelier-${c.id}-skin)`,outline=c.female?'M-30-315Q-7-327 23-315L38-297 28-271 20-243 28-214 14-195-19-196-31-215-24-243-31-277-40-295Z':'M-40-314Q-10-331 27-315L48-299 37-267 28-233 34-204 13-185-21-188-37-208-29-238-42-273-49-296Z';
  const fill={ryu:skin,ken:'#a35443',chun:'#276e91',cammy:'#344c4d',luke:'#e7ded1',juri:skin,mai:skin,iori:'#272836'}[c.id];let s=P(outline,fill,1.5);
  s+=INK.Art[c.id].back(c,a,skin);
  return s;
 }
 function sideTorso(c) {
  const a=SF6Art.palette[c.id],skin=`url(#atelier-${c.id}-skin)`,cloth=`url(#atelier-${c.id}-cloth)`;
  const fill={ryu:skin,ken:'#a35443',chun:'#277b9a',cammy:'#3c6665',luke:'#e7ded1',juri:skin,mai:'#bd4155',iori:'#292b39'}[c.id];
  let s=P(c.female?'M-30-315Q-5-330 23-315L38-297 28-272 19-244 28-214 14-195-19-196-31-215-24-243-31-277-40-295Z':'M-40-314Q-10-331 27-315L48-299 37-267 28-233 34-204 13-185-21-188-37-208-29-238-42-273-49-296Z',fill,1.4);
  s+=F('M-27-310Q-8-318 1-305L-2-274-10-247-3-213-20-198-29-221-23-246Z',a.skin[2],'opacity=".20"');
  s+=L('M18-309Q29-291 19-275M6-264Q11-243 3-224',c.female?a.skin[0]:a.cloth[0],1.3,'opacity=".42"');
  if(['ken','iori','chun','cammy','luke'].includes(c.id))s+=L('M17-290Q14-254 23-213',a.cloth[2],1.4);
  if(c.id==='mai')s+=P('M-18-310L-6-287 1-270 18-291 27-309 18-278 9-245 23-215-7-218-18-247-8-279Z',skin,.8)+L('M-31-220Q-3-213 27-220','#fff3df',6);
  if(c.id==='ryu')s+=P('M-32-314L-13-310-16-285-30-272-24-248-8-218-25-211-34-242-31-274Z',cloth,1.1);
  if(c.id==='juri')s+=L('M-20-307L-3-281 24-296M-16-247L19-244',a.trim,3);
  return s;
 }
 const original=INK.assets.pack;
 INK.assets.pack=function(c){const a=original(c);a.heads={front:head(c),profile:head(c,'profile'),back:head(c,'back')};a.torso=torso(c);a.torsoBack=backTorso(c);a.torsoSide=sideTorso(c);return a;};
 INK.design={head,torso,backTorso,sideTorso,edition:'FLOW 3'};
})();
