/* FLOW 05 — compiled animation tracks.
 * Coefficients are built once per clip; sampling has no keyframe-array walks,
 * slope recomputation, random state, event dispatch or writes to the asset.
 * Authored winding numbers (including 720° turns) remain untouched.
 */
'use strict';
(() => {
  const {clamp,copy,finite,easing,Clip}=INK;
  const stats={clips:0,tracks:0,samples:0};
  class Track {
    constructor(keys) {
      this.times=Float64Array.from(keys,k=>k[0]);
      this.dimension=Array.isArray(keys[0][1])?2:1;
      this.vector=this.dimension===2;
      this.values=Float64Array.from(keys.flatMap(k=>this.vector?k[1]:[k[1]]));
      this.curves=keys.slice(1).map(k=>k[2]||'smooth');
      this.coefficients=new Float64Array(Math.max(0,keys.length-1)*this.dimension*4);
      const value=(i,j)=>this.values[i*this.dimension+j];
      const tangent=(i,j)=>{
        if(i===0)return (value(1,j)-value(0,j))/(this.times[1]-this.times[0]);
        if(i===keys.length-1)return (value(i,j)-value(i-1,j))/(this.times[i]-this.times[i-1]);
        const h0=this.times[i]-this.times[i-1],h1=this.times[i+1]-this.times[i];
        const d0=(value(i,j)-value(i-1,j))/h0,d1=(value(i+1,j)-value(i,j))/h1;
        if(d0*d1<=0)return 0;
        const w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/d0+w1/d1);
      };
      for(let i=0;i<keys.length-1;i++)for(let j=0;j<this.dimension;j++) {
        const x=value(i,j),y=value(i+1,j),d=y-x,h=this.times[i+1]-this.times[i],curve=this.curves[i];
        let c=[x,0,3*d,-2*d];
        if(curve==='linear')c=[x,d,0,0];
        else if(curve==='strike')c=[x,3*d,-3*d,d];
        else if(curve==='load')c=[x,0,0,d];
        else if(curve==='hold')c=[x,0,0,0];
        else if(curve==='spline') {
          let m0=tangent(i,j),m1=tangent(i+1,j);
          if(['hold','strike','load'].includes(keys[i][2]))m0=0;
          if(i+2<keys.length&&['hold','strike','load'].includes(keys[i+2][2]))m1=0;
          if(Math.abs(d/h)<1e-12)c=[x,0,0,0];
          else c=[x,h*m0,3*d-h*(2*m0+m1),-2*d+h*(m0+m1)];
        }
        this.coefficients.set(c,(i*this.dimension+j)*4);
      }
      stats.tracks++;
    }
    locate(t) {
      const n=this.times.length;if(t<=this.times[0])return -1;if(t>=this.times[n-1])return n-1;
      let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(this.times[m]<=t)lo=m;else hi=m;}return lo;
    }
    sample(t) {
      const i=this.locate(t),n=this.times.length;
      const at=(index,j)=>this.values[index*this.dimension+j];
      if(i<0)return this.vector?[at(0,0),at(0,1)]:at(0,0);
      if(i===n-1)return this.vector?[at(i,0),at(i,1)]:at(i,0);
      const u=(t-this.times[i])/(this.times[i+1]-this.times[i]),curve=this.curves[i];
      const component=j=>{
        const x=at(i,j),y=at(i+1,j);
        if(Array.isArray(curve))return x+(y-x)*easing(u,curve);
        const k=(i*this.dimension+j)*4,c=this.coefficients;
        const v=((c[k+3]*u+c[k+2])*u+c[k+1])*u+c[k];
        return curve==='spline'?clamp(v,Math.min(x,y),Math.max(x,y)):v;
      };
      return this.vector?[component(0),component(1)]:component(0);
    }
  }
  class CompiledClip extends Clip {
    constructor(data) {super(data);this.compiled=Object.entries(this.tracks).map(([key,keys])=>[key,new Track(keys)]);stats.clips++;}
    sample(frame,base=INK.basePose) {
      finite(frame,'Finite animation frame required');const p=copy(base),t=clamp(frame,0,this.duration);
      for(const [key,track]of this.compiled)p[key]=track.sample(t);stats.samples++;return p;
    }
  }
  INK.CompiledMotion={Track,stats,version:'5.0.0'};INK.CompiledClip=CompiledClip;
})();
