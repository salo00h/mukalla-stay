-- 🏨 إنشاء جدول الفنادق
CREATE TABLE IF NOT EXISTS hotels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    area TEXT,
    address TEXT,
    active INTEGER DEFAULT 1
);

-- 🛏️ إنشاء جدول الغرف
CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    capacity INTEGER,
    photo_url TEXT,
    active INTEGER DEFAULT 1,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id)
);

-- 📅 إنشاء جدول الحجوزات
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_ref TEXT UNIQUE,              -- مثال: MS-2025-12345
    hotel_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    checkin_date TEXT NOT NULL,           -- YYYY-MM-DD
    checkout_date TEXT NOT NULL,          -- YYYY-MM-DD
    -- 🧠 الحالات الممكنة:
    -- WAITING_HOTEL_CONFIRM → بانتظار رد الفندق
    -- AWAITING_DEPOSIT → الفندق وافق وبانتظار دفع العربون
    -- REJECTED → الفندق رفض الحجز
    -- DEPOSIT_SENT → العميل أرسل إيصال العربون
    -- CONFIRMED → تم الدفع والموافقة النهائية
    -- CANCELLED → تم الإلغاء
    -- EXPIRED → انتهت المهلة بدون رد أو دفع
    status TEXT DEFAULT 'WAITING_HOTEL_CONFIRM',
    deposit REAL DEFAULT 0,               -- عربون (مثلاً 5%)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- 💳 إنشاء جدول المدفوعات
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_ref TEXT NOT NULL,
    method TEXT,             -- bank أو card
    amount REAL,
    proof_url TEXT,          -- صورة أو رقم الحوالة
    confirmed INTEGER DEFAULT 0,  -- 0 = لم يُؤكّد، 1 = تم التأكيد
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_ref) REFERENCES bookings(booking_ref)
);

-- 🧾 سجل العمليات (Audit Log)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,                 -- مثل CREATE_BOOKING
    ip TEXT,
    user_email TEXT,
    payload TEXT,                         -- تفاصيل العملية
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ⚡️ فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(booking_ref);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(client_email);

-- 🌍 بيانات الفنادق الافتراضية
INSERT INTO hotels (name, area, address, active) VALUES
('Hotel Al Mukalla', 'Fouh', 'Fouh Street 12', 1),
('Hadramout Suites', 'Al Dis', 'Al Dis Ave 45', 1);

-- 🛏️ بيانات الغرف الافتراضية
INSERT INTO rooms (hotel_id, name, price, capacity, photo_url, active) VALUES
(1, 'Standard Room', 25, 2, '/images/hotel1.jpg', 1),
(1, 'Deluxe Sea View', 40, 3, '/images/hotel1.jpg', 1),
(2, 'Studio', 30, 2, '/images/hotel2.jpg', 1);


-- ========================
-- 🗓️ جدول توفر الغرف (room_calendar)
-- ========================
CREATE TABLE IF NOT EXISTS room_calendar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'available', -- available / booked
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- ========================
-- ⭐ جدول التقييمات (reviews)
-- ========================
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_ref TEXT NOT NULL,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_ref) REFERENCES bookings(booking_ref)
);

-- ========================
-- 💬 جدول الرسائل بين العميل والفندق (messages)
-- ========================
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_ref TEXT,
  sender TEXT,
  message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_ref) REFERENCES bookings(booking_ref)
);


