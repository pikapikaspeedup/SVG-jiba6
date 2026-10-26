#!/usr/bin/env python3
"""Verify archive hashes, then rebuild in a fresh temporary directory.
This checks delivery/reproducibility, not browser permissions or rerunning QA.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', nargs='?', type=Path, default=ROOT.parent/'INK-Flow-7-Rhythm-Source.zip')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    report_path = args.report or args.archive.with_name('INK-Flow-7-Rhythm-Delivery-Check.json')
    report = {'suite': 'flow7-delivery-check', 'capturedAt': datetime.now(timezone.utc).isoformat(), 'archive': args.archive.name,
              'archiveSha256': sha(args.archive), 'archiveBytes': args.archive.stat().st_size,
              'status': 'failed', 'scope': 'Archive manifest validation and fresh extraction/rebuild. Browser tests are not rerun by this command.'}
    try:
        with tempfile.TemporaryDirectory(prefix='ink-flow7-delivery-') as temp:
            directory = Path(temp)
            with zipfile.ZipFile(args.archive) as z:
                members = z.infolist()
                if len(members) > 10000 or sum(i.file_size for i in members) > 512*1024*1024:
                    raise ValueError('Archive exceeds delivery safety limits.')
                names = set()
                for item in members:
                    name = PurePosixPath(item.filename)
                    if (name.is_absolute() or '..' in name.parts or not name.parts or ':' in name.parts[0]
                            or '\\' in item.filename or stat.S_ISLNK(item.external_attr >> 16)):
                        raise ValueError('Unsafe archive entry: '+item.filename)
                    if item.filename in names:
                        raise ValueError('Duplicate archive entry: '+item.filename)
                    names.add(item.filename)
                z.extractall(directory)
            roots = [p for p in directory.iterdir() if p.is_dir()]
            if len(roots) != 1:
                raise ValueError('Expected one source root directory.')
            source = roots[0]
            manifest = json.loads((source/'SHA256SUMS.json').read_text(encoding='utf-8'))['files']
            actual = {str(p.relative_to(source)).replace('\\', '/') for p in source.rglob('*') if p.is_file() and p.name != 'SHA256SUMS.json'}
            if set(manifest) != actual:
                raise ValueError('Manifest membership differs from extracted files.')
            mismatches = [name for name, value in manifest.items() if sha(source/name) != value]
            report.update(manifestFiles=len(manifest), matchedFiles=len(manifest)-len(mismatches), mismatches=mismatches)
            if mismatches:
                raise ValueError('Packaged file hashes do not match.')
            result = subprocess.run([sys.executable, 'tools/build_forge.py'], cwd=source, capture_output=True,
                                    text=True, encoding='utf-8', errors='replace', check=True)
            report['buildLog'] = result.stdout
            outputs = ['dist/INK-Street-Fighter-6.html', 'dist/INK-Street-Fighter-6-Player.html', 'dist/forge-template.html', 'dist/game-forge.js']
            report['rebuiltOutputs'] = {name: {'sha256': sha(source/name), 'matchesPackage': sha(source/name) == manifest[name]} for name in outputs}
            if not all(r['matchesPackage'] for r in report['rebuiltOutputs'].values()):
                raise ValueError('Rebuilt HTML/template/source differs from delivered bytes.')
            validation = json.loads((source/'qa/flow7/validation.json').read_text(encoding='utf-8'))
            if validation.get('status') != 'passed' or not validation.get('evidence', {}).get('endurance', {}).get('fullSoakAccepted'):
                raise ValueError('Package lacks accepted final build + 20-minute-soak validation.')
            if not validation.get('evidence', {}).get('playback', {}).get('accepted'):
                raise ValueError('Package lacks current-hash playback evidence.')
            if validation['htmlSha256'] != sha(source/'dist/INK-Street-Fighter-6.html'):
                raise ValueError('Packaged QA does not refer to the rebuilt HTML.')
            report.update(status='passed', qaBoundToRebuiltHTML=True)
    except Exception as exc:
        report['error'] = f'{type(exc).__name__}: {exc}'
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('DELIVERY', report['status'].upper(), report_path)
    return 0 if report['status'] == 'passed' else 1

if __name__ == '__main__':
    raise SystemExit(main())
