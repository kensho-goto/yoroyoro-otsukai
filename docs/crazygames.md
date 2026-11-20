# CrazyGames に出すときのメモ

## 出す版のつくり方
```
python3 tools/build-portal.py
```
- `dist/yoroyoro-crazygames.zip` ができる。これをサイトの「ゲームを出す」画面に上げる。
- ふつうの公開版（GitHub Pages・合言葉あり）とは別物。合言葉・検索よけ・外のURL・版の自動更新を外し、サイトの道具（SDK）と `src/portal.js` を入れる。
- 手元で試すとき：`dist/crazygames/` を `python3 -m http.server` で開き、URL の後ろに `?useLocalSdk=true` をつけると、サイトの道具のお試し版が動く（広告のかわりに見本が出る）。

## サイトとのつなぎ（src/portal.js）
| いつ | すること |
|---|---|
| 読みこみ | `loadingStart` → タイトルが出たら `loadingStop` |
| 歩きはじめ／つづける | `gameplayStart` |
| ゲームオーバー・GOAL・ひと休み | `gameplayStop` |
| 「もう一回」「つぎへ」 | 区切りの広告（midgame）。出るかどうか・間かくはサイトが決める。広告のあいだは音を止める |
| 新しいステージをクリア | `happytime` |
| サイトの「音を消す」 | 音を止める（ゲーム内の音ボタンより優先） |
| 記録の保存 | サイトのアカウントに保存（`src/save.js` の保存先を `SDK.data` に切りかえ）。はじめての切りかえで端末の記録を移す。ゲームの本体は、サイトの準備が終わってから読みこむ（6秒で返事がなければそのまま始める） |

## 申しこみのときに必ずすること
- **「進み具合を保存する（Progress Save）」を選ぶ**。選ばないとサイトの保存が使えず、端末にだけ保存される（ゲームは動くが、ほかの端末で続きができない）

## 載せる文（英語）
ほかのころぶゲームとのちがいを前に出す：①ころび方を集める ②家で待っている人の反応 ③イライラではなく笑ってやめられる・すぐやり直せる
- **Title**: Yoroyoro Errand
- **Short description**: Tap left, tap right, don't drop the pudding! Every fall is a gag — a piano, a UFO, a flock of birds — and someone at home is waiting… and getting mad.
- **Description**:
  Your mom just wants her pudding. All you have to do is carry it home on a tray — one wobbly step at a time.
  Tap your left and right feet in rhythm to walk, tap both to jump, and don't stop, rush, or trip.

  **Falling is the fun part.** Every wipeout turns into a ridiculous gag: crushed by a grand piano, frozen solid,
  carried off by birds, abducted by a UFO… 29 kinds to collect in your Album.

  **Someone is waiting at home.** Mom, Grandpa, the cat, the kid next door — and when you fail, they react.
  They cry, they sulk, they get *really* mad. Collect every face.

  **Laugh, don't rage.** Runs take about 20 seconds. Fall, laugh, tap — you're walking again in about a second.
  No long loading, no lives, no waiting.

  Every stage brings a little mission (grab the high box, never stop, hit top speed). Earn medals, spin the Gacha
  for new outfits and trays, and see how far you can go.
- **Controls**: Mobile — tap the left / right half of the screen. Keyboard — F (left foot) and J (right foot). Tap both at once to jump.
- **中国語（簡体字）の名前**：摇摇晃晃去跑腿（ゲームの中も中国語で遊べる。端末が中国語なら自動で中国語）
- **中国語の短い説明**：左右轮流按，别把布丁弄掉！每次摔倒都是一场搞笑表演——钢琴、UFO、一群鸟……家里还有人在等你，而且越等越生气。
- **Tags（候補）**: funny, ragdoll, physics, casual, collect, mobile, difficult（2人用は作らない。one-button は合わないので付けない）
- **Age rating**: PEGI 12 相当（サイトの決まり）。暴力・血の表現なし（ころぶのはギャグ表現）。

## 表紙と紹介動画（`promo/`）
| ファイル | 大きさ | 使う場所 |
|---|---|---|
| `promo/cover-landscape.png` | 1920×1080 | 表紙（横） |
| `promo/cover-portrait.png` | 800×1200 | 表紙（縦） |
| `promo/cover-square.png` | 800×800 | 表紙（正方形） |
| `promo/preview-landscape.mp4` | 1920×1080・音なし | 紹介動画（横） |
| `promo/preview-portrait.mp4` | 1080×1620・音なし | 紹介動画（縦） |

- 表紙の中身：ピアノが落ちてくる瞬間（はじめてころんだときの芸）＋ タイトル ＋ おこったお母さん「WHERE'S MY PUDDING?!」
- 動画の流れ：表紙から始まる → 歩く → ころぶ → ピアノ → 待っている人の反応 → すぐやり直す → 鳥に運ばれる → 凍る
- サイトの決まり（15〜20秒・音なし・早送りしない・表紙から始める・黒い帯や「Play Now」の文字やマウスの矢印を入れない）に合わせてある
- 作り直すとき：`promo/compose.html` を `python3 -m http.server` で開き、`?lang=en&w=1920&h=1080` のように大きさを指定して画面を撮る（下絵は `promo/cover-base.png`）

## 使っているもの（使ってよいかの確認済み）
- planck.js（MIT）・Dela Gothic One（SIL Open Font License、Google Fonts から読む）・ZCOOL QingKe HuangYou（中国語のときだけ。SIL Open Font License、Google Fonts から読む）
- 音はすべてその場で作っている（音の素材ファイルなし）・絵はすべてコードで描いている
