/* global CKEDITOR, TurndownService */
const turndownService = new TurndownService({
  bulletListMarker: "-",
  headingStyle: "atx",
});

// Module to handle text transformations
const TextScrubber = (() => {
  const regexEscape = (string) =>
    string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

  const reg = (string) => new RegExp(`https?://${regexEscape(string)}`, "g");

  const scrub = (string) => {
    return string
      .replace(
        /<p><strong>&nbsp;<\/strong><\/p>|<strong>&nbsp;<\/strong>|<p>&nbsp;<\/p>|<h[1-5]>&nbsp;<\/h[1-5]>|<\/strong><strong>|&ndash;ndash;/g,
        "",
      )
      .replace(
        /<(h[1-5])><strong>(.*?)<\/strong><\/\1>|<(h[1-5])><em>(.*?)<\/em><\/\3>/g,
        "<$1>$2</$1>",
      )
      .replace(/<(table|td|tr|th)\s+width="\d+">/g, "<$1>")
      .replace(/\n{2,}/g, "\n")
      .replace(/(&nbsp;){2,}/g, "&nbsp;")
      .replace(/&nbsp;/g, " ");
  };

  const addDomainFilter = (string, domain) => string.replace(reg(domain), "");

  const addLinkRel = (string) =>
    string.replace(
      /<(a\s+(?:[^>]*?\s+)?href="https?([^"]*)")/g,
      '<$1 rel="noopener noreferrer"',
    );

  return {
    scrub,
    addDomainFilter,
    addLinkRel,
  };
})();

// Module to manage CKEditor and output operations
const EditorManager = (() => {
  const outputTextarea = document.getElementById("output");

  const clearBoth = () => {
    CKEDITOR.instances.wordup.setData("");
    outputTextarea.value = "";
  };

  const wordup = () => {
    let processedData = TextScrubber.scrub(CKEDITOR.instances.wordup.getData());

    if (
      document.getElementById("domainfilter").checked &&
      document.getElementById("domainname").value
    ) {
      processedData = TextScrubber.addDomainFilter(
        processedData,
        document.getElementById("domainname").value,
      );
    }

    if (document.getElementById("linkrel").checked) {
      processedData = TextScrubber.addLinkRel(processedData);
    }

    if (document.getElementById("markdown").checked) {
      processedData = turndownService.turndown(processedData);
    }

    outputTextarea.value = processedData;
  };

  return {
    clearBoth,
    wordup,
  };
})();

// CKEditor configuration
CKEDITOR.replace("wordup", {
  dataIndentationChars: "  ",
  format_tags: "p;h1;h2;h3;h4;h5",
  height: 325,
  removeButtons:
    "Underline,Strike,Subscript,Superscript,Anchor,Styles,Specialchar",
  toolbarGroups: [
    { name: "basicstyles", groups: ["basicstyles"] },
    { name: "links", groups: ["links"] },
    { name: "paragraph", groups: ["list"] },
    { name: "insert", groups: ["list"] },
    { name: "document", groups: ["mode"] },
    { name: "styles", groups: ["styles"] },
  ],
});

// Event listeners for UI controls
document
  .getElementById("clear")
  .addEventListener("click", EditorManager.clearBoth);
document
  .getElementById("convert")
  .addEventListener("click", EditorManager.wordup);
document
  .getElementById("linkrel")
  .addEventListener("click", EditorManager.wordup);
document
  .getElementById("markdown")
  .addEventListener("click", EditorManager.wordup);
document
  .getElementById("domainfilter")
  .addEventListener("click", EditorManager.wordup);
