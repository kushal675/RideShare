const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendOTPEmail(email, otp) {
    await resend.emails.send({
        from: "RideShare <onboarding@resend.dev>",
        to: email,
        subject: "RideShare Email Verification",
        html: `
            <div style="font-family:Arial,sans-serif">
                <h2>RideShare OTP Verification</h2>

                <p>Your verification code is:</p>

                <h1 style="
                    letter-spacing:6px;
                    color:#2563EB;
                ">
                    ${otp}
                </h1>

                <p>This OTP is valid for 5 minutes.</p>

                <p>If you didn't request this, please ignore this email.</p>
            </div>
        `
    });
}

async function sendForgotPasswordOTP(email, otp) {
    await resend.emails.send({
        from: "RideShare <onboarding@resend.dev>",
        to: email,
        subject: "RideShare Password Reset",
        html: `
            <div style="font-family:Arial,sans-serif">
                <h2>Password Reset</h2>

                <p>Your password reset OTP is:</p>

                <h1 style="
                    letter-spacing:6px;
                    color:#2563EB;
                ">
                    ${otp}
                </h1>

                <p>This OTP is valid for 5 minutes.</p>
            </div>
        `
    });
}

module.exports = {
    sendOTPEmail,
    sendForgotPasswordOTP
};