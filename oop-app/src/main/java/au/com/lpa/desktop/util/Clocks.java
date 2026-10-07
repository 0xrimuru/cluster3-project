package au.com.lpa.desktop.util;

import java.time.LocalDateTime;
import java.time.ZoneId;

/** LPA records local Brisbane time, whatever time zone the computer is set to. */
public final class Clocks {
    public static final ZoneId LPA = ZoneId.of("Australia/Brisbane");
    private Clocks() { }
    public static LocalDateTime nowBrisbane() { return LocalDateTime.now(LPA).withNano(0); }
}
