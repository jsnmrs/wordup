# Wordup

Convert Word documents to clean HTML or Markdown.

<https://code.jasonmorris.com/wordup>

Paste copied Word content into the editing area, or upload a `.docx` file (drag and drop works too). Pasted content is cleaned by Wordup&rsquo;s own Word-HTML filter, which rebuilds real lists from Word&rsquo;s markup and strips Office cruft. Uploaded files are converted by [Mammoth](https://github.com/mwilliamson/mammoth.js), which reads the document XML directly for the highest fidelity. All content is sanitized with [DOMPurify](https://github.com/cure53/DOMPurify), and Markdown conversion is handled by [Turndown](https://github.com/mixmark-io/turndown). Images are stripped by design. Read the [Wordup blog post](https://jasonmorris.com/code/wordup/).

## Running locally

1. `npx serve`

## Running tests

1. `npm install`
2. `npm test`
