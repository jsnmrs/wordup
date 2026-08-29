/* global DOMPurify, mammoth, TurndownService, WordCleaner */
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

// Module to manage the paste region and output operations
const EditorManager = (() => {
  const region = document.getElementById("wordup");
  const outputTextarea = document.getElementById("output");
  const fileInput = document.getElementById("docxfile");
  const statusRegion = document.getElementById("status");

  const setData = (html) => {
    region.innerHTML = html;
  };

  const setStatus = (message) => {
    statusRegion.textContent = message;
  };

  // Sanitized HTML for the region's content, one block element per line.
  // Re-parsing normalizes hand-typed content too: browsers that ignore the
  // defaultParagraphSeparator hint produce divs on Enter, renamed to p here.
  const getData = () => {
    const doc = new DOMParser().parseFromString(region.innerHTML, "text/html");
    Array.from(doc.body.querySelectorAll("div")).forEach((div) => {
      const paragraph = doc.createElement("p");
      while (div.firstChild) {
        paragraph.appendChild(div.firstChild);
      }
      div.replaceWith(paragraph);
    });
    const html = Array.from(doc.body.children)
      .map((el) => el.outerHTML)
      .join("\n");
    return DOMPurify.sanitize(html, WordCleaner.purifyConfig);
  };

  const insertHtml = (html) => {
    document.execCommand(
      "insertHTML",
      false,
      DOMPurify.sanitize(WordCleaner.clean(html), WordCleaner.purifyConfig),
    );
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    if (html) {
      insertHtml(html);
    } else {
      document.execCommand(
        "insertText",
        false,
        event.clipboardData.getData("text/plain"),
      );
    }
  };

  const handleDocx = (file) => {
    if (!file) {
      return;
    }
    if (!/\.docx$/i.test(file.name)) {
      setStatus(`Cannot convert ${file.name}. Upload a .docx document.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      mammoth
        .convertToHtml({ arrayBuffer: reader.result })
        .then((result) => {
          result.messages.forEach((message) => console.warn(message.message));
          setData(DOMPurify.sanitize(result.value, WordCleaner.purifyConfig));
          setStatus(
            `Converted ${file.name}. Review the content, then select Convert.`,
          );
        })
        .catch(() => {
          setStatus(`Could not convert ${file.name}.`);
        });
    };
    reader.onerror = () => {
      setStatus(`Could not read ${file.name}.`);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    region.classList.remove("dragover");
    if (event.dataTransfer.files.length) {
      handleDocx(event.dataTransfer.files[0]);
      return;
    }
    const html = event.dataTransfer.getData("text/html");
    if (html) {
      region.focus();
      insertHtml(html);
    }
  };

  const init = () => {
    document.execCommand("defaultParagraphSeparator", false, "p");
    region.addEventListener("paste", handlePaste);
    region.addEventListener("dragover", (event) => {
      event.preventDefault();
      region.classList.add("dragover");
    });
    region.addEventListener("dragleave", () => {
      region.classList.remove("dragover");
    });
    region.addEventListener("drop", handleDrop);
    fileInput.addEventListener("change", () => {
      handleDocx(fileInput.files[0]);
    });
  };

  const clearBoth = () => {
    setData("");
    outputTextarea.value = "";
    fileInput.value = "";
    setStatus("");
  };

  const wordup = () => {
    let processedData = TextScrubber.scrub(getData());

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
    init,
    wordup,
  };
})();

EditorManager.init();

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
