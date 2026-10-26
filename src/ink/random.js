/* Battle randomness is independent of particles, sound and paint frequency.
 * Mulberry32 is a reproducible simulation stream, not a security primitive.
 */
'use strict';
(() => {
 const uint=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
 function validateSeed(seed){if(!uint(seed))throw TypeError('战斗种子须为 0..4294967295 的整数');return seed;}
 function create(seed){
  let initial=validateSeed(seed),state=initial,draws=0;
  return Object.freeze({
   next(){state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);draws++;return ((t^(t>>>14))>>>0)/4294967296;},
   reset(seed=initial){initial=validateSeed(seed);state=initial;draws=0;},
   inspect(){return {algorithm:'mulberry32-v1',seed:initial,state,draws};},
   restore(value){if(!value||value.algorithm!=='mulberry32-v1'||!uint(value.seed)||!uint(value.state)||!Number.isSafeInteger(value.draws)||value.draws<0)throw TypeError('无效战斗随机流快照');initial=value.seed;state=value.state;draws=value.draws;}
  });
 }
 const entropy=()=>{const a=new Uint32Array(1);globalThis.crypto.getRandomValues(a);return a[0];};
 const combat=create(0);
 INK.Random=Object.freeze({create,validateSeed,combat,begin(seed){combat.reset(seed===undefined?entropy():validateSeed(seed));return combat.inspect();}});
})();
