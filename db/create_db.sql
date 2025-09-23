PRAGMA foreign_keys = ON;

BEGIN;

-- OIMembers
CREATE TABLE IF NOT EXISTS OIMembers (
  uuid TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,  -- serves as FK target
  email TEXT,
  education TEXT,
  bio TEXT,                   -- Pulled from the API
  phone TEXT,
  photo_url TEXT,
  profile_url TEXT
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
  publisher_name TEXT,
  name TEXT NOT NULL UNIQUE,  -- FK target for grants
  abstract TEXT,
  num_citations INTEGER,
  num_authors INTEGER,
  publication_year INTEGER,
  link_to_paper TEXT
);

-- OI ResearchOutputsAuthors: Many to Many relationship between OIResearchOutputs and authors / contributors:
CREATE TABLE IF NOT EXISTS OIResearchOutputsCollaborators (
  id INTEGER PRIMARY KEY,
  ro_uuid TEXT NOT NULL,
  researcher_uuid TEXT NOT NULL,
  role TEXT,
  
  FOREIGN KEY (ro_uuid) REFERENCES OIResearchOutputs(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  FOREIGN KEY (researcher_uuid) REFERENCES OIMembers(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);
-- DBML: (ro_uuid, researcher_uuid) [unique]
CREATE UNIQUE INDEX IF NOT EXISTS ux_oi_ro_collab_rouuid_member
  ON OIResearchOutputsCollaborators (ro_uuid, researcher_uuid);

-- OIMembersMetaInfo: One to One relationship between OIMembers and meta info aggregated from one to many relations with OIResearchOutputs (number of ROs, number of grants, number of collabortions (ROs done with other researchers)):
CREATE TABLE OIMembersMetaInfo (
  researcher_uuid TEXT PRIMARY KEY,
  num_research_outputs INTEGER NOT NULL DEFAULT 0,
  num_grants INTEGER NOT NULL DEFAULT 0,
  num_collaborations INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (researcher_uuid) REFERENCES OIMembers(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

-- OIResearchOutputTags: One to Many relationship between OIResearchOutputs and tags
CREATE TABLE IF NOT EXISTS OIResearchOutputTags (
  id INTEGER PRIMARY KEY,
  ro_uuid TEXT NOT NULL,
  type_name TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (ro_uuid) REFERENCES OIResearchOutputs(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);
-- DBML: (ro_uuid, tag) [unique]
CREATE UNIQUE INDEX IF NOT EXISTS ux_oi_research_outputs_tags_rouuid_tag
  ON OIResearchOutputTags (ro_uuid, name);

-- DBML: (researcher_name, name) [unique]
-- CREATE UNIQUE INDEX IF NOT EXISTS ux_oi_research_outputs_researcher_name
--   ON OIResearchOutputs (researcher_uuid, uuid);

-- OIResearchGrants
CREATE TABLE IF NOT EXISTS OIResearchGrants (
  uuid TEXT PRIMARY KEY,
  ro_uuid TEXT NOT NULL,
  grant_name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  total_funding INTEGER,
  top_funding_source_name TEXT,
  school TEXT,
  FOREIGN KEY (ro_uuid) REFERENCES OIResearchOutputs(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

-- OIResearchGrantsFundingSources: One to Many relationship between OIResearchGrants and funding sources
CREATE TABLE IF NOT EXISTS OIResearchGrantsFundingSources (
  id INTEGER PRIMARY KEY,
  grant_uuid TEXT NOT NULL,
  funding_source_name TEXT NOT NULL,
  amount REAL NOT NULL,
  FOREIGN KEY (grant_uuid) REFERENCES OIResearchGrants(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

-- DBML: (ro_name, grant_name) [unique]
CREATE UNIQUE INDEX IF NOT EXISTS ux_oi_research_grants_roname_grantname
  ON OIResearchGrants (ro_uuid, grant_name);

COMMIT;
