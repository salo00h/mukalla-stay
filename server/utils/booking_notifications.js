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

    let msg = "";
    switch (event) {
      case "BOOKING_CREATED":
        msg = `مرحبًا ${name} 👋
تم استلام طلب حجزك رقم ${ref} في ${hotel}.
سيقوم الفندق بمراجعته خلال 24 ساعة.
شكرًا لاستخدامك MukallaStay 💙`;
        break;

      case "HOTEL_CONFIRMED":
        msg = `🏨 تمت موافقة الفندق على حجزك رقم ${ref} (${hotel}).
يرجى دفع العربون خلال 24 ساعة لتأكيد الحجز.`;
        break;

      case "DEPOSIT_UPLOADED":
        msg = `💰 تم استلام إيصال دفع العربون لحجزك رقم ${ref}.
سيتم مراجعته من قِبل إدارة الموقع قريبًا.`;
        break;

      case "DEPOSIT_CONFIRMED":
        msg = `✅ تم تأكيد العربون بنجاح.
حجزك في ${hotel} أصبح مؤكدًا بالكامل 🎉`;
        break;

      case "REMINDER_FINAL_PAYMENT":
        msg = `⏰ تذكير: يجب دفع المبلغ المتبقي لحجزك رقم ${ref} قبل 5 أيام من تاريخ الوصول لتجنب الإلغاء.`;
        break;

      case "BOOKING_CANCELLED":
        msg = `❌ تم إلغاء حجزك رقم ${ref} بسبب عدم إتمام الإجراءات المطلوبة في الوقت المحدد.
نأمل حجزك معنا مرة أخرى 💙`;
        break;

      default:
        console.log("⚠️ حدث غير معروف:", event);
        return;
    }

    console.log(`🚀 إرسال إشعار ${event} إلى ${phone}`);
    await sendWhatsAppMeta(phone, msg);
  } catch (err) {
    console.error(`❌ خطأ أثناء تنفيذ notifyBookingEvent (${event}):`, err.message);
  }
}

// 🧾 إشعار خاص عند رفع إيصال العربون
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

    const msg = `💰 عزيزي ${booking.client_name}،
تم استلام إيصال دفع العربون بنجاح ✅
سيتم مراجعته من قِبل إدارة الموقع خلال الساعات القادمة.
رقم الحجز: ${booking.booking_ref}
الفندق: ${booking.hotel_name}
شكرًا لاستخدامك MukallaStay 💙`;

    console.log(`🚀 إرسال إشعار إيصال الدفع إلى ${booking.client_phone}`);
    await sendWhatsAppMeta(booking.client_phone, msg);


  } catch (err) {
    console.error("❌ خطأ أثناء إرسال إشعار إيصال العربون:", err);
  }
}

module.exports = {
  notifyBookingEvent,
  sendDepositProofNotification,
};
