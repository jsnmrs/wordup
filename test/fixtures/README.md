# Test fixtures

These files are synthetic clipboard HTML, hand-built to match the markup that
Microsoft Word for desktop (and, for `google-docs.html`, Google Docs) places on
the clipboard: `mso-*` styles, `<o:p>` tags, downlevel conditional comments,
unquoted attributes, and `mso-list` marker spans.

They are not captures of real documents. When adding coverage for a new source
or a regression, prefer a real capture: run this in any page's console, paste
from the source application, and save the logged string here.

```js
document.addEventListener("paste", (e) =>
  console.log(e.clipboardData.getData("text/html")),
);
```

`fixture.docx` is a minimal generated Word document used by the Mammoth
integration test.
