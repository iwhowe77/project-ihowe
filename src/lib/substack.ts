export const SUBSTACK_URL = "https://ianhowe.substack.com";

export type Post = {
  title: string;
  subtitle: string;
  url: string;
  date: Date | null;
  image: string | null;
};

// Shown when the feed can't be reached at build time, so a Substack outage
// or an offline build degrades to a stale list instead of an empty section.
const CURATED: Post[] = [
  {
    title: "Community Without the Commute",
    subtitle:
      "I brought a sense of neighborliness into my NYC apartment, and it was a lot easier than I thought it'd be.",
    url: `${SUBSTACK_URL}/p/community-without-the-commute`,
    date: null,
    image: null,
  },
  {
    title: "What Makes You Feel Fully Alive?",
    subtitle: "Reflections from a weekend filled with meaningful connection.",
    url: `${SUBSTACK_URL}/p/what-makes-you-feel-fully-alive`,
    date: null,
    image: null,
  },
  {
    title: "Howe to talk to people IRL",
    subtitle: "",
    url: `${SUBSTACK_URL}/p/howe-to-talk-to-people-irl`,
    date: null,
    image: null,
  },
];

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(item: string, name: string): string {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match ? decode(match[1]) : "";
}

function parse(xml: string): Post[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const published = new Date(tag(item, "pubDate"));
    const enclosure = item.match(/<enclosure[^>]*url="([^"]+)"/);
    return {
      title: tag(item, "title"),
      subtitle: decode(tag(item, "description").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " "),
      url: tag(item, "link"),
      date: Number.isNaN(published.getTime()) ? null : published,
      image: enclosure ? enclosure[1] : null,
    };
  });
}

export async function getPosts(limit = 4): Promise<Post[]> {
  try {
    const response = await fetch(`${SUBSTACK_URL}/feed`);
    if (!response.ok) throw new Error(`feed responded ${response.status}`);
    const posts = parse(await response.text());
    if (posts.length === 0) throw new Error("feed had no items");
    return posts.slice(0, limit);
  } catch (error) {
    console.warn(`[substack] falling back to curated posts: ${error}`);
    return CURATED.slice(0, limit);
  }
}

export function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
