/***************************************************************
* Today's SCHEDULE & LUNCHES
*/
var REFRESH_INTERVAL = 15 * 60 * 1000;  // milliseconds = minutes * 60 * 1000 

var d =  new Date();  //2021, 4, 28);
var today = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
var todayStr = today.toISOString().substr(0,10);

var twoWeeks = new Date(d.getFullYear(), d.getMonth(), d.getDate()+14, 0, 0, 0, 0);
var twoWeeksStr = twoWeeks.toISOString().substr(0,10);

var date1;
var date2;
var schedulesReady = false;
var lunchesReady = false;
var lunchesData = null;

var schedDataUrl = "https://script.google.com/macros/s/AKfycbwNcl6DD2ioQidiBaQg4gJ2NDjUNLjCKlv6maVXmg5WgnaUgKkevgJmJXM4Z2qIhCbR/exec";
schedDataUrl += "?type=schedule&start="+todayStr+"&end="+twoWeeksStr;

var lunchDataUrl = "https://script.google.com/macros/s/AKfycbwIfH0OUuUPFdfXIaPiMpUD6BeDf4R6Z36OhPfc3BVHYRuNIAFB8FtLEVOnZ4629grD/exec";
lunchDataUrl += "?type=lunch&start="+todayStr+"&end="+twoWeeksStr;

function getSchedules() {
	$.getJSON( schedDataUrl) .done(function( dataIn ) {
		
		$('.day').hide();
		console.log("getSchedules done");
		if (dataIn != null) {
			var data = dataIn.schedules;
			
			if ((data) && (data.length >=1)) {
				var nextSched = data[0][0];
				var nextSchedDate = new Date(nextSched["startTime"]);
				nextSchedDate = new Date(nextSchedDate.getFullYear(), nextSchedDate.getMonth(), nextSchedDate.getDate());
				date1 = nextSchedDate;
				var dateDiv = $('#day-1');
				fillDate(date1, dateDiv);
				fillScheduleDetails(nextSched, dateDiv);	
			} 
			if ((data) && (data.length >=2)) {
				var nextSched = data[1][0];
				var nextSchedDate = new Date(nextSched["startTime"]);
				nextSchedDate = new Date(nextSchedDate.getFullYear(), nextSchedDate.getMonth(), nextSchedDate.getDate());
				date2 = nextSchedDate;
				var dateDiv = $('#day-2');
				fillDate(date2, dateDiv);
				fillScheduleDetails(nextSched, dateDiv);	
			} 
		} 
		
		schedulesReady = true;
		processLunches();
	});
	
	
}

function fillDate(date, dateDiv) {
	$(dateDiv).find('.day-name').text(dayName(date));
	$(dateDiv).find('.month-name').text(monthName(date));
	$(dateDiv).find('.date-number').text(date.getDate());
}

function fillScheduleDetails(event, dateDiv) {
	$(dateDiv).css('display', 'flex');	
	$(dateDiv).find('.schedule .title').text(event["title"]);
	
	if (event["description"] != null) {
		$(dateDiv).find('.schedule .details').html(formatSchedTable(event["description"]));
	}
}

function fillLunchDetails(event, dateDiv) {
	$(dateDiv).show();	
	$(dateDiv).find('.lunch .title').text(`Lunch: ${event["title"]}`);
	
	if (event["description"] != null) {
		$(dateDiv).find('.lunch .details').html(event["description"]);
	}
}


function getLunches() {
	$.getJSON( lunchDataUrl) .done(function( dataIn ) {
		lunchesReady = true;
		lunchesData = dataIn;
		processLunches();
	});
}

function processLunches() {
	var dataIn = lunchesData;
	if (!lunchesReady || !schedulesReady) {
		return;
	}
	if (dataIn != null) {
		var data = dataIn.lunch;
		
		data.forEach((item) => {
			var nextLunch = item[0];
			var nextLunchDate = new Date(nextLunch["startTime"]);
			
			if (dateMatches(nextLunchDate, date1)) {
				fillLunchDetails(nextLunch, $('#day-1'));
			} else if (dateMatches(nextLunchDate, date2)) {
				fillLunchDetails(nextLunch, $('#day-2'));
			}
		}); 
	}
}

getSchedules();
getLunches();

function formatDate(d) {
	var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Sep','Oct','Nov','Dec'];
	var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
	
	var dd = new Date(d);
	//Logger.log(dd);
	var ret = days[dd.getDay()] + ", "+ months[dd.getMonth()-1] +" "+dd.getDate() + ", "+dd.getFullYear();
	return ret;
}

function dayName(d) {
	// var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
	var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
	var ret = "";
	if (d.getDay()) {
		ret = days[d.getDay()];
	}
	return ret;
}

function monthName(d) {
	var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Sep','Oct','Nov','Dec'];
	var ret = "";
	if (d.getMonth()) {
		ret = months[d.getMonth()];
	}
	return ret;
}


function formatSchedTable(desc) {
	var html = "<div class='schedule-grid'>";
	desc = desc.replace(/ - /g,"-");
	var fullRows = desc.split("\n");
	for (var r in fullRows) {
		var indent = "";
		if ((fullRows[r].indexOf("Lunch") >=0) 
		|| (fullRows[r].indexOf("lunch") >=0)) {
			indent = "&nbsp;&nbsp;";
		}
		var row = fullRows[r].split(": ");
		var colspan = "";
		if (row.length == 1 ) {
			html += `<div class="double">${row[0]}</div>`;
		} else {
			html += `<div class="time-cell">${indent}${row[0]}</div><div class="block-cell">${indent}${row[1]}</div>`;
		}
	}
	html += "</div>";
	return html;
}

function dateMatches(d1, d2) {
	try {
		var matchYear = d1.getFullYear() == d2.getFullYear();
		var matchMonth = d1.getMonth() == d2.getMonth();
		var matchDay = d1.getDate() == d2.getDate();
		
		return (matchYear && matchMonth && matchDay);
	} catch (e) {
		return false;
	}
}

