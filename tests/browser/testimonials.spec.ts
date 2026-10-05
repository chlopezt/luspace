import { test, expect } from "@playwright/test";
for (const [width, visible] of [
  [375, 1],
  [800, 2],
  [1280, 3],
])
  test(`testimonials navigation shows ${visible} cards at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/presentacion");
    await expect(page.locator(".testimonial-card")).toHaveCount(4);
    await expect(
      page.getByRole("button", { name: "Testimonios siguientes" }),
    ).toBeEnabled();
    const ratio = await page
      .locator(".testimonial-track")
      .evaluate(
        (el) =>
          el.clientWidth /
          (el.firstElementChild as HTMLElement).getBoundingClientRect().width,
      );
    expect(Math.round(ratio)).toBe(visible);
    await page.getByRole("button", { name: "Testimonios siguientes" }).click();
    await expect(
      page.locator(".testimonial-dots button").nth(1),
    ).toHaveAttribute("aria-current", "true");
    await page.getByRole("button", { name: "Testimonios anteriores" }).click();
    await expect(
      page.locator(".testimonial-dots button").first(),
    ).toHaveAttribute("aria-current", "true");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1280)
      await page.locator('.lp-testimonials').screenshot({
        path: "tmp/testimonials-desktop.png",
      });
  });
