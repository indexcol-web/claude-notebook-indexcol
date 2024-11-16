import React, { useState, useEffect } from 'react';
import jwt_decode from 'jwt-decode';
import axios from 'axios';
import DocumentUpload from './components/DocumentUpload';

function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState([]);

  useEffect(() => {
    const google = window.google;
    if (google) {
      google.accounts.id.initialize({
        client_id: window.GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
      });

      if (!user) {
        google.accounts.id.renderButton(
          document.getElementById("googleBtn"),
          { theme: "outline", size: "large" }
        );
      }
    }
  }, [user]);

  const handleCredentialResponse = async (response) => {
    try {
      const decodedToken = jwt_decode(response.credential);
      console.log("Decoded token:", decodedToken);

      const res = await axios.post('/api/auth/google', {
        token: response.credential,
        userData: decodedToken
      });

      if (res.data.success) {
        setUser(decodedToken);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

const sendMessage = async () => {
  if (!input.trim() || !user) return;

  const newMessages = [...messages, { role: 'user', content: input }];
  setMessages(newMessages);
  setInput('');

  try {
    const response = await axios.post('/api/chat', {
      messages: newMessages,
      documentIds: selectedDocuments
    });
    setMessages([...newMessages, response.data.message]);
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">Welcome to Claude Notebook</h1>
          <p className="mb-4">Please login to continue</p>
          <div id="googleBtn"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow p-4">
        <div className="flex items-center justify-between container mx-auto">
          <div className="flex items-center space-x-4">
            <img src={user.picture} className="w-8 h-8 rounded-full" alt="Profile" />
            <span className="font-semibold">{user.name}</span>
          </div>
          <button
            onClick={() => setUser(null)}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-bold mb-4">Document Analysis</h2>
            <DocumentUpload />
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-bold mb-4">Chat</h2>
            <div className="h-96 overflow-y-auto mb-4">
              {messages.map((message, index) => (
                <div key={index} className={`p-2 mb-2 rounded ${
                  message.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  {message.content}
                </div>
              ))}
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 p-2 border rounded"
                placeholder="Type your message..."
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
