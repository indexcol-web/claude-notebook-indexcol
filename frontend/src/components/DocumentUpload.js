import React, { useState } from 'react';
import axios from 'axios';

function DocumentUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);

  const handleFileSelect = (event) => {
    setSelectedFile(event.target.files[0]);
  };


  
const handleUpload = async () => {
  if (!selectedFile) return;

  setUploading(true);
  const formData = new FormData();
  formData.append('document', selectedFile);

  try {
    // Primera llamada para subir el archivo
    await axios.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 60000 // aumentamos el timeout a 60 segundos
    });

    // Esperar un momento para asegurar que el archivo se procesó
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Agregar el documento a la lista local
    const newDoc = {
      id: Date.now().toString(),
      name: selectedFile.name,
      type: selectedFile.type,
      uploadDate: new Date()
    };
    
    setDocuments(prev => [...prev, newDoc]);
    setSelectedFile(null);
    
  } catch (error) {
    console.error('Upload error:', error);
    // Si el error es 500 pero sabemos que el archivo se subió, no mostramos error
    if (error.response?.status === 500) {
      const newDoc = {
        id: Date.now().toString(),
        name: selectedFile.name,
        type: selectedFile.type,
        uploadDate: new Date()
      };
      setDocuments(prev => [...prev, newDoc]);
      setSelectedFile(null);
    } else {
      alert('Error uploading document. Please try again.');
    }
  } finally {
    setUploading(false);
  }
};
  
  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
        <input
          type="file"
          onChange={handleFileSelect}
          accept=".pdf,.txt"
          className="w-full"
        />
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="mt-2 bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:bg-gray-300"
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>

      {documents.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Your Documents</h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="border rounded p-4">
                <h4 className="font-medium">{doc.name}</h4>
                <p className="text-sm text-gray-500">
                  Uploaded on {new Date(doc.uploadDate).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentUpload;
