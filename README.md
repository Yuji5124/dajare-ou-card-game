# ダジャレ王

スマホ縦画面向けのプレーンHTML/CSS/JavaScript製カードゲームです。

## 起動方法

プロジェクト直下で静的サーバーを起動し、表示されたURLを開きます。

例:

```sh
python -m http.server 8000
```

その後、ブラウザで `http://localhost:8000/` を開いてください。

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

## オンライン対戦

Firebase Realtime Databaseを使います。外部ビルドは不要で、GitHub Pages上でもCDN版SDKで動きます。

1. Firebase Consoleでプロジェクトを作成します。
2. Webアプリを追加し、表示された設定値を `js/app.js` の `firebaseConfig` に貼り付けます。
3. Realtime Databaseを作成し、Database URLを `databaseURL` に入れます。
4. Realtime Databaseのロケーションを決め、テスト用ルールまたは下記ルールを設定して公開します。
5. GitHub Pagesで使う場合も追加ビルドは不要です。`https://yuji5124.github.io/dajare-ou-card-game/` を開き、タイトル画面の「オンライン対戦」から進みます。
6. 1台目は「ルームを作る」、2台目は同じパスワードで「参加する」を押します。内部では `rooms/{roomId}` にルームが作成され、1台目が `player1`、2台目が `player2` になります。3人目は満員として参加できません。

`firebaseConfig` が空のままだと、オンライン対戦画面に設定案内が表示されます。
両プレイヤーがダジャレ札を選んだ時だけ判定され、ルームリセットは該当する `rooms/{roomId}` を削除して初期状態に戻します。

最小ルール例:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

このルールはプロトタイプ用です。友人・家族とのテスト後は、期限や書き込み範囲を絞ってください。

期限付きテスト用ルール例:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": "now < 1780272000000"
      }
    }
  }
}
```

`1780272000000` は 2026-06-01 00:00:00 UTC の期限です。必要に応じて更新してください。
