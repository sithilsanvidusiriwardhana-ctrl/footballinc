/* ============================================================
   Football Inc Admin — admin.js
   Shared interactive behaviours
   ============================================================ */

// ── Live clock ──────────────────────────────────────────────
const clockEl = document.getElementById('clock');
if (clockEl) {
    const tick = () => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    tick();
    setInterval(tick, 1000);
}

// ── Hamburger / sidebar toggle ───────────────────────────────
const hamburger = document.getElementById('hamburger');
const sidebar   = document.getElementById('sidebar');

if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (
            window.innerWidth <= 768 &&
            sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !hamburger.contains(e.target)
        ) {
            sidebar.classList.remove('open');
        }
    });
}

// ── Auto-dismiss alerts after 4 s ───────────────────────────
document.querySelectorAll('.alert').forEach(alert => {
    setTimeout(() => {
        alert.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        alert.style.opacity    = '0';
        alert.style.transform  = 'translateY(-6px)';
        setTimeout(() => alert.remove(), 400);
    }, 4000);
});

// ── Highlight active nav item from URL ──────────────────────
(function () {
    const page = window.location.pathname.split('/').pop() || 'index.php';
    document.querySelectorAll('.nav-item').forEach(item => {
        const href = item.getAttribute('href');
        if (href && href.split('?')[0] === page) {
            item.classList.add('active');
        }
    });
})();
