const express = require("express");
const router = express.Router();
const db = require("../db/sqlite");
const bcrypt = require("bcryptjs");

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ ok: false, error: "يرجى إدخال البريد وكلمة المرور" });

    const hotel = await db.get("SELECT * FROM hotels WHERE email = ?", [email]);
    if (!hotel)
      return res.status(404).json({ ok: false, error: "الفندق غير موجود" });

    if (hotel.active === 0)
      return res.status(403).json({ ok: false, error: "لم يتم تفعيل الفندق بعد" });

    const match = await bcrypt.compare(password, hotel.password_hash || "");
    if (!match)
      return res.status(401).json({ ok: false, error: "كلمة المرور غير صحيحة" });

    res.json({
      ok: true,
      hotel: {
        id: hotel.id,
        name: hotel.name,
        email: hotel.email,
        area: hotel.area,
        address: hotel.address,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "حدث خطأ في الخادم" });
  }
});

module.exports = router;
