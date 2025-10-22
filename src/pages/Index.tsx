import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { VoteHistory } from "@/components/VoteHistory";
import { CurrentVotes } from "@/components/CurrentVotes";

type VoteOption = "hell-yeah" | "miss-me" | "only-if-boys";

interface Vote {
  name: string;
  option: VoteOption;
  timestamp: Date;
}

interface WeekData {
  weekStart: Date;
  votes: Vote[];
}

const Index = () => {
  const [userName, setUserName] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [currentWeekVotes, setCurrentWeekVotes] = useState<Vote[]>([]);
  const [weekHistory, setWeekHistory] = useState<WeekData[]>([
    {
      weekStart: new Date(2025, 9, 10),
      votes: [
        { name: "Sarah", option: "hell-yeah", timestamp: new Date(2025, 9, 10) },
        { name: "Mike", option: "only-if-boys", timestamp: new Date(2025, 9, 10) },
        { name: "Alex", option: "miss-me", timestamp: new Date(2025, 9, 11) },
        { name: "Jordan", option: "hell-yeah", timestamp: new Date(2025, 9, 11) },
      ],
    },
    {
      weekStart: new Date(2025, 9, 3),
      votes: [
        { name: "Sarah", option: "only-if-boys", timestamp: new Date(2025, 9, 3) },
        { name: "Mike", option: "hell-yeah", timestamp: new Date(2025, 9, 3) },
        { name: "Alex", option: "hell-yeah", timestamp: new Date(2025, 9, 4) },
      ],
    },
  ]);

  // Load name from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem("thursdayVoteName");
    if (savedName) {
      setUserName(savedName);
    }
  }, []);

  // Save name to localStorage whenever it changes
  const handleNameChange = (newName: string) => {
    setUserName(newName);
    if (newName.trim()) {
      localStorage.setItem("thursdayVoteName", newName);
    }
  };

  const handleVote = (option: VoteOption) => {
    if (!userName.trim()) {
      toast({
        title: "Hold up!",
        description: "Enter your name first, friend 👋",
        variant: "destructive",
      });
      return;
    }

    const newVote: Vote = {
      name: userName,
      option,
      timestamp: new Date(),
    };

    setCurrentWeekVotes([...currentWeekVotes, newVote]);
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
                  onClick={() => {
                    setHasVoted(false);
                    setCurrentWeekVotes(currentWeekVotes.filter(v => v.name !== userName));
                  }}
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
