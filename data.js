// Data storage and management using GitHub Gists API
// Falls back to localStorage if Gist is not configured

const Storage = {
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

    // Get formatted date string for display
    getFormattedDate() {
        return this.getCurrentWeek();
    },

    // Initialize data structure
    getDefaultData() {
        return {
            teamMembers: [],
            submissions: {}, // { week: [submissions] }
            guesses: {}, // { week: [guesses] }
            finalizedGuesses: {}, // { week: [guesser names] }
            adminPassword: 'admin',
            lastUpdated: new Date().toISOString()
        };
    },

    // Get data from Gist or localStorage
    async getData() {
        if (this.isGistConfigured()) {
            try {
                const data = await this.fetchGist();
                // Cache in localStorage
                localStorage.setItem('gistDataCache', JSON.stringify(data));
                localStorage.setItem('gistDataCacheTime', Date.now().toString());
                return data;
            } catch (error) {
                console.error('Error fetching from Gist:', error);
                // Try to use cached data if available
                const cached = localStorage.getItem('gistDataCache');
                if (cached) {
                    return JSON.parse(cached);
                }
                // Fallback to localStorage
                return this.getDataFromLocalStorage();
            }
        } else {
            return this.getDataFromLocalStorage();
        }
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

        // Admin password
        if (data.adminPassword) {
            localStorage.setItem('adminPassword', data.adminPassword);
        }
    },

    // GitHub Gists API methods
    async fetchGist() {
        const gistId = this.getGistId();
        const token = this.getGitHubToken();
        
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch Gist: ${response.statusText}`);
        }

        const gist = await response.json();
        const filename = Object.keys(gist.files)[0];
        const content = gist.files[filename].content;
        
        return JSON.parse(content);
    },

    async updateGist(data) {
        const gistId = this.getGistId();
        const token = this.getGitHubToken();
        
        // First, get the current Gist to get the filename
        const currentGist = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!currentGist.ok) {
            throw new Error(`Failed to fetch Gist: ${currentGist.statusText}`);
        }

        const gistData = await currentGist.json();
        const filename = Object.keys(gistData.files)[0] || 'album-game-data.json';
        
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    [filename]: {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `Failed to update Gist: ${response.statusText}`);
        }

        return await response.json();
    },

    async createGist(data) {
        const token = this.getGitHubToken();
        
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
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
            const error = await response.json();
            throw new Error(error.message || `Failed to create Gist: ${response.statusText}`);
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
        const data = await this.getData();
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
        const data = await this.getData();
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
        const data = await this.getData();
        
        if (!data.submissions) {
            data.submissions = {};
        }
        if (!data.submissions[week]) {
            data.submissions[week] = [];
        }
        
        const submissions = data.submissions[week];
        
        // Check if submitter already has 2 submissions this week
        const userSubmissions = submissions.filter(s => s.submitter === submitter);
        if (userSubmissions.length >= 2) {
            return { success: false, message: 'You have already submitted 2 albums this week.' };
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
        const data = await this.getData();
        
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
        const data = await this.getData();
        
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
        const data = await this.getData();
        
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
        const data = await this.getData();
        
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
        const data = await this.getData();
        
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
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getData();
        
        if (!data.submissions) {
            data.submissions = {};
        }
        data.submissions[weekKey] = [];
        
        await this.saveData(data);
        return { success: true };
    },

    // Clear this week's guesses
    async clearWeekGuesses(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getData();
        
        if (!data.guesses) {
            data.guesses = {};
        }
        data.guesses[weekKey] = [];
        
        // Also clear finalized guesses for this week
        if (!data.finalizedGuesses) {
            data.finalizedGuesses = {};
        }
        data.finalizedGuesses[weekKey] = [];
        
        await this.saveData(data);
        return { success: true };
    },

    // Clear finalized guesses for a week (unlock guesses)
    async clearFinalizedGuesses(week = null) {
        const weekKey = week || this.getCurrentWeek();
        const data = await this.getData();
        
        if (!data.finalizedGuesses) {
            data.finalizedGuesses = {};
        }
        data.finalizedGuesses[weekKey] = [];
        
        await this.saveData(data);
        return { success: true };
    },

    // Get all weeks that have submissions
    async getAllWeeks() {
        const data = await this.getData();
        const weeks = Object.keys(data.submissions || {});
        return weeks.sort().reverse(); // Most recent first
    },

    // Admin password
    async setAdminPassword(password) {
        localStorage.setItem('adminPassword', password);
        // Also update in Gist data if configured
        if (this.isGistConfigured()) {
            const data = await this.getData();
            data.adminPassword = password;
            await this.saveData(data);
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

        // Calculate total number of submissions (not unique albums)
        const totalSubmissions = submissions.length;

        // Calculate scores based on album groups
        const scores = {};
        members.forEach(member => {
            scores[member] = {
                correct: 0,
                total: totalSubmissions, // Total is the number of submissions in the week
                submissions: submissions.filter(s => s.submitter === member).length
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

        // Calculate scores for each guesser
        Object.keys(guessesByGuesserAndAlbum).forEach(guesser => {
            if (!scores[guesser]) {
                scores[guesser] = { correct: 0, total: totalSubmissions, submissions: 0 };
            }
            
            Object.keys(guessesByGuesserAndAlbum[guesser]).forEach(albumKey => {
                const albumGroup = albumGroups[albumKey];
                if (albumGroup) {
                    const actualSubmitters = [...new Set(albumGroup.actualSubmitters)];
                    const guessedSubmitters = [...new Set(guessesByGuesserAndAlbum[guesser][albumKey])];
                    
                    // Count correct guesses (people guessed who actually submitted)
                    const correctCount = guessedSubmitters.filter(g => actualSubmitters.includes(g)).length;
                    
                    // Add points for correct guesses
                    // Each correct guess is worth 1 point
                    scores[guesser].correct += correctCount;
                }
            });
        });

        return {
            submissions,
            guesses,
            scores,
            week: weekKey
        };
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
                if (results.scores[member]) {
                    stats[member].totalCorrect += results.scores[member].correct;
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
