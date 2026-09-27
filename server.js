const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');

// Import models
const User = require('./model/user');
const Account = require('./model/account');
const Transaction = require('./model/transaction');

const app = express();
const PORT = process.env.PORT || 3000;

// Express Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/user', express.static(path.join(__dirname, 'user')));

// Session configuration
app.use(session({
    secret: 'atm_cyber_bank_secure_session_key_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2 hours session
}));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://girija282911_db_user:bHCNQfBfXQfzX6aI@cluster0.biktue0.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB Atlas successfully');
        await seedDemoAccounts();
    })
    .catch((err) => {
        console.error('❌ Error connecting to MongoDB:', err.message);
    });

// Automatic Demo Account Seeder
async function seedDemoAccounts() {
    try {
        const count = await Account.countDocuments();
        if (count === 0) {
            console.log('🌱 No accounts found. Seeding initial demo ATM accounts...');
            const demoAccounts = [
                {
                    accnum: '1001202401',
                    cardnum: '4532891023456789',
                    pinnum: '1234',
                    holderName: 'Girija Sundaram',
                    accbls: 65000,
                    accType: 'Savings',
                    phone: '9876543210',
                    email: 'girija@example.com',
                    dailyLimit: 50000,
                    status: 'Active',
                    failedAttempts: 0
                },
                {
                    accnum: '1001202402',
                    cardnum: '5241638944129012',
                    pinnum: '5678',
                    holderName: 'Karthik Raman',
                    accbls: 35000,
                    accType: 'Current',
                    phone: '9876543211',
                    email: 'karthik@example.com',
                    dailyLimit: 100000,
                    status: 'Active',
                    failedAttempts: 0
                },
                {
                    accnum: '1001202403',
                    cardnum: '6071882311094321',
                    pinnum: '9999',
                    holderName: 'Priya Selvam',
                    accbls: 120000,
                    accType: 'Savings',
                    phone: '9876543212',
                    email: 'priya@example.com',
                    dailyLimit: 50000,
                    status: 'Active',
                    failedAttempts: 0
                }
            ];

            const created = await Account.insertMany(demoAccounts);
            console.log(`✅ Successfully seeded ${created.length} demo ATM accounts.`);

            // Seed initial sample transactions
            await Transaction.create([
                {
                    txnId: 'TXN' + (Date.now() - 86400000),
                    accnum: '1001202401',
                    cardnum: '4532891023456789',
                    txnType: 'DEPOSIT',
                    amount: 25000,
                    balanceAfter: 65000,
                    details: 'Cash Deposit at ATM Kiosk',
                    createdAt: new Date(Date.now() - 86400000)
                },
                {
                    txnId: 'TXN' + (Date.now() - 43200000),
                    accnum: '1001202401',
                    cardnum: '4532891023456789',
                    txnType: 'WITHDRAWAL',
                    amount: 5000,
                    balanceAfter: 60000,
                    details: 'ATM Cash Withdrawal',
                    createdAt: new Date(Date.now() - 43200000)
                }
            ]);
        }
    } catch (err) {
        console.error('Error seeding demo data:', err);
    }
}

// Helper function to generate unique Txn ID
function generateTxnId() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TXN-${timestamp}-${random}`;
}

// Middleware to check ATM Authentication
const requireAtmAuth = async (req, res, next) => {
    if (!req.session.atmAccountId || !req.session.atmAuthenticated) {
        return res.status(401).json({
            success: false,
            message: 'ATM Session expired or unauthorized. Please re-insert your card.'
        });
    }

    try {
        const account = await Account.findById(req.session.atmAccountId);
        if (!account) {
            req.session.atmAccountId = null;
            req.session.atmAuthenticated = false;
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }
        if (account.status === 'Blocked') {
            req.session.atmAccountId = null;
            req.session.atmAuthenticated = false;
            return res.status(403).json({ success: false, message: 'Your card is blocked. Please contact branch.' });
        }
        req.account = account;
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error verifying session.' });
    }
};

// ==========================================
// 🏧 ATM API ENDPOINTS
// ==========================================

// 1. Get Demo Accounts (For 1-click testing in UI)
app.get('/api/atm/demo-accounts', async (req, res) => {
    try {
        const accounts = await Account.find().select('accnum cardnum holderName accbls accType status');
        res.json({ success: true, accounts });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch demo accounts' });
    }
});

// 2. Validate Card / Account Number
app.post('/api/atm/validate-card', async (req, res) => {
    try {
        let { cardOrAcc } = req.body;
        if (!cardOrAcc) {
            return res.status(400).json({ success: false, message: 'Please enter card or account number.' });
        }

        // Clean input (remove spaces, hyphens)
        const cleanInput = cardOrAcc.toString().replace(/[\s-]/g, '');

        const account = await Account.findOne({
            $or: [
                { cardnum: cleanInput },
                { accnum: cleanInput }
            ]
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Invalid Card or Account Number. No matching record found.'
            });
        }

        if (account.status === 'Blocked') {
            return res.status(403).json({
                success: false,
                blocked: true,
                message: 'This Card / Account is BLOCKED due to security reasons. Please contact your nearest bank branch.'
            });
        }

        // Set partial session (awaiting PIN)
        req.session.atmAccountId = account._id.toString();
        req.session.atmAuthenticated = false;

        // Mask card number for security (e.g. 4532 **** **** 6789)
        const rawCard = account.cardnum || account.accnum;
        const masked = rawCard.length >= 12
            ? `${rawCard.slice(0, 4)} **** **** ${rawCard.slice(-4)}`
            : `**** ${rawCard.slice(-4)}`;

        res.json({
            success: true,
            message: 'Card validated. Please enter your secret PIN.',
            holderName: account.holderName,
            maskedCard: masked,
            accType: account.accType
        });
    } catch (err) {
        console.error('Error validating card:', err);
        res.status(500).json({ success: false, message: 'Server error during card validation.' });
    }
});

// 3. Verify PIN
app.post('/api/atm/verify-pin', async (req, res) => {
    try {
        const { pin } = req.body;
        if (!req.session.atmAccountId) {
            return res.status(400).json({ success: false, message: 'No active card session. Please insert card first.' });
        }

        if (!pin || pin.toString().length !== 4) {
            return res.status(400).json({ success: false, message: 'Please enter a valid 4-digit PIN.' });
        }

        const account = await Account.findById(req.session.atmAccountId);
        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        if (account.status === 'Blocked') {
            return res.status(403).json({ success: false, blocked: true, message: 'Card is blocked.' });
        }

        // Compare PIN
        if (account.pinnum.toString() === pin.toString()) {
            // Success: Reset failed attempts & authenticate
            account.failedAttempts = 0;
            await account.save();

            req.session.atmAuthenticated = true;

            const rawCard = account.cardnum || account.accnum;
            const masked = rawCard.length >= 12
                ? `${rawCard.slice(0, 4)} **** **** ${rawCard.slice(-4)}`
                : `**** ${rawCard.slice(-4)}`;

            return res.json({
                success: true,
                message: 'PIN Verified Successfully.',
                account: {
                    holderName: account.holderName,
                    accnum: account.accnum,
                    maskedCard: masked,
                    accbls: account.accbls,
                    accType: account.accType,
                    dailyLimit: account.dailyLimit
                }
            });
        } else {
            // Incorrect PIN: increment failed attempts
            account.failedAttempts = (account.failedAttempts || 0) + 1;
            const remaining = 3 - account.failedAttempts;

            if (account.failedAttempts >= 3) {
                account.status = 'Blocked';
                await account.save();
                req.session.atmAccountId = null;
                req.session.atmAuthenticated = false;
                return res.status(403).json({
                    success: false,
                    blocked: true,
                    message: 'Incorrect PIN entered 3 times! Your card has been temporarily BLOCKED for security.'
                });
            } else {
                await account.save();
                return res.status(401).json({
                    success: false,
                    remainingAttempts: remaining,
                    message: `Incorrect PIN! You have ${remaining} attempt(s) remaining.`
                });
            }
        }
    } catch (err) {
        console.error('Error verifying PIN:', err);
        res.status(500).json({ success: false, message: 'Server error verifying PIN.' });
    }
});

// 4. Get Account Summary / Balance Enquiry
app.get('/api/atm/account-info', requireAtmAuth, async (req, res) => {
    const acc = req.account;
    const rawCard = acc.cardnum || acc.accnum;
    const masked = rawCard.length >= 12
        ? `${rawCard.slice(0, 4)} **** **** ${rawCard.slice(-4)}`
        : `**** ${rawCard.slice(-4)}`;

    // Log balance enquiry transaction optionally
    const txnId = generateTxnId();

    res.json({
        success: true,
        account: {
            holderName: acc.holderName,
            accnum: acc.accnum,
            maskedCard: masked,
            accbls: acc.accbls,
            accType: acc.accType,
            dailyLimit: acc.dailyLimit,
            phone: acc.phone,
            email: acc.email
        },
        receipt: {
            txnId,
            date: new Date(),
            atmId: 'ATM-TN-CHN-008',
            location: 'Chennai Central Branch, TN',
            availableBalance: acc.accbls
        }
    });
});

// 5. Cash Withdrawal & Fast Cash
app.post('/api/atm/withdraw', requireAtmAuth, async (req, res) => {
    try {
        const { amount, isFastCash } = req.body;
        const withdrawAmount = Number(amount);

        if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Please enter a valid withdrawal amount.' });
        }

        if (withdrawAmount % 100 !== 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount. Please enter in multiples of ₹100, ₹200, or ₹500.'
            });
        }

        if (withdrawAmount > 25000) {
            return res.status(400).json({
                success: false,
                message: 'Single transaction limit is ₹25,000. Please enter a lower amount.'
            });
        }

        const account = req.account;

        if (account.accbls < withdrawAmount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient Funds! Available Balance: ₹${account.accbls.toLocaleString('en-IN')}`,
                availableBalance: account.accbls
            });
        }

        // Deduct balance
        account.accbls -= withdrawAmount;
        await account.save();

        const txnId = generateTxnId();
        const txnType = isFastCash ? 'FAST_CASH' : 'WITHDRAWAL';

        // Calculate note dispensation breakdown (Greedy note dispenser simulation)
        let rem = withdrawAmount;
        const count500 = Math.floor(rem / 500);
        rem %= 500;
        const count200 = Math.floor(rem / 200);
        rem %= 200;
        const count100 = Math.floor(rem / 100);

        const breakdown = {
            '500': count500,
            '200': count200,
            '100': count100
        };

        // Create transaction record
        const txn = await Transaction.create({
            txnId,
            accnum: account.accnum,
            cardnum: account.cardnum,
            txnType,
            amount: withdrawAmount,
            balanceAfter: account.accbls,
            details: `ATM Cash Withdrawal (${isFastCash ? 'Fast Cash' : 'Standard'})`,
            status: 'SUCCESS'
        });

        res.json({
            success: true,
            message: 'Cash dispensed successfully. Please collect your cash and card.',
            amount: withdrawAmount,
            balanceAfter: account.accbls,
            notesDispensed: breakdown,
            receipt: {
                txnId,
                txnType,
                amount: withdrawAmount,
                balanceAfter: account.accbls,
                date: txn.createdAt,
                holderName: account.holderName,
                maskedCard: `${account.cardnum.slice(0, 4)} **** **** ${account.cardnum.slice(-4)}`,
                atmId: 'ATM-TN-CHN-008',
                location: 'Chennai Central Branch, TN'
            }
        });
    } catch (err) {
        console.error('Error processing withdrawal:', err);
        res.status(500).json({ success: false, message: 'Failed to process cash withdrawal.' });
    }
});

// 6. Cash Deposit (CDM)
app.post('/api/atm/deposit', requireAtmAuth, async (req, res) => {
    try {
        const { count100 = 0, count200 = 0, count500 = 0, directAmount } = req.body;

        let depositAmount = 0;
        let breakdown = { '100': 0, '200': 0, '500': 0 };

        if (directAmount && Number(directAmount) > 0) {
            depositAmount = Number(directAmount);
            breakdown['500'] = Math.floor(depositAmount / 500);
            let r = depositAmount % 500;
            breakdown['200'] = Math.floor(r / 200);
            r %= 200;
            breakdown['100'] = Math.floor(r / 100);
        } else {
            const n100 = Math.max(0, parseInt(count100) || 0);
            const n200 = Math.max(0, parseInt(count200) || 0);
            const n500 = Math.max(0, parseInt(count500) || 0);

            depositAmount = (n100 * 100) + (n200 * 200) + (n500 * 500);
            breakdown = { '100': n100, '200': n200, '500': n500 };
        }

        if (depositAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Please insert at least one acceptable note (₹100, ₹200, or ₹500).' });
        }

        if (depositAmount > 100000) {
            return res.status(400).json({ success: false, message: 'Maximum deposit limit per transaction is ₹1,00,000.' });
        }

        const account = req.account;
        account.accbls += depositAmount;
        await account.save();

        const txnId = generateTxnId();

        const txn = await Transaction.create({
            txnId,
            accnum: account.accnum,
            cardnum: account.cardnum,
            txnType: 'DEPOSIT',
            amount: depositAmount,
            balanceAfter: account.accbls,
            details: `Cash Deposit (500x${breakdown['500']}, 200x${breakdown['200']}, 100x${breakdown['100']})`,
            status: 'SUCCESS'
        });

        res.json({
            success: true,
            message: 'Cash deposited and credited successfully!',
            amount: depositAmount,
            breakdown,
            balanceAfter: account.accbls,
            receipt: {
                txnId,
                txnType: 'DEPOSIT',
                amount: depositAmount,
                breakdown,
                balanceAfter: account.accbls,
                date: txn.createdAt,
                holderName: account.holderName,
                maskedCard: `${account.cardnum.slice(0, 4)} **** **** ${account.cardnum.slice(-4)}`,
                atmId: 'ATM-TN-CHN-008',
                location: 'Chennai Central Branch, TN'
            }
        });
    } catch (err) {
        console.error('Error processing deposit:', err);
        res.status(500).json({ success: false, message: 'Failed to process cash deposit.' });
    }
});

// 7. Verify Beneficiary for Transfer
app.post('/api/atm/check-beneficiary', requireAtmAuth, async (req, res) => {
    try {
        const { targetAccnum } = req.body;
        if (!targetAccnum) {
            return res.status(400).json({ success: false, message: 'Please enter target account number.' });
        }

        const cleanTarget = targetAccnum.toString().replace(/[\s-]/g, '');
        if (cleanTarget === req.account.accnum || cleanTarget === req.account.cardnum) {
            return res.status(400).json({ success: false, message: 'You cannot transfer funds to your own account.' });
        }

        const target = await Account.findOne({
            $or: [
                { accnum: cleanTarget },
                { cardnum: cleanTarget }
            ]
        });

        if (!target) {
            return res.status(404).json({ success: false, message: 'Beneficiary account number not found.' });
        }

        res.json({
            success: true,
            targetAccnum: target.accnum,
            holderName: target.holderName,
            accType: target.accType
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error checking beneficiary account.' });
    }
});

// 8. Fund Transfer (Card-to-Account / Account-to-Account)
app.post('/api/atm/transfer', requireAtmAuth, async (req, res) => {
    try {
        const { targetAccnum, amount } = req.body;
        const transferAmount = Number(amount);

        if (!transferAmount || transferAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Please enter a valid transfer amount.' });
        }

        const sender = req.account;
        if (sender.accbls < transferAmount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance! Available: ₹${sender.accbls.toLocaleString('en-IN')}`
            });
        }

        const cleanTarget = targetAccnum.toString().replace(/[\s-]/g, '');
        if (cleanTarget === sender.accnum || cleanTarget === sender.cardnum) {
            return res.status(400).json({ success: false, message: 'Sender and recipient account cannot be the same.' });
        }

        const recipient = await Account.findOne({
            $or: [
                { accnum: cleanTarget },
                { cardnum: cleanTarget }
            ]
        });

        if (!recipient) {
            return res.status(404).json({ success: false, message: 'Beneficiary account does not exist.' });
        }

        if (recipient.status === 'Blocked') {
            return res.status(400).json({ success: false, message: 'Cannot transfer funds to a blocked account.' });
        }

        // Perform Transfer Atomically
        sender.accbls -= transferAmount;
        recipient.accbls += transferAmount;

        await sender.save();
        await recipient.save();

        const txnId = generateTxnId();

        // Transaction log for sender
        const txnSender = await Transaction.create({
            txnId,
            accnum: sender.accnum,
            cardnum: sender.cardnum,
            txnType: 'TRANSFER_SENT',
            amount: transferAmount,
            balanceAfter: sender.accbls,
            targetAccnum: recipient.accnum,
            targetHolderName: recipient.holderName,
            details: `Transferred to ${recipient.holderName} (A/C: ${recipient.accnum})`,
            status: 'SUCCESS'
        });

        // Transaction log for recipient
        await Transaction.create({
            txnId: generateTxnId(),
            accnum: recipient.accnum,
            cardnum: recipient.cardnum,
            txnType: 'TRANSFER_RECEIVED',
            amount: transferAmount,
            balanceAfter: recipient.accbls,
            targetAccnum: sender.accnum,
            targetHolderName: sender.holderName,
            details: `Received from ${sender.holderName} (A/C: ${sender.accnum})`,
            status: 'SUCCESS'
        });

        res.json({
            success: true,
            message: `₹${transferAmount.toLocaleString('en-IN')} transferred successfully to ${recipient.holderName}.`,
            amount: transferAmount,
            targetHolderName: recipient.holderName,
            targetAccnum: recipient.accnum,
            balanceAfter: sender.accbls,
            receipt: {
                txnId,
                txnType: 'FUND_TRANSFER',
                amount: transferAmount,
                recipient: recipient.holderName,
                recipientAcc: recipient.accnum,
                balanceAfter: sender.accbls,
                date: txnSender.createdAt,
                holderName: sender.holderName,
                maskedCard: `${sender.cardnum.slice(0, 4)} **** **** ${sender.cardnum.slice(-4)}`,
                atmId: 'ATM-TN-CHN-008',
                location: 'Chennai Central Branch, TN'
            }
        });
    } catch (err) {
        console.error('Error processing transfer:', err);
        res.status(500).json({ success: false, message: 'Transfer failed. Server error.' });
    }
});

// 9. PIN Change
app.post('/api/atm/change-pin', requireAtmAuth, async (req, res) => {
    try {
        const { oldPin, newPin, confirmPin } = req.body;

        if (!oldPin || !newPin || !confirmPin) {
            return res.status(400).json({ success: false, message: 'All PIN fields are required.' });
        }

        if (newPin.toString().length !== 4 || !/^\d{4}$/.test(newPin.toString())) {
            return res.status(400).json({ success: false, message: 'New PIN must be exactly 4 numerical digits.' });
        }

        if (newPin.toString() !== confirmPin.toString()) {
            return res.status(400).json({ success: false, message: 'New PIN and Confirm PIN do not match.' });
        }

        const account = req.account;
        if (account.pinnum.toString() !== oldPin.toString()) {
            return res.status(401).json({ success: false, message: 'Current PIN is incorrect.' });
        }

        if (account.pinnum.toString() === newPin.toString()) {
            return res.status(400).json({ success: false, message: 'New PIN cannot be the same as your old PIN.' });
        }

        account.pinnum = newPin.toString();
        await account.save();

        const txnId = generateTxnId();
        await Transaction.create({
            txnId,
            accnum: account.accnum,
            cardnum: account.cardnum,
            txnType: 'PIN_CHANGE',
            amount: 0,
            balanceAfter: account.accbls,
            details: 'ATM PIN Changed Successfully',
            status: 'SUCCESS'
        });

        res.json({
            success: true,
            message: 'Your ATM PIN has been changed successfully. Please remember your new PIN.',
            receipt: {
                txnId,
                txnType: 'PIN_CHANGE',
                date: new Date(),
                holderName: account.holderName,
                maskedCard: `${account.cardnum.slice(0, 4)} **** **** ${account.cardnum.slice(-4)}`,
                atmId: 'ATM-TN-CHN-008',
                location: 'Chennai Central Branch, TN'
            }
        });
    } catch (err) {
        console.error('Error changing PIN:', err);
        res.status(500).json({ success: false, message: 'Failed to change PIN.' });
    }
});

// 10. Mini Statement
app.get('/api/atm/mini-statement', requireAtmAuth, async (req, res) => {
    try {
        const account = req.account;
        const transactions = await Transaction.find({ accnum: account.accnum })
            .sort({ createdAt: -1 })
            .limit(10);

        const rawCard = account.cardnum || account.accnum;
        const masked = rawCard.length >= 12
            ? `${rawCard.slice(0, 4)} **** **** ${rawCard.slice(-4)}`
            : `**** ${rawCard.slice(-4)}`;

        res.json({
            success: true,
            holderName: account.holderName,
            accnum: account.accnum,
            maskedCard: masked,
            currentBalance: account.accbls,
            accType: account.accType,
            transactions,
            receipt: {
                txnId: generateTxnId(),
                date: new Date(),
                atmId: 'ATM-TN-CHN-008',
                location: 'Chennai Central Branch, TN'
            }
        });
    } catch (err) {
        console.error('Error fetching mini statement:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve mini statement.' });
    }
});

// 11. End ATM Session / Eject Card
app.post('/api/atm/eject', (req, res) => {
    req.session.atmAccountId = null;
    req.session.atmAuthenticated = false;
    res.json({ success: true, message: 'Card ejected. Session ended safely.' });
});

// ==========================================
// 🛡️ ADMIN MANAGEMENT & AUDIT API ENDPOINTS
// ==========================================

// Get All Customer Accounts
app.get('/api/admin/accounts', async (req, res) => {
    try {
        const accounts = await Account.find().sort({ createdAt: -1 });
        res.json({ success: true, accounts });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch accounts.' });
    }
});

// Create New Account
app.post('/api/admin/accounts', async (req, res) => {
    try {
        const { accnum, cardnum, pinnum, holderName, accbls, accType, phone, email } = req.body;

        if (!accnum || !cardnum || !pinnum || !holderName) {
            return res.status(400).json({ success: false, message: 'Account No, Card No, PIN, and Name are required.' });
        }

        const existing = await Account.findOne({
            $or: [{ accnum: accnum.trim() }, { cardnum: cardnum.trim() }]
        });

        if (existing) {
            return res.status(400).json({ success: false, message: 'Account or Card number already exists.' });
        }

        const newAccount = new Account({
            accnum: accnum.trim(),
            cardnum: cardnum.trim(),
            pinnum: pinnum.trim(),
            holderName: holderName.trim(),
            accbls: Number(accbls) || 0,
            accType: accType || 'Savings',
            phone: phone || '9876543210',
            email: email || 'customer@example.com',
            status: 'Active',
            failedAttempts: 0
        });

        await newAccount.save();
        res.json({ success: true, message: 'Account created successfully!', account: newAccount });
    } catch (err) {
        console.error('Error creating account:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to create account.' });
    }
});

// Update Account (Balance, PIN, Status)
app.put('/api/admin/accounts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { holderName, accbls, pinnum, accType, status, dailyLimit } = req.body;

        const updateData = {};
        if (holderName) updateData.holderName = holderName;
        if (accbls !== undefined) updateData.accbls = Number(accbls);
        if (pinnum) updateData.pinnum = pinnum;
        if (accType) updateData.accType = accType;
        if (status) {
            updateData.status = status;
            if (status === 'Active') updateData.failedAttempts = 0; // unblock resets attempts
        }
        if (dailyLimit) updateData.dailyLimit = Number(dailyLimit);

        const updated = await Account.findByIdAndUpdate(id, updateData, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'Account not found.' });

        res.json({ success: true, message: 'Account updated successfully!', account: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update account.' });
    }
});

// Delete Account
app.delete('/api/admin/accounts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const account = await Account.findByIdAndDelete(id);
        if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });

        // Clean up transactions
        await Transaction.deleteMany({ accnum: account.accnum });

        res.json({ success: true, message: 'Account and associated records deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete account.' });
    }
});

// Get All System Transactions (Audit Log)
app.get('/api/admin/transactions', async (req, res) => {
    try {
        const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(50);
        res.json({ success: true, transactions });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch transaction logs.' });
    }
});

// Reset / Re-seed Demo Data
app.post('/api/admin/reset-demo', async (req, res) => {
    try {
        await Account.deleteMany({});
        await Transaction.deleteMany({});
        await seedDemoAccounts();
        res.json({ success: true, message: 'Demo accounts and transaction history reset successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to reset demo data.' });
    }
});

// ==========================================
// 🌐 LEGACY & ADMIN WEB PAGE ROUTES
// ==========================================

// Legacy Schema compatibility
const FormData = mongoose.models.FormData || mongoose.model("FormData", new mongoose.Schema({
    userid: String,
    accnum: Number,
    pinnum: Number,
    accbls: Number
}));

// Admin & Legacy Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));
app.get('/add', (req, res) => res.sendFile(path.join(__dirname, 'public/add.html')));
app.get('/read', (req, res) => res.sendFile(path.join(__dirname, 'public/read.html')));
app.get('/edit', (req, res) => res.sendFile(path.join(__dirname, 'public/edit.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'public/about.html')));

// Legacy ATM subpages redirecting cleanly to unified ATM interface or user templates
app.get('/pin', (req, res) => res.redirect('/'));
app.get('/language', (req, res) => res.redirect('/'));
app.get('/option', (req, res) => res.redirect('/'));
app.get('/banking', (req, res) => res.redirect('/'));
app.get('/withdraw', (req, res) => res.redirect('/'));
app.get('/deposit', (req, res) => res.redirect('/'));
app.get('/fast', (req, res) => res.redirect('/'));
app.get('/summary', (req, res) => res.redirect('/'));
app.get('/confirm', (req, res) => res.redirect('/'));
app.get('/complete', (req, res) => res.redirect('/'));
app.get('/cancel', (req, res) => res.redirect('/'));

// Legacy Admin Form handlers
app.get('/getdata', async (req, res) => {
    try {
        const data = await Account.find();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.get("/read/:id", async (req, res) => {
    try {
        const userdata = await Account.findById(req.params.id);
        res.json(userdata);
    } catch (error) {
        res.status(500).send("An error occurred.");
    }
});

app.delete("/delete/:id", async (req, res) => {
    try {
        await Account.findByIdAndDelete(req.params.id);
        res.send("Deleted successfully.");
    } catch (error) {
        res.status(500).send("An error occurred.");
    }
});

app.post('/submit', async (req, res) => {
    const { accnum, pinnum, accbls, name } = req.body;
    try {
        const newAcc = new Account({
            accnum: accnum.toString(),
            cardnum: accnum.toString(),
            pinnum: pinnum.toString(),
            holderName: name || 'Customer',
            accbls: Number(accbls) || 0
        });
        await newAcc.save();
        res.send(`
        <script>
        alert("Account added successfully!");
        window.location.href = '/read';
        </script>
        `);
    } catch (error) {
        res.status(500).send('Failed to store data.');
    }
});

app.post('/update', async (req, res) => {
    try {
        const { id, accnum, pinnum, accbls, holderName } = req.body;
        await Account.findByIdAndUpdate(id, {
            accnum,
            cardnum: accnum,
            pinnum,
            accbls: Number(accbls),
            holderName: holderName || 'Customer'
        });
        res.send(`
        <script>
        alert("Data updated successfully!");
        window.location.href = '/read';
        </script>
        `);
    } catch (error) {
        res.status(500).send('Failed to update data.');
    }
});

app.post('/acc/register', async (req, res) => {
    const { name, mail, pass } = req.body;
    try {
        const existingUser = await User.findOne({ mail });
        if (existingUser) {
            return res.send(`
                <script>
                    alert("Email is already registered.");
                    window.location.href = '/register';
                </script>
            `);
        }
        const newUser = new User({ name, mail, pass });
        await newUser.save();
        return res.send(`
            <script>
                alert("Registration successful! Please login.");
                window.location.href = '/login';
            </script>
        `);
    } catch (error) {
        res.status(500).send('Registration failed.');
    }
});

app.post('/acc/login', async (req, res) => {
    const { mail, pass } = req.body;
    try {
        const user = await User.findOne({ mail, pass });
        if (!user) {
            return res.send(`
                <script>
                    alert("Invalid email or password.");
                    window.location.href = '/login';
                </script>
            `);
        }
        req.session.userId = user._id;
        return res.send(`
            <script>
                alert("Login successful.");
                window.location.href = '/admin';
            </script>
        `);
    } catch (error) {
        res.status(500).send('Login failed.');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.send(`
            <script>
                alert("Logged out successfully");
                window.location.href = '/';
            </script>
        `);
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Bank of Tamil Nadu ATM Server is running at http://localhost:${PORT}`);
});
