// Admin Management Portal JavaScript Controller

let allAccounts = [];
let allTransactions = [];

document.addEventListener('DOMContentLoaded', () => {
    loadAccounts();
    loadTransactions();
});

// Load Accounts
async function loadAccounts() {
    try {
        const res = await fetch('/api/admin/accounts');
        const data = await res.json();
        if (data.success) {
            allAccounts = data.accounts;
            renderAccountsTable(allAccounts);
            updateStats();
        }
    } catch (e) {
        console.error('Error fetching accounts:', e);
    }
}

// Load Transactions
async function loadTransactions() {
    try {
        const res = await fetch('/api/admin/transactions');
        const data = await res.json();
        if (data.success) {
            allTransactions = data.transactions;
            renderTransactionsTable(allTransactions);
            updateStats();
        }
    } catch (e) {
        console.error('Error fetching transactions:', e);
    }
}

// Update KPI Stats Cards
function updateStats() {
    document.getElementById('stat-total-accounts').textContent = allAccounts.length;
    
    const totalBalance = allAccounts.reduce((sum, a) => sum + (a.accbls || 0), 0);
    document.getElementById('stat-total-balance').textContent = `₹${totalBalance.toLocaleString('en-IN')}`;

    const activeCount = allAccounts.filter(a => a.status === 'Active').length;
    document.getElementById('stat-active-cards').textContent = activeCount;

    document.getElementById('stat-total-txns').textContent = allTransactions.length;
}

// Render Accounts Table
function renderAccountsTable(accounts) {
    const tbody = document.getElementById('accounts-tbody');
    tbody.innerHTML = '';

    if (accounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">No accounts found. Click "Add New Account" to create one.</td></tr>`;
        return;
    }

    accounts.forEach(acc => {
        const isBlocked = acc.status === 'Blocked';
        const statusBadge = isBlocked 
            ? `<span class="status-badge status-blocked">BLOCKED</span>` 
            : `<span class="status-badge status-active">ACTIVE</span>`;

        tbody.innerHTML += `
            <tr>
                <td><strong>${acc.holderName}</strong></td>
                <td><code>${acc.accnum}</code></td>
                <td><code>${acc.cardnum}</code></td>
                <td><code>••••</code></td>
                <td><strong style="color: #34d399;">₹${(acc.accbls || 0).toLocaleString('en-IN')}</strong></td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="openEditModal('${acc._id}')">✏️ Edit</button>
                    <button class="btn btn-danger" style="padding: 4px 10px; font-size: 11px; margin-left: 4px;" onclick="deleteAccount('${acc._id}', '${acc.holderName}')">🗑️ Delete</button>
                </td>
            </tr>
        `;
    });
}

// Render Transactions Table
function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactions-tbody');
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No transactions recorded yet.</td></tr>`;
        return;
    }

    transactions.forEach(t => {
        const isCredit = t.txnType === 'DEPOSIT' || t.txnType === 'TRANSFER_RECEIVED';
        const color = isCredit ? '#34d399' : '#f87171';
        const sign = isCredit ? '+' : '-';
        const dateStr = new Date(t.createdAt).toLocaleString();

        tbody.innerHTML += `
            <tr>
                <td><code>${t.txnId}</code></td>
                <td>${dateStr}</td>
                <td><code>${t.accnum}</code></td>
                <td><strong>${t.txnType}</strong></td>
                <td style="color: ${color}; font-weight: 700;">${sign}₹${(t.amount || 0).toLocaleString('en-IN')}</td>
                <td>₹${(t.balanceAfter || 0).toLocaleString('en-IN')}</td>
            </tr>
        `;
    });
}

// Filter / Search Accounts
function filterAccounts() {
    const query = document.getElementById('account-search').value.toLowerCase();
    const filtered = allAccounts.filter(acc => 
        acc.holderName.toLowerCase().includes(query) ||
        acc.accnum.includes(query) ||
        acc.cardnum.includes(query)
    );
    renderAccountsTable(filtered);
}

// Tab Switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content-panel').forEach(p => p.style.display = 'none');

    if (tabName === 'accounts') {
        document.getElementById('tab-btn-accounts').classList.add('active');
        document.getElementById('panel-accounts').style.display = 'block';
    } else {
        document.getElementById('tab-btn-txns').classList.add('active');
        document.getElementById('panel-transactions').style.display = 'block';
    }
}

// Add Account Modal
function openAddAccountModal() {
    document.getElementById('add-acc-form').reset();
    document.getElementById('add-modal').classList.add('active');
}

function closeAddModal() {
    document.getElementById('add-modal').classList.remove('active');
}

async function submitAddAccount(e) {
    e.preventDefault();
    const payload = {
        holderName: document.getElementById('new-name').value,
        accnum: document.getElementById('new-accnum').value,
        cardnum: document.getElementById('new-cardnum').value,
        pinnum: document.getElementById('new-pin').value,
        accbls: Number(document.getElementById('new-balance').value),
        accType: document.getElementById('new-type').value,
        phone: document.getElementById('new-phone').value
    };

    try {
        const res = await fetch('/api/admin/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            alert('✅ Customer Account Created Successfully!');
            closeAddModal();
            loadAccounts();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (e) {
        alert('Failed to create account.');
    }
}

// Edit Account Modal
function openEditModal(id) {
    const acc = allAccounts.find(a => a._id === id);
    if (!acc) return;

    document.getElementById('edit-id').value = acc._id;
    document.getElementById('edit-name').value = acc.holderName;
    document.getElementById('edit-accnum').value = acc.accnum;
    document.getElementById('edit-balance').value = acc.accbls;
    document.getElementById('edit-pin').value = acc.pinnum;
    document.getElementById('edit-status').value = acc.status;
    document.getElementById('edit-type').value = acc.accType || 'Savings';

    document.getElementById('edit-modal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

async function submitEditAccount(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const payload = {
        holderName: document.getElementById('edit-name').value,
        accbls: Number(document.getElementById('edit-balance').value),
        pinnum: document.getElementById('edit-pin').value,
        status: document.getElementById('edit-status').value,
        accType: document.getElementById('edit-type').value
    };

    try {
        const res = await fetch(`/api/admin/accounts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            alert('✅ Account updated successfully!');
            closeEditModal();
            loadAccounts();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (e) {
        alert('Failed to update account.');
    }
}

// Delete Account
async function deleteAccount(id, name) {
    if (confirm(`Are you sure you want to delete account for "${name}"? All transaction records will also be removed.`)) {
        try {
            const res = await fetch(`/api/admin/accounts/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                alert('Account deleted.');
                loadAccounts();
                loadTransactions();
            } else {
                alert(data.message);
            }
        } catch (e) {
            alert('Failed to delete account.');
        }
    }
}

// Reset Demo Data
async function resetDemoData() {
    if (confirm('Reset database to default demo accounts & transaction logs?')) {
        try {
            const res = await fetch('/api/admin/reset-demo', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                loadAccounts();
                loadTransactions();
            }
        } catch (e) {
            alert('Failed to reset demo data.');
        }
    }
}
