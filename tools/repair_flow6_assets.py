#!/usr/bin/env python3
"""Restore polluted normal/branch vectors from the fixed pure recipe sampler.
Requires local Chromium + playwright ONLY for this optional migration. Normal
builds need Python's standard library only. Never rerun on user-authored assets.
Writes a before/after change journal; timing, boxes, scalar tracks and FX survive.
"""
from pathlib import Path
import json, hashlib, shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
O=R/'qa/flow6';O.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 p=b.new_page();p.set_content((R/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);p.wait_for_function('window.INKForge && INKForge.store')
 data=p.evaluate('''()=>{const rows=[];for(const ch of SVG_FIGHTER.characters)for(const r of INKForge.store.list(ch.id)){if(r.source!=='migrated-atelier'||r.clip.meta?.anatomy6)continue;const m=SVG_FIGHTER.moves[ch.id].find(x=>x.id===r.gameId);if(!m)continue;const f={ch,index:0,attack:{m}},base=SF6Motion.neutral(f,0,INK.basePose),tracks={};for(const k of ['fw','rw','fa','ra'])if(r.clip.tracks[k])tracks[k]=r.clip.tracks[k].map(([t,v,curve])=>[t,SF6Motion.sample(f,m,t,base)[k].map(x=>Math.round(x*1000)/1000),curve]);rows.push({character:ch.id,key:r.key,tracks});}return {rows,catalog:SVG_FIGHTER.moves};}''')
 b.close()
(R/'tests/fixtures/move-catalog.json').write_text(json.dumps(data['catalog'],ensure_ascii=False,indent=2)+'\n')
journal=O/'asset-repair-journal.json'
changes=json.loads(journal.read_text()).get('changes',[]) if journal.exists() else []
for row in data['rows']:
 path=R/f"assets/ink/characters/{row['character']}/moves/{row['key']}.json"
 d=json.loads(path.read_text());changed=[]
 for name,keys in row['tracks'].items():
  old=d['clip']['tracks'][name]
  # Float rounding of original sample times is not an authored change.
  if max(abs(a[1][j]-b[1][j]) for a,b in zip(keys,old) for j in (0,1))<.02:continue
  changed.append({'channel':name,'before':old,'after':keys});d['clip']['tracks'][name]=keys
 if not changed:continue
 d['clip']['meta']['anatomy6']={'revision':'recipe-vector-ownership','space':'unturned-author','notes':'恢复受共享模板污染的向量关键帧；未修改战斗时序、判定框、伤害或取消规则。'}
 changes.append({'asset':str(path.relative_to(R)),'changes':changed});path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
(O/'asset-repair-journal.json').write_text(json.dumps({'records':len(changes),'tracks':sum(len(x['changes']) for x in changes),'changes':changes},ensure_ascii=False,indent=2)+'\n')
print('Repaired records:',len(changes),'tracks:',sum(len(x['changes']) for x in changes))
