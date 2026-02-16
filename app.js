// Nagoya Station Parking Map Application - Advanced Pricing Logic

let map;
let markers = {};
let parkingData = [];
let currentSort = 'hourly';
let selectedParkingId = null;
let isMobile = window.innerWidth < 768;
let showWeekend = false; // Toggle state for Weekday/Weekend

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
    // Inject Sort & Day Type Controls into Header
    injectControls();

    await loadParkingData();
    initializeMap();
    renderLists();
    setupEventListeners();
    setupMobileSheet();
});

function injectControls() {
    // Add Weekday/Weekend toggle into the floating header if not present
    // Simple implementation: re-render the controls area or append to it
    const controlsContainer = document.querySelector('.bg-white\\/90.rounded-full.flex');
    if (controlsContainer) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'ml-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200';
        toggleBtn.id = 'dayToggle';
        toggleBtn.innerHTML = '平日表示';
        toggleBtn.onclick = toggleDayType;
        controlsContainer.parentElement.appendChild(toggleBtn);
    }
}

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
    const nagoyaStation = [35.1706, 136.8817];

    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView(nagoyaStation, 16);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

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

// Pricing Helper
function getPriceData(parking) {
    const type = showWeekend ? 'weekend' : 'weekday';
    return parking.price_structure[type];
}

// 1 Hour Equivalent Calculation
function calculateHourlyRate(parking) {
    const data = getPriceData(parking);
    // Prefer Day time rate for sorting
    const dayRate = data.day;
    if (!dayRate || dayRate.price === 0) return 99999; // Unknown/free handling

    if (dayRate.unit_minutes === 60) return dayRate.price;

    // Calculate 60 min equivalent
    // e.g., 200yen / 30min -> 400yen
    return Math.round((dayRate.price / dayRate.unit_minutes) * 60);
}

// Add Markers
function addMarkers() {
    Object.values(markers).forEach(m => m.remove());
    markers = {};

    parkingData.forEach(parking => {
        const hourlyRate = calculateHourlyRate(parking);

        let markerClass = 'modern-marker';
        if (hourlyRate <= 300) markerClass += ' cheap';
        if (hourlyRate >= 1000) markerClass += ' expensive'; // expensive styling if needed

        const iconHtml = `<div class="${markerClass}" id="marker-${parking.id}">
            ¥${hourlyRate.toLocaleString()}<span style="font-size:10px; font-weight:400; margin-left:1px">/h</span>
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

// Render Lists
function renderLists() {
    const sortedData = getSortedData();
    elements.countDisplay.textContent = `${sortedData.length}件`;

    elements.listContainer.innerHTML = '';
    elements.mobileListContainer.innerHTML = '';

    sortedData.forEach((parking, index) => {
        const cardHtml = createCardHtml(parking);

        // Desktop
        const desktopDiv = document.createElement('div');
        desktopDiv.className = `parking-card animate-entry delay-${Math.min(index, 3)}`;
        desktopDiv.innerHTML = cardHtml;
        desktopDiv.dataset.id = parking.id;
        desktopDiv.onclick = (e) => {
            // Prevent triggering select if clicking detailed table
            if (e.target.closest('.price-table')) return;
            selectParking(parking.id);
        };
        elements.listContainer.appendChild(desktopDiv);

        // Mobile
        const mobileDiv = document.createElement('div');
        mobileDiv.className = `parking-card animate-entry delay-${Math.min(index, 3)}`;
        mobileDiv.innerHTML = cardHtml;
        mobileDiv.dataset.id = parking.id;
        mobileDiv.onclick = () => selectParking(parking.id);
        elements.mobileListContainer.appendChild(mobileDiv);
    });

    updateDayToggleBtn();
}

function createCardHtml(parking) {
    const data = getPriceData(parking);
    const hourlyRate = calculateHourlyRate(parking);
    const day = data.day;
    const night = data.night;

    return `
        <div class="flex justify-between items-start mb-2">
            <h3 class="font-bold text-gray-800 text-sm leading-snug flex-1">${parking.name}</h3>
            <span class="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded ml-2 whitespace-nowrap">
                ${parking.distance}
            </span>
        </div>

        <!-- Primary Info: Calculated Hour Rate & Max -->
        <div class="flex items-center gap-3 mb-3 bg-gray-50 rounded-lg p-2">
            <div class="flex flex-col flex-1">
                <span class="text-[10px] text-gray-500 font-medium">1時間換算</span>
                <div class="flex items-baseline gap-1">
                    <span class="text-lg font-extrabold text-blue-600">¥${hourlyRate.toLocaleString()}</span>
                    <span class="text-xs text-gray-400">/h</span>
                </div>
            </div>
            <div class="w-px h-8 bg-gray-200"></div>
            <div class="flex flex-col flex-1 pl-2">
                <span class="text-[10px] text-gray-500 font-medium">最大料金</span>
                <span class="text-sm font-bold text-gray-900">${data.max ? '¥' + data.max.toLocaleString() : '-'}</span>
            </div>
        </div>

        <!-- Price Details Table -->
        <div class="price-table text-xs border-t border-gray-100 pt-2">
             <div class="grid grid-cols-3 gap-2 py-1 items-center">
                <div class="text-gray-500 font-medium bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded inline-block w-fit">☀️ 昼間</div>
                <div class="col-span-2 font-medium text-gray-700 text-right">
                    ${day ? `${day.start}-${day.end} <br> <span class="font-bold">${day.unit_minutes}分 ${day.price}円</span>` : '-'}
                </div>
            </div>
             <div class="grid grid-cols-3 gap-2 py-1 items-center border-t border-gray-50 border-dashed">
                <div class="text-gray-500 font-medium bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded inline-block w-fit">🌙 夜間</div>
                <div class="col-span-2 font-medium text-gray-700 text-right">
                    ${night ? `${night.start}-${night.end} <br> <span class="font-bold">${night.unit_minutes}分 ${night.price}円</span>` : '-'}
                </div>
            </div>
        </div>
        
        ${parking.note ? `<p class="mt-2 text-[10px] text-gray-500 flex items-start gap-1">
            <span class="text-blue-500">ℹ</span> ${parking.note}
        </p>` : ''}
    `;
}

// Sorting
function getSortedData() {
    const data = [...parkingData];
    switch (currentSort) {
        case 'hourly': return data.sort((a, b) => calculateHourlyRate(a) - calculateHourlyRate(b));
        case 'daily':
            return data.sort((a, b) => {
                const aMax = getPriceData(a).max || 99999;
                const bMax = getPriceData(b).max || 99999;
                return aMax - bMax;
            });
        case 'distance': return data.sort((a, b) => parseInt(a.distance) - parseInt(b.distance));
        default: return data;
    }
}

// Toggle Day Type
function toggleDayType() {
    showWeekend = !showWeekend;
    renderLists();
    addMarkers(); // Colors might change if pricing changes significantly
    updateDayToggleBtn();
}

function updateDayToggleBtn() {
    const btn = document.getElementById('dayToggle');
    if (btn) {
        if (showWeekend) {
            btn.innerHTML = '休日表示中';
            btn.className = btn.className.replace('bg-indigo-50 text-indigo-600', 'bg-orange-50 text-orange-600 border-orange-200');
        } else {
            btn.innerHTML = '平日表示中';
            btn.className = btn.className.replace('bg-orange-50 text-orange-600 border-orange-200', 'bg-indigo-50 text-indigo-600');
        }
    }
}

// Selection Logic
function selectParking(id) {
    selectedParkingId = id;
    const parking = parkingData.find(p => p.id === id);

    if (parking) {
        map.setView(parking.coords, 18, { animate: true, duration: 0.8 });
    }

    document.querySelectorAll('.parking-card').forEach(card => {
        if (parseInt(card.dataset.id) === id) {
            card.classList.add('selected');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            card.classList.remove('selected');
        }
    });

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
            addMarkers();
        });
    });

    document.getElementById('updateInfoBtn').addEventListener('click', () => {
        const url = `https://github.com/mkt918/nagoya-parking-map/issues/new?title=情報修正の提案`;
        window.open(url, '_blank');
    });
}

