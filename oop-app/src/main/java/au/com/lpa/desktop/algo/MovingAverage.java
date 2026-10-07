package au.com.lpa.desktop.algo;

import java.util.ArrayDeque;
import java.util.Deque;

/**
 * Sliding-window average with a queue (deque): each new value is O(1) - add it at the back,
 * drop the oldest from the front when the window is full, keep a running sum.
 * Used for the sales trend line (average of the last N months).
 */
public class MovingAverage {

    private final int window;
    private final Deque<Double> values = new ArrayDeque<>();
    private double sum;

    public MovingAverage(int window) {
        if (window < 1) throw new IllegalArgumentException("window must be at least 1");
        this.window = window;
    }

    public double add(double value) {
        values.addLast(value);
        sum += value;
        if (values.size() > window) sum -= values.removeFirst();
        return average();
    }

    public double average() { return values.isEmpty() ? 0 : sum / values.size(); }
    public int count() { return values.size(); }
}
