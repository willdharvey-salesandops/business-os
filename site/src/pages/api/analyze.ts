import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { jsPDF } from 'jspdf';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const CALENDLY_URL = 'https://calendly.com/will-leadershipgrowthconsulting/30min';

const SYSTEM_PROMPT = `You are a business automation specialist who builds AI-powered tools, systems, and workflows for small businesses (2-20 people). You work with founders who are operationally stretched and need working infrastructure, not advice.

Given information about a business and their biggest challenge, generate 2-3 specific, actionable automation ideas. Each idea should be a concrete tool or system that could be built, not a vague recommendation.

Rules:
- Be specific to their business type and challenge
- Describe actual tools (dashboards, engines, workflows), not generic "use AI" suggestions
- Each idea should have a clear, measurable time saving
- Keep descriptions to 2-3 sentences maximum
- Use plain language, no jargon
- Never use em dashes
- Be realistic with time savings estimates

Respond with valid JSON only, no markdown formatting. Use this exact structure:
{
  "ideas": [
    {
      "title": "Short tool name",
      "description": "2-3 sentence description of what it does and why it matters.",
      "hours_saved_per_week": 5
    }
  ]
}`;

interface FormData {
  name: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  team_size: string;
  challenge: string;
  time_area: string;
  monthly_financial_cost: number;
  hours_per_week: number;
  hourly_value: number;
}

interface Idea {
  title: string;
  description: string;
  hours_saved_per_week: number;
}

interface AuditResult {
  ideas: Idea[];
  total_annual_savings: string;
  total_hours_saved_per_year: string;
}

function buildUserPrompt(data: FormData): string {
  const financialLine = data.monthly_financial_cost
    ? `Estimated monthly financial cost of this problem: £${data.monthly_financial_cost.toLocaleString('en-GB')} (lost deals, wasted spend, rework, etc.)`
    : 'Monthly financial cost: Not specified';

  return `Business: ${data.industry || 'Unknown'}
Website: ${data.website || 'Not provided'}
Team size: ${data.team_size || 'Unknown'}
Biggest challenge: ${data.challenge || 'Not specified'}
Area that takes most time: ${data.time_area || 'Not specified'}
Hours lost per week: ${data.hours_per_week || 'Unknown'}
${financialLine}

Generate 2-3 automation ideas tailored to this specific business and challenge. Each idea should save meaningful time. The total hours saved across all ideas should be realistic but impactful relative to the ${data.hours_per_week || 10} hours they currently lose per week. If the business has significant direct financial losses, factor those into your recommendations too.`;
}

function generatePDF(data: FormData, result: AuditResult): Buffer {
  const doc = new jsPDF();
  const TEAL = [17, 94, 89] as const;
  const TEAL_BRIGHT = [45, 212, 191] as const;
  const INK = [17, 17, 17] as const;
  const GREY = [85, 85, 85] as const;
  const LIGHT_GREY = [243, 243, 241] as const;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...TEAL);
  doc.text('LEADERSHIP GROWTH CONSULTING', 10, 15);
  doc.setDrawColor(...TEAL_BRIGHT);
  doc.setLineWidth(0.8);
  doc.line(10, 19, 80, 19);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text('Your Automation Audit', 10, 35);

  // Lead info
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GREY);
  doc.text(`Prepared for ${data.name || 'you'}  |  ${data.industry || ''}  |  ${dateStr}`, 10, 44);

  let yPos = 56;

  // Ideas
  result.ideas.forEach((idea, i) => {
    // Calculate description lines to determine card height
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(idea.description, 178);
    const lineHeight = 3.5;
    const descHeight = lines.length * lineHeight;
    const cardPadding = 10; // top padding before title
    const titleToDesc = 8; // gap from title to description
    const descToHours = 6; // gap from last desc line to hours saved
    const hoursToBottom = 8; // padding below hours saved
    const cardHeight = cardPadding + titleToDesc + descHeight + descToHours + hoursToBottom;

    // Card background
    doc.setFillColor(...LIGHT_GREY);
    doc.rect(10, yPos, 190, cardHeight, 'F');

    // Teal left accent
    doc.setFillColor(...TEAL_BRIGHT);
    doc.rect(10, yPos, 2.5, cardHeight, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(`${i + 1}. ${idea.title}`, 16, yPos + cardPadding);

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(lines, 16, yPos + cardPadding + titleToDesc);

    // Hours saved
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...TEAL);
    doc.text(`${idea.hours_saved_per_week} hours saved per week`, 16, yPos + cardPadding + titleToDesc + descHeight + descToHours);

    yPos += cardHeight + 6;
  });

  // Total savings section
  yPos += 4;
  doc.setDrawColor(...LIGHT_GREY);
  doc.setLineWidth(0.3);
  doc.line(10, yPos, 200, yPos);
  yPos += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text('ESTIMATED ANNUAL SAVINGS', 105, yPos, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...TEAL_BRIGHT);
  doc.text(result.total_annual_savings, 105, yPos + 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(result.total_hours_saved_per_year, 105, yPos + 24, { align: 'center' });

  // CTA
  yPos += 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('Want to make this real?', 105, yPos, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GREY);
  doc.text('Book a 30-minute call. No pitch, no pressure.', 105, yPos + 8, { align: 'center' });
  doc.text("Just a conversation about what's possible.", 105, yPos + 14, { align: 'center' });

  // Footer
  yPos += 28;
  doc.setDrawColor(...LIGHT_GREY);
  doc.line(10, yPos, 200, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text('Book a call to discuss these ideas:', 10, yPos + 6);
  doc.setTextColor(...TEAL);
  doc.text(CALENDLY_URL, 10, yPos + 11);
  doc.setTextColor(...GREY);
  doc.text('will@leadershipgrowthconsulting.com', 10, yPos + 16);

  return Buffer.from(doc.output('arraybuffer'));
}

async function sendEmail(
  transporter: nodemailer.Transporter,
  to: string,
  subject: string,
  html: string,
  attachments?: nodemailer.SendMailOptions['attachments']
) {
  const gmailAddress = import.meta.env.GMAIL_ADDRESS || process.env.GMAIL_ADDRESS;
  if (!gmailAddress) return;

  await transporter.sendMail({
    from: `Will Harvey <${gmailAddress}>`,
    to,
    subject,
    html,
    attachments,
  });
}

function buildLeadEmail(data: FormData, result: AuditResult): string {
  const name = data.name || 'there';
  const numIdeas = result.ideas.length;
  const savings = result.total_annual_savings;

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; max-width: 560px; margin: 0 auto; padding: 20px;">
  <p style="color: #115e59; font-weight: 600; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px;">LEADERSHIP GROWTH CONSULTING</p>
  <hr style="border: none; border-top: 2px solid #2dd4bf; width: 60px; margin: 0 0 24px;">

  <p>Hi ${name},</p>

  <p>Thanks for running your Automation Audit.</p>

  <p>We found <strong>${numIdeas} areas</strong> where your business could save an estimated <strong>${savings}</strong> per year. Your full results are attached as a PDF.</p>

  <p>If you'd like to discuss these ideas and see what we could build together, book a 30-minute call:</p>

  <p style="margin: 24px 0;">
    <a href="${CALENDLY_URL}" style="background: #115e59; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Book a Call</a>
  </p>

  <p>No pitch. Just a conversation about what's possible.</p>

  <p>Best,<br>Will</p>

  <hr style="border: none; border-top: 1px solid #e5e5e3; margin: 32px 0 16px;">
  <p style="font-size: 12px; color: #888;">Leadership Growth Consulting<br>
  <a href="mailto:will@leadershipgrowthconsulting.com" style="color: #115e59;">will@leadershipgrowthconsulting.com</a></p>
</div>`;
}

function buildNotificationEmail(data: FormData, result: AuditResult): string {
  const ideasText = result.ideas
    .map((idea, i) => `  ${i + 1}. ${idea.title} - ${idea.hours_saved_per_week}h/week`)
    .join('\n');

  return `<div style="font-family: monospace; font-size: 13px; color: #333; padding: 16px;">
  <h2 style="color: #115e59; font-family: sans-serif;">New Website Lead</h2>

  <table style="border-collapse: collapse;">
    <tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">Name</td><td>${data.name || ''}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">Email</td><td>${data.email || ''}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">Phone</td><td>${data.phone || ''}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">Website</td><td>${data.website || ''}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">Industry</td><td>${data.industry || ''}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">Team</td><td>${data.team_size || ''}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">Challenge</td><td>${data.challenge || ''}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">Time area</td><td>${data.time_area || ''}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">Financial cost/mo</td><td>${data.monthly_financial_cost ? `\u00A3${data.monthly_financial_cost.toLocaleString('en-GB')}` : 'Not specified'}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">Hours/week</td><td>${data.hours_per_week || ''}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">Savings</td><td>${result.total_annual_savings || ''}</td></tr>
  </table>

  <h3 style="color: #115e59; font-family: sans-serif; margin-top: 16px;">Ideas Generated</h3>
  <pre style="background: #f3f3f1; padding: 12px; border-radius: 6px;">${ideasText}</pre>
</div>`;
}

export const POST: APIRoute = async ({ request }) => {
  const data = (await request.json()) as FormData;

  if (!data || !data.email) {
    return new Response(JSON.stringify({ error: 'No data provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Call Claude
    const anthropic = new Anthropic({
      apiKey: import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(data) }],
    });

    let responseText = (message.content[0] as { type: 'text'; text: string }).text.trim();
    // Strip markdown code fences if present
    const fenceMatch = responseText.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
    if (fenceMatch) {
      responseText = fenceMatch[1].trim();
    }
    responseText = responseText.trim();

    const result: AuditResult = JSON.parse(responseText);

    // Calculate savings
    const hourlyValue = data.hourly_value || 75;
    const totalHoursWeekly = result.ideas.reduce((sum, idea) => sum + idea.hours_saved_per_week, 0);
    const totalHoursYearly = Math.ceil(totalHoursWeekly * 48);
    const timeSavings = Math.ceil(totalHoursWeekly * hourlyValue * 48);
    const financialRecovery = Math.ceil((data.monthly_financial_cost || 0) * 12 * 0.5);
    const totalAnnualSavings = timeSavings + financialRecovery;

    result.total_annual_savings = `\u00A3${totalAnnualSavings.toLocaleString('en-GB')}`;
    const parts = [`Based on ${totalHoursYearly.toLocaleString('en-GB')} hours recovered per year`];
    if (financialRecovery > 0) {
      parts.push(`plus \u00A3${financialRecovery.toLocaleString('en-GB')} in reduced financial losses`);
    }
    result.total_hours_saved_per_year = parts.join(', ');

    // Post-processing: PDF, emails, and lead logging
    // Run in parallel to stay within Vercel timeout
    const gmailAddress = import.meta.env.GMAIL_ADDRESS || process.env.GMAIL_ADDRESS;
    const gmailPassword = import.meta.env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
    const supabaseUrl = import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const pdfBuffer = generatePDF(data, result);
      const tasks: Promise<any>[] = [];

      // Emails
      if (gmailAddress && gmailPassword) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailAddress, pass: gmailPassword },
        });

        tasks.push(
          sendEmail(transporter, data.email, 'Your Automation Audit Results', buildLeadEmail(data, result), [
            { filename: 'Automation-Audit-Results.pdf', content: pdfBuffer },
          ])
        );
        tasks.push(
          sendEmail(
            transporter,
            gmailAddress,
            `New Website Lead: ${data.name || 'Unknown'} (${data.industry || ''})`,
            buildNotificationEmail(data, result)
          )
        );
      }

      // Supabase lead log
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        tasks.push(
          supabase.from('leads').insert({
            name: data.name,
            email: data.email,
            phone: data.phone,
            website: data.website,
            team_size: data.team_size,
            hours: String(data.hours_per_week || ''),
            tasks: `${data.industry || ''} | ${data.challenge || ''} | ${data.time_area || ''}`,
            hourly_value: String(data.hourly_value || ''),
            total_savings: result.total_annual_savings,
            ideas: result.ideas,
          })
        );
      }

      await Promise.allSettled(tasks);
    } catch (err) {
      console.error('Post-processing error:', err);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('API error:', err?.message || err, err?.status, err?.error);
    return new Response(JSON.stringify({ error: 'AI service unavailable', detail: err?.message || 'Unknown error' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
