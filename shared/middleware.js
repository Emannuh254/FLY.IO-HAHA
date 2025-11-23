const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

// Setup middleware
function setupMiddleware(app) {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  
  // Disable CSP for development
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  }));

  app.use(compression());
  app.use(cors({
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'https://fly-io-haha.onrender.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Enhanced logging middleware
  app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
    skip: (req, res) => NODE_ENV === 'production' && res.statusCode < 400
  }));

  // Enhanced rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/', authLimiter);

  // Request logging middleware
  app.use((req, res, next) => {
    const baseUrl = 'https://fly-io-haha.onrender.com';
    const fullUrl = `${baseUrl}${req.originalUrl}`;
    console.log(`[${new Date().toISOString()}] ${req.method} ${fullUrl}`);
    next();
  });

  // Setup static files
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    console.log('Creating public directory...');
    fs.mkdirSync(publicDir, { recursive: true });
  }

  app.use(express.static(path.join(__dirname, '../public'), {
    dotfiles: 'ignore',
    etag: true,
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      // Set proper MIME types
      const mimeType = mime.lookup(filePath);
      if (mimeType) {
        res.setHeader('Content-Type', mimeType);
      }
      
      // No cache for HTML files
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  // Fallback for static files
  app.use((req, res, next) => {
    // If the request is for a file with an extension, try to serve it
    if (path.extname(req.path).length > 0) {
      const filePath = path.join(publicDir, req.path);
      if (fs.existsSync(filePath)) {
        // Explicitly set content type for HTML files
        if (filePath.endsWith('.html')) {
          res.setHeader('Content-Type', 'text/html');
        }
        return res.sendFile(filePath);
      }
    }
    next();
  });
}

module.exports = { setupMiddleware };