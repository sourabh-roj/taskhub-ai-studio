import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with the secure environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, to, taskTitle, userName, taskUrl } = body;

    let subject = '';
    let html = '';

    // 1. Task Assigned Template (User Receives)
    if (type === 'assigned') {
      subject = `New Task Assigned: ${taskTitle}`;
      html = `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px;">
          <h2>You have a new task!</h2>
          <p>A new AI photography task titled <strong>"${taskTitle}"</strong> has been assigned to you.</p>
          <a href="${taskUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">View Task Requirements</a>
        </div>
      `;
    } 
    // 2. Task Submitted Template (Admin Receives)
    else if (type === 'submitted') {
      subject = `Task Completed: ${taskTitle} by ${userName}`;
      html = `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px;">
          <h2>Task Ready for Review</h2>
          <p>User <strong>${userName}</strong> has completed all 8 images for <strong>"${taskTitle}"</strong>.</p>
          <a href="${taskUrl}" style="display: inline-block; padding: 10px 20px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 5px;">Review Task</a>
        </div>
      `;
    }

    // Send the email via Resend
    // Note: On the free tier, 'to' must be the email you used to sign up for Resend
    const data = await resend.emails.send({
      from: 'TaskHub Notifications <onboarding@resend.dev>',
      to: [to], 
      subject: subject,
      html: html,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Email API Error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}