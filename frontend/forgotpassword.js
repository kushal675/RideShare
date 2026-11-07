    (function(){
      const c=document.getElementById('dotsCanvas');
      for(let i=0;i<28;i++){
        const d=document.createElement('div'); d.className='dot';
        const s=Math.random()*3+1.5;
        d.style.cssText=`width:${s}px;height:${s}px;left:${Math.random()*100}%;bottom:${Math.random()*-20}%;opacity:0;animation-duration:${Math.random()*14+10}s;animation-delay:${Math.random()*-18}s`;
        c.appendChild(d);
      }
    })();

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
        const dot = document.getElementById('pd'+i);
        dot.classList.remove('active','done');
        if (i < currentStep) dot.classList.add('done');
        else if (i === currentStep) dot.classList.add('active');
      }
    }

    function showMessage(text, type) {
      const m=document.getElementById('message');
      m.textContent=text; m.className=type;
    }

    function setError(id, show) {
      const el=document.getElementById(id);
      if(show) el.classList.add('has-error');
      else el.classList.remove('has-error');
    }

    /* OTP inputs */
    document.querySelectorAll('.otp-box').forEach((box,idx,boxes) => {
      box.addEventListener('input', () => {
        box.value=box.value.replace(/\D/g,'');
        box.classList.toggle('filled', box.value.length>0);
        if (box.value && idx<boxes.length-1) boxes[idx+1].focus();
      });
      box.addEventListener('keydown', e => {
        if (e.key==='Backspace' && !box.value && idx>0) boxes[idx-1].focus();
      });
      box.addEventListener('paste', e => {
        const paste=(e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'');
        if (paste.length===6) {
          boxes.forEach((b,i) => { b.value=paste[i]||''; b.classList.toggle('filled',!!b.value); });
          boxes[5].focus(); e.preventDefault();
        }
      });
    });

    /* Step 1 */
    async function sendOtp() {
      const email=document.getElementById('email').value.trim();
      if (!email || !email.endsWith("@learner.manipal.edu")) { setError('fEmail',true); return; }
      setError('fEmail',false);
      const btn=document.getElementById('btnSendOtp');
      btn.disabled = true;
      btn.classList.add('loading');
      try {

        const response =
            await fetch(
                "https://rideshare-backend-uv0p.onrender.com/send-forgot-otp",
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

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Request failed");
        }
        console.log(data);
        btn.disabled = false;
        btn.classList.remove('loading');

        if (
            data.success
        ) {

            document
                .getElementById(
                    'emailDisplay'
                )
                .textContent =
                email;

            goToStep(2);

            document
                .getElementById(
                    'otp0'
                )
                .focus();

            startResendTimer();

        } else {

            showMessage(
                data.message,
                'error'
            );
        }

    } catch (err) {

        console.log(err);
        btn.disabled = false;
        btn.classList.remove('loading');

        showMessage(
            'Server Error',
            'error'
        );
    }
}

    /* Resend */
    let resendTimer;
    function startResendTimer() {
      const btn=document.getElementById('resendBtn');
      let secs=30; btn.disabled=true; btn.textContent=`Resend in ${secs}s`;
      clearInterval(resendTimer);
      resendTimer=setInterval(() => {
        secs--;
        if (secs<=0) { clearInterval(resendTimer); btn.disabled=false; btn.textContent='Resend code'; }
        else btn.textContent=`Resend in ${secs}s`;
      },1000);
    }
async function resendOtp() {

    const btn =
        document.getElementById("resendBtn");

    // Prevent multiple clicks
    btn.disabled = true;;

    const email =document.getElementById("email").value.trim();

    try {

        const response =
            await fetch(
                "https://rideshare-backend-uv0p.onrender.com/send-forgot-otp",
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

        const data = await response.json();
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
            "Server Error",
            "error"
        );
    }
}
    /* Step 2 */
async function verifyOtp() {

    const otp = Array.from(
        { length: 6 },
        (_, i) =>
            document.getElementById("otp" + i).value
    ).join("");

    if (otp.length < 6) {

        showMessage(
            "Please enter complete OTP",
            "error"
        );

        return;
    }

    const email = document
        .getElementById("email")
        .value
        .trim();

    const btn =
        document.getElementById("btnVerifyOtp");

    btn.disabled = true;
    btn.classList.add("loading");

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

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "OTP verification failed"
            );
        }

        btn.disabled = false;
        btn.classList.remove("loading");

        if (data.success) {

            goToStep(3);

        } else {

            showMessage(
                data.message || "Invalid OTP",
                "error"
            );
        }

    } catch (err) {

        console.error(err);

        btn.disabled = false;
        btn.classList.remove("loading");

        showMessage(
            err.message || "Server Error",
            "error"
        );
    }
}

    /* Password strength */
    const colors={1:'#F87171',2:'#FBBF24',3:'#60A5FA',4:'#34D399'};
    const labels={1:'Weak',2:'Fair',3:'Good',4:'Strong'};
    function checkStrength() {
      const pw=document.getElementById('newPassword').value;
      let score=0;
      if(pw.length>=8) score++;
      if(/[A-Z]/.test(pw)) score++;
      if(/[0-9]/.test(pw)) score++;
      if(/[^A-Za-z0-9]/.test(pw)) score++;
      for(let i=1;i<=4;i++){
        document.getElementById('seg'+i).style.background=i<=score ? colors[score]:'var(--glass-border)';
      }
      const lbl=document.getElementById('strengthLabel');
      lbl.textContent=pw.length===0?'—':labels[score]||'Weak';
      lbl.style.color=pw.length===0?'var(--muted)':colors[score]||colors[1];
    }

    /* Step 3 */
async function resetPassword() {

    const pw =
        document.getElementById(
            "newPassword"
        ).value;

    const cpw =
        document.getElementById(
            "confirmPassword"
        ).value;

    if (!pw || pw.length < 8) {

        showMessage(
            "Password must be at least 8 characters",
            "error"
        );

        return;
    }

    if (pw !== cpw) {

        showMessage(
            "Passwords do not match",
            "error"
        );

        return;
    }

    const email =
        document
            .getElementById("email")
            .value
            .trim();

    const btn =
        document.getElementById("btnReset");

    btn.disabled = true;
    btn.classList.add("loading");

    try {

        const response =
            await fetch(
                "https://rideshare-backend-uv0p.onrender.com/reset-password",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        password: pw
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Password reset failed"
            );
        }

        btn.disabled = false;
        btn.classList.remove("loading");

        if (data.success) {

            document
                .getElementById("step3")
                .classList
                .remove("active");

            document
                .getElementById("progressDots")
                .style.display =
                "none";

            document
                .getElementById("backLogin")
                .style.display =
                "none";

            document
                .getElementById("successScreen")
                .classList
                .add("show");

        } else {

            showMessage(
                data.message || "Reset Failed",
                "error"
            );
        }

    } catch (err) {

        console.error(err);

        btn.disabled = false;
        btn.classList.remove("loading");

        showMessage(
            err.message || "Server Error",
            "error"
        );
    }
}
    function togglePw(inputId, iconId) {
      const input=document.getElementById(inputId);
      const icon=document.getElementById(iconId);
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
      else if (currentStep===3) resetPassword();
    });