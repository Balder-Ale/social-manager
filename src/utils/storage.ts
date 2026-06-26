import * as Minio from 'minio';

type StorageConfig = {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicUrl: string;
  useSSL: boolean;
};

function getStorageConfig(): StorageConfig {
  const provider = process.env.STORAGE_PROVIDER || 'minio';

  if (provider === 'r2') {
    return {
      endpoint: process.env.R2_ENDPOINT || 'https://<account>.r2.cloudflarestorage.com',
      region: process.env.R2_REGION || 'auto',
      accessKey: process.env.R2_ACCESS_KEY_ID || '',
      secretKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucket: process.env.R2_BUCKET || 'social-manager-assets',
      publicUrl: process.env.R2_PUBLIC_URL || '',
      useSSL: true,
    };
  }

  // Default: MinIO
  const minioEndpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
  let hostname = 'localhost';
  let port = 9000;
  try {
    const url = new URL(minioEndpoint);
    hostname = url.hostname;
    port = parseInt(url.port) || 9000;
  } catch (_) {
    // use defaults
  }

  return {
    endpoint: minioEndpoint,
    region: 'us-east-1',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'social-manager-assets',
    publicUrl: minioEndpoint,
    useSSL: false,
  };
}

let cachedClient: Minio.Client | null = null;
let cachedConfig: StorageConfig | null = null;

function getClient(): { client: Minio.Client; config: StorageConfig } {
  const config = getStorageConfig();

  // Return cached client only if config hasn't changed
  if (cachedClient && cachedConfig && JSON.stringify(cachedConfig) === JSON.stringify(config)) {
    return { client: cachedClient, config };
  }

  const url = new URL(
    config.endpoint.startsWith('http') ? config.endpoint : `https://${config.endpoint}`
  );

  const client = new Minio.Client({
    endPoint: url.hostname,
    port: url.port ? parseInt(url.port) : config.useSSL ? 443 : 80,
    useSSL: config.useSSL,
    region: config.region,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });

  cachedClient = client;
  cachedConfig = config;
  return { client, config };
}

/**
 * Uploads a file to the configured storage (MinIO or Cloudflare R2)
 * and returns the public access URL.
 */
export async function uploadFile(
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const { client, config } = getClient();

  try {
    const exists = await client.bucketExists(config.bucket);
    if (!exists) {
      await client.makeBucket(config.bucket, config.region);
    }

    await client.putObject(config.bucket, fileName, fileBuffer, fileBuffer.length, {
      'Content-Type': mimeType,
    });

    // Build public URL
    if (config.publicUrl) {
      return `${config.publicUrl}/${config.bucket}/${fileName}`;
    }
    return `${config.endpoint}/${config.bucket}/${fileName}`;
  } catch (error) {
    console.error('Error uploading file to storage, using fallback URL:', error);
    return `${config.endpoint}/${config.bucket}/${fileName}`;
  }
}