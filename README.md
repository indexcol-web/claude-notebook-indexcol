# claude-notebook-indexcol
A NotebookLM clone with OpenAI integration


# Claude Notebook Project

## Estructura del Proyecto
```
/
├── frontend/
│   ├── src/
│   │   ├── App.js              # Componente principal y lógica de autenticación
│   │   ├── index.js
│   │   └── components/
│   │       └── DocumentUpload.js # Manejo de documentos y chat
│   ├── public/
│   │   └── index.html
│   └── package.json
├── server.js                    # Backend con Google OAuth, OpenAI y Cloud Storage
└── package.json
```

## Configuración Necesaria

### Variables de Entorno en Render
```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OPENAI_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS_JSON=
```

### Servicios Configurados
- Google Cloud Storage: Bucket `claude-notebook-indexcol-storage`
- Google OAuth para autenticación
- OpenAI API para procesamiento de consultas
- Render para hosting

### Configuración de Render
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Puerto: 10000

## Funcionalidades
- Autenticación con Google
- Subida y almacenamiento de PDFs
- Extracción de texto de documentos
- Chat con contexto de documentos usando OpenAI
