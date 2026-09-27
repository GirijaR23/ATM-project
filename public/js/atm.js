// ============================================================
// 🏧 CYBERBANK ATM - CLIENT-SIDE ATM CONTROLLER
// ============================================================

class ATMController {
    constructor() {
        this.currentView = 'view-welcome';
        this.cardData = null;
        this.authenticatedAccount = null;
        this.pinBuffer = '';
        this.activeInputTarget = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.startClock();
        applyTranslations();
    }

    startClock() {
        const timeEl = document.getElementById('kiosk-time');
        const updateTime = () => {
            const now = new Date();
            if (timeEl) {
                timeEl.textContent = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString();
            }
        };
        updateTime();
        setInterval(updateTime, 1000);
    }

    switchView(viewId) {
        document.querySelectorAll('.screen-view').forEach(view => {
            view.classList.remove('active');
        });
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewId;
        }

        // Set default active input for keypad target
        if (viewId === 'view-welcome') {
            this.activeInputTarget = document.getElementById('card-input');
        } else if (viewId === 'view-withdraw') {
            this.activeInputTarget = document.getElementById('withdraw-amount-input');
        } else if (viewId === 'view-deposit') {
            this.activeInputTarget = document.getElementById('deposit-500');
        } else if (viewId === 'view-transfer') {
            this.activeInputTarget = document.getElementById('transfer-acc-input');
        } else if (viewId === 'view-pinchange') {
            this.activeInputTarget = document.getElementById('old-pin-input');
        } else {
            this.activeInputTarget = null;
        }

        if (this.activeInputTarget) {
            setTimeout(() => {
                try {
                    this.activeInputTarget.focus();
                } catch (e) {}
            }, 60);
        }

        atmAudio.playBeep(880, 'sine', 0.05);
    }

    async loadDemoAccounts() {
        try {
            const res = await fetch('/api/atm/demo-accounts');
            const data = await res.json();
            const container = document.getElementById('demo-cards-container');
            if (data.success && container) {
                container.innerHTML = '';
                data.accounts.forEach(acc => {
                    const btn = document.createElement('button');
                    btn.className = 'demo-card-btn';
                    btn.innerHTML = `💳 ${acc.holderName}`;
                    btn.title = `Click to insert ${acc.holderName}'s card`;
                    btn.onclick = () => this.useDemoCard(acc);
                    container.appendChild(btn);
                });
            }
        } catch (e) {
            console.error('Error loading demo accounts:', e);
        }
    }

    useDemoCard(acc) {
        atmAudio.playCardSound();
        const cardInput = document.getElementById('card-input');
        if (cardInput) {
            cardInput.value = acc.cardnum;
        }
        this.submitCard(acc.cardnum);
    }

    bindEvents() {
        // Track focus across all screen inputs so on-screen keypad types into the right box
        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('focus', () => {
                this.activeInputTarget = input;
            });
            input.addEventListener('click', () => {
                this.activeInputTarget = input;
            });
        });

        // Physical / On-screen ATM Keypad clicks
        document.querySelectorAll('.atm-key').forEach(key => {
            key.addEventListener('click', (e) => {
                const keyValue = key.getAttribute('data-key');
                this.handleKeypadInput(keyValue);
            });
        });

        // Global Physical Keyboard input listener
        window.addEventListener('keydown', (e) => {
            // Case 1: PIN Screen (no native text input element)
            if (this.currentView === 'view-pin') {
                if (e.key >= '0' && e.key <= '9') {
                    e.preventDefault();
                    this.handleKeypadInput(e.key);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleKeypadInput('ENTER');
                } else if (e.key === 'Backspace') {
                    e.preventDefault();
                    this.handleKeypadInput('CLEAR');
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.handleKeypadInput('CANCEL');
                }
                return;
            }

            // Case 2: User is currently typing inside an input element (card, transfer, withdraw, etc.)
            const isInputFocused = document.activeElement && (
                document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA'
            );

            if (isInputFocused) {
                this.activeInputTarget = document.activeElement;

                if (e.key >= '0' && e.key <= '9') {
                    // Play tactile audio feedback. Native browser handles insertion to prevent double digits!
                    atmAudio.playBeep(1200, 'sine', 0.04);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    this.triggerActiveFormSubmit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelTransaction();
                }
                return;
            }

            // Case 3: User typed on keyboard while not focused in any input
            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                this.handleKeypadInput(e.key);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.handleKeypadInput('ENTER');
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                this.handleKeypadInput('CLEAR');
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.handleKeypadInput('CANCEL');
            }
        });

        // Side Hardware Function Keys (F1 - F8)
        document.querySelectorAll('.f-key-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-fkey');
                this.handleFunctionKey(key);
            });
        });

        // Sound Toggle
        const soundBtn = document.getElementById('sound-toggle-btn');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                const enabled = atmAudio.toggleSound();
                soundBtn.textContent = enabled ? '🔊' : '🔇';
                soundBtn.title = enabled ? 'Sound On' : 'Sound Muted';
            });
        }
    }

    handleKeypadInput(key) {
        atmAudio.playBeep(1200, 'sine', 0.04);

        if (this.currentView === 'view-pin') {
            if (key >= '0' && key <= '9') {
                if (this.pinBuffer.length < 4) {
                    this.pinBuffer += key;
                    this.updatePinDisplay();
                    if (this.pinBuffer.length === 4) {
                        setTimeout(() => this.submitPin(), 300);
                    }
                }
            } else if (key === 'CLEAR') {
                this.pinBuffer = this.pinBuffer.slice(0, -1);
                this.updatePinDisplay();
            } else if (key === 'CANCEL') {
                this.cancelTransaction();
            } else if (key === 'ENTER') {
                if (this.pinBuffer.length === 4) {
                    this.submitPin();
                }
            }
            return;
        }

        // Determine target input element for on-screen keypad
        let target = this.activeInputTarget;
        if (!target || !document.body.contains(target) || target.offsetParent === null) {
            const activeView = document.getElementById(this.currentView);
            if (activeView) {
                target = activeView.querySelector('input:not([type="hidden"])');
                this.activeInputTarget = target;
            }
        }

        if (target) {
            if ((key >= '0' && key <= '9') || key === '00' || key === '.') {
                const max = target.getAttribute('maxlength');
                if (max && (target.value.length + key.length) > parseInt(max, 10)) {
                    return;
                }
                target.value += key;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (key === 'CLEAR') {
                target.value = target.value.slice(0, -1);
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (key === 'CANCEL') {
                this.cancelTransaction();
            } else if (key === 'ENTER') {
                this.triggerActiveFormSubmit();
            }
        } else {
            if (key === 'CANCEL') {
                this.cancelTransaction();
            } else if (key === 'ENTER') {
                this.triggerActiveFormSubmit();
            }
        }
    }

    updatePinDisplay() {
        const dots = document.querySelectorAll('.pin-dot');
        dots.forEach((dot, index) => {
            if (index < this.pinBuffer.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        });
    }

    triggerActiveFormSubmit() {
        if (this.currentView === 'view-welcome') {
            this.submitCard();
        } else if (this.currentView === 'view-pin') {
            if (this.pinBuffer.length === 4) this.submitPin();
        } else if (this.currentView === 'view-withdraw') {
            this.submitCustomWithdrawal();
        } else if (this.currentView === 'view-deposit') {
            this.submitDeposit();
        } else if (this.currentView === 'view-transfer') {
            const step2 = document.getElementById('transfer-step-2');
            const amtInput = document.getElementById('transfer-amt-input');
            if (step2 && step2.style.display !== 'none' && amtInput && amtInput.value.trim() !== '') {
                this.submitFundTransfer();
            } else {
                this.checkBeneficiary();
            }
        } else if (this.currentView === 'view-pinchange') {
            this.submitPinChange();
        }
    }

    handleFunctionKey(fKey) {
        // Map side buttons dynamically to on-screen options based on current view
        if (this.currentView === 'view-menu') {
            switch (fKey) {
                case 'F1': this.openFastCash(); break;
                case 'F2': this.openWithdraw(); break;
                case 'F3': this.openDeposit(); break;
                case 'F4': this.openBalance(); break;
                case 'F5': this.openMiniStatement(); break;
                case 'F6': this.openTransfer(); break;
                case 'F7': this.openPinChange(); break;
                case 'F8': this.cancelTransaction(); break;
            }
        } else if (this.currentView === 'view-fastcash') {
            switch (fKey) {
                case 'F1': this.withdrawFastCash(500); break;
                case 'F2': this.withdrawFastCash(1000); break;
                case 'F3': this.withdrawFastCash(2000); break;
                case 'F4': this.openWithdraw(); break;
                case 'F5': this.withdrawFastCash(5000); break;
                case 'F6': this.withdrawFastCash(10000); break;
                case 'F8': this.switchView('view-menu'); break;
            }
        } else if (this.currentView === 'view-language') {
            switch (fKey) {
                case 'F1': this.selectLang('en'); break;
                case 'F2': this.selectLang('ta'); break;
                case 'F3': this.selectLang('hi'); break;
                case 'F8': this.cancelTransaction(); break;
            }
        }
    }

    // 1. Submit Card
    async submitCard(customCard) {
        const input = customCard || document.getElementById('card-input').value;
        if (!input || input.trim() === '') {
            atmAudio.playError();
            alert('Please enter your 16-digit Card Number or Account Number.');
            return;
        }

        atmAudio.playCardSound();
        const cardPreview = document.getElementById('virtual-card');
        if (cardPreview) cardPreview.classList.add('inserted');

        try {
            const res = await fetch('/api/atm/validate-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardOrAcc: input.trim() })
            });
            const data = await res.json();

            if (data.success) {
                this.cardData = data;
                const maskedCardEl = document.getElementById('display-masked-card');
                if (maskedCardEl) maskedCardEl.textContent = data.maskedCard;
                this.switchView('view-language');
            } else {
                atmAudio.playError();
                if (cardPreview) cardPreview.classList.remove('inserted');
                alert(data.message || 'Invalid Card Number');
            }
        } catch (err) {
            atmAudio.playError();
            if (cardPreview) cardPreview.classList.remove('inserted');
            alert('Connection failed. Please check server.');
        }
    }

    // 2. Select Language
    selectLang(lang) {
        setLanguage(lang);
        if (this.authenticatedAccount) {
            this.updateWelcomeGreeting(this.authenticatedAccount.holderName, this.authenticatedAccount);
        } else {
            this.pinBuffer = '';
            this.updatePinDisplay();
            this.switchView('view-pin');
        }
    }

    // 3. Submit PIN
    async submitPin() {
        if (this.pinBuffer.length !== 4) {
            atmAudio.playError();
            alert('Please enter a 4-digit PIN');
            return;
        }

        try {
            const res = await fetch('/api/atm/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: this.pinBuffer })
            });
            const data = await res.json();

            if (data.success) {
                atmAudio.playSuccess();
                this.authenticatedAccount = data.account;
                this.pinBuffer = '';
                this.updatePinDisplay();

                // Announce and display personalized welcome greeting!
                const holderName = data.account.holderName || 'Customer';
                this.updateWelcomeGreeting(holderName, data.account);
                atmAudio.speakWelcome(holderName, currentLang);

                this.switchView('view-acctype');
            } else {
                atmAudio.playError();
                this.pinBuffer = '';
                this.updatePinDisplay();
                alert(data.message);
                if (data.blocked) {
                    this.cancelTransaction();
                }
            }
        } catch (err) {
            atmAudio.playError();
            alert('PIN verification failed.');
        }
    }

    // Update personalized welcome banners across authenticated views
    updateWelcomeGreeting(name, account) {
        document.querySelectorAll('.auth-customer-name').forEach(el => {
            el.textContent = name;
        });
        const prefix = typeof t === 'function' ? (t('welcomeUserPrefix') || 'Welcome') : 'Welcome';
        document.querySelectorAll('.greeting-prefix').forEach(el => {
            el.textContent = prefix;
        });
        const accEl = document.getElementById('auth-customer-acc');
        if (accEl && account) {
            const rawAcc = account.accnum || '';
            accEl.textContent = rawAcc ? `A/C: •••• ${rawAcc.slice(-4)}` : '';
        }
    }

    // 4. Select Account Type
    selectAccountType(type) {
        if (this.authenticatedAccount) {
            this.authenticatedAccount.selectedType = type;
        }
        this.switchView('view-menu');
    }

    // Menu Navigation Helpers
    openFastCash() { this.switchView('view-fastcash'); }
    openWithdraw() {
        const input = document.getElementById('withdraw-amount-input');
        if (input) input.value = '';
        this.activeInputTarget = input;
        this.switchView('view-withdraw');
        if (input) {
            setTimeout(() => input.focus(), 60);
        }
    }
    openDeposit() {
        const d500 = document.getElementById('deposit-500');
        const d200 = document.getElementById('deposit-200');
        const d100 = document.getElementById('deposit-100');
        if (d500) d500.value = 0;
        if (d200) d200.value = 0;
        if (d100) d100.value = 0;
        this.calculateDepositTotal();
        this.activeInputTarget = d500;
        this.switchView('view-deposit');
        if (d500) {
            setTimeout(() => d500.focus(), 60);
        }
    }
    openTransfer() {
        const accInput = document.getElementById('transfer-acc-input');
        const amtInput = document.getElementById('transfer-amt-input');
        if (accInput) accInput.value = '';
        if (amtInput) amtInput.value = '';
        const benInfo = document.getElementById('transfer-beneficiary-info');
        if (benInfo) benInfo.style.display = 'none';
        const step2 = document.getElementById('transfer-step-2');
        if (step2) step2.style.display = 'none';
        this.activeInputTarget = accInput;
        this.switchView('view-transfer');
        if (accInput) {
            setTimeout(() => accInput.focus(), 60);
        }
    }
    openPinChange() {
        const oldPin = document.getElementById('old-pin-input');
        const newPin = document.getElementById('new-pin-input');
        const confPin = document.getElementById('confirm-pin-input');
        if (oldPin) oldPin.value = '';
        if (newPin) newPin.value = '';
        if (confPin) confPin.value = '';
        this.activeInputTarget = oldPin;
        this.switchView('view-pinchange');
        if (oldPin) {
            setTimeout(() => oldPin.focus(), 60);
        }
    }

    // 5. Fast Cash Withdrawal
    async withdrawFastCash(amount) {
        await this.executeWithdrawal(amount, true);
    }

    // 6. Custom Withdrawal
    async submitCustomWithdrawal() {
        const amountInput = document.getElementById('withdraw-amount-input');
        const amount = Number(amountInput.value);
        if (!amount || amount <= 0) {
            atmAudio.playError();
            alert('Please enter a valid amount.');
            return;
        }
        await this.executeWithdrawal(amount, false);
    }

    async executeWithdrawal(amount, isFastCash) {
        this.switchView('view-processing');
        atmAudio.playCashCount(2.5);

        try {
            const res = await fetch('/api/atm/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, isFastCash })
            });
            const data = await res.json();

            if (data.success) {
                setTimeout(() => {
                    atmAudio.playSuccess();
                    this.showDispensedCash(data);
                }, 2000);
            } else {
                setTimeout(() => {
                    atmAudio.playError();
                    alert(data.message);
                    this.switchView('view-menu');
                }, 1000);
            }
        } catch (err) {
            atmAudio.playError();
            alert('Withdrawal failed. Server error.');
            this.switchView('view-menu');
        }
    }

    showDispensedCash(data) {
        this.switchView('view-success-cash');
        const shutter = document.getElementById('dispenser-shutter');
        const cashStack = document.getElementById('cash-notes-stack');
        const cashText = document.getElementById('dispensed-cash-text');

        if (shutter) shutter.classList.add('open');
        if (cashStack) {
            cashStack.style.display = 'flex';
            cashText.textContent = `₹${data.amount.toLocaleString('en-IN')}`;
        }

        // Render receipt
        if (data.receipt) {
            this.currentReceiptData = data.receipt;
        }
    }

    collectCash() {
        atmAudio.playBeep(1000, 'sine', 0.08);
        const shutter = document.getElementById('dispenser-shutter');
        const cashStack = document.getElementById('cash-notes-stack');
        if (shutter) shutter.classList.remove('open');
        if (cashStack) cashStack.style.display = 'none';

        if (this.currentReceiptData) {
            this.displayReceipt(this.currentReceiptData);
        } else {
            this.switchView('view-menu');
        }
    }

    // 7. Cash Deposit (CDM)
    calculateDepositTotal() {
        const n500 = parseInt(document.getElementById('deposit-500').value) || 0;
        const n200 = parseInt(document.getElementById('deposit-200').value) || 0;
        const n100 = parseInt(document.getElementById('deposit-100').value) || 0;

        const total = (n500 * 500) + (n200 * 200) + (n100 * 100);
        document.getElementById('deposit-total-display').textContent = `₹${total.toLocaleString('en-IN')}`;
        return total;
    }

    async submitDeposit() {
        const n500 = parseInt(document.getElementById('deposit-500').value) || 0;
        const n200 = parseInt(document.getElementById('deposit-200').value) || 0;
        const n100 = parseInt(document.getElementById('deposit-100').value) || 0;
        const total = (n500 * 500) + (n200 * 200) + (n100 * 100);

        if (total <= 0) {
            atmAudio.playError();
            alert('Please enter count of notes to deposit.');
            return;
        }

        this.switchView('view-processing');
        atmAudio.playCashCount(2.0);

        try {
            const res = await fetch('/api/atm/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count100: n100, count200: n200, count500: n500 })
            });
            const data = await res.json();

            if (data.success) {
                setTimeout(() => {
                    atmAudio.playSuccess();
                    alert(`✅ Cash Deposit Successful! ₹${data.amount.toLocaleString('en-IN')} has been credited to your account.`);
                    if (data.receipt) {
                        this.displayReceipt(data.receipt);
                    } else {
                        this.switchView('view-menu');
                    }
                }, 2000);
            } else {
                atmAudio.playError();
                alert(data.message);
                this.switchView('view-deposit');
            }
        } catch (err) {
            atmAudio.playError();
            alert('Deposit transaction failed.');
            this.switchView('view-menu');
        }
    }

    // 8. Balance Enquiry
    async openBalance() {
        this.switchView('view-processing');
        try {
            const res = await fetch('/api/atm/account-info');
            const data = await res.json();

            if (data.success) {
                this.switchView('view-balance');
                document.getElementById('bal-holder').textContent = data.account.holderName;
                document.getElementById('bal-accnum').textContent = data.account.accnum;
                document.getElementById('bal-card').textContent = data.account.maskedCard;
                document.getElementById('bal-type').textContent = data.account.accType;
                document.getElementById('bal-amount').textContent = `₹${data.account.accbls.toLocaleString('en-IN')}`;

                this.currentReceiptData = {
                    txnId: data.receipt.txnId,
                    txnType: 'BALANCE_ENQUIRY',
                    holderName: data.account.holderName,
                    maskedCard: data.account.maskedCard,
                    balanceAfter: data.account.accbls,
                    date: new Date(),
                    atmId: 'ATM-TN-CHN-008',
                    location: 'Chennai Central Branch, TN'
                };
            } else {
                alert(data.message);
                this.cancelTransaction();
            }
        } catch (err) {
            alert('Failed to retrieve balance.');
            this.switchView('view-menu');
        }
    }

    // 9. Fund Transfer
    async checkBeneficiary() {
        const targetAcc = document.getElementById('transfer-acc-input').value;
        if (!targetAcc) {
            atmAudio.playError();
            alert('Please enter recipient account number.');
            return;
        }

        try {
            const res = await fetch('/api/atm/check-beneficiary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetAccnum: targetAcc.trim() })
            });
            const data = await res.json();

            if (data.success) {
                atmAudio.playSuccess();
                document.getElementById('ben-name-display').textContent = data.holderName;
                document.getElementById('ben-acc-display').textContent = data.targetAccnum;
                document.getElementById('transfer-beneficiary-info').style.display = 'block';
                document.getElementById('transfer-step-2').style.display = 'block';
                const amtInput = document.getElementById('transfer-amt-input');
                this.activeInputTarget = amtInput;
                if (amtInput) {
                    setTimeout(() => amtInput.focus(), 60);
                }
            } else {
                atmAudio.playError();
                alert(data.message);
            }
        } catch (e) {
            atmAudio.playError();
            alert('Error verifying beneficiary.');
        }
    }

    async submitFundTransfer() {
        const targetAcc = document.getElementById('transfer-acc-input').value;
        const amount = Number(document.getElementById('transfer-amt-input').value);

        if (!amount || amount <= 0) {
            atmAudio.playError();
            alert('Please enter a valid transfer amount.');
            return;
        }

        this.switchView('view-processing');
        try {
            const res = await fetch('/api/atm/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetAccnum: targetAcc.trim(), amount })
            });
            const data = await res.json();

            if (data.success) {
                atmAudio.playSuccess();
                alert(data.message);
                if (data.receipt) {
                    this.displayReceipt(data.receipt);
                } else {
                    this.switchView('view-menu');
                }
            } else {
                atmAudio.playError();
                alert(data.message);
                this.switchView('view-transfer');
            }
        } catch (e) {
            atmAudio.playError();
            alert('Transfer failed.');
            this.switchView('view-menu');
        }
    }

    // 10. Mini Statement
    async openMiniStatement() {
        this.switchView('view-processing');
        try {
            const res = await fetch('/api/atm/mini-statement');
            const data = await res.json();

            if (data.success) {
                this.switchView('view-statement');
                const tbody = document.getElementById('statement-rows');
                tbody.innerHTML = '';

                if (data.transactions.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px;">No recent transactions.</td></tr>';
                } else {
                    data.transactions.forEach(t => {
                        const dateStr = new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                        const isCredit = t.txnType === 'DEPOSIT' || t.txnType === 'TRANSFER_RECEIVED';
                        const badgeClass = isCredit ? 'badge-credit' : 'badge-debit';
                        const sign = isCredit ? '+' : '-';

                        tbody.innerHTML += `
                            <tr>
                                <td>${dateStr}</td>
                                <td>${t.txnType}</td>
                                <td class="${badgeClass}">${sign}₹${t.amount.toLocaleString('en-IN')}</td>
                                <td>₹${t.balanceAfter.toLocaleString('en-IN')}</td>
                            </tr>
                        `;
                    });
                }

                this.currentReceiptData = {
                    txnId: data.receipt.txnId,
                    txnType: 'MINI_STATEMENT',
                    holderName: data.holderName,
                    maskedCard: data.maskedCard,
                    balanceAfter: data.currentBalance,
                    date: new Date(),
                    transactions: data.transactions
                };
            } else {
                alert(data.message);
                this.switchView('view-menu');
            }
        } catch (e) {
            alert('Failed to load mini-statement.');
            this.switchView('view-menu');
        }
    }

    // 11. Change PIN
    async submitPinChange() {
        const oldPin = document.getElementById('old-pin-input').value;
        const newPin = document.getElementById('new-pin-input').value;
        const confirmPin = document.getElementById('confirm-pin-input').value;

        if (!oldPin || !newPin || !confirmPin) {
            atmAudio.playError();
            alert('Please fill in all PIN fields.');
            return;
        }

        if (newPin !== confirmPin) {
            atmAudio.playError();
            alert('New PIN and Confirm PIN do not match.');
            return;
        }

        this.switchView('view-processing');
        try {
            const res = await fetch('/api/atm/change-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPin, newPin, confirmPin })
            });
            const data = await res.json();

            if (data.success) {
                atmAudio.playSuccess();
                alert('✅ ' + data.message);
                this.cancelTransaction();
            } else {
                atmAudio.playError();
                alert(data.message);
                this.switchView('view-pinchange');
            }
        } catch (e) {
            atmAudio.playError();
            alert('PIN change failed.');
            this.switchView('view-menu');
        }
    }

    // Thermal Slip Modal Display
    displayReceipt(receipt) {
        document.getElementById('rec-txnid').textContent = receipt.txnId || 'TXN-' + Date.now();
        document.getElementById('rec-date').textContent = new Date(receipt.date || Date.now()).toLocaleString();
        document.getElementById('rec-holder').textContent = receipt.holderName || (this.authenticatedAccount ? this.authenticatedAccount.holderName : 'Customer');
        document.getElementById('rec-card').textContent = receipt.maskedCard || (this.authenticatedAccount ? this.authenticatedAccount.maskedCard : '**** 1234');
        document.getElementById('rec-type').textContent = receipt.txnType || 'TRANSACTION';
        document.getElementById('rec-amt').textContent = receipt.amount ? `₹${receipt.amount.toLocaleString('en-IN')}` : 'N/A';
        document.getElementById('rec-bal').textContent = receipt.balanceAfter !== undefined ? `₹${receipt.balanceAfter.toLocaleString('en-IN')}` : 'N/A';

        document.getElementById('receipt-modal').classList.add('active');
        atmAudio.playSuccess();
    }

    closeReceipt() {
        document.getElementById('receipt-modal').classList.remove('active');
        this.switchView('view-menu');
    }

    printReceipt() {
        window.print();
    }

    // Cancel Transaction & Eject
    async cancelTransaction() {
        atmAudio.playCardSound();
        try {
            await fetch('/api/atm/eject', { method: 'POST' });
        } catch (e) {}

        this.cardData = null;
        this.authenticatedAccount = null;
        this.pinBuffer = '';
        this.updatePinDisplay();

        const cardInput = document.getElementById('card-input');
        if (cardInput) cardInput.value = '';

        const cardPreview = document.getElementById('virtual-card');
        if (cardPreview) cardPreview.classList.remove('inserted');

        this.switchView('view-welcome');
    }
}

// Instantiate ATM Controller when DOM is ready
let atm;
document.addEventListener('DOMContentLoaded', () => {
    atm = new ATMController();
});
