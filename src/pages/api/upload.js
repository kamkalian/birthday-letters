import fs from 'fs';
import path from 'path';
import { NextApiRequest, NextApiResponse } from 'next';

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
    // Datei aus dem Request streamen
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Temporären Dateinamen erstellen
    const tempFileName = `upload_${Date.now()}${path.extname(req.headers['x-file-name'] || '.tmp')}`;
    const uploadPath = path.join(process.cwd(), 'uploads', tempFileName);

    // Upload-Verzeichnis sicherstellen
    if (!fs.existsSync(path.join(process.cwd(), 'uploads'))) {
      fs.mkdirSync(path.join(process.cwd(), 'uploads'));
    }

    // Datei speichern
    fs.writeFileSync(uploadPath, buffer);

    // FastAPI Endpoint aufrufen
    const fastApiResponse = await fetch('http://localhost:8000/create_pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({'file_path': uploadPath}),
    });

    if (!fastApiResponse.ok) {
      throw new Error('FastAPI processing failed');
    }

    const blob = await fastApiResponse.blob();
    const blobBuffer = await blob.arrayBuffer();
    
    // 4. Korrekte Next.js Response senden
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=document.pdf');
    res.status(200).send(Buffer.from(blobBuffer));

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'File upload failed' });
  }
}