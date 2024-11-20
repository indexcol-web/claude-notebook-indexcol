import React, { useState, useEffect } from 'react';
import jwt_decode from 'jwt-decode';
import axios from 'axios';
import DocumentUpload from './components/DocumentUpload';

function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');

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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
        model: selectedModel
      });
      
      if (response.data.message) {
        setMessages([...newMessages, response.data.message]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: 'Lo siento, hubo un error al procesar tu solicitud.' 
      }]);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">Bienvenido a Claude Notebook</h1>
          <p className="mb-4">Por favor inicia sesión para continuar</p>
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
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-4 bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-bold mb-4">Análisis de Documentos</h2>
            <DocumentUpload />
          </div>

          <div className="col-span-8 bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-bold mb-4">Chat</h2>
            
            {/* Selector de modelo */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modelo de IA
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="p-2 border rounded w-full"
              >
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4o-mini">GPT-4 Mini</option>
              </select>
            </div>

            <div className="h-[calc(100vh-400px)] overflow-y-auto mb-4 border rounded p-4">
              {messages.map((message, index) => (
                <div key={index} className={`p-2 mb-2 rounded ${
                  message.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <div className="text-sm text-gray-600 mb-1">
                    {message.role === 'user' ? 'Tú' : 'Asistente'}:
                  </div>
                  {message.content}
                </div>
              ))}
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                className="flex-1 p-2 border rounded"
                placeholder="Escribe tu mensaje..."
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
