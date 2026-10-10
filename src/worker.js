// Serves the static app from ./public. For HTML pages, it turns the relative
// link-preview URLs (meta tags marked data-abs) into absolute ones for the
// current domain, since WhatsApp/Facebook/X ignore relative og:image URLs.
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    if (!(res.headers.get('content-type') || '').includes('text/html')) return res;

    const origin = new URL(request.url).origin;
    return new HTMLRewriter()
      .on('meta[data-abs]', {
        element(el) {
          const value = el.getAttribute('content');
          if (value) el.setAttribute('content', new URL(value, origin).href);
          el.removeAttribute('data-abs');
        }
      })
      .transform(res);
  }
};
