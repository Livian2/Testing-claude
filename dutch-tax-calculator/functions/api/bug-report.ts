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

  if (!env.RESEND_API_KEY || !env.BUG_REPORT_EMAIL) {
    return json({ error: 'Bug report email is not configured on the server.' }, 500);
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

  const html = `
    <h2>New bug report — Dutch Tax Calculator ${escapeHtml(appVersion)}</h2>
    <p><strong>Page:</strong> ${escapeHtml(page) || '—'}</p>
    <p><strong>Reporter email:</strong> ${escapeHtml(email) || '—'}</p>
    <p><strong>User agent:</strong> ${escapeHtml(userAgent) || '—'}</p>
    <hr />
    <pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(message)}</pre>
  `;

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
