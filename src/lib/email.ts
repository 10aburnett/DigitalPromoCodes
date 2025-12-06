import nodemailer from 'nodemailer';
import { SITE_BRAND, CONTACT_EMAIL } from '@/lib/brand';
import { siteOrigin } from '@/lib/site-origin';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface ContactEmailData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Create email transporter
const createTransporter = () => {
  const config: EmailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASSWORD || '',
    },
  };

  return nodemailer.createTransport(config);
};

// Send contact form email
export const sendContactEmail = async (data: ContactEmailData): Promise<void> => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.SMTP_FROM || 'digitalpromocodescontact@gmail.com',
    to: 'digitalpromocodescontact@gmail.com',
    subject: `Contact Form: ${data.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">
          New Contact Form Submission
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #6366f1; margin-top: 0;">Contact Details</h3>
          <p><strong>Name:</strong> ${data.name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Subject:</strong> ${data.subject}</p>
        </div>
        
        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
          <h3 style="color: #6366f1; margin-top: 0;">Message</h3>
          <p style="white-space: pre-wrap; line-height: 1.6;">${data.message}</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p>This email was sent from the ${SITE_BRAND} contact form.</p>
          <p>Reply directly to this email to respond to ${data.name} at ${data.email}</p>
        </div>
      </div>
    `,
    replyTo: data.email,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Contact email sent successfully');
  } catch (error) {
    console.error('Error sending contact email:', error);
    throw new Error('Failed to send email');
  }
};

// Send auto-reply email to the user
export const sendAutoReply = async (data: ContactEmailData): Promise<void> => {
  const transporter = createTransporter();
  const origin = siteOrigin();

  const mailOptions = {
    from: process.env.SMTP_FROM || CONTACT_EMAIL,
    to: data.email,
    subject: `Thank you for contacting us - We've received your message`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">
          Thank you for contacting ${SITE_BRAND}
        </h2>
        
        <p>Hi ${data.name},</p>
        
        <p>Thank you for reaching out to us! We've received your message and will get back to you as soon as possible.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #6366f1; margin-top: 0;">Your Message Summary</h3>
          <p><strong>Subject:</strong> ${data.subject}</p>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap; line-height: 1.6; font-style: italic;">${data.message}</p>
        </div>
        
        <div style="background-color: #e0e7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #6366f1; margin-top: 0;">What happens next?</h3>
          <ul style="line-height: 1.6;">
            <li>Our team will review your message within 24 hours</li>
            <li>We'll respond to you directly at ${data.email}</li>
            <li>For urgent matters, please mention "URGENT" in the subject line</li>
          </ul>
        </div>
        
        <p>In the meantime, feel free to explore our latest deals at <a href="${origin}" style="color: #6366f1;">${SITE_BRAND}</a></p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p>Best regards,<br>The ${SITE_BRAND} Team</p>
          <p>Visit us: <a href="${origin}" style="color: #6366f1;">${origin}</a></p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Auto-reply email sent successfully');
  } catch (error) {
    console.error('Error sending auto-reply email:', error);
    // Don't throw here as auto-reply is not critical
  }
};

// Test email configuration
export const testEmailConfig = async (): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration test failed:', error);
    return false;
  }
};