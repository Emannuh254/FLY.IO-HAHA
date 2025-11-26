const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

function setupMiddleware(app) {
  const NODE_ENV = process.env.NODE_ENV || 'development';

  // Allow all external scripts/styles
  app.use(cors({
      origin: [
          'http://localhost:3000',
          'http://localhost:3006',
          'https://fly-io-haha.onrender.com',
          'https://forexproo.onrender.com'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
  }));

  app.use(compression());
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Logging
  app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use('/api/', limiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts, please try again later.'
  });
  app.use('/api/auth/', authLimiter);

  // Request logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });

  // Static files
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  app.use(express.static(publicDir, {
    dotfiles: 'ignore',
    etag: true,
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      const mimeType = mime.lookup(filePath);
      if (mimeType) res.setHeader('Content-Type', mimeType);
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }
  }));

  // Fallback for static files
  app.use((req, res, next) => {
    if (path.extname(req.path).length > 0) {
      const filePath = path.join(publicDir, req.path);
      if (fs.existsSync(filePath)) {
        if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html');
        return res.sendFile(filePath);
      }
    }
    next();
  });
}

module.exports = { setupMiddleware };
