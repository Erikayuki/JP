const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTKxORwJLSfQk4dCktLQUblnAab4sV-Wh0tpLfcm4Ly5eE9dJiUSJwhOLWX_qyW2StsqdiSqfhe10-T/pub?gid=0&single=true&output=csv";

let cards = [];
let currentAudio = null;

async function load() {
    try {
        const res = await fetch(SHEET_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`Google Sheet HTTP ${res.status}`);

        const csv = await res.text();
        const parsed = Papa.parse(csv, {
            header: true,
            skipEmptyLines: "greedy",
            transformHeader: header => String(header || "").replace(/^\uFEFF/, "").trim()
        });

        if (parsed.errors && parsed.errors.length) {
            console.warn("CSV parse warnings:", parsed.errors);
        }

        cards = parsed.data.filter(card => String(card.ID || card.Front || "").trim() !== "");
        populateCategoryFilter(cards);
        display(cards);
    } catch (error) {
        console.error(error);
        document.getElementById("list").textContent = "โหลดข้อมูลไม่สำเร็จ";
    }
}

function normalizeMultiline(value) {
    return String(value || "").replace(/\r\n?/g, "\n");
}

function display(data) {
    const list = document.getElementById("list");
    list.innerHTML = "";

    if (data.length === 0) {
        const empty = document.createElement("div");
        empty.className = "detail-empty";
        empty.textContent = "ไม่พบคำศัพท์ที่ตรงกับเงื่อนไข";
        list.appendChild(empty);
        return;
    }

    data.forEach(card => {
        const div = document.createElement("div");
        div.className = "dictionary-card";
        div.tabIndex = 0;

        const title = document.createElement("h2");
        title.textContent = card.Front || "";
        div.appendChild(title);

        if (card.READING) {
            const reading = document.createElement("p");
            reading.className = "reading";
            reading.textContent = card.READING;
            div.appendChild(reading);
        }

        const preview = document.createElement("p");
        preview.className = "dictionary-preview";
        const compactBack = normalizeMultiline(card.Back).replace(/\s+/g, " ").trim();
        preview.textContent = compactBack.length > 90
            ? `${compactBack.slice(0, 90)}…`
            : compactBack;
        div.appendChild(preview);

        appendMeta(div, card);

        const openCard = () => {
            if (window.matchMedia("(max-width: 600px)").matches) {
                localStorage.setItem("selectedCard", JSON.stringify(card));
                window.location.href = "detail.html";
            } else {
                showDetail(card);
            }
        };

        div.addEventListener("click", openCard);
        div.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCard();
            }
        });

        list.appendChild(div);
    });
}

function showDetail(card) {
    const detail = document.getElementById("detail");
    detail.innerHTML = "";
    detail.scrollTop = 0;

    const title = document.createElement("h1");
    title.className = "detail-title";
    title.textContent = card.Front || "";
    detail.appendChild(title);

    if (card.READING) {
        const reading = document.createElement("div");
        reading.className = "reading detail-reading";
        reading.textContent = card.READING;
        detail.appendChild(reading);
    }

    appendImage(detail, card, "word-image");
    appendAudioButton(detail, card);

    const back = document.createElement("div");
    back.className = "back-content";
    back.textContent = normalizeMultiline(card.Back);
    detail.appendChild(back);

    appendExample(detail, card);
    appendMeta(detail, card);
}

function appendImage(container, card, className) {
    const raw = firstValue(card, ["IMAGE_WEB_URL", "IMAGE_URL"]);
    const url = resolveImageUrl(raw);
    if (!url) return;

    const img = document.createElement("img");
    img.className = className;
    img.src = url;
    img.alt = card.Front || "ภาพประกอบคำศัพท์";
    img.loading = "lazy";

    img.addEventListener("error", () => {
        console.warn("Image failed to load:", raw);
        img.remove();

        const message = document.createElement("div");
        message.className = "media-error";
        message.textContent = "รูปภาพนี้โหลดไม่ได้";
        container.appendChild(message);
    }, { once: true });

    container.appendChild(img);
}

function appendAudioButton(container, card) {
    const raw = firstValue(card, ["AUDIO_WEB_URL", "AUDIO_URL"]);
    const audioUrl = resolveAudioUrl(raw);
    if (!audioUrl && !card.Front) return;

    const box = document.createElement("div");
    box.className = "audio-box";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sound-btn";
    button.textContent = "🔊";
    button.title = "ฟังเสียง";
    button.setAttribute("aria-label", `ฟังเสียง ${card.Front || "คำศัพท์"}`);

    button.addEventListener("click", event => {
        event.stopPropagation();
        playAudio(audioUrl, card.Front);
    });

    box.appendChild(button);
    container.appendChild(box);
}

function appendExample(container, card) {
    if (!String(card.EXAMPLE || "").trim()) return;

    const section = document.createElement("div");
    section.className = "example-section";

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = "ตัวอย่าง:";

    const example = document.createElement("div");
    example.className = "example-content";
    example.textContent = normalizeMultiline(card.EXAMPLE);

    section.appendChild(title);
    section.appendChild(example);
    container.appendChild(section);
}

function appendMeta(container, card) {
    if (!card.CAT && !card.JLPT_LEVEL) return;

    const meta = document.createElement("div");
    meta.className = "card-meta";

    if (card.CAT) {
        const cat = document.createElement("span");
        cat.className = "cat-label";
        cat.textContent = card.CAT;
        meta.appendChild(cat);
    }

    if (card.JLPT_LEVEL) {
        const jlpt = document.createElement("span");
        jlpt.className = "jlpt-label";
        jlpt.textContent = card.JLPT_LEVEL;
        meta.appendChild(jlpt);
    }

    container.appendChild(meta);
}

function populateCategoryFilter(data) {
    const select = document.getElementById("category");
    if (!select) return;

    const currentValue = select.value;
    const categories = [...new Set(
        data
            .map(card => String(card.CAT || "").trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    select.innerHTML = '<option value="">ทุก Category</option>';

    for (const category of categories) {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    }

    if (categories.includes(currentValue)) {
        select.value = currentValue;
    }
}

function searchCard() {
    const text = document.getElementById("search").value.trim().toLowerCase();
    const level = document.getElementById("level").value;
    const category = document.getElementById("category").value;

    const filtered = cards.filter(card => {
        // Search intentionally uses only Front + Back.
        // EXAMPLE, CAT and JLPT_LEVEL are excluded from text search.
        const searchableText = [
            card.Front,
            card.Back
        ]
            .map(value => String(value || "").toLowerCase())
            .join(" ");

        const matchText = searchableText.includes(text);
        const matchLevel = level === "" || String(card.JLPT_LEVEL || "").trim() === level;
        const matchCategory = category === "" || String(card.CAT || "").trim() === category;

        return matchText && matchLevel && matchCategory;
    });

    display(filtered);

    const detail = document.getElementById("detail");
    if (detail && !window.matchMedia("(max-width: 600px)").matches) {
        detail.innerHTML = '<div class="detail-empty">เลือกคำศัพท์จากด้านซ้าย</div>';
    }
}

function firstValue(card, keys) {
    for (const key of keys) {
        const value = String(card[key] || "").trim();
        if (value) return value;
    }
    return "";
}

function extractDriveId(url) {
    const text = String(url || "").trim();
    if (!text) return "";

    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /\/d\/([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
    }

    return "";
}

function resolveImageUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";

    const driveId = value.includes("drive.google.com") ? extractDriveId(value) : "";
    if (driveId) {
        return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1600`;
    }

    return value;
}

function resolveAudioUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";

    const driveId = value.includes("drive.google.com") ? extractDriveId(value) : "";
    if (driveId) {
        return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
    }

    return value;
}

function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

    if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
    }
}

function playAudio(url, fallbackText) {
    stopCurrentAudio();

    if (url) {
        try {
            currentAudio = new Audio(url);
            currentAudio.preload = "auto";
            currentAudio.play().catch(error => {
                console.warn("Audio URL could not be played; falling back to Japanese TTS.", error, url);
                currentAudio = null;
                speakJapanese(fallbackText);
            });
            return;
        } catch (error) {
            console.warn("Audio failed; falling back to Japanese TTS.", error);
        }
    }

    speakJapanese(fallbackText);
}

function speakJapanese(text) {
    if (!text || !("speechSynthesis" in window)) return;

    const speech = new SpeechSynthesisUtterance(String(text));
    speech.lang = "ja-JP";
    speech.rate = 0.8;
    speech.pitch = 1;

    speechSynthesis.cancel();
    speechSynthesis.speak(speech);
}

load();
