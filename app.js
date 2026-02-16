// Nagoya Station Parking Map Application - Modern Redesign

let map;
let markers = {};
let parkingData = [];
let currentSort = 'default';
let selectedParkingId = null;
let isMobile = window.innerWidth < 768;

// DOM Elements
const elements = {
    listContainer: document.getElementById('parkingList'),
    mobileListContainer: document.getElementById('mobileListContent'),
    countDisplay: document.getElementById('parkingCount'),
    sortButtons: document.querySelectorAll('.sort-btn'),
    mobileSheet: document.getElementById('mobileSheet'),
    sheetHandle: document.getElementById('sheetHandle')
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadParkingData();
    initializeMap();
    renderLists();
    setupEventListeners();
    setupMobileSheet();
});

// Load Data
async function loadParkingData() {
    try {
        const response = await fetch('parking_data.json');
        parkingData = await response.json();
    } catch (error) {
        console.error('Failed to load parking data:', error);
    }
}

// Initialize Leaflet
function initializeMap() {
    // Nagoya Station Coordinates
    const nagoyaStation = [35.1706, 136.8817];

    // Custom Map Style (Light/Clean)
    map = L.map('map', {
        zoomControl: false, // Move zoom control
        attributionControl: false
    }).setView(nagoyaStation, 16);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // 500m Radius
    L.circle(nagoyaStation, {
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.05,
        radius: 500,
        weight: 1,
        dashArray: '4, 8'
    }).addTo(map);

    addMarkers();
}

// Add Markers
function addMarkers() {
    // Clear existing
    Object.values(markers).forEach(m => m.remove());
    markers = {};

    parkingData.forEach(parking => {
        const price = getBestPrice(parking);
        const iconHtml = `<div class="modern-marker ${price < 300 ? 'cheap' : ''}" id="marker-${parking.id}">
            ¥${price.toLocaleString()}
        </div>`;

        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: iconHtml,
            iconSize: [null, null],
            iconAnchor: [30, 42]
        });

        const marker = L.marker(parking.coords, { icon: icon }).addTo(map);

        marker.on('click', () => {
            selectParking(parking.id);
            if (isMobile) openMobileSheet();
        });

        markers[parking.id] = marker;
    });
}

function getBestPrice(parking) {
    if (parking.price.hourly) return parking.price.hourly;
    if (parking.price.max_day) return Math.round(parking.price.max_day / 24); // Approximation for display
    return 0;
}

// Render Lists (Both Desktop & Mobile)
function renderLists() {
    const sortedData = getSortedData();
    const count = sortedData.length;

    // Update count
    elements.countDisplay.textContent = `${count}件`;

    // Clear lists
    elements.listContainer.innerHTML = '';
    elements.mobileListContainer.innerHTML = '';

    sortedData.forEach((parking, index) => {
        const cardHtml = createCardHtml(parking);

        // Desktop List
        const desktopDiv = document.createElement('div');
        desktopDiv.className = `parking-card animate-entry delay-${Math.min(index, 3)}`;
        desktopDiv.innerHTML = cardHtml;
        desktopDiv.dataset.id = parking.id;
        desktopDiv.onclick = () => selectParking(parking.id);
        elements.listContainer.appendChild(desktopDiv);

        // Mobile List
        const mobileDiv = document.createElement('div');
        mobileDiv.className = `parking-card animate-entry delay-${Math.min(index, 3)}`;
        mobileDiv.innerHTML = cardHtml;
        mobileDiv.dataset.id = parking.id;
        mobileDiv.onclick = () => {
            selectParking(parking.id);
            // On mobile, just select, don't close sheet
        };
        elements.mobileListContainer.appendChild(mobileDiv);
    });
}

function createCardHtml(parking) {
    return `
        <div class="flex justify-between items-start mb-2">
            <h3 class="font-bold text-gray-800 text-sm leading-snug flex-1">${parking.name}</h3>
            <span class="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded ml-2 whitespace-nowrap">
                ${parking.distance}
            </span>
        </div>
        <div class="flex items-center gap-3 mb-2">
            <div class="flex flex-col">
                <span class="text-[10px] text-gray-500 font-medium">時間料金</span>
                <span class="text-sm font-bold text-gray-900">${parking.price.hourly ? '¥' + parking.price.hourly : '-'}</span>
            </div>
            <div class="w-px h-6 bg-gray-100"></div>
            <div class="flex flex-col">
                <span class="text-[10px] text-gray-500 font-medium">最大料金</span>
                <span class="text-sm font-bold text-gray-900">${parking.price.max_day ? '¥' + parking.price.max_day.toLocaleString() : '-'}</span>
            </div>
        </div>
        ${parking.note ? `<p class="text-xs text-gray-500 bg-gray-50 p-2 rounded flex items-start gap-1">
            <span class="text-blue-500">ℹ</span> ${parking.note}
        </p>` : ''}
    `;
}

// Data Sorting
function getSortedData() {
    const data = [...parkingData];
    switch (currentSort) {
        case 'hourly': return data.sort((a, b) => (a.price.hourly || 9999) - (b.price.hourly || 9999));
        case 'daily': return data.sort((a, b) => (a.price.max_day || 99999) - (b.price.max_day || 99999));
        case 'distance': return data.sort((a, b) => parseInt(a.distance) - parseInt(b.distance));
        default: return data;
    }
}

// Selection Logic
function selectParking(id) {
    selectedParkingId = id;
    const parking = parkingData.find(p => p.id === id);

    // Pan Map
    if (parking) {
        map.setView(parking.coords, 18, { animate: true, duration: 0.8 });
    }

    // Update UI Classes
    document.querySelectorAll('.parking-card').forEach(card => {
        if (parseInt(card.dataset.id) === id) {
            card.classList.add('selected');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            card.classList.remove('selected');
        }
    });

    // Update Markers
    Object.values(markers).forEach(marker => {
        const el = marker.getElement().querySelector('.modern-marker');
        if (el) el.classList.remove('active');
    });
    const selectedMarker = markers[id];
    if (selectedMarker) {
        const el = selectedMarker.getElement().querySelector('.modern-marker');
        if (el) el.classList.add('active');
    }
}

// Mobile Bottom Sheet Logic
function setupMobileSheet() {
    let startY = 0;
    let currentY = 0;
    const sheet = elements.mobileSheet;

    elements.sheetHandle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        sheet.style.transition = 'none';
    });

    elements.sheetHandle.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 0) {
            sheet.style.transform = `translateY(${diff}px)`;
        }
    });

    elements.sheetHandle.addEventListener('touchend', () => {
        sheet.style.transition = 'transform 0.3s ease-out';
        if (currentY - startY > 100) {
            closeMobileSheet();
        } else {
            openMobileSheet();
        }
    });
}

function openMobileSheet() {
    elements.mobileSheet.classList.remove('translate-y-[calc(100%-80px)]');
    elements.mobileSheet.classList.add('translate-y-0');
}

function closeMobileSheet() {
    elements.mobileSheet.classList.add('translate-y-[calc(100%-80px)]');
    elements.mobileSheet.classList.remove('translate-y-0');
}

// Events
function setupEventListeners() {
    elements.sortButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.sortButtons.forEach(b => b.classList.remove('active', 'bg-blue-600', 'text-white'));
            elements.sortButtons.forEach(b => b.classList.add('text-gray-500', 'hover:bg-gray-100'));

            btn.classList.add('active', 'bg-blue-600', 'text-white');
            btn.classList.remove('text-gray-500', 'hover:bg-gray-100');

            currentSort = btn.dataset.sort;
            renderLists();
            initializeMap(); // Re-render markers with new sort order if needed (or just addMarkers)
        });
    });

    document.getElementById('updateInfoBtn').addEventListener('click', () => {
        const url = `https://github.com/mkt918/nagoya-parking-map/issues/new?title=情報修正の提案`;
        window.open(url, '_blank');
    });
}

