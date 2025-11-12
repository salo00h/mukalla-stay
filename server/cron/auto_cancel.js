// server/cron/auto_cancel.js
const db = require("../db/sqlite");
const { notifyBookingEvent } = require("../utils/booking_notifications.js");

async function cancelExpiredBookings() {
  // 1) فندق ما رد خلال 24 ساعة
  const expired1 = await db.all(`
    SELECT * FROM bookings
    WHERE status='WAITING_HOTEL_CONFIRM'
      AND hotel_confirm_by IS NOT NULL
      AND datetime('now') > hotel_confirm_by
  `);
  for (const b of expired1) {
    await db.run(`
      UPDATE bookings
      SET status='CANCELLED',
          cancel_reason='NO_HOTEL_RESPONSE',
          updated_at = CURRENT_TIMESTAMP
      WHERE booking_ref=?`, [b.booking_ref]);

    // 🔔 إشعار الإلغاء التلقائي
    await notifyBookingEvent("BOOKING_CANCELLED", b);
  }

  // 2) لم يُدفع العربون خلال 24 ساعة من تأكيد الفندق
  const expired2 = await db.all(`
    SELECT * FROM bookings
    WHERE status IN ('AWAITING_DEPOSIT','WAITING_CLIENT_DEPOSIT')
      AND deposit_due_at IS NOT NULL
      AND datetime('now') > deposit_due_at
  `);
  for (const b of expired2) {
    await db.run(`
      UPDATE bookings
      SET status='CANCELLED',
          cancel_reason='NO_DEPOSIT',
          updated_at = CURRENT_TIMESTAMP
      WHERE booking_ref=?`, [b.booking_ref]);
    await notifyBookingEvent("BOOKING_CANCELLED", b);
  }

  // 3) لم يُدفع المبلغ الكامل حتى 3 أيام قبل الدخول
  const expired3 = await db.all(`
    SELECT * FROM bookings
    WHERE status='CONFIRMED'
      AND final_paid = 0
      AND cancel_after_full_due IS NOT NULL
      AND datetime('now') >= cancel_after_full_due
  `);
  for (const b of expired3) {
    await db.run(`
      UPDATE bookings
      SET status='CANCELLED',
          cancel_reason='NO_FINAL_PAYMENT',
          updated_at = CURRENT_TIMESTAMP
      WHERE booking_ref=?`, [b.booking_ref]);
    await notifyBookingEvent("BOOKING_CANCELLED", b);
  }
}

function startAutoCancelJob() {
  cancelExpiredBookings().catch(console.error);
  setInterval(() => cancelExpiredBookings().catch(console.error), 10 * 60 * 1000);
}

module.exports = { startAutoCancelJob };
