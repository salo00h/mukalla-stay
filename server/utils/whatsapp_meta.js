// server/utils/whatsapp_meta.js
const axios = require("axios");

async function sendWhatsAppTemplate(to, templateName, paramsArray) {
  try {
    const url = `https://graph.facebook.com/v19.0/${process.env.META_PHONE_ID}/messages`;

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
            parameters: paramsArray.map(v => ({
              type: "text",
              text: v
            }))
          }
        ]
      }
    };

    const headers = {
      Authorization: `Bearer ${process.env.META_TOKEN}`,
      "Content-Type": "application/json",
    };

    const res = await axios.post(url, payload, { headers });
    console.log("✅ Meta Template sent:", res.data);

  } catch (err) {
    console.error("❌ Meta template send error:", err.response?.data || err.message);
  }
}

module.exports = { sendWhatsAppTemplate };
