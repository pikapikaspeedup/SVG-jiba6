"""Check actual source wiring and old authored motion/combat contracts, without a ZIP dependency."""
from pathlib import Path
import ast,datetime,hashlib,json
R=Path(__file__).resolve().parents[2];O=R/'qa/flow5';O.mkdir(parents=True,exist_ok=True)
def sha(data):return hashlib.sha256(data).hexdigest()
def canonical(value):return sha(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode())
baseline=json.loads((R/'tests/fixtures/flow4-assets.json').read_text());records=baseline['records'];changes=[];failures=[]
for rel,old in records.items():
 d=json.loads((R/rel).read_text())
 for k in ['binding','boxes','gameId','tracks']:
  actual=d['clip']['tracks'] if k=='tracks' else d[k]
  if canonical(actual)!=old[k]:failures.append({'file':rel,'changedContract':k})
 if canonical(d)!=old['record']:changes.append(rel)
version=json.loads((R/'VERSION.json').read_text());current=sha((R/'game.js').read_bytes());archived=sha((R/version['sourceBaseline']['archivedAt']).read_bytes())
builder=(R/'tools/build_forge.py').read_text();tree=ast.parse(builder);function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='game')
direct=len(function.body)==1 and isinstance(function.body[0],ast.Return) and ast.unparse(function.body[0].value)=="read('game.js')"
modules=['compiled-motion','engine-clock','secondary-dynamics','motion-graph','fx-timeline','ribbon-geometry','fx-emitter'];embedded={n:f'src/ink/{n}.js' in builder and (R/f'src/ink/{n}.js').is_file() for n in modules}
checks={'archiveIntact':archived==version['sourceBaseline']['gameSha256'],'liveSourceDifferentFromLegacy':current!=archived,'builderReadsLiveSourceDirectly':direct,'embeddedModules':all(embedded.values()),'generatedIntegrationMatchesSource':(R/'dist/game-forge.js').read_bytes()==(R/'game.js').read_bytes(),'unchangedBaseTracksAndCombatContracts':not failures,'changedRecordsOnlyMai':all('/mai/' in p for p in changes)}
report={'suite':'flow5-source-audit','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':sha((R/'dist/INK-Street-Fighter-6.html').read_bytes()),'passed':all(checks.values()),'checks':checks,'records':len(records),'changedRecords':len(changes),'changes':changes,'failures':failures,'gameSha256':current,'legacySha256':archived,'modules':embedded,'baselineArchiveSha256':baseline['sourceArchiveSha256'],'note':'Checks uploaded FLOW4 base tracks and bindings/boxes; current visual additions are metadata and FX configuration. This is not a claim that the whole game was rewritten.'}
(O/'source-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['changes','modules']},ensure_ascii=False,indent=2));raise SystemExit(0 if report['passed'] else 1)
