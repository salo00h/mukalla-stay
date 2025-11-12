const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// ✅ جلب الأسعار الموسمية لفندق
router.get("/:hotel_id", async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT * FROM seasonal_prices WHERE hotel_id=? ORDER BY start_date ASC",
      [req.params.hotel_id]
    );
    res.json({ ok: true, seasons: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "فشل تحميل المواسم" });
  }
});

// ➕ إضافة موسم جديد
router.post("/", async (req, res) => {
console.log("📩 البيانات اللي وصلت من الواجهة:", req.body);

  try {
    const { hotel_id, room_id, season_name, start_date, end_date, price, min_stay } = req.body;
    if (!hotel_id || !room_id || !start_date || !end_date || !price)
      return res.status(400).json({ ok: false, error: "بيانات ناقصة" });

    await db.run(
      `INSERT INTO seasonal_prices (hotel_id, room_id, season_name, start_date, end_date, price, min_stay)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [hotel_id, room_id, season_name, start_date, end_date, price, min_stay || 1]
    );
    res.json({ ok: true, message: "✅ تم إضافة الموسم بنجاح." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "فشل الإضافة" });
  }
});

// ❌ حذف موسم
router.delete("/:id", async (req, res) => {
  try {
    await db.run("DELETE FROM seasonal_prices WHERE id=?", [req.params.id]);
    res.json({ ok: true, message: "🗑️ تم حذف الموسم." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "فشل حذف الموسم" });
  }
});

module.exports = router;
