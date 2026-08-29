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

describe("list reconstruction", () => {
  it("rebuilds a flat bulleted list", () => {
    const out = WordCleaner.clean(fixture("bullet-list.html"));
    expect(out).toBe(
      "<p>Fruit to buy:</p>\n" +
        "<ul><li>Red apples</li><li>Bananas</li><li>Concord grapes</li></ul>\n" +
        "<p>Nothing else.</p>",
    );
  });

  it("rebuilds a flat numbered list", () => {
    const out = WordCleaner.clean(fixture("numbered-list.html"));
    expect(out).toBe(
      "<ol><li>Preheat the oven</li><li>Mix the batter</li>" +
        "<li>Bake for 30 minutes</li></ol>",
    );
  });

  it("rebuilds nested lists with mixed markers", () => {
    const out = WordCleaner.clean(fixture("nested-list.html"));
    expect(out).toBe(
      "<ul><li>Produce" +
        "<ul><li>Apples" +
        "<ul><li>Honeycrisp</li><li>Fuji</li></ul></li>" +
        "<li>Pears</li></ul></li>" +
        "<li>Bakery<ol><li>Sourdough</li></ol></li></ul>",
    );
  });

  it("classifies markers: letters and roman numerals are ordered", () => {
    const item = (marker, text) =>
      `<p style='text-indent:-.25in;mso-list:l0 level1 lfo1'>` +
      `<span style='mso-list:Ignore'>${marker}</span>${text}</p>`;
    expect(WordCleaner.clean(item("a)", "Alpha"))).toBe(
      "<ol><li>Alpha</li></ol>",
    );
    expect(WordCleaner.clean(item("iv.", "Roman"))).toBe(
      "<ol><li>Roman</li></ol>",
    );
    expect(WordCleaner.clean(item("(1)", "Parens"))).toBe(
      "<ol><li>Parens</li></ol>",
    );
    expect(WordCleaner.clean(item("o", "Courier bullet"))).toBe(
      "<ul><li>Courier bullet</li></ul>",
    );
    expect(WordCleaner.clean(item("§", "Wingding"))).toBe(
      "<ul><li>Wingding</li></ul>",
    );
  });

  it("creates intermediate levels when Word skips one", () => {
    const out = WordCleaner.clean(
      "<p style='mso-list:l0 level1 lfo1'>" +
        "<span style='mso-list:Ignore'>·</span>Top</p>" +
        "<p style='mso-list:l0 level3 lfo1'>" +
        "<span style='mso-list:Ignore'>§</span>Deep</p>",
    );
    expect(out).toBe(
      "<ul><li>Top<ul><ul><li>Deep</li></ul></ul></li></ul>",
    );
  });

  it("starts a new list when the type changes at the same level", () => {
    const out = WordCleaner.clean(
      "<p style='mso-list:l0 level1 lfo1'>" +
        "<span style='mso-list:Ignore'>·</span>Bullet</p>" +
        "<p style='mso-list:l1 level1 lfo2'>" +
        "<span style='mso-list:Ignore'>1.</span>Number</p>",
    );
    expect(out).toBe("<ul><li>Bullet</li></ul>\n<ol><li>Number</li></ol>");
  });

  it("ends the list run at a non-list paragraph", () => {
    const out = WordCleaner.clean(
      "<p style='mso-list:l0 level1 lfo1'>" +
        "<span style='mso-list:Ignore'>·</span>One</p>" +
        "<p>Break</p>" +
        "<p style='mso-list:l0 level1 lfo1'>" +
        "<span style='mso-list:Ignore'>·</span>Two</p>",
    );
    expect(out).toBe(
      "<ul><li>One</li></ul>\n<p>Break</p>\n<ul><li>Two</li></ul>",
    );
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
