#ifndef ANALYTICS_H
#define ANALYTICS_H

#include "csv_parser.h"

// Struct to hold calculated descriptive statistics for a numeric column
typedef struct {
    char col_name[128];
    int count;          // Number of valid (non-empty, numeric) rows
    int missing_count;  // Number of empty or invalid rows
    double sum;
    double mean;
    double median;
    double min;
    double max;
    double variance;
    double stddev;
    bool is_valid;      // True if statistics were successfully computed
} ColumnStats;

// Computes all descriptive statistics for a column by name
ColumnStats calculate_column_stats(const DataFrame* df, const char* col_name);

// Computes all descriptive statistics for a column by index
ColumnStats calculate_column_stats_by_index(const DataFrame* df, int col_idx);

// Prints descriptive statistics to standard output
void print_column_stats(const ColumnStats* stats);

// Filters and prints rows matching a condition:
// - Numeric comparisons: ">", "<", "="
// - String comparisons: "=" (exact), "like" (substring match)
// Returns the count of matching rows
int filter_and_print(const DataFrame* df, const char* col_name, const char* op, const char* val_str);

#endif // ANALYTICS_H
