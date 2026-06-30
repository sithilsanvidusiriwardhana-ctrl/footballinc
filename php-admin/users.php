<?php
// ============================================================
//  Football Inc — User Management Page
// ============================================================
require_once __DIR__ . '/config.php';
require_login();

$user    = $_SESSION['user'];
$success = '';
$error   = '';

// Handle POST actions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        $error = 'Invalid request token. Please refresh and try again.';
    } else {
        $action = $_POST['action'] ?? '';

        if ($action === 'add') {
            $err = add_user($_POST['new_username'] ?? '', $_POST['new_password'] ?? '');
            if ($err) $error = $err;
            else $success = 'User added successfully.';

        } elseif ($action === 'delete') {
            $err = delete_user($_POST['del_username'] ?? '', $user);
            if ($err) $error = $err;
            else $success = 'User deleted successfully.';

        } elseif ($action === 'change_password') {
            $err = change_password($_POST['cp_username'] ?? '', $_POST['cp_password'] ?? '');
            if ($err) $error = $err;
            else $success = 'Password updated successfully.';
        }
    }
}

$users     = get_all_users();
$showAddForm = isset($_GET['action']) && $_GET['action'] === 'add';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management — Football Inc Admin</title>
    <meta name="description" content="Manage admin users for Football Inc admin portal.">
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
            <a href="index.php"   class="nav-item" id="nav-dashboard"><span class="nav-icon">📊</span><span>Dashboard</span></a>
            <a href="users.php"   class="nav-item active" id="nav-users"><span class="nav-icon">👥</span><span>User Management</span></a>
            <a href="players.php" class="nav-item" id="nav-players"><span class="nav-icon">🏃</span><span>Players</span></a>
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
            <h2 class="page-title">User Management</h2>
            <div class="topbar-right">
                <button class="btn btn-primary btn-sm" id="openAddModal">➕ Add User</button>
            </div>
        </header>

        <div class="content-area">

            <!-- Alerts -->
            <?php if ($success): ?>
            <div class="alert alert-success"><span class="alert-icon">✔</span><?= htmlspecialchars($success) ?></div>
            <?php endif; ?>
            <?php if ($error): ?>
            <div class="alert alert-error"><span class="alert-icon">⚠</span><?= htmlspecialchars($error) ?></div>
            <?php endif; ?>

            <!-- User table -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">👥 Admin Users</h3>
                    <span class="badge"><?= count($users) ?> total</span>
                </div>
                <div class="table-wrap">
                    <table class="data-table" id="usersTable">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                        <?php foreach ($users as $i => $u): ?>
                            <tr class="<?= $u['username'] === $user ? 'row-current' : '' ?>">
                                <td><?= $i + 1 ?></td>
                                <td>
                                    <strong><?= htmlspecialchars($u['username']) ?></strong>
                                    <?php if ($u['username'] === $user): ?>
                                        <span class="badge badge-green">You</span>
                                    <?php endif; ?>
                                </td>
                                <td><span class="badge badge-blue">Administrator</span></td>
                                <td class="action-cell">
                                    <!-- Change Password -->
                                    <button
                                        class="btn btn-sm btn-secondary"
                                        onclick="openCpModal('<?= htmlspecialchars($u['username']) ?>')"
                                        id="cp-<?= htmlspecialchars($u['username']) ?>">
                                        🔑 Password
                                    </button>

                                    <!-- Delete -->
                                    <?php if ($u['username'] !== $user): ?>
                                    <form method="POST" style="display:inline" onsubmit="return confirm('Delete user &quot;<?= htmlspecialchars($u['username']) ?>&quot;? This cannot be undone.')">
                                        <?= csrf_field() ?>
                                        <input type="hidden" name="action" value="delete">
                                        <input type="hidden" name="del_username" value="<?= htmlspecialchars($u['username']) ?>">
                                        <button type="submit" class="btn btn-sm btn-danger" id="del-<?= htmlspecialchars($u['username']) ?>">🗑 Delete</button>
                                    </form>
                                    <?php else: ?>
                                        <span class="muted-text">(protected)</span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    </main>

    <!-- ===== Add User Modal ===== -->
    <div class="modal-overlay" id="addUserModal">
        <div class="modal glass-card">
            <div class="modal-header">
                <h3>➕ Add New User</h3>
                <button class="modal-close" id="closeAddModal">✕</button>
            </div>
            <form method="POST" action="users.php" class="modal-form" id="addUserForm">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="add">
                <div class="form-group">
                    <label class="form-label" for="new_username">Username</label>
                    <input class="form-input" type="text" id="new_username" name="new_username"
                           placeholder="e.g. coach_bob" pattern="[a-zA-Z0-9_]{3,32}" required autofocus>
                    <span class="form-hint">3–32 chars, letters, digits, or underscores</span>
                </div>
                <div class="form-group">
                    <label class="form-label" for="new_password">Password</label>
                    <input class="form-input" type="password" id="new_password" name="new_password"
                           placeholder="Min. 6 characters" minlength="6" required>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="cancelAddModal">Cancel</button>
                    <button type="submit" class="btn btn-primary">Create User</button>
                </div>
            </form>
        </div>
    </div>

    <!-- ===== Change Password Modal ===== -->
    <div class="modal-overlay" id="cpModal">
        <div class="modal glass-card">
            <div class="modal-header">
                <h3>🔑 Change Password</h3>
                <button class="modal-close" id="closeCpModal">✕</button>
            </div>
            <form method="POST" action="users.php" class="modal-form">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="change_password">
                <input type="hidden" name="cp_username" id="cpUsername">
                <div class="form-group">
                    <label class="form-label">Changing password for:</label>
                    <p class="cp-target" id="cpTarget"></p>
                </div>
                <div class="form-group">
                    <label class="form-label" for="cp_password">New Password</label>
                    <input class="form-input" type="password" id="cp_password" name="cp_password"
                           placeholder="Min. 6 characters" minlength="6" required>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="cancelCpModal">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update Password</button>
                </div>
            </form>
        </div>
    </div>

    <script src="assets/admin.js"></script>
    <script>
        // Add User Modal
        const addModal   = document.getElementById('addUserModal');
        const openAddBtn = document.getElementById('openAddModal');
        openAddBtn.addEventListener('click', () => addModal.classList.add('open'));
        document.getElementById('closeAddModal').addEventListener('click',  () => addModal.classList.remove('open'));
        document.getElementById('cancelAddModal').addEventListener('click', () => addModal.classList.remove('open'));

        // Open if ?action=add in URL
        <?php if ($showAddForm): ?>
        addModal.classList.add('open');
        <?php endif; ?>

        // Change Password Modal
        const cpModal = document.getElementById('cpModal');
        function openCpModal(username) {
            document.getElementById('cpUsername').value = username;
            document.getElementById('cpTarget').textContent = username;
            document.getElementById('cp_password').value = '';
            cpModal.classList.add('open');
        }
        document.getElementById('closeCpModal').addEventListener('click',  () => cpModal.classList.remove('open'));
        document.getElementById('cancelCpModal').addEventListener('click', () => cpModal.classList.remove('open'));

        // Close modals on overlay click
        [addModal, cpModal].forEach(m => {
            m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
        });
    </script>
</body>
</html>
