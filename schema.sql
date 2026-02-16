CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roadmaps (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roadmap_collaborators (
  roadmap_id INTEGER REFERENCES roadmaps(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (roadmap_id, user_id)
);

CREATE TABLE IF NOT EXISTS milestones (
  id SERIAL PRIMARY KEY,
  roadmap_id INTEGER REFERENCES roadmaps(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  x INTEGER DEFAULT 50,
  y INTEGER DEFAULT 50,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'not_started',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  roadmap_id INTEGER REFERENCES roadmaps(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  x INTEGER DEFAULT 50,
  y INTEGER DEFAULT 50,
  width INTEGER DEFAULT 200,
  height INTEGER DEFAULT 150,
  color VARCHAR(20) DEFAULT 'yellow',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connections (
  id SERIAL PRIMARY KEY,
  roadmap_id INTEGER REFERENCES roadmaps(id) ON DELETE CASCADE,
  from_type VARCHAR(20) NOT NULL,
  from_id INTEGER NOT NULL,
  to_type VARCHAR(20) NOT NULL,
  to_id INTEGER NOT NULL,
  style VARCHAR(20) DEFAULT 'solid',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_markers (
  id SERIAL PRIMARY KEY,
  roadmap_id INTEGER REFERENCES roadmaps(id) ON DELETE CASCADE,
  milestone_id INTEGER REFERENCES milestones(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  roadmap_id INTEGER REFERENCES roadmaps(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  roadmap_id INTEGER REFERENCES roadmaps(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id SERIAL PRIMARY KEY,
  roadmap_id INTEGER REFERENCES roadmaps(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL,
  webhook_url TEXT NOT NULL,
  events TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_roadmaps_owner ON roadmaps(owner_id);
CREATE INDEX idx_roadmaps_public ON roadmaps(is_public);
CREATE INDEX idx_milestones_roadmap ON milestones(roadmap_id);
CREATE INDEX idx_notes_roadmap ON notes(roadmap_id);
CREATE INDEX idx_connections_roadmap ON connections(roadmap_id);
CREATE INDEX idx_risk_markers_roadmap ON risk_markers(roadmap_id);
CREATE INDEX idx_comments_roadmap ON comments(roadmap_id);
CREATE INDEX idx_activity_log_roadmap ON activity_log(roadmap_id);
CREATE INDEX idx_webhooks_roadmap ON webhooks(roadmap_id);
CREATE INDEX idx_collaborators_roadmap ON roadmap_collaborators(roadmap_id);
CREATE INDEX idx_collaborators_user ON roadmap_collaborators(user_id);
