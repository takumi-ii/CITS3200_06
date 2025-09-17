PRAGMA foreign_keys = ON;

BEGIN;

-- OIMembers
CREATE TABLE IF NOT EXISTS OIMembers (
  uuid TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,  -- serves as FK target
  email TEXT,
  education TEXT,
  bio TEXT,
  phone TEXT
);

-- OIExpertise
CREATE TABLE IF NOT EXISTS OIExpertise (
  id INTEGER PRIMARY KEY,
  researcher_uuid TEXT NOT NULL,
  field TEXT NOT NULL,
  FOREIGN KEY (researcher_uuid) REFERENCES OIMembers(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);
-- DBML: (researcher_uuid, field) [unique]
CREATE UNIQUE INDEX IF NOT EXISTS ux_oi_expertise_researcher_field
  ON OIExpertise (researcher_uuid, field);

-- OIResearchOutputs
CREATE TABLE IF NOT EXISTS OIResearchOutputs (
  uuid TEXT PRIMARY KEY,
  researcher_uuid TEXT NOT NULL,
  publisher_name TEXT,
  name TEXT NOT NULL UNIQUE,  -- FK target for grants
  FOREIGN KEY (researcher_uuid) REFERENCES OIMembers(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);
-- DBML: (researcher_name, name) [unique]
CREATE UNIQUE INDEX IF NOT EXISTS ux_oi_research_outputs_researcher_name
  ON OIResearchOutputs (researcher_uuid, uuid);

-- OIResearchGrants
CREATE TABLE IF NOT EXISTS OIResearchGrants (
  uuid TEXT PRIMARY KEY,
  ro_uuid TEXT NOT NULL,
  grant_name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  funding INTEGER,
  funding_source_name TEXT,
  school TEXT,
  FOREIGN KEY (ro_uuid) REFERENCES OIResearchOutputs(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);
-- DBML: (ro_name, grant_name) [unique]
CREATE UNIQUE INDEX IF NOT EXISTS ux_oi_research_grants_roname_grantname
  ON OIResearchGrants (ro_uuid, grant_name);

COMMIT;
