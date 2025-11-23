// preloader.js
const fs = require('fs');
const path = require('path');

class Preloader {
  constructor() {
    this.cache = new Map();
    this.preloaded = false;
  }

  // Preload all HTML pages
  preloadPages() {
    if (this.preloaded) return;
    
    console.log('Preloading HTML pages...');
    
    // Define the pages to preload
    const pages = [
      'index.html',
      'admin.html',
      'dashboard.html',
      'trading.html',
      'deposit-withdraw.html',
      'profile.html',
      'referrals.html',
      'demo.html'
    ];
    
    // Get the public directory path
    const publicDir = path.join(__dirname, 'public');
    
    // Preload each page
    pages.forEach(page => {
      const filePath = path.join(publicDir, page);
      
      try {
        if (fs.existsSync(filePath)) {
          // Read the file content
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Store in cache
          this.cache.set(page, {
            content,
            lastModified: fs.statSync(filePath).mtime
          });
          
          console.log(`Preloaded: ${page}`);
        }
      } catch (err) {
        console.error(`Failed to preload ${page}:`, err.message);
      }
    });
    
    this.preloaded = true;
    console.log('All pages preloaded successfully');
  }

  // Get preloaded page content
  getPage(pageName) {
    const cached = this.cache.get(pageName);
    
    if (!cached) {
      return null;
    }
    
    // Check if file has been modified since preloading
    const filePath = path.join(__dirname, 'public', pageName);
    
    try {
      const stats = fs.statSync(filePath);
      
      if (stats.mtime > cached.lastModified) {
        // File has been modified, update cache
        const content = fs.readFileSync(filePath, 'utf8');
        this.cache.set(pageName, {
          content,
          lastModified: stats.mtime
        });
        return content;
      }
    } catch (err) {
      console.error(`Error checking file modification time for ${pageName}:`, err.message);
    }
    
    return cached.content;
  }

  // Check if a page is preloaded
  isPreloaded(pageName) {
    return this.cache.has(pageName);
  }

  // Clear the cache
  clearCache() {
    this.cache.clear();
    this.preloaded = false;
    console.log('Preloader cache cleared');
  }
}

// Create a singleton instance
const preloader = new Preloader();

module.exports = preloader;