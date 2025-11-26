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
  
  // Configure helmet with proper CSP for external resources
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https://randomuser.me", "https://images.unsplash.com"],
        connectSrc: ["'self'", "https://fly-io-haha.onrender.com", "https://forexproo.onrender.com"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));

  app.use(compression());
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
    const baseUrl = 'https://forexproo.onrender.com';
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

  // Serve static files with proper MIME types and caching
  app.use(express.static(publicDir, {
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