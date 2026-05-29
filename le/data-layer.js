/**
 * This file contains functions to fetch data from the Google Scripts backend,
 * providing a reusable and non-volatile interface for the rest of the site.
 */

const ROLLOVER_TIME = 14; // When to start displaying the next day's info
const API_URL = "https://script.google.com/macros/s/AKfycbwIfH0OUuUPFdfXIaPiMpUD6BeDf4R6Z36OhPfc3BVHYRuNIAFB8FtLEVOnZ4629grD/exec";

class Interface {
  async refresh(date) {
    this._log(console.info, "Refreshing!");

    if (date != null) {
      this._log(console.warn, "Using date override:", date);
    }

    try {
      this._latestData = null;
      const response = await this._fetch(date);
      const data = this._decode(response);
      this._latestData = this._repackage(data);
    }
    catch (e) {
      this._log(console.error, e);
    }
  }

  _latestFetch;
  get latestFetch() { return this._latestFetch; }

  _latestData;
  get latestData() { return this._latestData; }

  get isRolledOver() {
    return this._latestFetch.getHours() >= ROLLOVER_TIME;
  }

  async _fetch(date, params) {
    const now = date ?? new Date();
    this._latestFetch = now;

    // Speculation: The two week period is so that the rollover feature is always
    // able to find the next school day after any vacation periods, which are
    // never longer than two weeks (except summer vacation).
    const twoWeeks = msFromHours(2 * 7 * 24);
    const inTwoWeeks = new Date(now.getTime() + twoWeeks);

    const start = now.toLocaleString("sv").substring(0, 10);
    const end = inTwoWeeks.toLocaleString("sv").substring(0, 10);

    const url = new URL(API_URL);
    url.searchParams.append("start", start);
    url.searchParams.append("end", end);

    for (const [k, v] of Object.entries(params ?? [])) {
      url.searchParams.append(k, v);
    }

    const t1 = new Date();
    const response = await fetch(url);
    const t2 = new Date();

    const json = await response?.json();

    if (json == null) {
      throw new Error("Server returned malformed response.");
    }

    this._log(console.info, `Fetched JSON from server (took ${t2 - t1}ms):`, json);

    return json;
  }

  _decode() {
    throw new Error("Interface.#decode() is a virtual method");
  }

  _repackage(data) {
    return data;
  }

  _log(method, ...args) {
    method.call(console, this.constructor.name, "::", ...args);
  }
}

class Schedule extends Interface {
  static #VALID_DAYS = new Set(["A", "B", "C", "D"]);
  static #SPECIAL_DAYS = /\*|special|exam|transition|last|half|1\/2/i;

  /*
   * {
   *   schedules: [
   *     {
   *       title: string, // day name (*1)
   *       startTime: string, // ISO timestamp
   *       description: string?, // bell schedule (*2)
   *     },
   *   ][],
   * };
   *
   * (*1) The day name is of the format "X Day" where X denotes the name of the
   *      first block of the day. However, it may also include other information
   *      signifying a special day. This information is written by a human and
   *      is prone to inconsistencies; real examples include:
   *      - A & B Exams
   *      - B Day (*Special Schedule)
   *      - C Day * Special Schedule
   *      - D Day (1/2 Day)
   *      - D Day *Transition Day
   *
   * (*2) The bell schedule is written by a human, so its format is inconsistent
   *      and may contain errors. It is usually plain text but may also be HTML
   *      if someone copy-pastes a table from a webpage, for example. This
   *      program makes its best attempt to parse the schedule so it can be
   *      displayed consistently.
   *      Note that the description field may also be null.
   */
  async _fetch(date) {
    return await super._fetch(date, {
      type: "schedule",
    });
  }

  _decode(response) {
    if (response?.schedules == null) {
      throw new Error("Server response did not contain any schedule data.");
    }

    // The extra [0]s in the schedules index are a result of the data structures
    // returned by the backend
    let schedule = response.schedules[0][0];

    if (schedule == null) {
      throw new Error("Could not find schedule in server response.");
    }

    const isForToday = this.#_parseRelativeDayName(schedule.startTime)
      === "today";

    // Only roll over to the next day if the schedule is for the current day;
    // otherwise no need because it is already rolled over.
    // Only roll over at the appropriate time and if the next schedule exists.
    // Fall back to today if any conditions are failed.
    if (true
      && isForToday
      && this.isRolledOver
      && response.schedules.length > 1
    ) {
      this._log(console.info, "After ROLLOVER_TIME, returning next schedule.");
      schedule = response.schedules[1][0];
    }

    // Forward isForToday flag to allow "No Schedule Posted" indication
    return { schedule, todayHasSchedule: isForToday };
  }

  _repackage(data) {
    this._log(console.info, "Found next schedule:", data);

    const { schedule: { title, startTime, description }, todayHasSchedule } = data;

    return {
      letterOfTheDay:
        this.#_parseLetterOfTheDay(title),
      relativeDayName:
        this.#_parseRelativeDayName(startTime),
      classTimes:
        this.#_parseClassTimes(description),
      todayHasSchedule,
    };
  }

  #_parseLetterOfTheDay(dayName) {
    if (dayName == null) {
      this._log(console.warn, "schedule.title is null!");
      return {
        letter: "?",
        special: false,
      };
    }

    const candidate = dayName.trim().charAt(0);
    const letter = Schedule.#VALID_DAYS.has(candidate)
      ? candidate
      : null;
    const special = letter == null || Schedule.#SPECIAL_DAYS.test(dayName);

    return { letter, special };
  }

  #_parseRelativeDayName(date) {
    if (date == null) {
      this._log(console.warn, "schedule.startTime is null!");
      return "today";
    }
    else {
      date = new Date(date);
    }

    return toRelativeDayName(date, this._latestFetch);
  }

  /*
   * Regex to extract class times and names from schedule.description
   * /^\s*(\d?\d(?::?\d{2})?(?:\s*[ap]m)?)\s*-\s*(\d?\d(?::?\d{2})?(?:\s*[ap]m)?)[\s:]*(.*?)\s*$|^\s*(.*?)[\s:]*(\d?\d(?::?\d{2})?(?:\s*[ap]m)?)\s*-\s*(\d?\d(?::?\d{2})?(?:\s*[ap]m)?)\s*$/gmi
   *
   * >> Regex analyzer: https://regex101.com/r/hd7rpO/1 <<
   *
   * Two different cases
   * ===================
   * ^\s*{Time matcher}[\s:]*(.*?)\s*$  -- Time: Class
   * |                                  -- ... or ...
   * ^\s*(.*?)[\s:]*{Time matcher}\s*$  -- Class: Time
   *
   * Time matcher
   * ============
   * {Clock time}\s*-\s*{Clock time}  -- XX:XX - XX:XX
   *                                  -- two clock times separated by a dash
   *                                  -- and maybe whitespace around the dash
   *
   * Clock time
   * ==========
   * (
   *   \d?\d      -- hour (can be single-digit)
   *   (?:
   *     :?       -- colon is optional
   *     \d{2}    -- minute (always two digits)
   *   )?         -- minute is optional
   *   (?:
   *     \s*      -- whitespace is optional
   *     [ap]m    -- AM or PM
   *   )?
   * )
   *
   * Flags
   * =====
   * g  -- global (find all matches)
   * m  -- handle multiline
   * i  -- case-insensitive
   */
  static #_BELL_SCHEDULE_REGEX = null;
  static get #BELL_SCHEDULE_REGEX() {
    if (this.#_BELL_SCHEDULE_REGEX == null) {
      const clockTime   = String.raw`(\d?\d(?::?\d{2})?(?:\s*[ap]m)?)`;
      const timeMatcher = String.raw`${clockTime}\s*-\s*${clockTime}`;
      const timeBefore  = String.raw`^\s*${timeMatcher}[\s:]*(.*?)\s*$`;
      const timeAfter   = String.raw`^\s*(.*?)[\s:]*${timeMatcher}\s*$`;
      const regex = String.raw`${timeBefore}|${timeAfter}`;

      this.#_BELL_SCHEDULE_REGEX = new RegExp(regex, "gmi");
    }

    return this.#_BELL_SCHEDULE_REGEX;
  }

  /*
   * Regex to detect HTML tags in schedule.description
   * See https://regex101.com/r/WUMMda/1
   */
  static #SUSPECTED_HTML_REGEX = /<([^>]+)>.*?<\/\1>|<([^>]+)\/>/g;

  #_parseClassTimes(bellSchedule) {
    if (bellSchedule == null) {
      this._log(console.warn, "schedule.description is null!");
      return null;
    }

    // Convert to plain text if HTML
    let matches = [...bellSchedule.matchAll(Schedule.#SUSPECTED_HTML_REGEX)];

    if (matches.length > 0) {
      this._log(console.info, "Attempting to decode HTML.");

      const doc = new DOMParser().parseFromString(bellSchedule, "text/html");
      const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);

      let node;
      let nodes = [];
      while ((node = walker.nextNode()) != null)
        nodes.push(node.nodeValue);

      bellSchedule = nodes.join("\n");
    }

    matches = [...bellSchedule.matchAll(Schedule.#BELL_SCHEDULE_REGEX)];

    if (matches.length > 0) {
      try {
        return {
          type: "data",
          value: matches.map(match => {
            if (match.length !== 7)
              throw new Error("Regex should match 6 groups.");

            const [, startA, endA, nameA, nameB, startB, endB] = match;

            if (nameA != null)
              return { name: nameA, start: startA, end: endA };
            else if (nameB != null)
              return { name: nameB, start: startB, end: endB };
            else
              throw new Error("Regex returned null class name.");
          }),
        };
      }
      catch (e) {
        this._log(console.warn, "Parsed bell schedule successfully but got unexpected structure:", e.message);
      }
    }

    this._log(console.error, "Failed to parse bell schedule. Falling back to plain text.");

    // Rudimentary attempt to clean up unprocessed text
    return {
      type: "text",
      value: bellSchedule
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join("\n"),
    };
  }
}

class Lunch extends Interface {
  /*
   * {
   *   lunch: [
   *     {
   *       title: string, // short lunch name (*1)
   *       startTime: string, // ISO timestamp
   *       description: string?, // list of ingredients or sides (*2)
   *     },
   *   ][],
   * };
   *
   * (*1) e.g. "Meatball Sub" or "(V) Texas Toast Grilled Cheese"
   *      May also be "No School"
   *
   * (*2) e.g. "Tostito Scoops\nRed Pepper, Carrots, Ranch Dip"
   *      On "No School" days, this field is absent.
   */
  async _fetch(date) {
    return await super._fetch(date, {
      type: "lunch",
    });
  }

  _decode(response) {
    if (response.lunch == null) {
      throw new Error("Server response did not contain any lunch data.");
    }

    // The extra [0]s in the lunch index are a result of the data structures
    // returned by the backend
    const nextLunchIndex = response.lunch.findIndex(Lunch.#_isValidLunch);

    if (nextLunchIndex < 0) {
      throw new Error("Could not find schedule in server response.");
    }

    const nextLunch = response.lunch[nextLunchIndex][0];
    let todayLunch = null;
    let upcomingLunch = null;

    const isForToday = this.#_parseRelativeDayName(nextLunch.startTime)
      === "today";

    if (isForToday) {
      if (!this.isRolledOver) {
        todayLunch = nextLunch;
      }

      // Only look for the upcoming lunch if the next lunch isn't already future
      const upcomingLunchIndex = response.lunch.findIndex(
        (lunch, index) => index > nextLunchIndex && Lunch.#_isValidLunch(lunch)
      );
      if (upcomingLunchIndex >= 0) {
        upcomingLunch = response.lunch[upcomingLunchIndex][0];
      }
    }
    else {
      // If the next lunch is in the future, then today's lunch wasn't given
      upcomingLunch = nextLunch;
    }

    return {
      today: todayLunch,
      upcoming: upcomingLunch,
    };
  }

  static #_isValidLunch([lunch]) {
    return !/No School/i.test(lunch.title) && lunch.description != null;
  }

  _repackage(data) {
    return {
      today: this.#_repackageLunch(data.today),
      upcoming: this.#_repackageLunch(data.upcoming),
    };
  }

  static #SIDES_SEPARATOR = /\n|,\s*/;

  #_repackageLunch(lunch) {
    this._log(console.info, "Found lunch data:", lunch);

    if (lunch == null) {
      return null;
    }

    const { title, startTime, description } = lunch;

    return {
      relativeDayName:
        this.#_parseRelativeDayName(startTime),
      title:
        this.#_parseTitle(title).trim(),
      sides:
        this.#_parseDescription(description).trim()
          .split(Lunch.#SIDES_SEPARATOR)
          .filter(side => side.length > 0),
    };
  }

  #_parseRelativeDayName(date) {
    if (date == null) {
      this._log(console.warn, "lunch.startTime is null!");
      return "today";
    }
    else {
      date = new Date(date);
    }

    return toRelativeDayName(date, this._latestFetch);
  }

  #_parseTitle(title) {
    if (title == null) {
      this._log(console.warn, "lunch.title is null!");
      return "Lunch";
    }

    return title;
  }

  #_parseDescription(description) {
    if (description == null) {
      this._log(console.warn, "lunch.description is null!");
      return "";
    }

    return description;
  }
}
