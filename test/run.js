// Extract parser code from index.html and run on fixtures.
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("no <script> in index.html"); process.exit(1); }
let code = m[1];
// Strip DOM-touching wiring; keep parser + transforms only.
// We do it by truncating at the "// ---------- UI wiring ----------" marker.
const cutAt = code.indexOf("// ---------- UI wiring ----------");
if (cutAt < 0) { console.error("UI wiring marker not found"); process.exit(1); }
code = code.slice(0, cutAt);
// Expose what we need.
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

// ---- MySQL ----
{
  const parsed = parseEmbySql(loadFx("mysql.sql"));
  assertEq(parsed.length, 4, "mysql: row count = 4");
  assertEq(parsed[0].tg, 12345, "mysql: tg numeric");
  assertEq(parsed[0].embyid, "abc-def", "mysql: embyid");
  assertEq(parsed[0].ex, "2026-12-31 00:00:00", "mysql: ex datetime preserved");
  assertEq(parsed[1].name, "bob 'the' bold", "mysql: \\' escape decoded");
  assertEq(parsed[1].pwd, "p1\\p2", "mysql: \\\\ escape decoded");
  assertEq(parsed[1].ex, null, "mysql: NULL → null");
  assertEq(parsed[2].embyid, null, "mysql: nullable embyid");
  assertEq(parsed[3].embyid, "mn,op", "mysql: comma inside string preserved");

  const recs = buildRecords(parsed, { onlyBound: false });
  assertEq(recs.length, 4, "mysql: records = 4");
  assertEq(recs[0].expiresAt, "2026-12-31T00:00:00Z", "mysql: expiresAt -> ISO Z");
  assertEq(recs[1].expiresAt, "", "mysql: null ex → empty");
  assertEq(recs[2].embyId, "", "mysql: null embyid → empty");

  const recsBound = buildRecords(parsed, { onlyBound: true });
  assertEq(recsBound.length, 3, "mysql: onlyBound filters NULL embyid");

  const json = JSON.parse(toJSON(recs, true));
  assertEq(json[0], { tgId: "12345", embyId: "abc-def", expiresAt: "2026-12-31T00:00:00Z" }, "mysql: JSON shape");

  const csv = toDelimited(recs, ",", true);
  const lines = csv.split("\n");
  assertEq(lines[0], "tgId,embyId,expiresAt", "mysql: CSV header");
  assertEq(lines[1], "12345,abc-def,2026-12-31T00:00:00Z", "mysql: CSV row 1");
  assertEq(lines[4], '22222,"mn,op",2026-06-15T08:00:00Z', "mysql: CSV escapes comma in field");

  const tsv = toDelimited(recs, "\t", true);
  const tlines = tsv.split("\n");
  assertEq(tlines[0], "tgId\tembyId\texpiresAt", "mysql: TSV header");
  assertEq(tlines[4], "22222\tmn,op\t2026-06-15T08:00:00Z", "mysql: TSV no quoting needed for comma");
}

// ---- SQLite .dump ----
{
  const parsed = parseEmbySql(loadFx("sqlite.sql"));
  assertEq(parsed.length, 3, "sqlite: row count = 3");
  assertEq(parsed[0].embyid, "abc-def", "sqlite: embyid");
  assertEq(parsed[1].name, "bob's name", "sqlite: '' escape → single quote");
  assertEq(parsed[2].embyid, null, "sqlite: NULL embyid");
  const recs = buildRecords(parsed, { onlyBound: false });
  assertEq(recs[0].expiresAt, "2026-12-31T00:00:00Z", "sqlite: expiresAt ISO Z");
  assertEq(recs[1].expiresAt, "", "sqlite: NULL ex → empty");
}

// ---- No CREATE TABLE, but INSERT with explicit column list ----
{
  const sql = "INSERT INTO `emby` (`tg`,`embyid`,`ex`) VALUES (1,'x','2027-01-01 00:00:00'),(2,NULL,NULL);";
  const parsed = parseEmbySql(sql);
  assertEq(parsed.length, 2, "explicit-cols: row count");
  assertEq(parsed[0].tg, 1, "explicit-cols: tg");
  assertEq(parsed[0].embyid, "x", "explicit-cols: embyid");
  assertEq(parsed[1].ex, null, "explicit-cols: NULL ex");
  const recs = buildRecords(parsed, { onlyBound: false });
  assertEq(recs[0].expiresAt, "2027-01-01T00:00:00Z", "explicit-cols: expiresAt");
}

if (process.exitCode) console.error("\nsome tests FAILED");
else console.log("\nall tests passed");
