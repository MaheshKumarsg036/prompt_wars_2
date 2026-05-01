import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BigQuery } from '@google-cloud/bigquery';
import { Logging } from '@google-cloud/logging';
import * as path from 'path';
import { readFileSync } from 'fs';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { body, validationResult } from 'express-validator';

// Specific service account file
const keyFilename = path.join(process.cwd(), 'service-account-key.json');

// Set GOOGLE_APPLICATION_CREDENTIALS so all GCP libraries authenticate automatically
process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilename;

const app = express();
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://maps.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://maps.gstatic.com", "https://maps.googleapis.com"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
      frameSrc: ["'self'", "https://www.google.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? 'https://election-assistant-826715076206.us-central1.run.app' : '*' }));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter);

// Initialize Google Cloud Services using the provided key
const bigquery = new BigQuery({ keyFilename });
const logging = new Logging({ keyFilename });
const log = logging.log('election-assistant-log');

// EFFICIENCY: Pre-initialize BigQuery dataset and table on startup
const datasetName = 'election_data';
const tableName = 'voting_stats';
let bqReady = false;

async function initBigQuery() {
  try {
    const dataset = bigquery.dataset(datasetName);
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) await bigquery.createDataset(datasetName);

    const table = dataset.table(tableName);
    const [tableExists] = await table.exists();
    if (!tableExists) {
      const schema = 'hasVoted:BOOLEAN, location:STRING, timestamp:TIMESTAMP';
      await dataset.createTable(tableName, { schema });
    }
    bqReady = true;
    console.log("BigQuery initialized efficiently.");
  } catch (err) {
    console.error("BigQuery init error:", err);
  }
}
initBigQuery();

// Helper to write to Cloud Logging
async function writeLog(message, severity = 'INFO') {
  try {
    const entry = log.entry({ severity }, message);
    await log.write(entry);
    console.log(`Logged: ${message}`);
  } catch (error) {
    // Silencing Cloud Logging permission error to avoid flooding the console
    if (error.code !== 7) {
      console.error('Failed to write to Cloud Logging:', error);
    }
  }
}

// 1. News endpoint dynamically generated using Google Gemini AI
app.get('/api/news', async (req, res) => {
  await writeLog('Fetching election news dynamically via Gemini');
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Generate 4 realistic breaking news headlines about an ongoing local election in JSON format. 
      The JSON should be an array of objects with keys: id (number), title (string), source (string), time (string like '2h ago'). 
      Return ONLY the raw JSON array without markdown formatting.`;
    
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const news = JSON.parse(text);
    res.json(news);
  } catch (error) {
    console.error("News Generation Error:", error);
    await writeLog(`Error generating news: ${error.message}`, 'ERROR');
    // Fallback to static data if Gemini fails
    res.json([
      { id: 1, title: 'Local Election Turnout Reaches 65%', source: 'City Tribune', time: '2h ago' },
      { id: 2, title: 'Polling Stations Extend Hours Due to High Demand', source: 'Election Commission', time: '5h ago' }
    ]);
  }
});

// 2. QA endpoint using real Gemini via Vertex AI
app.post('/api/chat', [
  body('message').isString().trim().escape().notEmpty().withMessage('Message is required and must be a string')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { message } = req.body;
  await writeLog(`User asked a question: ${message}`);

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    // SECURITY: Use environment variable instead of hardcoded API key
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-2.5-flash for standard chat requests
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent(message);
    const response = result.response.text();

    res.json({ response });
  } catch (error) {
    console.error("EXACT GEMINI ERROR:", error);
    await writeLog(`Error in AI Studio Gemini QA: ${error.message}`, 'ERROR');
    next(error);
  }
});

// 3. Voting Stats endpoint using real BigQuery
app.post('/api/vote', [
  body('hasVoted').isBoolean().withMessage('hasVoted must be a boolean'),
  body('location').isString().trim().escape().notEmpty().withMessage('location must be a valid string')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { hasVoted, location } = req.body;
  await writeLog(`User reported voting status: ${hasVoted} at ${location}`);

  try {
    if (!bqReady) {
      return res.status(503).json({ error: 'BigQuery not ready yet.' });
    }

    const dataset = bigquery.dataset(datasetName);
    const table = dataset.table(tableName);

    // Insert the vote into BigQuery
    await table.insert([{ hasVoted, location, timestamp: new Date() }]);
    await writeLog(`Successfully inserted vote into BigQuery for location ${location}`);

    // Query stats from BigQuery
    const query = `
      SELECT 
        COUNT(*) as totalVoters, 
        SUM(CAST(hasVoted as INT64)) as votedCount 
      FROM \`${datasetName}.${tableName}\` 
      WHERE location = @location
    `;

    const options = {
      query: query,
      params: { location },
    };

    const [rows] = await bigquery.query(options);

    const totalVoters = parseInt(rows[0]?.totalVoters || 0, 10);
    const votedCount = parseInt(rows[0]?.votedCount || 0, 10);
    const percentage = totalVoters > 0 ? ((votedCount / totalVoters) * 100).toFixed(1) : "0.0";

    const stats = {
      totalVoters,
      votedCount,
      percentage,
      atmosphere: hasVoted
        ? `Thanks for voting! The atmosphere in your area is quite active, with a ${percentage}% turnout so far!`
        : `You haven't voted yet. The atmosphere is bustling; ${percentage}% of your neighbors have already cast their ballot. Don't miss out!`
    };

    res.json(stats);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    await writeLog(`Error in BigQuery operation: ${error.message}`, 'ERROR');
    next(error);
  }
});

// Serve Vite frontend static files with caching
app.use(express.static(path.join(process.cwd(), 'dist'), { maxAge: '1y' }));

// Catch-all route for React Router (must be placed after all API routes)
app.use((req, res) => {
  res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});

