// server/routes/hotel-analytics.js
const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// 🧠 إحصائيات أداء الفندق
router.get("/:hotelId/analytics", async (req, res) => {
  try {
    const { hotelId } = req.params;

    // 🕒 متوسط مدة الإقامة (لكل الحجوزات المؤكدة)
    const avgStay = await db.get(`
      SELECT ROUND(AVG(julianday(checkout_date) - julianday(checkin_date)), 1) AS avgStay
      FROM bookings
      WHERE hotel_id=? AND status IN ('CONFIRMED','AWAITING_DEPOSIT','DEPOSIT_SENT')
    `, [hotelId]);

    // 🏨 أكثر غرفة حُجزت
    const topRoom = await db.get(`
      SELECT r.name, COUNT(*) AS cnt
      FROM bookings b
      JOIN rooms r ON r.id=b.room_id
      WHERE b.hotel_id=? AND b.status IN ('CONFIRMED','AWAITING_DEPOSIT','DEPOSIT_SENT')
      GROUP BY r.name ORDER BY cnt DESC LIMIT 1
    `, [hotelId]);

    // 📅 أكثر شهر فيه حجوزات
    const topMonth = await db.get(`
      SELECT strftime('%m', checkin_date) AS month, COUNT(*) AS cnt
      FROM bookings
      WHERE hotel_id=? AND status IN ('CONFIRMED','AWAITING_DEPOSIT','DEPOSIT_SENT')
      GROUP BY month ORDER BY cnt DESC LIMIT 1
    `, [hotelId]);

    // 👥 العملاء الجدد مقابل العائدين
    const clients = await db.all(`
      SELECT LOWER(client_email) AS email, COUNT(*) AS cnt
      FROM bookings
      WHERE hotel_id=? AND status IN ('CONFIRMED','AWAITING_DEPOSIT','DEPOSIT_SENT')
      GROUP BY LOWER(client_email)
    `, [hotelId]);

    const newClients = clients.filter(c => c.cnt === 1).length;
    const returning = clients.filter(c => c.cnt > 1).length;
    const total = newClients + returning || 1;

    const ratioText = `${Math.round((newClients/total)*100)}% جدد / ${Math.round((returning/total)*100)}% عائدين`;

    res.json({
      ok: true,
      avgStay: avgStay?.avgStay || 0,
      topRoom: topRoom?.name || "—",
      topRoomCount: topRoom?.cnt || 0,
      topMonth: topMonth?.month || "—",
      topMonthCount: topMonth?.cnt || 0,
      clientRatio: ratioText,
      clientRatioData: [newClients, returning]
    });
  } catch (err) {
    console.error("❌ Analytics error:", err);
    res.status(500).json({ ok: false, error: "فشل تحميل الإحصائيات" });
  }
});

module.exports = router;
