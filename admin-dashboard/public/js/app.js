// API Configuration - Use proxy on same domain
const API_URL = '/api';
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
        case 'transfers':
            loadTransfers();
            break;
        case 'referrals':
            loadReferrals();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Load Transfers
async function loadTransfers() {
    try {
        const response = await fetch(`${API_URL}/admin/transfers`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to load transfers');
        
        const data = await response.json();
        const tbody = document.getElementById('transfersTable');

        if (data.transfers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No transfers yet</td></tr>';
            return;
        }

        tbody.innerHTML = data.transfers.map(transfer => `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3">
                    <p class="font-semibold">${transfer.sender_username || 'Unknown'}</p>
                    <p class="text-xs text-gray-500">ID: ${transfer.sender_telegram_id || 'N/A'}</p>
                </td>
                <td class="px-4 py-3">
                    ${transfer.recipient_username ? `
                        <p class="font-semibold">${transfer.recipient_username}</p>
                        <p class="text-xs text-gray-500">ID: ${transfer.recipient_telegram_id}</p>
                    ` : `
                        <p class="text-xs text-gray-500">${transfer.recipient_wallet.slice(0, 8)}...${transfer.recipient_wallet.slice(-8)}</p>
                    `}
                </td>
                <td class="px-4 py-3">
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                        ${transfer.token_symbol}
                    </span>
                </td>
                <td class="px-4 py-3 font-semibold">${transfer.amount}</td>
                <td class="px-4 py-3 text-sm text-gray-600">${formatTime(transfer.created_at)}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 rounded text-xs font-semibold ${
                        transfer.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        transfer.status === 'failed' ? 'bg-red-100 text-red-800' : 
                        'bg-yellow-100 text-yellow-800'
                    }">
                        ${transfer.status}
                    </span>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load transfers:', error);
    }
}

// Tab Management
function switchSettingsTab(tabName) {
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add('active', 'border-blue-500', 'text-blue-600');
        activeButton.classList.remove('border-transparent');
    }
    
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }
}

// Settings Management
async function loadSettings() {
    try {
        const response = await fetch(`${API_URL}/admin/settings`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to load settings');
        
        const data = await response.json();
        const s = data.settings;

        // General Settings
        document.getElementById('feeWalletAddress').value = s.fee_wallet_address || '';
        document.getElementById('feePercentage').value = s.fee_percentage || 0;
        document.getElementById('referralPercentage').value = s.referral_percentage || 0;
        document.getElementById('minTradeAmount').value = s.min_trade_amount || 0;
        document.getElementById('maxTradeAmount').value = s.max_trade_amount || '';
        document.getElementById('botEnabled').checked = s.enabled !== false;
        document.getElementById('maintenanceMode').checked = s.maintenance_mode || false;
        document.getElementById('allowNewRegistrations').checked = s.allow_new_registrations !== false;

        // Withdrawal Settings
        document.getElementById('withdrawalWalletAddress').value = s.withdrawal_wallet_address || '';
        document.getElementById('withdrawalFeePercentage').value = s.withdrawal_fee_percentage || 0.10;
        document.getElementById('minWithdrawalAmount').value = s.min_withdrawal_amount || 0.01;
        document.getElementById('maxWithdrawalAmount').value = s.max_withdrawal_amount || '';
        document.getElementById('dailyWithdrawalLimit').value = s.daily_withdrawal_limit || '';
        document.getElementById('monthlyWithdrawalLimit').value = s.monthly_withdrawal_limit || '';
        document.getElementById('withdrawalRequiresApproval').checked = s.withdrawal_requires_approval || false;
        document.getElementById('autoCollectFees').checked = s.auto_collect_fees || false;
        if (document.getElementById('autoWithdrawalThreshold')) {
            document.getElementById('autoWithdrawalThreshold').value = s.auto_withdrawal_threshold || '';
        }
        if (document.getElementById('autoCollectScheduleHours')) {
            document.getElementById('autoCollectScheduleHours').value = s.auto_collect_schedule_hours || 24;
        }
        if (document.getElementById('minBalanceForAutoCollect')) {
            document.getElementById('minBalanceForAutoCollect').value = s.min_balance_for_auto_collect || 1.0;
        }
        if (document.getElementById('feeCollectionWalletRotation')) {
            document.getElementById('feeCollectionWalletRotation').checked = s.fee_collection_wallet_rotation || false;
        }

        // Limits
        document.getElementById('dailyTradeLimitPerUser').value = s.daily_trade_limit_per_user || '';
        document.getElementById('maxTradeSizePerTransaction').value = s.max_trade_size_per_transaction || '';
        document.getElementById('maxActiveOrdersPerUser').value = s.max_active_orders_per_user || 10;
        document.getElementById('maxWalletsPerUser').value = s.max_wallets_per_user || 5;
        document.getElementById('tradeCooldownSeconds').value = s.trade_cooldown_seconds || 0;
        document.getElementById('suspiciousActivityThreshold').value = s.suspicious_activity_threshold || 100;
        if (document.getElementById('newUserCooldownHours')) {
            document.getElementById('newUserCooldownHours').value = s.new_user_cooldown_hours || 0;
        }

        // Security
        document.getElementById('require2fa').checked = s.require_2fa || false;
        document.getElementById('autoLockSuspiciousAccounts').checked = s.auto_lock_suspicious_accounts || false;
        document.getElementById('notifyOnSuspiciousActivity').checked = s.notify_on_suspicious_activity !== false;
        document.getElementById('notifyOnLargeTrades').checked = s.notify_on_large_trades !== false;
        document.getElementById('maxFailedLoginAttempts').value = s.max_failed_login_attempts || 5;
        document.getElementById('largeTradeThresholdSol').value = s.large_trade_threshold_sol || 10;
        document.getElementById('adminNotificationEmail').value = s.admin_notification_email || '';
        document.getElementById('adminNotificationTelegramId').value = s.admin_notification_telegram_id || '';
        if (document.getElementById('adminIpWhitelist')) {
            document.getElementById('adminIpWhitelist').value = (s.admin_ip_whitelist || []).join('\n');
        }
        if (document.getElementById('requireKycAboveLimit')) {
            document.getElementById('requireKycAboveLimit').value = s.require_kyc_above_limit || '';
        }

        // Infrastructure
        document.getElementById('solanaRpcEndpoint').value = s.solana_rpc_endpoint || 'https://api.devnet.solana.com';
        document.getElementById('solanaBackupRpcEndpoint').value = s.solana_backup_rpc_endpoint || '';
        document.getElementById('ethereumRpcEndpoint').value = s.ethereum_rpc_endpoint || '';
        document.getElementById('bscRpcEndpoint').value = s.bsc_rpc_endpoint || '';
        document.getElementById('apiRateLimitPerMinute').value = s.api_rate_limit_per_minute || 60;
        if (document.getElementById('maxGasPriceGwei')) {
            document.getElementById('maxGasPriceGwei').value = s.max_gas_price_gwei || '';
        }
        if (document.getElementById('lastHealthCheck')) {
            document.getElementById('lastHealthCheck').textContent = s.last_health_check ? new Date(s.last_health_check).toLocaleString() : 'Never';
        }

        // Advanced
        document.getElementById('globalMaxSlippageBps').value = s.global_max_slippage_bps || 5000;
        document.getElementById('globalMinSlippageBps').value = s.global_min_slippage_bps || 10;
        document.getElementById('minPriorityFeeLamports').value = s.min_priority_fee_lamports || 1000;
        document.getElementById('maxPriorityFeeLamports').value = s.max_priority_fee_lamports || 1000000;
        document.getElementById('maxConsecutiveErrors').value = s.max_consecutive_errors || 10;
        document.getElementById('enableMevProtection').checked = s.enable_mev_protection !== false;
        document.getElementById('autoRestartOnError').checked = s.auto_restart_on_error !== false;
        document.getElementById('emergencyStop').checked = s.emergency_stop || false;
        document.getElementById('emergencyStopReason').value = s.emergency_stop_reason || '';

        // Update emergency banner
        if (s.emergency_stop) {
            document.getElementById('emergencyBanner').classList.remove('hidden');
            document.getElementById('emergencyReason').textContent = s.emergency_stop_reason || 'All trading operations are halted';
        } else {
            document.getElementById('emergencyBanner').classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        alert('Failed to load settings. Please try again.');
    }
}

async function saveSettings(event) {
    event.preventDefault();

    const settings = {
        // General
        fee_wallet_address: document.getElementById('feeWalletAddress').value.trim(),
        fee_percentage: parseFloat(document.getElementById('feePercentage').value),
        referral_percentage: parseFloat(document.getElementById('referralPercentage').value),
        min_trade_amount: parseFloat(document.getElementById('minTradeAmount').value),
        max_trade_amount: document.getElementById('maxTradeAmount').value ? parseFloat(document.getElementById('maxTradeAmount').value) : null,
        enabled: document.getElementById('botEnabled').checked,
        maintenance_mode: document.getElementById('maintenanceMode').checked,
        allow_new_registrations: document.getElementById('allowNewRegistrations').checked,

        // Withdrawals
        withdrawal_wallet_address: document.getElementById('withdrawalWalletAddress').value.trim() || null,
        withdrawal_fee_percentage: parseFloat(document.getElementById('withdrawalFeePercentage').value),
        min_withdrawal_amount: parseFloat(document.getElementById('minWithdrawalAmount').value),
        max_withdrawal_amount: document.getElementById('maxWithdrawalAmount').value ? parseFloat(document.getElementById('maxWithdrawalAmount').value) : null,
        daily_withdrawal_limit: document.getElementById('dailyWithdrawalLimit').value ? parseFloat(document.getElementById('dailyWithdrawalLimit').value) : null,
        monthly_withdrawal_limit: document.getElementById('monthlyWithdrawalLimit').value ? parseFloat(document.getElementById('monthlyWithdrawalLimit').value) : null,
        withdrawal_requires_approval: document.getElementById('withdrawalRequiresApproval').checked,
        auto_collect_fees: document.getElementById('autoCollectFees').checked,
        auto_withdrawal_threshold: document.getElementById('autoWithdrawalThreshold')?.value ? parseFloat(document.getElementById('autoWithdrawalThreshold').value) : null,
        auto_collect_schedule_hours: document.getElementById('autoCollectScheduleHours')?.value ? parseInt(document.getElementById('autoCollectScheduleHours').value) : 24,
        min_balance_for_auto_collect: document.getElementById('minBalanceForAutoCollect')?.value ? parseFloat(document.getElementById('minBalanceForAutoCollect').value) : 1.0,
        fee_collection_wallet_rotation: document.getElementById('feeCollectionWalletRotation')?.checked || false,

        // Limits
        daily_trade_limit_per_user: document.getElementById('dailyTradeLimitPerUser').value ? parseFloat(document.getElementById('dailyTradeLimitPerUser').value) : null,
        max_trade_size_per_transaction: document.getElementById('maxTradeSizePerTransaction').value ? parseFloat(document.getElementById('maxTradeSizePerTransaction').value) : null,
        max_active_orders_per_user: parseInt(document.getElementById('maxActiveOrdersPerUser').value),
        max_wallets_per_user: parseInt(document.getElementById('maxWalletsPerUser').value),
        trade_cooldown_seconds: parseInt(document.getElementById('tradeCooldownSeconds').value),
        suspicious_activity_threshold: parseFloat(document.getElementById('suspiciousActivityThreshold').value),
        new_user_cooldown_hours: document.getElementById('newUserCooldownHours')?.value ? parseInt(document.getElementById('newUserCooldownHours').value) : 0,

        // Security
        require_2fa: document.getElementById('require2fa').checked,
        auto_lock_suspicious_accounts: document.getElementById('autoLockSuspiciousAccounts').checked,
        notify_on_suspicious_activity: document.getElementById('notifyOnSuspiciousActivity').checked,
        notify_on_large_trades: document.getElementById('notifyOnLargeTrades').checked,
        max_failed_login_attempts: parseInt(document.getElementById('maxFailedLoginAttempts').value),
        large_trade_threshold_sol: parseFloat(document.getElementById('largeTradeThresholdSol').value),
        admin_notification_email: document.getElementById('adminNotificationEmail').value.trim() || null,
        admin_notification_telegram_id: document.getElementById('adminNotificationTelegramId').value ? parseInt(document.getElementById('adminNotificationTelegramId').value) : null,
        admin_ip_whitelist: document.getElementById('adminIpWhitelist')?.value ? document.getElementById('adminIpWhitelist').value.split('\n').map(ip => ip.trim()).filter(ip => ip.length > 0) : null,
        require_kyc_above_limit: document.getElementById('requireKycAboveLimit')?.value ? parseFloat(document.getElementById('requireKycAboveLimit').value) : null,

        // Infrastructure
        solana_rpc_endpoint: document.getElementById('solanaRpcEndpoint').value.trim(),
        solana_backup_rpc_endpoint: document.getElementById('solanaBackupRpcEndpoint').value.trim() || null,
        ethereum_rpc_endpoint: document.getElementById('ethereumRpcEndpoint').value.trim() || null,
        bsc_rpc_endpoint: document.getElementById('bscRpcEndpoint').value.trim() || null,
        api_rate_limit_per_minute: parseInt(document.getElementById('apiRateLimitPerMinute').value),
        max_gas_price_gwei: document.getElementById('maxGasPriceGwei')?.value ? parseFloat(document.getElementById('maxGasPriceGwei').value) : null,

        // Advanced
        global_max_slippage_bps: parseInt(document.getElementById('globalMaxSlippageBps').value),
        global_min_slippage_bps: parseInt(document.getElementById('globalMinSlippageBps').value),
        min_priority_fee_lamports: parseInt(document.getElementById('minPriorityFeeLamports').value),
        max_priority_fee_lamports: parseInt(document.getElementById('maxPriorityFeeLamports').value),
        max_consecutive_errors: parseInt(document.getElementById('maxConsecutiveErrors').value),
        enable_mev_protection: document.getElementById('enableMevProtection').checked,
        auto_restart_on_error: document.getElementById('autoRestartOnError').checked,
        emergency_stop: document.getElementById('emergencyStop').checked,
        emergency_stop_reason: document.getElementById('emergencyStopReason').value.trim() || null
    };

    try {
        const response = await fetch(`${API_URL}/admin/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(settings)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update settings');
        }

        alert('Settings updated successfully!');
        loadSettings();
    } catch (error) {
        console.error('Failed to save settings:', error);
        alert(error.message || 'Failed to save settings. Please try again.');
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

    // Settings form
    document.getElementById('settingsForm')?.addEventListener('submit', saveSettings);
    document.getElementById('cancelSettings')?.addEventListener('click', loadSettings);

    // Settings tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            switchSettingsTab(button.dataset.tab);
        });
    });

    // Emergency stop controls
    document.getElementById('emergencyStop')?.addEventListener('change', (e) => {
        const reasonDiv = document.getElementById('emergencyReasonDiv');
        if (e.target.checked) {
            reasonDiv.style.display = 'block';
        } else {
            reasonDiv.style.display = 'none';
        }
    });

    document.getElementById('deactivateEmergency')?.addEventListener('click', () => {
        document.getElementById('emergencyStop').checked = false;
        document.getElementById('emergencyReasonDiv').style.display = 'none';
        document.getElementById('emergencyStopReason').value = '';
    });

    // Check if already logged in
    if (authToken) {
        showDashboard();
        loadOverviewData();
    } else {
        showLogin();
    }
});
