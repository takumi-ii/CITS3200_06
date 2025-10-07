PRAGMA foreign_keys = ON;

BEGIN;

-- OIMembers
CREATE TABLE IF NOT EXISTS OIMembers (
  uuid TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,  -- serves as FK target
  email TEXT,
  education TEXT,             -- PhD, MSc, etc.
  bio TEXT,                   -- Pulled from the API
  position TEXT,              -- Their role at the OI - Associate Professor, Research Fellow, etc.
  first_title TEXT,                 -- Dr, Prof, etc.
  main_research_area TEXT,    -- Climate Change, Marine Biology, etc.
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
  journal_name TEXT,
  name TEXT NOT NULL,  
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
CREATE TABLE IF NOT EXISTS OIMembersMetaInfo (
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

-- OIResearchGrants
CREATE TABLE IF NOT EXISTS OIResearchGrants (
  uuid TEXT PRIMARY KEY,
  grant_name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  total_funding INTEGER,
  top_funding_source_name TEXT,
  school TEXT
);

-- OIResearchOutputsToGrants: Many to Many relationship between OIResearchOutputs and OIResearchGrants
CREATE TABLE IF NOT EXISTS OIResearchOutputsToGrants (
  id INTEGER PRIMARY KEY,
  ro_uuid TEXT NOT NULL,
  grant_uuid TEXT NOT NULL,
  FOREIGN KEY (ro_uuid) REFERENCES OIResearchOutputs(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
  FOREIGN KEY (grant_uuid) REFERENCES OIResearchGrants(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);
-- DBML: (ro_uuid, grant_uuid) [unique]
CREATE UNIQUE INDEX IF NOT EXISTS ux_oi_ro_to_grants_rouuid_grantuuid
  ON OIResearchOutputsToGrants (ro_uuid, grant_uuid);

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

-- OIPrizes:
CREATE TABLE IF NOT EXISTS OIPrizes (
  uuid TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  first_description TEXT,
  first_granting_organization_name TEXT,
  degree_of_recognition TEXT,
  year INTEGER NOT NULL,
  month INTEGER,
  day INTEGER
);

-- OIMembersToPrizes:
CREATE TABLE IF NOT EXISTS OIMembersToPrizes (
  id INTEGER PRIMARY KEY,
  re_uuid TEXT,
  prize_uuid TEXT,
  FOREIGN KEY (re_uuid) REFERENCES OIMembers(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
  FOREIGN KEY (prize_uuid) REFERENCES OIPrizes(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

-- ALL Concepts:
CREATE TABLE IF NOT EXISTS ALLConcepts (
  uuid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_discipline TEXT

);

-- OIFingerprints:
CREATE TABLE IF NOT EXISTS OIFingerprints (
  uuid TEXT PRIMARY KEY,
  origin_uuid TEXT NOT NULL,
  concept_uuid TEXT NOT NULL,
  rank REAL NOT NULL,
  frequency INTEGER,
  weightedRank REAL,
  UNIQUE(origin_uuid, concept_uuid, rank, frequency, weightedRank),
  FOREIGN KEY (concept_uuid) REFERENCES ALLConcepts(uuid)
    ON UPDATE CASCADE
    ON DELETE CASCADE

);

-- =====================================
-- Member Labels (promote, no_show, etc.)
-- =====================================
CREATE TABLE IF NOT EXISTS OIMemberLabels (
  id INTEGER PRIMARY KEY,
  researcher_uuid TEXT NOT NULL,
  label TEXT NOT NULL
    CHECK (label IN ('no_show','promote')),  -- << optional guard
  weight INTEGER NOT NULL DEFAULT 0,         -- priority for 'promote'
  starts_at DATE,
  expires_at DATE,
  note TEXT,
  UNIQUE (researcher_uuid, label),
  FOREIGN KEY (researcher_uuid) REFERENCES OIMembers(uuid)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_memberlabels_label ON OIMemberLabels(label);
CREATE INDEX IF NOT EXISTS ix_memberlabels_active_window
  ON OIMemberLabels(researcher_uuid, starts_at, expires_at);


COMMIT;
