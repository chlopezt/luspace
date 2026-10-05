import { test, expect } from "@playwright/test";
for (const width of [320, 375, 414, 800, 1280]) {
  test(`public purpose and audiences render without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/presentacion");
    const section = page.locator("#para-quien");
    await expect(section.getByRole("heading", { level: 2 })).toHaveText(
      "Salud, educación y cuidado diario en un solo lugar",
    );
    await expect(section.locator(".lp-audience-card")).toHaveCount(3);
    for (const name of [
      "Padres y Cuidadores",
      "Familias con Necesidades Específicas",
      "Profesionales y Equipos Educativos",
    ]) {
      await expect(
        section.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    }
    await expect(section.getByText("Luciano", { exact: true })).toBeVisible();
    const layout = await page.evaluate(() => {
      const audience = document.querySelector("#para-quien")!;
      const features = document.querySelector("#caracteristicas")!;
      const testimonials = document.querySelector(".lp-testimonials")!;
      const cards = [...document.querySelectorAll(".lp-audience-card")].map(
        (c) => c.getBoundingClientRect(),
      );
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        afterFeatures: !!(
          features.compareDocumentPosition(audience) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
        beforeTestimonials: !!(
          audience.compareDocumentPosition(testimonials) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
        sameRow: cards.every((c) => Math.abs(c.top - cards[0].top) < 1),
      };
    });
    expect(layout.overflow).toBe(false);
    expect(layout.afterFeatures).toBe(true);
    expect(layout.beforeTestimonials).toBe(true);
    expect(layout.sameRow).toBe(width > 900);
    if (width === 1280 || width === 375)
      await section.screenshot({ path: `tmp/purpose-${width}.png` });
  });
}
