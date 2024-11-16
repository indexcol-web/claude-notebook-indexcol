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

// Ruta para obtener todos los documentos
app.get('/api/documents', async (req, res) => {
  try {
    const [files] = await bucket.getFiles();
    
    const documents = files.map(file => {
      return {
        id: file.name,
        name: file.name.split('-').slice(1).join('-'), // Removemos el timestamp del nombre
        type: file.metadata.contentType,
        url: `https://storage.googleapis.com/${BUCKET_NAME}/${file.name}`,
        uploadDate: file.metadata.timeCreated
      };
    });

    res.json({ documents });
  } catch (error) {
    console.error('Error getting documents:', error);
    res.status(500).json({ error: 'Error getting documents' });
  }
});


// Upload route with improved error handling
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Starting file upload to GCS');
    
    const filename = Date.now() + '-' + req.file.originalname;
    const file = bucket.file(filename);

    // Crear el stream y subir el archivo
    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype
      }
    });

    // Hacer el archivo público
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`;
    
    const documentInfo = {
      id: Date.now().toString(),
      name: req.file.originalname,
      type: req.file.mimetype,
      url: publicUrl,
      uploadDate: new Date()
    };

    console.log('Upload successful, returning response');
    res.json({
      success: true,
      document: documentInfo
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Error uploading file',
      details: error.message 
    });
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
