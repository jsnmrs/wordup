/* global CKEDITOR, TurndownService */
var turndownService = new TurndownService({
  bulletListMarker: "-",
  headingStyle: "atx"
});

// Configure CKEditor window
CKEDITOR.replace("wordup", {
  dataIndentationChars: "  ",
  format_tags: "p;h1;h2;h3;h4;h5",
  height: 325,
  removeButtons:
    "Underline,Strike,Subscript,Superscript,Anchor,Styles,Specialchar",
  toolbarGroups: [
    { groups: ["basicstyles"], name: "basicstyles" },
    { groups: ["links"], name: "links" },
    { groups: ["list"], name: "paragraph" },
    { groups: ["list"], name: "insert" },
    { groups: ["mode"], name: "document" },
    { groups: ["styles"], name: "styles" }
  ]
});

function scrubber(string) {
  var scrubbed = string;

  scrubbed = scrubbed
    .replace(/<p><strong>&nbsp;<\/strong><\/p>/g, "")
    .replace(/<strong>&nbsp;<\/strong>/g, "")
    .replace(/<p>&nbsp;<\/p>/g, "")
    .replace(/<h1>&nbsp;<\/h1>/g, "")
    .replace(/<h2>&nbsp;<\/h2>/g, "")
    .replace(/<h3>&nbsp;<\/h3>/g, "")
    .replace(/<h4>&nbsp;<\/h4>/g, "")
    .replace(/<h5>&nbsp;<\/h5>/g, "")
    .replace(/<(h[^>])+><strong>(.*)<\/strong><\/h[^>]+>/g, "<$1>$2</$1>")
    .replace(/<(h[^>])+><em>(.*)<\/em><\/h[^>]+>/g, "<$1>$2</$1>")
    .replace(/<(table|td|tr|th)\s+width="(\d+?)">/g, "<$1>")
    .replace(/<\/strong><strong>/g, "")
    .replace(/&ndash;ndash;/g, "&mdash;")
    .replace(/\n\n\n/g, "\n\n")
    .replace(/\n\n/g, "\n")
    .replace(
      /&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/g,
      "&nbsp;"
    )
    .replace(
      /&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/g,
      "&nbsp;"
    )
    .replace(/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/g, "&nbsp;")
    .replace(/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/g, "&nbsp;")
    .replace(/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/g, "&nbsp;")
    .replace(/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/g, "&nbsp;")
    .replace(/&nbsp;&nbsp;&nbsp;&nbsp;/g, "&nbsp;")
    .replace(/&nbsp;&nbsp;&nbsp;/g, "&nbsp;")
    .replace(/&nbsp;&nbsp;/g, "&nbsp;")
    .replace(/&nbsp;/g, " ");

  return scrubbed;
}

function regexEscape(string) {
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function reg(string) {
  var escaped = string;
  var flags = "g";

  escaped = regexEscape(escaped);
  escaped = "https?://" + escaped;

  return new RegExp(escaped, flags);
}

function addDomainFilter(string, domain) {
  var filtered = string;
  var domainregex = reg(domain);

  filtered = filtered.replace(domainregex, "");

  return filtered;
}

function addTargetBlank(string) {
  var plusTarget = string;

  plusTarget = plusTarget.replace(
    /<(a\s+(?:[^>]*?\s+)?href="https?([^"]*)")/g,
    '<$1 target="_blank" rel="noopener noreferrer"'
  );

  return plusTarget;
}

function clearBoth() {
  CKEDITOR.instances.wordup.setData("");
  document.getElementById("output").value = "";
}

function wordup() {
  var pasteData = CKEDITOR.instances.wordup.getData();

  pasteData = scrubber(pasteData);

  if (
    document.getElementById("domainfilter").checked === true &&
    document.getElementById("domainname").value
  ) {
    pasteData = addDomainFilter(
      pasteData,
      document.getElementById("domainname").value
    );
  }

  if (document.getElementById("targetblank").checked === true) {
    pasteData = addTargetBlank(pasteData);
  }

  if (document.getElementById("markdown").checked === true) {
    pasteData = turndownService.turndown(pasteData);
  }

  document.getElementById("output").value = pasteData;
}

document.getElementById("clear").addEventListener("click", clearBoth);
document.getElementById("convert").addEventListener("click", wordup);
document.getElementById("targetblank").addEventListener("click", wordup);
document.getElementById("markdown").addEventListener("click", wordup);
document.getElementById("domainfilter").addEventListener("click", wordup);
