import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await axios.post('/api/auth/google', {
          token: tokenResponse.access_token
        });
        setUser(res.data);
      } catch (error) {
        console.error('Login error:', error);
      }
    }
  });

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');

    try {
      const response = await axios.post('/api/chat', {
        messages: newMessages
      });
      setMessages([...newMessages, response.data.message]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow p-4">
        {!user ? (
          <button onClick={login} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Login with Google
          </button>
        ) : (
          <div className="flex items-center space-x-4">
            <img src={user.picture} className="w-8 h-8 rounded-full" alt="Profile" />
            <span>{user.name}</span>
          </div>
        )}
      </header>

      <main className="container mx-auto p-4">
        <div className="bg-white rounded-lg shadow p-4">
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
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
