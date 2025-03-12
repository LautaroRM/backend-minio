require('dotenv').config();
const express = require('express');
const multer = require('multer');
const Minio = require('minio');
const cors = require('cors');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Configuración de MinIO
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

// Verificar si el bucket existe, si no, crearlo
const bucketName = process.env.MINIO_BUCKET;
minioClient.bucketExists(bucketName, (err, exists) => {
  if (err) {
    console.error(err);
  } else if (!exists) {
    minioClient.makeBucket(bucketName, 'us-east-1', (err) => {
      if (err) console.error(err);
      else console.log(`Bucket "${bucketName}" creado.`);
    });
  }
});

// Configurar almacenamiento con Multer y MinIO
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Ruta para subir archivos ZIP a MinIO
app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No se envió ningún archivo' });

  const fileName = `${Date.now()}-${file.originalname}`;

  minioClient.putObject(bucketName, fileName, file.buffer, (err, etag) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error subiendo el archivo' });
    }
    res.json({ message: 'Archivo subido correctamente', fileName });
  });
});

// Ruta para listar archivos
app.get('/files', (req, res) => {
  const stream = minioClient.listObjects(bucketName, '', true);
  const files = [];

  stream.on('data', (obj) => files.push(obj.name));
  stream.on('end', () => res.json({ files }));
  stream.on('error', (err) => res.status(500).json({ error: err.message }));
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
