const API = "https://mukalla-stay.onrender.com";


// 🏨 بيانات الجلسة
const hotel = JSON.parse(localStorage.getItem("hotel") || "null");
if (!hotel) {
  alert("يجب تسجيل الدخول أولاً");
  location.href = "hotel-login.html";
}

// 🧩 إعداد الواجهة
document.title = `لوحة ${hotel.name}`;
document.getElementById("welcome").textContent = `👋 ${hotel.name} مرحبًا بك`;

// الأزرار
document.getElementById("logout").onclick = () => {
  localStorage.removeItem("hotel");
  location.href = "hotel-login.html";
};
document.getElementById("refresh").onclick = loadBookings;

// العناصر
const els = {
  list: document.getElementById("list"),
  empty: document.getElementById("empty"),
  loading: document.getElementById("loading"),
  sAll: document.getElementById("sAll"),
  sConfirmed: document.getElementById("sConfirmed"),
  sDeposit: document.getElementById("sDeposit"),
  sWaitHotel: document.getElementById("sWaitHotel"),
  sBad: document.getElementById("sBad"),
  toasts: document.getElementById("toasts"),
};

function toast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  els.toasts.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function badge(status) {
  const s = (status || "").toUpperCase();
  if (s === "CONFIRMED") return '<span class="badge confirmed">✅ مؤكد</span>';
  if (s === "AWAITING_DEPOSIT" || s === "DEPOSIT_SENT")
    return '<span class="badge wait-deposit">⏳ بانتظار العربون</span>';
  if (s === "WAITING_HOTEL_CONFIRM")
    return '<span class="badge wait-hotel">🏨 بانتظار تأكيد الفندق</span>';
  if (s === "REJECTED")
    return '<span class="badge rejected">❌ مرفوض</span>';
  if (s === "CANCELLED")
    return '<span class="badge cancelled">🛑 ملغي</span>';
  if (s === "EXPIRED")
    return '<span class="badge expired">⏲️ منتهي</span>';
  return `<span class="badge">${s}</span>`;
}

function fmt(d) {
  try {
    return new Date(d).toLocaleDateString("ar-EG");
  } catch {
    return d || "";
  }
}

// 📦 تحميل الحجوزات
// ================== حالة الصفحة / الفلاتر ==================
let ALL_ROWS = [];   // كل الحجوزات (للفندق الحالي فقط)
let VIEW_ROWS = [];  // الناتج بعد التصفية
let AUTO_TIMER = null;

const ui = {
  search:  document.getElementById("searchBox"),
  dFrom:   document.getElementById("dateFrom"),
  dTo:     document.getElementById("dateTo"),
  chips:   [...document.querySelectorAll(".status-filters .chip")],
  count:   document.getElementById("resultCount"),
  auto:    document.getElementById("autoRefresh"),
  export:  document.getElementById("btnExport"),
  print:   document.getElementById("btnPrint"),
};

// ✅ تطبيق الفلاتر وإعادة الرسم
function applyFilters() {
  const q = (ui.search?.value || "").trim().toLowerCase();
  const f = ui.dFrom?.value ? new Date(ui.dFrom.value) : null;
  const t = ui.dTo?.value ? new Date(ui.dTo.value) : null;

  // الحالة النشطة
  const active = ui.chips.find(c => c.classList.contains("active"));
  const allowStatuses = active && active.dataset.status !== "ALL"
    ? active.dataset.status.split(",").map(s => s.trim())
    : null;

  VIEW_ROWS = ALL_ROWS.filter(b => {
    // نصّي
    const hay = `${b.client_name||""} ${b.client_email||""} ${b.booking_ref||""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;

    // تاريخ (نستخدم checkin_date لمقارنة بسيطة)
    const d = b.checkin_date ? new Date(b.checkin_date) : null;
    if (f && d && d < f) return false;
    if (t && d && d > t) return false;

    // حالة
    if (allowStatuses && !allowStatuses.includes(b.status)) return false;

    return true;
  });

  // عدّاد النتائج
  ui.count.textContent = VIEW_ROWS.length;

  // تحديث الإحصائيات (تُحسب من ALL_ROWS حتى لا تتأثر بالتصفية)
  els.sAll.textContent = ALL_ROWS.length;
  els.sConfirmed.textContent = ALL_ROWS.filter(b => b.status === "CONFIRMED").length;
  els.sDeposit.textContent   = ALL_ROWS.filter(b => ["AWAITING_DEPOSIT","DEPOSIT_SENT"].includes(b.status)).length;
  els.sWaitHotel.textContent = ALL_ROWS.filter(b => b.status === "WAITING_HOTEL_CONFIRM").length;
  els.sBad.textContent       = ALL_ROWS.filter(b => ["REJECTED","CANCELLED","EXPIRED"].includes(b.status)).length;

  // رسم القائمة
  renderList(VIEW_ROWS);
}

// 🧱 رسم قائمة البطاقات (نفس كارتك + واتساب سريع)
function renderList(rows) {
  if (!rows.length) {
    els.list.innerHTML = "";
    els.empty.classList.remove("hidden");
    return;
  }
  els.empty.classList.add("hidden");

  els.list.innerHTML = rows.map((b) => {
    const wa = `https://wa.me/?text=${encodeURIComponent(
      `مرجع: ${b.booking_ref}\nالإسم: ${b.client_name}\nالبريد: ${b.client_email}\nالفندق: ${b.hotel_name}\nالغرفة: ${b.room_name}\nالدخول: ${fmt(b.checkin_date)} - الخروج: ${fmt(b.checkout_date)}`
    )}`;

    const proof = b.deposit_proof_url
      ? `<div class="row"><a target="_blank" href="${b.deposit_proof_url}">🧾 عرض إيصال العربون</a></div>`
      : "";

    const actions = (b.status === "WAITING_HOTEL_CONFIRM")
      ? `<div class="actions-row">
           <button class="btn success" onclick="confirmBooking('${b.booking_ref}')">✅ تأكيد الحجز</button>
           <button class="btn danger"  onclick="rejectBooking('${b.booking_ref}')">❌ رفض</button>
           <a class="btn ghost" target="_blank" href="${wa}">واتساب</a>
           <button class="btn ghost" onclick="navigator.clipboard.writeText('${b.booking_ref}');toast('📋 تم نسخ المرجع');">نسخ المرجع</button>
         </div>`
      : `<div class="row" style="gap:8px;">
           <span class="muted">رقم الحجز: ${b.booking_ref}</span>
           <a class="btn ghost" target="_blank" href="${wa}">واتساب</a>
           <button class="btn ghost" onclick="navigator.clipboard.writeText('${b.booking_ref}');toast('📋 تم نسخ المرجع');">نسخ المرجع</button>
         </div>`;

    return `
      <div class="booking">
        <div class="row" style="justify-content:space-between">
          <div>
            <h3>${b.client_name}</h3>
            <div class="muted">${b.client_email}</div>
          </div>
          <div>${badge(b.status)}</div>
        </div>
        <div class="row muted">📅 من ${fmt(b.checkin_date)} إلى ${fmt(b.checkout_date)}</div>
        <div class="row muted">🏨 ${b.hotel_name} — 🛏️ ${b.room_name}</div>
        ${proof}
        ${actions}
      </div>`;
  }).join("");
}

// ♻️ تحميل من السيرفر ثم تطبيق الفلاتر
async function loadBookings() {
  els.list.innerHTML = "";
  els.empty.classList.add("hidden");
  els.loading.classList.remove("hidden");

  try {
    const res = await fetch(`${API}/api/bookings`);
    const j = await res.json();
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل التحميل");

    ALL_ROWS = (j.bookings || []).filter(b => b.hotel_name === hotel.name);
    els.loading.classList.add("hidden");
    applyFilters(); // ← يرسم القائمه ويحدّث العدّادات
  } catch (e) {
    console.error(e);
    els.loading.classList.add("hidden");
    toast("⚠️ خطأ في التحميل", "danger");
    els.empty.classList.remove("hidden");
  }
}

// ✅ تأكيد الحجز
async function confirmBooking(ref) {
  if (!confirm("هل تريد تأكيد هذا الحجز؟")) return;
  
  try {
    const res = await fetch(`${API}/api/bookings/confirm-by-hotel/${ref}`, {
      method: "POST"
    });
    const j = await res.json();
    
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل التأكيد");
    
    toast("✅ تم تأكيد الحجز", "success");
    loadBookings();
  } catch (e) {
    console.error(e);
    toast("⚠️ فشل في تأكيد الحجز", "danger");
  }
}

// ❌ رفض الحجز
async function rejectBooking(ref) {
  if (!confirm("هل تريد رفض هذا الحجز؟")) return;
  
  try {
    const res = await fetch(`${API}/api/bookings/reject-by-hotel/${ref}`, {
      method: "POST"
    });
    const j = await res.json();
    
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل الرفض");
    
    toast("❌ تم رفض الحجز", "success");
    loadBookings();
  } catch (e) {
    console.error(e);
    toast("⚠️ فشل في رفض الحجز", "danger");
  }
}

// ⏱️ تحديث تلقائي كل 30 ثانية
function startAutoRefresh(on) {
  if (AUTO_TIMER) { clearInterval(AUTO_TIMER); AUTO_TIMER = null; }
  if (on) AUTO_TIMER = setInterval(loadBookings, 30000);
}

// 🧭 ربط الأحداث
ui.search?.addEventListener("input", applyFilters);
ui.dFrom?.addEventListener("change", applyFilters);
ui.dTo?.addEventListener("change", applyFilters);
ui.chips.forEach(c => c.addEventListener("click", () => {
  ui.chips.forEach(x => x.classList.remove("active"));
  c.classList.add("active");
  applyFilters();
}));
document.getElementById("refresh")?.addEventListener("click", loadBookings);

ui.auto?.addEventListener("change", () => startAutoRefresh(ui.auto.checked));
ui.export?.addEventListener("click", exportCSV);
ui.print?.addEventListener("click", () => window.print());

// ✅ افتراضيًا: فعّل "الكل"
const firstChip = ui.chips?.[0]; if (firstChip) firstChip.classList.add("active");

// ⬇️ تصدير CSV (سريع)
function exportCSV() {
  const rows = VIEW_ROWS.length ? VIEW_ROWS : ALL_ROWS;
  if (!rows.length) { toast("لا يوجد بيانات للتصدير"); return; }

  const cols = ["booking_ref","client_name","client_email","hotel_name","room_name","checkin_date","checkout_date","status"];
  const head = cols.join(",");
  const body = rows.map(b => cols.map(k => `"${String(b[k] ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
  const csv  = head + "\n" + body;

  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `bookings_${hotel.name}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("تم تنزيل CSV ✅","success");
}

// 🚀 بدء التشغيل
loadBookings();

// 🌗 التبديل بين الوضعين
const toggle = document.getElementById("theme-toggle");
const saved = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", saved);
toggle.checked = saved === "light";
toggle.addEventListener("change", () => {
  const mode = toggle.checked ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem("theme", mode);
});

// ===================== 🔄 تبويبات بين الحجوزات والغرف =====================
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`#screen-${btn.dataset.target}`).classList.add("active");
    if (btn.dataset.target === "rooms") loadRooms();
  });
});

// ===================== 🏨 إدارة الغرف =====================
const roomsList = document.getElementById("roomsList");
const roomsEmpty = document.getElementById("roomsEmpty");

// ===================== تحميل الغرف =====================
async function loadRooms() {
  roomsList.innerHTML = "";
  roomsEmpty.style.display = "block";

  try {
    const res = await fetch(`${API}/api/rooms/by-hotel/${hotel.id}`);
    const j = await res.json();
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل تحميل الغرف");

    const rooms = j.rooms || [];
    if (!rooms.length) return;

    roomsEmpty.style.display = "none";

    // 🎨 عرض الغرف بتصميم بطاقات أنيق
    roomsList.innerHTML = rooms.map(r => `
      <div class="card room">
        <div class="info">
          <div><b>${r.name}</b> <span class="price">— ${r.price}$</span></div>
          <div class="muted">العدد: ${r.count || 1} | الحالة: ${r.available ? "✅ متاحة" : "❌ غير متاحة"}</div>
        </div>
        <div class="actions">
          <button class="btn" onclick="toggleRoom(${r.id}, ${r.available ? 0 : 1})">
            ${r.available ? "إيقاف" : "تفعيل"}
          </button>
          <button class="btn" onclick="editRoom(${r.id}, '${r.name}', ${r.price}, ${r.count || 1}, ${r.available})">✏️</button>
          <button class="btn red" onclick="deleteRoom(${r.id})">🗑️</button>
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.error(err);
    toast("حدث خطأ في تحميل الغرف ⚠️");
  }
}

// ===================== إضافة / تعديل / حذف =====================

// إضافة غرفة جديدة
document.getElementById("btnAddRoom")?.addEventListener("click", async () => {
  const name = prompt("اسم الغرفة:");
  if (!name) return;
  const price = +prompt("السعر:");
  const count = +prompt("عدد الغرف:");
  if (!price || !count) return alert("أدخل بيانات صحيحة");

  try {
    const res = await fetch(`${API}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotel_id: hotel.id, name, price, count }),
    });
    const j = await res.json();
    
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل الإضافة");
    
    toast("تمت إضافة الغرفة ✅");
    loadRooms();
  } catch (err) {
    console.error(err);
    toast("⚠️ فشل في إضافة الغرفة");
  }
});

async function editRoom(id, name, price, count, available) {
  const newName = prompt("اسم الغرفة:", name);
  if (newName === null) return;
  
  const newPrice = +prompt("السعر:", price);
  if (isNaN(newPrice)) return alert("أدخل سعرًا صحيحًا");
  
  const newCount = +prompt("العدد:", count);
  if (isNaN(newCount)) return alert("أدخل عددًا صحيحًا");

  try {
    const res = await fetch(`${API}/api/rooms/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, price: newPrice, count: newCount, available }),
    });
    const j = await res.json();
    
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل التحديث");
    
    toast("تم تحديث الغرفة ✅");
    loadRooms();
  } catch (err) {
    console.error(err);
    toast("⚠️ فشل في تحديث الغرفة");
  }
}

async function deleteRoom(id) {
  if (!confirm("هل أنت متأكد من الحذف؟")) return;
  
  try {
    const res = await fetch(`${API}/api/rooms/${id}`, { method: "DELETE" });
    const j = await res.json();
    
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل الحذف");
    
    toast("تم حذف الغرفة 🗑️");
    loadRooms();
  } catch (err) {
    console.error(err);
    toast("⚠️ فشل في حذف الغرفة");
  }
}

async function toggleRoom(id, newState) {
  try {
    const res = await fetch(`${API}/api/rooms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: newState }),
    });
    const j = await res.json();
    
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل التغيير");
    
    toast("تم تغيير حالة الغرفة ✅");
    loadRooms();
  } catch (err) {
    console.error(err);
    toast("⚠️ فشل في تغيير حالة الغرفة");
  }
}

// ===================== تفعيل التبويبات الثلاثة =====================
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`#screen-${btn.dataset.target}`).classList.add("active");
    if (btn.dataset.target === "stats") {
      loadStats();
      loadPerformanceAnalytics();
      loadRevenues(); // ✅ هذا السطر المهم
    }
           // تحميل الإحصائيات عند فتح التبويب
    if (btn.dataset.target === "rooms" && typeof loadRooms === "function") loadRooms(); // غرف
  });
});

// ===================== أدوات تاريخ بسيطة =====================
function ymd(d) {
  // d: Date | string
  const dt = (d instanceof Date) ? d : new Date(d);
  const m = String(dt.getMonth()+1).padStart(2,"0");
  const day = String(dt.getDate()).padStart(2,"0");
  return `${dt.getFullYear()}-${m}-${day}`;
}

// =============== رسم أعمدة مخصص (Canvas) ===============
function drawBars(ctx, labels, data, colors, opts={}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  const pad = 40, base = H - pad;
  const max = Math.max(1, ...data);
  const n = data.length;
  const barW = Math.max(24, (W - pad*2) / (n*1.8));
  const gap  = barW * 0.8;

  // محاور خفيفة
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.beginPath(); ctx.moveTo(pad, base); ctx.lineTo(W - pad, base); ctx.stroke();

  data.forEach((v,i)=>{
    const h = (v/max) * (H - pad*2);
    const x = pad + i * (barW + gap);
    const y = base - h;

    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, y, barW, h);

    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(v), x + barW/2, y - 6);

    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.font = "12px sans-serif";
    ctx.fillText(labels[i], x + barW/2, base + 16);
  });
}

// =============== تحميل الإحصائيات ===============
async function loadStats() {
  try {
    // 1) الحجوزات (نفس الـ API العام عندك)
    const r1 = await fetch(`${API}/api/bookings`);
    const j1 = await r1.json();
    if (!r1.ok || j1.ok === false) throw new Error(j1.error || "فشل تحميل الحجوزات");
    const bookings = (j1.bookings || []).filter(b => b.hotel_name === hotel.name);

    // أرقام أساسية
    const total     = bookings.length;
    const confirmed = bookings.filter(b => b.status === "CONFIRMED").length;
    const waiting   = bookings.filter(b => b.status === "WAITING_HOTEL_CONFIRM").length;
    const deposit   = bookings.filter(b => ["AWAITING_DEPOSIT","DEPOSIT_SENT"].includes(b.status)).length;
    const rejected  = bookings.filter(b => ["REJECTED","CANCELLED","EXPIRED"].includes(b.status)).length;

    // 2) الغرف (لحساب الإشغال)
    const r2 = await fetch(`${API}/api/rooms/by-hotel/${hotel.id}`);
    const j2 = await r2.json();
    const rooms = j2.rooms || [];
    const totalRooms  = rooms.length;
    const bookedRooms = rooms.filter(r => !r.available).length;
    const occPercent  = totalRooms ? Math.round((bookedRooms / totalRooms) * 100) : 0;

    // ===== بطاقات الأرقام =====
    const cardsBox = document.getElementById("statsCards");
    cardsBox.innerHTML = [
      ["إجمالي الحجوزات", total],
      ["مؤكدة", confirmed],
      ["بانتظار العربون", deposit],
      ["بانتظار الفندق", waiting],
      ["مرفوضة/ملغية/منتهية", rejected],
    ].map(([title,val]) => `
      <div class="stats-card">
        <h4>${title}</h4>
        <h2>${val}</h2>
      </div>
    `).join("");

    // ===== نسبة الإشغال =====
    const occBar  = document.getElementById("occBar");
    const occText = document.getElementById("occText");
    const color   = occPercent < 50 ? "#22c55e" : occPercent < 80 ? "#f59e0b" : "#ef4444";
    occBar.style.width     = occPercent + "%";
    occBar.style.background = color;
    occText.textContent    = `${occPercent}% — ${bookedRooms} من ${totalRooms} غرفة محجوزة`;

    // ===== رسم 1: توزيع الحالات =====
    const ctx1   = document.getElementById("statsChart").getContext("2d");
    const labels = ["مؤكدة","بانتظار العربون","بانتظار الفندق","مرفوضة/منتهية"];
    const data   = [confirmed, deposit, waiting, rejected];
    const colors = ["#22c55e","#3b82f6","#facc15","#ef4444"];
    drawBars(ctx1, labels, data, colors);

    // ===== رسم 2: حجوزات آخر 14 يوم =====
    // نعتمد created_at إن وجد، وإلا نستخدم checkin_date
    const today = new Date();
    const days  = [];
    const counts = [];
    for (let i=13; i>=0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()-i);
      const key = ymd(d);
      days.push(key);
      counts.push(0);
    }
    bookings.forEach(b => {
      const key = ymd(b.created_at || b.checkin_date || new Date());
      const idx = days.indexOf(key);
      if (idx >= 0) counts[idx] += 1;
    });
    const ctx2 = document.getElementById("dailyChart").getContext("2d");
    drawBars(ctx2, days.map(d=>d.slice(5)), counts, ["#60a5fa"]);
  } catch (err) {
    console.error(err);
    toast("⚠️ تعذّر تحميل الإحصائيات");
  }
}

// ==================== 🧠 تحليل الأداء مع الرسوم ====================
async function loadPerformanceAnalytics() {
  const colors = {
    blue: "#61d5ff",
    green: "#76ffa2",
    yellow: "#facc15",
    purple: "#c084fc"
  };

  const monthsMap = {
    "01": "يناير",
    "02": "فبراير",
    "03": "مارس",
    "04": "أبريل",
    "05": "مايو",
    "06": "يونيو",
    "07": "يوليو",
    "08": "أغسطس",
    "09": "سبتمبر",
    "10": "أكتوبر",
    "11": "نوفمبر",
    "12": "ديسمبر"
  };

  try {
    const res = await fetch(`${API}/api/hotel/${hotel.id}/analytics`);
    const j = await res.json();
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل تحميل التحليل");

    // 🕒 متوسط مدة الإقامة
    new Chart(document.getElementById("chartStay"), {
      type: "bar",
      data: {
        labels: ["المتوسط"],
        datasets: [{ data: [j.avgStay], backgroundColor: colors.blue }]
      },
      options: {
        animation: { duration: 1200, easing: "easeOutQuart" },
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(255,255,255,.06)" } }
        }
      }
    });
    document.querySelector("#chartStay")?.nextElementSibling?.remove();
    document.querySelector("#chartStay").insertAdjacentHTML(
      "afterend",
      `<div class="muted fade-in" style="margin-top:4px;">متوسط مدة الإقامة: ${j.avgStay} ليلة</div>`
    );

    // 🏨 أكثر نوع غرفة حُجز
    new Chart(document.getElementById("chartRoom"), {
      type: "bar",
      data: {
        labels: [j.topRoom || "—"],
        datasets: [{ data: [1], backgroundColor: colors.green }]
      },
      options: {
        animation: { duration: 1200, easing: "easeOutQuart" },
        plugins: { legend: { display: false } },
        scales: { y: { display: false } }
      }
    });
    document.querySelector("#chartRoom")?.nextElementSibling?.remove();
    document.querySelector("#chartRoom").insertAdjacentHTML(
      "afterend",
      `<div class="muted fade-in" style="margin-top:4px;">${j.topRoom || "لا يوجد بيانات"}</div>`
    );

    // 📅 أكثر شهر فيه حجوزات
    new Chart(document.getElementById("chartMonth"), {
      type: "bar",
      data: {
        labels: [j.topMonth || "—"],
        datasets: [{ data: [1], backgroundColor: colors.yellow }]
      },
      options: {
        animation: { duration: 1200, easing: "easeOutQuart" },
        plugins: { legend: { display: false } },
        scales: { y: { display: false } }
      }
    });
    const monthNum = (j.topMonth || "").replace("شهر ", "").padStart(2, "0");
    const monthName = monthsMap[monthNum] || j.topMonth || "لا يوجد";
    document.querySelector("#chartMonth")?.nextElementSibling?.remove();
    document.querySelector("#chartMonth").insertAdjacentHTML(
      "afterend",
      `<div class="muted fade-in" style="margin-top:4px;">${monthName}</div>`
    );

    // 👥 نسبة العملاء الجدد مقابل العائدين
    const ratio = j.clientRatioData || [50, 50];
    new Chart(document.getElementById("chartClients"), {
      type: "doughnut",
      data: {
        labels: ["جدد", "عائدين"],
        datasets: [
          { data: ratio, backgroundColor: [colors.blue, colors.green] }
        ]
      },
      options: {
        animation: { duration: 1500, easing: "easeOutElastic" },
        plugins: { legend: { position: "bottom" } }
      }
    });
    document.querySelector("#chartClients")?.nextElementSibling?.remove();
    document.querySelector("#chartClients").insertAdjacentHTML(
      "afterend",
      `<div class="muted fade-in" style="margin-top:4px;">${j.clientRatio || "لا توجد بيانات"}</div>`
    );

  } catch (err) {
    console.error("❌ Analytics error:", err);
  }
}

// ==================== 💼 نظام الإيرادات ====================
// ==================== 💼 نظام الإيرادات ====================
// ==================== 💼 نظام الإيرادات ====================
async function loadRevenues() {
  try {
    const res = await fetch(`${API}/api/hotel/${hotel.id}/revenues`);
    const j = await res.json();
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل تحميل الإيرادات");

    // 💰 مجموع العربون
    document.getElementById("totalDeposit").textContent =
      j.totalDeposit + " $";

    // 🏨 أرباح الفندق (90%)
    document.getElementById("monthlyRevenue").textContent =
      j.hotelRevenue + " $";

    // 💵 عمولة الموقع (10%)
    document.getElementById("netProfit").textContent =
      j.siteCommission + " $";

  } catch (err) {
    console.error("❌ Revenues error:", err);
  }
}



// ==================== 📅 تقويم الحجوزات ====================
// ==================== 📅 تقويم الحجوزات مع فلترة الغرف ====================
async function loadHotelCalendar() {
  const calendarEl = document.getElementById("hotelCalendar");
  const roomFilter = document.getElementById("roomFilter");
  if (!calendarEl || !roomFilter) return;

  // تحميل جميع الحجوزات
  const res = await fetch(`${API}/api/bookings`);
  const data = await res.json();
  if (!data.ok || !data.bookings) return toast("فشل تحميل الحجوزات");

  // 🔹 استخراج أسماء الغرف بدون تكرار
  const roomNames = [...new Set(data.bookings.map((b) => b.room_name))];
  roomNames.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    roomFilter.appendChild(opt);
  });

  // 🔹 تحويل الحجوزات إلى أحداث
  const makeEvents = (filter) =>
    data.bookings
      .filter((b) => filter === "all" || b.room_name === filter)
      .map((b) => ({
        title: `${b.room_name} — ${b.client_name}`,
        start: b.checkin_date,
        end: b.checkout_date,
        backgroundColor:
          b.status === "CONFIRMED"
            ? "#16a34a"
            : b.status === "WAITING_HOTEL_CONFIRM"
            ? "#facc15"
            : b.status === "AWAITING_DEPOSIT"
            ? "#3b82f6"
            : b.status === "CANCELLED" || b.status === "REJECTED"
            ? "#ef4444"
            : "#9ca3af",
        borderColor: "#fff",
        extendedProps: {
          hotel: b.hotel_name,
          status: b.status,
          ref: b.booking_ref,
        },
      }));

  // 🔹 إنشاء التقويم
  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: "ar",
    direction: "rtl",
    initialView: "dayGridMonth",
    height: "auto",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek",
    },
    events: makeEvents("all"),
    eventClick: (info) => {
      const e = info.event.extendedProps;
      alert(
        `📋 تفاصيل الحجز:\n\nرقم الحجز: ${e.ref}\nالفندق: ${e.hotel}\nالحالة: ${e.status}`
      );
    },
  });

  calendar.render();

  // 🔹 عند تغيير الغرفة — فلترة الأحداث
  roomFilter.addEventListener("change", (e) => {
    const filter = e.target.value;
    calendar.removeAllEvents();
    calendar.addEventSource(makeEvents(filter));
  });
}

// عند فتح تبويب الإحصائيات
document.querySelector('[data-target="stats"]').addEventListener("click", () => {
  if (!window.calendarLoaded) {
    loadHotelCalendar();
    window.calendarLoaded = true;
  }
});


// ==================== 🏷️ الأسعار الموسمية ====================
async function loadSeasons() {
  const res = await fetch(`${API}/api/seasons/${hotel.id}`);
  const j = await res.json();
  const tbody = document.querySelector("#seasonTable tbody");
  tbody.innerHTML = "";
  if (!j.ok || !j.seasons.length) {
    tbody.innerHTML = "<tr><td colspan='7'>لا توجد مواسم بعد.</td></tr>";
    return;
  }
  j.seasons.forEach((s) => {
    tbody.insertAdjacentHTML(
      "beforeend",
      `<tr>
        <td>${s.season_name}</td>
        <td>${s.start_date}</td>
        <td>${s.end_date}</td>
        <td>${s.price}$</td>
        <td>${s.min_stay}</td>
        <td>${s.room_id}</td>
        <td><button class='btn-mini bad' onclick='deleteSeason(${s.id})'>🗑️ حذف</button></td>
      </tr>`
    );
  });
}

async function deleteSeason(id) {
  await fetch(`${API}/api/seasons/${id}`, { method: "DELETE" });
  loadSeasons();
}

document.querySelector("#seasonForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    hotel_id: hotel.id,
    room_id: document.querySelector("#seasonRoom").value,
    season_name: document.querySelector("#seasonName").value,
    start_date: document.querySelector("#seasonStart").value,
    end_date: document.querySelector("#seasonEnd").value,
    price: document.querySelector("#seasonPrice").value,
    min_stay: document.querySelector("#seasonMinStay").value
  };
  const res = await fetch(`${API}/api/seasons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await res.json();
  if (j.ok) toast("✅ تمت الإضافة بنجاح");
  loadSeasons();
});

// تحميل الغرف للفندق الحالي
async function fillRoomsForSeasons() {
  const res = await fetch(`${API}/api/rooms/by-hotel/${hotel.id}`);
  const j = await res.json();
  const select = document.querySelector("#seasonRoom");
  select.innerHTML = j.rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join("");
}

// عند فتح التبويب
document.querySelector('[data-target="seasons"]').addEventListener("click", () => {
  if (!window.seasonLoaded) {
    fillRoomsForSeasons();
    loadSeasons();
    window.seasonLoaded = true;
  }
});
