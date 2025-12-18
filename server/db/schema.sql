-- ========================
-- جدول الفنادق (hotels)
-- ========================
CREATE TABLE IF NOT EXISTS hotels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  area TEXT,
  address TEXT,
  active INTEGER DEFAULT 1
);

-- ========================
-- جدول الغرف (rooms)
-- ========================
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hotel_id INTEGER NOT NULL,
  name TEXT NOT NULL,          -- اسم الغرفة
  price REAL NOT NULL,         -- السعر في الليلة
  capacity INTEGER DEFAULT 2,  -- عدد الأشخاص المسموح
  photo_url TEXT,              -- صورة للغرفة
  active INTEGER DEFAULT 1,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id)
);

-- ========================
-- جدول الحجوزات (bookings)
-- ========================
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT UNIQUE NOT NULL,             -- رقم الحجز الفريد
  room_id INTEGER NOT NULL,             -- الغرفة المحجوزة
  customer_name TEXT NOT NULL,          -- اسم العميل
  customer_email TEXT,                  -- إيميل العميل
  customer_phone TEXT,                  -- رقم الهاتف
  checkin DATE NOT NULL,                -- تاريخ الوصول
  checkout DATE NOT NULL,               -- تاريخ المغادرة
  status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING/CONFIRMED/CANCELLED
  deposit_amount REAL DEFAULT 0,        -- العربون
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_ip TEXT,
  confirmed_at DATETIME,
  confirmed_by_admin INTEGER,
  notes TEXT,
  fraud_flag INTEGER DEFAULT 0,         -- علم الاحتيال
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- ========================
-- جدول تتبع الأحداث (Audit Log)
-- ========================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT,        -- booking, admin, hotel...
  entity_id INTEGER,
  action TEXT,        -- create, confirm, cancel...
  actor TEXT,         -- customer, admin:1, hotel:3
  ip TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
