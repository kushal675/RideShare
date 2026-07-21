console.log("signup.js loaded");
/* Dots */
    (function(){
      const c=document.getElementById('dotsCanvas');
      for(let i=0;i<28;i++){
        const d=document.createElement('div'); d.className='dot';
        const s=Math.random()*3+1.5;
        d.style.cssText=`width:${s}px;height:${s}px;left:${Math.random()*100}%;bottom:${Math.random()*-20}%;opacity:0;animation-duration:${Math.random()*14+10}s;animation-delay:${Math.random()*-18}s`;
        c.appendChild(d);
      }
    })();

    /* Step management */
    let currentStep = 1;
    function goToStep(n) {
      document.getElementById('step'+currentStep).classList.remove('active');
      currentStep = n;
      document.getElementById('step'+currentStep).classList.add('active');
      updateProgress();
      showMessage('','');
    }

    function updateProgress() {
      for (let i=1; i<=3; i++) {
        const sc = document.getElementById('sc'+i);
        const sl = document.getElementById('sl'+i);
        sc.classList.remove('active','done');
        sl.classList.remove('active','done');
        if (i < currentStep) { sc.classList.add('done'); sl.classList.add('done'); sc.innerHTML='✓'; }
        else if (i === currentStep) { sc.classList.add('active'); sl.classList.add('active'); sc.textContent=i; }
        else { sc.textContent=i; }
      }
      for (let i=1; i<=2; i++) {
        const conn = document.getElementById('conn'+i);
        conn.classList.toggle('done', i < currentStep);
      }
    }

    /* Message */
    function showMessage(text, type) {
      const m = document.getElementById('message');
      m.textContent = text; m.className = type;
    }

    function setError(id, show) {
      const el = document.getElementById(id);
      if(show) el.classList.add('has-error');
      else el.classList.remove('has-error');
    }

    /* OTP inputs */
    document.querySelectorAll('.otp-box').forEach((box, idx, boxes) => {
      box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g,'');
        box.classList.toggle('filled', box.value.length > 0);
        if (box.value && idx < boxes.length-1) boxes[idx+1].focus();
      });
      box.addEventListener('keydown', e => {
        if (e.key==='Backspace' && !box.value && idx > 0) boxes[idx-1].focus();
      });
      box.addEventListener('paste', e => {
        const paste = (e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'');
        if (paste.length === 6) {
          boxes.forEach((b,i) => { b.value = paste[i]||''; b.classList.toggle('filled', !!b.value); });
          boxes[5].focus(); e.preventDefault();
        }
      });
    });

    /* Step 1 */
    function sendOtp() {

      console.log("sendOtp function called");

      const name  = document.getElementById('name').value.trim();
      const block = document.getElementById('block').value.trim();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();
      let ok = true;
      if (!name)  { setError('fName', true); ok=false; } else setError('fName',false);
      if (!block) { setError('fBlock',true); ok=false; } else setError('fBlock',false);
      if (!email || !email.endsWith("@learner.manipal.edu")) { setError('fEmail',true); ok=false; } else setError('fEmail',false);
      if (!phone || !phone.match(/^\d{10}$/)) { setError('fPhone',true); ok=false; } else setError('fPhone',false);
      if (!ok) return;

      const btn = document.getElementById('btnSendOtp');
      btn.disabled = true;
    btn.classList.add("loading");
      fetch("https://rideshare-backend-uv0p.onrender.com/send-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email
      })
})
.then(response => response.json())
.then(data => {
    btn.disabled = false;
    btn.classList.remove('loading');

    if (data.success) {

        document.getElementById('emailDisplay')
            .textContent = email;

        goToStep(2);

        document.getElementById('otp0')
            .focus();

        startResendTimer();

    } else {

        showMessage(
            data.message || "Failed to send OTP",
            "error"
        );
    }
})
.catch(err => {

    console.log(err);
    btn.disabled = false;
    btn.classList.remove('loading');

    showMessage(
        "Cannot connect to server",
        "error"
    );
      });
    }

    /* Resend timer */
    let resendTimer;
    function startResendTimer() {
      const btn = document.getElementById('resendBtn');
      let secs = 30;
      btn.disabled = true; btn.textContent = `Resend in ${secs}s`;
      clearInterval(resendTimer);
      resendTimer = setInterval(() => {
        secs--;
        if (secs <= 0) { clearInterval(resendTimer); btn.disabled=false; btn.textContent='Resend OTP'; }
        else btn.textContent = `Resend in ${secs}s`;
      }, 1000);
    }
    //resendOtp function

    async function resendOtp() {

    const btn =
        document.getElementById("resendBtn");

    // Prevent multiple clicks
    btn.disabled = true;;

    const email =document.getElementById("email").value.trim();

    try {

        const response =
            await fetch(
                "https://rideshare-backend-uv0p.onrender.com/send-otp",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        email
                    })
                }
            );

        const data =await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Request failed");
        }    
        if (data.success) {

            showMessage(
                "New OTP sent successfully!",
                "success"
            );

            startResendTimer();

        } else {

            showMessage(
                "Failed to resend OTP",
                "error"
            );
        }

    } catch (err) {

        console.log(err);

        showMessage(
            err.message || "Server Error",
            "error"
        );
    }
}

    /* Step 2 */
    async function verifyOtp() {

    const otp = Array.from(
        { length: 6 },
        (_, i) =>
            document.getElementById('otp' + i).value
    ).join('');

    if (otp.length < 6) {

        showMessage(
            'Please enter complete OTP',
            'error'
        );

        return;
    }

    const email =
        document.getElementById('email')
        .value
        .trim();

    const btn =
        document.getElementById('btnVerifyOtp');
    btn.disabled = true;
    btn.classList.add('loading');

    try {

        const response =
            await fetch(
                "https://rideshare-backend-uv0p.onrender.com/verify-otp",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        otp
                    })
                }
            );

        const data =await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Request failed");
        }
        btn.disabled = false;    
        btn.classList.remove('loading');

        if (data.success) {

            showMessage(
                "OTP Verified!",
                "success"
            );

            goToStep(3);

            document
                .getElementById("password")
                .focus();

        } else {

            showMessage(
                "Invalid OTP",
                "error"
            );
        }

    } catch (err ) {

        console.log(err);
        btn.disabled = false;
        btn.classList.remove('loading');

        showMessage(
            err.message || "Server Error",
            "error"
        );
    }
    /* Password strength */
    const colors = { 1:'#F87171', 2:'#FBBF24', 3:'#60A5FA', 4:'#34D399' };
    const labels = { 1:'Weak', 2:'Fair', 3:'Good', 4:'Strong' };
    function checkStrength() {
      const pw = document.getElementById('password').value;
      let score = 0;
      if (pw.length >= 8) score++;
      if (/[A-Z]/.test(pw)) score++;
      if (/[0-9]/.test(pw)) score++;
      if (/[^A-Za-z0-9]/.test(pw)) score++;
      for (let i=1; i<=4; i++) {
        const seg = document.getElementById('seg'+i);
        seg.style.background = i<=score ? colors[score] : 'var(--glass-border)';
      }
      const lbl = document.getElementById('strengthLabel');
      lbl.textContent = pw.length===0 ? '—' : labels[score]||'Weak';
      lbl.style.color = pw.length===0 ? 'var(--muted)' : colors[score]||colors[1];
    }

    /* Step 3 */
    async function signup() {
      const pw  = document.getElementById('password').value;
      const cpw = document.getElementById('confirmPassword').value;
      let ok = true;
      if (!pw || pw.length < 8) { setError('fPw',true); ok=false; } else setError('fPw',false);
      if (!cpw || cpw !== pw)   { setError('fConfirm',true); ok=false; } else setError('fConfirm',false);
      if (!ok) return;
      const btn = document.getElementById('btnSignup');
      btn.disabled = true;
      btn.classList.add('loading');
      try {

        const response =
            await fetch(
                "https://rideshare-backend-uv0p.onrender.com/signup",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        name:
                            document.getElementById('name').value,

                        email:
                            document.getElementById('email').value,

                        phone:
                            document.getElementById('phone').value,

                        block:
                            document.getElementById('block').value,

                        password: pw
                    })
                }
            );
        if (!response.ok) {
            throw new Error(data.message || "Request failed");
        }    
        const data =await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Request failed");
        }
        btn.disabled = false;    
        btn.classList.remove('loading');

        if (data.success) {

            showMessage(
                "Account Created!",
                "success"
            );
            setTimeout(() => {
            window.location.href = "login.html";
            }, 1500);

        } else {

            showMessage(
                data.message || "Signup Failed",
                "error"
            );
        }

    } catch (err ) {

        console.log(err);
        btn.disabled = false;
        btn.classList.remove('loading');

        showMessage(
            err.message || "Server Error",
            "error"
        );
    }

    /* Toggle password */
    function togglePw(inputId, iconId) {
      const input = document.getElementById(inputId);
      const icon  = document.getElementById(iconId);
      if (input.type==='password') {
        input.type='text';
        icon.innerHTML=`<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
      } else {
        input.type='password';
        icon.innerHTML=`<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`;
      }
    }

    document.addEventListener('keydown', e => {
      if (e.key!=='Enter') return;
      if (currentStep===1) sendOtp();
      else if (currentStep===2) verifyOtp();
      else if (currentStep===3) signup();
    });
    }}