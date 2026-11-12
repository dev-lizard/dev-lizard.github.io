// Shared code for the public pages. Content lives in data/maps.json and
// data/projects.json; edit them from /admin.html or by hand on GitHub.

const Site = (() => {
	async function loadJSON(path) {
		// no-cache so a fresh save from the admin page shows on reload
		const res = await fetch(path, { cache: "no-cache" });
		if (!res.ok) throw new Error(`Couldn't load ${path} (${res.status})`);
		return res.json();
	}

	function el(tag, attrs = {}, ...children) {
		const node = document.createElement(tag);
		for (const [k, v] of Object.entries(attrs)) {
			if (v == null || v === false) continue;
			if (k === "class") node.className = v;
			else if (k === "text") node.textContent = v;
			else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
			else node.setAttribute(k, v);
		}
		for (const c of children) if (c != null) node.append(c);
		return node;
	}

	function escapeHTML(s) {
		return String(s ?? "").replace(/[&<>"']/g, (c) => ({
			"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
		}[c]));
	}

	function safeURL(url) {
		const u = String(url ?? "").trim();
		if (/^(https?:|mailto:|\/|\.\/|#)/i.test(u) || /^[\w./-]+$/.test(u)) return u;
		return "#";
	}

	// Small Markdown subset: #/##/### headings, paragraphs, - lists,
	// **bold**, *italic*, `code`, [links](url), ![images](url).
	// Input is escaped first, so raw HTML in a write-up is shown as text.
	function markdown(src) {
		const inline = (t) => escapeHTML(t)
			.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, u) => `<img src="${safeURL(u)}" alt="${alt}">`)
			.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, u) => `<a href="${safeURL(u)}" target="_blank" rel="noopener">${txt}</a>`)
			.replace(/`([^`]+)`/g, "<code>$1</code>")
			.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
			.replace(/\*([^*]+)\*/g, "<em>$1</em>");

		const out = [];
		let para = [], list = [];
		const flush = () => {
			if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
			if (list.length) out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
			para = []; list = [];
		};
		for (const raw of String(src ?? "").split("\n")) {
			const line = raw.trim();
			const h = line.match(/^(#{1,3})\s+(.*)$/);
			if (!line) flush();
			else if (h) { flush(); const n = h[1].length + 1; out.push(`<h${n}>${inline(h[2])}</h${n}>`); }
			else if (/^[-*]\s+/.test(line)) { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } list.push(line.replace(/^[-*]\s+/, "")); }
			else { if (list.length) { out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`); list = []; } para.push(line); }
		}
		flush();
		return out.join("\n");
	}

	// ---------- lightbox ----------

	let box;
	function lightbox() {
		if (box) return box;
		const img = el("img", { alt: "" });
		const caption = el("div", { class: "lightbox-caption" });
		const close = el("button", { class: "lightbox-close", "aria-label": "Close", text: "×" });
		box = el("div", { class: "lightbox", role: "dialog", "aria-modal": "true" }, close, img, caption);
		const hide = () => { box.classList.remove("open"); img.removeAttribute("src"); };
		close.addEventListener("click", hide);
		box.addEventListener("click", (e) => { if (e.target === box) hide(); });
		document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
		box.show = (map) => {
			img.src = map.image || map.thumb;
			img.alt = map.title || "";
			caption.replaceChildren(el("strong", { text: map.title || "" }));
			if (map.caption) caption.append(el("span", { text: map.caption }));
			if (map.image) {
				caption.append(" ", el("a", { href: map.image, target: "_blank", rel: "noopener", text: "full size ↗" }));
			}
			box.classList.add("open");
			close.focus();
		};
		document.body.append(box);
		return box;
	}

	// ---------- maps page ----------

	const SECTIONS = [
		{ type: "static", title: "maps" },
		{ type: "interactive", title: "interactive maps" },
	];

	function tile(map) {
		const label = el("span", { class: "tile-label" }, map.title || "Untitled");
		if (map.year) label.append(el("small", { text: map.year }));
		const img = el("img", { src: map.thumb || map.image, alt: map.title || "", loading: "lazy" });

		if (map.type === "interactive" && map.link) {
			return el("a", { class: "tile", href: safeURL(map.link), target: "_blank", rel: "noopener" },
				img, el("span", { class: "badge", text: "interactive" }), label);
		}
		return el("button", { class: "tile", type: "button", onclick: () => lightbox().show(map) }, img, label);
	}

	async function renderMaps(container) {
		let maps;
		try { maps = await loadJSON("data/maps.json"); }
		catch (e) { container.append(el("p", { class: "empty", text: e.message })); return; }

		const visible = maps.filter((m) => !m.hidden);
		if (!visible.length) {
			container.append(el("p", { class: "empty", text: "Maps coming soon." }));
			return;
		}
		for (const s of SECTIONS) {
			const items = visible.filter((m) => (m.type || "static") === s.type);
			if (!items.length) continue;
			container.append(el("h2", { class: "section-title", text: s.title }), el("div", { class: "grid" }, ...items.map(tile)));
		}
	}

	// ---------- projects ----------

	async function renderProjects(container) {
		let projects;
		try { projects = await loadJSON("data/projects.json"); }
		catch (e) { container.append(el("p", { class: "empty", text: e.message })); return; }

		const visible = projects.filter((p) => !p.hidden);
		if (!visible.length) {
			container.append(el("p", { class: "empty", text: "Project write-ups coming soon." }));
			return;
		}
		const list = el("div", { class: "project-list" });
		for (const p of visible) {
			const href = `project.html?id=${encodeURIComponent(p.id)}`;
			list.append(el("a", { class: "project-card", href },
				el("div", { class: "thumb" }, (p.thumb || p.image) ? el("img", { src: p.thumb || p.image, alt: "", loading: "lazy" }) : null),
				el("div", {},
					el("h2", { text: p.title || "Untitled" }),
					el("p", { text: p.summary || "" }),
					el("span", { class: "more", text: "Read more →" }))));
		}
		container.append(list);
	}

	async function renderProject(container) {
		const id = new URLSearchParams(location.search).get("id");
		let projects = [];
		try { projects = await loadJSON("data/projects.json"); } catch {}
		const p = projects.find((x) => x.id === id);
		const back = el("a", { class: "back", href: "projects.html", text: "← All projects" });
		if (!p) {
			container.append(back, el("p", { class: "empty", text: "That project wasn't found." }));
			return;
		}
		document.title = `${p.title} · Maeve Clarke`;
		const article = el("article", { class: "article" }, back);
		if (p.image || p.thumb) article.append(el("img", { class: "hero", src: p.image || p.thumb, alt: "" }));
		article.append(el("h1", { text: p.title }));
		if (p.summary) article.append(el("p", { class: "summary", text: p.summary }));
		const body = el("div");
		body.innerHTML = markdown(p.body); // escaped inside markdown()
		article.append(body);
		if (p.link) article.append(el("a", { class: "button", href: safeURL(p.link), target: "_blank", rel: "noopener", text: p.linkLabel || "View project ↗" }));
		container.append(article);
	}

	return { renderMaps, renderProjects, renderProject, markdown, escapeHTML };
})();
