(function () {
  "use strict";

  var CFG = window.LQ_CONFIG;
  var I18N = window.LQ_I18N;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function store(key, val) {
    try {
      if (val === undefined) { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, v) { try { localStorage.setItem(key, v); } catch (e) {} }

  var lang = lsGet("lq_lang") === "en" ? "en" : "ar";
  var menu = store("lq_menu") || window.LQ_DEFAULT_MENU;
  var cart = store("lq_cart") || [];
  var activeCat = "all";
  var query = "";
  var rating = 0;
  var lastOrderMsg = "";

  function t(k) { return (I18N[lang] && I18N[lang][k]) || k; }
  function money(n) { return n.toFixed(2) + " " + t("jd"); }
  function findItem(id) { for (var i = 0; i < menu.length; i++) { if (menu[i].id === id) return menu[i]; } return null; }
  function brandName() { return lang === "ar" ? CFG.nameAr : CFG.nameEn; }

  function ammanHour() {
    try {
      var h = parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Amman", hour: "numeric", hour12: false }).format(new Date()), 10);
      return h % 24;
    } catch (e) { return new Date().getHours(); }
  }
  function isOpenHour(h) { return h >= CFG.openHour || h < CFG.closeHour; }
  function updateStatus() {
    var open = isOpenHour(ammanHour());
    var pill = $("#statusPill");
    pill.classList.toggle("closed", !open);
    $("#statusTxt").textContent = open ? t("open_now") : t("closed_now");
  }

  function applyLang() {
    var d = I18N[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = d.dir;
    document.title = lang === "ar"
      ? "لقمة ستريت | Loqma Street — شاورما وسناكات عمّان"
      : "Loqma Street | لقمة ستريت — Shawarma & Snacks in Amman";
    $$("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    $$("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    $$("[data-i18n-ph]").forEach(function (el) { el.placeholder = t(el.getAttribute("data-i18n-ph")); });
    $$("[data-brand]").forEach(function (el) { el.textContent = brandName(); });
    $("#langBtn").textContent = d.langBtn;
    updateStatus();
    renderMenu();
    renderCart();
    renderReviews();
    updateTotals();
  }

  function imgHtml(it) {
    return it.img ? '<img src="' + esc(it.img) + '" alt="' + esc(it[lang].name) + '" loading="lazy">' : '<span class="em">' + esc(it.emoji) + "</span>";
  }
  function renderMenu() {
    var grid = $("#menuGrid");
    var q = query.trim().toLowerCase();
    var list = menu.filter(function (it) {
      if (it.available === false) return false;
      var okCat = activeCat === "all" || it.cat === activeCat;
      var okQ = !q || (it.ar.name + " " + it.en.name + " " + it.ar.desc + " " + it.en.desc).toLowerCase().indexOf(q) !== -1;
      return okCat && okQ;
    });
    grid.innerHTML = list.map(function (it, i) {
      return '<article class="dish" style="animation-delay:' + (i * 0.05) + 's">' +
        '<div class="dish-img" style="--a:' + esc(it.c1) + ";--b:" + esc(it.c2) + '">' +
        (it.hot ? '<span class="tag">🔥 ' + esc(t("hot")) + "</span>" : "") + imgHtml(it) + "</div>" +
        '<div class="dish-body"><h3>' + esc(it[lang].name) + "</h3><p>" + esc(it[lang].desc) + "</p>" +
        '<div class="dish-foot"><span class="price">' + it.price.toFixed(2) + "<small>" + esc(t("jd")) + "</small></span>" +
        '<button class="add" data-add="' + it.id + '">+ ' + esc(t("add")) + "</button></div></div></article>";
    }).join("");
    $("#menuEmpty").hidden = list.length > 0;
  }

  function saveCart() { store("lq_cart", cart); }
  function cartCount() { return cart.reduce(function (s, c) { return s + c.qty; }, 0); }
  function cartSubtotal() {
    return cart.reduce(function (s, c) { var it = findItem(c.id); return s + (it ? it.price * c.qty : 0); }, 0);
  }
  function cleanCart() { cart = cart.filter(function (c) { return findItem(c.id) && c.qty > 0; }); }

  function addToCart(id) {
    var row = null;
    for (var i = 0; i < cart.length; i++) { if (cart[i].id === id) row = cart[i]; }
    if (row) row.qty += 1; else cart.push({ id: id, qty: 1 });
    saveCart(); renderCart(); toast(t("item_added"));
    var b = $("#cartBtn"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  }
  function changeQty(id, d) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) { cart[i].qty += d; if (cart[i].qty <= 0) cart.splice(i, 1); break; }
    }
    saveCart(); renderCart(); updateTotals();
  }
  function renderCart() {
    cleanCart();
    var box = $("#cartItems");
    $("#cartCount").textContent = cartCount();
    $("#cartFoot").hidden = cart.length === 0;
    if (!cart.length) {
      box.innerHTML = '<div class="cart-empty"><span>🛒</span>' + esc(t("cart_empty")) + "</div>";
      return;
    }
    box.innerHTML = cart.map(function (c) {
      var it = findItem(c.id);
      return '<div class="ci-row"><div class="ci-thumb" style="--a:' + esc(it.c1) + ";--b:" + esc(it.c2) + '">' +
        (it.img ? '<img src="' + esc(it.img) + '" alt="">' : esc(it.emoji)) + "</div>" +
        '<div class="ci-info"><b>' + esc(it[lang].name) + "</b><small>" + money(it.price * c.qty) + "</small></div>" +
        '<div class="qty"><button data-dec="' + it.id + '" aria-label="-">−</button><span>' + c.qty +
        '</span><button data-inc="' + it.id + '" aria-label="+">+</button></div></div>';
    }).join("");
    $("#cartSub").textContent = money(cartSubtotal());
  }

  function openDrawer() {
    $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false");
    $("#overlay").classList.add("show"); document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true");
    $("#overlay").classList.remove("show");
    if (!$(".modal.show")) document.body.style.overflow = "";
  }

  function openModal(id) {
    var m = $(id); m.classList.add("show"); m.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
  }
  function closeModals() {
    $$(".modal").forEach(function (m) { m.classList.remove("show"); m.setAttribute("aria-hidden", "true"); });
    if (!$("#drawer").classList.contains("open")) document.body.style.overflow = "";
  }

  var toastTimer;
  function toast(msg) {
    var el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove("show"); }, 1800);
  }

  var form = $("#orderForm");
  function orderType() { return form.otype.value; }
  function payMethod() { return form.pay.value; }
  function deliveryFee() { return orderType() === "delivery" ? CFG.deliveryFee : 0; }
  function updateTotals() {
    var sub = cartSubtotal(), del = deliveryFee();
    $("#tSub").textContent = money(sub);
    $("#tDelRow").hidden = del === 0;
    $("#tDel").textContent = money(del);
    $("#tTotal").textContent = money(sub + del);
    $("#closedWarn").hidden = isOpenHour(ammanHour());
  }
  function syncOrderFields() {
    var ty = orderType();
    $("#tableWrap").hidden = ty !== "dine";
    $("#addrWrap").hidden = ty !== "delivery";
    $("#cardBox").hidden = payMethod() !== "card";
    updateTotals();
  }

  function luhn(num) {
    var sum = 0, alt = false;
    for (var i = num.length - 1; i >= 0; i--) {
      var n = parseInt(num.charAt(i), 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }
  function cardBrand(num) {
    if (/^4/.test(num)) return "VISA";
    if (/^(5[1-5]|2[2-7])/.test(num)) return "MASTERCARD";
    return "CARD";
  }
  function validExpiry(v) {
    var m = /^(\d{2})\/(\d{2})$/.exec(v);
    if (!m) return false;
    var mm = parseInt(m[1], 10), yy = 2000 + parseInt(m[2], 10);
    if (mm < 1 || mm > 12) return false;
    var now = new Date();
    return new Date(yy, mm, 1) > new Date(now.getFullYear(), now.getMonth(), 1);
  }
  function validPhone(p) { var d = p.replace(/[^\d]/g, ""); return d.length >= 8 && d.length <= 15; }

  function validateOrder() {
    var f = form;
    if (!f.name.value.trim()) return t("err_name");
    if (!validPhone(f.phone.value)) return t("err_phone");
    if (orderType() === "delivery" && !f.address.value.trim()) return t("err_addr");
    if (payMethod() === "card") {
      var num = f.cnum.value.replace(/\s/g, "");
      if (!/^\d{13,19}$/.test(num) || !luhn(num)) return t("err_card");
      if (!f.cname.value.trim()) return t("err_cname");
      if (!validExpiry(f.cexp.value)) return t("err_exp");
      if (!/^\d{3,4}$/.test(f.ccvv.value)) return t("err_cvv");
    }
    return "";
  }

  function newOrderId() { return "LQ-" + String(Date.now()).slice(-6) + Math.floor(Math.random() * 90 + 10); }

  function buildWaMessage(o) {
    var typeLbl = { dine: I18N.ar.o_dine, pickup: I18N.ar.o_pickup, delivery: I18N.ar.o_delivery.replace(/\s*\(.*\)/, "") }[o.type];
    var lines = ["🌯 *طلب جديد - " + CFG.nameAr + "*", "رقم الطلب: " + o.id, "الاسم: " + o.name, "الهاتف: " + o.phone, "النوع: " + typeLbl];
    if (o.type === "dine" && o.table) lines.push("الطاولة: " + o.table);
    if (o.type === "delivery") lines.push("العنوان: " + o.address);
    lines.push("الدفع: " + (o.pay === "card" ? "بطاقة (تحقق من البوابة)" : "كاش"), "", "الأصناف:");
    o.items.forEach(function (i) { lines.push("• " + i.name + " × " + i.qty + " = " + (i.price * i.qty).toFixed(2)); });
    lines.push("", "المجموع: " + o.subtotal.toFixed(2) + " د.أ");
    if (o.delivery) lines.push("التوصيل: " + o.delivery.toFixed(2) + " د.أ");
    lines.push("*الإجمالي: " + o.total.toFixed(2) + " د.أ*");
    return lines.join("\n");
  }

  function placeOrder(e) {
    e.preventDefault();
    var errBox = $("#orderErr");
    errBox.textContent = "";
    if (!cart.length) { errBox.textContent = t("cart_empty"); return; }
    var err = validateOrder();
    if (err) { errBox.textContent = err; return; }

    var btn = $("#placeBtn");
    btn.disabled = true; btn.textContent = t("paying");

    var delay = payMethod() === "card" ? 1600 : 500;
    setTimeout(function () {
      var sub = cartSubtotal(), del = deliveryFee();
      var order = {
        id: newOrderId(), createdAt: new Date().toISOString(), status: "new",
        name: form.name.value.trim(), phone: form.phone.value.trim(),
        type: orderType(), table: form.table.value.trim(), address: form.address.value.trim(),
        pay: payMethod(), subtotal: sub, delivery: del, total: sub + del,
        items: cart.map(function (c) { var it = findItem(c.id); return { id: it.id, name: it.ar.name, qty: c.qty, price: it.price }; })
      };
      var orders = store("lq_orders") || [];
      orders.unshift(order);
      store("lq_orders", orders.slice(0, 300));

      lastOrderMsg = buildWaMessage(order);
      $("#okNum").textContent = order.id;
      $("#okWa").href = "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(lastOrderMsg);

      cart = []; saveCart(); renderCart();
      form.reset(); $("#ccPreview").textContent = "•••• •••• •••• ••••"; $("#cardBrand").textContent = "CARD";
      syncOrderFields();
      btn.disabled = false; btn.textContent = t("place_order");
      var ck = $("#successModal .check"); ck.innerHTML = ck.innerHTML;
      closeModals(); openModal("#successModal");
    }, delay);
  }

  function setupBooking() {
    var f = $("#bookForm");
    var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    f.date.min = today.toISOString().slice(0, 10);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = $("#bookMsg");
      msg.className = "msg"; msg.textContent = "";
      var name = f.name.value.trim(), phone = f.phone.value.trim(), date = f.date.value, time = f.time.value;
      var guests = parseInt(f.guests.value, 10);
      if (!name || !validPhone(phone) || !date || !time || !(guests >= 1 && guests <= 30)) {
        msg.className = "msg err"; msg.textContent = t("book_err"); return;
      }
      var hour = parseInt(time.split(":")[0], 10);
      if (!isOpenHour(hour)) { msg.className = "msg err"; msg.textContent = t("book_time_err"); return; }
      var b = { id: "BK-" + String(Date.now()).slice(-6), createdAt: new Date().toISOString(), status: "new",
        name: name, phone: phone, date: date, time: time, guests: guests, notes: f.notes.value.trim() };
      var list = store("lq_bookings") || []; list.unshift(b); store("lq_bookings", list.slice(0, 300));

      var text = "📅 *حجز طاولة - " + CFG.nameAr + "*\nالاسم: " + name + "\nالهاتف: " + phone + "\nالتاريخ: " + date + "\nالوقت: " + time +
        "\nعدد الأشخاص: " + guests + (b.notes ? "\nملاحظات: " + b.notes : "");
      msg.className = "msg ok";
      msg.textContent = t("book_ok") + " ";
      var a = document.createElement("a");
      a.href = "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(text);
      a.target = "_blank"; a.rel = "noopener"; a.style.textDecoration = "underline";
      a.textContent = lang === "ar" ? "أرسل الحجز عبر واتساب" : "Send booking via WhatsApp";
      msg.appendChild(a);
      f.reset(); f.guests.value = 2;
    });
  }

  var SEED_REVIEWS = [
    { name: "أحمد", stars: 5, text: "أحلى شاورما دجاج جربتها بعمّان! الثوم والمخلل مضبوطين والخبز طازج." },
    { name: "Lina", stars: 5, text: "Open late and always fresh. The beef saj wrap is unreal." },
    { name: "محمد", stars: 4, text: "الوجبة كبيرة والسعر ممتاز، والتوصيل سريع." },
    { name: "Sara", stars: 5, text: "Crispy chicken burger + kunafa = perfect night. Staff are super friendly." }
  ];
  function renderReviews() {
    var all = (store("lq_reviews") || []).concat(SEED_REVIEWS);
    $("#reviewsGrid").innerHTML = all.map(function (r, i) {
      var s = Math.max(1, Math.min(5, r.stars | 0));
      return '<div class="rev" style="animation-delay:' + (Math.min(i, 8) * 0.06) + 's"><div class="stars" aria-label="' + s + '/5">' +
        "★".repeat(s) + "☆".repeat(5 - s) + "</div><p>" + esc(r.text) + '</p><div class="who"><span class="av">' +
        esc(r.name.charAt(0).toUpperCase()) + "</span>" + esc(r.name) + "</div></div>";
    }).join("");
  }
  function setupReviews() {
    var stars = $$("#starsInput button");
    function paint(n) { stars.forEach(function (b) { b.classList.toggle("on", parseInt(b.dataset.v, 10) <= n); }); }
    stars.forEach(function (b) {
      b.addEventListener("click", function () { rating = parseInt(b.dataset.v, 10); paint(rating); });
      b.addEventListener("mouseenter", function () { paint(parseInt(b.dataset.v, 10)); });
      b.addEventListener("mouseleave", function () { paint(rating); });
    });
    $("#reviewForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, msg = $("#reviewMsg");
      var name = f.name.value.trim(), text = f.text.value.trim();
      if (!name || !text || !rating) { msg.className = "msg err"; msg.textContent = t("r_err"); return; }
      var list = store("lq_reviews") || [];
      list.unshift({ name: name, text: text, stars: rating });
      store("lq_reviews", list.slice(0, 50));
      f.reset(); rating = 0; paint(0);
      msg.className = "msg ok"; msg.textContent = t("r_ok");
      renderReviews();
    });
  }

  function setupEffects() {
    var header = $("#header"), toTop = $("#toTop");
    function onScroll() {
      header.classList.toggle("scrolled", window.scrollY > 40);
      toTop.classList.toggle("show", window.scrollY > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

    var burger = $("#burger"), links = $("#links");
    burger.addEventListener("click", function () { burger.classList.toggle("open"); links.classList.toggle("open"); });
    $$("#links a").forEach(function (a) { a.addEventListener("click", function () { burger.classList.remove("open"); links.classList.remove("open"); }); });

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
      }, { threshold: 0.12 });
      $$(".reveal").forEach(function (el) { io.observe(el); });

      var secs = $$("main section[id]");
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            $$("#links a").forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id); });
          }
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      secs.forEach(function (s) { spy.observe(s); });
    } else {
      $$(".reveal").forEach(function (el) { el.classList.add("in"); });
    }

    $$("[data-count]").forEach(function (el) {
      var end = parseInt(el.dataset.count, 10), n = 0;
      var step = Math.max(1, Math.round(end / 30));
      var iv = setInterval(function () { n += step; if (n >= end) { n = end; clearInterval(iv); } el.textContent = n; }, 40);
    });
  }

  function bind() {
    $("#langBtn").addEventListener("click", function () { lang = lang === "ar" ? "en" : "ar"; lsSet("lq_lang", lang); applyLang(); });
    $("#tabs").addEventListener("click", function (e) {
      var b = e.target.closest(".tab"); if (!b) return;
      $$(".tab").forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active");
      activeCat = b.dataset.cat; renderMenu();
    });
    $("#search").addEventListener("input", function (e) { query = e.target.value; renderMenu(); });
    $("#menuGrid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-add]"); if (b) addToCart(parseInt(b.dataset.add, 10));
    });
    $("#cartItems").addEventListener("click", function (e) {
      var inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]");
      if (inc) changeQty(parseInt(inc.dataset.inc, 10), 1);
      if (dec) changeQty(parseInt(dec.dataset.dec, 10), -1);
    });
    $("#cartBtn").addEventListener("click", openDrawer);
    $("#closeCart").addEventListener("click", closeDrawer);
    $("#overlay").addEventListener("click", closeDrawer);
    $("#clearCart").addEventListener("click", function () { cart = []; saveCart(); renderCart(); });
    $("#checkoutBtn").addEventListener("click", function () { closeDrawer(); syncOrderFields(); $("#orderErr").textContent = ""; openModal("#checkoutModal"); });

    $$(".modal").forEach(function (m) {
      m.addEventListener("click", function (e) { if (e.target === m || e.target.closest("[data-close]")) closeModals(); });
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeModals(); closeDrawer(); } });

    $$('input[name="otype"],input[name="pay"]', form).forEach(function (r) { r.addEventListener("change", syncOrderFields); });
    form.addEventListener("submit", placeOrder);

    var cnum = $("#cnum");
    cnum.addEventListener("input", function () {
      var d = cnum.value.replace(/\D/g, "").slice(0, 19);
      cnum.value = d.replace(/(.{4})/g, "$1 ").trim();
      var padded = (d + "################").slice(0, 16).replace(/#/g, "•");
      $("#ccPreview").textContent = padded.replace(/(.{4})/g, "$1 ").trim();
      $("#cardBrand").textContent = cardBrand(d);
    });
    var cexp = $("#cexp");
    cexp.addEventListener("input", function () {
      var d = cexp.value.replace(/\D/g, "").slice(0, 4);
      cexp.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
    });
    $("#cardBox").addEventListener("input", function (e) {
      if (e.target.name === "ccvv") e.target.value = e.target.value.replace(/\D/g, "");
    });
  }

  function init() {
    $("#year").textContent = new Date().getFullYear();
    $("#cPhone").textContent = CFG.phone;
    $("#cMail").textContent = CFG.email;
    $("#waLink").href = "https://wa.me/" + CFG.whatsapp;
    $("#igLink").href = CFG.instagram;
    $("#mapFrame").src = CFG.mapEmbed;
    bind(); setupBooking(); setupReviews(); setupEffects();
    applyLang();
    setInterval(updateStatus, 60000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
