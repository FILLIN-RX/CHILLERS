"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendLog = appendLog;
exports.getLogs = getLogs;
exports.addSSEClient = addSSEClient;
const MAX_LINES = 2000;
const buffer = [];
const clients = [];
function appendLog(line) {
    buffer.push(line);
    if (buffer.length > MAX_LINES)
        buffer.shift();
    for (const client of clients) {
        client.write(`data: ${JSON.stringify({ line })}\n\n`);
    }
}
function getLogs(limit = 200) {
    return buffer.slice(-limit);
}
function addSSEClient(res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    for (const line of buffer) {
        res.write(`data: ${JSON.stringify({ line })}\n\n`);
    }
    clients.push(res);
    res.on('close', () => {
        const idx = clients.indexOf(res);
        if (idx !== -1)
            clients.splice(idx, 1);
    });
}
