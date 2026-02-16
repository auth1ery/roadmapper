const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'access denied' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'invalid token' });
    }
    req.user = user;
    next();
  });
};

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (username.length < 3) {
      return res.status(400).json({ error: 'username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, hashedPassword]
    );

    const token = jwt.sign(
      { id: result.rows[0].id, username: result.rows[0].username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'user not found' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ error: 'incorrect password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/roadmaps', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.username as owner_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('username', cu.username)
          ) FILTER (WHERE cu.username IS NOT NULL),
          '[]'
        ) as collaborators
      FROM roadmaps r
      JOIN users u ON r.owner_id = u.id
      LEFT JOIN roadmap_collaborators rc ON r.id = rc.roadmap_id
      LEFT JOIN users cu ON rc.user_id = cu.id
      WHERE r.owner_id = $1 OR rc.user_id = $1
      GROUP BY r.id, u.username
      ORDER BY r.updated_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/roadmaps/public', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.username as owner_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('username', cu.username)
          ) FILTER (WHERE cu.username IS NOT NULL),
          '[]'
        ) as collaborators,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', m.id,
              'title', m.title,
              'description', m.description,
              'date', m.date,
              'x', m.x,
              'y', m.y
            )
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as milestones
      FROM roadmaps r
      JOIN users u ON r.owner_id = u.id
      LEFT JOIN roadmap_collaborators rc ON r.id = rc.roadmap_id
      LEFT JOIN users cu ON rc.user_id = cu.id
      LEFT JOIN milestones m ON r.id = m.roadmap_id
      WHERE r.is_public = true
      GROUP BY r.id, u.username
      ORDER BY r.updated_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/roadmaps/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.username as owner_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('username', cu.username, 'id', cu.id)
          ) FILTER (WHERE cu.username IS NOT NULL),
          '[]'
        ) as collaborators,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', m.id,
              'title', m.title,
              'description', m.description,
              'date', m.date,
              'x', m.x,
              'y', m.y
            )
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as milestones
      FROM roadmaps r
      JOIN users u ON r.owner_id = u.id
      LEFT JOIN roadmap_collaborators rc ON r.id = rc.roadmap_id
      LEFT JOIN users cu ON rc.user_id = cu.id
      LEFT JOIN milestones m ON r.id = m.roadmap_id
      WHERE r.id = $1
      GROUP BY r.id, u.username`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'roadmap not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/roadmaps', authenticateToken, async (req, res) => {
  try {
    const { title, description, isPublic } = req.body;

    const result = await pool.query(
      'INSERT INTO roadmaps (title, description, owner_id, is_public) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description || '', req.user.id, isPublic || false]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/roadmaps/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, isPublic, collaborators } = req.body;

    const roadmap = await pool.query(
      'SELECT owner_id FROM roadmaps WHERE id = $1',
      [req.params.id]
    );

    if (roadmap.rows.length === 0) {
      return res.status(404).json({ error: 'roadmap not found' });
    }

    if (roadmap.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'not authorized' });
    }

    const result = await pool.query(
      'UPDATE roadmaps SET title = $1, description = $2, is_public = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [title, description, isPublic, req.params.id]
    );

    if (collaborators && Array.isArray(collaborators)) {
      await pool.query('DELETE FROM roadmap_collaborators WHERE roadmap_id = $1', [req.params.id]);

      for (const username of collaborators) {
        const user = await pool.query('SELECT id FROM users WHERE username = $1', [username.trim()]);
        if (user.rows.length > 0) {
          await pool.query(
            'INSERT INTO roadmap_collaborators (roadmap_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.params.id, user.rows[0].id]
          );
        }
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/roadmaps/:id', authenticateToken, async (req, res) => {
  try {
    const roadmap = await pool.query(
      'SELECT owner_id FROM roadmaps WHERE id = $1',
      [req.params.id]
    );

    if (roadmap.rows.length === 0) {
      return res.status(404).json({ error: 'roadmap not found' });
    }

    if (roadmap.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'not authorized' });
    }

    await pool.query('DELETE FROM roadmaps WHERE id = $1', [req.params.id]);

    res.json({ message: 'roadmap deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/milestones', authenticateToken, async (req, res) => {
  try {
    const { roadmapId, title, description, date, x, y } = req.body;

    const result = await pool.query(
      'INSERT INTO milestones (roadmap_id, title, description, date, x, y) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [roadmapId, title, description || '', date, x || 50, y || 50]
    );

    await pool.query(
      'UPDATE roadmaps SET updated_at = NOW() WHERE id = $1',
      [roadmapId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/milestones/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, date, x, y } = req.body;

    const result = await pool.query(
      'UPDATE milestones SET title = $1, description = $2, date = $3, x = $4, y = $5 WHERE id = $6 RETURNING *',
      [title, description, date, x, y, req.params.id]
    );

    if (result.rows.length > 0) {
      await pool.query(
        'UPDATE roadmaps SET updated_at = NOW() WHERE id = $1',
        [result.rows[0].roadmap_id]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/milestones/:id', authenticateToken, async (req, res) => {
  try {
    const milestone = await pool.query(
      'SELECT roadmap_id FROM milestones WHERE id = $1',
      [req.params.id]
    );

    await pool.query('DELETE FROM milestones WHERE id = $1', [req.params.id]);

    if (milestone.rows.length > 0) {
      await pool.query(
        'UPDATE roadmaps SET updated_at = NOW() WHERE id = $1',
        [milestone.rows[0].roadmap_id]
      );
    }

    res.json({ message: 'milestone deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
