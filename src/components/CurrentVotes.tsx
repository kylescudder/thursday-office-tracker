import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type VoteOption = "hell-yeah" | "miss-me" | "only-if-boys";

interface Vote {
  name: string;
  option: VoteOption;
  timestamp: Date;
}

interface CurrentVotesProps {
  votes: Vote[];
}

const voteConfig = {
  "hell-yeah": {
    label: "Hell yeah brother 🔥",
    color: "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground",
  },
  "miss-me": {
    label: "Miss me with that 🏠",
    color: "bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground",
  },
  "only-if-boys": {
    label: "Only if my boys are 👥",
    color: "bg-gradient-to-r from-accent to-accent/80 text-accent-foreground",
  },
};

export function CurrentVotes({ votes }: CurrentVotesProps) {
  if (votes.length === 0) {
    return null;
  }

  const groupedVotes = votes.reduce((acc, vote) => {
    if (!acc[vote.option]) {
      acc[vote.option] = [];
    }
    acc[vote.option].push(vote);
    return acc;
  }, {} as Record<VoteOption, Vote[]>);

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle>This Week's Squad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(voteConfig) as VoteOption[]).map((option) => {
          const optionVotes = groupedVotes[option] || [];
          if (optionVotes.length === 0) return null;

          return (
            <div key={option} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={voteConfig[option].color}>
                  {voteConfig[option].label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {optionVotes.length} {optionVotes.length === 1 ? "person" : "people"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {optionVotes.map((vote, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1 bg-muted rounded-full text-sm font-medium"
                  >
                    {vote.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
