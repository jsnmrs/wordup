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

  const LIST_STYLE = /mso-list:\s*l\d+\s+level(\d+)/i;
  const MARKER_STYLE = /mso-list:\s*ignore/i;
  // Marker text that denotes a numbered item: 1. a) iv. (1) — bare bullet
  // glyphs (· o § ▪) carry no trailing punctuation and fall through
  const ORDERED_MARKER = /^\(?[0-9a-z]+[.)\]]/i;

  const getListLevel = (el) => {
    if (el.tagName !== "P") {
      return 0;
    }
    const match = LIST_STYLE.exec(el.getAttribute("style") || "");
    return match ? parseInt(match[1], 10) : 0;
  };

  const findMarker = (paragraph) =>
    Array.from(paragraph.querySelectorAll("[style]")).find((el) =>
      MARKER_STYLE.test(el.getAttribute("style") || ""),
    );

  // Word pastes lists as flat paragraphs carrying mso-list level styles and a
  // literal marker span; rebuild real nested ul/ol structure from them
  const rebuildLists = (body) => {
    const doc = body.ownerDocument;
    let stack = [];
    Array.from(body.children).forEach((el) => {
      const level = getListLevel(el);
      if (!level) {
        stack = [];
        return;
      }
      const marker = findMarker(el);
      const ordered = marker
        ? ORDERED_MARKER.test(marker.textContent.trim())
        : false;
      if (marker) {
        marker.remove();
      }
      stack.length = Math.min(stack.length, level);
      if (stack.length === level && marker) {
        const wanted = ordered ? "OL" : "UL";
        if (stack[stack.length - 1].tagName !== wanted) {
          stack.pop();
        }
      }
      while (stack.length < level) {
        const atTargetLevel = stack.length === level - 1;
        const list = doc.createElement(atTargetLevel && ordered ? "ol" : "ul");
        const parent = stack[stack.length - 1];
        if (parent) {
          (parent.lastElementChild || parent).appendChild(list);
        } else {
          body.insertBefore(list, el);
        }
        stack.push(list);
      }
      const item = doc.createElement("li");
      while (el.firstChild) {
        item.appendChild(el.firstChild);
      }
      stack[stack.length - 1].appendChild(item);
      el.remove();
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
    rebuildLists(body);
    convertStyledSpans(body);
    stripWordAttributes(body);
    normalizeInline(body);
    normalizeHeadings(body);
    removeEmptyBlocks(body);
    normalizeWhitespace(body);
    trimBlockEdges(body);
    return serialize(body);
  };

  // DOMPurify whitelist matching this cleaner's output contract; applied
  // wherever cleaned or user-entered HTML enters the page
  const purifyConfig = {
    ALLOWED_TAGS: [
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "strong",
      "em",
      "a",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "br",
    ],
    ALLOWED_ATTR: ["href", "colspan", "rowspan"],
    ALLOW_DATA_ATTR: false,
  };

  return { clean, purifyConfig };
});
