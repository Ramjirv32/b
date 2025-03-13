import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Simple diagnostic route
app.get('/', (req, res) => {
  res.json({
    message: 'Debug API is working',
    headers: req.headers,
    method: req.method,
    path: req.path
  });
});

// Test route that returns JSON
app.post('/test-json', (req, res) => {
  res.json({
    success: true,
    receivedBody: req.body,
    message: 'POST endpoint is working'
  });
});

// Test route for 404 handling
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '404 Not Found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start the server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Debug server is running on http://localhost:${PORT}`);
  });
}

export default app;
