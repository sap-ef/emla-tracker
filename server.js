const cds = require('@sap/cds');
const express = require('express');

// Configure body parser limits BEFORE any other middleware
cds.on('bootstrap', (app) => {
  console.log('[server.js] Configuring body parser with 10MB limit');

  // Remove default body parsers and add custom ones FIRST
  // This MUST be done before other middlewares to avoid the 100KB default limit
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.text({ limit: '10mb', type: ['text/plain', 'application/http', 'multipart/mixed'] }));
  app.use(express.raw({ limit: '10mb' }));

  console.log('[server.js] Body parser configured successfully');
});

// Start the CDS server
(async () => {
  try {
    await cds.server();
    console.log('[server.js] CDS server started successfully with 10MB body limit');
  } catch (err) {
    console.error('[server.js] Failed to start CDS server:', err);
    process.exit(1);
  }
})();
