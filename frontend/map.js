
class Contact{
    constructor(id, type, designator, current_loc, heading, last_report_time, speed, history, meta, status){
        this.id = id;
        this.type = type;
        this.designator = designator;
        this.current_loc = current_loc;
        this.heading = heading;
        this.last_report_time = last_report_time;
        this.speed = speed;
        this.history = history;
        this.meta = meta;
        this.status = status;
    }
}

class Zone{
    constructor(id, zonename, zonetype, zonedesc, zonecoords, zonesig=1){
        this.id = id;
        this.desig = zonename;
        this.type = zonetype;
        this.desc = zonedesc;
        this.coords = zonecoords;
        this.zonesig = zonesig;
    }
}

var current_Contacts = new Map();
var markers_ = new Map();
var current_zones = new Map();
var zone_polylines_ = new Map();

var map = null;
let gridLines = [];
let labelMarkers = [];

document.addEventListener('DOMContentLoaded', async function load_Map(){
    
    status_('[+] Loading Map...');

    map = L.map('main-map', {
        fullscreenControl: {
            pseudoFullscreen: true, // if true, fullscreen to page width and height
            attributionControl: false
        },
    }).setView([17.6868, 83.2185], 12);

    
    var openStreetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    var openSeaMap = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors'
    });

    var darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd'
    });


    openStreetMap.addTo(map);
    openSeaMap.addTo(map);
    darkTileLayer.addTo(map);

    drawGrid();

    // Redraw grid on move and zoom
    map.on('moveend zoomend', drawGrid);

    // var graticule = L.graticule({
    //     interval: 0.2, // Set the interval for grid lines
    //     style: {
    //         color: 'white', // Color of the grid lines
    //         weight: 100
    //     }
    // }).addTo(map);

    // map.addControl(new L.Control.Fullscreen());

        // Detect when fullscreen is entered or exited
    map.on('enterFullscreen', function() {
        console.log('Entered fullscreen mode');
    });

    map.on('exitFullscreen', function() {
        console.log('Exited fullscreen mode');
    });

    status_('[+] Map Loaded.');

    status_('[+] Loading contacts...');

    var contacts = await eel.fetch_all()(); // change to api functionality

    status_('[+] Fetched contacts. Plotting...')

    plot_contacts_fresh(contacts);
    
    status_('[+] Fetching zones...');

    var zones = await eel.fetch_all_zones()(); // change to api functionality
    
    status_('[+] Fetched zones. Plotting...');

    plot_zones_fresh(zones);

    document.getElementById('search_contacts_input_').addEventListener('input', function(event){
        var contact_searchcrit_ = event.target.value;
        filter_contacts(contact_searchcrit_);
    });

    document.getElementById('search_zones_input_').addEventListener('input', function(event){
        var zone_searchcrit_ = event.target.value;
        filter_zones(zone_searchcrit_);
    });

    status_("[.] Done.")

    // statusdiv.textContent = contacts[0][2];

});

function drawGrid() {
    // Clear existing grid lines and labels
    gridLines.forEach(line => map.removeLayer(line));
    gridLines = [];
    labelMarkers.forEach(marker => map.removeLayer(marker));
    labelMarkers = [];

    // Get current bounds and zoom level
    let bounds = map.getBounds();
    let zoom = map.getZoom();
    let gridSpacing = zoom > 10 ? 0.25 : zoom > 5 ? 0.5 : 1;

    // Define start and end lat/lng for grid
    let startLat = Math.floor(bounds.getSouth() / gridSpacing) * gridSpacing;
    let endLat = Math.ceil(bounds.getNorth() / gridSpacing) * gridSpacing;
    let startLng = Math.floor(bounds.getWest() / gridSpacing) * gridSpacing;
    let endLng = Math.ceil(bounds.getEast() / gridSpacing) * gridSpacing;

    // Draw latitude lines (horizontal) and add latitude labels above the grid lines
    for (let lat = startLat; lat <= endLat; lat += gridSpacing) {
        // Horizontal grid line
        let polyline = L.polyline([[lat, startLng], [lat, endLng]], {
            color: 'cyan',
            weight: 2,
            opacity: 0.1,
            dashArray: '4, 4'
        }).addTo(map);
        gridLines.push(polyline);

        // Place label at equal intervals above the line
        let labelMarker = L.marker([lat + gridSpacing * 0.05, startLng + gridSpacing + 0.05], {
            icon: L.divIcon({
                className: 'grid-label',
                html: `${lat.toFixed(2)}°`, // Latitude label
                iconSize: [40, 20],
                iconAnchor: [20, 0] // Centered above the line
            })
        }).addTo(map);
        labelMarkers.push(labelMarker);
    }

    // Draw longitude lines (vertical) and add longitude labels above the grid lines
    for (let lng = startLng; lng <= endLng; lng += gridSpacing) {
        // Vertical grid line
        let polyline = L.polyline([[startLat, lng], [endLat, lng]], {
            color: 'cyan',
            weight: 2,
            opacity: 0.1,
            dashArray: '4, 4'
        }).addTo(map);
        gridLines.push(polyline);

        // Place label at equal intervals above the line
        let labelMarker = L.marker([startLat + gridSpacing, lng + gridSpacing * 0.05], {
            icon: L.divIcon({
                className: 'grid-label',
                html: `${lng.toFixed(2)}°`, // Longitude label
                iconSize: [40, 20],
                iconAnchor: [0, 20] // Centered above the line
            })
        }).addTo(map);
        labelMarkers.push(labelMarker);
    }
}

function getExcelColumnLabel(index) {
    let label = '';
    while (index >= 0) {
        label = String.fromCharCode((index % 26) + 65) + label;
        index = Math.floor(index / 26) - 1;
    }
    return label;
}


function filter_contacts(filter_crit_){
    var matching_ids_ = searchMapByCriteria(current_Contacts, filter_crit_);
    console.log(matching_ids_);
    removeAllMarkers();
    markers_.forEach((marker_this_, marker_id_) => {
        if (matching_ids_.includes(marker_id_)){
            show_marker(marker_id_);
        }
    });

}

function filter_zones(filter_crit_){
    var matching_ids_ = searchMapByCriteria_zones(current_zones, filter_crit_);
    console.log(matching_ids_);
    removeAllZones();
    zone_polylines_.forEach((zone_this_, zone_id_) => {
        if (matching_ids_.includes(zone_id_)){
            show_zone(zone_id_);
        }
    });

}


function searchMapByCriteria_zones(contactmap, searchCriteria) {
    let matchingKeys = [];
    let criteriaLower = String(searchCriteria).toLowerCase();
    let criteria_markers = criteriaLower.split('|').map(value => value.trim());; 
    console.log(criteria_markers);
    contactmap.forEach((value, key) => {
        var keyadded = false;
        if(searchCriteria.trim() == ""){
            matchingKeys.push(key);
            keyadded = true;
        }
        if (!keyadded){
            for (let prop in value) {
                let propValue = value[prop];            
                if (criteria_markers.some(value => String(propValue).toLowerCase().includes(value))) {
                    matchingKeys.push(key);
                    break;
                }
            }
        }
    });

    return matchingKeys;
}

function searchMapByCriteria(contactmap, searchCriteria) {
    let matchingKeys = [];
    let criteriaLower = String(searchCriteria).toLowerCase(); 
    let criteria_markers = criteriaLower.split('|').map(value => value.trim());; 
    console.log(criteria_markers);
    contactmap.forEach((value, key) => {
        var keyadded = false;
        if(searchCriteria.trim() == ""){
            matchingKeys.push(key + "_marker_id_");
            keyadded = true;
        }
        if (!keyadded){
            for (let prop in value) {
                let propValue = value[prop];            
                if (criteria_markers.some(value => String(propValue).toLowerCase().includes(value))) {
                    matchingKeys.push(key + "_marker_id_");
                    break;
                }
            }
        }
    });

    return matchingKeys;
}


function status_(sts_txt=""){
    var statusdiv = document.getElementById('statusdiv');
    statusdiv.textContent = sts_txt;
}

function plot_zones_fresh(zones=null){
    if (zones != null){
        current_zones = new Map();
        zone_polylines_ = new Map();
        zones.forEach(zone => {
            var zone_id = zone[0];
            var zone_name = zone[1];
            var zone_type = zone[2];
            var zone_desc = zone[3];
            var zone_coords = zone[4];
            var zone_sig_level = zone[5];
            var this_Zone_ = new Zone(
                zone_id,
                zone_name,
                zone_type,
                zone_desc,
                zone_coords,
                zone_sig_level
            );
            current_zones.set(this_Zone_.id, this_Zone_);
        });
        for (const [key, zone] of current_zones){
            plot_this_zone(zone);
        }
    }
}

function plot_contacts_fresh(contacts=null){
    // console.log(contacts);
    if (contacts != null){
        current_Contacts = new Map();
        markers_ = new Map();
        contacts.forEach(contact => {
            var id = contact[0];
            var type = contact[1];
            var desig = contact[2];
            var loc = null;
            if (contact[3] != null){
                loc = [Number(contact[3].split(",")[0]), 
                Number(contact[3].split(", ")[1])]
            }
            var heading = contact[4];
            var lastreport = contact[5];
            var speed = contact[6];
            var history = contact[7];
            var meta = contact[8];
            var status = contact[9];
            var thisContact = new Contact(
                id, type, desig, loc, heading, lastreport, speed, history, meta, status
            );
            current_Contacts.set(thisContact.id, thisContact);
            
            // console.log(thisContact);
        }); 
        for(const [key, contact] of current_Contacts){
            plot_this_contact(contact);
        }   
    } else{
        // current_Contacts.set(thisContact.id, thisContact);
        removeAllMarkers();
        for(const [key, contact] of current_Contacts){
            plot_this_contact(contact, new_marker_=false);
        }
    }
    console.log(markers_);
    
}

function add_contact(contact_singular){
    var contact = contact_singular;
    var id = contact[0];
    var type = contact[1];
    var desig = contact[2];
    var loc = null;
    if (contact[3] != null){
        loc = [Number(contact[3].split(",")[0]), 
        Number(contact[3].split(", ")[1])]
    }
    var heading = contact[4];
    var lastreport = contact[5];
    var speed = contact[6];
    var history = contact[7];
    var meta = contact[8];
    var status = contact[9];
    var thisContact = new Contact(
        id, type, desig, loc, heading, lastreport, speed, history, meta, status
    );
    current_Contacts.set(thisContact.id, thisContact);
    plot_this_contact(thisContact);
    // console.log(thisContact);
}

function getAllMarkers() {

    var allMarkersObjArray = []; // for marker objects
    var allMarkersGeoJsonArray = []; // for readable geoJson markers

    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker) { // Check if the layer is a marker
            allMarkersObjArray.push(layer); // Add marker object to array
            allMarkersGeoJsonArray.push(JSON.stringify(layer.toGeoJSON())); // Convert marker to GeoJSON and add to array
        }
    });

    return allMarkersObjArray;
}

function remove_marker(contactid){
    
    // console.log("Remove marker called: ", markers_.get(contactid + "_marker_id_"));
    var allmarkers = getAllMarkers();

    allmarkers.forEach(marker => {
        // console.log(marker.markerId);
        if (marker.markerId == contactid + "_marker_id_"){
            marker.remove();
        }
    });
}

function removeAllMarkers(){
    var allmarkers = getAllMarkers();

    allmarkers.forEach(marker => {
        // console.log(marker.markerId);
        // if (marker.markerId == contactid + "_marker_id_"){
        marker.remove();
        // }
    });
}

function show_marker(markerid){
    var status_icon_colormap = new Map([
        ['routine','blue'],
        ['confidential', 'purple'],
        ['urgent', 'orange'],
        ['immediate', 'red'],
        ['secret', 'darkpurple'],
        ['unknown', 'green']
    ]);
    markers_.get(markerid).addTo(map);
    console.log(markerid.split("_")[0]);

    var marker_contact_ = current_Contacts.get(Number(markerid.split("_")[0]));
    console.log("Markercontact: ", marker_contact_);

    if (marker_contact_ && marker_contact_.heading != null){
        addHeadingAndCompass(
            markers_.get(marker_contact_.id+"_marker_id_"), 
            String(marker_contact_.heading), 
            String(marker_contact_.speed),
            status_icon_colormap.get(marker_contact_.status)
        );
    }

    markers_.get(markerid).openPopup();
}

function show_zone(zoneid){
    zone_polylines_.get(zoneid).addTo(map);
    zone_polylines_.get(zoneid).openPopup();
}

function getAllZones() {

    var allMarkersObjArray_zones = []; // for marker objects
    var allMarkersGeoJsonArray_zones = []; // for readable geoJson markers

    map.eachLayer(function (layer) {
        if (layer instanceof L.Polygon) { // Check if the layer is a marker
            allMarkersObjArray_zones.push(layer); // Add marker object to array
            allMarkersGeoJsonArray_zones.push(JSON.stringify(layer.toGeoJSON())); // Convert marker to GeoJSON and add to array
        }
    });

    return allMarkersObjArray_zones;
}

function remove_zone(zoneid){
    
    // console.log("Remove marker called: ", markers_.get(contactid + "_marker_id_"));
    var allzones = getAllZones();

    allzones.forEach(zone => {
        // console.log(marker.markerId);
        if (zone.zoneid == zoneid){
            zone.remove();
        }
    });
}

function removeAllZones(){
    var allzones = getAllZones();

    allzones.forEach(zone => {
        // console.log(marker.markerId);
        // if (marker.markerId == contactid + "_marker_id_"){
        zone.remove();
        // }
    });
}

function plot_this_zone(zone, new_zone_=true){
    console.log(zone);
    if (JSON.parse(zone.coords).length > 0){
        console.log(JSON.parse(zone.coords));
        var zonesig_colormap = new Map([
            ['1','cyan'],
            ['2', 'cyan'],
            ['3', 'cyan'],
            ['4', 'cyan'],
            ['5', 'red'],
        ]);
        if(new_zone_){
            
            var coords_this_ = JSON.parse(zone.coords);
            if (coords_this_[0] !== coords_this_[coords_this_.length - 1]) {
                coords_this_.push(coords_this_[0]);  // Add the first coordinate to the end
            }
            
            let this_polyline_ = L.polygon(
                coords_this_, 
                {
                    color : zonesig_colormap.get(String(zone.zonesig)),
                    weight: 1,        // Line thickness
                    opacity: 0.7,     // Slight transparency
                    className: 'glow',
                    // fillColor: zonesig_colormap.get(String(zone.zonesig)),    // Inside fill color (cyan)
                    fillOpacity: 0.05,
                    // fillPattern: null,
                }
            ).addTo(map);
            // this_polyline_.getElement().style.fill = "url(#diagonalStripes)";
            map.fitBounds(this_polyline_.getBounds());
            this_polyline_.zoneid = zone.id;

            var this_zone_popup_ = document.createElement('div');
            this_zone_popup_.style.backgroundColor = 'rgb(46, 46, 46)';
            this_zone_popup_.style.color = "antiquewhite";
            this_zone_popup_.style.fontFamily = "Arial, Helvetica, sans-serif";
            this_zone_popup_.style.fontSize = "small";
            this_zone_popup_.style.padding = "5px 5px";
            this_zone_popup_.style.borderRadius = "5px";
            this_zone_popup_.style.border = "1px solid antiquewhite";
            this_zone_popup_.style.width = "100%";
            this_zone_popup_.textContent = zone.desig;

            this_polyline_.on('mouseover', function(){
                this_polyline_.openPopup();
                show_dets_zone(zone);
            });

            zone_polylines_.set(zone.id, this_polyline_);

            this_polyline_.bindPopup(this_zone_popup_, {
                autoClose: false,
            });
            this_polyline_.openPopup();
        }
    }
}

function plot_this_contact(contact, new_marker_=true){
    if(contact.current_loc != null){
        if (new_marker_){
            var status_icon_colormap = new Map([
                ['routine','blue'],
                ['confidential', 'purple'],
                ['urgent', 'orange'],
                ['immediate', 'red'],
                ['secret', 'darkpurple'],
                ['unknown', 'green']
            ]);
    
            if (contact.status != null){
                var markerIcon_ship = L.AwesomeMarkers.icon({
                    icon:'ship', // ship, rocket, plane, motocycle, fighter-jet, car, bus, bicycle, automobile
                    markerColor:status_icon_colormap.get(contact.status), // red, darkred, orange, green, darkgreen, blue, purple, darkpurple, cadetblue
                    prefix: 'fa',
                });
            } else{
                var markerIcon_ship = L.AwesomeMarkers.icon({
                    icon:'ship', // ship, rocket, plane, motocycle, fighter-jet, car, bus, bicycle, automobile
                    markerColor:status_icon_colormap.get('unknown'), // red, darkred, orange, green, darkgreen, blue, purple, darkpurple, cadetblue
                    prefix: 'fa',
                });
            }
    
            var marker_this_contact_ = L.marker(
                    [contact.current_loc[0], contact.current_loc[1]],
                    {icon : markerIcon_ship}
            );

            marker_this_contact_.addTo(map);

            var this_contact_marker_popup_ = document.createElement('div');
            this_contact_marker_popup_.style.backgroundColor = 'rgb(46, 46, 46)';
            this_contact_marker_popup_.style.color = "antiquewhite";
            this_contact_marker_popup_.style.fontFamily = "Arial, Helvetica, sans-serif";
            this_contact_marker_popup_.style.fontSize = "small";
            this_contact_marker_popup_.style.padding = "5px 5px";
            this_contact_marker_popup_.style.borderRadius = "5px";
            this_contact_marker_popup_.style.border = "1px solid antiquewhite";
            this_contact_marker_popup_.style.width = "100%";
            this_contact_marker_popup_.textContent = contact.designator;
    
            marker_this_contact_.markerId = contact.id+"_marker_id_";

            marker_this_contact_.bindPopup(this_contact_marker_popup_, {
                autoClose: false,
            });
            marker_this_contact_.openPopup();
            
            // const markerpopup = L.popup({
            //     autoClose: true,
            //     closeOnClick: false
            // })
            // .setLatLng(contact.current_loc)
            // .setContent(this_contact_marker_popup_)
            // .addTo(map);
    
            // // Open popup automatically
            // marker_this_contact_.bindPopup(markerpopup).openPopup();
    
            marker_this_contact_.on('mouseover', function(){
                marker_this_contact_.openPopup();
                show_dets_marker(contact);
    
            });
    
            marker_this_contact_.on('click', function(){
                // show_dets_marker(contact);
                // alert("removing contact: " + String(contact.designator));
                
                // remove_marker(contact.id);
                
            });
    
            markers_.set(contact.id+"_marker_id_",  marker_this_contact_);

            if (contact.heading != null){
                addHeadingAndCompass(
                    markers_.get(contact.id+"_marker_id_"), 
                    String(contact.heading), 
                    String(contact.speed),
                    status_icon_colormap.get(contact.status)
                );
            }
            
        } else{
            markers_.get(contact.id + "_marker_id_").addTo(map);
        }
        
    } else{
        return "null location";
    }
}

function addHeadingAndCompass(marker, heading_param, linecolor) {
    const heading = parseFloat(heading_param.replace('°', ''));; // Example heading, you can set this dynamically
    const radius = 15; // Radius for the compass ring

    // Create the compass ring (div)
    const compassRing = L.divIcon({
        className: 'compass-ring',
        iconSize: [radius * 2, radius * 2],
        iconAnchor: [radius, radius],
        html: "<div style='color:antiquewhite; font-size:medium; font-weight:bold;'>" + heading_param + "</div>"
    });

    // Add the compass ring to the map
    const compassMarker = L.marker(marker.getLatLng(), { icon: compassRing });
    marker.compassMarker = compassMarker;
    compassMarker.addTo(map);

    // Calculate the end point of the heading line
    const headingRad = (heading - 90) * (Math.PI / 180); // Convert to radians
    const lineEndLat = marker.getLatLng().lat + Math.sin(headingRad) * 0.07; // 0.1 is the distance in degrees
    const lineEndLng = marker.getLatLng().lng + Math.cos(headingRad) * 0.07;

    // Draw the heading line
    const headingline = L.polyline([marker.getLatLng(), [lineEndLat, lineEndLng]], { color: "red", weight: 3 });
    marker.headingline = headingline;
    headingline.addTo(map);

    marker.on('remove', function (){
        map.removeLayer(headingline);
        map.removeLayer(compassMarker);
    });
}

function capitalize(str) {
    if (!str) return str; // Check for empty string
    return str.toUpperCase().replace(/^(.)(.*)$/, (match, p1, p2) => p1.toUpperCase() + p2.toLowerCase());
}

function show_dets_marker(contact){
    // show basic properties of contact
    var this_marker_report_element_ = document.getElementById("report_box");
    var this_marker_properties_element_ = document.getElementById('stat_box');
    var showtext = "";
    showtext += "<p style='font-size:25px'; font-weight:bold;>" + contact.designator + "<br></p>";
    showtext += "<div style='width:98%'; height:100%; overflow:auto;>";
    var status_icon_colormap = new Map([
        ['routine','blue'],
        ['confidential', 'purple'],
        ['urgent', 'orange'],
        ['immediate', 'red'],
        ['secret', 'darkpurple'],
        ['unknown', 'green']
    ]);
    if (contact.status != null){
        showtext += "<div style='background-color:" + status_icon_colormap.get(contact.status) + "; font-size:25px'; font-weight:bold;'>" + capitalize(String(contact.status)) + " </div> <br>";
    }
    if (contact.current_loc != null){
        showtext += "LAT: " + String(contact.current_loc[0]) + " LON: " + String(contact.current_loc[1]) + "<br><br>";
    }
    if (contact.heading != null){
        showtext += "HEADING: " + contact.heading + "<br><br>";
    }
    if (contact.last_report_time != null){
        showtext += "LAST REPORTED: " + String(contact.last_report_time) + "<br><br>"
    }
    if (contact.speed != null){
        showtext += "SPEED: " + String(contact.speed) + "<br><br>";
    }

    showtext += "<div class='showmorebtn'> SHOW CONTACT PROFILE </div>"
    showtext += "</div>"
    var report_text = "";
    if (contact.meta != null){
        report_text += String(contact.meta) + "<br><br>";
    }
    this_marker_report_element_.innerHTML = report_text;
    this_marker_properties_element_.innerHTML = "";
    this_marker_properties_element_.innerHTML = showtext;
}

function show_dets_zone(zone){
    // show basic properties of contact
    
    var this_zone_properties_element_ = document.getElementById('report_box_zones');
    var showtext = "";
    showtext += "<p style='font-size:25px'; font-weight:bold;>" + zone.desig + "<br></p>";
    showtext += "<div style='width:98%'; height:100%; overflow:auto;>";
    
    if (zone.type != null){
        showtext += "TYPE: " + String(zone.type) + "<br><br>";
    }
    if (zone.desc != null){
        showtext += zone.desc + "<br><br>";
    }
    if (zone.coords != null){
        showtext += "COORDS: " + String(zone.coords) + "<br><br>"
    }

    // showtext += "<div class='showmorebtn'> SHOW CONTACT PROFILE </div>"
    showtext += "</div>"

    this_zone_properties_element_.innerHTML = "";
    this_zone_properties_element_.innerHTML = showtext;
}

