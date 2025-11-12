// server/routes/hotel_signup.js
const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random()*1e9);
    cb(null, "hotel_" + unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// POST /api/public/hotels/register
router.post(
  "/register",
  upload.fields([
    { name: "cover", maxCount: 1 },      // صورة غلاف
    { name: "gallery", maxCount: 10 },   // ألبوم صور (اختياري)
  ]),
  async (req, res) => {
    try {
      const {
        name, area, address,
        email, password,
        phone, description
      } = req.body;

      if (!name || !email || !password || !area || !address) {
        return res.status(400).json({ ok:false, error:"البيانات الأساسية ناقصة." });
      }

      // تحقق من تكرار البريد
      const exists = await db.get("SELECT id FROM hotels WHERE email = ?", [email]);
      if (exists) return res.status(400).json({ ok:false, error:"هذا البريد مستخدم من قبل." });

      const hash = await bcrypt.hash(password, 10);

      const coverFile = req.files?.cover?.[0] || null;
      const cover_url = coverFile ? ("/uploads/" + coverFile.filename) : null;

      const gallery = (req.files?.gallery || []).map(f => "/uploads/" + f.filename);
      const gallery_json = JSON.stringify(gallery);

      // 🔒 الحساب يُنشأ غير مُفعّل (active=0) بإنتظار موافقة الإدارة
      const result = await db.run(
        `INSERT INTO hotels (name, area, address, email, password_hash, active, cover_url, gallery_json, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`,
        [name, area, address, email, hash, cover_url, gallery_json]
      );

      // لوج監audit (اختياري)
      await db.run(
        `INSERT INTO audit_logs (action, user_email, payload)
         VALUES ('HOTEL_SIGNUP', ?, ?)`,
        [email, JSON.stringify({ hotel_id: result.lastID, name, area, address })]
      );

      return res.json({
        ok:true,
        message:"✅ تم استلام طلب الإنضمام. سيوافق المشرف خلال 24 ساعة.",
        pending_hotel_id: result.lastID
      });
    } catch (e) {
      console.error("register hotel error:", e);
      return res.status(500).json({ ok:false, error:"خطأ في الخادم أثناء إنشاء الفندق." });
    }
  }
);

module.exports = router;
