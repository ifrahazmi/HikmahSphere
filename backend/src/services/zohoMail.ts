type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

export type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

let cachedToken: CachedToken | null = null;

const requiredEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing ${key}. Set Zoho HTTPS mail variables in .env`);
  }
  return value;
};

const accountsUrl = () =>
  (process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in').replace(/\/$/, '');

const mailApiUrl = () =>
  (process.env.ZOHO_MAIL_API_URL || 'https://mail.zoho.in').replace(/\/$/, '');

const extractEmail = (value: string): string => {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
};

export const isZohoMailConfigured = (): boolean =>
  Boolean(
    process.env.ZOHO_CLIENT_ID?.trim() &&
    process.env.ZOHO_CLIENT_SECRET?.trim() &&
    process.env.ZOHO_REFRESH_TOKEN?.trim() &&
    process.env.ZOHO_ACCOUNT_ID?.trim() &&
    process.env.ZOHO_FROM?.trim()
  );

let statusLogged = false;

export const logZohoMailStatus = (): void => {
  if (statusLogged) return;
  statusLogged = true;
  if (isZohoMailConfigured()) {
    console.log('✅ Zoho HTTPS mail is configured');
  } else {
    console.error('⚠️  Zoho HTTPS mail is not fully configured. Check ZOHO_* env vars.');
  }
};

const refreshAccessToken = async (): Promise<string> => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: requiredEnv('ZOHO_CLIENT_ID'),
    client_secret: requiredEnv('ZOHO_CLIENT_SECRET'),
    refresh_token: requiredEnv('ZOHO_REFRESH_TOKEN'),
  });

  const response = await fetch(`${accountsUrl()}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = await response.json() as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error || `Zoho token refresh failed (${response.status})`);
  }

  const expiresInMs = (payload.expires_in || 3600) * 1000;
  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresInMs - 60_000,
  };
  return cachedToken.accessToken;
};

const getAccessToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }
  return refreshAccessToken();
};

export const sendMail = async ({ to, subject, html, replyTo }: SendMailOptions): Promise<void> => {
  const accountId = requiredEnv('ZOHO_ACCOUNT_ID');
  const fromAddress = extractEmail(requiredEnv('ZOHO_FROM'));
  const accessToken = await getAccessToken();

  const payload: Record<string, string> = {
    fromAddress,
    toAddress: to,
    subject,
    content: html,
    mailFormat: 'html',
  };

  if (replyTo) {
    payload.replyTo = extractEmail(replyTo);
  }

  const response = await fetch(
    `${mailApiUrl()}/api/accounts/${accountId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json().catch(() => ({})) as {
    status?: { code?: number; description?: string };
    data?: unknown;
  };

  const ok =
    response.ok &&
    (result.status?.code === undefined || result.status.code === 200);

  if (!ok) {
    throw new Error(
      result.status?.description || `Zoho send mail failed (${response.status})`
    );
  }
};

