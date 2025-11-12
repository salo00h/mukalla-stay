const twilio = require("twilio");

const accountSid = "AC4609183ec7c2b16d35fe842fc260f97a";
const authToken = "673426e9a5d67314b49160a5055cac03";

const client = twilio(accountSid, authToken);

async function sendWhatsApp(to, msg) {
  try {
    const message = await client.messages.create({
      from: "whatsapp:+14155238886",
      to: `whatsapp:${to}`,
      body: msg
    });
    console.log(`✅ تم إرسال رسالة واتساب: ${message.sid} | الحالة: ${message.status}`);
  } catch (err) {
    console.error("❌ خطأ في إرسال واتساب:", err.message);
  }
}

module.exports = { sendWhatsApp };
