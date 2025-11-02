import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get the start of the current week (Monday)
function getWeekStart(date: Date): number {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Get current week's votes
export const getCurrentWeekVotes = query({
  handler: async (ctx) => {
    const weekStart = getWeekStart(new Date());
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_week", (q) => q.eq("weekStart", weekStart))
      .collect();

    return votes.map((vote) => ({
      _id: vote._id,
      name: vote.name,
      option: vote.option,
      timestamp: vote.timestamp, // Return as number
    }));
  },
});

// Get all votes grouped by week
export const getVoteHistory = query({
  handler: async (ctx) => {
    const allVotes = await ctx.db.query("votes").collect();

    // Group by week
    const weekMap = new Map<number, typeof allVotes>();

    for (const vote of allVotes) {
      const existing = weekMap.get(vote.weekStart) || [];
      weekMap.set(vote.weekStart, [...existing, vote]);
    }

    // Convert to array and sort by week (newest first)
    const weekHistory = Array.from(weekMap.entries())
      .map(([weekStart, votes]) => ({
        weekStart: weekStart, // Return as number
        votes: votes.map((v) => ({
          name: v.name,
          option: v.option,
          timestamp: v.timestamp, // Return as number
        })),
      }))
      .sort((a, b) => b.weekStart - a.weekStart);

    return weekHistory;
  },
});

// Add a new vote
export const addVote = mutation({
  args: {
    name: v.string(),
    option: v.union(
      v.literal("yes"),
      v.literal("no"),
      v.literal("could-be-convinced"),
    ),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const weekStart = getWeekStart(now);

    // Check if user already voted this week
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_week", (q) => q.eq("weekStart", weekStart))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existingVote) {
      // Update existing vote
      await ctx.db.patch(existingVote._id, {
        option: args.option,
        timestamp: now.getTime(),
      });
      return existingVote._id;
    } else {
      // Create new vote
      const voteId = await ctx.db.insert("votes", {
        name: args.name,
        option: args.option,
        weekStart,
        timestamp: now.getTime(),
      });
      return voteId;
    }
  },
});

// Delete a vote (for changing vote)
export const deleteVote = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const weekStart = getWeekStart(new Date());

    const vote = await ctx.db
      .query("votes")
      .withIndex("by_week", (q) => q.eq("weekStart", weekStart))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (vote) {
      await ctx.db.delete(vote._id);
    }
  },
});
