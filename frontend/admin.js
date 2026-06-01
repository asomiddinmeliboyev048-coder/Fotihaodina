// ============ ADMIN PANEL JAVASCRIPT ============
// Baraka Market - Complete Working Admin Panel

// ============ FIREBASE CONFIGURATION ============
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBodbuSlY3MnQFZjbT3jrFAP-jp1V--IXk",
  authDomain: "admin-dashboard-7fde9.firebaseapp.com",
  projectId: "admin-dashboard-7fde9",
  storageBucket: "admin-dashboard-7fde9.firebasestorage.app",
  messagingSenderId: "369558087012",
  appId: "1:369558087012:web:25292540078bd9156fc671",
  measurementId: "G-FLPC387S65"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// Expose to global scope
window.db = db;
window.auth = auth;
window.analytics = analytics;

console.log('✅ Firebase initialized in admin.js');
console.log('🔍 Firebase config:', firebaseConfig);

// ============ GLOBAL STATE ============
let currentAdmin = null;
let debts = [];
let products = [];
let orders = [];
let debtsUnsubscribe = null;

// ============ ADMIN AUTHENTICATION ============
const ADMIN_UID = "rSw8Z19oK4UJ9dWMf1l5YCuEmP82";

function checkAdminLogin() {
  const adminUID = localStorage.getItem('adminUID');
  return adminUID === ADMIN_UID;
}

function setAdminLogin(uid) {
  localStorage.setItem('adminUID', uid);
  currentAdmin = { uid, email: 'admin@barakamarket.uz', role: 'super_admin' };
}

function clearAdminLogin() {
  localStorage.removeItem('adminUID');
  currentAdmin = null;
}

// ============ NAVIGATION ============
function showSection(sectionId) {
  console.log('🔍 Showing section:', sectionId);
  
  // Check if user is authenticated
  const adminUID = localStorage.getItem('adminUID');
  if (adminUID !== 'rSw8Z19oK4UJ9dWMf1l5YCuEmP82') {
    console.log('❌ User not authenticated, redirecting to login');
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) {
      loginOverlay.style.display = 'flex';
    }
    return;
  }
  
  try {
    // Hide all sections with both possible classes
    const allSections = document.querySelectorAll('.section, .content-section');
    allSections.forEach(section => {
      section.style.display = 'none';
      section.classList.remove('active');
    });
    console.log('✅ All sections hidden');
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.style.display = 'block';
      targetSection.classList.add('active');
      
      // Smooth fade-in effect
      targetSection.style.opacity = '0';
      targetSection.style.transform = 'translateY(10px)';
      targetSection.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      
      setTimeout(() => {
        targetSection.style.opacity = '1';
        targetSection.style.transform = 'translateY(0)';
      }, 50);
      
      console.log('✅ Section displayed successfully:', sectionId);
    } else {
      console.error('❌ Section not found:', sectionId);
    }
    
    // Update active menu item
    const allMenuItems = document.querySelectorAll('.menu-item');
    allMenuItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-section') === sectionId) {
        item.classList.add('active');
        console.log('✅ Menu item activated:', sectionId);
      }
    });
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        sidebar.classList.remove('active');
      }
    }
    
    // Load section-specific data
    if (sectionId === 'debts') {
      loadDebts();
    } else if (sectionId === 'products') {
      loadProducts();
    } else if (sectionId === 'orders') {
      loadOrders();
    } else if (sectionId === 'dashboard') {
      loadDashboardData();
    }
    
  } catch (error) {
    console.error('❌ showSection error:', error);
  }
}

// ============ MOBILE SIDEBAR ============
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('active');
  }
}

// ============ DEBTS MANAGEMENT ============
async function loadDebts() {
  try {
    console.log('🔍 Loading debts...');
    const debtsRef = collection(db, 'debts');
    const snapshot = await getDocs(debtsRef);
    
    debts = [];
    snapshot.forEach(doc => {
      debts.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('✅ Debts loaded:', debts.length);
    renderDebts();
  } catch (error) {
    console.error('❌ Load debts error:', error);
    alert('Qarzlarni yuklashda xatolik: ' + error.message);
  }
}

function renderDebts() {
  const container = document.getElementById('debtsList');
  if (!container) return;
  
  if (debts.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-inbox fa-3x mb-3" style="color: #cbd5e1;"></i>
        <p class="text-muted">Hali qarzlar yo'q</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = debts.map(debt => `
    <div class="card mb-3" style="background: ${debt.status === 'unpaid' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}; border-radius: 15px; border-left: 4px solid ${debt.status === 'unpaid' ? '#ef4444' : '#22c55e'};">
      <div class="card-body">
        <div class="row align-items-center">
          <div class="col-md-3">
            <strong>${debt.name}</strong><br>
            <small class="text-muted">${debt.phone}</small>
          </div>
          <div class="col-md-3">
            <span class="badge ${debt.status === 'paid' ? 'bg-success' : 'bg-danger'}" style="font-size: 0.8rem;">
              ${debt.status === 'paid' ? '✅ To\'landi' : '⏰ To\'lanmagan'}
            </span>
          </div>
          <div class="col-md-3">
            <strong style="color: ${debt.status === 'unpaid' ? '#dc2626' : '#059669'};">${debt.amount.toLocaleString()} so'm</strong>
          </div>
          <div class="col-md-3 text-end">
            ${debt.status === 'unpaid' ? `
              <button class="btn btn-sm btn-success" onclick="markAsPaid('${debt.id}')">
                💰 To'landi
              </button>
            ` : `
              <button class="btn btn-sm btn-warning" onclick="markAsUnpaid('${debt.id}')">
                ↩️ Bekor qilish
              </button>
            `}
            <button class="btn btn-sm btn-danger ms-1" onclick="deleteDebt('${debt.id}')">
              🗑️ O'chirish
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

async function addDebt() {
  const name = document.getElementById('debtName').value.trim();
  const phone = document.getElementById('debtPhone').value.trim();
  const amount = parseFloat(document.getElementById('debtAmount').value);
  
  if (!name || !phone || !amount) {
    alert('Barcha maydonlarni to\'ldiring!');
    return;
  }
  
  try {
    console.log('🔍 Adding debt:', { name, phone, amount });
    
    const debt = {
      name,
      phone,
      amount,
      status: 'unpaid',
      createdAt: serverTimestamp(),
      createdBy: currentAdmin?.uid || ADMIN_UID
    };
    
    await addDoc(collection(db, 'debts'), debt);
    console.log('✅ Debt added successfully');
    
    // Clear form
    document.getElementById('debtName').value = '';
    document.getElementById('debtPhone').value = '';
    document.getElementById('debtAmount').value = '';
    
    // Reload debts
    await loadDebts();
    
    alert('Qarz muvaffaqiyatli qo\'shildi!');
  } catch (error) {
    console.error('❌ Add debt error:', error);
    alert('Qarz qo\'shishda xatolik: ' + error.message);
  }
}

async function markAsPaid(debtId) {
  try {
    console.log('🔍 Marking debt as paid:', debtId);
    await updateDoc(doc(db, 'debts', debtId), {
      status: 'paid',
      paidAt: serverTimestamp()
    });
    console.log('✅ Debt marked as paid');
    await loadDebts();
    alert('Qarz to\'landi deb belgilandi!');
  } catch (error) {
    console.error('❌ Mark as paid error:', error);
    alert('Xatolik: ' + error.message);
  }
}

async function markAsUnpaid(debtId) {
  try {
    console.log('🔍 Marking debt as unpaid:', debtId);
    await updateDoc(doc(db, 'debts', debtId), {
      status: 'unpaid',
      paidAt: null
    });
    console.log('✅ Debt marked as unpaid');
    await loadDebts();
    alert('Qarz to\'lanmagan deb belgilandi!');
  } catch (error) {
    console.error('❌ Mark as unpaid error:', error);
    alert('Xatolik: ' + error.message);
  }
}

async function deleteDebt(debtId) {
  if (!confirm('Qarzni o\'chirmoqchimisiz?')) return;
  
  try {
    console.log('🔍 Deleting debt:', debtId);
    await deleteDoc(doc(db, 'debts', debtId));
    console.log('✅ Debt deleted successfully');
    await loadDebts();
    alert('Qarz o\'chirildi!');
  } catch (error) {
    console.error('❌ Delete debt error:', error);
    alert('Xatolik: ' + error.message);
  }
}

async function searchDebts() {
  const searchTerm = document.getElementById('debtSearch').value.trim().toLowerCase();
  
  if (!searchTerm) {
    renderDebts();
    return;
  }
  
  const filteredDebts = debts.filter(debt => 
    debt.name.toLowerCase().includes(searchTerm)
  );
  
  const container = document.getElementById('debtsList');
  if (filteredDebts.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-search fa-3x mb-3" style="color: #cbd5e1;"></i>
        <p class="text-muted">"${searchTerm}" bo'yicha qarzlar topilmadi</p>
      </div>
    `;
    return;
  }
  
  // Render filtered debts
  const originalDebts = debts;
  debts = filteredDebts;
  renderDebts();
  debts = originalDebts;
}

// ============ PRODUCTS MANAGEMENT ============
async function loadProducts() {
  try {
    console.log('🔍 Loading products...');
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
    products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('✅ Products loaded:', products.length);
    renderProducts();
    renderDoughnutChart(['Jan', 'Fev', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 1100000, 1200000]);
  } catch (error) {
    console.error('❌ Load products error:', error);
    alert('Mahsulotlarni yuklashda xatolik: ' + error.message);
  }
}

function renderProducts() {
  const container = document.getElementById('productsList');
  if (!container) return;
  
  if (products.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-box fa-3x mb-3" style="color: #cbd5e1;"></i>
        <p class="text-muted">Hali mahsulotlar yo'q</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = products.map(product => `
    <div class="card mb-3" style="background: rgba(255,255,255,0.9); border-radius: 15px;">
      <div class="card-body">
        <div class="row align-items-center">
          <div class="col-md-2">
            ${product.imageUrl ? `<img src="${product.imageUrl}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 8px;">` : ''}
          </div>
          <div class="col-md-6">
            <strong>${product.name}</strong><br>
            <small class="text-muted">${product.category}</small>
          </div>
          <div class="col-md-2">
            <strong>${product.price.toLocaleString()} so'm</strong>
          </div>
          <div class="col-md-2 text-end">
            <button class="btn btn-sm btn-primary" onclick="editProduct('${product.id}')">Tahrirlash</button>
            <button class="btn btn-sm btn-danger ms-1" onclick="deleteProduct('${product.id}')">O'chirish</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

async function addProduct() {
  const name = document.getElementById('productName').value.trim();
  const price = parseFloat(document.getElementById('productPrice').value);
  const category = document.getElementById('productCategory').value.trim();
  const imageFile = document.getElementById('productImage').files[0];
  
  if (!name || !price || !category) {
    alert('Barcha maydonlarni to\'ldiring!');
    return;
  }
  
  try {
    console.log('🔍 Adding product:', { name, price, category, hasImage: !!imageFile });
    
    let imageUrl = '';
    if (imageFile) {
      imageUrl = await convertImageToBase64(imageFile);
    }
    
    const product = {
      name,
      price,
      category,
      imageUrl,
      createdAt: serverTimestamp()
    };
    
    await addDoc(collection(db, 'products'), product);
    console.log('✅ Product added successfully');
    
    // Clear form
    document.getElementById('productName').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productImage').value = '';
    
    // Reload products
    await loadProducts();
    
    alert('Mahsulot muvaffaqiyatli qo\'shildi!');
  } catch (error) {
    console.error('❌ Add product error:', error);
    alert('Mahsulot qo\'shishda xatolik: ' + error.message);
  }
}

async function convertImageToBase64(file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) throw new Error('Faqat rasm fayl yuklang');
  if (file.size > 2 * 1024 * 1024) throw new Error('Rasm hajmi 2MB dan oshmasin');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Rasmni o\'qishda xatolik'));
    reader.readAsDataURL(file);
  });
}

async function deleteProduct(productId) {
  if (!confirm('Mahsulotni o\'chirmoqchimisiz?')) return;
  
  try {
    console.log('🔍 Deleting product:', productId);
    await deleteDoc(doc(db, 'products', productId));
    console.log('✅ Product deleted successfully');
    await loadProducts();
    alert('Mahsulot o\'chirildi!');
  } catch (error) {
    console.error('❌ Delete product error:', error);
    alert('Xatolik: ' + error.message);
  }
}

function showAddProductForm() {
  const form = document.getElementById('addProductForm');
  if (form) {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }
}

// ============ ORDERS MANAGEMENT ============
async function loadOrders() {
  try {
    console.log('🔍 Loading orders...');
    const ordersRef = collection(db, 'orders');
    const snapshot = await getDocs(ordersRef);
    
    orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('✅ Orders loaded:', orders.length);
    renderOrders();
  } catch (error) {
    console.error('❌ Load orders error:', error);
    alert('Buyurtmalarni yuklashda xatolik: ' + error.message);
  }
}

function renderOrders() {
  const container = document.getElementById('ordersList');
  if (!container) return;
  
  if (orders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-shopping-cart fa-3x mb-3" style="color: #cbd5e1;"></i>
        <p class="text-muted">Hali buyurtmalar yo'q</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = orders.map(order => `
    <div class="card mb-3" style="background: rgba(255,255,255,0.9); border-radius: 15px;">
      <div class="card-body">
        <div class="row align-items-center">
          <div class="col-md-3">
            <strong>${order.customerName || 'Noma\'lum'}</strong><br>
            <small class="text-muted">${order.customerPhone || 'Noma\'lum'}</small>
          </div>
          <div class="col-md-3">
            <span class="badge bg-info">${order.status || 'yangi'}</span>
          </div>
          <div class="col-md-3">
            <strong>${order.total?.toLocaleString() || '0'} so'm</strong>
          </div>
          <div class="col-md-3 text-end">
            <small class="text-muted">${new Date(order.createdAt?.toDate?.() || order.createdAt).toLocaleDateString()}</small>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ============ CLEAR SECTION FUNCTION ============
function clearSection(sectionId) {
  console.log('🔍 Clearing section:', sectionId);
  
  try {
    switch(sectionId) {
      case 'debts':
        // Clear debt form
        const debtName = document.getElementById('debtName');
        const debtPhone = document.getElementById('debtPhone');
        const debtAmount = document.getElementById('debtAmount');
        const debtSearch = document.getElementById('debtSearch');
        if (debtName) debtName.value = '';
        if (debtPhone) debtPhone.value = '';
        if (debtAmount) debtAmount.value = '';
        if (debtSearch) debtSearch.value = '';
        break;
      case 'products':
        // Clear product form
        const productName = document.getElementById('productName');
        const productPrice = document.getElementById('productPrice');
        const productCategory = document.getElementById('productCategory');
        const productImage = document.getElementById('productImage');
        if (productName) productName.value = '';
        if (productPrice) productPrice.value = '';
        if (productCategory) productCategory.value = '';
        if (productImage) productImage.value = '';
        break;
      case 'orders':
        // Clear order search
        const orderSearch = document.getElementById('orderSearch');
        if (orderSearch) orderSearch.value = '';
        break;
    }
    console.log('✅ Section cleared:', sectionId);
  } catch (error) {
    console.error('❌ Clear section error:', error);
  }
}

// ============ LOGIN HANDLER ============
async function handleLogin(email, password) {
  console.log('🔍 Admin login attempt:', { email, password });
  
  // Validate input parameters
  if (!email || !password) {
    console.log('❌ Missing email or password');
    alert('Email va parolni to\'ldiring!');
    return false;
  }
  
  // Check if email is valid string
  if (typeof email !== 'string' || email.trim() === '') {
    console.log('❌ Invalid email format');
    alert('Email noto\'g\'ri formatda!');
    return false;
  }
  
  // Check for super admin UID
  if (email === 'admin@barakamarket.uz' && password === 'admin123') {
    setAdminLogin(ADMIN_UID);
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.display = 'none';
    console.log('✅ Super admin login successful - UID:', ADMIN_UID);
    return true;
  }
  
  // Check Firestore admins collection
  try {
    console.log('🔍 Checking Firestore admins collection...');
    const adminsRef = collection(db, 'admins');
    const q = query(adminsRef, where('email', '==', email.trim()));
    const snapshot = await getDocs(q);
    
    console.log('🔍 Found admins:', snapshot.size);
    
    if (snapshot.empty) {
      alert('Bu admin ro\'yxatida yo\'q!');
      return false;
    }
    
    let isValidAdmin = false;
    let adminData = null;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('🔍 Checking admin data:', { id: doc.id, email: data.email, hasPassword: !!data.password });
      
      // Verify data types
      if (typeof data.email === 'string' && typeof data.password === 'string') {
        if (data.email === email.trim() && data.password === password) {
          isValidAdmin = true;
          adminData = { id: doc.id, uid: doc.id, ...data };
          console.log('✅ Admin credentials matched:', adminData.id);
        }
      }
    });
    
    if (!isValidAdmin) {
      alert('Noto\'g\'ri parol yoki email!');
      return false;
    }
    
    setAdminLogin(adminData.id);
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.display = 'none';
    console.log('✅ Admin login successful - UID:', adminData.id);
    return true;
    
  } catch (error) {
    console.error('❌ Login error:', error);
    alert('Kirishda xatolik: ' + error.message);
    return false;
  }
}

// ============ DASHBOARD DATA ============
async function loadDashboardData() {
  try {
    console.log('🔍 Loading dashboard data...');
    // Dashboard data loading logic here
    console.log('✅ Dashboard data loaded');
  } catch (error) {
    console.error('❌ Dashboard data load error:', error);
  }
}

// ============ INITIALIZATION ============
async function initAdminPanel() {
  console.log('🚀 Initializing admin panel...');
  
  try {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }
    
    // Check if already logged in
    if (checkAdminLogin()) {
      console.log('✅ Already logged in');
      const loginOverlay = document.getElementById('loginOverlay');
      if (loginOverlay) loginOverlay.style.display = 'none';
      currentAdmin = { uid: ADMIN_UID, email: 'admin@barakamarket.uz', role: 'super_admin' };
      
      // Load initial data
      await loadDebts();
      showSection('debts');
      return;
    }
    
    console.log('⏳ Waiting for login...');
    
    // Setup menu event listeners
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = item.getAttribute('data-section');
        if (sectionId) {
          showSection(sectionId);
        }
      });
    });
    
    console.log('✅ Menu event listeners setup complete');
    
  } catch (error) {
    console.error('❌ Init error:', error);
  }
}

// ============ EXPOSE FUNCTIONS TO GLOBAL SCOPE ============
window.showSection = showSection;
window.addDebt = addDebt;
window.markAsPaid = markAsPaid;
window.markAsUnpaid = markAsUnpaid;
window.deleteDebt = deleteDebt;
window.searchDebts = searchDebts;
window.clearSection = clearSection;
window.handleLogin = handleLogin;
window.loadProducts = loadProducts;
window.addProduct = addProduct;
window.deleteProduct = deleteProduct;
window.loadOrders = loadOrders;
window.showAddProductForm = showAddProductForm;
window.toggleSidebar = toggleSidebar;
window.loadDashboardData = loadDashboardData;

// ============ AUTO INIT ============
// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminPanel);
} else {
  initAdminPanel();
}
