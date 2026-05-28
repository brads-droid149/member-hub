export default function Terms() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-display tracking-tight text-foreground">Terms & Conditions</h1>
        <p className="text-muted-foreground">Last updated: May 2026</p>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">1. Membership</h2>
          <p className="text-muted-foreground">
            By joining Junkyard Surf Club, you agree to pay the subscription fee and abide by our community guidelines.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">2. Giveaways</h2>
          <p className="text-muted-foreground">
            Giveaway entries are awarded based on your active membership status. Winners are selected at random and notified via email.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">3. Cancellations</h2>
          <p className="text-muted-foreground">
            You may cancel your membership at any time through your account dashboard. Access to partner discounts and giveaways ends when your subscription period concludes.
          </p>
        </section>
      </div>
    </div>
  );
}
