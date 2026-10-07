package au.com.lpa.desktop.export;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;

import java.io.IOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.function.Function;

/**
 * Writes any list as a CSV file (opens in Excel) with the Apache Commons CSV library (third party):
 * values with commas, quotes or line breaks are quoted correctly. A UTF-8 byte-order mark is
 * written first so Excel shows characters such as "&eacute;" properly.
 */
public final class CsvExport {

    /** One column: heading + how to get the value from a row. */
    public record Column<T>(String heading, Function<T, Object> value) { }

    private CsvExport() { }

    @SafeVarargs
    public static <T> void write(Path file, List<T> rows, Column<T>... columns) throws IOException {
        try (Writer w = Files.newBufferedWriter(file, StandardCharsets.UTF_8)) {
            w.write('﻿');
            String[] headings = new String[columns.length];
            for (int i = 0; i < columns.length; i++) headings[i] = columns[i].heading();
            try (CSVPrinter csv = new CSVPrinter(w, CSVFormat.EXCEL.builder().setHeader(headings).build())) {
                for (T row : rows) {
                    Object[] values = new Object[columns.length];
                    for (int i = 0; i < columns.length; i++) values[i] = columns[i].value().apply(row);
                    csv.printRecord(values);
                }
            }
        }
    }
}
