#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "../include/csv_parser.h"

// Helper to duplicate a string slice
static char* duplicate_string(const char* src, int len) {
    char* dest = (char*)malloc(len + 1);
    if (!dest) return NULL;
    strncpy(dest, src, len);
    dest[len] = '\0';
    return dest;
}

// Trims leading and trailing whitespace from a string in place
static void trim_whitespace(char* s) {
    if (!s) return;
    int len = strlen(s);
    int start = 0;
    while (start < len && isspace((unsigned char)s[start])) {
        start++;
    }
    int end = len - 1;
    while (end >= start && isspace((unsigned char)s[end])) {
        end--;
    }
    if (start > 0 || end < len - 1) {
        int i;
        for (i = start; i <= end; i++) {
            s[i - start] = s[i];
        }
        s[i - start] = '\0';
    }
}

// Helper to check if a string is numeric (float or int)
static bool is_string_numeric(const char* s) {
    if (!s || strlen(s) == 0) return false;
    char* endptr;
    // Skip leading spaces
    while (isspace((unsigned char)*s)) s++;
    if (*s == '\0') return false;
    
    strtod(s, &endptr);
    
    // Skip trailing spaces
    while (isspace((unsigned char)*endptr)) endptr++;
    return (*endptr == '\0');
}

// Strip trailing carriage returns and newlines
static void strip_newline(char* s) {
    size_t len = strlen(s);
    while (len > 0 && (s[len - 1] == '\n' || s[len - 1] == '\r')) {
        s[len - 1] = '\0';
        len--;
    }
}

// Parses a single CSV line with support for quotes and escaped quotes
static char** parse_csv_line(const char* line, int* col_count) {
    int cap = 8;
    char** cols = malloc(sizeof(char*) * cap);
    if (!cols) {
        *col_count = 0;
        return NULL;
    }
    int count = 0;
    int len = strlen(line);
    int i = 0;

    while (i < len) {
        int start;
        char* val = NULL;

        // Skip leading spaces before checking for quotes
        while (i < len && isspace((unsigned char)line[i]) && line[i] != ',') {
            i++;
        }

        if (i < len && line[i] == '"') {
            // Quoted field
            i++; // skip opening quote
            start = i;
            while (i < len) {
                if (line[i] == '"') {
                    // Check if it's an escaped quote: ""
                    if (i + 1 < len && line[i + 1] == '"') {
                        i += 2;
                    } else {
                        break; // closing quote
                    }
                } else {
                    i++;
                }
            }
            int field_len = i - start;
            val = duplicate_string(line + start, field_len);
            
            // Clean up escaped quotes
            if (val) {
                int r = 0, w = 0;
                while (val[r]) {
                    if (val[r] == '"' && val[r + 1] == '"') {
                        val[w++] = '"';
                        r += 2;
                    } else {
                        val[w++] = val[r++];
                    }
                }
                val[w] = '\0';
            }

            if (i < len && line[i] == '"') {
                i++; // skip closing quote
            }

            // Consume up to the next comma
            while (i < len && line[i] != ',') {
                i++;
            }
        } else {
            // Unquoted field
            start = i;
            while (i < len && line[i] != ',') {
                i++;
            }
            int field_len = i - start;
            val = duplicate_string(line + start, field_len);
            if (val) {
                trim_whitespace(val);
            }
        }

        if (i < len && line[i] == ',') {
            i++; // skip comma
        }

        if (count >= cap) {
            cap *= 2;
            char** temp = realloc(cols, sizeof(char*) * cap);
            if (!temp) {
                // Out of memory clean up
                for (int j = 0; j < count; j++) free(cols[j]);
                free(cols);
                *col_count = 0;
                return NULL;
            }
            cols = temp;
        }
        cols[count++] = val;
    }

    // Check if line ended with a comma (signaling an empty last field)
    if (len > 0 && line[len - 1] == ',') {
        if (count >= cap) {
            cap += 1;
            char** temp = realloc(cols, sizeof(char*) * cap);
            if (temp) {
                cols = temp;
            }
        }
        cols[count++] = duplicate_string("", 0);
    }

    *col_count = count;
    return cols;
}

DataFrame* parse_csv(const char* filepath) {
    FILE* file = fopen(filepath, "r");
    if (!file) {
        fprintf(stderr, "Error: Could not open file %s\n", filepath);
        return NULL;
    }

    DataFrame* df = (DataFrame*)malloc(sizeof(DataFrame));
    if (!df) {
        fclose(file);
        return NULL;
    }
    df->headers = NULL;
    df->data = NULL;
    df->row_count = 0;
    df->col_count = 0;
    df->is_numeric = NULL;

    char line_buf[65536];
    
    // Read header line
    if (!fgets(line_buf, sizeof(line_buf), file)) {
        fprintf(stderr, "Error: CSV file %s is empty\n", filepath);
        free(df);
        fclose(file);
        return NULL;
    }

    strip_newline(line_buf);
    int cols_in_header = 0;
    df->headers = parse_csv_line(line_buf, &cols_in_header);
    if (!df->headers || cols_in_header == 0) {
        fprintf(stderr, "Error: Failed to parse header row in %s\n", filepath);
        free(df);
        fclose(file);
        return NULL;
    }
    df->col_count = cols_in_header;

    // Allocate column metadata
    df->is_numeric = (bool*)malloc(sizeof(bool) * df->col_count);
    for (int i = 0; i < df->col_count; i++) {
        df->is_numeric[i] = true; // Assume numeric initially, disprove later
    }

    // Parse data rows
    int row_cap = 128;
    df->data = (char***)malloc(sizeof(char**) * row_cap);
    if (!df->data) {
        free_dataframe(df);
        fclose(file);
        return NULL;
    }

    int line_num = 1;
    while (fgets(line_buf, sizeof(line_buf), file)) {
        line_num++;
        strip_newline(line_buf);
        
        // Skip empty lines
        if (strlen(line_buf) == 0) {
            continue;
        }

        int cols_in_line = 0;
        char** parsed_cols = parse_csv_line(line_buf, &cols_in_line);
        if (!parsed_cols && cols_in_line == 0) {
            continue; // line parse failed or empty
        }

        // Align parsed line columns to standard col_count (rectangular shape)
        char** aligned_row = (char**)malloc(sizeof(char*) * df->col_count);
        for (int c = 0; c < df->col_count; c++) {
            if (c < cols_in_line) {
                aligned_row[c] = parsed_cols[c];
            } else {
                aligned_row[c] = duplicate_string("", 0); // Missing column padding
            }
        }
        // Free any extra columns beyond df->col_count
        for (int c = df->col_count; c < cols_in_line; c++) {
            free(parsed_cols[c]);
        }
        free(parsed_cols);

        // Append to dataframe data rows
        if (df->row_count >= row_cap) {
            row_cap *= 2;
            char*** temp_data = realloc(df->data, sizeof(char**) * row_cap);
            if (!temp_data) {
                fprintf(stderr, "Error: Out of memory at row %d\n", df->row_count);
                // Free aligned row
                for (int c = 0; c < df->col_count; c++) free(aligned_row[c]);
                free(aligned_row);
                break;
            }
            df->data = temp_data;
        }
        df->data[df->row_count++] = aligned_row;
    }

    fclose(file);

    // Determine data types for each column
    // A column is numeric if it contains only numeric elements and optionally empty values.
    // If it contains even one non-numeric, non-empty element, it is non-numeric (string).
    for (int c = 0; c < df->col_count; c++) {
        bool has_any_value = false;
        for (int r = 0; r < df->row_count; r++) {
            const char* val = df->data[r][c];
            if (val && strlen(val) > 0) {
                has_any_value = true;
                if (!is_string_numeric(val)) {
                    df->is_numeric[c] = false;
                    break; // No need to check further rows for this column
                }
            }
        }
        // If a column had absolutely no values, we treat it as non-numeric/string by default
        if (!has_any_value) {
            df->is_numeric[c] = false;
        }
    }

    return df;
}

void free_dataframe(DataFrame* df) {
    if (!df) return;
    
    if (df->headers) {
        for (int c = 0; c < df->col_count; c++) {
            free(df->headers[c]);
        }
        free(df->headers);
    }

    if (df->data) {
        for (int r = 0; r < df->row_count; r++) {
            if (df->data[r]) {
                for (int c = 0; c < df->col_count; c++) {
                    free(df->data[r][c]);
                }
                free(df->data[r]);
            }
        }
        free(df->data);
    }

    free(df->is_numeric);
    free(df);
}

void print_dataframe_summary(const DataFrame* df) {
    if (!df) {
        printf("DataFrame is NULL.\n");
        return;
    }
    printf("DataFrame Summary:\n");
    printf("=========================================\n");
    printf("Rows count:    %d\n", df->row_count);
    printf("Columns count: %d\n", df->col_count);
    printf("Columns list:\n");
    for (int c = 0; c < df->col_count; c++) {
        printf("  [%d] %-20s (%s)\n", 
               c, 
               df->headers[c], 
               df->is_numeric[c] ? "Numeric" : "String");
    }
    printf("=========================================\n");
}

void print_dataframe(const DataFrame* df, int limit) {
    if (!df) {
        printf("DataFrame is NULL.\n");
        return;
    }
    int rows_to_show = (limit < 0 || limit > df->row_count) ? df->row_count : limit;
    
    // Print header line
    for (int c = 0; c < df->col_count; c++) {
        printf("%-16s", df->headers[c]);
        if (c < df->col_count - 1) printf("\t");
    }
    printf("\n");
    
    // Print separator
    for (int c = 0; c < df->col_count; c++) {
        printf("----------------");
        if (c < df->col_count - 1) printf("\t");
    }
    printf("\n");

    // Print rows
    for (int r = 0; r < rows_to_show; r++) {
        for (int c = 0; c < df->col_count; c++) {
            const char* val = df->data[r][c];
            if (val && strlen(val) > 0) {
                printf("%-16.16s", val);
            } else {
                printf("%-16s", "[NULL]");
            }
            if (c < df->col_count - 1) printf("\t");
        }
        printf("\n");
    }

    if (rows_to_show < df->row_count) {
        printf("... and %d more rows.\n", df->row_count - rows_to_show);
    }
}
