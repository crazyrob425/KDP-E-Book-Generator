import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { runAutomation } from './automation-worker';
import { KdpAutomationPayload, BotUpdate } from '../types';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');
    let automationGenerator: AsyncGenerator<void, void, string> | null = null;

    const sendUpdate = (update: BotUpdate) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(update));
        }
    };

    ws.on('message', async (message: string) => {
        try {
            const data = JSON.parse(message);

            if (automationGenerator) {
                // An automation process is already running and waiting for input (e.g., CAPTCHA).
                if (data.type === 'captcha_solution') {
                    const result = await automationGenerator.next(data.solution);
                    if (result.done) {
                        automationGenerator = null; // The generator has finished.
                    }
                }
            } else {
                // This is the first message, which should be the main payload.
                const payload: KdpAutomationPayload = data;
                console.log('Received automation payload for:', payload.outline.title);

                automationGenerator = runAutomation(payload, sendUpdate);
                const result = await automationGenerator.next();
                if (result.done) {
                    automationGenerator = null; // The generator finished without yielding.
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
            const errorMessage = (error instanceof Error) ? error.message : 'Invalid payload or server error.';
            sendUpdate({ type: 'error', message: errorMessage });
            ws.close();
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        // Terminate any running generator if the client disconnects.
        if (automationGenerator) {
            automationGenerator.return();
            automationGenerator = null;
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});