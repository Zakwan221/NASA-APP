import { cached, getJson } from './cache'

/** NASA Image and Video Library. No API key needed. */
export const PAGE_SIZE = 24

export interface NasaImage {
  nasaId: string
  title: string
  description: string
  date: string
  center?: string
  thumbUrl: string
  largeUrl: string
}

export interface ImagePage {
  total: number
  items: NasaImage[]
}

interface SearchResponse {
  collection: {
    metadata: { total_hits: number }
    items: Array<{
      data: Array<{
        nasa_id: string
        title: string
        description?: string
        date_created: string
        center?: string
      }>
      links?: Array<{ href: string; render?: string }>
    }>
  }
}

/** Some NASA ids contain spaces — make every URL safe to use */
function safeUrl(href: string): string {
  try {
    return encodeURI(decodeURI(href))
  } catch {
    return href
  }
}

export function searchImages(query: string, page: number) {
  const q = query.trim().toLowerCase()
  return cached<ImagePage>(`images:${q}:${page}`, async () => {
    const params = new URLSearchParams({
      q,
      media_type: 'image',
      page: String(page),
      page_size: String(PAGE_SIZE),
    })
    const data = await getJson<SearchResponse>(`https://images-api.nasa.gov/search?${params}`)
    if (!data) return null

    const items: NasaImage[] = []
    for (const item of data.collection.items) {
      const info = item.data[0]
      const links = (item.links ?? []).map((l) => safeUrl(l.href))
      const thumb = links.find((h) => h.includes('~small')) ?? links.find((h) => h.includes('~thumb')) ?? links[0]
      if (!info || !thumb) continue
      items.push({
        nasaId: info.nasa_id,
        title: info.title,
        description: info.description ?? '',
        date: info.date_created,
        center: info.center,
        thumbUrl: thumb,
        largeUrl: links.find((h) => h.includes('~medium')) ?? links.find((h) => h.includes('~large')) ?? thumb,
      })
    }
    return { total: data.collection.metadata.total_hits, items }
  })
}
