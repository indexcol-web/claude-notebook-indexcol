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
    const { messages, documentIds } = req.body;
    console.log('Received request with documentIds:', documentIds);
    
    // Si se especifican documentos, obtener su contenido
    let documentContext = '';
    if (documentIds && documentIds.length > 0) {
      console.log('Getting metadata for documents...');
      const files = await Promise.all(
        documentIds.map(async (id) => {
          console.log('Getting metadata for document:', id);
          return bucket.file(id).getMetadata();
        })
      );
      
      documentContext = files
        .map(([metadata]) => {
          console.log('Metadata:', metadata);
          return metadata.metadata?.extractedText || '';
        })
        .join('\n\n');
      
      console.log('Document context length:', documentContext.length);
      // Mostrar los primeros 500 caracteres del contexto para verificar
      console.log('Document context preview:', documentContext.substring(0, 500));
    }

    // Crear el mensaje del sistema con el contexto
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant analyzing documents. ${
        documentContext ? 'Here is the context from the selected documents:\n\n' + documentContext : ''
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



// Ruta para obtener todos los documentos
app.get('/api/documents', async (req, res) => {
  try {
    const [files] = await bucket.getFiles();
    
    const documents = files.map(file => {
      const name = decodeURIComponent(file.name.split('-').slice(1).join('-')); // Decodificar el nombre
      return {
        id: file.name,
        name: name,
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

// Ruta para eliminar un documento
app.delete('/api/documents/:fileName', async (req, res) => {
  try {
    const fileName = req.params.fileName;
    const file = bucket.file(fileName);
    
    await file.delete();
    
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Error deleting document' });
  }
});

const pdfParse = require('pdf-parse');

// Función para extraer texto
async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  } else if (mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  }
  return '';
}

// Upload route
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Starting file upload and text extraction');

    // Extraer texto del documento
    const extractedText = await extractText(req.file.buffer, req.file.mimetype);
    console.log('Extracted text length:', extractedText.length);

    const filename = Date.now() + '-' + encodeURIComponent(req.file.originalname);
    const file = bucket.file(filename);

    // Subir el archivo con metadata incluyendo el texto extraído
    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        extractedText: extractedText // Guardar el texto extraído en metadata
      },
      public: true
    });

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`;

    const documentInfo = {
      id: filename,
      name: decodeURIComponent(filename.split('-').slice(1).join('-')),
      type: req.file.mimetype,
      url: publicUrl,
      uploadDate: new Date(),
      hasText: extractedText.length > 0
    };

    console.log('Upload successful');
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
