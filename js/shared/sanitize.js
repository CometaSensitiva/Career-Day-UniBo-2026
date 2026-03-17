export function escapeHtml(value) {
    const container = document.createElement('div');
    container.textContent = String(value || '');
    return container.innerHTML;
}

export function normalizeHttpUrl(value) {
    if (!value) return '';
    try {
        const url = new URL(String(value).replace(/&amp;/g, '&'));
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
        return url.href;
    } catch {
        return '';
    }
}

export function getHostFromUrl(value) {
    try {
        return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
}

export function getRootHost(host) {
    const parts = String(host || '').split('.').filter(Boolean);
    if (parts.length <= 2) return host;
    return parts.slice(-2).join('.');
}

export function renderMarkdown(md) {
    let html = escapeHtml(md);
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
        const safeUrl = normalizeHttpUrl(url);
        return safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` : escapeHtml(label);
    });
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<![*])\*([^*]+?)\*(?![*])/g, '<em>$1</em>');
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^(\s*)[-*] (.+)$/gm, '<li>$2</li>');
    html = html.replace(/^(\s*)\d+\. (.+)$/gm, '<li>$2</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    return sanitizeRichHtml(`<p>${html}</p>`);
}

export function sanitizeRichHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
    const allowedTags = new Set(['P', 'BR', 'STRONG', 'EM', 'CODE', 'PRE', 'A', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'HR', 'DIV', 'SPAN']);
    const allowedAttrs = {
        A: new Set(['href', 'target', 'rel', 'title'])
    };

    const sanitizeNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            return document.createTextNode(node.textContent || '');
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return document.createDocumentFragment();
        }

        if (!allowedTags.has(node.tagName)) {
            const fragment = document.createDocumentFragment();
            Array.from(node.childNodes).forEach((child) => {
                fragment.appendChild(sanitizeNode(child));
            });
            return fragment;
        }

        const clean = document.createElement(node.tagName.toLowerCase());
        const tagAllowedAttrs = allowedAttrs[node.tagName] || new Set();

        Array.from(node.attributes).forEach((attr) => {
            if (!tagAllowedAttrs.has(attr.name)) return;
            if (attr.name === 'href') {
                const safeHref = normalizeHttpUrl(attr.value);
                if (!safeHref) return;
                clean.setAttribute('href', safeHref);
                return;
            }
            clean.setAttribute(attr.name, attr.value);
        });

        if (node.tagName === 'A') {
            clean.setAttribute('target', '_blank');
            clean.setAttribute('rel', 'noopener noreferrer');
        }

        Array.from(node.childNodes).forEach((child) => {
            clean.appendChild(sanitizeNode(child));
        });

        return clean;
    };

    const fragment = document.createDocumentFragment();
    Array.from(doc.body.childNodes).forEach((child) => {
        fragment.appendChild(sanitizeNode(child));
    });
    const container = document.createElement('div');
    container.appendChild(fragment);
    return container.innerHTML;
}

export function linkifyPlainUrls(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.parentElement) return NodeFilter.FILTER_REJECT;
            const tag = node.parentElement.tagName;
            if (tag === 'A' || tag === 'CODE' || tag === 'PRE' || tag === 'SCRIPT' || tag === 'STYLE') {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    const urlRegex = /https?:\/\/[^\s<>()"]+/g;
    nodes.forEach((node) => {
        const text = node.nodeValue || '';
        if (!urlRegex.test(text)) return;
        urlRegex.lastIndex = 0;

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;
        while ((match = urlRegex.exec(text)) !== null) {
            const rawUrl = match[0];
            let url = rawUrl;
            while (/[),.;!?]$/.test(url)) url = url.slice(0, -1);
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            anchor.textContent = url;
            fragment.appendChild(anchor);
            const trailing = rawUrl.slice(url.length);
            if (trailing) fragment.appendChild(document.createTextNode(trailing));
            lastIndex = match.index + rawUrl.length;
        }
        if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        node.parentNode.replaceChild(fragment, node);
    });
}
