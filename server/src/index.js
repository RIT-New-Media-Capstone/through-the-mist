const express = require('express');
const path = require('path');
const app = express();

// Define the path to the client directory
const clientPath = path.join(__dirname, '../../client');

// Serve static files from the "client" directory
app.use(express.static(clientPath));

// Serve the HTML file for the root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
});

// Additional routes can be defined here

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});