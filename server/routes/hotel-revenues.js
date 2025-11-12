// server/routes/hotel-revenues.js
const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// 🏦 حساب الإيرادات (العربون الكلي، أرباح الفندق، عمولة الموقع)
router.get("/:hotelId/revenues", async (req, res) => {
  try {
    const { hotelId } = req.params;

    // 💰 جمع جميع العربونات المؤكدة للحجوزات المؤكدة فقط
    const row = await db.get(`
      SELECT SUM(p.amount) AS totalDeposit
      FROM payments p
      JOIN bookings b ON b.booking_ref = p.booking_ref
      WHERE b.hotel_id=? AND p.confirmed=1
    `, [hotelId]);

    const totalDeposit = row?.totalDeposit || 0;

    // 🧮 التوزيع
    const hotelRevenue = totalDeposit * 0.9;
    const siteCommission = totalDeposit * 0.1;

    res.json({
      ok: true,
      totalDeposit: totalDeposit.toFixed(2),
      hotelRevenue: hotelRevenue.toFixed(2),
      siteCommission: siteCommission.toFixed(2),
    });
  } catch (err) {
    console.error("❌ Revenue error:", err);
    res.status(500).json({ ok: false, error: "فشل حساب الإيرادات" });
  }
});

module.exports = router;
