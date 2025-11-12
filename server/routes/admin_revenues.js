const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

router.get("/hotel-revenues", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT 
        h.id AS hotel_id,
        h.name AS hotel_name,
        IFNULL(SUM(p.amount), 0) AS total_revenue,
        COUNT(DISTINCT b.id) AS total_bookings
      FROM hotels h
      LEFT JOIN bookings b ON b.hotel_id = h.id
      LEFT JOIN payments p ON p.booking_ref = b.booking_ref AND p.confirmed = 1
      WHERE h.active = 1
      GROUP BY h.id
      ORDER BY total_revenue DESC
    `);
    res.json({ ok: true, hotels: rows });
  } catch (e) {
    console.error("Erreur /hotel-revenues:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
