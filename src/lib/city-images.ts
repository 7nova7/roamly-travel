function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 1000;
  }
  return Math.abs(hash);
}

export function getCityImageUrl(city: string, region?: string, size = "600x400"): string {
  const query = [city, region, "travel"].filter(Boolean).join(" ");
  const sig = hashString(query);
  return `https://source.unsplash.com/${size}/?${encodeURIComponent(query)}&sig=${sig}`;
}
