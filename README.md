# ダジャレ王

スマホ縦画面向けのプレーンHTML/CSS/JavaScript製カードゲームです。

## 起動方法

プロジェクト直下で静的サーバーを起動し、表示されたURLを開きます。

例:

```sh
python -m http.server 8000
```

その後、ブラウザで `http://localhost:8000/` を開いてください。

最初に合言葉画面が表示されます。初期合言葉は `dajare` です。

## GitHub Pages

公開URL:

`https://yuji5124.github.io/dajare-ou-card-game/`

設定方法:

1. GitHubのリポジトリ設定を開きます。
2. `Pages` を選びます。
3. `Build and deployment` の `Source` を `Deploy from a branch` にします。
4. `Branch` を `main`、フォルダを `/root` にして保存します。
5. 数分後に公開URLへアクセスします。

`index.html` はリポジトリ直下にあり、CSS/JS/カードデータは相対パスで読み込むため、`/dajare-ou-card-game/` のサブパスでも動作します。

## 遊び方

1. タイトル画面で開始します。
2. 敵選択で「はじめくん」を選びます。
3. デッキ構成でおすすめ編成を押し、30枚デッキを作ります。
4. バトルでダジャレ札を1枚選びます。
5. ノリカードは1ターンに1枚まで使えます。
6. おもしろPが高い方が1Pを取り、先に5P取ると勝ちです。

所持カードとデッキは `localStorage` に保存されます。タイトル画面のリセットボタンで初期化できます。
