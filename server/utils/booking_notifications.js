// server/utils/booking_notifications.js
const db = require("../db/sqlite");
const { sendWhatsAppTemplate } = require("./whatsapp_meta.js");

// 🔔 دالة الإشعارات الموحدة لجميع الأحداث
async function notifyBookingEvent(event, booking) {
  try {
    const phone = booking.client_phone;
    const ref = booking.booking_ref;
    const name = booking.client_name || "العميل";
    const hotel = booking.hotel_name || "أحد فنادق MukallaStay";

    if (!phone) {
      console.warn(`⚠️ لا يوجد رقم هاتف لإرسال إشعار ${event} للحجز ${ref}`);
      return;
    }

    switch (event) {
      // ✅ الحالة الوحيدة اللي عندنا لها Template حاليًا
      case "BOOKING_CREATED":
        console.log("📨 إرسال Template booking_confirmation ...");

        await sendWhatsAppTemplate(phone, "booking_confirmation", [
          name,                     // {{1}} اسم العميل
          hotel,                    // {{2}} اسم الفندق
          booking.checkin_date,     // {{3}} تاريخ الوصول
          "بدون وقت",               // {{4}} وقت الوصول (ما عندنا عمود وقت)
          booking.final_price + "€" // {{5}} المبلغ النهائي
        ]);

        return;

      // باقي الحالات لسه ما عندها Templates
      case "HOTEL_CONFIRMED":
      case "DEPOSIT_UPLOADED":
      case "DEPOSIT_CONFIRMED":
      case "REMINDER_FINAL_PAYMENT":
      case "BOOKING_CANCELLED":
        console.log(
          `⚠️ الحدث ${event} لا يملك Template بعد، لن يتم إرسال رسالة واتساب.`
        );
        return;

      default:
        console.log("⚠️ حدث غير معروف:", event);
        return;
    }
  } catch (err) {
    console.error(`❌ خطأ أثناء تنفيذ notifyBookingEvent (${event}):`, err.message);
  }
}

// 🧾 إشعار خاص عند رفع إيصال العربون
async function sendDepositProofNotification(bookingRef) {
  try {
    const booking = await db.get(
      `SELECT 
         b.booking_ref, 
         b.client_name, 
         b.client_phone, 
         h.name AS hotel_name
       FROM bookings b
       JOIN hotels h ON h.id = b.hotel_id
       WHERE b.booking_ref = ?`,
      [bookingRef]
    );

    if (!booking) {
      console.warn("⚠️ لم يتم العثور على بيانات الحجز لإرسال الإشعار.");
      return;
    }

    if (!booking.client_phone) {
      console.warn(`⚠️ لا يوجد رقم هاتف للحجز ${booking.booking_ref}.`);
      return;
    }

    console.log(
      `⚠️ sendDepositProofNotification: لا يوجد Template مخصّص بعد، لن يتم إرسال رسالة.`
    );
    // لو حاب، نقدر نعيد استخدام booking_confirmation هنا أو نعمل Template جديد

  } catch (err) {
    console.error("❌ خطأ أثناء إرسال إشعار إيصال العربون:", err);
  }
}

module.exports = {
  notifyBookingEvent,
  sendDepositProofNotification,
};
