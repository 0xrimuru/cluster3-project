package au.com.lpa.desktop.ui;

import au.com.lpa.desktop.Services;

import javax.swing.BorderFactory;
import javax.swing.JPanel;
import java.awt.BorderLayout;

/**
 * Base class of every screen in the main window (inheritance): a title at the top, the screen's
 * own content in the middle, and a hook that runs each time the screen is shown.
 */
public abstract class BasePanel extends JPanel {

    protected final Services app;
    protected final MainFrame frame;

    protected BasePanel(Services app, MainFrame frame, String title) {
        super(new BorderLayout(0, 12));
        this.app = app;
        this.frame = frame;
        setBorder(BorderFactory.createEmptyBorder(16, 18, 16, 18));
        add(Ui.title(title), BorderLayout.NORTH);
    }

    /** Called every time the screen becomes visible (reload data, focus a field...). */
    public void onShow() { }

    /** Unique name used by the window's CardLayout. */
    public abstract String key();
}
