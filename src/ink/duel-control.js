/* DUEL CONTROL: recent jump/dash intent survives landing or recovery, using
 * the same actionable-frame clock as attack buffering. No synthetic inputs. */
'use strict';
(() => {
 const settings={enabled:true},active=()=>settings.enabled;
 function queue(f,kind,direction,G){if(!active()||G.phase!=='fight'||f.hp<=0||f.captured||['throwing','ko','win'].includes(f.state))return;f._inkMotor={kind,direction,frame:INK.Input.frame};}
 function press(f,key,G){if(key==='up')queue(f,'jump',(f.input.held.has('right')?1:0)-(f.input.held.has('left')?1:0),G);}
 function direction(f,x){if(f._inkMotor?.kind==='jump'&&f.input.held.has('up'))f._inkMotor.direction=x;}
 function peek(f){const q=f._inkMotor;if(!q)return null;if(!active()||INK.Input.frame-q.frame>INK.Input.window){f._inkMotor=null;return null;}return q;}
 function take(f,kind){const q=peek(f);if(!q||q.kind!==kind||f.input.queue.length)return null;f._inkMotor=null;return q;}
 INK.DuelControl={settings,active,queue,press,direction,peek,take};
})();
