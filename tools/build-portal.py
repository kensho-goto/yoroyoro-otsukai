# ゲームサイト（CrazyGames）に出す版をつくる。使い方: python3 tools/build-portal.py
# ふつうの公開版との違い：合言葉なし・検索よけなし・外のURLなし・サイトの道具（SDK）入り・版の自動更新なし
# 出来上がり: dist/crazygames/（中身）と dist/yoroyoro-crazygames.zip（サイトに上げるもの）
import os, re, shutil, subprocess, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OUT = 'dist/crazygames'
ZIP = 'dist/yoroyoro-crazygames.zip'
SDK = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'

try:
    ver = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip() or 'portal'
except Exception:
    ver = 'portal'

if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT + '/src'); os.makedirs(OUT + '/vendor'); os.makedirs(OUT + '/img')

s = open('index.html', encoding='utf-8').read()

def drop(pattern, need=True):
    global s
    s2, n = re.subn(pattern, '', s, flags=re.S)
    if need and n == 0:
        raise SystemExit('見つからない: ' + pattern)
    s = s2

drop(r'<meta name="robots"[^>]*>\s*')
drop(r'<meta property="og:url"[^>]*>\s*')
drop(r'<meta property="og:image"[^>]*>\s*')
drop(r'<meta name="twitter:card"[^>]*>\s*')
drop(r'<link rel="manifest"[^>]*>\s*')
drop(r'<div class="overlay show" id="gate" hidden>.*?</div>\s*</div>\s*')  # 合言葉の画面
drop(r'<script src="src/gate\.js\?v=dev"></script>\s*')
s = s.replace("window.BUILD = 'dev'", "window.BUILD = 'portal'")
s = s.replace('?v=dev', '?v=' + ver)
s = s.replace('<script src="src/i18n.js', SDK + '\n<script src="src/portal.js?v=' + ver + '"></script>\n<script src="src/i18n.js', 1)
if 'crazygames-sdk' not in s or 'portal.js' not in s or s.index('src/save.js') > s.index('src/portal.js'):
    raise SystemExit('SDK を入れられなかった')
# ゲームの本体（i18n.js から main.js まで）は、サイトの準備と記録の読みこみが終わってから、順番に読みこむ
m = re.search(r'<script src="src/i18n\.js[^"]*"></script>.*<script src="src/main\.js[^"]*"></script>', s, flags=re.S)
if not m:
    raise SystemExit('ゲームの本体の読みこみが見つからない')
srcs = re.findall(r'<script src="([^"]+)"></script>', m.group(0))
loader = ('<script>\n(function () { // ゲームの本体は、サイトの準備が終わってから順番に読みこむ\n'
          '  const list = ' + repr(srcs).replace("'", '"') + ';\n'
          '  const next = () => { const f = list.shift(); if (!f) { document.documentElement.classList.remove("boot"); return; } const e = document.createElement("script"); e.src = f; e.onload = next; e.onerror = next; document.body.appendChild(e); };\n'
          '  YP.ready.then(next, next);\n'
          '})();\n</script>')
s = s[:m.start()] + loader + s[m.end():]
# 読みこみ中は、ことばを切りかえる前の画面を見せない
s = s.replace('<html lang="ja">', '<html lang="ja" class="boot">', 1).replace('</style>', '  html.boot .overlay, html.boot .hud, html.boot .pads { visibility: hidden; }\n</style>', 1)
if 'class="boot"' not in s:
    raise SystemExit('読みこみ中のかくしが入らない')
open(OUT + '/index.html', 'w', encoding='utf-8').write(s)

for f in sorted(os.listdir('src')):
    if f.endswith('.js') and f != 'gate.js':
        shutil.copy('src/' + f, OUT + '/src/' + f)
shutil.copy('vendor/planck.min.js', OUT + '/vendor/planck.min.js')
for f in ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']:
    shutil.copy('img/' + f, OUT + '/img/' + f)

# 外のURLが残っていないか（サイトの決まり：よその場所へ誘わない）
for dp, _, fs in os.walk(OUT):
    for f in fs:
        if f.endswith(('.html', '.js')) and f != 'planck.min.js':
            t = open(os.path.join(dp, f), encoding='utf-8').read()
            for u in re.findall(r'https?://[^\s"\'`)]+', t):
                if not re.match(r'https://(sdk\.crazygames\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|www\.w3\.org)', u):
                    raise SystemExit(f'外のURLが残っている: {f}: {u}')

if os.path.exists(ZIP):
    os.remove(ZIP)
with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
    for dp, _, fs in os.walk(OUT):
        for f in fs:
            p = os.path.join(dp, f)
            z.write(p, os.path.relpath(p, OUT))
n = sum(len(fs) for _, _, fs in os.walk(OUT))
print(f'ok {OUT}  {n} files  zip {os.path.getsize(ZIP) // 1024}KB  ver {ver}')
