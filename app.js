const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTKxORwJLSfQk4dCktLQUblnAab4sV-Wh0tpLfcm4Ly5eE9dJiUSJwhOLWX_qyW2StsqdiSqfhe10-T/pub?gid=0&single=true&output=csv";

let cards = [];
let current = null;
let showingBack = false;
let currentAudio = null;

let progress = loadProgress();

function loadProgress() {
    let raw = {};

    try {
        raw = JSON.parse(localStorage.getItem("progress")) || {};
    } catch (error) {
        console.warn("Progress data was invalid; starting with a clean in-browser progress map.", error);
        raw = {};
    }

    const migrated = {};

    for (const [id, value] of Object.entries(raw)) {
        migrated[id] = normalizeProgress(value);
    }

    localStorage.setItem("progress", JSON.stringify(migrated));
    return migrated;
}

function getDefaultProgress() {
    return {
        repetitions: 0,
        intervalDays: 0,
        ease: 2.0,
        lapses: 0,
        relearning: false,
        previousInterval: 0,
        lastReviewAt: null,
        dueAt: null,
        status: "NEW"
    };
}

function normalizeProgress(raw) {
    const p = getDefaultProgress();
    const source = raw || {};

    p.repetitions = toNonNegativeNumber(source.repetitions ?? source.count, 0);
    p.intervalDays = toNonNegativeNumber(source.intervalDays ?? source.interval, 0);
    p.ease = clampNumber(source.ease, 1.3, 2.6, 2.0);
    p.lapses = toNonNegativeNumber(source.lapses, 0);
    p.relearning = Boolean(source.relearning);
    p.previousInterval = toNonNegativeNumber(source.previousInterval ?? source.interval, 0);
    p.lastReviewAt = validDateValue(source.lastReviewAt ?? source.lastReview) || null;
    p.dueAt = normalizeDueAt(source.dueAt ?? source.nextReview);

    if (source.status) {
        p.status = String(source.status);
    } else if (p.relearning) {
        p.status = "RELEARNING";
    } else if (p.repetitions > 0 || p.dueAt) {
        p.status = "REVIEW";
    }

    return p;
}

function toNonNegativeNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function validDateValue(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeDueAt(value) {
    if (!value) return null;

    const text = String(value).trim();

    // รองรับข้อมูลเก่าที่เก็บ YYYY-MM-DD
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
        ? `${text}T00:00:00`
        : text;

    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function loadCards() {
    try {
        setCardMessage("กำลังโหลด...");

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

        if (cards.length === 0) {
            throw new Error("ไม่พบข้อมูล flashcard ใน Google Sheet");
        }

        selectCard();
    } catch (error) {
        console.error(error);
        current = null;
        setCardMessage("โหลดข้อมูลไม่สำเร็จ");
        setReviewButtonsDisabled(true);
    }
}

function setCardMessage(message) {
    const word = document.getElementById("word");
    const answer = document.getElementById("answer");
    if (word) {
        word.style.display = "block";
        word.textContent = message;
    }
    if (answer) {
        answer.style.display = "none";
        answer.innerHTML = "";
    }
}

function normalizeMultiline(value) {
    return String(value || "").replace(/\r\n?/g, "\n");
}

function selectCard() {
    const now = new Date();

    const relearningCards = [];
    const reviewCards = [];
    const newCards = [];

    for (const card of cards) {
        const id = String(card.ID || "").trim();
        const p = id ? progress[id] : null;

        if (!p) {
            newCards.push(card);
            continue;
        }

        const due = p.dueAt ? new Date(p.dueAt) : null;
        const isDue = due && !Number.isNaN(due.getTime()) && due <= now;

        if (p.status === "RELEARNING") {
            if (isDue) relearningCards.push(card);
        } else if (isDue) {
            reviewCards.push(card);
        }
    }

    let pool = [];
    let poolName = "";

    if (relearningCards.length > 0) {
        pool = relearningCards;
        poolName = "Relearning";
    } else if (reviewCards.length > 0) {
        pool = reviewCards;
        poolName = "Review";
    } else if (newCards.length > 0) {
        pool = newCards;
        poolName = "New";
    }

    updateStatus(relearningCards.length, reviewCards.length, newCards.length, poolName);

    if (pool.length === 0) {
        current = null;
        showingBack = false;
        setCardMessage("ไม่มีคำต้องทบทวน 🎉");
        setReviewButtonsDisabled(true);
        return;
    }

    current = pool[Math.floor(Math.random() * pool.length)];
    setReviewButtonsDisabled(false);
    showFront();
}

function updateStatus(relearningCount, reviewCount, newCount, poolName) {
    const status = document.getElementById("status");
    if (!status) return;

    const active = poolName ? ` • กำลังสุ่มจาก ${poolName}` : "";
    status.textContent = `Relearn ${relearningCount} | Review ${reviewCount} | ใหม่ ${newCount}${active}`;
}

function setReviewButtonsDisabled(disabled) {
    const remember = document.getElementById("rememberBtn");
    const forget = document.getElementById("forgetBtn");
    if (remember) remember.disabled = disabled;
    if (forget) forget.disabled = disabled;
}

function toggleCard() {
    if (!current) return;
    showingBack ? showFront() : showBack();
}

function showFront() {
    if (!current) return;

    showingBack = false;

    const word = document.getElementById("word");
    const answer = document.getElementById("answer");

    word.style.display = "block";
    answer.style.display = "none";
    answer.innerHTML = "";
    word.textContent = current.Front || "";
}

function showBack() {
    if (!current) return;

    showingBack = true;

    const word = document.getElementById("word");
    const answer = document.getElementById("answer");

    word.style.display = "none";
    answer.style.display = "block";
    answer.innerHTML = "";

    appendImage(answer, current, "card-image");
    appendAudioButton(answer, current);
    appendBackContent(answer, current);
    appendExample(answer, current);
    appendMeta(answer, current);
}

function appendBackContent(container, card) {
    const back = document.createElement("div");
    back.className = "back-content";
    back.textContent = normalizeMultiline(card.Back);
    container.appendChild(back);
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

    // แม้ไม่มีไฟล์เสียง ให้ใช้ Japanese TTS จาก Front ได้
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

function review(correct) {
    if (!current) return;

    const id = String(current.ID || "").trim();
    if (!id) {
        console.warn("This card has no ID, so review progress cannot be stored safely.");
        return;
    }

    const p = normalizeProgress(progress[id] || getDefaultProgress());
    const now = new Date();

    p.lastReviewAt = now.toISOString();

    if (correct) {
        if (p.relearning) {
            p.intervalDays = Math.max(1, Math.round((p.previousInterval || 1) * 0.25));
            p.relearning = false;
        } else if (p.repetitions === 0) {
            p.intervalDays = 1;
        } else if (p.repetitions === 1) {
            p.intervalDays = 3;
        } else if (p.repetitions === 2) {
            p.intervalDays = 7;
        } else {
            p.intervalDays = Math.max(
                p.intervalDays + 1,
                Math.round(p.intervalDays * p.ease)
            );
        }

        p.repetitions += 1;
        p.ease = Math.min(2.6, p.ease + 0.05);
        p.status = "REVIEW";

        const next = new Date(now);
        next.setDate(next.getDate() + p.intervalDays);
        p.dueAt = next.toISOString();
    } else {
        p.lapses += 1;
        p.ease = Math.max(1.3, p.ease - 0.20);
        p.previousInterval = Math.max(1, p.intervalDays || 1);
        p.relearning = true;
        p.status = "RELEARNING";

        // คำที่ลืมจะกลับมาให้ทบทวนอีกประมาณ 10 นาที
        p.dueAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    }

    progress[id] = p;
    localStorage.setItem("progress", JSON.stringify(progress));

    stopCurrentAudio();
    selectCard();
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

const cardElement = document.getElementById("card");
if (cardElement) {
    cardElement.addEventListener("click", toggleCard);
    cardElement.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleCard();
        }
    });
}

loadCards();
