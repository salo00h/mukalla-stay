const axios = require("axios");

async function sendContact(to) {
  const url = `https://graph.facebook.com/v19.0/${process.env.META_PHONE_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "contacts",
    contacts: [
      {
        name: {
          formatted_name: "MukallaStay Support",
          first_name: "MukallaStay",
          last_name: "Support"
        },
        phones: [
          {
            phone: "33777263112", // بدون +
            type: "WORK"
          }
        ]
      }
    ]
  };

  const headers = {
    Authorization: `Bearer ${process.env.META_TOKEN}`,
    "Content-Type": "application/json"
  };

  try {
    const res = await axios.post(url, payload, { headers });
    console.log("✅ Contact sent:", res.data);
  } catch (err) {
    console.error("❌ Contact send error:", err.response?.data || err.message);
  }
}

module.exports = { sendContact };
