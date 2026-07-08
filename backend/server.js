require("dotenv").config();

const net = require("net");

if (net.setDefaultAutoSelectFamily) {
    net.setDefaultAutoSelectFamily(false);
}

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const JWT_SECRET = process.env.JWT_SECRET;
const app = express();

app.set("trust proxy", 1);

const allowedOrigins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://maherideshare.netlify.app"
];
app.use(cors({
    origin(origin, callback) {

        // Allow tools like Postman and server-to-server requests
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },

    methods: ["GET", "POST", "PUT", "DELETE"],

    allowedHeaders: [
        "Content-Type",
        "Authorization"
    ]
}));

app.use(express.json());
app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
}

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many attempts. Please try again after 15 minutes."
    }
});

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many OTP requests. Please try again after 15 minutes."
    }
});

const otpStore = {};
const lastOtpSent={};
const verifiedEmails = {};

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);
const dnsPromises = require("dns").promises;

async function createTransporter() {
    const [ipv4] = await dnsPromises.resolve4("smtp.gmail.com");

    return nodemailer.createTransport({
        host: ipv4,
        port: 465,
        secure: true,
        tls: {
            servername: "smtp.gmail.com"
        },
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}
const transporter = await createTransporter();
transporter.verify(function (error, success) {
    if (error) {
        console.error("SMTP VERIFY FAILED");
        console.error(error);
    } else {
        console.log("SMTP SERVER READY");
    }
});

/* ============================================
   JWT HELPERS
============================================ */

function generateToken(user) {

    return jwt.sign(
        {
            uid: user.uid,
            email: user.mail
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
}


async function requireAuth(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {

        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });

    }

    const token = authHeader.split(" ")[1];

    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const { data: user, error } = await supabase
            .from("users")
            .select("uid,mail,name,phone,block,year_branch")
            .eq("uid", decoded.uid)
            .single();

        if (error || !user) {

            return res.status(401).json({
                success: false,
                message: "User not found"
            });

        }

        req.user = user;

        next();

    }

    catch {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });

    }

}
async function createNotification({
    userId,
    type,
    actorId = null,
    groupId = null,
    rideRequestId = null
}) {

    await supabase
        .from("notifications")
        .insert({
            user_id: userId,
            type,
            actor_id: actorId,
            group_id: groupId,
            ride_request_id: rideRequestId
        });

}


async function removePendingNotification({
    userId,
    type,
    groupId,
    rideRequestId
}) {

    await supabase
        .from("notifications")
        .delete()
        .eq("user_id", userId)
        .eq("type", type)
        .eq("group_id", groupId)
        .eq("ride_request_id", rideRequestId);

}

async function updateCompletedRides() {

    try {

        const now = new Date().toISOString();

        // -------------------------------------------------
        // STEP 1 : Complete expired ride requests
        // -------------------------------------------------

        const { data: rideRequests, error: rideError } = await supabase
            .from("ride_requests")
            .select("id, ride_date, ride_time")
            .eq("status", "open");

        if (rideError) {
            console.error("Ride Request Fetch Error:", rideError);
            return;
        }

        const completedRideRequestIds = [];

        for (const ride of rideRequests) {

            const rideDateTime = new Date(
                `${ride.ride_date}T${ride.ride_time}`
            );

            rideDateTime.setHours(
                rideDateTime.getHours() + 1
            );

            if (new Date(now) >= rideDateTime) {

                completedRideRequestIds.push(
                    ride.id
                );

            }

        }

        if (completedRideRequestIds.length > 0) {

            await supabase
                .from("ride_requests")
                .update({
                    status: "completed",
                    completed_at: now
                })
                .in("id", completedRideRequestIds);

        }

        // -------------------------------------------------
        // STEP 2 : Complete expired active groups
        // -------------------------------------------------

        const { data: groups, error: groupError } = await supabase
            .from("groups")
            .select("id, ride_request_id")
            .eq("status", "active");

        if (groupError) {
            console.error("Group Fetch Error:", groupError);
            return;
        }

        const creatorRideRequestIds = groups.map(
            g => g.ride_request_id
        );

        if (creatorRideRequestIds.length === 0)
            return;

        const { data: creatorRequests, error: creatorError } =
            await supabase
                .from("ride_requests")
                .select("id, ride_date, ride_time")
                .in("id", creatorRideRequestIds);

        if (creatorError) {
            console.error("Creator Ride Fetch Error:", creatorError);
            return;
        }

        const requestMap = {};

        creatorRequests.forEach(request => {

            requestMap[request.id] = request;

        });

        const completedGroupIds = [];

        for (const group of groups) {

            const creatorRide =
                requestMap[group.ride_request_id];

            if (!creatorRide)
                continue;

            const rideDateTime = new Date(
                `${creatorRide.ride_date}T${creatorRide.ride_time}`
            );

            rideDateTime.setHours(
                rideDateTime.getHours() + 1
            );

            if (new Date(now) >= rideDateTime) {

                completedGroupIds.push(
                    group.id
                );

            }

        }

            if (completedGroupIds.length > 0) {

                await supabase
                    .from("groups")
                    .update({
                        status: "completed",
                        completed_at: now
                    })
                    .in("id", completedGroupIds);

                //--------------------------------------------------
                // Notify every member of completed groups
                //--------------------------------------------------

                for (const groupId of completedGroupIds) {

                    const { data: members, error: memberError } =
                        await supabase
                            .from("group_members")
                            .select("user_id")
                            .eq("group_id", groupId);

                    if (memberError) {
                        console.error(memberError);
                        continue;
                    }

                    for (const member of members) {

                        await createNotification({

                            userId: member.user_id,

                            type: "RIDE_COMPLETED",

                            groupId

                        });

                    }

                }

            }

    }
    catch (err) {

        console.error(
            "updateCompletedRides:",
            err
        );

    }

}

app.use(async (req, res, next) => {

    // Skip routes that don't need ride status updates
    const skippedRoutes = [
        "/send-otp",
        "/verify-otp",
        "/signup",
        "/login",
        "/forgot-password",
        "/reset-password"
    ];

    if (skippedRoutes.includes(req.path)) {
        return next();
    }

    try {
        await updateCompletedRides();
    } catch (err) {
        console.error("Middleware:", err);
    }

    next();

});

//////////////////////////////
///////SIGN UP
///////////////////////////
app.post("/send-otp", otpLimiter, async (req, res) => {

    const { email } = req.body;
    if (
        !email ||
        !email.toLowerCase().endsWith("@learner.manipal.edu")
    ) {
        return res.status(400).json({
            success: false,
            message: "Only learner.manipal.edu email addresses are allowed."
        });
    }
    if (
    lastOtpSent[email] &&
    Date.now() - lastOtpSent[email] < 30000
) {
    return res.status(429).json({
        success: false,
        message:
            "Please wait 30 seconds"
    });
}

lastOtpSent[email] = Date.now();
    const record = otpStore[email];

let otp;

if (
    record &&
    Date.now() < record.expires
) {
    otp = record.otp;
} else {
    otp = crypto.randomInt(100000, 1000000).toString();

    otpStore[email] = {
        otp,
        expires: Date.now() + 5 * 60 * 1000
    };
}

    console.log(email, otp);

    try {

        console.log("About to send email...");

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "RideShare OTP",
            html: `<h2>Your OTP is ${otp}</h2>`
        });

        console.log("Email sent successfully");

        return res.json({
            success: true
        });

    } catch (err) {
        console.error("SEND MAIL ERROR:");
        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

app.post("/verify-otp", otpLimiter, (req, res) => {

    const { email, otp } = req.body;

    const record = otpStore[email];
    if (record && record.otp === otp && Date.now() < record.expires) {
        
        verifiedEmails[email] = true;
        delete otpStore[email];

        return res.json({
            success: true
        });
    }

    res.status(400).json({
        success: false,
        message: "Invalid OTP"
    });
});

app.post("/signup", authLimiter, async (req, res) => {

    const {
        name,
        email,
        phone,
        block,
        password
    } = req.body;
    if (
        typeof password !== "string" ||
        password.length < 8
    ) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 8 characters long."
        });
    }
    if (
        !email ||
        !email.toLowerCase().endsWith("@learner.manipal.edu")
    ) {
        return res.status(400).json({
            success: false,
            message: "Only learner.manipal.edu email addresses are allowed."
        });
    }
    if (!verifiedEmails[email]) {

    return res.status(400).json({
        success: false,
        message: "Verify OTP first"
    });
}

    try {

        // Check if account already exists

        const { data: existingUser } =
            await supabase
                .from("users")
                .select("mail")
                .eq(
                    "mail",
                    email.toLowerCase()
                );

        if (
            existingUser &&
            existingUser.length > 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Account already exists"
            });
        }

        // Hash password

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );
       // Insert into database

        const { error } =
            await supabase
                .from("users")
                .insert([
                    {
                        name,
                        mail:
                            email.toLowerCase(),
                        phone,
                        block,
                        password:
                            hashedPassword
                    }
                ]);

        if (error) {

            console.error(error);

            return res.status(500).json({
                success: false
            });
        }
        delete verifiedEmails[email]; // Remove the email from verified emails
        res.json({
            success: true
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false
        });
    }
});


///////////////////////////////
//////LOGIN
///////////////////////////////


app.post("/login", authLimiter, async (req, res) => {
    
    const { email, password } = req.body;

    try {

        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq(
                "mail",
                email.toLowerCase()
            );

        if (error) throw error;

        if (data.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = data[0];

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!passwordMatch) {

            return res.status(400).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = generateToken(user);

        return res.json({
            success: true,
            token,
            user: {
                uid: user.uid,
                name: user.name,
                email: user.mail,
                phone: user.phone,
                block: user.block
            }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false
        });
    }
});


////////////////////////////////
//////FORGOT PASSWORD
////////////////////////////////

app.post("/reset-password", authLimiter, async (req, res) => {


    try {

        let { email, password } = req.body;
        if (
            typeof password !== "string" ||
            password.length < 8
        ) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long."
            });
        }
        if (
            typeof email !== "string"
        ) {
            email = email.trim().toLowerCase();
        }

        // Check OTP verification

        if (!verifiedEmails[email]) {

            return res.status(400).json({
                success: false,
                message: "Verify OTP first"
            });
        }

        // Check user exists

        const { data: user, error: userError } =
            await supabase
                .from("users")
                .select("*")
                .eq("mail", email);

        if (userError) throw userError;

        if (!user || user.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Hash new password

        const hashedPassword =
            await bcrypt.hash(password, 10);

        // Update password

        const { data: updatedUser, error } =
            await supabase
                .from("users")
                .update({
                    password: hashedPassword
                })
                .eq(
                    "mail",
                    email.toLowerCase()
                )
                .select();
        if (error) {
            throw error;
        }        
        // Remove OTP verification flag

        delete verifiedEmails[email];

        res.json({
            success: true,
            message: "Password updated successfully"
        });
    } catch (err) {

        ;

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
});

app.post("/send-forgot-otp", otpLimiter, async (req, res) => {

    const email =
        req.body.email
            .trim()
            .toLowerCase();

    try {

        // Check if account exists

        const { data, error } =
            await supabase
                .from("users")
                .select("mail")
                .eq("mail", email);

        if (error) throw error;

        if (data.length === 0) {

            return res.status(400).json({
                success: false,
                message:
                    "No account found with this email"
            });
        }

        // Cooldown

        if (
            lastOtpSent[email] &&
            Date.now() -
            lastOtpSent[email]
            < 30000
        ) {

            return res.status(429).json({
                success: false,
                message:
                    "Please wait 30 seconds"
            });
        }

        lastOtpSent[email] =
            Date.now();

        const record =
            otpStore[email];

        let otp;

        if (
            record &&
            Date.now() <
            record.expires
        ) {

            otp = record.otp;

        } else {

            otp = crypto.randomInt(100000, 1000000).toString();

            otpStore[email] = {
                otp,
                expires:
                    Date.now() +
                    5 * 60 * 1000
            };
        }

        await transporter.sendMail({
            from:
                process.env.EMAIL_USER,
            to: email,
            subject:
                "RideShare Password Reset OTP",
            html: `
                <h2>Your OTP is</h2>
                <h1>${otp}</h1>
            `
        });

        res.json({
            success: true
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false
        });
    }
});



///////////////////////
////REQUEST CREATION
///////////////////////

app.post("/create-request", requireAuth, async (req, res) => {

    const user_id = req.user.uid;

    const {
        source,
        destination,
        ride_date,
        ride_time,
        notes
    } = req.body;
    const { data: existingRide, error: existingRideError } = await supabase
    .from("ride_requests")
    .select("id")
    .eq("user_id", user_id)
    .eq("ride_date", ride_date)
    .eq("ride_time", ride_time)
    .maybeSingle();

if (existingRideError) {
    return res.status(500).json(existingRideError);
}

if (existingRide) {
    return res.status(400).json({
        success: false,
        error: "You already have a ride request for this date and time."
    });
}   
    const { data, error } = await supabase
    .from("ride_requests")
    .insert([
        {
            user_id,
            source,
            destination,
            ride_date,
            ride_time,
            notes,
            status: "open"
        }
    ])
    .select()
    .single();

if (error) {

    if (error.code === "23505") {

        return res.status(400).json({
            success: false,
            error: "You already have a ride request for this date and time."
        });

    }

    return res.status(400).json({
        success: false,
        message: error.message
    });

}
    res.json({
        success: true,
        message: "Ride Request Created",
        request: data
    });
});

//--------------------------------------------------
// UPDATE RIDE REQUEST
//--------------------------------------------------

app.put("/ride-request/:id", requireAuth, async (req, res) => {

    try {

        const requestId = req.params.id;
        const user_id = req.user.uid;

        const {
            source,
            destination,
            ride_date,
            ride_time,
            notes
        } = req.body;

        //------------------------------------------
        // Check if ride request exists
        //------------------------------------------

        const { data: existingRide, error: fetchError } =
            await supabase
                .from("ride_requests")
                .select("*")
                .eq("id", requestId)
                .single();
        if (fetchError || !existingRide) {

            return res.status(404).json({
                success: false,
                message: "Ride request not found."
            });

        }

        if (existingRide.user_id !== user_id) {

            return res.status(403).json({
                success: false,
                message: "Forbidden"
            });

}
        const { data: group } = await supabase
            .from("groups")
            .select("id")
            .eq("ride_request_id", requestId)
            .in("status",["pending","active"])
            .maybeSingle();

        if(group){

            return res.status(400).json({

            success:false,
            message:"Ride request belongs to a group. Leave the group before editing."

            });

        }
        //------------------------------------------
        // Update ride request
        //------------------------------------------
 
        const updatePayload = {
    source,
    destination,
    ride_date,
    ride_time,
    notes
};

const { data, error } = await supabase
    .from("ride_requests")
    .update(updatePayload)
    .eq("id", requestId)
    .select();


if (error) {

    console.error(error);

    return res.status(400).json({
        success: false,
        message: "Unable to update ride request."
    });

}

        return res.json({
            success: true,
            message: "Ride request updated successfully.",
            rideRequest: data
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            error: err.message
        });

    }

});
//////////////////////////////////////////
/////PROFILE MANAGEMENT
//////////////////////////////////////////
app.get("/profile", requireAuth, async (req, res) => {

    const userId = req.user.uid;

    const { data, error } = await supabase
        .from("users")
        .select("uid, name, mail, phone, block, year_branch")
        .eq("uid", userId)
        .single();

    if (error) {

        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Unable to load profile."
        });

    }

    res.json(data);
});

app.post("/update-profile", requireAuth, async (req, res) => {

    const userId = req.user.uid;

    const {
        name,
        phone,
        block,
        year_branch
    } = req.body;

    const { error } = await supabase
        .from("users")
        .update({
            name,
            phone,
            block,
            year_branch
        })
        .eq("uid", userId);

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    res.json({
        success: true
    });

});

///////////////////////////////
//////GROUP MANAGEMENT
////////////////////////////////

app.post("/my-requests", requireAuth, async (req, res) => {

    const user_id = req.user.uid;

    const { data, error } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "open")
        .order("ride_date")
        .order("ride_time");

    if (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Unable to load ride requests."
        });

    }

    res.json(data);
});

app.post("/matching-students", requireAuth, async (req, res) => {
    
    const currentUserId = req.user.uid;

    const {
        currentRideRequestId,
        source,
        destination,
        ride_date,
        ride_time
    } = req.body;

    const { data: rideRequest, error: rideError } = await supabase
        .from("ride_requests")
        .select("user_id")
        .eq("id", currentRideRequestId)
        .single();

    if (rideError || !rideRequest) {
        return res.status(404).json({
            success: false,
            message: "Ride request not found."
        });
    }

    if (rideRequest.user_id !== req.user.uid) {
        return res.status(403).json({
            success: false,
            message: "Forbidden"
        });
    }

    try {

        const requestTime = new Date(`1970-01-01T${ride_time}`);

        const lowerTime = new Date(requestTime.getTime() - 15 * 60 * 1000)
            .toTimeString()
            .slice(0, 8);

        const upperTime = new Date(requestTime.getTime() + 15 * 60 * 1000)
            .toTimeString()
            .slice(0, 8);

        //--------------------------------------------------
        // Find all users already inside an active group
        //--------------------------------------------------

        const { data: groupedMembers, error: groupedError } = await supabase
        .from("group_members")
        .select("ride_request_id");

        if (groupedError) {

            console.error(groupedError);

            return res.status(500).json({
                success: false,
                message: "Server error."
            });

        }

        const groupedRideRequests =groupedMembers.map(m => m.ride_request_id);

        //--------------------------------------------------
        // Find matching students
        //--------------------------------------------------

        let query = supabase
            .from("ride_requests")
            .select(`
                id,
                user_id,
                ride_time,
                notes,
                users(name)
            `)
            .eq("source", source)
            .eq("destination", destination)
            .eq("ride_date", ride_date)
            .gte("ride_time", lowerTime)
            .lte("ride_time", upperTime)
            .neq("user_id", currentUserId)
            .eq("status", "open");

        if (groupedRideRequests.length > 0) {
            query = query.not("id","in",`(${groupedRideRequests.join(",")})`
);
        }

        const { data, error } = await query;

        if (error) {

            console.error(error);

            return res.status(500).json({
                success: false,
                message: "Unable to fetch matching students."
            });

        }

        const result = data.map(r => ({
            id: r.id,
            user_id: r.user_id,
            ride_time: r.ride_time,
            notes: r.notes,
            name: r.users.name
        }));

        res.json(result);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});

app.post("/group-status", requireAuth, async (req, res) => {
    
    const { rideRequestId } = req.body;
    const { data: rideRequest, error: rideError } = await supabase
        .from("ride_requests")
        .select("user_id")
        .eq("id", rideRequestId)
        .single();

    if (rideError || !rideRequest) {
        return res.status(404).json({
            success: false,
            message: "Ride request not found."
        });
    }

    if (rideRequest.user_id !== req.user.uid) {
        return res.status(403).json({
            success: false,
            message: "Forbidden"
        });
    }
    try {

        //--------------------------------------------------
        // Is user already inside a group?
        //--------------------------------------------------

        const { data: member, error: memberError } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("ride_request_id", rideRequestId)
            .maybeSingle();

        if (memberError) {
            console.error(memberError);

            return res.status(500).json({
                success: false,
                message: "Server error."
            });
        }

        if (member) {

            return res.json({
                status: "active",
                currentGroupId: member.group_id
            });

        }

        //--------------------------------------------------
        // Any pending incoming request?
        //--------------------------------------------------

        const { data: incoming, error: incomingError } = await supabase
            .from("group_request")
            .select("id")
            .eq("receiver_request_id", rideRequestId)
            .eq("status", "pending")
            .eq("type", "invitation");

        if (incomingError) {
            console.error(incomingError);

            return res.status(500).json({
                success: false,
                message: "Server error."
            });
        }

        //--------------------------------------------------
        // Any pending outgoing request?
        //--------------------------------------------------

        const { data: outgoing, error: outgoingError } = await supabase
            .from("group_request")
            .select("id")
            .eq("sender_request_id", rideRequestId)
            .eq("status", "pending")
            .in("type", ["invitation", "join_request"]);

        if (outgoingError) {
            console.error(outgoingError);

            return res.status(500).json({
                success: false,
                message: "Server error."
            });
        }

        if (incoming.length || outgoing.length) {

            return res.json({
                status: "pending",
                currentGroupId: null
            });

        }

        //--------------------------------------------------
        // Default
        //--------------------------------------------------

        return res.json({

            status: "looking",
            currentGroupId: null

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});

app.post("/create-group",requireAuth, async (req, res) => {

//--------------------------------------------------
// Check creator isn't already inside another group
//--------------------------------------------------
const creatorId = req.user.uid;

const {
    requestId,
    selectedUsers,
    max_members
} = req.body;

//--------------------------------------------------
// Validate max_members
//--------------------------------------------------

const parsedMaxMembers = Number(max_members);

if (
    !Number.isInteger(parsedMaxMembers) || parsedMaxMembers < 2 || parsedMaxMembers > 6) {
    return res.status(400).json({
        success: false,
        message: "Group size must be an integer between 2 and 6."
    });
}

const { data: rideRequest, error: rideError } = await supabase
    .from("ride_requests")
    .select("user_id")
    .eq("id", requestId)
    .single();

if (rideError || !rideRequest) {
    return res.status(404).json({
        success: false,
        message: "Ride request not found."
    });
}

if (rideRequest.user_id !== req.user.uid) {
    return res.status(403).json({
        success: false,
        message: "Forbidden"
    });
}

    // Check if this ride request already has a group

// Check if this ride request is already grouped

const { data: requestData, error: rideRequestError } = await supabase
    .from("ride_requests")
    .select("status")
    .eq("id", requestId)
    .single();

if (rideRequestError) {
    return res.status(500).json(rideRequestError);
}


// Check if user already has pending invitations sent
/*
const { data: pendingInvites, error: pendingError } = await supabase
    .from("group_request")
    .select("id")
    .eq("sender_id", creatorId)
    .eq("status", "pending")
    .limit(1);

if (pendingError) {
    return res.status(500).json(pendingError);
}

if (pendingInvites.length > 0) {

    return res.status(400).json({
        success: false,
        error: "You already have pending group invitations."
    });

}
*/

//--------------------------------------------------
// Is creator already inside a group?
//--------------------------------------------------

const { data: membership, error: membershipError } =
await supabase
    .from("group_members")
    .select("group_id")
    .eq("ride_request_id", requestId)
    .maybeSingle();

if (membershipError) {
    return res.status(500).json(membershipError);
}

let existingGroup = null;

//--------------------------------------------------
// Existing member → reuse current group
//--------------------------------------------------

if (membership) {

    const { data: memberGroup, error: memberGroupError } =
        await supabase
            .from("groups")
            .select("*")
            .eq("id", membership.group_id)
            .maybeSingle();

    if (memberGroupError) {
        return res.status(500).json(memberGroupError);
    }

    existingGroup = memberGroup;

}

//--------------------------------------------------
// Creator isn't in a group yet
//--------------------------------------------------

else {

    const { data: rideGroup, error: rideGroupError } =
        await supabase
            .from("groups")
            .select("*")
            .eq("ride_request_id", requestId)
            .in("status", ["pending","active"])
            .maybeSingle();

    if (rideGroupError) {
        return res.status(500).json(rideGroupError);
    }

    existingGroup = rideGroup;

}

let group;
const { data: members } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", group?.id || existingGroup?.id);

if (existingGroup && members.length >= existingGroup.max_members) {

    return res.status(400).json({
        success: false,
        error: "Group is already full."
    });

}

if (existingGroup) {

    group = existingGroup;

} else {

    const { data: newGroup, error: groupError } =
        await supabase
            .from("groups")
            .insert({
                creator_id: creatorId,
                ride_request_id: requestId,
                max_members: parsedMaxMembers,
                status: "pending"
            })
            .select()
            .single();

    if (groupError) {
        console.error(groupError);

        return res.status(500).json({
            success:false,
            message:"Server error."
        });
    }

    group = newGroup;

}
    try {
/*
        // 1. Create group
        const { data: group, error: groupError } = await supabase
            .from("groups")
            .insert({
                creator_id: creatorId,
                ride_request_id: requestId,
                max_members: max_members,
                status: "pending"
            })
            .select()
            .single();

        if (groupError) {
            return res.status(500).json(groupError);
        }
            */

        // 2. Send invitations
        // Get only users whose ride request is still open
        const { data: existingInvites } =
await supabase
    .from("group_request")
    .select("receiver_id")
    .eq("group_id", group.id)
    .eq("status","pending")
    .eq("type","invitation");

const alreadyInvited =
new Set(
    existingInvites.map(r=>r.receiver_id)
);

const requests =selectedUsers.filter(student=>!alreadyInvited.has(student.user_id))
.map(student=>({

    group_id: group.id,

    sender_id: creatorId,

    sender_request_id: requestId,

    receiver_id: student.user_id,

    receiver_request_id: student.request_id,

    status:"pending",

    type:"invitation"

}));
    if (requests.length === 0) {

    return res.json({
        success: true,
        message: "No new invitations to send.",
        groupId: group.id
    });

}

    const { error: requestError } = await supabase
            .from("group_request")
            .insert(requests);

        if (requestError) {
            return res.status(500).json(requestError);
        }

    // Create notification for every invited user
    for (const invitation of requests) {

        await createNotification({

            userId: invitation.receiver_id,

            type: "INVITATION_RECEIVED",

            actorId: creatorId,

            groupId: group.id,

            rideRequestId: invitation.receiver_request_id

        });

    }    

    res.json({
        success: true,
        groupId: group.id,
        invitedCount: requests.length,
    selectedCount: selectedUsers.length,
});

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});

////////////////////////////////////////////////////
/////// REQUEST TO JOIN GROUP
////////////////////////////////////////////////////

app.post("/join-group", requireAuth, async (req, res) => {

    const senderId = req.user.uid;

    const {
        groupId,
        senderRequestId
    } = req.body;

    const { data: rideRequest, error: rideError } = await supabase
        .from("ride_requests")
        .select("user_id")
        .eq("id", senderRequestId)
        .single();

    if (rideError || !rideRequest) {
        return res.status(404).json({
            success: false,
            message: "Ride request not found."
        });
    }

    if (rideRequest.user_id !== req.user.uid) {
        return res.status(403).json({
            success: false,
            message: "Forbidden"
        });
    }
    try {

        //--------------------------------------------------
        // Check sender isn't already a member of any group
        //--------------------------------------------------

        const { data: existingMember, error: memberError } =
            await supabase
                .from("group_members")
                .select("id")
                .eq("ride_request_id", senderRequestId)
                .maybeSingle();

        if (memberError) {

            console.error(memberError);

            return res.status(500).json({
                success:false,
                message:"Server error."
            });

        }

        if (existingMember) {

            return res.status(400).json({
                success: false,
                message: "You are already in a group."
            });

        }

        //--------------------------------------------------
        // Get group
        //--------------------------------------------------

        const { data: group, error: groupError } =
            await supabase
                .from("groups")
                .select("*")
                .eq("id", groupId)
                .single();

        if (groupError || !group) {

            return res.status(404).json({
                success: false,
                message: "Group not found."
            });

        }

        //--------------------------------------------------
        // Check group isn't full
        //--------------------------------------------------

        const { data: members } =
            await supabase
                .from("group_members")
                .select("user_id")
                .eq("group_id", groupId);

        if (members.length >= group.max_members) {

            return res.status(400).json({
                success: false,
                message: "Group is already full."
            });

        }
         //--------------------------------------------------
        // Check duplicate pending request
        //--------------------------------------------------

        const { data: duplicateRequest, error: duplicateError } =
            await supabase
                .from("group_request")
                .select("id")
                .eq("group_id", groupId)
                .eq("sender_id", senderId)
                .eq("type", "join_request")
                .eq("status", "pending")
                .maybeSingle();

        if (duplicateError) {

            return res.status(500).json(duplicateError);

        }

        if (duplicateRequest) {

            return res.status(400).json({
                success: false,
                message: "You have already requested this group."
            });

        }


        //--------------------------------------------------
        // Insert requests
        //--------------------------------------------------

        const { error: insertError } = await supabase
            .from("group_request")
            .insert({

                group_id: groupId,

                sender_id: senderId,
                sender_request_id: senderRequestId,

                receiver_id: group.creator_id,
                receiver_request_id: group.ride_request_id,

                status: "pending",
                type: "join_request"

            });

        if (insertError) {
            return res.status(500).json(insertError);
        }
        await createNotification({

            userId: group.creator_id,

            type: "JOIN_REQUEST",

            actorId: senderId,

            groupId,

            rideRequestId: senderRequestId

        });
        res.json({

            success: true,
            message: "Join request sent."

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,
            error: err.message

        });

    }

});

////////////////////////////////////////////////////
/////// GET JOIN REQUESTS
////////////////////////////////////////////////////

app.get("/join-requests",requireAuth, async (req, res) => {

    const userId = req.user.uid;

    try {

        //--------------------------------------------------
        // Fetch all pending join requests addressed to user
        //--------------------------------------------------

        const { data: requests, error } = await supabase
            .from("group_request")
            .select(`
                *,
                groups(id, max_members),
                users!group_request_sender_id_fkey(
                    uid,
                    name,
                    mail,
                    phone
                ),
                ride_requests!group_request_sender_request_id_fkey(
                    source,
                    destination,
                    ride_date,
                    ride_time
                )
            `)
            .eq("receiver_id", userId)
            .eq("status", "pending");

        if (error) {

            console.error(error);

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

        res.json({
            success: true,
            requests: requests || []
        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

app.post("/matching-groups", requireAuth, async (req, res) => {
    const currentUserId = req.user.uid;
    const {
        currentRideRequestId,
        source,
        destination,
        ride_date,
        ride_time
    } = req.body;
    const { data: rideRequest, error: rideError } = await supabase
        .from("ride_requests")
        .select("user_id")
        .eq("id", currentRideRequestId)
        .single();

    if (rideError || !rideRequest) {
        return res.status(404).json({
            success: false,
            message: "Ride request not found."
        });
    }

    if (rideRequest.user_id !== req.user.uid) {
        return res.status(403).json({
            success: false,
            message: "Forbidden"
        });
    }
    try {

        const requestTime = new Date(`1970-01-01T${ride_time}`);

        const lowerTime = new Date(requestTime.getTime() - 15 * 60 * 1000)
            .toTimeString()
            .slice(0, 8);

        const upperTime = new Date(requestTime.getTime() + 15 * 60 * 1000)
            .toTimeString()
            .slice(0, 8);

        //---------------------------------------------------
        // Find matching ride requests
        //---------------------------------------------------

        const { data: matchingRequests, error: requestError } = await supabase
            .from("ride_requests")
            .select("id")
            .eq("source", source)
            .eq("destination", destination)
            .eq("ride_date", ride_date)
            .gte("ride_time", lowerTime)
            .lte("ride_time", upperTime);

        if (requestError) {
            return res.status(500).json(requestError);
        }

        if (!matchingRequests.length) {
            return res.json([]);
        }

        const requestIds = matchingRequests.map(r => r.id);

        //---------------------------------------------------
        // Find all groups on those requests
        //---------------------------------------------------

        const { data: groups, error: groupError } = await supabase
            .from("groups")
            .select("*")
            .in("ride_request_id", requestIds)
            .in("status", ["pending", "active"]);

        if (groupError) {
            console.error(groupError);

            return res.status(500).json({
                success:false,
                message:"Server error."
            });
        }

        const result = [];

        for (const group of groups) {

            //---------------------------------------
            // Ride info
            //---------------------------------------

            const { data: ride } = await supabase
                .from("ride_requests")
                .select("source,destination,ride_time")
                .eq("id", group.ride_request_id)
                .single();

            //---------------------------------------
            // Creator
            //---------------------------------------

            const { data: creator } = await supabase
                .from("users")
                .select("uid,name")
                .eq("uid", group.creator_id)
                .single();

            //---------------------------------------
            // Members
            //---------------------------------------

            const { data: members } = await supabase
                .from("group_members")
                .select(`
                    user_id,
                    ride_request_id,
                    users(name)
                `)
                .eq("group_id", group.id);

            //---------------------------------------
            // Is current user creator?
            //---------------------------------------

            const isCreator =
    group.ride_request_id === currentRideRequestId;


            //---------------------------------------
            // Is current user already member?
            //---------------------------------------

            const isMember =members.some(
                m => m.ride_request_id === currentRideRequestId
    );

            //---------------------------------------
            // Has user already sent request?
            //---------------------------------------

            const { data: myRequest } = await supabase
                .from("group_request")
                .select("id,status")
                .eq("group_id", group.id)
                .eq("sender_request_id", currentRideRequestId)
                .eq("type", "join_request")
                .maybeSingle();

            //---------------------------------------
            // Current member count
            //---------------------------------------

            let memberList = members.map(m => ({
                user_id: m.user_id,
                name: m.users.name
            }));

            // Creator isn't in group_members until
            // first acceptance, so show creator manually.

            if(memberList.length===0){

    continue;

}

            result.push({

                id: group.id,

                route: {
                    from: ride.source,
                    to: ride.destination
                },

                time: ride.ride_time,

                leader: creator.name,

                members: memberList,

                currentMembers: memberList.length,

                max_members: group.max_members,

                status: group.status,

                seatsLeft:Math.max(0,group.max_members - memberList.length),

                isCurrentGroup:
                    isCreator || isMember,

                requestSent:
                    myRequest &&
                    myRequest.status === "pending"

            });

        }

        res.json(result);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server error."
        });

    }

});

///////////////////////////////////////////////////
// Accept Join Request
///////////////////////////////////////////////////
app.post("/accept-join-request", requireAuth, async (req, res) => {

    const userId = req.user.uid;

    const { requestId } = req.body;

    try {

        //--------------------------------------------------
        // Fetch Join Request
        //--------------------------------------------------

        const { data: request, error: requestError } =
            await supabase
                .from("group_request")
                .select("*")
                .eq("id", requestId)
                .eq("type", "join_request")
                .single();

        if (requestError || !request) {

            return res.status(404).json({
                success: false,
                message: "Join request not found."
            });

        }
        if (request.receiver_id !== req.user.uid) {

            return res.status(403).json({
                success: false,
                message: "Forbidden"
            });

        }
        //--------------------------------------------------
        // Already processed?
        //--------------------------------------------------

        if (request.status !== "pending") {

            return res.status(400).json({
                success: false,
                message: "Request already processed."
            });

        }

        //--------------------------------------------------
        // Get Group
        //--------------------------------------------------

        const { data: group, error: groupError } =
            await supabase
                .from("groups")
                .select("*")
                .eq("id", request.group_id)
                .single();

        if (groupError || !group) {

            return res.status(404).json({
                success: false,
                message: "Group not found."
            });

        }

        //--------------------------------------------------
        // Verify approver belongs to group
        //--------------------------------------------------

        const { data: approver } =
            await supabase
                .from("group_members")
                .select("id")
                .eq("group_id", group.id)
                .eq("user_id", userId)
                .maybeSingle();

        if (!approver && group.creator_id !== userId) {

            return res.status(403).json({
                success: false,
                message: "Only group members can respond."
            });

        }

        //--------------------------------------------------
        // Has sender already joined another group?
        //--------------------------------------------------

        const { data: existingMembership } =
            await supabase
                .from("group_members")
                .select("group_id")
                .eq("ride_request_id", request.sender_request_id)
                .maybeSingle();

        if (existingMembership) {

            await supabase
                .from("group_request")
                .update({
                    status: "expired"
                })
                .eq("id", request.id);

            return res.status(400).json({
                success: false,
                message: "User has already joined another group."
            });

        }

        //--------------------------------------------------
        // Mark request accepted
        //--------------------------------------------------

        const { error: acceptError } =
            await supabase
                .from("group_request")
                .update({
                    status: "accepted"
                })
                .eq("id", request.id);

        if (acceptError) {

            return res.status(500).json(acceptError);

        }

        //--------------------------------------------------
        // Add sender as group member
        //--------------------------------------------------

        //--------------------------------------------------
        // Check group capacity
        //--------------------------------------------------

        const { data: currentMembers, error: memberCountError } =
            await supabase
                .from("group_members")
                .select("id")
                .eq("group_id", group.id);

        if (memberCountError) {
            return res.status(500).json({
                success: false,
                message: "Server Error"
            });
        }

        if (currentMembers.length >= group.max_members) {

            await supabase
                .from("group_request")
                .update({
                    status: "expired"
                })
                .eq("id", request.id);

            return res.status(400).json({
                success: false,
                message: "Group is already full."
            });

        }

        const { data: existingMember } =
            await supabase
                .from("group_members")
                .select("id")
                .eq("group_id", group.id)
                .eq("user_id", request.sender_id)
                .maybeSingle();

        if (!existingMember) {

            const { error: memberInsertError } =
                await supabase
                    .from("group_members")
                    .insert({

                        group_id: group.id,

                        user_id: request.sender_id,

                        ride_request_id: request.sender_request_id

                    });

            if (memberInsertError) {

                return res.status(500).json(memberInsertError);

            }

        }

        //--------------------------------------------------
        // Expire only invitations for the SAME ride request
        //--------------------------------------------------
        const { data: expiredInvitations } = await supabase
            .from("group_request")
            .select("*")
            .eq("receiver_request_id", request.sender_request_id)
            .eq("type", "invitation")
            .eq("status", "pending");
        await supabase
            .from("group_request")
            .update({
                status: "expired"
            })
            .eq("receiver_request_id", request.sender_request_id)
            .eq("type", "invitation")
            .eq("status", "pending");        
        for (const invitation of expiredInvitations || []) {

            await removePendingNotification({

                userId: invitation.receiver_id,

                type: "INVITATION_RECEIVED",

                groupId: invitation.group_id,

                rideRequestId: invitation.receiver_request_id

            });

        }

        //--------------------------------------------------
        // Expire only join requests for the SAME ride request
        //--------------------------------------------------
        const { data: expiredJoinRequests } = await supabase
            .from("group_request")
            .select("*")
            .eq("sender_request_id", request.sender_request_id)
            .eq("type", "join_request")
            .eq("status", "pending")
            .neq("id", request.id);    
        for (const joinRequest of expiredJoinRequests || []) {

            await removePendingNotification({

                userId: joinRequest.receiver_id,

                type: "JOIN_REQUEST",

                groupId: joinRequest.group_id,

                rideRequestId: joinRequest.sender_request_id

            });

        }
        await supabase
            .from("group_request")
            .update({
                status: "expired"
            })
            .eq("sender_request_id", request.sender_request_id)
            .eq("type", "join_request")
            .eq("status", "pending")
            .neq("id", request.id);

        //--------------------------------------------------
        // Group becomes active after first accepted member
        //--------------------------------------------------

            await supabase
                .from("groups")
                .update({
                    status: "active"
                })
                .eq("id", group.id);        
        //--------------------------------------------------
        // Success
        //--------------------------------------------------
        
        await createNotification({

            userId: request.sender_id,

            type: "JOIN_ACCEPTED",

            actorId: userId,

            groupId: group.id,

            rideRequestId: request.sender_request_id

        });

        return res.json({

            success: true,

            message: "Join request accepted."

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

///////////////////////////////////////////////////
// Reject Join Request
///////////////////////////////////////////////////
app.post("/reject-join-request", requireAuth, async (req, res) => {

    const { requestId } = req.body;
    const userId = req.user.uid;

    try {

        //--------------------------------------------------
        // Fetch Join Request
        //--------------------------------------------------

        const { data: request, error: requestError } =
            await supabase
                .from("group_request")
                .select("*")
                .eq("id", requestId)
                .eq("type", "join_request")
                .single();

        if (requestError || !request) {

            return res.status(404).json({
                success: false,
                message: "Join request not found."
            });

        }
        if (request.receiver_id !== req.user.uid) {

            return res.status(403).json({
                success: false,
                message: "Forbidden"
            });

        }
        //--------------------------------------------------
        // Already processed?
        //--------------------------------------------------

        if (request.status !== "pending") {

            return res.status(400).json({
                success: false,
                message: "Request already processed."
            });

        }

        //--------------------------------------------------
        // Fetch Group
        //--------------------------------------------------

        const { data: group, error: groupError } =
            await supabase
                .from("groups")
                .select("*")
                .eq("id", request.group_id)
                .single();

        if (groupError || !group) {

            return res.status(404).json({
                success: false,
                message: "Group not found."
            });

        }

        //--------------------------------------------------
        // Verify approver belongs to group
        //--------------------------------------------------

        const { data: approver } =
            await supabase
                .from("group_members")
                .select("id")
                .eq("group_id", group.id)
                .eq("user_id", userId)
                .maybeSingle();

        if (!approver && group.creator_id !== userId) {

            return res.status(403).json({
                success: false,
                message: "Only group members can respond."
            });

        }

        //--------------------------------------------------
        // Reject Request
        //--------------------------------------------------

        const { error: rejectError } =
            await supabase
                .from("group_request")
                .update({
                    status: "rejected"
                })
                .eq("id", request.id);

        if (rejectError) {

            return res.status(500).json(rejectError);

        }

        //--------------------------------------------------
        // Success
        //--------------------------------------------------

        await createNotification({

            userId: request.sender_id,

            type: "JOIN_REJECTED",

            actorId: userId,

            groupId: group.id,

            rideRequestId: request.sender_request_id

        });

        return res.json({

            success: true,

            message: "Join request rejected."

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

////////////////////////////////////////////////////
/////// GET INCOMING INVITATIONS
////////////////////////////////////////////////////

app.get("/incoming-invitations", requireAuth, async (req, res) => {

    const userId = req.user.uid;

    try {

        // Pending invitations received by this user
        const { data: invitations, error } = await supabase
            .from("group_request")
            .select(`
                group_id,
                sender_id,
                groups(
                    id,
                    max_members,
                    ride_request_id
                )
            `)
            .eq("receiver_id", userId)
            .eq("status", "pending")
            .eq("type", "invitation");

        if (error) {
            console.error(error);

                return res.status(500).json({
                    success:false,
                    message:"Server error."
                });
        }

        const result = [];

        for (const invite of invitations) {

            //--------------------------
            // Sender name
            //--------------------------

            const { data: sender } = await supabase
                .from("users")
                .select("name")
                .eq("uid", invite.sender_id)
                .single();

            //--------------------------
            // Ride information
            //--------------------------

            const { data: ride } = await supabase
                .from("ride_requests")
                .select(`
                    source,
                    destination,
                    ride_date,
                    ride_time
                `)
                .eq("id", invite.groups.ride_request_id)
                .single();

            result.push({

                groupId: invite.group_id,

                senderId: invite.sender_id,

                senderName: sender.name,

                source: ride.source,

                destination: ride.destination,

                ride_date: ride.ride_date,

                ride_time: ride.ride_time,

                max_members: invite.groups.max_members

            });

        }

        res.json(result);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server error."
        });

    }

});

////////////////////////////////////////////////////
/////// ACCEPT INVITATION
////////////////////////////////////////////////////

app.post("/accept-invitation", requireAuth, async (req, res) => {

    const { groupId } = req.body;
    const userId = req.user.uid;
    let creatorId;
    try {

        //------------------------------------------------
        // Find invitation
        //------------------------------------------------

        const { data: invitation, error: invitationError } =
            await supabase
                .from("group_request")
                .select(`*,groups(ride_request_id)`)
                .eq("group_id", groupId)
                .eq("receiver_id", userId)
                .eq("status", "pending")
                .eq("type", "invitation")
                .single();

        if (invitationError || !invitation) {
            return res.status(400).json({
                success: false,
                message: "Invitation not found."
            });
        }
        if (invitation.receiver_id !== req.user.uid) {

            return res.status(403).json({
                success: false,
                message: "Forbidden"
            });

        }
        //------------------------------------------------
        // Mark invitation accepted
        //------------------------------------------------

        const { error: updateError } =
            await supabase
                .from("group_request")
                .update({
                    status: "accepted"
                })
                .eq("id", invitation.id);

        if (updateError) {
            return res.status(500).json(updateError);
        }
        //------------------------------------------------
        // If this is the first accepted invitation,
        // add creator to group_members
        //------------------------------------------------

        const { data: existingMembers, error: existingMembersError } =
            await supabase
                .from("group_members")
                .select("id")
                .eq("group_id", groupId);

        if (existingMembersError) {
            return res.status(500).json(existingMembersError);
        }
                

        if (existingMembers.length === 0) {

            const { data: groupInfo, error: groupInfoError } =
                await supabase
                    .from("groups")
                    .select("creator_id,ride_request_id")
                    .eq("id", groupId)
                    .single();
            
            if (groupInfoError) {
                return res.status(500).json(groupInfoError);
            }
            creatorId = groupInfo.creator_id;
            const { data: creatorAlreadyExists } =
            await supabase
                .from("group_members")
                .select("id")
                .eq("group_id", groupId)
                .eq("user_id", groupInfo.creator_id)
                .maybeSingle();

        if (!creatorAlreadyExists) {

            const { error: creatorInsertError } =
                await supabase
                    .from("group_members")
                    .insert({

                        group_id: groupId,
                        user_id: groupInfo.creator_id,
                        ride_request_id: groupInfo.ride_request_id
                    });

            if (creatorInsertError) {
                return res.status(500).json(creatorInsertError);
            }

        }}
        //------------------------------------------------
        // Add member
        //------------------------------------------------

        const { error: memberError } =
            await supabase
                .from("group_members")
                .insert({
                    group_id: groupId,
                    user_id: userId,
                    ride_request_id: invitation.receiver_request_id
                });

        if (memberError) {
            console.error(memberError);

            return res.status(500).json({
                success:false,
                message:"Server error."
            });
        }
/*
        //------------------------------------------------
        // Update ride request status
        //------------------------------------------------

        await supabase
            .from("ride_requests")
            .update({
                status: "grouped"
            })
            .eq("user_id", userId);
*/
//------------------------------------------------
// Reject every other pending invitation
// for this user
//------------------------------------------------
const { data: expiredInvitations } = await supabase
    .from("group_request")
    .select("*")
    .eq("receiver_request_id", invitation.receiver_request_id)
    .eq("status", "pending")
    .eq("type", "invitation")
    .neq("group_id", groupId);
for (const invite of expiredInvitations || []) {

    await removePendingNotification({

        userId: invite.receiver_id,

        type: "INVITATION_RECEIVED",

        groupId: invite.group_id,

        rideRequestId: invite.receiver_request_id

    });

}    
await supabase
    .from("group_request")
    .update({
        status: "expired"
    })
    .eq(
        "receiver_request_id",
        invitation.receiver_request_id
    )
    .eq("status", "pending")
    .eq("type","invitation")
    .neq("group_id", groupId);

//------------------------------------------------
// Expire every pending join request
// sent by this user
//------------------------------------------------
const { data: expiredJoinRequests } = await supabase
    .from("group_request")
    .select("*")
    .eq("sender_request_id", invitation.receiver_request_id)
    .eq("status", "pending")
    .eq("type", "join_request");
for (const request of expiredJoinRequests || []) {

    await removePendingNotification({

        userId: request.receiver_id,

        type: "JOIN_REQUEST",

        groupId: request.group_id,

        rideRequestId: request.sender_request_id

    });

}
await supabase
    .from("group_request")
    .update({
        status: "expired"
    })
    .eq("sender_request_id", invitation.receiver_request_id)
    .eq("status", "pending")
    .eq("type", "join_request");
//------------------------------------------------
// Count members
//------------------------------------------------

const { data: members, error: membersError } =
    await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", groupId);

if (membersError) {
    return res.status(500).json(membersError);
}

const { data: group, error: groupError } =
    await supabase
        .from("groups")
        .select("max_members")
        .eq("id", groupId)
        .single();

if (groupError) {
    console.error(groupError);

    return res.status(500).json({
        success:false,
        message:"Server error."
    });
}

//------------------------------------------------
// Group becomes active after first acceptance
//------------------------------------------------

await supabase
    .from("groups")
    .update({
        status: "active"
    })
    .eq("id", groupId);

//------------------------------------------------
// Group is full
//------------------------------------------------


if (members.length === group.max_members) {
    const { data: fullGroupInvites } = await supabase
    .from("group_request")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .eq("type", "invitation");

    await supabase
        .from("group_request")
        .update({
            status: "expired"
        })
        .eq("group_id", groupId)
        .eq("type", "invitation")
        .eq("status", "pending");
    
    for (const invite of fullGroupInvites || []) {

    await removePendingNotification({

        userId: invite.receiver_id,

        type: "INVITATION_RECEIVED",

        groupId: invite.group_id,

        rideRequestId: invite.receiver_request_id

    });

}

}

if (!creatorId) {

    const { data: groupInfo } = await supabase
        .from("groups")
        .select("creator_id")
        .eq("id", groupId)
        .single();

    creatorId = groupInfo.creator_id;

}

await createNotification({

    userId: creatorId,

    type: "INVITATION_ACCEPTED",

    actorId: userId,

    groupId

});

res.json({
    success: true,
    message: "Invitation accepted."
});

}

catch (err) {

    console.error(err);

    res.status(500).json({
        success: false,
        message: "Server error."
    });

}

});

////////////////////////////////////////////////////
/////// REJECT INVITATION
////////////////////////////////////////////////////

app.post("/reject-invitation",requireAuth, async (req, res) => {

    const userId = req.user.uid;

    const { groupId } = req.body;
    const { data: groupData, error: groupDataError } =
        await supabase
            .from("groups")
            .select("creator_id")
            .eq("id", groupId)
            .single();

    if (groupDataError) {
        return res.status(500).json(groupDataError);
    }

    const creatorId = groupData.creator_id;
    try {

        //------------------------------------------------
        // Check invitation exists
        //------------------------------------------------

        const { data: invitation, error: invitationError } =
            await supabase
                .from("group_request")
                .select("id, receiver_id, receiver_request_id")
                .eq("receiver_id", userId)
                .eq("group_id", groupId)
                .eq("status", "pending")
                .eq("type", "invitation")
                .maybeSingle();

        if (invitationError) {
            return res.status(500).json(invitationError);
        }

        if (!invitation) {
            return res.status(400).json({
                success: false,
                message: "Invitation not found."
            });
        }
        if (invitation.receiver_id !== req.user.uid) {

            return res.status(403).json({
                success: false,
                message: "Forbidden"
            });

        }
        //------------------------------------------------
        // Reject invitation
        //------------------------------------------------

        const { error: updateError } =
            await supabase
                .from("group_request")
                .update({
                    status: "rejected"
                })
                .eq("id", invitation.id);

        if (updateError) {
            return res.status(500).json(updateError);
        }
        await createNotification({

            userId: creatorId,

            type: "INVITATION_REJECTED",

            actorId: userId,

            groupId

        });
        res.json({
            success: true,
            message: "Invitation rejected."
        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

////////////////////////////////////////////////////
/////// CANCEL INVITATION
////////////////////////////////////////////////////

app.post("/cancel-invitation",requireAuth, async (req, res) => {

    const senderId = req.user.uid;

    const {invitationId} = req.body;

    try {

        //--------------------------------------------------
        // Find invitation
        //--------------------------------------------------

        const { data: invitation, error: invitationError } =
            await supabase
                .from("group_request")
                .select("*")
                .eq("id", invitationId)
                .eq("sender_id", senderId)
                .eq("status", "pending")
                .eq("type", "invitation")
                .maybeSingle();

        if (invitationError) {

            return res.status(500).json(invitationError);

        }

        if (!invitation) {

            return res.status(404).json({

                success: false,

                message: "Invitation not found."

            });

        }
        await removePendingNotification({

            userId: invitation.receiver_id,

            type: "INVITATION_RECEIVED",

            groupId: invitation.group_id,

            rideRequestId: invitation.receiver_request_id

        });

        //--------------------------------------------------
        // Cancel invitation
        //--------------------------------------------------

        const { error: deleteError } =
            await supabase
                .from("group_request")
                .delete()
                .eq("id", invitationId);

        if (deleteError) {

            return res.status(500).json(deleteError);

        }

        res.json({

            success: true,

            message: "Invitation cancelled."

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

////////////////////////////////////////////////////
/////// OUTGOING INVITATIONS
////////////////////////////////////////////////////

app.get("/outgoing-invitations",requireAuth, async (req, res) => {

    const userId = req.user.uid;

    try {

        //------------------------------------------------
        // Invitations sent by this user
        //------------------------------------------------

        const { data: invitations, error } = await supabase
            .from("group_request")
            .select(`
                status,
                receiver_id,
                receiver_request_id,
                groups(
                    id,
                    ride_request_id,
                    max_members,
                    status
                )
            `)
            .eq("sender_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error(error);

            return res.status(500).json({
                success:false,
                message:"Server error."
            });
        }

        const result = [];

        for (const invite of invitations) {

            //--------------------------------------
            // Receiver details
            //--------------------------------------

            const { data: receiver } = await supabase
                .from("users")
                .select("uid,name")
                .eq("uid", invite.receiver_id)
                .single();

            //--------------------------------------
            // Receiver ride
            //--------------------------------------

            const { data: ride } = await supabase
                .from("ride_requests")
                .select(`
                    source,
                    destination,
                    ride_date,
                    ride_time
                `)
                .eq("id", invite.receiver_request_id)
                .single();

            result.push({

                groupId: invite.groups.id,

                receiverId: receiver.uid,

                receiverName: receiver.name,

                source: ride.source,

                destination: ride.destination,

                ride_date: ride.ride_date,

                ride_time: ride.ride_time,

                invitationStatus: invite.status,

                groupStatus: invite.groups.status

            });

        }

        res.json(result);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server error."
        });

    }

});

app.get("/my-ride-requests", requireAuth, async (req, res) => {

    
    const userId = req.user.uid;

    try {

        ////////////////////////////////////////////////////
        // Pending invitations received
        ////////////////////////////////////////////////////

        const { data: invitations, error: invitationError } = await supabase
            .from("group_request")
            .select(`
                id,
                status,
                sender_request_id,
                group_id
            `)
            .eq("receiver_id", userId)
            .eq("status", "pending")
            .eq("type", "invitation");

        if (invitationError) throw invitationError;

        const invitationResult = [];

for (const invite of invitations) {

    const { data: senderRequest } = await supabase
        .from("ride_requests")
        .select(`
            source,
            destination,
            ride_date,
            ride_time,
            user_id
        `)
        .eq("id", invite.sender_request_id)
        .maybeSingle();

    // Skip broken invitation
    if (!senderRequest) {

        console.log(
            "Skipping orphan invitation:",
            invite.id
        );

        continue;
    }

    const { data: sender } = await supabase
        .from("users")
        .select("name")
        .eq("uid", senderRequest.user_id)
        .maybeSingle();

    const { data: group } = await supabase
        .from("groups")
        .select("max_members")
        .eq("id", invite.group_id)
        .maybeSingle();

    invitationResult.push({

        id: invite.id,
        group_id: invite.group_id,

        sender_request: {

            source: senderRequest.source,
            destination: senderRequest.destination,
            ride_date: senderRequest.ride_date,
            ride_time: senderRequest.ride_time,

            users: {
                name: sender?.name || "Unknown User"
            }

        },

        ride_groups: {
            max_members: group?.max_members || 0
        }

    });

}

        ////////////////////////////////////////////////////
        // Active Ride Requests
        ////////////////////////////////////////////////////

        const { data: requests, error: requestError } = await supabase
            .from("ride_requests")
            .select("*")
            .eq("user_id", userId)
            .neq("status", "completed")
            .order("ride_date")
            .order("ride_time");

        if (requestError) throw requestError;

        const activeRequests = [];

        for (const request of requests) {

            let groupStatus = "looking";
            let rideGroup = null;
            let outgoingInvites = [];
            let groupSummary = null;

            //////////////////////////////////////////////////////
            // Is this request the creator of a group?
            //////////////////////////////////////////////////////

            const { data: creatorGroup } = await supabase
                .from("groups")
                .select("id,max_members,status")
                .eq("ride_request_id", request.id)
                .maybeSingle();

            if (creatorGroup) {

                rideGroup = creatorGroup;

                if (creatorGroup.status === "pending") {

                    groupStatus = "pending";

                    const { data: invites } = await supabase
                        .from("group_request")
                        .select(`
                            id,
                            status,
                            receiver_id,
                            receiver_request_id
                        `)
                        .eq("group_id", creatorGroup.id)
                        .eq("type", "invitation");

                    outgoingInvites = [];

                    for (const invite of invites || []) {

                        const { data: user } = await supabase
                            .from("users")
                            .select("name")
                            .eq("uid", invite.receiver_id)
                            .maybeSingle();

                        outgoingInvites.push({

                            name: user?.name || "Unknown",

                            initials: (user?.name || "U")
                                .split(" ")
                                .map(x => x[0])
                                .join("")
                                .substring(0,2)
                                .toUpperCase(),

                            color: "#2563EB",

                            status: invite.status

                        });

                    }

                }

                else if (creatorGroup.status === "active") {

                    groupStatus = "ingroup";

                    const { count } = await supabase
                        .from("group_members")
                        .select("*", {
                            count: "exact",
                            head: true
                        })
                        .eq("group_id", creatorGroup.id);

                    groupSummary = {

                        currentMembers: (count || 0) + 1,

                        max_members: creatorGroup.max_members

                    };

                }

            }

            //////////////////////////////////////////////////////
            // Is this request a MEMBER of someone else's group?
            //////////////////////////////////////////////////////

            else {

                const { data: membership } = await supabase
                    .from("group_members")
                    .select(`
                        group_id,
                        groups(
                            id,
                            max_members,
                            status
                        )
                    `)
                    .eq("ride_request_id", request.id)
                    .maybeSingle();

                if (membership) {

                    groupStatus = "ingroup";

                    rideGroup = membership.groups;

                    const { count } = await supabase
                        .from("group_members")
                        .select("*", {
                            count: "exact",
                            head: true
                        })
                        .eq("group_id", membership.group_id);

                    groupSummary = {

                        currentMembers: (count || 0) + 1,

                        max_members: membership.groups.max_members

                    };

                }

            }

            activeRequests.push({

                ...request,

                groupStatus,

                outgoingInvites,

                groupSummary,

                ride_groups: rideGroup

            });

        }

        ////////////////////////////////////////////////////
// Ride History
////////////////////////////////////////////////////

const { data: completedRequests, error: historyError } = await supabase
    .from("ride_requests")
    .select(`
        id,
        source,
        destination,
        ride_date,
        ride_time,
        completed_at
    `)
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

if (historyError) throw historyError;

const history = [];

for (const ride of completedRequests) {

    // If this ride request is part of a group, this row will exist.
    const { data: membership, error: membershipError } = await supabase
        .from("group_members")
        .select(`
            group_id,
            groups(
                id,
                max_members,
                status,
                ride_request_id
            )
        `)
        .eq("ride_request_id", ride.id)
        .maybeSingle();

    if (membershipError) throw membershipError;

    let members = [];
    let rideType = "solo";
    let maxMembers = 1;

    if (membership && membership.groups) {
        rideType = "group";
        maxMembers = membership.groups.max_members || 1;

        const { data: groupMembers, error: groupMembersError } = await supabase
            .from("group_members")
            .select(`
                user_id,
                users(name)
            `)
            .eq("group_id", membership.group_id);

        if (groupMembersError) throw groupMembersError;

        members = (groupMembers || []).map(member => {
            const name = member.users?.name || "Unknown";
            return {
                user_id: member.user_id,
                name,
                initials: name
                    .split(" ")
                    .map(word => word[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase(),
                color: "#60A5FA"
            };
        });
    }

    history.push({
        id: ride.id,
        from: ride.source,
        to: ride.destination,
        date: ride.ride_date,
        time: ride.ride_time,
        completedAt: ride.completed_at,
        rideType,
        members,
        max_members: maxMembers
    });
}
        ////////////////////////////////////////////////////

        res.json({

            invitations: invitationResult,

            requests: activeRequests,

            history

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            error: "Failed to load ride requests"

        });

    }

});

////////////////////////////////////////////////////
/////// ACTIVE GROUPS
////////////////////////////////////////////////////

app.get("/active-groups", requireAuth, async (req, res) => {
    
    const userId = req.user.uid;
    try {

        //--------------------------------------------------
        // Find every group the user belongs to
        //--------------------------------------------------

        const { data: memberships, error: memberError } =
            await supabase
                .from("group_members")
                .select("group_id")
                .eq("user_id", userId);

        if (memberError) {
            console.error(memberError);

            return res.status(500).json({
                success:false,
                message:"Server error."
            });
        }

        if (!memberships || memberships.length === 0) {

            return res.json([]);

        }

        const result = [];

        //--------------------------------------------------
        // Build each group
        //--------------------------------------------------

        for (const membership of memberships) {

            //----------------------------------------------
            // Group
            //----------------------------------------------

            const { data: group, error: groupError } =
                await supabase
                    .from("groups")
                    .select("*")
                    .eq("id", membership.group_id)
                    .single();

            if (groupError || !group) {
                continue;
            }

            //----------------------------------------------
            // Creator Ride Request
            //----------------------------------------------

            const { data: ride, error: rideError } =
                await supabase
                    .from("ride_requests")
                    .select(`
                        source,
                        destination,
                        ride_date,
                        ride_time
                    `)
                    .eq("id", group.ride_request_id)
                    .single();

            if (rideError || !ride) {
                continue;
            }

            //----------------------------------------------
            // Members
            //----------------------------------------------

            const { data: members, error: membersError } =
                await supabase
                    .from("group_members")
                    .select(`
                        user_id,
                        joined_at,
                        users(
                            uid,
                            name,
                            phone,
                            block
                        )
                    `)
                    .eq("group_id", group.id)
                    .order("joined_at", {
                        ascending: true
                    });

            if (membersError) {
                return res.status(500).json(membersError);
            }

            //----------------------------------------------
            // Build Member List
            //----------------------------------------------

            const memberList = members.map(member => ({

                user_id: member.user_id,

                name: member.users.name,

                phone: member.users.phone,

                block: member.users.block,

                joined_at: member.joined_at,

                isCreator:
                    member.user_id === group.creator_id

            }));
            //--------------------------------------------------
            // Pending Join Requests
            //--------------------------------------------------

            const { data: joinRequests, error: joinRequestError } =
            await supabase
                .from("group_request")
                .select(`
                    id,
                    sender_id,
                    sender_request_id,
                    users!group_request_sender_id_fkey(
                        uid,
                        name
                    )
                `)
                .eq("group_id", group.id)
                .eq("status", "pending")
                .eq("type", "join_request");

            if (joinRequestError) {
                return res.status(500).json(joinRequestError);
            }

            const formattedJoinRequests = joinRequests.map(r => ({

                id: r.id,

                userId: r.sender_id,

                requestId: r.sender_request_id,

                name: r.users.name

            }));
            //--------------------------------------------------
            // Pending Invitations
            //--------------------------------------------------

            const { data: invitations, error: invitationError } =
            await supabase
                .from("group_request")
                .select(`
                    id,
                    receiver_id,
                    receiver_request_id,
                    users!group_request_receiver_id_fkey(
                        uid,
                        name
                    )
                `)
                .eq("group_id", group.id)
                .eq("status", "pending")
                .eq("type", "invitation");

            if (invitationError) {
                return res.status(500).json(invitationError);
            }

            const formattedInvitations = invitations.map(i => ({

                id: i.id,

                userId: i.receiver_id,

                requestId: i.receiver_request_id,

                name: i.users.name,

                status: "Pending"

            }));
            //----------------------------------------------
            // Response
            //----------------------------------------------

            result.push({

                groupId: group.id,
                creatorId: group.creator_id,
                creatorRideRequestId: group.ride_request_id,
                rideRequestId: group.ride_request_id,
                status: group.status,
                max_members: group.max_members,
                currentMembers: memberList.length,
                availableSeats:
                    Math.max(
                        0,
                        group.max_members - memberList.length
                    ),

                source: ride.source,
                destination: ride.destination,
                ride_date: ride.ride_date,
                ride_time: ride.ride_time,
                whatsappLink: group.whatsapp_link || "",
                members: memberList,
                joinRequests: formattedJoinRequests,
                pendingInvitations: formattedInvitations,
                isCreator:
                    group.creator_id === userId

            });

        }

        res.json(result);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            error: err.message

        });

    }

});

////////////////////////////////////////////////////
/////// INVITE MEMBERS TO EXISTING GROUP
////////////////////////////////////////////////////

app.post("/invite-members-existinggc", requireAuth, async (req, res) => {

    const senderId = req.user.uid;

    const {

        groupId,
        senderRequestId,
        selectedUsers

    } = req.body;
    const { data: rideRequest, error: rideError } = await supabase
        .from("ride_requests")
        .select("user_id")
        .eq("id", senderRequestId)
        .single();

    if (rideError || !rideRequest) {

        return res.status(404).json({
            success: false,
            message: "Ride request not found."
        });

    }

    if (rideRequest.user_id !== req.user.uid) {

        return res.status(403).json({
            success: false,
            message: "Forbidden"
        });

    }
    try {

        //--------------------------------------------------
        // Fetch Group
        //--------------------------------------------------

        const { data: group, error: groupError } =
            await supabase
                .from("groups")
                .select("*")
                .eq("id", groupId)
                .single();

        if (groupError || !group) {

            return res.status(404).json({

                success: false,

                message: "Group not found."

            });

        }
        //--------------------------------------------------
        // Verify sender belongs to this group
        //--------------------------------------------------

        const { data: membership, error: membershipError } =
            await supabase
                .from("group_members")
                .select("id")
                .eq("group_id", groupId)
                .eq("user_id", senderId)
                .maybeSingle();

        if (membershipError) {

            return res.status(500).json(membershipError);

        }

        if (!membership && group.creator_id !== senderId) {

            return res.status(403).json({

                success: false,

                message: "You are not a member of this group."

            });

        }
        //--------------------------------------------------
        // Count current members
        //--------------------------------------------------

        const { data: members, error: membersError } =
            await supabase
                .from("group_members")
                .select("user_id")
                .eq("group_id", groupId);

        if (membersError) {
            return res.status(500).json(membersError);
        }

        //--------------------------------------------------
        // Check if group is already full
        //--------------------------------------------------

        if (members.length >= group.max_members) {

            return res.status(400).json({

                success: false,

                message: "Group is already full."

            });

        }
                //--------------------------------------------------
        // Existing members
        //--------------------------------------------------

        const memberIds = new Set(
            members.map(m => m.user_id)
        );

        //--------------------------------------------------
        // Existing pending invitations
        //--------------------------------------------------

        const { data: existingInvites, error: inviteError } =
            await supabase
                .from("group_request")
                .select("receiver_id")
                .eq("group_id", groupId)
                .eq("status", "pending")
                .eq("type", "invitation");

        if (inviteError) {
            return res.status(500).json(inviteError);
        }

        const invitedIds = new Set(
            existingInvites.map(i => i.receiver_id)
        );

        //--------------------------------------------------
        // Filter users
        //--------------------------------------------------

        const usersToInvite = selectedUsers.filter(student =>

            !memberIds.has(student.user_id) &&
            !invitedIds.has(student.user_id)

        );

        if (usersToInvite.length === 0) {

            return res.json({

                success: true,

                message: "No new users to invite."

            });

        }
        //--------------------------------------------------
        // Insert invitations
        //--------------------------------------------------

        const requests = usersToInvite.map(student => ({

            group_id: groupId,

            sender_id: senderId,

            sender_request_id: senderRequestId,

            receiver_id: student.user_id,

            receiver_request_id: student.request_id,

            status: "pending",

            type: "invitation"

        }));

        const { error: requestError } =
            await supabase
                .from("group_request")
                .insert(requests);

        if (requestError) {

            return res.status(500).json(requestError);

        }

        for (const invitation of requests) {

            await createNotification({

                userId: invitation.receiver_id,

                type: "INVITATION_RECEIVED",

                actorId: senderId,

                groupId,

                rideRequestId: invitation.receiver_request_id

            });

        }

        return res.json({

            success: true,

            message: `${requests.length} invitation(s) sent.`,

            invitedCount: requests.length,

            groupId

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            error: err.message

        });

    }

});

////////////////////////////////////////////////////
// NOTIFICTION
////////////////////////////////////////////////////

app.get("/notifications", requireAuth, async (req, res) => {

    const userId = req.user.uid;

    try {

        const { data: notifications, error } = await supabase
            .from("notifications")
            .select(`
                *,
                actor:actor_id (
                    name
                )
            `)
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        const formatted = notifications.map(notification => {

            const actorName =
                notification.actor?.name || "Someone";

            let title = "";
            let message = "";

            switch (notification.type) {

                case "INVITATION_RECEIVED":
                    title = "Ride Invitation";
                    message = `${actorName} invited you to join a ride.`;
                    break;

                case "INVITATION_ACCEPTED":
                    title = "Invitation Accepted";
                    message = `${actorName} accepted your invitation.`;
                    break;

                case "INVITATION_REJECTED":
                    title = "Invitation Rejected";
                    message = `${actorName} rejected your invitation.`;
                    break;

                case "JOIN_REQUEST":
                    title = "Join Request";
                    message = `${actorName} requested to join your ride.`;
                    break;

                case "JOIN_ACCEPTED":
                    title = "Join Request Accepted";
                    message = `${actorName} accepted your join request.`;
                    break;

                case "JOIN_REJECTED":
                    title = "Join Request Rejected";
                    message = `${actorName} rejected your join request.`;
                    break;

                case "MEMBER_LEFT":
                    title = "Member Left";
                    message = `${actorName} left your ride group.`;
                    break;

                case "CREATOR_CHANGED":
                    title = "New Creator";
                    message = `${actorName} is now the group creator.`;
                    break;

                case "GROUP_DISSOLVED":
                    title = "Group Dissolved";
                    message = "Your ride group has been dissolved.";
                    break;

                case "RIDE_COMPLETED":
                    title = "Ride Completed";
                    message = "Your ride has been marked as completed.";
                    break;

                default:
                    title = "Notification";
                    message = "You have a new notification.";
            }

            return {

                id: notification.id,

                type: notification.type,

                title,

                message,

                actorName,

                isRead: notification.is_read,

                createdAt: notification.created_at,

                groupId: notification.group_id,

                rideRequestId: notification.ride_request_id

            };

        });

        res.json(formatted);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});


app.post("/notification/read",requireAuth, async (req, res) => {

    const { notificationId } = req.body;

    try {

        const { error } = await supabase
            .from("notifications")
            .update({
                is_read: true
            })
            .eq("id", notificationId)
            .eq("user_id", req.user.uid);

        if (error) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

        res.json({
            success: true,
            message: "Notification marked as read."
        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});


app.post("/notification/read-all", requireAuth, async (req, res) => {

    const userId  = req.user.uid;

    try {

        const { error } = await supabase
            .from("notifications")
            .update({
                is_read: true
            })
            .eq("user_id", userId)
            .eq("is_read", false);

        if (error) {

            return res.status(500).json({
                success: false,
                message: error.message
            });

        }

        res.json({
            success: true,
            message: "All notifications marked as read."
        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

////////////////////////////////////////////////////
// LEAVE GROUP
////////////////////////////////////////////////////
app.post("/leave-group", requireAuth, async (req, res) => {

    const userId = req.user.uid;
    const { groupId } = req.body;

    try {

        //--------------------------------------------------
        // Get group
        //--------------------------------------------------

        const { data: group, error: groupError } =
            await supabase
                .from("groups")
                .select("*")
                .eq("id", groupId)
                .single();
        if (groupError || !group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }


        const { data: creatorMembership } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", groupId)
            .eq("user_id", group.creator_id)
            .maybeSingle();

        if (!creatorMembership && group.creator_id !== req.user.uid) {
            return res.status(403).json({
                success: false,
                message: "Forbidden"
            });
        }

        //--------------------------------------------------
        // Check user belongs to group
        //--------------------------------------------------

        const { data: member, error: memberError } =
            await supabase
                .from("group_members")
                .select("*")
                .eq("group_id", groupId)
                .eq("user_id", userId)
                .maybeSingle();

        if (memberError) {
            console.error(memberError);
            return res.status(500).json({
                success: false,
                message: "Server error."
            });
        }

        if (!member) {
            return res.status(400).json({
                success: false,
                message: "User is not part of this group."
            });
        }
        
        //--------------------------------------------------
        // Ride request comes directly from membership
        //--------------------------------------------------

        const userRideRequest = {
        id: member.ride_request_id
        };

        //--------------------------------------------------
        // Is creator?
        //--------------------------------------------------

        const isCreator = group.creator_id === userId;

        ////////////////////////////////////////////////////
        // NON-CREATOR LEAVING
        ////////////////////////////////////////////////////
        if (!isCreator) {

            //--------------------------------------------------
            // Remove member from group_members
            //--------------------------------------------------

            const { error: removeError } =
                await supabase
                    .from("group_members")
                    .delete()
                    .eq("group_id", groupId)
                    .eq("user_id", userId);

            if (removeError) {
                return res.status(500).json(removeError);
            }

            //--------------------------------------------------
            // Remove this user's accepted request record
            // Works whether they joined via invitation or join request
            //--------------------------------------------------

            await supabase
                .from("group_request")
                .delete()
                .eq("group_id", groupId)
                .eq("status", "accepted")
                .or(`receiver_id.eq.${userId},sender_id.eq.${userId}`);

            //--------------------------------------------------
            // Update user's ride request back to open
            //--------------------------------------------------

            if (userRideRequest) {
                await supabase
                    .from("ride_requests")
                    .update({
                        status: "open"
                    })
                    .eq("id", userRideRequest.id);
            }

            //--------------------------------------------------
            // Delete any pending requests for this user in this group
            //--------------------------------------------------

            await supabase
                .from("group_request")
                .delete()
                .eq("group_id", groupId)
                .or(`receiver_id.eq.${userId},sender_id.eq.${userId}`);

            //--------------------------------------------------
            // Check remaining members
            //--------------------------------------------------

            const { data: remainingMembers, error: remainingError } =
                await supabase
                    .from("group_members")
                    .select("*")
                    .eq("group_id", groupId)
                    .order("joined_at", { ascending: true });

            if (remainingError) {
                return res.status(500).json(remainingError);
            }



            //--------------------------------------------------
            // Group survives normally
            //--------------------------------------------------

            if (remainingMembers.length > 1) {
                    //--------------------------------------------------
                    // Notify remaining members
                    //--------------------------------------------------

                    for (const remainingMember of remainingMembers) {

                        await createNotification({

                            userId: remainingMember.user_id,

                            type: "MEMBER_LEFT",

                            actorId: userId,

                            groupId

                        });

                    }
                return res.json({
                    success: true,
                    message: "Left group successfully."
                });
            }

            //--------------------------------------------------
            // Only one member left -> dissolve group
            //--------------------------------------------------

            if (remainingMembers.length === 1) {
                const survivor = remainingMembers[0];

                const survivorRequest = {
                    id: survivor.ride_request_id
                };

                if (survivorRequest) {
                    await supabase
                        .from("ride_requests")
                        .update({
                            status: "open"
                        })
                        .eq("id", survivorRequest.id);
                }

                await createNotification({

                    userId: survivor.user_id,

                    type: "GROUP_DISSOLVED",

                    actorId: userId,

                    groupId

                });

                await supabase
                    .from("group_members")
                    .delete()
                    .eq("group_id", groupId);
                const { data: pendingRequests } = await supabase
                    .from("group_request")
                    .select("*")
                    .eq("group_id", groupId);

                for (const request of pendingRequests || []) {

                    if (request.status !== "pending")
                        continue;

                    if (request.type === "invitation") {

                        await removePendingNotification({

                            userId: request.receiver_id,
                            type: "INVITATION_RECEIVED",
                            groupId: request.group_id,
                            rideRequestId: request.receiver_request_id

                        });

                    }

                    else if (request.type === "join_request") {

                        await removePendingNotification({

                            userId: request.receiver_id,
                            type: "JOIN_REQUEST",
                            groupId: request.group_id,
                            rideRequestId: request.sender_request_id

                        });

                    }

                }
                await supabase
                    .from("group_request")
                    .delete()
                    .eq("group_id", groupId);

                await supabase
                    .from("groups")
                    .delete()
                    .eq("id", groupId);

                return res.json({
                    success: true,
                    message: "Group dissolved."
                });
            }

            //--------------------------------------------------
            // No members left -> just cleanup
            //--------------------------------------------------

            await supabase
                .from("group_members")
                .delete()
                .eq("group_id", groupId);
            const { data: pendingRequests } = await supabase
                .from("group_request")
                .select("*")
                .eq("group_id", groupId);

            for (const request of pendingRequests || []) {

                if (request.status !== "pending")
                    continue;

                if (request.type === "invitation") {

                    await removePendingNotification({

                        userId: request.receiver_id,
                        type: "INVITATION_RECEIVED",
                        groupId: request.group_id,
                        rideRequestId: request.receiver_request_id

                    });

                }

                else if (request.type === "join_request") {

                    await removePendingNotification({

                        userId: request.receiver_id,
                        type: "JOIN_REQUEST",
                        groupId: request.group_id,
                        rideRequestId: request.sender_request_id

                    });

                }

            }
            await supabase
                .from("group_request")
                .delete()
                .eq("group_id", groupId);

            await supabase
                .from("groups")
                .delete()
                .eq("id", groupId);

            return res.json({
                success: true,
                message: "Group dissolved."
            });
        }

        ////////////////////////////////////////////////////
        // CREATOR LEAVING
        ////////////////////////////////////////////////////

        //--------------------------------------------------
        // Remove creator from group_members
        //--------------------------------------------------

        const { error: removeCreatorError } =
            await supabase
                .from("group_members")
                .delete()
                .eq("group_id", groupId)
                .eq("user_id", userId);

        if (removeCreatorError) {
            return res.status(500).json(removeCreatorError);
        }

        //--------------------------------------------------
        // Creator ride request becomes open
        //--------------------------------------------------

        await supabase
            .from("ride_requests")
            .update({
                status: "open"
            })
            .eq("id", userRideRequest.id);

        //--------------------------------------------------
        // Remaining members after creator leaves
        //--------------------------------------------------

        const { data: remainingMembers, error: remainingError } =
            await supabase
                .from("group_members")
                .select("*")
                .eq("group_id", groupId)
                .order("joined_at", { ascending: true });

        if (remainingError) {
            return res.status(500).json(remainingError);
        }

        //--------------------------------------------------
        // Only one member left -> dissolve group
        //--------------------------------------------------

        if (remainingMembers.length === 1) {
            const survivor = remainingMembers[0];

            const survivorRideRequest = {
                id: survivor.ride_request_id
            };

            if (survivorRideRequest) {
                await supabase
                    .from("ride_requests")
                    .update({
                        status: "open"
                    })
                    .eq("id", survivorRideRequest.id);
            }

            await createNotification({

                userId: survivor.user_id,

                type: "GROUP_DISSOLVED",

                actorId: userId,

                groupId

            });

            await supabase
                .from("group_members")
                .delete()
                .eq("group_id", groupId);
            
            const { data: pendingRequests } = await supabase
                .from("group_request")
                .select("*")
                .eq("group_id", groupId);

            for (const request of pendingRequests || []) {

                if (request.status !== "pending")
                    continue;

                if (request.type === "invitation") {

                    await removePendingNotification({

                        userId: request.receiver_id,
                        type: "INVITATION_RECEIVED",
                        groupId: request.group_id,
                        rideRequestId: request.receiver_request_id

                    });

                }

                else if (request.type === "join_request") {

                    await removePendingNotification({

                        userId: request.receiver_id,
                        type: "JOIN_REQUEST",
                        groupId: request.group_id,
                        rideRequestId: request.sender_request_id

                    });

                }

            }

            await supabase
                .from("group_request")
                .delete()
                .eq("group_id", groupId);

            await supabase
                .from("groups")
                .delete()
                .eq("id", groupId);

            return res.json({
                success: true,
                message: "Group dissolved."
            });
        }

        //--------------------------------------------------
        // Assign new creator
        //--------------------------------------------------

        const newCreator = remainingMembers[0];

        const newCreatorRideRequest = {
            id: newCreator.ride_request_id
        };

        //--------------------------------------------------
        // Update group owner + ride request
        //--------------------------------------------------

        const { error: updateGroupError } =
            await supabase
                .from("groups")
                .update({
                    creator_id: newCreator.user_id,
                    ride_request_id: newCreatorRideRequest.id
                })
                .eq("id", groupId);

        if (updateGroupError) {
            return res.status(500).json(updateGroupError);
        }

        //--------------------------------------------------
        // Remove the accepted request that made the new creator a member
        // Works for both invitation and join request
        //--------------------------------------------------

        await supabase
            .from("group_request")
            .delete()
            .eq("group_id", groupId)
            .eq("status", "accepted")
            .or(`receiver_id.eq.${newCreator.user_id},sender_id.eq.${newCreator.user_id}`);

        //--------------------------------------------------
        // Transfer pending invitations sent by the old creator
        //--------------------------------------------------

        await supabase
            .from("group_request")
            .update({
                sender_id: newCreator.user_id,
                sender_request_id: newCreatorRideRequest.id
            })
            .eq("group_id", groupId)
            .eq("type", "invitation")
            .eq("sender_id", userId);

        //--------------------------------------------------
        // Transfer pending join requests to the new creator
        //--------------------------------------------------

        await supabase
            .from("group_request")
            .update({
                receiver_id: newCreator.user_id,
                receiver_request_id: newCreatorRideRequest.id
            })
            .eq("group_id", groupId)
            .eq("type", "join_request")
            .eq("receiver_id", userId);

        //--------------------------------------------------
        // Notify remaining members about new creator
        //--------------------------------------------------

        for (const member of remainingMembers) {

            await createNotification({

                userId: member.user_id,

                type: "CREATOR_CHANGED",

                actorId: newCreator.user_id,

                groupId

            });

        }

        return res.json({
            success: true,
            message: "Creator left successfully."
        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

////////////////////////////////////////////////////
/////// UPDATE GROUP WHATSAPP LINK
////////////////////////////////////////////////////

app.post("/group-whatsapp", requireAuth, async (req, res) => {

    const userId = req.user.uid;

    const {
        groupId,
        whatsappLink
    } = req.body;

    try {

        //--------------------------------------------------
        // Find group
        //--------------------------------------------------

        const { data: group, error: groupError } =
            await supabase
                .from("groups")
                .select("creator_id")
                .eq("id", groupId)
                .single();

        if (groupError || !group) {

            return res.status(404).json({
                success: false,
                message: "Group not found."
            });

        }

        //--------------------------------------------------
        // Check user is a member of the group
        //--------------------------------------------------

const { data: member, error: memberError } =
    await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle();

if (memberError) {
    console.error(memberError);
    return res.status(500).json({
        success: false,
        message: "Server error."
    });
}

if (!member) {

    return res.status(403).json({
        success: false,
        message: "Only group members can update the WhatsApp link."
    });

}
        //--------------------------------------------------
        // Update link
        //--------------------------------------------------

        const { error: updateError } =
            await supabase
                .from("groups")
                .update({
                    whatsapp_link: whatsappLink
                })
                .eq("id", groupId);

        if (updateError) {

            console.error(updateError);
            return res.status(500).json({
                success: false,
                message: "Server error."
            });

        }

        res.json({

            success: true,

            whatsappLink

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            error: err.message

        });

    }

});

////////////////////////////////////////////////////
/////// DELETE RIDE REQUEST
////////////////////////////////////////////////////

app.delete("/ride-request/:requestId", requireAuth, async (req, res) => {

    const requestId = req.params.requestId;

    try {

        //--------------------------------------------------
        // Get Ride Request
        //--------------------------------------------------

        const { data: rideRequest, error: rideError } =
            await supabase
                .from("ride_requests")
                .select("*")
                .eq("id", requestId)
                .single();

        if (rideError || !rideRequest) {

            return res.status(404).json({
                success: false,
                message: "Ride request not found."
            });

        }
        if (rideRequest.user_id !== req.user.uid) {

            return res.status(403).json({
                success: false,
                message: "Forbidden"
            });

        }

        //--------------------------------------------------
        // Check whether this ride request owns a group
        //--------------------------------------------------

        const { data: group, error: groupError } =
            await supabase
                .from("groups")
                .select("*")
                .eq("ride_request_id", requestId)
                .maybeSingle();

        if (groupError) {

            console.error(groupError);

            return res.status(500).json({
                success:false,
                message:"Server error."
            });

        }

        ////////////////////////////////////////////////////
        // CASE 1
        // Looking for Group
        ////////////////////////////////////////////////////

        if (!group) {

            const { error: deleteRideError } =
                await supabase
                    .from("ride_requests")
                    .delete()
                    .eq("id", requestId);

            if (deleteRideError) {

                return res.status(500).json(deleteRideError);

            }

            return res.json({

                success: true,

                message: "Ride request deleted."

            });

        }

        ////////////////////////////////////////////////////
        // CASE 2
        // Pending Group
        ////////////////////////////////////////////////////

        if (group.status === "pending") {

            //------------------------------------------
            // Delete all invitations / join requests
            //------------------------------------------
            const { data: pendingRequests } = await supabase
                .from("group_request")
                .select("*")
                .eq("group_id", group.id);
             for (const request of pendingRequests || []) {

                if (request.status !== "pending")
                    continue;

                if (request.type === "invitation") {

                    await removePendingNotification({

                        userId: request.receiver_id,

                        type: "INVITATION_RECEIVED",

                        groupId: request.group_id,

                        rideRequestId: request.receiver_request_id

                    });

                }

                else if (request.type === "join_request") {

                    await removePendingNotification({

                        userId: request.receiver_id,

                        type: "JOIN_REQUEST",

                        groupId: request.group_id,

                        rideRequestId: request.sender_request_id

                    });

                }

            }
            const { error: requestDeleteError } =
                await supabase
                    .from("group_request")
                    .delete()
                    .eq("group_id", group.id);

            if (requestDeleteError) {

                return res.status(500).json(requestDeleteError);

            }

           

            //------------------------------------------
            // Delete group
            //------------------------------------------

            const { error: groupDeleteError } =
                await supabase
                    .from("groups")
                    .delete()
                    .eq("id", group.id);

            if (groupDeleteError) {

                return res.status(500).json(groupDeleteError);

            }

            //------------------------------------------
            // Delete ride request
            //------------------------------------------

            const { error: rideDeleteError } =
                await supabase
                    .from("ride_requests")
                    .delete()
                    .eq("id", requestId);

            if (rideDeleteError) {

                return res.status(500).json(rideDeleteError);

            }

            return res.json({

                success: true,

                message: "Ride request deleted."

            });

        }

        ////////////////////////////////////////////////////
        // CASE 3
        // Active Group
        ////////////////////////////////////////////////////
        
        //--------------------------------------------------
        // NON-CREATOR deleting ride request
        //--------------------------------------------------

        if (group.creator_id !== rideRequest.user_id) {

            //------------------------------------------
            // Remove member from group
            //------------------------------------------

            const { error: removeMemberError } =
                await supabase
                    .from("group_members")
                    .delete()
                    .eq("group_id", group.id)
                    .eq("user_id", rideRequest.user_id);

            if (removeMemberError) {

                return res.status(500).json(removeMemberError);

            }

            //------------------------------------------
            // Remove the accepted request that added
            // this member to the group
            //------------------------------------------

            await supabase
                .from("group_request")
                .delete()
                .eq("group_id", group.id)
                .eq("status", "accepted")
                .or(
                    `receiver_id.eq.${rideRequest.user_id},sender_id.eq.${rideRequest.user_id}`
                );

            //------------------------------------------
            // Delete pending requests of this user
            //------------------------------------------

            await supabase
                .from("group_request")
                .delete()
                .eq("group_id", group.id)
                .or(
                    `receiver_id.eq.${rideRequest.user_id},sender_id.eq.${rideRequest.user_id}`
                );

            //------------------------------------------
            // Delete the ride request
            //------------------------------------------

            const { error: deleteRideError } =
                await supabase
                    .from("ride_requests")
                    .delete()
                    .eq("id", requestId);

            if (deleteRideError) {

                return res.status(500).json(deleteRideError);

            }

            //------------------------------------------
            // Remaining members
            //------------------------------------------

            const { data: remainingMembers, error: remainingError } =
                await supabase
                    .from("group_members")
                    .select("*")
                    .eq("group_id", group.id);

            if (remainingError) {

                return res.status(500).json(remainingError);

            }

            //------------------------------------------
            // Group still has creator + one member
            //------------------------------------------

            if (remainingMembers.length > 1) {

                for (const member of remainingMembers) {

                    await createNotification({

                        userId: member.user_id,

                        type: "MEMBER_LEFT",

                        actorId: rideRequest.user_id,

                        groupId: group.id

                    });

                }

                return res.json({

                    success: true,

                    message: "Ride request deleted and member removed."

                });

            }

            await createNotification({

                userId: remainingMembers[0].user_id,

                type: "GROUP_DISSOLVED",

                actorId: rideRequest.user_id,

                groupId: group.id

            });

            //------------------------------------------
            // Only creator remains
            //------------------------------------------

            await supabase
                .from("group_members")
                .delete()
                .eq("group_id", group.id);
            const { data: pendingRequests } = await supabase
                .from("group_request")
                .select("*")
                .eq("group_id", group.id);

            for (const request of pendingRequests || []) {

                if (request.status !== "pending")
                    continue;

                if (request.type === "invitation") {

                    await removePendingNotification({

                        userId: request.receiver_id,
                        type: "INVITATION_RECEIVED",
                        groupId: request.group_id,
                        rideRequestId: request.receiver_request_id

                    });

                }

                else if (request.type === "join_request") {

                    await removePendingNotification({

                        userId: request.receiver_id,
                        type: "JOIN_REQUEST",
                        groupId: request.group_id,
                        rideRequestId: request.sender_request_id

                    });

                }

            }

            await supabase
                .from("group_request")
                .delete()
                .eq("group_id", group.id);

            await supabase
                .from("groups")
                .delete()
                .eq("id", group.id);

            return res.json({

                success: true,

                message: "Ride request deleted. Group dissolved."

            });

        }

        //------------------------------------------
        // Remove creator from group_members
        //------------------------------------------

        const { error: removeCreatorError } =
            await supabase
                .from("group_members")
                .delete()
                .eq("group_id", group.id)
                .eq("user_id", rideRequest.user_id);

        if (removeCreatorError) {

            return res.status(500).json(removeCreatorError);

        }

        //------------------------------------------
        // Get remaining members
        //------------------------------------------

        const { data: remainingMembers, error: memberError } =
            await supabase
                .from("group_members")
                .select("*")
                .eq("group_id", group.id)
                .order("joined_at", { ascending: true });

        if (memberError) {

            console.error(memberError);
            return res.status(500).json({
                success: false,
                message: "Server error."
            });

        }

        //------------------------------------------
        // Only one member left
        //------------------------------------------

        if (remainingMembers.length === 1) {

            const survivor = remainingMembers[0];

            //------------------------------------------
            // Restore survivor ride request
            //------------------------------------------

            const { data: survivorRideRequest, error: survivorRideError } =
                await supabase
                    .from("ride_requests")
                    .update({
                        status: "open"
                    })
                    .eq("id", survivor.ride_request_id);
            if (survivorRideError) {

                return res.status(500).json(survivorRideError);

            }

            //------------------------------------------
            // Delete remaining member
            //------------------------------------------
            
            await createNotification({

                userId: survivor.user_id,

                type: "GROUP_DISSOLVED",

                actorId: rideRequest.user_id,

                groupId: group.id

            });

            await supabase
                .from("group_members")
                .delete()
                .eq("group_id", group.id);


            const { data: pendingRequests } = await supabase
                .from("group_request")
                .select("*")
                .eq("group_id", group.id);

            for (const request of pendingRequests || []) {

                if (request.status !== "pending")
                    continue;

                if (request.type === "invitation") {

                    await removePendingNotification({

                        userId: request.receiver_id,
                        type: "INVITATION_RECEIVED",
                        groupId: request.group_id,
                        rideRequestId: request.receiver_request_id

                    });

                }

                else if (request.type === "join_request") {

                    await removePendingNotification({

                        userId: request.receiver_id,
                        type: "JOIN_REQUEST",
                        groupId: request.group_id,
                        rideRequestId: request.sender_request_id

                    });

                }

            }
            //------------------------------------------
            // Delete all group requests
            //------------------------------------------

            await supabase
                .from("group_request")
                .delete()
                .eq("group_id", group.id);

            //------------------------------------------
            // Delete group
            //------------------------------------------

            await supabase
                .from("groups")
                .delete()
                .eq("id", group.id);

            //------------------------------------------
            // Delete creator ride request
            //------------------------------------------

            await supabase
                .from("ride_requests")
                .delete()
                .eq("id", requestId);

            return res.json({

                success: true,

                message: "Group dissolved."

            });

        }

        //------------------------------------------
        // More than one member left
        //------------------------------------------

        const newCreator = remainingMembers[0];

        //------------------------------------------
        // New creator ride request comes directly
        // from group_members
        //------------------------------------------

        const newRideRequest = {
            id: newCreator.ride_request_id
        };
        //------------------------------------------
        // Update group creator
        //------------------------------------------

        const { error: updateGroupError } =
            await supabase
                .from("groups")
                .update({

                    creator_id: newCreator.user_id,

                    ride_request_id: newRideRequest.id

                })
                .eq("id", group.id);

        if (updateGroupError) {

            return res.status(500).json(updateGroupError);

        }
                //--------------------------------------------------
        // Remove the accepted request that made the
        // promoted member join this group
        // (works for invitation OR join request)
        //--------------------------------------------------

        const { error: deleteAcceptedRequestError } =
            await supabase
                .from("group_request")
                .delete()
                .eq("group_id", group.id)
                .eq("status", "accepted")
                .or(
                    `receiver_id.eq.${newCreator.user_id},sender_id.eq.${newCreator.user_id}`
                );

        if (deleteAcceptedRequestError) {

            return res.status(500).json(deleteAcceptedRequestError);

        }

        //--------------------------------------------------
        // Transfer pending invitations
        //--------------------------------------------------

        const { error: invitationTransferError } =
            await supabase
                .from("group_request")
                .update({

                    sender_id: newCreator.user_id,

                    sender_request_id: newRideRequest.id

                })
                .eq("group_id", group.id)
                .eq("type", "invitation")
                .eq("status", "pending")
                .eq("sender_id", rideRequest.user_id);

        if (invitationTransferError) {

            return res.status(500).json(invitationTransferError);

        }

        //--------------------------------------------------
        // Transfer pending join requests
        //--------------------------------------------------

        const { error: joinTransferError } =
            await supabase
                .from("group_request")
                .update({

                    receiver_id: newCreator.user_id,

                    receiver_request_id: newRideRequest.id
                })
                .eq("group_id", group.id)
                .eq("type", "join_request")
                .eq("status", "pending");

        if (joinTransferError) {

            return res.status(500).json(joinTransferError);

        }

        //--------------------------------------------------
        // Delete creator's ride request
        //--------------------------------------------------

        const { error: deleteRideRequestError } =
            await supabase
                .from("ride_requests")
                .delete()
                .eq("id", requestId);

        if (deleteRideRequestError) {

            return res.status(500).json(deleteRideRequestError);

        }

        //--------------------------------------------------
        // Success
        //--------------------------------------------------

        for (const member of remainingMembers) {

            await createNotification({

                userId: member.user_id,

                type: "CREATOR_CHANGED",

                actorId: newCreator.user_id,

                groupId: group.id

            });

        }

        return res.json({

            success: true,

            message: "Creator removed and new creator assigned."

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            error: err.message

        });

    }

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});