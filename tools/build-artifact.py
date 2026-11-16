# claude.ai の非公開ページ用に整える（doctype/html/head/body を外す）。使い方: python3 tools/build-artifact.py <出力先>
import re, sys, shutil, os
out = sys.argv[1]
os.makedirs(out + '/src', exist_ok=True); os.makedirs(out + '/vendor', exist_ok=True)
s = open('index.html', encoding='utf-8').read()
s = re.sub(r'<!doctype html>\s*|</?html[^>]*>\s*|</?head>\s*|</?body>\s*', '', s, flags=re.I)
s = re.sub(r'<meta (charset|name="viewport"|name="apple-mobile-web-app-capable")[^>]*>\s*', '', s)
open(out + '/index.html', 'w', encoding='utf-8').write(s)
for f in ['src/core.js', 'src/main.js', 'vendor/planck.min.js']: shutil.copy(f, out + '/' + f)
print('ok', out)
