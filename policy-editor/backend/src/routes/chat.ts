import express from 'express';
import { McpClient } from '../mcp/client.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
let mcpClient: McpClient | null = null;

// Initialize MCP client
const initializeMcpClient = async (serverPath: string): Promise<void> => {
    if (mcpClient) {
        await mcpClient.cleanup();
    }

    mcpClient = new McpClient();
    try {
        await mcpClient.connectToServer(serverPath);
        logger.info(`MCP client connected to server at ${serverPath}`);
    } catch (error) {
        logger.error('Failed to initialize MCP client:', error);
        mcpClient = null;
        throw error;
    }
};

// POST /api/chat - Process a chat message
router.post('/', async (req, res) => {
    try {
        // Extract message, history, and the new context fields
        const { message, history, branchId, fileContent, userName } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required and must be a string' });
        }
        // Optional: Validate branchId and fileContent types if needed
        if (branchId && typeof branchId !== 'string') {
            return res.status(400).json({ error: 'branchId must be a string if provided' });
        }
        if (fileContent && typeof fileContent !== 'string') {
            return res.status(400).json({ error: 'fileContent must be a string if provided' });
        }
        if (userName && typeof userName !== 'string') {
            return res.status(400).json({ error: 'userName must be a string if provided' });
        }

        // Validate history if provided
        if (history && !Array.isArray(history)) {
            return res.status(400).json({ error: 'History must be an array of messages' });
        }

        if (!mcpClient) {
            return res.status(500).json({ error: 'MCP client is not initialized' });
        }

        // Pass message, history, and context to processQuery
        const response = await mcpClient.processQuery(message, history || [], branchId, fileContent, userName);
        return res.json({ response });
    } catch (error) {
        logger.error('Error processing chat message:', error);
        return res.status(500).json({
            error: 'Failed to process message',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// POST /api/chat/connect - Connect to the MCP server defined in .env
router.post('/connect', async (req, res) => {
    try {
        const serverPath = process.env.MCP_SERVER_PATH;

        if (!serverPath || typeof serverPath !== 'string') {
            logger.error('MCP_SERVER_PATH environment variable is not set or is invalid.');
            return res.status(400).json({ error: 'MCP_SERVER_PATH environment variable is not configured correctly on the server.' });
        }

        await initializeMcpClient(serverPath);
        return res.json({ success: true, message: `Connected to MCP server at ${serverPath}` });
    } catch (error) {
        logger.error('Error connecting to MCP server:', error);
        return res.status(500).json({
            error: 'Failed to connect to MCP server',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// GET /api/chat/status - Check MCP client status
router.get('/status', (req, res) => {
    return res.json({
        initialized: mcpClient !== null,
        tools: mcpClient ? mcpClient.tools : []
    });
});

export default router;