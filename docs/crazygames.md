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
- **Title**: Yoroyoro Errand
- **Short description**: Tap left, tap right, don't drop the pudding! A wobbly ragdoll delivery game with ridiculous wipeouts.
- **Description**:
  Deliver a wobbly pudding on a tray — one step at a time. Tap your left and right feet in rhythm to walk, tap both to jump,
  and don't stop, rush, or trip. Every fall turns into a ridiculous wipeout: crushed by a piano, frozen solid, carried off by birds,
  abducted by a UFO… there are 29 kinds to collect. The people waiting at home will cry, sulk, or get really mad.
  Every stage brings a little mission — grab the high box, never stop, hit top speed — and new kinds keep appearing as you go.
  Collect medals from ? boxes and missions, spin the Gacha for new outfits, and see how far you can go. Stages never end.
- **Controls**: Mobile — tap the left / right half of the screen. Keyboard — F (left foot) and J (right foot). Tap both at once to jump.
- **中国語（簡体字）の名前**：摇摇晃晃去跑腿（ゲームの中も中国語で遊べる。端末が中国語なら自動で中国語）
- **中国語の短い説明**：左右轮流按，别把布丁弄掉！摇摇晃晃的送布丁游戏，每次摔倒都超搞笑。
- **Tags（候補）**: ragdoll, physics, funny, walking, casual, one-button(×), difficult, 2 player(×)
- **Age rating**: PEGI 12 相当（サイトの決まり）。暴力・血の表現なし（ころぶのはギャグ表現）。

## 使っているもの（使ってよいかの確認済み）
- planck.js（MIT）・Dela Gothic One（SIL Open Font License、Google Fonts から読む）・ZCOOL QingKe HuangYou（中国語のときだけ。SIL Open Font License、Google Fonts から読む）
- 音はすべてその場で作っている（音の素材ファイルなし）・絵はすべてコードで描いている
