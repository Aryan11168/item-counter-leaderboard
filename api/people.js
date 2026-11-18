/**
 * Vercel Serverless Function: /api/people
 * Provides public read access to the people scoreboard and 
 * password-protected mutation access for the Admin.
 * 
 * Storage: Automatically uses Vercel KV / Upstash Redis if connected,
 * otherwise falls back to memory cache with default data.
 */

const DEFAULT_PEOPLE = [
  { id: '1', name: 'Sophia Martinez', count: 18, createdAt: 1700000000000 },
  { id: '2', name: 'Liam Chen', count: 24, createdAt: 1700000010000 },
  { id: '3', name: 'Emma Watson', count: 15, createdAt: 1700000020000 },
  { id: '4', name: 'Marcus Johnson', count: 11, createdAt: 1700000030000 },
  { id: '5', name: 'Aria Patel', count: 7, createdAt: 1700000040000 },
  { id: '6', name: 'Noah Davis', count: 3, createdAt: 1700000050000 }
];

const KV_KEY = 'scoreboard_people_v1';
let memoryFallback = [...DEFAULT_PEOPLE];

// Helper to interact with Vercel KV / Upstash REST API
async function getStoredPeople() {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl}/get/${KV_KEY}`, {
        headers: { Authorization: `Bearer ${kvToken}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.result) {
          const parsed = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (err) {
      console.warn('Failed reading from Vercel KV, using fallback:', err.message);
    }
  }

  return memoryFallback;
}

async function saveStoredPeople(people) {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  memoryFallback = people;

  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/${KV_KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(people)
      });
    } catch (err) {
      console.warn('Failed writing to Vercel KV, saved to memory:', err.message);
    }
  }
}

// Admin Password check
function verifyAdmin(req) {
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  // Check Authorization header or request body
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === expectedPassword) return true;
  }

  const customHeader = req.headers['x-admin-key'];
  if (customHeader === expectedPassword) return true;

  if (req.body && req.body.password === expectedPassword) return true;

  return false;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-admin-key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Public read-only access (anyone can view)
  if (req.method === 'GET') {
    try {
      const people = await getStoredPeople();
      const isAdmin = verifyAdmin(req);
      return res.status(200).json({
        people,
        isAdmin,
        storageConnected: Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch scoreboard data' });
    }
  }

  // POST: Admin-only mutations
  if (req.method === 'POST') {
    if (!verifyAdmin(req)) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid Admin Password'
      });
    }

    const { action, name, id, delta } = req.body || {};
    let people = await getStoredPeople();

    // Verify Password check
    if (action === 'VERIFY_PASSWORD') {
      return res.status(200).json({ success: true, message: 'Admin verified successfully' });
    }

    // Action: Add new person (starts with count: 0)
    if (action === 'ADD_PERSON') {
      const trimmedName = (name || '').trim();
      if (!trimmedName || trimmedName.length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters long' });
      }

      const duplicate = people.some(p => p.name.toLowerCase() === trimmedName.toLowerCase());
      if (duplicate) {
        return res.status(400).json({ error: `"${trimmedName}" is already registered` });
      }

      const newPerson = {
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: trimmedName,
        count: 0,
        createdAt: Date.now()
      };

      people.unshift(newPerson);
      await saveStoredPeople(people);
      return res.status(200).json({ success: true, person: newPerson, people });
    }

    // Action: Update count (+1 or -1)
    if (action === 'UPDATE_COUNT') {
      const target = people.find(p => p.id === id);
      if (!target) {
        return res.status(404).json({ error: 'Person not found' });
      }

      const change = Number(delta) || 0;
      target.count = Math.max(0, target.count + change);

      await saveStoredPeople(people);
      return res.status(200).json({ success: true, person: target, people });
    }

    // Action: Delete person
    if (action === 'DELETE_PERSON') {
      people = people.filter(p => p.id !== id);
      await saveStoredPeople(people);
      return res.status(200).json({ success: true, people });
    }

    // Action: Reset all counts to 0
    if (action === 'RESET_COUNTS') {
      people = people.map(p => ({ ...p, count: 0 }));
      await saveStoredPeople(people);
      return res.status(200).json({ success: true, people });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
