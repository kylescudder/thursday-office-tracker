import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    votes: defineTable({
        name: v.string(),
        option: v.union(
            v.literal("hell-yeah"),
            v.literal("miss-me"),
            v.literal("only-if-boys")
        ),
        weekStart: v.number(), // Unix timestamp
        timestamp: v.number(), // Unix timestamp
    }).index("by_week", ["weekStart"]),
});
