<?php
// ============================================================
//  Football Inc — Activity Logs Page
// ============================================================
require_once __DIR__ . '/config.php';
require_login();

$user     = $_SESSION['user'];
$logLines = get_log_lines(100);

// Handle clear log
$success = '';
$error   = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'clear_log') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        $error = 'Invalid request token.';
    } else {
        file_put_contents(LOG_FILE, '');
        $success  = 'Log file cleared.';
        $logLines = [];
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Activity Logs — Football Inc Admin</title>
    <meta name="description" content="Review login activity and audit logs for Football Inc admin portal.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/style.css">
</head>
<body class="admin-body">

    <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
            <span class="brand-icon">⚽</span>
            <span class="brand-text">Football Inc</span>
        </div>
        <nav class="sidebar-nav">
            <a href="index.php"   class="nav-item" id="nav-dashboard"><span class="nav-icon">📊</span><span>Dashboard</span></a>
            <a href="users.php"   class="nav-item" id="nav-users"><span class="nav-icon">👥</span><span>User Management</span></a>
            <a href="players.php" class="nav-item" id="nav-players"><span class="nav-icon">🏃</span><span>Players</span></a>
            <a href="logs.php"    class="nav-item active" id="nav-logs"><span class="nav-icon">📋</span><span>Activity Logs</span></a>
        </nav>
        <div class="sidebar-footer">
            <div class="user-info">
                <div class="user-avatar"><?= strtoupper(substr($user, 0, 1)) ?></div>
                <div>
                    <div class="user-name"><?= htmlspecialchars($user) ?></div>
                    <div class="user-role">Administrator</div>
                </div>
            </div>
            <a href="logout.php" class="btn-logout" title="Logout">⏻</a>
        </div>
    </aside>

    <main class="main-content">
        <header class="topbar">
            <button class="hamburger" id="hamburger" aria-label="Toggle menu">☰</button>
            <h2 class="page-title">Activity Logs</h2>
            <div class="topbar-right">
                <form method="POST" action="logs.php"
                      onsubmit="return confirm('Clear all log entries? This cannot be undone.')">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="clear_log">
                    <button type="submit" class="btn btn-danger btn-sm" id="clearLogBtn">🗑 Clear Log</button>
                </form>
            </div>
        </header>

        <div class="content-area">

            <?php if ($success): ?>
            <div class="alert alert-success"><span class="alert-icon">✔</span><?= htmlspecialchars($success) ?></div>
            <?php endif; ?>
            <?php if ($error): ?>
            <div class="alert alert-error"><span class="alert-icon">⚠</span><?= htmlspecialchars($error) ?></div>
            <?php endif; ?>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">📋 Login Activity</h3>
                    <span class="badge"><?= count($logLines) ?> entries</span>
                </div>
                <div class="log-list log-list-full">
                    <?php if (empty($logLines)): ?>
                        <p class="empty-state" style="padding:2rem">No log entries found.</p>
                    <?php else: ?>
                        <?php foreach ($logLines as $line): ?>
                        <div class="log-entry <?= str_contains($line, 'successfully') ? 'log-success' : 'log-fail' ?>">
                            <span class="log-dot"></span>
                            <span class="log-text"><?= htmlspecialchars($line) ?></span>
                            <span class="log-badge"><?= str_contains($line, 'successfully') ? '✔ OK' : '✗ Fail' ?></span>
                        </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

        </div>
    </main>

    <script src="assets/admin.js"></script>
</body>
</html>
