import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  
  // Remove query params
  filePath = filePath.split('?')[0];
  
  let fullPath;
  
  // Handle dist folder access from parent directory
  if (filePath.startsWith('/dist/')) {
    fullPath = join(__dirname, '..', filePath);
  } else {
    fullPath = join(__dirname, filePath);
  }
  
  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  try {
    const content = await readFile(fullPath);
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404);
      res.end(`404 Not Found: ${filePath}`);
    } else {
      res.writeHead(500);
      res.end('500 Internal Server Error: ' + err.message);
    }
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🌍 Demo server running at http://localhost:${PORT}`);
  console.log('Make sure you ran "npm run build" first!');
});
