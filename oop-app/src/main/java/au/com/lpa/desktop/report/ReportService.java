package au.com.lpa.desktop.report;

import au.com.lpa.desktop.algo.BinarySearch;
import au.com.lpa.desktop.repo.ProductRepository;
import au.com.lpa.desktop.service.ServiceException;
import au.com.lpa.desktop.service.Session;
import au.com.lpa.desktop.util.Clocks;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/** Reports and planning for the desktop app (permission reports.view). */
public class ReportService {

    private final ReportRepository reports;
    private final ProductRepository products;
    private final Session session;
    private final ReorderPlanner reorder = new ReorderPlanner(90, 30);
    private final DeliveryPlanner delivery = new DeliveryPlanner();

    public ReportService(ReportRepository reports, ProductRepository products, Session session) {
        this.reports = reports;
        this.products = products;
        this.session = session;
    }

    public List<ReorderPlanner.Suggestion> reorderPlan(int limit) throws SQLException, ServiceException {
        session.require("reports.view");
        LocalDate today = Clocks.today();
        return reorder.plan(products.findAll(), reports.salesBySku(reorder.since(today), today), limit);
    }

    public SalesReport.Result sales(LocalDate from, LocalDate to) throws SQLException, ServiceException {
        session.require("reports.view");
        if (from.isAfter(to)) throw new ServiceException("The 'from' date must be on or before the 'to' date.");
        return SalesReport.build(reports.invoicesByDate(), reports.salesBySku(from, to), from, to);
    }

    public DeliveryPlanner.Route deliveryRoute(List<ReportRepository.InvoiceRow> invoices) throws ServiceException {
        session.require("reports.view");
        return delivery.plan(invoices);
    }

    public List<ReportRepository.InvoiceRow> invoicesBetween(LocalDate from, LocalDate to) throws SQLException, ServiceException {
        session.require("reports.view");
        return List.copyOf(BinarySearch.range(reports.invoicesByDate(), from, to, ReportRepository.InvoiceRow::date, Comparator.naturalOrder()));
    }
}
