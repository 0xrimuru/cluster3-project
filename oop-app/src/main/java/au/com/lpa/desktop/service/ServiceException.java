package au.com.lpa.desktop.service;

import java.util.List;

/** A business rule was broken - the messages are shown to the user. */
public class ServiceException extends Exception {
    private final List<String> messages;

    public ServiceException(List<String> messages) {
        super(String.join(" ", messages));
        this.messages = List.copyOf(messages);
    }

    public ServiceException(String message) { this(List.of(message)); }

    public List<String> messages() { return messages; }
}
