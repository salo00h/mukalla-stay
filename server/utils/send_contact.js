const axios = require("axios");

const META_URL = `https://graph.facebook.com/v19.0/${process.env.META_PHONE_ID}/messages`;
const HEADERS = {
  Authorization: `Bearer ${process.env.META_TOKEN}`,
  "Content-Type": "application/json",
};

async function sendAutoReply(to) {
  try {
    // 1️⃣ الرسالة أولاً
    await axios.post(
      META_URL,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: {
          body:
            "⚠️ لم يتم استلام رسالتك هنا.\n\n" +
            "يرجى التواصل مباشرة مع فريق الدعم.\n\n" +
            "يمكنك مراسلتنا عبر الرابط أو حفظ جهة الاتصال بالأسفل 👇\n\n" +
            "👉 https://wa.me/33777263112\n\n" +
            "MukallaStay Support",
        },
      },
      { headers: HEADERS }
    );

    // 2️⃣ جهة الاتصال بعدها
    await axios.post(
      META_URL,
      {
        messaging_product: "whatsapp",
        to,
        type: "contacts",
        contacts: [
          {
            name: {
              formatted_name: "MukallaStay Support",
              first_name: "MukallaStay",
              last_name: "Support",
            },
            phones: [
              {
                phone: "33777263112", // بدون +
                type: "WORK",
                wa_id: "33777263112",
              },
            ],
          },
        ],
      },
      { headers: HEADERS }
    );

    console.log("✅ Text then Contact sent");
  } catch (err) {
    console.error(
      "❌ WhatsApp auto-reply error:",
      err.response?.data || err.message
    );
  }
}

module.exports = { sendAutoReply };
