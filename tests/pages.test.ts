import { describe, expect, it } from "vitest";
import { generateStaticParams } from "@/app/[year]/page";

describe("year pages", () => {
  it("prerender no real year at build", async () => {
    // Regression: with /2026 prerendered, the first request after every admin
    // edit served the build-time snapshot. See the comment on generateStaticParams.
    const params = await generateStaticParams();
    expect(params).toEqual([{ year: "0" }]);
  });
});
