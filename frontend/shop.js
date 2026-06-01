import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getAuth, GoogleAuthProvider, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signInWithPopup, onAuthStateChanged,
  updateProfile, signOut, reload,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc, addDoc,
  onSnapshot, serverTimestamp, query, where, getDoc, updateDoc,
  getDocs, orderBy, limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBodbuSlY3MnQFZjbT3jrFAP-jp1V--IXk",
  authDomain: "admin-dashboard-7fde9.firebaseapp.com",
  projectId: "admin-dashboard-7fde9",
  storageBucket: "admin-dashboard-7fde9.firebasestorage.app",
  messagingSenderId: "369558087012",
  appId: "1:369558087012:web:25292540078bd9156fc671",
  measurementId: "G-FLPC387S65"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
getAnalytics(app);

// ===== HELPERS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function esc(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function fmt(v) { return Number(v||0).toLocaleString("ru-RU") + " so\u2019m"; }

function toast(type, title, msg) {
  const wrap = $("#toastWrap");
  if (!wrap) return;
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.innerHTML = "<strong>" + esc(title) + "</strong><span>" + esc(msg) + "</span>";
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function openModal(id) { $(id) && $(id).classList.add("show"); }
function closeModal(id) { $(id) && $(id).classList.remove("show"); }

// ===== STATE =====
let currentUser = null;
let products = [];
let categories = [];
let activeCategory = "Barchasi";
let searchTerm = "";
let favoriteIds = new Set();
let myOrders = [];
let carouselSlides = [];
let carouselIndex = 0;
let carouselTimer = null;
let productsUnsub = null;
let categoriesUnsub = null;
let carouselUnsub = null;
let favUnsub = null;
let ordersUnsub = null;

function uidKey(k) { return k + "_" + (currentUser?.uid || "guest"); }
function loadLS(k, fb) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } }
function saveLS(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function getCart() { return loadLS(uidKey("cart"), []); }
function setCart(c) { saveLS(uidKey("cart"), c); updateCartBadge(); }

// ===== CAROUSEL =====
const DEFAULT_SLIDES = [
  { title: "ELZAFAR MARKET", desc: "Yangi mahsulotlar har doim yoningizda", img: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=70", color: "#4f46e5" },
  { title: "Sog\u02BBlom oziq-ovqat", desc: "Tanlangan mahsulotlar va qulay buyurtma", img: "https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=1200&q=70", color: "#059669" },
  { title: "Tez yetkazib berish", desc: "Olib ketish vaqtini o\u02BBzingiz belgilaysiz", img: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=1200&q=70", color: "#dc2626" },
];

function renderCarousel() {
  const track = $("#carouselTrack");
  const dotsEl = $("#carouselDots");
  if (!track || !dotsEl) return;
  const slides = carouselSlides.length ? carouselSlides : DEFAULT_SLIDES;
  track.innerHTML = slides.map(s => `
    <div class="slide" style="background:${s.color||"#4f46e5"}">
      ${s.img ? `<img src="${esc(s.img)}" alt="" onerror="this.style.display='none'">` : ""}
      <div class="slide-content">
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.desc||"")}</p>
      </div>
    </div>`).join("");
  dotsEl.innerHTML = slides.map((_, i) =>
    `<div class="dot${i === carouselIndex ? " active" : ""}" data-i="${i}"></div>`).join("");
  track.style.transform = `translateX(${-carouselIndex * 100}%)`;
  dotsEl.onclick = (e) => {
    const d = e.target.closest(".dot");
    if (!d) return;
    carouselIndex = +d.dataset.i;
    applyCarousel();
    restartTimer();
  };
}

function applyCarousel() {
  const track = $("#carouselTrack");
  if (track) track.style.transform = `translateX(${-carouselIndex * 100}%)`;
  $$("#carouselDots .dot").forEach((d, i) => d.classList.toggle("active", i === carouselIndex));
}

function restartTimer() {
  if (carouselTimer) clearInterval(carouselTimer);
  const len = (carouselSlides.length || DEFAULT_SLIDES.length);
  carouselTimer = setInterval(() => {
    carouselIndex = (carouselIndex + 1) % len;
    applyCarousel();
  }, 4000);
}

function startCarouselListener() {
  if (carouselUnsub) { carouselUnsub(); carouselUnsub = null; }
  carouselUnsub = onSnapshot(collection(db, "shopCarousel"), snap => {
    const slides = snap.docs.map(d => {
      const x = d.data();
      return { title: x.text || x.title || "", desc: x.subtitle || x.desc || "", img: x.imageUrl || x.image || "", color: x.color || "#4f46e5" };
    });
    carouselSlides = slides.length ? slides.slice(0, 3) : [];
    carouselIndex = 0;
    renderCarousel();
    restartTimer();
  }, () => { carouselSlides = []; renderCarousel(); restartTimer(); });
}

// ===== AUTH =====
async function upsertCustomer(user) {
  if (!user) return;
  try {
    await setDoc(doc(db, "customers", user.uid), {
      uid: user.uid, email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) { console.warn("upsertCustomer:", e); }
}

function renderUserChip() {
  const loginBtn = $("#loginHeaderBtn");
  const userPill = $("#userPill");
  const avatar = $("#userAvatar");
  const emailEl = $("#userEmail");
  const bnAvatar = $("#bnAvatar");
  const bnLabel = $("#bnKabinetLabel");

  if (loginBtn) loginBtn.style.display = currentUser ? "none" : "";
  if (userPill) userPill.style.display = currentUser ? "flex" : "none";
  const logoutBtn = $("#logoutBtn");
  const cabinetBtn = $("#cabinetBtn");
  if (logoutBtn) logoutBtn.style.display = currentUser ? "inline-flex" : "none";
  if (cabinetBtn) cabinetBtn.style.display = currentUser ? "inline-flex" : "none";

  if (!currentUser) {
    if (avatar) avatar.innerHTML = "?";
    if (emailEl) emailEl.textContent = "";
    if (bnAvatar) { bnAvatar.className = "bn-avatar"; bnAvatar.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`; }
    if (bnLabel) bnLabel.textContent = "Kirish";
    return;
  }

  if (emailEl) emailEl.textContent = currentUser.email || "";
  const hint = $("#authHint");
  if (hint) hint.textContent = currentUser.displayName || "Xush kelibsiz!";

  // Desktop avatar
  if (avatar) {
    if (currentUser.photoURL) {
      avatar.innerHTML = `<img src="${esc(currentUser.photoURL)}" alt="" referrerpolicy="no-referrer">`;
    } else {
      avatar.textContent = (currentUser.displayName || currentUser.email || "U")[0].toUpperCase();
    }
  }

  // Mobile bottom nav avatar
  if (bnAvatar) {
    if (currentUser.photoURL) {
      bnAvatar.className = "bn-avatar";
      bnAvatar.innerHTML = `<img src="${esc(currentUser.photoURL)}" alt="" referrerpolicy="no-referrer">`;
    } else {
      bnAvatar.className = "bn-avatar has-letter";
      bnAvatar.textContent = (currentUser.displayName || currentUser.email || "U")[0].toUpperCase();
    }
  }
  if (bnLabel) bnLabel.textContent = "Kabinet";
}

function ensureAuth() {
  if (currentUser) return true;
  toast("warn", "Kirish kerak", "Davom etish uchun tizimga kiring");
  openLoginModal();
  return false;
}

function openLoginModal() {
  const last = localStorage.getItem("bm_last_email");
  const block = $("#loginResumeBlock");
  const em = $("#loginResumeEmail");
  if (block && em) {
    if (last && !currentUser) { block.style.display = "block"; em.textContent = last; }
    else block.style.display = "none";
  }
  openModal("#loginModal");
}

async function loginGoogle() {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { toast("error", "Xatolik", e.message); }
}

async function loginEmail(email, password, mode) {
  const errs = {
    "auth/user-not-found": "Foydalanuvchi topilmadi",
    "auth/wrong-password": "Notogri parol",
    "auth/email-already-in-use": "Bu email allaqachon royxatdan otgan",
    "auth/weak-password": "Parol juda kuchsiz (kamida 6 ta belgi)",
    "auth/invalid-email": "Notogri email formati",
    "auth/invalid-credential": "Email yoki parol notogri",
  };
  try {
    if (mode === "signup") await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    toast("error", "Xatolik", errs[e.code] || e.message);
  }
}

async function logout() {
  try { await signOut(auth); }
  catch (e) { toast("error", "Xatolik", e.message); }
}

// ===== PRODUCTS =====
function startProductsListener() {
  if (productsUnsub) { productsUnsub(); productsUnsub = null; }
  productsUnsub = onSnapshot(collection(db, "products"), snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    products.sort((a, b) => {
      const ta = a.createdAt?.toDate?.()?.getTime() || 0;
      const tb = b.createdAt?.toDate?.()?.getTime() || 0;
      return tb - ta;
    });
    computeCategories(); renderChips(); renderGrid();
  }, e => { console.error("products:", e); toast("error", "Xatolik", "Mahsulotlar yuklanmadi"); });
}

function startCategoriesListener() {
  if (categoriesUnsub) { categoriesUnsub(); categoriesUnsub = null; }
  categoriesUnsub = onSnapshot(collection(db, "categories"), snap => {
    categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    computeCategories(); renderChips(); renderCatalogGrid();
  }, e => console.warn("categories:", e));
}

function computeCategories() {
  // aktiv kategoriya hali mavjudmi tekshirish
  if (activeCategory !== "Barchasi") {
    const all = [...categories.map(c => c.name || c.id), ...products.map(p => p.category || "").filter(Boolean)];
    if (!all.includes(activeCategory)) activeCategory = "Barchasi";
  }
}

function getCatOptions() {
  if (categories.length) {
    return [{ slug: "Barchasi", label: "Barchasi" }, ...categories.map(c => ({ slug: c.name || c.id, label: c.name || c.id }))];
  }
  const uniq = [...new Set(products.map(p => (p.category || "").trim()).filter(Boolean))];
  return [{ slug: "Barchasi", label: "Barchasi" }, ...uniq.map(s => ({ slug: s, label: s }))];
}

function renderChips() {
  const wrap = $("#categoryChips");
  if (!wrap) return;
  const opts = getCatOptions();
  wrap.innerHTML = opts.map(c =>
    `<div class="chip${c.slug === activeCategory ? " active" : ""}" data-cat="${esc(c.slug)}">${esc(c.label)}</div>`
  ).join("");
  wrap.onclick = e => {
    const el = e.target.closest(".chip");
    if (!el) return;
    activeCategory = el.dataset.cat;
    renderChips(); renderGrid();
  };
}

function productMatches(p) {
  if (activeCategory !== "Barchasi" && (p.category || "") !== activeCategory) return false;
  if (searchTerm && !String(p.name || "").toLowerCase().includes(searchTerm)) return false;
  return true;
}

function renderGrid() {
  const grid = $("#productsGrid");
  if (!grid) return;
  const list = products.filter(productMatches);
  if (!list.length) { grid.innerHTML = `<div class="small" style="padding:20px;grid-column:1/-1">Hech narsa topilmadi.</div>`; return; }
  grid.innerHTML = list.map(p => productCard(p, favoriteIds.has(p.id))).join("");
  grid.onclick = e => {
    const favBtn = e.target.closest("[data-fav]");
    const addBtn = e.target.closest("[data-add]");
    if (favBtn) { if (!ensureAuth()) return; toggleFav(favBtn.dataset.fav); return; }
    if (addBtn) {
      if (!ensureAuth()) return;
      const pid = addBtn.dataset.add;
      const qtyEl = grid.querySelector(`input[data-qty="${CSS.escape(pid)}"]`);
      addToCart(pid, Number(qtyEl?.value || 1));
      addBtn.textContent = "\u2713 Qoshildi";
      addBtn.style.background = "var(--success)";
      setTimeout(() => { addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Savat`; addBtn.style.background = ""; }, 1200);
    }
  };
}

function productCard(p, isFav) {
  const unit = p.unit === "kg" ? "kg" : "dona";
  const step = unit === "kg" ? "0.1" : "1";
  const def = unit === "kg" ? "0.5" : "1";
  const img = p.imageUrl || p.image || "";
  const price = Number(p.price || 0);
  return `<div class="card" data-id="${esc(p.id)}">
    <div class="card-media">
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<div style="width:100%;height:100%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:32px">&#128722;</div>`}
      <button class="fav${isFav ? " active" : ""}" data-fav="${esc(p.id)}">${heartSvg(isFav)}</button>
    </div>
    <div class="card-body">
      <div class="title">${esc(p.name || "Mahsulot")}</div>
      <div class="meta"><span class="badge">${esc(p.category || "")}</span><span class="badge">${unit}</span></div>
      <div class="price-row">
        <div><div class="price">${fmt(price)}</div><div class="small">/${unit}</div></div>
        <div><input type="number" data-qty="${esc(p.id)}" value="${def}" step="${step}" min="${step}" style="width:60px;padding:4px 6px;border:1px solid var(--border-color);border-radius:6px;font-size:12px;text-align:center"></div>
      </div>
      <button class="btn-add-cart" data-add="${esc(p.id)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Savat
      </button>
    </div>
  </div>`;
}

function heartSvg(active) {
  const f = active ? "#ef4444" : "none";
  const s = active ? "#ef4444" : "#344054";
  return `<svg viewBox="0 0 24 24" fill="${f}" stroke="${s}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>`;
}

// ===== CATALOG =====
function renderCatalogGrid() {
  const grid = $("#catalogGrid");
  if (!grid) return;
  if (!categories.length) {
    grid.innerHTML = `<div style="padding:24px;color:var(--text-secondary)">Admin paneldan kategoriya qoshing.</div>`;
    return;
  }
  grid.innerHTML = categories.map(c => {
    const slug = c.name || c.id;
    const img = c.imageUrl || c.image || "";
    return `<div class="catalog-row" data-slug="${esc(slug)}">
      <div class="catalog-row-left">
        ${img ? `<img class="catalog-row-img" src="${esc(img)}" alt="">` : `<div class="catalog-row-placeholder">&#128722;</div>`}
        <span class="catalog-row-name">${esc(c.name || slug)}</span>
      </div>
      <span class="catalog-row-arrow">&#8250;</span>
    </div>`;
  }).join("");
  grid.onclick = e => {
    const row = e.target.closest(".catalog-row");
    if (!row) return;
    activeCategory = row.dataset.slug;
    closeModal("#catalogModal");
    renderChips(); renderGrid();
    document.querySelector("main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Search filter
  const search = $("#catalogSearch");
  if (search) search.oninput = () => {
    const term = search.value.toLowerCase();
    grid.querySelectorAll(".catalog-row").forEach(r => {
      const name = r.querySelector(".catalog-row-name")?.textContent.toLowerCase() || "";
      r.style.display = name.includes(term) ? "" : "none";
    });
  };
}

// ===== FAVORITES =====
function startFavListener(uid) {
  if (favUnsub) { favUnsub(); favUnsub = null; }
  favoriteIds = new Set();
  if (!uid) return;
  favUnsub = onSnapshot(collection(db, "customers", uid, "favorites"), snap => {
    favoriteIds = new Set(snap.docs.map(d => d.id));
    renderGrid(); renderFavDrawer(); updateFavBadge();
  }, e => console.warn("favs:", e));
}

async function toggleFav(pid) {
  if (!currentUser) { openLoginModal(); return; }
  const ref = doc(db, "customers", currentUser.uid, "favorites", pid);
  try {
    if (favoriteIds.has(pid)) { await deleteDoc(ref); toast("info", "Saralangan", "Olib tashlandi"); }
    else { await setDoc(ref, { productId: pid, addedAt: serverTimestamp() }); toast("info", "Saralangan", "Saqlandi"); }
  } catch (e) { toast("error", "Xatolik", e.message); }
}

function updateFavBadge() {
  const n = favoriteIds.size;
  const el = $("#favoritesCount");
  if (el) { el.textContent = n; el.style.display = n > 0 ? "inline-flex" : "none"; }
  const bn = $("#bnFavCount");
  if (bn) { bn.textContent = n; bn.style.display = n > 0 ? "flex" : "none"; }
}

function renderFavDrawer() {
  const body = $("#favoritesBody");
  if (!body) return;
  if (!currentUser) { body.innerHTML = `<div class="fav-empty">Tizimga kiring.</div>`; return; }
  const list = products.filter(p => favoriteIds.has(p.id));
  if (!list.length) { body.innerHTML = `<div class="fav-empty">Saralangan mahsulot yoq.</div>`; return; }
  body.innerHTML = `<div class="fav-list">${list.map(p => {
    const unit = p.unit === "kg" ? "kg" : "dona";
    const img = p.imageUrl || p.image || "";
    return `<div class="fav-row">
      ${img ? `<img src="${esc(img)}" alt="">` : `<div style="width:70px;height:70px;background:#e2e8f0;border-radius:7px;display:flex;align-items:center;justify-content:center">&#128722;</div>`}
      <div class="fav-row-main">
        <div class="fav-row-title">${esc(p.name || "")}</div>
        <div class="fav-row-meta">${fmt(p.price)}/${unit}</div>
        <div class="fav-row-actions">
          <button class="btn primary" style="width:auto;padding:6px 12px;font-size:12px" data-add-fav="${esc(p.id)}">Savatga</button>
          <button class="btn" style="width:auto;padding:6px 10px;font-size:12px" data-rem-fav="${esc(p.id)}">Olib tashlash</button>
        </div>
      </div>
    </div>`;
  }).join("")}</div>`;
  body.onclick = e => {
    const add = e.target.closest("[data-add-fav]");
    const rem = e.target.closest("[data-rem-fav]");
    if (add) { if (!ensureAuth()) return; addToCart(add.dataset.addFav, 1); }
    if (rem) toggleFav(rem.dataset.remFav);
  };
}

// ===== CABINET PANE NAVIGATION =====
function showCabinetDetail(pane) {
  $$("[data-cab-pane]").forEach(el => el.style.display = "none");
  const list = $("#cabinetMainList");
  if (list) list.style.display = "none";
  const target = document.getElementById("cabinetPane_" + pane);
  if (target) target.style.display = "block";
  const foot = $("#cabinetFooterProfile");
  if (foot) foot.style.display = pane === "profile" ? "flex" : "none";
  if (pane === "orders") renderCabinetOrders();
  if (pane === "fav") renderCabinetFav();
  if (pane === "news") loadCabinetNews();
  if (pane === "dev") renderDeveloperPage();
}
window.showCabinetDetail = showCabinetDetail;

function showCabinetMainList() {
  $$("[data-cab-pane]").forEach(el => el.style.display = "none");
  const list = $("#cabinetMainList");
  if (list) list.style.display = "block";
  const foot = $("#cabinetFooterProfile");
  if (foot) foot.style.display = "none";
}
window.showCabinetMainList = showCabinetMainList;

function openCabinet() {
  if (!ensureAuth()) return;
  // Avatar set
  function setAv(el) {
    if (!el) return;
    if (currentUser.photoURL) el.innerHTML = `<img src="${esc(currentUser.photoURL)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    else el.textContent = (currentUser.displayName || currentUser.email || "U")[0].toUpperCase();
  }
  setAv($("#cabinetAvatarBig")); setAv($("#cabinetAvatarBig2"));
  const nameEl = $("#cabinetUserName");
  if (nameEl) nameEl.textContent = currentUser.displayName || (currentUser.email || "").split("@")[0] || "Foydalanuvchi";
  const emailEl = $("#cabinetUserEmail");
  if (emailEl) emailEl.textContent = currentUser.email || "";
  const cabEmail = $("#cabinetEmail");
  if (cabEmail) cabEmail.textContent = currentUser.email || "";
  const nameIn = $("#cabinetName");
  if (nameIn) nameIn.value = currentUser.displayName || "";
  showCabinetMainList();
  openModal("#cabinetModal");
}

// ===== CABINET ORDERS =====
function startOrdersListener(uid) {
  if (ordersUnsub) { ordersUnsub(); ordersUnsub = null; }
  myOrders = [];
  if (!uid) return;
  ordersUnsub = onSnapshot(
    query(collection(db, "orders"), where("userUid", "==", uid)),
    snap => {
      myOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      myOrders.sort((a, b) => {
        const ta = a.createdAt?.toDate?.()?.getTime() || 0;
        const tb = b.createdAt?.toDate?.()?.getTime() || 0;
        return tb - ta;
      });
      renderCabinetOrders();
    }, e => console.warn("orders:", e)
  );
}

function renderCabinetOrders() {
  const el = $("#cabinetOrdersList");
  if (!el) return;
  if (!currentUser) { el.innerHTML = `<div class="small">Tizimga kiring.</div>`; return; }
  if (!myOrders.length) { el.innerHTML = `<div class="small">Hozircha buyurtma yoq.</div>`; return; }
  el.innerHTML = myOrders.map(o => {
    const items = (o.items || []).map(i => `${esc(i.name)} x ${i.quantity}`).join(" | ");
    const pickup = o.pickupTime ? `<div class="small" style="margin-top:5px">Olib ketish: <b>${esc(o.pickupTime)}</b></div>` : "";
    return `<div class="cabinet-order-card">
      <div class="cabinet-order-row">
        <span class="cabinet-order-sum">${fmt(o.total || 0)}</span>
        <span class="cabinet-order-badge">${esc(o.status || "yangi")}</span>
      </div>
      <div class="small">${items || "\u2014"}</div>${pickup}
    </div>`;
  }).join("");
}

// ===== CABINET FAV PANE =====
function renderCabinetFav() {
  const el = $("#cabinetFavList");
  if (!el) return;
  if (!currentUser) { el.innerHTML = `<div class="small">Tizimga kiring.</div>`; return; }
  const list = products.filter(p => favoriteIds.has(p.id));
  if (!list.length) { el.innerHTML = `<div class="small">Saralangan mahsulot yoq.</div>`; return; }
  el.innerHTML = `<div class="fav-list">${list.map(p => {
    const img = p.imageUrl || p.image || "";
    return `<div class="fav-row">
      ${img ? `<img src="${esc(img)}" alt="">` : `<div style="width:70px;height:70px;background:#e2e8f0;border-radius:7px;display:flex;align-items:center;justify-content:center">&#128722;</div>`}
      <div class="fav-row-main">
        <div class="fav-row-title">${esc(p.name || "")}</div>
        <div class="fav-row-meta">${fmt(p.price)}</div>
        <div class="fav-row-actions">
          <button class="btn primary" style="width:auto;padding:6px 12px;font-size:12px" data-add-fav="${esc(p.id)}">Savatga</button>
          <button class="btn" style="width:auto;padding:6px 10px;font-size:12px" data-rem-fav="${esc(p.id)}">Olib tashlash</button>
        </div>
      </div>
    </div>`;
  }).join("")}</div>`;
  el.onclick = e => {
    const add = e.target.closest("[data-add-fav]");
    const rem = e.target.closest("[data-rem-fav]");
    if (add) { if (!ensureAuth()) return; addToCart(add.dataset.addFav, 1); }
    if (rem) toggleFav(rem.dataset.remFav);
  };
}

// ===== NEWS =====
let newsUnsub = null;
function loadCabinetNews() {
  const el = $("#cabinetNewsList");
  if (!el) return;
  if (newsUnsub) { newsUnsub(); newsUnsub = null; }
  newsUnsub = onSnapshot(query(collection(db, "news"), orderBy("createdAt", "desc"), limit(10)), snap => {
    if (snap.empty) { el.innerHTML = `<div class="news-loading">Hozircha yangilik yoq</div>`; return; }
    el.innerHTML = snap.docs.map(d => {
      const item = d.data();
      const date = item.createdAt?.toDate?.() || new Date();
      const ds = date.toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
      let media = "";
      if (item.videoUrl) {
        const vid = item.videoUrl.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^#&?]*)/)?.[1];
        if (vid) media = `<div style="margin-top:10px;border-radius:8px;overflow:hidden"><iframe src="https://www.youtube.com/embed/${vid}" allowfullscreen style="width:100%;height:180px;border:none"></iframe></div>`;
      } else if (item.imageUrl) {
        media = `<img src="${esc(item.imageUrl)}" alt="" style="width:100%;border-radius:8px;margin-top:8px">`;
      }
      return `<div class="news-card"><h5>${esc(item.title||"")}</h5>${item.content?`<p>${esc(item.content)}</p>`:""}<div class="news-date">${ds}</div>${media}</div>`;
    }).join("");
  }, () => { el.innerHTML = `<div class="news-loading">Yuklanishda xatolik</div>`; });
}

// ===== DEVELOPER PAGE =====
function renderDeveloperPage() {
  const el = $("#devPageBody");
  if (!el) return;
  el.innerHTML = `
    <div class="dev-page">
      <div class="dev-avatar-wrap">
        <img src="https://avatars.githubusercontent.com/asomiddinmeliboyev" alt="Asomiddin"
          onerror="this.parentElement.innerHTML='<span class=dev-avatar-letter>A</span>'">
      </div>
      <div class="dev-name">Asomiddin Meliboyev</div>
      <div class="dev-role">Full-Stack Developer &amp; AI Engineer</div>
      <div class="dev-bio">
        <p>Yoshim: <b>18 yosh</b></p>
        <p>Hozirda Jizzax Hokimiyat <b>IT PROGRESS</b> markazida o\u02BBqiyapman.</p>
        <br>
        <p>Odamlarga <b>zamonaviy biznes tizimlari</b> yarataman &mdash; onlayn do\u02BBkonlar, avtomatlashtirish va <b>AI botlar</b>.</p>
        <br>
        <p>Men orqali siz o\u02BBz biznesingizni rivojlantirishingiz mumkin!</p>
      </div>
      <div class="dev-socials">
        <a href="https://t.me/asomiddinmeliboyev" target="_blank" rel="noopener" class="dev-social-btn tg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.5 3.5 11c-.8.3-.8.8-.1 1l4.6 1.4 11-7c.5-.3.9-.1.5.2l-9 8.3-.3 3.8c.4 0 .6-.2.8-.4l2-2 4.1 3c.8.4 1.3.2 1.5-.7l3-14.2c.2-1-.3-1.5-1.2-1.2Z"/></svg>
          Telegram
        </a>
        <a href="https://instagram.com/asomiddinmeliboyev" target="_blank" rel="noopener" class="dev-social-btn ig">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>
          Instagram
        </a>
      </div>
      <a href="tel:+998918917007" class="dev-phone">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        +998 91-891-70-07
      </a>
    </div>`;
}

// ===== PROFILE SAVE =====
async function saveCabinet() {
  if (!ensureAuth()) return;
  const displayName = ($("#cabinetName")?.value || "").trim();
  const file = $("#cabinetPhoto")?.files?.[0] || null;
  const btn = $("#cabinetSave");
  if (btn) { btn.disabled = true; btn.textContent = "Saqlanmoqda..."; }
  try {
    if (file) {
      // Firebase Storage - with detailed error logging
      let photoURL = null;
      let usesFallback = false;
      
      try {
        console.log('[Profile] ===== UPLOAD START =====');
        console.log('[Profile] File name:', file.name);
        console.log('[Profile] File size:', file.size, 'bytes');
        console.log('[Profile] File type:', file.type);
        console.log('[Profile] Current user UID:', currentUser.uid);
        console.log('[Profile] Current user email:', currentUser.email);
        
        // Create storage reference
        const storagePath = `profile_photos/${currentUser.uid}_${Date.now()}`;
        console.log('[Profile] Storage path:', storagePath);
        const ref = storageRef(storage, storagePath);
        console.log('[Profile] Storage reference created successfully');
        
        // Upload file - MUST complete before getDownloadURL
        console.log('[Profile] Starting file upload...');
        const uploadResult = await uploadBytes(ref, file);
        console.log('[Profile] Upload completed successfully');
        console.log('[Profile] Upload result ref:', uploadResult.ref.fullPath);
        
        // Get download URL ONLY after upload completes
        console.log('[Profile] Retrieving download URL...');
        photoURL = await getDownloadURL(uploadResult.ref);
        console.log('[Profile] Download URL obtained:', photoURL.substring(0, 80) + '...');
        
        // Save to Firestore customers collection with merge: true
        console.log('[Profile] Saving to Firestore (customers/' + currentUser.uid + ')...');
        await setDoc(
          doc(db, "customers", currentUser.uid), 
          { 
            photoURL: photoURL,
            displayName: displayName || null,
            email: currentUser.email,
            updatedAt: serverTimestamp()
          }, 
          { merge: true }
        );
        console.log('[Profile] Firestore save successful');
        
        // Update Auth profile
        console.log('[Profile] Updating Firebase Auth profile...');
        await updateProfile(currentUser, { photoURL, displayName: displayName || null });
        console.log('[Profile] Auth profile updated successfully');
        console.log('[Profile] ===== UPLOAD SUCCESS =====');
        
      } catch (storageErr) {
        console.error('[Profile] ===== STORAGE ERROR =====');
        console.error('[Profile] Error code:', storageErr.code);
        console.error('[Profile] Error message:', storageErr.message);
        console.error('[Profile] Full error:', storageErr);
        
        // Fallback: Save as base64 to Firestore
        usesFallback = true;
        console.log('[Profile] Using base64 fallback...');
        
        const reader = new FileReader();
        const base64 = await new Promise((res, rej) => { 
          reader.onload = () => res(reader.result); 
          reader.onerror = rej; 
          reader.readAsDataURL(file); 
        });
        console.log('[Profile] Base64 conversion complete, size:', base64.length, 'chars');
        
        // Save base64 to Firestore
        console.log('[Profile] Saving base64 to Firestore...');
        await setDoc(
          doc(db, "customers", currentUser.uid), 
          { 
            photoBase64: base64,
            displayName: displayName || null,
            email: currentUser.email,
            updatedAt: serverTimestamp()
          }, 
          { merge: true }
        );
        console.log('[Profile] Base64 Firestore save successful');
        
        // Update UI with base64 image
        [$("#cabinetAvatarBig"), $("#cabinetAvatarBig2")].forEach(el => { 
          if (el) el.innerHTML = `<img src="${esc(base64)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; 
        });
        console.log('[Profile] UI updated with base64 image');
      }
    } else {
      // No file - just update displayName
      console.log('[Profile] No file provided, updating displayName only');
      await setDoc(
        doc(db, "customers", currentUser.uid), 
        { 
          displayName: displayName || null,
          email: currentUser.email,
          updatedAt: serverTimestamp()
        }, 
        { merge: true }
      );
      if (displayName && displayName !== currentUser.displayName) { 
        await updateProfile(currentUser, { displayName }); 
      }
    }
    
    // Reload and sync
    console.log('[Profile] Reloading auth state...');
    try {
      await reload(auth.currentUser);
    } catch (e) {
      console.log('[Profile] Reload warning (non-critical):', e.message);
    }
    
    currentUser = auth.currentUser;
    console.log('[Profile] Current user after reload - UID:', currentUser?.uid, 'Email:', currentUser?.email);
    
    // Ensure customer doc exists in Firestore
    await upsertCustomer(currentUser);
    
    toast("success", "Saqlandi! ✅", "Profil muvaffaqiyatli yangilandi");
    renderUserChip();
    
    // Update avatar display
    const avatarContent = currentUser.photoURL ? 
      `<img src="${esc(currentUser.photoURL)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` :
      (currentUser.displayName || currentUser.email || "U")[0].toUpperCase();
    
    [$("#cabinetAvatarBig"), $("#cabinetAvatarBig2")].forEach(el => {
      if (el) el.innerHTML = avatarContent;
    });
    showCabinetMainList();
  } catch (e) {
    console.error("[Profile] FATAL ERROR in saveCabinet");
    console.error("[Profile] Error code:", e.code);
    console.error("[Profile] Error message:", e.message);
    console.error("[Profile] Full error object:", e);
    toast("error", "Xatolik ❌", "Profil saqlanishda xato: " + (e.message || "Noma'lum xato"));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Profilni saqlash"; }
  }
}

// ===== CART =====
function updateCartBadge() {
  const cart = getCart();
  const n = Math.round(cart.reduce((s, i) => s + Number(i.quantity || 0), 0) * 10) / 10;
  const el = $("#cartCount");
  if (el) el.textContent = n;
  const bn = $("#bnCartCount");
  if (bn) { bn.textContent = n; bn.style.display = n > 0 ? "flex" : "none"; }
}

function addToCart(pid, qty) {
  const p = products.find(x => x.id === pid);
  if (!p) return;
  const unit = p.unit === "kg" ? "kg" : "dona";
  const q = Number(qty || 1);
  if (!isFinite(q) || q <= 0) { toast("warn", "Savat", "Miqdor notogri"); return; }
  const cart = getCart();
  const ix = cart.findIndex(i => i.productId === pid);
  if (ix >= 0) cart[ix].quantity = Number(cart[ix].quantity || 0) + q;
  else cart.push({ productId: pid, name: p.name || "", price: Number(p.price || 0), unit, imageUrl: p.imageUrl || p.image || "", category: p.category || "", quantity: q });
  setCart(cart);
  toast("info", "Savat", `${p.name} qoshildi`);
}

function calcTotal(cart) { return cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0); }

function renderCartDrawer() {
  const wrap = $("#cartItems");
  const totalEl = $("#cartTotal");
  const cart = getCart();
  if (!wrap || !totalEl) return;
  if (!cart.length) { wrap.innerHTML = `<div class="small">Savatcha bosh.</div>`; totalEl.textContent = fmt(0); return; }
  wrap.innerHTML = cart.map((item, idx) => {
    const sum = Number(item.price || 0) * Number(item.quantity || 0);
    return `<div class="cart-item" data-idx="${idx}">
      ${item.imageUrl ? `<img src="${esc(item.imageUrl)}" alt="">` : `<div style="width:56px;height:56px;background:#e2e8f0;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0">&#128722;</div>`}
      <div>
        <div class="name">${esc(item.name)}</div>
        <div class="sub">${esc(String(item.quantity))} ${esc(item.unit)} x ${fmt(item.price)} = <b>${fmt(sum)}</b></div>
        <div class="actions">
          <button class="mini" data-dec>-</button>
          <button class="mini" data-inc>+</button>
          <button class="mini" data-del style="color:#ef4444">O\u02BBchirish</button>
        </div>
      </div>
    </div>`;
  }).join("");
  totalEl.textContent = fmt(calcTotal(cart));
  wrap.onclick = e => {
    const row = e.target.closest(".cart-item");
    if (!row) return;
    const idx = +row.dataset.idx;
    const c = getCart(); const item = c[idx]; if (!item) return;
    const step = item.unit === "kg" ? 0.1 : 1;
    if (e.target.closest("[data-dec]")) { item.quantity = Math.max(step, Number(item.quantity) - step); c[idx] = item; setCart(c); renderCartDrawer(); }
    else if (e.target.closest("[data-inc]")) { item.quantity = Number(item.quantity) + step; c[idx] = item; setCart(c); renderCartDrawer(); }
    else if (e.target.closest("[data-del]")) { c.splice(idx, 1); setCart(c); renderCartDrawer(); }
  };
}

// ===== CHECKOUT =====
function openCheckout() {
  if (!ensureAuth()) return;
  const cart = getCart();
  if (!cart.length) { toast("warn", "Savat", "Savatcha bosh"); return; }
  const emailEl = $("#checkoutEmail");
  if (emailEl) emailEl.value = currentUser.email || "";
  const totalEl = $("#checkoutTotal");
  if (totalEl) totalEl.textContent = fmt(calcTotal(cart));
  const timeEl = $("#checkoutTime");
  if (timeEl) timeEl.value = "";
  // Drawerni yopish
  $("#cartDrawer")?.classList.remove("show");
  $("#overlay")?.classList.remove("show");
  openModal("#checkoutModal");
}

function validatePhone(phone) {
  const p = String(phone).replace(/\D/g, "");
  if (p.length === 12 && p.startsWith("998")) return "+" + p;
  if (p.length === 9 && /^[39]\d{8}$/.test(p)) return "+998" + p;
  return null;
}

async function submitOrder() {
  if (!ensureAuth()) return;
  const cart = getCart();
  if (!cart.length) { toast("warn", "Savat", "Savatcha bosh"); return; }
  const name = ($("#checkoutName")?.value || "").trim();
  const phone = validatePhone($("#checkoutPhone")?.value || "");
  const pickup = $("#checkoutTime")?.value || "";
  if (!name) { toast("error", "Xatolik", "Ism kiriting"); return; }
  if (!phone) { toast("error", "Xatolik", "Telefon +998 formatda kiriting"); return; }
  if (!pickup) { toast("error", "Xatolik", "Olib ketish vaqtini tanlang"); return; }
  const total = calcTotal(cart);
  const order = {
    userUid: currentUser.uid, userEmail: currentUser.email || null,
    userName: name, userPhone: phone,
    customerName: name, customerPhone: phone, phone, name,
    pickupTime: pickup,
    items: cart.map(i => ({ productId: i.productId, name: i.name, price: Number(i.price), quantity: Number(i.quantity), unit: i.unit, category: i.category, imageUrl: i.imageUrl, costPrice: products.find(p => p.id === i.productId)?.costPrice || 0 })),
    total: Number(total), totalPrice: Number(total),
    status: "yangi", payment: "Naqd", createdAt: serverTimestamp(),
  };
  const btn = $("#checkoutSubmit");
  if (btn) { btn.disabled = true; btn.textContent = "Yuborilmoqda..."; }
  try {
    await addDoc(collection(db, "orders"), order);
    toast("success", "Buyurtma", "Qabul qilindi!");
    setCart([]); closeModal("#checkoutModal"); renderCartDrawer();
  } catch (e) {
    toast("error", "Xatolik", e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Tasdiqlash"; }
  }
}

// ===== BOTTOM NAV =====
function setBottomNav(tab) { $$(".bn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab)); }

// ===== WIRE UI =====
function wireUI() {
  // Overlay
  $("#overlay")?.addEventListener("click", () => {
    $("#cartDrawer")?.classList.remove("show");
    $("#favoritesDrawer")?.classList.remove("show");
    $("#overlay")?.classList.remove("show");
  });

  // Cart
  $("#cartBtn")?.addEventListener("click", () => { if (!ensureAuth()) return; renderCartDrawer(); $("#overlay")?.classList.add("show"); $("#cartDrawer")?.classList.add("show"); });
  $("#closeCart")?.addEventListener("click", () => { $("#cartDrawer")?.classList.remove("show"); if (!$("#favoritesDrawer")?.classList.contains("show")) $("#overlay")?.classList.remove("show"); });
  $("#clearCart")?.addEventListener("click", () => { setCart([]); renderCartDrawer(); toast("info", "Savat", "Tozalandi"); });
  $("#checkoutBtn")?.addEventListener("click", openCheckout);
  $("#checkoutClose")?.addEventListener("click", () => closeModal("#checkoutModal"));
  $("#checkoutClose2")?.addEventListener("click", () => closeModal("#checkoutModal"));
  $("#checkoutSubmit")?.addEventListener("click", submitOrder);

  // Favorites
  $("#favoritesOpenBtn")?.addEventListener("click", () => { if (!ensureAuth()) return; renderFavDrawer(); $("#overlay")?.classList.add("show"); $("#favoritesDrawer")?.classList.add("show"); });
  $("#closeFavorites")?.addEventListener("click", () => { $("#favoritesDrawer")?.classList.remove("show"); if (!$("#cartDrawer")?.classList.contains("show")) $("#overlay")?.classList.remove("show"); });

  // Login
  $("#loginHeaderBtn")?.addEventListener("click", openLoginModal);
  $("#loginClose")?.addEventListener("click", () => closeModal("#loginModal"));
  $("#loginScrim")?.addEventListener("click", () => closeModal("#loginModal"));
  $("#loginGoogle")?.addEventListener("click", loginGoogle);
  $("#loginResumeGoogle")?.addEventListener("click", loginGoogle);
  let emailMode = "login";
  $("#tabLogin")?.addEventListener("click", () => { emailMode = "login"; $("#tabLogin")?.classList.add("active"); $("#tabSignup")?.classList.remove("active"); });
  $("#tabSignup")?.addEventListener("click", () => { emailMode = "signup"; $("#tabSignup")?.classList.add("active"); $("#tabLogin")?.classList.remove("active"); });
  $("#emailSubmit")?.addEventListener("click", () => {
    const email = ($("#emailInput")?.value || "").trim();
    const pass = $("#passwordInput")?.value || "";
    if (!email || !pass) { toast("warn", "Kirish", "Email va parol kiriting"); return; }
    loginEmail(email, pass, emailMode);
  });

  // User
  $("#logoutBtn")?.addEventListener("click", logout);
  $("#cabinetBtn")?.addEventListener("click", openCabinet);

  // Cabinet
  $("#cabinetClose")?.addEventListener("click", () => closeModal("#cabinetModal"));
  $("#cabinetSave")?.addEventListener("click", saveCabinet);
  $("#cabinetPhoto")?.addEventListener("change", () => {
    const f = $("#cabinetPhoto")?.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    [$("#cabinetAvatarBig"), $("#cabinetAvatarBig2")].forEach(el => { if (el) el.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; });
  });

  // Catalog
  $("#catalogBtn")?.addEventListener("click", () => { renderCatalogGrid(); openModal("#catalogModal"); });
  $("#catalogClose")?.addEventListener("click", () => closeModal("#catalogModal"));

  // Search
  $("#searchInput")?.addEventListener("input", e => { searchTerm = (e.target.value || "").toLowerCase().trim(); renderGrid(); });

  // Bottom nav
  $$(".bn").forEach(b => {
    b.addEventListener("click", () => {
      const tab = b.dataset.tab;
      setBottomNav(tab);
      if (tab === "home") window.scrollTo({ top: 0, behavior: "smooth" });
      if (tab === "catalog") { renderCatalogGrid(); openModal("#catalogModal"); }
      if (tab === "cart") { if (!ensureAuth()) return; renderCartDrawer(); $("#overlay")?.classList.add("show"); $("#cartDrawer")?.classList.add("show"); }
      if (tab === "fav") { if (!ensureAuth()) return; renderFavDrawer(); $("#overlay")?.classList.add("show"); $("#favoritesDrawer")?.classList.add("show"); }
      if (tab === "kabinet") { if (!currentUser) { openLoginModal(); return; } openCabinet(); }
    });
  });

  // Close modals on backdrop click
  $$(".modal").forEach(m => m.addEventListener("click", e => { if (e.target === m) m.classList.remove("show"); }));
}

// ===== GLOBAL AUDIO UNLOCK (Bypass Autoplay Policy) =====
let audioContextUnlockedCustomer = false;
function unlockAudioContextCustomer() {
  if (audioContextUnlockedCustomer) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        audioContextUnlockedCustomer = true;
        console.log('[Customer] Audio context unlocked');
      });
    } else {
      audioContextUnlockedCustomer = true;
    }
  } catch (e) {
    console.log('[Customer] Audio context unlock error:', e);
  }
}
// Unlock on first user interaction
document.addEventListener('click', unlockAudioContextCustomer, { once: true });
document.addEventListener('keydown', unlockAudioContextCustomer, { once: true });
document.addEventListener('touchstart', unlockAudioContextCustomer, { once: true });

// ===== NOTIFICATIONS & CHAT =====
let allNotifications = [];
let notifUnsub = null;
let supportChatMessages = [];
let supportChatUnsub = null;
let notificationInitialLoad = true;  // Flag to prevent sound on first load
let supportChatInitialLoad = true;   // Flag for support chat messages
let knownNotificationIds = new Set();  // Track notification IDs
let knownChatMessageIds = new Set();   // Track message IDs

async function startNotificationListener(uid) {
  try {
    console.log('[Listener] Starting notification listener for user:', uid);
    if (notifUnsub) notifUnsub();
    notificationInitialLoad = true;
    knownNotificationIds.clear();
    
    notifUnsub = onSnapshot(
      query(collection(db, "notifications"), where("userId", "==", uid), orderBy("createdAt", "desc")),
      snap => {
        // On initial load, just track known IDs - NO SOUND
        if (notificationInitialLoad) {
          knownNotificationIds = new Set(snap.docs.map(d => d.id));
          notificationInitialLoad = false;
          allNotifications = snap.docs.map(d => ({id: d.id, ...d.data()}));
          console.log('[Listener] Initial load:', allNotifications.length, 'notifications');
          updateNotificationBadge();
          console.log("[Listener] Initial load complete, no sound triggered");
          return;
        }
        
        const newNotifications = snap.docs.map(d => ({id: d.id, ...d.data()}));
        console.log('[Listener] Update received with', newNotifications.length, 'total notifications');
        
        // Check for NEW notifications only - ONLY THEN PLAY SOUND
        let hasNewSupportNotif = false;
        let newSupportMessage = null;
        
        newNotifications.forEach(notif => {
          if (!knownNotificationIds.has(notif.id)) {
            knownNotificationIds.add(notif.id);
            console.log("[Listener] NEW notification detected:", notif.id, 'type:', notif.type, 'read:', notif.read);
            // Only play sound for new unread support notifications
            if (notif.type === 'support' && !notif.read) {
              hasNewSupportNotif = true;
              newSupportMessage = notif;
            }
          }
        });
        
        // Play sound ONLY if new unread support notification arrived
        if (hasNewSupportNotif && newSupportMessage) {
          console.log("[Listener] Playing sound for new support notification");
          playSound();
          toast("info", newSupportMessage.title || "🆘 Yangi Javob", newSupportMessage.message);
        }
        
        // Update local state and UI
        allNotifications = newNotifications;
        console.log('[Listener] Updating badge - total:', allNotifications.length);
        updateNotificationBadge();
        
        // If notifications modal is open, re-render
        const notifModal = $("#notificationsModal");
        if (notifModal && notifModal.classList.contains("show")) {
          console.log('[Listener] Notifications modal is open, re-rendering list');
          renderNotificationsList();
        }
      },
      err => console.error("[Listener] Notification listen error:", err)
    );
  } catch (e) { console.error("[Listener] Start notification listener error:", e); }
}

function updateNotificationBadge() {
  // MUAMMO 2 FIX: Count ONLY unread support notifications
  const unreadCount = (allNotifications || []).filter(n => !n.read && n.type === 'support').length;
  const badge = $("#notifBadge");
  
  console.log('[Badge] Updating counter - unread count:', unreadCount, 'total notifications:', allNotifications?.length);
  
  if (unreadCount > 0) {
    if (badge) {
      badge.style.display = "flex";
      badge.textContent = unreadCount;
      console.log('[Badge] Showing badge with count:', unreadCount);
    }
  } else {
    if (badge) {
      badge.style.display = "none";
      console.log('[Badge] Hiding badge - no unread notifications');
    }
  }
}

/**
 * MUAMMO 2 FIX: Mark all unread messages from admin as read
 * This function is called when user opens the notifications panel or chat
 */
async function markMessagesAsRead() {
  if (!currentUser) {
    console.log('[Mark Read] No user logged in');
    return;
  }
  
  try {
    console.log('[Mark Read] Starting to mark messages as read for user:', currentUser.uid);
    
    // Find all unread admin messages
    const messagesSnap = await getDocs(
      query(
        collection(db, "messages"),
        where("customerId", "==", currentUser.uid),
        where("isAdmin", "==", true),
        where("unread", "==", true)
      )
    );
    
    console.log('[Mark Read] Found', messagesSnap.docs.length, 'unread admin messages');
    
    if (messagesSnap.docs.length === 0) {
      console.log('[Mark Read] No unread messages to mark');
      updateNotificationBadge();
      return;
    }
    
    // Batch update all unread messages to read
    const batch = [];
    messagesSnap.docs.forEach(doc => {
      console.log('[Mark Read] Marking message as read:', doc.id);
      batch.push(updateDoc(doc.ref, { unread: false }));
    });
    
    // Execute batch update
    await Promise.all(batch);
    console.log('[Mark Read] Successfully marked', batch.length, 'messages as read');
    
    // Update badge immediately
    updateNotificationBadge();
    
  } catch (e) {
    console.error("[Mark Read] Error marking messages as read:", e);
  }
}

/**
 * Play notification sound (ding ding)
 * Unlocks audio context and generates tone with Web Audio API
 */
function playSound() {
  try {
    // Ensure audio context is unlocked
    unlockAudioContextCustomer();
    
    // Generate tone with Web Audio API
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // First beep: 800Hz
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
    
    // Second beep: 900Hz (after 250ms delay)
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 900;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.4, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.2);
      } catch (e) { console.log("Second beep error:", e); }
    }, 250);
  } catch (e) {
    console.log("Audio play error:", e);
  }
}

/**
 * Alias for playSound for backward compatibility
 */
function playNotificationSound() {
  playSound();
}

function renderNotificationsList() {
  const list = $("#notificationsList");
  if (!list) return;
  
  // Show ONLY UNREAD notifications
  const unreadNotifications = (allNotifications || []).filter(n => !n.read);
  
  if (!unreadNotifications || unreadNotifications.length === 0) {
    list.innerHTML = `<div style="padding:40px 20px;text-align:center;color:#98a2b3">
      <div style="font-size:14px">Bildirishnomalar yo'q</div>
      <div style="font-size:12px;margin-top:8px;opacity:0.7">Yangi xabarlar shu yerda ko'rinadi</div>
    </div>`;
    return;
  }

  let html = `<div style="display:flex;flex-direction:column;gap:10px">`;
  unreadNotifications.forEach(notif => {
    const date = notif.createdAt?.toDate?.() || new Date();
    const timeStr = new Intl.DateTimeFormat("uz", {hour:"2-digit",minute:"2-digit"}).format(date);
    const isUnread = !notif.read;
    const sectionIcon = notif.type === 'support' ? '🆘' : '📢';
    const section = notif.type === 'support' ? 'Qo\'llab-quvvatlash' : 'Xabarlar';
    const isSupport = notif.type === 'support';
    
    html += `<div style="padding:12px;border-left:4px solid ${isUnread ? 'var(--brand)' : '#cbd5e1'};background:${isUnread ? 'rgba(99,102,241,0.12)' : '#f8fafc'};border-radius:6px;cursor:pointer;transition:all 0.2s" onclick="handleNotificationClick('${notif.id}', ${isSupport})">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
        <div style="font-size:20px;flex-shrink:0">${sectionIcon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(notif.title || "Xabar")}</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:6px;line-height:1.4">${esc(notif.message || "")}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;color:#94a3b8">${section}</span>
            <span style="font-size:11px;color:#94a3b8">${timeStr}</span>
          </div>
        </div>
        ${isUnread ? '<div style="width:10px;height:10px;border-radius:50%;background:var(--brand);flex-shrink:0;margin-top:2px"></div>' : ''}
      </div>
    </div>`;
  });
  html += `</div>`;
  list.innerHTML = html;
}

async function handleNotificationClick(id, isSupport) {
  try {
    console.log('[Notification] Clicked notification ID:', id, 'is support:', isSupport);
    
    // Mark notification as read in notifications collection
    await updateDoc(doc(db, "notifications", id), {read: true, unread: false});
    console.log('[Notification] Marked notification as read');
    
    // If it's a support notification, open chat
    if (isSupport && currentUser) {
      console.log('[Chat] Opening support chat for user:', currentUser.uid);
      
      // Mark all unread messages from admin as read using helper function
      await markMessagesAsRead();
      
      closeModal("#notificationsModal");
      startSupportChatListener(currentUser.uid);
      openModal("#supportChatModal");
    }
  } catch (e) { console.log("Handle notification click error:", e); }
}

async function markNotificationRead(id) {
  try {
    await updateDoc(doc(db, "notifications", id), {read: true});
  } catch (e) { console.log("Mark notification error:", e); }
}

function showWelcomeMessage() {
  if (currentUser && currentUser.displayName) {
    toast("success", "Xush kelibsiz! 👋", `${currentUser.displayName}, ELZAFAR MARKET'ga qatnashganingiz uchun rahmat!`);
  }
}

async function startSupportChatListener(uid) {
  try {
    if (supportChatUnsub) supportChatUnsub();
    supportChatInitialLoad = true;
    knownChatMessageIds.clear();
    
    supportChatUnsub = onSnapshot(
      query(collection(db, "messages"), where("customerId", "==", uid), orderBy("createdAt", "asc")),
      snap => {
        const newMessages = snap.docs.map(d => ({id: d.id, ...d.data()}));
        
        // On initial load, just track known IDs - NO SOUND
        if (supportChatInitialLoad) {
          supportChatMessages = newMessages;
          knownChatMessageIds = new Set(snap.docs.map(d => d.id));
          supportChatInitialLoad = false;
          renderSupportChatMessages();
          console.log("[Chat Listener] Initial load complete, loaded", knownChatMessageIds.size, "messages");
          // Auto scroll to bottom on initial load
          setTimeout(() => {
            const container = document.getElementById('supportChatMessages');
            if (container) container.scrollTop = container.scrollHeight;
          }, 100);
          return;
        }
        
        // Check if NEW messages arrived (especially admin replies) - ONLY THEN PLAY SOUND
        let hasNewAdminMessage = false;
        let newAdminMessage = null;
        
        newMessages.forEach(msg => {
          if (!knownChatMessageIds.has(msg.id)) {
            knownChatMessageIds.add(msg.id);
            console.log("[Chat Listener] NEW message detected:", msg.id, "isAdmin:", msg.isAdmin);
            // NEW admin reply detected
            if (msg.isAdmin) {
              hasNewAdminMessage = true;
              newAdminMessage = msg;
            }
          }
        });
        
        // Play sound ONLY if new admin message arrived
        if (hasNewAdminMessage && newAdminMessage) {
          console.log("[Chat Listener] Playing sound for new admin reply");
          playSound();
          toast("info", "🆘 Yangi Javob", newAdminMessage.message?.substring(0, 50) + "...");
        }
        
        supportChatMessages = newMessages;
        renderSupportChatMessages();
        
        // Auto scroll to bottom
        setTimeout(() => {
          const container = document.getElementById('supportChatMessages');
          if (container) container.scrollTop = container.scrollHeight;
        }, 100);
      },
      err => console.log("Support chat listen error:", err)
    );
  } catch (e) { console.log("Start support chat listener error:", e); }
}

function renderSupportChatMessages() {
  const container = $("#supportChatMessages");
  if (!container) return;
  
  let html = ``;
  supportChatMessages.forEach(msg => {
    const isAdmin = msg.isAdmin || false;
    const time = msg.createdAt?.toDate?.() || new Date();
    const timeStr = new Intl.DateTimeFormat("uz", {hour:"2-digit",minute:"2-digit"}).format(time);
    
    if (isAdmin) {
      // Admin reply - right aligned, blue
      html += `<div style="display:flex;justify-content:flex-end;margin-bottom:10px;align-items:flex-end;gap:8px">
        <div style="max-width:70%">
          <div style="background:var(--brand);color:#fff;padding:10px 14px;border-radius:16px;border-bottom-right-radius:4px;word-wrap:break-word">
            <div style="font-weight:600;margin-bottom:4px;font-size:12px;opacity:0.9">🆘 Qo'llab-quvvatlash</div>
            <div style="font-size:13px;line-height:1.4">${esc(msg.message || "")}</div>
            <div style="font-size:11px;opacity:0.8;margin-top:4px;text-align:right">${timeStr}</div>
          </div>
        </div>
      </div>`;
    } else {
      // Customer message - left aligned, gray
      html += `<div style="display:flex;justify-content:flex-start;margin-bottom:10px;align-items:flex-end;gap:8px">
        <div style="max-width:70%">
          <div style="background:#e2e8f0;color:#1e293b;padding:10px 14px;border-radius:16px;border-bottom-left-radius:4px;word-wrap:break-word">
            <div style="font-size:13px;line-height:1.4">${esc(msg.message || "")}</div>
            <div style="font-size:11px;opacity:0.6;margin-top:4px;text-align:left">${timeStr}</div>
          </div>
        </div>
      </div>`;
    }
  });
  
  container.innerHTML = html || `<div style="text-align:center;color:#98a2b3;padding:40px 20px">
    <div style="font-size:14px">Hali xabar yo'q</div>
    <div style="font-size:12px;margin-top:8px;opacity:0.7">Qo'llab-quvvatlash jamoasi sizga yordam berishga tayyor</div>
  </div>`;
  setTimeout(() => { if (container) container.scrollTop = container.scrollHeight; }, 100);
}

async function sendSupportMessage(msg) {
  if (!currentUser || !msg.trim()) return;
  
  try {
    const avatarLetter = (currentUser.displayName || currentUser.email || "U")[0].toUpperCase();
    
    // Prepare message with full customer metadata
    const messageData = {
      customerId: currentUser.uid,
      customerEmail: currentUser.email || '',
      customerName: currentUser.displayName || currentUser.email || "Mehmon",
      customerAvatar: currentUser.photoURL || avatarLetter,
      message: msg.trim(),
      isAdmin: false,
      adminRead: false,
      unread: false,  // ← Customer's own messages are not unread
      createdAt: serverTimestamp()
    };
    
    // Save to Firestore
    await addDoc(collection(db, "messages"), messageData);
    
    // Clear input
    const inp = $("#supportChatInput");
    if (inp) inp.value = "";
    
    // Show toast confirmation
    toast("success", "Xabar yuborildi ✅", "Qo'llab-quvvatlash jamoasi uni ko'radi");
    
  } catch (e) { 
    toast("error", "Xato", "Xabar yuborishda xato yuz berdi: " + e.message);
    console.log("Send support message error:", e); 
  }
}

async function clearChatHistoryCustomer() {
  if (!currentUser) {
    toast("error", "Xato", "Avval tizimga kirishingiz kerak");
    return;
  }
  
  const result = await Swal.fire({
    title: "Chat tarixini tozalash?",
    text: "Bu amalni bekor qilib bo'lmaydi! Barcha xabarlar o'chirib tashlanadi.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Ha, o'chir!",
    cancelButtonText: "Bekor"
  });
  
  if (!result.isConfirmed) return;
  
  try {
    console.log("[Clear History] Clearing chat for customer:", currentUser.uid);
    
    // Get all messages for this customer
    const q = query(
      collection(db, "messages"),
      where("customerId", "==", currentUser.uid)
    );
    const snap = await getDocs(q);
    
    console.log("[Clear History] Found", snap.docs.length, "messages");
    
    // Delete all messages
    if (snap.docs.length > 0) {
      await Promise.all(
        snap.docs.map(doc => deleteDoc(doc.ref))
      );
      console.log("[Clear History] All messages deleted");
    }
    
    // Clear UI
    const msgContainer = $("#supportChatMessages");
    if (msgContainer) {
      msgContainer.innerHTML = '<div style="text-align:center;color:#98a2b3;padding:20px">Chat tarixi tozalandi</div>';
    }
    
    toast("success", "Chat tarixi tozalandi ✅", "Barcha xabarlar o'chirib tashlandi");
    console.log("[Clear History] Chat history cleared successfully");
  } catch (e) {
    console.error("[Clear History] Error:", e);
    toast("error", "Xato", "Chat tarixini tozalashda xato: " + e.message);
  }
}

async function startNewsListener() {
  try {
    const newsEl = $("#cabinetNewsList");
    if (!newsEl) return;
    onSnapshot(
      query(collection(db, "news"), orderBy("createdAt", "desc"), limit(5)),
      snap => {
        if (snap.empty) { newsEl.innerHTML = `<div style="padding:20px;text-align:center;color:#98a2b3">Yangiliklar yo'q</div>`; return; }
        newsEl.innerHTML = snap.docs.map(d => {
          const item = d.data();
          const date = item.createdAt?.toDate?.() || new Date();
          const ds = date.toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
          let media = "";
          if (item.videoUrl) {
            const vid = item.videoUrl.match(/(?:youtu\.be\/|watch\?v=|embed\/)([^#&?]*)/)?.[1];
            if (vid) media = `<div style="margin-top:10px;border-radius:8px;overflow:hidden"><iframe src="https://www.youtube.com/embed/${vid}" allowfullscreen style="width:100%;height:180px;border:none"></iframe></div>`;
          } else if (item.imageUrl) {
            media = `<img src="${esc(item.imageUrl)}" alt="" style="width:100%;border-radius:8px;margin-top:8px">`;
          }
          return `<div class="news-card"><h5>${esc(item.title||"")}</h5>${item.desc?`<p>${esc(item.desc)}</p>`:""}<div class="news-date">${ds}</div>${media}</div>`;
        }).join("");
      },
      () => { newsEl.innerHTML = `<div style="padding:20px;text-align:center;color:#98a2b3">Yuklanishda xatolik</div>`; }
    );
  } catch (e) { console.log("Start news listener error:", e); }
}

function setupModalListeners() {
  // MUAMMO 2 FIX: Notification bell - mark messages as read when opened
  $("#notifBellBtn")?.addEventListener("click", async () => {
    console.log('[Notification Bell] Clicked - marking messages as read');
    await markMessagesAsRead();
    renderNotificationsList();
    openModal("#notificationsModal");
  });
  $("#notificationsClose")?.addEventListener("click", () => closeModal("#notificationsModal"));

  // Support chat
  $("#supportChatBtn")?.addEventListener("click", async () => {
    if (!currentUser) { openLoginModal(); return; }
    
    console.log('[Chat Button] Clicked by user:', currentUser.uid);
    
    // FIRST: Load existing messages immediately
    try {
      console.log('[Chat Button] Loading existing messages...');
      const snap = await getDocs(
        query(collection(db, "messages"), where("customerId", "==", currentUser.uid), orderBy("createdAt", "asc"))
      );
      supportChatMessages = snap.docs.map(d => ({id: d.id, ...d.data()}));
      console.log('[Chat Button] Loaded', supportChatMessages.length, 'messages');
      renderSupportChatMessages();
    } catch (e) {
      console.error("[Chat Button] Load messages error:", e);
    }
    
    // MARK ALL UNREAD ADMIN MESSAGES AS READ
    try {
      console.log('[Chat Button] Finding unread admin messages...');
      const unreadAdminMessages = await getDocs(
        query(
          collection(db, "messages"),
          where("customerId", "==", currentUser.uid),
          where("isAdmin", "==", true),
          where("unread", "==", true)
        )
      );
      
      console.log('[Chat Button] Found', unreadAdminMessages.docs.length, 'unread admin messages');
      if (unreadAdminMessages.docs.length > 0) {
        const batch = [];
        unreadAdminMessages.docs.forEach(doc => {
          batch.push(updateDoc(doc.ref, {unread: false}));
        });
        await Promise.all(batch);
        console.log('[Chat Button] Batch marked', batch.length, 'messages as read');
        // Update badge counter after marking messages as read
        updateNotificationBadge();
        console.log('[Chat Button] Badge counter updated');
      }
    } catch (e) {
      console.error("[Chat Button] Mark messages error:", e);
    }
    
    // SECOND: Start real-time listener
    startSupportChatListener(currentUser.uid);
    
    // THIRD: Open modal
    openModal("#supportChatModal");
    
    // Auto scroll to bottom
    setTimeout(() => {
      const container = document.getElementById('supportChatMessages');
      if (container) container.scrollTop = container.scrollHeight;
    }, 100);
  });
  $("#supportChatClose")?.addEventListener("click", () => closeModal("#supportChatModal"));
  $("#supportChatSend")?.addEventListener("click", () => {
    const msg = $("#supportChatInput")?.value || "";
    if (msg.trim()) sendSupportMessage(msg);
  });
  $("#supportChatInput")?.addEventListener("keypress", e => {
    if (e.key === "Enter") {
      const msg = $("#supportChatInput")?.value || "";
      if (msg.trim()) sendSupportMessage(msg);
    }
  });
}

async function sendOrderConfirmationEmail(order) {
  try {
    if (typeof emailjs === 'undefined') return false;
    emailjs.init('8uiR4RF572SVMNU7J');
    const itemsList = (order.items || []).map(i => `${i.name} x${i.qty} = ${fmt(i.price * i.qty)}`).join(', ');
    
    await emailjs.send('service_7ukfskj', 'template_order_confirm', {
      to_email: currentUser?.email || 'customer@placeholder.com',
      to_name: currentUser?.displayName || 'Mijoz',
      from_name: 'ELZAFAR MARKET',
      order_id: order.id,
      order_date: new Date(order.createdAt?.toDate?.() || Date.now()).toLocaleDateString('uz'),
      order_items: itemsList,
      order_total: fmt(order.total),
      delivery_address: order.address || 'Tez o\'rnatiladi',
      message: `Sizning buyurtmangiz qabul qilindi!`
    });
    
    return true;
  } catch (e) {
    console.log("Order email error:", e);
    return false;
  }
}


function boot() {
  wireUI();
  setupModalListeners();
  renderCarousel();
  restartTimer();
  startCarouselListener();
  startProductsListener();
  startCategoriesListener();
  startNewsListener();

  onAuthStateChanged(auth, async user => {
    currentUser = user || null;
    renderUserChip();
    if (currentUser) {
      if (currentUser.email) localStorage.setItem("bm_last_email", currentUser.email);
      await upsertCustomer(currentUser);
      startFavListener(currentUser.uid);
      startOrdersListener(currentUser.uid);
      startNotificationListener(currentUser.uid);
      closeModal("#loginModal");
      showWelcomeMessage();
      updateCartBadge(); renderGrid(); renderFavDrawer();
    } else {
      if (favUnsub) { favUnsub(); favUnsub = null; }
      if (ordersUnsub) { ordersUnsub(); ordersUnsub = null; }
      if (notifUnsub) { notifUnsub(); notifUnsub = null; }
      if (supportChatUnsub) { supportChatUnsub(); supportChatUnsub = null; }
      favoriteIds = new Set(); myOrders = []; allNotifications = [];
      setCart([]); updateCartBadge(); renderGrid(); renderFavDrawer();
    }
  });
}

document.addEventListener("DOMContentLoaded", boot);