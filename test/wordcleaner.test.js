import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import WordCleaner from "../wordcleaner.js";

const fixture = (name) => readFileSync(`test/fixtures/${name}`, "utf8");

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

describe("junk removal", () => {
  it("removes comments, including downlevel conditionals", () => {
    const out = WordCleaner.clean(fixture("bullet-list.html"));
    expect(out).not.toContain("supportLists");
    expect(out).not.toContain("StartFragment");
    expect(out).not.toContain("<!--");
  });

  it("removes namespaced Office elements and junk tags", () => {
    const out = WordCleaner.clean(
      "<p>Keep me</p><style>p{color:red}</style>" +
        '<img src="file:///C:/temp/clip_image001.png">' +
        '<v:shape id="x"><v:imagedata src="x"></v:imagedata></v:shape>' +
        "<p>Also <o:p></o:p>kept</p>",
    );
    expect(out).toBe("<p>Keep me</p>\n<p>Also kept</p>");
  });

  it("strips Word attributes while keeping href, colspan, and rowspan", () => {
    const out = WordCleaner.clean(fixture("table.html"));
    expect(out).not.toMatch(/class=|style=|width=|valign=|cellspacing=/);
    expect(out).toContain('<td colspan="2">');
    expect(out).toContain("<td><p><strong>Region</strong></p></td>");
  });

  it("keeps only href on links", () => {
    const out = WordCleaner.clean(fixture("links.html"));
    expect(out).toContain('<a href="https://example.com/faq">FAQ</a>');
    expect(out).not.toMatch(/target=|title=/);
  });
});

describe("inline normalization", () => {
  it("converts b and i to strong and em and unwraps junk wrappers", () => {
    const out = WordCleaner.clean(fixture("inline.html"));
    expect(out).toContain("<strong>bold words</strong>");
    expect(out).toContain("<em>italic words</em>");
    expect(out).toContain("<strong><em>bold italic words</em></strong>");
    expect(out).toContain("Font-tagged text");
    expect(out).toContain("needlessly underlined");
    expect(out).not.toMatch(/<(b|i|u|font|span)[ >]/);
  });

  it("unwraps link-less anchors and internal fragment links", () => {
    const out = WordCleaner.clean(
      '<p><a name="OLE_LINK1">Bookmarked</a> and a footnote' +
        '<a href="#_ftn1"><span>[1]</span></a> reference</p>',
    );
    expect(out).toBe("<p>Bookmarked and a footnote[1] reference</p>");
  });

  it("converts Google Docs styled spans and unwraps the bold wrapper", () => {
    const out = WordCleaner.clean(fixture("google-docs.html"));
    expect(out).toContain("<strong>bold words</strong>");
    expect(out).toContain("<em>italic words</em>");
    expect(out).toContain("<li><p>First real list item</p></li>");
    expect(out).not.toMatch(/<(b|span)[ >]/);
  });
});

describe("heading normalization", () => {
  it("unwraps spans and emphasis inside headings and demotes h6", () => {
    const out = WordCleaner.clean(fixture("headings.html"));
    expect(out).toContain("<h1>Annual Report</h1>");
    expect(out).toContain("<h5>Vermont</h5>");
    expect(out).toContain("<p>Montpelier</p>");
    expect(out).not.toContain("<h6>");
  });

  it("unwraps a strong tag spanning an entire heading", () => {
    expect(WordCleaner.clean("<h2><strong>All bold</strong></h2>")).toBe(
      "<h2>All bold</h2>",
    );
    expect(
      WordCleaner.clean("<h2>Partly <strong>bold</strong></h2>"),
    ).toBe("<h2>Partly <strong>bold</strong></h2>");
  });
});

describe("empty block removal", () => {
  it("drops paragraphs that hold only whitespace or nbsp", () => {
    const out = WordCleaner.clean(fixture("empty-paras.html"));
    expect(out).toBe(
      "<p>First paragraph.</p>\n<p>Second paragraph.</p>\n<p>Third paragraph.</p>",
    );
  });

  it("drops paragraphs that hold only a line break", () => {
    expect(WordCleaner.clean("<p>Kept</p><p><br></p>")).toBe("<p>Kept</p>");
  });
});
