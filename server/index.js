// server/index.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { initSchema } = require("./db/sqlite");
const fs = require("fs");
require("dotenv").config();
const { sendContact } = require("./utils/send_contact");


const app = express();
const PORT = process.env.PORT || 3000;


// 🛡️ إعدادات الأمان
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// 🧰 JSON
app.use(express.json());
// 🟢 واجهة العميل
app.use("/client", express.static(path.join(__dirname, "public", "client")));


// 🖼️ ملفات الرفع (إيصالات العربون)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 🖼️ عرض الملفات من public
app.use(express.static(path.join(__dirname, "public")));

// 🖼️ عرض الصور من مجلد img
app.use("/images", express.static(path.join(__dirname, "public", "img")));



// 🚫 Rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// ✅ Routes
app.use("/api/public", require("./routes/public"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/payments", require("./routes/payments"));

app.use("/api/admin", require("./routes/admin"));
app.use("/api/admin", require("./routes/admin_hotels"));
app.use("/api/admin", require("./routes/admin_dashboard"));
app.use("/api/admin", require("./routes/admin_revenues"));





app.use("/api/rooms", require("./routes/rooms"));

app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/calendar", require("./routes/calendar"));

app.use("/api/hotel", require("./routes/hotel_auth"));
app.use("/api/hotel", require("./routes/hotel-analytics"));
app.use("/api/hotel", require("./routes/hotel-revenues"));
app.use("/api/admin", require("./routes/admin_hotel_details"));
app.use("/api/seasons", require("./routes/seasonalPrices"));
app.use("/api/public/hotels", require("./routes/hotel_signup"));

app.use("/api/admin", require("./routes/admin_dashboard"));




// 📩 Webhook WhatsApp: أي رسالة → رد بجهة اتصال
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (message && message.from) {
      const from = message.from;

      console.log("📩 Incoming WhatsApp message from:", from);

      // رد تلقائي بجهة اتصال
      await sendContact(from);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.sendStatus(200);
  }
});







// 🔍 Test
app.get("/", (req, res) => res.send("🚀 MukallaStay API running"));

// ✅ اختبار الصور خطوة بخطوة
app.get("/debug-images", (req, res) => {
  const imgDir = path.join(__dirname, "public", "img");
  if (!fs.existsSync(imgDir)) {
    return res.send(`❌ مجلد الصور غير موجود: ${imgDir}`);
  }
  const files = fs.readdirSync(imgDir);
  res.send(`✅ المجلد موجود ويحتوي على:\n${files.join("\n")}`);
});

// 🚀 Start server
(async () => {
  try {
    // 🗄️ إنشاء القاعدة فقط في أول مرة
    const dbFile = path.join(__dirname, "db", "database.db");
    if (!fs.existsSync(dbFile)) {
      console.log("🆕 أول تشغيل: إنشاء قاعدة البيانات...");
      await initSchema();
    } else {
      console.log("✅ قاعدة البيانات موجودة، لن نعيد التهيئة.");
    }

    app.listen(PORT, () =>
      console.log(`✅ Server started at http://localhost:${PORT}`)
    );

    // ⏰ تشغيل الكرون لإلغاء الحجوزات المنتهية المهلة
   const { startAutoCancelJob } = require("./cron/auto_cancel");
   startAutoCancelJob();
   console.log("🔁 Auto cancel job started (runs every 10 minutes)");


    // 🤖 الفحص التلقائي للحجوزات (مسار مرن)
    try {
      let checker;
      try {
        checker = require("./auto/checker");
      } catch {
        checker = require("./checker");
      }
      if (checker?.runAutoChecksOnce) {
        checker.runAutoChecksOnce();
        setInterval(checker.runAutoChecksOnce, 24 * 60 * 60 * 1000); // كل 24 ساعة
      }
    } catch (e) {
      console.warn("⚠️ لم أستطع تحميل أداة الفحص التلقائي:", e.message);
    }
  } catch (e) {
    console.error("DB init error:", e);
    process.exit(1);
  }
})();
