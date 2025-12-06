import { google } from 'googleapis';
import * as nodemailer from 'nodemailer';

interface ContactEmailData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Create OAuth2 client
const createOAuth2Client = () => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground' // redirect URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  return oauth2Client;
};

// Create nodemailer transporter with OAuth2
const createTransporter = async () => {
  const oauth2Client = createOAuth2Client();
  
  try {
    const accessToken = await oauth2Client.getAccessToken();
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: 'digitalpromocodescontact@gmail.com',
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    } as any);

    return transporter;
  } catch (error) {
    console.error('Error creating transporter:', error);
    throw error;
  }
};

// Send contact form email
export const sendContactEmail = async (data: ContactEmailData): Promise<void> => {
  const transporter = await createTransporter();
  
  const mailOptions = {
    from: 'digitalpromocodescontact@gmail.com',
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
          <!-- TODO: Update brand name once new domain is finalised -->
          <p>This email was sent from our website contact form.</p>
          <p>Reply directly to this email to respond to ${data.name} at ${data.email}</p>
        </div>
      </div>
    `,
    replyTo: data.email,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Contact email sent successfully via Gmail OAuth2');
  } catch (error) {
    console.error('Error sending contact email:', error); // This is good!
    if (error && error.response) {
      console.error('Gmail response:', error.response);
    }
    if (error && error.stack) {
      console.error('Stack:', error.stack);
    }
    throw error; // Throw the original error so you see the real message in your logs
  }
};

// Send auto-reply email to the user
export const sendAutoReply = async (data: ContactEmailData): Promise<void> => {
  const transporter = await createTransporter();
  
  const mailOptions = {
    from: 'digitalpromocodescontact@gmail.com',
    to: data.email,
    subject: `Thank you for contacting us - We've received your message`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">
          Thank you for contacting us
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
        
        <!-- TODO: Update brand name and URL once new domain is finalised -->
        <p>In the meantime, feel free to explore our latest offers and deals on our website.</p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p>Best regards,<br>Our Team</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Auto-reply email sent successfully via Gmail OAuth2');
  } catch (error) {
    console.error('Error sending auto-reply email:', error);
    // Don't throw here as auto-reply is not critical
  }
};

// Test email configuration
export const testEmailConfig = async (): Promise<boolean> => {
  try {
    const transporter = await createTransporter();
    await transporter.verify();
    console.log('Gmail OAuth2 email configuration is valid');
    return true;
  } catch (error) {
    console.error('Gmail OAuth2 configuration test failed:', error);
    return false;
  }
};