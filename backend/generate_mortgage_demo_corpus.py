from __future__ import annotations

from pathlib import Path
from random import Random


SCENARIOS = [
    {
        "topic": "payment posting",
        "customer_openings": [
            "I made my payment online on Friday and it still has not posted to the account.",
            "The website shows my payment as pending and I need to know if I am going to be marked late.",
            "My bank shows the draft cleared, but your portal still looks behind.",
        ],
        "agent_context": [
            "I am reviewing the payment history and the suspense activity now.",
            "Let me check the posting timeline and whether the funds are still in suspense.",
            "I can walk through the payment ledger and the normal processing window.",
        ],
        "agent_resolution": [
            "The funds are already on the account and should fully post overnight, so I do not see a late fee right now.",
            "I can submit a payment research request and add notes so the next agent can see what was reviewed.",
            "What I can confirm is that the payment is in process and the delinquency status has not advanced today.",
        ],
    },
    {
        "topic": "escrow increase",
        "customer_openings": [
            "My mortgage payment jumped this month and the letter says it is because of escrow.",
            "I need someone to explain why the escrow analysis raised my monthly payment so much.",
            "The shortage amount on this escrow statement does not make sense to me.",
        ],
        "agent_context": [
            "I have the escrow analysis in front of me and I can review the projected disbursements line by line.",
            "Let me compare last year's tax and insurance disbursements against the new escrow calculation.",
            "I can explain how the shortage was spread into the new payment amount.",
        ],
        "agent_resolution": [
            "The increase is tied to higher county taxes and insurance, and I can explain when the new amount takes effect.",
            "If you want, I can document a review request and note the exact escrow line items we covered.",
            "I will add notes about the shortage breakdown so you do not have to start over if you call back.",
        ],
    },
    {
        "topic": "loss mitigation",
        "customer_openings": [
            "I am behind on my payments after a job loss and I need to know what assistance options are available.",
            "I was told to ask about hardship help because I cannot keep up with the monthly payment right now.",
            "I need to understand what the loss mitigation review process looks like before I fall further behind.",
        ],
        "agent_context": [
            "I can explain the assistance application steps and what documents the review team needs.",
            "Let me walk through the hardship package, income documents, and the expected review timeline.",
            "I am reviewing the home retention options that may apply to your account.",
        ],
        "agent_resolution": [
            "I can submit the assistance packet request and note that you are preparing the documents.",
            "The next step is to complete the hardship package so the review queue can evaluate the account.",
            "I will document the assistance discussion and the follow-up expectations on the loan.",
        ],
    },
    {
        "topic": "payoff",
        "customer_openings": [
            "My title company needs a payoff statement for closing and I want to make sure the amount is correct.",
            "I am refinancing and need to know how the good-through date works on the payoff quote.",
            "The payoff funds were wired, but I still see the old loan online and I need an update.",
        ],
        "agent_context": [
            "I can review the payoff statement details and the good-through date with you.",
            "Let me check whether the refinance funds have fully cleared the account.",
            "I am looking at the closing timeline and the payoff request status now.",
        ],
        "agent_resolution": [
            "The quote includes principal, interest, and fees through the requested date, and I can explain each part.",
            "If the title company needs another statement, I can note that request and document the closing timeline.",
            "I can confirm what has posted so far and whether the account is waiting on final reconciliation.",
        ],
    },
    {
        "topic": "insurance or taxes",
        "customer_openings": [
            "I received a notice about lender placed insurance even though I already have coverage.",
            "The county says the tax bill is due, and I need to know whether escrow already paid it.",
            "My homeowners insurance changed and I am trying to keep the escrow side accurate.",
        ],
        "agent_context": [
            "Let me review the insurance carrier information and the escrow disbursement history.",
            "I can check whether proof of coverage has been matched to the loan yet.",
            "I am looking at the tax disbursement record and the most recent escrow activity now.",
        ],
        "agent_resolution": [
            "If needed, you can send the declaration page and I will document the account for the insurance team.",
            "I can explain whether the tax bill has already been paid from escrow or is still pending.",
            "I will note the coverage update and the next step so the record is clear.",
        ],
    },
]

OUTCOMES = [
    ("resolved", "Customer: That helps and now I understand what happened on the account."),
    ("follow-up", "Customer: Okay, I will wait for the follow-up since the review is still in motion."),
    ("callback", "Customer: Please have someone call me back once the research is complete."),
    ("escalated", "Agent: I am transferring this to the specialist queue and documenting the notes before I do."),
]


def build_transcript(topic: dict, index: int, rng: Random) -> str:
    outcome_label, outcome_line = OUTCOMES[index % len(OUTCOMES)]
    lines = [
        "Agent: Thank you for calling SPS mortgage servicing. My name is Taylor. How can I help you today?",
        f"Customer: {rng.choice(topic['customer_openings'])}",
        "Agent: Before we discuss the loan, I need to complete account verification.",
        "Customer: That is fine.",
        "Agent: Thank you. I have the account in front of me now.",
        f"Agent: {rng.choice(topic['agent_context'])}",
        "Customer: I have already called once, so I really need a clear answer on what happens next.",
        "Agent: I understand why that is frustrating, and I will walk through it carefully.",
        f"Agent: {rng.choice(topic['agent_resolution'])}",
        outcome_line,
    ]
    if outcome_label != "escalated":
        lines.append("Agent: I am adding notes so the account reflects everything we reviewed today.")
    if outcome_label == "callback":
        lines.append("Agent: I documented the callback request and the current status before we end the call.")
    elif outcome_label == "follow-up":
        lines.append("Agent: I noted the follow-up expectation and the review timeline on the account.")
    elif outcome_label == "resolved":
        lines.append("Agent: I am glad we were able to clear that up today.")
    lines.extend(
        [
            "Agent: Thank you for calling today.",
            "Customer: Thank you.",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    target_dir = repo_root / "data" / "raw" / "transcripts"
    target_dir.mkdir(parents=True, exist_ok=True)
    for existing in target_dir.glob("transcript_*.txt"):
        existing.unlink()

    rng = Random(7)
    count = 100
    for index in range(1, count + 1):
        scenario = SCENARIOS[(index - 1) % len(SCENARIOS)]
        transcript = build_transcript(scenario, index, rng)
        (target_dir / f"transcript_{index:03d}.txt").write_text(transcript, encoding="utf-8")


if __name__ == "__main__":
    main()
