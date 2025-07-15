// === MOCK INTELLIGENCE SYSTEM ===
// Generates realistic analysis results based on real-world data

class MockIntelligence {
    constructor() {
        this.initialized = false;
        this.geoData = {};
        this.weatherPatterns = {};
        this.seasonalData = {};
        this.init();
    }

    init() {
        this.setupGeoZones();
        this.setupWeatherPatterns();
        this.setupSeasonalData();
        this.setupSpeciesData();
        this.initialized = true;
        console.log('🧠 Mock Intelligence System initialized');
    }

    // Geographic zones with real characteristics
    setupGeoZones() {
        this.geoData = {
            // Lessinia - Prime testing area
            'lessinia': {
                bounds: { latMin: 45.45, latMax: 45.65, lngMin: 10.85, lngMax: 11.15 },
                characteristics: {
                    altitude: { min: 600, max: 1800 },
                    soilType: 'calcareous_rocky',
                    forestDensity: 'mixed_medium',
                    climate: 'pre_alpine',
                    moistureLevel: 'variable',
                    geology: 'carsico'
                },
                baseProbability: {
                    funghi: 72,      // Good for summer fungi
                    tartufi: 78,     // Excellent for Tartufo Nero
                    erbe: 85,        // Perfect for alpine herbs
                    custom: 55
                },
                commonSpecies: {
                    funghi: ['Porcini Estivi', 'Gallinacci', 'Russule', 'Prataioli', 'Vescia'],
                    tartufi: ['Tartufo Nero Estivo (Scorzone)', 'Tartufo Nero Uncinato'],
                    erbe: ['Timo Serpillo', 'Genzianella', 'Carlina', 'Achillea', 'Origano']
                },
                specificNotes: {
                    fungi_hotspots: ['Bosco del Cansiglio', 'Valle delle Sfingi', 'Malga San Giorgio'],
                    truffle_zones: ['Valli carsiche', 'Doline', 'Boschi misti faggio-nocciolo'],
                    soil_indicators: ['Terreno calcareo-marnoso', 'Affioramenti rocciosi', 'Drenaggio ottimo']
                }
            },
            
            // Northern Italy - High mushroom/truffle probability
            'northern_italy': {
                bounds: { latMin: 45.0, latMax: 46.5, lngMin: 7.0, lngMax: 13.0 },
                characteristics: {
                    altitude: { min: 100, max: 1200 },
                    soilType: 'calcareous',
                    forestDensity: 'high',
                    climate: 'temperate',
                    moistureLevel: 'optimal'
                },
                baseProbability: {
                    funghi: 75,
                    tartufi: 82,
                    erbe: 68,
                    custom: 50
                },
                commonSpecies: {
                    funghi: ['Porcini', 'Finferli', 'Chiodini', 'Ovoli'],
                    tartufi: ['Tartufo Bianco', 'Tartufo Nero', 'Scorzone'],
                    erbe: ['Tarassaco', 'Ortica', 'Borragine', 'Cicoria']
                }
            },
            
            // Central Italy - Medium probability
            'central_italy': {
                bounds: { latMin: 41.5, latMax: 44.5, lngMin: 8.0, lngMax: 15.0 },
                characteristics: {
                    altitude: { min: 50, max: 800 },
                    soilType: 'mixed',
                    forestDensity: 'medium',
                    climate: 'mediterranean',
                    moistureLevel: 'variable'
                },
                baseProbability: {
                    funghi: 58,
                    tartufi: 65,
                    erbe: 72,
                    custom: 45
                },
                commonSpecies: {
                    funghi: ['Porcini', 'Chiodini', 'Gallinacci'],
                    tartufi: ['Tartufo Nero', 'Scorzone'],
                    erbe: ['Rucola Selvatica', 'Finocchietto', 'Malva']
                }
            },
            
            // Southern Italy - Lower probability for fungi/truffles
            'southern_italy': {
                bounds: { latMin: 36.0, latMax: 41.5, lngMin: 12.0, lngMax: 18.5 },
                characteristics: {
                    altitude: { min: 0, max: 600 },
                    soilType: 'volcanic',
                    forestDensity: 'low',
                    climate: 'mediterranean_dry',
                    moistureLevel: 'low'
                },
                baseProbability: {
                    funghi: 35,
                    tartufi: 28,
                    erbe: 78,
                    custom: 40
                },
                commonSpecies: {
                    funghi: ['Cardoncelli', 'Pleurotus'],
                    tartufi: ['Tartufo Nero Estivo'],
                    erbe: ['Capperi', 'Origano', 'Rosmarino', 'Finocchietto']
                }
            },

            // Alpine regions - Specialized species
            'alpine': {
                bounds: { latMin: 45.5, latMax: 47.5, lngMin: 6.0, lngMax: 13.0 },
                characteristics: {
                    altitude: { min: 800, max: 2500 },
                    soilType: 'acidic',
                    forestDensity: 'high',
                    climate: 'alpine',
                    moistureLevel: 'high'
                },
                baseProbability: {
                    funghi: 85,
                    tartufi: 45,
                    erbe: 88,
                    custom: 55
                },
                commonSpecies: {
                    funghi: ['Porcini', 'Finferli', 'Russule', 'Lactarius'],
                    tartufi: ['Tartufo Nero'],
                    erbe: ['Genziana', 'Stella Alpina', 'Timo Selvatico']
                }
            }
        };
    }

    // Weather impact on probability
    setupWeatherPatterns() {
        this.weatherPatterns = {
            'sunny': {
                description: 'Sole',
                modifiers: {
                    funghi: -15,  // Fungi prefer moisture
                    tartufi: -10,
                    erbe: +10,    // Herbs like sun
                    custom: 0
                }
            },
            'cloudy': {
                description: 'Nuvoloso',
                modifiers: {
                    funghi: +5,
                    tartufi: +8,
                    erbe: +5,
                    custom: 0
                }
            },
            'rainy': {
                description: 'Pioggia',
                modifiers: {
                    funghi: +20,  // Perfect for mushrooms
                    tartufi: +15,
                    erbe: -5,     // Harder to find
                    custom: +5
                }
            },
            'foggy': {
                description: 'Nebbia',
                modifiers: {
                    funghi: +25,  // Ideal conditions
                    tartufi: +20,
                    erbe: -10,
                    custom: +10
                }
            },
            'windy': {
                description: 'Ventoso',
                modifiers: {
                    funghi: -8,
                    tartufi: -5,
                    erbe: -8,
                    custom: -5
                }
            }
        };
    }

    // Seasonal variations
    setupSeasonalData() {
        this.seasonalData = {
            'spring': {
                months: [3, 4, 5],
                modifiers: {
                    funghi: -10,   // Not prime season
                    tartufi: +15,  // Spring truffles
                    erbe: +25,     // Best for herbs
                    custom: +5
                },
                peakSpecies: {
                    funghi: ['Morchelle', 'Spugnole'],
                    tartufi: ['Tartufo Nero Pregiato', 'Bianchetto'],
                    erbe: ['Tarassaco', 'Ortica Giovane', 'Borragine']
                }
            },
            'summer': {
                months: [6, 7, 8],
                modifiers: {
                    funghi: -10,   // August still possible in mountains
                    tartufi: +20,  // PEAK for Tartufo Nero Estivo!
                    erbe: +15,
                    custom: 0
                },
                peakSpecies: {
                    funghi: ['Porcini Estivi', 'Gallinacci', 'Russule', 'Prataioli di Montagna'],
                    tartufi: ['Scorzone (Tartufo Nero Estivo)', 'Tartufo Nero Uncinato'],
                    erbe: ['Origano', 'Timo', 'Maggiorana', 'Achillea']
                },
                lessiniaSpecific: {
                    optimalAltitude: [800, 1400],
                    bestTimeOfDay: 'early_morning',
                    weatherPreference: 'after_thunderstorms',
                    soilConditions: 'moist_but_not_wet'
                }
            },
            'autumn': {
                months: [9, 10, 11],
                modifiers: {
                    funghi: +30,   // PEAK season!
                    tartufi: +25,  // Prime truffle time
                    erbe: +5,
                    custom: +15
                },
                peakSpecies: {
                    funghi: ['Porcini', 'Finferli', 'Chiodini', 'Ovoli'],
                    tartufi: ['Tartufo Bianco', 'Tartufo Nero'],
                    erbe: ['Rosa Canina', 'Bacche di Sambuco']
                }
            },
            'winter': {
                months: [12, 1, 2],
                modifiers: {
                    funghi: -25,   // Very limited
                    tartufi: -15,
                    erbe: -20,
                    custom: -10
                },
                peakSpecies: {
                    funghi: ['Orecchioni', 'Funghi su Legno'],
                    tartufi: ['Tartufo Nero Invernale'],
                    erbe: ['Rosmarino', 'Alloro']
                }
            }
        };
    }

    // Species-specific data
    setupSpeciesData() {
        this.speciesData = {
            'scorzone_lessinia': {
                scientificName: 'Tuber Aestivum',
                season: 'Maggio-Settembre',
                optimalConditions: {
                    altitude: [600, 1200],
                    temperature: [15, 25],
                    humidity: [60, 80],
                    soilPH: [7.0, 8.5]
                },
                indicators: [
                    'Terreno calcareo-marnoso tipico della Lessinia',
                    'Boschi misti di faggio, carpino, nocciolo',
                    'Doline e depressioni carsiche',
                    'Terreno ben drenato con affioramenti rocciosi',
                    'Zone con escursione termica giorno/notte'
                ],
                hotspots: [
                    'Valli carsiche tra Bosco Chiesanuova e Erbezzo',
                    'Doline presso Malga San Giorgio',
                    'Boschi misti verso Cerna'
                ]
            },
            'porcini_estivi': {
                scientificName: 'Boletus Reticulatus/Aereus',
                season: 'Giugno-Settembre',
                optimalConditions: {
                    altitude: [700, 1300],
                    temperature: [18, 28],
                    humidity: [70, 90],
                    soilPH: [5.5, 7.0]
                },
                indicators: [
                    'Boschi di faggio e abete rosso',
                    'Terreno acido con humus',
                    'Dopo piogge estive abbondanti',
                    'Zone fresche e ombreggiate',
                    'Presenza di mirtilli e felci'
                ]
            },
            'gallinacci': {
                scientificName: 'Cantharellus Cibarius',
                season: 'Luglio-Settembre',
                optimalConditions: {
                    altitude: [600, 1400],
                    temperature: [16, 24],
                    humidity: [75, 85],
                    soilPH: [4.5, 6.5]
                },
                indicators: [
                    'Boschi di conifere miste',
                    'Terreno muscoso e umido',
                    'Dopo temporali estivi',
                    'Zone semi-ombreggiate',
                    'Presenza di muschi e licheni'
                ]
            }
        };
    }

    // Main analysis function
    generateAnalysis(data) {
        const { target, latitude, longitude, photo, sensorData, timestamp } = data;
        
        // Determine geographic zone
        const zone = this.identifyGeoZone(latitude, longitude);
        
        // Get current season
        const season = this.getCurrentSeason(timestamp);
        
        // Simulate weather (in real app, this comes from API)
        const weather = this.simulateWeather(latitude, longitude, season);
        
        // Calculate base probability
        let probability = this.calculateBaseProbability(zone, target, season, weather);
        
        // Add photo analysis simulation
        if (photo) {
            probability += this.simulatePhotoAnalysis(photo, target, zone);
        }
        
        // Add sensor analysis simulation
        if (sensorData) {
            probability += this.simulateSensorAnalysis(sensorData, target);
        }
        
        // Ensure probability is within bounds
        probability = Math.max(0, Math.min(100, Math.round(probability)));
        
        // Generate detailed analysis
        const analysis = this.generateDetailedAnalysis(zone, target, season, weather, probability);
        
        return {
            probability,
            analysis: analysis.description,
            suggestions: analysis.suggestions,
            confidence: this.calculateConfidence(probability, photo ? true : false, sensorData ? true : false),
            zone: zone.name,
            season: season.name,
            weather: weather.description,
            species: analysis.likelySpecies,
            indicators: analysis.indicators,
            timestamp: new Date().toISOString()
        };
    }

    identifyGeoZone(lat, lng) {
        for (const [zoneName, zoneData] of Object.entries(this.geoData)) {
            const bounds = zoneData.bounds;
            if (lat >= bounds.latMin && lat <= bounds.latMax && 
                lng >= bounds.lngMin && lng <= bounds.lngMax) {
                return { name: zoneName, data: zoneData };
            }
        }
        
        // Default to central Italy if no match
        return { name: 'central_italy', data: this.geoData.central_italy };
    }

    getCurrentSeason(timestamp) {
        const date = new Date(timestamp);
        const month = date.getMonth() + 1; // 1-12
        
        for (const [seasonName, seasonData] of Object.entries(this.seasonalData)) {
            if (seasonData.months.includes(month)) {
                return { name: seasonName, data: seasonData };
            }
        }
        
        return { name: 'autumn', data: this.seasonalData.autumn };
    }

    simulateWeather(lat, lng, season) {
        // Simulate realistic weather patterns
        const weatherTypes = Object.keys(this.weatherPatterns);
        
        // Seasonal weather tendencies
        let weatherProbabilities = {
            'sunny': 0.3,
            'cloudy': 0.3,
            'rainy': 0.2,
            'foggy': 0.1,
            'windy': 0.1
        };

        if (season.name === 'autumn') {
            weatherProbabilities.rainy = 0.4;
            weatherProbabilities.foggy = 0.2;
            weatherProbabilities.sunny = 0.2;
        } else if (season.name === 'summer') {
            weatherProbabilities.sunny = 0.5;
            weatherProbabilities.rainy = 0.1;
        }

        // Pick weather based on probabilities
        const rand = Math.random();
        let cumulative = 0;
        for (const [weather, prob] of Object.entries(weatherProbabilities)) {
            cumulative += prob;
            if (rand <= cumulative) {
                return this.weatherPatterns[weather];
            }
        }
        
        return this.weatherPatterns.cloudy;
    }

    calculateBaseProbability(zone, target, season, weather) {
        let probability = zone.data.baseProbability[target] || 50;
        
        // Apply seasonal modifier
        probability += season.data.modifiers[target] || 0;
        
        // Apply weather modifier
        probability += weather.modifiers[target] || 0;
        
        // Add some randomness for realism
        probability += (Math.random() - 0.5) * 20;
        
        return probability;
    }

    simulatePhotoAnalysis(photo, target, zone) {
        // Simulate computer vision analysis
        // In reality, this would analyze the actual photo
        
        let photoBonus = 0;
        
        // Simulate detecting favorable conditions
        const indicators = [
            'terreno_umido',
            'vegetazione_densa', 
            'alberi_favorevoli',
            'muschio_presente',
            'foglie_decomposte'
        ];
        
        // Randomly "detect" some indicators
        const detectedIndicators = indicators.filter(() => Math.random() > 0.6);
        
        photoBonus = detectedIndicators.length * 5; // +5 per indicator
        
        // Target-specific bonuses
        if (target === 'funghi' && detectedIndicators.includes('terreno_umido')) {
            photoBonus += 10;
        }
        if (target === 'tartufi' && detectedIndicators.includes('alberi_favorevoli')) {
            photoBonus += 15;
        }
        
        return photoBonus;
    }

    simulateSensorAnalysis(sensorData, target) {
        let sensorBonus = 0;
        
        // Simulate chemical signature detection
        const { voc, gas, temp, humidity } = sensorData;
        
        if (target === 'funghi') {
            // Fungi emit specific VOCs
            if (voc > 100 && voc < 300) sensorBonus += 20;
            if (humidity > 70) sensorBonus += 10;
        } else if (target === 'tartufi') {
            // Truffles have distinct chemical signature
            if (voc > 150 && voc < 400) sensorBonus += 25;
            if (gas > 120000) sensorBonus += 15;
        }
        
        return sensorBonus;
    }

    generateDetailedAnalysis(zone, target, season, weather, probability) {
        const zoneData = zone.data;
        const seasonData = season.data;
        
        let description = '';
        let suggestions = '';
        let likelySpecies = [];
        let indicators = [];
        
        // Special handling for Lessinia
        if (zone.name === 'lessinia') {
            description += `🏔️ Analisi LESSINIA per ${this.getTargetName(target)}. `;
            
            if (target === 'tartufi' && season.name === 'summer') {
                description += `🎯 ZONA E STAGIONE OTTIMALI per Tartufo Nero Estivo (Scorzone)! `;
                description += `La Lessinia in agosto è il periodo di MASSIMA maturazione. Terreno calcareo-carsico ideale, `;
                description += `altitudine ${zoneData.characteristics.altitude.min}-${zoneData.characteristics.altitude.max}m perfetta. `;
                
                if (probability >= 70) {
                    suggestions = `Concentrati sulle DOLINE CARSICHE tra Bosco Chiesanuova ed Erbezzo. `;
                    suggestions += `Cerca sotto noccioli e carpini in boschi misti. Le zone migliori sono: `;
                    suggestions += `Valle delle Sfingi, doline presso Malga San Giorgio, boschi verso Cerna. `;
                    suggestions += `Orario ottimale: prima mattina dopo notti fresche.`;
                }
            } else if (target === 'funghi' && season.name === 'summer') {
                description += `🍄 Condizioni discrete per funghi estivi. In Lessinia ad agosto trova principalmente: `;
                description += `Porcini Estivi (Boletus reticulatus) nei boschi di faggio 800-1200m, `;
                description += `Gallinacci (Cantharellus) nelle conifere, Russule nelle radure. `;
                
                if (probability >= 60) {
                    suggestions = `Esplora boschi di FAGGIO tra 800-1300m di quota. `;
                    suggestions += `Dopo temporali estivi controlla zone ombreggiate e fresche. `;
                    suggestions += `Zone consigliate: Bosco del Cansiglio, versanti nord di Corna Piana, `;
                    suggestions += `boschi attorno a Malga Lessinia.`;
                }
            }
        } else {
            // Original analysis for other zones
            description += `Analisi per ${this.getTargetName(target)} nella zona ${this.getZoneName(zone.name)}. `;
        }
        
        description += `Stagione ${season.name} con condizioni ${weather.description.toLowerCase()}. `;
        
        if (probability >= 70) {
            if (!description.includes('OTTIMALI')) {
                description += `🎯 Condizioni OTTIME! `;
            }
            description += `La zona presenta caratteristiche ideali per il target selezionato.`;
            
            if (!suggestions) {
                suggestions = `Esplora aree sotto ${this.getOptimalTrees(target)}. `;
                suggestions += `Cerca segni di ${this.getSearchIndicators(target)}.`;
            }
            
        } else if (probability >= 40) {
            description += `⚠️ Condizioni MEDIE. La zona ha potenziale ma alcuni fattori limitano la probabilità.`;
            
            if (!suggestions) {
                suggestions = `Prova aree più protette o con microclima favorevole. `;
                suggestions += `Cerca indicatori specifici.`;
            }
            
        } else {
            description += `❌ Condizioni SFAVOREVOLI per questo target nella zona attuale.`;
            
            if (!suggestions) {
                suggestions = `Considera di esplorare zone diverse o attendere condizioni più favorevoli.`;
            }
        }
        
        // Get likely species
        if (zone.name === 'lessinia' && season.name === 'summer') {
            likelySpecies = this.getLessiniaSpecies(target);
        } else {
            likelySpecies = seasonData.peakSpecies[target] || zoneData.commonSpecies[target] || [];
        }
        
        // Get indicators
        indicators = this.getSearchIndicators(target, true, zone.name);
        
        return {
            description,
            suggestions,
            likelySpecies,
            indicators
        };
    }

    getLessiniaSpecies(target) {
        const lessiniaSpecies = {
            'tartufi': ['Scorzone (Tartufo Nero Estivo)', 'Tartufo Nero Uncinato'],
            'funghi': ['Porcini Estivi', 'Gallinacci', 'Russule', 'Prataioli di Montagna', 'Vescia'],
            'erbe': ['Timo Serpillo', 'Genzianella', 'Achillea', 'Carlina', 'Origano Montano']
        };
        return lessiniaSpecies[target] || [];
    }

    calculateConfidence(probability, hasPhoto, hasSensor) {
        let confidence = 60; // Base confidence
        
        if (hasPhoto) confidence += 20;
        if (hasSensor) confidence += 20;
        
        // Higher probability = higher confidence
        if (probability > 80) confidence += 10;
        else if (probability < 30) confidence -= 15;
        
        return Math.max(0, Math.min(100, confidence));
    }

    // Helper functions
    getTargetName(target) {
        const names = {
            'funghi': 'funghi',
            'tartufi': 'tartufi', 
            'erbe': 'erbe medicinali',
            'custom': 'target personalizzato'
        };
        return names[target] || target;
    }

    getZoneName(zoneName) {
        const names = {
            'northern_italy': 'Nord Italia',
            'central_italy': 'Centro Italia',
            'southern_italy': 'Sud Italia',
            'alpine': 'Regione Alpina'
        };
        return names[zoneName] || 'zona sconosciuta';
    }

    getOptimalTrees(target) {
        const trees = {
            'funghi': 'castagni, faggi, querce',
            'tartufi': 'querce, noccioli, tigli, pioppi',
            'erbe': 'radure e bordi bosco'
        };
        return trees[target] || 'vegetazione mista';
    }

    getOptimalSoil(target) {
        const soils = {
            'funghi': 'umidi e ben drenati',
            'tartufi': 'calcarei e argillosi',
            'erbe': 'ricchi di humus'
        };
        return soils[target] || 'ben drenati';
    }

    getSearchIndicators(target, detailed = false, zone = null) {
        // Lessinia-specific indicators
        if (zone === 'lessinia') {
            const lessiniaIndicators = {
                'tartufi': detailed ? [
                    'Doline carsiche con accumulo di terra',
                    'Boschi misti faggio-carpino-nocciolo',
                    'Terreno calcareo-marnoso ben drenato',
                    'Affioramenti rocciosi nelle vicinanze',
                    'Zone con escursione termica giorno/notte',
                    'Assenza di vegetazione erbacea fitta sotto gli alberi'
                ] : 'doline carsiche, boschi misti, terreno calcareo',
                
                'funghi': detailed ? [
                    'Boschi di faggio tra 800-1300m di quota',
                    'Terreno umido ma non fradicio dopo piogge',
                    'Zone ombreggiate e fresche in estate',
                    'Presenza di humus e foglie in decomposizione',
                    'Muschi e felci nelle vicinanze',
                    'Pendii esposti a nord o nord-est'
                ] : 'boschi di faggio, zone fresche, humus',
                
                'erbe': detailed ? [
                    'Prati e radure tra 600-1500m',
                    'Terreno calcareo ben esposto al sole',
                    'Bordi di sentieri e mulattiere',
                    'Zone non troppo umide',
                    'Presenza di altre piante aromatiche',
                    'Pascoli montani abbandonati'
                ] : 'prati montani, terreno calcareo, esposizione solare'
            };
            
            return lessiniaIndicators[target] || (detailed ? ['Indicatori specifici per Lessinia non definiti'] : 'indicatori montani');
        }
        
        // Default indicators for other zones
        const indicators = {
            'funghi': detailed ? [
                'Terreno soffice con foglie in decomposizione',
                'Presenza di muschio',
                'Umidità costante ma non ristagno',
                'Alberi di castagno, faggio o quercia',
                'Assenza di erba fitta'
            ] : 'muschio, foglie decomposte, terreno soffice',
            
            'tartufi': detailed ? [
                'Terreno calcareo-argilloso',
                'Radici superficiali di quercia/nocciolo',
                'Assenza di vegetazione sotto l\'albero',
                'Terreno compatto ma non duro',
                'Microclima riparato'
            ] : 'terreno calcareo, radici superficiali, zone brulle',
            
            'erbe': detailed ? [
                'Terreno ricco di humus',
                'Esposizione parziale al sole',
                'Presenza di altre erbe spontanee',
                'Terreno non inquinato',
                'Vicinanza a fonti d\'acqua'
            ] : 'terreno ricco, esposizione solare, biodiversità'
        };
        
        return indicators[target] || (detailed ? ['Indicatori specifici non definiti'] : 'indicatori vari');
    }

    // Public API for testing
    testAnalysis(lat = 45.4384, lng = 10.9916, target = 'funghi') {
        const mockData = {
            target,
            latitude: lat,
            longitude: lng,
            photo: 'data:image/jpeg;base64,mock_photo_data',
            timestamp: new Date().toISOString(),
            sensorData: {
                voc: Math.floor(Math.random() * 200) + 100,
                gas: Math.floor(Math.random() * 50000) + 120000,
                temp: 18.5,
                humidity: 75
            }
        };
        
        return this.generateAnalysis(mockData);
    }

    // Specific test for Lessinia
    testLessinia(target = 'tartufi') {
        console.log(`🏔️ Testing Lessinia for ${target} in August...`);
        
        // Coordinates for Lessinia area
        const lessiniaCoords = [
            { lat: 45.5234, lng: 10.9584, name: 'Bosco Chiesanuova' },
            { lat: 45.5489, lng: 10.9123, name: 'Malga San Giorgio' },
            { lat: 45.5612, lng: 10.8956, name: 'Valle delle Sfingi' },
            { lat: 45.4987, lng: 11.0234, name: 'Erbezzo' }
        ];
        
        const testLocation = lessiniaCoords[Math.floor(Math.random() * lessiniaCoords.length)];
        
        const result = this.testAnalysis(testLocation.lat, testLocation.lng, target);
        console.log(`📍 Test location: ${testLocation.name}`);
        console.log(`🎯 Result: ${result.probability}% probability`);
        console.log(`📝 Analysis: ${result.analysis}`);
        
        return result;
    }
}

// Export for use in main app
window.MockIntelligence = MockIntelligence;