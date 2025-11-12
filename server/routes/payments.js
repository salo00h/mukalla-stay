// server/routes/payments.js
const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// 🧾 إعداد مجلد رفع الصور
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// ⚙️ إعداد multer لتخزين الصور
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 💳 إرسال إيصال العربون (رفع الصورة)
// الحالة الصحيحة الآن: WAITING_CLIENT_DEPOSIT
router.post("/upload-proof/:bookingRef", upload.single("proof"), async (req, res) => {
  try {
    const { method, amount } = req.body;
    const ref = req.params.bookingRef;
    const proof_url = req.file ? "/uploads/" + req.file.filename : null;

    if (!method || !amount)
      return res.status(400).json({ ok: false, error: "البيانات ناقصة" });

    // ✅ التأكد أن الحجز بانتظار العربون من العميل
    const booking = await db.get(
      "SELECT * FROM bookings WHERE booking_ref=? AND status IN ('WAITING_CLIENT_DEPOSIT','AWAITING_DEPOSIT')",
      [ref]
    );
    if (!booking)
      return res.status(400).json({
        ok: false,
        error: "❌ لا يمكن رفع الإيصال قبل أن يؤكد الفندق الحجز."
      });

    // 💾 حفظ في جدول المدفوعات
    await db.run(
      `INSERT INTO payments (booking_ref, method, amount, proof_url, confirmed)
       VALUES (?, ?, ?, ?, 0)`,
      [ref, method, amount, proof_url]
    );

    // 🔄 تحديث حالة الحجز مع حفظ رابط الصورة
    await db.run(
      "UPDATE bookings SET status='DEPOSIT_SENT', deposit_proof_url=?, updated_at=CURRENT_TIMESTAMP WHERE booking_ref=?",
      [proof_url, ref]
    );

    const { sendDepositProofNotification } = require("../utils/booking_notifications");
    await sendDepositProofNotification(ref);


    res.json({
      ok: true,
      message: "✅ تم رفع إثبات الدفع بنجاح. سيتم المراجعة خلال 24 ساعة.",
      proof_url
    });
  } catch (e) {
    console.error("Erreur /upload-proof:", e);
    res.status(500).json({ ok: false, error: "خطأ في الخادم" });
  }
});

// 💳 دفع المبلغ الكامل (رفع إيصال ثاني)
router.post("/upload-final/:bookingRef", upload.single("proof"), async (req, res) => {
  try {
    const { method, amount } = req.body;
    const ref = req.params.bookingRef;
    const proof_url = req.file ? "/uploads/" + req.file.filename : null;

    if (!method || !amount)
      return res.status(400).json({ ok: false, error: "البيانات ناقصة" });

    // ✅ يجب أن يكون الحجز مؤكد (دفع عربون سابقًا)
    const booking = await db.get(
      "SELECT * FROM bookings WHERE booking_ref=? AND status='CONFIRMED'",
      [ref]
    );
    if (!booking)
      return res.status(400).json({
        ok: false,
        error: "❌ لا يمكن دفع المبلغ الكامل قبل اعتماد الحجز."
      });

    // 💾 تسجيل دفعة نهائية جديدة
    await db.run(
      `INSERT INTO payments (booking_ref, method, amount, proof_url, confirmed)
       VALUES (?, ?, ?, ?, 0)`,
      [ref, method, amount, proof_url]
    );

    // 📆 لا نغير الحالة، فقط نحدث الوقت
    await db.run(
      "UPDATE bookings SET updated_at=CURRENT_TIMESTAMP WHERE booking_ref=?",
      [ref]
    );

    res.json({
      ok: true,
      message: "✅ تم رفع إيصال الدفع الكامل. سيتم المراجعة قريبًا.",
      proof_url
    });
  } catch (e) {
    console.error("Erreur /upload-final:", e);
    res.status(500).json({ ok: false, error: "خطأ في الخادم" });
  }
});


// ✅ قائمة المدفوعات (للإدارة)
router.get("/", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT 
        p.*, 
        b.client_name, 
        b.client_email, 
        h.name AS hotel_name,
        r.name AS room_name
      FROM payments p
      JOIN bookings b ON p.booking_ref = b.booking_ref
      JOIN hotels   h ON b.hotel_id = h.id
      JOIN rooms    r ON b.room_id  = r.id
      ORDER BY p.id DESC
    `);
    res.json({ ok: true, payments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

router.post("/upload-proof", upload.single("proof"), async (req, res) => {
  const { booking_ref, amount, method } = req.body;
  const fileUrl = "/uploads/" + req.file.filename;
  await db.run(
    "INSERT INTO payments (booking_ref, amount, method, proof_url) VALUES (?,?,?,?)",
    [booking_ref, amount, method, fileUrl]
  );
  await db.run(
    "UPDATE bookings SET deposit_proof_url=?, status='DEPOSIT_SENT' WHERE booking_ref=?",
    [fileUrl, booking_ref]
  );
  res.json({ ok: true, message: "Proof uploaded" });
});


module.exports = router;
