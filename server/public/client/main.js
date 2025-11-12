// ==================== الإعدادات ====================
const API = "https://mukalla-stay.onrender.com";


// خريطة نص الحالة + اللون (مضاف AWAITING_DEPOSIT)
// خريطة نص الحالة + اللون (مضاف AWAITING_DEPOSIT)
const STATUS_TEXT = {
  WAITING_HOTEL_CONFIRM: "بانتظار موافقة الفندق",
  WAITING_CLIENT_DEPOSIT: "بانتظار العربون",
  AWAITING_DEPOSIT: "بانتظار العربون",
  DEPOSIT_SENT: "تم إرسال إيصال العربون",
  CONFIRMED: "مؤكد",
  REJECTED: "مرفوض",
  CANCELLED: "تم الإلغاء",
  EXPIRED: "انتهى الوقت",

  // ✅ الأسباب التفصيلية للإلغاء
  NO_HOTEL_RESPONSE: "الفندق لم يرد خلال 24 ساعة",
  NO_DEPOSIT: "لم يتم دفع العربون خلال المهلة",
  NO_FINAL_PAYMENT: "لم يتم دفع المبلغ الكامل في الوقت المحدد (العربون غير مسترد)"
};

const STATUS_COLOR = {
  WAITING_HOTEL_CONFIRM: "gold",
  WAITING_CLIENT_DEPOSIT: "#42a5f5",
  AWAITING_DEPOSIT: "#42a5f5",
  DEPOSIT_SENT: "violet",
  CONFIRMED: "var(--green)",
  REJECTED: "var(--red)",
  CANCELLED: "var(--red)",
  EXPIRED: "var(--red)",
};

// ==================== أدوات صغيرة ====================
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const toastBox = $("#toasts");
const toast = (msg) => {
  if (!toastBox) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = msg;
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), 3500);
};

async function jfetch(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || "Request failed");
  return j;
}

// ==================== تبويبات ====================
$$(".tab").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.target;
    $$(".screen").forEach((s) => s.classList.remove("active"));
    const pane = $("#" + target);
    if (pane) pane.classList.add("active");
    if (target === "explore") showHotels();
  })
);

// ==================== بيانات ذاكرة ====================
let hotelsCache = [];
let roomsCache = [];

// ==================== واجهة الفنادق ====================
async function loadHotels() {
  const res = await jfetch(API + "/api/public/hotels");
  hotelsCache = res.hotels || [];
}

function renderHotels() {
  const grid = $("#hotels");
  const empty = $("#hotelsEmpty");
  if (!grid) return;

  grid.innerHTML = "";

  if (!hotelsCache.length) {
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  hotelsCache.forEach((h, i) => {
    const card = document.createElement("div");
    card.className = "card hotel-card";
    card.style.animationDelay = i * 60 + "ms";

    const cover =
      h.cover_url || h.photo_url || h.image_url || "/images/hotel_placeholder.jpg";

    // ⭐ نص التقييم (متوسط / عدد التقييمات أو "لا توجد تقييمات")
    const ratingText = h.avg_rating
      ? `⭐ <b>${h.avg_rating}</b> / 5 <span class="muted" style="color:#aaa;">(${h.total_reviews} تقييم)</span>`
      : `<span class="muted" style="color:#ffcc00;">لا توجد تقييمات بعد</span>`;

    // 🏨 بطاقة الفندق
    card.innerHTML = `
      <img class="hotel-cover" src="${cover}" alt="">
      <div class="hotel-meta">
        <div class="hotel-title">${h.name}</div>
        <div class="hotel-sub">${h.area || ""} — ${h.address || ""}</div>
        <div class="hotel-rating" style="margin-top:6px;font-weight:600;color:gold;">
          ${ratingText}
        </div>
        <div class="row" style="justify-content:space-between;margin-top:8px;">
          <div class="badge">⭐ فندق</div>
          <button class="btn" data-id="${h.id}">عرض الغرف</button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  // 🖱️ زر "عرض الغرف"
  $$("#hotels .btn").forEach((b) =>
    b.addEventListener("click", () => openHotel(Number(b.dataset.id)))
  );
}


async function ensureRoomsLoaded() {
  if (roomsCache.length) return;
  const res = await jfetch(API + "/api/public/rooms");
  roomsCache = res.rooms || [];
}

async function openHotel(hotelId) {
  await ensureRoomsLoaded();

  const hotel = hotelsCache.find((h) => Number(h.id) === Number(hotelId));
  if (!hotel) return toast("الفندق غير موجود");

  // عنوان
  const hvName = $("#hvName");
  const hvMeta = $("#hvMeta");
  if (hvName) hvName.textContent = hotel.name;
  if (hvMeta) hvMeta.textContent = `${hotel.area || ""} — ${hotel.address || ""}`;
  const hvImage = $("#hvImage");
  if (hvImage) hvImage.src = hotel.cover_url || hotel.photo_url || "/images/hotel_placeholder.jpg";




  // إظهار واجهة الفندق
  const hotelsGrid = $("#hotels");
  const hotelsEmpty = $("#hotelsEmpty");
  const hotelView = $("#hotelView");
  if (hotelsGrid) hotelsGrid.style.display = "none";
  if (hotelsEmpty) hotelsEmpty.style.display = "none";
  if (hotelView) hotelView.style.display = "block";

  // غرف الفندق
  const grid = $("#hotelRooms");
  const roomsEmpty = $("#hotelRoomsEmpty");
  if (!grid) return;
  grid.innerHTML = "";
  const rooms = roomsCache.filter((r) => String(r.hotel_id) === String(hotelId));

  if (!rooms.length) {
    if (roomsEmpty) roomsEmpty.style.display = "block";
    return;
  }
  if (roomsEmpty) roomsEmpty.style.display = "none";

  rooms.forEach((r, i) => {
    const el = document.createElement("div");
    el.className = "card room";
    el.style.animationDelay = i * 50 + "ms";
    el.innerHTML = `
      <img src="${r.photo_url || "/images/placeholder.jpg"}" alt="">
      <div class="meta">
        <div class="row" style="justify-content:space-between">
          <div>
            <div style="font-weight:800">${r.name}</div>
            <div class="muted" style="font-size:12px">${hotel.name} — ${hotel.area || ""}</div>
          </div>
          <div class="badge"><span>السعر</span> ${r.price} $ /ليلة</div>
        </div>
        <div class="row" style="margin-top:8px;justify-content:space-between">
          <div class="muted">الاستيعاب: ${r.capacity} أشخاص</div>
          <button class="btn" data-h="${r.hotel_id}" data-r="${r.id}">احجز هذه الغرفة</button>
        </div>
      </div>
    `;
    grid.appendChild(el);
  });

  // حجز سريع من الفندق
  $$("#hotelRooms .btn").forEach((b) =>
    b.addEventListener("click", () => {
      const tabBook = $(`.tab[data-target="book"]`);
      if (tabBook) tabBook.click();
      const bHotel = $("#bHotel");
      const bRoom = $("#bRoom");
      if (bHotel) bHotel.value = b.dataset.h;
      populateRoomsForHotel();
      if (bRoom) bRoom.value = b.dataset.r;
      updatePriceSummary();
      toast("تم اختيار الغرفة في نموذج الحجز ✅");
    })
  );

  // 🗓️ تحميل الأيام المحجوزة
try {
  const res = await jfetch(API + "/api/calendar/" + hotelId);
  const cal = $("#calendarDays");
  if (res.calendar?.length) {
    cal.innerHTML = res.calendar
      .map(
        (d) =>
          `<span style="padding:6px 10px;border-radius:6px;background:${
            d.status === "booked" ? "#ff4d4d" : "#22c55e"
          };color:white;font-size:13px;">${d.date}</span>`
      )
      .join("");
  } else {
    cal.innerHTML = "<div class='muted'>لا توجد أيام محجوزة حالياً.</div>";
  }
} catch (err) {
  console.error(err);
}

}


function backToHotels() {
  const hotelView = $("#hotelView");
  const hotelsGrid = $("#hotels");
  const hotelsEmpty = $("#hotelsEmpty");
  if (hotelView) hotelView.style.display = "none";
  if (hotelsGrid) hotelsGrid.style.display = "grid";
  if (hotelsEmpty && !hotelsCache.length) hotelsEmpty.style.display = "block";
}

async function showHotels() {
  if (!hotelsCache.length) {
    const grid = $("#hotels");
    if (grid) {
      grid.innerHTML = "";
      for (let i = 0; i < 6; i++) {
        const s = document.createElement("div");
        s.className = "card";
        s.style.height = "210px";
        s.style.opacity = ".35";
        grid.appendChild(s);
      }
    }
    try {
      await loadHotels();
    } catch (e) {
      console.error(e);
      toast("تعذر جلب الفنادق");
    }
  }
  backToHotels();
  renderHotels();
}

// زر الرجوع من صفحة الفندق
const btnBackHotels = $("#btnBackHotels");
if (btnBackHotels) btnBackHotels.addEventListener("click", backToHotels);

// ==================== نموذج الحجز ====================
async function fillHotelsForBooking() {
  const res = hotelsCache.length
    ? { hotels: hotelsCache }
    : await jfetch(API + "/api/public/hotels");
  const hotels = res.hotels || [];
  const bHotel = $("#bHotel");
  if (!bHotel) return;
  bHotel.innerHTML = hotels.map((h) => `<option value="${h.id}">${h.name}</option>`).join("");
}

function populateRoomsForHotel() {
  const bHotel = $("#bHotel");
  const bRoom = $("#bRoom");
  if (!bHotel || !bRoom) return;
  const hid = bHotel.value;
  const rooms = roomsCache.filter((r) => String(r.hotel_id) === String(hid));
  bRoom.innerHTML = rooms
    .map((r) => `<option value="${r.id}">${r.name} — ${r.price}$</option>`)
    .join("");
  updatePriceSummary();
}

// ✅ حساب السعر الإجمالي والعربون
// ✅ حساب السعر الإجمالي والعربون (يدعم الأسعار الموسمية)
async function updatePriceSummary() {
  const bHotel = $("#bHotel");
  const bRoom = $("#bRoom");
  const summary = $("#priceSummary");
  if (!bHotel || !bRoom || !summary) return;

  const hotelId = Number(bHotel.value);
  const roomId = Number(bRoom.value);
  const inVal = $("#bIn")?.value;
  const outVal = $("#bOut")?.value;

  if (!hotelId || !roomId || !inVal || !outVal) {
    summary.innerHTML = "💰 سيتم حساب السعر الإجمالي بعد اختيار التواريخ والغرفة.";
    return;
  }

  try {
    // 🔹 نطلب السعر الحقيقي من السيرفر
    const res = await fetch(`${API}/api/bookings/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotel_id: hotelId,
        room_id: roomId,
        checkin_date: inVal,
        checkout_date: outVal
      })
    });

    const j = await res.json();
    if (!j.ok) throw new Error(j.error || "فشل التسعير");

    const deposit = j.total * 0.05;

    summary.innerHTML = `
      <div>🛏️ السعر لليلة: <b>${j.price_per_night}$</b></div>
      <div>📅 عدد الليالي: <b>${j.nights}</b></div>
      <div>💰 السعر الإجمالي: <b>${j.total.toFixed(2)}$</b></div>
      <div>💵 العربون (5%): <b>${deposit.toFixed(2)}$</b></div>
      ${j.is_seasonal ? `<div style="color:gold;font-weight:600;">💰 سعر موسمي مُطبّق</div>` : ""}
      ${(j.nights < j.min_stay)
        ? `<div style="color:red;font-weight:600;">⚠️ الحد الأدنى للإقامة هو ${j.min_stay} ليالي</div>`
        : ""}
    `;
  } catch (err) {
    console.error(err);
    summary.innerHTML = "⚠️ فشل تحميل السعر من السيرفر.";
  }
}


// إنشاء حجز جديد
const formBook = $("#formBook");
if (formBook) {
  formBook.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const body = {
       hotel_id: Number($("#bHotel")?.value),
       room_id: Number($("#bRoom")?.value),
       client_name: $("#bName")?.value.trim(),
       client_email: $("#bEmail")?.value.trim(),
       client_phone: $("#bPhone")?.value.trim(), // ✅ رقم الهاتف الجديد
       checkin_date: $("#bIn")?.value,
       checkout_date: $("#bOut")?.value,
      };

      const res = await jfetch(API + "/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const bookResult = $("#bookResult");
      if (bookResult) {
        bookResult.classList.add("show");
        bookResult.innerHTML = `
          <div class="badge" style="margin-bottom:8px">حالة الطلب: ${res.status}</div>
          <div style="font-weight:800">رقم الحجز: <span class="badge">${res.booking_ref}</span></div>
          <div class="muted" style="margin-top:6px;white-space:pre-line">${res.policy_note || ""}</div>
        `;
      }
      toast("تم إرسال طلب الحجز ✅");
      const trackTab = $(`.tab[data-target="track"]`);
      setTimeout(() => {
        if (trackTab) trackTab.click();
        const tRef = $("#tRef");
        if (tRef) tRef.value = res.booking_ref;
        doTrack();
      }, 600);
    } catch (err) {
      console.error(err);
      toast("تعذّر إنشاء الحجز");
    }
  });
}

// ==================== تتبّع الحجز ====================
const btnTrack = $("#btnTrack");
if (btnTrack) btnTrack.addEventListener("click", doTrack);

async function doTrack() {
  const tRef = $("#tRef");
  if (!tRef) return;
  const ref = tRef.value.trim();
  if (!ref) return toast("اكتب رقم الحجز");
  try {
    const res = await jfetch(API + "/api/bookings/" + encodeURIComponent(ref));
    const b = res.booking;

    // ✅ خزّن رقم الحجز لاستخدامه عند رفع الإيصال
    window.currentBookingRef = b.booking_ref;

    const trackCard = $("#trackCard");
    if (trackCard) {
      trackCard.innerHTML = `
        <div class="row" style="justify-content:space-between">
          <div>
            <div style="font-weight:800">رقم الحجز: <span class="badge">${b.booking_ref}</span></div>
            <div class="muted" style="margin-top:6px">${b.client_name} — ${b.client_email}</div>
          </div>
          <div class="badge">الحالة: ${STATUS_TEXT[b.status] || b.status}</div>
        </div>
        <div class="row" style="margin-top:10px;justify-content:space-between">
          <div>${b.hotel_name} — ${b.room_name}</div>
          <div class="muted">الدخول: ${new Date(b.checkin_date).toLocaleDateString('ar-EG')} • الخروج: ${new Date(b.checkout_date).toLocaleDateString('ar-EG')}</div>
        </div>
      `;
      trackCard.classList.add("reveal");
    }

    // 🟥 عرض سبب الإلغاء في حال كان الحجز ملغى
    if (b.status === 'CANCELLED' && b.cancel_reason) {
     const map = {
       NO_HOTEL_RESPONSE: "الفندق لم يرد خلال 24 ساعة، تم إلغاء الحجز.",
       NO_DEPOSIT: "لم يتم دفع العربون خلال 24 ساعة، تم إلغاء الحجز.",
       NO_FINAL_PAYMENT: "لم يتم دفع المبلغ المتبقي في الوقت المحدد، تم إلغاء الحجز (العربون غير مسترد)."
      };
      trackCard.insertAdjacentHTML(
        "beforeend",
        `<div class="policy" style="margin-top:10px;color:#ffb4b4">
        🔔 سبب الإلغاء: <b>${map[b.cancel_reason] || b.cancel_reason}</b>
        </div>`
      );
    }

    // 💰 تنبيه دفع كامل قبل 5 أيام من الوصول
    if (b.status === 'CONFIRMED' && b.final_paid == 0 && b.full_due_at) {
     const now = new Date();
     const due = new Date(b.full_due_at);
     if (now >= due) {
       // متأخر — يجب الدفع فورًا (الكرون سيلغي بعد 3 أيام من الوصول)
        trackCard.insertAdjacentHTML(
         "beforeend",
         `<div class="policy" style="margin-top:10px;color:#ffd166">
          💳 يجب دفع المبلغ المتبقي الآن (الموعد النهائي بدأ).
         </div>`
        );
      } else {
        const hoursLeft = Math.max(1, Math.ceil((due - now) / (1000 * 60 * 60)));
        trackCard.insertAdjacentHTML(
         "beforeend",
         `<div class="policy" style="margin-top:10px;">
         💳 تبقّى <b>${hoursLeft}</b> ساعة لبدء موعد دفع المبلغ المتبقي (قبل 5 أيام من الوصول).
         </div>`
        );
      }
    }



    await ensureRoomsLoaded();
    const payBox = $("#payBox");
    if (!payBox) return;

    if (["WAITING_CLIENT_DEPOSIT", "AWAITING_DEPOSIT"].includes(b.status)) {
      payBox.style.display = "block";
      const r = roomsCache.find((x) => String(x.id) === String(b.room_id));
      if (r) {
        const checkin = new Date(b.checkin_date);
        const checkout = new Date(b.checkout_date);
        const nights = Math.ceil((checkout - checkin) / (1000 * 60 * 60 * 24));
        const total = r.price * nights;
        const deposit = total * 0.05;
        const payAmount = $("#payAmount");
        if (payAmount) payAmount.value = deposit.toFixed(2);

        // لا تكرر الملحوظة
        const oldNote = payBox.querySelector(".deposit-note");
        if (oldNote) oldNote.remove();
        const title = payBox.querySelector("h3") || payBox;
        title.insertAdjacentHTML(
          "afterend",
          `<p class="deposit-note" style="color:#4da3ff;margin:6px 0 10px;font-weight:600">
            💡 يجب دفع عربون قدره: <b>${deposit.toFixed(2)}$</b> (${nights} ليالي × ${r.price}$/ليلة × 5%)
          </p>`
        );
      }
    } else {
      payBox.style.display = "none";
    }
  } catch (err) {
    console.error(err);
    toast("لم يتم العثور على الحجز");
    const trackCard = $("#trackCard");
    if (trackCard) trackCard.innerHTML = "";
    const payBox = $("#payBox");
    if (payBox) payBox.style.display = "none";
  }
}

// ==================== 📧 جميع حجوزات بريد معيّن ====================
const btnTrackEmail = $("#btnTrackEmail");
if (btnTrackEmail) btnTrackEmail.addEventListener("click", () => loadAllBookings());

async function loadAllBookings() {
  const emailInput = $("#tEmail");
  const container = $("#allBookings");
  if (!emailInput || !container) return;

  const email = emailInput.value.trim();
  if (!email) return toast("أدخل بريدك الإلكتروني");

  try {
    const res = await jfetch(API + "/api/bookings/by-email/" + encodeURIComponent(email));
    const bookings = res.bookings || [];

    if (!bookings.length) {
      container.innerHTML = "<div class='muted'>لا توجد حجوزات حالياً.</div>";
      return;
    }

    container.innerHTML = `
      ${bookings
        .map((b) => {
          const color = STATUS_COLOR[b.status] || "var(--red)";
          return `
            <div class="card" style="margin-top:10px; cursor:pointer" onclick="openBooking('${b.booking_ref}')">
              <div class="row" style="justify-content:space-between">
                <div>
                  <div style="font-weight:800">
                    رقم الحجز: <span class="badge">${b.booking_ref}</span>
                  </div>
                  <div class="muted">${b.hotel_name} — ${b.room_name}</div>
                </div>
                <div class="badge" style="background:${color}">
                  ${STATUS_TEXT[b.status] || b.status}
                </div>
              </div>
              <div class="muted">
                الدخول: ${new Date(b.checkin_date).toLocaleDateString('ar-EG')} • 
                الخروج: ${new Date(b.checkout_date).toLocaleDateString('ar-EG')}
              </div>
            </div>
          `;
        })
        .join("")}
      <div style="text-align:center; margin-top:12px">
        <button id="btnReloadBookings" class="btn">🔄 تحديث القائمة</button>
      </div>
    `;

    const btnReload = $("#btnReloadBookings");
    if (btnReload) btnReload.addEventListener("click", loadAllBookings);
  } catch (err) {
    console.error(err);
    toast("تعذر جلب الحجوزات");
    container.innerHTML = "<div class='muted'>لم يتم العثور على بيانات.</div>";
  }
}

// ==================== 📦 عرض تفاصيل الحجز تحت البطاقة عند الضغط ====================
async function openBooking(ref) {
  const card = [...document.querySelectorAll(".card")].find((c) => c.innerHTML.includes(ref));
  if (!card) return;

  // إذا كانت التفاصيل مفتوحة مسبقاً، أغلقها
  const existing = card.nextElementSibling;
  if (existing && existing.classList.contains("booking-details")) {
    existing.remove();
    return;
  }

  try {
    const res = await jfetch(`${API}/api/bookings/${encodeURIComponent(ref)}`);
    const b = res.booking;
    await ensureRoomsLoaded();
    const room = roomsCache.find((r) => r.id == b.room_id);

    // إزالة أي تفاصيل أخرى مفتوحة
    document.querySelectorAll(".booking-details").forEach((el) => el.remove());

    // إنشاء التفاصيل
    const details = document.createElement("div");
    details.className = "booking-details";
    details.style = `
      padding:14px;
      border-radius:10px;
      background:rgba(255,255,255,0.05);
      margin-top:8px;
      animation:fadeIn 0.4s ease;
    `;

    const nights = Math.ceil(
      (new Date(b.checkout_date) - new Date(b.checkin_date)) / (1000 * 60 * 60 * 24)
    );
    const total = room ? room.price * nights : 0;
    const deposit = total * 0.05;

    details.innerHTML = `
      <p>🏨 <b>${b.hotel_name}</b> — ${b.room_name}</p>
      <p>📅 من ${new Date(b.checkin_date).toLocaleDateString('ar-EG')} إلى 
         ${new Date(b.checkout_date).toLocaleDateString('ar-EG')} (${nights} ليالي)</p>
      <p>💰 السعر الإجمالي: <b>${total.toFixed(2)}$</b></p>
      <p>💵 العربون (5%): <b>${deposit.toFixed(2)}$</b></p>
      <p>📦 الحالة: <b>${STATUS_TEXT[b.status] || b.status}</b></p>

      <div class="row" style="justify-content:space-between; margin-top:10px">
        <button class="btn small red">إغلاق</button>
        ${
          ["WAITING_CLIENT_DEPOSIT", "AWAITING_DEPOSIT"].includes(b.status)
            ? `<button class="btn small" onclick="
                document.querySelector('.tab[data-target=track]').click();
                document.querySelector('#tRef').value='${b.booking_ref}';
                doTrack();
                setTimeout(() => {
                  const payBox = document.querySelector('#payBox');
                  if (payBox) payBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              ">💳 دفع العربون</button>`
            : ""
        }
      </div>
    `;

    // عرض التفاصيل أسفل البطاقة
    card.after(details);

    // زر الإغلاق
    details.querySelector(".red").addEventListener("click", () => details.remove());
  } catch (err) {
    console.error(err);
    toast("تعذر عرض تفاصيل الحجز");
  }
}


// ==================== 🔍 تصفية الفنادق ====================
function applyFilters() {
  if (!hotelsCache.length) return toast("لم يتم تحميل الفنادق بعد");

  const city = $("#filterCity")?.value || "";
  const type = $("#filterType")?.value || "";
  const sort = $("#filterSort")?.value || "";

  // فلترة حسب المدينة والنوع
  let filtered = [...hotelsCache].filter((h) => {
    const matchCity = !city || (h.area && h.area.includes(city));
    const matchType = !type || (h.type && h.type.toLowerCase() === type.toLowerCase());
    return matchCity && matchType;
  });

  // ترتيب حسب السعر
  if (sort === "low") {
    filtered.sort((a, b) => (a.avg_price || 0) - (b.avg_price || 0));
  } else if (sort === "high") {
    filtered.sort((a, b) => (b.avg_price || 0) - (a.avg_price || 0));
  }

  // عرض النتيجة
  const grid = $("#hotels");
  const empty = $("#hotelsEmpty");
  const count = $("#hotelCount");

  grid.innerHTML = "";
  if (filtered.length === 0) {
    if (empty) empty.style.display = "block";
    if (count) count.textContent = "0 فندق";
    return;
  }

  if (empty) empty.style.display = "none";
  if (count) {
    count.textContent = `${filtered.length} فندق`;
    count.classList.add("updated");
    setTimeout(() => count.classList.remove("updated"), 800);
  }

  filtered.forEach((h, i) => {
    const card = document.createElement("div");
    card.className = "card hotel-card";
    card.style.animationDelay = i * 60 + "ms";
    const cover = h.cover_url || h.photo_url || "/images/hotel_placeholder.jpg";
    card.innerHTML = `
      <img class="hotel-cover" src="${cover}" alt="">
      <div class="hotel-meta">
        <div class="hotel-title">${h.name}</div>
        <div class="hotel-sub">${h.area || ""} — ${h.address || ""}</div>
        <div class="row" style="justify-content:space-between;margin-top:8px">
          <div class="badge">⭐ فندق</div>
          <button class="btn" data-id="${h.id}">عرض الغرف</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // تفعيل زر "عرض الغرف"
  $$("#hotels .btn").forEach((b) =>
    b.addEventListener("click", () => openHotel(Number(b.dataset.id)))
  );
}

// ربط الزر بالوظيفة
const btnApplyFilters = $("#btnApplyFilters");
if (btnApplyFilters) btnApplyFilters.addEventListener("click", applyFilters);


// ==================== تهيئة عامة (مرّة واحدة فقط) ====================
document.addEventListener("DOMContentLoaded", () => {
  try {
    // 🟢 نحذف await لتجنب التجميد، ونشغّل الدوال في الخلفية
    showHotels();
    ensureRoomsLoaded();
    fillHotelsForBooking();
    populateRoomsForHotel();
  } catch (e) {
    console.error(e);
    toast("تعذر التحميل الأولي");
  }



  // تحديث الأسعار عند التغيير
  $("#bHotel")?.addEventListener("change", () => {
    populateRoomsForHotel();
    updatePriceSummary();
  });
  $("#bRoom")?.addEventListener("change", updatePriceSummary);
  $("#bIn")?.addEventListener("change", updatePriceSummary);
  $("#bOut")?.addEventListener("change", updatePriceSummary);

  // ثيم فاتح/داكن
  const toggle = $("#theme-toggle");
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  if (toggle) {
    toggle.checked = saved === "light";
    toggle.addEventListener("change", () => {
      const val = toggle.checked ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", val);
      localStorage.setItem("theme", val);
    });
  }

  // 💰 إرسال إثبات دفع العربون
  const sendBtn = $("#btnSendProof");
  if (sendBtn) {
    sendBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const ref =
        (window.currentBookingRef || $("#tRef")?.value || "").trim();
      const method = $("#payMethod")?.value || "transfer";
      const amount = Number($("#payAmount")?.value || 0);
      const file = $("#payFile")?.files?.[0];

      if (!ref) return toast("⚠️ رقم الحجز غير معروف. ابحث عن الحجز أولاً.");
      if (!file) return toast("⚠️ اختر صورة الإيصال.");
      if (!amount || amount <= 0) return toast("⚠️ أدخل قيمة العربون.");

      const formData = new FormData();
      formData.append("method", method);
      formData.append("amount", amount);
      formData.append("proof", file);

      try {
        const res = await fetch(
          `${API}/api/payments/upload-proof/${encodeURIComponent(ref)}`,
          { method: "POST", body: formData }
        );
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j.ok === false) throw new Error(j.error || "فشل الرفع");

        toast("✅ تم استلام إثبات الدفع، سيتم المراجعة قريبًا.");
        doTrack();
      } catch (err) {
        console.error(err);
        toast("❌ تعذر إرسال الإثبات");
      }
    });
  }
});




// 💫 إظهار الهيدر والأزرار عند تحميل الصفحة
window.addEventListener("load", () => {
  // إظهار الهيدر
  document.querySelector(".topbar").classList.add("visible");

  // إظهار الأزرار تدريجيًا
  const tabs = document.querySelectorAll(".tabs .tab");
  tabs.forEach((tab, i) => {
    setTimeout(() => tab.classList.add("visible"), i * 150);
  });
});

// === 🗺️ عرض خريطة الفنادق ===
const btnShowMap = document.getElementById("btnShowMap");
let map, markersLayer;

btnShowMap?.addEventListener("click", async () => {
  const box = document.getElementById("mapBox");
  const visible = box.style.display !== "none";
  box.style.display = visible ? "none" : "block";

  if (!visible && !map) {
    // 🗺️ إنشاء الخريطة
    map = L.map("map").setView([14.521, 49.10], 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    // 🏨 أيقونة الفندق المتوهجة
    const hotelIcon = L.divIcon({
      html: `<img src="/uploads/hotel-pin.png" 
              style="
                 width:36px;
                 height:36px;
                 filter: brightness(5) drop-shadow(0 0 6px rgba(0,255,255,0.9));
                 transition: transform 0.2s ease, filter 0.2s ease;
              "
              onmouseover="this.style.transform='scale(1.3)'; this.style.filter='brightness(7) drop-shadow(0 0 10px rgba(0,255,255,1))';"
              onmouseout="this.style.transform='scale(1.0)'; this.style.filter='brightness(5) drop-shadow(0 0 6px rgba(0,255,255,0.9))';"
            ">`,
      className: "",
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -30]
    });

    try {
      const res = await fetch(`${API}/api/public/hotels`);
      const data = await res.json();
      if (data.ok) {
        const bounds = [];

        data.hotels.forEach(h => {
          if (h.latitude && h.longitude) {
            const marker = L.marker([h.latitude, h.longitude], { icon: hotelIcon })
              .addTo(markersLayer)
              .bindPopup(`
                <div style="text-align:center;">
                  <img src="${h.photo_url}" 
                       alt="${h.name}" 
                       style="width:100px;height:70px;object-fit:cover;border-radius:8px;margin-bottom:5px;">
                  <h4 style="margin:0;font-size:14px;color:#00ffff;">${h.name}</h4>
                  <p style="margin:2px 0;font-size:12px;color:#ccc;">${h.area || ""}</p>
                  <p style="margin:0;font-size:12px;color:#aaa;">${h.address || ""}</p>
                  <button 
                    onclick="openHotelFromMap('${h.id}')"
                    style="
                      margin-top:8px;
                      padding:5px 10px;
                      background:#00bcd4;
                      border:none;
                      border-radius:6px;
                      color:#fff;
                      font-size:12px;
                      cursor:pointer;
                      transition:filter 0.2s ease;
                    "
                    onmouseover="this.style.filter='brightness(1.2)'"
                    onmouseout="this.style.filter='brightness(1)'"
                  >عرض التفاصيل 🔗</button>
                </div>
              `);
            bounds.push([h.latitude, h.longitude]);
          }
        });

        // 🔄 توسيط الخريطة على جميع الفنادق
        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    } catch (e) {
      toast("⚠️ فشل تحميل الخريطة");
      console.error(e);
    }

    // إصلاح الحجم بعد الظهور
    setTimeout(() => map.invalidateSize(), 300);
  }
});

// 🔗 فتح تفاصيل الفندق من الخريطة
function openHotelFromMap(hotelId) {
  // ابحث عن بيانات الفندق من القائمة الحالية
  const hotelCard = document.querySelector(`[data-id="${hotelId}"]`);
  if (hotelCard) {
    hotelCard.scrollIntoView({ behavior: "smooth", block: "center" });
    hotelCard.click();
  } else {
    toast("📍 لم يتم العثور على تفاصيل الفندق.");
  }
}

// ==================== ⭐ التقييمات ====================
async function loadReviews() {
  try {
    const res = await jfetch(API + "/api/reviews"); // ✅ استدعاء المسار الجديد
    const list = $("#reviewsList");
    const empty = $("#noReviews");

    if (!res.reviews?.length) {
      list.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    list.innerHTML = res.reviews
      .map(
        (r) => `
        <div class="card">
          <div style="font-weight:700;">${"⭐".repeat(r.rating)}</div>
          <p>${r.comment || "بدون تعليق"}</p>
          <div class="muted" style="font-size:12px;">
            ${r.client_name || ""} – ${r.hotel_name || ""} – ${new Date(r.created_at).toLocaleDateString("ar-EG")}
          </div>
        </div>`
      )
      .join("");
  } catch (err) {
    console.error(err);
    toast("تعذّر تحميل التقييمات");
  }
}

// 📧 عرض حجوزات العميل المؤكدة
$("#btnLoadMyBookings")?.addEventListener("click", async () => {
  const email = $("#revEmail").value.trim();
  if (!email) return toast("أدخل بريدك الإلكتروني أولاً");

  $("#btnLoadMyBookings").disabled = true;
  $("#btnLoadMyBookings").textContent = "⏳ جاري التحميل...";

  try {
    const res = await fetch(API + "/api/bookings/confirmed-by-email/" + encodeURIComponent(email));

    const j = await res.json();

    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل التحميل");
    const bookings = j.bookings || [];

    const box = $("#revBookingsBox");
    if (!bookings.length) {
      box.innerHTML = "<div class='muted'>لا توجد حجوزات مؤكدة.</div>";
      $("#revFormBox").style.display = "none";
      return;
    }

    // 🎨 عرض الحجوزات
    box.innerHTML = bookings
      .map(
        (b) => `
        <div class="card rev-booking" data-ref="${b.booking_ref}" style="margin-top:6px;cursor:pointer;">
          <b>${b.hotel_name}</b> – ${b.room_name}
          <div class="muted">${b.booking_ref}</div>
        </div>`
      )
      .join("");
  } catch (err) {
    console.error(err);
    toast("⚠️ تعذر تحميل الحجوزات");
  } finally {
    $("#btnLoadMyBookings").disabled = false;
    $("#btnLoadMyBookings").textContent = "عرض حجوزاتي المؤكدة";
  }
});

// ✅ عند الضغط على أي حجز في القائمة
// ✅ عند الضغط على حجز مؤكد، افتح نافذة التقييم
$("#revBookingsBox")?.addEventListener("click", (e) => {
  const card = e.target.closest(".rev-booking");
  if (!card) return;
  const ref = card.dataset.ref;
  window.selectedBookingRef = ref;
  $("#reviewModal").style.display = "flex";
});

// ❌ إلغاء التقييم
$("#btnCancelReview")?.addEventListener("click", () => {
  $("#reviewModal").style.display = "none";
  $("#revComment").value = "";
});

// ✅ إرسال التقييم
$("#btnAddReview")?.addEventListener("click", async () => {
  const ref = window.selectedBookingRef;
  const rating = Number($("#revRating").value);
  const comment = $("#revComment").value.trim();
  if (!ref) return toast("اختر حجز أولاً");

  try {
    const res = await fetch(API + "/api/reviews/" + encodeURIComponent(ref), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || "فشل إرسال التقييم");

    toast("✅ تم إرسال تقييمك بنجاح");
    $("#reviewModal").style.display = "none";
    $("#revComment").value = "";
    loadReviews(); // 🔁 تحديث التقييمات فوراً
  } catch (err) {
    console.error(err);
    toast("❌ فشل إرسال التقييم");
  }
});
// ⭐ تحميل متوسط تقييمات الفنادق
async function loadAverageRatings() {
  try {
    const res = await jfetch(API + "/api/reviews/averages");
    const container = document.querySelector("#avgRatings");
    if (!container) return;

    if (!res.averages?.length) {
      container.innerHTML = "<div class='muted'>لا توجد تقييمات بعد.</div>";
      return;
    }

    container.innerHTML = res.averages
      .map(
        (h) => `
        <div class="card small" style="text-align:center;">
          <b>${h.hotel_name}</b><br>
          ⭐ ${h.avg_rating} / 5 <br>
          <span class="muted">${h.total_reviews} تقييم</span>
        </div>`
      )
      .join("");
  } catch (err) {
    console.error(err);
  }
}


const tabReviews = document.querySelector('.tab[data-target="reviews"]');
if (tabReviews)
  tabReviews.addEventListener("click", () => {
    loadReviews();          // تحميل التقييمات المفصلة
    loadAverageRatings();   // ✅ تحميل المتوسطات
  });


$("#bRoom")?.addEventListener("change", updatePriceSummary);
$("#bIn")?.addEventListener("change", updatePriceSummary);
$("#bOut")?.addEventListener("change", updatePriceSummary);
