<?php
// ============================================================
//  Football Inc — Login Page
// ============================================================
require_once __DIR__ . '/config.php';
start_secure_session();

// Already logged in → go to dashboard
if (!empty($_SESSION['user'])) {
    redirect('index.php');
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        $error = 'Invalid request. Please try again.';
    } else {
        $username = trim($_POST['username'] ?? '');
        $password = trim($_POST['password'] ?? '');

        if ($username === '' || $password === '') {
            $error = 'Please enter your username and password.';
        } elseif (verify_credentials($username, $password)) {
            log_attempt($username, true);
            session_regenerate_id(true);
            $_SESSION['user']       = $username;
            $_SESSION['login_time'] = time();
            redirect('index.php');
        } else {
            log_attempt($username, false);
            $error = 'Access Denied. Incorrect username or password.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login — Football Inc Admin</title>
    <meta name="description" content="Admin login portal for Football Inc player data management system.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/style.css">
</head>
<body class="login-body">

    <!-- Animated pitch lines in background -->
    <div class="pitch-bg">
        <div class="pitch-line pitch-line-1"></div>
        <div class="pitch-line pitch-line-2"></div>
        <div class="pitch-circle"></div>
    </div>

    <div class="login-wrapper">
        <div class="login-card glass-card">

            <!-- Logo / Header -->
            <div class="login-header">
                <div class="logo-icon">⚽</div>
                <h1 class="login-title">Football Inc</h1>
                <p class="login-subtitle">Admin Portal</p>
            </div>

            <!-- Error banner -->
            <?php if ($error): ?>
            <div class="alert alert-error" role="alert">
                <span class="alert-icon">⚠</span>
                <?= htmlspecialchars($error) ?>
            </div>
            <?php endif; ?>

            <!-- Login Form -->
            <form method="POST" action="login.php" class="login-form" novalidate>
                <?= csrf_field() ?>

                <div class="form-group">
                    <label class="form-label" for="username">Username</label>
                    <div class="input-wrapper">
                        <span class="input-icon">👤</span>
                        <input
                            class="form-input"
                            type="text"
                            id="username"
                            name="username"
                            placeholder="Enter your username"
                            value="<?= htmlspecialchars($_POST['username'] ?? '') ?>"
                            autocomplete="username"
                            required
                            autofocus
                        >
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="password">Password</label>
                    <div class="input-wrapper">
                        <span class="input-icon">🔒</span>
                        <input
                            class="form-input"
                            type="password"
                            id="password"
                            name="password"
                            placeholder="Enter your password"
                            autocomplete="current-password"
                            required
                        >
                        <button type="button" class="toggle-pass" id="togglePass" aria-label="Toggle password visibility">👁</button>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary btn-full" id="loginBtn">
                    <span>Sign In</span>
                    <span class="btn-arrow">→</span>
                </button>
            </form>

            <p class="login-hint">Default: <code>admin</code> / <code>admin123</code></p>
        </div>
    </div>

    <script>
        // Toggle password visibility
        document.getElementById('togglePass').addEventListener('click', function () {
            const pw = document.getElementById('password');
            pw.type = pw.type === 'password' ? 'text' : 'password';
            this.textContent = pw.type === 'password' ? '👁' : '🙈';
        });

        // Button loading state
        document.querySelector('.login-form').addEventListener('submit', function () {
            const btn = document.getElementById('loginBtn');
            btn.innerHTML = '<span class="spinner"></span> Signing in…';
            btn.disabled = true;
        });
    </script>
</body>
</html>
