import { Resend } from 'resend';
import { SITE_BRAND, CONTACT_EMAIL } from '@/lib/brand';
import { siteOrigin } from '@/lib/site-origin';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ContactEmailData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Send contact form email to admin
export const sendContactEmail = async (data: ContactEmailData): Promise<void> => {
  const origin = siteOrigin();
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: CONTACT_EMAIL,
      to: CONTACT_EMAIL,
      subject: `Contact Form: ${data.subject}`,
      replyTo: data.email,
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
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log('Contact email sent successfully via Resend:', emailData?.id);
  } catch (error) {
    console.error('Error sending contact email:', error);
    throw error;
  }
};

// Send auto-reply email to the user
export const sendAutoReply = async (data: ContactEmailData): Promise<void> => {
  const origin = siteOrigin();
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: CONTACT_EMAIL,
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
    });

    if (error) {
      console.error('Resend auto-reply error:', error);
      throw new Error(`Failed to send auto-reply: ${error.message}`);
    }

    console.log('Auto-reply email sent successfully via Resend:', emailData?.id);
  } catch (error) {
    console.error('Error sending auto-reply email:', error);
    // Don't throw here as auto-reply is not critical
  }
};

// Test email configuration
export const testEmailConfig = async (): Promise<boolean> => {
  try {
    const { data, error } = await resend.emails.send({
      from: CONTACT_EMAIL,
      to: CONTACT_EMAIL,
      subject: 'Test Email Configuration',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6366f1;">Email Configuration Test</h2>
          <p>This is a test email to verify that the email configuration is working correctly.</p>
          <p>If you receive this email, the setup is successful!</p>
        </div>
      `,
    });

    if (error) {
      console.error('Email test failed:', error);
      return false;
    }

    console.log('Test email sent successfully:', data?.id);
    return true;
  } catch (error) {
    console.error('Email test error:', error);
    return false;
  }
};