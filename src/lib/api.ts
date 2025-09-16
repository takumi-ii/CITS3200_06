export type Member = {
  uuid: string;
  name: string;
  email?: string;
  education?: string;
  bio?: string;
  phone?: string;
  expertise?: string[];
  score?: number;
};

export type ResearchOutput = {
  uuid: string;
  researcher_uuid: string;
  publisher_name?: string;
  name: string;
  score?: number;
};

export async function searchAll(query: string): Promise<{ members: Member[]; research_outputs: ResearchOutput[]; }> {
  const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
  return resp.json();
}


