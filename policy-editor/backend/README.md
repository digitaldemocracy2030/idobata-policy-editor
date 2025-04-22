# Idobata Policy Editor Backend

This is the backend server for the Idobata Policy Editor project, providing a chat interface with MCP (Model Context Protocol) integration.

## Features

- Express.js REST API server
- OpenAI SDK integration with OpenRouter for Claude 3.7 Sonnet
- MCP (Model Context Protocol) client implementation
- Sample MCP weather server for testing

## Prerequisites

- Node.js 17 or higher
- npm or yarn
- OpenRouter API key

## Setup

1. Clone the repository (if you haven't already)

2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Create a `.env` file in the backend directory with the following content:
   ```
   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # OpenRouter API Configuration
   OPENROUTER_API_KEY=your_openrouter_api_key_here

   # CORS Settings
   CORS_ORIGIN=http://localhost:5173

   # MCP Server Path (relative to backend directory)
   # Example for the sample weather server:
   # MCP_SERVER_PATH=./build/mcp-servers/weather-server.js
   MCP_SERVER_PATH=your_mcp_server_build_path_here
   ```

4. Replace `your_openrouter_api_key_here` with your actual OpenRouter API key and `your_mcp_server_build_path_here` with the path to your built MCP server file (e.g., `./build/mcp-servers/weather-server.js`).

## Building and Running

1. Build the TypeScript code:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

### Chat API

- `POST /api/chat` - Send a message to the chatbot
  - Request body: `{ "message": "your message here" }`
  - Response: `{ "response": "bot response here" }`

- `POST /api/chat/connect` - Connect to the MCP server specified in the `.env` file (`MCP_SERVER_PATH`)
  - Request body: (empty)
  - Response: `{ "success": true, "message": "Connected to MCP server at <path>" }`

- `GET /api/chat/status` - Check MCP client status
  - Response: `{ "initialized": true, "tools": [...] }`

### Health Check

- `GET /health` - Check if the server is running
  - Response: `{ "status": "ok", "timestamp": "2025-04-14T02:40:00.000Z" }`

## MCP Servers

The project includes a sample MCP weather server for testing:

- `src/mcp-servers/weather-server.ts` - A simple weather server that provides a `get_weather` tool

To use the weather server:
1. Build the project
2. Set the `MCP_SERVER_PATH` in your `.env` file to the path of the built server file (e.g., `MCP_SERVER_PATH=./build/mcp-servers/weather-server.js`).
3. Connect to the server using the `/api/chat/connect` endpoint (no request body needed).

## Frontend Integration

The frontend is configured to connect to this backend at `http://localhost:3001/api`. Make sure the `VITE_API_BASE_URL` in the frontend's `.env` file is set correctly.