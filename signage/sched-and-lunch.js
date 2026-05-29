/***************************************************************
* Today's SCHEDULE & LUNCHES
*/
var REFRESH_INTERVAL = 15 * 60 * 1000;  // milliseconds = minutes * 60 * 1000 

var d =  new Date();  //2018, 10, 21);
var today = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
var todayStr = today.toISOString().substr(0,10);

//console.log("today="+todayStr);
var twoWeeks = new Date(d.getFullYear(), d.getMonth(), d.getDate()+14, 0, 0, 0, 0);
var twoWeeksStr = twoWeeks.toISOString().substr(0,10);

var schedDataUrl = "https://script.google.com/macros/s/AKfycbwNcl6DD2ioQidiBaQg4gJ2NDjUNLjCKlv6maVXmg5WgnaUgKkevgJmJXM4Z2qIhCbR/exec";
schedDataUrl += "?type=schedule&start="+todayStr+"&end="+twoWeeksStr;
//console.log(schedDataUrl);
//https://script.google.com/a/holliston.k12.ma.us/macros/s/AKfycbySq1-awpeZr2RLzsEizMJjBpgBvD8KFWc-VKGjV6JrcKTe3g/exec?type=schedule&start=2017-12-5&end=2017-12-19

var lunchDataUrl = "https://script.google.com/macros/s/AKfycbwIfH0OUuUPFdfXIaPiMpUD6BeDf4R6Z36OhPfc3BVHYRuNIAFB8FtLEVOnZ4629grD/exec";
lunchDataUrl += "?type=lunch&start="+todayStr+"&end="+twoWeeksStr;
console.log(lunchDataUrl);
//https://script.google.com/a/holliston.k12.ma.us/macros/s/AKfycbySq1-awpeZr2RLzsEizMJjBpgBvD8KFWc-VKGjV6JrcKTe3g/exec?type=lunch&start=2017-10-16   

function getSchedules() {
  $.getJSON( schedDataUrl) .done(function( dataIn ) {
    
    console.log("getSchedules done");
    if (dataIn != null) {
      var data = dataIn.schedules;
      
      if ((data) && (data.length >0)) {
        var nextSched = data[0][0];
        var nextSchedDate = new Date(nextSched["startTime"]);
        nextSchedDate = new Date(nextSchedDate.getFullYear(), nextSchedDate.getMonth(), nextSchedDate.getDate());
        //console.log(nextSchedDate);
        var today = new Date();
        // today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        if ((today.getHours() >= 14) && (data.length > 1)) {
          nextSched = data[1][0];
          nextSchedDate = new Date(nextSched["startTime"]);
          nextSchedDate = new Date(nextSchedDate.getFullYear(), nextSchedDate.getMonth(), nextSchedDate.getDate());
        }
        
        var datesMatch = (today.getFullYear() == nextSchedDate.getFullYear() ) &&
        (today.getMonth() == nextSchedDate.getMonth()) && 
        (today.getDate() == nextSchedDate.getDate());
        
        if (datesMatch) {
          $("#schedBox #date").html("Today's Schedule");
        } else {
          var dn = dayName(nextSchedDate);
          if (nextSchedDate.getDate() - today.getDate() == 1) {
            dn = "Tomorrow";
          }
          if (dn != "") {
            $("#schedBox #date").html(dn + "'s Schedule");
          }
        }
        if (nextSched["description"] != null) {
          $("#schedBox #schedTable").html(formatSchedTable(nextSched["description"]));
        }
        
        displayLetter(nextSched["title"]);
        
      } else {
        var html = "<table class='no-data'><tr><td>No classes scheduled</td></tr></table>";
        $("#schedBox #schedTable").html(html);
      }
    } else {
      var html = "<table class='no-data'><tr><td>No classes scheduled</td></tr></table>";
      $("#schedBox #schedTable").html(html);
    }
    
  });
  
  setTimeout(getSchedules, REFRESH_INTERVAL);
}

function getLunches() {
  $.getJSON( lunchDataUrl) .done(function( dataIn ) {
    //console.log(dataIn); 
    console.log("getLunches done");
    if (dataIn != null) {
      var data = dataIn.lunch;
      if (data.length >0) {
        var lunchTableHtml = "";
        
        console.log(data);
        var nextSched = data[0][0];
        var nextSchedDate = new Date(nextSched["startTime"]);
        nextSchedDate = new Date(nextSchedDate.getFullYear(), nextSchedDate.getMonth(), nextSchedDate.getDate());
        var today = new Date();
        if (today.getHours() < 14) {
          
          var datesMatch = (today.getFullYear() == nextSchedDate.getFullYear() ) &&
          (today.getMonth() == nextSchedDate.getMonth()) && 
          (today.getDate() == nextSchedDate.getDate());
          
          if (datesMatch) {
            lunchTableHtml += "<div class='date'>Today's Lunch Menu</div>";
          } else {
            var dn = dayName(nextSchedDate);
            if (nextSchedDate.getDate() - today.getDate() == 1) {
              dn = "Tomorrow";
            }
            if (dn != "") {
              lunchTableHtml += "<div class='date'>" + dn + "'s Lunch</div>";
            }
          }
          lunchTableHtml += formatLunchTable(nextSched);
        }
        
        
        if (data.length >= 2) {
          var secondSched = data[1][0];
          var secondSchedDate = new Date(secondSched["startTime"]);
          var dn = dayName(secondSchedDate);
          if (secondSchedDate.getDate() - today.getDate() == 1) {
            dn = "Tomorrow";
          }
          if (dn != "") {
            lunchTableHtml += "<div class='date'>" + dn + "'s Lunch</div>";
          }
          
          lunchTableHtml += formatLunchTable(secondSched);
          
        }
        $("#lunchBox #table").html(lunchTableHtml);
        
      } else {
        var html = "<table class='no-data'><tr><td>No lunch posted</td></tr></table>";
        $("#lunchBox #table").html(html);
      }
    } else {
      var html = "<table class='no-data'><tr><td>No lunch posted</td></tr></table>";
      $("#lunchBox #table").html(html);
    }
  });
  
  setTimeout(getLunches, REFRESH_INTERVAL);
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
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var ret = "";
  if (d.getDay()) {
    ret = days[d.getDay()];
  }
  return ret;
}

function formatSchedTable(desc) {
  var html = "<table>";
  desc = desc.replace(/ - /g,"-");
  var fullRows = desc.split("\n");
  for (var r in fullRows) {
    var lunchspan = "";
    if ((fullRows[r].indexOf("Lunch") >=0) 
    || (fullRows[r].indexOf("lunch") >=0)) {
      lunchspan = " class='lunch'";
    }
    var row = fullRows[r].split(": ");
    html += "<tr>";
    for (var rr in row) {
      var colspan = "";
      if (row.length ==1) {
        colspan = " colspan='2'";
      } else {
        colspan = " class='timecell'";
      }
      html += "<td"+colspan +"><span" + lunchspan +">" + row[rr] + "</span></td>";
    }
    html += "</tr>"
  }
  html += "</table>";
  return html;
}

function formatLunchTable(day) {
  var html = "<table>";
  html += "<tr><td class='menuTitle'>" + day["title"] + "</td></tr>";
  
  var description = typeof day["description"] !== "undefined" ? day["description"] : "";
  html += "<tr><td class='menuDescr'>" + description + "</td></tr>";
  html += "</table>";
  
  return html;
}

function displayLetter(t){
  var letter = "&#9733;";
  var sp = "SPECIAL<br>SCHEDULE";
  var code = t.charCodeAt(0);
  console.log(code);
  if ((code >= 65) && (code <= 68)) {
    //between A and D
    letter = t.charAt(0);
    $(".letter").show().html(letter);
    $(".star").hide();
    $(".special").hide();
  } else {
    $(".letter").hide();
    $(".star").show().html("&#9733;");
    $(".special").show().html("SPECIAL<br>SCHEDULE");
  }
}

function startScreenToggles(interval) {
  let delay = interval;
  if (typeof delay === 'undefined') {
    delay = 8000;
  }
  window.setInterval(toggleScreens, delay);
}

function toggleScreens() {
  $("#schedBox").slideToggle();
  $("#lunchBox").slideToggle();
}
