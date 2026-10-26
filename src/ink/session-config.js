/* Bounded new-match presets. No arbitrary object/state patch import. */
'use strict';
(() => {
 function validate(v){
  const keys=['characters','mode','control','difficulty','seed','preset','rhythm','rules','buffer','spacing','reentry','dummy'];
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw TypeError('无效会话配置');
  const c={characters:['ryu','ken'],mode:'training',control:'classic',difficulty:'normal',preset:'duel',rhythm:'fluid',rules:'flow',buffer:9,spacing:false,reentry:true,dummy:'idle',...v};
  if(!Array.isArray(c.characters)||c.characters.length!==2||c.characters.some(id=>!INK.Schema.CHARACTERS.includes(id)))throw TypeError('无效会话角色');
  for(const [key,choices] of Object.entries({mode:['training','versus','cpu','demo'],control:['classic','assist'],difficulty:['easy','normal','hard'],preset:['duel','spacing'],rhythm:['fluid','weighted','legacy'],rules:['flow','legacy'],dummy:['idle','guard','crouch','cpu']}))if(!choices.includes(c[key]))throw TypeError('无效会话 '+key);
  INK.Random.validateSeed(c.seed);
  if(![3,6,9,12].includes(c.buffer)||typeof c.spacing!=='boolean'||typeof c.reentry!=='boolean')throw TypeError('无效会话规则');
  return JSON.parse(JSON.stringify(c));
 }
 INK.SessionConfig=Object.freeze({validate});
})();
