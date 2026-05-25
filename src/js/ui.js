function qs(selector, root = document) {
	return root.querySelector(selector);
}

function qsa(selector, root = document) {
	return Array.from(root.querySelectorAll(selector));
}

function show(el) {
	if (el) el.classList.remove('hidden');
}

function hide(el) {
	if (el) el.classList.add('hidden');
}

function toggle(el, visible) {
	if (!el) return;
	el.classList.toggle('hidden', visible === false);
}

function setBusy(el, busy, options = {}) {
	if (!el) return;
	const labelEl = options.labelEl || el.querySelector('.btn-label');
	el.disabled = !!busy;
	el.classList.toggle('is-busy', !!busy);
	el.setAttribute('aria-busy', busy ? 'true' : 'false');
	if (labelEl) {
		if (busy && options.label !== undefined) {
			if (!labelEl.dataset.defaultLabel) {
				labelEl.dataset.defaultLabel = labelEl.textContent;
			}
			labelEl.textContent = options.label;
		} else if (!busy && labelEl.dataset.defaultLabel) {
			labelEl.textContent = labelEl.dataset.defaultLabel;
			delete labelEl.dataset.defaultLabel;
		}
	}
}

function setStatus(el, message, kind = 'info') {
	if (!el) return;
	el.textContent = message || '';
	el.dataset.kind = kind;
}

function on(target, event, handler, options) {
	if (target) target.addEventListener(event, handler, options);
}

export { qs, qsa, show, hide, toggle, setBusy, setStatus, on };
