"use strict";

const TAG_KEYWORDS = {
    commission_increase: ["commission", "percentage", "cut", "increased", "raised", "hiked"],
    account_suspended: ["deactivated", "banned", "suspended", "blocked", "locked"],
    payment_delay: ["payment", "unpaid", "settlement", "not received", "delayed"],
    rating_manipulation: ["rating", "star", "review", "unfair rating"],
    safety_concern: ["safety", "dangerous", "threat", "emergency", "night"],
    app_issue: ["app", "crash", "bug", "error", "glitch"],
};

function autoTag(description) {
    const lower = description.toLowerCase();
    const tags = new Set();

    for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lower.includes(keyword)) {
                tags.add(tag);
                break;
            }
        }
    }

    return Array.from(tags).slice(0, 3);
}

module.exports = { autoTag };
