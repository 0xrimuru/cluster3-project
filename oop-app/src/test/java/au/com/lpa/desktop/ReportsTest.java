package au.com.lpa.desktop;

import au.com.lpa.desktop.export.CsvExport;
import au.com.lpa.desktop.export.InvoicePdf;
import au.com.lpa.desktop.model.Invoice;
import au.com.lpa.desktop.model.InvoiceLine;
import au.com.lpa.desktop.model.Product;
import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.report.DeliveryPlanner;
import au.com.lpa.desktop.report.ReorderPlanner;
import au.com.lpa.desktop.report.ReportRepository.InvoiceRow;
import au.com.lpa.desktop.report.ReportRepository.ItemSales;
import au.com.lpa.desktop.report.SalesReport;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Reports, planning and the third-party library features, with fixed test data (no database). */
class ReportsTest {

    static Product p(String id, int onHand) {
        Product p = new Product();
        p.setId(id); p.setName("Item " + id); p.setBrand("B"); p.setOnHand(onHand); p.setPrice(BigDecimal.TEN);
        return p;
    }

    @Test @DisplayName("R-01 Reorder planner: out of stock and selling, then under 30 days of cover, then out of stock, then the rest")
    void reorder() {
        Product disabled = p("D", 0); disabled.setStatus(RecordStatus.DISABLED);
        List<Product> products = List.of(p("A", 20), p("B", 2), p("C", 0), p("E", 0), p("F", 100), disabled);
        Map<String, ItemSales> sales = Map.of(
                "A", new ItemSales("A", "A", 45, BigDecimal.ONE),   // 0.5/day -> 40 days
                "B", new ItemSales("B", "B", 9, BigDecimal.ONE),    // 0.1/day -> 20 days
                "C", new ItemSales("C", "C", 18, BigDecimal.ONE),   // out of stock and selling
                "D", new ItemSales("D", "D", 90, BigDecimal.ONE));  // disabled - ignored
        List<ReorderPlanner.Suggestion> plan = new ReorderPlanner(90, 30).plan(products, sales, 4);
        assertEquals(List.of("C", "B", "E", "A"), plan.stream().map(s -> s.product().getId()).toList()); // selling+out, 20 days, out, 40 days
        assertEquals(6, plan.get(0).suggestedQty());   // 0.2/day x 30 = 6
        assertEquals(1, plan.get(1).suggestedQty());   // 3 needed - 2 on hand
        assertEquals("Out of stock and selling", plan.get(0).reason());
        assertEquals(20, plan.get(1).daysOfCover(), 1e-9);
    }

    static InvoiceRow row(String no, String date, String amount, String address) {
        return new InvoiceRow(no, LocalDate.parse(date), "CL-1", "Client " + no, address, new BigDecimal(amount));
    }

    @Test @DisplayName("R-02 Sales report: date range by binary search, months with zero, moving average, best sellers")
    void sales() {
        List<InvoiceRow> rows = List.of(row("1", "2026-06-30", "10", ""), row("2", "2026-07-01", "100", ""), row("3", "2026-07-15", "50", ""),
                row("4", "2026-09-02", "30", ""), row("5", "2026-10-01", "999", ""));
        Map<String, ItemSales> items = Map.of("X", new ItemSales("X", "x", 1, new BigDecimal("50")), "Y", new ItemSales("Y", "y", 9, new BigDecimal("80")),
                "Z", new ItemSales("Z", "z", 2, new BigDecimal("50")));
        SalesReport.Result r = SalesReport.build(rows, items, LocalDate.parse("2026-07-01"), LocalDate.parse("2026-09-30"));
        assertEquals(List.of("2", "3", "4"), r.invoices().stream().map(InvoiceRow::number).toList());
        assertEquals(new BigDecimal("180"), r.total());
        assertEquals(List.of(YearMonth.of(2026, 7), YearMonth.of(2026, 8), YearMonth.of(2026, 9)), r.months().stream().map(SalesReport.Month::month).toList());
        assertEquals(BigDecimal.ZERO, r.months().get(1).total());
        assertEquals(60.0, r.months().get(2).movingAverage(), 1e-9); // (150 + 0 + 30) / 3
        assertEquals(List.of("Y", "X", "Z"), r.topItems().stream().map(ItemSales::sku).toList()); // ties by Stock ID
    }

    @Test @DisplayName("R-03 Delivery planner: suburbs read from addresses, route starts/ends at the warehouse")
    void delivery() {
        assertEquals("Brisbane City", DeliveryPlanner.suburbOf("88 Ann St, Brisbane City QLD 4000"));
        assertEquals("Indooroopilly", DeliveryPlanner.suburbOf("12 River Rd, Indooroopilly QLD 4068"));
        assertEquals("", DeliveryPlanner.suburbOf("Somewhere without a state"));
        DeliveryPlanner d = new DeliveryPlanner();
        DeliveryPlanner.Route r = d.plan(List.of(
                row("INV-1", "2026-10-01", "1", "12 River Rd, Indooroopilly QLD 4068"),
                row("INV-2", "2026-10-01", "1", "5 Ridge St, Northgate QLD 4013"),
                row("INV-3", "2026-10-01", "1", "7 Park Rd, Milton QLD 4064"),
                row("INV-4", "2026-10-01", "1", "45 George St, Sydney NSW 2000"),
                row("INV-5", "2026-10-01", "1", "88 Ann St, Brisbane City QLD 4000")));
        List<String> suburbs = r.stops().stream().map(DeliveryPlanner.Stop::suburb).toList();
        assertEquals("Brisbane City", suburbs.get(0));
        assertEquals("Brisbane City", suburbs.get(suburbs.size() - 1));
        assertTrue(suburbs.containsAll(List.of("Indooroopilly", "Northgate", "Milton")));
        int milton = suburbs.indexOf("Milton"), indro = suburbs.indexOf("Indooroopilly");
        assertEquals(1, Math.abs(milton - indro), "Milton and Indooroopilly are next to each other on the route: " + suburbs);
        assertEquals(1, r.notOnMap().size());
        assertTrue(r.km() <= r.greedyKm() + 1e-9);
        // by hand: City-Milton 3 + Milton-Indooroopilly 6.5 + Indooroopilly-Northgate 22.5 + Northgate-City 13 = 45 km
        assertEquals(45.0, r.km(), 1e-9, suburbs.toString());
    }

    @Test @DisplayName("R-04 CSV export (Commons CSV): commas and quotes are kept; Excel BOM; reads back the same")
    void csv() throws Exception {
        Path f = Files.createTempFile("lpa", ".csv");
        record Row(String a, int b) { }
        CsvExport.write(f, List.of(new Row("Docks, Hubs & \"Cables\"", 3), new Row("Plain", 4)),
                new CsvExport.Column<Row>("Name", Row::a), new CsvExport.Column<Row>("Qty", Row::b));
        String text = Files.readString(f, StandardCharsets.UTF_8);
        assertTrue(text.startsWith("﻿"));
        try (CSVParser p = CSVParser.parse(text.substring(1), CSVFormat.EXCEL.builder().setHeader().setSkipHeaderRecord(true).build())) {
            List<CSVRecord> recs = p.getRecords();
            assertEquals("Docks, Hubs & \"Cables\"", recs.get(0).get("Name"));
            assertEquals("4", recs.get(1).get("Qty"));
        }
        Files.delete(f);
    }

    @Test @DisplayName("R-05 Invoice PDF (OpenPDF): readable text with the number, client, lines and total")
    void pdf() throws Exception {
        Invoice inv = new Invoice();
        inv.setId("INV-9001"); inv.setDate(LocalDate.parse("2026-10-07")); inv.setClientId("CL-002"); inv.setClientName("DevWorks Pty Ltd");
        inv.setClientAddress("88 Ann St, Brisbane City QLD 4000");
        inv.addLine(new InvoiceLine("LPA-005", "1080p HD Webcam CV-10", 2, new BigDecimal("69.00")));
        Path f = Files.createTempFile("inv", ".pdf");
        InvoicePdf.write(inv, f);
        PdfReader reader = new PdfReader(f.toString());
        String text = new PdfTextExtractor(reader).getTextFromPage(1);
        reader.close();
        assertTrue(text.contains("TAX INVOICE INV-9001"), text);
        assertTrue(text.contains("DevWorks Pty Ltd"));
        assertTrue(text.contains("1080p HD Webcam CV-10"));
        assertTrue(text.contains("$138.00"));
        Files.delete(f);
    }
}
