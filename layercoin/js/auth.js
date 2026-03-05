import { auth, db, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, collection, getDocs, orderBy, query, where, limit, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * CORE LOGIC - LIGHTWEIGHT 2D EDITION
 */

// UI Elements
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const btnNextBlog = document.getElementById('btnNextBlog');
const btnPrevBlog = document.getElementById('btnPrevBlog');
const frmWithdraw = document.getElementById('frmWithdraw');
const withdrawRequestsList = document.getElementById('withdrawRequestsList');
const frmNotification = document.getElementById('frmNotification');
const notiBell = document.getElementById('notiBell');
const notiPanel = document.getElementById('notiPanel');
const notiList = document.getElementById('notiList');
const notiBadge = document.getElementById('notiBadge');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const sidebar = document.getElementById('sidebar');

// Ads Management UI
const frmAdsManagement = document.getElementById('frmAdsManagement');

const themeToggleBtn = document.getElementById('themeToggleBtn');

// Capture Referral
const urlParams = new URLSearchParams(window.location.search);
const refCode = urlParams.get('ref');
if (refCode) sessionStorage.setItem('pendingReferral', refCode);

let blogList = [];
let currentTimer = null;
let userPageIndex = 0;

// Sidebar Toggle
if (btnToggleSidebar && sidebar) {
    btnToggleSidebar.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('active');
    });
}

// Notification Bell Toggle
if (notiBell && notiPanel) {
    notiBell.addEventListener('click', (e) => {
        e.stopPropagation();
        notiPanel.style.display = notiPanel.style.display === 'block' ? 'none' : 'block';
    });
}

// Close overlays
document.addEventListener('click', () => {
    if (notiPanel) notiPanel.style.display = 'none';
    if (sidebar) sidebar.classList.remove('active');
});

if (notiPanel) notiPanel.addEventListener('click', (e) => e.stopPropagation());
if (sidebar) sidebar.addEventListener('click', (e) => e.stopPropagation());

// Login
if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            await handleUserRegistration(result.user);
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error("Login Error:", error);
        }
    });
}

// Logout
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        clearBlogActivities();
        await signOut(auth);
        window.location.href = 'index.html';
    });
}

// Register User
async function handleUserRegistration(user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        const referralCode = 'LC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        let referredByUID = null;

        const pendingRef = sessionStorage.getItem('pendingReferral');
        if (pendingRef) {
            const q = query(collection(db, "users"), where("referralCode", "==", pendingRef), limit(1));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) referredByUID = querySnap.docs[0].id;
            sessionStorage.removeItem('pendingReferral');
        }

        await setDoc(userRef, {
            uid: user.uid,
            name: user.displayName || 'Explorer',
            email: user.email,
            coins: 0,
            referralCode,
            referredBy: referredByUID,
            currentPageIndex: 0,
            readNotifications: [],
            joinDate: serverTimestamp()
        });
    }
}

// Auth State Monitor
onAuthStateChanged(auth, async (user) => {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';

    const protectedPages = ['dashboard.html', 'referral.html', 'withdraw.html', 'admin.html'];
    const isProtected = protectedPages.includes(page);

    // Admin security
    if (page === 'admin.html' && user && user.email !== "kn4933300@gmail.com") {
        window.location.replace('dashboard.html');
    }

    if (user) {
        // Universal elements
        if (document.getElementById('userName'))
            document.getElementById('userName').innerText = user.displayName || 'Explorer';

        // Show sidebar and toggle button for logged-in users everywhere
        if (sidebar) sidebar.style.display = 'block';
        if (btnToggleSidebar) btnToggleSidebar.style.display = 'block';

        // Populate based on page
        await populatePageData(user, page);

        if (page === 'admin.html' && user.email === "kn4933300@gmail.com") {
            await loadWithdrawRequests();
            await loadAdsConfig();
        }

        // Hide login, show user info on public pages if logged in
        if (btnLogin) btnLogin.style.display = 'none';
        if (document.getElementById('userName')) document.getElementById('userName').style.display = 'block';
        if (btnLogout) btnLogout.style.display = 'block';

        // Check if admin and update sidebar if needed
        // For now, based on requirement, we don't add Admin to sidebar for normal users.
        // We could add logic here to show it for admins if we had an admin flag.
    } else {
        if (isProtected) {
            window.location.replace('index.html');
        }
        // Hide sidebar and toggle button for logged-out users
        if (sidebar) sidebar.style.display = 'none';
        if (btnToggleSidebar) btnToggleSidebar.style.display = 'none';

        // Show login, hide user info on public pages if logged out
        if (btnLogin) btnLogin.style.display = 'block';
        if (document.getElementById('userName')) document.getElementById('userName').style.display = 'none';
        if (btnLogout) btnLogout.style.display = 'none';
    }
});

async function populatePageData(user, page) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const data = userSnap.data();

        // Common elements across pages
        if (document.getElementById('coinBalance'))
            document.getElementById('coinBalance').innerText = data.coins;

        // Dashboard specific
        if (page === 'dashboard.html') {
            userPageIndex = data.currentPageIndex || 0;
            await initBlogSystem(user.uid, userPageIndex);
            // Notifications are loaded here via loadNotifications
            await loadNotifications(user.uid);
        }

        // Referral specific
        if (page === 'referral.html') {
            if (document.getElementById('referralCodeDisplay'))
                document.getElementById('referralCodeDisplay').innerText = data.referralCode;
            if (document.getElementById('referralLink'))
                document.getElementById('referralLink').innerText = `layercoin.in?ref=${data.referralCode}`;

            // Load referral statistics
            const referralUsersList = document.getElementById('referralUsersList');
            const totalReferrals = document.getElementById('totalReferrals');
            const referralEarnings = document.getElementById('referralEarnings');

            const referralQuery = query(
                collection(db, "users"),
                where("referredBy", "==", user.uid)
            );

            const referralSnap = await getDocs(referralQuery);

            let totalCount = 0;
            let totalEarned = 0;

            if (referralUsersList) referralUsersList.innerHTML = '';

            referralSnap.forEach(docSnap => {
                const refUser = docSnap.data();
                totalCount++;

                // Estimate earnings based on reward logic
                // Each time referral earns 2 coins, referrer earns 0.5 coins
                // So referral earnings = (refUser.coins / 2) * 0.5
                // Simplified = refUser.coins * 0.25

                totalEarned += (refUser.coins || 0) * 0.25;

                if (referralUsersList) {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid var(--border)';
                    tr.innerHTML = `
                        <td style="padding: 0.75rem 0;">${refUser.name}</td>
                        <td style="padding: 0.75rem 0;">${refUser.email}</td>
                    `;
                    referralUsersList.appendChild(tr);
                }
            });

            if (totalReferrals) totalReferrals.innerText = totalCount;
            if (referralEarnings) referralEarnings.innerText = totalEarned.toFixed(2);
        }

        // Withdraw specific
        if (page === 'withdraw.html') {
            const withdrawThresholdMsg = document.getElementById('withdrawThresholdMsg');
            const btnWithdrawSubmit = document.getElementById('btnWithdrawSubmit');
            const thresholdProgress = document.getElementById('thresholdProgress');

            if (withdrawThresholdMsg && btnWithdrawSubmit) {
                const coinsNeeded = 10000 - data.coins;
                if (coinsNeeded > 0) {
                    withdrawThresholdMsg.innerText = `You have ${data.coins} LC. You need ${coinsNeeded.toLocaleString()} more LC to withdraw.`;
                } else {
                    withdrawThresholdMsg.innerText = "Threshold reached! You can now process your withdrawal.";
                }
            }

            if (thresholdProgress) {
                const perc = Math.min((data.coins / 10000) * 100, 100);
                thresholdProgress.style.width = `${perc}%`;
            }
        }
    }
}

// Withdrawal Form logic updated for withdraw.html
if (frmWithdraw) {
    frmWithdraw.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const btnSubmit = document.getElementById('btnWithdrawSubmit');
        const name = document.getElementById('withdrawName').value;
        const phone = document.getElementById('withdrawPhone').value;
        const upi = document.getElementById('withdrawUPI').value;

        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            const data = userSnap.data();
            const currentCoins = data.coins || 0;

            if (currentCoins < 10000) {
                const needed = 10000 - currentCoins;
                return alert(`Insufficient Balance! You have ${currentCoins} LC. You need ${needed.toLocaleString()} more LC to withdraw.`);
            }

            if (btnSubmit) btnSubmit.disabled = true;

            await addDoc(collection(db, "withdrawRequests"), {
                uid: user.uid,
                name: name,
                phone: phone,
                upi: upi,
                coinsRequested: 10000,
                status: "Pending",
                createdAt: serverTimestamp()
            });

            await updateDoc(userRef, { coins: increment(-10000) });

            alert("Withdrawal request submitted successfully.");
            frmWithdraw.reset();
            window.location.reload();

        } catch (error) {
            console.error("Withdraw Error:", error);
            alert("An error occurred during submission. Please try again.");
        } finally {
            if (btnSubmit) btnSubmit.disabled = false;
        }
    });
}

// Notification Signal Sender (Admin)
if (frmNotification) {
    frmNotification.addEventListener('submit', async (e) => {
        e.preventDefault();

        const target = document.getElementById('notiTarget').value;
        const uid = document.getElementById('notiUID').value;
        const title = document.getElementById('notiTitle').value;
        const message = document.getElementById('notiMessage').value;

        try {
            await addDoc(collection(db, "notifications"), {
                title: title,
                message: message,
                target: target,
                userId: target === "specificUser" ? uid : "allUsers",
                createdAt: serverTimestamp(),
                isActive: true
            });

            alert("Notification sent successfully.");
            frmNotification.reset();
        } catch (error) {
            console.error("Notification Error:", error);
            alert("Error sending notification.");
        }
    });
}

// Blog Content Publisher (Admin)
const frmBlog = document.getElementById('frmBlog');
if (frmBlog) {
    frmBlog.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('blogTitleInput').value;
        const content = document.getElementById('blogContentInput').value;
        const imageURL = document.getElementById('blogImageURL').value;
        const videoURL = document.getElementById('blogVideoURL').value;

        try {
            await addDoc(collection(db, "blogs"), {
                title: title,
                content: content,
                imageURL: imageURL || null,
                videoURL: videoURL || null,
                createdAt: serverTimestamp(),
                readCount: 0
            });

            alert("Content published successfully.");
            frmBlog.reset();
        } catch (error) {
            console.error("Publishing Error:", error);
            alert("Error publishing content.");
        }
    });
}

// Blog System
async function initBlogSystem(uid, index) {
    const blogSnap = await getDocs(query(collection(db, "blogs"), orderBy("createdAt", "desc")));
    blogList = blogSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Pre-fetch ads once
    await loadAdsConfig();

    const blogTitle = document.getElementById('blogTitle');
    const blogContent = document.getElementById('blogContent');

    if (blogList.length > 0) {
        loadCurrentBlog(uid, index);
    } else {
        if (blogTitle) blogTitle.innerText = "No content available";
        if (blogContent) blogContent.innerHTML = "<p class='text-muted'>Please check back later for more earning opportunities.</p>";
    }
}

async function loadCurrentBlog(uid, index) {
    if (blogList.length === 0) return;

    const blog = blogList[index % blogList.length];

    const titleEl = document.getElementById('blogTitle');
    const imageEl = document.getElementById('blogImage');
    const videoContainer = document.getElementById('blogVideoContainer');
    const videoEl = document.getElementById('blogVideo');

    if (titleEl) titleEl.innerText = blog.title;

    // Handle Image
    if (imageEl) {
        if (blog.imageURL) {
            imageEl.src = blog.imageURL;
            imageEl.style.display = 'block';
        } else {
            imageEl.style.display = 'none';
        }
    }

    // Handle Video
    if (videoContainer && videoEl) {
        if (blog.videoURL) {
            let embedURL = blog.videoURL;

            // Convert YouTube watch link to embed format
            if (embedURL.includes('watch?v=')) {
                embedURL = embedURL.replace('watch?v=', 'embed/');
            }

            videoEl.src = embedURL;
            videoContainer.style.display = 'block';
        } else {
            videoContainer.style.display = 'none';
            videoEl.src = '';
        }
    }

    // Inject blog content with ads
    injectAds(blog.content);

    // Update page stats
    updatePageStats(index);

    // Start reward timer
    startRewardTimer(uid, blog.id);
}

let platformAds = null;
async function loadAdsConfig() {
    try {
        const adSnap = await getDoc(doc(db, "ads", "mainAds"));
        if (adSnap.exists()) {
            platformAds = adSnap.data();

            // Populate admin form if present
            if (document.getElementById('adBannerCode')) document.getElementById('adBannerCode').value = platformAds.bannerCode || '';
            if (document.getElementById('adNativeCode')) document.getElementById('adNativeCode').value = platformAds.nativeCode || '';
            if (document.getElementById('adSocialCode')) document.getElementById('adSocialCode').value = platformAds.socialBarCode || '';
        }
    } catch (e) {
        console.error("Ads Loading Error:", e);
    }
}

// Ads Management Form (Admin Only)
if (frmAdsManagement) {
    frmAdsManagement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const banner = document.getElementById('adBannerCode').value;
        const native = document.getElementById('adNativeCode').value;
        const social = document.getElementById('adSocialCode').value;

        try {
            await setDoc(doc(db, "ads", "mainAds"), {
                bannerCode: banner,
                nativeCode: native,
                socialBarCode: social
            }, { merge: true });
            alert("Ads configuration updated successfully!");
        } catch (e) {
            console.error("Ads Saving Error:", e);
            alert("Error saving ads configuration.");
        }
    });
}

function injectAds(content) {
    const bannerBox = document.getElementById('adBannerTop');
    const socialBox = document.getElementById('adSocialBottom');
    const contentBox = document.getElementById('blogContent');

    if (bannerBox) {
        bannerBox.innerHTML = platformAds?.bannerCode || '';
        bannerBox.style.display = platformAds?.bannerCode ? 'block' : 'none';
    }
    if (socialBox) socialBox.innerHTML = platformAds?.socialBarCode || '';

    if (contentBox && platformAds?.nativeCode) {
        // Inject native ad after first paragraph
        let html = content;
        const pIndex = html.indexOf('</p>');
        if (pIndex !== -1) {
            const insertionPoint = pIndex + 4;
            html = html.slice(0, insertionPoint) +
                `<div id="adNativeMiddle" style="margin: 1.5rem 0; text-align: center;">${platformAds.nativeCode}</div>` +
                html.slice(insertionPoint);
        } else {
            html += `<div id="adNativeMiddle" style="margin: 1.5rem 0; text-align: center;">${platformAds.nativeCode}</div>`;
        }
        contentBox.innerHTML = html;
    } else if (contentBox) {
        contentBox.innerHTML = content;
    }
}

function updatePageStats(index) {
    const total = blogList.length;
    if (total === 0) return;

    const display = document.getElementById('pageInfoDisplay');
    const pageNum = document.getElementById('pageNumber');
    const completed = document.getElementById('pagesCompleted');
    const remaining = document.getElementById('pagesRemaining');

    if (display) display.style.display = 'block';

    const curPage = (index % total) + 1;
    const compCount = index % total;
    const remCount = total - curPage;

    if (pageNum) pageNum.innerText = `Page ${curPage} of ${total}`;
    if (completed) completed.innerText = compCount;
    if (remaining) remaining.innerText = Math.max(0, remCount);
}

if (btnNextBlog) {
    btnNextBlog.addEventListener('click', () => {
        const user = auth.currentUser;
        if (!user) return;
        userPageIndex++;
        loadCurrentBlog(user.uid, userPageIndex);
    });
}

if (btnPrevBlog) {
    btnPrevBlog.addEventListener('click', () => {
        const user = auth.currentUser;
        if (!user) return;
        if (userPageIndex > 0) {
            userPageIndex--;
            loadCurrentBlog(user.uid, userPageIndex);
        }
    });
}

function startRewardTimer(uid, blogId) {
    clearBlogActivities();

    const duration = Math.floor(Math.random() * (25 - 15 + 1) + 15);
    let timeLeft = duration;

    const timerVal = document.getElementById('rewardTimerVal');

    const timerInterval = setInterval(() => {
        timeLeft--;
        if (timerVal) timerVal.innerText = timeLeft;
        if (timeLeft <= 0) clearInterval(timerInterval);
    }, 1000);

    currentTimer = setTimeout(async () => {
        clearInterval(timerInterval);

        try {
            const userRef = doc(db, "users", uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();

            const nextIndex = (userData.currentPageIndex + 1) % blogList.length;

            await updateDoc(userRef, {
                coins: increment(2),
                currentPageIndex: nextIndex
            });

            if (userData.referredBy) {
                const referrerRef = doc(db, "users", userData.referredBy);
                await updateDoc(referrerRef, { coins: increment(0.5) }); // ₹0.005 = 0.5 coins
            }

            await updateDoc(doc(db, "blogs", blogId), {
                readCount: increment(1)
            });

            // Update local balance if on dashboard
            if (document.getElementById('coinBalance')) {
                const current = parseInt(document.getElementById('coinBalance').innerText) || 0;
                document.getElementById('coinBalance').innerText = current + 2;

                // Update page stats for dashboard
                userPageIndex = nextIndex;
                updatePageStats(userPageIndex);
            }

        } catch (e) {
            console.error(e);
        }

    }, duration * 1000);
}

async function loadNotifications(uid) {
    if (!notiList) return;

    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const readNotifs = userData?.readNotifications || [];

        // Dual Queries
        const qAll = query(collection(db, "notifications"),
            where("target", "==", "allUsers"),
            where("isActive", "==", true),
            orderBy("createdAt", "desc"),
            limit(20));

        const qSpecific = query(collection(db, "notifications"),
            where("target", "==", "specificUser"),
            where("userId", "==", uid),
            where("isActive", "==", true),
            orderBy("createdAt", "desc"),
            limit(20));

        const [snapAll, snapSpecific] = await Promise.all([getDocs(qAll), getDocs(qSpecific)]);

        let allNotifs = [];
        snapAll.forEach(d => allNotifs.push({ id: d.id, ...d.data() }));
        snapSpecific.forEach(d => allNotifs.push({ id: d.id, ...d.data() }));

        // Merge and Sort
        allNotifs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        allNotifs = allNotifs.slice(0, 20);

        // Render
        notiList.innerHTML = '';
        let unreadCount = 0;
        const visibleIds = [];

        if (allNotifs.length === 0) {
            notiList.innerHTML = '<p class="text-muted" style="text-align: center; padding: 1rem;">No notifications</p>';
        } else {
            allNotifs.forEach(n => {
                visibleIds.push(n.id);
                const isRead = readNotifs.includes(n.id);
                if (!isRead) unreadCount++;

                const date = n.createdAt?.toDate() ? n.createdAt.toDate().toLocaleDateString() : 'Recent';

                const item = document.createElement('div');
                item.style.padding = '0.75rem';
                item.style.borderBottom = '1px solid var(--border)';
                item.style.background = isRead ? 'transparent' : 'rgba(var(--primary-rgb), 0.05)';
                item.innerHTML = `
                    <div class="font-bold" style="font-size: 0.9rem;">${n.title}</div>
                    <div style="font-size: 0.8rem; margin: 0.25rem 0;">${n.message}</div>
                    <div class="text-muted" style="font-size: 0.7rem;">${date}</div>
                `;
                notiList.appendChild(item);
            });
        }

        // Badge Update
        if (notiBadge) {
            notiBadge.innerText = unreadCount;
            notiBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }

        // Mark All Read logic
        const btnMarkAllRead = document.getElementById('btnMarkAllRead');
        if (btnMarkAllRead) {
            // Remove old listeners to avoid duplicates
            const newBtn = btnMarkAllRead.cloneNode(true);
            btnMarkAllRead.parentNode.replaceChild(newBtn, btnMarkAllRead);

            newBtn.addEventListener('click', async () => {
                if (visibleIds.length > 0) {
                    const { arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    await updateDoc(userRef, {
                        readNotifications: arrayUnion(...visibleIds)
                    });
                    if (notiBadge) notiBadge.style.display = 'none';
                    await loadNotifications(uid);
                }
            });
        }

    } catch (e) {
        console.error("Notifications Error:", e);
    }
}

async function loadWithdrawRequests() {
    if (!withdrawRequestsList) return;

    const q = query(collection(db, "withdrawRequests"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    withdrawRequestsList.innerHTML = '';

    snap.forEach(docSnap => {
        const r = docSnap.data();

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.name}</td>
            <td>${r.coinsRequested}</td>
            <td><code>${r.upi}</code></td>
            <td>${r.status}</td>
            <td>
                ${r.status === 'Pending'
                ? `<button onclick="updateWithdrawStatus('${docSnap.id}', 'Approved')" class="btn btn-outline">Approve</button>`
                : 'OK'}
            </td>
        `;
        withdrawRequestsList.appendChild(tr);
    });
}

window.updateWithdrawStatus = async (id, status) => {
    try {
        const snap = await getDoc(doc(db, "withdrawRequests", id));

        await updateDoc(doc(db, "withdrawRequests", id), {
            status: status
        });

        await addDoc(collection(db, "notifications"), {
            title: `Withdrawal ${status}`,
            message: `Your withdrawal request was ${status.toLowerCase()}.`,
            target: "specificUser",
            userId: snap.data().uid,
            createdAt: serverTimestamp(),
            isActive: true
        });

        alert("Withdrawal status updated.");
        loadWithdrawRequests();
    } catch (error) {
        console.error("Withdraw Update Error:", error);
        alert("Error updating withdrawal status.");
    }
};

function clearBlogActivities() {
    if (currentTimer) clearTimeout(currentTimer);
}

// Dark Mode System
function applySavedTheme() {
    const savedTheme = localStorage.getItem('layercoin-theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggleBtn) themeToggleBtn.innerText = '☀️';
    }
}

applySavedTheme();

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');

        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('layercoin-theme', 'dark');
            themeToggleBtn.innerText = '☀️';
        } else {
            localStorage.setItem('layercoin-theme', 'light');
            themeToggleBtn.innerText = '🌙';
        }
    });
}
