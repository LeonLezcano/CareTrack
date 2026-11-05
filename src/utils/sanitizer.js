/**
 * CareTrack Zero-Sink DOM Sanitizer
 * AppSec Guardian Zero-Trust Compliant
 * Uses native DOMParser and replaceChildren to eliminate DOM injection sinks.
 */

export class Sanitizer {
  static escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  static sanitizeURL(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim().toLowerCase();
    if (
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('vbscript:') ||
      trimmed.startsWith('file:')
    ) {
      return '#blocked-dangerous-scheme';
    }
    return url;
  }

  static sanitizeToFragment(dirtyHtml) {
    if (typeof DOMParser === 'undefined' || typeof document === 'undefined') {
      return null;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(dirtyHtml, 'text/html');
    const fragment = document.createDocumentFragment();

    const allowedTags = new Set([
      'DIV', 'SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
      'STRONG', 'B', 'EM', 'I', 'U', 'SMALL', 'BADGE', 'BUTTON', 'A', 'IMG',
      'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'MAIN',
      'LABEL', 'INPUT', 'SELECT', 'OPTION', 'TEXTAREA', 'FORM',
      'SVG', 'PATH', 'CIRCLE', 'RECT', 'LINE', 'POLYLINE', 'POLYGON', 'G'
    ]);

    const allowedAttrs = new Set([
      'class', 'id', 'name', 'type', 'value', 'placeholder', 'data-id',
      'data-action', 'data-tab', 'data-qr', 'data-code', 'data-patient', 'data-num', 'data-total',
      'disabled', 'checked', 'selected', 'rows', 'cols', 'href', 'title', 'aria-label',
      'role', 'd', 'fill', 'stroke', 'stroke-width', 'viewBox', 'xmlns', 'src', 'alt',
      'target', 'rel', 'step', 'max', 'min',
      'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'style'
    ]);

    function cleanNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(node.textContent || '');
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }

      const tagName = node.tagName.toUpperCase();
      if (!allowedTags.has(tagName)) {
        return null;
      }

      const cleanEl = document.createElement(tagName.toLowerCase());

      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        const attrName = attr.name.toLowerCase();

        if (attrName.startsWith('on') || attrName === 'formaction') continue;
        if ((attrName === 'href' || attrName === 'src') && attr.value.trim().toLowerCase().startsWith('javascript:')) continue;

        if (allowedAttrs.has(attrName) || attrName.startsWith('data-')) {
          cleanEl.setAttribute(attrName, attr.value);
        }
      }

      let child = node.firstChild;
      while (child) {
        const cleanedChild = cleanNode(child);
        if (cleanedChild) {
          cleanEl.appendChild(cleanedChild);
        }
        child = child.nextSibling;
      }

      return cleanEl;
    }

    let rootChild = doc.body.firstChild;
    while (rootChild) {
      const cleaned = cleanNode(rootChild);
      if (cleaned) {
        fragment.appendChild(cleaned);
      }
      rootChild = rootChild.nextSibling;
    }

    return fragment;
  }

  static safeSetInnerHTML(target, html) {
    if (!target) return;
    const fragment = Sanitizer.sanitizeToFragment(html);
    if (fragment && typeof target.replaceChildren === 'function') {
      target.replaceChildren(fragment);
    } else if (typeof target.replaceChildren === 'function') {
      const text = Sanitizer.escapeHTML(html);
      const textNode = typeof document !== 'undefined' ? document.createTextNode(text) : null;
      if (textNode) target.replaceChildren(textNode);
    }
  }
}
