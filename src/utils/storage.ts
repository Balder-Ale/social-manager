import * as Minio from 'minio';

const minioEndpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
let hostname = 'localhost';
let port = 9000;

try {
  const url = new URL(minioEndpoint);
  hostname = url.hostname;
  port = parseInt(url.port) || 9000;
} catch (e) {
  // Use defaults if URL parsing fails
}

const minioClient = new Minio.Client({
  endPoint: hostname,
  port: port,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

const bucketName = process.env.MINIO_BUCKET || 'social-manager-assets';

/**
 * Uploads a file to MinIO bucket and returns the access URL.
 */
export async function uploadFile(fileName: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
    }
    
    await minioClient.putObject(bucketName, fileName, fileBuffer, fileBuffer.length, {
      'Content-Type': mimeType,
    });
    
    return `${minioEndpoint}/${bucketName}/${fileName}`;
  } catch (error) {
    console.error('Error uploading file to MinIO, using fallback URL:', error);
    return `${minioEndpoint}/${bucketName}/${fileName}`;
  }
}
