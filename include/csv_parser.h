#ifndef CSV_PARSER_H
#define CSV_PARSER_H

#include <stdbool.h>

// Struct representing a dynamic 2D table parsed from a CSV file
typedef struct {
    char** headers;      // Array of header names (size: col_count)
    char*** data;        // 2D array of string values (size: row_count x col_count)
    int row_count;       // Number of rows (excluding header)
    int col_count;       // Number of columns
    bool* is_numeric;    // Array of flags indicating if a column is numeric (size: col_count)
} DataFrame;

// Parses a CSV file and loads it into a DataFrame structure
// Returns NULL on error or failure to open/parse file
DataFrame* parse_csv(const char* filepath);

// Frees all memory allocated for a DataFrame
void free_dataframe(DataFrame* df);

// Prints a summary of the DataFrame (dimensions, columns, types)
void print_dataframe_summary(const DataFrame* df);

// Prints the DataFrame contents to standard output (with a row limit)
void print_dataframe(const DataFrame* df, int limit);

#endif // CSV_PARSER_H
