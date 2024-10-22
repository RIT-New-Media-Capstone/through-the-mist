const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Define the path to the client directory
const clientPath = path.join(__dirname, '../../client');

// Serve static files from the "client" directory
app.use(express.static(clientPath));

// Serve the HTML file for the root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Additional routes here

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

let connectedClients = [];

// Handle WebSocket connections
wss.on('connection', (ws) => {
  if (connectedClients.length < 2) {
    connectedClients.push(ws);

    // Relay messages between clients
    ws.on('message', (message) => {
      connectedClients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message); // Relay offer/answer/ICE candidates to the other peer
        }
      });
    });

    // Remove the client when they disconnect
    ws.on('close', () => {
      connectedClients = connectedClients.filter(client => client !== ws);
    });
  } else {
    ws.close();//closes the connection
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});