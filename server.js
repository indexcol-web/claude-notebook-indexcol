const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Google OAuth setup
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Serve static files
app.use(express.static('public'));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Google Auth route
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const { email, name, picture } = ticket.getPayload();
    res.json({ email, name, picture });
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
