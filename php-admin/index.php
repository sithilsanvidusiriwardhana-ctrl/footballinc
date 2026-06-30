<?php
// ============================================================
//  Football Inc — Admin Dashboard (index)
// ============================================================
require_once __DIR__ . '/config.php';
require_login();

$user = $_SESSION['user'];
$users = get_all_users();
$logLines = get_log_lines(20);

// Quick stats
$playerCount = 0;
if (file_exists(DATA_FILE)) {
    $lines = file(DATA_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $playerCount = max(0, count($lines) - 1); // subtract header
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard — Football Inc Admin</title>
    <meta name="description" content="Football Inc admin dashboard with player statistics and user management.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/style.css">
</head>
<body class="admin-body">

    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
            <span class="brand-icon">⚽</span>
            <span class="brand-text">Football Inc</span>
        </div>

        <nav class="sidebar-nav">
            <a href="index.php"   class="nav-item active" id="nav-dashboard">
                <span class="nav-icon">📊</span><span>Dashboard</span>
            </a>
            <a href="users.php"   class="nav-item" id="nav-users">
                <span class="nav-icon">👥</span><span>User Management</span>
            </a>
            <a href="players.php" class="nav-item" id="nav-players">
                <span class="nav-icon">🏃</span><span>Players</span>
            </a>
            <a href="logs.php"    class="nav-item" id="nav-logs">
                <span class="nav-icon">📋</span><span>Activity Logs</span>
            </a>
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

    <!-- Main Content -->
    <main class="main-content">
        <header class="topbar">
            <button class="hamburger" id="hamburger" aria-label="Toggle menu">☰</button>
            <h2 class="page-title">Dashboard</h2>
            <div class="topbar-right">
                <span class="topbar-time" id="clock"></span>
            </div>
        </header>

        <div class="content-area">

            <!-- Stat cards -->
            <div class="stats-grid">
                <div class="stat-card stat-green">
                    <div class="stat-icon">🏃</div>
                    <div class="stat-info">
                        <div class="stat-value"><?= $playerCount ?></div>
                        <div class="stat-label">Total Players</div>
                    </div>
                </div>
                <div class="stat-card stat-blue">
                    <div class="stat-icon">👥</div>
                    <div class="stat-info">
                        <div class="stat-value"><?= count($users) ?></div>
                        <div class="stat-label">Admin Users</div>
                    </div>
                </div>
                <div class="stat-card stat-purple">
                    <div class="stat-icon">📋</div>
                    <div class="stat-info">
                        <div class="stat-value"><?= count($logLines) ?>+</div>
                        <div class="stat-label">Recent Log Entries</div>
                    </div>
                </div>
                <div class="stat-card stat-orange">
                    <div class="stat-icon">🔐</div>
                    <div class="stat-info">
                        <div class="stat-value">Active</div>
                        <div class="stat-label">Session Status</div>
                    </div>
                </div>
            </div>

            <!-- Two-column layout -->
            <div class="two-col">

                <!-- Quick actions -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">⚡ Quick Actions</h3>
                    </div>
                    <div class="quick-actions">
                        <a href="users.php" class="action-btn action-blue">
                            <span>👤</span> Manage Users
                        </a>
                        <a href="users.php?action=add" class="action-btn action-green">
                            <span>➕</span> Add User
                        </a>
                        <a href="players.php" class="action-btn action-purple">
                            <span>🏃</span> View Players
                        </a>
                        <a href="logs.php" class="action-btn action-orange">
                            <span>📋</span> View Logs
                        </a>
                    </div>
                </div>

                <!-- Recent activity -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🕐 Recent Activity</h3>
                        <a href="logs.php" class="card-link">View all →</a>
                    </div>
                    <div class="log-list">
                        <?php if (empty($logLines)): ?>
                            <p class="empty-state">No log entries yet.</p>
                        <?php else: ?>
                            <?php foreach (array_slice($logLines, 0, 5) as $line): ?>
                                <div class="log-entry <?= str_contains($line, 'successfully') ? 'log-success' : 'log-fail' ?>">
                                    <span class="log-dot"></span>
                                    <span class="log-text"><?= htmlspecialchars($line) ?></span>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

        </div><!-- /content-area -->
    </main>

    <script src="assets/admin.js"></script>
</body>
</html>
