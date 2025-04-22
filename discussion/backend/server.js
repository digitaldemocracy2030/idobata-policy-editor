import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { callLLM } from './services/llmService.js'; // Import LLM service
import chatRoutes from './routes/chatRoutes.js'; // Import chat routes
import adminRoutes from './routes/adminRoutes.js'; // Import admin routes
import questionRoutes from './routes/questionRoutes.js'; // Import question routes
import policyRoutes from './routes/policyRoutes.js'; // Import policy routes
import importRoutes from './routes/importRoutes.js'; // Import import routes

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- Database Connection ---
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
    console.error('Error: MONGODB_URI is not defined in the .env file.');
    process.exit(1); // Exit the application if DB connection string is missing
}

mongoose.connect(mongoUri)
    .then(() => {
        console.log('MongoDB connected successfully.');
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1); // Exit on connection failure
    });

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 3000; // Use port from env or default to 3000

// --- Middleware ---
// CORS: Allow requests from the frontend development server
app.use(cors({
    origin: 'http://localhost:5173', // Default Vite frontend dev server port
    // Add other origins (e.g., production frontend URL) if needed
}));

// JSON Parser: Parse incoming JSON requests
app.use(express.json());

// --- API Routes ---
// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: "ok", timestamp: new Date() });
});

// Placeholder for future routes
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes); // Use admin routes
app.use('/api/questions', questionRoutes); // Use question routes
app.use('/api/policy-drafts', policyRoutes); // Use policy routes
app.use('/api/import', importRoutes); // Use import routes

// --- Serve static files in production ---
// This section will be useful when deploying to production
// For development, we'll handle this with a fallback route
if (process.env.NODE_ENV === 'production') {
    // Serve static files from the React app build directory
    const frontendBuildPath = path.join(__dirname, '../frontend/dist');
    app.use(express.static(frontendBuildPath));

    // For any request that doesn't match an API route, serve the React app
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
}

// For development, add a fallback route to handle non-API requests
app.use((req, res, next) => {
    // If this is an API request, continue to the API routes
    if (req.path.startsWith('/api')) {
        return next();
    }

    // For all other routes in development, respond with a message
    res.status(200).send(`
        <html>
            <head><title>Development Mode</title></head>
            <body>
                <h1>Backend Development Server</h1>
                <p>This is the backend server running in development mode.</p>
                <p>For client-side routing to work properly in development:</p>
                <ul>
                    <li>Make sure your frontend Vite dev server is running (npm run dev in the frontend directory)</li>
                    <li>Access your app through the Vite dev server URL (typically http://localhost:5173)</li>
                    <li>The Vite dev server will proxy API requests to this backend server</li>
                </ul>
            </body>
        </html>
    `);
});

// --- Error Handling Middleware (Example - Add more specific handlers later) ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});