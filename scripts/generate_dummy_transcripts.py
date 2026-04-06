from __future__ import annotations

import argparse
import random
import textwrap
from pathlib import Path


FIRST_NAMES = [
    "Jordan",
    "Taylor",
    "Casey",
    "Morgan",
    "Riley",
    "Avery",
    "Cameron",
    "Parker",
    "Quinn",
    "Drew",
]

LAST_NAMES = [
    "Hayes",
    "Bennett",
    "Collins",
    "Morris",
    "Perry",
    "Reed",
    "Foster",
    "Sullivan",
    "Brooks",
    "Ward",
]

AGENT_NAMES = [
    "Alicia",
    "Brandon",
    "Carla",
    "Devon",
    "Elena",
    "Marcus",
    "Nina",
    "Oscar",
    "Priya",
    "Tessa",
]

ISSUES = [
    "payment_posting",
    "escrow_shortage",
    "late_fee",
    "autopay",
    "payoff_quote",
    "hardship",
    "refinance",
    "statement_confusion",
    "insurance",
    "tax_adjustment",
    "payment_plan",
    "transfer_friction",
]

OUTCOMES = [
    "resolved",
    "unresolved",
    "escalated",
]


def pick_name(rng: random.Random) -> str:
    return f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"


def intro(agent_name: str, customer_name: str, rng: random.Random) -> list[str]:
    verification = rng.choice(
        [
            "Before we get into the account, I need to verify your full name and property zip code.",
            "Before I review the loan, I need to verify your name and the zip code on file.",
            "I can help with that. First, I need to verify your full name and the property zip code.",
        ]
    )
    return [
        f"Agent: Thank you for calling SPS mortgage servicing. This is {agent_name}. How can I help you today?",
        f"Customer: Hi, this is {customer_name}. I am calling because I need help with my mortgage account.",
        f"Agent: {verification}",
        f"Customer: Sure, this is {customer_name}, and the property zip code is {rng.choice(['80219', '75024', '30318', '60618', '15222'])}.",
        "Agent: Thank you. For your privacy, I will only discuss general account details needed to assist with this call.",
    ]


def issue_block(issue: str, outcome: str, rng: random.Random) -> list[str]:
    if issue == "payment_posting":
        lines = [
            "Customer: My payment still shows pending and I made it several days ago.",
            "Agent: I understand why that is frustrating. I am reviewing the recent payment activity now.",
            "Customer: I already called last week about this and I do not want another late mark because of processing.",
            "Agent: I see the payment was received in our system but it is still moving through posting review.",
        ]
        if outcome == "resolved":
            lines += [
                "Agent: I can confirm the effective date will remain tied to the date received, so there is no additional late fee from this delay.",
                "Customer: Okay, that is what I needed to know.",
                "Agent: I am adding notes and you should see the update by the next billing cycle refresh.",
            ]
        elif outcome == "escalated":
            lines += [
                "Customer: That is not acceptable because I was told it would be fixed already.",
                "Agent: I understand. I need to escalate this to payment research for manual review.",
                "Customer: Please do that because this keeps happening.",
            ]
        else:
            lines += [
                "Agent: I do not have the final posting confirmation yet.",
                "Customer: So I still have to wait without an answer?",
                "Agent: At this stage, yes, and I recommend checking back if it has not updated within two business days.",
            ]
        return lines

    if issue == "escrow_shortage":
        lines = [
            "Customer: I got a letter about escrow and I do not understand it.",
            "Agent: I can walk through that with you. I am seeing an escrow analysis that increased the projected disbursements.",
            "Customer: My monthly payment went up more than I expected.",
            "Agent: The analysis shows a shortage, which means taxes or insurance were higher than projected.",
        ]
        if outcome == "resolved":
            lines += [
                "Agent: I can explain the spread over the next twelve months and the option to pay the shortage separately.",
                "Customer: That makes more sense now.",
                "Agent: I will note that we reviewed the new monthly payment and your next due date remains the same.",
            ]
        elif outcome == "escalated":
            lines += [
                "Customer: I still do not agree with the increase and I need someone to recheck the analysis.",
                "Agent: I can submit an escrow review request, but I cannot change the payment today.",
                "Customer: Fine, transfer me if that is what it takes.",
            ]
        else:
            lines += [
                "Agent: I can explain the notice, but I cannot tell yet whether a correction is needed.",
                "Customer: So I still do not know if this amount is right.",
                "Agent: Not until the review team completes the follow-up.",
            ]
        return lines

    if issue == "late_fee":
        lines = [
            "Customer: Can you explain why there is a late fee on my statement?",
            "Agent: I am checking the due date, grace period, and payment receipt date now.",
            "Customer: I made the payment before the end of the month.",
            "Agent: The loan applies a late fee when the payment posts after the grace period unless there is an approved exception.",
        ]
        if outcome == "resolved":
            lines += [
                "Agent: I do see the payment was delayed during processing, so I can request a courtesy review based on that timing.",
                "Customer: I appreciate that.",
                "Agent: I have submitted the request and you should receive an update after review.",
            ]
        elif outcome == "escalated":
            lines += [
                "Customer: I do not accept that answer because I have proof of when I sent it.",
                "Agent: I understand. The next step is an escalation to our research team.",
                "Customer: Please escalate it.",
            ]
        else:
            lines += [
                "Agent: Based on what I can see, the fee is still considered valid for now.",
                "Customer: That does not really help me.",
                "Agent: I understand, but I do not have authority to waive it on this call.",
            ]
        return lines

    if issue == "autopay":
        lines = [
            "Customer: I was told autopay would come out automatically, but it did not.",
            "Agent: Let me review the recurring payment setup and effective date.",
            "Customer: I signed up because I was trying to avoid another missed payment.",
            "Agent: I see the enrollment request, but the draft was not scheduled for the cycle you expected.",
        ]
        if outcome == "resolved":
            lines += [
                "Agent: The enrollment is now active for the next due date, and I explained how one-time payments work until then.",
                "Customer: Okay, at least I know what to do this month.",
                "Agent: I am also documenting that explanation in the account notes.",
            ]
        elif outcome == "escalated":
            lines += [
                "Customer: I specifically asked if it would cover this month and now I am behind again.",
                "Agent: I understand your concern. I can escalate the enrollment complaint for review.",
                "Customer: Yes, because this created a mess.",
            ]
        else:
            lines += [
                "Agent: I can confirm the setup is pending, but I cannot make the draft pull today.",
                "Customer: So I have to make another manual payment.",
                "Agent: Yes, to avoid delinquency for this cycle.",
            ]
        return lines

    if issue == "payoff_quote":
        lines = [
            "Customer: I need the payoff amount for closing.",
            "Agent: I can explain the payoff request process and timing.",
            "Customer: The title company needs it quickly.",
            "Agent: We can issue a payoff quote that includes principal, interest, and any applicable fees through the good-through date.",
        ]
        if outcome == "resolved":
            lines += [
                "Agent: I have submitted the request and explained the expected turnaround window.",
                "Customer: Good, that should keep the closing on track.",
                "Agent: If needed, the authorized third party can follow up using the same loan file reference.",
            ]
        elif outcome == "escalated":
            lines += [
                "Customer: This is urgent and I cannot wait another day.",
                "Agent: I can mark it urgent, but I need a specialist to complete the final quote.",
                "Customer: Then transfer me to whoever can help.",
            ]
        else:
            lines += [
                "Agent: I can document the request, but I cannot provide the final payoff figure on this call.",
                "Customer: I was hoping to get the number today.",
                "Agent: It still requires follow-up processing.",
            ]
        return lines

    if issue == "hardship":
        lines = [
            "Customer: I am behind and I need to know what hardship options I have.",
            "Agent: I am sorry you are dealing with that. I can review the general assistance options available.",
            "Customer: I am trying to avoid another missed payment.",
            "Agent: We can discuss forbearance review or payment assistance, depending on your current status.",
        ]
        if outcome == "resolved":
            lines += [
                "Agent: I explained the application steps, document requirements, and next contact timeline.",
                "Customer: That gives me a path forward.",
                "Agent: I also noted that you requested assistance before the next due date.",
            ]
        elif outcome == "escalated":
            lines += [
                "Customer: I need a firm answer today, not just general information.",
                "Agent: I understand. I need to transfer you to the assistance team for a case-specific review.",
                "Customer: Please transfer me.",
            ]
        else:
            lines += [
                "Agent: I can outline options, but I cannot determine eligibility on this call.",
                "Customer: I still do not know what happens next.",
                "Agent: The next step is to submit the review request and wait for outreach.",
            ]
        return lines

    if issue == "refinance":
        lines = [
            "Customer: I am checking on my refinance status because I thought the old loan would be paid off already.",
            "Agent: Let me review whether we received payoff funds or closing instructions.",
            "Customer: I do not want to send another payment if the refinance is in process.",
            "Agent: Until the prior loan is paid in full, the regular payment obligation can still remain in place.",
        ]
        if outcome == "resolved":
            lines += [
                "Agent: I explained the payoff timing and why servicing may still show active until final posting completes.",
                "Customer: Okay, that clears it up.",
                "Agent: I also reviewed where to check for final confirmation.",
            ]
        elif outcome == "escalated":
            lines += [
                "Customer: I keep getting different answers from everyone.",
                "Agent: I understand. I can escalate this to payoff support for a status review.",
                "Customer: Please do that.",
            ]
        else:
            lines += [
                "Agent: I do not yet see final payoff completion.",
                "Customer: Then I am still stuck in limbo.",
                "Agent: At the moment, yes, pending the incoming funds review.",
            ]
        return lines

    if issue == "statement_confusion":
        lines = [
            "Customer: My loan statement is confusing and the amount due does not match what I expected.",
            "Agent: I can go line by line through the statement with you.",
            "Customer: There are multiple amounts and I do not know which one I am supposed to pay.",
            "Agent: I am looking at the principal, escrow, suspense, and any past due amounts listed on the billing cycle.",
        ]
        if outcome == "resolved":
            lines += [
                "Agent: I explained which amount is currently due and what the other figures represent.",
                "Customer: That helps a lot.",
                "Agent: I also reviewed the due date so there is no confusion going forward.",
            ]
        elif outcome == "escalated":
            lines += [
                "Customer: It still looks wrong to me and I want someone to audit it.",
                "Agent: I can submit a statement research request for deeper review.",
                "Customer: Do that, because this is not clear.",
            ]
        else:
            lines += [
                "Agent: I can explain the standard layout, but I cannot fully reconcile one item from this view.",
                "Customer: So part of it is still unresolved.",
                "Agent: Yes, one item still needs follow-up.",
            ]
        return lines

    if issue == "insurance":
        lines = [
            "Customer: I sent proof of hazard insurance, but the account still shows lender-placed coverage.",
            "Agent: I will review the insurance tracking notes.",
            "Customer: My payment increased because of it.",
            "Agent: I see proof was received, but I cannot confirm the update has finished processing.",
        ]
        if outcome == "resolved":
            lines += [
                "Agent: I documented the policy details on file and explained the normal removal timeline.",
                "Customer: Okay, that sounds reasonable.",
                "Agent: If the premium is removed, the escrow portion will adjust on a future cycle.",
            ]
        elif outcome == "escalated":
            lines += [
                "Customer: I already sent documents twice and I am tired of repeating this.",
                "Agent: I understand. I am escalating it to the insurance review team.",
                "Customer: Thank you, because this should have been fixed.",
            ]
        else:
            lines += [
                "Agent: The documents may still be in review.",
                "Customer: Then I am still paying the higher amount for now.",
                "Agent: For now, yes, until the review is completed.",
            ]
        return lines

    if issue == "tax_adjustment":
        lines = [
            "Customer: The tax bill changed and now my payment went up.",
            "Agent: I can review how the escrow account adjusted after the updated tax disbursement.",
            "Customer: I was not expecting that large of an increase.",
            "Agent: When county taxes change, the escrow portion of the monthly payment may increase to cover the new projected amount.",
        ]
        if outcome == "resolved":
            lines += [
                "Agent: I explained the breakdown and how the new monthly amount was calculated.",
                "Customer: All right, at least I know where the number came from.",
                "Agent: I also reviewed when the next escrow analysis would occur.",
            ]
        elif outcome == "escalated":
            lines += [
                "Customer: I think the tax amount they used is wrong.",
                "Agent: I can request an escrow re-review based on the updated tax information.",
                "Customer: Please open that request.",
            ]
        else:
            lines += [
                "Agent: I can see the increase, but I cannot verify the outside tax source on this call.",
                "Customer: So I still need someone else to check it.",
                "Agent: Yes, that part needs a follow-up review.",
            ]
        return lines

    if issue == "payment_plan":
        lines = [
            "Customer: I want to know if I can set up a payment plan.",
            "Agent: I can go over the general process and the team that handles those reviews.",
            "Customer: I fell behind after a temporary income issue.",
            "Agent: Payment plan availability depends on delinquency status and investor guidelines.",
        ]
        if outcome == "resolved":
            lines += [
                "Agent: I outlined the request path and the documents you may need.",
                "Customer: That gives me something concrete to do.",
                "Agent: I also reviewed the best callback number for follow-up.",
            ]
        elif outcome == "escalated":
            lines += [
                "Customer: I need an actual arrangement, not a summary.",
                "Agent: I understand. I need to transfer you to the assistance team for case handling.",
                "Customer: All right, transfer me.",
            ]
        else:
            lines += [
                "Agent: I can provide the process, but I cannot approve a plan here.",
                "Customer: So nothing is set up yet.",
                "Agent: Correct, not yet.",
            ]
        return lines

    lines = [
        "Customer: I was transferred before and I still do not have a clear answer.",
        "Agent: I am sorry about that. Let me review the notes so I do not repeat unnecessary questions.",
        "Customer: I keep getting bounced around.",
        "Agent: I can see prior transfer activity and I understand the frustration.",
    ]
    if outcome == "resolved":
        lines += [
            "Agent: I found the correct team notes and explained the next step clearly so you do not need another transfer today.",
            "Customer: Thank you, that is the first clear explanation I have gotten.",
            "Agent: I documented the summary in detail before we end the call.",
        ]
    elif outcome == "escalated":
        lines += [
            "Customer: If I am transferred again, I want a supervisor.",
            "Agent: I understand. I am escalating the call now to avoid another incomplete handoff.",
            "Customer: Please stay on until the handoff is complete.",
        ]
    else:
        lines += [
            "Agent: I can document the issue, but I still need to route this to another team.",
            "Customer: So I am back where I started.",
            "Agent: I understand why it feels that way.",
        ]
    return lines


def closing(outcome: str, rng: random.Random) -> list[str]:
    closing_map = {
        "resolved": [
            "Customer: All right, I appreciate you explaining it.",
            "Agent: You are welcome. Is there anything else I can help with on the mortgage account today?",
            "Customer: No, that covers it.",
            "Agent: Thank you for calling SPS mortgage servicing. Have a good day.",
        ],
        "unresolved": [
            "Customer: I guess I will wait for the follow-up, but I am not happy about it.",
            "Agent: I understand, and I noted the concern in detail on the account.",
            "Customer: Okay.",
            "Agent: Thank you for calling SPS mortgage servicing.",
        ],
        "escalated": [
            "Customer: I need this handled quickly.",
            "Agent: I understand, and I am documenting the escalation before the handoff.",
            "Customer: Thank you.",
            "Agent: Please hold while I connect the next team.",
        ],
    }
    lines = closing_map[outcome][:]
    if rng.random() < 0.35:
        lines.insert(-1, "Agent: Please allow normal processing time once the review is completed.")
    return lines


def build_transcript(index: int, rng: random.Random) -> str:
    issue = rng.choice(ISSUES)
    outcome = rng.choices(OUTCOMES, weights=[0.45, 0.3, 0.25], k=1)[0]
    agent_name = rng.choice(AGENT_NAMES)
    customer_name = pick_name(rng)

    lines = []
    lines.extend(intro(agent_name, customer_name, rng))
    if rng.random() < 0.25:
        lines.append("Agent: I appreciate your patience while I pull up the servicing details.")
    lines.extend(issue_block(issue, outcome, rng))
    if rng.random() < 0.2 and outcome != "escalated":
        lines.append("Agent: I want to set expectations clearly so there is no confusion about the next step.")
    lines.extend(closing(outcome, rng))

    text = "\n".join(textwrap.fill(line, width=100, break_long_words=False) for line in lines)
    return text + "\n"


def generate_transcripts(count: int, out_dir: Path, seed: int) -> None:
    rng = random.Random(seed)
    out_dir.mkdir(parents=True, exist_ok=True)

    for index in range(1, count + 1):
        transcript = build_transcript(index, rng)
        file_path = out_dir / f"transcript_{index:03d}.txt"
        file_path.write_text(transcript, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate synthetic mortgage-servicing transcripts as plain text files."
    )
    parser.add_argument("--count", type=int, default=50, help="Number of transcript files to generate.")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/raw/transcripts"),
        help="Output directory for transcript text files.",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for deterministic generation.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.count <= 0:
        raise ValueError("--count must be greater than zero")
    generate_transcripts(args.count, args.out, args.seed)


if __name__ == "__main__":
    main()
