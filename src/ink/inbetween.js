/* INK FLOW / continuous 2.5D view projection.
 * This is authored vector turn-around, not recovered 3D geometry or optical flow.
 * All functions are stateless so reverse seek, replays and fractional frames agree.
 */
'use strict';
(() => {
  const {clamp,rad,mat}=INK;
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  function angle(p,part='body') {
    const base=Math.abs(p.yaw||0)>1e-8?p.yaw:(p.turn||0)*170;
    return base+(part==='head'?(p.headYaw||0):part==='pelvis'?(p.pelvisYaw||0):(p.chestYaw||0));
  }
  function view(yaw) {
    const n=((yaw+180)%360+360)%360-180,a=Math.abs(n),c=Math.cos(rad(n)),s=Math.sin(rad(n));
    const front=1-smooth(18,87,a),back=smooth(96,171,a),side=clamp(1-front-back);
    return {angle:n,front,side,back,far:c<0,sign:n<0?-1:1,
      width:Math.sqrt(c*c+.42*s*s),shear:s*.025,offset:s*6,
      shoulder:c,depth:s};
  }
  function projection(p,part='body') {
    const v=view(angle(p,part));
    // A ribcage has thickness. It must not collapse to a zero-width card at 90°.
    return [v.width,0,v.shear,1,v.offset+v.shear*250,0];
  }
  function shoulder(point,p) {
    const v=view(angle(p));return [point[0]*v.shoulder+v.depth*9,point[1]+v.depth*(point[0]>0?2:-2)];
  }
  function hip(point,p) {
    const v=view(angle(p,'pelvis'));return [point[0]*v.shoulder+v.depth*5,point[1]];
  }
  function bands(yaw,width) {
    const v=view(yaw),w=width*2;
    // Opaque disjoint regions, never two transparent faces over one another.
    if(Math.abs(v.angle)<=90){const split=-width+w*(1-v.front);return {front:[split,width-split],profile:[-width,split+width],back:[width,0]};}
    const split=width-w*v.back;return {front:[width,0],profile:[-width,split+width],back:[split,width-split]};
  }
  INK.Turn={angle,view,projection,shoulder,hip,bands,smooth,version:'3.0'};
})();
