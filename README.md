# timezone-clock

シンプルな静的時計アプリ。現在時刻を大きく表示し、クエリ文字列でタイムゾーンを切り替えられます。

## 使い方

| URL | 説明 |
|-----|------|
| `/` | ブラウザのローカルタイムゾーン |
| `/?tz=Asia/Tokyo` | 東京 |
| `/?tz=America/New_York` | ニューヨーク |
| `/?timezone=Europe/London` | ロンドン（`timezone` パラメータも可） |
| `/?tz=Asia/Tokyo&subtz=America/New_York` | 東京の主時計とニューヨークのサブ時計 |
| `/?until=2026-12-31T23:59:59+09:00` | 指定日時までのタイマー（経過後はマイナス） |

無効なタイムゾーンが指定された場合は、ローカルタイムゾーンにフォールバックします。

`subtimezone` は `subtz` の別名としても使えます。`until` には JavaScript が解釈できる日時文字列（ISO 8601 推奨）を指定してください。

## GitHub Pages

このリポジトリは GitHub Pages でホストする想定です。`main` ブランチのルートから配信されます。
