const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// قائمة الفنادق النشطة
// قائمة الفنادق النشطة
router.get("/hotels", async (req, res) => {
  try {
    const hotels = await db.all(`
      SELECT 
        h.*, 
        ROUND(AVG(r.rating), 1) AS avg_rating,
        COUNT(r.id) AS total_reviews
      FROM hotels h
      LEFT JOIN bookings b ON b.hotel_id = h.id
      LEFT JOIN reviews r ON r.booking_ref = b.booking_ref
      GROUP BY h.id
      ORDER BY h.name ASC
    `);

    res.json({ ok: true, hotels });
  } catch (err) {
    console.error("Error loading hotels:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});


// قائمة الغرف المتاحة
router.get("/rooms", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT r.id, r.name, r.price, r.capacity,
             r.photo_url,
             r.photos_json,
              h.id AS hotel_id, h.name AS hotel_name, h.area, h.address
      FROM rooms r
      JOIN hotels h ON h.id = r.hotel_id
      WHERE r.active=1 AND h.active=1
      ORDER BY h.name, r.price ASC

    `);
    res.json({ ok: true, rooms: rows });
  } catch (e) {
    console.error("Erreur /rooms:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// === سياسة الحجز والدفع ===
const policy = require("../config/policy");

router.get("/policy", (req, res) => {
  res.json({
    ok: true,
    anti_fraud_policy: policy.antiFraud.trim(),
    booking_payment_policy: policy.bookingAndPayment.trim()
  });
});


module.exports = router;
