PRAGMA foreign_keys = ON;

BEGIN;

-- OIMembers
CREATE TABLE IF NOT EXISTS OIMembers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,  -- serves as FK target
  email TEXT,
  education TEXT,
  bio TEXT,
  phone TEXT
);

-- OIExpertise
CREATE TABLE IF NOT EXISTS OIExpertise (
  id INTEGER PRIMARY KEY,
  researcher_name TEXT NOT NULL,
  field TEXT NOT NULL,
  FOREIGN KEY (researcher_name) REFERENCES OIMembers(name)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);
-- DBML: (researcher_name, field) [unique]
CREATE UNIQUE INDEX IF NOT EXISTS ux_oi_expertise_researcher_field
  ON OIExpertise (researcher_name, field);

-- OIResearchOutputs
CREATE TABLE IF NOT EXISTS OIResearchOutputs (
  id INTEGER PRIMARY KEY,
  researcher_name TEXT NOT NULL,
  publisher_name TEXT,
  name TEXT NOT NULL UNIQUE,  -- FK target for grants
  FOREIGN KEY (researcher_name) REFERENCES OIMembers(name)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);
-- DBML: (researcher_name, name) [unique]
CREATE UNIQUE INDEX IF NOT EXISTS ux_oi_research_outputs_researcher_name
  ON OIResearchOutputs (researcher_name, name);

-- OIResearchGrants
CREATE TABLE IF NOT EXISTS OIResearchGrants (
  id INTEGER PRIMARY KEY,
  ro_name TEXT NOT NULL,
  grant_name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  funding INTEGER,
  institute TEXT,
  school TEXT,
  FOREIGN KEY (ro_name) REFERENCES OIResearchOutputs(name)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);
-- DBML: (ro_name, grant_name) [unique]
CREATE UNIQUE INDEX IF NOT EXISTS ux_oi_research_grants_roname_grantname
  ON OIResearchGrants (ro_name, grant_name);

COMMIT;
