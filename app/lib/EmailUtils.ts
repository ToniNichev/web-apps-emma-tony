import nodemailer from 'nodemailer';

export async function SendEmail(to: string, subject: string, bodyText: string, bodyHTML: string) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject,
    text: bodyText,
    html: bodyHTML,
  });

  return info;
}
