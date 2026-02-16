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
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_roadmaps_owner ON roadmaps(owner_id);
CREATE INDEX idx_roadmaps_public ON roadmaps(is_public);
CREATE INDEX idx_milestones_roadmap ON milestones(roadmap_id);
CREATE INDEX idx_collaborators_roadmap ON roadmap_collaborators(roadmap_id);
CREATE INDEX idx_collaborators_user ON roadmap_collaborators(user_id);
