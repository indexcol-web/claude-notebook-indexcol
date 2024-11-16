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
    const response = await axios.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000 // 30 segundos de timeout
    });

    if (response.data.success) {
      setDocuments([...documents, response.data.document]);
      setSelectedFile(null);
    }
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error.response?.data?.error || error.message || 'Error uploading document';
    alert(`Error uploading document: ${errorMessage}`);
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
