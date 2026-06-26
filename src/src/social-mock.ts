import express from 'express';

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[Mock Social] ${req.method} ${req.url}`, req.body);
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'social-mock' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'social-mock' });
});

// Instagram API Mocks (v17.0 Graph API)
app.post('/v17.0/me/media', (req, res) => {
  const { image_url, caption, video_url } = req.body;
  console.log(`[Mock Instagram] Creating media container with caption: "${caption}"`);
  res.json({
    id: `ig_media_container_${Math.floor(Math.random() * 1000000)}`
  });
});

app.post('/v17.0/me/media_publish', (req, res) => {
  const { creation_id } = req.body;
  console.log(`[Mock Instagram] Publishing media container: ${creation_id}`);
  res.json({
    id: `ig_post_id_${Math.floor(Math.random() * 1000000)}`
  });
});

// Facebook API Mocks
app.post('/v17.0/me/feed', (req, res) => {
  const { message, link } = req.body;
  console.log(`[Mock Facebook] Creating feed post: "${message}"`);
  res.json({
    id: `fb_post_id_${Math.floor(Math.random() * 1000000)}`
  });
});

// TikTok API Mocks (v2 Publish)
app.post('/v2/post/publish/video/init/', (req, res) => {
  console.log('[Mock TikTok] Initializing video publish');
  res.json({
    data: {
      publish_id: `tt_publish_id_${Math.floor(Math.random() * 1000000)}`
    },
    error: {
      code: 'ok',
      message: ''
    }
  });
});

app.post('/v2/post/publish/content/init/', (req, res) => {
  console.log('[Mock TikTok] Initializing content publish');
  res.json({
    data: {
      publish_id: `tt_publish_id_${Math.floor(Math.random() * 1000000)}`
    },
    error: {
      code: 'ok',
      message: ''
    }
  });
});

// OAuth Mock Flows (returns a redirect code/token)
app.get('/oauth/authorize', (req, res) => {
  const { redirect_uri, state, client_id } = req.query;
  console.log(`[Mock OAuth] Authorizing for client: ${client_id}`);
  
  if (redirect_uri) {
    const callbackUrl = new URL(redirect_uri as string);
    callbackUrl.searchParams.append('code', `mock_code_${Math.floor(Math.random() * 1000000)}`);
    if (state) callbackUrl.searchParams.append('state', state as string);
    res.redirect(callbackUrl.toString());
  } else {
    res.status(400).send('Missing redirect_uri');
  }
});

app.post('/oauth/access_token', (req, res) => {
  res.json({
    access_token: `mock_access_token_${Math.floor(Math.random() * 1000000)}`,
    token_type: 'bearer',
    expires_in: 3600,
    scope: 'publish_video,publish_content'
  });
});

app.listen(port, () => {
  console.log(`🚀 Mock Social service listening on port ${port}`);
});
