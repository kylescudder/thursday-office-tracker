import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

interface VoteHistoryProps {
  weekHistory: WeekData[];
}

const voteConfig = {
  "hell-yeah": {
    emoji: "🔥",
    color: "bg-primary/10 text-primary border-primary/20",
  },
  "miss-me": {
    emoji: "🏠",
    color: "bg-secondary/10 text-secondary border-secondary/20",
  },
  "only-if-boys": {
    emoji: "👥",
    color: "bg-accent/10 text-accent border-accent/20",
  },
};

export function VoteHistory({ weekHistory }: VoteHistoryProps) {
  const formatWeek = (date: Date) => {
    const endDate = new Date(date);
    endDate.setDate(date.getDate() + 6);
    
    return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle>Previous Weeks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {weekHistory.map((week, weekIdx) => {
          const groupedVotes = week.votes.reduce((acc, vote) => {
            if (!acc[vote.option]) {
              acc[vote.option] = [];
            }
            acc[vote.option].push(vote);
            return acc;
          }, {} as Record<VoteOption, Vote[]>);

          return (
            <div key={weekIdx} className="space-y-3 pb-6 border-b last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{formatWeek(week.weekStart)}</h3>
                <span className="text-sm text-muted-foreground">
                  {week.votes.length} {week.votes.length === 1 ? "vote" : "votes"}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(Object.keys(voteConfig) as VoteOption[]).map((option) => {
                  const optionVotes = groupedVotes[option] || [];
                  
                  return (
                    <div key={option} className="space-y-2">
                      <Badge variant="outline" className={voteConfig[option].color}>
                        <span className="mr-1">{voteConfig[option].emoji}</span>
                        {optionVotes.length}
                      </Badge>
                      <div className="space-y-1">
                        {optionVotes.map((vote, idx) => (
                          <div
                            key={idx}
                            className="text-sm px-2 py-1 bg-muted/50 rounded"
                          >
                            {vote.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
