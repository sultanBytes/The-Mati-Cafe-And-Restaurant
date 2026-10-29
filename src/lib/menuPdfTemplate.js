import { RESTAURANT_NAME } from "./constants.js";
import { getItemPrices } from "./format.js";
import { getPublicItems, groupItemsByCategory } from "./menuVisibility.js";

export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

const FOOTER_LINE = "Ask your server to place your order.";

export function rupee(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function itemVariants(item) {
  return (item.variants || [])
    .map((variant) => ({
      label: String(variant.label || variant.name || "").trim(),
      price: Number(variant.price),
    }))
    .filter((variant) => variant.label && Number.isFinite(variant.price) && variant.price >= 0);
}

export function categoryIconSvg(categoryId, accent) {
  const kind = String(categoryId || "menu").length % 4;
  if (kind === 1) {
    return `<svg viewBox="0 0 54 54" width="54" height="54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="54" height="54" rx="12" fill="${accent}" fill-opacity=".12"/><path d="M16 34c8-2 10-12 11-20 6 7 10 14 10 22" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/><circle cx="27" cy="16" r="3" fill="${accent}"/></svg>`;
  }
  if (kind === 2) {
    return `<svg viewBox="0 0 54 54" width="54" height="54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="54" height="54" rx="12" fill="${accent}" fill-opacity=".12"/><path d="M18 24h18l-1.5 12H19.5L18 24z" fill="none" stroke="${accent}" stroke-width="2.2"/><path d="M22 24v-4a5 5 0 0 1 10 0v4" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  }
  if (kind === 3) {
    return `<svg viewBox="0 0 54 54" width="54" height="54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="54" height="54" rx="12" fill="${accent}" fill-opacity=".12"/><ellipse cx="27" cy="22" rx="12" ry="5" fill="none" stroke="${accent}" stroke-width="2.2"/><path d="M15 22c0 10 5.5 18 12 18s12-8 12-18" fill="none" stroke="${accent}" stroke-width="2.2"/></svg>`;
  }
  return `<svg viewBox="0 0 54 54" width="54" height="54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="54" height="54" rx="12" fill="${accent}" fill-opacity=".12"/><path d="M27 14c8 8 12 14 12 20a12 12 0 0 1-24 0c0-6 4-12 12-20z" fill="none" stroke="${accent}" stroke-width="2.2"/><path d="M27 26v16" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function patternDataUri(theme) {
  const color = encodeURIComponent(theme.patternColor);
  if (theme.pattern === "bamboo") {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36'><path d='M0 36L36 0M-10 10L10 -10M26 46L46 26' fill='none' stroke='${color}' stroke-width='1.1'/></svg>`;
    return `url("data:image/svg+xml,${svg}")`;
  }
  if (theme.pattern === "flower") {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><g fill='none' stroke='${color}' stroke-width='1.2' transform='translate(30 30)'><ellipse rx='6' ry='14'/><ellipse rx='6' ry='14' transform='rotate(60)'/><ellipse rx='6' ry='14' transform='rotate(120)'/><circle r='4'/></g></svg>`;
    return `url("data:image/svg+xml,${svg}")`;
  }
  if (theme.pattern === "zigzag") {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='14'><path d='M0 10L7 3L14 10L21 3L28 10' fill='none' stroke='${color}' stroke-width='1.2'/><path d='M0 13L7 6L14 13L21 6L28 13' fill='none' stroke='${color}' stroke-width='1.2'/></svg>`;
    return `url("data:image/svg+xml,${svg}")`;
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><g fill='none' stroke='${color}' stroke-width='1.15' transform='translate(32 32)'><circle r='16'/><path d='M0 -22V22M-22 0H22M-15.5 -15.5L15.5 15.5M15.5 -15.5L-15.5 15.5'/><circle cx='0' cy='-22' r='1.6' fill='${color}' stroke='none'/><circle cx='0' cy='22' r='1.6' fill='${color}' stroke='none'/><circle cx='22' cy='0' r='1.6' fill='${color}' stroke='none'/><circle cx='-22' cy='0' r='1.6' fill='${color}' stroke='none'/></g></svg>`;
  return `url("data:image/svg+xml,${svg}")`;
}

function fontFaceCss(fonts) {
  return fonts
    .map(
      (font) => `@font-face{font-family:"${font.family}";src:url("${font.dataUrl}") format("woff2");font-weight:${font.weight};font-style:normal;font-display:block;}`,
    )
    .join("");
}

export function menuPdfCss(theme, fonts) {
  const pattern = patternDataUri(theme);
  return `${fontFaceCss(fonts)}
.pdf-root{margin:0;padding:0;background:${theme.bg};color:${theme.ink};font-family:"${theme.bodyFont}",Lato,sans-serif;}
.pdf-page{position:relative;width:${A4_WIDTH_PX}px;height:${A4_HEIGHT_PX}px;overflow:hidden;background:${theme.bg};color:${theme.ink};box-sizing:border-box;}
.pdf-pattern,.pdf-watermark{position:absolute;inset:0;pointer-events:none;z-index:0;}
.pdf-pattern{background-image:${pattern};background-size:${theme.patternSize};opacity:${theme.patternOpacity};}
.pdf-watermark{background-image:url("${theme.watermarkUrl}");background-size:cover;background-position:center;filter:grayscale(1);opacity:${theme.watermarkOpacity};}
.pdf-content{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;}
.pdf-hero{position:relative;height:188px;flex:none;overflow:hidden;}
.pdf-hero img{width:100%;height:100%;object-fit:cover;object-position:${theme.heroPosition};display:block;}
.pdf-hero-overlay{position:absolute;inset:0;background:linear-gradient(180deg,${theme.overlayFrom},${theme.overlayTo});}
.pdf-hero-copy{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18px 28px;color:#f7efe3;}
.pdf-hero-copy h1{margin:0;font-family:"Playfair Display",Georgia,serif;font-weight:800;font-size:34px;line-height:1.1;letter-spacing:.2px;}
.pdf-hero-copy p{margin:8px 0 0;font-family:"${theme.bodyFont}",Lato,sans-serif;font-size:13px;letter-spacing:.18em;text-transform:uppercase;opacity:.92;}
.pdf-ornament{margin-top:10px;color:${theme.accent};font-size:11px;letter-spacing:6px;}
.pdf-runhead{flex:none;padding:16px 28px 8px;font-family:"Playfair Display",Georgia,serif;font-weight:800;font-size:13px;color:${theme.accent};}
.pdf-body{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px 22px;padding:10px 28px 8px;min-height:0;}
.pdf-col{min-width:0;}
.pdf-section{break-inside:avoid;page-break-inside:avoid;}
.pdf-section-title{display:flex;align-items:center;gap:8px;margin:0 0 8px;color:${theme.accent};font-family:"${theme.headingFont}",Georgia,serif;font-weight:${theme.headingWeight};font-size:15px;letter-spacing:${theme.headingLetterSpacing};text-transform:${theme.headingUppercase ? "uppercase" : "none"};}
.pdf-section-title.pill{display:inline-flex;background:${theme.pillBg || "#fde1e9"};border-radius:999px;padding:4px 12px;margin-bottom:10px;}
.pdf-section-title.pill .line{display:none;}
.pdf-section-title .line{flex:1;height:2px;background:${theme.accent2};}
.pdf-section-title .gem{color:${theme.accent2};font-size:11px;}
.pdf-item{display:grid;grid-template-columns:54px 1fr;gap:8px;align-items:start;margin:0 0 9px;break-inside:avoid;page-break-inside:avoid;}
.pdf-thumb{width:54px;height:54px;border-radius:12px;overflow:hidden;background:${theme.accent2};flex:none;}
.pdf-thumb img,.pdf-thumb svg{width:54px;height:54px;object-fit:cover;display:block;}
.pdf-name-row{display:flex;align-items:baseline;gap:6px;min-width:0;}
.pdf-name{font-weight:600;font-size:12.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pdf-leader{flex:1;border-bottom:1px dotted ${theme.accent2};transform:translateY(-3px);min-width:12px;}
.pdf-price{color:${theme.accent};font-weight:600;font-size:12.5px;white-space:nowrap;}
.pdf-from{display:inline-block;margin-right:4px;font-size:8px;letter-spacing:.08em;font-weight:700;vertical-align:middle;opacity:.85;}
.pdf-desc{margin:3px 0 0;font-size:12px;line-height:1.35;opacity:.72;}
.pdf-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;}
.pdf-chip{font-size:11px;line-height:1;padding:4px 7px;border-radius:999px;border:1px solid ${theme.accent2};}
.pdf-chip strong{color:${theme.accent};font-weight:600;}
.pdf-gallery{flex:none;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:6px 28px 0;}
.pdf-gallery img{height:110px;width:100%;object-fit:cover;border-radius:10px;border:2px solid ${theme.accent};display:block;}
.pdf-footer{flex:none;display:flex;justify-content:space-between;align-items:center;padding:8px 28px 12px;font-size:10px;opacity:.8;}
`;
}

function estimateItemHeight(item) {
  const variants = itemVariants(item);
  const desc = String(item.description || "").trim();
  const descLines = desc ? Math.min(3, Math.ceil(desc.length / 46)) : 0;
  const chips = variants.length >= 2 ? 22 : 0;
  const text = 18 + descLines * 15 + chips;
  return Math.max(62, text + 10);
}

function estimateHeadingHeight(theme) {
  return theme.sectionPills ? 40 : 36;
}

function paginateGroups(groups, theme) {
  const page1Body = 680;
  const otherBody = 820;
  const colCount = 2;
  const pages = [];

  function fresh(isFirst) {
    return {
      isFirst,
      cols: Array.from({ length: colCount }, () => ({ height: 0, blocks: [] })),
      col: 0,
    };
  }

  let page = fresh(true);
  pages.push(page);

  function bodyLimit() {
    return page.isFirst ? page1Body : otherBody;
  }

  function advance() {
    if (page.col < colCount - 1) {
      page.col += 1;
      return;
    }
    page = fresh(false);
    pages.push(page);
  }

  function fits(height) {
    return page.cols[page.col].height + height <= bodyLimit();
  }

  function push(block, height) {
    if (!fits(height)) advance();
    if (!fits(height)) advance();
    page.cols[page.col].blocks.push(block);
    page.cols[page.col].height += height;
  }

  for (const group of groups) {
    const headingH = estimateHeadingHeight(theme);
    const firstH = estimateItemHeight(group.items[0]);
    if (!fits(headingH + firstH)) advance();
    push({ type: "heading", category: group.category }, headingH);
    for (const item of group.items) {
      push({ type: "item", item, category: group.category }, estimateItemHeight(item));
    }
  }

  return pages;
}

function renderItem(item, theme) {
  const variants = itemVariants(item);
  const { hasRange, min } = getItemPrices(item);
  const showChips = variants.length >= 2;
  const thumb = item.imageDataUrl
    ? `<img src="${item.imageDataUrl}" alt="">`
    : categoryIconSvg(item.categoryId, theme.accent);
  const desc = String(item.description || "").trim();
  const priceHtml = hasRange
    ? `<span class="from">FROM</span>${escapeHtml(rupee(min))}`
    : escapeHtml(rupee(item.price));
  const chips = showChips
    ? `<div class="pdf-chips">${variants
        .map((variant) => `<span class="pdf-chip">${escapeHtml(variant.label)} <strong>${escapeHtml(rupee(variant.price))}</strong></span>`)
        .join("")}</div>`
    : "";
  const priceRow = showChips
    ? `<div class="pdf-name">${escapeHtml(item.name)}</div>`
    : `<div class="pdf-name">${escapeHtml(item.name)}</div><span class="pdf-leader"></span><div class="pdf-price">${priceHtml}</div>`;
  return `<article class="pdf-item"><div class="pdf-thumb">${thumb}</div><div><div class="pdf-name-row">${priceRow}</div>${
    desc ? `<p class="pdf-desc">${escapeHtml(desc)}</p>` : ""
  }${chips}</div></article>`;
}

function renderHeading(category, theme) {
  const pill = theme.sectionPills ? " pill" : "";
  return `<div class="pdf-section"><h2 class="pdf-section-title${pill}"><span>${escapeHtml(category.name)}</span><span class="line"></span><span class="gem">❖</span></h2></div>`;
}

function renderPage(page, index, total, theme, restaurantName) {
  const hero = page.isFirst
    ? `<header class="pdf-hero"><img src="${theme.heroUrl}" alt=""><div class="pdf-hero-overlay"></div><div class="pdf-hero-copy"><h1>${escapeHtml(
        restaurantName,
      )}</h1><p>Vegetarian Café Menu</p><div class="pdf-ornament">◆ ◆ ◆</div></div></header>`
    : `<div class="pdf-runhead">${escapeHtml(restaurantName)}</div>`;
  const cols = page.cols
    .map((col) => {
      const html = col.blocks
        .map((block) => (block.type === "heading" ? renderHeading(block.category, theme) : renderItem(block.item, theme)))
        .join("");
      return `<div class="pdf-col">${html}</div>`;
    })
    .join("");
  const gallery = theme.galleryUrls
    .map((url) => `<img src="${url}" alt="">`)
    .join("");
  return `<section class="pdf-page">
    <div class="pdf-pattern"></div>
    <div class="pdf-watermark"></div>
    <div class="pdf-content">
      ${hero}
      <div class="pdf-body">${cols}</div>
      <div class="pdf-gallery">${gallery}</div>
      <footer class="pdf-footer"><span>${escapeHtml(FOOTER_LINE)}</span><span>${index + 1} / ${total}</span></footer>
    </div>
  </section>`;
}

export function buildMenuPdfDocument(menu, theme, { fonts, photos, itemImages }) {
  const restaurantName = menu.restaurant?.name || RESTAURANT_NAME;
  const items = getPublicItems(menu).map((item) => ({
    ...item,
    imageDataUrl: itemImages.get(item.id) || "",
  }));
  const groups = groupItemsByCategory(menu, items);
  const themed = {
    ...theme,
    heroUrl: photos[theme.hero],
    watermarkUrl: photos[theme.watermark],
    galleryUrls: theme.gallery.map((name) => photos[name]),
  };
  const pages = paginateGroups(groups, themed);
  const css = menuPdfCss(themed, fonts);
  const body = pages.map((page, index) => renderPage(page, index, pages.length, themed, restaurantName)).join("");
  return {
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="pdf-root">${body}</body></html>`,
    css,
    body,
    pageCount: pages.length,
  };
}
