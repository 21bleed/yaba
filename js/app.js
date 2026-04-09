const API_KEY = '392616728e665a959e6c9e6f1aaf8a6c';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';

// --- INSTÄLLNINGAR ---
const VIDSRC_DOMAIN = 'https://vsrc.su'; // Byt till t.ex. 'https://vidsrcme.su' eller 'https://vidsrc-embed.ru' om denna slutar funka

let heroData = null;
let currentModalData = null;
let currentLanguage = localStorage.getItem('huset_language') || 'sv';
let currentAudioType = localStorage.getItem('huset_audio_type') || 'sub'; // 'sub' eller 'dub'
let currentVideoProvider = localStorage.getItem('huset_video_provider') || 'vidlink'; // 'vidsrc' eller 'vidlink'

// Språkkonfiguration för UI och API
const LANGUAGES = {
    'sv': { name: 'Svenska', flag: '🇸🇪', tmdb: 'sv-SE', vidlink: 'sv' },
    'en': { name: 'English', flag: '🇬🇧', tmdb: 'en-US', vidlink: 'en' },
    'ja': { name: '日本語', flag: '🇯🇵', tmdb: 'ja-JP', vidlink: 'ja' },
    'de': { name: 'Deutsch', flag: '🇩🇪', tmdb: 'de-DE', vidlink: 'de' },
    'fr': { name: 'Français', flag: '🇫🇷', tmdb: 'fr-FR', vidlink: 'fr' },
    'es': { name: 'Español', flag: '🇪🇸', tmdb: 'es-ES', vidlink: 'es' },
    'it': { name: 'Italiano', flag: '🇮🇹', tmdb: 'it-IT', vidlink: 'it' },
    'ko': { name: '한국어', flag: '🇰🇷', tmdb: 'ko-KR', vidlink: 'ko' },
    'pt': { name: 'Português', flag: '🇵🇹', tmdb: 'pt-PT', vidlink: 'pt' },
    'ru': { name: 'Русский', flag: '🇷🇺', tmdb: 'ru-RU', vidlink: 'ru' },
    'zh': { name: '中文', flag: '🇨🇳', tmdb: 'zh-CN', vidlink: 'zh' },
    'nl': { name: 'Nederlands', flag: '🇳🇱', tmdb: 'nl-NL', vidlink: 'nl' },
    'pl': { name: 'Polski', flag: '🇵🇱', tmdb: 'pl-PL', vidlink: 'pl' },
    'tr': { name: 'Türkçe', flag: '🇹🇷', tmdb: 'tr-TR', vidlink: 'tr' },
    'ar': { name: 'العربية', flag: '🇸🇦', tmdb: 'ar-SA', vidlink: 'ar' }
};

// LocalStorage keys
const STORAGE_KEYS = {
    CONTINUE_WATCHING: 'huset_continue_watching',
    WATCH_LATER: 'huset_watch_later',
    LIKED: 'huset_liked',
    LAST_WATCHED: 'huset_last_watched',
    LANGUAGE: 'huset_language',
    AUDIO_TYPE: 'huset_audio_type',
    VIDEO_PROVIDER: 'huset_video_provider'
};

document.addEventListener('DOMContentLoaded', () => {
    loadAll();
    loadPersonalizedRows();
    
    // Navbar scroll effect
    window.onscroll = () => {
        const nav = document.getElementById('navbar');
        window.scrollY > 50 ? nav.classList.add('scrolled') : nav.classList.remove('scrolled');
    };

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.getElementById('searchOverlay').classList.remove('active');
        }
    });

    // Simulate progress tracking every 30 seconds
    setInterval(trackProgress, 30000);
});

// --- LOCAL STORAGE FUNCTIONS ---

function getStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('LocalStorage error:', e);
        return [];
    }
}

function setStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('LocalStorage error:', e);
    }
}

function addToContinueWatching(movie, progress = 0, duration = 100) {
    const continueWatching = getStorage(STORAGE_KEYS.CONTINUE_WATCHING);
    const existingIndex = continueWatching.findIndex(m => m.id === movie.id);
    
    const movieData = {
        ...movie,
        progress: progress,
        duration: duration,
        lastWatched: new Date().toISOString(),
        type: movie.title ? 'movie' : 'tv'
    };

    if (existingIndex >= 0) {
        continueWatching[existingIndex] = movieData;
    } else {
        continueWatching.unshift(movieData);
    }

    // Keep only last 20 items
    if (continueWatching.length > 20) {
        continueWatching.pop();
    }

    setStorage(STORAGE_KEYS.CONTINUE_WATCHING, continueWatching);
    loadPersonalizedRows();
}

function addToWatchLater(movie) {
    const watchLater = getStorage(STORAGE_KEYS.WATCH_LATER);
    
    if (!watchLater.find(m => m.id === movie.id)) {
        watchLater.unshift({
            ...movie,
            addedAt: new Date().toISOString(),
            type: movie.title ? 'movie' : 'tv'
        });
        setStorage(STORAGE_KEYS.WATCH_LATER, watchLater);
        loadPersonalizedRows();
        showNotification('Tillagd i Titta Senare');
    } else {
        showNotification('Finns redan i Titta Senare');
    }
}

function removeFromWatchLater(id) {
    const watchLater = getStorage(STORAGE_KEYS.WATCH_LATER);
    const filtered = watchLater.filter(m => m.id !== id);
    setStorage(STORAGE_KEYS.WATCH_LATER, filtered);
    loadPersonalizedRows();
    showNotification('Borttagen från Titta Senare');
}

function removeFromContinueWatching(id) {
    const continueWatching = getStorage(STORAGE_KEYS.CONTINUE_WATCHING);
    const filtered = continueWatching.filter(m => m.id !== id);
    setStorage(STORAGE_KEYS.CONTINUE_WATCHING, filtered);
    loadPersonalizedRows();
}

function isInWatchLater(id) {
    const watchLater = getStorage(STORAGE_KEYS.WATCH_LATER);
    return watchLater.some(m => m.id === id);
}

// --- LANGUAGE & PROVIDER FUNCTIONS ---

function setLanguage(langCode) {
    if (LANGUAGES[langCode]) {
        currentLanguage = langCode;
        localStorage.setItem(STORAGE_KEYS.LANGUAGE, langCode);
        
        updatePageLanguage();
        loadAll();
        
        if (currentModalData && document.getElementById('modal').classList.contains('active')) {
            refreshPlayerLanguage();
        }
        
        showNotification(`Språk ändrat till ${LANGUAGES[langCode].name}`);
    }
}

function setAudioType(type) {
    if (type === 'sub' || type === 'dub') {
        currentAudioType = type;
        localStorage.setItem(STORAGE_KEYS.AUDIO_TYPE, type);
        
        document.querySelectorAll('.audio-type-btn[data-type]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        
        if (currentModalData && document.getElementById('modal').classList.contains('active')) {
            refreshPlayerLanguage();
        }
        
        showNotification(type === 'dub' ? 'Dubbat aktiverat' : 'Original med text aktiverat');
    }
}

function setVideoProvider(provider) {
    if (provider === 'vidlink' || provider === 'vidsrc') {
        currentVideoProvider = provider;
        localStorage.setItem(STORAGE_KEYS.VIDEO_PROVIDER, provider);
        
        document.querySelectorAll('.provider-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.provider === provider);
        });
        
        if (currentModalData && document.getElementById('modal').classList.contains('active')) {
            refreshPlayerLanguage();
        }
        
        showNotification(`Videokälla ändrad till ${provider === 'vidlink' ? 'VidLink' : 'VidSrc'}`);
    }
}

function updatePageLanguage() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLanguage);
    });
}

function refreshPlayerLanguage() {
    if (!currentModalData) return;
    
    const { id, type, currentSeason, currentEpisode } = currentModalData;
    const isAnime = currentModalData.data.isAnime || 
                    currentModalData.data.genres?.some(g => g.name === 'Animation');
    
    if (type === 'tv' && isAnime) {
        const malId = currentModalData.data.mal_id || id;
        playAnimeEpisode(malId, id, currentEpisode, currentAudioType);
    } else if (type === 'tv') {
        playEpisode(id, currentSeason, currentEpisode, false);
    } else {
        setupMoviePlayer(id);
    }
}

function getLanguageSelectorHTML() {
    const isAnime = currentModalData && (
        currentModalData.data.isAnime ||
        currentModalData.data.genres?.some(g => g.name === 'Animation')
    );
    
    let html = `
        <div class="language-selector" id="languageSelector" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
            
            <div class="lang-dropdown">
                <button class="lang-btn main-lang-btn" onclick="toggleLangDropdown()">
                    <span>${LANGUAGES[currentLanguage].flag}</span>
                    <span>${LANGUAGES[currentLanguage].name}</span>
                    <i class="ph ph-caret-down"></i>
                </button>
                <div class="lang-dropdown-menu" id="langDropdownMenu">
                    ${Object.entries(LANGUAGES).map(([code, data]) => `
                        <button class="lang-dropdown-item ${code === currentLanguage ? 'active' : ''}" 
                                onclick="setLanguage('${code}')">
                            <span>${data.flag}</span>
                            <span>${data.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="audio-type-selector">
                <button class="audio-type-btn provider-btn ${currentVideoProvider === 'vidlink' ? 'active' : ''}" 
                        data-provider="vidlink" onclick="setVideoProvider('vidlink')">
                    <i class="ph ph-plugs"></i>
                    <span>VidLink</span>
                </button>
                <button class="audio-type-btn provider-btn ${currentVideoProvider === 'vidsrc' ? 'active' : ''}" 
                        data-provider="vidsrc" onclick="setVideoProvider('vidsrc')">
                    <i class="ph ph-plugs-connected"></i>
                    <span>VidSrc</span>
                </button>
            </div>
            
            ${isAnime ? `
                <div class="audio-type-selector">
                    <button class="audio-type-btn ${currentAudioType === 'sub' ? 'active' : ''}" 
                            data-type="sub" onclick="setAudioType('sub')">
                        <i class="ph ph-subtitles"></i>
                        <span>Sub</span>
                    </button>
                    <button class="audio-type-btn ${currentAudioType === 'dub' ? 'active' : ''}" 
                            data-type="dub" onclick="setAudioType('dub')">
                        <i class="ph ph-speaker-high"></i>
                        <span>Dub</span>
                    </button>
                </div>
            ` : ''}
        </div>
    `;
    return html;
}

function toggleLangDropdown() {
    const menu = document.getElementById('langDropdownMenu');
    menu.classList.toggle('show');
}

document.addEventListener('click', (e) => {
    const dropdown = document.querySelector('.lang-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        const menu = document.getElementById('langDropdownMenu');
        if (menu) menu.classList.remove('show');
    }
});

// --- UI FUNCTIONS ---

function loadPersonalizedRows() {
    const continueWatching = getStorage(STORAGE_KEYS.CONTINUE_WATCHING);
    const watchLater = getStorage(STORAGE_KEYS.WATCH_LATER);

    const continueRow = document.getElementById('continue');
    const continueSlider = document.getElementById('slider-continue');
    
    if (continueWatching.length > 0) {
        continueRow.style.display = 'block';
        continueSlider.innerHTML = continueWatching.map(m => createContinueCard(m)).join('');
        setTimeout(() => updateArrowVisibility('continue'), 100);
    } else {
        continueRow.style.display = 'none';
    }

    const watchLaterRow = document.getElementById('watchlater');
    const watchLaterSlider = document.getElementById('slider-watchlater');
    
    if (watchLater.length > 0) {
        watchLaterRow.style.display = 'block';
        watchLaterSlider.innerHTML = watchLater.map(m => createCard(m, true)).join('');
        setTimeout(() => updateArrowVisibility('watchlater'), 100);
    } else {
        watchLaterRow.style.display = 'none';
    }
}

function createContinueCard(m) {
    const title = m.title || m.name;
    const year = (m.release_date || m.first_air_date || '').split('-')[0] || '2024';
    const rating = Math.round(m.vote_average * 10);
    const progressPercent = Math.round((m.progress / m.duration) * 100) || 0;
    
    return `
        <div class="movie-card" onclick="openModal(${m.id}, '${m.type}')">
            
            <div class="card-image-wrapper">
                <img src="${IMG + m.backdrop_path}" alt="${title}" loading="lazy">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                </div>
            </div>
            
            <div class="card-info">
                <div class="card-title">${title}</div>
                <div class="card-meta">
                    <span class="card-rating">
                        <i class="ph-fill ph-star"></i>
                        ${rating}%
                    </span>
                    <span class="card-year">${year}</span>
                    <span style="color: var(--text-muted);">${progressPercent}% klar</span>
                </div>
            </div>
            
            <div class="card-expanded">
                <div class="card-title" style="font-size: 15px; margin-bottom: 10px; color: var(--text); white-space: normal; font-weight: 600;">${title}</div>
                <div class="card-meta" style="margin-bottom: 12px;">
                    <span class="card-year" style="color: var(--text-muted);">${year}</span>
                </div>
                <div class="card-actions">
                    <button class="card-btn play" onclick="event.stopPropagation(); openModal(${m.id}, '${m.type}')">
                        <i class="ph-fill ph-play"></i>
                        <span>Fortsätt</span>
                    </button>
                    <button class="card-btn" onclick="event.stopPropagation(); removeFromContinueWatching(${m.id})" title="Ta bort från fortsätt titta">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createCard(m, isWatchLater = false) {
    const title = m.title || m.name;
    const year = (m.release_date || m.first_air_date || '').split('-')[0] || '2024';
    const rating = Math.round(m.vote_average * 10);
    const type = m.type || (m.title ? 'movie' : 'tv');
    const inWatchLater = isWatchLater || isInWatchLater(m.id);
    
    return `
        <div class="movie-card" onclick="openModal(${m.id}, '${type}')">
            <img src="${IMG + m.backdrop_path}" alt="${title}" loading="lazy">
            
            <div class="card-info">
                <div class="card-title">${title}</div>
                <div class="card-meta">
                    <span class="card-rating">
                        <i class="ph-fill ph-star"></i>
                        ${rating}%
                    </span>
                    <span class="card-year">${year}</span>
                    ${type === 'tv' ? '<span class="card-badge">TV</span>' : ''}
                </div>
            </div>
            
            <div class="card-expanded">
                <div class="card-title" style="font-size: 15px; margin-bottom: 10px; color: var(--text); white-space: normal; font-weight: 600;">${title}</div>
                <div class="card-meta" style="margin-bottom: 12px;">
                    <span class="card-year" style="color: var(--text-muted);">${year}</span>
                    <span class="card-badge">${type === 'movie' ? 'Film' : 'TV'}</span>
                </div>
                <div class="card-actions">
                    <button class="card-btn play" onclick="event.stopPropagation(); openModal(${m.id}, '${type}')">
                        <i class="ph-fill ph-play"></i>
                        <span>Spela</span>
                    </button>
                    <button class="card-btn ${inWatchLater ? 'active' : ''}" onclick="event.stopPropagation(); toggleWatchLater(${m.id}, '${type}')" title="${inWatchLater ? 'Ta bort från' : 'Lägg till i'} Titta Senare">
                        <i class="ph ${inWatchLater ? 'ph-fill ph-check' : 'ph-plus'}"></i>
                    </button>
                    <button class="card-btn" onclick="event.stopPropagation(); likeTitle(${m.id})" title="Gilla">
                        <i class="ph ph-thumbs-up"></i>
                    </button>
                    <button class="card-btn" onclick="event.stopPropagation(); showInfo(${m.id}, '${type}')" title="Mer info">
                        <i class="ph ph-info"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function toggleWatchLater(id, type) {
    if (isInWatchLater(id)) {
        removeFromWatchLater(id);
    } else {
        const langCode = LANGUAGES[currentLanguage].tmdb;
        fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&language=${langCode}`)
            .then(res => res.json())
            .then(m => {
                addToWatchLater({...m, type});
            });
    }
}

function showNotification(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 9999;
        border: 1px solid var(--border);
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function trackProgress() {
    if (currentModalData && document.getElementById('modal').classList.contains('active')) {
        const current = getStorage(STORAGE_KEYS.CONTINUE_WATCHING);
        const existing = current.find(m => m.id === currentModalData.id);
        const progress = existing ? existing.progress + 5 : 5;
        
        addToContinueWatching(currentModalData.data, progress, 100);
    }
}

// --- NAVIGATION FUNCTIONS ---

function scrollToSection(id) {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollSlider(rowId, direction) {
    const slider = document.getElementById(`slider-${rowId}`);
    if (!slider) return;
    
    const cardWidth = slider.querySelector('.movie-card')?.offsetWidth || 200;
    const gap = 8;
    const scrollAmount = (cardWidth + gap) * 4;
    
    slider.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });

    setTimeout(() => updateArrowVisibility(rowId), 400);
}

function updateArrowVisibility(rowId) {
    const slider = document.getElementById(`slider-${rowId}`);
    const leftArrow = slider?.parentElement?.querySelector('.slider-arrow.left');
    const rightArrow = slider?.parentElement?.querySelector('.slider-arrow.right');
    
    if (!slider || !leftArrow || !rightArrow) return;

    if (slider.scrollLeft <= 10) {
        leftArrow.classList.add('hidden');
    } else {
        leftArrow.classList.remove('hidden');
    }

    const maxScroll = slider.scrollWidth - slider.clientWidth;
    if (slider.scrollLeft >= maxScroll - 10) {
        rightArrow.classList.add('hidden');
    } else {
        rightArrow.classList.remove('hidden');
    }
}

// --- DATA LOADING FUNCTIONS ---

async function loadAll() {
    try {
        const langCode = LANGUAGES[currentLanguage].tmdb;
        
        const lastWatched = getStorage(STORAGE_KEYS.LAST_WATCHED);
        let heroMovie = null;
        
        if (lastWatched && lastWatched.length > 0) {
            const lastItem = lastWatched[0];
            try {
                const heroRes = await fetch(`${BASE_URL}/${lastItem.type}/${lastItem.id}?api_key=${API_KEY}&language=${langCode}`);
                if (heroRes.ok) {
                    heroMovie = await heroRes.json();
                }
            } catch (e) {
                console.log('Could not load last watched as hero');
            }
        }
        
        if (!heroMovie) {
            const heroRes = await fetch(`${BASE_URL}/trending/movie/day?api_key=${API_KEY}&language=${langCode}`);
            const heroData_raw = await heroRes.json();
            heroMovie = heroData_raw.results[0];
        }
        
        heroData = heroMovie;
        
        document.getElementById('heroImage').src = IMG_ORIGINAL + heroData.backdrop_path;
        document.getElementById('heroTitle').textContent = heroData.title || heroData.name;
        document.getElementById('heroOverview').textContent = heroData.overview;
        document.getElementById('heroRating').innerHTML = `
            <i class="ph-fill ph-star"></i>
            <span>${Math.round(heroData.vote_average * 10)}% match</span>
        `;
        document.getElementById('heroYear').textContent = (heroData.release_date || heroData.first_air_date || '').split('-')[0] || '2024';
        
        const continueWatching = getStorage(STORAGE_KEYS.CONTINUE_WATCHING);
        const isContinue = continueWatching.find(m => m.id === heroData.id);
        if (isContinue) {
            document.getElementById('heroGenre').textContent = 'Fortsätt titta';
        } else {
            document.getElementById('heroGenre').textContent = heroData.genres?.map(g => g.name).slice(0, 2).join(', ') || 'Trending';
        }

        await Promise.all([
            fetchRow('/trending/all/week', 'slider-trending'),
            fetchRow('/discover/movie?with_genres=28&sort_by=popularity.desc', 'slider-action'),
            fetchRow('/movie/top_rated', 'slider-toprated'),
            fetchRow('/discover/tv?with_genres=16&sort_by=popularity.desc', 'slider-anime'),
            fetchRow('/discover/movie?with_genres=35&sort_by=popularity.desc', 'slider-comedy'),
            fetchRow('/discover/movie?with_genres=878&sort_by=popularity.desc', 'slider-scifi'),
            fetchRow('/discover/movie?with_genres=27&sort_by=popularity.desc', 'slider-horror'),
            fetchRow('/discover/movie?with_genres=99&sort_by=popularity.desc', 'slider-doc')
        ]);

        ['trending', 'action', 'toprated', 'anime', 'comedy', 'scifi', 'horror', 'doc'].forEach(id => {
            updateArrowVisibility(id);
            const slider = document.getElementById(`slider-${id}`);
            if (slider) {
                slider.addEventListener('scroll', () => updateArrowVisibility(id));
            }
        });

    } catch (error) {
        console.error('Error loading content:', error);
    }
}

async function fetchRow(path, elementId) {
    try {
        const langCode = LANGUAGES[currentLanguage].tmdb;
        const res = await fetch(`${BASE_URL}${path}${path.includes('?') ? '&' : '?'}api_key=${API_KEY}&language=${langCode}`);
        const data = await res.json();
        
        const container = document.getElementById(elementId);
        if (!container) return;

        container.innerHTML = data.results.slice(0, 20).map(m => createCard(m)).join('');
    } catch (error) {
        console.error(`Error loading ${elementId}:`, error);
    }
}

// --- MODAL & PLAYER FUNCTIONS ---

// Gemensam URL-generator för båda tjänsterna
// Gemensam URL-generator för båda tjänsterna
function getEmbedUrl(tmdbId, type, season = 1, episode = 1, isAnime = false) {
    const isDub = (currentAudioType === 'dub');
    
    if (currentVideoProvider === 'vidlink') {
        let url = type === 'movie' 
            ? `https://vidlink.pro/movie/${tmdbId}`
            : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`;
            
        // Ändrat från autoplay=false till autoplay=true här!
        url += `?primaryColor=e50914&autoplay=true`;
        
        // VidLink flagga för Anime Dub
        if (isAnime && isDub) {
            url += `&isDub=true`;
        }
        return url;
        
    } else {
        const domain = typeof VIDSRC_DOMAIN !== 'undefined' ? VIDSRC_DOMAIN : 'https://vsrc.su';
        let url = type === 'movie'
            ? `${domain}/embed/movie/${tmdbId}`
            : `${domain}/embed/tv/${tmdbId}/${season}/${episode}`;
            
        // VidSrc använder ofta ?autoPlay=true eller motsvarande. Vi lägger till ett ? eller & beroende på om ds=1 redan finns.
        if (isAnime && isDub) {
             url += `?ds=1&autoplay=1`; 
        } else {
             url += `?autoplay=1`;
        }
        return url;
    }
}

// Ny hjälpfunktion för att bygga en krasch-säker iframe för Firefox OCH blockera pop-ups (sandbox)
function getPlayerHTML(streamUrl) {
    return `
        ${getLanguageSelectorHTML()}
        <iframe 
            src="${streamUrl}" 
            width="100%" 
            height="100%" 
            frameborder="0" 
            scrolling="no"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write" 
            allowfullscreen>
        </iframe>
    `;
}

async function openModal(id, type, season = 1, episode = 1) {
    try {
        const modal = document.getElementById('modal');
        const langCode = LANGUAGES[currentLanguage].tmdb;
        const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&language=${langCode}`);
        const m = await res.json();
        
        const isAnime = m.genres?.some(g => g.name === 'Animation') || 
                       m.origin_country?.includes('JP') ||
                       m.original_language === 'ja';
        
        m.isAnime = isAnime;
        
        if (isAnime && type === 'tv') {
            try {
                const malRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(m.name || m.title)}&limit=1`);
                const malData = await malRes.json();
                if (malData.data && malData.data.length > 0) {
                    m.mal_id = malData.data[0].mal_id;
                }
            } catch (e) {
                console.log('Could not fetch MAL ID, using TMDB ID');
            }
        }
        
        currentModalData = { id, type, data: m, currentSeason: season, currentEpisode: episode };
        
        const lastWatched = getStorage(STORAGE_KEYS.LAST_WATCHED);
        const existingIndex = lastWatched.findIndex(item => item.id === id);
        const watchData = { id, type, watchedAt: new Date().toISOString() };
        
        if (existingIndex >= 0) {
            lastWatched.splice(existingIndex, 1);
        }
        lastWatched.unshift(watchData);
        if (lastWatched.length > 10) lastWatched.pop();
        setStorage(STORAGE_KEYS.LAST_WATCHED, lastWatched);
        
        addToContinueWatching(m, 0, 100);
        
        document.getElementById('modalTitle').textContent = m.title || m.name;
        document.getElementById('modalOverview').textContent = m.overview;
        document.getElementById('modalPoster').src = IMG + m.poster_path;
        
        const rating = Math.round(m.vote_average * 10);
        document.getElementById('modalRating').innerHTML = `
            <i class="ph-fill ph-star"></i>
            <span>${rating}% match</span>
        `;
        
        document.getElementById('modalYear').textContent = (m.release_date || m.first_air_date || '').split('-')[0] || '2024';
        document.getElementById('modalGenre').textContent = m.genres?.map(g => g.name).slice(0, 2).join(', ') || 'Genre';
        
        if (type === 'tv') {
            await setupTVPlayer(id, m, season, episode);
        } else {
            setupMoviePlayer(id);
        }
        
        const recRes = await fetch(`${BASE_URL}/${type}/${id}/recommendations?api_key=${API_KEY}&language=${langCode}`);
        const recData = await recRes.json();
        
        const recContainer = document.getElementById('recommendations');
        recContainer.innerHTML = recData.results.slice(0, 15).map(m => createCard(m)).join('');
        
        setTimeout(() => {
            updateArrowVisibility('recommendations');
            recContainer.addEventListener('scroll', () => updateArrowVisibility('recommendations'));
        }, 100);

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error opening modal:', error);
    }
}

function setupMoviePlayer(id) {
    const videoContainer = document.getElementById('videoContainer');
    let streamUrl = getEmbedUrl(id, 'movie');
    
    // Använder den nya iframe-funktionen med adblock/sandbox och firefox-behörigheter
    videoContainer.innerHTML = getPlayerHTML(streamUrl);
    
    document.getElementById('episodeSidebar').style.display = 'none';
    document.getElementById('mobileSidebarBtn').style.display = 'none';
    document.getElementById('sidebarTitle').textContent = 'Filmer';
}

async function setupTVPlayer(id, showData, currentSeason, currentEpisode) {
    const sidebar = document.getElementById('episodeSidebar');
    const mobileBtn = document.getElementById('mobileSidebarBtn');
    const seasonSelector = document.getElementById('seasonSelector');
    const videoContainer = document.getElementById('videoContainer');
    
    sidebar.style.display = 'flex';
    mobileBtn.style.display = 'flex';
    document.getElementById('sidebarTitle').textContent = 'Avsnitt';
    
    const isAnime = showData.isAnime || showData.genres?.some(g => g.name === 'Animation');
    let streamUrl = getEmbedUrl(id, 'tv', currentSeason, currentEpisode, isAnime);

    // Använder den nya iframe-funktionen med adblock/sandbox och firefox-behörigheter
    videoContainer.innerHTML = getPlayerHTML(streamUrl);
    
    if (currentVideoProvider === 'vidsrc' || (!isAnime && currentVideoProvider === 'vidlink')) {
        const seasons = showData.seasons?.filter(s => s.season_number > 0) || [];
        if (seasons.length > 1) {
            seasonSelector.style.display = 'block';
            const seasonSelect = document.getElementById('seasonSelect');
            seasonSelect.innerHTML = seasons.map(s => 
                `<option value="${s.season_number}" ${s.season_number == currentSeason ? 'selected' : ''}>Säsong ${s.season_number}</option>`
            ).join('');
        } else {
            seasonSelector.style.display = 'none';
        }
    } else {
        seasonSelector.style.display = 'none';
    }
    
    await loadEpisodes(id, currentSeason, currentEpisode, isAnime, showData.mal_id);
}

async function loadEpisodes(showId, seasonNum, currentEpisode, isAnime = false, malId = null) {
    try {
        const langCode = LANGUAGES[currentLanguage].tmdb;
        const episodesList = document.getElementById('episodesList');
        
        const useAnimeFormat = isAnime && currentVideoProvider === 'vidlink';

        if (useAnimeFormat) {
            const res = await fetch(`${BASE_URL}/tv/${showId}?api_key=${API_KEY}&language=${langCode}`);
            const showData = await res.json();
            const episodeCount = showData.number_of_episodes || 12;
            
            episodesList.innerHTML = Array.from({length: Math.min(episodeCount, 50)}, (_, i) => i + 1).map(epNum => `
                <div class="episode-item ${epNum == currentEpisode ? 'active' : ''}" 
                     onclick="playAnimeEpisode(${malId || showId}, ${showId}, ${epNum}, '${currentAudioType}')">
                    <div class="episode-number">${epNum}</div>
                    <div class="episode-info">
                        <div class="episode-title">Avsnitt ${epNum}</div>
                        <div class="episode-duration">24 min</div>
                    </div>
                </div>
            `).join('');
        } else {
            const res = await fetch(`${BASE_URL}/tv/${showId}/season/${seasonNum}?api_key=${API_KEY}&language=${langCode}`);
            const seasonData = await res.json();
            
            const episodes = seasonData.episodes || [];
            
            episodesList.innerHTML = episodes.map(ep => `
                <div class="episode-item ${ep.episode_number == currentEpisode ? 'active' : ''}" 
                     onclick="playEpisode(${showId}, ${seasonNum}, ${ep.episode_number}, false)">
                    <div class="episode-number">${ep.episode_number}</div>
                    <div class="episode-info">
                        <div class="episode-title">${ep.name}</div>
                        <div class="episode-duration">${ep.runtime || '45'} min</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading episodes:', error);
    }
}

function playEpisode(showId, seasonNum, episodeNum, isAnime = false) {
    currentModalData.currentSeason = seasonNum;
    currentModalData.currentEpisode = episodeNum;
    
    document.querySelectorAll('.episode-item').forEach((item, index) => {
        item.classList.toggle('active', index + 1 === episodeNum);
    });
    
    let streamUrl = getEmbedUrl(showId, 'tv', seasonNum, episodeNum, isAnime);
    const videoContainer = document.getElementById('videoContainer');
    
    // Använder den nya iframe-funktionen
    videoContainer.innerHTML = getPlayerHTML(streamUrl);
}

function playAnimeEpisode(malId, tmdbId, episodeNum, audioType) {
    currentModalData.currentEpisode = episodeNum;
    
    document.querySelectorAll('.episode-item').forEach((item, index) => {
        item.classList.toggle('active', index + 1 === episodeNum);
    });
    
    const season = currentModalData?.currentSeason || 1;
    let streamUrl = getEmbedUrl(tmdbId, 'tv', season, episodeNum, true);
    const videoContainer = document.getElementById('videoContainer');
    
    // Använder den nya iframe-funktionen
    videoContainer.innerHTML = getPlayerHTML(streamUrl);
}

async function changeSeason(seasonNum) {
    if (!currentModalData) return;
    const { id } = currentModalData;
    await loadEpisodes(id, seasonNum, 1, false);
    playEpisode(id, seasonNum, 1, false);
}

function toggleSidebar() {
    const sidebar = document.getElementById('episodeSidebar');
    sidebar.classList.toggle('open');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
    document.getElementById('videoContainer').innerHTML = '';
    document.body.style.overflow = '';
}

// --- SEARCH FUNCTIONS ---

function toggleSearch() {
    const overlay = document.getElementById('searchOverlay');
    overlay.classList.toggle('active');
    if (overlay.classList.contains('active')) {
        document.getElementById('searchInput').focus();
    }
}

let searchTimeout;
async function doSearch(q) {
    clearTimeout(searchTimeout);
    if (q.length < 2) {
        document.getElementById('searchResults').innerHTML = '';
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        try {
            const langCode = LANGUAGES[currentLanguage].tmdb;
            const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(q)}&language=${langCode}`);
            const data = await res.json();
            
            const results = data.results
                .filter(m => m.backdrop_path && (m.title || m.name))
                .slice(0, 20);
            
            document.getElementById('searchResults').innerHTML = results.map(m => createCard(m)).join('');
        } catch (error) {
            console.error('Search error:', error);
        }
    }, 300);
}

// --- UTILITY FUNCTIONS ---

function randomPick() {
    const rows = ['trending', 'action', 'toprated', 'anime'];
    const randomRow = rows[Math.floor(Math.random() * rows.length)];
    const slider = document.getElementById(`slider-${randomRow}`);
    const cards = slider?.getElementsByClassName('movie-card');
    
    if (cards && cards.length > 0) {
        const randomCard = cards[Math.floor(Math.random() * cards.length)];
        randomCard.click();
    }
}

function openHero() {
    if (heroData) {
        const type = heroData.title ? 'movie' : 'tv';
        openModal(heroData.id, type);
    }
}

function openHeroInfo() {
    if (heroData) {
        const type = heroData.title ? 'movie' : 'tv';
        openModal(heroData.id, type);
    }
}

function playCurrent() {
    if (currentModalData) {
        const { id, type } = currentModalData;
        if (type === 'tv') {
            const { currentSeason, currentEpisode } = currentModalData;
            const isAnime = currentModalData.data.isAnime;
            if (isAnime && currentModalData.data.mal_id) {
                playAnimeEpisode(currentModalData.data.mal_id, id, currentEpisode, currentAudioType);
            } else {
                playEpisode(id, currentSeason, currentEpisode, isAnime);
            }
        } else {
            setupMoviePlayer(id);
        }
    }
}

function addToCurrentList() {
    if (currentModalData) {
        const { data } = currentModalData;
        addToWatchLater(data);
    }
}

function likeCurrent() {
    if (currentModalData) {
        likeTitle(currentModalData.id);
    }
}

function likeTitle(id) {
    console.log('Liked:', id);
    showNotification('Gillad!');
}

async function showInfo(id, type) {
    await openModal(id, type);
}