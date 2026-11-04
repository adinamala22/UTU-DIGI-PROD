export type VideoInfo = { provider: "youtube" | "vimeo"; id: string; embedUrl: string; thumbnail: string };

export function parseVideo(url?: string | null): VideoInfo | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) {
    const id = yt[1];
    return {
      provider: "youtube",
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    const id = vm[1];
    return {
      provider: "vimeo",
      id,
      embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1`,
      thumbnail: `https://vumbnail.com/${id}.jpg`,
    };
  }
  return null;
}
