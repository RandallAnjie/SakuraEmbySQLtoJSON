# 樱花名册

如果你正打算从 [Sakura_embyboss](https://github.com/berry8838/Sakura_embyboss) 换到 [EM](https://syxxxx.net/)，这一步多半绕不过去：把老库里的用户名单整理成 EM 能吃的格式。

樱花名册就干这一件事 —— 把 Sakura_embyboss 的数据库备份翻一遍，给你一份干净的 JSON / CSV / TSV，里面只有 EM 那边需要的三样东西：Telegram ID、Emby ID、到期时间。

整个过程都在浏览器里跑。文件不会上传到任何地方，关掉标签页就什么都没了。

## 为什么需要这个

EM 的导入接口要的是一份结构化的用户表，三列：`tgId`、`embyId`、`expiresAt`。

Sakura_embyboss 那边存的是一张 `emby` 表，里面除了上面三样还有密码、等级、创建时间、用量、邀请数、改名时间一大堆字段，列名也不一样（`tg`、`embyid`、`ex`）。手动整理一遍当然能干，但十几个用户还行，几百个就头大了。

更麻烦的是 `.sql` 文件本身：mysqldump 的反引号转义、sqlite `.dump` 的双引号转义、字段值里夹着逗号和引号、`NULL` 和空字符串的区别、`ex` 没值到底算不算永久 —— 一个个 SQL 编辑器里 find/replace 太容易出错。

所以就有了这个。

## 怎么用

直接打开 `index.html` —— 没有构建，没有依赖。

1. 把你的 `.sql` 拖进去，或者点一下选。mysqldump 和 sqlite `.dump` 都认。
2. 选个格式：EM 一般用 JSON，但如果你想先 Excel 看一眼 CSV 也行。要是想跳过那些还没绑 Emby 的人，勾上对应选项。
3. 看一眼预览，没问题就下载或者复制，拿去 EM 那边导入。

导出的字段就三个：

- `tgId` —— 来自 `emby.tg`
- `embyId` —— 来自 `emby.embyid`，可能是空的（还没绑的用户）
- `expiresAt` —— 来自 `emby.ex`，按 UTC 写成 `2026-12-31T00:00:00Z` 这种样子。原本是 `NULL` 或空的就留空，EM 那边读到空字符串就当作永久

JSON 长这样：

```json
[
  { "tgId": "12345", "embyId": "abc-def", "expiresAt": "2026-12-31T00:00:00Z" },
  { "tgId": "67890", "embyId": "ghi-jkl", "expiresAt": "" }
]
```

CSV / TSV 第一行是表头（可关），后面就是逐行数据。字符串里有逗号、引号、换行的会按 RFC 4180 加引号。

## 从 Sakura_embyboss 导出 .sql

数据库一般在 `data/` 或者你 docker-compose 里挂出来的那个卷里。

如果你用的是 SQLite（Sakura_embyboss 的默认配置）：

```bash
sqlite3 data/data.db .dump > backup.sql
```

如果你用的是 MySQL / MariaDB：

```bash
mysqldump -u USER -p DATABASE emby > backup.sql
```

只 dump `emby` 一张表也行，整库 dump 也行 —— 樱花名册只会去找 `emby` 表的内容，别的表会忽略。

## 部署

它就是一个 `index.html`，挑一个地方放：

- **Cloudflare Pages**：Direct Upload `index.html`；或者 `wrangler pages deploy .`，构建命令留空，输出目录就是项目根。
- **GitHub Pages**：推到 `main` 或 `gh-pages`，仓库 Pages 设置里选好分支。
- **本地用**：双击 `index.html` 就能跑，根本不需要 server。断网也能用。

## 它能读什么

写解析器的时候是按"拿来主义"的思路 —— 你 dump 怎么导出我都尽量认：

- mysqldump 的反引号标识符、`\'` 和 `\\` 转义、多行 `VALUES (..), (..), ...`
- sqlite `.dump` 的双引号标识符、`''` 转单引号转义
- INSERT 不带列名（按 `CREATE TABLE` 的列顺序对齐）也行；INSERT 带列名（`INSERT INTO emby (tg, embyid, ex) VALUES ...`）也行
- `NULL`、整数、字符串混在一行
- 字段值里有逗号、引号、换行

要是你的 dump 是某种我没想到的方言，跑出来不对，把那段 SQL 贴出来开个 issue，我加进测试用例。

## 字段对照

原表（来自 Sakura_embyboss 的 `bot/sql_helper/sql_emby.py`）：

```
emby
├── tg       BigInteger, 主键 —— 输出为 tgId
├── embyid   VARCHAR(255), 可空 —— 输出为 embyId
├── name     VARCHAR(255)
├── pwd, pwd2
├── lv       VARCHAR(1)
├── cr       DATETIME
├── ex       DATETIME, 可空 —— 输出为 expiresAt，NULL 视为永久
├── us, iv   INT
└── ch       DATETIME
```

其它列（`name`、`lv`、`cr` 等等）不导出，EM 那边不需要。要是你将来想加，改 `buildRecords` 里那一段就行，不到十行。

## 关于隐私

这页所有逻辑都在浏览器里跑（一个 HTML，没有 fetch，没有 worker）。你可以打开开发者工具看网络面板 —— 上传文件那一下不会有任何请求。

要是你不放心，把页面下载到本地，断网后双击打开也能用。数据库里有用户密码这些敏感字段，所以你愿意在本地跑我完全理解。

## 自己改

整个东西就一个 `index.html`，五百多行，HTML / CSS / JS 拌在一起。SQL 解析在文件中段，搜 `parseEmbySql`。导出格式在 `toJSON` / `toDelimited`。UI 在 `// ---------- UI wiring ----------` 之后。

测试：

```
node test/run.js
```

样例 dump 在 `test/fixtures/`，覆盖两种导出方言、转义、NULL、字段含逗号等情况。

## 许可

随便用。
