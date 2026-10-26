/* One production renderer, reversible only for regression inspection. */
'use strict';
(()=>{INK.Game={enabled:true,mode:'skin',version:'9.0.0',
 legacyNodes:f=>[f.core,f.rearLeg.g,f.frontLeg.g,f.trailing,f.beltLink].filter(Boolean),
 show(f,on){if(f._inkShown===on)return;f._inkShown=on;for(const n of this.legacyNodes(f))n.style.display=on?'none':'';if(f.inkRenderer)f.inkRenderer.group.style.display=on?'':'none';if(f.inkFX){f.inkFX.group.style.display=on?'':'none';f.inkFX.backRoot.style.display=on?'':'none';}},
 mount(f){if(f.inkRenderer)return f.inkRenderer;const profile=INK.Runtime.store?INK.Runtime.profile(f.ch.id):INK.assets.byID[f.ch.id];const r=f.inkRenderer=new INK.Renderer(f.facing,profile);r.setStyle(profile.previewStyle||{});r.setMode(this.mode);f.facing.insertBefore(r.group,f.charge);f._inkShown=undefined;f.inkFX=new INK.Effects(f.facing);f.facing.insertBefore(f.inkFX.backRoot,r.group);f.facing.insertBefore(f.inkFX.group,f.charge);return r;},
 update(f,pose,rig,frame,expression,freeze,world=null,view=f){const r=this.mount(f);this.show(f,true);const ctx=INK.State.contextForFX(view);const localFrame=ctx?(f.attack?INK.Runtime.clipFrame(ctx.record,f.attack.m,frame):ctx.frame):frame;r.render(pose,{rig,frame:localFrame,expression,secondary:!INK.VFX.settings.reducedMotion,motion:INK.Runtime.presentation(view,ctx?.record,localFrame,frame)});f.inkFX.render(ctx?.record,ctx?(f.attack?INK.Runtime.clipFrame(ctx.record,f.attack.m,frame):ctx.frame):0,pose,rig,world?{...world,sourceAttack:f.attack,history:f._inkTrail?.attack===f.attack?f._inkTrail.rows:null,socketHistory:f._inkTrail?.attack===f.attack?f._inkTrail.socketHistory:null}:null);},
 setEnabled(value){this.enabled=!!value;INK.Runtime.setEnabled(value);for(const f of globalThis.SVG_FIGHTER?.fighters||[])this.show(f,this.enabled);globalThis.SVG_FIGHTER?.render();},
 setMode(mode){this.mode=mode;for(const f of globalThis.SVG_FIGHTER?.fighters||[])f.inkRenderer?.setMode(mode);}
};})();
