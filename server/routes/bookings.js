// server/routes/bookings.js
const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { sendWhatsApp } = require("../utils/whatsapp_twilio.js");
const { notifyBookingEvent } = require("../utils/booking_notifications.js");




// ✅ قراءة جميع الحجوزات
router.get("/", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT b.*, h.name AS hotel_name, r.name AS room_name
      FROM bookings b
      JOIN hotels h ON h.id = b.hotel_id
      JOIN rooms  r ON r.id = b.room_id
      ORDER BY b.created_at DESC
    `);
    res.json({ ok: true, bookings: rows });
  } catch (e) {
    console.error("Erreur GET /bookings:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});
// 🧮 عرض تسعير قبل إنشاء الحجز (Preview)
router.post("/quote", async (req, res) => {
  try {
    const { hotel_id, room_id, checkin_date, checkout_date } = req.body;
    if (!hotel_id || !room_id || !checkin_date || !checkout_date)
      return res.status(400).json({ ok: false, error: "بيانات ناقصة للتسعير" });

    // سعر الغرفة الأساسي
    const room = await db.get(`SELECT price FROM rooms WHERE id=? AND hotel_id=?`, [room_id, hotel_id]);
    if (!room) return res.status(404).json({ ok: false, error: "الغرفة غير موجودة" });

    // ابحث عن أي تداخل مع موسم
    const season = await db.get(
      `SELECT * FROM seasonal_prices
       WHERE hotel_id=? AND room_id=?
       AND (
         (date(?) BETWEEN start_date AND end_date)
         OR (date(?) BETWEEN start_date AND end_date)
         OR (date(start_date) BETWEEN date(?) AND date(?))
         OR (date(end_date) BETWEEN date(?) AND date(?))
       )
       ORDER BY price DESC LIMIT 1`,
      [hotel_id, room_id, checkin_date, checkout_date, checkin_date, checkout_date, checkin_date, checkout_date]
    );

    const checkin = new Date(checkin_date);
    const checkout = new Date(checkout_date);
    const nights = Math.max(0, Math.ceil((checkout - checkin) / (1000*60*60*24)));

    const price_per_night = season ? season.price : room.price;
    const min_stay = season ? season.min_stay : 1;
    const total = price_per_night * nights;

    res.json({
      ok: true,
      is_seasonal: !!season,
      price_per_night,
      min_stay,
      nights,
      total
    });
  } catch (e) {
    console.error("Erreur POST /bookings/quote:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ✅ إنشاء حجز جديد → مبدئياً بانتظار تأكيد الفندق
router.post("/create", async (req, res) => {
  try {
    const {
      hotel_id,
      room_id,
      client_name,
      client_email,
      client_phone,
      checkin_date,
      checkout_date
    } = req.body;

    if (!hotel_id || !room_id || !client_name || !client_email)
      return res.status(400).json({ ok: false, error: "Missing fields" });

    // 🔍 جلب السعر الموسمي الصحيح (نسخة منطقية ومضمونة)
    const season = await db.get(
      `SELECT * FROM seasonal_prices
       WHERE hotel_id=? AND room_id=?
       AND NOT (
         date(end_date) < date(?) OR date(start_date) > date(?)
       )
       ORDER BY price DESC LIMIT 1`,
      [hotel_id, room_id, checkin_date, checkout_date]
    );

    // 🔍 جلب السعر الافتراضي للغرفة
    const room = await db.get(
      `SELECT price FROM rooms WHERE id=? AND hotel_id=?`,
      [room_id, hotel_id]
    );

    if (!room) {
      return res.status(404).json({ ok: false, error: "الغرفة غير موجودة" });
    }

    let price_per_night = season ? season.price : room.price;
    

    let min_stay = season ? season.min_stay : 1;

    // 🔍 التحقق من الحد الأدنى للإقامة
    const checkin = new Date(checkin_date);
    const checkout = new Date(checkout_date);
    const stayDays = Math.ceil((checkout - checkin) / (1000 * 60 * 60 * 24));

    let final_price = price_per_night * stayDays; // السعر الإجمالي

    // ⭐ حساب العربون 5%
    const depositAmount = Number((final_price * 0.05).toFixed(2));

    // ⭐ حساب المبلغ المتبقي بعد العربون
    const remainingAmount = Number((final_price - depositAmount).toFixed(2));

    

    if (stayDays < min_stay) {
      return res.status(400).json({
        ok: false,
        error: `المدة المطلوبة للإقامة في هذا الموسم هي ${min_stay} ليالي على الأقل`
      });
    }

    const booking_ref =
      "MS-" + new Date().getFullYear() + "-" + Math.floor(10000 + Math.random() * 90000);

    // 💾 حفظ الحجز في قاعدة البيانات
    
    await db.run(
     `INSERT INTO bookings (
        booking_ref, hotel_id, room_id, client_name, client_email, client_phone,
        checkin_date, checkout_date, status, final_price, is_seasonal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'WAITING_HOTEL_CONFIRM', ?, ?)`,
      [
        booking_ref,
        hotel_id,
        room_id,
        client_name,
        client_email,
        client_phone,     // ✅ أضفنا رقم الهاتف هنا
        checkin_date,
        checkout_date,
        final_price,
        season ? 1 : 0
      ]
    );

    // 🔍 جلب بيانات الحجز كاملة مع اسم الفندق بعد الإدخال
    const bookingRow = await db.get(
      `SELECT 
        b.*,
       h.name AS hotel_name,
       r.name AS room_name
      FROM bookings b
      JOIN hotels h ON h.id = b.hotel_id
      JOIN rooms  r ON r.id = b.room_id
      WHERE b.booking_ref = ?`,
      [booking_ref]
    );


    // 🔔 إرسال الإشعار الصحيح مع البيانات الحقيقية
    await notifyBookingEvent("BOOKING_CREATED", bookingRow);



    // ⏳ تحديث التواريخ الزمنية (تأكيد الفندق + الدفع الكامل)
    await db.run(
      `
      UPDATE bookings
      SET 
        hotel_confirm_by = datetime(created_at, '+1 day'),
        full_due_at = datetime(date(checkin_date), '-5 days'),
        cancel_after_full_due = datetime(date(checkin_date), '-3 days')
      WHERE booking_ref = ?
      `,
      [booking_ref]
    );

    // 🔍 حفظ معلومات السعر الموسمي إذا وجد
    if (season) {
      await db.run(
        `INSERT INTO booking_seasonal_info 
         (booking_ref, seasonal_price_id, original_price, seasonal_price)
         VALUES (?, ?, ?, ?)`,
        [booking_ref, season.id, room.price, season.price]
      );
    }

    
    // ✅ الرد النهائي
    res.json({
      ok: true,
      booking_ref,
      status: "WAITING_HOTEL_CONFIRM",
      final_price,
      is_seasonal: !!season,
      min_stay,
      policy_note: `🏨 تم إرسال طلب الحجز.\nرقم الحجز: ${booking_ref}\n⏳ الفندق سيراجع خلال 24 ساعة.\n${season ? `💰 سعر موسمي: $${final_price}` : `💰 السعر: $${final_price}`}`
    });
  } catch (e) {
    console.error("Erreur POST /bookings/create:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});


// ❌ إلغاء حجز من قبل الإدارة
router.patch("/:bookingRef/cancel", async (req, res) => {
  try {
    const ref = req.params.bookingRef;

    const booking = await db.get(
      "SELECT * FROM bookings WHERE booking_ref=? AND status NOT IN ('CANCELLED','REJECTED','EXPIRED')",
      [ref]
    );

    if (!booking) {
      return res.status(404).json({ ok: false, error: "الحجز غير موجود أو تم إلغاؤه مسبقًا." });
    }

    await db.run("UPDATE bookings SET status='CANCELLED' WHERE booking_ref=?", [ref]);

    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('CANCEL_BY_ADMIN', 'admin@mukallastay.com', ?)`,
      [JSON.stringify({ booking_ref: ref })]
    );

    res.json({ ok: true, message: `🛑 تم إلغاء الحجز ${ref} بنجاح.` });
  } catch (e) {
    console.error("Erreur /bookings/:ref/cancel:", e);
    res.status(500).json({ ok: false, error: "Server error أثناء الإلغاء" });
  }
});

// ✅ جلب تفاصيل حجز واحد
// 📦 جلب تفاصيل حجز واحد برقم المرجع
router.get("/:bookingRef", async (req, res) => {
  try {
    const ref = req.params.bookingRef;

    const booking = await db.get(
      `SELECT 
          b.id,
          b.booking_ref,
          b.hotel_id,
          b.room_id,
          b.client_name,
          b.client_email,
          b.checkin_date,
          b.checkout_date,
          b.status,
          b.deposit,
          b.created_at,
          b.updated_at,
          b.deposit_proof_url,
          b.final_price,
          b.is_seasonal,
          -- 🕒 الأعمدة الجديدة للمهل
          b.hotel_confirm_by,
          b.deposit_due_at,
          b.full_due_at,
          b.cancel_after_full_due,
          b.final_paid,
          b.cancel_reason,
          -- 🏨 بيانات إضافية
          h.name AS hotel_name,
          r.name AS room_name,
          s.season_name AS season_name,
          s.price AS seasonal_price,
          s.min_stay AS seasonal_min_stay
       FROM bookings b
       JOIN hotels h ON h.id = b.hotel_id
       JOIN rooms  r ON r.id = b.room_id
       LEFT JOIN seasonal_prices s ON s.id = (
         SELECT id FROM seasonal_prices 
         WHERE hotel_id = b.hotel_id 
           AND room_id = b.room_id 
           AND date(b.checkin_date) BETWEEN start_date AND end_date
         LIMIT 1
       )
       WHERE b.booking_ref = ?`,
      [ref]
    );

    if (!booking) {
      return res.status(404).json({ ok: false, error: "لم يتم العثور على الحجز" });
    }

    res.json({ ok: true, booking });
  } catch (e) {
    console.error("Erreur GET /bookings/:ref:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});


// 📧 عرض جميع الحجوزات حسب البريد الإلكتروني
// ✅ إرجاع الحجوزات المؤكدة فقط (للتقييمات)
// ✅ 1. مسار عام (لعرض كل الحجوزات)
router.get("/by-email/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const rows = await db.all(
      `
      SELECT 
        b.booking_ref,
        b.client_name,
        b.client_email,
        b.status,
        b.created_at,
        b.final_price,
        b.is_seasonal,
        h.name AS hotel_name,
        r.name AS room_name,
        b.checkin_date,
        b.checkout_date
      FROM bookings b
      JOIN hotels h ON b.hotel_id = h.id
      JOIN rooms  r ON b.room_id = r.id
      WHERE LOWER(b.client_email) = LOWER(?)
      ORDER BY b.created_at DESC
      `,
      [email]
    );

    res.json({ ok: true, bookings: rows });
  } catch (err) {
    console.error("❌ Error fetching bookings by email:", err);
    res.status(500).json({ ok: false, error: "Server error أثناء تحميل الحجوزات" });
  }
});


// ✅ 2. مسار خاص بالتقييمات (يُظهر فقط المؤكد)
router.get("/confirmed-by-email/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const rows = await db.all(
      `
      SELECT 
        b.booking_ref,
        b.client_name,
        b.client_email,
        b.status,
        b.created_at,
        b.final_price,
        b.is_seasonal,
        h.name AS hotel_name,
        r.name AS room_name,
        b.checkin_date,
        b.checkout_date
      FROM bookings b
      JOIN hotels h ON b.hotel_id = h.id
      JOIN rooms  r ON b.room_id = r.id
      WHERE LOWER(b.client_email) = LOWER(?)
        AND b.status = 'CONFIRMED'
      ORDER BY b.created_at DESC
      `,
      [email]
    );

    res.json({ ok: true, bookings: rows });
  } catch (err) {
    console.error("❌ Error fetching confirmed bookings by email:", err);
    res.status(500).json({ ok: false, error: "Server error أثناء تحميل الحجوزات المؤكدة" });
  }
});



// ✅ الإبقاء على هذا الراوت كما طلبت (بدون حذف)
// لكنه الآن لا يعلن CONFIRMED إلا إذا:
// - الحالة الحالية DEPOSIT_SENT
// - يوجد إيصال مرفوع (deposit_proof_url) أو دفعة معلّقة في جدول payments
// ✅ اعتماد العربون من الإدارة
router.post("/approve-deposit/:ref", async (req, res) => {
  try {
    const { ref } = req.params;

    // 📦 جلب الحجز + اسم الفندق
    const booking = await db.get(`
      SELECT b.*, h.name AS hotel_name
      FROM bookings b
      JOIN hotels h ON h.id = b.hotel_id
      WHERE b.booking_ref = ?
    `, [ref]);

    if (!booking)
      return res.status(404).json({ ok: false, error: "الحجز غير موجود" });

    if (booking.status !== "DEPOSIT_SENT") {
      return res.status(400).json({
        ok: false,
        error: "لا يمكن اعتماد العربون قبل رفع الإيصال ومراجعته.",
      });
    }

    const payment = await db.get(
      "SELECT * FROM payments WHERE booking_ref=? AND (confirmed=0 OR confirmed=1) ORDER BY id DESC LIMIT 1",
      [ref]
    );

    if (!booking.deposit_proof_url && !payment?.proof_url) {
      return res.status(400).json({
        ok: false,
        error: "لا يوجد إيصال مرفوع لهذا الحجز.",
      });
    }

    // ✅ تحديث الحالة
    await db.run("UPDATE bookings SET status='CONFIRMED' WHERE booking_ref=?", [ref]);

    // 🔔 إشعار العميل بتأكيد العربون
    // 🔔 إشعار العميل بتأكيد العربون
    if (booking.client_phone && booking.client_phone.startsWith("+")) {
     console.log("📤 إرسال إشعار DEPOSIT_CONFIRMED إلى:", booking.client_phone);
     await notifyBookingEvent("DEPOSIT_CONFIRMED", booking);

      

    } else {
      console.warn("⚠️ لا يوجد رقم هاتف صالح في هذا الحجز:", booking.booking_ref, booking.client_phone);
      console.log("📦 بيانات الحجز:", booking);
    }


    // 🗂️ سجل العملية
    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('APPROVE_DEPOSIT_LEGACY', 'admin@mukallastay.com', ?)`,
      [JSON.stringify({ booking_ref: ref })]
    );

    res.json({ ok: true, message: `✅ تم اعتماد العربون بنجاح للحجز ${ref}` });
  } catch (err) {
    console.error("Erreur /approve-deposit:", err);
    res.status(500).json({ ok: false, error: "Server error أثناء اعتماد العربون" });
  }
});

// 🗂️ إعداد رفع الإيصالات (يجب أن يكون فوق أي route يستخدم upload)
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) =>
    cb(null, "deposit_" + Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });


// ✅ رفع إيصال العربون من العميل (بديل إضافي)
// ✅ رفع إيصال العربون من العميل
// ✅ رفع إيصال العربون من العميل
// ✅ رفع إيصال العربون من العميل
router.post("/upload-deposit/:bookingRef", upload.single("proof"), async (req, res) => {
  try {
    const ref = req.params.bookingRef;
    if (!req.file)
      return res.status(400).json({ ok: false, error: "لم يتم إرسال ملف." });

    const filePath = `/uploads/${req.file.filename}`;

    // 📦 جلب بيانات الحجز مع الفندق قبل التحديث
    let booking = await db.get(`
      SELECT b.*, h.name AS hotel_name
      FROM bookings b
      JOIN hotels h ON h.id = b.hotel_id
      WHERE b.booking_ref=? AND b.status IN ('AWAITING_DEPOSIT','DEPOSIT_SENT')
    `, [ref]);

    if (!booking) {
      console.warn("⚠️ لم يتم العثور على الحجز أو حالته لا تسمح بالرفع:", ref);
      return res.status(400).json({
        ok: false,
        error: "الحجز غير مؤهل لرفع العربون أو تم إلغاؤه.",
      });
    }

    // ✅ تحديث الحالة والإيصال
    await db.run(
      "UPDATE bookings SET deposit_proof_url = ?, status = 'DEPOSIT_SENT', updated_at = CURRENT_TIMESTAMP WHERE booking_ref = ?",
      [filePath, ref]
    );

    // 📥 إعادة جلب البيانات بعد التحديث (لضمان وجودها الأحدث)
    booking = await db.get(`
      SELECT b.*, h.name AS hotel_name
      FROM bookings b
      JOIN hotels h ON h.id = b.hotel_id
      WHERE b.booking_ref = ?
    `, [ref]);

    console.log("📸 تم رفع الإيصال وتحديث حالة الحجز:", booking.booking_ref);

    // 🔔 إرسال إشعار واتساب بعد التأكد من وجود رقم الهاتف
    if (booking.client_phone && booking.client_phone.startsWith("+")) {
      console.log("🚀 إرسال إشعار DEPOSIT_UPLOADED إلى:", booking.client_phone);
      await notifyBookingEvent("DEPOSIT_UPLOADED", {
        client_phone: booking.client_phone,
        client_name: booking.client_name,
        booking_ref: booking.booking_ref,
        hotel_name: booking.hotel_name || "MukallaStay"
      });
      console.log("✅ تم إرسال إشعار DEPOSIT_UPLOADED بنجاح!");
    } else {
      console.warn("⚠️ لا يوجد رقم هاتف صالح لإرسال إشعار DEPOSIT_UPLOADED:", booking.client_phone);
    }
    
    // 🧾 تسجيل العملية في السجلات
    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('UPLOAD_DEPOSIT_PROOF', ?, ?)`,
      [booking.client_email || "client@mukallastay.com", JSON.stringify({ booking_ref: ref, file: filePath })]
    );

    // ✅ الرد النهائي
    res.json({
      ok: true,
      message: "✅ تم الرفع بنجاح. بانتظار مراجعة الإدارة.",
      deposit_proof_url: filePath,
    });
  } catch (err) {
    console.error("Erreur /upload-deposit:", err);
    res.status(500).json({ ok: false, error: "حدث خطأ أثناء رفع الإيصال" });
  }
});


// 🗂️ إعداد رفع الإيصالات (مطلوب قبل استخدام upload)






// ✅ الفندق يؤكد الحجز
// ✅ الفندق يؤكد الحجز
router.post("/confirm-by-hotel/:bookingRef", async (req, res) => {
  try {
    const ref = req.params.bookingRef;

    // تأكد أن الحجز ينتظر تأكيد الفندق
    const booking = await db.get(
      `SELECT b.*, h.name AS hotel_name 
       FROM bookings b
       JOIN hotels h ON h.id = b.hotel_id
       WHERE b.booking_ref=? AND b.status='WAITING_HOTEL_CONFIRM'`,
      [ref]
    );

    if (!booking)
      return res.status(404).json({ ok: false, error: "الحجز غير موجود أو تمت معالجته سابقًا." });

    // تحديث الحالة
    await db.run("UPDATE bookings SET status='AWAITING_DEPOSIT' WHERE booking_ref=?", [ref]);

    // 🔔 إشعار العميل بتأكيد الفندق
    if (booking.client_phone) {
      await notifyBookingEvent("HOTEL_CONFIRMED", {
       client_phone: booking.client_phone,
       client_name: booking.client_name,
       booking_ref: booking.booking_ref,
       hotel_name: booking.hotel_name || "MukallaStay",
       final_price: booking.final_price    // أهم سطر
      });

    }

    // حفظ في سجل العمليات
    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('CONFIRM_BY_HOTEL', ?, ?)`,
      [booking.client_email, JSON.stringify({ booking_ref: ref })]
    );

    res.json({ ok: true, message: `✅ تم تأكيد الحجز ${ref}` });
  } catch (err) {
    console.error("Erreur /confirm-by-hotel:", err);
    res.status(500).json({ ok: false, error: "فشل في تأكيد الحجز" });
  }
});


// ❌ الفندق يرفض الحجز
router.post("/reject-by-hotel/:bookingRef", async (req, res) => {
  try {
    const ref = req.params.bookingRef;

    const booking = await db.get(
      "SELECT * FROM bookings WHERE booking_ref=? AND status='WAITING_HOTEL_CONFIRM'",
      [ref]
    );
    if (!booking)
      return res.status(404).json({ ok: false, error: "الحجز غير موجود أو تمت معالجته سابقًا." });

    await db.run("UPDATE bookings SET status='REJECTED' WHERE booking_ref=?", [ref]);

    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('REJECT_BY_HOTEL', ?, ?)`,
      [booking.client_email, JSON.stringify({ booking_ref: ref })]
    );

    res.json({ ok: true, message: `❌ تم رفض الحجز ${ref}` });
  } catch (err) {
    console.error("Erreur /reject-by-hotel:", err);
    res.status(500).json({ ok: false, error: "فشل في رفض الحجز" });
  }
});

// ✅ تصدير الراوتر
module.exports = router;