#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../include/csv_parser.h"
#include "../include/analytics.h"
#include "../include/auth.h"

void print_usage(const char* prog_name) {
    printf("C Data Analysis Tool\n");
    printf("=========================================\n");
    printf("Usage: %s <csv_file_path> [options]\n\n", prog_name);
    printf("Options:\n");
    printf("  --summary                    Print column summary & dimensions\n");
    printf("  --show [rows]                Print data rows (default: 10, -1 for all)\n");
    printf("  --stats <col_name>           Compute stats for a numeric column\n");
    printf("  --filter <col> <op> <val>    Query the data based on condition\n");
    printf("                               Operators: '>', '<', '=', 'like'\n");
    printf("=========================================\n");
}

int main(int argc, char* argv[]) {
    if (!authenticate_user()) {
        return 1;
    }

    if (argc < 2) {
        print_usage(argv[0]);
        return 1;
    }

    const char* filepath = argv[1];
    DataFrame* df = parse_csv(filepath);
    if (!df) {
        return 1;
    }

    // Default action if no arguments: print summary and show top 10 rows
    if (argc == 2) {
        print_dataframe_summary(df);
        printf("\nFirst 10 rows of data:\n");
        print_dataframe(df, 10);
        free_dataframe(df);
        return 0;
    }

    int i = 2;
    while (i < argc) {
        if (strcmp(argv[i], "--summary") == 0) {
            print_dataframe_summary(df);
            i++;
        } else if (strcmp(argv[i], "--show") == 0) {
            int limit = 10;
            if (i + 1 < argc && argv[i + 1][0] != '-') {
                limit = atoi(argv[i + 1]);
                i += 2;
            } else {
                i++;
            }
            print_dataframe(df, limit);
        } else if (strcmp(argv[i], "--stats") == 0) {
            if (i + 1 < argc) {
                const char* col_name = argv[i + 1];
                ColumnStats stats = calculate_column_stats(df, col_name);
                print_column_stats(&stats);
                i += 2;
            } else {
                fprintf(stderr, "Error: --stats requires a column name.\n");
                free_dataframe(df);
                return 1;
            }
        } else if (strcmp(argv[i], "--filter") == 0) {
            if (i + 3 < argc) {
                const char* col = argv[i + 1];
                const char* op = argv[i + 2];
                const char* val = argv[i + 3];
                filter_and_print(df, col, op, val);
                i += 4;
            } else {
                fprintf(stderr, "Error: --filter requires: <column> <operator> <value>.\n");
                free_dataframe(df);
                return 1;
            }
        } else {
            fprintf(stderr, "Error: Unknown option '%s'\n", argv[i]);
            print_usage(argv[0]);
            free_dataframe(df);
            return 1;
        }
    }

    free_dataframe(df);
    return 0;
}
