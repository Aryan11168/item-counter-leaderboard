/**
 * Vercel Serverless Function: /api/people
 * Provides public read access to the people scoreboard and 
 * password-protected mutation access for the Admin.
 * 
 * Storage: Automatically uses Vercel KV / Upstash Redis if connected,
 * otherwise falls back to memory cache with default data.
 */

const DEFAULT_PEOPLE = [];

const KV_KEY = 'arena_scoreboard_master';
let memoryFallback = [];

// Helper to sanitize and strictly deduplicate people by name (case-insensitive)
function cleanPeople(list) {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  for (const p of list) {
    if (!p || !p.name) continue;
    const name = String(p.name).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const count = Math.max(0, Number(p.count) || 0);

    if (map.has(key)) {
      const existing = map.get(key);
      // Retain the higher count and real ID
      if (count > existing.count) {
        existing.count = count;
      }
      if (p.id && (!existing.id || existing.id.startsWith('temp_'))) {
        existing.id = p.id;
      }
    } else {
      map.set(key, {
        id: p.id || ('p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
        name,
        count,
        createdAt: Number(p.createdAt) || Date.now()
      });
    }
  }
  return Array.from(map.values());
}

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
          if (Array.isArray(parsed)) return cleanPeople(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed reading from Vercel KV, using fallback:', err.message);
    }
  }

  return cleanPeople(memoryFallback);
}

async function saveStoredPeople(people) {
  const cleaned = cleanPeople(people);
  memoryFallback = cleaned;

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/${KV_KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleaned)
      });
    } catch (err) {
      console.warn('Failed writing to Vercel KV, saved to memory:', err.message);
    }
  }
  return cleaned;
}

// Admin Password check
function verifyAdmin(req) {
  const expectedPassword = process.env.ADMIN_PASSWORD || 'manitsuttagang';
  
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

    // Action: Add new person
    if (action === 'ADD_PERSON') {
      const trimmedName = (name || '').trim();
      if (!trimmedName || trimmedName.length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters long' });
      }

      const startingCount = Math.max(0, Number(req.body.count ?? req.body.initialCount ?? 0) || 0);
      const personId = req.body.id || ('p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));

      // Check if person already exists by normalized name OR id
      const existing = people.find(
        p => p.name.toLowerCase() === trimmedName.toLowerCase() || (req.body.id && p.id === req.body.id)
      );

      if (existing) {
        existing.count = startingCount;
        if (req.body.id) existing.id = req.body.id;
        existing.name = trimmedName;
        const saved = await saveStoredPeople(people);
        return res.status(200).json({ success: true, person: existing, people: saved });
      }

      const newPerson = {
        id: personId,
        name: trimmedName,
        count: startingCount,
        createdAt: req.body.createdAt || Date.now()
      };

      people.unshift(newPerson);
      const saved = await saveStoredPeople(people);
      return res.status(200).json({ success: true, person: newPerson, people: saved });
    }

    // Action: Update count (+1, -1, or direct setCount)
    if (action === 'UPDATE_COUNT') {
      let target = people.find(
        p => p.id === id || (name && p.name.toLowerCase() === String(name).trim().toLowerCase())
      );

      if (!target && name) {
        target = {
          id: id || ('p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
          name: String(name).trim(),
          count: 0,
          createdAt: Date.now()
        };
        people.unshift(target);
      }

      if (!target) {
        return res.status(404).json({ error: 'Person not found' });
      }

      if (req.body.setCount !== undefined) {
        target.count = Math.max(0, Number(req.body.setCount) || 0);
      } else {
        const change = Number(delta) || 0;
        target.count = Math.max(0, target.count + change);
      }

      const saved = await saveStoredPeople(people);
      return res.status(200).json({ success: true, person: target, people: saved });
    }

    // Action: Bulk Save / Server Initialization from Admin client
    if (action === 'BULK_SAVE' && Array.isArray(req.body.people)) {
      const saved = await saveStoredPeople(req.body.people);
      return res.status(200).json({ success: true, people: saved });
    }

    // Action: Delete person
    if (action === 'DELETE_PERSON') {
      people = people.filter(
        p => p.id !== id && (!name || p.name.toLowerCase() !== String(name).trim().toLowerCase())
      );
      const saved = await saveStoredPeople(people);
      return res.status(200).json({ success: true, people: saved });
    }

    // Action: Reset all counts to 0
    if (action === 'RESET_COUNTS') {
      people = people.map(p => ({ ...p, count: 0 }));
      const saved = await saveStoredPeople(people);
      return res.status(200).json({ success: true, people: saved });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
