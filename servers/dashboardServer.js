// dashboardServer.js - Updated with authentication endpoint
const express = require('express');
const path = require('path');
const { setupMiddleware } = require('../shared/middleware');
const { authenticateToken } = require('../shared/auth');
const supabase = require('../supabaseClient');

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

// Get user profile (protected route)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.userId)
      .single();
    
    if (error) throw error;
    
    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
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