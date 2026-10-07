package au.com.lpa.desktop.report;

import au.com.lpa.desktop.algo.BinarySearch;
import au.com.lpa.desktop.algo.MovingAverage;
import au.com.lpa.desktop.algo.Sorts;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sales report for a date range: the invoices in the range (binary search on the date-sorted list),
 * totals per month with a 3-month moving average, and the best-selling items (stable merge sort).
 */
public final class SalesReport {

    public record Month(YearMonth month, BigDecimal total, double movingAverage) { }
    public record Result(LocalDate from, LocalDate to, List<ReportRepository.InvoiceRow> invoices, BigDecimal total,
                         List<Month> months, List<ReportRepository.ItemSales> topItems) { }

    private SalesReport() { }

    public static Result build(List<ReportRepository.InvoiceRow> byDate, Map<String, ReportRepository.ItemSales> itemSales, LocalDate from, LocalDate to) {
        List<ReportRepository.InvoiceRow> range = BinarySearch.range(byDate, from, to, ReportRepository.InvoiceRow::date, Comparator.naturalOrder());
        BigDecimal total = range.stream().map(ReportRepository.InvoiceRow::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<YearMonth, BigDecimal> perMonth = new LinkedHashMap<>();
        for (YearMonth m = YearMonth.from(from); !m.isAfter(YearMonth.from(to)); m = m.plusMonths(1)) perMonth.put(m, BigDecimal.ZERO);
        for (ReportRepository.InvoiceRow r : range) perMonth.merge(YearMonth.from(r.date()), r.amount(), BigDecimal::add);
        MovingAverage avg = new MovingAverage(3);
        List<Month> months = new ArrayList<>();
        perMonth.forEach((m, t) -> months.add(new Month(m, t, avg.add(t.doubleValue()))));
        List<ReportRepository.ItemSales> top = Sorts.mergeSort(new ArrayList<>(itemSales.values()),
                Comparator.comparing(ReportRepository.ItemSales::revenue).reversed().thenComparing(ReportRepository.ItemSales::sku));
        return new Result(from, to, List.copyOf(range), total, months, top);
    }
}
