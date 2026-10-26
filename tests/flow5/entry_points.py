"""Offline package landing-page links and responsive-layout check.
The screenshot asset is injected as data bytes for set_content, because this
host blocks native file navigation; this does not claim filesystem permissions.
Run after the release report exists. Does not modify either game HTML.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import base64
import datetime
import hashlib
import json
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'qa/flow5'


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attributes):
        for key, value in attributes:
            if key in ('src', 'href') and value:
                self.links.append(value)


def main():
    tests, errors = [], []
    for name in ('OPEN-ME.html', 'index.html'):
        parser = Links()
        parser.feed((ROOT / name).read_text(encoding='utf-8'))
        checked = []
        for value in parser.links:
            parts = urlsplit(value)
            assert not parts.scheme and not parts.netloc, 'Unexpected remote landing dependency: ' + value
            target = (ROOT / unquote(parts.path)).resolve()
            assert ROOT in target.parents and target.is_file(), 'Missing landing target: ' + value
            checked.append(value)
        tests.append({'name': name + ' local links', 'pass': True, 'links': checked})
    assert (ROOT / 'OPEN-ME.html').read_bytes() == (ROOT / 'index.html').read_bytes()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'), headless=True, args=['--no-sandbox'])
        page = browser.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        markup = (ROOT / 'OPEN-ME.html').read_text(encoding='utf-8')
        image = 'data:image/png;base64,' + base64.b64encode((OUT / 'inspector-desktop.png').read_bytes()).decode('ascii')
        for width, height in [(1440, 1000), (844, 390), (390, 844), (360, 800)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.set_content(markup, wait_until='load')
            page.locator('img').evaluate('(img, bytes) => { img.src = bytes; }', image)
            page.wait_for_function('document.querySelector("img").complete && document.querySelector("img").naturalWidth > 0')
            info = page.evaluate('''() => ({width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
              links: [...document.querySelectorAll('.button')].map(n => {
                const r=n.getBoundingClientRect();return {text:n.textContent, left:r.left,right:r.right,height:r.height};
              }), headings:[...document.querySelectorAll('h1,h2')].map(n=>n.textContent),
              imageLoaded:document.querySelector('img').naturalWidth>0})''')
            assert info['scrollWidth'] <= width + 1, 'Horizontal page overflow'
            assert len(info['links']) == 2 and info['imageLoaded']
            assert all(link['left'] >= 0 and link['right'] <= width + 1 and link['height'] >= 44 for link in info['links']), 'Game button clipping or undersized target'
            tests.append({'name': f'Landing {width} x {height}', 'pass': True, 'detail': info})
            if width in (1440, 390):
                page.screenshot(path=str(OUT / f'landing-{width}.png'), full_page=True)
        browser.close()
    assert not errors, errors
    report = {'suite': 'flow5-entry-points', 'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'htmlSha256': hashlib.sha256((ROOT / 'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest(),
              'landingSha256': hashlib.sha256((ROOT / 'OPEN-ME.html').read_bytes()).hexdigest(),
              'total': len(tests), 'passed': sum(t['pass'] for t in tests), 'tests': tests, 'browserErrors': errors,
              'scope': 'Static shipped relative-path checks plus set_content layout with screenshot bytes injected. Not native filesystem navigation.'}
    (OUT / 'entry-points.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'tests'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
