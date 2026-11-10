// Data storage and management using GitHub Gists API
// Falls back to localStorage if Gist is not configured

const Storage = {
    PREVIEW_MODE_KEY: 'adminPreviewMode',
    PREVIEW_OVERLAY_KEY: 'adminPreviewDataOverlay',

    isPreviewMode() {
        return localStorage.getItem(this.PREVIEW_MODE_KEY) === 'true' &&
            sessionStorage.getItem('adminLoggedIn') === 'true';
    },

    setPreviewMode(enabled) {
        if (enabled) {
            localStorage.setItem(this.PREVIEW_MODE_KEY, 'true');
        } else {
            localStorage.removeItem(this.PREVIEW_MODE_KEY);
            localStorage.removeItem(this.PREVIEW_OVERLAY_KEY);
        }
    },

    getPreviewOverlay() {
        const raw = localStorage.getItem(this.PREVIEW_OVERLAY_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            localStorage.removeItem(this.PREVIEW_OVERLAY_KEY);
            return null;
        }
    },

    setPreviewOverlay(overlay) {
        if (!overlay) {
            localStorage.removeItem(this.PREVIEW_OVERLAY_KEY);
            return;
        }
        localStorage.setItem(this.PREVIEW_OVERLAY_KEY, JSON.stringify(overlay));
    },

    /** Merge preview overlay (current week only) into a full data object */
    mergePreviewOverlay(base) {
        if (!this.isPreviewMode()) return base;
        const po = this.getPreviewOverlay();
        if (!po || !po.week) return base;
        const out = JSON.parse(JSON.stringify(base));
        const w = po.week;
        if (po.submissions !== undefined) out.submissions = { ...out.submissions, [w]: po.submissions };
        if (po.guesses !== undefined) out.guesses = { ...out.guesses, [w]: po.guesses };
        if (po.finalizedGuesses !== undefined) out.finalizedGuesses = { ...out.finalizedGuesses, [w]: po.finalizedGuesses };
        if (po.lifelines !== undefined) {
            if (!out.lifelines) out.lifelines = {};
            out.lifelines[w] = po.lifelines;
        }
        if (po.deals !== undefined) {
            if (!out.deals) out.deals = {};
            out.deals[w] = po.deals;
        }
        return out;
    },

    /**
     * Persist preview changes: only the current week's slice + sync gist cache for local reads.
     */
    savePreviewOverlayFromMergedData(data) {
        const week = this.getCurrentWeek();
        const overlay = {
            week,
            submissions: data.submissions?.[week],
            guesses: data.guesses?.[week],
            finalizedGuesses: data.finalizedGuesses?.[week],
            lifelines: data.lifelines?.[week],
            deals: data.deals?.[week]
        };
        this.setPreviewOverlay(overlay);
        const cached = this.parseCachedGistData();
        if (cached) {
            const merged = this.mergePreviewOverlay(cached);
            localStorage.setItem('gistDataCache', JSON.stringify(merged));
            localStorage.setItem('gistDataCacheTime', Date.now().toString());
        }
        return { success: true };
    },

    async seedPreviewWeekMockSubmissions() {
        const week = this.getCurrentWeek();
        const members = (await this.getTeamMembers()).filter(Boolean);
        if (members.length < 2) {
            return { success: false, message: 'Add at least two team members before seeding preview data.' };
        }
        const albums = [
            {
                artist: 'Pink Floyd',
                album: 'The Dark Side of the Moon',
                url: 'https://open.spotify.com/album/4LH4d3eTuMXviHvrmDufwL'
            },
            {
                artist: 'Fleetwood Mac',
                album: 'Rumours',
                url: 'https://open.spotify.com/album/1WNf769gz8AOST3siLj0AC'
            },
            {
                artist: 'Radiohead',
                album: 'OK Computer',
                url: 'https://open.spotify.com/album/382ObEPsp2rxGrns7N7fVj'
            },
            {
                artist: 'The Beatles',
                album: 'Abbey Road',
                url: 'https://open.spotify.com/album/0ETFjACtuP2ADd6ieM9l16'
            }
        ];
        const submissions = [];
        let t = Date.now();
        members.forEach((submitter, i) => {
            const a = albums[i % albums.length];
            submissions.push({
                id: t++,
                artist: a.artist,
                album: a.album,
                url: a.url,
                submitter,
                week
            });
        });
        this.setPreviewOverlay({
            week,
            submissions,
            guesses: [],
            finalizedGuesses: [],
            lifelines: {},
            deals: {}
        });
        const cached = this.parseCachedGistData();
        if (cached) {
            const merged = this.mergePreviewOverlay(cached);
            localStorage.setItem('gistDataCache', JSON.stringify(merged));
            localStorage.setItem('gistDataCacheTime', Date.now().toString());
        }
        return { success: true, message: `Seeded ${submissions.length} mock submission(s) for ${week}.` };
    },

    /** Clear lifeline usage for the current week in preview overlay only (gist unchanged for that slice). */
    resetPreviewLifelines() {
        if (!this.isPreviewMode()) {
            return { success: false, message: 'Turn on preview mode first.' };
        }
        const week = this.getCurrentWeek();
        const existing = this.getPreviewOverlay() || {};
        const overlay = {
            ...existing,
            week,
            lifelines: {}
        };
        this.setPreviewOverlay(overlay);
        const cached = this.parseCachedGistData();
        if (cached) {
            const merged = this.mergePreviewOverlay(cached);
            localStorage.setItem('gistDataCache', JSON.stringify(merged));
            localStorage.setItem('gistDataCacheTime', Date.now().toString());
        }
        return { success: true, message: 'Preview lifeline usage reset for this week.' };
    },

    // Gist configuration
    // Checks shared config first, then falls back to localStorage
    getGistId() {
        // Check shared config first
        if (typeof SharedGistConfig !== 'undefined' && SharedGistConfig.gistId) {
            return SharedGistConfig.gistId;
        }
        // Fall back to localStorage
        return localStorage.getItem('gistId') || '';
    },

    setGistId(id) {
        // Only save to localStorage if not using shared config
        if (typeof SharedGistConfig === 'undefined' || !SharedGistConfig.gistId) {
            localStorage.setItem('gistId', id);
        }
    },

    getGitHubToken() {
        // Check shared config first
        if (typeof SharedGistConfig !== 'undefined' && SharedGistConfig.token) {
            return SharedGistConfig.token;
        }
        // Fall back to localStorage
        return localStorage.getItem('githubToken') || '';
    },

    setGitHubToken(token) {
        // Only save to localStorage if not using shared config
        if (typeof SharedGistConfig === 'undefined' || !SharedGistConfig.token) {
            localStorage.setItem('githubToken', token);
        }
    },

    isGistConfigured() {
        return !!(this.getGistId() && this.getGitHubToken());
    },

    // Check if using shared config
    isUsingSharedConfig() {
        return typeof SharedGistConfig !== 'undefined' && 
               !!(SharedGistConfig.gistId && SharedGistConfig.token);
    },

    // Get current week identifier (Friday date in DD/MM/YYYY format)
    // Shows this week's Friday if Mon-Fri, next Friday if Sat-Sun
    getCurrentWeek() {
        const now = new Date();
        const day = now.getDay(); // 0 = Sunday, 5 = Friday
        let daysUntilFriday;
        
        if (day <= 5) {
            // Monday (1) to Friday (5): show this week's Friday
            daysUntilFriday = 5 - day;
        } else {
            // Saturday (6) to Sunday (0): show next Friday
            daysUntilFriday = 5 - day + 7;
        }
        
        const friday = new Date(now);
        friday.setDate(now.getDate() + daysUntilFriday);
        
        const dayStr = String(friday.getDate()).padStart(2, '0');
        const monthStr = String(friday.getMonth() + 1).padStart(2, '0');
        const yearStr = friday.getFullYear();
        
        return `${dayStr}/${monthStr}/${yearStr}`;
    },

    // Local calendar day as DD/MM/YYYY (for game-day overrides)
    getTodayKey() {
        const now = new Date();
        const dayStr = String(now.getDate()).padStart(2, '0');
        const monthStr = String(now.getMonth() + 1).padStart(2, '0');
        const yearStr = now.getFullYear();
        return `${dayStr}/${monthStr}/${yearStr}`;
    },

    isFriday() {
        return new Date().getDay() === 5;
    },

    // Friday always counts; otherwise only the admin-enabled calendar day for this week
    async isGameDay(week = null) {
        if (this.isFriday()) return true;
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getData();
        return data.gameDayOverrides?.[weekKey] === this.getTodayKey();
    },

    async getGameDayOverride(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getData();
        return data.gameDayOverrides?.[weekKey] || null;
    },

    async enableGameDayToday(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const today = this.getTodayKey();
        const data = await this.getFreshData();
        if (!data.gameDayOverrides) {
            data.gameDayOverrides = {};
        }
        data.gameDayOverrides[weekKey] = today;
        const result = await this.saveData(data);
        if (result.success) {
            return { success: true, day: today, week: weekKey };
        }
        return { success: false, error: result.error || 'Failed to save game day override.' };
    },

    async clearGameDayOverride(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getFreshData();
        if (!data.gameDayOverrides) {
            data.gameDayOverrides = {};
        }
        delete data.gameDayOverrides[weekKey];
        await this.saveData(data);
        return { success: true };
    },

    // Get formatted date string for display
    getFormattedDate() {
        return this.getCurrentWeek();
    },

    /** 4pm on the Friday identified by weekStr (DD/MM/YYYY). */
    getWeekFriday4pm(weekStr) {
        const [d, m, y] = weekStr.split('/').map(Number);
        return new Date(y, m - 1, d, 16, 0, 0, 0);
    },

    // Initialize data structure
    getDefaultData() {
        return {
            teamMembers: [],
            submissions: {}, // { week: [submissions] }
            guesses: {}, // { week: [guesses] }
            finalizedGuesses: {}, // { week: [guesser names] }
            lifelines: {}, // { week: { guesser: [{ albumKey, type }] } } type: fiftyFifty | audience | phone
            deals: {}, // { week: { guesser: { offer, accepted } } }
            themes: {}, // { week: { id, params, text } }
            gameDayOverrides: {}, // { week: DD/MM/YYYY } admin-enabled early game day
            adminPassword: 'admin',
            lastUpdated: new Date().toISOString()
        };
    },

    // Get data from Gist or localStorage
    parseCachedGistData() {
        const cached = localStorage.getItem('gistDataCache');
        if (!cached) return null;
        try {
            return JSON.parse(cached);
        } catch (error) {
            console.error('Invalid gistDataCache in localStorage:', error);
            localStorage.removeItem('gistDataCache');
            localStorage.removeItem('gistDataCacheTime');
            return null;
        }
    },

    async getData() {
        let base;
        if (this.isGistConfigured()) {
            try {
                base = await this.fetchGist();
                localStorage.setItem('gistDataCache', JSON.stringify(base));
                localStorage.setItem('gistDataCacheTime', Date.now().toString());
            } catch (error) {
                console.error('Error fetching from Gist:', error);
                const cached = this.parseCachedGistData();
                base = cached || this.getDataFromLocalStorage();
            }
        } else {
            base = this.getDataFromLocalStorage();
        }
        return this.mergePreviewOverlay(base);
    },

    // Always fetch latest data before a write (avoids stale overwrites)
    async getFreshData() {
        let base;
        if (this.isGistConfigured()) {
            try {
                base = await this.fetchGist();
                localStorage.setItem('gistDataCache', JSON.stringify(base));
                localStorage.setItem('gistDataCacheTime', Date.now().toString());
            } catch (error) {
                console.error('Error fetching fresh Gist data:', error);
                const cached = this.parseCachedGistData();
                base = cached || this.getDataFromLocalStorage();
            }
        } else {
            base = this.getDataFromLocalStorage();
        }
        return this.mergePreviewOverlay(base);
    },

    /** Restore real persisted data for the current week when saving (preview mode). */
    applyRealWeekSlice(target, source) {
        const week = this.getCurrentWeek();
        const t = { ...target };
        t.submissions = { ...(t.submissions || {}) };
        t.guesses = { ...(t.guesses || {}) };
        t.finalizedGuesses = { ...(t.finalizedGuesses || {}) };
        t.lifelines = { ...(t.lifelines || {}) };
        t.deals = { ...(t.deals || {}) };
        t.submissions[week] = source.submissions?.[week] ? [...source.submissions[week]] : [];
        t.guesses[week] = source.guesses?.[week] ? [...source.guesses[week]] : [];
        t.finalizedGuesses[week] = source.finalizedGuesses?.[week] ? [...source.finalizedGuesses[week]] : [];
        t.lifelines[week] = source.lifelines?.[week] ? { ...source.lifelines[week] } : {};
        t.deals[week] = source.deals?.[week] ? { ...source.deals[week] } : {};
        return t;
    },

    // Get data from localStorage
    getDataFromLocalStorage() {
        const data = this.getDefaultData();
        
        // Team members
        const members = localStorage.getItem('teamMembers');
        if (members) {
            data.teamMembers = JSON.parse(members);
        }

        // Submissions
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('submissions_')) {
                const week = key.replace('submissions_', '');
                data.submissions[week] = JSON.parse(localStorage.getItem(key));
            }
        }

        // Guesses
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('guesses_')) {
                const week = key.replace('guesses_', '');
                data.guesses[week] = JSON.parse(localStorage.getItem(key));
            }
        }

        // Finalized guesses
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('finalizedGuesses_')) {
                const week = key.replace('finalizedGuesses_', '');
                data.finalizedGuesses[week] = JSON.parse(localStorage.getItem(key));
            }
        }

        // Themes
        const themes = localStorage.getItem('themes');
        if (themes) {
            data.themes = JSON.parse(themes);
        }

        const lifelines = localStorage.getItem('lifelines');
        if (lifelines) {
            data.lifelines = JSON.parse(lifelines);
        }

        const deals = localStorage.getItem('deals');
        if (deals) {
            data.deals = JSON.parse(deals);
        }

        // Game day overrides
        const gameDayOverrides = localStorage.getItem('gameDayOverrides');
        if (gameDayOverrides) {
            data.gameDayOverrides = JSON.parse(gameDayOverrides);
        }

        // Admin password
        const adminPwd = localStorage.getItem('adminPassword');
        if (adminPwd) {
            data.adminPassword = adminPwd;
        }

        return data;
    },

    // Save data to Gist or localStorage
    async saveData(data) {
        data.lastUpdated = new Date().toISOString();

        if (this.isPreviewMode()) {
            let sourceReal;
            if (this.isGistConfigured()) {
                try {
                    sourceReal = await this.fetchGist();
                } catch (e) {
                    sourceReal = this.parseCachedGistData() || this.getDefaultData();
                }
            } else {
                sourceReal = this.getDataFromLocalStorage();
            }
            const persisted = this.applyRealWeekSlice(data, sourceReal);
            this.savePreviewOverlayFromMergedData(data);
            if (this.isGistConfigured()) {
                try {
                    await this.updateGist(persisted);
                    const forCache = this.mergePreviewOverlay(persisted);
                    localStorage.setItem('gistDataCache', JSON.stringify(forCache));
                    localStorage.setItem('gistDataCacheTime', Date.now().toString());
                    return { success: true };
                } catch (error) {
                    console.error('Error saving to Gist (preview):', error);
                    this.saveDataToLocalStorage(persisted);
                    return { success: false, error: error.message };
                }
            }
            this.saveDataToLocalStorage(persisted);
            return { success: true };
        }
        
        if (this.isGistConfigured()) {
            try {
                await this.updateGist(data);
                // Update cache
                localStorage.setItem('gistDataCache', JSON.stringify(data));
                localStorage.setItem('gistDataCacheTime', Date.now().toString());
                return { success: true };
            } catch (error) {
                console.error('Error saving to Gist:', error);
                // Fallback to localStorage
                this.saveDataToLocalStorage(data);
                return { success: false, error: error.message };
            }
        } else {
            this.saveDataToLocalStorage(data);
            return { success: true };
        }
    },

    // Save data to localStorage
    saveDataToLocalStorage(data) {
        // Team members
        localStorage.setItem('teamMembers', JSON.stringify(data.teamMembers || []));

        // Submissions
        Object.keys(data.submissions || {}).forEach(week => {
            localStorage.setItem(`submissions_${week}`, JSON.stringify(data.submissions[week]));
        });

        // Guesses
        Object.keys(data.guesses || {}).forEach(week => {
            localStorage.setItem(`guesses_${week}`, JSON.stringify(data.guesses[week]));
        });

        // Finalized guesses
        Object.keys(data.finalizedGuesses || {}).forEach(week => {
            localStorage.setItem(`finalizedGuesses_${week}`, JSON.stringify(data.finalizedGuesses[week]));
        });

        // Themes
        if (data.themes) {
            localStorage.setItem('themes', JSON.stringify(data.themes));
        }

        if (data.lifelines) {
            localStorage.setItem('lifelines', JSON.stringify(data.lifelines));
        }

        if (data.deals) {
            localStorage.setItem('deals', JSON.stringify(data.deals));
        }

        // Game day overrides
        if (data.gameDayOverrides) {
            localStorage.setItem('gameDayOverrides', JSON.stringify(data.gameDayOverrides));
        }

        // Admin password
        if (data.adminPassword) {
            localStorage.setItem('adminPassword', data.adminPassword);
        }
    },

    // GitHub Gists API methods
    getGistHeaders(includeJson = false) {
        const headers = {
            'Authorization': `Bearer ${this.getGitHubToken()}`,
            'Accept': 'application/vnd.github.v3+json'
        };
        if (includeJson) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    },

    gistErrorMessage(status, fallback) {
        if (status === 401) {
            return 'GitHub token is invalid or expired. Create a new token with the "gist" scope and update it in Settings.';
        }
        if (status === 403) {
            return 'GitHub access denied. Check that your token has the "gist" scope.';
        }
        if (status === 404) {
            return 'Gist not found. Check the Gist ID in Settings.';
        }
        return fallback;
    },

    async fetchGist() {
        const gistId = this.getGistId();

        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: this.getGistHeaders()
        });

        if (!response.ok) {
            throw new Error(this.gistErrorMessage(response.status, `Failed to fetch Gist: ${response.statusText}`));
        }

        const gist = await response.json();
        const filename = Object.keys(gist.files)[0];
        const content = gist.files[filename].content;

        return JSON.parse(content);
    },

    async updateGist(data) {
        const gistId = this.getGistId();

        // First, get the current Gist to get the filename
        const currentGist = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: this.getGistHeaders()
        });

        if (!currentGist.ok) {
            throw new Error(this.gistErrorMessage(currentGist.status, `Failed to fetch Gist: ${currentGist.statusText}`));
        }

        const gistData = await currentGist.json();
        const filename = Object.keys(gistData.files)[0] || 'album-game-data.json';

        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: this.getGistHeaders(true),
            body: JSON.stringify({
                files: {
                    [filename]: {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(
                this.gistErrorMessage(response.status, error.message || `Failed to update Gist: ${response.statusText}`)
            );
        }

        return await response.json();
    },

    async createGist(data) {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: this.getGistHeaders(true),
            body: JSON.stringify({
                description: 'Album Game Data',
                public: false,
                files: {
                    'album-game-data.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(
                this.gistErrorMessage(response.status, error.message || `Failed to create Gist: ${response.statusText}`)
            );
        }

        const gist = await response.json();
        this.setGistId(gist.id);
        return gist;
    },

    // Team Members (async)
    async getTeamMembers() {
        const data = await this.getData();
        return data.teamMembers || [];
    },

    async addTeamMember(name) {
        const data = await this.getFreshData();
        if (!data.teamMembers) {
            data.teamMembers = [];
        }
        
        if (!data.teamMembers.find(m => m.toLowerCase() === name.toLowerCase())) {
            data.teamMembers.push(name);
            await this.saveData(data);
            return true;
        }
        return false;
    },

    async deleteTeamMember(name) {
        const data = await this.getFreshData();
        if (data.teamMembers) {
            data.teamMembers = data.teamMembers.filter(m => m.toLowerCase() !== name.toLowerCase());
            await this.saveData(data);
        }
    },

    // Submissions (async)
    async getSubmissions(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getData();
        return data.submissions?.[weekKey] || [];
    },

    async addSubmission(artist, album, url, submitter) {
        const week = this.getCurrentWeek();

        if (!this.isPreviewMode() && !(await this.isGameDay(week))) {
            return { success: false, message: 'Albums can only be submitted on Friday (or an admin-enabled game day).' };
        }

        const data = await this.getFreshData();
        
        if (!data.submissions) {
            data.submissions = {};
        }
        if (!data.submissions[week]) {
            data.submissions[week] = [];
        }
        
        const submissions = data.submissions[week];
        
        // Check if submitter already has 1 submission this week
        const userSubmissions = submissions.filter(s => s.submitter === submitter);
        if (userSubmissions.length >= 1) {
            return { success: false, message: 'You have already submitted an album this week.' };
        }

        const submission = {
            id: Date.now(),
            artist,
            album,
            url: url || '',
            submitter,
            week
        };

        submissions.push(submission);
        data.submissions[week] = submissions;
        
        const result = await this.saveData(data);
        if (result.success) {
            return { success: true, message: 'Album submitted successfully!' };
        } else {
            return { success: false, message: 'Failed to save submission. ' + (result.error || '') };
        }
    },

    // Guesses (async)
    async getGuesses(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getData();
        return data.guesses?.[weekKey] || [];
    },

    async saveGuess(submissionId, guesser, guessedSubmitter) {
        const week = this.getCurrentWeek();
        const data = await this.getFreshData();
        
        if (!data.guesses) {
            data.guesses = {};
        }
        if (!data.guesses[week]) {
            data.guesses[week] = [];
        }
        
        const guesses = data.guesses[week];
        
        // Remove existing guess for this submission by this guesser
        const filtered = guesses.filter(g => !(g.submissionId === submissionId && g.guesser === guesser));
        
        filtered.push({
            submissionId,
            guesser,
            guessedSubmitter,
            week
        });

        data.guesses[week] = filtered;
        await this.saveData(data);
    },

    // Check if guesses are finalized for a user/week
    async areGuessesFinalized(guesser, week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getData();
        if (!data.finalizedGuesses || !data.finalizedGuesses[weekKey]) {
            return false;
        }
        return data.finalizedGuesses[weekKey].includes(guesser);
    },

    // Finalize guesses for a user/week (lock them)
    async finalizeGuesses(guesser, week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getFreshData();
        
        if (!data.finalizedGuesses) {
            data.finalizedGuesses = {};
        }
        if (!data.finalizedGuesses[weekKey]) {
            data.finalizedGuesses[weekKey] = [];
        }
        
        if (!data.finalizedGuesses[weekKey].includes(guesser)) {
            data.finalizedGuesses[weekKey].push(guesser);
            await this.saveData(data);
        }
    },

    // Save guess for album group (handles duplicates)
    async saveGuessForAlbum(albumKey, guesser, guessedSubmitter, skipFinalizedCheck = false) {
        // Check if guesses are finalized (unless we're in a save operation)
        if (!skipFinalizedCheck && await this.areGuessesFinalized(guesser)) {
            throw new Error('Your guesses for this week have been finalized and cannot be changed.');
        }

        const week = this.getCurrentWeek();
        const data = await this.getFreshData();
        
        if (!data.guesses) {
            data.guesses = {};
        }
        if (!data.guesses[week]) {
            data.guesses[week] = [];
        }
        
        const guesses = data.guesses[week];
        
        // Check if this guess already exists
        const exists = guesses.some(g => 
            g.albumKey === albumKey && 
            g.guesser === guesser && 
            g.guessedSubmitter === guessedSubmitter
        );
        
        if (!exists) {
            guesses.push({
                albumKey,
                guesser,
                guessedSubmitter,
                week
            });
            data.guesses[week] = guesses;
            await this.saveData(data);
        }
    },

    // Remove guess for album group
    async removeGuessForAlbum(albumKey, guesser, guessedSubmitter) {
        // Check if guesses are finalized
        if (await this.areGuessesFinalized(guesser)) {
            throw new Error('Your guesses for this week have been finalized and cannot be changed.');
        }

        const week = this.getCurrentWeek();
        const data = await this.getFreshData();
        
        if (!data.guesses || !data.guesses[week]) {
            return;
        }
        
        const guesses = data.guesses[week];
        const filtered = guesses.filter(g => 
            !(g.albumKey === albumKey && 
              g.guesser === guesser && 
              g.guessedSubmitter === guessedSubmitter)
        );
        
        data.guesses[week] = filtered;
        await this.saveData(data);
    },

    // Remove all guesses for an album group (for clearing before saving new ones)
    async removeAllGuessesForAlbum(albumKey, guesser) {
        // Check if guesses are finalized
        if (await this.areGuessesFinalized(guesser)) {
            throw new Error('Your guesses for this week have been finalized and cannot be changed.');
        }

        const week = this.getCurrentWeek();
        const data = await this.getFreshData();
        
        if (!data.guesses || !data.guesses[week]) {
            return;
        }
        
        const guesses = data.guesses[week];
        const filtered = guesses.filter(g => 
            !(g.albumKey === albumKey && g.guesser === guesser)
        );
        
        data.guesses[week] = filtered;
        await this.saveData(data);
    },

    // Clear this week's submissions
    async clearWeekSubmissions(week = null) {
        if (this.isPreviewMode()) {
            throw new Error('Preview mode is on — turn it off in Admin before clearing real week data.');
        }
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getFreshData();
        
        if (!data.submissions) {
            data.submissions = {};
        }
        data.submissions[weekKey] = [];
        
        await this.saveData(data);
        return { success: true };
    },

    // Clear this week's guesses
    async clearWeekGuesses(week = null) {
        if (this.isPreviewMode()) {
            throw new Error('Preview mode is on — turn it off in Admin before clearing real week data.');
        }
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getFreshData();
        
        if (!data.guesses) {
            data.guesses = {};
        }
        data.guesses[weekKey] = [];
        
        // Also clear finalized guesses for this week
        if (!data.finalizedGuesses) {
            data.finalizedGuesses = {};
        }
        data.finalizedGuesses[weekKey] = [];

        if (data.lifelines && data.lifelines[weekKey]) {
            delete data.lifelines[weekKey];
        }
        if (data.deals && data.deals[weekKey]) {
            delete data.deals[weekKey];
        }
        
        await this.saveData(data);
        return { success: true };
    },

    /** @returns {Record<string, { albumKey: string, type: string }[]>} */
    async getLifelinesForWeek(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getData();
        return data.lifelines?.[weekKey] || {};
    },

    async saveGuesserLifelines(weekKey, guesser, entries) {
        const data = await this.getFreshData();
        if (!data.lifelines) data.lifelines = {};
        if (!data.lifelines[weekKey]) data.lifelines[weekKey] = {};
        data.lifelines[weekKey][guesser] = Array.isArray(entries) ? entries : [];
        await this.saveData(data);
    },

    /** @returns {Record<string, { offer: number, accepted: boolean } | null>} */
    async getDealsForWeek(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getData();
        return data.deals?.[weekKey] || {};
    },

    async saveGuesserDeal(weekKey, guesser, deal) {
        const data = await this.getFreshData();
        if (!data.deals) data.deals = {};
        if (!data.deals[weekKey]) data.deals[weekKey] = {};
        data.deals[weekKey][guesser] = deal;
        await this.saveData(data);
    },

    // Clear finalized guesses for a week (unlock guesses)
    async clearFinalizedGuesses(week = null) {
        if (this.isPreviewMode()) {
            throw new Error('Preview mode is on — turn it off in Admin before unlocking real finalized guesses.');
        }
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getFreshData();
        
        if (!data.finalizedGuesses) {
            data.finalizedGuesses = {};
        }
        data.finalizedGuesses[weekKey] = [];
        
        await this.saveData(data);
        return { success: true };
    },

    // Get all weeks that have submissions (sorted by date, most recent first)
    async getAllWeeks() {
        const data = await this.getData();
        const weeks = Object.keys(data.submissions || {});
        return weeks.sort((a, b) => {
            const parse = (s) => {
                const [d, m, y] = s.split('/').map(Number);
                return new Date(y, m - 1, d).getTime();
            };
            return parse(b) - parse(a);
        });
    },

    // Admin password
    async setAdminPassword(password) {
        localStorage.setItem('adminPassword', password);
        // Also update in Gist data if configured
        if (this.isGistConfigured()) {
            try {
                const data = await this.getFreshData();
                data.adminPassword = password;
                await this.saveData(data);
            } catch (error) {
                console.error('Error syncing admin password to Gist:', error);
            }
        }
    },

    async getAdminPassword() {
        // Try to get from Gist data first if configured
        if (this.isGistConfigured()) {
            try {
                const data = await this.getData();
                if (data.adminPassword) {
                    // Sync to localStorage for fallback
                    localStorage.setItem('adminPassword', data.adminPassword);
                    return data.adminPassword;
                }
            } catch (error) {
                console.error('Error fetching admin password from Gist:', error);
            }
        }
        // Fallback to localStorage
        return localStorage.getItem('adminPassword') || 'admin'; // Default password
    },

    // Check if admin is logged in
    isAdminLoggedIn() {
        return sessionStorage.getItem('adminLoggedIn') === 'true';
    },

    setAdminLoggedIn(value) {
        sessionStorage.setItem('adminLoggedIn', value.toString());
    },

    // Get results for a week (async)
    async getWeekResults(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const submissions = await this.getSubmissions(weekKey);
        const guesses = await this.getGuesses(weekKey);
        const members = await this.getTeamMembers();
        const data = await this.getData();
        const weekLifelines = data.lifelines?.[weekKey] || {};
        const weekDeals = data.deals?.[weekKey] || {};

        /** @param {string} guesser @param {string} albumKey */
        const lifelineCountForAlbum = (guesser, albumKey) => {
            const list = weekLifelines[guesser];
            if (!Array.isArray(list)) return 0;
            return list.filter(e => e && e.albumKey === albumKey).length;
        };

        // Group submissions by album key
        const albumGroups = {};
        submissions.forEach(sub => {
            const key = `${sub.artist.toLowerCase()}-${sub.album.toLowerCase()}`;
            if (!albumGroups[key]) {
                albumGroups[key] = {
                    key: key,
                    artist: sub.artist,
                    album: sub.album,
                    actualSubmitters: []
                };
            }
            albumGroups[key].actualSubmitters.push(sub.submitter);
        });

        // Calculate scores: only count albums a member actually guessed (total = their attempts)
        const scores = {};
        members.forEach(member => {
            scores[member] = {
                correct: 0, // actual points from guesses + lifeline multipliers
                publishedCorrect: 0, // deal when accepted, else actual
                total: 0, // Set later for guessers: number of albums they guessed
                submissions: submissions.filter(s => s.submitter === member).length,
                deal: null // { offer, accepted } or null
            };
        });

        // Process guesses by album key
        const guessesByGuesserAndAlbum = {};
        guesses.forEach(guess => {
            // Handle both old format (submissionId) and new format (albumKey)
            const albumKey = guess.albumKey || (() => {
                const submission = submissions.find(s => s.id === guess.submissionId);
                return submission ? `${submission.artist.toLowerCase()}-${submission.album.toLowerCase()}` : null;
            })();
            
            if (albumKey) {
                if (!guessesByGuesserAndAlbum[guess.guesser]) {
                    guessesByGuesserAndAlbum[guess.guesser] = {};
                }
                if (!guessesByGuesserAndAlbum[guess.guesser][albumKey]) {
                    guessesByGuesserAndAlbum[guess.guesser][albumKey] = [];
                }
                guessesByGuesserAndAlbum[guess.guesser][albumKey].push(guess.guessedSubmitter);
            }
        });

        // Calculate scores for each guesser (total = albums they guessed; non-guessers stay 0/0)
        Object.keys(guessesByGuesserAndAlbum).forEach(guesser => {
            if (!scores[guesser]) {
                scores[guesser] = { correct: 0, total: 0, submissions: submissions.filter(s => s.submitter === guesser).length };
            }
            const albumsGuessed = Object.keys(guessesByGuesserAndAlbum[guesser]).length;
            scores[guesser].total = albumsGuessed;

            Object.keys(guessesByGuesserAndAlbum[guesser]).forEach(albumKey => {
                const albumGroup = albumGroups[albumKey];
                if (albumGroup) {
                    const actualSubmitters = [...new Set(albumGroup.actualSubmitters)];
                    const guessedSubmitters = [...new Set(guessesByGuesserAndAlbum[guesser][albumKey])];
                    const nLifelines = lifelineCountForAlbum(guesser, albumKey);
                    const mult = 1 / Math.pow(2, nLifelines);

                    const correctPoints = guessedSubmitters
                        .filter(g => actualSubmitters.includes(g))
                        .length * mult;

                    scores[guesser].correct += correctPoints;
                }
            });
        });

        Object.keys(scores).forEach(member => {
            const d = weekDeals[member];
            if (d && typeof d.offer === 'number') {
                scores[member].deal = { offer: d.offer, accepted: !!d.accepted };
                scores[member].publishedCorrect = d.accepted ? d.offer : scores[member].correct;
            } else {
                scores[member].publishedCorrect = scores[member].correct;
            }
        });

        // After 4pm Friday: submitters who never finalized get 0 points (counted as missed every album)
        const albumCount = Object.keys(albumGroups).length;
        const finalizedList = data.finalizedGuesses?.[weekKey] || [];
        const deadlinePassed = albumCount > 0 && new Date() >= this.getWeekFriday4pm(weekKey);
        if (deadlinePassed && !this.isPreviewMode()) {
            const submitterSet = new Set(submissions.map(s => s.submitter));
            members.forEach(member => {
                if (!submitterSet.has(member)) return;
                if (finalizedList.includes(member)) return;
                scores[member].correct = 0;
                scores[member].publishedCorrect = 0;
                scores[member].total = albumCount;
                scores[member].deal = null;
            });
        }

        return {
            submissions,
            guesses,
            scores,
            week: weekKey
        };
    },

    // Weekly themes
    async getWeekTheme(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getData();
        return data.themes?.[weekKey] || null;
    },

    async ensureWeekTheme(week = null) {
        const weekKey = week || this.getCurrentWeek();
        try {
            const data = await this.getFreshData();

            if (!data.themes) {
                data.themes = {};
            }

            if (data.themes[weekKey]) {
                return data.themes[weekKey];
            }

            const theme = ThemeGenerator.generateTheme(data.themes, weekKey, data.teamMembers || []);
            data.themes[weekKey] = theme;
            await this.saveData(data);

            const refreshed = await this.getFreshData();
            return refreshed.themes?.[weekKey] || theme;
        } catch (error) {
            console.error('Error ensuring weekly theme:', error);
            const data = this.parseCachedGistData() || this.getDataFromLocalStorage();
            return data.themes?.[weekKey] || null;
        }
    },

    async clearWeekTheme(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getFreshData();

        if (!data.themes) {
            data.themes = {};
        }

        delete data.themes[weekKey];
        await this.saveData(data);
        return { success: true };
    },

    // Get overall stats (async)
    async getOverallStats() {
        const weeks = await this.getAllWeeks();
        const members = await this.getTeamMembers();
        
        const stats = {};
        members.forEach(member => {
            stats[member] = {
                totalCorrect: 0,
                totalGuesses: 0,
                totalSubmissions: 0,
                weeksPlayed: 0,
                weeksSubmitted: 0
            };
        });

        for (const week of weeks) {
            const results = await this.getWeekResults(week);
            const weekMembers = results.submissions.map(s => s.submitter);
            const uniqueWeekMembers = [...new Set(weekMembers)];

            members.forEach(member => {
                // Only add guess stats and weeksPlayed when they actually made guesses that week
                if (results.scores[member] && results.scores[member].total > 0) {
                    const pub = results.scores[member].publishedCorrect != null
                        ? results.scores[member].publishedCorrect
                        : results.scores[member].correct;
                    stats[member].totalCorrect += pub;
                    stats[member].totalGuesses += results.scores[member].total;
                    stats[member].weeksPlayed++;
                }
                if (uniqueWeekMembers.includes(member)) {
                    stats[member].weeksSubmitted++;
                }
                stats[member].totalSubmissions += results.scores[member]?.submissions || 0;
            });
        }

        return stats;
    }
};
