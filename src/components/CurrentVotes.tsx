import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type VoteOption = "yes" | "no" | "could-be-convinced";

interface Vote {
  name: string;
  option: VoteOption;
  timestamp: Date;
}

interface CurrentVotesProps {
  votes: Vote[];
}

const voteConfig = {
  yes: {
    label: "Sign me up 🔥",
    color:
      "bg-linear-to-r from-primary to-primary-glow text-primary-foreground",
  },
  no: {
    label: "No thank you 🏠",
    color:
      "bg-linear-to-r from-secondary to-secondary/80 text-secondary-foreground",
  },
  "could-be-convinced": {
    label: "I could be convinced 👥",
    color: "bg-linear-to-r from-accent to-accent/80 text-accent-foreground",
  },
};

export function CurrentVotes({ votes }: CurrentVotesProps) {
  if (votes.length === 0) {
    return null;
  }

  const groupedVotes = votes.reduce(
    (acc, vote) => {
      if (!acc[vote.option]) {
        acc[vote.option] = [];
      }
      acc[vote.option].push(vote);
      return acc;
    },
    {} as Record<VoteOption, Vote[]>,
  );

  return (
    <Card className="shadow-(--shadow-card)">
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
                  {optionVotes.length}{" "}
                  {optionVotes.length === 1 ? "person" : "people"}
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
