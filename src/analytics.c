#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "../include/analytics.h"

// Helper function for sorting doubles (used in median calculation)
static int compare_doubles(const void* a, const void* b) {
    double da = *(const double*)a;
    double db = *(const double*)b;
    if (da < db) return -1;
    if (da > db) return 1;
    return 0;
}

ColumnStats calculate_column_stats_by_index(const DataFrame* df, int col_idx) {
    ColumnStats stats;
    memset(&stats, 0, sizeof(ColumnStats));

    if (!df || col_idx < 0 || col_idx >= df->col_count) {
        stats.is_valid = false;
        return stats;
    }

    strncpy(stats.col_name, df->headers[col_idx], sizeof(stats.col_name) - 1);

    if (!df->is_numeric[col_idx]) {
        // Count missing for string columns
        for (int r = 0; r < df->row_count; r++) {
            const char* val = df->data[r][col_idx];
            if (!val || strlen(val) == 0) {
                stats.missing_count++;
            } else {
                stats.count++;
            }
        }
        stats.is_valid = false;
        return stats;
    }

    // Allocate array to hold values for median calculation
    double* values = (double*)malloc(sizeof(double) * df->row_count);
    int val_count = 0;

    double sum = 0.0;
    double min_val = INFINITY;
    double max_val = -INFINITY;

    for (int r = 0; r < df->row_count; r++) {
        const char* val_str = df->data[r][col_idx];
        if (!val_str || strlen(val_str) == 0) {
            stats.missing_count++;
            continue;
        }

        char* endptr;
        double val = strtod(val_str, &endptr);
        
        // Ensure it's a valid conversion
        if (endptr != val_str) {
            sum += val;
            if (val < min_val) min_val = val;
            if (val > max_val) max_val = val;
            values[val_count++] = val;
        } else {
            stats.missing_count++;
        }
    }

    if (val_count == 0) {
        free(values);
        stats.is_valid = false;
        return stats;
    }

    stats.count = val_count;
    stats.sum = sum;
    stats.mean = sum / val_count;
    stats.min = min_val;
    stats.max = max_val;

    // Calculate variance and standard deviation
    double variance_sum = 0.0;
    for (int i = 0; i < val_count; i++) {
        variance_sum += (values[i] - stats.mean) * (values[i] - stats.mean);
    }
    
    // Sample variance (divided by N - 1)
    if (val_count > 1) {
        stats.variance = variance_sum / (val_count - 1);
    } else {
        stats.variance = 0.0;
    }
    stats.stddev = sqrt(stats.variance);

    // Calculate median
    qsort(values, val_count, sizeof(double), compare_doubles);
    if (val_count % 2 == 1) {
        stats.median = values[val_count / 2];
    } else {
        stats.median = (values[val_count / 2 - 1] + values[val_count / 2]) / 2.0;
    }

    free(values);
    stats.is_valid = true;
    return stats;
}

ColumnStats calculate_column_stats(const DataFrame* df, const char* col_name) {
    ColumnStats stats;
    memset(&stats, 0, sizeof(ColumnStats));

    if (!df || !col_name) {
        stats.is_valid = false;
        return stats;
    }

    int col_idx = -1;
    for (int i = 0; i < df->col_count; i++) {
        if (strcmp(df->headers[i], col_name) == 0) {
            col_idx = i;
            break;
        }
    }

    if (col_idx == -1) {
        strncpy(stats.col_name, col_name, sizeof(stats.col_name) - 1);
        stats.is_valid = false;
        return stats;
    }

    return calculate_column_stats_by_index(df, col_idx);
}

void print_column_stats(const ColumnStats* stats) {
    if (!stats) return;
    printf("\nDescriptive Statistics for Column '%s':\n", stats->col_name);
    printf("==================================================\n");
    if (!stats->is_valid) {
        printf("Status:        [INVALID OR NON-NUMERIC COLUMN]\n");
        printf("Valid Count:   %d\n", stats->count);
        printf("Missing Count: %d\n", stats->missing_count);
        printf("==================================================\n\n");
        return;
    }
    printf("Count:         %d\n", stats->count);
    printf("Missing:       %d\n", stats->missing_count);
    printf("Sum:           %.4f\n", stats->sum);
    printf("Mean:          %.4f\n", stats->mean);
    printf("Median:        %.4f\n", stats->median);
    printf("Min:           %.4f\n", stats->min);
    printf("Max:           %.4f\n", stats->max);
    printf("Variance:      %.4f\n", stats->variance);
    printf("Std Dev:       %.4f\n", stats->stddev);
    printf("==================================================\n\n");
}

int filter_and_print(const DataFrame* df, const char* col_name, const char* op, const char* val_str) {
    if (!df || !col_name || !op || !val_str) return 0;
    
    int col_idx = -1;
    for (int i = 0; i < df->col_count; i++) {
        if (strcmp(df->headers[i], col_name) == 0) {
            col_idx = i;
            break;
        }
    }
    if (col_idx == -1) {
        fprintf(stderr, "Error: Column '%s' not found.\n", col_name);
        return 0;
    }

    bool is_num_op = (strcmp(op, ">") == 0 || strcmp(op, "<") == 0);
    if (is_num_op && !df->is_numeric[col_idx]) {
        fprintf(stderr, "Error: Numeric comparison '%s' cannot be run on string column '%s'.\n", op, col_name);
        return 0;
    }

    double query_double = 0.0;
    if (df->is_numeric[col_idx] && (is_num_op || strcmp(op, "=") == 0)) {
        char* endptr;
        query_double = strtod(val_str, &endptr);
        if (endptr == val_str) {
            fprintf(stderr, "Error: Invalid numeric value '%s' in filter query.\n", val_str);
            return 0;
        }
    }

    printf("\nQuery Result: Filter [%s %s %s]\n", col_name, op, val_str);
    printf("=================================================================================\n");
    for (int c = 0; c < df->col_count; c++) {
        printf("%-16s", df->headers[c]);
        if (c < df->col_count - 1) printf("\t");
    }
    printf("\n");
    for (int c = 0; c < df->col_count; c++) {
        printf("----------------");
        if (c < df->col_count - 1) printf("\t");
    }
    printf("\n");

    int match_count = 0;
    for (int r = 0; r < df->row_count; r++) {
        const char* cell = df->data[r][col_idx];
        bool match = false;
        
        if (cell && strlen(cell) > 0) {
            if (df->is_numeric[col_idx] && (is_num_op || strcmp(op, "=") == 0)) {
                double cell_val = strtod(cell, NULL);
                if (strcmp(op, ">") == 0) {
                    match = (cell_val > query_double);
                } else if (strcmp(op, "<") == 0) {
                    match = (cell_val < query_double);
                } else if (strcmp(op, "=") == 0) {
                    match = (fabs(cell_val - query_double) < 1e-7);
                }
            } else {
                if (strcmp(op, "=") == 0) {
                    match = (strcmp(cell, val_str) == 0);
                } else if (strcmp(op, "like") == 0) {
                    match = (strstr(cell, val_str) != NULL);
                }
            }
        }

        if (match) {
            match_count++;
            for (int c = 0; c < df->col_count; c++) {
                const char* cell_val = df->data[r][c];
                if (cell_val && strlen(cell_val) > 0) {
                    printf("%-16.16s", cell_val);
                } else {
                    printf("%-16s", "[NULL]");
                }
                if (c < df->col_count - 1) printf("\t");
            }
            printf("\n");
        }
    }
    printf("=================================================================================\n");
    printf("Found %d matching rows.\n\n", match_count);
    return match_count;
}
