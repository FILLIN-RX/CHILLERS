import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
});

export async function sendNotification(subject: string, message: string) {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject,
            text: message
        });
        console.log(`[Notification] Sent`);
    } catch (error) {
        console.error(`[Notification] Failed:`, error);
    }
}
