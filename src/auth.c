#include "../include/auth.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
#include <conio.h>
#else
#include <termios.h>
#include <unistd.h>
#endif

// Log an attempt to login_attempts.log
static void log_attempt(const char* username, bool success) {
    FILE* file = fopen("login_attempts.log", "a");
    if (!file) {
        // If we can't open/create the log file, we just return (don't block the user)
        return;
    }
    
    time_t rawtime;
    struct tm* timeinfo;
    char time_str[80];
    
    time(&rawtime);
    timeinfo = localtime(&rawtime);
    if (timeinfo) {
        strftime(time_str, sizeof(time_str), "%Y-%m-%d %H:%M:%S", timeinfo);
    } else {
        strcpy(time_str, "UNKNOWN TIME");
    }
    
    if (success) {
        fprintf(file, "[%s] User '%s' logged in successfully.\n", time_str, username);
    } else {
        fprintf(file, "[%s] Failed login attempt for user '%s'.\n", time_str, username);
    }
    
    fclose(file);
}

// Check credentials against users.txt
static bool check_credentials(const char* username, const char* password) {
    FILE* file = fopen("users.txt", "r");
    if (!file) {
        // Create default users.txt if not exists
        file = fopen("users.txt", "w");
        if (file) {
            fprintf(file, "admin:admin123\n");
            fclose(file);
            printf("[System Info] Created default credentials file 'users.txt' (admin:admin123).\n");
            file = fopen("users.txt", "r");
        }
    }
    
    if (!file) {
        fprintf(stderr, "Error: Could not open or create users.txt\n");
        return false;
    }
    
    char line[256];
    bool authenticated = false;
    
    while (fgets(line, sizeof(line), file)) {
        // Strip newline characters
        size_t len = strlen(line);
        while (len > 0 && (line[len-1] == '\n' || line[len-1] == '\r')) {
            line[len-1] = '\0';
            len--;
        }
        
        // Skip empty lines or comments
        if (strlen(line) == 0 || line[0] == '#') {
            continue;
        }
        
        // Find delimiter ':' or ','
        char* delim = strchr(line, ':');
        if (!delim) {
            delim = strchr(line, ',');
        }
        
        if (delim) {
            *delim = '\0';
            char* file_user = line;
            char* file_pass = delim + 1;
            
            if (strcmp(file_user, username) == 0 && strcmp(file_pass, password) == 0) {
                authenticated = true;
                break;
            }
        }
    }
    
    fclose(file);
    return authenticated;
}

// Securely read a masked password
static void get_masked_password(char* password, int max_len) {
#ifdef _WIN32
    int i = 0;
    char ch;
    while (i < max_len - 1) {
        ch = _getch();
        if (ch == '\r' || ch == '\n') { // Enter key
            break;
        } else if (ch == '\b') { // Backspace
            if (i > 0) {
                i--;
                printf("\b \b"); // Erase last star from screen
            }
        } else if (ch == 3) { // Ctrl+C
            printf("\n");
            exit(1);
        } else {
            password[i++] = ch;
            printf("*");
        }
    }
    password[i] = '\0';
    printf("\n");
#else
    // POSIX secure read (no echo)
    struct termios oldt, newt;
    int i = 0;
    char ch;
    
    tcgetattr(STDIN_FILENO, &oldt);
    newt = oldt;
    newt.c_lflag &= ~(ECHO);
    tcsetattr(STDIN_FILENO, TCSANOW, &newt);
    
    while (i < max_len - 1) {
        if (read(STDIN_FILENO, &ch, 1) <= 0) break;
        if (ch == '\n' || ch == '\r') {
            break;
        } else if (ch == 127 || ch == '\b') {
            if (i > 0) {
                i--;
            }
        } else {
            password[i++] = ch;
        }
    }
    password[i] = '\0';
    
    tcsetattr(STDIN_FILENO, TCSANOW, &oldt);
    printf("\n");
#endif
}

bool authenticate_user(void) {
    char username[128];
    char password[128];
    int attempts = 3;
    
    printf("=========================================\n");
    printf("      FOOTBALL INC. SECURE ACCESS\n");
    printf("=========================================\n");
    
    while (attempts > 0) {
        printf("Username: ");
        fflush(stdout);
        
        if (!fgets(username, sizeof(username), stdin)) {
            printf("\nError reading username.\n");
            return false;
        }
        
        // Strip newline from username
        size_t len = strlen(username);
        while (len > 0 && (username[len-1] == '\n' || username[len-1] == '\r')) {
            username[len-1] = '\0';
            len--;
        }
        
        printf("Password: ");
        fflush(stdout);
        get_masked_password(password, sizeof(password));
        
        if (check_credentials(username, password)) {
            log_attempt(username, true);
            printf("\nAccess Granted. Welcome back, %s!\n", username);
            printf("=========================================\n\n");
            return true;
        } else {
            log_attempt(username, false);
            attempts--;
            printf("\nAccess Denied. Incorrect username or password.\n");
            if (attempts > 0) {
                printf("You have %d attempt(s) remaining.\n\n", attempts);
            } else {
                printf("Too many failed attempts. Access Locked.\n");
                printf("=========================================\n\n");
            }
        }
    }
    
    return false;
}
