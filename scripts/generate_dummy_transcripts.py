from __future__ import annotations

import argparse
import random
from pathlib import Path


ISSUES = [
    {
        "label": "payment posting confusion",
        "customer_openers": [
            "my payment still shows pending and I made it a few days ago",
            "I made my payment online and it does not look applied yet",
            "I am calling because the payment is not showing correctly on my account",
        ],
        "agent_explanations": [
            "payments can appear as pending before they finish posting within the billing cycle",
            "I can review the payment activity and explain where it is in the posting process",
            "sometimes the online payment shows as scheduled first and then moves to posted",
        ],
        "resolutions": [
            "the agent confirms the payment is in process and no late fee will be assessed",
            "the agent explains the processing timeline and submits a review request",
            "the call ends with a follow-up note because the posting still needs research",
        ],
    },
    {
        "label": "escrow shortage",
        "customer_openers": [
            "I got a letter about escrow and I do not understand it",
            "the tax bill changed and now my payment went up",
            "I need someone to explain why my escrow payment increased",
        ],
        "agent_explanations": [
            "the escrow analysis reflects higher projected tax or insurance disbursements",
            "I can walk through the shortage amount and how it affects the monthly payment",
            "the annual escrow review recalculates the cushion and monthly collection",
        ],
        "resolutions": [
            "the customer understands the analysis after the breakdown is explained",
            "the customer remains frustrated and asks for the written escrow details again",
            "the agent offers next steps and explains when the new payment amount takes effect",
        ],
    },
    {
        "label": "late fee dispute",
        "customer_openers": [
            "can you explain why there is a late fee",
            "I do not think I should have been charged this late fee",
            "I paid as soon as I could and now I see a fee that does not seem right",
        ],
        "agent_explanations": [
            "I can review the due date, grace period, and when the payment posted",
            "late fees are assessed based on the contractual due date and posting date",
            "I will check whether the fee was triggered correctly and whether a waiver review applies",
        ],
        "resolutions": [
            "the fee is upheld after the timeline is reviewed",
            "the agent submits a courtesy waiver request because the history supports it",
            "the customer asks for a supervisor when the fee cannot be removed immediately",
        ],
    },
    {
        "label": "autopay not applied",
        "customer_openers": [
            "I was told autopay would come out automatically",
            "my automatic payment did not draft and now I am worried about missing a payment",
            "I enrolled in autopay and it still did not pull the funds",
        ],
        "agent_explanations": [
            "autopay usually starts with the next eligible draft date after enrollment is complete",
            "I can verify whether the bank information was active in time for this month",
            "I will review the autopay enrollment date and draft schedule with you",
        ],
        "resolutions": [
            "the agent explains that autopay starts next cycle and offers a manual payment option",
            "the customer requests confirmation that autopay is now active going forward",
            "the call ends unresolved because the customer expected a same-cycle draft",
        ],
    },
    {
        "label": "payoff quote request",
        "customer_openers": [
            "I need the payoff amount for closing",
            "I am trying to get a payoff quote and I need it quickly",
            "my title company needs the payoff and I want to confirm the process",
        ],
        "agent_explanations": [
            "payoff quotes are provided for a specific good-through date",
            "I can explain how the per diem amount changes the final payoff",
            "the request can be sent through the approved payoff channel with timing expectations",
        ],
        "resolutions": [
            "the agent explains the request steps and expected turnaround clearly",
            "the payoff process is understood and the customer confirms the next action",
            "the customer asks for expedited handling because closing is approaching",
        ],
    },
    {
        "label": "hardship or forbearance question",
        "customer_openers": [
            "I am trying to avoid another missed payment",
            "I need to know what hardship options I have right now",
            "my income changed and I want to ask about forbearance or payment help",
        ],
        "agent_explanations": [
            "I can review the available hardship assistance paths at a high level",
            "there may be eligibility requirements and documents needed before options are offered",
            "I will explain what the assistance review process usually looks like",
        ],
        "resolutions": [
            "the agent outlines next steps and the customer agrees to submit documents",
            "the call is escalated to the assistance team for a detailed review",
            "the customer is relieved to hear there may be temporary help available",
        ],
    },
    {
        "label": "loan statement confusion",
        "customer_openers": [
            "my statement does not make sense to me",
            "I do not understand the amounts on this monthly statement",
            "I already called last week about this statement and I am still confused",
        ],
        "agent_explanations": [
            "I can break down principal, interest, escrow, and any fees shown on the statement",
            "the statement reflects the billed amount for this cycle and any unpaid charges",
            "I will go line by line so the balance and due amount are clearer",
        ],
        "resolutions": [
            "the statement is clarified after the charges are explained",
            "the customer asks for a mailed explanation because the balance still seems off",
            "the call ends with notes for additional research on prior-cycle charges",
        ],
    },
    {
        "label": "insurance proof or tax escrow issue",
        "customer_openers": [
            "I sent in my insurance and I want to know why it still shows on the account",
            "I have a question about insurance proof and escrow",
            "why am I being asked for insurance documents again",
        ],
        "agent_explanations": [
            "I can review whether the proof of coverage was received and matched to the loan",
            "the escrow team may still be updating the hazard insurance record",
            "I will explain how insurance tracking and escrow updates usually work",
        ],
        "resolutions": [
            "the customer is told the documents are in review and should update soon",
            "the issue is escalated because the proof was previously submitted",
            "the agent provides next steps for resubmitting the declaration page",
        ],
    },
    {
        "label": "payment plan request",
        "customer_openers": [
            "I need to set up a payment plan",
            "I fell behind and I want to see if there is a way to catch up over time",
            "can someone tell me whether I can make partial payments on a plan",
        ],
        "agent_explanations": [
            "I can explain the review process for repayment options",
            "payment plans depend on the delinquency status and available programs",
            "I will outline what information is needed before an option can be quoted",
        ],
        "resolutions": [
            "the customer is directed to the review process and understands the next steps",
            "the call is transferred for specialized assistance on repayment options",
            "the customer remains anxious but agrees to complete the intake steps",
        ],
    },
    {
        "label": "call transfer or hold friction",
        "customer_openers": [
            "I keep getting transferred and nobody is telling me what is happening",
            "I was on hold before and I do not want to start over again",
            "this is the second time I have called today and I need help now",
        ],
        "agent_explanations": [
            "I understand the frustration and I will stay with the issue as far as I can from this line",
            "I can document the prior contact so you do not have to repeat everything again",
            "if a transfer is needed I will explain why and what team is best equipped to help",
        ],
        "resolutions": [
            "the agent de-escalates the call and sets expectations before a warm transfer",
            "the customer remains upset but accepts a transfer with detailed notes attached",
            "the issue is partially addressed before the call is escalated",
        ],
    },
]

OUTCOMES = [
    ("resolved", "By the end of the call, the customer says the explanation makes sense and thanks the agent for helping."),
    ("unresolved", "The issue is not fully resolved during the call, and the customer leaves with lingering concern."),
    ("escalated", "The call ends with escalation to another team or supervisor for additional handling."),
    ("follow-up needed", "The agent documents follow-up steps and tells the customer a review is still pending."),
    ("callback requested", "The customer asks for a callback after additional research is completed."),
]


def build_transcript(index: int, issue: dict[str, list[str] | str], rng: random.Random) -> str:
    outcome_label, outcome_summary = rng.choice(OUTCOMES)
    opener = rng.choice(issue["customer_openers"])
    explanation = rng.choice(issue["agent_explanations"])
    issue_resolution = rng.choice(issue["resolutions"])

    customer_tone = rng.choice(
        [
            "I am really trying to keep this current and I just need a straight answer.",
            "I am frustrated because I thought this had already been handled.",
            "I just want to understand what I need to do next so I do not miss anything.",
        ]
    )
    compliance = rng.choice(
        [
            "Before we continue, I do need to complete a quick verification on the account.",
            "I can certainly look into that for you after a brief verification step.",
            "I will be glad to review this with you once I complete verification.",
        ]
    )
    empathy = rng.choice(
        [
            "I understand why that would be frustrating.",
            "I can hear the concern in your voice, and I will walk through it carefully.",
            "I understand this is important, and I will explain what I am seeing.",
        ]
    )
    next_step = rng.choice(
        [
            "I am also going to note the account so the next team can see exactly what we reviewed today.",
            "I will summarize the next steps clearly before we end the call.",
            "Let me explain what happens next and the timeframe you should expect.",
        ]
    )

    transcript_lines = [
        "Agent: Thank you for calling SPS mortgage servicing. My name is Taylor. How can I help you today?",
        f"Customer: Hi, {opener}.",
        f"Agent: {compliance}",
        "Customer: Sure, that is fine.",
        "Agent: Thank you. I have the account pulled up now.",
        f"Customer: {customer_tone}",
        f"Agent: {empathy}",
        f"Agent: For this call, I am seeing that {explanation}.",
        "Customer: Okay, but that is not how I expected it to work.",
        "Agent: I understand. Let me explain the timeline and what is affecting the account this billing cycle.",
        f"Customer: That helps some, but I still need to know what happens with the monthly payment and due dates.",
        f"Agent: {next_step}",
        f"Agent: In this case, {issue_resolution}",
        f"Customer: I appreciate you checking that. Does that mean this is considered {outcome_label}?",
        f"Agent: Based on what we completed today, {outcome_summary}",
        "Customer: All right. Thank you for explaining it.",
        "Agent: You are welcome. Thank you for calling, and have a good day.",
    ]

    if index % 7 == 0:
        transcript_lines.insert(
            10,
            "Customer: I was on hold earlier and I do not want to get bounced around again."
        )
        transcript_lines.insert(
            11,
            "Agent: I understand. I will stay with you and make sure the notes are clear if another team has to assist."
        )

    return "\n".join(transcript_lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate dummy mortgage servicing transcript files.")
    parser.add_argument("--count", type=int, default=50, help="Number of transcript files to generate.")
    parser.add_argument("--out", type=Path, default=Path("data/raw/transcripts"), help="Output directory.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for repeatable output.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    rng = random.Random(args.seed)
    for index in range(1, args.count + 1):
        issue = ISSUES[(index - 1) % len(ISSUES)]
        transcript = build_transcript(index=index, issue=issue, rng=rng)
        file_path = args.out / f"transcript_{index:03d}.txt"
        file_path.write_text(transcript, encoding="utf-8")


if __name__ == "__main__":
    main()
