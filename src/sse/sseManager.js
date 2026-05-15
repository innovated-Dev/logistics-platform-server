// src/sse/sseManager.js
import { logger } from "../utils/logger.js";

const sseClients = {};

export function addClient(email, res) {
     if(!res){
        logger.error("No client received!");
        return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if(!sseClients[email]) sseClients[email] = [];
    sseClients[email].push(res);
}

export function removeClient(email, res) {
     sseClients[email] = sseClients[email].filter(r => r !== res);
}

export function notifyClient(email) {
  const clients = sseClients[email];
  if(!clients) return; 
  clients.forEach((eachClient) => {
    eachClient.write(`data: ${JSON.stringify({ verified: true })}\n\n`);
  });
}


