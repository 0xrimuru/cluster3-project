package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;
import au.com.lpa.desktop.model.Client;
import au.com.lpa.desktop.model.RecordStatus;

import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JTextField;
import java.util.List;

/** Clients: search (name, ID, address or exact phone number), add, edit, disable. */
public class ClientPanel extends CrudPanel<Client> {

    private final JLabel code = new JLabel();
    private final JTextField first = new JTextField();
    private final JTextField last = new JTextField();
    private final JTextField address = new JTextField();
    private final JTextField phone = new JTextField();
    private final JComboBox<RecordStatus> status = new JComboBox<>(new RecordStatus[]{RecordStatus.ACTIVE, RecordStatus.DISABLED});

    public ClientPanel(Services app, MainFrame frame) {
        super(app, frame, "Clients", new BeanTableModel<>(
                new BeanTableModel.Column<Client>("Client ID", String.class, Client::getId),
                new BeanTableModel.Column<Client>("Name", String.class, Client::fullName),
                new BeanTableModel.Column<Client>("Phone", String.class, Client::getPhone),
                new BeanTableModel.Column<Client>("Status", String.class, c -> c.getStatus().label())));
        formHolder.add(new Ui.Form().add("Client ID:", code).add("First Name:", first).add("Last Name:", last)
                .add("Address:", address).add("Phone:", phone).add("Status:", status)
                .full(new JLabel("<html><small>Phone numbers are stored encrypted (AES-256-GCM).</small></html>")).end(), java.awt.BorderLayout.CENTER);
    }

    @Override public String key() { return "clients"; }
    @Override protected boolean canEdit() { return app.session.can("sales.create"); }
    @Override protected String deleteLabel() { return "Disable"; }
    @Override protected Client blank() { return new Client(); }

    @Override
    protected void fill(Client c) {
        code.setText(c.isNew() ? "(new - next CL number)" : c.getId());
        first.setText(c.getFirstName());
        last.setText(c.getLastName());
        address.setText(c.getAddress());
        phone.setText(c.getPhone());
        status.setSelectedItem(c.getStatus() == RecordStatus.DISABLED ? RecordStatus.DISABLED : RecordStatus.ACTIVE);
        boolean edit = canEdit();
        for (var f : new java.awt.Component[]{first, last, address, phone, status}) f.setEnabled(edit);
    }

    @Override
    protected Client read() {
        Client c = new Client();
        if (current != null && !current.isNew()) c.setId(current.getId());
        c.setFirstName(first.getText());
        c.setLastName(last.getText());
        c.setAddress(address.getText());
        c.setPhone(phone.getText());
        c.setStatus((RecordStatus) status.getSelectedItem());
        return c;
    }

    @Override protected List<Client> load(String q) throws Exception { return app.clients.search(q); }
    @Override protected Client store(Client c) throws Exception { return app.clients.save(c); }
    @Override protected void remove(Client c) throws Exception { app.clients.disable(c.getId()); }
}
