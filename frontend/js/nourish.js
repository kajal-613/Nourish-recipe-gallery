const API = 'https://nourish-backend-t4w4.onrender.com/api';
let allRecipes = [];
let currentCategory = 'All';
let openRecipe = null;
let baseServings = 1;
let currentServings = 1;
let selectedRating = 0;
const activeTimers = {};
let groceryItems = JSON.parse(localStorage.getItem('groceryItems') || '[]');

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  loadRecipes();
  updateNavAuth();
  updateGroceryUI();
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu-wrap')) closeUserDropdown();
  });
});

// ── AUTH ──
function updateNavAuth() {
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  const email = localStorage.getItem('userEmail') || '';
  const wrap = document.getElementById('userMenuWrap');

  if (token && username) {
    const initial = username.charAt(0).toUpperCase();
    const savedAvatar = localStorage.getItem('userAvatar');
    wrap.innerHTML = `
      <button class="user-logged-btn" onclick="toggleUserDropdown(event)">
        <div class="user-avatar-sm">
          ${savedAvatar
            ? `<img src="${savedAvatar}" alt="avatar">`
            : initial}
        </div>
        ${username}
        <i class="fa-solid fa-chevron-down"
          style="font-size:0.7rem;color:var(--light)"></i>
      </button>
      <div class="user-dropdown" id="userDropdown" style="display:none">
        <div class="user-dropdown-header">
          <div class="user-avatar">
            ${savedAvatar
              ? `<img src="${savedAvatar}" alt="avatar">`
              : initial}
          </div>
          <div>
            <div class="user-dropdown-name">${username}</div>
            <div class="user-dropdown-email">${email}</div>
          </div>
        </div>
        <div class="user-dropdown-divider"></div>
        <button class="user-dropdown-item"
          onclick="openProfile();closeUserDropdown()">
          <i class="fa-regular fa-user"></i> My Profile
        </button>
        <button class="user-dropdown-item"
          onclick="openAddModal();closeUserDropdown()">
          <i class="fa-solid fa-plus"></i> Add Recipe
        </button>
        <div class="user-dropdown-divider"></div>
        <button class="user-dropdown-item logout" onclick="logoutUser()">
          <i class="fa-solid fa-right-from-bracket"></i> Logout
        </button>
      </div>`;
  } else {
    wrap.innerHTML = `
      <button class="btn btn-outline" id="nav-auth" onclick="openAuthModal()">
        <i class="fa-regular fa-user"></i> Login
      </button>`;
  }
}

function toggleUserDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('userDropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function closeUserDropdown() {
  const dd = document.getElementById('userDropdown');
  if (dd) dd.style.display = 'none';
}

function openAuthModal() {
  showLoginForm();
  document.getElementById('authOverlay').classList.add('open');
}

function closeAuthModal() {
  document.getElementById('authOverlay').classList.remove('open');
}

function closeAuthOutside(e) {
  if (e.target === document.getElementById('authOverlay')) closeAuthModal();
}

function showLoginForm() {
  document.getElementById('loginForm').style.display = '';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('authModalTitle').textContent = 'Welcome back';
}

function showRegisterForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = '';
  document.getElementById('authModalTitle').textContent = 'Create account';
}

async function loginUser() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    const res = await fetch(`${API}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      localStorage.setItem('userId', data._id);
      localStorage.setItem('userEmail', email);
      await syncBookmarksFromDB(data.token);
      closeAuthModal();
      updateNavAuth();
      updateStats();
      loadRecipes();
      showToast('Welcome back, ' + data.username + '!');
      if (openRecipe) checkLoginForReview();
    } else {
      showToast('Error: ' + data.message);
    }
  } catch (err) {
    showToast('Login failed. Please try again.');
  }
}

async function syncBookmarksFromDB(token) {
  try {
    const res = await fetch(`${API}/users/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.bookmarks) {
      localStorage.setItem('bookmarks', JSON.stringify(data.bookmarks));
    }
  } catch (err) {
    console.log('Could not sync bookmarks');
  }
}

async function registerUser() {
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  try {
    const res = await fetch(`${API}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      localStorage.setItem('userId', data._id);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('bookmarks', '[]');
      closeAuthModal();
      updateNavAuth();
      updateStats();
      showToast('Welcome to Nourish, ' + data.username + '!');
    } else {
      showToast('Error: ' + data.message);
    }
  } catch (err) {
    showToast('Registration failed. Please try again.');
  }
}

function logoutUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('userId');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('bookmarks');
  localStorage.removeItem('userAvatar');
  localStorage.removeItem('userBio');
  closeUserDropdown();
  updateNavAuth();
  updateStats();
  loadRecipes();
  showGallery();
  showToast('Logged out successfully.');
}

// ── PROFILE ──
async function openProfile() {
  hideAllPages();
  document.getElementById('profilePage').style.display = '';

  const username = localStorage.getItem('username') || 'User';
  const email = localStorage.getItem('userEmail') || '';
  const hasAvatar = localStorage.getItem('userAvatar');
  const initial = username.charAt(0).toUpperCase();
  const token = localStorage.getItem('token');

  // Set avatar
  const avatarEl = document.getElementById('profileAvatarDisplay');
  if (avatarEl) {
    avatarEl.innerHTML = hasAvatar
      ? `<img src="${hasAvatar}" alt="avatar">`
      : initial;
  }

  // Show/hide remove button
  const removeBtn = document.getElementById('removeAvatarBtn');
  if (removeBtn) {
    removeBtn.style.display = hasAvatar ? 'flex' : 'none';
  }

  document.getElementById('profileName').textContent = username;
  document.getElementById('profileEmail').textContent = email;

  try {
    const userId = localStorage.getItem('userId');

    // ── Sync bookmarks from DB first ──
    if (token) {
      const profileRes = await fetch(`${API}/users/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profileData = await profileRes.json();
      if (profileRes.ok && profileData.bookmarks) {
        localStorage.setItem('bookmarks',
          JSON.stringify(profileData.bookmarks));
      }
    }

    // Load all recipes
    const res = await fetch(`${API}/recipes`);
    const recipes = await res.json();

    // ── My Recipes ──
    const myRecipes = recipes.filter(r =>
      r.author?._id === userId || r.author === userId
    );
    document.getElementById('myRecipeCount').textContent = myRecipes.length;
    renderGrid(myRecipes, 'myRecipesGrid');

    // ── My Reviews ──
    const myReviews = [];
    recipes.forEach(recipe => {
      if (recipe.ratings) {
        recipe.ratings.forEach(r => {
          if (r.user?._id === userId || r.user === userId) {
            myReviews.push({
              ...r,
              recipeTitle: recipe.title,
              recipeId: recipe._id
            });
          }
        });
      }
    });

    document.getElementById('myReviewCount').textContent = myReviews.length;

    const reviewsList = document.getElementById('myReviewsList');
    if (!myReviews.length) {
      reviewsList.innerHTML = `<div class="empty-state">
        <i class="fa-regular fa-star"
          style="font-size:2rem;margin-bottom:1rem;color:var(--light)"></i>
        <p>You haven't reviewed any recipes yet.</p>
      </div>`;
    } else {
      reviewsList.innerHTML = myReviews.map(r => `
        <div class="review-card-page" id="profile-review-${r._id}">
          <div style="display:flex;justify-content:space-between;
                      align-items:flex-start;margin-bottom:0.5rem">
            <div class="review-card-recipe">${r.recipeTitle}</div>
            <button onclick="deleteReviewFromProfile(
                '${r.recipeId}','${r._id}')"
              style="background:none;border:1.5px solid var(--border);
                     border-radius:8px;padding:4px 10px;cursor:pointer;
                     color:var(--light);font-size:0.8rem;
                     transition:all 0.2s;display:flex;
                     align-items:center;gap:4px;"
              onmouseover="this.style.color='var(--terracotta)';
                this.style.borderColor='var(--terracotta)'"
              onmouseout="this.style.color='var(--light)';
                this.style.borderColor='var(--border)'">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </div>
          <div class="review-card-stars">
            ${[1,2,3,4,5].map(i =>
              `<i class="fa-${i <= r.rating
                ? 'solid' : 'regular'} fa-star"></i>`
            ).join('')}
          </div>
          <p class="review-card-text">${r.review || 'No written review.'}</p>
          <p class="review-card-date">
            ${r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric'
            }) : ''}
          </p>
        </div>`).join('');
    }

    // ── My Favorites — match against actual DB recipe IDs ──
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    const favRecipes = recipes.filter(r => bookmarks.includes(r._id));

    // Clean up stale bookmark IDs
    const validBookmarks = favRecipes.map(r => r._id);
    localStorage.setItem('bookmarks', JSON.stringify(validBookmarks));

    // Update counts
    document.getElementById('myFavCount').textContent = favRecipes.length;
    updateStats();

    renderGrid(favRecipes, 'myFavoritesGrid');

  } catch (err) {
    showToast('Error loading profile data.');
  }
}

function changeAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 300;
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      } else {
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.8);
      localStorage.setItem('userAvatar', compressed);

      const avatarEl = document.getElementById('profileAvatarDisplay');
      if (avatarEl) avatarEl.innerHTML =
        `<img src="${compressed}" alt="avatar">`;

      const removeBtn = document.getElementById('removeAvatarBtn');
      if (removeBtn) removeBtn.style.display = 'flex';

      updateNavAuth();
      showToast('Profile picture updated!');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeAvatar() {
  if (!confirm('Remove your profile picture?')) return;
  localStorage.removeItem('userAvatar');

  const username = localStorage.getItem('username') || 'User';
  const initial = username.charAt(0).toUpperCase();
  const avatarEl = document.getElementById('profileAvatarDisplay');
  if (avatarEl) avatarEl.innerHTML = initial;

  const removeBtn = document.getElementById('removeAvatarBtn');
  if (removeBtn) removeBtn.style.display = 'none';

  updateNavAuth();
  showToast('Profile picture removed.');
}

function switchProfileTab(tab, el) {
  document.querySelectorAll('.profile-tab').forEach(t =>
    t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-myRecipes').style.display =
    tab === 'myRecipes' ? '' : 'none';
  document.getElementById('tab-myReviews').style.display =
    tab === 'myReviews' ? '' : 'none';
  document.getElementById('tab-myFavorites').style.display =
    tab === 'myFavorites' ? '' : 'none';
}

function openEditProfile() {
  document.getElementById('edit-username').value =
    localStorage.getItem('username') || '';
  document.getElementById('edit-bio').value =
    localStorage.getItem('userBio') || '';
  document.getElementById('editProfileOverlay').classList.add('open');
}

function closeEditProfile() {
  document.getElementById('editProfileOverlay').classList.remove('open');
}

function closeEditProfileOutside(e) {
  if (e.target === document.getElementById('editProfileOverlay'))
    closeEditProfile();
}

function saveProfile() {
  const newUsername = document.getElementById('edit-username').value.trim();
  const newBio = document.getElementById('edit-bio').value.trim();
  if (!newUsername) { showToast('Username cannot be empty.'); return; }
  localStorage.setItem('username', newUsername);
  localStorage.setItem('userBio', newBio);
  closeEditProfile();
  updateNavAuth();
  openProfile();
  showToast('Profile updated successfully!');
}

// ── PAGES ──
function hideAllPages() {
  document.getElementById('galleryPage').style.display = 'none';
  document.getElementById('favoritesPage').style.display = 'none';
  document.getElementById('profilePage').style.display = 'none';
}

function showGallery() {
  hideAllPages();
  document.getElementById('galleryPage').style.display = '';
}

function showFavorites() {
  const token = localStorage.getItem('token');
  if (!token) {
    openAuthModal();
    showToast('Please login to view your favorites.');
    return;
  }
  hideAllPages();
  document.getElementById('favoritesPage').style.display = '';
  const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
  const favs = allRecipes.filter(r => bookmarks.includes(r._id));
  renderGrid(favs, 'favGrid');
}

// ── LOAD RECIPES ──
async function loadRecipes(params = '') {
  const grid = document.getElementById('recipeGrid');
  if (!grid) return;
  grid.innerHTML = `<div class="empty-state">
    <i class="fa-solid fa-spinner fa-spin"
      style="font-size:2rem;margin-bottom:1rem;color:var(--sage)"></i>
    <p>Loading recipes...</p>
  </div>`;
  try {
    const res = await fetch(`${API}/recipes?${params}`);
    allRecipes = await res.json();
    renderGrid(allRecipes, 'recipeGrid');
    updateStats();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-circle-exclamation"
        style="font-size:2rem;margin-bottom:1rem;color:var(--terracotta)"></i>
      <p>Could not load recipes. Please try again.</p>
    </div>`;
  }
}

function renderGrid(recipes, containerId) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const bookmarks = token
    ? JSON.parse(localStorage.getItem('bookmarks') || '[]')
    : [];

  if (!recipes.length) {
    grid.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-magnifying-glass"
        style="font-size:2rem;margin-bottom:1rem;color:var(--light)"></i>
      <p>No recipes found.</p>
    </div>`;
    return;
  }

  grid.innerHTML = recipes.map(r => {
    const avg = Math.round(r.averageRating || 0);
    const total = (r.prepTime || 0) + (r.cookTime || 0);
    const isBookmarked = bookmarks.includes(r._id);
    const isOwner = token && userId &&
      (r.author?._id === userId || r.author === userId);
    return `
      <div class="recipe-card" onclick="openDetail('${r._id}')">
        <div class="card-img-wrap">
          <img class="card-img"
            src="${r.image ||
              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'}"
            alt="${r.title}"
            onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'">
          <span class="card-badge">${r.category}</span>
          <button class="fav-btn ${isBookmarked ? 'bookmarked' : ''}"
            onclick="event.stopPropagation();quickBookmark('${r._id}',this)">
            <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-heart"></i>
          </button>
          ${isOwner ? `
            <button class="delete-btn"
              onclick="event.stopPropagation();
                deleteRecipe('${r._id}', this)">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>
        <div class="card-body">
          <div class="card-title">${r.title}</div>
          <div class="card-meta">
            <span><i class="fa-regular fa-clock"></i> ${total} min</span>
            <span><i class="fa-solid fa-users"></i>
              ${r.servings} servings</span>
          </div>
          <div class="card-stars">
            ${[1,2,3,4,5].map(i =>
              `<span class="star ${i <= avg ? 'filled' : ''}">
                <i class="fa-${i <= avg
                  ? 'solid' : 'regular'} fa-star"></i>
              </span>`
            ).join('')}
          </div>
        </div>
      </div>`;
  }).join('');
}

function updateStats() {
  const totalEl = document.getElementById('totalCount');
  const favEl = document.getElementById('favCount');
  const cuisineEl = document.getElementById('cuisineCount');
  if (totalEl) totalEl.textContent = allRecipes.length;
  const token = localStorage.getItem('token');
  const bookmarks = token
    ? JSON.parse(localStorage.getItem('bookmarks') || '[]')
    : [];
  if (favEl) favEl.textContent = bookmarks.length;
  const cuisines = [...new Set(allRecipes.map(r => r.cuisine))].length;
  if (cuisineEl) cuisineEl.textContent = cuisines;
}

// ── FILTERS ──
function setCategory(cat, el) {
  currentCategory = cat;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  const st = document.getElementById('sectionTitle');
  if (st) st.textContent =
    cat === 'All' ? 'All Recipes' : cat + ' Recipes';
  filterRecipes();
}

function filterRecipes() {
  const search = document.getElementById('searchInput')?.value || '';
  const cuisine = document.getElementById('filter-cuisine')?.value || '';
  const difficulty =
    document.getElementById('filter-difficulty')?.value || '';
  let params = '';
  if (search) params += `search=${search}&`;
  if (cuisine) params += `cuisine=${cuisine}&`;
  if (currentCategory !== 'All') params += `category=${currentCategory}&`;
  if (difficulty) params += `difficulty=${difficulty}&`;
  loadRecipes(params);
}

// ── DETAIL MODAL ──
async function openDetail(id) {
  try {
    const res = await fetch(`${API}/recipes/${id}`);
    openRecipe = await res.json();
    baseServings = openRecipe.servings;
    currentServings = openRecipe.servings;
    renderDetail();
    document.getElementById('detailOverlay').classList.add('open');
  } catch (err) {
    showToast('Could not load recipe. Please try again.');
  }
}

function renderDetail() {
  const r = openRecipe;
  const token = localStorage.getItem('token');
  const bookmarks = token
    ? JSON.parse(localStorage.getItem('bookmarks') || '[]')
    : [];
  const isBookmarked = bookmarks.includes(r._id);

  document.getElementById('modalImg').src = r.image ||
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800';
  document.getElementById('modalTitle').textContent = r.title;
  document.getElementById('modalFavBtn').innerHTML =
    `<i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-heart"
      style="color:${isBookmarked
        ? 'var(--terracotta)' : 'var(--light)'}"></i>`;

  document.getElementById('modalMeta').innerHTML = `
    <span><i class="fa-solid fa-earth-asia"></i> ${r.cuisine}</span>
    <span><i class="fa-solid fa-utensils"></i> ${r.category}</span>
    <span><i class="fa-regular fa-clock"></i> Prep: ${r.prepTime}m</span>
    <span><i class="fa-solid fa-fire-flame-curved"></i>
      Cook: ${r.cookTime}m</span>
    <span><i class="fa-solid fa-gauge-high"></i> ${r.difficulty}</span>
    <span><i class="fa-solid fa-star"></i>
      ${(r.averageRating || 0).toFixed(1)}/5
      (${r.ratings?.length || 0})</span>
    <span><i class="fa-solid fa-user-tie"></i>
      ${r.author?.username || 'Chef'}</span>
  `;

  document.getElementById('servingCount').textContent = currentServings;

  document.querySelectorAll('.recipe-tab').forEach(t =>
    t.classList.remove('active'));
  document.querySelector('.recipe-tab').classList.add('active');
  document.getElementById('panel-ingredients').style.display = '';
  document.getElementById('panel-instructions').style.display = 'none';
  document.getElementById('panel-reviews').style.display = 'none';

  renderIngredients();
  renderSteps();
  renderReviews();
  checkLoginForReview();
}

function switchRecipeTab(tab, el) {
  document.querySelectorAll('.recipe-tab').forEach(t =>
    t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('panel-ingredients').style.display =
    tab === 'ingredients' ? '' : 'none';
  document.getElementById('panel-instructions').style.display =
    tab === 'instructions' ? '' : 'none';
  document.getElementById('panel-reviews').style.display =
    tab === 'reviews' ? '' : 'none';
}

function renderIngredients() {
  const ratio = currentServings / baseServings;
  document.getElementById('modalIngredients').innerHTML =
    openRecipe.ingredients.map(ing => {
      const qty = scaleQty(ing.quantity, ratio);
      return `<li>
        <span>${ing.name}</span>
        <span class="ing-qty">${qty}</span>
      </li>`;
    }).join('');
}

function scaleQty(qty, ratio) {
  const match = qty.match(/^(\d+\.?\d*)\s*(.*)/);
  if (match) {
    const scaled = parseFloat(
      (parseFloat(match[1]) * ratio).toFixed(1));
    return `${scaled % 1 === 0
      ? parseInt(scaled) : scaled} ${match[2]}`;
  }
  return qty;
}

function changeServings(change) {
  if (currentServings + change < 1) return;
  currentServings += change;
  document.getElementById('servingCount').textContent = currentServings;
  renderIngredients();
}

function renderSteps() {
  document.getElementById('modalSteps').innerHTML =
    openRecipe.instructions.map((inst, i) => {
      const timerKey = `${openRecipe._id}_step${i}`;
      const hasTimer = inst.timer && inst.timer > 0;
      const isRunning = activeTimers[timerKey] &&
        !activeTimers[timerKey].done;
      return `
        <li class="step-item" id="step-item-${i}"
          onclick="toggleStep(${i})">
          <div class="step-checkbox" id="step-check-${i}">
            <i class="fa-solid fa-check"
              style="font-size:0.65rem;display:none"
              id="step-check-icon-${i}"></i>
          </div>
          <div class="step-num-badge">${inst.step || i + 1}</div>
          <div class="step-content">
            <p class="step-text" id="step-text-${i}">
              ${inst.description}
            </p>
            ${hasTimer ? `
              <button class="timer-btn ${isRunning ? 'running' : ''}"
                id="timer-btn-${i}"
                onclick="event.stopPropagation();
                  startTimer('${timerKey}', ${inst.timer}, ${i},
                  '${openRecipe.title} — Step ${inst.step || i + 1}')">
                <i class="fa-regular fa-clock"></i>
                ${isRunning
                  ? 'Stop timer'
                  : `Start ${inst.timer} min timer`}
              </button>
              <span class="timer-countdown"
                id="inline-timer-${i}"></span>
            ` : ''}
          </div>
        </li>`;
    }).join('');

  openRecipe.instructions.forEach((inst, i) => {
    const timerKey = `${openRecipe._id}_step${i}`;
    if (activeTimers[timerKey] && !activeTimers[timerKey].done) {
      const display = document.getElementById(`inline-timer-${i}`);
      if (display) activeTimers[timerKey].inlineDisplay = display;
    }
  });
}

function toggleStep(i) {
  const item = document.getElementById(`step-item-${i}`);
  const checkbox = document.getElementById(`step-check-${i}`);
  const icon = document.getElementById(`step-check-icon-${i}`);
  const isCompleted = item.classList.contains('completed');
  item.classList.toggle('completed', !isCompleted);
  checkbox.style.background = !isCompleted ? 'var(--sage-dark)' : 'white';
  checkbox.style.borderColor = !isCompleted
    ? 'var(--sage-dark)' : 'var(--border)';
  icon.style.display = !isCompleted ? 'block' : 'none';
}

// ── TIMER ──
function startTimer(timerKey, mins, stepIdx, label) {
  if (activeTimers[timerKey] && activeTimers[timerKey].interval) {
    clearInterval(activeTimers[timerKey].interval);
    delete activeTimers[timerKey];
    const btn = document.getElementById(`timer-btn-${stepIdx}`);
    if (btn) {
      btn.innerHTML =
        `<i class="fa-regular fa-clock"></i> Start ${mins} min timer`;
      btn.classList.remove('running');
    }
    const display = document.getElementById(`inline-timer-${stepIdx}`);
    if (display) display.textContent = '';
    updateTimerWidget();
    return;
  }

  let secs = mins * 60;
  const btn = document.getElementById(`timer-btn-${stepIdx}`);
  if (btn) {
    btn.classList.add('running');
    btn.innerHTML = `<i class="fa-regular fa-clock"></i> Stop timer`;
  }

  activeTimers[timerKey] = { label, secs, done: false, interval: null };

  activeTimers[timerKey].interval = setInterval(() => {
    secs--;
    activeTimers[timerKey].secs = secs;
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    const timeStr = `${m}:${s}`;
    const inline = document.getElementById(`inline-timer-${stepIdx}`);
    if (inline) {
      inline.textContent = timeStr;
      inline.className =
        `timer-countdown${secs <= 30 ? ' urgent' : ''}`;
    }
    updateTimerWidget();
    if (secs <= 0) {
      clearInterval(activeTimers[timerKey].interval);
      activeTimers[timerKey].done = true;
      activeTimers[timerKey].secs = 0;
      if (inline) inline.textContent = 'Done!';
      const b = document.getElementById(`timer-btn-${stepIdx}`);
      if (b) {
        b.classList.remove('running');
        b.innerHTML =
          `<i class="fa-regular fa-clock"></i> Start ${mins} min timer`;
      }
      playAlarm();
      showToast(label + ' — timer done!');
      updateTimerWidget();
      setTimeout(() => {
        delete activeTimers[timerKey];
        updateTimerWidget();
      }, 5000);
    }
  }, 1000);

  updateTimerWidget();
  showToast('Timer started: ' + label);
}

function updateTimerWidget() {
  const widget = document.getElementById('timerWidget');
  const body = document.getElementById('timerWidgetBody');
  if (!widget || !body) return;
  const keys = Object.keys(activeTimers);
  if (!keys.length) { widget.style.display = 'none'; return; }
  widget.style.display = 'block';
  body.innerHTML = keys.map(key => {
    const t = activeTimers[key];
    const m = String(Math.floor(t.secs / 60)).padStart(2, '0');
    const s = String(t.secs % 60).padStart(2, '0');
    const timeStr = t.done ? 'Done!' : `${m}:${s}`;
    const cls = t.done ? 'done' : (t.secs <= 30 ? 'urgent' : '');
    return `<div class="timer-widget-item">
      <span class="tw-label">${t.label}</span>
      <span class="tw-time ${cls}">${timeStr}</span>
    </div>`;
  }).join('');
}

function closeTimerWidget() {
  Object.keys(activeTimers).forEach(key => {
    clearInterval(activeTimers[key].interval);
    delete activeTimers[key];
  });
  const widget = document.getElementById('timerWidget');
  if (widget) widget.style.display = 'none';
}

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.4);
      gain.gain.exponentialRampToValueAtTime(
        0.001, ctx.currentTime + i * 0.4 + 0.3);
      osc.start(ctx.currentTime + i * 0.4);
      osc.stop(ctx.currentTime + i * 0.4 + 0.3);
    }
  } catch (e) {}
}

// ── REVIEWS ──
function renderReviews() {
  const container = document.getElementById('modalReviews');
  if (!openRecipe.ratings || !openRecipe.ratings.length) {
    container.innerHTML =
      '<p style="color:var(--light);font-size:0.88rem;padding:0.5rem 0">' +
      'No reviews yet. Be the first!</p>';
    return;
  }
  const userId = localStorage.getItem('userId');
  container.innerHTML = openRecipe.ratings.map(r => {
    const isMyReview = userId &&
      (r.user?._id === userId || r.user === userId);
    return `
      <div class="review-item" id="review-${r._id}">
        <div class="review-header">
          <span class="review-author">
            ${r.user?.username || 'User'}
          </span>
          <div style="display:flex;align-items:center;gap:0.8rem">
            <span class="review-stars">
              ${[1,2,3,4,5].map(i =>
                `<i class="fa-${i <= r.rating
                  ? 'solid' : 'regular'} fa-star"></i>`
              ).join('')}
            </span>
            ${isMyReview ? `
              <button
                onclick="deleteReview('${openRecipe._id}','${r._id}')"
                style="background:none;border:none;cursor:pointer;
                       color:var(--light);font-size:0.8rem;
                       transition:color 0.2s;padding:2px 4px;"
                onmouseover="this.style.color='var(--terracotta)'"
                onmouseout="this.style.color='var(--light)'"
                title="Delete review">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
        <p class="review-text">${r.review || ''}</p>
      </div>`;
  }).join('');
}

async function deleteReview(recipeId, reviewId) {
  if (!confirm('Delete your review?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(
      `${API}/recipes/${recipeId}/review/${reviewId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    if (res.ok) {
      showToast('Review deleted.');
      await openDetail(recipeId);
    } else {
      const data = await res.json();
      showToast('Error: ' + data.message);
    }
  } catch (err) {
    showToast('Error deleting review.');
  }
}

async function deleteReviewFromProfile(recipeId, reviewId) {
  if (!confirm('Delete your review?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(
      `${API}/recipes/${recipeId}/review/${reviewId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    if (res.ok) {
      showToast('Review deleted.');
      const el = document.getElementById(`profile-review-${reviewId}`);
      if (el) el.remove();
      const countEl = document.getElementById('myReviewCount');
      if (countEl) countEl.textContent =
        Math.max(0, parseInt(countEl.textContent) - 1);
    } else {
      const data = await res.json();
      showToast('Error: ' + data.message);
    }
  } catch (err) {
    showToast('Error deleting review.');
  }
}

function checkLoginForReview() {
  const token = localStorage.getItem('token');
  const wrap = document.getElementById('reviewFormWrap');
  const login = document.getElementById('loginToReview');
  if (wrap) wrap.style.display = token ? '' : 'none';
  if (login) login.style.display = token ? 'none' : '';
}

function setRating(r) {
  selectedRating = r;
  document.querySelectorAll('#starSelect span').forEach((s, i) => {
    s.classList.toggle('active', i < r);
  });
}

async function submitReview() {
  if (!selectedRating) {
    showToast('Please select a star rating.'); return;
  }
  const review = document.getElementById('reviewText').value;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API}/recipes/${openRecipe._id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rating: selectedRating, review })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Review submitted successfully!');
      document.getElementById('reviewText').value = '';
      selectedRating = 0;
      document.querySelectorAll('#starSelect span').forEach(s =>
        s.classList.remove('active'));
      await openDetail(openRecipe._id);
    } else {
      showToast('Error: ' + data.message);
    }
  } catch (err) {
    showToast('Error submitting review.');
  }
}

function closeDetailModal() {
  document.getElementById('detailOverlay').classList.remove('open');
  openRecipe = null;
  selectedRating = 0;
  const reviewText = document.getElementById('reviewText');
  if (reviewText) reviewText.value = '';
  document.querySelectorAll('#starSelect span').forEach(s =>
    s.classList.remove('active'));
}

function closeDetailOutside(e) {
  if (e.target === document.getElementById('detailOverlay'))
    closeDetailModal();
}

// ── BOOKMARK ──
function quickBookmark(id, btn) {
  const token = localStorage.getItem('token');
  if (!token) {
    openAuthModal();
    showToast('Please login to save favorites.');
    return;
  }
  const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
  if (bookmarks.includes(id)) {
    localStorage.setItem('bookmarks',
      JSON.stringify(bookmarks.filter(b => b !== id)));
    btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    btn.classList.remove('bookmarked');
    showToast('Removed from favorites.');
  } else {
    bookmarks.push(id);
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
    btn.classList.add('bookmarked');
    showToast('Saved to favorites!');
  }
  updateStats();
  fetch(`${API}/users/bookmark/${id}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
}

function toggleFavModal() {
  if (!openRecipe) return;
  const btn = document.getElementById('modalFavBtn');
  quickBookmark(openRecipe._id, btn);
}

// ── ADD RECIPE ──
function openAddModal() {
  const token = localStorage.getItem('token');
  if (!token) {
    openAuthModal();
    showToast('Please login to add recipes.');
    return;
  }
  document.getElementById('addOverlay').classList.add('open');
}

function closeAddModal() {
  document.getElementById('addOverlay').classList.remove('open');
}

function closeAddOutside(e) {
  if (e.target === document.getElementById('addOverlay')) closeAddModal();
}

function handleRecipeImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 600;
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      } else {
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.7);
      localStorage.setItem('pendingRecipeImage', compressed);
      const preview = document.getElementById('imgPreview');
      if (preview) {
        preview.src = compressed;
        preview.style.display = 'block';
      }
      const label = document.getElementById('imgLabel');
      if (label) label.innerHTML =
        '<i class="fa-solid fa-check"></i> Photo added';
      showToast('Image ready!');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function submitRecipe() {
  const name = document.getElementById('f_name').value.trim();
  const cuisine = document.getElementById('f_cuisine').value;
  const cat = document.getElementById('f_cat').value;
  const prep = parseInt(document.getElementById('f_prep').value) || 0;
  const cook = parseInt(document.getElementById('f_cook').value) || 0;
  const servings =
    parseInt(document.getElementById('f_servings').value) || 2;
  const difficulty = document.getElementById('f_difficulty').value;
  const desc = document.getElementById('f_desc').value.trim();
  const ingRaw = document.getElementById('f_ingredients').value.trim();
  const stepsRaw = document.getElementById('f_steps').value.trim();

  if (!name || !ingRaw || !stepsRaw) {
    showToast('Please fill in all required fields.'); return;
  }

  const ingredients = ingRaw.split('\n').map(line => {
    const parts = line.split('|');
    return {
      name: parts[0]?.trim(),
      quantity: parts[1]?.trim() || 'to taste'
    };
  }).filter(i => i.name);

  const instructions = stepsRaw.split('\n').map((line, i) => {
    const parts = line.split('|');
    return {
      step: i + 1,
      description: parts[0]?.trim(),
      timer: parseInt(parts[1]) || 0
    };
  }).filter(s => s.description);

  const imageData = localStorage.getItem('pendingRecipeImage') || '';
  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API}/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: name, description: desc, cuisine,
        category: cat, prepTime: prep, cookTime: cook,
        servings, difficulty, ingredients, instructions,
        image: imageData
      })
    });
    const data = await res.json();
    if (res.ok) {
      closeAddModal();
      localStorage.removeItem('pendingRecipeImage');
      loadRecipes();
      showToast(`"${name}" added successfully!`);
      ['f_name','f_prep','f_cook','f_servings',
       'f_desc','f_ingredients','f_steps'].forEach(id => {
        document.getElementById(id).value = '';
      });
      const preview = document.getElementById('imgPreview');
      if (preview) { preview.src = ''; preview.style.display = 'none'; }
      const label = document.getElementById('imgLabel');
      if (label) label.innerHTML =
        '<i class="fa-solid fa-camera"></i> Add Photo';
    } else {
      showToast('Error: ' + data.message);
    }
  } catch (err) {
    showToast('Error adding recipe. Please try again.');
  }
}

async function deleteRecipe(id, btn) {
  if (!confirm('Are you sure you want to delete this recipe?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API}/recipes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      showToast('Recipe deleted successfully.');
      btn.closest('.recipe-card').remove();
      loadRecipes();
      const profilePage = document.getElementById('profilePage');
      if (profilePage && profilePage.style.display !== 'none') {
        openProfile();
      }
    } else {
      const data = await res.json();
      showToast('Error: ' + data.message);
    }
  } catch (err) {
    showToast('Error deleting recipe.');
  }
}

// ── GROCERY ──
function addToGrocery() {
  if (!openRecipe) return;
  let added = 0;
  openRecipe.ingredients.forEach(ing => {
    const text = `${ing.name} — ${ing.quantity}`;
    if (!groceryItems.find(g => g.text === text)) {
      groceryItems.push({ text, checked: false });
      added++;
    }
  });
  localStorage.setItem('groceryItems', JSON.stringify(groceryItems));
  updateGroceryUI();
  showToast(added > 0
    ? `Added ${added} ingredients to grocery list.`
    : 'Already in list.');
}

function updateGroceryUI() {
  const body = document.getElementById('groceryBody');
  if (!body) return;
  if (!groceryItems.length) {
    body.innerHTML = `<div style="text-align:center;padding:2rem 0;
      color:var(--light)">
      <i class="fa-solid fa-basket-shopping"
        style="font-size:2rem;margin-bottom:0.8rem;display:block"></i>
      <p style="font-size:0.9rem">No items yet.<br>
        Open a recipe and add its ingredients.</p>
    </div>`;
    return;
  }
  body.innerHTML = groceryItems.map((g, i) => `
    <div class="grocery-item ${g.checked ? 'checked' : ''}">
      <input type="checkbox" ${g.checked ? 'checked' : ''}
        onchange="toggleGroceryItem(${i})">
      <span>${g.text}</span>
    </div>`).join('');
}

function toggleGroceryItem(i) {
  groceryItems[i].checked = !groceryItems[i].checked;
  localStorage.setItem('groceryItems', JSON.stringify(groceryItems));
  updateGroceryUI();
}

function clearGrocery() {
  groceryItems = [];
  localStorage.setItem('groceryItems', JSON.stringify(groceryItems));
  updateGroceryUI();
  showToast('Grocery list cleared.');
}

function openGrocery() {
  document.getElementById('groceryPanel').classList.add('open');
  document.getElementById('groceryBackdrop').classList.add('open');
}

function closeGrocery() {
  document.getElementById('groceryPanel').classList.remove('open');
  document.getElementById('groceryBackdrop').classList.remove('open');
}

// ── TOAST ──
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}