const cds = require('@sap/cds');

// Configure larger payload limits before CDS starts
cds.on('bootstrap', (app) => {
    // Increase payload size limits
    app.use(require('express').json({ limit: '10mb' }));
    app.use(require('express').text({ limit: '10mb' }));
    app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
    
    console.log('Custom middleware applied with 10MB payload limits');
});

module.exports = cds.server;