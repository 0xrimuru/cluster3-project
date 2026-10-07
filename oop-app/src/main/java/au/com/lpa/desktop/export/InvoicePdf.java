package au.com.lpa.desktop.export;

import au.com.lpa.desktop.model.Invoice;
import au.com.lpa.desktop.model.InvoiceLine;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;

import java.awt.Color;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Saves an invoice as a PDF (tax invoice layout) with the OpenPDF library (third party). */
public final class InvoicePdf {

    private static final Color BRAND = new Color(0x0A, 0x6B, 0x49);
    private static final NumberFormat MONEY = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-AU"));

    private InvoicePdf() { }

    public static void write(Invoice inv, Path file) throws IOException {
        try (OutputStream out = Files.newOutputStream(file)) {
            write(inv, out);
        }
    }

    public static void write(Invoice inv, OutputStream out) throws IOException {
        Document doc = new Document(PageSize.A4, 48, 48, 48, 48);
        try {
            PdfWriter.getInstance(doc, out);
            doc.addTitle("Tax invoice " + inv.getId());
            doc.addAuthor("Logic Peripherals Australia");
            doc.open();
            Font h1 = new Font(Font.HELVETICA, 22, Font.BOLD, BRAND);
            Font bold = new Font(Font.HELVETICA, 10, Font.BOLD);
            Font normal = new Font(Font.HELVETICA, 10);
            Font small = new Font(Font.HELVETICA, 8, Font.NORMAL, Color.GRAY);

            doc.add(new Paragraph("LPA", h1));
            doc.add(new Paragraph("Logic Peripherals Australia - 123 Queen St, Brisbane City QLD 4000 - (07) 3000 1234", small));
            Paragraph title = new Paragraph("TAX INVOICE " + inv.getId(), new Font(Font.HELVETICA, 14, Font.BOLD));
            title.setSpacingBefore(18);
            doc.add(title);
            doc.add(new Paragraph("Date: " + inv.getDate().format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.forLanguageTag("en-AU"))), normal));
            Paragraph bill = new Paragraph("Bill to: " + inv.getClientName() + " (" + inv.getClientId() + ")\n" + inv.getClientAddress() + "\nPayment: " + inv.getPayment(), normal);
            bill.setSpacingBefore(8);
            bill.setSpacingAfter(14);
            doc.add(bill);

            PdfPTable t = new PdfPTable(new float[]{1.3f, 4f, 0.8f, 1.3f, 1.4f});
            t.setWidthPercentage(100);
            for (String h : new String[]{"Stock ID", "Item", "Qty", "Price", "Amount"}) {
                PdfPCell c = new PdfPCell(new Phrase(h, new Font(Font.HELVETICA, 10, Font.BOLD, Color.WHITE)));
                c.setBackgroundColor(BRAND);
                c.setPadding(5);
                t.addCell(c);
            }
            for (InvoiceLine l : inv.getLines()) {
                t.addCell(cell(l.sku(), normal, Element.ALIGN_LEFT));
                t.addCell(cell(l.name(), normal, Element.ALIGN_LEFT));
                t.addCell(cell(String.valueOf(l.qty()), normal, Element.ALIGN_RIGHT));
                t.addCell(cell(MONEY.format(l.price()), normal, Element.ALIGN_RIGHT));
                t.addCell(cell(MONEY.format(l.amount()), normal, Element.ALIGN_RIGHT));
            }
            PdfPCell label = cell("Total (incl. GST " + MONEY.format(inv.gst()) + ")", bold, Element.ALIGN_RIGHT);
            label.setColspan(4);
            t.addCell(label);
            t.addCell(cell(MONEY.format(inv.total()), bold, Element.ALIGN_RIGHT));
            doc.add(t);

            Paragraph thanks = new Paragraph("Prices include GST. Thank you for your business.", small);
            thanks.setSpacingBefore(18);
            doc.add(thanks);
        } catch (DocumentException e) {
            throw new IOException("PDF could not be created: " + e.getMessage(), e);
        } finally {
            if (doc.isOpen()) doc.close();
        }
    }

    private static PdfPCell cell(String text, Font font, int align) {
        PdfPCell c = new PdfPCell(new Phrase(text, font));
        c.setHorizontalAlignment(align);
        c.setPadding(5);
        return c;
    }
}
