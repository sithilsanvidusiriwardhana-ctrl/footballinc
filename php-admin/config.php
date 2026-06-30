<?php
// ============================================================
//  Football Inc — PHP Admin Panel Config & Helpers
// ============================================================

define('USERS_FILE',   __DIR__ . '/../users.txt');
define('LOG_FILE',     __DIR__ . '/../login_attempts.log');
define('DATA_FILE',    __DIR__ . '/../data/sample.csv');
define('SESSION_NAME', 'footballinc_session');
define('APP_NAME',     'Football Inc Admin');

// Start session securely
function start_secure_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'secure'   => false, // set true on HTTPS
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        session_start();
    }
}

// Redirect helper
function redirect(string $url): void {
    header("Location: $url");
    exit;
}

// Require the user to be logged in
function require_login(): void {
    start_secure_session();
    if (empty($_SESSION['user'])) {
        redirect('login.php');
    }
}

// ---- User file helpers ----------------------------------------

/**
 * Read all users from users.txt.
 * Returns array of ['username' => ..., 'password' => ...].
 */
function get_all_users(): array {
    if (!file_exists(USERS_FILE)) {
        file_put_contents(USERS_FILE, "admin:admin123\n");
    }

    $users = [];
    foreach (file(USERS_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;

        $delim = strpos($line, ':') !== false ? ':' : ',';
        $parts  = explode($delim, $line, 2);
        if (count($parts) === 2) {
            $users[] = ['username' => trim($parts[0]), 'password' => trim($parts[1])];
        }
    }
    return $users;
}

/**
 * Verify username + password against users.txt.
 */
function verify_credentials(string $username, string $password): bool {
    foreach (get_all_users() as $u) {
        if ($u['username'] === $username && $u['password'] === $password) {
            return true;
        }
    }
    return false;
}

/**
 * Write all users back to users.txt.
 */
function save_all_users(array $users): void {
    $lines = array_map(fn($u) => "{$u['username']}:{$u['password']}", $users);
    file_put_contents(USERS_FILE, implode("\n", $lines) . "\n");
}

/**
 * Add a new user (returns error string or empty string on success).
 */
function add_user(string $username, string $password): string {
    $username = trim($username);
    $password = trim($password);

    if ($username === '' || $password === '') return 'Username and password cannot be empty.';
    if (!preg_match('/^[a-zA-Z0-9_]{3,32}$/', $username))
        return 'Username must be 3–32 alphanumeric characters or underscores.';
    if (strlen($password) < 6) return 'Password must be at least 6 characters.';

    $users = get_all_users();
    foreach ($users as $u) {
        if ($u['username'] === $username) return "User '$username' already exists.";
    }

    $users[] = ['username' => $username, 'password' => $password];
    save_all_users($users);
    return '';
}

/**
 * Delete a user (cannot delete yourself).
 */
function delete_user(string $username, string $currentUser): string {
    if ($username === $currentUser) return 'You cannot delete your own account.';

    $users = get_all_users();
    $filtered = array_filter($users, fn($u) => $u['username'] !== $username);

    if (count($filtered) === count($users)) return "User '$username' not found.";

    save_all_users(array_values($filtered));
    return '';
}

/**
 * Change a user's password.
 */
function change_password(string $username, string $newPassword): string {
    $newPassword = trim($newPassword);
    if (strlen($newPassword) < 6) return 'New password must be at least 6 characters.';

    $users = get_all_users();
    $found = false;
    foreach ($users as &$u) {
        if ($u['username'] === $username) {
            $u['password'] = $newPassword;
            $found = true;
            break;
        }
    }
    unset($u);

    if (!$found) return "User '$username' not found.";
    save_all_users($users);
    return '';
}

// ---- Login log helpers ----------------------------------------

/**
 * Append an entry to the login attempts log.
 */
function log_attempt(string $username, bool $success): void {
    $ts  = date('Y-m-d H:i:s');
    $msg = $success
        ? "[$ts] User '$username' logged in successfully.\n"
        : "[$ts] User '$username' failed login attempt.\n";
    file_put_contents(LOG_FILE, $msg, FILE_APPEND | LOCK_EX);
}

/**
 * Return the last N lines from the login log.
 */
function get_log_lines(int $n = 50): array {
    if (!file_exists(LOG_FILE)) return [];
    $lines = file(LOG_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    return array_slice(array_reverse($lines), 0, $n);
}

// ---- CSRF helpers --------------------------------------------

function csrf_token(): string {
    start_secure_session();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf(string $token): bool {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

function csrf_field(): string {
    return '<input type="hidden" name="csrf_token" value="' . htmlspecialchars(csrf_token()) . '">';
}
