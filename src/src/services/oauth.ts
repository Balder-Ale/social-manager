// OAuth service for Instagram, Facebook, and TikTok
// Handles auth URL generation, token exchange, and refresh

import axios from 'axios';

// ─── Types ──────────────────────────────────────────────────────────

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId: string;
  accountName: string;
  metadata?: Record<string, any>;
}

// ─── Platform Configs ───────────────────────────────────────────────

const PLATFORM_CONFIGS: Record<string, { authorizeUrl: string; tokenUrl: string; apiVersion: string }> = {
  instagram: {
    authorizeUrl: 'https://www.facebook.com/v17.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v17.0/oauth/access_token',
    apiVersion: 'v17.0'
  },
  facebook: {
    authorizeUrl: 'https://www.facebook.com/v17.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v17.0/oauth/access_token',
    apiVersion: 'v17.0'
  },
  tiktok: {
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    apiVersion: 'v2'
  }
};

// ─── Helpers ────────────────────────────────────────────────────────

function getConfig(platform: string): OAuthConfig {
  const prefix = platform.toUpperCase();
  // TikTok uses "client_key" instead of "client_id"
  const clientIdKey = platform === 'tiktok' ? `${prefix}_CLIENT_KEY` : `${prefix}_CLIENT_ID`;
  return {
    clientId: process.env[clientIdKey] || '',
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] || '',
    redirectUri: process.env[`${prefix}_REDIRECT_URI`] || `http://localhost:4001/api/auth/${platform}/callback`
  };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Build the OAuth authorize URL for the given platform.
 * The user's browser should be redirected here.
 */
export function buildAuthUrl(platform: string, state: string): string {
  const config = PLATFORM_CONFIGS[platform];
  if (!config) throw new Error(`Unsupported platform: ${platform}`);

  const creds = getConfig(platform);

  const params = new URLSearchParams();

  if (platform === 'tiktok') {
    params.set('client_key', creds.clientId);
    params.set('scope', 'user.info.basic,video.publish,video.upload');
    params.set('response_type', 'code');
    params.set('redirect_uri', creds.redirectUri);
    params.set('state', state);
  } else {
    // Instagram / Facebook (Meta Graph API)
    params.set('client_id', creds.clientId);
    params.set('redirect_uri', creds.redirectUri);
    params.set('state', state);
    params.set('scope', 'pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement');
    params.set('response_type', 'code');
  }

  return `${config.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeCode(platform: string, code: string): Promise<TokenResponse> {
  const config = PLATFORM_CONFIGS[platform];
  if (!config) throw new Error(`Unsupported platform: ${platform}`);

  const creds = getConfig(platform);

  if (platform === 'tiktok') {
    const params = new URLSearchParams();
    params.set('client_key', creds.clientId);
    params.set('client_secret', creds.clientSecret);
    params.set('code', code);
    params.set('grant_type', 'authorization_code');
    params.set('redirect_uri', creds.redirectUri);

    const response = await axios.post(config.tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = response.data;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      accountId: data.open_id || '',
      accountName: data.open_id || 'TikTok User',
    };
  } else {
    // Meta Graph API: exchange code for short-lived token
    const tokenResponse = await axios.get(config.tokenUrl, {
      params: {
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: creds.redirectUri,
        code
      }
    });

    const shortToken = tokenResponse.data.access_token;

    // Exchange short-lived token for long-lived (60 days)
    const longResponse = await axios.get('https://graph.facebook.com/v17.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        fb_exchange_token: shortToken
      }
    });

    const longToken = longResponse.data.access_token;
    const expiresIn = longResponse.data.expires_in || 5_184_000; // default 60 days

    // Fetch user/page info
    let accountId = '';
    let accountName = '';

    if (platform === 'instagram') {
      const meResponse = await axios.get('https://graph.facebook.com/v17.0/me/accounts', {
        params: { access_token: longToken }
      });
      const pages = meResponse.data.data || [];
      if (pages.length > 0) {
        const page = pages[0];
        // Get the Instagram Business Account linked to this page
        const igResponse = await axios.get(`https://graph.facebook.com/v17.0/${page.id}`, {
          params: { access_token: longToken, fields: 'instagram_business_account' }
        });
        const igAccount = igResponse.data.instagram_business_account;
        if (igAccount) {
          accountId = igAccount.id;
          accountName = igAccount.name || page.name;
        } else {
          accountId = page.id;
          accountName = page.name;
        }
      } else {
        // Fallback to user profile
        const profile = await axios.get('https://graph.facebook.com/v17.0/me', {
          params: { access_token: longToken, fields: 'id,name' }
        });
        accountId = profile.data.id;
        accountName = profile.data.name;
      }
    } else {
      // Facebook
      const meResponse = await axios.get('https://graph.facebook.com/v17.0/me', {
        params: { access_token: longToken, fields: 'id,name' }
      });
      accountId = meResponse.data.id;
      accountName = meResponse.data.name;
    }

    return {
      accessToken: longToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      accountId,
      accountName,
    };
  }
}

/**
 * Refresh an expired access token.
 */
export async function refreshToken(platform: string, currentRefreshToken: string): Promise<TokenResponse> {
  const config = PLATFORM_CONFIGS[platform];
  if (!config) throw new Error(`Unsupported platform: ${platform}`);

  const creds = getConfig(platform);

  if (platform === 'tiktok') {
    const params = new URLSearchParams();
    params.set('client_key', creds.clientId);
    params.set('client_secret', creds.clientSecret);
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', currentRefreshToken);

    const response = await axios.post(config.tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = response.data;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      accountId: data.open_id || '',
      accountName: data.open_id || 'TikTok User',
    };
  }

  // Meta: just re-exchange (Facebook tokens can be refreshed by re-using the long-lived token exchange)
  // For simplicity, attempt to get a new long-lived token
  const longResponse = await axios.get('https://graph.facebook.com/v17.0/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      fb_exchange_token: currentRefreshToken || ''
    }
  });

  const newToken = longResponse.data.access_token;
  const expiresIn = longResponse.data.expires_in || 5_184_000;

  return {
    accessToken: newToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    accountId: '',
    accountName: '',
  };
}