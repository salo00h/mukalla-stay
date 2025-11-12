// server/auto/checker.js
const db = require("../db/sqlite");

// ثوابت الزمن (ساعات)
const HOURS_WAITING_HOTEL = 24; // ~72 ثانية
const HOURS_AWAITING_DEPOSIT = 24;

async function autoExpireWaitingHotel() {
  const rows = await db.all(
    `SELECT booking_ref, client_email
     FROM bookings
     WHERE status='WAITING_HOTEL_CONFIRM'
       AND created_at <= datetime('now', ?);`,
    [`-${HOURS_WAITING_HOTEL} hours`]
  );

  for (const r of rows) {
    await db.run(`UPDATE bookings SET status='EXPIRED' WHERE booking_ref=?`, [r.booking_ref]);
    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('AUTO_EXPIRE_WAITING_HOTEL', ?, ?)`,
      [r.client_email, JSON.stringify({ booking_ref: r.booking_ref })]
    );
    console.log(`⏰ AUTO: ${r.booking_ref} → EXPIRED (no hotel response in ${HOURS_WAITING_HOTEL}h)`);
  }
  return rows.length;
}

async function autoCancelNoDeposit() {
  const rows = await db.all(
    `SELECT b.booking_ref, b.client_email, al.created_at AS hotel_confirmed_at
     FROM bookings b
     JOIN audit_logs al
       ON al.action='CONFIRM_BY_HOTEL'
      AND al.payload LIKE '%' || b.booking_ref || '%'
     WHERE b.status='AWAITING_DEPOSIT'
       AND al.created_at <= datetime('now', ?);`,
    [`-${HOURS_AWAITING_DEPOSIT} hours`]
  );

  for (const r of rows) {
    await db.run(`UPDATE bookings SET status='CANCELLED' WHERE booking_ref=?`, [r.booking_ref]);
    await db.run(
      `INSERT INTO audit_logs (action, user_email, payload)
       VALUES ('AUTO_CANCEL_NO_DEPOSIT', ?, ?)` ,
      [r.client_email, JSON.stringify({ booking_ref: r.booking_ref, hotel_confirmed_at: r.hotel_confirmed_at })]
    );
    console.log(`⏰ AUTO: ${r.booking_ref} → CANCELLED (no deposit in ${HOURS_AWAITING_DEPOSIT}h)`);
  }
  return rows.length;
}

// checker.js (أو auto/checker.js)
async function runAutoChecksOnce() {
  // ❌ لا تؤكّد الحجز بعد تأكيد الفندق
  // ✅ أكّد فقط إذا كانت الحالة DEPOSIT_SENT ويوجد دفع مؤكد
  await db.run(`
    UPDATE bookings
    SET status = 'CONFIRMED'
    WHERE status = 'DEPOSIT_SENT'
      AND EXISTS (
        SELECT 1 FROM payments
        WHERE payments.booking_ref = bookings.booking_ref
          AND payments.confirmed = 1
      )
  `);

  // ممكن تضيف إلغاء تلقائي لو تأخر العربون:
  await db.run(`
    UPDATE bookings
    SET status = 'EXPIRED'
    WHERE status IN ('AWAITING_DEPOSIT')
      AND julianday('now') - julianday(created_at) > 1  -- بعد 24 ساعة
  `);
}

module.exports = { runAutoChecksOnce };

