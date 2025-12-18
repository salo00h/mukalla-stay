// server/utils/booking_notifications.js

const { sendWhatsAppTemplate } = require("./whatsapp_meta.js");

// ======================================================
//   🔔 دالة الإشعارات الموحدة — النسخة النهائية
// ======================================================
async function notifyBookingEvent(event, booking) {
  try {
    console.log("🔥 notifyBookingEvent:", event);

    const phone = booking.client_phone;
    if (!phone) return console.warn("⚠️ لا يوجد رقم هاتف:", booking.booking_ref);

    const name = booking.client_name || "العميل";
    const hotel = booking.hotel_name || "MukallaStay";
    const ref = booking.booking_ref;
    const finalPrice = Number(booking.final_price) || 0;

    const depositAmount = (finalPrice * 0.05).toFixed(2);
    const remainingAmount = (finalPrice - depositAmount).toFixed(2);

    // ======================================================
    // 1️⃣  BOOKING_CREATED
    // ======================================================
    if (event === "BOOKING_CREATED") {
      const arrival = booking.checkin_date?.substring(0, 10) || "غير محدد";
      const checkout = booking.checkout_date?.substring(0, 10) || "غير محدد";

      return await sendWhatsAppTemplate(phone, "booking_confirmation", [
        name,                 // {{1}}
        hotel,                // {{2}}
        arrival,              // {{3}}
        checkout,             // {{4}}
        finalPrice + "€",     // {{5}}
        depositAmount + "€"   // {{6}}
      ]);
    }

    // ======================================================
    // 2️⃣ HOTEL_CONFIRMED
    // ======================================================
    if (event === "HOTEL_CONFIRMED") {
      return await sendWhatsAppTemplate(phone, "hotel_confirmed", [
        name,                   // {{1}}
        hotel,                  // {{2}}
        ref,                    // {{3}}
        depositAmount + "€"     // {{4}}
      ]);
    }

    // ======================================================
    // 3️⃣ DEPOSIT_UPLOADED
    // ======================================================
    if (event === "DEPOSIT_UPLOADED") {
      return await sendWhatsAppTemplate(phone, "deposit_uploaded", [
        name,   // {{1}}
        ref     // {{2}}
      ]);
    }

    // ======================================================
    // 4️⃣ DEPOSIT_CONFIRMED — تم اعتماد العربون
    // ======================================================
    if (event === "DEPOSIT_CONFIRMED") {
      const arrival = booking.checkin_date?.substring(0, 10) || "غير محدد";
      const checkout = booking.checkout_date?.substring(0, 10) || "غير محدد";

      return await sendWhatsAppTemplate(phone, "deposit_confirmed", [
        name,                     // {{1}}
        ref,                    // {{2}}
        hotel,                      // {{3}}
        arrival,                  // {{4}}
        checkout,                 // {{5}}
        finalPrice + "€",         // {{6}}
        remainingAmount + "€"     // {{7}}
      ]);
    }

    console.log("⚠️ حدث غير مدعوم:", event);

  } catch (err) {
    console.error("❌ notifyBookingEvent ERROR:", err);
  }
}

module.exports = { notifyBookingEvent };
