import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BigQuery } from '@google-cloud/bigquery';
import { Logging } from '@google-cloud/logging';
import * as path from 'path';
import { readFileSync } from 'fs';

// Specific service account file
const keyFilename = path.join(process.cwd(), 'service-account-key.json');

// Set GOOGLE_APPLICATION_CREDENTIALS so all GCP libraries authenticate automatically
process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilename;

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Google Cloud Services using the provided key
const bigquery = new BigQuery({ keyFilename });
const logging = new Logging({ keyFilename });
const log = logging.log('election-assistant-log');

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

// 1. News endpoint (Real or static depending on News API availability. 
// Using static for now, but logging is real)
app.get('/api/news', async (req, res) => {
  await writeLog('Fetching election news');
  res.json([
    { id: 1, title: 'Local Election Turnout Reaches 65%', source: 'City Tribune', time: '2h ago' },
    { id: 2, title: 'Debate Highlights: Key Issues Discussed', source: 'National News', time: '4h ago' },
    { id: 3, title: 'Polling Stations Extend Hours Due to High Demand', source: 'Election Commission', time: '5h ago' },
    { id: 4, title: 'Security Heightened Around Major Voting Centers', source: 'Police Dept', time: '12h ago' }
  ]);
});

// 2. QA endpoint using real Gemini via Vertex AI
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  await writeLog(`User asked a question: ${message}`);

  try {
    // Initialize AI Studio with the provided API key
    const genAI = new GoogleGenerativeAI("");

    // Use gemini-2.5-flash for standard chat requests
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent(message);
    const response = result.response.text();

    res.json({ response });
  } catch (error) {
    console.error("EXACT GEMINI ERROR:", error);
    await writeLog(`Error in AI Studio Gemini QA: ${error.message}`, 'ERROR');
    res.status(500).json({ error: `Failed to process question with Gemini. Details: ${error.message}` });
  }
});

// 3. Voting Stats endpoint using real BigQuery
app.post('/api/vote', async (req, res) => {
  const { hasVoted, location } = req.body;
  await writeLog(`User reported voting status: ${hasVoted} at ${location}`);

  try {
    // BigQuery initialization
    const datasetName = 'election_data';
    const tableName = 'voting_stats';

    // Create dataset if it doesn't exist
    const dataset = bigquery.dataset(datasetName);
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) {
      await writeLog(`Dataset ${datasetName} does not exist, creating...`);
      await bigquery.createDataset(datasetName);
    }

    // Create table if it doesn't exist
    const table = dataset.table(tableName);
    const [tableExists] = await table.exists();
    if (!tableExists) {
      await writeLog(`Table ${tableName} does not exist, creating...`);
      const schema = 'hasVoted:BOOLEAN, location:STRING, timestamp:TIMESTAMP';
      await dataset.createTable(tableName, { schema });

      // Wait a moment for BigQuery table to initialize properly
      await new Promise(r => setTimeout(r, 2000));
    }

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
    res.status(500).json({ error: 'Failed to record vote or fetch stats from BigQuery.' });
  }
});

// Serve Vite frontend static files
app.use(express.static(path.join(process.cwd(), 'dist')));

// Catch-all route for React Router (must be placed after all API routes)
app.use((req, res) => {
  res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});

