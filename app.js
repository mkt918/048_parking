// Nagoya Station Parking Map Application

let map;
let markers = [];
let parkingData = [];
let currentSort = 'default';
let selectedParkingId = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadParkingData();
    initializeMap();
    renderParkingList();
    setupEventListeners();
});

// Load parking data from JSON
async function loadParkingData() {
    try {
        const response = await fetch('parking_data.json');
        parkingData = await response.json();
    } catch (error) {
        console.error('Failed to load parking data:', error);
        parkingData = [];
    }
}

// Initialize Leaflet map
function initializeMap() {
    // Center on Nagoya Station
    const nagoyaStation = [35.1706, 136.8817];
    
    map = L.map('map').setView(nagoyaStation, 16);
    
    // Use OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add a circle to show 500m radius
    L.circle(nagoyaStation, {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        radius: 500,
        weight: 2,
        dashArray: '5, 10'
    }).addTo(map);
    
    // Add markers for each parking lot
    addMarkers();
}

// Add markers to the map
function addMarkers() {
    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];
    
    const sortedData = getSortedData();
    
    sortedData.forEach((parking, index) => {
        const priceDisplay = getPriceDisplay(parking);
        
        // Create custom icon with price
        const customIcon = L.divIcon({
            className: 'price-marker',
            html: `<div class="price-marker" data-id="${parking.id}">${priceDisplay}</div>`,
            iconSize: [60, 32],
            iconAnchor: [30, 32]
        });
        
        const marker = L.marker(parking.coords, { icon: customIcon })
            .addTo(map)
            .bindPopup(createPopupContent(parking));
        
        // Add click event
        marker.on('click', () => selectParking(parking.id));
        
        markers.push(marker);
    });
    
    updateMarkerStyles();
}

// Get price display text
function getPriceDisplay(parking) {
    if (parking.price.max_day) {
        return `¥${parking.price.max_day.toLocaleString()}`;
    } else if (parking.price.hourly) {
        return `¥${parking.price.hourly}/h`;
    } else {
        return parking.price.unit.split(' ')[0] || '要確認';
    }
}

// Create popup content
function createPopupContent(parking) {
    const hourlyPrice = parking.price.hourly 
        ? `<span class="price-badge">時間: ¥${parking.price.hourly}</span>` 
        : '';
    const dailyPrice = parking.price.max_day 
        ? `<span class="price-badge secondary">1日最大: ¥${parking.price.max_day.toLocaleString()}</span>` 
        : '';
    
    return `
        <div style="min-width: 200px;">
            <h3 style="font-weight: 600; font-size: 16px; margin-bottom: 8px; color: #1f2937;">
                ${parking.name}
            </h3>
            <div style="margin-bottom: 8px;">
                ${hourlyPrice} ${dailyPrice}
            </div>
            <p style="font-size: 12px; color: #6b7280; margin: 4px 0;">
                ${parking.price.unit}
            </p>
            ${parking.distance ? `<p style="font-size: 12px; color: #6b7280; margin: 4px 0;">📍 名古屋駅から ${parking.distance}</p>` : ''}
            ${parking.capacity ? `<p style="font-size: 12px; color: #6b7280; margin: 4px 0;">🚗 収容台数: ${parking.capacity}</p>` : ''}
            ${parking.note ? `<p style="font-size: 12px; color: #3b82f6; margin: 4px 0;">💡 ${parking.note}</p>` : ''}
        </div>
    `;
}

// Render parking list in sidebar
function renderParkingList() {
    const listContainer = document.getElementById('parkingList');
    const sortedData = getSortedData();
    
    listContainer.innerHTML = sortedData.map(parking => `
        <div class="parking-item" data-id="${parking.id}">
            <div class="flex items-start justify-between mb-2">
                <h3 class="font-semibold text-gray-800 text-sm flex-1">${parking.name}</h3>
                ${parking.distance ? `<span class="text-xs text-gray-500 ml-2">${parking.distance}</span>` : ''}
            </div>
            <div class="flex flex-wrap gap-1 mb-2">
                ${parking.price.hourly ? `<span class="price-badge">¥${parking.price.hourly}/h</span>` : ''}
                ${parking.price.max_day ? `<span class="price-badge secondary">1日 ¥${parking.price.max_day.toLocaleString()}</span>` : ''}
            </div>
            <p class="text-xs text-gray-600 mb-1">${parking.price.unit}</p>
            ${parking.note ? `<p class="text-xs text-blue-600">💡 ${parking.note}</p>` : ''}
        </div>
    `).join('');
    
    // Update count
    document.getElementById('parkingCount').textContent = `全${sortedData.length}件`;
    
    // Add click events to list items
    document.querySelectorAll('.parking-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.id);
            selectParking(id);
            
            // Scroll map to marker
            const parking = parkingData.find(p => p.id === id);
            if (parking) {
                map.setView(parking.coords, 17, { animate: true });
            }
        });
    });
    
    updateListItemStyles();
}

// Select a parking lot
function selectParking(id) {
    selectedParkingId = id;
    updateMarkerStyles();
    updateListItemStyles();
}

// Update marker styles based on selection
function updateMarkerStyles() {
    document.querySelectorAll('.price-marker').forEach(marker => {
        const markerId = parseInt(marker.dataset.id);
        if (markerId === selectedParkingId) {
            marker.classList.add('selected');
        } else {
            marker.classList.remove('selected');
        }
    });
}

// Update list item styles based on selection
function updateListItemStyles() {
    document.querySelectorAll('.parking-item').forEach(item => {
        const itemId = parseInt(item.dataset.id);
        if (itemId === selectedParkingId) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Get sorted data based on current sort option
function getSortedData() {
    const data = [...parkingData];
    
    switch (currentSort) {
        case 'hourly':
            return data.sort((a, b) => {
                const aPrice = a.price.hourly || Infinity;
                const bPrice = b.price.hourly || Infinity;
                return aPrice - bPrice;
            });
        case 'daily':
            return data.sort((a, b) => {
                const aPrice = a.price.max_day || Infinity;
                const bPrice = b.price.max_day || Infinity;
                return aPrice - bPrice;
            });
        case 'distance':
            return data.sort((a, b) => {
                const aDistance = parseInt(a.distance) || Infinity;
                const bDistance = parseInt(b.distance) || Infinity;
                return aDistance - bDistance;
            });
        default:
            return data;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sortType = btn.dataset.sort;
            currentSort = sortType;
            
            // Update active state
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Re-render
            addMarkers();
            renderParkingList();
        });
    });
    
    // Update info button
    document.getElementById('updateInfoBtn').addEventListener('click', () => {
        // Open Google Form or GitHub Issue
        const message = encodeURIComponent('駐車場情報の修正・追加の提案をこちらに記入してください。');
        const url = `https://github.com/mkt918/nagoya-parking-map/issues/new?title=情報修正の提案&body=${message}`;
        window.open(url, '_blank');
    });
}
