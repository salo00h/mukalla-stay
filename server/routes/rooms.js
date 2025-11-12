// server/routes/rooms.js
const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// 🏨 جميع الغرف لفندق محدد
router.get("/by-hotel/:id", async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM rooms WHERE hotel_id=?", [req.params.id]);
    res.json({ ok: true, rooms: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ➕ إضافة غرفة جديدة
router.post("/", async (req, res) => {
  try {
    const { hotel_id, name, price, count } = req.body;
    await db.run(
      "INSERT INTO rooms (hotel_id, name, price, count, available) VALUES (?, ?, ?, ?, 1)",
      [hotel_id, name, price, count]
    );
    res.json({ ok: true, message: "تمت إضافة الغرفة بنجاح" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ✏️ تعديل بيانات الغرفة
router.put("/:id", async (req, res) => {
  try {
    const { name, price, count, available } = req.body;
    await db.run(
      "UPDATE rooms SET name=?, price=?, count=?, available=? WHERE id=?",
      [name, price, count, available, req.params.id]
    );
    res.json({ ok: true, message: "تم التعديل بنجاح" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// 🗑️ حذف غرفة
router.delete("/:id", async (req, res) => {
  try {
    await db.run("DELETE FROM rooms WHERE id=?", [req.params.id]);
    res.json({ ok: true, message: "تم حذف الغرفة" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// 🔁 تغيير الحالة فقط (تفعيل / تعطيل)
router.patch("/:id", async (req, res) => {
  try {
    await db.run("UPDATE rooms SET available=? WHERE id=?", [req.body.available, req.params.id]);
    res.json({ ok: true, message: "تم تحديث الحالة" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
