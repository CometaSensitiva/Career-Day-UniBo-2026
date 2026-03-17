export function $(id) {
    return document.getElementById(id);
}

export function setText(id, value) {
    const el = typeof id === 'string' ? $(id) : id;
    if (el) el.textContent = value;
}

export function clearChildren(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
}

export function toggleHidden(nodeOrId, hidden) {
    const el = typeof nodeOrId === 'string' ? $(nodeOrId) : nodeOrId;
    if (el) el.classList.toggle('hidden', hidden);
}

export function createEl(tagName, options = {}) {
    const el = document.createElement(tagName);
    if (options.className) el.className = options.className;
    if (options.text) el.textContent = options.text;
    if (options.html) el.innerHTML = options.html;
    if (options.attrs) {
        Object.entries(options.attrs).forEach(([key, value]) => {
            if (value === null || value === undefined) return;
            el.setAttribute(key, String(value));
        });
    }
    return el;
}

export function appendAll(parent, children) {
    if (!parent || !Array.isArray(children)) return;
    children.forEach((child) => {
        if (child) parent.appendChild(child);
    });
}

export function setButtonBusy(button, label, disabled = true) {
    if (!button) return () => {};
    const previous = {
        html: button.innerHTML,
        disabled: button.disabled
    };
    button.textContent = label;
    button.disabled = disabled;
    return () => {
        button.innerHTML = previous.html;
        button.disabled = previous.disabled;
    };
}

export function safeScrollIntoView(node, options) {
    if (!node || typeof node.scrollIntoView !== 'function') return;
    node.scrollIntoView(options);
}

export function initialsFromUser(user) {
    return String(user?.displayName || user?.email || '?')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}
