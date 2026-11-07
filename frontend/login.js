/* ── Floating Dots ── */
    (function spawnDots() {
      const canvas = document.getElementById('dotsCanvas');
      const count = 28;
      for (let i = 0; i < count; i++) {
        const d = document.createElement('div');
        d.className = 'dot';
        const size = Math.random() * 3 + 1.5;
        d.style.cssText = `
          width: ${size}px; height: ${size}px;
          left: ${Math.random() * 100}%;
          bottom: ${Math.random() * -20}%;
          opacity: 0;
          animation-duration: ${Math.random() * 14 + 10}s;
          animation-delay: ${Math.random() * -18}s;
        `;
        canvas.appendChild(d);
      }
    })();

    /* ── Password toggle ── */
    function togglePassword() {
      const input = document.getElementById('password');
      const icon  = document.getElementById('eyeIcon');
      if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
      } else {
        input.type = 'password';
        icon.innerHTML = `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`;
      }
    }

    /* ── Field validation helpers ── */
    function setError(fieldId, show) {
      const el = document.getElementById(fieldId);
      if (show) el.classList.add('has-error');
      else       el.classList.remove('has-error');
    }

    function showMessage(text, type) {
      const msg = document.getElementById('message');
      msg.textContent  = text;
      msg.className    = type; /* 'success' | 'error' */
    }

    /* ── Real-time validation ── */
    document.getElementById('email').addEventListener('input', function() {
      setError('fieldEmail', this.value.length > 0 && !this.value.includes('@'));
    });
    document.getElementById('password').addEventListener('input', function() {
      if (document.getElementById('fieldPassword').classList.contains('has-error') && this.value.length > 0) {
        setError('fieldPassword', false);
      }
    });

    /* ── Login handler ── */
    function login() {
      const email    = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      let valid = true;

      if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        setError('fieldEmail', true); valid = false;
      } else {
        setError('fieldEmail', false);
      }

      if (!password) {
        setError('fieldPassword', true); valid = false;
      } else {
        setError('fieldPassword', false);
      }

      if (!valid) {
        showMessage('Please fix the errors above.', 'error');
        return;
      }

      /* Simulate async login */
      const btn = document.getElementById('loginBtn');
      btn.disabled = true;
      btn.classList.add('loading');
      showMessage('', '');

      fetch("https://rideshare-backend-uv0p.onrender.com/login",
    {
        method: "POST",
        headers: {
            "Content-Type":
                "application/json"
        },
        body: JSON.stringify({
            email,
            password
        })
    }
)
.then(async response => {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Login failed");
    }

    return data;
})
.then(data => {

    btn.classList.remove('loading');
    btn.disabled = false;
    if (data.success) {

        showMessage(
            "✓ Login successful!",
            "success"
        );
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userPhone");
        localStorage.removeItem("userBlock");
        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.user.uid);
        localStorage.setItem("userName", data.user.name);
        localStorage.setItem("userEmail", data.user.email);
        localStorage.setItem("userPhone", data.user.phone);
        localStorage.setItem("userBlock", data.user.block);  

        setTimeout(() => {

            window.location.href =
                "dashboard.html";

        }, 1000);

    } else {

        showMessage(
    data.message,
    "error");
    }
})
.catch(err => {

    console.log(err);
    btn.disabled = false;
    btn.classList.remove("loading");

    showMessage(
        err.message|| "Server Error",
        "error"
    );
});
    }

    /* Enter key support */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') login();
    });