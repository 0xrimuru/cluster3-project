package au.com.lpa.desktop.util;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** LPA records local Brisbane time, whatever time zone the computer is set to. */
public final class Clocks {
    public static final ZoneId LPA = ZoneId.of("Australia/Brisbane");
    private static Clock clock = Clock.system(LPA);
    private Clocks() { }
    public static LocalDateTime nowBrisbane() { return LocalDateTime.now(clock).withNano(0); }
    public static LocalDate today() { return LocalDate.now(clock); }
    /** Tests only: fix "now", so reports over "the last 90 days" give the same result on any day. */
    public static void useClock(Clock c) { clock = c.withZone(LPA); }
}
