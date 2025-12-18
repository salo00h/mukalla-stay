// server/public/hotel-login.js
const API = window.location.origin;

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) return alert("⚠️ أدخل البريد وكلمة المرور");

  try {
    const res = await fetch(`${API}/api/hotel/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const j = await res.json();
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل تسجيل الدخول");

    // ✅ حفظ بيانات الفندق مؤقتًا في localStorage
    localStorage.setItem("hotel", JSON.stringify(j.hotel));

    alert("✅ تم تسجيل الدخول بنجاح");
    window.location.href = "hotel-dashboard.html"; // الانتقال للوحة الفندق
  } catch (err) {
    alert("❌ " + err.message);
  }
});
