import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { ServiceBook, ServiceBookEntry } from './service-record.service';

const FONT = 'helvetica';
const MARGIN = 12;
const TABLE_WIDTH = 186;
const LINE_HEIGHT = 3.6;
const HEADER_HEIGHT = 26;
const TABLE_HEADER_HEIGHT = 7;
const BOTTOM_SPACE = 18;

// Oszlopok helye a táblázaton belül (mm)
const COLUMN = {
  date: { x: 2, width: 24 },
  work: { x: 28, width: 68 },
  provider: { x: 98, width: 30 },
  total: { x: 150 },
  recorded: { x: 153, width: 32 }
};

interface Line {
  text: string;
  bold?: boolean;
}

// Egy táblázatsor oszloponként, már tördelve
interface Row {
  date: Line[];
  work: Line[];
  provider: string[];
  total: string;
  recorded: Line[];
  height: number;
}

// A szervizkönyv a böngészőben készül, a jsPDF csak gombnyomásra töltődik be.
@Injectable({ providedIn: 'root' })
export class ServiceBookPdfService {
  async generate(book: ServiceBook, unit: string) {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    this.buildPdf(doc, book, unit);
    doc.save(`szervizkonyv_${book.vehicle.licensePlate}.pdf`);
  }

  // A helvetica nem ismeri az ő és ű betűt (Q és q lenne belőlük), ezért ö és ü kerül a helyükre.
  // Ami a betűkészletben sincs meg, az ? lesz, hogy ne jelenjen meg helyette rossz betű.
  private clean(text: string) {
    return text.replace(/ő/g, 'ö').replace(/ű/g, 'ü').replace(/Ő/g, 'Ö').replace(/Ű/g, 'Ü')
      .replace(/[^\x00-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu, '?');
  }

  private buildPdf(doc: jsPDF, book: ServiceBook, unit: string) {
    const bottom = doc.internal.pageSize.getHeight() - BOTTOM_SPACE;
    let y = MARGIN;

    this.drawPageHeader(doc, book, y);
    y += HEADER_HEIGHT;
    y = this.drawVehicle(doc, book, y);
    y = this.drawSummary(doc, book, y);

    this.drawTableHeader(doc, y);
    y += TABLE_HEADER_HEIGHT;

    book.entries.forEach(entry => {
      const row = this.buildRow(doc, entry, unit);

      if (y + row.height > bottom) {
        doc.addPage();
        y = MARGIN;

        this.drawPageHeader(doc, book, y);
        y += HEADER_HEIGHT;

        this.drawTableHeader(doc, y);
        y += TABLE_HEADER_HEIGHT;
      }

      this.drawRow(doc, y, row);
      y += row.height;
    });

    this.drawFooters(doc);
  }

  private drawPageHeader(doc: jsPDF, book: ServiceBook, y: number) {
    const { licensePlate, make, model } = book.vehicle;

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(MARGIN, y, TABLE_WIDTH, 22, 2, 2, 'F');
    doc.setTextColor(20);

    doc.setFont(FONT, 'bold');
    doc.setFontSize(16);
    doc.text('Szervizkönyv', MARGIN + 4, y + 9);

    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.text(this.clean(`${licensePlate} · ${make} ${model}`), MARGIN + 4, y + 17);
    doc.text(`Készült: ${this.dateTime(book.generatedAt)}`, MARGIN + TABLE_WIDTH - 4, y + 17, { align: 'right' });
  }

  private drawVehicle(doc: jsPDF, book: ServiceBook, y: number) {
    const vehicle = book.vehicle;
    const fields = [
      { label: 'Rendszám', value: vehicle.licensePlate },
      { label: 'Alvázszám', value: vehicle.vin ?? '-' },
      { label: 'Márka és modell', value: `${vehicle.make} ${vehicle.model}` },
      { label: 'Évjárat', value: vehicle.year?.toString() ?? '-' },
      { label: 'Üzemanyag', value: vehicle.fuelType },
      { label: 'Aktuális óraállás', value: `${this.number(vehicle.currentKm)} km` }
    ];

    // Három oszlop, két sor
    fields.forEach((field, index) => {
      const x = MARGIN + 2 + (index % 3) * 62;
      const rowY = y + 4 + Math.floor(index / 3) * 10;

      doc.setFont(FONT, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(field.label, x, rowY);

      doc.setFont(FONT, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20);
      doc.text(this.clean(field.value), x, rowY + 4);
    });

    return y + 24;
  }

  private drawSummary(doc: jsPDF, book: ServiceBook, y: number) {
    const entries = book.entries;
    const late = entries.filter(e => e.isLate).length;
    const edited = entries.filter(e => e.updatedAt).length;

    doc.setFont(FONT, 'bold');
    doc.setFontSize(9);
    doc.text(`Bejegyzések: ${entries.length}   Utólag rögzítve: ${late}   Módosítva: ${edited}   Naplózott törlés: ${book.deletedCount}`, MARGIN + 2, y);

    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text('Utólag rögzített: a szerviz dátuma után több mint 7 nappal felvitt bejegyzés.', MARGIN + 2, y + 4.5);
    doc.setTextColor(20);

    return y + 9;
  }

  private drawTableHeader(doc: jsPDF, y: number) {
    doc.setFillColor(230, 230, 230);
    doc.rect(MARGIN, y, TABLE_WIDTH, TABLE_HEADER_HEIGHT, 'F');

    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    doc.text('Dátum / óraállás', MARGIN + COLUMN.date.x, y + 4.7);
    doc.text('Elvégzett munka', MARGIN + COLUMN.work.x, y + 4.7);
    doc.text('Helyszín', MARGIN + COLUMN.provider.x, y + 4.7);
    doc.text('Összeg', MARGIN + COLUMN.total.x, y + 4.7, { align: 'right' });
    doc.text('Rögzítve', MARGIN + COLUMN.recorded.x, y + 4.7);
  }

  // Hosszú szövegnél nem vágunk le semmit, a sor magasabb lesz.
  private buildRow(doc: jsPDF, entry: ServiceBookEntry, unit: string): Row {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);

    const wrap = (text: string, width: number): string[] => doc.splitTextToSize(this.clean(text), width);
    const items = entry.items.flatMap(item => wrap(`${item.categoryName}: ${this.number(item.amount)} ${unit}`, COLUMN.work.width));
    const description = entry.description ? wrap(entry.description.replace(/\s+/g, ' '), COLUMN.work.width) : [];

    const recorded: Line[] = [{ text: this.dateTime(entry.createdAt) }, { text: this.timing(entry) }];
    if (entry.isLate) recorded.push({ text: 'Utólag rögzítve', bold: true });
    if (entry.updatedAt) recorded.push({ text: `Módosítva: ${this.dateTime(entry.updatedAt).slice(0, 10)}` });

    const row: Row = {
      date: [{ text: entry.date, bold: true }, { text: `${this.number(entry.odometerKm)} km` }],
      work: [...items.map(text => ({ text })), ...description.map(text => ({ text }))],
      provider: wrap(entry.provider ?? '-', COLUMN.provider.width),
      total: `${this.number(entry.total)} ${unit}`,
      recorded,
      height: 0
    };

    const lineCount = Math.max(row.date.length, row.work.length, row.provider.length, row.recorded.length);
    row.height = lineCount * LINE_HEIGHT + 3;
    return row;
  }

  private drawRow(doc: jsPDF, y: number, row: Row) {
    doc.setDrawColor(220);
    doc.rect(MARGIN, y, TABLE_WIDTH, row.height);

    const textY = y + 4.2;
    doc.setFontSize(8);

    this.drawLines(doc, row.date, MARGIN + COLUMN.date.x, textY);
    this.drawLines(doc, row.work, MARGIN + COLUMN.work.x, textY);
    this.drawLines(doc, row.provider.map(text => ({ text })), MARGIN + COLUMN.provider.x, textY);
    this.drawLines(doc, row.recorded, MARGIN + COLUMN.recorded.x, textY);

    doc.setFont(FONT, 'normal');
    doc.text(row.total, MARGIN + COLUMN.total.x, textY, { align: 'right' });
  }

  private drawLines(doc: jsPDF, lines: Line[], x: number, y: number) {
    lines.forEach((line, index) => {
      doc.setFont(FONT, line.bold ? 'bold' : 'normal');
      doc.text(line.text, x, y + index * LINE_HEIGHT);
    });
  }

  // Az oldalszámhoz már kell az összes oldal, ezért ez készül el utoljára.
  private drawFooters(doc: jsPDF) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont(FONT, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text('A rögzítés idejét a szerver állítja be, a felhasználó nem adhatja meg és nem írhatja át.', pageWidth / 2, pageHeight - 11, { align: 'center' });
      doc.text(`${i} / ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
      doc.setTextColor(0);
    }
  }

  private timing(entry: ServiceBookEntry) {
    if (entry.daysLate > 0) return `${entry.daysLate} nappal a szerviz után`;
    return entry.daysLate < 0 ? 'Korábban rögzítve' : 'A szerviz napján';
  }

  private dateTime(value: string) {
    return new Date(value).toLocaleString('sv-SE', { timeZone: 'Europe/Budapest', dateStyle: 'short', timeStyle: 'short' });
  }

  private number(value: number) {
    return value.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
  }
}
