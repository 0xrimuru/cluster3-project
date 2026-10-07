package au.com.lpa.desktop.ui;

import javax.swing.BorderFactory;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.SwingConstants;
import java.awt.Color;
import java.awt.Component;
import java.awt.Font;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Image;
import java.awt.Insets;
import java.awt.event.ActionListener;
import java.math.BigDecimal;
import java.net.URL;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

/** Small helpers shared by every screen (colours, buttons, form rows, messages). */
public final class Ui {

    public static final Color BRAND = new Color(0x0E8A5F);
    public static final Color BRAND_DARK = new Color(0x0A6B49);
    public static final Color DANGER = new Color(0xB3362E);
    public static final Color WARN = new Color(0xB06A00);
    private static final NumberFormat MONEY = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-AU"));

    private Ui() { }

    public static String money(BigDecimal v) { return v == null ? "" : MONEY.format(v); }

    public static JButton button(String text, ActionListener action) {
        JButton b = new JButton(text);
        b.addActionListener(action);
        return b;
    }

    public static JButton primary(String text, ActionListener action) {
        JButton b = button(text, action);
        b.putClientProperty("JButton.buttonType", "default");
        b.setBackground(BRAND);
        b.setForeground(Color.WHITE);
        return b;
    }

    public static JButton danger(String text, ActionListener action) {
        JButton b = button(text, action);
        b.setForeground(DANGER);
        return b;
    }

    public static JLabel title(String text) {
        JLabel l = new JLabel(text);
        l.setFont(l.getFont().deriveFont(Font.BOLD, 20f));
        l.setForeground(BRAND_DARK);
        return l;
    }

    /** A two-column form (label | field) built with GridBagLayout. */
    public static final class Form extends JPanel {
        private int row;

        public Form() {
            super(new GridBagLayout());
            setOpaque(false);
        }

        public Form add(String label, JComponent field) {
            GridBagConstraints l = new GridBagConstraints();
            l.gridx = 0; l.gridy = row; l.anchor = GridBagConstraints.LINE_END; l.insets = new Insets(4, 0, 4, 8);
            JLabel lbl = new JLabel(label);
            lbl.setLabelFor(field);
            super.add(lbl, l);
            GridBagConstraints f = new GridBagConstraints();
            f.gridx = 1; f.gridy = row++; f.weightx = 1; f.fill = GridBagConstraints.HORIZONTAL; f.insets = new Insets(4, 0, 4, 0);
            super.add(field, f);
            return this;
        }

        public Form full(JComponent c) {
            GridBagConstraints f = new GridBagConstraints();
            f.gridx = 0; f.gridy = row++; f.gridwidth = 2; f.weightx = 1; f.fill = GridBagConstraints.HORIZONTAL; f.insets = new Insets(8, 0, 4, 0);
            super.add(c, f);
            return this;
        }

        /** Pushes the rows to the top. */
        public Form end() {
            GridBagConstraints f = new GridBagConstraints();
            f.gridx = 0; f.gridy = row++; f.weighty = 1;
            super.add(new JLabel(), f);
            return this;
        }
    }

    public static JPanel card(JComponent content, String heading) {
        JPanel p = new JPanel(new java.awt.BorderLayout(0, 8));
        p.setBorder(BorderFactory.createCompoundBorder(BorderFactory.createLineBorder(new Color(0xD8DFDB)), BorderFactory.createEmptyBorder(12, 14, 12, 14)));
        if (heading != null) {
            JLabel h = new JLabel(heading);
            h.setFont(h.getFont().deriveFont(Font.BOLD, 14f));
            p.add(h, java.awt.BorderLayout.NORTH);
        }
        p.add(content, java.awt.BorderLayout.CENTER);
        return p;
    }

    public static void errors(Component parent, String title, List<String> messages) {
        StringBuilder sb = new StringBuilder("<html><body style='width:320px'>");
        for (String m : messages) sb.append("&bull; ").append(escape(m)).append("<br>");
        JOptionPane.showMessageDialog(parent, sb.append("</body></html>").toString(), title, JOptionPane.WARNING_MESSAGE);
    }

    public static void info(Component parent, String message) {
        JOptionPane.showMessageDialog(parent, message, "LPA", JOptionPane.INFORMATION_MESSAGE);
    }

    public static boolean confirm(Component parent, String message) {
        return JOptionPane.showConfirmDialog(parent, message, "Please confirm", JOptionPane.OK_CANCEL_OPTION, JOptionPane.QUESTION_MESSAGE) == JOptionPane.OK_OPTION;
    }

    public static String escape(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    /** Product picture from the jar (same images as the web store). */
    public static ImageIcon productImage(String webPath, int size) {
        String name = webPath == null ? "" : webPath.substring(webPath.lastIndexOf('/') + 1);
        URL url = Ui.class.getResource("/images/products/" + name);
        if (url == null) url = Ui.class.getResource("/images/products/placeholder.png");
        if (url == null) return null;
        Image img = new ImageIcon(url).getImage().getScaledInstance(size, size, Image.SCALE_SMOOTH);
        return new ImageIcon(img);
    }

    public static JLabel badge(String text, Color colour) {
        JLabel l = new JLabel(text, SwingConstants.CENTER);
        l.setOpaque(true);
        l.setBackground(new Color(colour.getRed(), colour.getGreen(), colour.getBlue(), 40));
        l.setForeground(colour.darker());
        l.setBorder(BorderFactory.createEmptyBorder(2, 8, 2, 8));
        l.setFont(l.getFont().deriveFont(Font.BOLD, 11f));
        return l;
    }
}
