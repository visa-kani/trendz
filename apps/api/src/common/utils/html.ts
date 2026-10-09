import sanitizeHtml from "sanitize-html";

/**
 * Allow-list for rich product descriptions. Everything else (scripts, styles,
 * event handlers, iframes, images, inline CSS, javascript: URLs) is removed
 * before the HTML is stored, so the storefront only ever renders safe markup.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h3", "h4", "blockquote", "a", "span"],
  allowedAttributes: { a: ["href", "title", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
  },
  disallowedTagsMode: "discard",
};

export function sanitizeRichText(html: string | null | undefined): string | null {
  if (html == null) return null;
  const clean = sanitizeHtml(html, OPTIONS).trim();
  return clean === "" ? null : clean;
}
