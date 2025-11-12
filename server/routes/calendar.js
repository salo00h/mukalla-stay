const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// 🗓️ عرض التواريخ المتاحة لغرفة معينة
router.get("/:room_id", async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT date, status FROM room_calendar WHERE room_id=? ORDER BY date ASC",
      [req.params.room_id]
    );
    res.json({ ok: true, calendar: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ✅ تحديث حالة اليوم (مثلاً حجز يوم)
router.post("/:room_id", async (req, res) => {
  try {
    const { date, status } = req.body;
    if (!date || !status)
      return res.status(400).json({ ok: false, error: "البيانات ناقصة" });

    await db.run(
      `
      INSERT INTO room_calendar (room_id, date, status)
      VALUES (?, ?, ?)
      ON CONFLICT(room_id, date) DO UPDATE SET status=excluded.status
      `,
      [req.params.room_id, date, status]
    );

    res.json({ ok: true, message: "تم تحديث الحالة" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
