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
  const JUNK_TAGS = new Set([
    "STYLE",
    "SCRIPT",
    "LINK",
    "META",
    "TITLE",
    "XML",
    "IMG",
  ]);
  // Namespaced Office elements: <o:p>, VML <v:shape>, <w:sdt>, smart tags
  const NAMESPACED_TAG = /^(O|V|W|M|ST\d*):/i;
  // Attributes that survive cleaning, per element
  const KEPT_ATTRIBUTES = {
    A: ["href"],
    TD: ["colspan", "rowspan"],
    TH: ["colspan", "rowspan"],
  };

  const unwrap = (el) => {
    while (el.firstChild) {
      el.parentNode.insertBefore(el.firstChild, el);
    }
    el.remove();
  };

  const rename = (el, tagName) => {
    const replacement = el.ownerDocument.createElement(tagName);
    while (el.firstChild) {
      replacement.appendChild(el.firstChild);
    }
    el.replaceWith(replacement);
  };

  const removeComments = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        removeComments(child);
      }
    });
  };

  const removeJunkElements = (body) => {
    Array.from(body.querySelectorAll("*")).forEach((el) => {
      if (JUNK_TAGS.has(el.tagName) || NAMESPACED_TAG.test(el.tagName)) {
        el.remove();
      }
    });
  };

  // Google Docs marks emphasis with font-weight/font-style on spans and wraps
  // everything in <b style="font-weight:normal">; Word uses real b/i tags.
  const convertStyledSpans = (body) => {
    const doc = body.ownerDocument;
    Array.from(body.querySelectorAll("b[style], span[style]")).forEach((el) => {
      const style = el.getAttribute("style") || "";
      if (el.tagName === "B" && /(^|;)\s*font-weight:\s*normal/i.test(style)) {
        unwrap(el);
        return;
      }
      if (el.tagName !== "SPAN") {
        return;
      }
      const bold = /(^|;)\s*font-weight:\s*(bold|[7-9]00)/i.test(style);
      const italic = /(^|;)\s*font-style:\s*italic/i.test(style);
      if (!bold && !italic) {
        return;
      }
      const outer = doc.createElement(bold ? "strong" : "em");
      let target = outer;
      if (bold && italic) {
        target = doc.createElement("em");
        outer.appendChild(target);
      }
      while (el.firstChild) {
        target.appendChild(el.firstChild);
      }
      el.replaceWith(outer);
    });
  };

  const stripWordAttributes = (body) => {
    Array.from(body.querySelectorAll("*")).forEach((el) => {
      const kept = KEPT_ATTRIBUTES[el.tagName] || [];
      Array.from(el.attributes).forEach((attr) => {
        if (!kept.includes(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name);
        }
      });
    });
  };

  const normalizeInline = (body) => {
    Array.from(body.querySelectorAll("b")).forEach((el) => {
      rename(el, "strong");
    });
    Array.from(body.querySelectorAll("i")).forEach((el) => {
      rename(el, "em");
    });
    Array.from(body.querySelectorAll('a:not([href]), a[href^="#"]')).forEach(
      (el) => {
        unwrap(el);
      },
    );
    Array.from(body.querySelectorAll("font, u, span, div")).forEach((el) => {
      unwrap(el);
    });
  };

  const normalizeHeadings = (body) => {
    Array.from(body.querySelectorAll("h6")).forEach((el) => {
      rename(el, "p");
    });
    Array.from(body.querySelectorAll("h1, h2, h3, h4, h5")).forEach(
      (heading) => {
        while (
          heading.childNodes.length === 1 &&
          heading.firstChild.nodeType === Node.ELEMENT_NODE &&
          ["STRONG", "EM"].includes(heading.firstChild.tagName)
        ) {
          unwrap(heading.firstChild);
        }
      },
    );
  };

  const removeEmptyBlocks = (body) => {
    Array.from(body.querySelectorAll("p, h1, h2, h3, h4, h5, li")).forEach(
      (el) => {
        if (!el.textContent.replace(/[\s\u00a0]/g, "")) {
          el.remove();
        }
      },
    );
  };

  // Elements whose child whitespace is formatting noise, never content
  const STRUCTURAL_TAGS = new Set([
    "BODY",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "UL",
    "OL",
  ]);

  // Clipboard HTML is hard-wrapped mid-phrase; collapse the line breaks the
  // way a browser rendering the markup would
  const normalizeWhitespace = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        child.textContent = child.textContent.replace(/[\t\n\r ]+/g, " ");
        if (STRUCTURAL_TAGS.has(node.tagName) && !child.textContent.trim()) {
          child.remove();
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        normalizeWhitespace(child);
      }
    });
  };

  const trimBlockEdges = (body) => {
    Array.from(
      body.querySelectorAll("p, h1, h2, h3, h4, h5, li, td, th"),
    ).forEach((el) => {
      const first = el.firstChild;
      if (first && first.nodeType === Node.TEXT_NODE) {
        first.textContent = first.textContent.replace(/^[\t\n\r ]+/, "");
      }
      const last = el.lastChild;
      if (last && last.nodeType === Node.TEXT_NODE) {
        last.textContent = last.textContent.replace(/[\t\n\r ]+$/, "");
      }
    });
  };

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
    const body = doc.body;
    removeComments(body);
    removeJunkElements(body);
    convertStyledSpans(body);
    stripWordAttributes(body);
    normalizeInline(body);
    normalizeHeadings(body);
    removeEmptyBlocks(body);
    normalizeWhitespace(body);
    trimBlockEdges(body);
    return serialize(body);
  };

  return { clean };
});
