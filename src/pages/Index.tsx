import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { VoteHistory } from "@/components/VoteHistory";
import { CurrentVotes } from "@/components/CurrentVotes";

type VoteOption = "hell-yeah" | "miss-me" | "only-if-boys";

const Index = () => {
    const [userName, setUserName] = useState("");
    const [hasVoted, setHasVoted] = useState(false);

    // Convex queries and mutations
    const currentWeekVotesRaw = useQuery(api.votes.getCurrentWeekVotes);
    const weekHistoryRaw = useQuery(api.votes.getVoteHistory);
    const addVote = useMutation(api.votes.addVote);
    const deleteVote = useMutation(api.votes.deleteVote);

    // Convert timestamps to Date objects
    const currentWeekVotes = useMemo(() => {
        if (!currentWeekVotesRaw) return [];
        return currentWeekVotesRaw.map(vote => ({
            ...vote,
            timestamp: new Date(vote.timestamp),
        }));
    }, [currentWeekVotesRaw]);

    const weekHistory = useMemo(() => {
        if (!weekHistoryRaw) return [];
        return weekHistoryRaw.map(week => ({
            weekStart: new Date(week.weekStart),
            votes: week.votes.map(v => ({
                ...v,
                timestamp: new Date(v.timestamp),
            })),
        }));
    }, [weekHistoryRaw]);

    // Load name from localStorage on mount
    useEffect(() => {
        const savedName = localStorage.getItem("thursdayVoteName");
        if (savedName) {
            setUserName(savedName);
        }
    }, []);

    // Check if current user has voted
    useEffect(() => {
        if (userName && currentWeekVotes) {
            const userVote = currentWeekVotes.find(v => v.name === userName);
            setHasVoted(!!userVote);
        }
    }, [userName, currentWeekVotes]);

    // Save name to localStorage whenever it changes
    const handleNameChange = (newName: string) => {
        setUserName(newName);
        if (newName.trim()) {
            localStorage.setItem("thursdayVoteName", newName);
        }
    };

    const handleVote = async (option: VoteOption) => {
        if (!userName.trim()) {
            toast({
                title: "Hold up!",
                description: "Enter your name first, friend 👋",
                variant: "destructive",
            });
            return;
        }

        try {
            await addVote({ name: userName, option });
            setHasVoted(true);

            const optionText = {
                "hell-yeah": "Hell yeah brother! 🔥",
                "miss-me": "Fair enough! 🏠",
                "only-if-boys": "Only if the squad's in! 👥",
            };

            toast({
                title: "Vote recorded!",
                description: optionText[option],
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to record vote. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleChangeVote = async () => {
        try {
            await deleteVote({ name: userName });
            setHasVoted(false);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to change vote. Please try again.",
                variant: "destructive",
            });
        }
    };

    const getThisThursday = () => {
        const today = new Date();
        const thursday = new Date(today);
        const day = today.getDay();
        const daysUntilThursday = (4 - day + 7) % 7;
        thursday.setDate(today.getDate() + daysUntilThursday);
        return thursday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    };

    return (
        <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-3">
                    <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                        Thursday Office Vibes
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        {getThisThursday()}
                    </p>
                </div>

                {/* Main Voting Card */}
                <Card className="shadow-[var(--shadow-card)] border-2">
                    <CardHeader>
                        <CardTitle className="text-2xl">Will you be in the office?</CardTitle>
                        <CardDescription>Let the squad know your Thursday plans</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {!hasVoted && (
                            <div className="space-y-2">
                                <Label htmlFor="name">Your Name</Label>
                                <Input
                                    id="name"
                                    placeholder="Enter your name..."
                                    value={userName}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    className="text-lg"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Button
                                variant="vote"
                                onClick={() => handleVote("hell-yeah")}
                                disabled={hasVoted}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground flex-col gap-4 min-h-36 py-10 px-10 whitespace-normal text-xl leading-tight"
                            >
                                <span className="text-3xl leading-none">🔥</span>
                                <span className="px-1">Hell yeah brother</span>
                            </Button>

                            <Button
                                variant="vote"
                                onClick={() => handleVote("miss-me")}
                                disabled={hasVoted}
                                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground flex-col gap-4 min-h-36 py-10 px-10 whitespace-normal text-xl leading-tight"
                            >
                                <span className="text-3xl leading-none">🏠</span>
                                <span className="px-1">Miss me with that office shizz</span>
                            </Button>

                            <Button
                                variant="vote"
                                onClick={() => handleVote("only-if-boys")}
                                disabled={hasVoted}
                                className="bg-accent hover:bg-accent/80 text-accent-foreground flex-col gap-4 min-h-36 py-10 px-10 whitespace-normal text-xl leading-tight"
                            >
                                <span className="text-3xl leading-none">👥</span>
                                <span className="px-1">Only if my boys are</span>
                            </Button>
                        </div>

                        {hasVoted && (
                            <div className="text-center">
                                <Button
                                    variant="ghost"
                                    onClick={handleChangeVote}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    Change your vote
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Current Week Votes */}
                <CurrentVotes votes={currentWeekVotes} />

                {/* Vote History */}
                <VoteHistory weekHistory={weekHistory} />
            </div>
        </div>
    );
};

export default Index;