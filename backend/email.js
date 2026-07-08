const brevo = require("@getbrevo/brevo");

const apiInstance = new brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY
);

const sender = {
    name: "RideShare",
    email: "ridesharefarehelp@gmail.com"
};

async function sendOTPEmail(email, otp) {
    const emailData = {
        sender,
        to: [{ email }],
        subject: "RideShare Email Verification",
        htmlContent: `
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
    };

    await apiInstance.sendTransacEmail(emailData);
}

async function sendForgotPasswordOTP(email, otp) {
    const emailData = {
        sender,
        to: [{ email }],
        subject: "RideShare Password Reset",
        htmlContent: `
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
    };

    await apiInstance.sendTransacEmail(emailData);
}

module.exports = {
    sendOTPEmail,
    sendForgotPasswordOTP
};