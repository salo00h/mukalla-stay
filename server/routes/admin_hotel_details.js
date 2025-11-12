const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// 📊 تفاصيل فندق معيّن (إيرادات + حجوزات)
router.get("/hotel-details/:hotelId", async (req, res) => {
  try {
    const hotelId = req.params.hotelId;

    // إجمالي الإيرادات وعدد الحجوزات
    const stats = await db.get(`
      SELECT 
        h.name AS hotel_name,
        IFNULL(SUM(p.amount), 0) AS total_revenue,
        COUNT(DISTINCT b.id) AS total_bookings
      FROM hotels h
      LEFT JOIN bookings b ON b.hotel_id = h.id
      LEFT JOIN payments p ON p.booking_ref = b.booking_ref AND p.confirmed = 1
      WHERE h.id = ?
    `, [hotelId]);

    // قائمة الحجوزات الخاصة بهذا الفندق
    const bookings = await db.all(`
      SELECT 
        b.booking_ref, b.client_name, b.client_email, b.status,
        r.name AS room_name, b.checkin_date, b.checkout_date, p.amount
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      LEFT JOIN payments p ON b.booking_ref = p.booking_ref
      WHERE b.hotel_id = ?
      ORDER BY b.created_at DESC
    `, [hotelId]);

    res.json({ ok: true, stats, bookings });
  } catch (e) {
    console.error("Erreur /hotel-details:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
