const express = require('express');
const path = require('path');
const { setupMiddleware } = require('../shared/middleware');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3006;

// Setup middleware
setupMiddleware(app);

// Serve dashboard.html
app.get(['/dashboard', '/dashboard.html'], (req, res) => {
  const filePath = path.join(__dirname, '../public/dashboard.html');
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(filePath);
});

// Start server
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Dashboard server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start dashboard server:', err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };