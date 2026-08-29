import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import WordCleaner from "../wordcleaner.js";

const fixture = (name) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("clean", () => {
  it("round-trips minimal clean HTML", () => {
    expect(WordCleaner.clean("<p>Hello</p>")).toBe("<p>Hello</p>");
  });

  it("joins blocks with single newlines", () => {
    expect(WordCleaner.clean("<p>One</p><p>Two</p>")).toBe(
      "<p>One</p>\n<p>Two</p>",
    );
  });

  it("wraps stray top-level text in a paragraph", () => {
    expect(WordCleaner.clean("Loose text")).toBe("<p>Loose text</p>");
  });
});
