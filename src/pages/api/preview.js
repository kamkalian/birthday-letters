import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Stream file from request (raw body)
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Save temp file
    const tempFileName = `upload_${Date.now()}${path.extname(req.headers['x-file-name'] || '.csv')}`;
    const uploadDir = path.join(process.cwd(), 'uploads');
    const uploadPath = path.join(uploadDir, tempFileName);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    fs.writeFileSync(uploadPath, buffer);

    // Call FastAPI preview endpoint
    const fastApiResponse = await fetch('http://localhost:8000/preview_csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: uploadPath, n_rows: 10 }),
    });

    const data = await fastApiResponse.json();
    if (!fastApiResponse.ok) {
      return res.status(400).json({ error: 'Preview failed', details: data });
    }

    return res.status(200).json({
      file_path: uploadPath,
      ...data,
    });
  } catch (err) {
    console.error('Preview error:', err);
    return res.status(500).json({ error: err.message || 'Preview failed' });
  }
}
