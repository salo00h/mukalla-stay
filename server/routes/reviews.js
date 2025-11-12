const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// ⭐ إضافة تقييم
router.post("/:booking_ref", async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const ref = req.params.booking_ref;

    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ ok: false, error: "قيمة التقييم غير صحيحة" });

    // ✅ تحقق أن الحجز موجود ومؤكد قبل إضافة التقييم
    const booking = await db.get(
      "SELECT * FROM bookings WHERE booking_ref = ? AND status = 'CONFIRMED'",
      [ref]
    );
    if (!booking)
      return res.status(400).json({ ok: false, error: "لا يمكن تقييم حجز غير مؤكد" });

    await db.run(
      `INSERT INTO reviews (booking_ref, rating, comment, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [ref, rating, comment || ""]
    );

    res.json({ ok: true, message: "✅ تم إضافة التقييم بنجاح" });
  } catch (err) {
    console.error("❌ Error adding review:", err);
    res.status(500).json({ ok: false, error: "خطأ في السيرفر" });
  }
});

// ⭐ عرض تقييمات فندق معيّن
router.get("/hotel/:hotel_id", async (req, res) => {
  try {
    const reviews = await db.all(
      `
      SELECT r.*, b.client_name, h.name AS hotel_name
      FROM reviews r
      JOIN bookings b ON b.booking_ref = r.booking_ref
      JOIN hotels h ON h.id = b.hotel_id
      WHERE h.id = ?
      ORDER BY r.created_at DESC
      `,
      [req.params.hotel_id]
    );
    res.json({ ok: true, reviews });
  } catch (err) {
    console.error("❌ Error loading hotel reviews:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ⭐ عرض جميع التقييمات لكل الفنادق
router.get("/", async (req, res) => {
  try {
    const reviews = await db.all(`
      SELECT r.*, b.client_name, h.name AS hotel_name
      FROM reviews r
      JOIN bookings b ON b.booking_ref = r.booking_ref
      JOIN hotels h ON h.id = b.hotel_id
      ORDER BY r.created_at DESC
    `);
    res.json({ ok: true, reviews });
  } catch (err) {
    console.error("❌ Error loading all reviews:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ⭐ جلب متوسط تقييمات كل فندق
// ⭐ جلب متوسط تقييمات كل فندق
router.get("/averages", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT 
        h.id AS hotel_id,
        h.name AS hotel_name,
        ROUND(AVG(r.rating), 1) AS avg_rating,
        COUNT(r.id) AS total_reviews
      FROM reviews r
      JOIN bookings b ON b.booking_ref = r.booking_ref
      JOIN hotels h ON h.id = b.hotel_id
      GROUP BY h.id, h.name
    `);
    res.json({ ok: true, averages: rows });
  } catch (err) {
    console.error("❌ Error fetching averages:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});



module.exports = router;
