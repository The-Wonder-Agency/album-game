// Weekly theme definitions and random generation

const ThemeGenerator = {
    COMMON_THEME_IDS: [
        'colour_in_name',
        'number_in_title',
        'single_word_title',
        'starts_with_the',
        'contains_and',
        'contains_live',
        'contains_part_vol',
        'contains_roman_numeral',
        'self_titled',
        'video_game_soundtrack',
        'film_tv_soundtrack',
        'compilation_one_artist',
        'compilation_multiple_artists',
        'contains_deluxe',
        'animal_in_title',
        'place_in_title',
        'emotion_in_title',
        'weather_in_title',
        'season_in_title',
        'short_title',
        'long_title',
        'one_word_artist',
        'title_shorter_than_artist',
        'song_from_tv_show',
        'song_from_film',
        'song_from_advert',
        'non_english_lyrics',
        'guilty_pleasure',
        'think_player_would_pick',
        'genre_you_dont_listen_to',
        'genre_not_associated_with_you',
        'features_uk_number_one_single',
        'uk_number_one_album',
        'travel_in_title',
        'time_in_title',
        'cover_art_colour',
        'cover_art_object',
        'deep_cut',
        'one_hit_wonder_artist',
        'discovered_this_year',
        'owned_on_cd_or_vinyl',
        'listened_on_repeat',
        'first_album_bought',
        'artist_broke_up_died_or_retired',
        'one_album_artist',
        'album_older_than_you',
        'album_younger_than_you',
        'title_is_person_name',
        'title_is_question',
        'title_has_punctuation',
        'title_all_caps_or_stylised',
        'cover_art_typography',
        'cover_art_photo_of_place',
        'cover_art_photo_of_person',
        'cover_art_photograph',
        'supergroup',
        'album_not_uk_or_us'
    ],

    RARE_THEME_IDS: [
        'album_starts_with',
        'artist_starts_with',
        'release_year',
        'release_decade',
        'genre'
    ],

    COMMON_THEME_WEIGHT: 7,
    RARE_THEME_WEIGHT: 1,

    GENRES: [
        'rock',
        'pop',
        'hip-hop',
        'country',
        'electronic',
        'metal',
        'punk',
        'R&B',
        'soul',
        'folk',
        'indie',
        'blues',
        'dance'
    ],

    LETTER_WEIGHTS: {
        A: 8, B: 6, C: 8, D: 6, E: 2, F: 5, G: 4, H: 4, I: 2, J: 2, K: 2,
        L: 5, M: 8, N: 4, O: 4, P: 6, Q: 1, R: 7, S: 8, T: 8, U: 2, V: 2,
        W: 3, X: 1, Y: 2, Z: 1
    },

    DECADES: ['1980s', '1990s', '2000s', '2010s', '2020s'],

    COVER_COLOURS: [
        'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
        'black', 'white', 'gold', 'silver', 'brown', 'grey'
    ],

    COVER_OBJECTS: [
        'heart', 'skull', 'crown', 'flower', 'rose', 'butterfly', 'bird', 'eagle',
        'eye', 'hand', 'face', 'mask', 'sword', 'car', 'train', 'boat', 'moon',
        'sun', 'star', 'tree', 'mountain', 'castle', 'house', 'key', 'clock',
        'mirror', 'balloon', 'apple', 'candle', 'flame', 'snake', 'wolf', 'horse',
        'cat', 'dog', 'angel', 'cross', 'globe', 'planet', 'rocket', 'robot',
        'doll', 'umbrella', 'bicycle', 'guitar', 'piano', 'microphone', 'ring',
        'diamond', 'chain', 'smoke', 'cloud', 'lightning', 'rainbow', 'ghost',
        'skeleton', 'pyramid', 'bridge', 'road', 'window', 'chair', 'knife', 'gun'
    ],

    pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    pickRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    pickWeightedLetter() {
        const pool = [];
        Object.entries(this.LETTER_WEIGHTS).forEach(([letter, weight]) => {
            for (let i = 0; i < weight; i++) {
                pool.push(letter);
            }
        });
        return this.pickRandom(pool);
    },

    pickReleaseYear() {
        const currentYear = new Date().getFullYear();
        return this.pickRandomInt(1980, currentYear);
    },

    parseWeekKey(weekKey) {
        const [d, m, y] = weekKey.split('/').map(Number);
        return new Date(y, m - 1, d).getTime();
    },

    getSortedThemeWeeks(themes) {
        return Object.keys(themes || {}).sort(
            (a, b) => this.parseWeekKey(a) - this.parseWeekKey(b)
        );
    },

    getRecentThemeIds(themes, currentWeekKey) {
        const cooldownWeeks = this.COMMON_THEME_IDS.length;
        const sorted = this.getSortedThemeWeeks(themes).filter(week => week !== currentWeekKey);
        const currentIndex = sorted.indexOf(currentWeekKey);
        const priorWeeks = currentIndex === -1 ? sorted : sorted.slice(0, currentIndex);
        const recentWeeks = priorWeeks.slice(-cooldownWeeks);
        const ids = new Set();

        recentWeeks.forEach(week => {
            const theme = themes[week];
            if (theme?.id) {
                ids.add(theme.id);
            }
        });

        return ids;
    },

    pickLeastRecentlyUsedThemeId(themeIds, themes, currentWeekKey) {
        const sorted = this.getSortedThemeWeeks(themes).filter(week => week !== currentWeekKey);
        const lastUsed = new Map();

        sorted.forEach(week => {
            const theme = themes[week];
            if (theme?.id && themeIds.includes(theme.id)) {
                lastUsed.set(theme.id, week);
            }
        });

        return [...themeIds].sort((a, b) => {
            const aUsed = lastUsed.has(a);
            const bUsed = lastUsed.has(b);
            if (!aUsed && !bUsed) {
                return themeIds.indexOf(a) - themeIds.indexOf(b);
            }
            if (!aUsed) return -1;
            if (!bUsed) return 1;
            return this.parseWeekKey(lastUsed.get(a)) - this.parseWeekKey(lastUsed.get(b));
        })[0];
    },

    pickThemeId(themes, currentWeekKey, teamMembers = []) {
        const blockedIds = this.getRecentThemeIds(themes, currentWeekKey);
        const availableCommon = this.COMMON_THEME_IDS.filter(id => {
            if (blockedIds.has(id)) return false;
            if (id === 'think_player_would_pick' && teamMembers.length === 0) return false;
            return true;
        });
        const availableRare = this.RARE_THEME_IDS.filter(id => !blockedIds.has(id));
        const pool = [];

        availableCommon.forEach(id => {
            for (let i = 0; i < this.COMMON_THEME_WEIGHT; i++) {
                pool.push(id);
            }
        });

        availableRare.forEach(id => {
            for (let i = 0; i < this.RARE_THEME_WEIGHT; i++) {
                pool.push(id);
            }
        });

        if (pool.length > 0) {
            return this.pickRandom(pool);
        }

        const allIds = [...this.COMMON_THEME_IDS, ...this.RARE_THEME_IDS];
        return this.pickLeastRecentlyUsedThemeId(allIds, themes, currentWeekKey);
    },

    buildText(id, params) {
        switch (id) {
            case 'album_starts_with':
                return `Album title beginning with ${params.letter}`;
            case 'artist_starts_with':
                return `Artist name beginning with ${params.letter}`;
            case 'release_year':
                return `Album released in ${params.year}`;
            case 'release_decade':
                return `Album released in the ${params.decade}`;
            case 'genre': {
                const genre = params.genre;
                const article = /^[aeiou]/i.test(genre) ? 'An' : 'A';
                return `${article} ${genre} album`;
            }
            case 'colour_in_name':
                return 'Album with a colour in the name';
            case 'number_in_title':
                return 'Album title containing a number';
            case 'single_word_title':
                return 'Album title that is a single word';
            case 'starts_with_the':
                return 'Album title beginning with "The"';
            case 'contains_and':
                return 'Album title containing "&" or "and"';
            case 'contains_live':
                return 'Album with "Live" in the title';
            case 'contains_part_vol':
                return 'Album with "Part", "Vol", or "Volume" in the title';
            case 'contains_roman_numeral':
                return 'Album with a Roman numeral in the title (II, III, IV, etc.)';
            case 'self_titled':
                return 'Self-titled album (album name matches artist name)';
            case 'video_game_soundtrack':
                return 'Video game soundtrack';
            case 'film_tv_soundtrack':
                return 'Film or TV soundtrack';
            case 'compilation_one_artist':
                return 'Compilation album by one artist';
            case 'compilation_multiple_artists':
                return 'Compilation album featuring multiple artists';
            case 'contains_deluxe':
                return 'Album with "Deluxe" or "Remix" in the title';
            case 'animal_in_title':
                return 'Album with an animal in the title';
            case 'place_in_title':
                return 'Album with a place in the title (city, country, etc.)';
            case 'emotion_in_title':
                return 'Album with an emotion in the title (love, fear, joy, etc.)';
            case 'weather_in_title':
                return 'Album with weather in the title (rain, sun, storm, snow, etc.)';
            case 'season_in_title':
                return 'Album with a season in the title (spring, summer, autumn, winter)';
            case 'short_title':
                return `Album title of ${params.maxWords} word${params.maxWords === 1 ? '' : 's'} or fewer`;
            case 'long_title':
                return `Album title of ${params.minWords} words or more`;
            case 'one_word_artist':
                return 'Album by an artist with a one-word name';
            case 'title_shorter_than_artist':
                return 'Album title shorter than the artist name (by character count)';
            case 'song_from_tv_show':
                return 'Album featuring a song from a TV show';
            case 'song_from_film':
                return 'Album featuring a song from a film';
            case 'song_from_advert':
                return 'Album featuring a song from an advert';
            case 'non_english_lyrics':
                return 'Album where at least 90% of the lyrics are not in English';
            case 'guilty_pleasure':
                return 'Guilty pleasure album';
            case 'think_player_would_pick':
                return `An album you think ${params.player} would pick`;
            case 'genre_you_dont_listen_to':
                return 'Album from a genre you wouldn\'t normally listen to';
            case 'genre_not_associated_with_you':
                return 'Album from a genre people wouldn\'t associate with you';
            case 'features_uk_number_one_single':
                return 'Album featuring a UK number one single';
            case 'uk_number_one_album':
                return 'UK number one album';
            case 'travel_in_title':
                return 'Album with travel or a journey in the title';
            case 'time_in_title':
                return 'Album with time in the title';
            case 'cover_art_colour':
                return `Album where the cover art is mostly ${params.colour}`;
            case 'cover_art_object': {
                const object = params.object;
                const article = /^[aeiou]/i.test(object) ? 'an' : 'a';
                return `Album where the cover art features ${article} ${object}`;
            }
            case 'deep_cut':
                return 'Deep cut album — your favourite track isn\'t the hit single';
            case 'one_hit_wonder_artist':
                return 'Album by a one-hit wonder artist';
            case 'discovered_this_year':
                return 'Album you discovered this year';
            case 'owned_on_cd_or_vinyl':
                return 'Album you owned on CD or vinyl';
            case 'listened_on_repeat':
                return 'Album you listened to on repeat for a week';
            case 'first_album_bought':
                return 'First album you ever bought';
            case 'artist_broke_up_died_or_retired':
                return 'Album by an artist who broke up, died, or retired';
            case 'one_album_artist':
                return 'Album by an artist who only ever released one album';
            case 'album_older_than_you':
                return 'Album older than you';
            case 'album_younger_than_you':
                return 'Album younger than you';
            case 'title_is_person_name':
                return 'Album title that\'s a person\'s name';
            case 'title_is_question':
                return 'Album title that\'s a question';
            case 'title_has_punctuation':
                return 'Album title with punctuation (!, ?, …)';
            case 'title_all_caps_or_stylised':
                return 'Album title that\'s all caps or stylised unusually';
            case 'cover_art_typography':
                return 'Album where the cover art is mostly text or typography';
            case 'cover_art_photo_of_place':
                return 'Album where the cover art is a photograph of a place';
            case 'cover_art_photo_of_person':
                return 'Album where the cover art is a photograph of a person';
            case 'cover_art_photograph':
                return 'Album where the cover art is a photograph';
            case 'supergroup':
                return 'Album by a supergroup';
            case 'album_not_uk_or_us':
                return 'Album by an artist from a country other than the UK or US';
            default:
                return 'Unknown theme';
        }
    },

    generateParams(id, teamMembers = []) {
        switch (id) {
            case 'album_starts_with':
            case 'artist_starts_with':
                return { letter: this.pickWeightedLetter() };
            case 'release_year':
                return { year: this.pickReleaseYear() };
            case 'release_decade':
                return { decade: this.pickRandom(this.DECADES) };
            case 'genre':
                return { genre: this.pickRandom(this.GENRES) };
            case 'short_title':
                return { maxWords: this.pickRandomInt(1, 3) };
            case 'long_title':
                return { minWords: this.pickRandomInt(4, 6) };
            case 'think_player_would_pick':
                return { player: this.pickRandom(teamMembers) };
            case 'cover_art_colour':
                return { colour: this.pickRandom(this.COVER_COLOURS) };
            case 'cover_art_object':
                return { object: this.pickRandom(this.COVER_OBJECTS) };
            default:
                return {};
        }
    },

    generateTheme(themes = {}, currentWeekKey = '', teamMembers = []) {
        const id = this.pickThemeId(themes, currentWeekKey, teamMembers);
        const params = this.generateParams(id, teamMembers);
        return {
            id,
            params,
            text: this.buildText(id, params)
        };
    }
};
