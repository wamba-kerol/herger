const weatherApiKey = '098185580a031e38cba98336c09fb082';
const clientId = 'j2iM83a1d4LKCt6EHg7LB';
const clientSecret = 'T7VsTvbpQQauCfaoKyiRVQuU0PI0l5IlbxKtAan4';

let lastApiCall = 0;
const apiCooldown = 10000; // Délai de 10 secondes
let lastLocation = { lat: null, lng: null }; // Dernières coordonnées utilisées
let map, autocomplete, service, infowindow;

// Vérifie si un appel API peut être effectué
function canMakeApiCall() {
    const now = Date.now();
    if (now - lastApiCall > apiCooldown) {
        lastApiCall = now;
        return true;
    }
    return false;
}

// Récupère les données si une nouvelle localisation est sélectionnée
function fetchDataIfNewLocation(lat, lng) {
    if (lat !== lastLocation.lat || lng !== lastLocation.lng) {
        lastLocation = { lat, lng };
        if (canMakeApiCall()) {
            fetchAirQuality(lat, lng);
            fetchWeather(lat, lng);
            fetchNearbyRestaurants(lat, lng);  // Recherche des restaurants à proximité
        } else {
            alert("Trop de requêtes. Veuillez patienter avant de faire un nouvel appel.");
        }
    }
}

// Initialise la carte Google Maps
function initMap() {
    const mapCenter = { lat: 45.1885, lng: 5.7245 }; // Grenoble

    map = new google.maps.Map(document.getElementById("map"), {
        center: mapCenter,
        zoom: 10,
    });

    // Création du service Places pour les recherches
    service = new google.maps.places.PlacesService(map);
    infowindow = new google.maps.InfoWindow();

    // Associer l'autocomplétion à l'input existant
    const input = document.querySelector('.navbar input[type="text"]');
    autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.bindTo('bounds', map);

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) {
            alert("Lieu introuvable. Veuillez essayer un autre endroit.");
            return;
        }

        const location = place.geometry.location;
        map.setCenter(location);
        map.setZoom(12); // Zoom après la recherche
        fetchDataIfNewLocation(location.lat(), location.lng());
    });

    // Ajout de l'événement de clic sur la carte
    map.addListener("click", (mapsMouseEvent) => {
        const lat = mapsMouseEvent.latLng.lat();
        const lng = mapsMouseEvent.latLng.lng();
        fetchDataIfNewLocation(lat, lng);
    });
}

// Recherche des restaurants à proximité
// Fonction de récupération des restaurants à proximité (avec une API publique ou autre service)
// Fonction pour récupérer les restaurants proches
function fetchNearbyRestaurants(lat, lng) {
    const apiUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node[amenity=restaurant](${lat-0.01},${lng-0.01},${lat+0.01},${lng+0.01});out;`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            const restaurantList = document.getElementById("restaurants-list");
            restaurantList.innerHTML = ""; // Vider la liste avant de la remplir
            
            if (data.elements && data.elements.length > 0) {
                data.elements.forEach(place => {
                    if (place.lat && place.lon) {
                        const marker = new google.maps.Marker({
                            position: new google.maps.LatLng(place.lat, place.lon),
                            map: map,
                            title: place.tags.name || "Restaurant",
                        });

                        google.maps.event.addListener(marker, 'click', () => {
                            infowindow.setContent(`
                                <h3>${place.tags.name || 'Restaurant'}</h3>
                                <p>${place.tags['addr:street'] || 'Adresse non disponible'}</p>
                            `);
                            infowindow.open(map, marker);
                        });

                        const listItem = document.createElement("div");
                        listItem.classList.add("restaurant-item");
                        listItem.innerHTML = `
                            <h4>${place.tags.name || 'Restaurant'}</h4>
                            <p>${place.tags['addr:street'] || 'Adresse non disponible'}</p>
                            <button onclick="panToLocation(${place.lat}, ${place.lon})">Voir sur la carte</button>
                        `;
                        restaurantList.appendChild(listItem);
                    }
                });
            } else {
                restaurantList.innerHTML = "<p>Aucun restaurant trouvé à proximité.</p>";
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            document.getElementById('restaurants-list').innerHTML = 'Erreur lors de la récupération des restaurants.';
        });
}

// Fonction pour recentrer la carte sur un endroit spécifique
function panToLocation(lat, lng) {
    map.setCenter({ lat, lng });
    map.setZoom(15);
}

// Vider les marqueurs existants (si nécessaire)
function clearMarkers() {
    const markers = map.getMarkers();
    markers.forEach(marker => marker.setMap(null));
}



// Vider les marqueurs existants (si nécessaire)
function clearMarkers() {
    const markers = map.getMarkers();
    markers.forEach(marker => marker.setMap(null));
}

// Récupère les données sur la qualité de l'air
function fetchAirQuality(lat, lng) {
    const apiUrl = `https://data.api.xweather.com/airquality/${lat},${lng}?format=json&fields=loc,place,periods,periods.dominant,periods.pollutants&client_id=${clientId}&client_secret=${clientSecret}`;

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur API: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const airData = data.response[0];
                const location = airData.place.name;
                const state = airData.place.state;
                const country = airData.place.country;
                const aqi = airData.periods[0].aqi;
                const pollutants = airData.periods[0].pollutants;

                document.getElementById('location').innerHTML = `<h2>${location}, ${state}, ${country}</h2>`;

                let aqiClass = '';
                let aqiText = '';
                if (aqi <= 50) {
                    aqiClass = 'good';
                    aqiText = 'Bonne qualité';
                } else if (aqi <= 100) {
                    aqiClass = 'moderate';
                    aqiText = 'Qualité modérée';
                } else {
                    aqiClass = 'unhealthy';
                    aqiText = 'Qualité insalubre';
                }
                document.getElementById('aqi').innerHTML = `<h3 class="${aqiClass}">AQI: ${aqi} (${aqiText})</h3>`;

                let pollutantsText = '<h4>Polluants :</h4>';
                pollutants.forEach(pollutant => {
                    pollutantsText += `<p><strong>${pollutant.name}:</strong> ${pollutant.valueUGM3} µg/m³ (AQI: ${pollutant.aqi})</p>`;
                });
                document.getElementById('pollutants').innerHTML = pollutantsText;
            } else {
                document.getElementById('location').innerHTML = 'Erreur de récupération des données de qualité de l\'air.';
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            document.getElementById('location').innerHTML = 'Erreur lors de la récupération des données de qualité de l\'air.';
        });
}

// Récupère les données météorologiques
function fetchWeather(lat, lng) {
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${weatherApiKey}&units=metric&lang=fr`;

    fetch(weatherUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur API: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.main) {
                const temperature = data.main.temp;
                const description = data.weather[0].description;
                const iconCode = data.weather[0].icon;
                const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
                const weatherInfo = `<p>Température: ${temperature}°C</p><p>${description}</p><img src="${iconUrl}" alt="${description}" style="width:50px;height:50px;">`;
                document.getElementById('weather-data').innerHTML = weatherInfo;
            } else {
                document.getElementById('weather-data').innerHTML = 'Données météo non disponibles.';
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            document.getElementById('weather-data').innerHTML = 'Erreur lors de la récupération des données météo.';
        });
}

// Initialisation de la carte au chargement de la page
window.onload = initMap;
