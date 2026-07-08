const net = require("net");

if (net.setDefaultAutoSelectFamily) {
    net.setDefaultAutoSelectFamily(false);
}

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const nodemailer = require("nodemailer");
const dnsPromises = require("dns").promises;

let transporterPromise = null;

async function buildTransporter() {
    const addresses = await dnsPromises.resolve4("smtp.gmail.com");
    const ipv4Host = addresses[0];

    const transporter = nodemailer.createTransport({
        host: ipv4Host,
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

    await transporter.verify();

    console.log("SMTP SERVER READY (IPv4:", ipv4Host, ")");

    return transporter;
}

function getTransporter() {
    if (!transporterPromise) {
        transporterPromise = buildTransporter().catch(err => {
            transporterPromise = null;
            throw err;
        });
    }

    return transporterPromise;
}

module.exports = { getTransporter };