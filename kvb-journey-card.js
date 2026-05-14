class KVBJourneyCard extends HTMLElement {
  setConfig(config) {
    this.config = config || {};
    this.startStop = null;
    this.destStop = null;
    this.currentJourneys = [];
    this.currentRecallId = null;
  }

  set hass(hass) {
    this._hass = hass;
  }

  connectedCallback() {
    this.style.touchAction = "manipulation";
    this.loadSavedStops();

    this.selectedDate =
      localStorage.getItem("kvb_journey_date") ||
      this.todayString();

    this.selectedTime =
      localStorage.getItem("kvb_journey_time") ||
      this.nowTimeString();

    this.renderCard();
    this.bindEvents();

    if (this.startStop && this.destStop) {
      this.loadJourney();
    }
  }

  todayString() {
    const d = new Date();

    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  nowTimeString() {
    const d = new Date();

    return (
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0")
    );
  }

  formatDateDisplay() {
    if (!this.selectedDate) return "Datum";
    const [y, m, d] = this.selectedDate.split("-");
    return `${d}.${m}.${y}`;
  }

  formatTimeDisplay() {
    return this.selectedTime || "Zeit";
  }

  saveDateTime() {
    localStorage.setItem("kvb_journey_date", this.selectedDate);
    localStorage.setItem("kvb_journey_time", this.selectedTime);
  }

  buildIsoDateTime() {
    const [year, month, day] = this.selectedDate.split("-").map(Number);
    const [hour, minute] = this.selectedTime.split(":").map(Number);
    const d = new Date(year, month - 1, day, hour, minute, 0);

    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const abs = Math.abs(offset);
    const oh = String(Math.floor(abs / 60)).padStart(2, "0");
    const om = String(abs % 60).padStart(2, "0");

    return (
      d.getFullYear() +
      "-" + String(d.getMonth() + 1).padStart(2, "0") +
      "-" + String(d.getDate()).padStart(2, "0") +
      "T" + String(d.getHours()).padStart(2, "0") +
      ":" + String(d.getMinutes()).padStart(2, "0") +
      ":00" + sign + oh + ":" + om
    );
  }

  loadSavedStops() {
    try {
      const start = localStorage.getItem("kvb_journey_start");
      const dest = localStorage.getItem("kvb_journey_dest");
      if (start) this.startStop = JSON.parse(start);
      if (dest) this.destStop = JSON.parse(dest);
    } catch (e) {
      console.warn("KVB saved stops error", e);
    }
  }

  saveStops() {
    if (this.startStop) {
      localStorage.setItem("kvb_journey_start", JSON.stringify(this.startStop));
    }
    if (this.destStop) {
      localStorage.setItem("kvb_journey_dest", JSON.stringify(this.destStop));
    }
  }

  startSvg() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
        <path d="M80-240v-480h80v480H80Zm560 0-57-56 144-144H240v-80h487L584-664l56-56 240 240-240 240Z"/>
      </svg>
    `;
  }

  inputStyle() {
    return `
      flex:1;
      min-width:0;
      padding:11px;
      border-radius:10px;
      border:1px solid #ccc;
      font-size:15px;
      background:white;
      color:#111;
      -webkit-user-select:text;
      user-select:text;
      pointer-events:auto;
      touch-action:manipulation;
    `;
  }

  smallButtonStyle() {
    return `
      display:flex;
      align-items:center;
      justify-content:center;
      gap:4px;
      padding:7px 5px;
      border:0;
      border-radius:9px;
      background:#eee;
      font-size:11px;
      font-weight:700;
      white-space:nowrap;
      min-width:0;
      overflow:hidden;
      touch-action:manipulation;
    `;
  }

  renderCard() {
    this.innerHTML = `
      <ha-card>
        <div style="padding:14px;touch-action:manipulation;">

          <div style="
            display:grid;
            grid-template-columns:80% 20%;
            gap:8px;
            align-items:start;
            margin-bottom:12px;
          ">
            <div style="display:flex;flex-direction:column;gap:10px;min-width:0;">
              <div style="display:flex;align-items:center;gap:9px;">
                <span style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
                  ${this.startSvg()}
                </span>
                <input
                  id="startInput"
                  type="text"
                  inputmode="text"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="none"
                  spellcheck="false"
                  placeholder="Start eingeben"
                  value="${this.startStop ? (this.startStop.alias || this.startStop.name) : ""}"
                  style="${this.inputStyle()}"
                >
              </div>
              <div id="startResults" style="max-height:190px;overflow-y:auto;"></div>

              <div style="display:flex;align-items:center;gap:9px;">
                <ha-icon icon="mdi:format-horizontal-align-left" style="color:#143e74;width:24px;height:24px;"></ha-icon>
                <input
                  id="destInput"
                  type="text"
                  inputmode="text"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="none"
                  spellcheck="false"
                  placeholder="Ziel eingeben"
                  value="${this.destStop ? (this.destStop.alias || this.destStop.name) : ""}"
                  style="${this.inputStyle()}"
                >
              </div>
              <div id="destResults" style="max-height:190px;overflow-y:auto;"></div>
            </div>

            <div style="display:flex;justify-content:flex-end;align-items:flex-start;min-width:0;">
              <img src="https://www.kvb.koeln/img/kvb_logo_g2.png" style="width:100%;max-width:76px;height:auto;object-fit:contain;">
            </div>
          </div>

          <div style="
            display:grid;
            grid-template-columns:1.35fr 0.95fr 0.7fr 0.85fr 0.7fr;
            gap:6px;
            margin-bottom:14px;
            align-items:center;
            width:100%;
          ">
            <button id="dateBtn" style="${this.smallButtonStyle()}">
              <img src="https://www.kvb.koeln/images/tpl/auskunft/date.svg" style="height:15px;">
              <span id="dateText">${this.formatDateDisplay()}</span>
            </button>

            <button id="timeBtn" style="${this.smallButtonStyle()}">
              <img src="https://www.kvb.koeln/images/tpl/auskunft/time.svg" style="height:15px;">
              <span id="timeText">${this.formatTimeDisplay()}</span>
            </button>

            <button id="nowBtn" style="${this.smallButtonStyle()}">Jetzt</button>
            <button id="prevBtn" style="${this.smallButtonStyle()}">Vorher</button>
            <button id="nextBtn" style="${this.smallButtonStyle()}">Next</button>
          </div>

          <div id="journeys" style="padding:8px;border-radius:12px;background:#fafafa;border:1px solid #eee;">
            Bitte Start und Ziel auswählen.
          </div>

          <div id="pickerModal"></div>
        </div>
      </ha-card>
    `;
  }

  androidSafeInput(input) {
    if (!input) return;

    const forceFocus = (event) => {
      event.stopPropagation();
      setTimeout(() => {
        input.focus();
        try {
          input.setSelectionRange(input.value.length, input.value.length);
        } catch (e) {}
      }, 0);
    };

    input.addEventListener("pointerdown", forceFocus, { passive: false });
    input.addEventListener("touchstart", forceFocus, { passive: false });
    input.addEventListener("click", forceFocus, { passive: false });

    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
    });

    input.addEventListener("keyup", (event) => {
      event.stopPropagation();
    });
  }

  bindEvents() {
    const startInput = this.querySelector("#startInput");
    const destInput = this.querySelector("#destInput");
    const dateBtn = this.querySelector("#dateBtn");
    const timeBtn = this.querySelector("#timeBtn");
    const nowBtn = this.querySelector("#nowBtn");
    const prevBtn = this.querySelector("#prevBtn");
    const nextBtn = this.querySelector("#nextBtn");

    this.androidSafeInput(startInput);
    this.androidSafeInput(destInput);

    startInput.addEventListener("input", () => {
      this.searchStops(startInput.value, "start");
    });

    destInput.addEventListener("input", () => {
      this.searchStops(destInput.value, "dest");
    });

    dateBtn.addEventListener("click", () => {
      this.openPickerModal("date");
    });

    timeBtn.addEventListener("click", () => {
      this.openPickerModal("time");
    });

    nowBtn.addEventListener("click", () => {
      this.selectedDate = this.todayString();
      this.selectedTime = this.nowTimeString();
      this.saveDateTime();

      const dateText = this.querySelector("#dateText");
      const timeText = this.querySelector("#timeText");
      if (dateText) dateText.textContent = this.formatDateDisplay();
      if (timeText) timeText.textContent = this.formatTimeDisplay();

      if (this.startStop && this.destStop) {
        this.loadJourney();
      }
    });

    prevBtn.addEventListener("click", () => {
      this.loadRecall("previous");
    });

    nextBtn.addEventListener("click", () => {
      this.loadRecall("next");
    });
  }

  openPickerModal(type) {
    const modal = this.querySelector("#pickerModal");
    const title = type === "date" ? "Datum auswählen" : "Uhrzeit auswählen";
    const inputType = type === "date" ? "date" : "time";
    const value = type === "date" ? this.selectedDate : this.selectedTime;

    modal.innerHTML = `
      <div style="
        position:fixed;
        inset:0;
        background:rgba(0,0,0,0.45);
        z-index:999999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
      ">
        <div style="
          width:100%;
          max-width:360px;
          background:var(--card-background-color, white);
          color:var(--primary-text-color, #111);
          border-radius:18px;
          padding:18px;
          box-shadow:0 10px 40px rgba(0,0,0,0.35);
        ">
          <div style="font-size:18px;font-weight:800;margin-bottom:14px;">
            ${title}
          </div>

          <input
            id="modalPickerInput"
            type="${inputType}"
            value="${value}"
            style="
              width:100%;
              box-sizing:border-box;
              font-size:22px;
              padding:12px;
              border-radius:12px;
              border:1px solid #ccc;
              background:white;
              color:#111;
              -webkit-user-select:text;
              user-select:text;
              pointer-events:auto;
              touch-action:manipulation;
            "
          >

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
            <button id="modalCancelBtn" style="padding:10px 14px;border:0;border-radius:12px;background:#ddd;">Abbrechen</button>
            <button id="modalOkBtn" style="padding:10px 14px;border:0;border-radius:12px;background:#143e74;color:white;font-weight:800;">OK</button>
          </div>
        </div>
      </div>
    `;

    const input = modal.querySelector("#modalPickerInput");
    const cancelBtn = modal.querySelector("#modalCancelBtn");
    const okBtn = modal.querySelector("#modalOkBtn");

    this.androidSafeInput(input);

    setTimeout(() => {
      input.focus();
      try {
        if (input.showPicker) input.showPicker();
      } catch (e) {}
    }, 150);

    cancelBtn.addEventListener("click", () => {
      modal.innerHTML = "";
    });

    okBtn.addEventListener("click", () => {
      const newValue = input.value;

      if (!newValue) return;

      if (type === "date") {
        this.selectedDate = newValue;
        const dateText = this.querySelector("#dateText");
        if (dateText) dateText.textContent = this.formatDateDisplay();
      } else {
        this.selectedTime = newValue;
        const timeText = this.querySelector("#timeText");
        if (timeText) timeText.textContent = this.formatTimeDisplay();
      }

      this.saveDateTime();
      modal.innerHTML = "";

      if (this.startStop && this.destStop) {
        this.loadJourney();
      }
    });
  }

  async searchStops(query, type) {
    if (!query || query.length < 3) return;

    const resultBox =
      this.querySelector(type === "start" ? "#startResults" : "#destResults");

    resultBox.innerHTML = "Suche...";

    const url =
      "/api/kvb_journey/search?q=" +
      encodeURIComponent(query);

    try {
      const response = await fetch(url);
      const data = await response.json();

      const stops =
        Array.isArray(data)
          ? data
          : data.locations || data.results || [];

      if (!stops.length) {
        resultBox.innerHTML = "Keine Treffer.";
        return;
      }

      resultBox.innerHTML = stops.slice(0, 20).map((stop, index) => `
        <div data-index="${index}" style="padding:9px;border-bottom:1px solid #ddd;cursor:pointer;background:white;">
          <b>${stop.alias || stop.name}</b><br>
          <span style="font-size:12px;color:#666;">${stop.name || ""}</span>
        </div>
      `).join("");

      [...resultBox.querySelectorAll("div[data-index]")].forEach(el => {
        el.addEventListener("click", () => {
          const stop = stops[parseInt(el.dataset.index)];

          if (type === "start") {
            this.startStop = stop;
            this.querySelector("#startInput").value = stop.alias || stop.name;
            this.querySelector("#startResults").innerHTML = "";
          } else {
            this.destStop = stop;
            this.querySelector("#destInput").value = stop.alias || stop.name;
            this.querySelector("#destResults").innerHTML = "";
          }

          this.saveStops();

          if (this.startStop && this.destStop) {
            this.loadJourney();
          }
        });
      });
    } catch (err) {
      resultBox.innerHTML = "Fehler bei der Suche.";
      console.error("KVB search error:", err);
    }
  }

  cleanDirection(text) {
    if (!text) return "-";
    return text.replace(/^Köln\s+/i, "").trim();
  }

  extractRecallId(journeys) {
    if (journeys && journeys.length && journeys[0].recallId) {
      this.currentRecallId = journeys[0].recallId;
    }
  }

  renderJourneyList(journeys) {
    const box = this.querySelector("#journeys");

    journeys.sort((a, b) => a.departure - b.departure);
    this.extractRecallId(journeys);

    box.innerHTML = journeys.slice(0, 6).map(journey => {
      const leg =
        (journey.legs || []).find(l => l.transport && l.transport.icon !== "WALK") ||
        journey.legs?.[0] ||
        {};

      const transport = leg.transport || {};
      const color = transport.color || "#143e74";
      const line = transport.lineNumber || transport.name || "-";
      const direction = this.cleanDirection(transport.direction || transport.headsign);

      const icon =
        transport.icon === "BUS"
          ? "🚌"
          : transport.icon === "WALK"
            ? "🚶"
            : "🚆";

      const dep = new Date(journey.departure).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
      });

      const arr = new Date(journey.arrival).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
      });

      const duration = Math.round((journey.arrival - journey.departure) / 60000);
      const stops = leg.stopSequence ? leg.stopSequence.length : 0;

      return `
        <div style="
          display:grid;
          grid-template-columns:50px 1fr;
          gap:9px;
          padding:7px 6px;
          border-bottom:1px solid #e5e5e5;
          background:white;
        ">
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;color:#222;font-size:13px;line-height:1.1;">
            <div style="font-weight:800;">${dep}</div>
            <div style="height:17px;width:4px;background:${color};border-radius:4px;margin:3px 0;"></div>
            <div style="font-weight:400;color:#555;">${arr}</div>
          </div>

          <div style="display:flex;flex-direction:column;justify-content:center;min-width:0;">
            <div style="
              display:flex;
              align-items:center;
              gap:6px;
              font-size:14px;
              font-weight:800;
              line-height:1.2;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
            ">
              <span style="font-size:15px;">${icon}</span>
              <span style="background:${color};color:white;padding:2px 7px;border-radius:7px;font-weight:800;font-size:13px;">${line}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;">Richtung ${direction}</span>
            </div>

            <div style="margin-top:4px;color:#666;font-size:13px;line-height:1.2;">
              ${duration} min • ${stops} Haltestellen
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  async loadJourney() {
    const box = this.querySelector("#journeys");
    box.innerHTML = "Lade Verbindung...";

    const rawDate = this.buildIsoDateTime();
    const date = encodeURIComponent(rawDate);

    console.log("KVB CARD JOURNEY DATETIME:", rawDate);

    const url =
      "/api/kvb_journey/journey?start=" +
      encodeURIComponent(this.startStop.id) +
      "&dest=" +
      encodeURIComponent(this.destStop.id) +
      "&date=" +
      date;

    try {
      const response = await fetch(url);
      const data = await response.json();

      const journeys =
        Array.isArray(data)
          ? data
          : data.journey || data.journeys || [];

      if (!journeys.length) {
        box.innerHTML = "Keine Verbindung gefunden.";
        return;
      }

      this.currentJourneys = journeys;
      this.renderJourneyList(journeys);
    } catch (err) {
      box.innerHTML = "Fehler beim Laden der Verbindung.";
      console.error("KVB journey error:", err);
    }
  }

  async loadRecall(direction) {
    const box = this.querySelector("#journeys");

    if (!this.currentRecallId) {
      box.innerHTML = "Keine recallId vorhanden.";
      return;
    }

    const url =
      direction === "next"
        ? "/api/kvb_journey/next?recallId=" + encodeURIComponent(this.currentRecallId)
        : "/api/kvb_journey/previous?recallId=" + encodeURIComponent(this.currentRecallId);

    try {
      box.innerHTML =
        direction === "next"
          ? "Lade nächste Verbindungen..."
          : "Lade vorherige Verbindungen...";

      const response = await fetch(url);
      const data = await response.json();

      const journeys =
        Array.isArray(data)
          ? data
          : data.journey || data.journeys || [];

      if (!journeys.length) {
        box.innerHTML = "Keine weiteren Verbindungen.";
        return;
      }

      this.currentJourneys = journeys;
      this.renderJourneyList(journeys);
    } catch (err) {
      box.innerHTML = "Fehler beim Laden.";
      console.error("KVB recall error:", err);
    }
  }

  getCardSize() {
    return 5;
  }
}

if (!customElements.get("kvb-journey-card")) {
  customElements.define("kvb-journey-card", KVBJourneyCard);
}
