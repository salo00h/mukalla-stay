// server/routes/admin_dashboard.js
const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// ✅ إحصائيات لوحة الإدارة
router.get("/dashboard", async (req, res) => {
  try {
    const totalHotels = await db.get(`SELECT COUNT(*) AS c FROM hotels WHERE active=1`);
    const totalBookings = await db.get(`SELECT COUNT(*) AS c FROM bookings`);
    const activeClients = await db.get(`SELECT COUNT(DISTINCT client_email) AS c FROM bookings`);
    const totalRevenue = await db.get(`SELECT SUM(amount) AS total FROM payments WHERE confirmed=1`);

    res.json({
      ok: true,
      stats: {
        totalHotels: totalHotels.c,
        totalBookings: totalBookings.c,
        activeClients: activeClients.c,
        siteRevenue: (totalRevenue.total || 0) * 0.10,   // 10% للموقع
        hotelsRevenue: (totalRevenue.total || 0) * 0.90, // 90% للفنادق
        avgBookingValue: (totalRevenue.total || 0) / (totalBookings.c || 1),
        occupancyRate: Math.round(Math.random() * 100),  // مؤقت
        topHotel: "Nesto Hotel" // مؤقت
      }
    });
  } catch (err) {
    console.error("خطأ في dashboard:", err);
    res.json({ ok: false, error: "فشل تحميل الإحصائيات" });
  }
});


// ✅ الإيرادات الشهرية
router.get("/revenue-by-month", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT strftime('%m', created_at) AS month, SUM(amount) AS total
      FROM payments
      WHERE confirmed = 1
      GROUP BY month
      ORDER BY month ASC
    `);

    const monthsMap = {
      "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
      "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
      "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر"
    };

    const labels = rows.map(r => monthsMap[r.month] || r.month);
    const values = rows.map(r => r.total || 0);

    res.json({ ok: true, labels, values });
  } catch (err) {
    console.error("خطأ في الإيرادات الشهرية:", err);
    res.json({ ok: false, error: "فشل تحميل الإيرادات الشهرية" });
  }
});

module.exports = router;
