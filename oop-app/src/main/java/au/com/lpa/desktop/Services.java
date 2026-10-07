package au.com.lpa.desktop;

import au.com.lpa.desktop.config.AppConfig;
import au.com.lpa.desktop.repo.ClientRepository;
import au.com.lpa.desktop.repo.InvoiceRepository;
import au.com.lpa.desktop.repo.LedgerRepository;
import au.com.lpa.desktop.repo.ProductRepository;
import au.com.lpa.desktop.repo.UserRepository;
import au.com.lpa.desktop.security.FieldCrypto;
import au.com.lpa.desktop.security.Policy;
import au.com.lpa.desktop.service.AuthService;
import au.com.lpa.desktop.service.ClientService;
import au.com.lpa.desktop.service.DashboardService;
import au.com.lpa.desktop.service.InvoiceService;
import au.com.lpa.desktop.service.Session;
import au.com.lpa.desktop.service.StockService;
import au.com.lpa.desktop.service.UserService;
import au.com.lpa.desktop.util.Db;

/** Builds every object once and wires them together (composition root / dependency injection by hand). */
public final class Services implements AutoCloseable {

    public final AppConfig config;
    public final Db db;
    public final Policy policy;
    public final Session session;
    public final AuthService auth;
    public final StockService stock;
    public final InvoiceService invoices;
    public final ClientService clients;
    public final UserService users;
    public final DashboardService dashboard;
    public final au.com.lpa.desktop.report.ReportService reports;
    public final au.com.lpa.desktop.service.LookupCache cache = new au.com.lpa.desktop.service.LookupCache();

    public Services(AppConfig config) {
        this.config = config;
        this.db = new Db(config);
        this.policy = Policy.load(config.projectRoot().orElse(null));
        this.session = new Session(policy);
        FieldCrypto crypto = new FieldCrypto(config.dataKey());
        ProductRepository productRepo = new ProductRepository(db);
        ClientRepository clientRepo = new ClientRepository(db, crypto);
        UserRepository userRepo = new UserRepository(db);
        InvoiceRepository invoiceRepo = new InvoiceRepository(db);
        LedgerRepository ledgerRepo = new LedgerRepository(db);
        this.auth = new AuthService(userRepo, session);
        this.stock = new StockService(db, productRepo, ledgerRepo, session, cache);
        this.invoices = new InvoiceService(db, invoiceRepo, clientRepo, productRepo, ledgerRepo, session, cache);
        this.clients = new ClientService(clientRepo, session, cache);
        this.reports = new au.com.lpa.desktop.report.ReportService(new au.com.lpa.desktop.report.ReportRepository(db), productRepo, session);
        this.users = new UserService(userRepo, session);
        this.dashboard = new DashboardService(db);
    }

    @Override public void close() { db.close(); }
}
