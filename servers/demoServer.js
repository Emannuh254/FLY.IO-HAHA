const express = require('express');
const path = require('path');
const { setupMiddleware } = require('../shared/middleware');

const app = express();
const PORT = process.env.DEMO_PORT || 3004;

// Setup middleware
setupMiddleware(app);

// Serve demo.html
app.get(['/demo', '/demo.html'], (req, res) => {
  const filePath = path.join(__dirname, '../public/demo.html');
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(filePath);
});

// Start server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Demo server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start demo server:', err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };