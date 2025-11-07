// API Configuration - Auto-detect environment
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001/api'
  : `${window.location.protocol}//${window.location.hostname}:3001/api`;
let authToken = localStorage.getItem('adminToken');
let refreshInterval;

// Authentication Functions
async function login(telegramId, password) {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        authToken = data.token;
        localStorage.setItem('adminToken', authToken);
        localStorage.setItem('adminInfo', JSON.stringify(data.admin));

        showDashboard();
        loadOverviewData();
    } catch (error) {
        showLoginError(error.message);
    }
}

function logout() {
    authToken = null;
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    stopAutoRefresh();
    showLogin();
}

function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    startAutoRefresh();
}

// API Helper
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401 || response.status === 403) {
        logout();
        throw new Error('Session expired');
    }

    return await response.json();
}

// Data Loading Functions
async function loadOverviewData() {
    try {
        const stats = await apiCall('/admin/stats');
        
        document.getElementById('totalUsers').textContent = stats.totalUsers.toLocaleString();
        document.getElementById('activeWallets').textContent = stats.activeWallets.toLocaleString();
        document.getElementById('totalTransactions').textContent = stats.totalTransactions.toLocaleString();
        document.getElementById('totalFees').textContent = stats.totalFeesCollected.toFixed(4);

        await loadRecentActivity();
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadRecentActivity() {
    try {
        const data = await apiCall('/admin/transactions?limit=10');
        const activityDiv = document.getElementById('recentActivity');

        if (data.transactions.length === 0) {
            activityDiv.innerHTML = '<p class="text-gray-500">No recent activity</p>';
            return;
        }

        activityDiv.innerHTML = data.transactions.map(tx => `
            <div class="flex items-center justify-between py-3 border-b">
                <div class="flex items-center">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${tx.transaction_type === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${tx.transaction_type.toUpperCase()}
                    </span>
                    <span class="ml-3 text-sm text-gray-700">
                        ${tx.username || tx.first_name || 'User #' + tx.telegram_id}
                    </span>
                </div>
                <div class="text-right">
                    <p class="text-sm font-semibold">${tx.from_amount} ${tx.transaction_type === 'buy' ? 'SOL' : 'tokens'}</p>
                    <p class="text-xs text-gray-500">${formatTime(tx.created_at)}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load activity:', error);
    }
}

async function loadUsers(searchTerm = '') {
    try {
        const data = await apiCall(`/admin/users${searchTerm ? '?search=' + encodeURIComponent(searchTerm) : ''}`);
        const tbody = document.getElementById('usersTable');

        if (data.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No users found</td></tr>';
            return;
        }

        tbody.innerHTML = data.users.map(user => `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3">
                    <div>
                        <p class="font-semibold">${user.first_name || 'Unknown'} ${user.last_name || ''}</p>
                        <p class="text-sm text-gray-500">@${user.username || 'N/A'}</p>
                    </div>
                </td>
                <td class="px-4 py-3">${user.telegram_id}</td>
                <td class="px-4 py-3">${user.wallet_count || 0}</td>
                <td class="px-4 py-3">${user.transaction_count || 0}</td>
                <td class="px-4 py-3">${formatDate(user.created_at)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function loadTransactions() {
    try {
        const data = await apiCall('/admin/transactions?limit=50');
        const tbody = document.getElementById('transactionsTable');

        if (data.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No transactions found</td></tr>';
            return;
        }

        tbody.innerHTML = data.transactions.map(tx => `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${tx.transaction_type === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${tx.transaction_type.toUpperCase()}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <p class="text-sm">${tx.username || tx.first_name || 'User'}</p>
                    <p class="text-xs text-gray-500">#${tx.telegram_id}</p>
                </td>
                <td class="px-4 py-3">${tx.from_amount}</td>
                <td class="px-4 py-3">${tx.fee_amount ? tx.fee_amount.toFixed(4) : '0'} SOL</td>
                <td class="px-4 py-3">${formatTime(tx.created_at)}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${tx.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${tx.status}
                    </span>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load transactions:', error);
    }
}

async function loadReferrals() {
    try {
        const data = await apiCall('/admin/referrals');
        const contentDiv = document.getElementById('referralsContent');

        if (data.referrals.length === 0) {
            contentDiv.innerHTML = '<p class="text-gray-500">No referrals yet</p>';
            return;
        }

        contentDiv.innerHTML = `
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Referral Code</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total Referrals</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rewards</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.referrals.map(ref => `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="px-4 py-3">
                                <p class="font-semibold">${ref.first_name || 'User'}</p>
                                <p class="text-xs text-gray-500">@${ref.username || 'N/A'}</p>
                            </td>
                            <td class="px-4 py-3"><code class="bg-gray-100 px-2 py-1 rounded">${ref.referral_code}</code></td>
                            <td class="px-4 py-3">${ref.total_referrals}</td>
                            <td class="px-4 py-3">${ref.total_rewards ? ref.total_rewards.toFixed(4) : '0'} SOL</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Failed to load referrals:', error);
    }
}

// Page Navigation
function showPage(pageName, clickEvent = null) {
    // Update sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    
    if (clickEvent) {
        clickEvent.target.closest('.sidebar-item').classList.add('active');
    } else {
        // If no event (e.g., refresh button), find and activate the sidebar item
        const sidebarItem = document.querySelector(`[data-page="${pageName}"]`);
        if (sidebarItem) {
            sidebarItem.classList.add('active');
        }
    }

    // Update page content
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
    });
    document.getElementById(`${pageName}Page`).classList.remove('hidden');

    // Update title
    const titles = {
        overview: 'Overview',
        users: 'Users Management',
        transactions: 'Transactions',
        referrals: 'Referrals',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[pageName];

    // Load page data
    switch(pageName) {
        case 'overview':
            loadOverviewData();
            break;
        case 'users':
            loadUsers();
            break;
        case 'transactions':
            loadTransactions();
            break;
        case 'referrals':
            loadReferrals();
            break;
    }
}

// Utility Functions
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return date.toLocaleDateString();
}

function startAutoRefresh() {
    refreshInterval = setInterval(() => {
        const activePage = document.querySelector('.page-content:not(.hidden)');
        if (activePage.id === 'overviewPage') {
            loadOverviewData();
        }
    }, 10000); // Refresh every 10 seconds
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const telegramId = document.getElementById('telegramId').value;
        const password = document.getElementById('password').value;
        await login(telegramId, password);
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        const activePage = document.querySelector('.sidebar-item.active')?.dataset.page || 'overview';
        showPage(activePage, null);
    });

    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(item.dataset.page, e);
        });
    });

    // User search
    let searchTimeout;
    document.getElementById('userSearch')?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadUsers(e.target.value);
        }, 300);
    });

    // Check if already logged in
    if (authToken) {
        showDashboard();
        loadOverviewData();
    } else {
        showLogin();
    }
});
