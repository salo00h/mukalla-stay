require("dotenv").config();
const { sendWhatsAppMeta } = require("./utils/whatsapp_meta");

(async () => {
  console.log("🚀 بدء اختبار الإرسال من MukallaStay عبر Meta API...");
  await sendWhatsAppMeta("+33777263112", "مرحبًا صالح 👋 هذا اختبار مباشر من موقع MukallaStay ✅");
})();
