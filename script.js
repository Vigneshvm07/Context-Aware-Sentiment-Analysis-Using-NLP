const $ = id => document.getElementById(id);

const textInput = $("textInput");
const analyzeBtn = $("analyzeBtn");

let stats = { positive: 0, neutral: 0, negative: 0 };
let history = [];
let chart;

// Sentiment dictionary
const positiveWords = {
    good: 1, great: 2, excellent: 3, amazing: 3,
    awesome: 2, love: 3, lovely: 2, happy: 2,
    wonderful: 3, fantastic: 3, best: 3, beautiful: 2,
    perfect: 3, success: 2, successful: 2, enjoy: 2,
    nice: 1, brilliant: 3, excited: 2, helpful: 2,
    impressive: 2, delightful: 3, satisfied: 2,
    like: 1, positive: 2, interesting: 1, recommend: 2,
    comfortable: 2, delicious: 2, valuable: 2
};

const negativeWords = {
    bad: -1, worst: -3, terrible: -3, awful: -3,
    hate: -3, sad: -2, angry: -2, poor: -2,
    horrible: -3, disappointed: -2, disappointing: -2,
    fail: -2, failure: -2, problem: -1, wrong: -1,
    boring: -2, annoying: -2, useless: -2,
    difficult: -1, scam: -3, delay: -1, slow: -1,
    broken: -2, dislike: -2, unhappy: -2,
    frustrating: -2, frustratingly: -2, regret: -2,
    damage: -2, expensive: -1, uncomfortable: -2,
    negative: -2, miserable: -3, horrible: -3
};

// Words that reverse the sentiment of nearby words
const negations = [
    "not", "never", "no", "isn't", "wasn't",
    "aren't", "weren't", "don't", "doesn't",
    "didn't", "can't", "couldn't", "won't",
    "wouldn't", "hardly", "barely", "neither"
];

// Words that increase sentiment strength
const intensifiers = {
    very: 1.5,
    really: 1.5,
    extremely: 2,
    absolutely: 2,
    incredibly: 2,
    totally: 1.5,
    highly: 1.5,
    so: 1.4,
    quite: 1.2,
    slightly: 0.5,
    somewhat: 0.7,
    barely: 0.5
};

// Contrast words indicate a change in opinion
const contrastWords = [
    "but", "however", "although",
    "though", "yet", "nevertheless"
];

// Emotion dictionary
const emotions = {
    Happiness: ["happy", "joy", "delighted", "glad", "wonderful", "enjoy"],
    Anger: ["angry", "furious", "hate", "annoying", "frustrating"],
    Sadness: ["sad", "unhappy", "miserable", "disappointed", "upset"],
    Excitement: ["excited", "amazing", "awesome", "fantastic", "brilliant"],
    Fear: ["afraid", "scared", "fear", "worried", "nervous"],
    Trust: ["trust", "reliable", "honest", "safe", "confident"]
};

// Character count
textInput.addEventListener("input", () => {
    $("charCount").textContent =
        `${textInput.value.length} / 2000`;
});

// Example buttons
document.querySelectorAll(".example-btn").forEach(button => {
    button.addEventListener("click", () => {
        textInput.value = button.dataset.example;
        $("charCount").textContent =
            `${textInput.value.length} / 2000`;
        textInput.focus();
    });
});

// Clear input
$("clearBtn").addEventListener("click", () => {
    textInput.value = "";
    $("charCount").textContent = "0 / 2000";
    resetResult();
});

// Analyze button
analyzeBtn.addEventListener("click", () => {
    const text = textInput.value.trim();

    if (!text) {
        alert("Please enter some text to analyze.");
        return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyzing...";

    setTimeout(() => {
        const result = analyzeText(text);

        displayResult(result);
        displayInsights(result);
        updateDashboard(result);
        addHistory(text, result);

        analyzeBtn.disabled = false;
        analyzeBtn.textContent = "✦ Analyze Sentiment";
    }, 350);
});

// Text preprocessing
function preprocess(text) {
    return text
        .toLowerCase()
        .replace(/([.!?,;])/g, " $1 ")
        .replace(/[^\p{L}\p{N}'!?.,;\s-]/gu, " ")
        .split(/\s+/)
        .filter(Boolean);
}

// Check if a word is a sentiment word
function getWordScore(word) {
    if (Object.hasOwn(positiveWords, word)) {
        return positiveWords[word];
    }

    if (Object.hasOwn(negativeWords, word)) {
        return negativeWords[word];
    }

    return 0;
}

// Main context-aware sentiment analysis
function analyzeText(text) {
    const tokens = preprocess(text);

    let score = 0;
    let positiveHits = 0;
    let negativeHits = 0;
    let detectedWords = [];
    let contextNotes = [];

    let negateNext = 0;
    let intensity = 1;
    let contrastBoost = 1;

    const sentimentTokens = tokens.map((word, index) => {
        return {
            word,
            index,
            score: getWordScore(word)
        };
    });

    for (let i = 0; i < tokens.length; i++) {
        const word = tokens[i];

        if ([".", "!", "?", ";"].includes(word)) {
            negateNext = 0;
            intensity = 1;
            continue;
        }

        if (contrastWords.includes(word)) {
            contrastBoost = 1.5;
            negateNext = 0;
            intensity = 1;
            contextNotes.push(
                `Contrast detected: "${word}" changes the emphasis of the sentence.`
            );
            continue;
        }

        if (negations.includes(word)) {
            negateNext = 3;
            contextNotes.push(
                `Negation detected: "${word}" may reverse nearby sentiment.`
            );
            continue;
        }

        if (Object.hasOwn(intensifiers, word)) {
            intensity = intensifiers[word];
            continue;
        }

        const baseScore = getWordScore(word);

        if (baseScore !== 0) {
            let adjusted = baseScore * intensity;

            if (negateNext > 0) {
                adjusted *= -1;
                contextNotes.push(
                    `Negation changed the meaning of "${word}".`
                );
            }

            adjusted *= contrastBoost;

            score += adjusted;

            if (adjusted > 0) {
                positiveHits++;
            } else {
                negativeHits++;
            }

            detectedWords.push({
                word,
                score: adjusted
            });

            intensity = 1;
            negateNext = 0;
            contrastBoost = 1;
        } else {
            if (negateNext > 0) negateNext--;
            intensity = 1;
        }
    }

    // Handle punctuation as a mild emotional signal
    const exclamations = (text.match(/!/g) || []).length;
    if (exclamations > 0 && score !== 0) {
        score += Math.sign(score) * Math.min(exclamations, 2) * 0.25;
        contextNotes.push("Exclamation marks indicate emphasis.");
    }

    // Handle mixed opinions
    if (positiveHits > 0 && negativeHits > 0) {
        contextNotes.push("Mixed sentiment detected in the text.");
    }

    // Final sentiment
    let sentiment = "Neutral";

    if (score >= 0.5) {
        sentiment = "Positive";
    } else if (score <= -0.5) {
        sentiment = "Negative";
    }

    // Calculate normalized scores for visualization
    const magnitude = Math.abs(score);
    const confidence = Math.min(
        95,
        Math.round(55 + magnitude * 10)
    );

    let positivePercentage;
    let neutralPercentage;
    let negativePercentage;

    if (sentiment === "Positive") {
        positivePercentage = Math.round(
            50 + 45 * magnitude / (magnitude + 3)
        );
        negativePercentage = Math.round(
            5 + 15 * negativeHits / Math.max(1, positiveHits + negativeHits)
        );
        neutralPercentage = 100 - positivePercentage - negativePercentage;
    } else if (sentiment === "Negative") {
        negativePercentage = Math.round(
            50 + 45 * magnitude / (magnitude + 3)
        );
        positivePercentage = Math.round(
            5 + 15 * positiveHits / Math.max(1, positiveHits + negativeHits)
        );
        neutralPercentage = 100 - negativePercentage - positivePercentage;
    } else {
        positivePercentage = 20;
        negativePercentage = 20;
        neutralPercentage = 60;
    }

    return {
        sentiment,
        score: Number(score.toFixed(2)),
        confidence,
        positivePercentage,
        neutralPercentage,
        negativePercentage,
        detectedWords,
        contextNotes,
        emotions: detectEmotions(tokens),
        positiveHits,
        negativeHits
    };
}

// Emotion detection
function detectEmotions(tokens) {
    const found = [];

    for (const [emotion, words] of Object.entries(emotions)) {
        const matches = tokens.filter(word =>
            words.includes(word)
        );

        if (matches.length > 0) {
            found.push({
                emotion,
                count: matches.length
            });
        }
    }

    return found.sort((a, b) => b.count - a.count);
}

// Show main result
function displayResult(result) {
    const icons = {
        Positive: "😊",
        Neutral: "😐",
        Negative: "😟"
    };

    const messages = {
        Positive: "The text expresses an overall positive sentiment.",
        Neutral: "The text appears neutral or has balanced sentiment.",
        Negative: "The text expresses an overall negative sentiment."
    };

    $("resultEmoji").textContent = icons[result.sentiment];
    $("sentimentResult").textContent = result.sentiment;
    $("resultMessage").textContent = messages[result.sentiment];
    $("resultStatus").textContent = "COMPLETED";

    $("confidenceValue").textContent =
        `${result.confidence}%`;
    $("confidenceBar").style.width =
        `${result.confidence}%`;

    $("positiveScore").textContent =
        `${result.positivePercentage}%`;
    $("neutralScore").textContent =
        `${result.neutralPercentage}%`;
    $("negativeScore").textContent =
        `${result.negativePercentage}%`;

    const colors = {
        Positive: "#20ae82",
        Neutral: "#8990a5",
        Negative: "#ef6678"
    };

    $("confidenceBar").style.background =
        colors[result.sentiment];
}

// Show contextual observations, keywords and emotions
function displayInsights(result) {
    const contextBox = $("contextInsights");
    const keywordBox = $("keywordInsights");
    const emotionBox = $("emotionInsights");

    contextBox.replaceChildren();

    const notes = result.contextNotes.length
        ? result.contextNotes
        : ["No strong contextual signals detected."];

    notes.forEach(note => {
        const item = document.createElement("div");
        item.className = "context-item";
        item.textContent = "✦ " + note;
        contextBox.appendChild(item);
    });

    keywordBox.replaceChildren();

    if (result.detectedWords.length === 0) {
        keywordBox.textContent =
            "No sentiment keywords detected.";
    } else {
        result.detectedWords.forEach(item => {
            const tag = document.createElement("span");
            tag.className = "keyword-tag";

            if (item.score < 0) {
                tag.classList.add("negative");
            }

            tag.textContent = item.word;
            keywordBox.appendChild(tag);
        });
    }

    emotionBox.replaceChildren();

    if (result.emotions.length === 0) {
        emotionBox.textContent =
            "No specific emotion detected.";
    } else {
        result.emotions.forEach(item => {
            const row = document.createElement("div");
            row.className = "emotion-item";

            const name = document.createElement("span");
            name.textContent = item.emotion;

            const count = document.createElement("span");
            count.textContent = `${item.count} signal(s)`;

            row.append(name, count);
            emotionBox.appendChild(row);
        });
    }
}

// Dashboard statistics
function updateDashboard(result) {
    stats[result.sentiment.toLowerCase()]++;

    $("totalCount").textContent =
        stats.positive + stats.neutral + stats.negative;

    $("positiveCount").textContent = stats.positive;
    $("neutralCount").textContent = stats.neutral;
    $("negativeCount").textContent = stats.negative;

    updateChart();
}

// Chart.js visualization
function initializeChart() {
    const ctx = $("sentimentChart").getContext("2d");

    chart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Positive", "Neutral", "Negative"],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    "#20ae82",
                    "#8990a5",
                    "#ef6678"
                ],
                borderWidth: 0,
                hoverOffset: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "72%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            family: "DM Sans",
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function updateChart() {
    if (!chart) return;

    chart.data.datasets[0].data = [
        stats.positive,
        stats.neutral,
        stats.negative
    ];

    chart.update();
}

// Analysis history
function addHistory(text, result) {
    history.unshift({
        text,
        sentiment: result.sentiment,
        confidence: result.confidence,
        time: new Date().toLocaleTimeString()
    });

    if (history.length > 10) {
        history.pop();
    }

    renderHistory();
}

function renderHistory() {
    const list = $("historyList");
    list.replaceChildren();

    if (history.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No analyses yet. Try entering some text.";
        list.appendChild(empty);
        return;
    }

    const icons = {
        Positive: "😊",
        Neutral: "😐",
        Negative: "😟"
    };

    history.forEach(item => {
        const row = document.createElement("div");
        row.className = "history-item";

        const emoji = document.createElement("div");
        emoji.className = "history-emoji";
        emoji.textContent = icons[item.sentiment];

        const content = document.createElement("div");
        content.className = "history-text";

        const title = document.createElement("strong");
        title.textContent = item.sentiment;

        const preview = document.createElement("small");
        preview.textContent = item.text;

        content.append(title, preview);

        const confidence = document.createElement("span");
        confidence.className = "history-confidence";
        confidence.textContent = `${item.confidence}%`;

        row.append(emoji, content, confidence);
        list.appendChild(row);
    });
}

// Clear dashboard history and statistics
$("clearHistory").addEventListener("click", () => {
    history = [];
    stats = { positive: 0, neutral: 0, negative: 0 };

    $("totalCount").textContent = "0";
    $("positiveCount").textContent = "0";
    $("neutralCount").textContent = "0";
    $("negativeCount").textContent = "0";

    renderHistory();
    updateChart();
});

// Reset analyzer output
function resetResult() {
    $("resultEmoji").textContent = "✧";
    $("sentimentResult").textContent = "Awaiting analysis";
    $("resultMessage").textContent =
        "Your sentiment insights will appear here.";
    $("resultStatus").textContent = "WAITING";
    $("confidenceValue").textContent = "0%";
    $("confidenceBar").style.width = "0%";

    $("positiveScore").textContent = "0%";
    $("neutralScore").textContent = "0%";
    $("negativeScore").textContent = "0%";

    $("contextInsights").textContent =
        "Contextual observations will appear after analysis.";
    $("keywordInsights").textContent =
        "Sentiment keywords will appear here.";
    $("emotionInsights").textContent =
        "Emotional signals will appear here.";
}

initializeChart();