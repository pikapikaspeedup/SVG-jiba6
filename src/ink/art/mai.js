/* Mai's costume is drawn in the torso bind coordinates. SkinGroup applies
 * the same three-bone weights to every contour, seam and embroidered detail. */
'use strict';
(()=>{
 const {P,F,L}=INK.assets;
 const white='#f7efe5', red='#bd263e', shadow='#7c1b30', thread='#ed8b86';

 // Each blossom is actual vector geometry, rather than a bitmap or a font.
 function blossom(x,y,scale=1,opacity=.28){
  return F('M0-4C1-6 3-5 3-2C6-3 7-1 4 1C6 3 5 5 2 4C1 7-1 7-2 4C-5 5-6 3-4 1C-7-1-6-3-3-2C-3-5-1-6 0-4Z',
   '#f38a83',`transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}"`);
 }
 function obi(){
  let s=P('M-28-231Q-2-225 25-233L28-210Q3-202-28-210Z','#242730',1.1);
  s+=F('M-27-229Q-2-224 24-231L25-227Q-1-221-27-226Z','#72747a','opacity=".24"');
  s+=L('M-26-228Q0-222 24-230M-26-213Q0-207 25-215','#7b7c7e',.7,'opacity=".65"');
  // The diamond weave stays on the weighted belt when the torso bends.
  for(let x=-28;x<=18;x+=9){
   s+=L(`M${x}-226l10 14M${x}-213l10-13`,'#60616a',.55,'opacity=".58"');
  }
  return s;
 }
 (INK.Art ||= {}).mai={
  hair:'M-29 11C-35 0-35-20-30-31C-25-42-13-48 0-47C14-47 27-42 32-30C35-20 32-5 26 9L24-9C22-16 20-21 16-25C14-18 10-15 6-13C7-21 4-28 0-32C-3-24-8-19-14-15L-14-28C-21-23-24-12-23 8Z',
  decoration(c,a,skin,hair){
   let s='';
   // Curved locks and parting are laid over the moving face, not painted on it.
   s+=F('M-26-27C-20-42-9-45 0-43C-12-39-17-30-18-16L-23-8Z','#68514d','opacity=".48"');
   s+=F('M4-44C19-44 28-38 30-27C22-34 13-36 6-35Z','#0e1117','opacity=".48"');
   s+=L('M-23-30C-18-38-10-42-3-42M-14-33C-10-38-5-40-1-40M5-41C14-41 22-37 26-30',a.hair[0],1,'opacity=".58"');
   s+=L('M-22-17C-25-10-25-3-23 5M19-25C23-20 25-14 25-7','#17151a',1.5);
   // High ponytail tie: two folded white cloth loops and a central knot.
   s+=P('M-28-40C-38-45-40-54-38-59C-33-58-26-54-22-47L-19-42Z','#e9e9e4',.8);
   s+=P('M-22-43C-20-50-15-55-10-56C-8-51-9-46-15-40Z','#faf8ef',.8);
   s+=F('M-37-56C-34-54-29-50-26-46L-29-46Z','#aeb4b4','opacity=".65"');
   s+=P('M-26-44Q-21-48-16-43L-17-38Q-22-36-27-39Z','#eee9dc',.7);
   s+=L('M-25-42L-19-40','#b0aaa5',.8);
   return s;
  },
  front(c,a,skin,cloth){
   let s='';
   // V-shaped opening is skin; the red shell and both white lapels overlap.
   s+=P('M-32-304Q-29-315-19-320L-16-318C-14-303-8-285 1-272C9-285 14-302 17-319L21-320Q30-315 34-304L31-288Q22-273 19-255L26-231Q0-222-28-231L-23-255Q-30-274-34-289Z',cloth,1.15);
   s+=F('M-32-300Q-30-310-23-313C-19-295-14-279-3-265L-16-258Q-29-272-33-290Z',shadow,'opacity=".36"');
   s+=F('M16-310Q22-315 28-306L26-293Q21-280 12-267L4-271Q13-288 16-310Z','#ff8c80','opacity=".28"');
   s+=F('M-22-257Q-13-251-4-251L-18-237-26-238Z','#6d1930','opacity=".25"');
   s+=F('M8-259Q15-252 20-243L22-233Q9-230-2-231Z','#f05c60','opacity=".25"');
   // Neckline shadows and two individual folded bands.
   s+=F('M-8-317Q0-313 9-317L5-301Q0-297-5-301Z',a.skin[0],'opacity=".2"');
   s+=L('M-13-309Q-9-298-5-293M11-310Q8-298 5-291M1-305Q-1-299 1-294',a.skin[2],.75,'opacity=".42"');
   s+=P('M-20-320L-14-322C-11-306-5-289 5-275L2-269C-9-280-17-299-20-320Z',white,.65);
   s+=F('M-18-319L-16-320Q-12-295 2-274L1-270Q-11-284-18-319Z','#c9c5c0','opacity=".55"');
   s+=P('M16-322L23-318C19-303 12-286 4-272L-13-247-19-250C-12-263-5-273 0-282C8-296 13-309 16-322Z',white,.65);
   s+=L('M19-318Q13-296 4-280L-15-251','#ffffff',1.1,'opacity=".64"');
   s+=L('M-27-288Q-24-279-17-274M-21-263Q-13-256-7-255M-22-237Q-12-235-4-238M17-275Q13-265 7-261M16-245Q10-240 2-238',shadow,1,'opacity=".58"');
   s+=L('M22-297Q21-284 14-277M-21-280Q-15-272-9-270',thread,.85,'opacity=".58"');
   s+=blossom(-22,-283,.65)+blossom(20,-290,.56)+blossom(14,-249,.65,.22)+blossom(-18,-242,.5,.2);
   return s+obi();
  },
  back(c,a,skin){
   let s=P('M-29-310Q-24-319-16-320L-6-315Q0-311 7-315L16-320Q27-316 31-307L32-290Q25-273 20-254L21-237Q0-230-25-237L-23-255Q-28-276-32-291Z',red,1.15);
   s+=F('M-28-305Q-24-313-19-315L-15-292-18-264-24-250-27-272Z',shadow,'opacity=".28"');
   s+=F('M13-315Q23-315 27-306L25-287 19-270 14-257 8-254 12-281Z','#f08079','opacity=".25"');
   s+=P('M-20-320L-14-322Q-11-304-10-287L-14-276Q-17-295-22-315Z',white,.7);
   s+=P('M15-321L21-318Q16-300 13-282L8-275Q9-297 15-321Z',white,.7);
   s+=L('M-10-307Q0-301 11-308M-16-267Q0-260 15-267M-21-244Q0-238 19-244',shadow,1,'opacity=".6"');
   s+=L('M-8-301L-7-275M5-301L5-273',thread,.7,'opacity=".36"');
   s+=blossom(-16,-284,.75)+blossom(13,-293,.7)+blossom(11,-248,.65)+blossom(-13,-250,.55);
   return s+obi();
  },
  side(c,a,skin,cloth){
   let s=P('M-30-308Q-25-319-15-320L-12-318Q-8-296 3-275Q12-295 18-319Q29-313 34-301L30-285Q22-268 19-252L26-231Q0-222-29-231L-24-255Q-31-274-35-290Z',cloth,1.1);
   s+=F('M-28-303Q-23-313-18-314L-15-293-7-274-14-259-26-276Z',shadow,'opacity=".34"');
   s+=F('M19-308Q25-312 29-302L24-282 13-266 8-272Z','#fa7770','opacity=".25"');
   s+=P('M-17-321L-11-322Q-8-299 7-276L3-270Q-12-290-17-321Z',white,.7);
   s+=P('M17-321L23-317Q16-296 6-277L-12-251-18-253Q-4-276 2-285Q12-302 17-321Z',white,.7);
   s+=L('M-25-282Q-20-271-15-268M17-270Q13-261 8-256M-20-240Q-10-236 0-238',shadow,1,'opacity=".58"');
   s+=blossom(-22,-286,.6)+blossom(16,-247,.6);
   return s+obi();
  }
 };
})();
