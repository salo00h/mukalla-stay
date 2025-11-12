const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// 💬 إرسال رسالة بين العميل والفندق
router.post("/:booking_ref", async (req, res) => {
  try {
    const { sender, message } = req.body;
    const ref = req.params.booking_ref;

    if (!sender || !message)
      return res.status(400).json({ ok: false, error: "البيانات ناقصة" });

    await db.run(
      `INSERT INTO messages (booking_ref, sender, message) VALUES (?, ?, ?)`,
      [ref, sender, message]
    );

    res.json({ ok: true, message: "✅ تم إرسال الرسالة بنجاح" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// 💬 جلب كل الرسائل حسب الحجز
router.get("/:booking_ref", async (req, res) => {
  try {
    const msgs = await db.all(
      `SELECT * FROM messages WHERE booking_ref=? ORDER BY created_at ASC`,
      [req.params.booking_ref]
    );
    res.json({ ok: true, messages: msgs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
