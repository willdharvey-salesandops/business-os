import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { name, email, company, teamSize } = await request.json();

    if (!name || !email || !company || !teamSize) {
      return new Response(JSON.stringify({ error: 'All fields are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const gmailAddress = import.meta.env.GMAIL_ADDRESS || process.env.GMAIL_ADDRESS;
    const gmailPassword = import.meta.env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
    const supabaseUrl = import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    const tasks: Promise<any>[] = [];

    // Log to Supabase
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      tasks.push(
        supabase.from('workshop_signups').insert({
          name,
          email,
          company,
          team_size: teamSize,
        })
      );
    }

    // Send notification email to Will
    if (gmailAddress && gmailPassword) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailAddress, pass: gmailPassword },
      });

      // Notification to Will
      tasks.push(
        transporter.sendMail({
          from: gmailAddress,
          to: gmailAddress,
          subject: `New AI Workshop Sign-up: ${name} (${company})`,
          html: `
            <h2>New AI Workshop Sign-up</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Company:</strong> ${company}</p>
            <p><strong>Team size:</strong> ${teamSize}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>
          `,
        })
      );

      // Confirmation to the applicant
      tasks.push(
        transporter.sendMail({
          from: `"Will Harvey" <${gmailAddress}>`,
          to: email,
          subject: 'AI Workshop: Application received',
          html: `
            <p>Hi ${name},</p>
            <p>Thanks for signing up for the AI Workshop. I've got your details and I'll be in touch shortly to get your session booked in.</p>
            <p>In the meantime, if you have any questions, just reply to this email.</p>
            <p>Speak soon,<br/>Will</p>
            <p style="color: #888; font-size: 13px;">Will Harvey<br/>Leadership Growth Consulting<br/>will@leadershipgrowthconsulting.com</p>
          `,
        })
      );
    }

    await Promise.allSettled(tasks);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Workshop signup error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
