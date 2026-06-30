/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Initialize Gemini Client safely
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn('WARNING: GEMINI_API_KEY is not configured or uses placeholder value.');
}

// 1. API: Analyze current network status & generate structured recommendations
app.post('/api/gemini/analyze', async (req, res) => {
  if (!ai) {
    return res.status(503).json({
      error: 'Gemini service is not initialized. Please verify your GEMINI_API_KEY in Settings > Secrets.',
    });
  }

  const { metrics, disruptions, depots } = req.body;

  try {
    const prompt = `
      You are the Logistics Network Enterprise Agent. Analyze the current supply chain network metrics, active routing disruptions, and depot loads.
      
      NETWORK METRICS:
      - Total Shipments: ${metrics.totalShipments}
      - Routed Shipments: ${metrics.routedShipments}
      - Active Disruptions: ${metrics.activeDisruptions}
      - Delayed/Disrupted Shipments: ${metrics.delayedCount}
      - Average Delay Time: ${metrics.avgDelayMinutes} mins
      
      ACTIVE DISRUPTIONS:
      ${JSON.stringify(disruptions, null, 2)}
      
      DEPC-LEVEL OPERATIONAL STATUS:
      ${JSON.stringify(depots, null, 2)}
      
      Provide a highly precise strategic mitigation plan using the structured schema. Reallocate trucks or dispatch secondary routes from other depots to bypass the disruption zones.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an elite Supply Chain Orchestrator and Logistics Agent. You specialize in dynamic routing mitigation, high-performance network analysis, and load balancing across multi-depot fulfillment structures. Be concise, mathematically minded, and highly strategic.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'Executive summary detailing current operational risk and overall strategy.',
            },
            actions: {
              type: Type.ARRAY,
              description: 'Key actions to take immediately.',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Action item title' },
                  description: { type: Type.STRING, description: 'Step-by-step description of how to execute this action.' },
                  impact: { type: Type.STRING, description: 'Operational KPI impact (e.g., Saves 34 mins of dwell time)' },
                  priority: { type: Type.STRING, description: 'CRITICAL, HIGH, or MEDIUM priority' },
                },
                required: ['title', 'description', 'impact', 'priority'],
              },
            },
            depotAdjustments: {
              type: Type.ARRAY,
              description: 'Depot resource re-allocations to balance load.',
              items: {
                type: Type.OBJECT,
                properties: {
                  depotId: { type: Type.STRING, description: 'Target Depot ID' },
                  reallocatedTrucks: { type: Type.INTEGER, description: 'Number of trucks to shift (e.g. +3 or -5)' },
                  reason: { type: Type.STRING, description: 'Data-driven justification for this change' },
                },
                required: ['depotId', 'reallocatedTrucks', 'reason'],
              },
            },
          },
          required: ['summary', 'actions', 'depotAdjustments'],
        },
      },
    });

    if (!response.text) {
      throw new Error('Empty response from Gemini');
    }

    const recommendation = JSON.parse(response.text.trim());
    res.json(recommendation);
  } catch (err: any) {
    console.error('Gemini analyze failed:', err);
    res.status(500).json({
      error: 'Failed to generate recommendations from Gemini API.',
      details: err.message,
    });
  }
});

// 2. API: Natural Language Logistics Co-pilot
app.post('/api/gemini/chat', async (req, res) => {
  if (!ai) {
    return res.status(503).json({
      error: 'Gemini service is not initialized. Please verify your GEMINI_API_KEY in Settings > Secrets.',
    });
  }

  const { message, history } = req.body;

  try {
    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const chat = ai.chats.create({
      model: 'gemini-3.5-flash',
      config: {
        systemInstruction: `
          You are 'Optima-AI', the GPU-Accelerated Logistics Network Assistant.
          You answer questions about logistics, spatial route optimization (TSP), clustering (K-Means), NVIDIA RAPIDS (cuDF, cuGraph), BigQuery queries, and general network risks.
          
          Provide highly practical, mathematically accurate advice. Recommend using GPU acceleration (e.g. RAPIDS cuDF, cuGraph, Spark RAPIDS) when processing size exceeds 10,000 points.
          Refer to BigQuery Storage Read API with Arrow for accelerated data loading. Keep your tone professional, crisp, and helpful.
        `,
      },
      history: formattedHistory,
    });

    const response = await chat.sendMessage({
      message: message,
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error('Gemini chat failed:', err);
    res.status(500).json({
      error: 'Failed to communicate with Gemini API.',
      details: err.message,
    });
  }
});

// Initialize Vite server or static serving
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
});
