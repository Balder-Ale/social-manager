// Unit tests for the OAuth service (src/services/oauth.ts)
// Focus: auth URL generation, code exchange logic, error handling

import axios from 'axios';

jest.mock('axios');
const mockedAxios = jest.mocked(axios);

// Set env vars required by getConfig() before importing
process.env.INSTAGRAM_CLIENT_ID = 'ig_client';
process.env.INSTAGRAM_CLIENT_SECRET = 'ig_secret';
process.env.INSTAGRAM_REDIRECT_URI = 'http://localhost:4001/api/auth/instagram/callback';
process.env.FACEBOOK_CLIENT_ID = 'fb_client';
process.env.FACEBOOK_CLIENT_SECRET = 'fb_secret';
process.env.FACEBOOK_REDIRECT_URI = 'http://localhost:4001/api/auth/facebook/callback';
process.env.TIKTOK_CLIENT_KEY = 'tt_client';
process.env.TIKTOK_CLIENT_SECRET = 'tt_secret';
process.env.TIKTOK_REDIRECT_URI = 'http://localhost:4001/api/auth/tiktok/callback';

import { buildAuthUrl, exchangeCode } from '../services/oauth';

// ─── buildAuthUrl ───────────────────────────────────────────────────

describe('buildAuthUrl()', () => {
  it('builds a valid Instagram/Facebook authorize URL', () => {
    const url = buildAuthUrl('instagram', 'test-state-123');
    expect(url).toContain('https://www.facebook.com/v17.0/dialog/oauth');
    expect(url).toContain('client_id=ig_client');
    expect(url).toContain('state=test-state-123');
    expect(url).toContain('response_type=code');
    expect(url).toContain('redirect_uri=' + encodeURIComponent('http://localhost:4001/api/auth/instagram/callback'));
  });

  it('builds a valid TikTok authorize URL', () => {
    const url = buildAuthUrl('tiktok', 'tt-state-456');
    expect(url).toContain('https://www.tiktok.com/v2/auth/authorize');
    expect(url).toContain('client_key=tt_client');
    expect(url).toContain('state=tt-state-456');
    expect(url).toContain('response_type=code');
  });

  it('throws for unknown platform', () => {
    expect(() => buildAuthUrl('snapchat', 's')).toThrow('Unsupported platform');
  });

  it('includes the correct scopes for Meta', () => {
    const url = buildAuthUrl('facebook', 's');
    expect(url).toContain('pages_show_list');
    expect(url).toContain('instagram_basic');
    expect(url).toContain('instagram_content_publish');
  });

  it('includes the correct scopes for TikTok', () => {
    const url = buildAuthUrl('tiktok', 's');
    expect(url).toContain('user.info.basic');
    expect(url).toContain('video.publish');
    expect(url).toContain('video.upload');
  });
});

// ─── exchangeCode ───────────────────────────────────────────────────

describe('exchangeCode()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TikTok', () => {
    const mockTokenResponse = {
      data: {
        access_token: 'tt_access_789',
        refresh_token: 'tt_refresh_789',
        expires_in: 86400,
        open_id: 'tt_user_123'
      }
    };

    it('exchanges code for token successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);

      const result = await exchangeCode('tiktok', 'auth_code_xyz');

      expect(result.accessToken).toBe('tt_access_789');
      expect(result.refreshToken).toBe('tt_refresh_789');
      expect(result.accountId).toBe('tt_user_123');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      // Verify token URL
      const callUrl = mockedAxios.post.mock.calls[0][0];
      expect(callUrl).toBe('https://open.tiktokapis.com/v2/oauth/token/');
    });

    it('throws on network error', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network failure'));

      await expect(exchangeCode('tiktok', 'code')).rejects.toThrow('Network failure');
    });
  });

  describe('Instagram / Facebook (Meta)', () => {
    beforeEach(() => {
      // Mock the short-lived token exchange
      mockedAxios.get.mockResolvedValueOnce({
        data: { access_token: 'short_token_abc' }
      });
    });

    it('exchanges code for a long-lived token', async () => {
      // Mock the long-lived token exchange
      mockedAxios.get.mockResolvedValueOnce({
        data: { access_token: 'long_token_xyz', expires_in: 5184000 }
      });

      // Mock the /me endpoint for account info
      mockedAxios.get.mockResolvedValueOnce({
        data: { id: 'fb_user_456', name: 'Test User' }
      });

      const result = await exchangeCode('facebook', 'auth_code_abc');

      expect(result.accessToken).toBe('long_token_xyz');
      expect(result.accountId).toBe('fb_user_456');
      expect(result.accountName).toBe('Test User');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('handles Instagram by fetching linked business account', async () => {
      // Long-lived token exchange
      mockedAxios.get.mockResolvedValueOnce({
        data: { access_token: 'long_token_ig', expires_in: 5184000 }
      });

      // Mock /me/accounts to return pages
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: [{ id: 'page_789', name: 'My Page' }] }
      });

      // Mock page detail to return IG business account
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          instagram_business_account: {
            id: 'ig_biz_111',
            name: 'My IG Account'
          }
        }
      });

      const result = await exchangeCode('instagram', 'code_ig');

      expect(result.accountId).toBe('ig_biz_111');
      expect(result.accountName).toBe('My IG Account');
    });

    it('falls back to user profile when no pages found for Instagram', async () => {
      // Long-lived token exchange
      mockedAxios.get.mockResolvedValueOnce({
        data: { access_token: 'long_token', expires_in: 5184000 }
      });

      // No pages
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: [] }
      });

      // Fallback to /me
      mockedAxios.get.mockResolvedValueOnce({
        data: { id: 'fb_user_fallback', name: 'Fallback User' }
      });

      const result = await exchangeCode('instagram', 'code');

      expect(result.accountId).toBe('fb_user_fallback');
      expect(result.accountName).toBe('Fallback User');
    });

    it('throws on exchange failure', async () => {
      jest.clearAllMocks();
      mockedAxios.get.mockRejectedValueOnce(new Error('Invalid code'));

      await expect(exchangeCode('facebook', 'bad_code')).rejects.toThrow('Invalid code');
    });
  });
});