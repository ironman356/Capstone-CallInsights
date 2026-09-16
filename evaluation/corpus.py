from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from random import Random


@dataclass(frozen=True)
class IssueSpec:
    label: str
    confound_group: str
    train_openings: tuple[str, ...]
    test_openings: tuple[str, ...]
    followups: tuple[str, ...]


ISSUES = (
    IssueSpec(
        "payment_posting",
        "payment_movement",
        (
            "I sent the mortgage payment Thursday, but the portal still says pending.",
            "The money left my checking account and has not been applied to the loan.",
            "Can you tell me why this month's payment is sitting in suspense?",
            "My online payment is not showing in the transaction history yet.",
        ),
        (
            "The bank draft cleared, but your balance acts like the payment never arrived.",
            "I paid before the weekend and the account has not caught up.",
            "Funds were taken, although the mortgage ledger still looks unpaid.",
        ),
        (
            "I need to know where the funds are right now, not just the normal due date.",
            "Could it be held somewhere before it reaches principal and interest?",
        ),
    ),
    IssueSpec(
        "autopay_draft",
        "payment_movement",
        (
            "My automatic mortgage payment did not draft on its scheduled date.",
            "I enrolled in recurring payments, but nothing came out of the bank.",
            "The bank account is on file and autopay skipped this month.",
            "I changed my draft date and need to know which cycle it starts.",
        ),
        (
            "The recurring withdrawal never fired even though enrollment shows active.",
            "Your system was supposed to pull the payment and my bank shows no attempt.",
            "I updated auto debit last week; will it take this month's installment?",
        ),
        (
            "I am trying to avoid making a second payment if the automatic one is delayed.",
            "Please confirm whether the recurring instruction is active for next month.",
        ),
    ),
    IssueSpec(
        "escrow_shortage",
        "escrow_insurance",
        (
            "My escrow analysis raised the monthly payment and I do not understand the shortage.",
            "The new payment is much higher because of an escrow deficit.",
            "Please explain how the tax and insurance projection created this shortage.",
            "The annual escrow statement says I owe more every month.",
        ),
        (
            "My installment jumped after the account review, and the shortage math is unclear.",
            "The analysis spread a deficit across twelve months, but the amount looks wrong.",
            "Taxes and insurance changed the cushion and now the payment increased.",
        ),
        (
            "I want the old and new disbursements compared line by line.",
            "What part is the shortage and what part is the new projection?",
        ),
    ),
    IssueSpec(
        "insurance_coverage",
        "escrow_insurance",
        (
            "I received a lender-placed insurance notice even though my policy is active.",
            "My carrier sent proof of coverage, but the loan still shows forced insurance.",
            "The homeowners policy renewed and I need the insurance record corrected.",
            "Why was an insurance premium added when I already have coverage?",
        ),
        (
            "The declaration page was faxed twice, yet the system says there is a coverage gap.",
            "I have continuous hazard protection and should not be charged for a backup policy.",
            "The insurer changed names, not coverage, but the mortgage file did not match it.",
        ),
        (
            "Can you verify the effective dates rather than reviewing the escrow amount?",
            "I need the duplicate policy charge removed after coverage is validated.",
        ),
    ),
    IssueSpec(
        "late_fee_dispute",
        "fees_documents",
        (
            "I paid within the grace period, so I am disputing this late fee.",
            "The statement added a delinquency charge even though the payment was on time.",
            "Why does the account show past due when I paid before the cutoff?",
            "I want the late charge reviewed before it affects credit reporting.",
        ),
        (
            "The installment arrived by the allowed date, but a penalty still appeared.",
            "Your history marks me delinquent even though the confirmation is dated the tenth.",
            "I am challenging the fee, not asking where the payment posted.",
        ),
        (
            "Please compare the receipt timestamp with the assessment date.",
            "I need a decision on whether the charge can be reversed.",
        ),
    ),
    IssueSpec(
        "payoff_quote",
        "fees_documents",
        (
            "My title company needs a payoff statement with a good-through date.",
            "I am refinancing and need an updated payoff quote for closing.",
            "The closing agent says the payoff amount expires before settlement.",
            "Please explain the fees and per-diem interest on the payoff document.",
        ),
        (
            "Settlement is next week and the title office needs the exact amount to retire the loan.",
            "The refinance wire depends on a demand statement valid through Friday.",
            "I need a fresh quote because daily interest changed the closing figure.",
        ),
        (
            "Can it be delivered securely to the title company today?",
            "I need confirmation of the expiration date and delivery method.",
        ),
    ),
)


APPROACH_LINES = {
    "ledger_walkthrough": {
        "train": (
            "I have the account ledger open. Let's trace the receipt, suspense entry, and application line by line.",
            "I will compare each transaction date and amount with you so we can locate the mismatch.",
            "We can reconcile the history from the first entry through the current balance.",
        ),
        "test": (
            "Let's audit the activity in order and match every debit to where it landed.",
            "I will work backward through the account movements until the numbers reconcile.",
        ),
    },
    "timeline_explanation": {
        "train": (
            "Here is the sequence: receipt today, overnight validation, and final posting by the second business day.",
            "I will explain what happens at each step and give you the date when the status should change.",
            "There are three stages, and I will put a date beside each one.",
        ),
        "test": (
            "Let me map the process from today's event to the expected completion point.",
            "I'll lay out the order of events and the deadline attached to each handoff.",
        ),
    },
    "teach_back": {
        "train": (
            "Before we finish, could you tell me in your own words what will happen next so I know I explained it clearly?",
            "Let me pause there. What is your understanding of the next step and timing?",
            "Could you repeat the plan back to me so I can correct anything unclear?",
        ),
        "test": (
            "Just to check my explanation, how would you describe the plan from here?",
            "Walk me through what you expect next, and I will fill in any gap.",
        ),
    },
    "case_ownership": {
        "train": (
            "I am opening case [CASE_ID], adding today's findings, and I will own the follow-up through the review date.",
            "I created a tracked request and documented the evidence so you will not need to start over.",
            "I will keep responsibility for this request and update the notes after review.",
        ),
        "test": (
            "This is now assigned to me under reference [CASE_ID], and I will carry it to the next checkpoint.",
            "I am putting my name on the request and preserving the full history for whoever touches it next.",
        ),
    },
    "document_request": {
        "train": (
            "Please upload the dated confirmation or declaration page; the review team needs that document to decide the request.",
            "The next step is to send the supporting record through the secure portal for validation.",
            "We need a copy of the source document before the analyst can complete the review.",
        ),
        "test": (
            "Send the proof through the protected link so the examiner can verify the dates.",
            "The reviewer cannot make the correction until we receive the supporting paperwork.",
        ),
    },
    "policy_citation": {
        "train": (
            "Under the servicing guideline, the account follows the stated cutoff and review window.",
            "The written policy requires the transaction to complete validation before the status changes.",
            "The loan terms set the condition I am applying to this request.",
        ),
        "test": (
            "The governing rule says this event is measured against the effective-date requirement.",
            "I am applying the published servicing standard to determine eligibility.",
        ),
    },
    "generic_reassurance": {
        "train": (
            "I understand the concern. It should be okay, so please allow more time.",
            "I am sorry this is frustrating, but the system usually works itself out.",
            "I would not worry yet; these things generally settle down.",
        ),
        "test": (
            "I hear you, and I am sure it will probably sort itself out soon.",
            "Try not to be concerned; it normally becomes fine without another action.",
        ),
    },
    "warm_transfer": {
        "train": (
            "I have briefed the specialist and will stay on the line while I connect you, so you do not repeat the story.",
            "I am transferring you to the escalation desk with my notes and the documents already attached.",
            "The next representative has my summary, and I will introduce the situation before I leave.",
        ),
        "test": (
            "I have brought the advanced-support colleague up to speed and will remain here for the handoff.",
            "The next-level team is ready, with your history in front of them, and I am joining the connection.",
        ),
    },
}


OUTCOME_LINES = {
    "resolved": {
        "train": (
            "Customer: Okay, I can see the correction now. That answers this part.",
            "Customer: That makes sense, and I do not need anything else on this issue.",
        ),
        "test": ("Customer: That's clear now; we can close that item.",),
    },
    "follow_up": {
        "train": (
            "Customer: I understand the next step, but this item is still open until the review finishes.",
            "Customer: All right, I will wait for the case decision; it is not resolved today.",
        ),
        "test": ("Customer: So the investigation has to finish before we know the answer.",),
    },
    "unresolved": {
        "train": (
            "Customer: No, that does not answer what I asked. This part is still unresolved.",
            "Customer: I am still missing a clear answer on this issue.",
        ),
        "test": ("Customer: We are in the same place as when we started on this item.",),
    },
    "escalated": {
        "train": (
            "Customer: Please connect me to the specialist; we have not settled this issue here.",
            "Customer: I will continue with the escalation because this part remains open.",
        ),
        "test": ("Customer: Let's have the next-level team take it from here.",),
    },
}


RESOLUTION_PROBABILITY = {
    "teach_back": 0.82,
    "ledger_walkthrough": 0.77,
    "timeline_explanation": 0.71,
    "case_ownership": 0.64,
    "document_request": 0.54,
    "policy_citation": 0.47,
    "generic_reassurance": 0.25,
    "warm_transfer": 0.18,
}


def _choose_outcome(approach: str, rng: Random) -> str:
    draw = rng.random()
    if draw < RESOLUTION_PROBABILITY[approach]:
        return "resolved"
    if approach == "warm_transfer" or draw > 0.93:
        return "escalated"
    if draw < 0.82:
        return "follow_up"
    return "unresolved"


def _asr_variant(text: str, rng: Random) -> str:
    if rng.random() > 0.22:
        return text
    replacements = (("mortgage", "mort gage"), ("autopay", "auto pay"), ("good-through", "good through"))
    for source, target in replacements:
        text = text.replace(source, target)
    return "um " + text[0].lower() + text[1:].replace(",", "")


def _issue_sequence(index: int, rng: Random) -> list[IssueSpec]:
    primary = ISSUES[index % len(ISSUES)]
    mode = index % 6
    if mode in {0, 1, 2}:
        return [primary]
    others = [issue for issue in ISSUES if issue.label != primary.label]
    second = rng.choice(others)
    if mode == 5:
        third = rng.choice([issue for issue in others if issue.label != second.label])
        return [primary, second, third]
    return [primary, second]


def build_corpus(count: int = 144, seed: int = 4000) -> list[dict]:
    rng = Random(seed)
    approach_names = tuple(APPROACH_LINES)
    rows: list[dict] = []
    for index in range(count):
        call_number = index + 1
        split = "test" if call_number % 5 == 0 else "train"
        issues = _issue_sequence(index, rng)
        turns = [
            {"speaker": "Agent", "text": rng.choice(("Thank you for calling mortgage servicing. How may I help?", "Mortgage servicing, this is Jordan. What can I look into today?"))},
            {"speaker": "Customer", "text": rng.choice(("Hi, I have a question about my account.", "Yeah, I need help understanding something on the loan."))},
            {"speaker": "Agent", "text": "Before I access account details, may I verify the property ZIP and the last four digits?"},
            {"speaker": "Customer", "text": "Yes, I can verify that."},
        ]
        segments = []
        challenge_types = {"held_out_paraphrase" if split == "test" else "training_language"}
        if len(issues) > 1:
            challenge_types.add("multiple_problems")
        else:
            challenge_types.add("single_problem")
        if len(issues) == 1 and call_number % 3 == 0:
            challenge_types.add("one_long_problem")

        for segment_index, issue in enumerate(issues, start=1):
            if segment_index > 1:
                transition = rng.choice(("There is one other thing on the account.", "While I have you, I need help with a separate item."))
                turns.append({"speaker": "Customer", "text": transition})
            opening_pool = issue.test_openings if split == "test" else issue.train_openings
            start_turn = len(turns)
            turns.append({"speaker": "Customer", "text": _asr_variant(rng.choice(opening_pool), rng), "gold_issue": issue.label})
            if "one_long_problem" in challenge_types:
                turns.append({"speaker": "Customer", "text": rng.choice(issue.followups), "gold_issue": issue.label})
            turns.append({"speaker": "Agent", "text": rng.choice(("Let me pull up the detailed history.", "Give me a moment while I review the account notes.")), "gold_issue": issue.label})
            approach = approach_names[(index * 3 + segment_index * 5) % len(approach_names)]
            approach_turn = len(turns)
            turns.append({"speaker": "Agent", "text": rng.choice(APPROACH_LINES[approach][split]), "gold_issue": issue.label, "gold_approach": approach})
            outcome = _choose_outcome(approach, rng)
            outcome_turn = len(turns)
            speaker, text = rng.choice(OUTCOME_LINES[outcome][split]).split(": ", 1)
            turns.append({"speaker": speaker, "text": text, "gold_issue": issue.label, "gold_outcome": outcome})
            end_turn = len(turns) - 1
            segments.append(
                {
                    "segment_id": f"SYN-{call_number:04d}-SEG-{segment_index:02d}",
                    "issue_label": issue.label,
                    "confound_group": issue.confound_group,
                    "start_turn": start_turn,
                    "end_turn": end_turn,
                    "agent_approach": approach,
                    "outcome": outcome,
                    "approach_evidence_turns": [approach_turn],
                    "resolution_evidence_turns": [outcome_turn],
                }
            )
        turns.extend(
            [
                {"speaker": "Agent", "text": "Is there anything else I can help with today?"},
                {"speaker": "Customer", "text": "No, that covers everything we discussed."},
                {"speaker": "Agent", "text": "Thank you for calling. Take care."},
            ]
        )
        rows.append(
            {
                "schema_version": "1.0",
                "call_id": f"SYN-{call_number:04d}",
                "split": split,
                "challenge_types": sorted(challenge_types),
                "metadata": {
                    "agent_id": f"AGENT-{(index % 18) + 1:03d}",
                    "queue": "mortgage_servicing",
                    "channel": "voice_transcript",
                    "synthetic": True,
                    "seed": seed,
                },
                "turns": [{"turn_id": turn_index, **turn} for turn_index, turn in enumerate(turns)],
                "segments": segments,
                "transcript": "\n".join(f"{turn['speaker']}: {turn['text']}" for turn in turns),
            }
        )
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(row, ensure_ascii=True) for row in rows) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the model-agnostic Call Insights evaluation corpus.")
    parser.add_argument("--output", type=Path, default=Path("data/evaluation/call_insights_benchmark.jsonl"))
    parser.add_argument("--count", type=int, default=144)
    parser.add_argument("--seed", type=int, default=4000)
    args = parser.parse_args()
    rows = build_corpus(args.count, args.seed)
    write_jsonl(args.output, rows)
    print(f"Wrote {len(rows)} synthetic calls to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
