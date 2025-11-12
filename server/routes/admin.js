// server/routes/admin.js
const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// 🏨 الفندق يؤكد الحجز → بانتظار العربون من العميل
router.patch("/confirm-booking/:bookingRef", async (req, res) => {
  try {
    const ref = req.params.bookingRef;

    // ✅ البحث عن الحجز في وضع انتظار تأكيد الفندق
    const booking = await db.get(
      "SELECT * FROM bookings WHERE booking_ref=? AND status='WAITING_HOTEL_CONFIRM'",
      [ref]
    );

    if (!booking) {
      return res
        .status(404)
        .json({ ok: false, error: "الحجز غير موجود أو تمت معالجته سابقًا." });
    }

    // ✅ تحديث الحالة إلى انتظار العربون من العميل
    await db.run(
      "UPDATE bookings SET status='WAITING_CLIENT_DEPOSIT', updated_at=CURRENT_TIMESTAMP WHERE booking_ref=?",
      [ref]
    );

    // ✅ ضبط مهلة دفع العربون (24 ساعة بعد تأكيد الفندق)
    await db.run(`
     UPDATE bookings
     SET deposit_due_at = datetime('now', '+1 day')
     WHERE booking_ref = ?
    `, [ref]);


    // 🧾 حفظ في سجل العمليات
    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('CONFIRM_BY_HOTEL', 'hotel@hadramout.com', ?)`,
      [JSON.stringify({ booking_ref: ref })]
    );

    res.json({
      ok: true,
      message: `✅ تم تأكيد الحجز ${ref} من الفندق. بانتظار العربون من العميل.`,
    });
  } catch (e) {
    console.error("Erreur /admin/confirm-booking:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ❌ الفندق يرفض الحجز
router.patch("/reject-booking/:bookingRef", async (req, res) => {
  try {
    const ref = req.params.bookingRef;

    const booking = await db.get(
      "SELECT * FROM bookings WHERE booking_ref=? AND status IN ('WAITING_HOTEL_CONFIRM','WAITING_ADMIN_DEPOSIT')",
      [ref]
    );
    if (!booking) {
      return res
        .status(404)
        .json({ ok: false, error: "الحجز غير موجود أو تمت معالجته سابقًا." });
    }

    await db.run("UPDATE bookings SET status='REJECTED' WHERE booking_ref=?", [ref]);

    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('REJECT_BY_HOTEL', 'hotel@hadramout.com', ?)`,
      [JSON.stringify({ booking_ref: ref, reason: req.body.reason || "لم يُذكر سبب" })]
    );

    res.json({ ok: true, message: `❌ تم رفض الحجز ${ref} من قبل الفندق.` });
  } catch (e) {
    console.error("Erreur /admin/reject-booking:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// 🧾 قائمة الحجوزات التي بانتظار مراجعة العربون (للواجهة الإدارية)
router.get("/pending-deposits", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT 
        b.*, 
        h.name AS hotel_name, 
        r.name AS room_name
      FROM bookings b
      JOIN hotels h ON h.id = b.hotel_id
      JOIN rooms  r ON r.id = b.room_id
      WHERE b.status='DEPOSIT_SENT'
      ORDER BY b.updated_at DESC, b.created_at DESC
    `);
    res.json({ ok: true, bookings: rows });
  } catch (e) {
    console.error("Erreur /admin/pending-deposits:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// 💰 الإدارة تؤكد دفع العربون → CONFIRMED
router.patch("/confirm-payment/:bookingRef", async (req, res) => {
  try {
    const ref = req.params.bookingRef;

    const booking = await db.get(
      "SELECT * FROM bookings WHERE booking_ref=? AND status='DEPOSIT_SENT'",
      [ref]
    );
    if (!booking) {
      return res.status(400).json({ ok: false, error: "الحجز ليس في وضع انتظار تأكيد العربون." });
    }

    const payment = await db.get(
      "SELECT * FROM payments WHERE booking_ref=? ORDER BY id DESC LIMIT 1",
      [ref]
    );
    if (!payment || (!payment.proof_url && !booking.deposit_proof_url)) {
      return res.status(400).json({ ok: false, error: "لا يوجد إيصال صالح لهذا الحجز." });
    }

    await db.run("UPDATE payments SET confirmed=1 WHERE booking_ref=?", [ref]);
    await db.run("UPDATE bookings SET status='CONFIRMED' WHERE booking_ref=?", [ref]);
    // 📩 إشعار العميل بعد تأكيد العربون من الإدارة
    const { notifyBookingEvent } = require("../utils/booking_notifications");

    const client = await db.get(`
      SELECT 
      b.booking_ref, 
      b.client_name, 
      b.client_phone, 
      h.name AS hotel_name
      FROM bookings b
      JOIN hotels h ON h.id = b.hotel_id
      WHERE b.booking_ref = ?`,
      [ref]
    );

      if (client) {
      await notifyBookingEvent("DEPOSIT_CONFIRMED", client);
    }


    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('CONFIRM_DEPOSIT_BY_ADMIN', 'admin@mukallastay.com', ?)`,
      [JSON.stringify({ booking_ref: ref, method: payment?.method, amount: payment?.amount })]
    );

    res.json({ ok: true, message: `✅ تم تأكيد العربون والحجز ${ref} الآن مؤكد بالكامل.` });
  } catch (e) {
    console.error("Erreur /admin/confirm-payment:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ✅ اعتماد العربون (للإدارة) → تحويل الحالة إلى CONFIRMED
router.post("/approve-deposit/:bookingRef", async (req, res) => {
  try {
    const ref = req.params.bookingRef;

    // تحقق أن الحجز في حالة "DEPOSIT_SENT"
    const booking = await db.get(
      "SELECT * FROM bookings WHERE booking_ref=? AND status='DEPOSIT_SENT'",
      [ref]
    );
    if (!booking) {
      return res
        .status(400)
        .json({ ok: false, error: "لا يمكن اعتماد هذا العربون، تحقق من الحالة." });
    }

    // تحديث حالة الدفع
    await db.run("UPDATE payments SET confirmed=1 WHERE booking_ref=?", [ref]);

    // 🔄 تحديث الحجز إلى مؤكد
    await db.run(
      "UPDATE bookings SET status='CONFIRMED', updated_at=CURRENT_TIMESTAMP WHERE booking_ref=?",
      [ref]
    );

    // 📩 إشعار العميل بعد تأكيد العربون من الإدارة
    const { notifyBookingEvent } = require("../utils/booking_notifications");

    const client = await db.get(`
      SELECT 
      b.booking_ref, 
      b.client_name, 
      b.client_phone, 
      h.name AS hotel_name
      FROM bookings b
      JOIN hotels h ON h.id = b.hotel_id
      WHERE b.booking_ref = ?`,
      [ref]
    );

    if (client) {
     await notifyBookingEvent("DEPOSIT_CONFIRMED", client);
    }


    // 🧾 سجل العملية
    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('APPROVE_DEPOSIT_BY_ADMIN', 'admin@mukallastay.com', ?)`,
      [JSON.stringify({ booking_ref: ref })]
    );

    res.json({
      ok: true,
      message: `✅ تم اعتماد العربون والحجز ${ref} مؤكد الآن.`,
    });
  } catch (e) {
    console.error("Erreur /approve-deposit:", e);
    res.status(500).json({ ok: false, error: "خطأ في السيرفر" });
  }
});

// 💳 اعتماد الدفع الكامل من الإدارة
router.post("/approve-final/:bookingRef", async (req, res) => {
  try {
    const ref = req.params.bookingRef;

    // تأكد أن الحجز مؤكد فعلاً
    const booking = await db.get(
      "SELECT * FROM bookings WHERE booking_ref=? AND status='CONFIRMED'",
      [ref]
    );
    if (!booking) {
      return res
        .status(400)
        .json({ ok: false, error: "❌ لا يمكن اعتماد الدفع الكامل إلا للحجوزات المؤكدة." });
    }

    // ✅ تأكيد الدفع في جدول payments (آخر دفعة)
    await db.run(
      "UPDATE payments SET confirmed=1 WHERE booking_ref=? ORDER BY id DESC LIMIT 1",
      [ref]
    );

    // ✅ وضع final_paid=1 في الحجز
    await db.run(`
      UPDATE bookings
      SET final_paid = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE booking_ref = ?
    `, [ref]);

    // 🧾 سجل العملية في سجل التدقيق
    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('APPROVE_FINAL_BY_ADMIN', 'admin@mukallastay.com', ?)`,
      [JSON.stringify({ booking_ref: ref })]
    );

    res.json({
      ok: true,
      message: `✅ تم اعتماد الدفع الكامل للحجز ${ref} بنجاح.`,
    });
  } catch (e) {
    console.error("Erreur /approve-final:", e);
    res.status(500).json({ ok: false, error: "خطأ في السيرفر" });
  }
});


// 🧾 جميع حجوزات فندق معين
router.get("/bookings/:hotel_id", async (req, res) => {
  try {
    const rows = await db.all(
      `
      SELECT b.*, r.name AS room_name, h.name AS hotel_name
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      JOIN hotels h ON b.hotel_id = h.id
      WHERE b.hotel_id = ?
      ORDER BY b.created_at DESC
    `,
      [req.params.hotel_id]
    );

    res.json({ ok: true, bookings: rows });
  } catch (e) {
    console.error("Erreur admin /bookings:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// تغيير الحالة يدويًا (قديم)
router.post("/bookings/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["CONFIRMED", "REJECTED"];
    if (!allowed.includes(status))
      return res.status(400).json({ ok: false, error: "Invalid status" });

    await db.run(`UPDATE bookings SET status = ? WHERE id = ?`, [status, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Erreur update status:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// 🏨 تسجيل دخول الفندق
router.post("/hotel-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const hotel = await db.get(
      "SELECT id, name FROM hotels WHERE manager_email=? AND manager_password=?",
      [email, password]
    );

    if (!hotel)
      return res.status(401).json({ ok: false, error: "بيانات الدخول غير صحيحة" });

    res.json({ ok: true, hotel });
  } catch (e) {
    console.error("Erreur /hotel-login:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// 👥 قائمة كل المستخدمين (فنادق + عملاء)
router.get("/users", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT 'client' AS type, client_email AS email, client_name AS name
      FROM bookings
      GROUP BY client_email
      UNION
      SELECT 'hotel' AS type, email, name
      FROM hotels
      WHERE active = 1
    `);

    res.json({ ok: true, users: rows });
  } catch (e) {
    console.error("Erreur /admin/users:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// 📊 لوحة التحكم الإدارية
// 📊 إحصائيات لوحة الإدارة
router.get("/dashboard", async (req, res) => {
  try {
    const stats = {};

    // عدد الفنادق النشطة
    const h = await db.get(`SELECT COUNT(*) AS totalHotels FROM hotels WHERE active=1`);
    stats.totalHotels = h.totalHotels || 0;

    // عدد الحجوزات المؤكدة فقط
    const b = await db.get(`SELECT COUNT(*) AS totalBookings FROM bookings WHERE status='CONFIRMED'`);
    stats.totalBookings = b.totalBookings || 0;

    // عدد العملاء (distinct emails)
    const c = await db.get(`SELECT COUNT(DISTINCT client_email) AS activeClients FROM bookings`);
    stats.activeClients = c.activeClients || 0;

    // 💰 جمع العربون المؤكد فقط
    const r = await db.get(`
      SELECT SUM(p.amount) AS totalDeposit
      FROM payments p
      JOIN bookings b ON b.booking_ref = p.booking_ref
      WHERE p.confirmed=1
    `);
    const totalDeposit = r?.totalDeposit || 0;

    // 🧮 التوزيع مثل لوحة الفندق
    stats.hotelsRevenue = totalDeposit * 0.9; // أرباح الفنادق
    stats.siteRevenue = totalDeposit * 0.1;   // عمولة الموقع

    // 🔹 متوسط قيمة العربون المؤكد
    const avg = await db.get(`
      SELECT AVG(p.amount) AS avgBookingValue
      FROM payments p
      WHERE p.confirmed=1
    `);
    stats.avgBookingValue = avg?.avgBookingValue || 0;

    // 🔹 أعلى فندق من حيث العربون المؤكد
    const top = await db.get(`
      SELECT h.name AS hotel_name, SUM(p.amount) AS total
      FROM payments p
      JOIN bookings b ON b.booking_ref = p.booking_ref
      JOIN hotels h ON h.id = b.hotel_id
      WHERE p.confirmed=1
      GROUP BY h.id
      ORDER BY total DESC
      LIMIT 1
    `);
    stats.topHotel = top?.hotel_name || "—";

    res.json({ ok: true, stats });
  } catch (err) {
    console.error("❌ /api/admin/dashboard:", err);
    res.status(500).json({ ok: false, error: "فشل تحميل بيانات لوحة الإدارة" });
  }
});


module.exports = router;