const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

// تنفيذ SQL بدون إرجاع نتائج
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// تنفيذ SQL وإرجاع كل النتائج
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// تنفيذ SQL واحد وإرجاع نتيجة واحدة
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, "seed.sql"), "utf8");
  const statements = sql.split(/;\s*\n/).filter((s) => s.trim());

  // 🧩 تحقق أولًا من عدد الفنادق
  const existing = await get("SELECT COUNT(*) AS c FROM hotels");
  if (existing && existing.c > 0) {
    console.log("✅ قاعدة البيانات موجودة، لن نعيد التهيئة.");
    return;
  }

  for (const stmt of statements) {
    await run(stmt);
  }

  console.log("✅ تمت تهيئة قاعدة البيانات لأول مرة فقط.");
}


module.exports = { run, all, get, initSchema };
