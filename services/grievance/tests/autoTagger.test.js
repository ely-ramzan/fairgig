"use strict";
/**
 * TDD — Phase H3.7: src/services/autoTagger.js
 * Keyword-based tag extraction from free-text descriptions.
 */
const { autoTag } = require("../src/services/autoTagger");

describe("autoTag — no match", () => {
    test("empty string returns empty array", () => {
        expect(autoTag("")).toEqual([]);
    });

    test("unrelated text returns empty array", () => {
        expect(autoTag("I had a good day today")).toEqual([]);
    });
});

describe("autoTag — single category matches", () => {
    test("'commission increased' triggers commission_increase", () => {
        const tags = autoTag("My commission increased this week");
        expect(tags).toContain("commission_increase");
    });

    test("'cut' keyword triggers commission_increase", () => {
        const tags = autoTag("They took a bigger cut from my earnings");
        expect(tags).toContain("commission_increase");
    });

    test("'deactivated' triggers account_suspended", () => {
        const tags = autoTag("My account was deactivated without warning");
        expect(tags).toContain("account_suspended");
    });

    test("'banned' triggers account_suspended", () => {
        const tags = autoTag("I was banned from the platform");
        expect(tags).toContain("account_suspended");
    });

    test("'payment not received' triggers payment_delay", () => {
        const tags = autoTag("My payment was not received last week");
        expect(tags).toContain("payment_delay");
    });

    test("'rating unfair rating' triggers rating_manipulation", () => {
        const tags = autoTag("I received an unfair rating from a passenger");
        expect(tags).toContain("rating_manipulation");
    });

    test("'safety dangerous' triggers safety_concern", () => {
        const tags = autoTag("The area was dangerous at night");
        expect(tags).toContain("safety_concern");
    });

    test("'app crash' triggers app_issue", () => {
        const tags = autoTag("The app keeps crashing when I log in");
        expect(tags).toContain("app_issue");
    });
});

describe("autoTag — case insensitivity", () => {
    test("uppercase keywords are matched", () => {
        const tags = autoTag("COMMISSION was RAISED");
        expect(tags).toContain("commission_increase");
    });

    test("mixed case is matched", () => {
        const tags = autoTag("My Account Was Suspended");
        expect(tags).toContain("account_suspended");
    });
});

describe("autoTag — multiple categories", () => {
    test("two matching categories → two tags", () => {
        const tags = autoTag("commission raised and account suspended");
        expect(tags).toContain("commission_increase");
        expect(tags).toContain("account_suspended");
    });

    test("result is an array", () => {
        expect(Array.isArray(autoTag("commission raised"))).toBe(true);
    });
});

describe("autoTag — max tags cap", () => {
    test("at most 3 tags returned even if 6 categories match", () => {
        // Hits all 6 categories
        const desc =
            "commission raised, account suspended, payment delayed, " +
            "unfair rating, safety dangerous, app crash";
        const tags = autoTag(desc);
        expect(tags.length).toBeLessThanOrEqual(3);
    });

    test("tags are unique — same keyword does not duplicate a tag", () => {
        const tags = autoTag("commission commission commission");
        const unique = new Set(tags);
        expect(unique.size).toBe(tags.length);
    });
});
