// Main application logic and routing

let currentPage = 'submit';
let currentGuesser = '';
let selectedWeek = Storage.getCurrentWeek();
let isLoading = false;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupNavigation();
    await renderPage(currentPage);
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

function isBeforeMidday() {
    const now = new Date();
    return now.getHours() < 12;
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
        if (isBeforeMidday()) {
            guessBtn.disabled = true;
            guessBtn.title = 'Available from midday';
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

    const playlistBtn = document.querySelector('.nav-btn[data-page="playlist"]');
    if (playlistBtn) {
        const week = Storage.getCurrentWeek();
        const submissions = await Storage.getSubmissions(week);
        if (submissions.length < 6) {
            playlistBtn.disabled = true;
            playlistBtn.title = `Available once 6 albums are submitted (${submissions.length}/6)`;
        } else {
            playlistBtn.disabled = false;
            playlistBtn.removeAttribute('title');
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

    if (page === 'guess' && isBeforeMidday()) {
        return; // Guess button is disabled, but guard in case of hash/navigation
    }
    if (page === 'results' && isBeforeMidday()) {
        return; // Results button is disabled, but guard in case of hash/navigation
    }
    if (page === 'playlist') {
        const week = Storage.getCurrentWeek();
        const submissions = await Storage.getSubmissions(week);
        if (submissions.length < 6) {
            return; // Playlist requires at least 6 submissions
        }
    }

    currentPage = page;

    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-page') === page);
    });

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
                break;
            case 'guess':
                if (isBeforeMidday()) {
                    mainContent.innerHTML = `
                        <div class="page active">
                            <h2 class="page-title">Guess</h2>
                            <div class="empty-state">
                                <p>Guessing opens at midday. Check back later!</p>
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
                mainContent.innerHTML = await renderStatsPage();
                break;
            case 'playlist':
                {
                    const week = Storage.getCurrentWeek();
                    const submissions = await Storage.getSubmissions(week);
                    if (submissions.length < 6) {
                        mainContent.innerHTML = `
                            <div class="page active">
                                <h2 class="page-title">Spotify Playlist</h2>
                                <div class="empty-state">
                                    <p>The playlist is available once at least 6 albums have been submitted this week (${submissions.length}/6).</p>
                                </div>
                            </div>
                        `;
                    } else {
                        mainContent.innerHTML = await renderPlaylistPage();
                        setupPlaylistPage();
                    }
                }
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
    const submissions = await Storage.getSubmissions(week);
    const members = await Storage.getTeamMembers();
    const userSubmissions = submissions.filter(s => s.submitter === currentGuesser);
    const remaining = 2 - userSubmissions.length;

    return `
        <div class="page active">
            <h2 class="page-title">Submit Albums</h2>
            ${members.length === 0 ? `
                <div class="alert alert-info">
                    <p>No team members have been added yet. Please ask an admin to add team members first.</p>
                </div>
            ` : ''}
            ${!currentGuesser ? `
                <div class="form-group">
                    <label for="guesser-name">Your Name:</label>
                    <select id="guesser-name" required>
                        <option value="">Select your name...</option>
                        ${members.map(m => `
                            <option value="${m}" ${m === currentGuesser ? 'selected' : ''}>${m}</option>
                        `).join('')}
                    </select>
                </div>
            ` : `
                <div class="submission-count">Submissions this week: ${userSubmissions.length}/2</div>
            `}
            ${remaining > 0 && members.length > 0 ? `
                <form id="submit-form">
                    <div class="form-group">
                        <label for="submitter-name">Your Name:</label>
                        <select id="submitter-name" required>
                            <option value="">Select your name...</option>
                            ${members.map(m => `
                                <option value="${m}" ${m === currentGuesser ? 'selected' : ''}>${m}</option>
                            `).join('')}
                        </select>
                    </div>
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
                    You have submitted 2 albums this week. Check back next week!
                </div>
            `}
            ${userSubmissions.length > 0 ? `
                <h3 style="margin-top: 30px;">Your Submissions This Week:</h3>
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
    // Handle name selection dropdown (outside form)
    const guesserNameSelect = document.getElementById('guesser-name');
    if (guesserNameSelect) {
        guesserNameSelect.addEventListener('change', async (e) => {
            const name = e.target.value.trim();
            if (name) {
                currentGuesser = name;
                localStorage.setItem('currentGuesser', name);
                await renderPage('submit');
            }
        });
    }

    // Handle name selection dropdown (inside form)
    const submitterNameSelect = document.getElementById('submitter-name');
    if (submitterNameSelect) {
        submitterNameSelect.addEventListener('change', async (e) => {
            const name = e.target.value.trim();
            if (name && name !== currentGuesser) {
                currentGuesser = name;
                localStorage.setItem('currentGuesser', name);
                await renderPage('submit');
            }
        });
    }

    const form = document.getElementById('submit-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get name from either the top dropdown or the form dropdown
            let submitterName = '';
            const guesserNameSelect = document.getElementById('guesser-name');
            const submitterNameSelect = document.getElementById('submitter-name');
            
            if (guesserNameSelect) {
                submitterName = guesserNameSelect.value.trim();
            } else if (submitterNameSelect) {
                submitterName = submitterNameSelect.value.trim();
            }
            
            if (!submitterName) {
                showMessage('submit-message', 'Please select your name.', 'error');
                return;
            }
            
            // Update currentGuesser if it changed
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

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                const result = await Storage.addSubmission(artist, album, url, submitterName);
                
                if (result.success) {
                    showMessage('submit-message', result.message, 'success');
                    form.reset();
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

    return `
        <div class="page active" data-guesses-finalized="${guessesFinalized}">
            <h2 class="page-title">Guess Who Submitted What</h2>
            ${guessesFinalized ? `
                <div class="alert alert-info" style="margin-bottom: 30px;">
                    <p style="margin-bottom: 0;"><strong>Your guesses for this week have been finalized.</strong> You cannot make any changes.</p>
                </div>
            ` : ''}
            ${hasDuplicates ? `
                <div class="alert alert-info" style="margin-bottom: 30px;">
                    <p style="margin-bottom: 0;"><strong>Note:</strong> One album in this week was submitted by ${maxDuplicateCount} team member(s). 
                    You can select up to ${maxDuplicateCount} people on ONE album if you think it's the duplicate. All other albums should have only one selection. You can select each person at most twice in total.</p>
                </div>
            ` : `
                <div class="alert alert-info" style="margin-bottom: 30px;">
                    <p style="margin-bottom: 0;">You can select each person at most twice in total across all albums.</p>
                </div>
            `}
            ${uniqueAlbums.map(albumGroup => {
                const existingGuesses = existingGuessesByAlbum[albumGroup.key] || [];
                const useRadioButtons = !hasDuplicates;
                return `
                    <div class="album-card">
                        <h3>${albumGroup.album}</h3>
                        <p><strong>Artist:</strong> ${albumGroup.artist}</p>
                        <div class="guess-form">
                            <label>Who submitted this? ${useRadioButtons ? '(Select one)' : `(Select up to ${maxDuplicateCount}, only one album can have multiple)`}</label>
                            <div class="guess-options" 
                                 data-album-key="${albumGroup.key}" 
                                 data-use-radio="${useRadioButtons}" 
                                 data-max-selections="${maxDuplicateCount}"
                                 style="margin-top: 10px;">
                                ${submittersThisWeek.map(m => {
                                    const isSelected = existingGuesses.includes(m);
                                    const inputType = useRadioButtons ? 'radio' : 'checkbox';
                                    const inputName = useRadioButtons ? `guess-${albumGroup.key}` : '';
                                    return `
                                        <label style="display: flex; align-items: center; margin-bottom: 10px; ${guessesFinalized ? 'opacity: 0.6;' : 'cursor: pointer;'}">
                                            <input type="${inputType}" 
                                                   name="${inputName}"
                                                   value="${m}" 
                                                   ${isSelected ? 'checked' : ''}
                                                   ${guessesFinalized ? 'disabled' : ''}
                                                   class="guess-input"
                                                   style="margin-right: 8px; width: 18px; height: 18px; ${guessesFinalized ? '' : 'cursor: pointer;'}">
                                            <span>${m}</span>
                                        </label>
                                    `;
                                }).join('')}
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

    const guesserNameInput = document.getElementById('guesser-name-guess');
    if (guesserNameInput) {
        guesserNameInput.addEventListener('change', async (e) => {
            currentGuesser = e.target.value.trim();
            localStorage.setItem('currentGuesser', currentGuesser);
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

            // Validate: no person selected more than twice across all albums
            const countByPerson = {};
            for (const g of guessesToSave) {
                countByPerson[g.guessedSubmitter] = (countByPerson[g.guessedSubmitter] || 0) + 1;
            }
            const overSelected = Object.entries(countByPerson).find(([, count]) => count > 2);
            if (overSelected) {
                showMessage('guess-message', `You can select each person at most twice. "${overSelected[0]}" is selected ${overSelected[1]} times.`, 'error');
                return;
            }

            if (confirm('Are you sure you want to save and finalize your guesses? You will not be able to change them after this.')) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';

                try {
                    const week = Storage.getCurrentWeek();
                    // Fetch latest data right before modifying to avoid overwriting another user's guesses
                    const data = await Storage.getData();
                    if (!data.guesses) data.guesses = {};
                    if (!data.guesses[week]) data.guesses[week] = [];
                    // Remove only this guesser's guesses for this week (keep everyone else's)
                    data.guesses[week] = data.guesses[week].filter(g => g.guesser !== currentGuesser || !g.albumKey);
                    // Add this user's new guesses
                    for (const g of guessesToSave) {
                        data.guesses[week].push({
                            albumKey: g.albumKey,
                            guesser: currentGuesser,
                            guessedSubmitter: g.guessedSubmitter,
                            week
                        });
                    }
                    const saveResult = await Storage.saveData(data);
                    if (!saveResult || !saveResult.success) {
                        throw new Error('Failed to save guesses');
                    }

                    await Storage.finalizeGuesses(currentGuesser);
                    
                    showMessage('guess-message', `Saved and finalized ${totalGuesses} guess(es)!`, 'success');
                    setTimeout(async () => {
                        await renderPage('guess');
                    }, 1000);
                } catch (error) {
                    console.error('Error saving guesses:', error);
                    showMessage('guess-message', 'Error saving guesses: ' + error.message, 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save & Finalize Guesses';
                }
            }
        });
    }

    // Count how many times each person is selected across all albums; enforce max 2 per person
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

    function updateMaxTwoPerPersonState() {
        const countByPerson = getSelectionCountByPerson();
        guessGroups.forEach(group => {
            const useRadio = group.getAttribute('data-use-radio') === 'true';
            const inputs = group.querySelectorAll(useRadio ? 'input[type="radio"]' : 'input[type="checkbox"]');
            inputs.forEach(input => {
                const name = input.value;
                const total = countByPerson[name] || 0;
                const alreadySelectedHere = input.checked;
                input.disabled = guessesFinalized;
                if (!guessesFinalized && !alreadySelectedHere && total >= 2) {
                    input.disabled = true;
                }
            });
        });
    }

    const guessesFinalized = document.querySelector('.page.active')?.getAttribute('data-guesses-finalized') === 'true';
    updateMaxTwoPerPersonState();

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
                            // Check max 2 per person across all albums
                            const countByPerson = getSelectionCountByPerson();
                            if (countByPerson[checkbox.value] > 2) {
                                checkbox.checked = false;
                                showMessage('guess-message', 'You can select each person at most twice across all albums.', 'error');
                                return;
                            }
                            // If this album now has multiple selections, ensure no other album has multiple
                            if (checkedInThisAlbum > 1 && albumsWithMultiple > 0) {
                                checkbox.checked = false;
                                showMessage('guess-message', 'Only one album can have multiple selections. Uncheck selections on other albums first.', 'error');
                                return;
                            }
                        }
                        updateMaxTwoPerPersonState();
                        
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
                            updateMaxTwoPerPersonState();
                        }
                    }
                });
            });
        } else if (!useRadio) {
            // Regular checkboxes - still enforce max 2 per person
            const checkboxes = group.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', async () => {
                    if (currentGuesser && !checkbox.disabled) {
                        if (checkbox.checked) {
                            const countByPerson = getSelectionCountByPerson();
                            if (countByPerson[checkbox.value] > 2) {
                                checkbox.checked = false;
                                showMessage('guess-message', 'You can select each person at most twice across all albums.', 'error');
                                return;
                            }
                        }
                        updateMaxTwoPerPersonState();
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
                            updateMaxTwoPerPersonState();
                        }
                    }
                });
            });
        } else {
            // Radio buttons - enforce max 2 per person on change
            const radios = group.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => {
                radio.addEventListener('change', () => {
                    updateMaxTwoPerPersonState();
                });
            });
        }
    });
}

// Results Page
async function renderResultsPage() {
    const weeks = await Storage.getAllWeeks();
    const currentWeek = Storage.getCurrentWeek();
    
    return `
        <div class="page active">
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
    const weekSelector = document.getElementById('week-selector');
    if (weekSelector) {
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
                url: sub.url,
                actualSubmitters: []
            };
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
    const submissionsHtml = Object.values(albumGroups).map(albumGroup => {
        const actualSubmitters = [...new Set(albumGroup.actualSubmitters)]; // Remove duplicates
        const guessedSubmitters = guessesByAlbum[albumGroup.key] || [];
        const isDuplicate = actualSubmitters.length > 1;
        
        // Calculate correct/incorrect guesses
        const correctGuesses = guessedSubmitters.filter(g => actualSubmitters.includes(g));
        const incorrectGuesses = guessedSubmitters.filter(g => !actualSubmitters.includes(g));
        const missedSubmitters = actualSubmitters.filter(a => !guessedSubmitters.includes(a));
        
        const hasGuesses = guessedSubmitters.length > 0;
        // All correct if you got all actual submitters (even if you guessed extra people)
        const allCorrect = missedSubmitters.length === 0 && correctGuesses.length === actualSubmitters.length;
        
        // Determine result message
        let resultMessage = '';
        if (allCorrect) {
            resultMessage = '✓ All Correct!';
        } else if (correctGuesses.length === 0) {
            // No correct guesses at all
            resultMessage = '✗ Incorrect';
        } else if (missedSubmitters.length > 0) {
            // Some correct but missed some - partial
            resultMessage = `Partial: ${correctGuesses.length}/${actualSubmitters.length} correct`;
        } else {
            // Got all submitters but also guessed extra people - still correct!
            resultMessage = '✓ All Correct!';
        }
        
        return `
            <div class="result-item ${hasGuesses ? (allCorrect ? 'correct' : 'incorrect') : ''}">
                <h4>${albumGroup.album} - ${albumGroup.artist}</h4>
                ${hasGuesses ? `
                    <p><strong>Submitted by:</strong> ${actualSubmitters.join(', ')}</p>
                    ${isDuplicate ? `<p style="color: #00a8cc; font-weight: 600; margin-top: 5px;">✓ This was the duplicate album (submitted by ${actualSubmitters.length} person(s))</p>` : ''}
                    <p><strong>Your guesses:</strong> ${guessedSubmitters.length > 0 ? guessedSubmitters.join(', ') : 'None'}</p>
                    <p><strong>Correct:</strong> ${correctGuesses.length > 0 ? '✓ ' + correctGuesses.join(', ') : 'None'}</p>
                    ${incorrectGuesses.length > 0 ? `<p><strong>Incorrect guesses:</strong> ✗ ${incorrectGuesses.join(', ')}</p>` : ''}
                    ${missedSubmitters.length > 0 ? `<p><strong>Missed:</strong> ${missedSubmitters.join(', ')}</p>` : ''}
                    <p><strong>Result:</strong> ${resultMessage}</p>
                ` : '<p>You have not guessed this album yet. Make your guesses on the Guess page to see results.</p>'}
                ${albumGroup.url ? `<p><a href="${albumGroup.url}" target="_blank">${albumGroup.url}</a></p>` : ''}
            </div>
        `;
    }).join('');

    // Calculate leaderboard (with ties: same score = same rank, no highlight when tied)
    const leaderboardSorted = Object.entries(results.scores)
        .filter(([member, score]) => score.total > 0)
        .map(([member, score]) => ({
            member,
            correct: score.correct,
            total: score.total,
            percentage: score.total > 0 ? ((score.correct / score.total) * 100).toFixed(1) : 0
        }))
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
                    ${firstPlace.map((entry) => `
                        <div class="leaderboard-item ${entry.rankClass}">
                            <span><strong>${entry.displayRank}</strong> ${entry.member}</span>
                            <span>${entry.correct}/${entry.total} (${entry.percentage}%)</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            ${restPlace.length > 0 ? `
                <div class="leaderboard-rest-grid ${restPlace.length === 2 ? 'rest-count-2' : ''}">
                    ${restPlace.map((entry) => `
                        <div class="leaderboard-item ${entry.rankClass}">
                            <span><strong>${entry.displayRank}</strong> ${entry.member}</span>
                            <span>${entry.correct}/${entry.total} (${entry.percentage}%)</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    ` : '';

    content.innerHTML = `
        <h3>Submissions & Results</h3>
        <div class="results-grid">
            ${submissionsHtml}
        </div>
        ${leaderboardHtml}
    `;
}

// Stats Page
async function renderStatsPage() {
    const stats = await Storage.getOverallStats();
    const weeks = await Storage.getAllWeeks();
    const members = Object.keys(stats).filter(m => stats[m].totalGuesses > 0 || stats[m].totalSubmissions > 0);

    if (members.length === 0) {
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
    const overallSorted = members
        .map(member => ({
            member,
            ...stats[member],
            accuracy: stats[member].totalGuesses > 0 
                ? ((stats[member].totalCorrect / stats[member].totalGuesses) * 100).toFixed(1) 
                : 0
        }))
        .sort((a, b) => {
            const accA = parseFloat(a.accuracy);
            const accB = parseFloat(b.accuracy);
            if (accB !== accA) return accB - accA;
            return b.totalCorrect - a.totalCorrect;
        });
    const overallLeaderboard = addLeaderboardRanks(overallSorted, e => `${e.totalCorrect}-${e.totalGuesses}-${e.accuracy}`);

    // Week-by-week stats
    const weekStats = [];
    for (const week of weeks) {
        const weekResults = await Storage.getWeekResults(week);
        weekStats.push({
            week,
            results: weekResults.scores
        });
    }

    return `
        <div class="page active">
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
                                            <span>${entry.totalCorrect}/${entry.totalGuesses} (${entry.accuracy}%)</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            ${restPlace.length > 0 ? `
                                <div class="leaderboard-rest-grid ${restPlace.length === 2 ? 'rest-count-2' : ''}">
                                    ${restPlace.map((entry) => `
                                        <div class="leaderboard-item ${entry.rankClass}">
                                            <span><strong>${entry.displayRank}</strong> ${entry.member}<small class="leaderboard-weeks-played"> ${entry.weeksPlayed || 0} weeks played</small></span>
                                            <span>${entry.totalCorrect}/${entry.totalGuesses} (${entry.accuracy}%)</span>
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
                    .map(([member, score]) => ({
                        member,
                        correct: score.correct,
                        total: score.total,
                        percentage: score.total > 0 ? ((score.correct / score.total) * 100).toFixed(1) : 0
                    }))
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
                        ${weekLeaderboard.length > 0 ? `
                            ${firstPlace.length > 0 ? `
                                <div class="leaderboard-first-row ${firstPlace.length > 1 ? 'first-row-multi' : ''}">
                                    ${firstPlace.map((entry) => `
                                        <div class="leaderboard-item ${entry.rankClass}">
                                            <span><strong>${entry.displayRank}</strong> ${entry.member}</span>
                                            ${firstPlace.length > 1 ? `<span class="leaderboard-score-under">${entry.correct}/${entry.total} (${entry.percentage}%)</span>` : `<span>${entry.correct}/${entry.total} (${entry.percentage}%)</span>`}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            ${restPlace.length > 0 ? `
                                <div class="leaderboard-rest-grid ${restPlace.length === 2 ? 'rest-count-2' : ''} ${restPlace.length > 3 ? 'rest-stack' : ''}">
                                    ${restPlace.map((entry) => `
                                        <div class="leaderboard-item ${entry.rankClass}">
                                            <span><strong>${entry.displayRank}</strong> ${entry.member}</span>
                                            <span>${entry.correct}/${entry.total} (${entry.percentage}%)</span>
                                        </div>
                                    `).join('')}
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
                <h2 class="page-title">Spotify Playlist</h2>
                <div class="empty-state">
                    <p>No albums submitted yet this week.</p>
                </div>
            </div>
        `;
    }

    // Group by artist for better organization
    const albumsWithUrls = submissions.filter(sub => sub.url && sub.url.includes('spotify.com'));
    const albumsWithoutUrls = submissions.filter(sub => !sub.url || !sub.url.includes('spotify.com'));

    // Extract Spotify album IDs from URLs
    const getSpotifyId = (url) => {
        const match = url.match(/album\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    };

    const spotifyIds = albumsWithUrls
        .map(sub => getSpotifyId(sub.url))
        .filter(id => id !== null);

    // Create Spotify playlist URL
    const playlistUrl = spotifyIds.length > 0 
        ? `https://open.spotify.com/playlist/create?uri=${spotifyIds.map(id => `spotify:album:${id}`).join(',')}`
        : null;

    return `
        <div class="page active">
            <h2 class="page-title">Spotify Playlist</h2>
            <p style="margin-bottom: 20px; color: #666666;">
                Week: <strong>${week}</strong> | Total Albums: ${submissions.length} | With Spotify URLs: ${albumsWithUrls.length}
            </p>

            ${spotifyIds.length > 0 ? `
                <div class="alert alert-info" style="margin-bottom: 30px;">
                    <h3 style="margin-bottom: 10px;">Create Playlist</h3>
                    <p style="margin-bottom: 15px;">
                        Use the "Open in Spotify" buttons below each album to add them to a playlist. Spotify doesn't support bulk playlist creation via URL, so you'll need to add albums one by one.
                    </p>
                    <p style="margin-top: 10px; font-size: 0.9rem; color: #666666;">
                        <strong>Quick method:</strong> Click each "Open in Spotify" button, then use the "..." menu on each album page to add it to your playlist.
                    </p>
                </div>
            ` : ''}

            <h3 style="margin-top: 30px;">Albums with Spotify URLs</h3>
            ${albumsWithUrls.length > 0 ? `
                <div style="display: grid; gap: 15px; margin-bottom: 30px;">
                    ${albumsWithUrls.map((sub, index) => {
                        const spotifyId = getSpotifyId(sub.url);
                        const spotifyAlbumUrl = spotifyId ? `https://open.spotify.com/album/${spotifyId}` : sub.url;
                        return `
                            <div class="album-card" style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <h3 style="margin-bottom: 5px;">${sub.album}</h3>
                                    <p style="margin-bottom: 5px;"><strong>Artist:</strong> ${sub.artist}</p>
                                    <a href="${spotifyAlbumUrl}" target="_blank" style="color: #00a8cc; text-decoration: none;">
                                        ${spotifyAlbumUrl}
                                    </a>
                                </div>
                                <a href="${spotifyAlbumUrl}" target="_blank" class="btn" style="margin-left: 15px; text-decoration: none; color: white !important;">
                                    Open in Spotify
                                </a>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : '<p style="color: #666666;">No albums with Spotify URLs yet.</p>'}

            ${albumsWithoutUrls.length > 0 ? `
                <h3 style="margin-top: 30px;">Albums without Spotify URLs</h3>
                <div style="display: grid; gap: 15px;">
                    ${albumsWithoutUrls.map(sub => `
                        <div class="album-card">
                            <h3>${sub.album}</h3>
                            <p><strong>Artist:</strong> ${sub.artist}</p>
                            <p style="color: #999999; font-size: 0.9rem;">No Spotify URL provided</p>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div style="margin-top: 30px; padding: 20px; background: #fafafa; border: 2px solid #e0e0e0; border-radius: 8px;">
                <h3 style="margin-bottom: 10px; color: #333333;">Manual Playlist Creation</h3>
                <p style="color: #666666; margin-bottom: 15px;">
                    If the automatic playlist creation doesn't work, you can manually create a playlist in Spotify and add these albums:
                </p>
                <ol style="color: #666666; padding-left: 20px;">
                    <li>Open Spotify and create a new playlist</li>
                    <li>Click on each album link above to open it in Spotify</li>
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
    const submissions = await Storage.getSubmissions(currentWeek);
    const guesses = await Storage.getGuesses(currentWeek);

    return `
        <div class="page active">
            <h2 class="page-title">Admin Panel</h2>
            <button class="btn btn-secondary" id="logout-btn" style="margin-bottom: 20px;">Logout</button>
            
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
            await updateNavigationVisibility();
            // If on settings page, redirect to admin
            if (currentPage === 'settings') {
                await navigateToPage('admin');
            } else {
                await renderPage('admin');
            }
        });
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
