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
// Modificar la ruta de subida
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const extractedText = await extractText(req.file.buffer, req.file.mimetype);
    const timestamp = Date.now();
    
    // Codificar el nombre del archivo para almacenamiento
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const safeFileName = `${timestamp}-${originalName}`;
    const file = bucket.file(safeFileName);

    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        extractedText: extractedText,
        originalName: originalName // Guardar nombre original en metadata
      }
    });

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURIComponent(safeFileName)}`;

    const documentInfo = {
      id: safeFileName,
      name: originalName,
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
// Ruta de listado modificada
app.get('/api/documents', async (req, res) => {
  try {
    const [files] = await bucket.getFiles();
    
    const documents = await Promise.all(files.map(async (file) => {
      const [metadata] = await file.getMetadata();
      
      // Obtener el nombre original del archivo
      const timestampPart = file.name.split('-')[0];
      const originalNamePart = file.name.slice(timestampPart.length + 1);
      
      return {
        id: file.name,
        name: decodeURIComponent(originalNamePart),
        type: metadata.contentType,
        url: `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURIComponent(file.name)}`,
        uploadDate: metadata.timeCreated
      };
    }));

    res.json({ documents });
  } catch (error) {
    console.error('Error getting documents:', error);
    res.status(500).json({ error: 'Error retrieving documents' });
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
// Envio de info al Chat
// En server.js
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gpt-3.5-turbo' } = req.body; // Default a gpt-3.5-turbo
    
    // Reset del historial para obtener contexto fresco
    const userMessages = messages.filter(msg => msg.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    
    const [files] = await bucket.getFiles();
    const documentContexts = await Promise.all(
      files.map(async file => {
        try {
          const [metadata] = await file.getMetadata();
          const fileName = file.name.split('-').slice(1).join('-');
          return {
            name: decodeURIComponent(fileName),
            content: metadata.extractedText || ''
          };
        } catch (error) {
          console.error(`Error getting metadata for file ${file.name}:`, error);
          return null;
        }
      })
    );

    const formattedContext = documentContexts
      .filter(doc => doc && doc.content)
      .map(doc => `=== BEGIN DOCUMENT: ${doc.name} ===\n\n${doc.content}\n\n=== END DOCUMENT ===`)
      .join('\n\n');

    const systemMessage = {
      role: 'system',
      content: `You are an advanced document analysis AI assistant. Your primary function is to analyze and provide information from the following documents:

${documentContexts.filter(doc => doc).map(doc => `- ${doc.name}`).join('\n')}

Critical Instructions:
1. The content provided in these documents is REAL and VALID. Treat all document content as actual information, not examples or placeholders.

2. When answering:
   - Use ONLY information found in the documents
   - Cite specific details from the documents
   - Respond in the same language as the question
   - If information isn't in the documents, say "I don't have that information in the available documents"

3. Document content is clearly marked between BEGIN and END tags. Everything between these tags is valid content that you should use to answer questions.

Here are the source documents with their full content:\n\n${formattedContext}`
    };

    const completion = await openai.chat.completions.create({
      messages: [systemMessage, { role: 'user', content: lastUserMessage.content }],
      model: model,
      temperature: 0.3,
      max_tokens: 2000
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
