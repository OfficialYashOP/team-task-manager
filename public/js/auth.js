document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect
  if (API.getToken()) {
    window.location.href = '/dashboard.html';
    return;
  }

  const loginTab = document.getElementById('loginTab');
  const signupTab = document.getElementById('signupTab');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  // Tab switching
  loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
  });

  signupTab.addEventListener('click', () => {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.style.display = 'block';
    loginForm.style.display = 'none';
  });

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const data = await API.login({
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value,
      });

      API.setToken(data.token);
      API.setUser(data.user);
      showToast('Welcome back!', 'success');
      setTimeout(() => window.location.href = '/dashboard.html', 500);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = origText;
    }
  });

  // Signup
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = signupForm.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
      const data = await API.signup({
        name: document.getElementById('signupName').value,
        email: document.getElementById('signupEmail').value,
        password: document.getElementById('signupPassword').value,
      });

      API.setToken(data.token);
      API.setUser(data.user);
      showToast('Account created!', 'success');
      setTimeout(() => window.location.href = '/dashboard.html', 500);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
});
