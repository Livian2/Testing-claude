interface Env {
  RESEND_API_KEY:   string;
  BUG_REPORT_EMAIL: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' } });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const missing: string[] = [];
  if (!env.RESEND_API_KEY)   missing.push('RESEND_API_KEY');
  if (!env.BUG_REPORT_EMAIL) missing.push('BUG_REPORT_EMAIL');
  if (missing.length > 0) {
    return json({ error: `Bug report email is not configured on the server. Missing: ${missing.join(', ')}` }, 500);
  }

  let payload: { message?: string; email?: string; page?: string; userAgent?: string; appVersion?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const message = (payload.message ?? '').trim();
  if (!message) {
    return json({ error: 'Message is required.' }, 400);
  }
  if (message.length > 5000) {
    return json({ error: 'Message is too long.' }, 400);
  }

  const email      = (payload.email ?? '').trim().slice(0, 200);
  const page       = (payload.page ?? '').slice(0, 200);
  const userAgent  = (payload.userAgent ?? '').slice(0, 300);
  const appVersion = (payload.appVersion ?? '').slice(0, 50);

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 12px 6px 0; color:#94a3b8; font-size:12px; text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; vertical-align:top;">${label}</td>
      <td style="padding:6px 0; color:#1e293b; font-size:14px; font-weight:600; word-break:break-word;">${value}</td>
    </tr>`;

  const html = `
  <div style="background:#f1f5f9; padding:24px; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f59e0b,#ea580c); padding:20px 24px;">
        <div style="color:#ffffff; font-size:18px; font-weight:700;">🐞 New bug report</div>
        <div style="color:#fff7ed; font-size:13px; margin-top:4px;">
          Dutch Tax Calculator
          <span style="display:inline-block; margin-left:6px; padding:1px 8px; background:rgba(255,255,255,.25); border-radius:999px; font-weight:600;">${escapeHtml(appVersion) || '—'}</span>
        </div>
      </div>
      <div style="padding:20px 24px;">
        <table style="width:100%; border-collapse:collapse;">
          ${row('Page', escapeHtml(page) || '—')}
          ${row('Reporter', escapeHtml(email) || '—')}
          ${row('Browser', escapeHtml(userAgent) || '—')}
        </table>
        <div style="margin-top:18px; padding:16px; background:#fffbeb; border-left:4px solid #f59e0b; border-radius:6px;">
          <div style="color:#92400e; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px;">Message</div>
          <div style="white-space:pre-wrap; color:#1e293b; font-size:14px; line-height:1.55;">${escapeHtml(message)}</div>
        </div>
      </div>
    </div>
  </div>`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:     'Bug Reports <onboarding@resend.dev>',
      to:       [env.BUG_REPORT_EMAIL],
      reply_to: email || undefined,
      subject:  `Bug report — Dutch Tax Calculator${page ? ` (${page})` : ''}`,
      html,
    }),
  }).catch(() => null);

  if (!resendRes || !resendRes.ok) {
    return json({ error: 'Failed to send bug report.' }, 502);
  }

  return json({ ok: true });
}
