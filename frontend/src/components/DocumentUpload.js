import React, { useState, useEffect } from 'react';
import axios from 'axios';

function DocumentUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get('/api/documents');
      setDocuments(response.data.documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

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
        }
      });

      if (response.data.success) {
        await fetchDocuments(); // Recargar la lista después de subir
        setSelectedFile(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    if (window.confirm(`Are you sure you want to delete "${doc.name}"?`)) {
      try {
        await axios.delete(`/api/documents/${doc.id}`);
        await fetchDocuments(); // Recargar la lista después de borrar
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Error deleting document. Please try again.');
      }
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
            {loading ? (
              <p>Loading documents...</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="border rounded p-4 flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{doc.name}</h4>
                    <p className="text-sm text-gray-500">
                      Uploaded on {new Date(doc.uploadDate).toLocaleDateString()}
                    </p>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 text-sm mt-2 inline-block"
                    >
                      View Document
                    </a>
                  </div>
                  <button
                    onClick={() => handleDelete(doc)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentUpload;
