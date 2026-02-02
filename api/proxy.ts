import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    
    // Validate URL is from allowed domains (Cosmos LCD endpoints)
    const allowedDomains = [
      'lcd.osmosis.zone',
      'rest.osmosis.goldenratiostaking.net',
      'rest.lavenderfive.com',
      'rest-osmosis.ecostake.com',
      'osmosis-api.polkachu.com',
      'lcd-cosmoshub.keplr.app',
      'cosmos-lcd.quickapi.com',
      'rest.cosmos.directory',
      'cosmos-rest.publicnode.com',
      'celestia-lcd.publicnode.com',
      'celestia-api.polkachu.com',
      'dydx-lcd.publicnode.com',
      'dydx-api.polkachu.com',
      'sei-lcd.publicnode.com',
      'sei-api.polkachu.com',
      'injective-lcd.publicnode.com',
      'injective-api.polkachu.com',
      'neutron-lcd.publicnode.com',
      'neutron-api.polkachu.com',
      'noble-lcd.publicnode.com',
      'noble-api.polkachu.com',
    ];

    const urlObj = new URL(decodedUrl);
    const isAllowed = allowedDomains.some(domain => urlObj.hostname.includes(domain));
    
    if (!isAllowed) {
      return res.status(403).json({ error: 'Domain not allowed' });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    // Only add Content-Type for POST requests
    if (req.method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(decodedUrl, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });

    if (!response.ok) {
      // Try to get error details from response body
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // Ignore if we can't read the body
      }
      console.error(`Upstream error: ${response.status} ${response.statusText}`, errorBody);
      return res.status(response.status).json({ 
        error: `Upstream error: ${response.status} ${response.statusText}`,
        upstream: errorBody.slice(0, 500) // Include first 500 chars of error
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Proxy request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
