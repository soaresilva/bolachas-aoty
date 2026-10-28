import { ImageResponse } from "next/og";
import { getPublishedList } from "@/lib/public";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Favorite albums of the year, by Bolachas";

// Share card: the title next to the top four covers.
export default async function Image({ params }: { params: Promise<{ year: string }> }) {
  const year = Number((await params).year);
  const list = Number.isInteger(year) ? await getPublishedList(year) : null;
  const covers = (list?.ranked ?? []).slice(0, 4).map((e) => e.cover_url).filter(Boolean);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#09090b", color: "#f4f4f5", padding: 60, gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ fontSize: 26, letterSpacing: 6, color: "#71717a" }}>{`BOLACHAS · ${year}`}</div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>{list?.title ?? `Albums of ${year}`}</div>
          <div style={{ fontSize: 28, color: "#a1a1aa" }}>{list ? `${list.ranked.length} albums` : ""}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 510, height: 510, gap: 10 }}>
          {covers.map((src, i) => (
            // eslint-disable-next-line jsx-a11y/alt-text -- rendered to PNG by satori, never shown as HTML
            <img key={i} src={src} width={250} height={250} style={{ objectFit: "cover" }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
