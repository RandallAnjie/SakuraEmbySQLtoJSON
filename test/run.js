// Extract parser code from index.html and run on fixtures.
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("no <script> in index.html"); process.exit(1); }
let code = m[1];
const cutAt = code.indexOf("// ---------- UI wiring ----------");
if (cutAt < 0) { console.error("UI wiring marker not found"); process.exit(1); }
code = code.slice(0, cutAt);
code += "\nmodule.exports = { parseEmbySql, buildRecords, toJSON, toDelimited, toIsoZ };\n";

const mod = { exports: {} };
const fn = new Function("module", "exports", code);
fn(mod, mod.exports);
const { parseEmbySql, buildRecords, toJSON, toDelimited } = mod.exports;

function assertEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}\n  actual:   ${a}\n  expected: ${e}`);
    process.exitCode = 1;
  } else {
    console.log(`ok   ${label}`);
  }
}

function loadFx(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

// ---- MySQL: 五条记录，覆盖 a / b / b-with-null-ex / c / d ----
{
  const parsed = parseEmbySql(loadFx("mysql.sql"));
  assertEq(parsed.length, 5, "mysql: 解析出 5 条原始记录");
  assertEq(parsed[1].name, "bob 'the' bold", "mysql: \\' 转义解码");
  assertEq(parsed[1].pwd, "p1\\p2", "mysql: \\\\ 转义解码");
  assertEq(parsed[3].embyid, "mn,op", "mysql: 字符串内逗号保留");

  const recs = buildRecords(parsed, { onlyBound: false });
  assertEq(recs.length, 3, "mysql: 按 lv 过滤后导出 3 条（a + b + b，跳过 c/d）");
  assertEq(recs[0], { tgId: "12345", embyId: "abc-def", expiresAt: "" }, "mysql: lv=a 永久（即使 ex 有值也留空）");
  assertEq(recs[1], { tgId: "67890", embyId: "ghi-jkl", expiresAt: "2026-10-01T12:00:00Z" }, "mysql: lv=b 取 ex");
  assertEq(recs[2], { tgId: "22222", embyId: "mn,op", expiresAt: "" }, "mysql: lv=b 但 ex 为 NULL → 留空");

  // 确认 c/d 真的没出现
  const tgIds = recs.map(r => r.tgId);
  assertEq(tgIds.includes("11111"), false, "mysql: lv=d 被跳过");
  assertEq(tgIds.includes("33333"), false, "mysql: lv=c 被跳过");

  // onlyBound 在这份数据上不影响结果（被导出的三条都有 embyid）
  const recsBound = buildRecords(parsed, { onlyBound: true });
  assertEq(recsBound.length, 3, "mysql: onlyBound 不影响（a/b 都已绑）");

  const json = JSON.parse(toJSON(recs, true));
  assertEq(json[0], { tgId: "12345", embyId: "abc-def", expiresAt: "" }, "mysql: JSON 结构");

  const csv = toDelimited(recs, ",", true);
  const lines = csv.split("\n");
  assertEq(lines[0], "tgId,embyId,expiresAt", "mysql: CSV 表头");
  assertEq(lines[1], "12345,abc-def,", "mysql: CSV 永久行（expiresAt 空）");
  assertEq(lines[2], "67890,ghi-jkl,2026-10-01T12:00:00Z", "mysql: CSV 到期行");
  assertEq(lines[3], '22222,"mn,op",', "mysql: CSV 字段含逗号要加引号");

  const tsv = toDelimited(recs, "\t", false);
  const tlines = tsv.split("\n");
  assertEq(tlines.length, 3, "mysql: TSV 不带表头时只有 3 行");
  assertEq(tlines[2], "22222\tmn,op\t", "mysql: TSV 无需为逗号加引号");
}

// ---- SQLite ----
{
  const parsed = parseEmbySql(loadFx("sqlite.sql"));
  assertEq(parsed.length, 3, "sqlite: 解析 3 条");
  assertEq(parsed[1].name, "bob's name", "sqlite: '' 转义");
  const recs = buildRecords(parsed, { onlyBound: false });
  assertEq(recs.length, 2, "sqlite: 导出 2 条（跳过 lv=d）");
  assertEq(recs[0].expiresAt, "", "sqlite: lv=a 永久留空");
  assertEq(recs[1].expiresAt, "2026-09-01T00:00:00Z", "sqlite: lv=b 取 ex");
}

// ---- lv 字段的各种值 ----
{
  // 大小写、空白、未知值都按"跳过"处理（除非是 a 或 b）
  const sql = `
    INSERT INTO emby (tg, embyid, lv, ex) VALUES
      (1, 'x', 'A', '2026-01-01 00:00:00'),
      (2, 'y', 'B', '2026-02-01 00:00:00'),
      (3, 'z', 'C', NULL),
      (4, 'w', 'D', NULL),
      (5, 'v', NULL, NULL),
      (6, 'u', 'z', NULL);
  `;
  const parsed = parseEmbySql(sql);
  assertEq(parsed.length, 6, "lv-cases: 解析 6 条");
  const recs = buildRecords(parsed, { onlyBound: false });
  assertEq(recs.length, 2, "lv-cases: 只有 A/B 被导出（大小写不敏感）");
  assertEq(recs[0].expiresAt, "", "lv-cases: 大写 A 也视为永久");
  assertEq(recs[1].expiresAt, "2026-02-01T00:00:00Z", "lv-cases: 大写 B 取 ex");
}

// ---- onlyBound 过滤 ----
{
  // lv=b 但 embyid 是 NULL 的情况（注册到一半）
  const sql = `
    INSERT INTO emby (tg, embyid, lv, ex) VALUES
      (1, 'a-emby', 'a', NULL),
      (2, NULL,     'b', '2026-03-01 00:00:00');
  `;
  const parsed = parseEmbySql(sql);
  const all = buildRecords(parsed, { onlyBound: false });
  assertEq(all.length, 2, "onlyBound: 默认两条都导出");
  const filtered = buildRecords(parsed, { onlyBound: true });
  assertEq(filtered.length, 1, "onlyBound: 过滤掉 embyid 为 NULL 的");
  assertEq(filtered[0].tgId, "1", "onlyBound: 留下的是已绑定的那条");
}

if (process.exitCode) console.error("\nsome tests FAILED");
else console.log("\nall tests passed");
