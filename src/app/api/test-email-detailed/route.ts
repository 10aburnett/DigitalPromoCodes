import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

export async function GET() {
  try {
    console.log('Testing detailed email configuration...');
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    console.log('Getting access token...');
    const accessToken = await oauth2Client.getAccessToken();
    console.log('Access token obtained');

    console.log('Creating nodemailer transporter...');
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

    console.log('Verifying transporter...');
    await transporter.verify();
    console.log('Transporter verified successfully');

    return NextResponse.json({
      success: true,
      message: "Email configuration is working correctly!",
      transporterVerified: true
    });
    
  } catch (error: any) {
    console.error('Detailed email test failed:', error);
    return NextResponse.json({
      success: false,
      message: "Email configuration failed",
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 