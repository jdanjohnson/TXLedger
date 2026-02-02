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

    const response = await fetch(decodedUrl, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Upstream error: ${response.status} ${response.statusText}` 
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
