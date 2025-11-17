const axios = require("axios");

// إرسال رسالة واتساب نصية (بدون قالب)
async function sendWhatsAppMeta(to, message) {
  try {
    const url = `https://graph.facebook.com/v19.0/${process.env.META_PHONE_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: message
      }
    };

    const headers = {
      Authorization: `Bearer ${process.env.META_TOKEN}`,
      "Content-Type": "application/json",
    };

    const res = await axios.post(url, payload, { headers });
    console.log("✅ WhatsApp message sent:", res.data);

  } catch (err) {
    console.error("❌ WhatsApp send error:", err.response?.data || err.message);
  }
}

module.exports = {
  sendWhatsAppMeta,
  sendWhatsAppTemplate
};
