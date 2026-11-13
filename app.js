// Main application logic and routing

let currentPage = 'submit';
let currentGuesser = '';
let selectedWeek = Storage.getCurrentWeek();
let isLoading = false;
let currentWeekTheme = null;
const HARRY_HILL_IMAGE = 'images/harry-hill.jpg';
const HARRY_HILL_NO_THEME_IMAGE = 'images/harry-hill/JS47551015.avif';
const HARRY_HILL_IMAGES = [
    'images/harry-hill/2609.jpg',
    'images/harry-hill/3000.jpg',
    'images/harry-hill/harry_hill_cin_2013_1.jpg',
    'images/harry-hill/Harry-Hill-BBC-pay-salary-net-worth-World-Of-TV-Burp-news-latest-update-2622680.jpg',
    'images/harry-hill/harry_hill_image2.jpg',
    'images/harry-hill/Harry-Hill-WEB.jpg',
    'images/harry-hill/JS47551015.avif'
];

const GAME_SHOW_TITLE = 'Who Wants To Be An Album Game Millionaire? (Previously The All New All-New Album Game (AI Super Deluxe Edition))';

const CHRIS_IMAGE_5050 = 'images/chris-tarrant/842328698_18380646265239409_2468023915473924986_n.jpg';
const CHRIS_IMAGE_AUDIENCE = 'images/chris-tarrant/843205650_18380646262239409_1717322556819931312_n.jpg';
const CHRIS_IMAGE_PHONE = 'images/chris-tarrant/0_CD31326899.avif';
const LIFELINE_ICON_5050 = 'images/lifelines/50-50_2018.webp';
const LIFELINE_ICON_AUDIENCE = 'images/lifelines/ATA_2018.webp';
const LIFELINE_ICON_PHONE = 'images/lifelines/PAF_2018.webp';
const LIFELINE_CONFIRM_BODY = '<p>This lifeline can only be used once per week.</p><p>If you use it on this album, your score for this guess is halved (multiple lifelines on the same album keep halving).</p>';
const NOEL_BANKER_IMAGE = 'images/noel-edmunds/1_Noel-Edmonds-Deal-or-No-Deal.avif';
const JIM_BOWEN_IMAGE = 'images/jim-bowen/4319.jpg';
const MR_BLOBBY_IMAGE = 'images/mr-blobby/SEI_229300029-e519.webp';
const RICHARD_OBRIEN_IMAGE = 'images/richard-obrien/MAIN-Richard-OBrien.avif';
const ROY_WALKER_IMAGE = 'images/roy-walker/catchphrase-tv---roy-walker-440nw-814149as.jpg';

const LETTER_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Same hash mixing as seededShuffle */
function stringToHash32(str) {
    let seed = 0;
    for (let i = 0; i < str.length; i++) {
        seed = ((seed << 5) - seed) + str.charCodeAt(i);
        seed |= 0;
    }
    return seed >>> 0;
}

function mulberry32(a) {
    return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function randomForSeed(seedKey) {
    return mulberry32(stringToHash32(seedKey));
}

function pickFromWeighted(names, weights, rand) {
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = rand() * sum;
    for (let i = 0; i < names.length; i++) {
        r -= weights[i];
        if (r <= 0) return names[i];
    }
    return names[names.length - 1];
}

/** Raw weights for Ask the Audience / Phone “how certain” (skewed toward actual submitters). */
function audienceStyleWeightsForNames(names, actualSubmitters, rand) {
    return names.map(name => {
        const isRight = actualSubmitters.includes(name);
        return isRight ? 20 + rand() * 25 : 3 + rand() * 12;
    });
}

function percentagesFromWeights(weights) {
    const sumW = weights.reduce((a, b) => a + b, 0);
    if (sumW <= 0) return weights.map(() => 0);
    return weights.map(w => (w / sumW) * 100);
}

function shuffleWithRand(array, rand) {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function formatScoreNum(n) {
    if (typeof n !== 'number' || Number.isNaN(n)) return String(n);
    const rounded = Math.round(n * 1000) / 1000;
    if (Number.isInteger(rounded)) return String(rounded);
    return String(rounded);
}

/** Banker offer: 35–65% of album count, step 0.5, never 0 or full house. */
function computeBankerOffer(week, guesser, albumCount) {
    if (albumCount < 1) return 0;
    const rand = randomForSeed(`${week}|bankerOffer|${guesser}|${albumCount}`);
    const frac = 0.35 + rand() * 0.3;
    let offer = Math.round(albumCount * frac * 2) / 2;
    if (offer < 0.5) offer = 0.5;
    if (offer >= albumCount) offer = albumCount - 0.5;
    if (offer < 0.5) offer = 0.5;
    return offer;
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeApp();
    } catch (error) {
        console.error('App initialization error:', error);
        showGistErrorBanner(error.message || 'The app failed to start properly.');
    }

    setupNavigation();

    try {
        await renderPage(currentPage);
    } catch (error) {
        console.error('Error rendering initial page:', error);
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="page active">
                    <div class="alert alert-error">
                        <p>Something went wrong loading this page. Try opening Admin to fix your connection.</p>
                    </div>
                </div>
            `;
        }
    }

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-page') === currentPage);
    });
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.setAttribute('data-current-page', currentPage);
});

async function initializeApp() {
    // Check for URL parameters to auto-configure Gist
    await checkUrlParameters();

    // Set current date
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        dateElement.textContent = Storage.getFormattedDate();
    }

    // Initialize admin password if not set
    if (!localStorage.getItem('adminPassword')) {
        await Storage.setAdminPassword('admin');
    }

    // Check if we need to set a guesser name
    const savedGuesser = localStorage.getItem('currentGuesser');
    if (savedGuesser) {
        currentGuesser = savedGuesser;
    }

    // Update navigation visibility
    await updateNavigationVisibility();

    // Ensure weekly theme exists and show popup only on game day (Friday or admin override)
    try {
        if (await Storage.isGameDay()) {
            currentWeekTheme = await Storage.ensureWeekTheme();
            showThemePopupIfNeeded();
        } else {
            currentWeekTheme = await Storage.getWeekTheme();
        }
    } catch (error) {
        console.error('Error loading weekly theme:', error);
    }

    await checkGistConnection();
}

async function checkGistConnection() {
    if (!Storage.isGistConfigured()) return;

    try {
        await Storage.fetchGist();
        dismissGistErrorBanner();
    } catch (error) {
        showGistErrorBanner(error.message);
    }
}

function showGistErrorBanner(message) {
    dismissGistErrorBanner();

    const banner = document.createElement('div');
    banner.id = 'gist-error-banner';
    banner.className = 'gist-error-banner';
    banner.innerHTML = `
        <div class="gist-error-banner-content">
            <p><strong>Gist connection problem:</strong> ${escapeHtml(message)}</p>
            <p class="gist-error-banner-help">Log in via Admin, then open Settings to update your GitHub token.</p>
            <div class="gist-error-banner-actions">
                <button type="button" class="btn btn-secondary" id="gist-error-admin-btn">Go to Admin</button>
                <button type="button" class="btn btn-secondary" id="gist-error-disconnect-btn">Disconnect Gist</button>
                <button type="button" class="btn btn-secondary" id="gist-error-dismiss-btn">Dismiss</button>
            </div>
        </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('gist-error-admin-btn').addEventListener('click', () => {
        navigateToPage('admin');
    });
    document.getElementById('gist-error-disconnect-btn').addEventListener('click', () => {
        if (confirm('Disconnect from Gist and use local storage only? You can reconnect in Settings after logging in as admin.')) {
            localStorage.removeItem('githubToken');
            localStorage.removeItem('gistId');
            dismissGistErrorBanner();
            window.location.reload();
        }
    });
    document.getElementById('gist-error-dismiss-btn').addEventListener('click', dismissGistErrorBanner);
}

function dismissGistErrorBanner() {
    const banner = document.getElementById('gist-error-banner');
    if (banner) banner.remove();
}

// Check URL parameters for Gist setup
async function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const gist = urlParams.get('gist');
    const setup = urlParams.get('setup');

    // If setup parameter exists, show setup message
    if (setup === 'success') {
        // Show success message if redirected after setup
        setTimeout(() => {
            if (currentPage === 'settings' || window.location.hash === '#settings') {
                // Will be handled by settings page
            }
        }, 100);
    }

    // If token and gist are provided, configure automatically
    if (token && gist) {
        try {
            // Store in localStorage
            localStorage.setItem('githubToken', token);
            localStorage.setItem('gistId', gist);
            
            // Test the connection by trying to fetch the Gist
            try {
                await Storage.fetchGist();
                dismissGistErrorBanner();
            } catch (fetchError) {
                // If fetch fails, still store the values but show a warning
                console.warn('Could not verify Gist connection:', fetchError);
            }
            
            // Clear URL parameters for security
            const newUrl = window.location.pathname + (window.location.hash || '');
            window.history.replaceState({}, document.title, newUrl);
            
            // Show success message
            console.log('Gist configured successfully from URL parameters');
            
            // If on settings page, refresh it
            if (currentPage === 'settings') {
                await renderPage('settings');
            }
        } catch (error) {
            console.error('Error configuring from URL parameters:', error);
            // Still clear URL parameters even if there's an error
            const newUrl = window.location.pathname + (window.location.hash || '');
            window.history.replaceState({}, document.title, newUrl);
            alert('Error configuring Gist. Please check your token and Gist ID.');
        }
    }
}

function isBeforeGuessTime() {
    if (typeof Storage !== 'undefined' && Storage.isPreviewMode()) return false;
    const now = new Date();
    return now.getHours() < 10 || (now.getHours() === 10 && now.getMinutes() < 30);
}

function isBeforeMidday() {
    if (typeof Storage !== 'undefined' && Storage.isPreviewMode()) return false;
    const now = new Date();
    return now.getHours() < 12;
}

function previewModeBanner() {
    if (typeof Storage === 'undefined' || !Storage.isPreviewMode()) return '';
    return `
        <div class="preview-mode-banner" role="status">
            <strong>Preview mode</strong> — you’re seeing mock data for this week on this device only. Nothing is saved to the shared Gist until you turn preview off.
        </div>
    `;
}
/** Midday on the Friday that identifies a game week (weekStr is DD/MM/YYYY). */
function getWeekFridayMidday(weekStr) {
    const [d, m, y] = weekStr.split('/').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function getWeekFriday4pm(weekStr) {
    const [d, m, y] = weekStr.split('/').map(Number);
    return new Date(y, m - 1, d, 16, 0, 0, 0);
}

function isAfterMiddayOnWeekFriday(weekStr) {
    return new Date() >= getWeekFridayMidday(weekStr);
}

function isAfter4pmOnWeekFriday(weekStr) {
    return new Date() >= getWeekFriday4pm(weekStr);
}

/** True when `date` is the calendar day identified by weekStr (DD/MM/YYYY = that Friday). */
function isDateSameAsWeekFriday(weekStr, date = new Date()) {
    const [d, m, y] = weekStr.split('/').map(Number);
    return date.getDate() === d && date.getMonth() === m - 1 && date.getFullYear() === y;
}

/** Spotify album id from open.spotify.com/.../album/{id} */
function extractSpotifyAlbumId(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.trim().match(/album\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

function getFirstSpotifyAlbumUrlFromSubmissions(submissions) {
    if (!Array.isArray(submissions)) return '';
    for (const s of submissions) {
        if (s && s.url && extractSpotifyAlbumId(s.url)) return s.url.trim();
    }
    return '';
}

async function fetchSpotifyOEmbedThumbnail(albumPageUrl) {
    const u = `https://open.spotify.com/oembed?url=${encodeURIComponent(albumPageUrl)}`;
    const res = await fetch(u);
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumbnail_url || null;
}

/** Fallback album art when Spotify oEmbed fails (e.g. preview / CORS). */
async function fetchItunesAlbumArtwork(artist, album) {
    const term = encodeURIComponent(`${artist} ${album}`.trim());
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=album&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const url = data.results?.[0]?.artworkUrl100;
    return url ? url.replace('100x100bb', '600x600bb') : null;
}

function getCrystalMazeBodyHtml(windowId) {
    switch (windowId) {
        case 'midday':
            return '<p>Results unlock at <strong>midday</strong> once everyone has finalized their guesses. Still time to lock in your answers in the maze!</p>';
        case 'fourPmPending':
            return '<p>Someone is still guessing — results will show at <strong>4pm</strong> if guesses are still outstanding. Save &amp; finalize yours before then!</p>';
        case 'fourPmGeneric':
            return '<p>After <strong>midday</strong>, results may be live. If anyone is still guessing, the rest of the team might be waiting until <strong>4pm</strong> — don&apos;t be the straggler: finalize!</p>';
        case 'after4pm':
            return '<p>It&apos;s past <strong>4pm</strong> on results Friday. If you haven&apos;t finalized your guesses, you&apos;ll be scored <strong>0</strong> for this week (see the rules).</p>';
        default:
            return '';
    }
}

/** Admin / preview: show Crystal Maze popup without Friday timing or localStorage guard. */
async function previewCrystalMazePopup(windowId) {
    const bodyHtml = getCrystalMazeBodyHtml(windowId);
    if (!bodyHtml) return;
    await openConfirmModal({
        image: RICHARD_OBRIEN_IMAGE,
        bodyHtml,
        confirmLabel: 'OK',
        cancelLabel: 'Close'
    });
}

async function fillAdminCatchphraseArtPreview(gridEl) {
    const subs = await Storage.getSubmissions(Storage.getCurrentWeek());
    if (!gridEl) return;
    if (subs.length === 0) {
        gridEl.innerHTML = '<p class="preview-art-empty">No submissions for this week. Enable preview and seed mock albums first.</p>';
        return;
    }
    gridEl.innerHTML = '<p class="preview-art-loading">Loading artwork…</p>';
    const figures = [];
    for (const sub of subs) {
        const albumClean = String(sub.album || '').replace(/\s*\([^)]*\)\s*$/, '').trim() || sub.album;
        let thumb = null;
        let source = '';
        if (sub.url && extractSpotifyAlbumId(sub.url)) {
            try {
                thumb = await fetchSpotifyOEmbedThumbnail(sub.url.trim());
                if (thumb) source = 'Spotify';
            } catch { /* ignore */ }
        }
        if (!thumb && sub.artist && albumClean) {
            try {
                thumb = await fetchItunesAlbumArtwork(sub.artist, albumClean);
                if (thumb) source = 'iTunes (fallback)';
            } catch { /* ignore */ }
        }
        const imgBlock = thumb
            ? `<img src="${escapeAttr(thumb)}" alt="" loading="lazy">`
            : '<div class="preview-catchphrase-art-missing">No art</div>';
        figures.push(`
            <figure class="preview-catchphrase-art-item">
                ${imgBlock}
                <figcaption>
                    <strong>${escapeHtml(sub.album)}</strong><br>
                    ${escapeHtml(sub.artist)} · ${escapeHtml(sub.submitter)}
                    ${source ? `<br><small>${escapeHtml(source)}</small>` : ''}
                </figcaption>
            </figure>
        `);
    }
    gridEl.innerHTML = `<div class="preview-catchphrase-art-grid">${figures.join('')}</div>`;
}

/** Crystal Maze: one-off Friday deadline reminders on the Guess page (preview mode skipped). */
async function maybeShowCrystalMazeDeadlinePopup(week) {
    if (Storage.isPreviewMode()) return;
    if (!currentGuesser) return;
    const finalized = await Storage.areGuessesFinalized(currentGuesser, week);
    if (finalized) return;
    if (!isDateSameAsWeekFriday(week, new Date())) return;

    const now = new Date();
    const tMin = now.getHours() * 60 + now.getMinutes();
    let windowId = null;

    if (tMin >= 10 * 60 && tMin < 12 * 60) {
        windowId = 'midday';
    } else if (tMin >= 12 * 60 && tMin < 16 * 60) {
        const pending = await getPendingGuessers(week);
        windowId = pending.length > 0 ? 'fourPmPending' : 'fourPmGeneric';
    } else if (tMin >= 16 * 60) {
        windowId = 'after4pm';
    }

    if (!windowId) return;

    const bodyHtml = getCrystalMazeBodyHtml(windowId);

    const key = `crystalMazeWarn_${week}_${windowId}`;
    if (localStorage.getItem(key)) return;

    await openConfirmModal({
        image: RICHARD_OBRIEN_IMAGE,
        bodyHtml,
        confirmLabel: 'OK',
        cancelLabel: 'Close'
    });
    localStorage.setItem(key, '1');
}

async function hydrateCatchphraseAlbumArt(root = document) {
    const cells = root.querySelectorAll('.catchphrase-art-cell[data-spotify-url]');
    if (cells.length === 0) return;
    const cache = new Map();
    for (const cell of cells) {
        const url = cell.getAttribute('data-spotify-url');
        if (!url) continue;
        const artist = cell.getAttribute('data-artist') || '';
        const album = cell.getAttribute('data-album') || '';
        const cacheKey = url || `${artist}|${album}`;
        let thumb = cache.get(cacheKey);
        if (thumb === undefined) {
            try {
                thumb = url ? await fetchSpotifyOEmbedThumbnail(url) : null;
            } catch {
                thumb = null;
            }
            if (!thumb && artist && album) {
                try {
                    thumb = await fetchItunesAlbumArtwork(artist, album);
                } catch {
                    thumb = null;
                }
            }
            cache.set(cacheKey, thumb);
        }
        const img = cell.querySelector('.catchphrase-album-thumb');
        const ph = cell.querySelector('.catchphrase-art-placeholder');
        const roy = cell.querySelector('.catchphrase-roy-host');
        if (thumb && img) {
            img.src = thumb;
            img.removeAttribute('hidden');
            img.alt = 'Album artwork';
            if (ph) ph.hidden = true;
        } else if (ph) {
            ph.textContent = 'No artwork (add a Spotify album link when submitting)';
        }
        if (roy) roy.hidden = false;
    }
}

async function getPendingGuessers(week) {
    const submissions = await Storage.getSubmissions(week);
    const submitters = [...new Set(submissions.map(s => s.submitter))];
    if (submitters.length === 0) return [];
    const data = await Storage.getData();
    const finalized = data.finalizedGuesses?.[week] || [];
    return submitters.filter(name => !finalized.includes(name));
}

async function isWeekResultsRevealed(weekStr) {
    if (Storage.isPreviewMode()) return true;
    const submissions = await Storage.getSubmissions(weekStr);
    if (submissions.length === 0) return false;

    const pending = await getPendingGuessers(weekStr);
    const now = new Date();

    if (pending.length === 0) {
        return now >= getWeekFridayMidday(weekStr);
    }
    return now >= getWeekFriday4pm(weekStr);
}

async function renderResultsWaitingMessage(week) {
    const pending = await getPendingGuessers(week);
    const afterMiddayFriday = isAfterMiddayOnWeekFriday(week);
    const after4pmFriday = isAfter4pmOnWeekFriday(week);
    const submissions = await Storage.getSubmissions(week);

    if (submissions.length === 0) {
        return '<p>No submissions for this week yet.</p>';
    }

    const pendingLine = pending.length > 0
        ? `<p><strong>Still waiting on guesses from ${pending.length} ${pending.length === 1 ? 'person' : 'people'}:</strong> ${pending.map(p => escapeHtml(p)).join(', ')}.</p>`
        : '';

    if (pending.length > 0 && afterMiddayFriday && !after4pmFriday) {
        return `<p>Results will be revealed at 4pm on Friday if guesses are still outstanding.</p>${pendingLine}`;
    }

    let html = '<p>Results will be revealed at midday on Friday once everyone has submitted their guesses, or at 4pm on Friday if anyone is still outstanding.</p>';
    html += pendingLine;
    if (!afterMiddayFriday && pending.length === 0) {
        html += '<p>Check back after midday on Friday.</p>';
    } else if (!afterMiddayFriday) {
        html += '<p>If everyone has guessed by then, results will appear at midday; otherwise at 4pm.</p>';
    }
    return html;
}

function showThemePopupIfNeeded() {
    if (!currentWeekTheme) return;
    if (document.getElementById('theme-modal-backdrop')) return;

    const week = Storage.getCurrentWeek();
    const seenKey = `themePopupSeen_${week}`;
    if (localStorage.getItem(seenKey)) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'theme-modal-backdrop';
    backdrop.id = 'theme-modal-backdrop';
    backdrop.innerHTML = `
        <div class="theme-modal-card" id="theme-modal-card">
            <img src="${HARRY_HILL_IMAGE}" alt="Harry Hill" class="theme-harry-hill theme-harry-hill--modal">
            <h2>Theme of the Week</h2>
            <p class="theme-modal-text">${escapeHtml(currentWeekTheme.text)}</p>
            <button type="button" class="btn" id="theme-modal-dismiss">Got it</button>
        </div>
    `;
    document.body.appendChild(backdrop);

    const card = document.getElementById('theme-modal-card');
    const rect = card.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    Confetti.burst(originX, originY);

    document.getElementById('theme-modal-dismiss').addEventListener('click', () => {
        localStorage.setItem(seenKey, 'true');
        backdrop.remove();
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function removeGameshowModal() {
    document.getElementById('gameshow-modal-backdrop')?.remove();
}

/**
 * @param {{ title: string, image?: string, bodyHtml: string, confirmLabel?: string, cancelLabel?: string }} opts
 * @returns {Promise<boolean>}
 */
function openConfirmModal(opts) {
    return new Promise((resolve) => {
        removeGameshowModal();
        const backdrop = document.createElement('div');
        backdrop.className = 'gameshow-modal-backdrop';
        backdrop.id = 'gameshow-modal-backdrop';
        backdrop.innerHTML = `
            <div class="gameshow-modal-card" role="dialog" aria-modal="true">
                ${opts.image ? `<img src="${opts.image}" alt="" class="gameshow-host-img">` : ''}
                ${opts.title ? `<h3 class="gameshow-modal-title">${escapeHtml(opts.title)}</h3>` : ''}
                <div class="gameshow-modal-body">${opts.bodyHtml}</div>
                <div class="gameshow-modal-actions">
                    <button type="button" class="btn btn-success" id="gameshow-modal-confirm">${escapeHtml(opts.confirmLabel || 'Confirm')}</button>
                    <button type="button" class="btn" id="gameshow-modal-cancel">${escapeHtml(opts.cancelLabel || 'Cancel')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        backdrop.querySelector('#gameshow-modal-confirm').addEventListener('click', () => {
            removeGameshowModal();
            resolve(true);
        });
        backdrop.querySelector('#gameshow-modal-cancel').addEventListener('click', () => {
            removeGameshowModal();
            resolve(false);
        });
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                removeGameshowModal();
                resolve(false);
            }
        });
    });
}

/**
 * @param {number} offer
 * @returns {Promise<boolean|null>} true = deal, false = no deal, null = cancel
 */
function openBankerOfferModal(offer) {
    return new Promise((resolve) => {
        removeGameshowModal();
        const backdrop = document.createElement('div');
        backdrop.className = 'gameshow-modal-backdrop';
        backdrop.id = 'gameshow-modal-backdrop';
        backdrop.innerHTML = `
            <div class="gameshow-modal-card banker-modal" role="dialog" aria-modal="true">
                <img src="${NOEL_BANKER_IMAGE}" alt="Noel Edmonds" class="gameshow-host-img">
                <h3 class="gameshow-modal-title">The Banker is phoning…</h3>
                <p class="gameshow-modal-body">Noel says the Banker will lock in <strong>${formatScoreNum(offer)}</strong> points for this week. Do you accept?</p>
                <div class="gameshow-modal-actions">
                    <button type="button" class="btn btn-success" id="banker-deal-btn">Deal</button>
                    <button type="button" class="btn" id="banker-no-deal-btn">No deal</button>
                    <button type="button" class="btn btn-muted" id="banker-cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        backdrop.querySelector('#banker-deal-btn').addEventListener('click', () => {
            removeGameshowModal();
            resolve(true);
        });
        backdrop.querySelector('#banker-no-deal-btn').addEventListener('click', () => {
            removeGameshowModal();
            resolve(false);
        });
        backdrop.querySelector('#banker-cancel-btn').addEventListener('click', () => {
            removeGameshowModal();
            resolve(null);
        });
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                removeGameshowModal();
                resolve(null);
            }
        });
    });
}

function parseAlbumMeta(group) {
    try {
        const raw = group.getAttribute('data-album-meta');
        return raw ? JSON.parse(raw) : { title: '', artist: '', actualSubmitters: [] };
    } catch {
        return { title: '', artist: '', actualSubmitters: [] };
    }
}

function getNamesFromGuessGroup(group) {
    return [...group.querySelectorAll('.guess-option-label')].map(l => l.getAttribute('data-person'));
}

/** Names still in play after 50:50 (greyed labels excluded). */
function getActiveNamesFromGuessGroup(group) {
    return [...group.querySelectorAll('.guess-option-label:not(.lifeline-fifty-excluded)')].map(l => l.getAttribute('data-person'));
}

function applyFiftyFiftyKeepSet(group, keepSet) {
    group.querySelectorAll('.guess-option-label').forEach(label => {
        const p = label.getAttribute('data-person');
        const input = label.querySelector('input');
        if (!keepSet.has(p)) {
            label.classList.add('lifeline-fifty-excluded');
            if (input) {
                input.checked = false;
                input.disabled = true;
            }
        } else {
            label.classList.remove('lifeline-fifty-excluded');
        }
    });
}

function formatAudienceVoteSuffix(numOptions) {
    if (numOptions <= 0) return '';
    const letters = [...LETTER_LABELS.slice(0, numOptions)];
    if (numOptions === 1) return `${letters[0]}, all vote... now!`;
    if (numOptions === 2) return `${letters[0]} or ${letters[1]}, all vote... now!`;
    return `${letters.slice(0, -1).join(', ')} or ${letters[numOptions - 1]}, all vote... now!`;
}

function formatAudienceKeypadLine(names) {
    const n = names.length;
    if (n === 0) return '';
    let keypad = `Now A on your keypads is ${names[0]}`;
    for (let i = 1; i < n; i++) {
        const L = LETTER_LABELS[i];
        if (i === n - 1) {
            keypad += n === 2 ? ` and ${L} is ${names[i]}` : `, and ${L} is ${names[i]}`;
        } else {
            keypad += `, ${L} is ${names[i]}`;
        }
    }
    return `${keypad}. ${formatAudienceVoteSuffix(n)}`;
}

function buildAudienceBarsHtml(names, weights) {
    const rows = names.map((name, i) => {
        const pct = Math.min(100, Math.max(0, weights[i]));
        return `
        <div class="audience-bar-row">
            <span class="audience-bar-label">${LETTER_LABELS[i]}. ${escapeHtml(name)}</span>
            <div class="audience-bar-track">
                <div class="audience-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="audience-bar-pct">${pct.toFixed(1)}%</span>
        </div>
    `;
    }).join('');
    return `<div class="audience-bars">${rows}</div>`;
}

function renderThemeBanner() {
    if (!currentWeekTheme) return '';
    return `
        <div class="theme-banner">
            <img src="${HARRY_HILL_IMAGE}" alt="Harry Hill" class="theme-harry-hill theme-harry-hill--banner">
            <div class="theme-banner-content">
                <div class="theme-banner-label">Theme of the Week</div>
                <div class="theme-banner-text">${escapeHtml(currentWeekTheme.text)}</div>
            </div>
        </div>
    `;
}

/** Same photo for a given week for everyone, chosen from HARRY_HILL_IMAGES. */
function pickHarryHillImage(seedKey) {
    return seededShuffle(HARRY_HILL_IMAGES, String(seedKey))[0];
}

function renderHarryHillPhotoExamples() {
    const fileName = (src) => src.split('/').pop();
    return `
        <div class="admin-section">
            <h2>Harry Hill photos</h2>
            <p class="harry-preview-note">
                Each photo as it is cropped on a week card. Weeks with no saved theme always use
                <strong>${escapeHtml(fileName(HARRY_HILL_NO_THEME_IMAGE))}</strong>.
            </p>
            <div class="harry-preview-grid">
                ${HARRY_HILL_IMAGES.map(src => {
                    const name = fileName(src);
                    const isNoTheme = src === HARRY_HILL_NO_THEME_IMAGE;
                    return `
                        <figure class="harry-preview-item">
                            <img src="${src}" alt="${escapeHtml(name)}" class="theme-harry-hill theme-harry-hill--preview">
                            <figcaption>
                                <span>${escapeHtml(name)}</span>
                                ${isNoTheme ? '<span class="harry-preview-tag">No theme</span>' : ''}
                            </figcaption>
                        </figure>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function setupHarryHillPhotoExamples() {
    document.querySelectorAll('.harry-preview-item img').forEach(img => {
        const markBroken = () => {
            const item = img.closest('.harry-preview-item');
            if (!item || item.classList.contains('is-broken')) return;
            item.classList.add('is-broken');
            const caption = item.querySelector('figcaption');
            if (caption) {
                caption.insertAdjacentHTML('beforeend', '<span class="harry-preview-error">Failed to load</span>');
            }
        };
        if (img.complete && img.naturalWidth === 0) {
            markBroken();
        } else {
            img.addEventListener('error', markBroken);
        }
    });
}

function renderWeekThemeBanner(week, theme) {
    const image = theme?.text ? pickHarryHillImage(week) : HARRY_HILL_NO_THEME_IMAGE;
    const label = theme?.text ? 'Theme of the Week' : '';
    const text = theme?.text ? escapeHtml(theme.text) : 'No theme recorded for this week.';
    return `
        <div class="theme-banner theme-banner--week">
            <img src="${image}" alt="Harry Hill" class="theme-harry-hill theme-harry-hill--week">
            <div class="theme-banner-content">
                ${label ? `<div class="theme-banner-label">${label}</div>` : ''}
                <div class="theme-banner-text">${text}</div>
            </div>
        </div>
    `;
}

/** Deterministic shuffle so playlist order is random for the week but stable for everyone. */
function seededShuffle(array, seedKey) {
    let seed = 0;
    for (let i = 0; i < seedKey.length; i++) {
        seed = ((seed << 5) - seed) + seedKey.charCodeAt(i);
        seed |= 0;
    }
    const arr = [...array];
    function next() {
        seed = (Math.imul(seed, 1103515245) + 12345) | 0;
        return (seed >>> 0) / 0xffffffff;
    }
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function updateNavigationVisibility() {
    const settingsBtn = document.querySelector('.nav-btn[data-page="settings"]');
    if (settingsBtn) {
        if (Storage.isAdminLoggedIn()) {
            settingsBtn.style.display = '';
        } else {
            settingsBtn.style.display = 'none';
        }
    }

    const guessBtn = document.querySelector('.nav-btn[data-page="guess"]');
    if (guessBtn) {
        if (isBeforeGuessTime()) {
            guessBtn.disabled = true;
            guessBtn.title = 'Available from 10:30';
        } else {
            guessBtn.disabled = false;
            guessBtn.removeAttribute('title');
        }
    }

    const resultsBtn = document.querySelector('.nav-btn[data-page="results"]');
    if (resultsBtn) {
        if (isBeforeMidday()) {
            resultsBtn.disabled = true;
            resultsBtn.title = 'Available from midday';
        } else {
            resultsBtn.disabled = false;
            resultsBtn.removeAttribute('title');
        }
    }

    const statsBtn = document.querySelector('.nav-btn[data-page="stats"]');
    if (statsBtn) {
        if (isBeforeMidday()) {
            statsBtn.disabled = true;
            statsBtn.title = 'Available from midday';
        } else {
            statsBtn.disabled = false;
            statsBtn.removeAttribute('title');
        }
    }

}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const page = btn.getAttribute('data-page');
            await navigateToPage(page);
        });
    });
}

async function navigateToPage(page) {
    await updateNavigationVisibility();

    if (page === 'guess' && isBeforeGuessTime()) {
        return; // Guess button is disabled, but guard in case of hash/navigation
    }
    if (page === 'results' && isBeforeMidday()) {
        return; // Results button is disabled, but guard in case of hash/navigation
    }
    if (page === 'stats' && isBeforeMidday()) {
        return;
    }
    currentPage = page;

    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-page') === page);
    });
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.setAttribute('data-current-page', page);

    await renderPage(page);
}

async function renderPage(page) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<div class="page active"><div class="empty-state"><p>Loading...</p></div></div>';
    
    try {
        switch(page) {
            case 'submit':
                mainContent.innerHTML = await renderSubmitPage();
                setupSubmitPage();
                if (await Storage.isGameDay()) {
                    if (!currentWeekTheme) {
                        try {
                            currentWeekTheme = await Storage.ensureWeekTheme();
                        } catch (error) {
                            console.error('Error ensuring weekly theme:', error);
                        }
                    }
                    showThemePopupIfNeeded();
                }
                break;
            case 'guess':
                if (isBeforeGuessTime()) {
                    mainContent.innerHTML = `
                        <div class="page active">
                            <h2 class="page-title">Guess</h2>
                            <div class="empty-state">
                                <p>Guessing opens at 10:30. Check back later!</p>
                            </div>
                        </div>
                    `;
                } else {
                    mainContent.innerHTML = await renderGuessPage();
                    setupGuessPage();
                }
                break;
            case 'results':
                if (isBeforeMidday()) {
                    mainContent.innerHTML = `
                        <div class="page active">
                            <h2 class="page-title">Results</h2>
                            <div class="empty-state">
                                <p>Results are available from midday. Check back later!</p>
                            </div>
                        </div>
                    `;
                } else {
                    mainContent.innerHTML = await renderResultsPage();
                    await setupResultsPage();
                }
                break;
            case 'stats':
                if (isBeforeMidday()) {
                    mainContent.innerHTML = `
                        <div class="page active">
                            <h2 class="page-title">Stats</h2>
                            <div class="empty-state">
                                <p>Stats are available from midday. Check back later!</p>
                            </div>
                        </div>
                    `;
                } else {
                    mainContent.innerHTML = await renderStatsPage();
                }
                break;
            case 'playlist':
                mainContent.innerHTML = await renderPlaylistPage();
                setupPlaylistPage();
                break;
            case 'admin':
                mainContent.innerHTML = await renderAdminPage();
                await setupAdminPage();
                break;
            case 'settings':
                if (!Storage.isAdminLoggedIn()) {
                    // Redirect to admin login if not logged in
                    navigateToPage('admin');
                    return;
                }
                mainContent.innerHTML = renderSettingsPage();
                setupSettingsPage();
                break;
        }
    } catch (error) {
        console.error('Error rendering page:', error);
        mainContent.innerHTML = `<div class="page active"><div class="alert alert-error">Error loading page: ${error.message}</div></div>`;
    }
}

// Submit Page
async function renderSubmitPage() {
    const week = Storage.getCurrentWeek();
    const isGameDay = await Storage.isGameDay(week);
    const submissions = await Storage.getSubmissions(week);
    const members = await Storage.getTeamMembers();
    const userSubmissions = submissions.filter(s => s.submitter === currentGuesser);
    const remaining = 1 - userSubmissions.length;

    if (isGameDay && !currentWeekTheme) {
        try {
            currentWeekTheme = await Storage.ensureWeekTheme(week);
        } catch (error) {
            console.error('Error ensuring weekly theme:', error);
        }
    }

    return `
        <div class="page active">
            ${previewModeBanner()}
            <h2 class="page-title">Submit Albums</h2>
            ${isGameDay ? renderThemeBanner() : ''}
            ${!isGameDay ? `
                <div class="alert alert-info">
                    <p>Album submissions open on Friday. An admin can enable game day early if you&rsquo;re playing on a different day this week.</p>
                </div>
            ` : ''}
            ${members.length === 0 ? `
                <div class="alert alert-info">
                    <p>No team members have been added yet. Please ask an admin to add team members first.</p>
                </div>
            ` : ''}
            ${isGameDay && members.length > 0 && !currentGuesser ? `
                <div class="form-group">
                    <label for="guesser-name">Your Name:</label>
                    <select id="guesser-name" required>
                        <option value="">Select your name...</option>
                        ${members.map(m => `
                            <option value="${m}">${m}</option>
                        `).join('')}
                    </select>
                </div>
            ` : ''}
            ${isGameDay && currentGuesser ? `
                <div class="submission-count">Submissions this week: ${userSubmissions.length}/1</div>
                ${remaining > 0 ? `
                    <form id="submit-form">
                        <input type="hidden" id="submitter-name" value="${escapeHtml(currentGuesser)}">
                        <div class="form-group">
                            <label for="artist">Artist Name:</label>
                            <input type="text" id="artist" placeholder="Enter artist name" required>
                        </div>
                        <div class="form-group">
                            <label for="album">Album Name:</label>
                            <input type="text" id="album" placeholder="Enter album name" required>
                        </div>
                        <div class="form-group">
                            <label for="url">Spotify URL (optional):</label>
                            <input type="url" id="url" placeholder="https://open.spotify.com/album/...">
                        </div>
                        <button type="submit" class="btn">Submit Album</button>
                    </form>
                ` : `
                    <div class="alert alert-info">
                        You have already submitted your album this week. Check back next week!
                    </div>
                `}
            ` : ''}
            ${userSubmissions.length > 0 ? `
                <h3 style="margin-top: 30px; margin-bottom: 16px;">Your Submissions This Week:</h3>
                ${userSubmissions.map(sub => `
                    <div class="album-card">
                        <h3>${sub.album}</h3>
                        <p><strong>Artist:</strong> ${sub.artist}</p>
                        ${sub.url ? `<p><a href="${sub.url}" target="_blank">${sub.url}</a></p>` : ''}
                    </div>
                `).join('')}
            ` : ''}
            <div id="submit-message"></div>
        </div>
    `;
}

function setupSubmitPage() {
    // Handle name selection dropdown (shown only until a name is chosen once)
    const guesserNameSelect = document.getElementById('guesser-name');
    if (guesserNameSelect) {
        guesserNameSelect.addEventListener('change', async (e) => {
            const name = e.target.value.trim();
            if (name) {
                currentGuesser = name;
                localStorage.setItem('currentGuesser', name);
                await updateNavigationVisibility();
                await renderPage('submit');
            }
        });
    }

    const form = document.getElementById('submit-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!(await Storage.isGameDay())) {
                showMessage('submit-message', 'Albums can only be submitted on Friday (or an admin-enabled game day).', 'error');
                return;
            }

            const submitterNameInput = document.getElementById('submitter-name');
            const submitterName = (submitterNameInput?.value || currentGuesser || '').trim();
            
            if (!submitterName) {
                showMessage('submit-message', 'Please select your name.', 'error');
                return;
            }
            
            // Keep currentGuesser in sync
            if (submitterName !== currentGuesser) {
                currentGuesser = submitterName;
                localStorage.setItem('currentGuesser', submitterName);
            }

            const artist = document.getElementById('artist').value.trim();
            const album = document.getElementById('album').value.trim();
            const url = document.getElementById('url').value.trim();

            if (!artist || !album) {
                showMessage('submit-message', 'Please fill in artist and album name.', 'error');
                return;
            }

            // If a Spotify URL is provided, it must be an album URL, not a playlist
            if (url) {
                const urlLower = url.toLowerCase();
                if (urlLower.includes('spotify.com')) {
                    if (urlLower.includes('/playlist/')) {
                        showMessage('submit-message', 'Please use a Spotify album URL, not a playlist URL.', 'error');
                        return;
                    }
                    if (!urlLower.includes('/album/')) {
                        showMessage('submit-message', 'Please use a Spotify album link (e.g. open.spotify.com/album/...).', 'error');
                        return;
                    }
                }
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                const result = await Storage.addSubmission(artist, album, url, submitterName);
                
                if (result.success) {
                    showMessage('submit-message', result.message, 'success');
                    form.reset();
                    // Restore hidden name after reset (reset clears hidden inputs too)
                    const hiddenName = document.getElementById('submitter-name');
                    if (hiddenName) hiddenName.value = submitterName;
                    await updateNavigationVisibility();
                    setTimeout(async () => {
                        await renderPage('submit');
                    }, 1000);
                } else {
                    showMessage('submit-message', result.message, 'error');
                }
            } catch (error) {
                showMessage('submit-message', 'Error submitting: ' + error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
}

// Guess Page
async function renderGuessPage() {
    const week = Storage.getCurrentWeek();
    const submissions = await Storage.getSubmissions(week);
    const guesses = await Storage.getGuesses(week);
    // Only show people who submitted at least one album this week
    const submittersThisWeek = [...new Set(submissions.map(s => s.submitter))];

    if (submissions.length === 0) {
        return `
            <div class="page active">
                <h2 class="page-title">Guess</h2>
                <div class="empty-state">
                    <p>No albums submitted yet this week.</p>
                </div>
            </div>
        `;
    }

    // Don't show albums/guess form until this user has submitted at least one album this week
    const userSubmittedThisWeek = currentGuesser && submissions.some(s => s.submitter === currentGuesser);
    if (!currentGuesser) {
        return `
            <div class="page active">
                <h2 class="page-title">Guess</h2>
                <div class="form-group">
                    <label for="guesser-name-guess">Your Name:</label>
                    <input type="text" id="guesser-name-guess" placeholder="Enter your name" required>
                </div>
                <p style="color: #666666; margin-top: 15px;">Enter your name to continue.</p>
                <div id="guess-message"></div>
            </div>
        `;
    }
    if (!userSubmittedThisWeek) {
        return `
            <div class="page active">
                <h2 class="page-title">Guess</h2>
                <div class="empty-state">
                    <p>Submit at least one album this week to make guesses.</p>
                </div>
                <div id="guess-message"></div>
            </div>
        `;
    }

    // Group submissions by artist+album (case-insensitive)
    const albumGroups = {};
    submissions.forEach(sub => {
        const key = `${sub.artist.toLowerCase()}-${sub.album.toLowerCase()}`;
        if (!albumGroups[key]) {
            albumGroups[key] = {
                key: key,
                artist: sub.artist,
                album: sub.album,
                url: sub.url,
                submissions: []
            };
        }
        albumGroups[key].submissions.push(sub);
    });

    // Convert to array and shuffle
    const uniqueAlbums = Object.values(albumGroups).sort(() => Math.random() - 0.5);

    // Check if there are any duplicates and calculate max duplicate count
    const duplicateAlbums = uniqueAlbums.filter(ag => ag.submissions.length > 1);
    const hasDuplicates = duplicateAlbums.length > 0;
    const maxDuplicateCount = hasDuplicates 
        ? Math.max(...duplicateAlbums.map(ag => ag.submissions.length))
        : 0;

    // Check if guesses are finalized
    const guessesFinalized = currentGuesser ? await Storage.areGuessesFinalized(currentGuesser) : false;
    const resultsRevealed = await isWeekResultsRevealed(week);

    // Get existing guesses for this guesser, grouped by album key
    const existingGuessesByAlbum = {};
    guesses.forEach(g => {
        if (g.guesser === currentGuesser && g.albumKey) {
            if (!existingGuessesByAlbum[g.albumKey]) {
                existingGuessesByAlbum[g.albumKey] = [];
            }
            existingGuessesByAlbum[g.albumKey].push(g.guessedSubmitter);
        }
    });

    const lifelinesByWeek = await Storage.getLifelinesForWeek(week);
    const myLifelineEntries = (lifelinesByWeek[currentGuesser] || []).filter(e => e && e.albumKey && e.type);
    const usedFiftyGlobally = myLifelineEntries.some(e => e.type === 'fiftyFifty');
    const usedAudienceGlobally = myLifelineEntries.some(e => e.type === 'audience');
    const usedPhoneGlobally = myLifelineEntries.some(e => e.type === 'phone');
    const lifelinesByAlbum = {};
    myLifelineEntries.forEach(e => {
        if (!lifelinesByAlbum[e.albumKey]) lifelinesByAlbum[e.albumKey] = [];
        lifelinesByAlbum[e.albumKey].push(e.type);
    });

    return `
        <div class="page active" data-guesses-finalized="${guessesFinalized}">
            ${previewModeBanner()}
            <h2 class="page-title">Guess Who Submitted What</h2>
            ${guessesFinalized ? `
                <div class="alert alert-info" style="margin-bottom: 30px;">
                    <p style="margin-bottom: 0;"><strong>Your guesses for this week have been finalized.</strong> You cannot make any changes.${!resultsRevealed ? ' Results will be revealed at midday on Friday once everyone has guessed, or at 4pm if anyone is still outstanding.' : ''}</p>
                </div>
            ` : ''}
            ${hasDuplicates ? `
                <div class="alert alert-info" style="margin-bottom: 30px;">
                    <p style="margin-bottom: 0;"><strong>Note:</strong> One album in this week was submitted by ${maxDuplicateCount} team member(s). 
                    You can select up to ${maxDuplicateCount} people on ONE album if you think it's the duplicate. All other albums should have only one selection. You can select each person at most once in total.</p>
                </div>
            ` : `
                <div class="alert alert-info" style="margin-bottom: 30px;">
                    <p style="margin-bottom: 0;">You can select each person at most once across all albums.</p>
                </div>
            `}
            ${uniqueAlbums.map(albumGroup => {
                const existingGuesses = existingGuessesByAlbum[albumGroup.key] || [];
                const useRadioButtons = !hasDuplicates;
                const onThisAlbum = lifelinesByAlbum[albumGroup.key] || [];
                const albumActualSubmitters = [...new Set(albumGroup.submissions.map(s => s.submitter))];
                const wrongNamePool = submittersThisWeek.filter(m => !albumActualSubmitters.includes(m));
                const fiftyDisabled = guessesFinalized || usedFiftyGlobally || submittersThisWeek.length <= 2 || wrongNamePool.length === 0;
                const audienceDisabled = guessesFinalized || usedAudienceGlobally;
                const phoneDisabled = guessesFinalized || usedPhoneGlobally;
                const albumTitleEsc = escapeHtml(albumGroup.album);
                const albumArtistEsc = escapeHtml(albumGroup.artist);
                const albumMetaAttr = escapeAttr(JSON.stringify({
                    title: albumGroup.album,
                    artist: albumGroup.artist,
                    actualSubmitters: albumActualSubmitters
                }));
                const lifelineHint = onThisAlbum.map(t => (
                    t === 'fiftyFifty' ? '50:50' : t === 'audience' ? 'Ask the Audience' : t === 'phone' ? 'Phone a Friend' : t
                )).join(', ');
                const spotifyUrl = albumGroup.submissions.map(s => s.url).find(u => u && extractSpotifyAlbumId(u)) || '';
                const spotifyUrlAttr = spotifyUrl ? escapeAttr(spotifyUrl) : '';
                return `
                    <div class="album-card" data-album-key="${albumGroup.key}">
                        ${`
                        <div class="catchphrase-art-cell" data-spotify-url="${spotifyUrlAttr}" data-artist="${escapeAttr(albumGroup.artist)}" data-album="${escapeAttr(albumGroup.album)}">
                            <div class="catchphrase-panel">
                                <div class="catchphrase-art-wrap">
                                    <span class="catchphrase-art-placeholder" aria-hidden="true">…</span>
                                    <img class="catchphrase-album-thumb" alt="" width="120" height="120" hidden>
                                </div>
                                <div class="catchphrase-copy">
                                    <span class="catchphrase-say-what">Say what you see…</span>
                                    <p class="catchphrase-title-line"><strong>${albumTitleEsc}</strong></p>
                                    <p class="catchphrase-artist-line">${albumArtistEsc}</p>
                                </div>
                            </div>
                            <img src="${ROY_WALKER_IMAGE}" alt="Roy Walker" class="catchphrase-roy-host" width="72" height="72">
                        </div>
                        `}
                        <div class="guess-form">
                            <div class="guess-form-lifeline-row">
                                <div class="guess-options" 
                                     data-album-key="${albumGroup.key}" 
                                     data-album-meta="${albumMetaAttr}"
                                     data-use-radio="${useRadioButtons}" 
                                     data-max-selections="${maxDuplicateCount}"
                                     role="group"
                                     aria-label="${useRadioButtons ? 'Pick who submitted this album (choose one)' : escapeAttr(`Pick who submitted this album (up to ${maxDuplicateCount})`)}">
                                    ${submittersThisWeek.map(m => {
                                    const isSelected = existingGuesses.includes(m);
                                    const inputType = useRadioButtons ? 'radio' : 'checkbox';
                                    const inputName = useRadioButtons ? `guess-${albumGroup.key}` : '';
                                    const mAttr = escapeAttr(m);
                                    return `
                                        <label class="guess-option-label" data-person="${mAttr}" style="display: flex; align-items: center; margin-bottom: 10px; ${guessesFinalized ? 'opacity: 0.6;' : 'cursor: pointer;'}">
                                            <input type="${inputType}" 
                                                   name="${inputName}"
                                                   value="${mAttr}" 
                                                   ${isSelected ? 'checked' : ''}
                                                   ${guessesFinalized ? 'disabled' : ''}
                                                   class="guess-input"
                                                   style="margin-right: 8px; width: 18px; height: 18px; ${guessesFinalized ? '' : 'cursor: pointer;'}">
                                            <span>${escapeHtml(m)}</span>
                                        </label>
                                    `;
                                }).join('')}
                                </div>
                                ${!guessesFinalized ? `
                                <div class="album-lifeline-stack" data-album-key="${albumGroup.key}">
                                    <button type="button" class="btn-lifeline-icon" data-lifeline-action="fiftyFifty" data-album-key="${albumGroup.key}" title="50:50" aria-label="50:50" ${fiftyDisabled ? 'disabled' : ''}>
                                        <img src="${LIFELINE_ICON_5050}" alt="">
                                    </button>
                                    <button type="button" class="btn-lifeline-icon" data-lifeline-action="audience" data-album-key="${albumGroup.key}" title="Ask the Audience" aria-label="Ask the Audience" ${audienceDisabled ? 'disabled' : ''}>
                                        <img src="${LIFELINE_ICON_AUDIENCE}" alt="">
                                    </button>
                                    <button type="button" class="btn-lifeline-icon" data-lifeline-action="phone" data-album-key="${albumGroup.key}" title="Phone a Friend" aria-label="Phone a Friend" ${phoneDisabled ? 'disabled' : ''}>
                                        <img src="${LIFELINE_ICON_PHONE}" alt="">
                                    </button>
                                    <span class="lifeline-on-album-hint" ${onThisAlbum.length ? '' : 'style="display:none"'}>Used on this album: ${escapeHtml(lifelineHint)}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
            ${currentGuesser && !guessesFinalized ? `
                <button class="btn btn-success" id="save-guesses-btn">Save & Finalize Guesses</button>
                <p style="margin-top: 10px; color: #666666; font-size: 0.9rem;">You must select at least one person for each album before saving.</p>
            ` : ''}
            <div id="guess-message"></div>
        </div>
    `;
}

function setupGuessPage() {
    const guessGroups = document.querySelectorAll('.guess-options');
    const guessesFinalized = document.querySelector('.page.active')?.getAttribute('data-guesses-finalized') === 'true';

    const guesserNameInput = document.getElementById('guesser-name-guess');
    if (guesserNameInput) {
        guesserNameInput.addEventListener('change', async (e) => {
            currentGuesser = e.target.value.trim();
            localStorage.setItem('currentGuesser', currentGuesser);
            await updateNavigationVisibility();
            await renderPage('guess');
        });
    }

    const saveBtn = document.getElementById('save-guesses-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!currentGuesser) {
                showMessage('guess-message', 'Please enter your name first.', 'error');
                return;
            }
            let totalGuesses = 0;
            let albumsWithNoSelection = [];

            // Validate that each album has at least one selection
            let albumsWithMultiple = 0;
            let invalidAlbum = null;
            const maxDuplicateCount = guessGroups.length > 0 
                ? parseInt(document.querySelector('.guess-options[data-max-selections]')?.getAttribute('data-max-selections') || '1')
                : 1;
            
            for (const group of guessGroups) {
                const albumKey = group.getAttribute('data-album-key');
                const useRadio = group.getAttribute('data-use-radio') === 'true';
                const selected = useRadio 
                    ? group.querySelector('input[type="radio"]:checked')
                    : group.querySelectorAll('input[type="checkbox"]:checked');
                
                if ((useRadio && !selected) || (!useRadio && selected.length === 0)) {
                    albumsWithNoSelection.push(albumKey);
                }
                
                // Check for multiple selections (only for checkboxes)
                if (!useRadio && selected.length > 1) {
                    albumsWithMultiple++;
                    if (selected.length > maxDuplicateCount) {
                        invalidAlbum = albumKey;
                        break;
                    }
                }
            }

            if (albumsWithNoSelection.length > 0) {
                showMessage('guess-message', 'Please select at least one person for each album before saving.', 'error');
                return;
            }

            if (invalidAlbum) {
                showMessage('guess-message', `You can only select up to ${maxDuplicateCount} people on one album.`, 'error');
                return;
            }

            // Validate duplicate selection rules
            if (albumsWithMultiple > 1) {
                showMessage('guess-message', 'Only one album can have multiple selections. Please adjust your guesses.', 'error');
                return;
            }

            // Collect all guesses to save first
            const guessesToSave = [];
            for (const group of guessGroups) {
                const albumKey = group.getAttribute('data-album-key');
                const useRadio = group.getAttribute('data-use-radio') === 'true';
                
                if (useRadio) {
                    const selected = group.querySelector('input[type="radio"]:checked');
                    if (selected) {
                        guessesToSave.push({ albumKey, guessedSubmitter: selected.value });
                        totalGuesses++;
                    }
                } else {
                    const checkedBoxes = group.querySelectorAll('input[type="checkbox"]:checked');
                    for (const checkbox of checkedBoxes) {
                        guessesToSave.push({ albumKey, guessedSubmitter: checkbox.value });
                        totalGuesses++;
                    }
                }
            }

            // Validate: no person selected more than once across all albums
            const countByPerson = {};
            for (const g of guessesToSave) {
                countByPerson[g.guessedSubmitter] = (countByPerson[g.guessedSubmitter] || 0) + 1;
            }
            const overSelected = Object.entries(countByPerson).find(([, count]) => count > 1);
            if (overSelected) {
                showMessage('guess-message', `You can select each person at most once. "${overSelected[0]}" is selected ${overSelected[1]} times.`, 'error');
                return;
            }

            const preConfirm = await openConfirmModal({
                title: 'Finalize guesses?',
                bodyHtml: '<p>Are you sure you want to save and finalize your guesses? You will not be able to change them after this.</p>',
                confirmLabel: 'Continue',
                cancelLabel: 'Cancel'
            });
            if (!preConfirm) return;

            const week = Storage.getCurrentWeek();
            const albumCount = guessGroups.length;
            const offer = computeBankerOffer(week, currentGuesser, albumCount);
            const bankerChoice = await openBankerOfferModal(offer);
            if (bankerChoice === null) return;

            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            try {
                const data = await Storage.getFreshData();
                if (!data.guesses) data.guesses = {};
                if (!data.guesses[week]) data.guesses[week] = [];
                data.guesses[week] = data.guesses[week].filter(g => g.guesser !== currentGuesser || !g.albumKey);
                for (const g of guessesToSave) {
                    data.guesses[week].push({
                        albumKey: g.albumKey,
                        guesser: currentGuesser,
                        guessedSubmitter: g.guessedSubmitter,
                        week
                    });
                }
                if (!data.finalizedGuesses) data.finalizedGuesses = {};
                if (!data.finalizedGuesses[week]) data.finalizedGuesses[week] = [];
                if (!data.finalizedGuesses[week].includes(currentGuesser)) {
                    data.finalizedGuesses[week].push(currentGuesser);
                }
                if (!data.deals) data.deals = {};
                if (!data.deals[week]) data.deals[week] = {};
                data.deals[week][currentGuesser] = { offer, accepted: bankerChoice === true };

                const saveResult = await Storage.saveData(data);
                if (!saveResult || !saveResult.success) {
                    throw new Error('Failed to save guesses');
                }

                await updateNavigationVisibility();
                await renderPage('guess');
                showMessage('guess-message', 'Guesses saved and finalized! Results will be revealed at midday on Friday once everyone has guessed, or at 4pm if anyone is still outstanding.', 'success');
            } catch (error) {
                console.error('Error saving guesses:', error);
                showMessage('guess-message', 'Error saving guesses: ' + error.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save & Finalize Guesses';
            }
        });
    }

    async function getMyLifelineList() {
        const week = Storage.getCurrentWeek();
        const byWeek = await Storage.getLifelinesForWeek(week);
        return byWeek[currentGuesser] || [];
    }

    function findGuessGroupByAlbumKey(albumKey) {
        return [...document.querySelectorAll('.guess-options')].find(g => g.getAttribute('data-album-key') === albumKey);
    }

    function rehydrateFiftyFiftyFromState(entries) {
        entries.filter(e => e.type === 'fiftyFifty').forEach(entry => {
            const group = findGuessGroupByAlbumKey(entry.albumKey);
            if (!group) return;
            const meta = parseAlbumMeta(group);
            const allNames = getNamesFromGuessGroup(group);
            const actual = meta.actualSubmitters || [];
            const wrongPool = allNames.filter(n => !actual.includes(n));
            const rand = randomForSeed(`${Storage.getCurrentWeek()}|${currentGuesser}|fiftyRehydrate|${entry.albumKey}`);
            const keep = new Set(actual);
            if (wrongPool.length > 0) {
                keep.add(wrongPool[Math.floor(rand() * wrongPool.length)]);
            }
            applyFiftyFiftyKeepSet(group, keep);
        });
    }

    document.querySelectorAll('.btn-lifeline-icon').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (guessesFinalized || !currentGuesser) return;
            const albumKey = btn.getAttribute('data-album-key');
            const action = btn.getAttribute('data-lifeline-action');
            const group = findGuessGroupByAlbumKey(albumKey);
            if (!group || !action) return;

            const list = await getMyLifelineList();
            if (action === 'fiftyFifty' && list.some(e => e.type === 'fiftyFifty')) return;
            if (action === 'audience' && list.some(e => e.type === 'audience')) return;
            if (action === 'phone' && list.some(e => e.type === 'phone')) return;

            const meta = parseAlbumMeta(group);
            const allNames = getNamesFromGuessGroup(group);
            const actual = meta.actualSubmitters || [];
            const week = Storage.getCurrentWeek();
            const seedBase = `${week}|${currentGuesser}|${albumKey}|${action}`;

            if (action === 'fiftyFifty') {
                const wrongPool = allNames.filter(n => !actual.includes(n));
                if (wrongPool.length === 0 || allNames.length <= 2) return;
                const ok = await openConfirmModal({
                    title: 'Use 50:50?',
                    image: CHRIS_IMAGE_5050,
                    bodyHtml: LIFELINE_CONFIRM_BODY,
                    confirmLabel: 'Use lifeline',
                    cancelLabel: 'Cancel'
                });
                if (!ok) return;
                const rand = randomForSeed(`${seedBase}|fifty`);
                const keep = new Set(actual);
                keep.add(wrongPool[Math.floor(rand() * wrongPool.length)]);
                const removed = allNames.length - keep.size;
                const answerWord = removed === 1 ? 'answer' : 'answers';
                const line = `Ok, Computer, take away ${removed} random wrong ${answerWord}, leaving the right answer and the one remaining wrong answer.`;
                list.push({ albumKey, type: 'fiftyFifty' });
                await Storage.saveGuesserLifelines(week, currentGuesser, list);
                applyFiftyFiftyKeepSet(group, keep);
                await openConfirmModal({
                    title: 'Chris says…',
                    image: CHRIS_IMAGE_5050,
                    bodyHtml: `<p>${escapeHtml(line)}</p>`,
                    confirmLabel: 'OK',
                    cancelLabel: 'Close'
                });
                document.querySelectorAll('.btn-lifeline-icon[data-lifeline-action="fiftyFifty"]').forEach(b => { b.disabled = true; });
                return;
            }

            if (action === 'audience') {
                const ok = await openConfirmModal({
                    title: 'Ask the Audience?',
                    image: CHRIS_IMAGE_AUDIENCE,
                    bodyHtml: LIFELINE_CONFIRM_BODY,
                    confirmLabel: 'Use lifeline',
                    cancelLabel: 'Cancel'
                });
                if (!ok) return;
                list.push({ albumKey, type: 'audience' });
                await Storage.saveGuesserLifelines(week, currentGuesser, list);
                const audienceNames = getActiveNamesFromGuessGroup(group);
                const rand = randomForSeed(`${seedBase}|audience`);
                const weights = audienceStyleWeightsForNames(audienceNames, actual, rand);
                const pct = percentagesFromWeights(weights);
                const intro = `Ok, Audience, let's try and help ${escapeHtml(currentGuesser)} get up to a point. The question is: who submitted ${escapeHtml(meta.title || '')} by ${escapeHtml(meta.artist || '')}? `;
                const keypad = formatAudienceKeypadLine(audienceNames);
                const body = `<p>${intro}${keypad}</p>${buildAudienceBarsHtml(audienceNames, pct)}`;
                await openConfirmModal({
                    title: 'Chris & the Audience',
                    image: CHRIS_IMAGE_AUDIENCE,
                    bodyHtml: body,
                    confirmLabel: 'OK',
                    cancelLabel: 'Close'
                });
                document.querySelectorAll('.btn-lifeline-icon[data-lifeline-action="audience"]').forEach(b => { b.disabled = true; });
                return;
            }

            if (action === 'phone') {
                const ok = await openConfirmModal({
                    title: 'Phone a Friend?',
                    image: CHRIS_IMAGE_PHONE,
                    bodyHtml: LIFELINE_CONFIRM_BODY,
                    confirmLabel: 'Use lifeline',
                    cancelLabel: 'Cancel'
                });
                if (!ok) return;
                list.push({ albumKey, type: 'phone' });
                await Storage.saveGuesserLifelines(week, currentGuesser, list);
                const phoneNames = getActiveNamesFromGuessGroup(group);
                const actualInPlay = actual.filter(n => phoneNames.includes(n));
                const rand = randomForSeed(`${seedBase}|phone`);
                const others = (await Storage.getTeamMembers()).filter(n => n !== currentGuesser);
                const friend = others.length > 0 ? others[Math.floor(rand() * others.length)] : 'Friend';
                const wrongOnly = phoneNames.filter(n => !actual.includes(n));
                const pickTwoTips = () => {
                    if (wrongOnly.length >= 2 && rand() < 0.2) {
                        const sh = shuffleWithRand([...wrongOnly], randomForSeed(`${seedBase}|bothWrong`));
                        return [sh[0], sh[1]];
                    }
                    const a = actualInPlay.length > 0 ? actualInPlay[Math.floor(rand() * actualInPlay.length)] : phoneNames[0];
                    let b = wrongOnly.length > 0 ? wrongOnly[Math.floor(rand() * wrongOnly.length)] : (phoneNames.find(n => n !== a) || a);
                    if (b === a && phoneNames.length > 1) {
                        b = phoneNames.find(n => n !== a) || b;
                    }
                    return [a, b];
                };
                const [tip1, tip2] = pickTwoTips();
                const albumTitle = meta.title || 'this album';
                const albumArtist = meta.artist || 'this artist';
                const answersPart = phoneNames.map((n, i) => `${LETTER_LABELS[i]}: ${n}`).join(', ');
                const meChoicesLine = `Who picked ${albumTitle} by ${albumArtist}. ${answersPart}`;
                removeGameshowModal();
                const backdrop = document.createElement('div');
                backdrop.className = 'gameshow-modal-backdrop';
                backdrop.id = 'gameshow-modal-backdrop';
                backdrop.innerHTML = `
                    <div class="gameshow-modal-card phone-call-modal" role="dialog" aria-modal="true">
                        <img src="${CHRIS_IMAGE_PHONE}" alt="" class="gameshow-host-img">
                        <h3 class="gameshow-modal-title">Phone a Friend</h3>
                        <div class="phone-call-log" id="phone-call-log"></div>
                        <p class="phone-call-timer" id="phone-call-timer">0:30</p>
                        <div class="gameshow-modal-actions">
                            <button type="button" class="btn" id="phone-call-close-btn">Close</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(backdrop);
                const logEl = backdrop.querySelector('#phone-call-log');
                const timerEl = backdrop.querySelector('#phone-call-timer');
                let finished = false;
                let tenSecondMessageShown = false;
                let fiveSecondMessageShown = false;
                const pendingTimeouts = [];
                const lines = [
                    { speaker: 'Chris', text: `Hello, is that ${friend}?` },
                    { speaker: friend, text: 'Yes, hello?' },
                    { speaker: 'Chris', text: `Hello ${friend}, it's Chris Tarrant here from ${GAME_SHOW_TITLE}. I've got ${currentGuesser} with me, and they need your help. You've got thirty seconds. ${currentGuesser}, you can speak to ${friend} now.` },
                    { speaker: currentGuesser, text: meChoicesLine },
                    { speaker: friend, text: `I think it might be ${tip1}, or maybe ${tip2}.` }
                ];
                const lineDelaysMs = [1600, 1600, 1400, 1600, 1800];
                const randCertainty = randomForSeed(`${seedBase}|phone|tenSec`);
                const certaintyWeights = audienceStyleWeightsForNames(phoneNames, actual, randCertainty);
                const certaintyPick = pickFromWeighted(phoneNames, certaintyWeights, randCertainty);
                /** Sound confident on the phone (not a fair split across N options like the audience bars). */
                const certaintySoundingPct = 80 + Math.floor(randCertainty() * 16);
                const pushLine = (i) => {
                    if (i >= lines.length || finished) return;
                    const row = document.createElement('div');
                    row.className = 'phone-call-line';
                    row.innerHTML = `<strong>${escapeHtml(lines[i].speaker)}:</strong> ${escapeHtml(lines[i].text)}`;
                    logEl.appendChild(row);
                    logEl.scrollTop = logEl.scrollHeight;
                    const delay = lineDelaysMs[i] ?? 1800;
                    pendingTimeouts.push(setTimeout(() => pushLine(i + 1), delay));
                };
                const deadline = Date.now() + 30000;
                const tick = () => {
                    if (finished) return;
                    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
                    timerEl.textContent = `0:${String(left).padStart(2, '0')}`;
                    if (left === 10 && !tenSecondMessageShown) {
                        tenSecondMessageShown = true;
                        const q = document.createElement('div');
                        q.className = 'phone-call-line';
                        q.innerHTML = `<strong>${escapeHtml(currentGuesser)}:</strong> How certain are you?`;
                        logEl.appendChild(q);
                        const a = document.createElement('div');
                        a.className = 'phone-call-line';
                        a.innerHTML = `<strong>${escapeHtml(friend)}:</strong> I'd say about ${certaintySoundingPct}%—I'd go with ${escapeHtml(certaintyPick)}.`;
                        logEl.appendChild(a);
                        logEl.scrollTop = logEl.scrollHeight;
                    }
                    if (left === 5 && !fiveSecondMessageShown) {
                        fiveSecondMessageShown = true;
                        const warn = document.createElement('div');
                        warn.className = 'phone-call-line phone-call-line-five';
                        warn.innerHTML = '<strong>Chris:</strong> I\'m going to have to hurry you.';
                        logEl.appendChild(warn);
                        logEl.scrollTop = logEl.scrollHeight;
                    }
                    if (left <= 0) {
                        finished = true;
                        const outOfTime = document.createElement('div');
                        outOfTime.className = 'phone-call-line phone-call-line-timeout';
                        outOfTime.innerHTML = '<strong>Chris:</strong> Sorry, we\'ve run out of time.';
                        logEl.appendChild(outOfTime);
                        timerEl.textContent = '0:00';
                        logEl.scrollTop = logEl.scrollHeight;
                        return;
                    }
                    pendingTimeouts.push(setTimeout(tick, 250));
                };
                pushLine(0);
                tick();
                const closeModal = () => {
                    finished = true;
                    pendingTimeouts.forEach(id => clearTimeout(id));
                    removeGameshowModal();
                };
                backdrop.querySelector('#phone-call-close-btn').addEventListener('click', closeModal);
                backdrop.addEventListener('click', (e) => {
                    if (e.target === backdrop) closeModal();
                });
                document.querySelectorAll('.btn-lifeline-icon[data-lifeline-action="phone"]').forEach(b => { b.disabled = true; });
            }
        });
    });

    if (!guessesFinalized && currentGuesser) {
        getMyLifelineList().then(list => rehydrateFiftyFiftyFromState(list));
    }

    // Count how many times each person is selected across all albums; enforce max 1 per person
    function getSelectionCountByPerson() {
        const count = {};
        guessGroups.forEach(group => {
            const useRadio = group.getAttribute('data-use-radio') === 'true';
            const inputs = group.querySelectorAll(useRadio ? 'input[type="radio"]:checked' : 'input[type="checkbox"]:checked');
            inputs.forEach(input => {
                const name = input.value;
                count[name] = (count[name] || 0) + 1;
            });
        });
        return count;
    }

    function updateMaxOnePerPersonState() {
        const countByPerson = getSelectionCountByPerson();
        guessGroups.forEach(group => {
            const useRadio = group.getAttribute('data-use-radio') === 'true';
            const inputs = group.querySelectorAll(useRadio ? 'input[type="radio"]' : 'input[type="checkbox"]');
            inputs.forEach(input => {
                const label = input.closest('.guess-option-label');
                if (label?.classList.contains('lifeline-fifty-excluded')) {
                    input.disabled = true;
                    return;
                }
                const name = input.value;
                const total = countByPerson[name] || 0;
                const alreadySelectedHere = input.checked;
                input.disabled = guessesFinalized;
                if (!guessesFinalized && !alreadySelectedHere && total >= 1) {
                    input.disabled = true;
                }
            });
        });
    }

    updateMaxOnePerPersonState();

    // Auto-save on change (only if not finalized) - for checkboxes only (radio buttons handled on save)
    const hasDuplicates = document.querySelector('.guess-options[data-use-radio="false"]') !== null;
    
    guessGroups.forEach(group => {
        const useRadio = group.getAttribute('data-use-radio') === 'true';
        const maxSelections = parseInt(group.getAttribute('data-max-selections')) || 1;
        
        if (!useRadio && hasDuplicates) {
            // Checkboxes with duplicate logic - limit selections
            const checkboxes = group.querySelectorAll('input[type="checkbox"]');
            
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', async () => {
                    if (currentGuesser && !checkbox.disabled) {
                        // Count current selections in this album (after the change)
                        const checkedInThisAlbum = group.querySelectorAll('input[type="checkbox"]:checked').length;
                        
                        // Count albums with multiple selections (excluding this one)
                        let albumsWithMultiple = 0;
                        guessGroups.forEach(otherGroup => {
                            if (otherGroup !== group) {
                                const checkedInOther = otherGroup.querySelectorAll('input[type="checkbox"]:checked').length;
                                if (checkedInOther > 1) {
                                    albumsWithMultiple++;
                                }
                            }
                        });
                        
                        if (checkbox.checked) {
                            // Check if this would exceed max selections for this album
                            if (checkedInThisAlbum > maxSelections) {
                                checkbox.checked = false;
                                showMessage('guess-message', `You can only select up to ${maxSelections} people on one album.`, 'error');
                                return;
                            }
                            // Check max 1 per person across all albums
                            const countByPerson = getSelectionCountByPerson();
                            if (countByPerson[checkbox.value] > 1) {
                                checkbox.checked = false;
                                showMessage('guess-message', 'You can select each person at most once across all albums.', 'error');
                                return;
                            }
                            // If this album now has multiple selections, ensure no other album has multiple
                            if (checkedInThisAlbum > 1 && albumsWithMultiple > 0) {
                                checkbox.checked = false;
                                showMessage('guess-message', 'Only one album can have multiple selections. Uncheck selections on other albums first.', 'error');
                                return;
                            }
                        }
                        updateMaxOnePerPersonState();
                        
                        try {
                            const albumKey = group.getAttribute('data-album-key');
                            const guessedSubmitter = checkbox.value;
                            if (checkbox.checked) {
                                await Storage.saveGuessForAlbum(albumKey, currentGuesser, guessedSubmitter);
                            } else {
                                await Storage.removeGuessForAlbum(albumKey, currentGuesser, guessedSubmitter);
                            }
                        } catch (error) {
                            showMessage('guess-message', error.message, 'error');
                            checkbox.checked = !checkbox.checked;
                            updateMaxOnePerPersonState();
                        }
                    }
                });
            });
        } else if (!useRadio) {
            // Regular checkboxes - still enforce max 1 per person
            const checkboxes = group.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', async () => {
                    if (currentGuesser && !checkbox.disabled) {
                        if (checkbox.checked) {
                            const countByPerson = getSelectionCountByPerson();
                            if (countByPerson[checkbox.value] > 1) {
                                checkbox.checked = false;
                                showMessage('guess-message', 'You can select each person at most once across all albums.', 'error');
                                return;
                            }
                        }
                        updateMaxOnePerPersonState();
                        try {
                            const albumKey = group.getAttribute('data-album-key');
                            const guessedSubmitter = checkbox.value;
                            if (checkbox.checked) {
                                await Storage.saveGuessForAlbum(albumKey, currentGuesser, guessedSubmitter);
                            } else {
                                await Storage.removeGuessForAlbum(albumKey, currentGuesser, guessedSubmitter);
                            }
                        } catch (error) {
                            showMessage('guess-message', error.message, 'error');
                            checkbox.checked = !checkbox.checked;
                            updateMaxOnePerPersonState();
                        }
                    }
                });
            });
        } else {
            // Radio buttons - enforce max 1 per person on change
            const radios = group.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => {
                radio.addEventListener('change', () => {
                    updateMaxOnePerPersonState();
                });
            });
        }
    });

    if (guessGroups.length > 0 && currentGuesser) {
        const week = Storage.getCurrentWeek();
        maybeShowCrystalMazeDeadlinePopup(week);
        hydrateCatchphraseAlbumArt(document).catch(() => {});
    }
}

// Results Page
async function renderResultsPage() {
    const currentWeek = Storage.getCurrentWeek();
    const allWeeks = await Storage.getAllWeeks();
    const weekSet = new Set([...allWeeks, currentWeek]);
    const weeks = [...weekSet].sort((a, b) => {
        const parse = (s) => {
            const [d, m, y] = s.split('/').map(Number);
            return new Date(y, m - 1, d).getTime();
        };
        return parse(b) - parse(a);
    });
    
    return `
        <div class="page active">
            ${previewModeBanner()}
            <h2 class="page-title">Results</h2>
            ${weeks.length > 1 ? `
                <div class="week-selector">
                    <label>Select Week: </label>
                    <select id="week-selector">
                        ${weeks.map(w => `
                            <option value="${w}" ${w === currentWeek ? 'selected' : ''}>${w}</option>
                        `).join('')}
                    </select>
                </div>
            ` : ''}
            <div id="results-content">Loading...</div>
        </div>
    `;
}

async function setupResultsPage() {
    selectedWeek = Storage.getCurrentWeek();

    const weekSelector = document.getElementById('week-selector');
    if (weekSelector) {
        weekSelector.value = selectedWeek;
        weekSelector.addEventListener('change', async (e) => {
            selectedWeek = e.target.value;
            await renderResultsContent(selectedWeek);
        });
    }
    await renderResultsContent(selectedWeek);
}

async function renderResultsContent(week) {
    const results = await Storage.getWeekResults(week);
    const content = document.getElementById('results-content');
    
    if (!content) return;

    if (!(await isWeekResultsRevealed(week))) {
        content.innerHTML = `<div class="empty-state">${await renderResultsWaitingMessage(week)}</div>`;
        return;
    }
    
    if (results.submissions.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No submissions for this week yet.</p></div>';
        return;
    }

    // Group submissions by album key
    const albumGroups = {};
    results.submissions.forEach(sub => {
        const key = `${sub.artist.toLowerCase()}-${sub.album.toLowerCase()}`;
        if (!albumGroups[key]) {
            albumGroups[key] = {
                key: key,
                artist: sub.artist,
                album: sub.album,
                url: sub.url || '',
                actualSubmitters: []
            };
        } else {
            const cur = albumGroups[key].url || '';
            const next = sub.url || '';
            if (extractSpotifyAlbumId(next) && !extractSpotifyAlbumId(cur)) {
                albumGroups[key].url = next;
            } else if (!cur && next) {
                albumGroups[key].url = next;
            }
        }
        albumGroups[key].actualSubmitters.push(sub.submitter);
    });

    // Get guesses for this guesser, grouped by album key
    const guessesByAlbum = {};
    results.guesses.forEach(g => {
        if (g.guesser === currentGuesser && g.albumKey) {
            if (!guessesByAlbum[g.albumKey]) {
                guessesByAlbum[g.albumKey] = [];
            }
            guessesByAlbum[g.albumKey].push(g.guessedSubmitter);
        }
    });

    // Show grouped albums
    let correctCount = 0;
    let guessedCount = 0;
    const submissionsHtml = Object.values(albumGroups).map(albumGroup => {
        const actualSubmitters = [...new Set(albumGroup.actualSubmitters)];
        const guessedSubmitters = [...new Set(guessesByAlbum[albumGroup.key] || [])];
        const correctGuesses = guessedSubmitters.filter(g => actualSubmitters.includes(g));
        const missedSubmitters = actualSubmitters.filter(a => !guessedSubmitters.includes(a));
        const hasGuesses = guessedSubmitters.length > 0;
        const allCorrect = missedSubmitters.length === 0 && correctGuesses.length === actualSubmitters.length;

        if (hasGuesses) {
            guessedCount++;
            if (allCorrect) correctCount++;
        }

        const resultMessage = hasGuesses
            ? (allCorrect ? '✓ Correct' : '✗ Incorrect')
            : '';

        const albumTitleEsc = escapeHtml(albumGroup.album);
        const albumArtistEsc = escapeHtml(albumGroup.artist);
        const youLineInner = hasGuesses
            ? `<strong>You said:</strong> ${guessedSubmitters.map(s => escapeHtml(s)).join(', ')}`
            : '';

        return `
            <div class="result-item ${hasGuesses ? (allCorrect ? 'correct' : 'incorrect') : ''}">
                <h4>${albumTitleEsc} — ${albumArtistEsc}</h4>
                ${youLineInner ? `<p>${youLineInner}</p>` : ''}
                <p><strong>Submitted by:</strong> ${actualSubmitters.map(s => escapeHtml(s)).join(', ')}</p>
                ${hasGuesses ? `<p><strong>Result:</strong> ${resultMessage}</p>` : ''}
            </div>
        `;
    }).join('');

    const dataForWeek = await Storage.getData();
    const weekLifelinesMap = dataForWeek.lifelines?.[week] || {};

    function lifelineMultFor(guesser, albumKey) {
        const list = weekLifelinesMap[guesser];
        if (!Array.isArray(list)) return 1;
        const n = list.filter(e => e && e.albumKey === albumKey).length;
        return 1 / Math.pow(2, n);
    }

    let myOnlyOwnAlbumCorrect = false;
    let myMissedOwnAlbum = false;
    let myActualPoints = 0;

    if (currentGuesser && guessedCount > 0) {
        let albumsAllCorrect = 0;
        let ownAlbumAllCorrect = false;
        Object.values(albumGroups).forEach(ag => {
            const actualSubmitters = [...new Set(ag.actualSubmitters)];
            const guessedSubmitters = guessesByAlbum[ag.key] || [];
            const correctGuesses = guessedSubmitters.filter(g => actualSubmitters.includes(g));
            const missedSubmitters = actualSubmitters.filter(a => !guessedSubmitters.includes(a));
            const hasGuesses = guessedSubmitters.length > 0;
            const allCorrect = hasGuesses && missedSubmitters.length === 0 && correctGuesses.length === actualSubmitters.length;
            if (allCorrect) albumsAllCorrect++;
            if (hasGuesses && actualSubmitters.includes(currentGuesser) && !guessedSubmitters.includes(currentGuesser)) {
                myMissedOwnAlbum = true;
            }
            if (hasGuesses && allCorrect && actualSubmitters.includes(currentGuesser)) {
                ownAlbumAllCorrect = true;
            }
            if (hasGuesses) {
                const mult = lifelineMultFor(currentGuesser, ag.key);
                myActualPoints += correctGuesses.length * mult;
            }
        });
        myOnlyOwnAlbumCorrect = albumsAllCorrect === 1 && ownAlbumAllCorrect && guessedCount > 1;
    }

    let scoreHeader = '';
    if (currentGuesser && guessedCount > 0) {
        const s = results.scores[currentGuesser];
        const actualStr = formatScoreNum(s?.correct ?? myActualPoints);
        const pub = s?.publishedCorrect != null ? s.publishedCorrect : (s?.correct ?? myActualPoints);
        const pubStr = formatScoreNum(pub);
        const deal = s?.deal;
        let dealLine = '';
        if (deal && typeof deal.offer === 'number') {
            dealLine = deal.accepted
                ? `<br><span class="deal-result-line">Banker offered ${formatScoreNum(deal.offer)}. You took the deal. Actual score: ${actualStr}.</span>`
                : `<br><span class="deal-result-line">Banker offered ${formatScoreNum(deal.offer)}. No deal — your score stays ${actualStr}.</span>`;
        }
        scoreHeader = `<p style="margin-bottom: 20px;"><strong>Your score:</strong> ${pubStr} points (${correctCount}/${guessedCount} albums fully correct)${dealLine}</p>`;
    }

    const cameoBullseye = currentGuesser && guessedCount > 0 && myOnlyOwnAlbumCorrect
        ? `<div class="results-cameo results-cameo--bullseye">
            <img src="${JIM_BOWEN_IMAGE}" alt="Jim Bowen" class="results-cameo-img">
            <p class="results-cameo-text">Let's have a look at what you could have won!</p>
           </div>`
        : '';
    const cameoBlobby = currentGuesser && guessedCount > 0 && !myOnlyOwnAlbumCorrect && (myActualPoints === 0 || myMissedOwnAlbum)
        ? `<div class="results-cameo results-cameo--blobby">
            <img src="${MR_BLOBBY_IMAGE}" alt="Mr Blobby" class="results-cameo-img">
            <p class="results-cameo-text">Blobby blob blob!</p>
           </div>`
        : '';

    // Calculate leaderboard (with ties: same score = same rank, no highlight when tied)
    const leaderboardSorted = Object.entries(results.scores)
        .filter(([member, score]) => score.total > 0)
        .map(([member, score]) => {
            const pub = score.publishedCorrect != null ? score.publishedCorrect : score.correct;
            return {
                member,
                correct: pub,
                actualCorrect: score.correct,
                total: score.total,
                percentage: score.total > 0 ? ((pub / score.total) * 100).toFixed(1) : 0,
                deal: score.deal
            };
        })
        .sort((a, b) => {
            if (b.correct !== a.correct) return b.correct - a.correct;
            return b.percentage - a.percentage;
        });
    const leaderboard = addLeaderboardRanks(leaderboardSorted, e => `${e.correct}-${e.total}-${e.percentage}`);
    const firstPlace = leaderboard.filter(e => e.rank === 1);
    const restPlace = leaderboard.filter(e => e.rank > 1);

    const leaderboardHtml = leaderboard.length > 0 ? `
        <div class="leaderboard">
            <h3 style="margin-top: 30px; margin-bottom: 20px;">Weekly Leaderboard</h3>
            ${firstPlace.length > 0 ? `
                <div class="leaderboard-first-row">
                    ${firstPlace.map((entry) => {
                        const main = `${formatScoreNum(entry.correct)}/${entry.total} (${entry.percentage}%)`;
                        const actualNote = entry.deal?.accepted
                            ? `<span class="leaderboard-score-under">Actual: ${formatScoreNum(entry.actualCorrect)}</span>`
                            : '';
                        return `
                        <div class="leaderboard-item ${entry.rankClass}">
                            <span><strong>${entry.displayRank}</strong> ${entry.member}</span>
                            ${firstPlace.length > 1
                                ? `<span class="leaderboard-score-block">${main}${actualNote}</span>`
                                : `<span>${main}</span>${actualNote}`
                            }
                        </div>
                    `;
                    }).join('')}
                </div>
            ` : ''}
            ${restPlace.length > 0 ? `
                <div class="leaderboard-rest-grid ${restPlace.length === 1 ? 'rest-count-1' : restPlace.length === 2 ? 'rest-count-2' : ''}">
                    ${restPlace.map((entry) => {
                        const main = `${formatScoreNum(entry.correct)}/${entry.total} (${entry.percentage}%)`;
                        const actualNote = entry.deal?.accepted
                            ? `<span class="leaderboard-score-under">Actual: ${formatScoreNum(entry.actualCorrect)}</span>`
                            : '';
                        return `
                        <div class="leaderboard-item ${entry.rankClass}">
                            <span><strong>${entry.displayRank}</strong> ${entry.member}</span>
                            <span class="leaderboard-score-block">${main}${actualNote}</span>
                        </div>
                    `;
                    }).join('')}
                </div>
            ` : ''}
        </div>
    ` : '';

    content.innerHTML = `
        <h3>Submissions & Results</h3>
        ${scoreHeader}
        ${cameoBullseye}
        ${cameoBlobby}
        <div class="results-grid">
            ${submissionsHtml}
        </div>
        ${leaderboardHtml}
    `;
}

// Stats Page
async function renderStatsPage() {
    const allWeeks = await Storage.getAllWeeks();
    const weeks = [];
    for (const w of allWeeks) {
        if (await isWeekResultsRevealed(w)) {
            weeks.push(w);
        }
    }
    const members = await Storage.getTeamMembers();

    if (weeks.length === 0) {
        const currentWeek = Storage.getCurrentWeek();
        const waitingMessage = await renderResultsWaitingMessage(currentWeek);
        return `
            <div class="page active">
                <h2 class="page-title">Stats</h2>
                <div class="empty-state">
                    ${waitingMessage}
                </div>
            </div>
        `;
    }

    const statsForDisplay = {};
    members.forEach(member => {
        statsForDisplay[member] = {
            totalCorrect: 0,
            totalGuesses: 0,
            totalSubmissions: 0,
            weeksPlayed: 0,
            weeksSubmitted: 0
        };
    });
    for (const week of weeks) {
        const results = await Storage.getWeekResults(week);
        const weekMembers = results.submissions.map(s => s.submitter);
        const uniqueWeekMembers = [...new Set(weekMembers)];
        members.forEach(member => {
            if (results.scores[member] && results.scores[member].total > 0) {
                const pub = results.scores[member].publishedCorrect != null
                    ? results.scores[member].publishedCorrect
                    : results.scores[member].correct;
                statsForDisplay[member].totalCorrect += pub;
                statsForDisplay[member].totalGuesses += results.scores[member].total;
                statsForDisplay[member].weeksPlayed++;
            }
            if (uniqueWeekMembers.includes(member)) {
                statsForDisplay[member].weeksSubmitted++;
            }
            statsForDisplay[member].totalSubmissions += results.scores[member]?.submissions || 0;
        });
    }

    const activeMembers = members.filter(m => statsForDisplay[m].totalGuesses > 0 || statsForDisplay[m].totalSubmissions > 0);
    if (activeMembers.length === 0) {
        return `
            <div class="page active">
                <h2 class="page-title">Stats</h2>
                <div class="empty-state">
                    <p>No stats available yet. Start playing to see your stats!</p>
                </div>
            </div>
        `;
    }

    // Overall leaderboard (with ties: same score = same rank, no highlight when tied)
    const overallSorted = activeMembers
        .map(member => ({
            member,
            ...statsForDisplay[member],
            accuracy: statsForDisplay[member].totalGuesses > 0 
                ? ((statsForDisplay[member].totalCorrect / statsForDisplay[member].totalGuesses) * 100).toFixed(1) 
                : 0
        }))
        .sort((a, b) => {
            const accA = parseFloat(a.accuracy);
            const accB = parseFloat(b.accuracy);
            if (accB !== accA) return accB - accA;
            return b.totalCorrect - a.totalCorrect;
        });
    const overallLeaderboard = addLeaderboardRanks(overallSorted, e => `${e.totalCorrect}-${e.totalGuesses}-${e.accuracy}`);

    // Week-by-week stats (revealed weeks only)
    const weekStats = [];
    for (const week of weeks) {
        const weekResults = await Storage.getWeekResults(week);
        const theme = await Storage.getWeekTheme(week);
        weekStats.push({
            week,
            results: weekResults.scores,
            theme
        });
    }

    return `
        <div class="page active">
            ${previewModeBanner()}
            <h2 class="page-title">Statistics</h2>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Overall Leaderboard</h3>
                    ${(() => {
                        const firstPlace = overallLeaderboard.filter(e => e.rank === 1);
                        const restPlace = overallLeaderboard.filter(e => e.rank > 1);
                        return `
                            ${firstPlace.length > 0 ? `
                                <div class="leaderboard-first-row">
                                    ${firstPlace.map((entry) => `
                                        <div class="leaderboard-item ${entry.rankClass}">
                                            <span><strong>${entry.displayRank}</strong> ${entry.member}<small class="leaderboard-weeks-played"> ${entry.weeksPlayed || 0} weeks played</small></span>
                                            <span>${formatScoreNum(entry.totalCorrect)}/${entry.totalGuesses} (${entry.accuracy}%)</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            ${restPlace.length > 0 ? `
                                <div class="leaderboard-rest-grid ${restPlace.length === 1 ? 'rest-count-1' : restPlace.length === 2 ? 'rest-count-2' : ''}">
                                    ${restPlace.map((entry) => `
                                        <div class="leaderboard-item ${entry.rankClass}">
                                            <span><strong>${entry.displayRank}</strong> ${entry.member}<small class="leaderboard-weeks-played"> ${entry.weeksPlayed || 0} weeks played</small></span>
                                            <span>${formatScoreNum(entry.totalCorrect)}/${entry.totalGuesses} (${entry.accuracy}%)</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        `;
                    })()}
                </div>
            </div>

            <h3 style="margin-top: 40px;">Week-by-Week Performance</h3>
            <div class="week-by-week-grid">
            ${weekStats.map(weekStat => {
                const weekLeaderboardSorted = Object.entries(weekStat.results)
                    .filter(([member, score]) => score.total > 0)
                    .map(([member, score]) => {
                        const pub = score.publishedCorrect != null ? score.publishedCorrect : score.correct;
                        return {
                            member,
                            correct: pub,
                            actualCorrect: score.correct,
                            total: score.total,
                            percentage: score.total > 0 ? ((pub / score.total) * 100).toFixed(1) : 0,
                            deal: score.deal
                        };
                    })
                    .sort((a, b) => {
                        if (b.correct !== a.correct) return b.correct - a.correct;
                        return b.percentage - a.percentage;
                    });
                const weekLeaderboard = addLeaderboardRanks(weekLeaderboardSorted, e => `${e.correct}-${e.total}-${e.percentage}`);
                const firstPlace = weekLeaderboard.filter(e => e.rank === 1);
                const restPlace = weekLeaderboard.filter(e => e.rank > 1);

                return `
                    <div class="stat-card week-card">
                        <h3>Week of ${weekStat.week}</h3>
                        ${renderWeekThemeBanner(weekStat.week, weekStat.theme)}
                        ${weekLeaderboard.length > 0 ? `
                            ${firstPlace.length > 0 ? `
                                <div class="leaderboard-first-row ${firstPlace.length > 1 ? 'first-row-multi' : ''}">
                                    ${firstPlace.map((entry) => {
                                        const line = `${formatScoreNum(entry.correct)}/${entry.total} (${entry.percentage}%)`;
                                        const actual = entry.deal?.accepted
                                            ? `<span class="leaderboard-score-under">Actual: ${formatScoreNum(entry.actualCorrect)}</span>`
                                            : '';
                                        return `
                                        <div class="leaderboard-item ${entry.rankClass}">
                                            <span><strong>${entry.displayRank}</strong> ${entry.member}</span>
                                            ${firstPlace.length > 1
                                                ? `<span class="leaderboard-score-block">${line}${actual}</span>`
                                                : `<span>${line}</span>${actual}`
                                            }
                                        </div>
                                    `;
                                    }).join('')}
                                </div>
                            ` : ''}
                            ${restPlace.length > 0 ? `
<div class="leaderboard-rest-grid ${restPlace.length === 1 ? 'rest-count-1' : restPlace.length === 2 ? 'rest-count-2' : ''} ${restPlace.length > 3 ? 'rest-stack' : ''}">
                                        ${restPlace.map((entry) => {
                                        const line = `${formatScoreNum(entry.correct)}/${entry.total} (${entry.percentage}%)`;
                                        const actual = entry.deal?.accepted
                                            ? `<span class="leaderboard-score-under">Actual: ${formatScoreNum(entry.actualCorrect)}</span>`
                                            : '';
                                        return `
                                        <div class="leaderboard-item ${entry.rankClass}">
                                            <span><strong>${entry.displayRank}</strong> ${entry.member}</span>
                                            <span class="leaderboard-score-block">${line}${actual}</span>
                                        </div>
                                    `;
                                    }).join('')}
                                </div>
                            ` : ''}
                        ` : '<p>No guesses recorded for this week.</p>'}
                    </div>
                `;
            }).join('')}
            </div>
        </div>
    `;
}

// Playlist Page
async function renderPlaylistPage() {
    const week = Storage.getCurrentWeek();
    const submissions = await Storage.getSubmissions(week);

    if (submissions.length === 0) {
        return `
            <div class="page active">
                ${previewModeBanner()}
                <h2 class="page-title">Spotify Playlist</h2>
                <div class="empty-state">
                    <p>No albums submitted yet this week.</p>
                </div>
            </div>
        `;
    }

    const idSig = submissions.map(s => s.id).sort((a, b) => a - b).join(',');
    const shuffled = seededShuffle([...submissions], `${week}|${idSig}`);

    // Extract Spotify album IDs from URLs (order follows shuffled list)
    const withSpotify = shuffled
        .map(sub => {
            const spotifyId = sub.url && sub.url.includes('spotify.com') ? extractSpotifyAlbumId(sub.url) : null;
            return spotifyId ? { ...sub, spotifyId } : null;
        })
        .filter(Boolean);

    return `
        <div class="page active">
            ${previewModeBanner()}
            <h2 class="page-title">Spotify Playlist</h2>
            <p style="margin-bottom: 20px; color: #666666;">
                Week: <strong>${week}</strong> | Total Albums: ${submissions.length} | With Spotify URLs: ${withSpotify.length}
            </p>
            <p style="margin-bottom: 16px; color: #666666; font-size: 0.95rem;">
                Album order is randomized for this week (same order for everyone). Add each album to your playlist without peeking at titles.
            </p>

            ${withSpotify.length > 0 ? `
                <div class="alert alert-info" style="margin-bottom: 30px;">
                    <h3 style="margin-bottom: 10px;">Create Playlist</h3>
                    <p style="margin-bottom: 15px;">
                        Use the buttons below to open each album in Spotify, then use the "..." menu to add it to your playlist.
                    </p>
                </div>

                <div style="display: grid; gap: 15px; margin-bottom: 30px;">
                    ${withSpotify.map((sub) => {
                        const spotifyAlbumUrl = `https://open.spotify.com/album/${sub.spotifyId}`;
                        return `
                            <a href="${spotifyAlbumUrl}" target="_blank" class="btn btn-open-spotify" style="text-decoration: none; color: white !important; text-align: center;">
                                Open in Spotify
                            </a>
                        `;
                    }).join('')}
                </div>
            ` : `
                <div class="alert alert-info">
                    <p>No Spotify album links were submitted this week.</p>
                </div>
            `}

            <div style="margin-top: 30px; padding: 20px; background: #fafafa; border: 2px solid #e0e0e0; border-radius: 8px;">
                <h3 style="margin-bottom: 10px; color: #333333;">Manual Playlist Creation</h3>
                <p style="color: #666666; margin-bottom: 15px;">
                    If the automatic playlist creation doesn't work, you can manually create a playlist in Spotify and add these albums:
                </p>
                <ol style="color: #666666; padding-left: 20px;">
                    <li>Open Spotify and create a new playlist</li>
                    <li>Click each "Open in Spotify" button above</li>
                    <li>Click the "..." menu on each album and select "Add to Playlist"</li>
                    <li>Select your new playlist</li>
                </ol>
            </div>
        </div>
    `;
}

function setupPlaylistPage() {
    // No special setup needed for playlist page
}

// Admin Page
async function renderAdminPage() {
    if (!Storage.isAdminLoggedIn()) {
        return `
            <div class="page active">
                <h2 class="page-title">Admin Login</h2>
                <div class="login-form">
                    <form id="admin-login-form">
                        <div class="form-group">
                            <label for="admin-password">Password:</label>
                            <input type="password" id="admin-password" placeholder="Enter admin password" required>
                        </div>
                        <button type="submit" class="btn">Login</button>
                    </form>
                    <div id="admin-message"></div>
                </div>
            </div>
        `;
    }

    const members = await Storage.getTeamMembers();
    const currentWeek = Storage.getCurrentWeek();
    const previewOn = Storage.isPreviewMode();
    const submissions = await Storage.getSubmissions(currentWeek);
    const guesses = await Storage.getGuesses(currentWeek);
    const weekTheme = await Storage.getWeekTheme(currentWeek);
    const isGameDay = await Storage.isGameDay(currentWeek);
    const gameDayOverride = await Storage.getGameDayOverride(currentWeek);
    const todayKey = Storage.getTodayKey();
    const isFriday = Storage.isFriday();

    return `
        <div class="page active">
            <h2 class="page-title">Admin Panel</h2>
            <button class="btn btn-secondary" id="logout-btn" style="margin-bottom: 20px;">Logout</button>

            <div class="admin-section admin-preview-section">
                <h2>Preview mode (local testing)</h2>
                <p style="color: #666666; margin-bottom: 15px; font-size: 0.95rem;">
                    Test lifelines, the banker, and results <strong>without writing real submissions or guesses to the shared Gist</strong>.
                    Mock data for <strong>${escapeHtml(currentWeek)}</strong> is stored only in this browser. Team members still come from the real list.
                </p>
                <p style="margin-bottom: 12px;">
                    Status: <strong>${previewOn ? 'On' : 'Off'}</strong>
                    ${previewOn ? ` · Mock submissions this week: ${submissions.length}` : ''}
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button type="button" class="btn" id="preview-enable-btn" style="background: #7b2cbf;" ${previewOn ? 'disabled' : ''}>
                        Enable preview &amp; seed mock albums
                    </button>
                    <button type="button" class="btn btn-secondary" id="preview-off-btn" ${!previewOn ? 'disabled' : ''}>
                        Turn off preview
                    </button>
                    <button type="button" class="btn" id="preview-reset-lifelines-btn" style="background: #5c4d7d;" ${!previewOn ? 'disabled' : ''}>
                        Reset lifelines (preview)
                    </button>
                    <button type="button" class="btn btn-secondary" id="preview-reseed-btn" ${!previewOn ? 'disabled' : ''}>
                        Re-seed mock albums
                    </button>
                </div>
                <div class="admin-preview-gameshow-tester">
                    <h3 style="margin: 20px 0 10px; font-size: 1.05rem;">Preview Crystal Maze &amp; Catchphrase</h3>
                    <p style="color: #666666; margin-bottom: 12px; font-size: 0.9rem;">
                        Try Richard&apos;s deadline popups any time (no Friday clock). Load album artwork the same way as on the Guess page (Spotify oEmbed, then iTunes fallback).
                    </p>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px;">
                        <label for="preview-crystal-window" class="sr-only">Crystal Maze message</label>
                        <select id="preview-crystal-window" class="admin-preview-select">
                            <option value="midday">Midday warning</option>
                            <option value="fourPmPending">4pm (still guessing)</option>
                            <option value="fourPmGeneric">4pm (straggler nudge)</option>
                            <option value="after4pm">After 4pm forfeit</option>
                        </select>
                        <button type="button" class="btn" id="preview-crystal-btn">Show Crystal Maze popup</button>
                        <button type="button" class="btn btn-secondary" id="preview-guess-catchphrase-btn" ${!previewOn ? 'disabled' : ''}>Open Guess (Catchphrase)</button>
                        <button type="button" class="btn btn-secondary" id="preview-catchphrase-refresh-btn" ${!previewOn ? 'disabled' : ''}>Load artwork preview</button>
                    </div>
                    <div id="preview-catchphrase-art-preview" class="preview-catchphrase-art-preview-host"></div>
                </div>
                <p style="color: #666666; margin-top: 12px; font-size: 0.9rem;">
                    After enabling, open <strong>Guess</strong>, pick your name from the team list, and use the Chris / Noel flows. Results and Stats unlock immediately in preview so you can check layouts.
                </p>
                <div id="preview-mode-message" style="margin-top: 10px;"></div>
            </div>
            
            <div class="admin-section">
                <h2>Add Team Member</h2>
                <form id="add-member-form">
                    <div class="form-group">
                        <label for="member-name">Name:</label>
                        <input type="text" id="member-name" placeholder="Enter team member name" required>
                    </div>
                    <button type="submit" class="btn">Add Member</button>
                </form>
                <div id="add-member-message"></div>
            </div>

            <div class="admin-section">
                <h2>Team Members</h2>
                ${members.length > 0 ? `
                    <ul class="team-member-list">
                        ${members.map(member => `
                            <li class="team-member-item">
                                <span>${member}</span>
                                <button class="btn btn-danger btn-delete-member" data-member="${member}">Delete</button>
                            </li>
                        `).join('')}
                    </ul>
                ` : '<p>No team members yet. Add one above!</p>'}
            </div>

            <div class="admin-section">
                <h2>Game Day</h2>
                <p style="color: #666666; margin-bottom: 15px;">
                    Week: <strong>${currentWeek}</strong><br>
                    Today: <strong>${todayKey}</strong><br>
                    Status: ${isGameDay
                        ? (isFriday
                            ? '<strong>Open</strong> (Friday)'
                            : `<strong>Open</strong> (admin enabled for ${escapeHtml(gameDayOverride || todayKey)})`)
                        : '<strong>Closed</strong> — submissions and theme appear on Friday'}
                </p>
                <p style="color: #666666; margin-bottom: 15px; font-size: 0.95rem;">
                    Press the button below to let everyone submit albums and see the theme of the week today (for playing on a different day).
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn" id="enable-game-day-btn" style="background: #00a8cc;" ${isFriday || (gameDayOverride === todayKey) ? 'disabled' : ''}>
                        ${gameDayOverride === todayKey ? 'Game Day Enabled for Today' : 'Enable Game Day Today'}
                    </button>
                    ${gameDayOverride ? `
                        <button class="btn btn-secondary" id="clear-game-day-btn">
                            Clear Early Game Day
                        </button>
                    ` : ''}
                </div>
                <div id="game-day-message" style="margin-top: 10px;"></div>
            </div>

            <div class="admin-section">
                <h2>Weekly Theme</h2>
                <p style="color: #666666; margin-bottom: 15px;">
                    Week: <strong>${currentWeek}</strong><br>
                    Current theme: ${weekTheme ? `<strong>${escapeHtml(weekTheme.text)}</strong>` : '<em>None set</em>'}
                </p>
                <button class="btn btn-danger" id="clear-theme-btn" ${!weekTheme ? 'disabled' : ''}>
                    Clear Theme
                </button>
                <div id="clear-theme-message" style="margin-top: 10px;"></div>
            </div>

            ${renderHarryHillPhotoExamples()}

            <div class="admin-section">
                <h2>Clear This Week's Data (Testing)</h2>
                <p style="color: #666666; margin-bottom: 15px;">
                    Week: <strong>${currentWeek}</strong><br>
                    Submissions: ${submissions.length} | Guesses: ${guesses.length}
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-danger" id="clear-submissions-btn" ${submissions.length === 0 ? 'disabled' : ''}>
                        Clear Submissions
                    </button>
                    <button class="btn btn-danger" id="clear-guesses-btn" ${guesses.length === 0 ? 'disabled' : ''}>
                        Clear Guesses
                    </button>
                    <button class="btn btn-danger" id="clear-both-btn" ${submissions.length === 0 && guesses.length === 0 ? 'disabled' : ''}>
                        Clear Both
                    </button>
                    <button class="btn" id="unlock-guesses-btn" style="background: #00a8cc;">
                        Unlock Finalized Guesses
                    </button>
                </div>
                <div id="clear-message" style="margin-top: 10px;"></div>
            </div>
        </div>
    `;
}

async function setupAdminPage() {
    setupHarryHillPhotoExamples();
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('admin-password').value;
            const correctPassword = await Storage.getAdminPassword();
            
            if (password === correctPassword) {
                Storage.setAdminLoggedIn(true);
                await updateNavigationVisibility();
                showMessage('admin-message', 'Login successful!', 'success');
                setTimeout(async () => {
                    await renderPage('admin');
                }, 500);
            } else {
                showMessage('admin-message', 'Incorrect password.', 'error');
            }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            Storage.setAdminLoggedIn(false);
            Storage.setPreviewMode(false);
            await updateNavigationVisibility();
            // If on settings page, redirect to admin
            if (currentPage === 'settings') {
                await navigateToPage('admin');
            } else {
                await renderPage('admin');
            }
        });
    }

    const previewEnableBtn = document.getElementById('preview-enable-btn');
    if (previewEnableBtn) {
        previewEnableBtn.addEventListener('click', async () => {
            previewEnableBtn.disabled = true;
            previewEnableBtn.textContent = 'Enabling…';
            try {
                Storage.setPreviewMode(true);
                const result = await Storage.seedPreviewWeekMockSubmissions();
                if (!result.success) {
                    Storage.setPreviewMode(false);
                    showMessage('preview-mode-message', result.message || 'Could not seed preview.', 'error');
                    return;
                }
                await updateNavigationVisibility();
                showMessage('preview-mode-message', result.message || 'Preview enabled.', 'success');
                setTimeout(async () => {
                    await renderPage('admin');
                }, 600);
            } catch (error) {
                Storage.setPreviewMode(false);
                showMessage('preview-mode-message', error.message || 'Error enabling preview.', 'error');
                previewEnableBtn.disabled = false;
                previewEnableBtn.textContent = 'Enable preview & seed mock albums';
            }
        });
    }

    const previewOffBtn = document.getElementById('preview-off-btn');
    if (previewOffBtn) {
        previewOffBtn.addEventListener('click', async () => {
            if (!confirm('Turn off preview mode? Local mock guesses for this week will be discarded.')) return;
            Storage.setPreviewMode(false);
            await updateNavigationVisibility();
            showMessage('preview-mode-message', 'Preview mode off.', 'success');
            setTimeout(async () => {
                await renderPage('admin');
            }, 400);
        });
    }

    const previewResetLifelinesBtn = document.getElementById('preview-reset-lifelines-btn');
    if (previewResetLifelinesBtn) {
        previewResetLifelinesBtn.addEventListener('click', async () => {
            const result = Storage.resetPreviewLifelines();
            if (!result.success) {
                showMessage('preview-mode-message', result.message || 'Could not reset lifelines.', 'error');
                return;
            }
            showMessage('preview-mode-message', result.message || 'Lifelines reset.', 'success');
            setTimeout(async () => {
                await renderPage(currentPage);
            }, 400);
        });
    }

    const previewReseedBtn = document.getElementById('preview-reseed-btn');
    if (previewReseedBtn) {
        previewReseedBtn.addEventListener('click', async () => {
            previewReseedBtn.disabled = true;
            try {
                const result = await Storage.seedPreviewWeekMockSubmissions();
                if (!result.success) {
                    showMessage('preview-mode-message', result.message || 'Could not re-seed.', 'error');
                    return;
                }
                showMessage('preview-mode-message', result.message || 'Mock albums re-seeded.', 'success');
                const artHost = document.getElementById('preview-catchphrase-art-preview');
                if (artHost) await fillAdminCatchphraseArtPreview(artHost);
            } finally {
                previewReseedBtn.disabled = false;
            }
        });
    }

    const previewCrystalBtn = document.getElementById('preview-crystal-btn');
    if (previewCrystalBtn) {
        previewCrystalBtn.addEventListener('click', async () => {
            const sel = document.getElementById('preview-crystal-window');
            const windowId = sel?.value || 'midday';
            await previewCrystalMazePopup(windowId);
        });
    }

    const previewGuessCatchphraseBtn = document.getElementById('preview-guess-catchphrase-btn');
    if (previewGuessCatchphraseBtn) {
        previewGuessCatchphraseBtn.addEventListener('click', async () => {
            await navigateToPage('guess');
        });
    }

    const previewCatchphraseRefreshBtn = document.getElementById('preview-catchphrase-refresh-btn');
    const previewCatchphraseArtHost = document.getElementById('preview-catchphrase-art-preview');
    if (previewCatchphraseRefreshBtn && previewCatchphraseArtHost) {
        previewCatchphraseRefreshBtn.addEventListener('click', async () => {
            previewCatchphraseRefreshBtn.disabled = true;
            try {
                await fillAdminCatchphraseArtPreview(previewCatchphraseArtHost);
            } finally {
                previewCatchphraseRefreshBtn.disabled = false;
            }
        });
        if (Storage.isPreviewMode() && previewCatchphraseArtHost) {
            fillAdminCatchphraseArtPreview(previewCatchphraseArtHost).catch(() => {});
        }
    }

    const addMemberForm = document.getElementById('add-member-form');
    if (addMemberForm) {
        addMemberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('member-name').value.trim();
            
            if (!name) {
                showMessage('add-member-message', 'Please enter a name.', 'error');
                return;
            }

            const submitBtn = addMemberForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';

            try {
                const success = await Storage.addTeamMember(name);
                if (success) {
                    showMessage('add-member-message', `Added ${name} to team!`, 'success');
                    addMemberForm.reset();
                    setTimeout(async () => {
                        await renderPage('admin');
                    }, 500);
                } else {
                    showMessage('add-member-message', 'Member already exists.', 'error');
                }
            } catch (error) {
                showMessage('add-member-message', 'Error adding member: ' + error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Member';
            }
        });
    }

    const deleteButtons = document.querySelectorAll('.btn-delete-member');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete ${btn.getAttribute('data-member')}?`)) {
                try {
                    await Storage.deleteTeamMember(btn.getAttribute('data-member'));
                    await renderPage('admin');
                } catch (error) {
                    alert('Error deleting member: ' + error.message);
                }
            }
        });
    });

    // Clear buttons
    const clearSubmissionsBtn = document.getElementById('clear-submissions-btn');
    if (clearSubmissionsBtn) {
        clearSubmissionsBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all submissions for this week? This cannot be undone.')) {
                try {
                    await Storage.clearWeekSubmissions();
                    showMessage('clear-message', 'Submissions cleared successfully!', 'success');
                    setTimeout(async () => {
                        await renderPage('admin');
                    }, 1000);
                } catch (error) {
                    showMessage('clear-message', 'Error clearing submissions: ' + error.message, 'error');
                }
            }
        });
    }

    const clearGuessesBtn = document.getElementById('clear-guesses-btn');
    if (clearGuessesBtn) {
        clearGuessesBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all guesses for this week? This cannot be undone.')) {
                try {
                    await Storage.clearWeekGuesses();
                    showMessage('clear-message', 'Guesses cleared successfully!', 'success');
                    setTimeout(async () => {
                        await renderPage('admin');
                    }, 1000);
                } catch (error) {
                    showMessage('clear-message', 'Error clearing guesses: ' + error.message, 'error');
                }
            }
        });
    }

    const clearBothBtn = document.getElementById('clear-both-btn');
    if (clearBothBtn) {
        clearBothBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear ALL submissions and guesses for this week? This cannot be undone.')) {
                try {
                    await Storage.clearWeekSubmissions();
                    await Storage.clearWeekGuesses();
                    showMessage('clear-message', 'All data cleared successfully!', 'success');
                    setTimeout(async () => {
                        await renderPage('admin');
                    }, 1000);
                } catch (error) {
                    showMessage('clear-message', 'Error clearing data: ' + error.message, 'error');
                }
            }
        });
    }

    const unlockGuessesBtn = document.getElementById('unlock-guesses-btn');
    if (unlockGuessesBtn) {
        unlockGuessesBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to unlock all finalized guesses for this week? Users will be able to edit their guesses again.')) {
                try {
                    await Storage.clearFinalizedGuesses();
                    showMessage('clear-message', 'Finalized guesses unlocked successfully!', 'success');
                    setTimeout(async () => {
                        await renderPage('admin');
                    }, 1000);
                } catch (error) {
                    showMessage('clear-message', 'Error unlocking guesses: ' + error.message, 'error');
                }
            }
        });
    }

    const clearThemeBtn = document.getElementById('clear-theme-btn');
    if (clearThemeBtn) {
        clearThemeBtn.addEventListener('click', async () => {
            const currentWeek = Storage.getCurrentWeek();
            if (confirm('Clear this week\'s theme? A new random theme will be chosen on the next page load.')) {
                try {
                    await Storage.clearWeekTheme();
                    localStorage.removeItem(`themePopupSeen_${currentWeek}`);
                    currentWeekTheme = null;
                    showMessage('clear-theme-message', 'Theme cleared successfully!', 'success');
                    setTimeout(async () => {
                        await renderPage('admin');
                    }, 1000);
                } catch (error) {
                    showMessage('clear-theme-message', 'Error clearing theme: ' + error.message, 'error');
                }
            }
        });
    }

    const enableGameDayBtn = document.getElementById('enable-game-day-btn');
    if (enableGameDayBtn) {
        enableGameDayBtn.addEventListener('click', async () => {
            if (Storage.isFriday()) {
                showMessage('game-day-message', 'It\'s already Friday — game day is open automatically.', 'info');
                return;
            }
            if (!confirm('Enable submissions and theme of the week for today? Everyone will be able to play as if it were Friday.')) {
                return;
            }
            enableGameDayBtn.disabled = true;
            enableGameDayBtn.textContent = 'Enabling...';
            try {
                const result = await Storage.enableGameDayToday();
                if (!result.success) {
                    showMessage('game-day-message', result.error || 'Failed to enable game day.', 'error');
                    return;
                }
                currentWeekTheme = await Storage.ensureWeekTheme();
                localStorage.removeItem(`themePopupSeen_${Storage.getCurrentWeek()}`);
                showThemePopupIfNeeded();
                showMessage('game-day-message', `Game day enabled for ${result.day}. Theme and submissions are now open.`, 'success');
                setTimeout(async () => {
                    await renderPage('admin');
                }, 1000);
            } catch (error) {
                showMessage('game-day-message', 'Error enabling game day: ' + error.message, 'error');
            } finally {
                enableGameDayBtn.disabled = false;
                enableGameDayBtn.textContent = 'Enable Game Day Today';
            }
        });
    }

    const clearGameDayBtn = document.getElementById('clear-game-day-btn');
    if (clearGameDayBtn) {
        clearGameDayBtn.addEventListener('click', async () => {
            if (!confirm('Clear the early game day override for this week? Submissions and theme will close until Friday (unless you enable again).')) {
                return;
            }
            try {
                await Storage.clearGameDayOverride();
                showMessage('game-day-message', 'Early game day cleared.', 'success');
                setTimeout(async () => {
                    await renderPage('admin');
                }, 1000);
            } catch (error) {
                showMessage('game-day-message', 'Error clearing game day: ' + error.message, 'error');
            }
        });
    }
}

// Settings Page
function renderSettingsPage() {
    const isConfigured = Storage.isGistConfigured();
    const gistId = Storage.getGistId();
    const hasToken = !!Storage.getGitHubToken();
    const currentUrl = window.location.origin + window.location.pathname;

    return `
        <div class="page active">
            <h2 class="page-title">Settings</h2>
            
            ${isConfigured ? `
                <div class="alert alert-success" style="margin-bottom: 30px;">
                    <h3 style="margin-bottom: 10px;">✓ Gist Connected</h3>
                    <p style="margin-bottom: 5px;"><strong>Gist ID:</strong> <code>${gistId}</code></p>
                </div>
            ` : ''}
            
            <div class="admin-section">
                <h2>Share with Team (Recommended)</h2>
                <p style="margin-bottom: 15px; color: #aaaaaa;">
                    Create a share URL that automatically configures the app for your team members. 
                    They don't need GitHub accounts or individual setup!
                </p>
                
                ${isConfigured ? `
                    <div style="background: #fafafa; border: 2px solid #e0e0e0; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 10px; font-weight: 600;">Share URL:</label>
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            <input type="text" id="share-url" readonly 
                                   value="${currentUrl}?token=${encodeURIComponent(Storage.getGitHubToken())}&gist=${encodeURIComponent(gistId)}"
                                   style="flex: 1; min-width: 300px; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-family: monospace; font-size: 0.9rem;">
                            <button class="btn" id="copy-url-btn">Copy URL</button>
                        </div>
                        <p style="margin-top: 10px; font-size: 0.9rem; color: #666666;">
                            Share this URL with your team. When they visit it, the app will automatically configure itself.
                            <strong>Note:</strong> The URL contains your GitHub token - only share it with trusted team members!
                        </p>
                    </div>
                ` : `
                    <div class="alert alert-info">
                        <p>Configure the Gist below first, then you'll be able to generate a share URL.</p>
                    </div>
                `}
            </div>
            
            <div class="admin-section">
                <h2>GitHub Gist Configuration</h2>
                <p style="margin-bottom: 20px; color: #666666;">
                    Configure GitHub Gist to share data across all team members. 
                    <a href="https://github.com/settings/tokens" target="_blank">Create a Personal Access Token</a> with <code>gist</code> scope.
                </p>
                
                <div id="gist-status" style="margin-bottom: 20px; padding: 10px; background: #fafafa; border: 2px solid #e0e0e0; border-radius: 8px;">
                    ${isConfigured ? 
                        '<span style="color: #00d4aa;">✓ Gist Connected</span>' : 
                        '<span style="color: #dc3545;">⚠ Using Local Storage Only</span>'
                    }
                </div>

                <form id="gist-config-form">
                    <div class="form-group">
                        <label for="github-token">GitHub Personal Access Token:</label>
                        <input type="password" id="github-token" 
                               placeholder="${hasToken ? 'Token is set (enter new to change)' : 'Enter your GitHub token'}" 
                               ${hasToken ? '' : 'required'}>
                        <small style="color: #666666; display: block; margin-top: 5px;">
                            Token needs <code>gist</code> scope. Keep this secret!
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label for="gist-id">Gist ID (optional - leave empty to create new):</label>
                        <input type="text" id="gist-id" 
                               placeholder="${gistId || 'Leave empty to create a new Gist'}" 
                               value="${gistId || ''}">
                        <small style="color: #666666; display: block; margin-top: 5px;">
                            If you have an existing Gist ID, enter it here. Otherwise, a new Gist will be created.
                        </small>
                    </div>
                    
                    <button type="submit" class="btn">${isConfigured ? 'Update Configuration' : 'Connect Gist'}</button>
                </form>
                <div id="gist-config-message"></div>
            </div>

            ${isConfigured ? `
                <div class="admin-section">
                    <h2>Gist Information</h2>
                    <p><strong>Gist ID:</strong> <code>${gistId}</code></p>
                    <button class="btn btn-secondary" id="disconnect-gist-btn" style="margin-top: 10px;">Disconnect Gist</button>
                </div>
            ` : ''}
        </div>
    `;
}

function setupSettingsPage() {
    // Copy URL button
    const copyUrlBtn = document.getElementById('copy-url-btn');
    if (copyUrlBtn) {
        copyUrlBtn.addEventListener('click', () => {
            const shareUrlInput = document.getElementById('share-url');
            if (shareUrlInput) {
                shareUrlInput.select();
                shareUrlInput.setSelectionRange(0, 99999); // For mobile devices
                try {
                    document.execCommand('copy');
                    copyUrlBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        copyUrlBtn.textContent = 'Copy URL';
                    }, 2000);
                } catch (err) {
                    // Fallback for browsers that don't support execCommand
                    navigator.clipboard.writeText(shareUrlInput.value).then(() => {
                        copyUrlBtn.textContent = 'Copied!';
                        setTimeout(() => {
                            copyUrlBtn.textContent = 'Copy URL';
                        }, 2000);
                    }).catch(() => {
                        alert('Failed to copy. Please copy manually.');
                    });
                }
            }
        });
    }

    const form = document.getElementById('gist-config-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const token = document.getElementById('github-token').value.trim();
            const gistId = document.getElementById('gist-id').value.trim();
            
            if (!token && !Storage.getGitHubToken()) {
                showMessage('gist-config-message', 'Please enter a GitHub token.', 'error');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Connecting...';

            try {
                if (token) {
                    Storage.setGitHubToken(token);
                }

                if (gistId) {
                    Storage.setGistId(gistId);
                    // Test connection
                    await Storage.fetchGist();
                    dismissGistErrorBanner();
                    showMessage('gist-config-message', 'Gist connected successfully!', 'success');
                } else {
                    // Create new Gist
                    const data = await Storage.getData();
                    const gist = await Storage.createGist(data);
                    showMessage('gist-config-message', `New Gist created! ID: ${gist.id}`, 'success');
                }

                // Refresh page to show share URL
                setTimeout(() => {
                    renderPage('settings');
                }, 1500);
            } catch (error) {
                showMessage('gist-config-message', 'Error: ' + error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = Storage.isGistConfigured() ? 'Update Configuration' : 'Connect Gist';
            }
        });
    }

    const disconnectBtn = document.getElementById('disconnect-gist-btn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to disconnect from Gist? You will switch to local storage only.')) {
                localStorage.removeItem('gistId');
                localStorage.removeItem('githubToken');
                await renderPage('settings');
            }
        });
    }
}

// Utility: add ranks with ties; first place always gets gold; display #1, #2, =1, =2, ...
function addLeaderboardRanks(sortedLeaderboard, getScoreKey) {
    const result = [];
    let currentRank = 1;
    for (let i = 0; i < sortedLeaderboard.length; i++) {
        const entry = sortedLeaderboard[i];
        const prev = i > 0 ? sortedLeaderboard[i - 1] : null;
        const tiedWithPrev = prev && getScoreKey(entry) === getScoreKey(prev);
        if (!tiedWithPrev) currentRank = i + 1;
        result.push({ ...entry, rank: currentRank });
    }
    const rankCounts = {};
    result.forEach(r => { rankCounts[r.rank] = (rankCounts[r.rank] || 0) + 1; });
    return result.map(r => {
        const tied = rankCounts[r.rank] > 1;
        return {
            ...r,
            displayRank: tied ? `=${r.rank}` : `#${r.rank}`,
            rankClass: r.rank === 1 ? 'rank-1' : (r.rank <= 3 && rankCounts[r.rank] === 1) ? `rank-${r.rank}` : ''
        };
    });
}

// Utility function
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
        setTimeout(() => {
            element.innerHTML = '';
        }, 5000);
    }
}
