// ========================================
// FreshScan GPT — Authentication Logic
// Uses Firebase Compat SDK
// ========================================

// ── State ──
let currentAuthMode = 'signin'; // 'signin' | 'signup'

// ── DOM Ready ──
document.addEventListener('DOMContentLoaded', () => {
  setupAuthListeners();
  checkAuthState();
});

// ── Auth State Observer ──
function checkAuthState() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      // User is signed in — save info and redirect
      const userData = {
        uid: user.uid,
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        photoURL: user.photoURL || null,
        provider: user.providerData[0]?.providerId || 'password'
      };
      localStorage.setItem('freshscan_user', JSON.stringify(userData));

      // Only redirect if we're on the auth page
      if (window.location.pathname.endsWith('index.html') || 
          window.location.pathname === '/' ||
          window.location.pathname.endsWith('/')) {
        window.location.href = 'app.html';
      }
    } else {
      localStorage.removeItem('freshscan_user');
    }
  });
}

// ── Setup Event Listeners ──
function setupAuthListeners() {
  // Toggle between Sign In / Sign Up
  const toggleBtn = document.getElementById('authToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleAuthMode();
    });
  }

  // Auth form submit
  const authForm = document.getElementById('authForm');
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleFormSubmit();
    });
  }

  // Google sign in
  const googleBtn = document.getElementById('googleSignInBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', handleGoogleSignIn);
  }

  // Forgot password
  const forgotBtn = document.getElementById('forgotPasswordBtn');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleForgotPassword();
    });
  }

  // Password visibility toggle
  const togglePwdBtns = document.querySelectorAll('.toggle-password');
  togglePwdBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword 
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    });
  });
}

// ── Toggle Auth Mode ──
function toggleAuthMode() {
  const card = document.getElementById('authCard');
  const title = document.getElementById('authTitle');
  const subtitle = document.getElementById('authSubtitle');
  const submitBtn = document.getElementById('authSubmitBtn');
  const toggleText = document.getElementById('authToggleText');
  const toggleBtn = document.getElementById('authToggle');
  const nameField = document.getElementById('nameFieldGroup');
  const forgotBtn = document.getElementById('forgotPasswordBtn');

  if (currentAuthMode === 'signin') {
    currentAuthMode = 'signup';
    title.textContent = 'Create Account';
    subtitle.textContent = 'Join FreshScan GPT to analyze freshness';
    submitBtn.textContent = 'Create Account';
    toggleText.textContent = 'Already have an account? ';
    toggleBtn.textContent = 'Sign In';
    nameField.style.display = 'block';
    nameField.classList.add('field-enter');
    forgotBtn.style.display = 'none';
  } else {
    currentAuthMode = 'signin';
    title.textContent = 'Welcome Back';
    subtitle.textContent = 'Sign in to continue analyzing freshness';
    submitBtn.textContent = 'Sign In';
    toggleText.textContent = "Don't have an account? ";
    toggleBtn.textContent = 'Sign Up';
    nameField.style.display = 'none';
    nameField.classList.remove('field-enter');
    forgotBtn.style.display = 'inline';
  }

  card.classList.add('card-shake');
  setTimeout(() => card.classList.remove('card-shake'), 300);
  clearErrors();
}

// ── Form Submit ──
function handleFormSubmit() {
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const name = document.getElementById('nameInput')?.value.trim() || '';

  clearErrors();

  // Validation
  if (!email) return showFieldError('emailInput', 'Email is required');
  if (!isValidEmail(email)) return showFieldError('emailInput', 'Enter a valid email');
  if (!password) return showFieldError('passwordInput', 'Password is required');
  if (password.length < 6) return showFieldError('passwordInput', 'Password must be at least 6 characters');
  if (currentAuthMode === 'signup' && !name) return showFieldError('nameInput', 'Name is required');

  setLoading(true);

  if (currentAuthMode === 'signup') {
    handleSignUp(email, password, name);
  } else {
    handleSignIn(email, password);
  }
}

// ── Email/Password Sign Up ──
function handleSignUp(email, password, name) {
  auth.createUserWithEmailAndPassword(email, password)
    .then((result) => {
      // Update display name
      return result.user.updateProfile({ displayName: name });
    })
    .then(() => {
      showToast('Account created successfully! 🎉', 'success');
      // onAuthStateChanged will handle redirect
    })
    .catch((error) => {
      setLoading(false);
      handleAuthError(error);
    });
}

// ── Email/Password Sign In ──
function handleSignIn(email, password) {
  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      showToast('Welcome back! 👋', 'success');
      // onAuthStateChanged will handle redirect
    })
    .catch((error) => {
      setLoading(false);
      handleAuthError(error);
    });
}

// ── Google OAuth ──
function handleGoogleSignIn() {
  setLoading(true);
  
  auth.signInWithPopup(googleProvider)
    .then(() => {
      showToast('Signed in with Google! 🎉', 'success');
      // onAuthStateChanged will handle redirect
    })
    .catch((error) => {
      setLoading(false);
      if (error.code !== 'auth/popup-closed-by-user') {
        handleAuthError(error);
      }
    });
}

// ── Forgot Password ──
function handleForgotPassword() {
  const email = document.getElementById('emailInput').value.trim();
  if (!email) {
    showFieldError('emailInput', 'Enter your email first');
    return;
  }
  if (!isValidEmail(email)) {
    showFieldError('emailInput', 'Enter a valid email');
    return;
  }

  auth.sendPasswordResetEmail(email)
    .then(() => {
      showToast('Password reset email sent! Check your inbox 📧', 'success');
    })
    .catch((error) => {
      handleAuthError(error);
    });
}

// ── Sign Out (called from app.html) ──
function handleSignOut() {
  auth.signOut()
    .then(() => {
      localStorage.removeItem('freshscan_user');
      localStorage.removeItem('freshscan_chats');
      window.location.href = 'index.html';
    })
    .catch((error) => {
      console.error('Sign out error:', error);
      showToast('Error signing out. Try again.', 'error');
    });
}

// ── Error Handling ──
function handleAuthError(error) {
  console.error('Auth error:', error.code, error.message);
  
  const messages = {
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/weak-password': 'Password should be at least 6 characters',
    'auth/invalid-email': 'Invalid email address',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Check your connection',
    'auth/popup-blocked': 'Pop-up was blocked. Allow pop-ups and try again',
    'auth/operation-not-allowed': 'This sign-in method is not enabled'
  };

  const msg = messages[error.code] || `Authentication error: ${error.message}`;
  showToast(msg, 'error');
}

// ── UI Helpers ──
function setLoading(isLoading) {
  const btn = document.getElementById('authSubmitBtn');
  const googleBtn = document.getElementById('googleSignInBtn');
  const spinner = document.getElementById('authSpinner');
  
  if (btn) {
    btn.disabled = isLoading;
    btn.classList.toggle('loading', isLoading);
  }
  if (googleBtn) googleBtn.disabled = isLoading;
  if (spinner) spinner.style.display = isLoading ? 'flex' : 'none';
}

function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  
  const group = field.closest('.form-group');
  if (!group) return;
  
  group.classList.add('has-error');
  let errorEl = group.querySelector('.field-error');
  if (!errorEl) {
    errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    group.appendChild(errorEl);
  }
  errorEl.textContent = message;
}

function clearErrors() {
  document.querySelectorAll('.form-group').forEach(g => {
    g.classList.remove('has-error');
    const err = g.querySelector('.field-error');
    if (err) err.remove();
  });
}

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3200);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
