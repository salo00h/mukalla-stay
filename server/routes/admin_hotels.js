// server/routes/admin_hotels.js
const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");

// ✅ تفعيل حساب فندق
router.post("/hotels/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const row = await db.get("SELECT id, name, email, active FROM hotels WHERE id=?", [id]);
    if (!row) return res.status(404).json({ ok:false, error:"الفندق غير موجود." });
    if (row.active === 1) return res.json({ ok:true, message:"الفندق مُفعّل مسبقاً." });

    await db.run("UPDATE hotels SET active=1 WHERE id=?", [id]);
    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('ADMIN_APPROVE_HOTEL', 'admin@mukallastay.com', ?)`,
      [JSON.stringify({ hotel_id:id })]
    );

    res.json({ ok:true, message:"✅ تم تفعيل الفندق بنجاح." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"خطأ في الخادم أثناء التفعيل." });
  }
});

// ❌ رفض / إلغاء فندق
router.post("/hotels/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    await db.run("UPDATE hotels SET active=0 WHERE id=?", [id]);
    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('ADMIN_REJECT_HOTEL', 'admin@mukallastay.com', ?)`,
      [JSON.stringify({ hotel_id:id })]
    );
    res.json({ ok:true, message:"🛑 تم رفض الطلب." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"خطأ في الخادم أثناء الرفض." });
  }
});

// قائمة الفنادق غير المفعّلة
router.get("/hotels/pending", async (req, res) => {
  try {
    const hotels = await db.all("SELECT id, name, area, address, email FROM hotels WHERE active=0");
    res.json({ ok: true, hotels });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "خطأ في تحميل الفنادق الجديدة." });
  }
});


module.exports = router;
