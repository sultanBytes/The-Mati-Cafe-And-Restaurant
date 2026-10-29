import { jsPDF } from "jspdf";
import { formatItemPrice } from "./format.js";
import { getPublicCategories, getPublicItems, groupItemsByCategory } from "./menuVisibility.js";
import { withBase } from "./urls.js";

const A4_W = 210;
const A4_H = 297;

async function loadImage(path) {
  const response = await fetch(withBase(path), { cache: "no-store" });
  if (!response.ok) throw new Error("The QR artwork could not be loaded.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The QR artwork could not be read."));
    reader.readAsDataURL(blob);
  });
}

export function qrSheetLayout(sizeCm) {
  const size = Number(sizeCm);
  const qrMm = Math.min(120, Math.max(20, size * 10));
  const gap = Math.max(3, Math.min(6, qrMm * 0.08));
  const margin = 8;
  const usableW = A4_W - margin * 2;
  const usableH = A4_H - margin * 2;
  const cols = Math.max(1, Math.floor((usableW + gap) / (qrMm + gap)));
  const rows = Math.max(1, Math.floor((usableH + gap) / (qrMm + gap)));
  return { sizeCm: size, qrMm, gap, margin, cols, rows, count: cols * rows };
}

export async function downloadQrSheetPdf({ sizeCm, restaurantName }) {
  const layout = qrSheetLayout(sizeCm);
  const image = await loadImage("/images/branding/tmc-table-qr.png");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const gridW = layout.cols * layout.qrMm + (layout.cols - 1) * layout.gap;
  const gridH = layout.rows * layout.qrMm + (layout.rows - 1) * layout.gap;
  const startX = (A4_W - gridW) / 2;
  const startY = (A4_H - gridH) / 2;

  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      const x = startX + col * (layout.qrMm + layout.gap);
      const y = startY + row * (layout.qrMm + layout.gap);
      pdf.addImage(image, "PNG", x, y, layout.qrMm, layout.qrMm, undefined, "FAST");
    }
  }

  pdf.setFontSize(8);
  pdf.setTextColor(28, 28, 24);
  pdf.text(`${restaurantName || "The Maati Cafe & Restaurant"} · ${layout.sizeCm} cm · ${layout.count} codes`, A4_W / 2, A4_H - 5, {
    align: "center",
  });
  pdf.save(`maati-qr-${layout.sizeCm}cm.pdf`);
  return layout;
}

export function downloadMenuPdf(menu, { includeHidden = false } = {}) {
  const restaurant = menu.restaurant || {};
  const items = includeHidden ? menu.items || [] : getPublicItems(menu);
  const categories = includeHidden
    ? [...(menu.categories || [])].sort((a, b) => a.sortOrder - b.sortOrder)
    : getPublicCategories(menu);
  const grouped = includeHidden
    ? categories
        .map((category) => ({
          category,
          items: items.filter((item) => item.categoryId === category.id),
        }))
        .filter((group) => group.items.length)
    : groupItemsByCategory(menu, items);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 10;
  const gutter = 8;
  const colW = (A4_W - margin * 2 - gutter) / 2;
  const bottom = A4_H - 12;
  let page = 1;

  function header() {
    pdf.setFillColor(153, 65, 38);
    pdf.rect(0, 0, A4_W, 16, "F");
    pdf.setTextColor(253, 249, 243);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(restaurant.name || "The Maati Cafe & Restaurant", margin, 10);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("Vegetarian cafe menu · prices in INR", A4_W - margin, 10, { align: "right" });
  }

  function footer() {
    pdf.setTextColor(120, 110, 100);
    pdf.setFontSize(8);
    pdf.text(restaurant.footerText || "Ask your server to place your order.", margin, A4_H - 6);
    pdf.text(`Page ${page}`, A4_W - margin, A4_H - 6, { align: "right" });
  }

  header();
  footer();

  let col = 0;
  let y = 22;

  function ensureSpace(height) {
    if (y + height <= bottom) return;
    col += 1;
    y = 22;
    if (col > 1) {
      page += 1;
      pdf.addPage();
      header();
      footer();
      col = 0;
      y = 22;
    }
  }

  function xForCol() {
    return margin + col * (colW + gutter);
  }

  for (const group of grouped) {
    ensureSpace(10);
    pdf.setTextColor(153, 65, 38);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    const title = pdf.splitTextToSize(group.category.name, colW);
    pdf.text(title, xForCol(), y);
    y += title.length * 5 + 1;

    for (const item of group.items) {
      const nameLines = pdf.splitTextToSize(item.name, colW - 22);
      const desc = item.description ? pdf.splitTextToSize(item.description, colW).slice(0, 2) : [];
      const combo = (item.comboItems || []).map((entry) => entry.name).filter(Boolean);
      const comboLines = combo.length ? pdf.splitTextToSize(`Includes: ${combo.join(", ")}`, colW) : [];
      const block = 4 + nameLines.length * 4 + desc.length * 3.4 + comboLines.length * 3.4 + 3;
      ensureSpace(block);
      const x = xForCol();
      pdf.setTextColor(28, 28, 24);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(nameLines, x, y);
      pdf.setTextColor(153, 65, 38);
      pdf.setFontSize(8);
      pdf.text(formatItemPrice(item, restaurant.currency), x + colW, y, { align: "right" });
      y += nameLines.length * 4;
      if (desc.length) {
        pdf.setTextColor(90, 86, 80);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.text(desc, x, y);
        y += desc.length * 3.4;
      }
      if (comboLines.length) {
        pdf.setTextColor(61, 107, 79);
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(7);
        pdf.text(comboLines, x, y);
        y += comboLines.length * 3.4;
      }
      y += 2.5;
    }
    y += 3;
  }

  pdf.save("maati-menu.pdf");
}
