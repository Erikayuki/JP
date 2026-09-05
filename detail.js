let currentAudio = null;

function normalizeMultiline(value) {
    return String(value || "").replace(/\r\n?/g, "\n");
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

function appendImage(container, card) {
    const raw = firstValue(card, ["IMAGE_WEB_URL", "IMAGE_URL"]);
    const url = resolveImageUrl(raw);
    if (!url) return;

    const img = document.createElement("img");
    img.className = "word-image";
    img.src = url;
    img.alt = card.Front || "ภาพประกอบคำศัพท์";

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
    const url = resolveAudioUrl(raw);
    if (!url && !card.Front) return;

    const box = document.createElement("div");
    box.className = "audio-box";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sound-btn";
    button.textContent = "🔊";
    button.title = "ฟังเสียง";

    button.addEventListener("click", () => playAudio(url, card.Front));

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

function showDetail(card) {
    const detail = document.getElementById("detail");
    detail.innerHTML = "";

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

    appendImage(detail, card);
    appendAudioButton(detail, card);

    const back = document.createElement("div");
    back.className = "back-content";
    back.textContent = normalizeMultiline(card.Back);
    detail.appendChild(back);

    appendExample(detail, card);
    appendMeta(detail, card);
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

let selectedCard = null;
try {
    selectedCard = JSON.parse(localStorage.getItem("selectedCard"));
} catch (error) {
    console.warn("selectedCard could not be read.", error);
}

if (selectedCard) {
    showDetail(selectedCard);
} else {
    document.getElementById("detail").textContent = "ไม่พบคำศัพท์ที่เลือก กรุณากลับไปเลือกคำศัพท์ใหม่";
}
