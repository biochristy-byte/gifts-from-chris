/* Country and territory centres (approximate, for placing a flower, not for navigation).
   Tableau does not hand its generated latitude and longitude to an extension, so the
   Garden map looks a flower's name up here when the view has no Latitude and Longitude
   fields. One line per place:  name | lat | lon | alias ; alias ; ...  */
(function (global) {
  'use strict';
  var RAW = [
    'Afghanistan|33.9|67.7', 'Albania|41.15|20.17', 'Algeria|28.0|2.6', 'Andorra|42.5|1.5', 'Angola|-12.3|17.5',
    'Antigua and Barbuda|17.1|-61.8', 'Argentina|-34.0|-64.0', 'Armenia|40.07|45.04', 'Australia|-25.0|134.0', 'Austria|47.6|14.1',
    'Azerbaijan|40.14|47.58', 'Bahamas|24.7|-77.8', 'Bahrain|26.0|50.55', 'Bangladesh|23.7|90.3', 'Barbados|13.2|-59.5',
    'Belarus|53.7|27.9', 'Belgium|50.6|4.7', 'Belize|17.2|-88.7', 'Benin|9.3|2.3', 'Bhutan|27.5|90.4', 'Bolivia|-16.7|-64.7',
    'Bosnia and Herzegovina|44.2|17.8|bosnia', 'Botswana|-22.3|24.7', 'Brazil|-10.8|-52.9', 'Brunei Darussalam|4.5|114.7|brunei',
    'Bulgaria|42.7|25.2', 'Burkina Faso|12.2|-1.6', 'Burundi|-3.4|29.9', 'Cabo Verde|16.0|-24.0|cape verde', 'Cambodia|12.6|104.9',
    'Cameroon|5.7|12.7', 'Canada|56.0|-100.0', 'Central African Republic|6.6|20.9', 'Chad|15.4|18.7', 'Chile|-35.7|-71.5',
    'China|35.0|103.0|peoples republic of china;prc', 'Colombia|4.6|-74.3', 'Comoros|-11.9|43.3', 'Congo|-0.7|15.2|republic of the congo;congo brazzaville',
    'DR Congo|-2.9|23.7|democratic republic of the congo;congo kinshasa;drc', 'Costa Rica|9.9|-84.2', 'Cote d Ivoire|7.5|-5.5|ivory coast',
    'Croatia|45.1|15.2', 'Cuba|21.5|-79.0', 'Cyprus|35.1|33.4', 'Czechia|49.8|15.5|czech republic', 'Denmark|56.0|9.5', 'Djibouti|11.8|42.6',
    'Dominica|15.4|-61.4', 'Dominican Republic|18.9|-70.2', 'Ecuador|-1.4|-78.5', 'Egypt|26.8|30.8', 'El Salvador|13.7|-88.9',
    'Equatorial Guinea|1.6|10.5', 'Eritrea|15.2|39.8', 'Estonia|58.7|25.5', 'Eswatini|-26.5|31.5|swaziland', 'Ethiopia|9.1|40.5',
    'Fiji|-17.7|178.1', 'Finland|62.9|26.3', 'France|46.6|2.5', 'Gabon|-0.8|11.6', 'Gambia|13.4|-15.4', 'Georgia|42.3|43.4', 'Germany|51.1|10.4',
    'Ghana|7.9|-1.0', 'Greece|39.0|22.0', 'Grenada|12.1|-61.7', 'Guatemala|15.5|-90.3', 'Guinea|9.9|-11.4', 'Guinea-Bissau|12.0|-15.2',
    'Guyana|4.9|-58.9', 'Haiti|19.0|-72.7', 'Honduras|14.8|-86.6', 'Hungary|47.2|19.4', 'Iceland|64.9|-18.6', 'India|22.0|79.0',
    'Indonesia|-2.5|118.0', 'Iran|32.4|53.7|iran islamic republic of', 'Iraq|33.2|43.7', 'Ireland|53.2|-8.1', 'Israel|31.4|35.0', 'Italy|42.8|12.6',
    'Jamaica|18.1|-77.3', 'Japan|36.5|138.3', 'Jordan|31.2|36.8', 'Kazakhstan|48.0|67.0', 'Kenya|0.5|37.9', 'Kiribati|1.9|-157.4',
    'Korea|36.4|127.9|south korea;republic of korea;korea republic of', 'North Korea|40.3|127.2|dprk;korea dpr', 'Kosovo|42.6|20.9', 'Kuwait|29.3|47.5',
    'Kyrgyzstan|41.5|74.6|kyrgyz republic', 'Laos|19.9|102.5|lao pdr', 'Latvia|56.9|24.9', 'Lebanon|33.9|35.9', 'Lesotho|-29.6|28.2',
    'Liberia|6.4|-9.4', 'Libya|27.0|17.0', 'Liechtenstein|47.1|9.55', 'Lithuania|55.3|23.9', 'Luxembourg|49.8|6.1', 'Madagascar|-19.4|46.7',
    'Malawi|-13.2|34.3', 'Malaysia|4.2|102.0', 'Maldives|3.2|73.2', 'Mali|17.6|-4.0', 'Malta|35.9|14.4', 'Marshall Islands|7.1|171.2',
    'Mauritania|20.3|-10.9', 'Mauritius|-20.3|57.6', 'Mexico|23.6|-102.5', 'Micronesia|6.9|158.2', 'Moldova|47.2|28.5', 'Monaco|43.74|7.4',
    'Mongolia|46.9|103.8', 'Montenegro|42.7|19.4', 'Morocco|31.8|-7.1', 'Mozambique|-18.7|35.5', 'Myanmar|21.9|95.96|burma', 'Namibia|-22.0|17.1',
    'Nauru|-0.5|166.9', 'Nepal|28.4|84.1', 'Netherlands|52.2|5.5|the netherlands;holland', 'New Zealand|-41.0|174.0', 'Nicaragua|12.9|-85.2',
    'Niger|17.6|8.1', 'Nigeria|9.1|8.7', 'North Macedonia|41.6|21.7|macedonia', 'Norway|61.0|9.0', 'Oman|21.5|55.9', 'Pakistan|30.4|69.3',
    'Palau|7.5|134.6', 'Palestinian Authority|31.9|35.2|palestine;state of palestine', 'Panama|8.5|-80.8', 'Papua New Guinea|-6.3|143.9',
    'Paraguay|-23.4|-58.4', 'Peru|-9.2|-75.0', 'Philippines|12.9|122.0', 'Poland|52.0|19.4', 'Portugal|39.6|-8.0', 'Qatar|25.3|51.2',
    'Romania|45.9|25.0', 'Russia|61.5|99.0|russian federation', 'Rwanda|-1.94|29.9', 'Saint Kitts and Nevis|17.3|-62.7', 'Saint Lucia|13.9|-60.98',
    'Saint Vincent and the Grenadines|13.25|-61.2', 'Samoa|-13.76|-172.1', 'San Marino|43.94|12.46', 'Sao Tome and Principe|0.2|6.6',
    'Saudi Arabia|24.0|45.0', 'Senegal|14.5|-14.5', 'Serbia|44.0|20.8', 'Seychelles|-4.7|55.5', 'Sierra Leone|8.5|-11.8', 'Singapore|1.35|103.8',
    'Slovak Republic|48.7|19.5|slovakia', 'Slovenia|46.1|14.8', 'Solomon Islands|-9.6|160.2', 'Somalia|5.2|46.2', 'South Africa|-29.0|24.5',
    'South Sudan|7.3|30.3', 'Spain|40.2|-3.7', 'Sri Lanka|7.9|80.8', 'Sudan|15.6|30.2', 'Suriname|3.9|-56.0', 'Sweden|62.0|15.0',
    'Switzerland|46.8|8.2', 'Syria|34.8|39.0|syrian arab republic', 'Chinese Taipei|23.7|121.0|taiwan', 'Tajikistan|38.9|71.3', 'Tanzania|-6.4|34.9',
    'Thailand|15.0|101.0', 'Timor-Leste|-8.9|125.7|east timor', 'Togo|8.6|0.8', 'Tonga|-21.2|-175.2', 'Trinidad and Tobago|10.7|-61.2',
    'Tunisia|34.0|9.6', 'Türkiye|39.0|35.2|turkiye;turkey', 'Turkmenistan|39.0|59.6', 'Tuvalu|-7.5|178.7', 'Uganda|1.4|32.3', 'Ukraine|49.0|32.0',
    'United Arab Emirates|24.0|54.0|uae', 'United Kingdom|54.0|-2.5|uk;great britain;britain;england', 'United States|39.0|-98.0|united states of america;usa;us;america',
    'Uruguay|-32.8|-56.0', 'Uzbekistan|41.4|64.6', 'Vanuatu|-15.4|166.96', 'Venezuela|7.1|-66.2', 'Viet Nam|16.0|106.3|vietnam', 'Yemen|15.9|47.6',
    'Zambia|-13.1|27.8', 'Zimbabwe|-19.0|29.9',
    /* sub-national and special entries used by international surveys */
    'B-S-J-Z (China)|31.5|119.0|bsjz;beijing shanghai jiangsu zhejiang', 'Dushanbe (Tajikistan)|38.56|68.79', 'Hong Kong (China)|22.3|114.2|hong kong;hong kong sar',
    'Macao (China)|22.2|113.55|macao;macau', 'Kurdistan Region (Iraq)|36.2|44.0|kurdistan', 'Ukrainian regions (17 of 27)|49.0|32.0'
  ];
  var index = {};
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  RAW.forEach(function (line) {
    var p = line.split('|'), rec = { name: p[0], lat: parseFloat(p[1]), lon: parseFloat(p[2]) };
    index[norm(p[0])] = rec;
    (p[3] ? p[3].split(';') : []).forEach(function (a) { index[norm(a)] = rec; });
  });
  /* Returns {lat, lon, name} or null. Tries the full text, then the text without a bracketed part. */
  function lookup(name) {
    var n = norm(name); if (!n) return null;
    if (index[n]) return index[n];
    var bare = norm(String(name).replace(/\([^)]*\)/g, ''));
    return bare && index[bare] ? index[bare] : null;
  }
  global.GardenGeo = { lookup: lookup, norm: norm, count: RAW.length };
})(window);
