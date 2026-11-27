// Throwaway probe: can a Cloudflare Pages Function read Substack's profile feed?
export async function onRequest() {
  const url = 'https://substack.com/api/v1/reader/feed/profile/111934112';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ihowe-site)', Accept: 'application/json' } });
    const text = await r.text();
    let restacks = null, types = null;
    try {
      const j = JSON.parse(text);
      types = (j.items || []).map((i) => i.context && i.context.type);
      restacks = (j.items || []).filter((i) => i.context && i.context.type === 'post_restack')
        .map((i) => ({ title: i.post && i.post.title, url: i.post && i.post.canonical_url, pub: i.publication && i.publication.name, at: i.context.timestamp }));
      return Response.json({ status: r.status, types, restacks, nextCursor: j.nextCursor ?? null });
    } catch (e) {
      return Response.json({ status: r.status, notJson: text.slice(0, 300) });
    }
  } catch (e) {
    return Response.json({ error: String(e) });
  }
}
