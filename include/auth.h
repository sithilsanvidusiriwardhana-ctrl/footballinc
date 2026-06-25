#ifndef AUTH_H
#define AUTH_H

#include <stdbool.h>

// Prompts the user to login and validates their credentials.
// Allows up to 3 attempts. Returns true on success, false on failure.
bool authenticate_user(void);

#endif // AUTH_H
