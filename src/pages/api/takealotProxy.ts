import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, apiKey } = req.body;

  console.log('TakealotProxy - Received request:', { endpoint, apiKey: apiKey ? 'Present' : 'Missing' });

  if (!endpoint || !apiKey) {
    return res.status(400).json({ error: 'Missing endpoint or apiKey' });
  }

  try {
    const fullUrl = `https://seller-api.takealot.com${endpoint}`;
    const headers = {
      Authorization: `Key ${apiKey}`,
      Accept: 'application/json',
    };

    console.log('TakealotProxy - Making request to:', fullUrl);
    console.log('TakealotProxy - Headers:', headers);

    const takealotRes = await fetch(fullUrl, {
      headers: headers,
    });

    console.log('TakealotProxy - Response status:', takealotRes.status);
    console.log('TakealotProxy - Response headers:', Object.fromEntries(takealotRes.headers.entries()));

    const data = await takealotRes.json();
    console.log('TakealotProxy - Response data:', data);

    res.status(takealotRes.status).json(data);
  } catch (error: any) {
    console.error('TakealotProxy - Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch from Takealot API' });
  }
}
