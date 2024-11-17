const express = require('express');
const cors = require('cors');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const OpenAI = require('openai');
const { Storage } = require('@google-cloud/storage');
const multer = require('multer');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend/build')));

// Google OAuth setup
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuración de Multer para memoria
const upload = multer({
  storage: multer.memoryStorage()
});

// Función para extraer texto
async function extractText(buffer, mimetype) {
  try {
    if (mimetype === 'application/pdf') {
      const data = await pdfParse(buffer);
      console.log('PDF text extracted, length:', data.text.length);
      return data.text;
    } else if (mimetype === 'text/plain') {
      const text = buffer.toString('utf-8');
      console.log('Text file extracted, length:', text.length);
      return text;
    }
    return '';
  } catch (error) {
    console.error('Error extracting text:', error);
    return '';
  }
}

// Google Cloud Storage setup
const BUCKET_NAME = 'claude-notebook-indexcol-storage';

let storage;
try {
  storage = new Storage({
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
  });
  console.log('Google Cloud Storage initialized successfully');
} catch (error) {
  console.error('Error initializing Google Cloud Storage:', error);
}

const bucket = storage.bucket(BUCKET_NAME);

// Google Auth route
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token, userData } = req.body;
    
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    if (payload.email === userData.email) {
      res.json({
        success: true,
        user: userData
      });
    } else {
      throw new Error('Email verification failed');
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ 
      error: 'Authentication failed', 
      details: error.message 
    });
  }
});

// Upload route
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const extractedText = await extractText(req.file.buffer, req.file.mimetype);
    console.log('Extracted text length:', extractedText.length);

    const timestamp = Date.now();
    const safeFileName = `${timestamp}-${req.file.originalname}`;
    const file = bucket.file(safeFileName);

    // Subir archivo
    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        extractedText: extractedText // Guardar texto extraído en metadata
      }
    });

    // Hacer archivo público
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURIComponent(safeFileName)}`;

    const documentInfo = {
      id: safeFileName,
      name: req.file.originalname,
      type: req.file.mimetype,
      url: publicUrl,
      uploadDate: new Date()
    };

    res.json({
      success: true,
      document: documentInfo
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Error uploading file' });
  }
});

// Get documents route
app.get('/api/documents', async (req, res) => {
  try {
    const [files] = await bucket.getFiles();
    
    const documents = await Promise.all(files.map(async file => {
      await file.makePublic(); // Asegurar que el archivo sea público
      return {
        id: file.name,
        name: file.name.split('-').slice(1).join('-'),
        type: file.metadata.contentType,
        url: `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURIComponent(file.name)}`,
        uploadDate: file.metadata.timeCreated
      };
    }));

    res.json({ documents });
  } catch (error) {
    console.error('Error getting documents:', error);
    res.status(500).json({ error: 'Error getting documents' });
  }
});

// Delete document route
app.delete('/api/documents/:fileName', async (req, res) => {
  try {
    const file = bucket.file(req.params.fileName);
    await file.delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Error deleting file' });
  }
});

// Chat route
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    
    // Obtener todos los documentos y su contenido
    const [files] = await bucket.getFiles();
    const documentContents = await Promise.all(
      files.map(async file => {
        try {
          const [metadata] = await file.getMetadata();
          return metadata.extractedText || '';
        } catch (error) {
          console.error(`Error getting metadata for file ${file.name}:`, error);
          return '';
        }
      })
    );
    
    const documentContext = documentContents
      .filter(text => text.length > 0)
      .join('\n\n');

    const systemMessage = {
      role: 'system',
      content: `You are a helpful assistant analyzing all available documents. ${
        documentContext 
          ? 'Please use the following document content to help answer questions:\n\n' + documentContext
          : 'No document content available.'
      }`
    };

    const completion = await openai.chat.completions.create({
      messages: [systemMessage, ...messages],
      model: "gpt-3.5-turbo",
    });

    res.json(completion.choices[0]);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
