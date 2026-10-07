package au.com.lpa.desktop.service;

import au.com.lpa.desktop.model.Client;
import au.com.lpa.desktop.repo.ClientRepository;

import java.sql.SQLException;
import java.util.List;

/** Client records. Staff can view; administrators add, edit and disable (same as users.manage). */
public class ClientService {

    private final ClientRepository clients;
    private final Session session;

    public ClientService(ClientRepository clients, Session session) {
        this.clients = clients;
        this.session = session;
    }

    public List<Client> search(String text) throws SQLException, ServiceException {
        session.require("clients.view");
        return clients.search(text);
    }

    public Client save(Client c) throws SQLException, ServiceException {
        session.require("sales.create"); // administrators keep the client list (they create invoices for them)
        List<String> errors = c.validate();
        if (!errors.isEmpty()) throw new ServiceException(errors);
        return clients.save(c);
    }

    public void disable(String code) throws SQLException, ServiceException {
        session.require("sales.create");
        if (!clients.delete(code)) throw new ServiceException("Client not found or already disabled.");
    }
}
