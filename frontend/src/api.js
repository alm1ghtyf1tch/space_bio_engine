// frontend/src/api.js
export async function searchQuery(query, k = 5) {
  const url = `/search?q=${encodeURIComponent(query)}&k=${k}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Search error ${resp.status}`);
  return resp.json(); // returns { query, k, results: [...] }
}

export async function qaQuery(question, k = 10) {
  const url = `/qa?q=${encodeURIComponent(question)}&k=${k}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`QA error ${resp.status}`);
  return resp.json(); // returns { query, answer, verdict, confidence, evidence }
}

export async function healthCheck() {
  const resp = await fetch(`/health`);
  if (!resp.ok) throw new Error(`Health error ${resp.status}`);
  return resp.json();
}
