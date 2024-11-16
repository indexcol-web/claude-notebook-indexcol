const express = require('express');
const cors = require('cors');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const OpenAI = require('openai');
const { Storage } = require('@google-cloud/storage');
const multer = require('multer');
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

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Google Auth route
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token, userData } = req.body;
    
    // Verificar el token con Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    console.log("Auth payload:", payload);
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

// OpenAI chat route
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const completion = await openai.chat.completions.create({
      messages,
      model: "gpt-3.5-turbo",
    });
    res.json(completion.choices[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload route with improved error handling
app.post('/api/upload', upload.single('document'), async (req, res) => {
  let responded = false;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Starting file upload to GCS');
    console.log('File details:', {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const blob = bucket.file(Date.now() + '-' + req.file.originalname);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: req.file.mimetype
      }
    });

    blobStream.on('error', (error) => {
      console.error('Blob stream error:', error);
      if (!responded) {
        responded = true;
        res.status(500).json({ error: 'Error uploading file to storage' });
      }
    });

    blobStream.on('finish', async () => {
      try {
        console.log('File upload stream finished');
        await blob.makePublic();
        const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${blob.name}`;
        
        const documentInfo = {
          id: Date.now().toString(),
          name: req.file.originalname,
          type: req.file.mimetype,
          url: publicUrl,
          uploadDate: new Date()
        };

        console.log('Upload successful, returning response');
        if (!responded) {
          responded = true;
          res.json({
            success: true,
            document: documentInfo
          });
        }
      } catch (error) {
        console.error('Error in finish handler:', error);
        if (!responded) {
          responded = true;
          res.status(500).json({ error: 'Error processing uploaded file' });
        }
      }
    });

    console.log('Piping file buffer to blob stream');
    blobStream.end(req.file.buffer);
  } catch (error) {
    console.error('Upload route error:', error);
    if (!responded) {
      responded = true;
      res.status(500).json({ error: 'Error processing document upload' });
    }
  }
});

// Todas las demás rutas sirven el index.html de React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
