const axios = require("axios");

/**
 * إرسال Template WhatsApp
 */
async function sendWhatsAppTemplate(to, templateName, params = []) {
  try {
    const url = `https://graph.facebook.com/v20.0/${process.env.META_PHONE_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "ar" },
        components: [
          {
            type: "body",
            parameters: params.map((p) => ({ type: "text", text: p })),
          },
        ],
      },
    };

    const headers = {
      Authorization: `Bearer ${process.env.META_TOKEN}`,
      "Content-Type": "application/json",
    };

    const res = await axios.post(url, payload, { headers });
    console.log("✅ Template sent:", res.data);
  } catch (err) {
    console.error("❌ Template send error:", err.response?.data || err.message);
  }
}

module.exports = { sendWhatsAppTemplate };
