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

const logActivity = async (roadmapId, userId, action, details = null) => {
  try {
    await pool.query(
      'INSERT INTO activity_log (roadmap_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
      [roadmapId, userId, action, details]
    );
  } catch (error) {
    console.error('activity log error:', error);
  }
};

const triggerWebhooks = async (roadmapId, event, data) => {
  try {
    const webhooks = await pool.query(
      'SELECT * FROM webhooks WHERE roadmap_id = $1 AND is_active = true AND $2 = ANY(events)',
      [roadmapId, event]
    );

    for (const webhook of webhooks.rows) {
      fetch(webhook.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, roadmap_id: roadmapId, data, timestamp: new Date() })
      }).catch(err => console.error('webhook error:', err));
    }
  } catch (error) {
    console.error('trigger webhook error:', error);
  }
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
              'y', m.y,
              'priority', m.priority,
              'status', m.status
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
              'y', m.y,
              'priority', m.priority,
              'status', m.status
            )
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as milestones,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', n.id,
              'content', n.content,
              'x', n.x,
              'y', n.y,
              'width', n.width,
              'height', n.height,
              'color', n.color
            )
          ) FILTER (WHERE n.id IS NOT NULL),
          '[]'
        ) as notes,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', conn.id,
              'from_type', conn.from_type,
              'from_id', conn.from_id,
              'to_type', conn.to_type,
              'to_id', conn.to_id,
              'style', conn.style
            )
          ) FILTER (WHERE conn.id IS NOT NULL),
          '[]'
        ) as connections,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', rm.id,
              'milestone_id', rm.milestone_id,
              'title', rm.title,
              'description', rm.description,
              'severity', rm.severity
            )
          ) FILTER (WHERE rm.id IS NOT NULL),
          '[]'
        ) as risks
      FROM roadmaps r
      JOIN users u ON r.owner_id = u.id
      LEFT JOIN roadmap_collaborators rc ON r.id = rc.roadmap_id
      LEFT JOIN users cu ON rc.user_id = cu.id
      LEFT JOIN milestones m ON r.id = m.roadmap_id
      LEFT JOIN notes n ON r.id = n.roadmap_id
      LEFT JOIN connections conn ON r.id = conn.roadmap_id
      LEFT JOIN risk_markers rm ON r.id = rm.roadmap_id
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

    await logActivity(result.rows[0].id, req.user.id, 'created roadmap', title);

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

    await logActivity(req.params.id, req.user.id, 'updated roadmap', title);
    await triggerWebhooks(req.params.id, 'roadmap.updated', { title, description });

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
    await triggerWebhooks(req.params.id, 'roadmap.deleted', {});

    res.json({ message: 'roadmap deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/milestones', authenticateToken, async (req, res) => {
  try {
    const { roadmapId, title, description, date, x, y, priority, status } = req.body;

    const result = await pool.query(
      'INSERT INTO milestones (roadmap_id, title, description, date, x, y, priority, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [roadmapId, title, description || '', date, x || 50, y || 50, priority || 'medium', status || 'not_started']
    );

    await pool.query('UPDATE roadmaps SET updated_at = NOW() WHERE id = $1', [roadmapId]);
    await logActivity(roadmapId, req.user.id, 'created milestone', title);
    await triggerWebhooks(roadmapId, 'milestone.created', result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/milestones/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, date, x, y, priority, status } = req.body;

    const result = await pool.query(
      'UPDATE milestones SET title = $1, description = $2, date = $3, x = $4, y = $5, priority = $6, status = $7 WHERE id = $8 RETURNING *',
      [title, description, date, x, y, priority, status, req.params.id]
    );

    if (result.rows.length > 0) {
      await pool.query('UPDATE roadmaps SET updated_at = NOW() WHERE id = $1', [result.rows[0].roadmap_id]);
      await logActivity(result.rows[0].roadmap_id, req.user.id, 'updated milestone', title);
      await triggerWebhooks(result.rows[0].roadmap_id, 'milestone.updated', result.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/milestones/:id', authenticateToken, async (req, res) => {
  try {
    const milestone = await pool.query('SELECT roadmap_id, title FROM milestones WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM milestones WHERE id = $1', [req.params.id]);

    if (milestone.rows.length > 0) {
      await pool.query('UPDATE roadmaps SET updated_at = NOW() WHERE id = $1', [milestone.rows[0].roadmap_id]);
      await logActivity(milestone.rows[0].roadmap_id, req.user.id, 'deleted milestone', milestone.rows[0].title);
      await triggerWebhooks(milestone.rows[0].roadmap_id, 'milestone.deleted', { id: req.params.id });
    }

    res.json({ message: 'milestone deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/notes', authenticateToken, async (req, res) => {
  try {
    const { roadmapId, content, x, y, width, height, color } = req.body;

    const result = await pool.query(
      'INSERT INTO notes (roadmap_id, content, x, y, width, height, color) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [roadmapId, content, x || 50, y || 50, width || 200, height || 150, color || 'yellow']
    );

    await pool.query('UPDATE roadmaps SET updated_at = NOW() WHERE id = $1', [roadmapId]);
    await logActivity(roadmapId, req.user.id, 'created note', null);

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/notes/:id', authenticateToken, async (req, res) => {
  try {
    const { content, x, y, width, height, color } = req.body;

    const result = await pool.query(
      'UPDATE notes SET content = $1, x = $2, y = $3, width = $4, height = $5, color = $6 WHERE id = $7 RETURNING *',
      [content, x, y, width, height, color, req.params.id]
    );

    if (result.rows.length > 0) {
      const note = await pool.query('SELECT roadmap_id FROM notes WHERE id = $1', [req.params.id]);
      if (note.rows.length > 0) {
        await pool.query('UPDATE roadmaps SET updated_at = NOW() WHERE id = $1', [note.rows[0].roadmap_id]);
        await logActivity(note.rows[0].roadmap_id, req.user.id, 'updated note', null);
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
  try {
    const note = await pool.query('SELECT roadmap_id FROM notes WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM notes WHERE id = $1', [req.params.id]);

    if (note.rows.length > 0) {
      await pool.query('UPDATE roadmaps SET updated_at = NOW() WHERE id = $1', [note.rows[0].roadmap_id]);
      await logActivity(note.rows[0].roadmap_id, req.user.id, 'deleted note', null);
    }

    res.json({ message: 'note deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/connections', authenticateToken, async (req, res) => {
  try {
    const { roadmapId, fromType, fromId, toType, toId, style } = req.body;

    const result = await pool.query(
      'INSERT INTO connections (roadmap_id, from_type, from_id, to_type, to_id, style) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [roadmapId, fromType, fromId, toType, toId, style || 'solid']
    );

    await pool.query('UPDATE roadmaps SET updated_at = NOW() WHERE id = $1', [roadmapId]);
    await logActivity(roadmapId, req.user.id, 'created connection', null);

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/connections/:id', authenticateToken, async (req, res) => {
  try {
    const conn = await pool.query('SELECT roadmap_id FROM connections WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM connections WHERE id = $1', [req.params.id]);

    if (conn.rows.length > 0) {
      await pool.query('UPDATE roadmaps SET updated_at = NOW() WHERE id = $1', [conn.rows[0].roadmap_id]);
      await logActivity(conn.rows[0].roadmap_id, req.user.id, 'deleted connection', null);
    }

    res.json({ message: 'connection deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/risks', authenticateToken, async (req, res) => {
  try {
    const { roadmapId, milestoneId, title, description, severity } = req.body;

    const result = await pool.query(
      'INSERT INTO risk_markers (roadmap_id, milestone_id, title, description, severity) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [roadmapId, milestoneId, title, description || '', severity || 'medium']
    );

    await pool.query('UPDATE roadmaps SET updated_at = NOW() WHERE id = $1', [roadmapId]);
    await logActivity(roadmapId, req.user.id, 'created risk marker', title);

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/risks/:id', authenticateToken, async (req, res) => {
  try {
    const risk = await pool.query('SELECT roadmap_id FROM risk_markers WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM risk_markers WHERE id = $1', [req.params.id]);

    if (risk.rows.length > 0) {
      await pool.query('UPDATE roadmaps SET updated_at = NOW() WHERE id = $1', [risk.rows[0].roadmap_id]);
      await logActivity(risk.rows[0].roadmap_id, req.user.id, 'deleted risk marker', null);
    }

    res.json({ message: 'risk marker deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/roadmaps/:id/comments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.username 
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.roadmap_id = $1
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/comments', authenticateToken, async (req, res) => {
  try {
    const { roadmapId, content } = req.body;

    const result = await pool.query(
      'INSERT INTO comments (roadmap_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [roadmapId, req.user.id, content]
    );

    const user = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
    const comment = { ...result.rows[0], username: user.rows[0].username };

    await logActivity(roadmapId, req.user.id, 'added comment', null);
    await triggerWebhooks(roadmapId, 'comment.created', comment);

    res.json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/roadmaps/:id/activity', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.username 
       FROM activity_log a
       JOIN users u ON a.user_id = u.id
       WHERE a.roadmap_id = $1
       ORDER BY a.created_at DESC
       LIMIT 100`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/roadmaps/:id/export', authenticateToken, async (req, res) => {
  try {
    const roadmap = await pool.query(
      `SELECT r.*, u.username as owner_name,
        COALESCE(json_agg(DISTINCT cu.username) FILTER (WHERE cu.username IS NOT NULL), '[]') as collaborators,
        COALESCE(json_agg(DISTINCT m.*) FILTER (WHERE m.id IS NOT NULL), '[]') as milestones,
        COALESCE(json_agg(DISTINCT n.*) FILTER (WHERE n.id IS NOT NULL), '[]') as notes,
        COALESCE(json_agg(DISTINCT conn.*) FILTER (WHERE conn.id IS NOT NULL), '[]') as connections,
        COALESCE(json_agg(DISTINCT rm.*) FILTER (WHERE rm.id IS NOT NULL), '[]') as risks
      FROM roadmaps r
      JOIN users u ON r.owner_id = u.id
      LEFT JOIN roadmap_collaborators rc ON r.id = rc.roadmap_id
      LEFT JOIN users cu ON rc.user_id = cu.id
      LEFT JOIN milestones m ON r.id = m.roadmap_id
      LEFT JOIN notes n ON r.id = n.roadmap_id
      LEFT JOIN connections conn ON r.id = conn.roadmap_id
      LEFT JOIN risk_markers rm ON r.id = rm.roadmap_id
      WHERE r.id = $1
      GROUP BY r.id, u.username`,
      [req.params.id]
    );

    if (roadmap.rows.length === 0) {
      return res.status(404).json({ error: 'roadmap not found' });
    }

    res.setHeader('Content-Disposition', `attachment; filename=roadmap-${req.params.id}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(roadmap.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/roadmaps/:id/webhooks', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM webhooks WHERE roadmap_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/webhooks', authenticateToken, async (req, res) => {
  try {
    const { roadmapId, service, webhookUrl, events } = req.body;

    const result = await pool.query(
      'INSERT INTO webhooks (roadmap_id, service, webhook_url, events, is_active) VALUES ($1, $2, $3, $4, true) RETURNING *',
      [roadmapId, service, webhookUrl, events || []]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/webhooks/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM webhooks WHERE id = $1', [req.params.id]);
    res.json({ message: 'webhook deleted' });
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
