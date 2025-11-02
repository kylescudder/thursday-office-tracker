import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  votes: defineTable({
    name: v.string(),
    option: v.union(
      v.literal("yes"),
      v.literal("no"),
      v.literal("could-be-convinced"),
    ),
    weekStart: v.number(), // Unix timestamp
    timestamp: v.number(), // Unix timestamp
  }).index("by_week", ["weekStart"]),
});
