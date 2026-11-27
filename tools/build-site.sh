#!/usr/bin/env bash
# 公開するゲームのファイルだけを _site/ に集める。
# GitHub Pages（.github/workflows/pages.yml）と Cloudflare（npm run deploy:cf）の両方がこれを使う。
# 載せるファイルを足したときは、下の cp の行だけを直す。
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site
mkdir _site
cp -r index.html robots.txt manifest.webmanifest src vendor img _site/
# 新しい版をすぐ見せる：ファイル名に版の印をつけ、今の版を version.json に書く
V=${GITHUB_SHA:-$(git rev-parse HEAD)}
V=${V:0:7}
# macOS と Linux の両方で動く書き方（sed -i の違いを避ける）
perl -pi -e "s/\?v=dev/?v=${V}/g; s/window.BUILD = 'dev'/window.BUILD = '${V}'/" _site/index.html
echo "{\"v\":\"${V}\"}" > _site/version.json
# Cloudflare 版：ページの中の GitHub Pages の住所（名前入り）を、公開先の住所に置き換える
# （SNS で共有したときのリンク・自慢の絵の URL など。npm run deploy:cf が SITE_URL を渡す）
if [ -n "${SITE_URL:-}" ]; then
  HOST=${SITE_URL#https://}; HOST=${HOST%/}
  grep -rlF 'kensho-goto.github.io/yoroyoro-otsukai' _site | while read -r f; do
    perl -pi -e "s#https://kensho-goto\.github\.io/yoroyoro-otsukai/#${SITE_URL}#g; s#kensho-goto\.github\.io/yoroyoro-otsukai#${HOST}#g" "$f"
  done
fi
echo "_site/ に集めました（版 ${V}）"
