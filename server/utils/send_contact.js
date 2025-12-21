const axios = require("axios");

const META_URL = `https://graph.facebook.com/v19.0/${process.env.META_PHONE_ID}/messages`;
const HEADERS = {
  Authorization: `Bearer ${process.env.META_TOKEN}`,
  "Content-Type": "application/json",
};

async function sendAutoReply(to) {
  try {
    await axios.post(
      META_URL,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: {
          body:
            "⚠️ لم يتم استلام رسالتك هنا.\n\n" +
            "يرجى التواصل مباشرة مع فريق الدعم عبر هذا الرقم:\n\n" +
            "👉 https://wa.me/33777263112\n\n" +
            "MukallaStay Support",
        },
      },
      { headers: HEADERS }
    );

    console.log("✅ Auto reply sent (safe mode)");
  } catch (err) {
    console.error(
      "❌ WhatsApp auto-reply error:",
      err.response?.data || err.message
    );
  }
}

module.exports = { sendAutoReply };
