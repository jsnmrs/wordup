/*
 * WordCleaner converts the HTML that word processors place on the clipboard
 * into the small, clean element set Wordup emits. It expects raw clipboard
 * markup (mso-* styles, conditional comments, marker spans) and must run
 * before any sanitizer that would strip those hints.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WordCleaner = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const serialize = (body) => {
    const doc = body.ownerDocument;
    Array.from(body.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.replace(/[\s\u00a0]/g, "")) {
          const paragraph = doc.createElement("p");
          node.replaceWith(paragraph);
          paragraph.appendChild(node);
        } else {
          node.remove();
        }
      }
    });
    return Array.from(body.children)
      .map((el) => el.outerHTML)
      .join("\n");
  };

  const clean = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return serialize(doc.body);
  };

  return { clean };
});
