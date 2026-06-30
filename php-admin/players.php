<?php
// ============================================================
//  Football Inc — Players View (read from CSV)
// ============================================================
require_once __DIR__ . '/config.php';
require_login();

$user = $_SESSION['user'];

// Read CSV
$headers = [];
$players = [];
if (file_exists(DATA_FILE)) {
    $rows = array_map('str_getcsv', file(DATA_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
    if (!empty($rows)) {
        $headers = array_shift($rows);
        $players = $rows;
    }
}

// Simple search
$search = trim($_GET['search'] ?? '');
if ($search !== '') {
    $players = array_filter($players, function($row) use ($search) {
        foreach ($row as $cell) {
            if (stripos($cell, $search) !== false) return true;
        }
        return false;
    });
    $players = array_values($players);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Players — Football Inc Admin</title>
    <meta name="description" content="Browse and search Football Inc player database.">
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
            <a href="players.php" class="nav-item active" id="nav-players"><span class="nav-icon">🏃</span><span>Players</span></a>
            <a href="logs.php"    class="nav-item" id="nav-logs"><span class="nav-icon">📋</span><span>Activity Logs</span></a>
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
            <h2 class="page-title">Players</h2>
            <div class="topbar-right">
                <form method="GET" action="players.php" class="search-form">
                    <input class="search-input" type="text" name="search" id="playerSearch"
                           placeholder="Search players…"
                           value="<?= htmlspecialchars($search) ?>" autocomplete="off">
                    <button type="submit" class="btn btn-primary btn-sm">🔍</button>
                    <?php if ($search): ?>
                    <a href="players.php" class="btn btn-secondary btn-sm">✕ Clear</a>
                    <?php endif; ?>
                </form>
            </div>
        </header>

        <div class="content-area">

            <?php if ($search): ?>
            <div class="alert alert-info">
                <span class="alert-icon">🔍</span>
                Showing <strong><?= count($players) ?></strong> result(s) for
                "<strong><?= htmlspecialchars($search) ?></strong>"
            </div>
            <?php endif; ?>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">🏃 Player Database</h3>
                    <span class="badge"><?= count($players) ?> players</span>
                </div>
                <?php if (empty($headers)): ?>
                    <p class="empty-state" style="padding:2rem">No player data found. Ensure <code>data/sample.csv</code> exists.</p>
                <?php else: ?>
                <div class="table-wrap table-scroll">
                    <table class="data-table players-table" id="playersTable">
                        <thead>
                            <tr>
                                <?php foreach ($headers as $h): ?>
                                <th><?= htmlspecialchars($h) ?></th>
                                <?php endforeach; ?>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($players as $row): ?>
                            <tr>
                                <?php foreach ($row as $i => $cell): ?>
                                <td>
                                    <?php if ($i === 0): // Name column ?>
                                        <strong><?= htmlspecialchars($cell) ?></strong>
                                    <?php elseif ($i === 3): // Position column ?>
                                        <span class="position-badge position-<?= strtolower($cell) ?>">
                                            <?= htmlspecialchars($cell) ?>
                                        </span>
                                    <?php else: ?>
                                        <?= htmlspecialchars($cell) ?>
                                    <?php endif; ?>
                                </td>
                                <?php endforeach; ?>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <?php endif; ?>
            </div>

        </div>
    </main>

    <script src="assets/admin.js"></script>
</body>
</html>
