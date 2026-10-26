/* Exact, bounded value encoding and SHA-256 for identities and state diagnostics.
 * Sorting object keys does not reorder arrays or simulate unordered Sets/Maps.
 */
'use strict';
(() => {
 const utf8=new TextEncoder(),hex=n=>n.toString(16).padStart(8,'0');
 function encode(value){
  let nodes=0;const active=new Set(),buffer=new ArrayBuffer(8),view=new DataView(buffer);
  function walk(v,depth){
   if(++nodes>1500000||depth>80)throw TypeError('规范数据超过结构上限');
   if(v===null)return 'null;';if(v===undefined)return 'undefined;';
   if(typeof v==='boolean')return v?'true;':'false;';
   if(typeof v==='number'){view.setFloat64(0,v,false);return 'n'+hex(view.getUint32(0,false))+hex(view.getUint32(4,false))+';';}
   if(typeof v==='string')return 's'+JSON.stringify(v)+';';
   if(typeof v!=='object'||Object.getOwnPropertySymbols(v).length||active.has(v))throw TypeError('规范数据包含不支持的类型或循环');
   active.add(v);let out;
   if(Array.isArray(v)){if(Object.keys(v).length!==v.length)throw TypeError('规范数组不能稀疏或含额外属性');out='['+v.map(x=>walk(x,depth+1)).join('')+']';}
   else{if(Object.prototype.toString.call(v)!=='[object Object]')throw TypeError('需要显式导出的纯数据');out='{'+Object.keys(v).sort().map(k=>walk(k,depth+1)+walk(v[k],depth+1)).join('')+'}';}
   active.delete(v);return out;
  }
  return walk(value,0);
 }
 const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
 function sha256(text){
  if(typeof text!=='string')throw TypeError('摘要输入必须是固定文本');const source=utf8.encode(text);if(source.length>33554432)throw TypeError('摘要字节超过 32 MiB');
  const data=new Uint8Array(Math.ceil((source.length+9)/64)*64);data.set(source);data[source.length]=128;const d=new DataView(data.buffer);d.setUint32(data.length-8,Math.floor(source.length/536870912));d.setUint32(data.length-4,(source.length*8)>>>0);
  const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64);
  for(let offset=0;offset<data.length;offset+=64){
   for(let i=0;i<16;i++)w[i]=d.getUint32(offset+i*4);
   for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2],s0=rotr(x,7)^rotr(x,18)^(x>>>3),s1=rotr(y,17)^rotr(y,19)^(y>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
   let [a,b,c,e0,e,f,g,j]=h;
   for(let i=0;i<64;i++){const s1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g),t1=(j+s1+ch+K[i]+w[i])>>>0,s0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)>>>0;j=g;g=f;f=e;e=(e0+t1)>>>0;e0=c;c=b;b=a;a=(t1+t2)>>>0;}
   const values=[a,b,c,e0,e,f,g,j];for(let i=0;i<8;i++)h[i]=(h[i]+values[i])>>>0;
  }
  return [...h].map(hex).join('');
 }
 INK.Canonical=Object.freeze({version:1,encode,sha256,hash:v=>sha256(encode(v))});
})();
