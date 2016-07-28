/**
 * Welcome to Pebble.js!
 *
 * This is where you write your app.
 */

var UI = require('ui');
var Vibe = require('ui/vibe');
var Settings = require('settings');
var Clay = require('./clay');
var clayConfig = require('./config');
var clay = new Clay(clayConfig, null, {autoHandleEvents: false});
var whitelist;
var Vector2 = require('vector2');

Pebble.addEventListener('showConfiguration', function(e) {
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function(e) {
  if (e && !e.response) {
    return;
  }
  var dict = clay.getSettings(e.response);

  // Save the Clay settings to the Settings module. 
  Settings.option(dict);
});

var _pokedex = {"1":"Bulbasaur","2":"Ivysaur","3":"Venusaur","4":"Charmander","5":"Charmeleon","6":"Charizard","7":"Squirtle","8":"Wartortle","9":"Blastoise","10":"Caterpie","11":"Metapod","12":"Butterfree","13":"Weedle","14":"Kakuna","15":"Beedrill","16":"Pidgey","17":"Pidgeotto","18":"Pidgeot","19":"Rattata","20":"Raticate","21":"Spearow","22":"Fearow","23":"Ekans","24":"Arbok","25":"Pikachu","26":"Raichu","27":"Sandshrew","28":"Sandslash","29":"Nidoran\u2640","30":"Nidorina","31":"Nidoqueen","32":"Nidoran\u2642","33":"Nidorino","34":"Nidoking","35":"Clefairy","36":"Clefable","37":"Vulpix","38":"Ninetales","39":"Jigglypuff","40":"Wigglytuff","41":"Zubat","42":"Golbat","43":"Oddish","44":"Gloom","45":"Vileplume","46":"Paras","47":"Parasect","48":"Venonat","49":"Venomoth","50":"Diglett","51":"Dugtrio","52":"Meowth","53":"Persian","54":"Psyduck","55":"Golduck","56":"Mankey","57":"Primeape","58":"Growlithe","59":"Arcanine","60":"Poliwag","61":"Poliwhirl","62":"Poliwrath","63":"Abra","64":"Kadabra","65":"Alakazam","66":"Machop","67":"Machoke","68":"Machamp","69":"Bellsprout","70":"Weepinbell","71":"Victreebel","72":"Tentacool","73":"Tentacruel","74":"Geodude","75":"Graveler","76":"Golem","77":"Ponyta","78":"Rapidash","79":"Slowpoke","80":"Slowbro","81":"Magnemite","82":"Magneton","83":"Farfetch'd","84":"Doduo","85":"Dodrio","86":"Seel","87":"Dewgong","88":"Grimer","89":"Muk","90":"Shellder","91":"Cloyster","92":"Gastly","93":"Haunter","94":"Gengar","95":"Onix","96":"Drowzee","97":"Hypno","98":"Krabby","99":"Kingler","100":"Voltorb","101":"Electrode","102":"Exeggcute","103":"Exeggutor","104":"Cubone","105":"Marowak","106":"Hitmonlee","107":"Hitmonchan","108":"Lickitung","109":"Koffing","110":"Weezing","111":"Rhyhorn","112":"Rhydon","113":"Chansey","114":"Tangela","115":"Kangaskhan","116":"Horsea","117":"Seadra","118":"Goldeen","119":"Seaking","120":"Staryu","121":"Starmie","122":"Mr. Mime","123":"Scyther","124":"Jynx","125":"Electabuzz","126":"Magmar","127":"Pinsir","128":"Tauros","129":"Magikarp","130":"Gyarados","131":"Lapras","132":"Ditto","133":"Eevee","134":"Vaporeon","135":"Jolteon","136":"Flareon","137":"Porygon","138":"Omanyte","139":"Omastar","140":"Kabuto","141":"Kabutops","142":"Aerodactyl","143":"Snorlax","144":"Articuno","145":"Zapdos","146":"Moltres","147":"Dratini","148":"Dragonair","149":"Dragonite","150":"Mewtwo","151":"Mew"};
var _location;
var listUI;
var loadingScreen;
var pokelist = [];
var loading = true;

//location stuff
var watchId;
var options = {
  enableHighAccuracy: true,
  maximumAge: 10000,
  timeout: 10000
};

var navWindow;
var Polyline = require('./polyline.js');
var navWatch;
var rad;

function Log(message)
{
  console.log(message);
}

function onMissingConfig()
{
  var ecard = new UI.Card();
  ecard.title('No configuration');
  ecard.body('Please run the configuration to set the Pokemon filter and restart the app');
  ecard.show();
}

function init()
{
  whitelist = Settings.option("whitelist");
  if(!whitelist)
    {
      onMissingConfig();
    } else {
  
  listUI = new UI.Menu({
    sections: [{
    title: 'Initializing...'
  }]
  });
  listUI.on('select', onMenuSelect);
  listUI.on('longSelect', onMenuLongSelect);

  loadingScreen = new UI.Card();
  loadingScreen.title("Loading...");
  loadingScreen.subtitle("Initializing...");
  loadingScreen.show();
  
  getLocation();
    }
}

function onMenuSelect(e)
{
  //get directions
  var pokemon = e.item.data;
  //listUI.hide();
  openNavWindow(pokemon);
}

function onMenuLongSelect(e)
{
  //hide
  pokelist[e.item.data.id].hidden = true;
  processPokemon(_location, pokelist);
}

function getLocation()
{
  loadingScreen.subtitle("Getting location...");
  navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError, options);
}

function onLocationSuccess(pos)
{
  _location = pos;
  watchId = navigator.geolocation.watchPosition(onNewPosition, onLocationError, options);
  loadingScreen.subtitle('Scanning location...');
  scanLocation();
}

function onNewPosition(pos)
{
  _location = pos;
  //refresh menu
  if(pokelist && Object.keys(pokelist).length > 0)
    processPokemon(_location, pokelist);
}

function onLocationError(err){
  var ecard = new UI.Card();
  ecard.title('Location Error');
  ecard.body('location error (' + err.code + '): ' + err.message);
  ecard.show();
}

var xhrRequest = function (url, type, callback, location, jobId) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    callback(this.responseText, location, jobId);
  };
  xhr.open(type, url);
  xhr.send();
};

function scanLocation()
{
  //do scan
  var url = 'https://pokevision.com/map/scan/' + _location.coords.latitude + '/' + _location.coords.longitude;
  if(loading)
    listUI.section(0).title = 'Scanning...';
  xhrRequest(url, 'GET', onScanComplete, _location, 0);
}

function getMapData(location, jobId)
{
  var url = 'https://pokevision.com/map/data/' + location.coords.latitude + '/' + location.coords.longitude;
  if(jobId !== 0){
    url += '/' + jobId;
  }
  if(loading)
    loadingScreen.subtitle("Fetching Pokemon...");
  listUI.section(0).title = 'Scan complete';
  xhrRequest(url, 'GET', onDataFetchComplete, location, jobId);
}

function onScanComplete(response, location, jobId)
{
  Log('Scan completed. ' + response);
  var json = JSON.parse(response);
  if(!(json && json.status == 'success' && json.jobId))
    onGetDataError();
  getMapData(location, json.jobId);
}

function onGetDataError()
{
  var ecard = new UI.Card();
  ecard.title('Data Error');
  ecard.body('Could not load data. Restart app.');
  ecard.show();
}

function onDataFetchComplete(response, location, jobId)
{  
  Log('Done fetching data. ' + response);
  var json = JSON.parse(response);
  if(!(json && json.status == 'success'))
    onGetDataError();
  //wait for job
  if(json.jobStatus == 'in_progress')
    {
      //backoff and wait
      setTimeout(function() {
        getMapData(location, jobId);
      }, 10000);
    }
  else {
    if(json.jobStatus != 'failure')
    {
      processPokelist(json.pokemon);
      processPokemon(location, pokelist);	
      if(loading)
        {
          loading = false;
          listUI.show();
          loadingScreen.hide();
        }
    }
    
    //schedule next
    setTimeout(function() { scanLocation(); }, 31000);
  }
}

String.prototype.hashCode = function() {
  var hash = 0, i, chr, len;
  if (this.length === 0) return hash;
  for (i = 0, len = this.length; i < len; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

function processPokelist(items)
{
  //add new
  var vibrate = false;
  for(var i = 0; i < items.length;i++)
    {
      var pokemon = items[i];
      pokemon.id = ("P" + pokemon.pokemon_id + pokemon.latitude + pokemon.longitude).hashCode();
      if(!pokelist[items[i].id] && whitelist.indexOf(pokemon.pokemonId + "") > 1)
        {
          //insert
          Log('Added pokemon ' + items[i].id);
          pokelist[items[i].id] = items[i];
          vibrate = true;
        }
    }  
  if(vibrate)
    {
      Vibe.vibrate('short');
    }
}

function processPokemon(location, list)
{
    var pokemonlist = {
	  normal: [],
	  favorite: [],
	  unique: []
	  };
  var inrange = false;
  for(var key in list)
  {
    var now = Math.floor(Date.now() / 1000);
     if(now > list[key].expiration_time)
        {
          //remove
          Log('Removed pokemon ' + pokelist[key].id);
          delete pokelist[key];
          continue;
        }
	var pokemon = list[key];
    if(pokemon.hidden)
      {
        //hidden
        continue;
      }
    pokemon = processSinglePokemon(pokemon, location);
    if(pokemon.inrange)
      {
        inrange = true;
      }
	pokemonlist.normal.push(pokemon);
  }
  //sort by distance
  pokemonlist.normal = pokemonlist.normal.sort(function(a,b) {return (Number(a.distance) > Number(b.distance)) ? 1 : ((Number(b.distance) > Number(a.distance))? -1 : 0);} );
  
  if(inrange)
    {
        Vibe.vibrate('long');
    }
  
  //update UI
  updateListUI(pokemonlist.normal);
}

function processSinglePokemon(pokemon, location)
{
  
	pokemon.name = _pokedex[pokemon.pokemonId];
	//calculate dist etc
    var mylocation = new LatLon(location.coords.latitude, location.coords.longitude);
	var pokelocation = new LatLon(pokemon.latitude, pokemon.longitude);
    var olddistance = pokemon.distance;
	pokemon.distance = Math.round(mylocation.distanceTo(pokelocation));
    if((pokemon.distance < olddistance && pokemon.distance <= 50 && olddistance > 50) || (pokemon.distance <= 50 && !olddistance))
      {
        pokemon.inrange = true;
        Log(pokemon.name + ' in range! Distance ' + pokemon.distance + 'm, old ' + olddistance);
      }
  else { 
    pokemon.inrange = false;
  }
	pokemon.heading = Math.round(mylocation.bearingTo(pokelocation));
    pokemon.remaining = getRemainingTime(pokemon.expiration_time);
  return pokemon;
}

function getHeading(heading)
{
  var dir;
if (heading >= 0 && heading <= 11.25)
{
 dir = "N";
}
if (heading > 348.75 && heading <= 360)
{
 dir = "N";
}
if (heading > 11.25 && heading <= 33.75)
{
 dir = "NNE";
}
if (heading > 33.75 && heading <= 56.25)
{
 dir = "NE";
}
if (heading > 56.25 && heading <= 78.75)
{
 dir = "ENE";
}
if (heading > 78.75 && heading <= 101.25)
{
 dir = "E";
}
if (heading > 101.25 && heading <= 123.75)
{
 dir = "ESE";
}
if (heading > 123.75 && heading <= 146.25)
{
 dir = "SE";
}
if (heading > 146.25 && heading <= 168.75)
{
 dir = "SSE";
}
if (heading > 168.75 && heading <= 191.25)
{
 dir = "S";
}
if (heading > 191.25 && heading <= 213.75)
{
 dir = "SSW";
}
if (heading > 213.75 && heading <= 236.25)
{
 dir = "SW";
}
if (heading > 236.25 && heading <= 258.75)
{
 dir = "WSW";
}
if (heading > 258.75 && heading <= 281.25)
{
 dir = "W";
}
if (heading > 281.25 && heading <= 303.75)
{
 dir = "WNW";
}
if (heading > 303.75 && heading <= 326.25)
{
 dir = "NW";
}
if (heading > 326.25 && heading <= 348.75)
{
 dir = "NNW";
}
  return dir;
}

function getRemainingTime(endoflife)
{
  var now = Math.floor(Date.now() / 1000);
  var diff = endoflife - now;
  if(diff <= 0)
    diff = 1;//sanity check
  var minutes = parseInt( diff / 60 ) % 60;
  var seconds = diff % 60; 
  if(seconds < 10) { seconds = '0' + seconds;}
  return minutes + ':' + seconds;
}

function parsePokemonToItems(items)
{
  var menuitems = [];
  for(var i = 0; i < items.length; i++)
    {
      var item = {
        title: items[i].name + ' (' + items[i].remaining + ')',
        subtitle: items[i].distance + 'm, ' + getHeading(items[i].heading),
        data: items[i]
      };
      menuitems.push(item);
    }
  return menuitems;
}

function updateListUI(list)
{
  var items = parsePokemonToItems(list);
  listUI.items(0, items);
  listUI.section(0).title = Object.keys(pokelist).length + " pokemon nearby";
}

function openNavWindow(pokemon)
{
  navWindow = new UI.Window({
    backgroundColor: 'white'
  });
  navWindow.on('hide', onNavWindowHide);
  navWindow.pokemon = pokemon;
  navWindow.on('click', 'up', function() { if(navWindow.zoom < 10){ navWindow.zoom++;Log("Zoom is now " + navWindow.zoom); navRedraw();} });
  navWindow.on('click', 'down', function() {if(navWindow.zoom > 1) { navWindow.zoom--;Log("Zoom is now " + navWindow.zoom); navRedraw();} });
  navWindow.show();
  //start nav
  getDirections(pokemon);
}

function onNavWindowHide()
{
  navigator.geolocation.clearWatch(navWatch);
}

function getDirections(pokemon)
{
  var url = "https://maps.googleapis.com/maps/api/directions/json?origin=" +
      _location.coords.latitude +
      "," +
      _location.coords.longitude +
      "&destination=" +
      pokemon.latitude +
      "," +
      pokemon.longitude +
      "&mode=walking";
  //Log(url);
  xhrRequest(url, 'GET', onGetDirectionsSuccess, 0, 0);
}

function onGetDirectionsSuccess(response, foo, bar)
{
  //Log(response);
  navWindow.locationResponse = JSON.parse(response);
  navWindow.zoom = 10;//min: 1, max: 10
  
//   rad = new UI.Radial({
//     position: new Vector2(47, 59),
//     size: new Vector2(50, 50),
//     borderColor: 'black'
//   });
  var poscircle = new UI.Circle({
    position: new Vector2(72, 84),
    radius: 2,
    backgroundColor: 'black'
  });
  navWindow.add(poscircle);
//   navWindow.add(rad);
  
  if(navWindow.locationResponse.status == "OK")
  {
    //Log(navWindow.locationResponse);
    var polylines = Polyline.decode(navWindow.locationResponse.routes[0].overview_polyline.points);
    navWindow.polylines = [];
    //create polyline elements
    for(var i = 0; i < (polylines.length - 1);i++)
    {
      var polystart = polylines[i];
      var polyend = polylines[i + 1];
      var poly = {
        lat1: polystart[0],
        lon1: polystart[1],
        lat2: polyend[0],
        lon2: polyend[1]
      };
      var p1 = getOnScreenPosition(poly.lat1, poly.lon1);
      var p2 = getOnScreenPosition(poly.lat2, poly.lon2);
      poly.line= new UI.Line({
        position: new Vector2(p1.x, p1.y),
        position2: new Vector2(p2.x, p2.y),
        strokeColor: 'black'
      });
     navWindow.add(poly.line);
      navWindow.polylines.push(poly);
    }
    navWatch = navigator.geolocation.watchPosition(gpsPing, function(){}, options);
  }
}

// function zoomRedraw()
// {
//   var pos = rad.position();
//   var size = rad.size();
  
//   var radius = 50;
//   pos.x = (72 - Math.round((radius * (navWindow.zoom / 10)) / 2));
//   pos.y = (84 - Math.round((radius * (navWindow.zoom / 10)) / 2));
//   size.x = Math.round(radius * (navWindow.zoom / 10));
//   size.y = Math.round(radius * (navWindow.zoom / 10));
  
//   // Schedule the animation with an animateDef
//   rad.animate({ position: pos, size: size }, 0);
// }

function navRedraw()
{
  for(var i = 0; i < navWindow.polylines.length;i++)
  {
    var pos1 = getOnScreenPosition(navWindow.polylines[i].lat1, navWindow.polylines[i].lon1);
    var pos2 = getOnScreenPosition(navWindow.polylines[i].lat2, navWindow.polylines[i].lon2);
    var vec1 = navWindow.polylines[i].line.position();
    var vec2 = navWindow.polylines[i].line.position2();
    vec1.x = pos1.x;
    vec1.y = pos1.y;
    vec2.x = pos2.x;
    vec2.y = pos2.y;
    navWindow.polylines[i].line.animate({
      position: vec1,
      position2: vec2
    }, 0);
  }
}

function gpsPing(loc)
{
  _location = loc;
  navRedraw();
}

function getOnScreenPosition(lat, lon)
{
  var mylat = _location.coords.latitude;
  var mylon = _location.coords.longitude;
  
  var dlat = lat - mylat;
  var dlon = lon - mylon;
  
  dlat = Math.round((dlat / 0.000009) * (navWindow.zoom / 10));
  dlon = Math.round((dlon / 0.000009) * (navWindow.zoom / 10));
  //center = 72, 84
  return {
    x: (dlon + 72),
    y: (84 - dlat)
  };
}

init();





/**
 * Creates a LatLon point on the earth's surface at the specified latitude / longitude.
 *
 * @constructor
 * @param {number} lat - Latitude in degrees.
 * @param {number} lon - Longitude in degrees.
 *
 * @example
 *     var p1 = new LatLon(52.205, 0.119);
 */
 function LatLon (lat, lon) {
    // allow instantiation without 'new'
    if (!(this instanceof LatLon)) return new LatLon(lat, lon);

    this.lat = Number(lat);
    this.lon = Number(lon);
}


/**
 * Returns the distance from ‘this’ point to destination point (using haversine formula).
 *
 * @param   {LatLon} point - Latitude/longitude of destination point.
 * @param   {number} [radius=6371e3] - (Mean) radius of earth (defaults to radius in metres).
 * @returns {number} Distance between this point and destination point, in same units as radius.
 *
 * @example
 *     var p1 = new LatLon(52.205, 0.119);
 *     var p2 = new LatLon(48.857, 2.351);
 *     var d = p1.distanceTo(p2); // 404.3 km
 */
LatLon.prototype.distanceTo = function(point, radius) {
    if (!(point instanceof LatLon)) throw new TypeError('point is not LatLon object');
    radius = (radius === undefined) ? 6371e3 : Number(radius);

    var R = radius;
    var φ1 = this.lat.toRadians(),  λ1 = this.lon.toRadians();
    var φ2 = point.lat.toRadians(), λ2 = point.lon.toRadians();
    var Δφ = φ2 - φ1;
    var Δλ = λ2 - λ1;

    var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;

    return d;
};


/**
 * Returns the (initial) bearing from ‘this’ point to destination point.
 *
 * @param   {LatLon} point - Latitude/longitude of destination point.
 * @returns {number} Initial bearing in degrees from north.
 *
 * @example
 *     var p1 = new LatLon(52.205, 0.119);
 *     var p2 = new LatLon(48.857, 2.351);
 *     var b1 = p1.bearingTo(p2); // 156.2°
 */
LatLon.prototype.bearingTo = function(point) {
    if (!(point instanceof LatLon)) throw new TypeError('point is not LatLon object');

    var φ1 = this.lat.toRadians(), φ2 = point.lat.toRadians();
    var Δλ = (point.lon-this.lon).toRadians();

    // see http://mathforum.org/library/drmath/view/55417.html
    var y = Math.sin(Δλ) * Math.cos(φ2);
    var x = Math.cos(φ1)*Math.sin(φ2) -
            Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    var θ = Math.atan2(y, x);

    return (θ.toDegrees()+360) % 360;
};


/**
 * Returns final bearing arriving at destination destination point from ‘this’ point; the final bearing
 * will differ from the initial bearing by varying degrees according to distance and latitude.
 *
 * @param   {LatLon} point - Latitude/longitude of destination point.
 * @returns {number} Final bearing in degrees from north.
 *
 * @example
 *     var p1 = new LatLon(52.205, 0.119);
 *     var p2 = new LatLon(48.857, 2.351);
 *     var b2 = p1.finalBearingTo(p2); // 157.9°
 */
LatLon.prototype.finalBearingTo = function(point) {
    if (!(point instanceof LatLon)) throw new TypeError('point is not LatLon object');

    // get initial bearing from destination point to this point & reverse it by adding 180°
    return ( point.bearingTo(this)+180 ) % 360;
};


/**
 * Returns the midpoint between ‘this’ point and the supplied point.
 *
 * @param   {LatLon} point - Latitude/longitude of destination point.
 * @returns {LatLon} Midpoint between this point and the supplied point.
 *
 * @example
 *     var p1 = new LatLon(52.205, 0.119);
 *     var p2 = new LatLon(48.857, 2.351);
 *     var pMid = p1.midpointTo(p2); // 50.5363°N, 001.2746°E
 */
LatLon.prototype.midpointTo = function(point) {
    if (!(point instanceof LatLon)) throw new TypeError('point is not LatLon object');

    // φm = atan2( sinφ1 + sinφ2, √( (cosφ1 + cosφ2⋅cosΔλ) ⋅ (cosφ1 + cosφ2⋅cosΔλ) ) + cos²φ2⋅sin²Δλ )
    // λm = λ1 + atan2(cosφ2⋅sinΔλ, cosφ1 + cosφ2⋅cosΔλ)
    // see http://mathforum.org/library/drmath/view/51822.html for derivation

    var φ1 = this.lat.toRadians(), λ1 = this.lon.toRadians();
    var φ2 = point.lat.toRadians();
    var Δλ = (point.lon-this.lon).toRadians();

    var Bx = Math.cos(φ2) * Math.cos(Δλ);
    var By = Math.cos(φ2) * Math.sin(Δλ);

    var x = Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By);
    var y = Math.sin(φ1) + Math.sin(φ2);
    var φ3 = Math.atan2(y, x);

    var λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);

    return new LatLon(φ3.toDegrees(), (λ3.toDegrees()+540)%360-180); // normalise to −180..+180°
};


/**
 * Returns the destination point from ‘this’ point having travelled the given distance on the
 * given initial bearing (bearing normally varies around path followed).
 *
 * @param   {number} distance - Distance travelled, in same units as earth radius (default: metres).
 * @param   {number} bearing - Initial bearing in degrees from north.
 * @param   {number} [radius=6371e3] - (Mean) radius of earth (defaults to radius in metres).
 * @returns {LatLon} Destination point.
 *
 * @example
 *     var p1 = new LatLon(51.4778, -0.0015);
 *     var p2 = p1.destinationPoint(7794, 300.7); // 51.5135°N, 000.0983°W
 */
LatLon.prototype.destinationPoint = function(distance, bearing, radius) {
    radius = (radius === undefined) ? 6371e3 : Number(radius);

    // φ2 = asin( sinφ1⋅cosδ + cosφ1⋅sinδ⋅cosθ )
    // λ2 = λ1 + atan2( sinθ⋅sinδ⋅cosφ1, cosδ − sinφ1⋅sinφ2 )
    // see http://williams.best.vwh.net/avform.htm#LL

    var δ = Number(distance) / radius; // angular distance in radians
    var θ = Number(bearing).toRadians();

    var φ1 = this.lat.toRadians();
    var λ1 = this.lon.toRadians();

    var φ2 = Math.asin(Math.sin(φ1)*Math.cos(δ) + Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
    var x = Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2);
    var y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
    var λ2 = λ1 + Math.atan2(y, x);

    return new LatLon(φ2.toDegrees(), (λ2.toDegrees()+540)%360-180); // normalise to −180..+180°
};


/**
 * Returns the point of intersection of two paths defined by point and bearing.
 *
 * @param   {LatLon} p1 - First point.
 * @param   {number} brng1 - Initial bearing from first point.
 * @param   {LatLon} p2 - Second point.
 * @param   {number} brng2 - Initial bearing from second point.
 * @returns {LatLon|null} Destination point (null if no unique intersection defined).
 *
 * @example
 *     var p1 = LatLon(51.8853, 0.2545), brng1 = 108.547;
 *     var p2 = LatLon(49.0034, 2.5735), brng2 =  32.435;
 *     var pInt = LatLon.intersection(p1, brng1, p2, brng2); // 50.9078°N, 004.5084°E
 */
LatLon.intersection = function(p1, brng1, p2, brng2) {
    if (!(p1 instanceof LatLon)) throw new TypeError('p1 is not LatLon object');
    if (!(p2 instanceof LatLon)) throw new TypeError('p2 is not LatLon object');

    // see http://williams.best.vwh.net/avform.htm#Intersection

    var φ1 = p1.lat.toRadians(), λ1 = p1.lon.toRadians();
    var φ2 = p2.lat.toRadians(), λ2 = p2.lon.toRadians();
    var θ13 = Number(brng1).toRadians(), θ23 = Number(brng2).toRadians();
    var Δφ = φ2-φ1, Δλ = λ2-λ1;

    var δ12 = 2*Math.asin( Math.sqrt( Math.sin(Δφ/2)*Math.sin(Δφ/2) + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)*Math.sin(Δλ/2) ) );
    if (δ12 === 0) return null;

    // initial/final bearings between points
    var θ1 = Math.acos( ( Math.sin(φ2) - Math.sin(φ1)*Math.cos(δ12) ) / ( Math.sin(δ12)*Math.cos(φ1) ) );
    if (isNaN(θ1)) θ1 = 0; // protect against rounding
    var θ2 = Math.acos( ( Math.sin(φ1) - Math.sin(φ2)*Math.cos(δ12) ) / ( Math.sin(δ12)*Math.cos(φ2) ) );

    var θ12 = Math.sin(λ2-λ1)>0 ? θ1 : 2*Math.PI-θ1;
    var θ21 = Math.sin(λ2-λ1)>0 ? 2*Math.PI-θ2 : θ2;

    var α1 = (θ13 - θ12 + Math.PI) % (2*Math.PI) - Math.PI; // angle 2-1-3
    var α2 = (θ21 - θ23 + Math.PI) % (2*Math.PI) - Math.PI; // angle 1-2-3

    if (Math.sin(α1)===0 && Math.sin(α2)===0) return null; // infinite intersections
    if (Math.sin(α1)*Math.sin(α2) < 0) return null;      // ambiguous intersection

    //α1 = Math.abs(α1);
    //α2 = Math.abs(α2);
    // ... Ed Williams takes abs of α1/α2, but seems to break calculation?

    var α3 = Math.acos( -Math.cos(α1)*Math.cos(α2) + Math.sin(α1)*Math.sin(α2)*Math.cos(δ12) );
    var δ13 = Math.atan2( Math.sin(δ12)*Math.sin(α1)*Math.sin(α2), Math.cos(α2)+Math.cos(α1)*Math.cos(α3) );
    var φ3 = Math.asin( Math.sin(φ1)*Math.cos(δ13) + Math.cos(φ1)*Math.sin(δ13)*Math.cos(θ13) );
    var Δλ13 = Math.atan2( Math.sin(θ13)*Math.sin(δ13)*Math.cos(φ1), Math.cos(δ13)-Math.sin(φ1)*Math.sin(φ3) );
    var λ3 = λ1 + Δλ13;

    return new LatLon(φ3.toDegrees(), (λ3.toDegrees()+540)%360-180); // normalise to −180..+180°
};


/**
 * Returns (signed) distance from ‘this’ point to great circle defined by start-point and end-point.
 *
 * @param   {LatLon} pathStart - Start point of great circle path.
 * @param   {LatLon} pathEnd - End point of great circle path.
 * @param   {number} [radius=6371e3] - (Mean) radius of earth (defaults to radius in metres).
 * @returns {number} Distance to great circle (-ve if to left, +ve if to right of path).
 *
 * @example
 *   var pCurrent = new LatLon(53.2611, -0.7972);
 *   var p1 = new LatLon(53.3206, -1.7297);
 *   var p2 = new LatLon(53.1887,  0.1334);
 *   var d = pCurrent.crossTrackDistanceTo(p1, p2);  // -307.5 m
 */
LatLon.prototype.crossTrackDistanceTo = function(pathStart, pathEnd, radius) {
    if (!(pathStart instanceof LatLon)) throw new TypeError('pathStart is not LatLon object');
    if (!(pathEnd instanceof LatLon)) throw new TypeError('pathEnd is not LatLon object');
    radius = (radius === undefined) ? 6371e3 : Number(radius);

    var δ13 = pathStart.distanceTo(this, radius)/radius;
    var θ13 = pathStart.bearingTo(this).toRadians();
    var θ12 = pathStart.bearingTo(pathEnd).toRadians();

    var dxt = Math.asin( Math.sin(δ13) * Math.sin(θ13-θ12) ) * radius;

    return dxt;
};


/**
 * Returns maximum latitude reached when travelling on a great circle on given bearing from this
 * point ('Clairaut's formula'). Negate the result for the minimum latitude (in the Southern
 * hemisphere).
 *
 * The maximum latitude is independent of longitude; it will be the same for all points on a given
 * latitude.
 *
 * @param {number} bearing - Initial bearing.
 * @param {number} latitude - Starting latitude.
 */
LatLon.prototype.maxLatitude = function(bearing) {
    var θ = Number(bearing).toRadians();

    var φ = this.lat.toRadians();

    var φMax = Math.acos(Math.abs(Math.sin(θ)*Math.cos(φ)));

    return φMax.toDegrees();
};


/**
 * Returns the pair of meridians at which a great circle defined by two points crosses the given
 * latitude. If the great circle doesn't reach the given latitude, null is returned.
 *
 * @param {LatLon} point1 - First point defining great circle.
 * @param {LatLon} point2 - Second point defining great circle.
 * @param {number} latitude - Latitude crossings are to be determined for.
 * @returns {Object|null} Object containing { lon1, lon2 } or null if given latitude not reached.
 */
LatLon.crossingParallels = function(point1, point2, latitude) {
    var φ = Number(latitude).toRadians();

    var φ1 = point1.lat.toRadians();
    var λ1 = point1.lon.toRadians();
    var φ2 = point2.lat.toRadians();
    var λ2 = point2.lon.toRadians();

    var Δλ = λ2 - λ1;

    var x = Math.sin(φ1) * Math.cos(φ2) * Math.cos(φ) * Math.sin(Δλ);
    var y = Math.sin(φ1) * Math.cos(φ2) * Math.cos(φ) * Math.cos(Δλ) - Math.cos(φ1) * Math.sin(φ2) * Math.cos(φ);
    var z = Math.cos(φ1) * Math.cos(φ2) * Math.sin(φ) * Math.sin(Δλ);

    if (z*z > x*x + y*y) return null; // great circle doesn't reach latitude

    var λm = Math.atan2(-y, x);                  // longitude at max latitude
    var Δλi = Math.acos(z / Math.sqrt(x*x+y*y)); // Δλ from λm to intersection points

    var λi1 = λ1 + λm - Δλi;
    var λi2 = λ1 + λm + Δλi;

    return { lon1: (λi1.toDegrees()+540)%360-180, lon2: (λi2.toDegrees()+540)%360-180 }; // normalise to −180..+180°
};


/* Rhumb - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

/**
 * Returns the distance travelling from ‘this’ point to destination point along a rhumb line.
 *
 * @param   {LatLon} point - Latitude/longitude of destination point.
 * @param   {number} [radius=6371e3] - (Mean) radius of earth (defaults to radius in metres).
 * @returns {number} Distance in km between this point and destination point (same units as radius).
 *
 * @example
 *     var p1 = new LatLon(51.127, 1.338);
 *     var p2 = new LatLon(50.964, 1.853);
 *     var d = p1.distanceTo(p2); // 40.31 km
 */
LatLon.prototype.rhumbDistanceTo = function(point, radius) {
    if (!(point instanceof LatLon)) throw new TypeError('point is not LatLon object');
    radius = (radius === undefined) ? 6371e3 : Number(radius);

    // see http://williams.best.vwh.net/avform.htm#Rhumb

    var R = radius;
    var φ1 = this.lat.toRadians(), φ2 = point.lat.toRadians();
    var Δφ = φ2 - φ1;
    var Δλ = Math.abs(point.lon-this.lon).toRadians();
    // if dLon over 180° take shorter rhumb line across the anti-meridian:
    if (Math.abs(Δλ) > Math.PI) Δλ = Δλ>0 ? -(2*Math.PI-Δλ) : (2*Math.PI+Δλ);

    // on Mercator projection, longitude distances shrink by latitude; q is the 'stretch factor'
    // q becomes ill-conditioned along E-W line (0/0); use empirical tolerance to avoid it
    var Δψ = Math.log(Math.tan(φ2/2+Math.PI/4)/Math.tan(φ1/2+Math.PI/4));
    var q = Math.abs(Δψ) > 10e-12 ? Δφ/Δψ : Math.cos(φ1);

    // distance is pythagoras on 'stretched' Mercator projection
    var δ = Math.sqrt(Δφ*Δφ + q*q*Δλ*Δλ); // angular distance in radians
    var dist = δ * R;

    return dist;
};


/**
 * Returns the bearing from ‘this’ point to destination point along a rhumb line.
 *
 * @param   {LatLon} point - Latitude/longitude of destination point.
 * @returns {number} Bearing in degrees from north.
 *
 * @example
 *     var p1 = new LatLon(51.127, 1.338);
 *     var p2 = new LatLon(50.964, 1.853);
 *     var d = p1.rhumbBearingTo(p2); // 116.7 m
 */
LatLon.prototype.rhumbBearingTo = function(point) {
    if (!(point instanceof LatLon)) throw new TypeError('point is not LatLon object');

    var φ1 = this.lat.toRadians(), φ2 = point.lat.toRadians();
    var Δλ = (point.lon-this.lon).toRadians();
    // if dLon over 180° take shorter rhumb line across the anti-meridian:
    if (Math.abs(Δλ) > Math.PI) Δλ = Δλ>0 ? -(2*Math.PI-Δλ) : (2*Math.PI+Δλ);

    var Δψ = Math.log(Math.tan(φ2/2+Math.PI/4)/Math.tan(φ1/2+Math.PI/4));

    var θ = Math.atan2(Δλ, Δψ);

    return (θ.toDegrees()+360) % 360;
};


/**
 * Returns the destination point having travelled along a rhumb line from ‘this’ point the given
 * distance on the  given bearing.
 *
 * @param   {number} distance - Distance travelled, in same units as earth radius (default: metres).
 * @param   {number} bearing - Bearing in degrees from north.
 * @param   {number} [radius=6371e3] - (Mean) radius of earth (defaults to radius in metres).
 * @returns {LatLon} Destination point.
 *
 * @example
 *     var p1 = new LatLon(51.127, 1.338);
 *     var p2 = p1.rhumbDestinationPoint(40300, 116.7); // 50.9642°N, 001.8530°E
 */
LatLon.prototype.rhumbDestinationPoint = function(distance, bearing, radius) {
    radius = (radius === undefined) ? 6371e3 : Number(radius);

    var δ = Number(distance) / radius; // angular distance in radians
    var φ1 = this.lat.toRadians(), λ1 = this.lon.toRadians();
    var θ = Number(bearing).toRadians();

    var Δφ = δ * Math.cos(θ);
    var φ2 = φ1 + Δφ;

    // check for some daft bugger going past the pole, normalise latitude if so
    if (Math.abs(φ2) > Math.PI/2) φ2 = φ2>0 ? Math.PI-φ2 : -Math.PI-φ2;

    var Δψ = Math.log(Math.tan(φ2/2+Math.PI/4)/Math.tan(φ1/2+Math.PI/4));
    var q = Math.abs(Δψ) > 10e-12 ? Δφ / Δψ : Math.cos(φ1); // E-W course becomes ill-conditioned with 0/0

    var Δλ = δ*Math.sin(θ)/q;
    var λ2 = λ1 + Δλ;

    return new LatLon(φ2.toDegrees(), (λ2.toDegrees()+540) % 360 - 180); // normalise to −180..+180°
};


/**
 * Returns the loxodromic midpoint (along a rhumb line) between ‘this’ point and second point.
 *
 * @param   {LatLon} point - Latitude/longitude of second point.
 * @returns {LatLon} Midpoint between this point and second point.
 *
 * @example
 *     var p1 = new LatLon(51.127, 1.338);
 *     var p2 = new LatLon(50.964, 1.853);
 *     var pMid = p1.rhumbMidpointTo(p2); // 51.0455°N, 001.5957°E
 */
LatLon.prototype.rhumbMidpointTo = function(point) {
    if (!(point instanceof LatLon)) throw new TypeError('point is not LatLon object');

    // http://mathforum.org/kb/message.jspa?messageID=148837

    var φ1 = this.lat.toRadians(), λ1 = this.lon.toRadians();
    var φ2 = point.lat.toRadians(), λ2 = point.lon.toRadians();

    if (Math.abs(λ2-λ1) > Math.PI) λ1 += 2*Math.PI; // crossing anti-meridian

    var φ3 = (φ1+φ2)/2;
    var f1 = Math.tan(Math.PI/4 + φ1/2);
    var f2 = Math.tan(Math.PI/4 + φ2/2);
    var f3 = Math.tan(Math.PI/4 + φ3/2);
    var λ3 = ( (λ2-λ1)*Math.log(f3) + λ1*Math.log(f2) - λ2*Math.log(f1) ) / Math.log(f2/f1);

    if (!isFinite(λ3)) λ3 = (λ1+λ2)/2; // parallel of latitude

    var p = LatLon(φ3.toDegrees(), (λ3.toDegrees()+540)%360-180); // normalise to −180..+180°

    return p;
};


/**
 * Returns a string representation of ‘this’ point, formatted as degrees, degrees+minutes, or
 * degrees+minutes+seconds.
 *
 * @param   {string} [format=dms] - Format point as 'd', 'dm', 'dms'.
 * @param   {number} [dp=0|2|4] - Number of decimal places to use - default 0 for dms, 2 for dm, 4 for d.
 * @returns {string} Comma-separated latitude/longitude.
 */
LatLon.prototype.toString = function(format, dp) {
    return this.lat + ',' + this.lon;
};


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

/** Extend Number object with method to convert numeric degrees to radians */
if (Number.prototype.toRadians === undefined) {
    Number.prototype.toRadians = function() { return this * Math.PI / 180; };
}

/** Extend Number object with method to convert radians to numeric (signed) degrees */
if (Number.prototype.toDegrees === undefined) {
    Number.prototype.toDegrees = function() { return this * 180 / Math.PI; };
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
