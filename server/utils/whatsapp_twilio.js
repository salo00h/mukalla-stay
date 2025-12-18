const twilio = require("twilio");

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_TOKEN;

const client = twilio(accountSid, authToken);

async function sendWhatsApp(to, msg) {
  try {
    const message = await client.messages.create({
      from: "whatsapp:+14155238886",
      to: `whatsapp:${to}`,
      body: msg
    });
    console.log(`✅ تم إرسال رسالة واتساب: ${message.sid}`);
  } catch (err) {
    console.error("❌ خطأ في إرسال واتساب:", err.message);
  }
}

module.exports = { sendWhatsApp };
